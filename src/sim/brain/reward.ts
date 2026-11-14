// The reward system: dopamine neurons report whether things are going better or worse
// than expected. Their activity is broadcast to all plastic synapses.
import { Network, NT, Pop } from './network';

const N_DA = 80;
const DA_BIAS = 4.5; // gives a tonic rate of about 9 Hz
const DA_GAIN = 9; // input current per unit of reward prediction error
const TAU_DA = 80; // ms, clearance of dopamine

export class RewardSystem {
  readonly vta: Pop;
  /** dopamine concentration relative to its tonic level: 0 = as expected */
  level = 0;
  /** reward prediction error that drives the dopamine neurons */
  rpe = 0;
  /** expected reward, separately for each behavioural context */
  readonly expected: number[] = [0, 0, 0];
  private conc = 0;
  private tonic = (9 / 1000) * TAU_DA;
  /** pending reward pulses (cookies, pain) that are paid out over a short time */
  private pulse = 0;

  constructor(readonly net: Network) {
    this.vta = net.addPop({ name: 'VTA', n: N_DA, type: NT.RS, region: 'vta', bias: DA_BIAS, biasJitter: 1, noise: 2 });
  }

  /** a discrete reward (positive) or punishment (negative) */
  give(amount: number): void {
    this.pulse += amount;
  }

  /** @param reward continuous reward rate; @param context index of the current behavioural context;
   *  @param surprise reward that is already relative to expectation (bypasses the baseline);
   *  @param pain cost of the pain that is being felt (per second). It counts as "worse than
   *  expected" but is not turned into current here: it reaches the dopamine neurons through
   *  their inhibitory synapses from the pain pathway. */
  step(reward: number, context: number, surprise = 0, pain = 0): void {
    // pulses are paid out with a time constant of 150 ms
    const pay = this.pulse / 150;
    this.pulse -= pay;
    const r = reward + pay * 1000;
    // context 2 (lying on the ground) carries no expectation: pain is always worse than expected
    const exp = context === 2 ? 0 : this.expected[context];
    this.rpe = r - exp + surprise - pain;
    if (context !== 2) this.expected[context] = exp + (r - exp) / 20000;
    let cur = DA_GAIN * (this.rpe + pain);
    if (cur > 40) cur = 40;
    else if (cur < -DA_BIAS - 4) cur = -DA_BIAS - 4;
    const iext = this.net.iext;
    for (let i = this.vta.start; i < this.vta.end; i++) iext[i] = cur;
    this.conc += this.vta.count / N_DA - this.conc / TAU_DA;
    this.tonic += (this.conc - this.tonic) / (this.fastBaseline ? 6000 : 30000);
    this.level = (this.conc - this.tonic) / this.tonic;
    if (this.shamDelay > 0) {
      // control experiment: the synapses receive the dopamine signal of `shamDelay` ticks ago.
      // It has the same statistics but no longer says anything about what was just done.
      if (!this.shamBuf) this.shamBuf = new Float32Array(this.shamDelay);
      const k = this.shamIdx++ % this.shamDelay;
      this.net.dopamine = this.shamBuf[k];
      this.shamBuf[k] = this.level;
    } else this.net.dopamine = this.level;
  }

  /** let the tonic level follow quickly (between replays in sleep) */
  fastBaseline = false;
  shamDelay = 0;
  private shamBuf: Float32Array | null = null;
  private shamIdx = 0;
}
