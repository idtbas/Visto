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
const LOOKAHEAD: [number, number] = [45, 55]; // ms
const N = 32;

export class Predictor {
  readonly pops: Pop[] = [];
  readonly targets: Pop[] = [];
  private readonly projs: Proj[] = [];
  /** current prediction error per signal (actual minus predicted rate, in units of 100 Hz) */
  readonly error = new Float32Array(TARGETS.length);
  /** mean absolute prediction error, smoothed over 100 ms */
  spe = 0;
  /** what the error usually is (slow average) */
  usual = 0.2;
  /** the error just rose far above its usual level */
  surprised = false;
  private refractory = 0;

  constructor(readonly net: Network, spinal: SpinalCord, learn: boolean, lr = 2e-4) {
    const sources = [...net.pops.filter((p) => p.region === 'afferent'), ...spinal.mn];
    for (const name of TARGETS) {
      const target = net.pop(name);
      const pop = net.addPop({ name: `Vorhersage_${name}`, n: N, type: NT.RELAY, region: 'cortex', bias: 1.0, biasJitter: 1.0, noise: 2 });
      this.pops.push(pop);
      this.targets.push(target);
      for (const src of sources) {
        this.projs.push(
          net.connect({
            pre: src, post: pop, channel: 'E', p: 0.25, w: 0.01, wJitter: 0.5, delay: LOOKAHEAD,
            // delta rule through the teaching-signal variable: w += lr * error
            plastic: learn ? { rule: 'cf', ltp: 0, ltd: -lr, wMin: 0, wMax: 0.5 } : undefined,
          }),
        );
      }
    }
  }

  step(asleep: boolean): void {
    const cf = this.net.cf;
    let sum = 0;
    for (let j = 0; j < this.pops.length; j++) {
      const p = this.pops[j];
      const e = asleep ? 0 : (this.targets[j].rate - p.rate) / 100;
      this.error[j] = e;
      sum += Math.abs(e);
      for (let i = p.start; i < p.end; i++) cf[i] = e;
    }
    if (asleep) {
      this.surprised = false;
      return;
    }
    this.spe += (sum / this.pops.length - this.spe) * 0.01;
    this.usual += (this.spe - this.usual) * (1 / 30000);
    this.surprised = false;
    if (this.refractory > 0) this.refractory--;
    else if (this.spe > 1.8 * this.usual + 0.04) {
      this.surprised = true;
      this.refractory = 600;
    }
  }
}
