// The whole nervous system of the creature: one spiking network, organised in regions.
import { Network } from './network';
import { SpinalCord } from './spinal';
import { RewardSystem } from './reward';
import { Hormones, type HormoneInputs } from './hormones';
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
  /** enable synaptic learning */
  learn?: boolean;
  learningRate?: number;
  /** how far the newborn's reflexes deviate from the innate blueprint (0 = perfectly tuned) */
  newborn?: number;
}

export class Brain {
  readonly net: Network;
  readonly spinal: SpinalCord;
  readonly reward: RewardSystem;
  readonly hormones = new Hormones();
  /** set by the simulation before every tick */
  readonly bodyState: HormoneInputs = { rpe: 0, dopamine: 0, pain: 0, surprise: 0, power: 0, intake: 0, asleep: false, activity: 0 };
  private activityRate = 0;
  /** spikes per neuron since the last frame was taken (for the display) */
  readonly activity: Uint8Array;

  constructor(biped: Biped, genome: Genome, opt: BrainOptions = {}) {
    this.net = new Network(opt.seed ?? 1);
    this.spinal = new SpinalCord(this.net, biped, genome.params, {
      scale: opt.scale ?? 1,
      mult: genome.mult,
      learn: opt.learn ? { lr: opt.learningRate ?? 2e-7, tauE: 400 } : undefined,
      newborn: opt.newborn,
    });
    this.reward = new RewardSystem(this.net);
    this.net.build();
    this.net.learning = !!opt.learn;
    this.activity = new Uint8Array(this.net.n);
  }

  /** @param reward continuous reward rate, @param context behavioural context for the reward expectation */
  tick(reward = 0, context = 0): void {
    this.reward.step(reward, context);
    // hormones: read the state of body and reward system, then modulate the network
    const bs = this.bodyState;
    bs.rpe = this.reward.rpe;
    bs.dopamine = this.reward.level;
    this.activityRate += ((this.net.nSpikes * 1000) / this.net.n - this.activityRate) * 0.01;
    bs.activity = this.activityRate;
    this.hormones.step(bs);
    bs.pain = 0;
    bs.surprise = 0;
    bs.intake = 0;
    if ((this.net.t & 31) === 0) {
      const fx = this.hormones.effects;
      this.spinal.exploreGain = fx.exploration;
      for (const pr of this.net.projs) if (pr.plastic) pr.lrGain = fx.learningRate;
    }
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
