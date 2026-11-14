// Seeing and deciding.
//
// The eye reports how far away the next obstacle is; a row of visual neuron pools is tuned
// to different distances. A basal-ganglia loop decides whether to give the "lift the feet
// higher" command: striatal cells that are driven strongly enough silence the tonically
// active pallidum, which releases the thalamus, which drives the command (direct pathway).
// The creature is born undecided (the synapses start at half strength). Which visual signals
// drive the striatum is learned: the synapses from the visual pools
// to the striatum are plastic and guided by dopamine, with random trial actions coming
// from the exploration nucleus.
import { Network, NT, Pop, Proj } from './network';
import type { SpinalCord } from './spinal';
import { currentForRate } from './spinal';
import { gaussian } from '../util/rng';

/** preferred obstacle distances of the visual pools [m] */
export const EYE_DISTANCES = [0.3, 0.6, 0.9, 1.3];
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const DEC_EX_W = Number(env.DEC_EX_W ?? 0.45);
const STR_BIAS = Number(env.STR_BIAS ?? 0.5);
const EX_TAU = 1500; // ms: a trial action lasts about as long as it takes to pass an obstacle

export class Decision {
  readonly visual: Pop[] = [];
  readonly striatum: Pop;
  readonly pallidum: Pop;
  readonly thalamus: Pop;
  readonly explorer: Pop;
  /** plastic visual → striatum projections, one per distance pool */
  readonly proj: Proj[] = [];
  /** what the eye currently sees: distance to the next obstacle [m] (Infinity = nothing) and its height */
  seenDistance = Infinity;
  seenHeight = 0;
  exploreGain = 1;
  private x = 0;

  constructor(readonly net: Network, readonly spinal: SpinalCord, opt: { learn: boolean; lr: number; n: number }) {
    const n = opt.n;
    for (let k = 0; k < EYE_DISTANCES.length; k++) {
      this.visual.push(net.addPop({ name: `V_${EYE_DISTANCES[k]}m`, n, type: NT.RELAY, region: 'visual', bias: 2.0, biasJitter: 0.6, noise: 2 }));
    }
    this.striatum = net.addPop({ name: 'STR_step', n: 2 * n, type: NT.RELAY, region: 'basal', bias: STR_BIAS, biasJitter: 1.5, noise: 2.5, inhibitory: true });
    this.pallidum = net.addPop({ name: 'GPi_step', n, type: NT.FS, region: 'basal', bias: 8, biasJitter: 1, noise: 2, inhibitory: true });
    this.thalamus = net.addPop({ name: 'THAL_step', n, type: NT.RELAY, region: 'basal', bias: 8, biasJitter: 1, noise: 2 });
    this.explorer = net.addPop({ name: 'EX_step', n: 8, type: NT.RELAY, region: 'explore', bias: 2.0, biasJitter: 0.6, noise: 2 });
    const wMature = 20 / (n * 0.5);
    for (const v of this.visual) {
      this.proj.push(
        net.connect({
          pre: v, post: this.striatum, channel: 'E', p: 0.5, w: 0.5 * wMature, wJitter: 0.3, delay: [2, 5],
          plastic: opt.learn ? { rule: 'perturb', lr: opt.lr * wMature, tauE: 2000, wMin: 0, wMax: 1.5 * wMature } : undefined,
        }),
      );
    }
    if (opt.learn) net.connect({ pre: this.explorer, post: this.striatum, channel: 'X', p: 1, w: DEC_EX_W, wJitter: 0.2, delay: [1, 3] });
    net.connect({ pre: this.striatum, post: this.pallidum, channel: 'I', p: 0.5, w: 30 / (2 * n * 0.5), wJitter: 0.3, delay: [1, 3] });
    net.connect({ pre: this.pallidum, post: this.thalamus, channel: 'I', p: 0.5, w: 40 / (n * 0.5), wJitter: 0.3, delay: [1, 3] });
    net.connect({ pre: this.thalamus, post: spinal.stepCmd, channel: 'E', p: 0.5, w: 34 / (n * 0.5), wJitter: 0.3, delay: [1, 3] });
  }

  step(): void {
    const iext = this.net.iext;
    // the eye: each pool responds best to "its" distance, more strongly to taller obstacles
    const d = this.seenDistance;
    const salience = Math.min(1, this.seenHeight / 0.05);
    for (let k = 0; k < this.visual.length; k++) {
      const c = EYE_DISTANCES[k];
      const width = 0.35 * c + 0.1;
      const resp = Number.isFinite(d) ? salience * Math.exp(-0.5 * ((d - c) / width) ** 2) : 0;
      const cur = currentForRate(90 * resp);
      const v = this.visual[k];
      for (let i = v.start; i < v.end; i++) iext[i] = cur;
    }
    // trial actions
    const kk = 1 / EX_TAU;
    this.x += -this.x * kk + Math.sqrt(2 * kk) * gaussian(this.net.rng);
    // trial actions are only tried when there is something to decide about
    let rate = 30 * (1 + (Number.isFinite(d) ? this.exploreGain * this.x : 0));
    if (rate < 0) rate = 0;
    else if (rate > 90) rate = 90;
    const cur = currentForRate(rate);
    for (let i = this.explorer.start; i < this.explorer.end; i++) iext[i] = cur;
  }

  /** learned strength with which each distance pool drives the striatum (1 = fully committed) */
  weights(): number[] {
    return this.proj.map((p) => p.meanWeight() / (20 / (this.visual[0].n * 0.5)));
  }
}
