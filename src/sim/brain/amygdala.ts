// The amygdala: learns what comes before pain.
//
// Its cells read the body-sense cortex through plastic synapses. Whenever pain sets in
// unexpectedly, the synapses from cortex cells that were unusually active in the half second
// before are strengthened; when the cells fire and no pain follows, those synapses are
// weakened again (extinction). After a while the cells fire when the body gets into a
// situation that used to end in pain – before it hurts.
//
// What matters for learning is not the expectation itself but how it changes. A small
// circuit compares the expectation with a sluggish copy of itself:
//   "danger rising"  = expectation minus sluggish copy  → silences the dopamine neurons
//   "danger falling" = sluggish copy minus expectation  → excites them (relief)
// A steady expectation cancels out. So the synapses that just steered the body into trouble
// are weakened at that moment, not only when it hits the ground, and getting out of trouble
// without pain is rewarded.
import { Network, NT, Pop, Proj } from './network';
import type { BodyCortex } from './cortex';
import type { Pain } from './pain';

const N = 128;
const N_SMALL = 32;
/** firing rate that counts as "pain is certain" [Hz] */
const FULL = 80;
/** how strongly unfulfilled expectation unlearns, relative to how strongly pain teaches */
const EXTINCTION = 0.25;
/** numeric cost per second of danger rising at full rate, for the bookkeeping of the reward system */
const COST = 2.0;
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** strength of the amygdala's influence on dopamine (0 = it only watches) */
const AMY_DA = Number(env.AMY_DA ?? 1);
const K_SLOW = Number(env.AMY_KS ?? 3.4);
const K_SUB = Number(env.AMY_SUB ?? 9);
const LR = Number(env.AMY_LR ?? 2e-4);

export class Amygdala {
  readonly cells: Pop;
  /** fast inhibitory copy, sluggish copy and its inhibitory partner */
  readonly fastI: Pop;
  readonly slow: Pop;
  readonly slowI: Pop;
  readonly rising: Pop;
  readonly falling: Pop;
  readonly inputs: Proj[] = [];
  /** expected pain 0..1 */
  danger = 0;
  /** change of the expectation as a reward rate (negative = danger rising) */
  td = 0;
  learning = true;
  private painSlow = 0;

  constructor(readonly net: Network, cortex: BodyCortex, readonly pain: Pain, vta: Pop, learn: boolean) {
    const pool = (name: string, n: number, inhibitory = false, bias = 1.0): Pop =>
      net.addPop({ name, n, type: inhibitory ? NT.FS : NT.RELAY, region: 'amygdala', bias, biasJitter: 0.8, noise: 2, inhibitory });
    this.cells = pool('Mandelkern', N, false, 0.5);
    this.fastI = pool('Mandelkern_i', N_SMALL, true, 0.5);
    this.slow = pool('Gefahr_träge', N_SMALL);
    this.slowI = pool('Gefahr_träge_i', N_SMALL, true, 0.5);
    this.rising = pool('Gefahr_steigt', N_SMALL);
    this.falling = pool('Gefahr_sinkt', N_SMALL);
    for (const area of cortex.areas) {
      this.inputs.push(
        net.connect({
          pre: area, post: this.cells, channel: 'E', p: 0.15, w: 0.002, wJitter: 0.5, delay: [2, 6],
          plastic: learn ? { rule: 'trace', lr: LR, tauE: 400, wMin: 0, wMax: 1.0 } : undefined,
        }),
      );
    }
    const link = (pre: Pop, post: Pop, channel: 'E' | 'I' | 'S', k: number): void => {
      net.connect({ pre, post, channel, p: 0.5, w: k / (pre.n * 0.5), wJitter: 0.3, delay: [1, 3] });
    };
    link(this.cells, this.fastI, 'E', 20);
    link(this.cells, this.slow, 'S', K_SLOW);
    link(this.slow, this.slowI, 'E', 20);
    // rising = expectation − sluggish copy
    link(this.cells, this.rising, 'E', 20);
    link(this.slowI, this.rising, 'I', K_SUB);
    // falling = sluggish copy − expectation
    link(this.slow, this.falling, 'E', 20);
    link(this.fastI, this.falling, 'I', K_SUB);
    if (AMY_DA > 0) {
      link(this.rising, pain.rmtg, 'E', 30 * AMY_DA);
      link(this.falling, vta, 'E', 20 * AMY_DA);
    }
  }

  step(asleep: boolean): void {
    const d = Math.min(1.5, this.cells.rate / FULL);
    this.danger = d;
    this.td = asleep ? 0 : (AMY_DA * COST * (this.falling.rate - this.rising.rate)) / FULL;
    // teaching signal: the onset of pain, minus what was expected anyway. Only the onset
    // counts, so that what is learned is what came before the pain, not what lying on the
    // ground feels like.
    const p = Math.min(1.5, this.pain.relay.rate / FULL);
    this.painSlow += (p - this.painSlow) / 150;
    const onset = p > this.painSlow ? 2 * (p - this.painSlow) : 0;
    const mod = asleep || !this.learning ? 0 : onset > d ? onset - d : p > 0.1 ? 0 : -EXTINCTION * d;
    for (const pr of this.inputs) pr.mod = mod;
  }
}
