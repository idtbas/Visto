// The whole nervous system of the creature: one spiking network, organised in regions.
import { Network } from './network';
import { SpinalCord } from './spinal';
import { RewardSystem } from './reward';
import { Cerebellum } from './cerebellum';
import { Decision } from './decision';
import { Hormones, HORMONES, type HormoneInputs } from './hormones';
import type { Biped } from '../body/biped';

export interface PopInfo {
  name: string;
  region: string;
  start: number;
  n: number;
  inhibitory: boolean;
}

const STATE_VERSION = 1;

export interface BrainState {
  version: number;
  neurons: number;
  plastic: Float32Array[];
  hormones: number[];
  energy: number;
  expected: number[];
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
  /** strength of the exploratory perturbations */
  exploreW?: number;
  /** how far the newborn's reflexes deviate from the innate blueprint (0 = perfectly tuned) */
  newborn?: number;
  /** learning rate of the visual → striatum synapses */
  decisionLr?: number;
  /** number of cerebellar granule cells; 0 = no cerebellum */
  granules?: number;
  /** descending tone of the newborn relative to mature (1 = mature) */
  newbornTone?: number;
}

export class Brain {
  readonly net: Network;
  readonly spinal: SpinalCord;
  readonly reward: RewardSystem;
  readonly cerebellum: Cerebellum | null;
  readonly decision: Decision;
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
      learn: opt.learn ? { lr: opt.learningRate ?? 1e-6, tauE: 500, exploreW: opt.exploreW } : undefined,
      newborn: opt.newborn,
      newbornTone: opt.newbornTone,
    });
    this.reward = new RewardSystem(this.net);
    this.decision = new Decision(this.net, this.spinal, { learn: !!opt.learn, lr: opt.decisionLr ?? 3e-6, n: Math.round(32 * (opt.scale ?? 1)) });
    this.cerebellum = opt.granules && opt.granules > 0 ? new Cerebellum(this.net, this.spinal, { granules: opt.granules }) : null;
    this.net.build();
    this.net.learning = !!opt.learn;
    this.activity = new Uint8Array(this.net.n);
  }

  /** @param reward continuous reward rate, @param context behavioural context for the reward expectation */
  tick(reward = 0, context = 0, surprise = 0): void {
    this.reward.step(reward, context, surprise);
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
      this.decision.exploreGain = Math.max(0.6, fx.exploration);
      for (const pr of this.net.projs) if (pr.plastic) pr.lrGain = fx.learningRate;
    }
    this.spinal.sense();
    this.decision.step();
    this.cerebellum?.step();
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

  /** everything the creature has learned: plastic synapses, hormone levels, expectations */
  saveState(): BrainState {
    const plastic = this.net.projs.filter((p) => p.plastic).map((p) => p.w.slice());
    return {
      version: STATE_VERSION,
      neurons: this.net.n,
      plastic,
      hormones: this.hormones.snapshot(),
      energy: this.hormones.energy,
      expected: this.reward.expected.slice(),
    };
  }

  /** returns false if the state does not fit this brain (different size or version) */
  loadState(st: BrainState): boolean {
    const projs = this.net.projs.filter((p) => p.plastic);
    if (st.version !== STATE_VERSION || st.neurons !== this.net.n || st.plastic.length !== projs.length) return false;
    if (projs.some((p, i) => p.w.length !== st.plastic[i].length)) return false;
    projs.forEach((p, i) => p.w.set(st.plastic[i]));
    HORMONES.forEach((h, i) => (this.hormones.level[h] = st.hormones[i] ?? this.hormones.level[h]));
    this.hormones.energy = st.energy;
    st.expected.forEach((v, i) => (this.reward.expected[i] = v));
    return true;
  }

  popInfo(): PopInfo[] {
    return this.net.pops.map((p) => ({ name: p.name, region: p.region, start: p.start, n: p.n, inhibitory: p.inhibitory }));
  }
}
