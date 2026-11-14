// Prediction: a forward model of the creature's own senses.
//
// Four pools of cortical cells try to fire exactly like four sensory signals (trunk tilting
// forward, trunk tilting back, load on the left foot, load on the right foot) – but they only
// get to see what was felt and done 50 ms earlier. Their input synapses learn with a delta
// rule: each presynaptic spike moves the synapse a little in the direction of the current
// prediction error of its target cell. Once the model has learned the normal rhythm of
// walking, a large prediction error means that something unexpected is happening (a shove,
// a stumble), and that is what drives the surprise signal to the hormone system.
import { Network, NT, Pop, Proj } from './network';
import type { SpinalCord } from './spinal';

const TARGETS = ['VestF', 'VestB', 'Load_0', 'Load_1'];
/** the mean error for the display and the old alarm is taken over these first senses only */
const N_CLASSIC = TARGETS.length;
const LOOKAHEAD: [number, number] = [45, 55]; // ms
const N = 32;

export class Predictor {
  readonly pops: Pop[] = [];
  readonly targets: Pop[] = [];
  /** all input projections of the prediction cells (senses and motor commands of 50 ms ago) */
  readonly inputs: Proj[] = [];
  /** current prediction error per signal (actual minus predicted rate, in units of 100 Hz) */
  readonly error = new Float32Array(16);
  /** mean absolute prediction error, smoothed over 100 ms */
  spe = 0;
  /** what the error usually is (slow average) */
  usual = 0.2;
  /** the error just rose far above its usual level */
  surprised = false;
  private refractory = 0;

  /** false freezes the model (control experiments) */
  learning = true;
  private readonly sources: Pop[];

  constructor(readonly net: Network, spinal: SpinalCord, private readonly learn: boolean, private readonly lr = 2e-4) {
    this.sources = [...net.pops.filter((p) => p.region === 'afferent'), ...spinal.mn];
    for (const name of TARGETS) this.addTarget(net.pop(name));
  }

  /** let the model predict one more sense (must be called before the network is built);
   *  `extraSources` are further populations it may use for all senses added from now on */
  addTarget(target: Pop, extraSources: Pop[] = []): Pop {
    this.sources.push(...extraSources);
    const pop = this.net.addPop({ name: `Vorhersage_${target.name}`, n: N, type: NT.RELAY, region: 'cortex', bias: 1.0, biasJitter: 1.0, noise: 2 });
    this.pops.push(pop);
    this.targets.push(target);
    for (const src of this.sources) {
      this.inputs.push(
        this.net.connect({
          pre: src, post: pop, channel: 'E', p: 0.25, w: 0.01, wJitter: 0.5, delay: LOOKAHEAD,
          // delta rule through the teaching-signal variable: w += lr * error
          plastic: this.learn ? { rule: 'cf', ltp: 0, ltd: -this.lr, wMin: 0, wMax: 0.5 } : undefined,
        }),
      );
    }
    return pop;
  }

  step(asleep: boolean): void {
    const cf = this.net.cf;
    let sum = 0;
    for (let j = 0; j < this.pops.length; j++) {
      const p = this.pops[j];
      const e = asleep ? 0 : (this.targets[j].rate - p.rate) / 100;
      this.error[j] = e;
      if (j < N_CLASSIC) sum += Math.abs(e);
      const teach = this.learning ? e : 0;
      for (let i = p.start; i < p.end; i++) cf[i] = teach;
    }
    if (asleep) {
      this.surprised = false;
      return;
    }
    this.spe += (sum / N_CLASSIC - this.spe) * 0.01;
    this.usual += (this.spe - this.usual) * (1 / 30000);
    this.surprised = false;
    if (this.refractory > 0) this.refractory--;
    else if (this.spe > 1.8 * this.usual + 0.04) {
      this.surprised = true;
      this.refractory = 600;
    }
  }
}
