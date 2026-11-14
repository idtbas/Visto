// Memory: a hippocampus that stores single experiences and plays them back.
//
// Two stores of "index" cells, each bound to the pattern that was active when it was written
// (fast Hebbian synapses, one experience is enough):
//
//  Store A – walking attempts. Bound to: what the exploration nucleus was trying (the tone
//  variation of that attempt) and how it turned out (better or worse than expected).
//  In sleep these memories are replayed in quick succession: the index cells re-drive the
//  exploration nucleus and the outcome cells re-drive the dopamine neurons, so the tone
//  synapses learn from each attempt again – without having to fall again.
//
//  Store B – encounters with obstacles. Bound to: what was done (feet lifted or not) and how
//  it turned out. When an obstacle comes into view, the two options are imagined in
//  alternation (theta rhythm); each one recalls the encounters in which it was chosen, and
//  the recalled outcomes push the basal ganglia towards or away from lifting the feet.
import { Network, NT, Pop, Proj } from './network';
import { currentForRate, type SpinalCord } from './spinal';
import type { Decision } from './decision';
import type { RewardSystem } from './reward';

const UNIT = 10; // cells per memory
const KA = 32; // walking attempts remembered
const KB = 16; // obstacle encounters remembered
const WRITE_MS = 300;
const REPLAY_MS = 500; // one replayed attempt
const REPLAY_GAP_MS = 700;
const THETA_HALF_MS = 125; // each option is imagined for half a theta cycle
const DRIVE_HZ = 90;
const TONE_W_SCALE = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TONE_W_SCALE ?? 1.6);

export interface MemoryState {
  writtenA: boolean[];
  writtenB: boolean[];
}

export class Memory {
  readonly storeA: Pop;
  readonly storeB: Pop;
  readonly valGood: Pop;
  readonly valBad: Pop;
  readonly actStep: Pop;
  readonly actNo: Pop;
  readonly go: Pop;
  readonly nogo: Pop;
  private readonly hebbA: Proj[] = [];
  private readonly hebbB: Proj[] = [];
  private readonly toVta: Proj[] = [];
  readonly writtenA = new Array<boolean>(KA).fill(false);
  readonly writtenB = new Array<boolean>(KB).fill(false);
  // --- what is going on right now (for the display) ---
  /** index of the walking memory being replayed (-1 = none) */
  replaying = -1;
  /** 0 = nothing, 1 = imagining "lift the feet", 2 = imagining "do not lift" */
  imagining = 0;
  replayCount = 0;
  private writeA = -1;
  private writeAUntil = 0;
  private writeB = -1;
  private writeBUntil = 0;
  private writeValence = 0;
  private writeStepped = false;
  private writeBGood = false;
  private readonly recentAtWrite = new Float32Array(5);
  private readonly zero = new Float32Array(5);
  private replayStart = -1;
  /** replay is switched off for control experiments */
  replayEnabled = true;
  /** recall before obstacles is switched off for control experiments */
  recallEnabled = true;

  constructor(readonly net: Network, readonly spinal: SpinalCord, readonly decision: Decision, readonly reward: RewardSystem, learn: boolean) {
    const mk = (name: string, n: number, bias: number, inhibitory = false): Pop =>
      net.addPop({ name, n, type: inhibitory ? NT.FS : NT.RELAY, region: 'hippocampus', bias, biasJitter: 0.6, noise: 2, inhibitory });
    this.storeA = mk('HPC_Laufversuche', KA * UNIT, 0.5);
    this.storeB = mk('HPC_Hindernisse', KB * UNIT, 0.5);
    this.valGood = mk('Ausgang_gut', 24, 0.5);
    this.valBad = mk('Ausgang_schlecht', 24, 0.5);
    const valBadI = mk('Ausgang_schlecht_i', 24, 0.5, true);
    this.actStep = mk('Option_heben', 24, 0.5);
    this.actNo = mk('Option_nicht_heben', 24, 0.5);

    const hebb = (pre: Pop, post: Pop, gate: 'pre' | 'post', wScale: number): Proj =>
      net.connect({ pre, post, channel: 'E', p: 1, w: 0, delay: [2, 4], plastic: { rule: 'hebb', gate, rate: 0.12, wScale, theta: 0, wMax: 3 } });
    // store A: walking attempt -> tone exploration pattern and outcome
    for (const tn of spinal.tone) this.hebbA.push(hebb(this.storeA, tn.ex, 'pre', TONE_W_SCALE));
    this.hebbA.push(hebb(this.storeA, this.valGood, 'pre', 1.5), hebb(this.storeA, this.valBad, 'pre', 1.5));
    // store B: obstacle encounter <-> chosen option, and -> outcome
    this.hebbB.push(hebb(this.storeB, this.valGood, 'pre', 1.5), hebb(this.storeB, this.valBad, 'pre', 1.5));
    this.hebbB.push(hebb(this.actStep, this.storeB, 'post', 0.37), hebb(this.actNo, this.storeB, 'post', 0.37));
    for (const pr of [...this.hebbA, ...this.hebbB]) pr.lrGain = 0;
    void learn;

    // remembered outcomes reach the dopamine neurons only in sleep (gain is switched in step())
    const K = (pre: Pop, k: number): number => k / pre.n;
    this.toVta.push(net.connect({ pre: this.valGood, post: reward.vta, channel: 'E', p: 1, w: K(this.valGood, 12), delay: [2, 4] }));
    net.connect({ pre: this.valBad, post: valBadI, channel: 'E', p: 0.5, w: 20 / (24 * 0.5), wJitter: 0.3, delay: [1, 3] });
    this.toVta.push(net.connect({ pre: valBadI, post: reward.vta, channel: 'I', p: 1, w: K(valBadI, 12), delay: [2, 4] }));
    for (const pr of this.toVta) pr.gain = 0;

    // evidence from recalled outcomes: "this option went well / badly" for or against lifting
    const and = (name: string, a: Pop, b: Pop): Pop => {
      const pop = mk(name, 24, -9);
      net.connect({ pre: a, post: pop, channel: 'E', p: 0.5, w: 18 / (a.n * 0.5), wJitter: 0.3, delay: [1, 3] });
      net.connect({ pre: b, post: pop, channel: 'E', p: 0.5, w: 18 / (b.n * 0.5), wJitter: 0.3, delay: [1, 3] });
      return pop;
    };
    const stepGood = and('heben_ging_gut', this.actStep, this.valGood);
    const stepBad = and('heben_ging_schlecht', this.actStep, this.valBad);
    const noGood = and('nicht_heben_ging_gut', this.actNo, this.valGood);
    const noBad = and('nicht_heben_ging_schlecht', this.actNo, this.valBad);
    this.go = mk('dafür', 24, 0.5);
    this.nogo = mk('dagegen', 24, 0.5, true);
    const slow = (pre: Pop, post: Pop): Proj => net.connect({ pre, post, channel: 'S', p: 0.6, w: 0.3, wJitter: 0.3, delay: [1, 3] });
    slow(stepGood, this.go);
    slow(noBad, this.go);
    slow(stepBad, this.nogo);
    slow(noGood, this.nogo);
    net.connect({ pre: this.go, post: decision.striatum, channel: 'E', p: 0.5, w: 25 / (24 * 0.5), wJitter: 0.3, delay: [1, 3] });
    net.connect({ pre: this.nogo, post: decision.striatum, channel: 'I', p: 0.5, w: 40 / (24 * 0.5), wJitter: 0.3, delay: [1, 3] });
  }

  private pick(written: boolean[]): number {
    // a free slot if there is one, otherwise a random one (the old memory is overwritten)
    const free: number[] = [];
    written.forEach((w, i) => !w && free.push(i));
    const rng = this.net.rng;
    return free.length > 0 ? free[Math.floor(rng() * free.length)] : Math.floor(rng() * written.length);
  }

  /** a walking attempt has just ended; `valence` > 0 means it went better than expected */
  rememberAttempt(valence: number): void {
    this.writeA = this.pick(this.writtenA);
    this.writtenA[this.writeA] = true;
    this.writeAUntil = this.net.t + WRITE_MS;
    this.writeValence = valence;
    this.recentAtWrite.set(this.spinal.toneRecent);
  }

  /** an obstacle has been passed (`good`) or tripped over */
  rememberObstacle(stepped: boolean, good: boolean): void {
    this.writeB = this.pick(this.writtenB);
    this.writtenB[this.writeB] = true;
    this.writeBUntil = this.net.t + WRITE_MS;
    this.writeStepped = stepped;
    this.writeBGood = good;
  }

  step(asleep: boolean): void {
    const net = this.net;
    const t = net.t;
    const iext = net.iext;
    const on = currentForRate(DRIVE_HZ) + 1.5; // these pools have a bias of 0.5 instead of 2
    const drive = (pop: Pop, rate: number): void => {
      const cur = rate > 0 ? currentForRate(rate) + 1.5 : 0;
      for (let i = pop.start; i < pop.end; i++) iext[i] = cur;
    };
    const driveUnit = (pop: Pop, unit: number): void => {
      for (let i = pop.start; i < pop.end; i++) iext[i] = 0;
      if (unit >= 0) for (let i = pop.start + unit * UNIT; i < pop.start + (unit + 1) * UNIT; i++) iext[i] = on;
    };
    const writingA = t < this.writeAUntil;
    const writingB = t < this.writeBUntil;
    let unitA = -1;
    let unitB = -1;
    let good = 0;
    let bad = 0;
    let step = 0;
    let no = 0;
    this.replaying = -1;
    this.imagining = 0;
    this.spinal.toneOverride = null;
    this.spinal.toneDriveOff = false;
    this.spinal.quiet = asleep;

    if (writingA) {
      // the exploration nucleus re-expresses what it tried during the attempt while it is stored
      unitA = this.writeA;
      this.spinal.toneOverride = this.recentAtWrite;
      const v = Math.max(-1.5, Math.min(1.5, this.writeValence)) / 1.5;
      if (v > 0) good = DRIVE_HZ * v;
      else bad = DRIVE_HZ * -v;
    }
    if (writingB) {
      unitB = this.writeB;
      if (this.writeStepped) step = DRIVE_HZ;
      else no = DRIVE_HZ;
      if (this.writeBGood) good = DRIVE_HZ;
      else bad = DRIVE_HZ;
    }
    if (asleep && this.replayEnabled && !writingA && !writingB) {
      // sleep: one remembered attempt after the other
      if (this.replayStart < 0) this.replayStart = t;
      const phase = (t - this.replayStart) % (REPLAY_MS + REPLAY_GAP_MS);
      if (phase === 0) {
        const have: number[] = [];
        this.writtenA.forEach((w, i) => w && have.push(i));
        this.replayUnit = have.length > 0 ? have[Math.floor(net.rng() * have.length)] : -1;
        if (this.replayUnit >= 0) this.replayCount++;
      }
      if (phase < REPLAY_MS && this.replayUnit >= 0) {
        unitA = this.replayUnit;
        this.replaying = unitA;
        this.spinal.toneDriveOff = true; // memory alone drives the exploration nucleus
      } else this.spinal.toneOverride = this.zero; // in between: exploration at rest
    } else if (!asleep) {
      if (this.replayStart >= 0) {
        // waking up: the day's attempts have been replayed and make room for new ones
        this.writtenA.fill(false);
      }
      this.replayStart = -1;
      // an obstacle in view: imagine the two options in turn
      if (this.recallEnabled && !writingB && Number.isFinite(this.decision.seenDistance)) {
        const first = Math.floor(t / THETA_HALF_MS) % 2 === 0;
        this.imagining = first ? 1 : 2;
        if (first) step = DRIVE_HZ;
        else no = DRIVE_HZ;
      }
    }
    driveUnit(this.storeA, unitA);
    driveUnit(this.storeB, unitB);
    drive(this.valGood, good);
    drive(this.valBad, bad);
    drive(this.actStep, step);
    drive(this.actNo, no);
    // encoding and retrieval are separate modes: while a memory is being written its synapses
    // learn but do not transmit, otherwise the pattern would reinforce itself
    for (const pr of this.hebbA) {
      pr.lrGain = writingA ? 1 : 0;
      pr.gain = this.replaying >= 0 ? 1 : 0;
    }
    for (const pr of this.hebbB) {
      pr.lrGain = writingB ? 1 : 0;
      pr.gain = writingB ? 0 : 1;
    }
    const vtaGain = asleep && this.replaying >= 0 ? 1 : 0;
    for (const pr of this.toVta) pr.gain = vtaGain;
    // in sleep the dopamine baseline follows the average over the last few replays, so that
    // each replayed outcome counts relative to the others ("better or worse than the rest")
    this.reward.fastBaseline = asleep;
  }

  private replayUnit = -1;

  /** what a walking memory holds: tone pattern (mean synaptic weight onto each exploration group) and outcome */
  recall(unit: number): { tone: number[]; good: number; bad: number } {
    const mean = (pr: Proj): number => {
      let s = 0;
      let n = 0;
      for (let i = unit * UNIT; i < (unit + 1) * UNIT; i++) {
        for (let k = pr.rowPtr[i]; k < pr.rowPtr[i + 1]; k++) {
          s += pr.w[k];
          n++;
        }
      }
      return n > 0 ? s / n : 0;
    };
    const nt = this.spinal.tone.length;
    return { tone: this.hebbA.slice(0, nt).map(mean), good: mean(this.hebbA[nt]), bad: mean(this.hebbA[nt + 1]) };
  }

  save(): MemoryState {
    return { writtenA: this.writtenA.slice(), writtenB: this.writtenB.slice() };
  }
  load(st: MemoryState): void {
    st.writtenA.forEach((v, i) => i < KA && (this.writtenA[i] = v));
    st.writtenB.forEach((v, i) => i < KB && (this.writtenB[i] = v));
  }
}
