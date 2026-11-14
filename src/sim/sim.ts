// One living creature in its world: body, (later) brain and hormones, advanced in 1 ms ticks.
import { Vec2 } from 'planck';
import { Physics, DT } from './world/physics';
import { NM, STAND_POSE, staggeredStandPose, type Pose } from './body/biped';
import { Brain, type PopInfo, type BrainState } from './brain/brain';
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
  /** counts cookies eaten so far (to trigger effects in the display) */
  cookiesEaten: number;
}

export interface Cookie {
  x: number;
  /** 1 = normal cookie */
  size: number;
}

export interface LifeStats {
  state: 'standing' | 'walking' | 'fallen';
  falls: number;
  /** distance covered since the creature was last put on its feet */
  attempt: number;
  bestAttempt: number;
  spikeRate: number;
  /** the helping hand is holding the creature right now */
  inHand: boolean;
}

export interface SimState {
  brain: BrainState;
  time: number;
  life: LifeStats;
  cookiesEaten: number;
  x: number;
}

export interface SimOptions {
  brainScale?: number;
  seed?: number;
  learn?: boolean;
  learningRate?: number;
  newborn?: number;
  mult?: number[];
  /** reflex blueprint; defaults to the built-in genome */
  params?: number[];
  startInStride?: boolean;
}

export interface BrainInfo {
  pops: PopInfo[];
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
  /** walking starts with a helping push instead of from quiet standing */
  startInStride = true;
  /** how long the helping hand steadies the creature after putting it down [s] */
  holdTime = 0.5;
  private attemptX0 = 0;
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
    if (this.autoCookies && !this.cookies.some((c) => c.x > x)) this.cookies.push({ x: x + 4 + 3 * this.brain.net.rng(), size: 1 });
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
    this.brain = new Brain(
      this.physics.biped,
      { params: this.reflexParams, mult: opt.mult ?? SPINAL_MULT },
      { scale: opt.brainScale ?? 1, seed: opt.seed ?? 1, learn: opt.learn ?? true, learningRate: opt.learningRate, newborn: opt.newborn ?? 0 },
    );
    this.place();
  }

  /** automatic reward: staying upright and making progress feels good */
  private autoReward(): number {
    const b = this.physics.biped;
    if (this.life.state === 'fallen') return 0;
    const v = b.velX();
    const speed = v < -0.5 ? -0.5 : v > 1.4 ? 1.4 : v;
    const tilt = Math.abs(b.theta - 0.1) - 0.2;
    let r = 0.3 - (tilt > 0 ? tilt : 0);
    if (this.life.state === 'walking') r += 0.7 * speed;
    else r -= 0.5 * Math.abs(v);
    return r;
  }

  saveState(): SimState {
    return { brain: this.brain.saveState(), time: this.physics.time, life: { ...this.life }, cookiesEaten: this.cookiesEaten, x: this.physics.biped.hipX() };
  }

  loadState(st: SimState): boolean {
    if (!this.brain.loadState(st.brain)) return false;
    this.physics.time = st.time;
    Object.assign(this.life, st.life);
    this.cookiesEaten = st.cookiesEaten;
    this.physics.biped.setPose(staggeredStandPose(undefined, st.x));
    this.place();
    return true;
  }

  brainInfo(): BrainInfo {
    return { pops: this.brain.popInfo(), neurons: this.brain.net.n, synapses: this.brain.net.nSynapses };
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
    if (life.state !== 'fallen') {
      life.attempt = b.hipX() - this.attemptX0;
      if (life.attempt > life.bestAttempt) life.bestAttempt = life.attempt;
      if (b.hipY() < 0.6 || Math.abs(b.theta) > 1.2 || b.impact > 0.05) {
        life.state = 'fallen';
        life.falls++;
        this.stateSince = this.time;
        this.brain.reward.give(-1.5); // falling hurts
        this.brain.bodyState.pain = 1;
      }
    } else {
      sp.go = 0;
      if (since > 1.5) this.place();
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
      if ((this.physics.time * 1000) % 50 < 1) this.cookieTick();
      this.brain.tick(this.autoRewardOn ? this.autoReward() : 0, st === 'standing' ? 0 : st === 'walking' ? 1 : 2);
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
    };
  }
}

export { DT };
