// Interoception: nerve cells that report the state of the body's own household.
//
// Until now the hormone levels acted on the nervous system only as multipliers in code.
// These cells make three of the internal states available as neural activity, so that they
// can compete for the global workspace like any other content:
//   hunger     – the energy store is running low
//   tiredness  – sleep pressure
//   exhaustion – the muscles are fatigued
// Like the pain receptors they are sensors: the body sets their input, the rest is spikes.
import { Network, NT, Pop } from './network';
import { currentForRate } from './spinal';

export const NEEDS = ['Hunger', 'Müdigkeit', 'Erschöpfung'] as const;

export class Interoception {
  readonly pops: Pop[] = [];
  /** current level of each need, 0..1 (the input of the cells) */
  readonly level = new Float32Array(NEEDS.length);
  /** experiments can set a level by hand (NaN = take it from the body) */
  readonly override = new Float32Array(NEEDS.length).fill(NaN);

  constructor(readonly net: Network) {
    for (const name of NEEDS) this.pops.push(net.addPop({ name: `Intero_${name}`, n: 16, type: NT.RELAY, region: 'intero', bias: 2.0, biasJitter: 0.5, noise: 1.5 }));
  }

  /** @param energy store 0..1, @param sleepPressure 0..1, @param fatigue mean muscle fatigue 0..1 */
  sense(energy: number, sleepPressure: number, fatigue: number): void {
    const lv = this.level;
    // each need starts to be felt only beyond a threshold
    lv[0] = Math.min(1, Math.max(0, (0.45 - energy) / 0.4));
    lv[1] = Math.min(1, Math.max(0, (sleepPressure - 0.55) / 0.4));
    lv[2] = Math.min(1, Math.max(0, (fatigue - 0.35) / 0.5));
    const iext = this.net.iext;
    for (let k = 0; k < this.pops.length; k++) {
      if (!Number.isNaN(this.override[k])) lv[k] = this.override[k];
      const cur = lv[k] > 0.02 ? currentForRate(100 * lv[k]) : -4;
      const p = this.pops[k];
      for (let i = p.start; i < p.end; i++) iext[i] = cur;
    }
  }
}
