// The whole nervous system of the creature: one spiking network, organised in regions.
import { Network, type Pop } from './network';
import { SpinalCord } from './spinal';
import { RewardSystem } from './reward';
import { Cerebellum } from './cerebellum';
import { Decision } from './decision';
import { Memory, type MemoryState } from './memory';
import { Predictor } from './predict';
import { Pain } from './pain';
import { BodyCortex } from './cortex';
import { Amygdala } from './amygdala';
import { BodyModel } from './bodymodel';
import { Interoception } from './intero';
import { Workspace } from './workspace';
import { Drive } from './drive';
import { Hormones, HORMONES, type HormoneInputs } from './hormones';
import type { Biped } from '../body/biped';

export const MODULES = ['workspace', 'broadcast', 'bodymodel', 'efference', 'drive'] as const;
export type ModuleName = (typeof MODULES)[number];

export interface PopInfo {
  name: string;
  region: string;
  start: number;
  n: number;
  inhibitory: boolean;
}

// Version 4 stores every learned projection under its name, so that a saved life survives
// when new regions are added to the brain. Version 3 stored them by position only; those
// are still read as long as the old regions come first and unchanged (they do).
const STATE_VERSION = 4;

export interface BrainState {
  version: number;
  neurons: number;
  plastic: Float32Array[];
  /** name of the projection each entry of `plastic` belongs to (version 4) */
  names?: string[];
  hormones: number[];
  energy: number;
  expected: number[];
  memory?: MemoryState;
  /** what the body model has come to regard as the usual mismatch */
  bodyModel?: number[];
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
  /** number of excitatory cells in the body-sense cortex */
  cortex?: number;
  /** false forces the JavaScript neuron loop even where WebAssembly is available */
  wasm?: boolean;
}

export class Brain {
  readonly net: Network;
  readonly spinal: SpinalCord;
  readonly reward: RewardSystem;
  readonly cerebellum: Cerebellum | null;
  readonly decision: Decision;
  readonly memory: Memory;
  readonly predictor: Predictor;
  readonly pain: Pain;
  readonly cortex: BodyCortex;
  readonly amygdala: Amygdala;
  readonly bodyModel: BodyModel;
  readonly intero: Interoception;
  readonly workspace: Workspace;
  readonly drive: Drive;
  /** the body is lying down on purpose (resting): being on the ground does not hurt */
  lyingDown = false;
  readonly hormones = new Hormones();
  /** set by the simulation before every tick */
  readonly bodyState: HormoneInputs = { rpe: 0, dopamine: 0, pain: 0, surprise: 0, power: 0, intake: 0, asleep: false, activity: 0 };
  private activityRate = 0;
  /** spikes per neuron since the last frame was taken (for the display) */
  readonly activity: Uint8Array;

  constructor(readonly biped: Biped, genome: Genome, opt: BrainOptions = {}) {
    this.net = new Network(opt.seed ?? 1);
    this.spinal = new SpinalCord(this.net, biped, genome.params, {
      scale: opt.scale ?? 1,
      mult: genome.mult,
      learn: opt.learn ? { lr: opt.learningRate ?? 1e-6, tauE: 500, exploreW: opt.exploreW } : undefined,
      newborn: opt.newborn,
      newbornTone: opt.newbornTone,
    });
    this.reward = new RewardSystem(this.net);
    this.decision = new Decision(this.net, this.spinal, { learn: !!opt.learn, lr: opt.decisionLr ?? 2e-6, n: Math.round(32 * (opt.scale ?? 1)) });
    this.predictor = new Predictor(this.net, this.spinal, !!opt.learn);
    this.memory = new Memory(this.net, this.spinal, this.decision, this.reward, !!opt.learn);
    this.pain = new Pain(this.net, biped, this.reward.vta);
    this.cortex = new BodyCortex(this.net, this.spinal, this.pain, Math.round((opt.cortex ?? 8192) * (opt.scale ?? 1)));
    this.amygdala = new Amygdala(this.net, this.cortex, this.pain, this.reward.vta, !!opt.learn);
    this.cerebellum = opt.granules && opt.granules > 0 ? new Cerebellum(this.net, this.spinal, { granules: opt.granules }) : null;
    // regions added later come last, so that lives saved before them still fit
    this.bodyModel = new BodyModel(this.net, this.predictor, this.spinal, biped);
    this.intero = new Interoception(this.net);
    const tone = (key: string): Pop => this.spinal.tone.find((t) => t.pop.name === `TONE_${key}`)!.pop;
    this.workspace = new Workspace(
      this.net,
      [
        { name: 'Körper', pops: [this.bodyModel.external], brace: 1 },
        { name: 'Schmerz', pops: [this.pain.relay], brace: 0 },
        { name: 'Gefahr', pops: [this.amygdala.cells], brace: 1 },
        { name: 'Sehen', pops: this.decision.visual, brace: 0 },
        { name: 'Bedürfnis', pops: this.intero.pops, brace: 0 },
      ],
      [tone('extensor'), tone('trunk'), tone('posture')],
    );
    this.drive = new Drive(this.net, this.intero.pops[0], { learn: !!opt.learn, lr: Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRV_LR ?? 3e-5) });
    if (opt.wasm === false) this.net.useKernel = false;
    this.net.build();
    this.net.learning = !!opt.learn;
    this.activity = new Uint8Array(this.net.n);
  }

  /** @param reward continuous reward rate, @param context behavioural context for the reward expectation */
  tick(reward = 0, context = 0, surprise = 0): void {
    // pain and the amygdala's expectation of it act on the dopamine neurons through synapses;
    // here they only enter the bookkeeping of "better or worse than expected"
    this.reward.step(reward, context, surprise, this.pain.cost - this.amygdala.td);
    // hormones: read the state of body and reward system, then modulate the network
    const bs = this.bodyState;
    bs.rpe = this.reward.rpe;
    bs.dopamine = this.reward.level;
    this.activityRate += ((this.net.nSpikes * 1000) / this.net.n - this.activityRate) * 0.01;
    bs.activity = this.activityRate;
    // felt pain, scaled so that an average fall adds up to about 1
    bs.pain += this.pain.cost * (0.001 / 1.5);
    if (this.surpriseNext > bs.surprise) bs.surprise = this.surpriseNext;
    this.surpriseNext = 0;
    this.hormones.step(bs);
    bs.pain = 0;
    bs.surprise = 0;
    bs.intake = 0;
    const asleep = bs.asleep;
    if ((this.net.t & 31) === 0) {
      const fx = this.hormones.effects;
      this.spinal.exploreGain = fx.exploration;
      this.decision.exploreGain = Math.max(0.6, fx.exploration);
      this.drive.exploreGain = Math.max(0.6, fx.exploration);
      // dopamine-gated synapses follow the hormonal learning rate; in sleep they learn from replay
      const lr = asleep ? this.replayGain : fx.learningRate;
      for (const pr of this.net.projs) if (pr.elig) pr.lrGain = lr;
    }
    if (asleep !== this.wasAsleep) {
      // asleep, a synapse remembers what it just did only briefly, so that one replayed
      // attempt is not credited with the outcome of the next
      this.wasAsleep = asleep;
      for (const tn of this.spinal.tone) {
        const pl = tn.proj.plastic;
        if (pl && pl.rule === 'perturb') {
          if (asleep) this.awakeTauE = pl.tauE;
          pl.tauE = asleep ? 500 : this.awakeTauE;
        }
      }
    }
    this.memory.step(asleep);
    this.predictor.step(asleep);
    // a content that ignites in the global workspace alerts the hormone system; with the
    // workspace cut off, the forward model's own alarm is all that is left
    if (this.workspace.enabled ? this.workspace.justIgnited : this.predictor.surprised) this.surpriseNext = 1;
    this.spinal.sense();
    this.pain.sense(asleep || this.lyingDown);
    this.bodyModel.sense();
    this.amygdala.step(asleep);
    this.bodyModel.step(asleep);
    let fatigue = 0;
    for (const m of this.biped.muscles) fatigue += m.fatigue;
    this.intero.sense(this.hormones.energy, this.hormones.level.somnin, fatigue / this.biped.muscles.length);
    this.workspace.step(this.hormones.effects.arousal, asleep);
    this.drive.hunger = this.intero.level[0];
    this.drive.step(asleep);
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

  /** how strongly the tone synapses learn from a replayed attempt, relative to a real one */
  replayGain = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.REPLAY_GAIN ?? 0.5);
  private wasAsleep = false;
  private surpriseNext = 0;
  private awakeTauE = 3000;

  /** returns the spike counts collected since the last call */
  takeActivity(): Uint8Array {
    const copy = this.activity.slice();
    this.activity.fill(0);
    return copy;
  }

  /** everything the creature has learned: plastic synapses, hormone levels, expectations */
  saveState(): BrainState {
    const projs = this.net.projs.filter((p) => p.plastic);
    const plastic = projs.map((p) => p.w.slice());
    return {
      version: STATE_VERSION,
      neurons: this.net.n,
      plastic,
      names: this.plasticNames(projs),
      hormones: this.hormones.snapshot(),
      energy: this.hormones.energy,
      expected: this.reward.expected.slice(),
      memory: this.memory.save(),
      bodyModel: this.bodyModel.saveDrive(),
    };
  }

  /** returns false if the state does not fit this brain (different size or version) */
  loadState(st: BrainState): boolean {
    const projs = this.net.projs.filter((p) => p.plastic);
    if (st.version === 3) {
      // by position: everything that was learned must find its place, new projections keep their start values
      if (st.plastic.length > projs.length) return false;
      if (st.plastic.some((w, i) => w.length !== projs[i].w.length)) return false;
      st.plastic.forEach((w, i) => projs[i].w.set(w));
    } else if (st.version === STATE_VERSION && st.names) {
      const byName = new Map(this.plasticNames(projs).map((n, i) => [n, projs[i]]));
      let found = 0;
      st.names.forEach((n, i) => {
        const pr = byName.get(n);
        if (pr && pr.w.length === st.plastic[i].length) {
          pr.w.set(st.plastic[i]);
          found++;
        }
      });
      // a state that fits nowhere belongs to a different brain
      if (found === 0) return false;
    } else return false;
    HORMONES.forEach((h, i) => (this.hormones.level[h] = st.hormones[i] ?? this.hormones.level[h]));
    this.hormones.energy = st.energy;
    st.expected.forEach((v, i) => (this.reward.expected[i] = v));
    if (st.memory) this.memory.load(st.memory);
    if (st.bodyModel) this.bodyModel.loadDrive(st.bodyModel);
    return true;
  }

  /** Switch a part of the architecture off or on again, for ablation experiments. The cells
   *  stay where they are (the random wiring of everything else is untouched); only the
   *  connections of that part are silenced.
   *   'workspace'  – the global workspace neither receives nor sends
   *   'broadcast'  – contents still ignite but reach nothing
   *   'bodymodel'  – the mismatch between predicted and felt reaches nothing
   *   'efference'  – the forward model no longer gets the copies of the motor commands
   *   'drive'      – the loops for "go" and "turn" no longer reach their commands */
  setModule(name: ModuleName, on: boolean): void {
    this.modules[name] = on;
    if (name === 'workspace') this.workspace.setEnabled(on);
    else if (name === 'broadcast') this.workspace.setBroadcast(on);
    else if (name === 'bodymodel') this.bodyModel.setOutput(on);
    else if (name === 'drive') this.drive.setEnabled(on);
    else this.bodyModel.setEfference(on);
  }
  readonly modules: Record<ModuleName, boolean> = { workspace: true, broadcast: true, bodymodel: true, efference: true, drive: true };

  /** a unique name for every learned projection (the same pair of populations can be connected more than once) */
  private plasticNames(projs: { name: string }[]): string[] {
    const seen = new Map<string, number>();
    return projs.map((p) => {
      const k = seen.get(p.name) ?? 0;
      seen.set(p.name, k + 1);
      return k === 0 ? p.name : `${p.name}#${k}`;
    });
  }

  popInfo(): PopInfo[] {
    return this.net.pops.map((p) => ({ name: p.name, region: p.region, start: p.start, n: p.n, inhibitory: p.inhibitory }));
  }
}
