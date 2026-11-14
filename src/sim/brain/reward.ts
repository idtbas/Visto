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

  /** @param reward continuous reward rate; @param context index of the current behavioural context */
  step(reward: number, context: number): void {
    // pulses are paid out with a time constant of 150 ms
    const pay = this.pulse / 150;
    this.pulse -= pay;
    const r = reward + pay * 1000;
    const exp = this.expected[context];
    this.rpe = r - exp;
    this.expected[context] = exp + (r - exp) / 20000;
    let cur = DA_GAIN * this.rpe;
    if (cur > 40) cur = 40;
    else if (cur < -DA_BIAS - 4) cur = -DA_BIAS - 4;
    const iext = this.net.iext;
    for (let i = this.vta.start; i < this.vta.end; i++) iext[i] = cur;
    this.conc += this.vta.count / N_DA - this.conc / TAU_DA;
    this.tonic += (this.conc - this.tonic) / 30000;
    this.level = (this.conc - this.tonic) / this.tonic;
    this.net.dopamine = this.level;
  }
}
