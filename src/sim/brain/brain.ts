// The whole nervous system of the creature: one spiking network, organised in regions.
import { Network } from './network';
import { SpinalCord } from './spinal';
import type { Biped } from '../body/biped';

export interface PopInfo {
  name: string;
  region: string;
  start: number;
  n: number;
  inhibitory: boolean;
}

export interface Genome {
  /** reflex blueprint (see control/reflex.ts) */
  params: number[];
  /** multipliers on the innate strength of each spinal pathway */
  mult: number[];
}

export interface BrainOptions {
  seed?: number;
  /** multiplies the size of all neuron pools */
  scale?: number;
}

export class Brain {
  readonly net: Network;
  readonly spinal: SpinalCord;
  /** spikes per neuron since the last frame was taken (for the display) */
  readonly activity: Uint8Array;

  constructor(biped: Biped, genome: Genome, opt: BrainOptions = {}) {
    this.net = new Network(opt.seed ?? 1);
    this.spinal = new SpinalCord(this.net, biped, genome.params, { scale: opt.scale ?? 1, mult: genome.mult });
    this.net.build();
    this.activity = new Uint8Array(this.net.n);
  }

  tick(): void {
    this.spinal.sense();
    this.net.step();
    this.spinal.act();
    const { spikes, nSpikes } = this.net;
    const act = this.activity;
    for (let k = 0; k < nSpikes; k++) {
      const i = spikes[k];
      if (act[i] < 255) act[i]++;
    }
  }

  /** returns the spike counts collected since the last call */
  takeActivity(): Uint8Array {
    const copy = this.activity.slice();
    this.activity.fill(0);
    return copy;
  }

  popInfo(): PopInfo[] {
    return this.net.pops.map((p) => ({ name: p.name, region: p.region, start: p.start, n: p.n, inhibitory: p.inhibitory }));
  }
}
