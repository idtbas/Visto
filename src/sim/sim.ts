// One living creature in its world: body, (later) brain and hormones, advanced in 1 ms ticks.
import { Vec2 } from 'planck';
import { Physics, DT } from './world/physics';
import { NM, STAND_POSE, staggeredStandPose, type Pose } from './body/biped';
import { Brain, type PopInfo, type BrainState } from './brain/brain';
import { FallExpectation } from './brain/expectation';
import { ReflexController, initialPose, REFLEX_DEFAULTS } from './control/reflex';
import { REFLEX_GENOME, SPINAL_MULT } from './control/genome';

export type ControlMode = 'manual' | 'reflex' | 'brain';

export interface Frame {
  time: number;
  /** x, y, angle of trunk, thigh L, shank L, foot L, thigh R, shank R, foot R */
  body: Float32Array;
  /** per muscle: activation, fibre length / lopt, force / fmax */
  muscles: Float32Array;
  heel: Float32Array;
  toe: Float32Array;
  lean: number;
  velX: number;
  power: number;
  obstacles: { x: number; w: number; h: number }[];
  mode: ControlMode;
  /** simulated seconds per wall-clock second, measured */
  speed: number;
  /** spikes per neuron since the previous frame */
  activity: Uint8Array | null;
  life: LifeStats;
  /** levels of the hormones, in the order of HORMONES */
  hormones: number[];
  energy: number;
  cookies: Cookie[];
  /** distance to the obstacle the eye is looking at (-1 = none) and how strongly the feet are being lifted */
  seen: number;
  highStep: number;
  /** learned drive from each visual distance pool onto the striatum */
  decision: number[];
  /** what the hippocampus is doing */
  mind: Mind;
  /** learned gain of the brainstem tone nuclei (1 = mature) */
  tone: number[];
  /** number of finished walking attempts; the list itself is sent separately when this changes */
  attemptCount: number;
  /** counts cookies eaten so far (to trigger effects in the display) */
  cookiesEaten: number;
  /** pain level per body site (see PAIN_SITES), overall pain 0..1 and what a fall is expected to cost */
  pain: number[];
  painNow: number;
  expectedPain: number;
  /** what the amygdala expects: 0 = safe, 1 = pain is certain */
  danger: number;
}

export interface Mind {
  /** stored walking attempts / obstacle encounters */
  attempts: number;
  encounters: number;
  /** the attempt being replayed in sleep: what was tried per tone nucleus (relative to rest) and how it ended (-1..1) */
  dream: { tone: number[]; outcome: number } | null;
  dreams: number;
  /** 0 = nothing, 1 = imagining lifting the feet, 2 = imagining not lifting them */
  imagining: number;
  /** recalled outcomes speaking for and against lifting the feet, 0..1 */
  pro: number;
  contra: number;
  /** recalled outcome right now: good / bad, 0..1 */
  recallGood: number;
  recallBad: number;
  /** prediction error of the forward model and its usual level */
  spe: number;
  speUsual: number;
}

export interface Cookie {
  x: number;
  /** 1 = normal cookie */
  size: number;
}

export interface LifeStats {
  state: 'standing' | 'walking' | 'fallen' | 'sleeping';
  falls: number;
  /** distance covered since the creature was last put on its feet */
  attempt: number;
  bestAttempt: number;
  spikeRate: number;
  /** the helping hand is holding the creature right now */
  inHand: boolean;
}

/** how much an average fall hurts, in units of reward */
const FALL_COST = 1.5;

/** 'graded': pain receptors decide how much a fall (or an overstretched joint) hurts;
 *  'fixed': every fall costs the same (the behaviour before pain was built in);
 *  'off': nothing hurts */
export type PainMode = 'graded' | 'fixed' | 'off';

export interface SimState {
  brain: BrainState;
  time: number;
  life: LifeStats;
  cookiesEaten: number;
  x: number;
  attempts?: number[];
  durations?: number[];
  expectedPain?: number;
}

export interface SimOptions {
  brainScale?: number;
  seed?: number;
  learn?: boolean;
  learningRate?: number;
  exploreW?: number;
  newborn?: number;
  newbornTone?: number;
  granules?: number;
  decisionLr?: number;
  mult?: number[];
  /** reflex blueprint; defaults to the built-in genome */
  params?: number[];
  startInStride?: boolean;
  /** the creature gets tired and sleeps */
  sleep?: boolean;
  pain?: PainMode;
  /** false forces the JavaScript neuron loop */
  wasm?: boolean;
}

export interface BrainInfo {
  /** 'wasm' = the fast WebAssembly loop is running, 'js' = the JavaScript fallback */
  engine: 'wasm' | 'js';
  pops: PopInfo[];
  /** every projection as [index of source population, index of target population, 1 if inhibitory] */
  projs: [number, number, number][];
  neurons: number;
  synapses: number;
}

export class Sim {
  readonly physics = new Physics();
  mode: ControlMode = 'brain';
  readonly brain: Brain;
  readonly life: LifeStats = { state: 'standing', falls: 0, attempt: 0, bestAttempt: 0, spikeRate: 0, inHand: false };
  private stateSince = 0;
  private holdUntil = 0;
  private holdX = 0;
  private frozenUntil = 0;
  /** reward prediction error summed over the current walking attempt */
  private attemptSurprise = 0;
  private sleepOption = false;
  /** walking starts with a helping push instead of from quiet standing */
  startInStride = true;
  /** how long the helping hand steadies the creature after putting it down [s] */
  holdTime = 0.5;
  private attemptX0 = 0;
  painMode: PainMode = 'graded';
  /** how much a fall usually hurts (running average of the pain actually felt) */
  expectedPain = FALL_COST;
  private fallPain = 0;
  readonly fallExpectation = new FallExpectation();
  /** distance of every finished walking attempt [m] (most recent last) */
  readonly attempts: number[] = [];
  attemptCount = 0;
  readonly cookies: Cookie[] = [];
  cookiesEaten = 0;
  /** keep one cookie waiting ahead of the creature */
  autoCookies = true;
  private lastImpact = 0;

  /** hand the creature a cookie right now (the user's reward button) */
  giveCookie(size = 1): void {
    const h = this.brain.hormones;
    this.brain.reward.give(1.2 * size * h.effects.appetite);
    this.brain.bodyState.intake += 0.06 * size;
    this.cookiesEaten++;
  }

  placeCookie(x: number, size = 1): void {
    this.cookies.push({ x, size });
  }

  private cookieTick(): void {
    const x = this.physics.biped.hipX();
    for (let i = this.cookies.length - 1; i >= 0; i--) {
      const c = this.cookies[i];
      if (Math.abs(c.x - x) < 0.25 && this.life.state !== 'fallen') {
        this.cookies.splice(i, 1);
        this.giveCookie(c.size);
      } else if (c.x < x - 6) this.cookies.splice(i, 1);
    }
    if (this.autoCookies && !this.obstaclesOn && !this.cookies.some((c) => c.x > x)) this.cookies.push({ x: x + 4 + 3 * this.brain.net.rng(), size: 1 });
  }

  /** blocks appear on the path every few metres */
  obstaclesOn = false;
  private nextObstacleX = 12;
  private readonly encounters = new Map<number, { sum: number; n: number; done: boolean }>();
  /** range of block heights [m] */
  obstacleHeight: [number, number] = [0.05, 0.1];

  private obstacleTick(): void {
    const b = this.physics.biped;
    const terrain = this.physics.terrain;
    const x = b.hipX();
    if (this.obstaclesOn) {
      if (this.nextObstacleX < x + 3) this.nextObstacleX = x + 3;
      if (x > this.nextObstacleX - 6) {
        const rng = this.brain.net.rng;
        const ox = this.nextObstacleX;
        terrain.addBlock(ox, 0.15, this.obstacleHeight[0] + (this.obstacleHeight[1] - this.obstacleHeight[0]) * rng());
        // a cookie waits behind every obstacle
        this.cookies.push({ x: ox + 0.9, size: 1 });
        this.nextObstacleX = ox + 7 + 5 * rng();
      }
    }
    // remember how each encounter went: were the feet lifted, and did it work?
    for (const o of terrain.obstacles) {
      const d = o.x - x;
      let tr = this.encounters.get(o.x);
      if (!tr && d < 1.0 && d > -0.5) this.encounters.set(o.x, (tr = { sum: 0, n: 0, done: false }));
      if (!tr || tr.done) continue;
      if (d > 0 && this.life.state === 'walking') {
        tr.sum += this.brain.spinal.stepLevel;
        tr.n++;
      }
      const stepped = tr.n > 0 && tr.sum / tr.n > 0.3;
      if (this.life.state === 'fallen' && Math.abs(d) < 1.6) {
        tr.done = true;
        this.brain.memory.rememberObstacle(stepped, false);
      } else if (d < -0.7 && this.life.state === 'walking') {
        tr.done = true;
        this.brain.memory.rememberObstacle(stepped, true);
      }
    }
    if (this.encounters.size > 40) for (const k of this.encounters.keys()) if (k < x - 8) this.encounters.delete(k);
    // obstacles far behind are cleared away; after a fall the hand also removes the one it tripped over
    const fallen = this.life.state === 'fallen';
    const keep = terrain.obstacles.filter((o) => o.x > x - 5 && !(fallen && Math.abs(o.x - x) < 1.6));
    if (keep.length !== terrain.obstacles.length) {
      const copy = keep.map((o) => ({ ...o }));
      terrain.clearObstacles();
      for (const o of copy) terrain.addBlock(o.x, o.w, o.h);
    }
    // the eye looks ahead
    let best = Infinity;
    let h = 0;
    for (const o of terrain.obstacles) {
      const d = o.x - x;
      if (d > -0.1 && d < best) {
        best = d;
        h = o.h;
      }
    }
    const dec = this.brain.decision;
    dec.seenDistance = best < 2.0 ? Math.max(0, best) : Infinity;
    dec.seenHeight = h;
  }

  /** reward for progress without the user handing out cookies */
  autoRewardOn = true;
  /** false keeps the creature standing */
  wantsToWalk = true;
  /** seconds of standing before the brainstem gives the walk command */
  standBeforeGo = 1.5;

  constructor(opt: SimOptions = {}) {
    const genome = opt.params ?? REFLEX_GENOME;
    this.reflexParams = REFLEX_DEFAULTS.map((v, i) => genome[i] ?? v);
    this.reflex = new ReflexController(this.physics.biped, this.reflexParams);
    this.startInStride = opt.startInStride ?? true;
    this.sleepOption = opt.sleep ?? false;
    this.brain = new Brain(
      this.physics.biped,
      { params: this.reflexParams, mult: opt.mult ?? SPINAL_MULT },
      { scale: opt.brainScale ?? 1, seed: opt.seed ?? 1, learn: opt.learn ?? true, learningRate: opt.learningRate, exploreW: opt.exploreW, newborn: opt.newborn ?? 0, newbornTone: opt.newbornTone, granules: opt.granules, decisionLr: opt.decisionLr, wasm: opt.wasm },
    );
    this.brain.hormones.sleepEnabled = this.sleepOption;
    this.setPainMode(opt.pain ?? 'graded');
    this.place();
    // at birth the nervous system needs a little longer to settle before the hand lets go
    if (this.frozenUntil > 0) this.frozenUntil = this.time + 0.6;
  }

  setPainMode(mode: PainMode): void {
    this.painMode = mode;
    this.brain.pain.enabled = mode === 'graded';
  }

  /** what a fall is expected to cost right now */
  private fallCost(): number {
    return this.painMode === 'off' ? 0 : this.painMode === 'fixed' ? FALL_COST : this.expectedPain;
  }

  /** automatic reward: staying upright and making progress feels good */
  private autoReward(): number {
    const b = this.physics.biped;
    if (this.life.state === 'fallen' || this.life.state === 'sleeping') return 0;
    const v = b.velX();
    const speed = v < -0.5 ? -0.5 : v > 1.4 ? 1.4 : v;
    const tilt = Math.abs(b.theta - 0.1) - 0.2;
    let r = 0.3 - (tilt > 0 ? tilt : 0);
    if (this.life.state === 'walking') r += 0.7 * speed;
    else r -= 0.5 * Math.abs(v);
    // lifting the feet high is an effort
    r -= 0.4 * this.brain.spinal.stepLevel;
    return r;
  }

  private dreamUnit = -1;
  private dream: Mind['dream'] = null;

  private mind(): Mind {
    const m = this.brain.memory;
    if (m.replaying !== this.dreamUnit) {
      this.dreamUnit = m.replaying;
      if (m.replaying < 0) this.dream = null;
      else {
        const r = m.recall(m.replaying);
        // stored synaptic weights back into "tried more / less than usual"
        const mean = r.tone.reduce((a, b) => a + b, 0) / r.tone.length || 1;
        this.dream = { tone: r.tone.map((w) => w / mean - 1), outcome: Math.max(-1, Math.min(1, (r.good - r.bad) / 2.5)) };
      }
    }
    const p = this.brain.predictor;
    return {
      attempts: m.writtenA.filter(Boolean).length,
      encounters: m.writtenB.filter(Boolean).length,
      dream: this.dream,
      dreams: m.replayCount,
      imagining: m.imagining,
      pro: Math.min(1, m.go.rate / 60),
      contra: Math.min(1, m.nogo.rate / 60),
      recallGood: Math.min(1, m.valGood.rate / 80),
      recallBad: Math.min(1, m.valBad.rate / 80),
      spe: p.spe,
      speUsual: p.usual,
    };
  }

  saveState(): SimState {
    return { brain: this.brain.saveState(), time: this.physics.time, life: { ...this.life }, cookiesEaten: this.cookiesEaten, x: this.physics.biped.hipX(), attempts: this.attempts.slice(), durations: this.fallExpectation.save(), expectedPain: this.expectedPain };
  }

  loadState(st: SimState): boolean {
    if (!this.brain.loadState(st.brain)) return false;
    this.physics.time = st.time;
    Object.assign(this.life, st.life);
    this.cookiesEaten = st.cookiesEaten;
    this.attempts.length = 0;
    this.attempts.push(...(st.attempts ?? []));
    this.attemptCount = this.attempts.length;
    this.fallExpectation.load(st.durations ?? []);
    this.expectedPain = st.expectedPain ?? FALL_COST;
    this.physics.biped.setPose(staggeredStandPose(undefined, st.x));
    this.place();
    return true;
  }

  brainInfo(): BrainInfo {
    const net = this.brain.net;
    return {
      engine: net.engine,
      pops: this.brain.popInfo(),
      projs: net.projs.map((p) => [p.pre.id, p.post.id, p.channel === 'I' ? 1 : 0]),
      neurons: net.n,
      synapses: net.nSynapses,
    };
  }

  /** the "helping hand": puts the creature back on its feet where it is and steadies it for a moment */
  placeStanding(): void {
    const b = this.physics.biped;
    b.setPose(staggeredStandPose(undefined, b.hipX()));
    this.brain.spinal.reset();
    this.life.state = 'standing';
    this.stateSince = this.time;
    this.attemptX0 = b.hipX();
    this.holdX = b.hipX();
    this.holdUntil = this.time + this.holdTime;
  }

  /** the hand sets the creature down in mid-stride with some forward speed, like in the
   *  stepping-reflex test with infants; the spinal reflexes take over from there */
  placeStride(): void {
    const b = this.physics.biped;
    const pose = initialPose(this.reflexParams);
    pose.x = b.hipX();
    b.setPose(pose);
    this.brain.spinal.reset();
    this.brain.spinal.go = 1;
    this.life.state = 'walking';
    this.stateSince = this.time;
    this.attemptX0 = b.hipX();
    this.attemptSurprise = 0;
    this.holdUntil = 0;
    // the nervous system gets a moment to register the posture before the hand lets go
    this.frozenUntil = this.time + 0.2;
  }

  /** put the creature back on its feet in the way that suits what it is about to do */
  place(): void {
    if (this.wantsToWalk && this.startInStride) this.placeStride();
    else this.placeStanding();
  }

  /** the hand steadies trunk position and tilt (it does not carry the weight) and lets go gradually */
  private holdTick(): void {
    const left = this.holdUntil - this.time;
    if (left <= 0) return;
    const b = this.physics.biped;
    const k = Math.min(1, left / 0.15);
    const t = b.trunk;
    const v = t.getLinearVelocity();
    const fx = k * (-3000 * (t.getPosition().x - this.holdX) - 600 * v.x);
    t.applyForceToCenter(new Vec2(fx, 0), true);
    t.applyTorque(k * (-1500 * (t.getAngle() + 0.03) - 150 * t.getAngularVelocity()), true);
  }

  get held(): boolean {
    return this.time < this.holdUntil;
  }

  private lifeTick(): void {
    const b = this.physics.biped;
    const life = this.life;
    const sp = this.brain.spinal;
    const since = this.time - this.stateSince;
    if (life.state === 'standing') {
      sp.go = 0;
      if (since > this.standBeforeGo && this.wantsToWalk) {
        life.state = 'walking';
        this.stateSince = this.time;
      }
    } else if (life.state === 'walking') {
      sp.go = 1;
    }
    // sleep: when the pressure is high enough the muscles go limp and the creature lies down
    const fx = this.brain.hormones.effects;
    if (life.state === 'sleeping') {
      sp.go = 0;
      sp.atonia = true;
      this.brain.bodyState.asleep = true;
      if (!fx.wantsSleep) {
        sp.atonia = false;
        this.brain.bodyState.asleep = false;
        this.place();
      }
      return;
    }
    if (fx.wantsSleep && this.time >= this.frozenUntil) {
      if (life.state === 'walking') {
        this.fallExpectation.record(Math.max(this.time - this.stateSince, this.fallExpectation.mean));
        this.attempts.push(Math.max(0, life.attempt));
        this.attemptCount++;
      }
      life.state = 'sleeping';
      this.stateSince = this.time;
      return;
    }
    if (life.state !== 'fallen') {
      life.attempt = b.hipX() - this.attemptX0;
      if (life.attempt > life.bestAttempt) life.bestAttempt = life.attempt;
      if (b.hipY() < 0.6 || Math.abs(b.theta) > 1.2 || b.impact > 0.05) {
        if (life.state === 'walking') {
          // store the attempt: what was tried and whether it went better or worse than expected
          this.brain.memory.rememberAttempt(this.attemptSurprise - this.fallCost());
          this.fallExpectation.record(this.time - this.stateSince);
          this.attempts.push(Math.max(0, life.attempt));
          if (this.attempts.length > 3000) this.attempts.shift();
          this.attemptCount++;
        }
        life.state = 'fallen';
        life.falls++;
        this.stateSince = this.time;
        this.fallPain = 0;
        if (this.painMode === 'fixed') {
          this.brain.reward.give(-FALL_COST);
          this.brain.bodyState.pain += 1;
        }
      }
    } else {
      sp.go = 0;
      this.fallPain += this.brain.pain.cost * DT;
      if (since > 1.5) {
        // how much did this fall hurt? That is what the next one is expected to cost.
        if (this.painMode === 'graded') this.expectedPain += (this.fallPain - this.expectedPain) / 10;
        this.place();
      }
    }
  }
  readonly manualStim = new Float32Array(2 * NM).fill(0.01);
  readonly reflexParams: number[];
  readonly reflex: ReflexController;

  get time(): number {
    return this.physics.time;
  }

  reset(pose?: Pose): void {
    if (this.mode === 'brain' && !pose) {
      this.place();
      return;
    }
    const p = pose ?? (this.mode === 'reflex' ? initialPose(this.reflexParams) : STAND_POSE);
    p.x = this.physics.biped.hipX();
    this.physics.biped.setPose(p);
    this.reflex.reset();
  }

  /** switch between walking and quiet standing */
  setWantsToWalk(on: boolean): void {
    if (this.wantsToWalk === on) return;
    this.wantsToWalk = on;
    if (this.mode === 'brain' && this.life.state !== 'fallen') this.place();
  }

  setMode(mode: ControlMode): void {
    this.mode = mode;
    this.reset();
  }

  tick(): void {
    const b = this.physics.biped;
    if (this.mode === 'manual') b.stim.set(this.manualStim);
    else if (this.mode === 'reflex') this.reflex.step();
    else {
      this.lifeTick();
      this.holdTick();
      const st = this.life.state;
      const b2 = this.physics.biped;
      const bs = this.brain.bodyState;
      bs.power = b2.power;
      // a sudden jolt (push, stumble) is surprising
      const jolt = Math.abs(b2.dtheta) > 2.5 ? 1 : 0;
      if (jolt > this.lastImpact) bs.surprise = 1;
      this.lastImpact = jolt;
      if (st === 'walking' && this.time >= this.frozenUntil) this.attemptSurprise += this.brain.reward.rpe * DT;
      if ((this.physics.time * 1000) % 50 < 1 && st !== 'sleeping') this.cookieTick();
      if ((this.physics.time * 1000) % 20 < 1) this.obstacleTick();
      // still on its feet at a moment when it usually falls: better than expected
      const relief = st === 'walking' && this.time >= this.frozenUntil ? this.fallCost() * this.fallExpectation.hazard(this.time - this.stateSince) : 0;
      this.brain.tick(this.autoRewardOn && st !== 'sleeping' ? this.autoReward() : 0, st === 'standing' ? 0 : st === 'walking' ? 1 : 2, relief);
    }
    if (this.time < this.frozenUntil) {
      // still in the hand: the stance leg already feels the ground
      const b = this.physics.biped;
      b.heelLoad[1] = b.toeLoad[1] = 0.5;
      this.physics.idle();
    } else this.physics.step();
  }

  frame(speed: number): Frame {
    const b = this.physics.biped;
    const body = new Float32Array(21);
    b.snapshot(body);
    const muscles = new Float32Array(2 * NM * 3);
    for (let i = 0; i < 2 * NM; i++) {
      const m = b.muscles[i];
      muscles[i * 3] = m.act;
      muscles[i * 3 + 1] = m.lce / m.p.lopt;
      muscles[i * 3 + 2] = m.force / m.p.fmax;
    }
    return {
      time: this.time,
      body,
      muscles,
      heel: b.heelLoad.slice(),
      toe: b.toeLoad.slice(),
      lean: b.theta,
      velX: b.velX(),
      power: b.power,
      obstacles: this.physics.terrain.obstacles.map((o) => ({ x: o.x, w: o.w, h: o.h })),
      mode: this.mode,
      speed,
      activity: this.mode === 'brain' ? this.brain.takeActivity() : null,
      life: { ...this.life, spikeRate: this.brain.net.nSpikes, inHand: this.time < this.frozenUntil || this.time < this.holdUntil },
      hormones: this.brain.hormones.snapshot(),
      energy: this.brain.hormones.energy,
      cookies: this.cookies.map((c) => ({ ...c })),
      cookiesEaten: this.cookiesEaten,
      seen: Number.isFinite(this.brain.decision.seenDistance) ? this.brain.decision.seenDistance : -1,
      highStep: this.brain.spinal.stepLevel,
      decision: this.brain.decision.weights(),
      mind: this.mind(),
      tone: this.brain.spinal.tone.map((t) => t.gain),
      attemptCount: this.attemptCount,
      pain: Array.from(this.brain.pain.level),
      painNow: this.brain.pain.intensity,
      expectedPain: this.painMode === 'off' ? 0 : this.painMode === 'fixed' ? FALL_COST : this.expectedPain,
      danger: this.brain.amygdala.danger,
    };
  }
}

export { DT };
