// The body model: what do I feel because of what I do, and what comes from outside?
//
// The forward model (predict.ts) predicts four of the creature's own senses from what it
// felt and what it commanded to its muscles 50 ms earlier. Here that prediction is compared
// with what is actually felt – by neurons, not by a subtraction in code:
//
//   "felt more than expected"  = sensory cells excite, prediction cells inhibit
//   "felt less than expected"  = prediction cells excite, sensory cells inhibit
//
// Whatever the forward model has learned to predict is cancelled; in a creature that knows
// its body, that is everything it causes itself (reafference). What is left over is, by
// exclusion, what came from outside (exafference). The pool "Fremdeinwirkung" collects all
// mismatch cells. Its excitability adapts slowly so that the everyday level of mismatch
// leaves it almost silent; it fires when the body feels clearly different from what its own
// commands predicted.
//
// For this the creature also gets a sense it did not have before: the otolith organs of the
// inner ear, which feel the head being accelerated forwards or backwards. Its own steps
// jolt the head too – those jolts can be predicted from what the legs are doing; a shove
// from outside cannot.
//
// Each kind of mismatch is judged by its own standards (precision weighting): the cells for
// every sense slowly adjust their excitability until they are nearly silent at the level of
// mismatch that is usual for that sense. A sense that is predicted poorly therefore does
// not drown out a small but unusual deviation in a sense that is predicted well.
//
// Nothing here is told which events are external. The distinction is only as good as the
// forward model, and it develops as that model learns.
import { Network, NT, Pop, Proj } from './network';
import type { Predictor } from './predict';
import { currentForRate, type SpinalCord } from './spinal';
import { Vec2 } from 'planck';
import { GEOM, type Biped } from '../body/biped';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const N_ERR = 16;
const N_EXT = 48;
/** inhibitory strength that cancels an equal excitatory rate (measured for these pools) */
const K_SUB = 9;
/** the mismatch pool should fire at about this rate on average [Hz] */
const HOMEOSTASIS_TARGET = 3;
/** every group of mismatch cells settles at about this rate for its usual mismatch [Hz] */
const MISMATCH_TARGET = Number(env.BM_MT ?? 4);
const K_EXT = Number(env.BM_KEXT ?? 12);
/** head acceleration at which the otolith cells fire at 100 Hz [m/s²] */
const OTO_SCALE = Number(env.BM_OTO ?? 10);
const OTO_TAU = Number(env.BM_TAU ?? 80); // ms: the organ answers to a change of speed over about this time, not to a single jolt

export class BodyModel {
  /** per predicted sense: cells that fire when more / less is felt than was predicted */
  readonly more: Pop[] = [];
  readonly less: Pop[] = [];
  /** unexplained sensation: by exclusion, what did not come from the creature itself */
  readonly external: Pop;
  /** 0 = everything is as predicted, 1 = strong unexplained sensation */
  externalLevel = 0;
  /** mean rate of the mismatch cells [Hz], smoothed over a second: how well the body is understood right now */
  mismatch = 0;
  /** share of the commands to the muscles in the prediction, as currently wired (lesion experiments) */
  efference = true;
  /** otolith organs: head accelerated forwards / backwards */
  readonly otolith: Pop[] = [];
  /** current head acceleration as felt [m/s²], smoothed */
  acceleration = 0;
  private prevV = NaN;
  private readonly headPoint = new Vec2(0, GEOM.trunkLen - 0.1);
  private readonly efferenceProjs: Proj[];
  private readonly outputs: Proj[] = [];
  private drive = 0;

  constructor(readonly net: Network, readonly predictor: Predictor, spinal: SpinalCord, readonly biped: Biped) {
    for (const name of ['OtoVor', 'OtoRück']) this.otolith.push(net.addPop({ name, n: 32, type: NT.RELAY, region: 'afferent', bias: 2.0, biasJitter: 0.6, noise: 2 }));
    // the forward model learns to predict the new sense as well, and may use its recent past
    predictor.addTarget(this.otolith[0], this.otolith);
    predictor.addTarget(this.otolith[1]);
    const pool = (name: string, n: number, inhibitory = false): Pop =>
      net.addPop({ name, n, type: inhibitory ? NT.FS : NT.RELAY, region: 'bodymodel', bias: inhibitory ? 0.5 : 1.0, biasJitter: 0.8, noise: 2, inhibitory });
    const link = (pre: Pop, post: Pop, channel: 'E' | 'I', k: number): Proj =>
      net.connect({ pre, post, channel, p: 0.5, w: k / (pre.n * 0.5), wJitter: 0.3, delay: [1, 3] });
    this.external = pool('Fremdeinwirkung', N_EXT);
    predictor.pops.forEach((pred, j) => {
      const sense = predictor.targets[j];
      const tag = sense.name;
      const predI = pool(`erwartet_i_${tag}`, N_ERR, true);
      const senseI = pool(`gespürt_i_${tag}`, N_ERR, true);
      const more = pool(`mehr_als_erwartet_${tag}`, N_ERR);
      const less = pool(`weniger_als_erwartet_${tag}`, N_ERR);
      link(pred, predI, 'E', 20);
      link(sense, senseI, 'E', 20);
      link(sense, more, 'E', 20);
      link(predI, more, 'I', K_SUB);
      link(pred, less, 'E', 20);
      link(senseI, less, 'I', K_SUB);
      this.outputs.push(link(more, this.external, 'E', K_EXT), link(less, this.external, 'E', K_EXT));
      this.more.push(more);
      this.less.push(less);
    });
    const mn = new Set(spinal.mn);
    this.efferenceProjs = predictor.inputs.filter((pr) => mn.has(pr.pre));
  }

  /** read the otolith organs; call before the network is advanced */
  sense(): void {
    const v = this.biped.trunk.getLinearVelocityFromLocalPoint(this.headPoint).x;
    // (being picked up and set down by the helping hand is not felt: see reset())
    const a = Number.isNaN(this.prevV) ? 0 : (v - this.prevV) * 1000;
    this.prevV = v;
    this.acceleration += (a - this.acceleration) / OTO_TAU;
    const x = this.acceleration / OTO_SCALE;
    const iext = this.net.iext;
    const fwd = currentForRate(100 * Math.min(1.5, Math.max(0, x)));
    const back = currentForRate(100 * Math.min(1.5, Math.max(0, -x)));
    for (let i = this.otolith[0].start; i < this.otolith[0].end; i++) iext[i] = fwd;
    for (let i = this.otolith[1].start; i < this.otolith[1].end; i++) iext[i] = back;
  }

  /** the body has been put somewhere else by hand */
  reset(): void {
    this.prevV = NaN;
    this.acceleration = 0;
  }

  step(asleep: boolean): void {
    let sum = 0;
    for (let j = 0; j < this.more.length; j++) sum += this.more[j].rate + this.less[j].rate;
    this.mismatch += (sum / (2 * this.more.length) - this.mismatch) / 1000;
    const ext = this.external;
    this.externalLevel = Math.min(1, ext.rate / 60);
    // slow adaptation of the pool's excitability (intrinsic plasticity): whatever level of
    // mismatch is normal for this body at its present skill stops being remarkable
    if (!asleep && (this.net.t & 31) === 0) {
      for (let j = 0; j < this.more.length; j++) {
        for (const p of [this.more[j], this.less[j]]) {
          let d = p.drive - 0.002 * (p.rate - MISMATCH_TARGET);
          if (d > 1) d = 1;
          else if (d < -15) d = -15;
          p.drive = d;
        }
      }
      this.drive -= 0.0008 * (ext.rate - HOMEOSTASIS_TARGET);
      if (this.drive > 2) this.drive = 2;
      else if (this.drive < -12) this.drive = -12;
      ext.drive = this.drive;
    }
  }

  /** lesion: cut the copies of the motor commands out of the prediction (or put them back) */
  setEfference(on: boolean): void {
    this.efference = on;
    for (const pr of this.efferenceProjs) pr.gain = on ? 1 : 0;
  }

  /** lesion: the mismatch no longer reaches anything */
  setOutput(on: boolean): void {
    for (const pr of this.outputs) pr.gain = on ? 1 : 0;
  }

  /** the learned excitabilities (what counts as usual), for saving */
  saveDrive(): number[] {
    return [this.drive, ...this.more.map((p) => p.drive), ...this.less.map((p) => p.drive)];
  }
  loadDrive(v: number[]): void {
    const n = this.more.length;
    if (v.length !== 1 + 2 * n) return;
    this.drive = v[0];
    this.external.drive = v[0];
    this.more.forEach((p, j) => (p.drive = v[1 + j]));
    this.less.forEach((p, j) => (p.drive = v[1 + n + j]));
  }
}
