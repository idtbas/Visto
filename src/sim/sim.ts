// One living creature in its world: body, (later) brain and hormones, advanced in 1 ms ticks.
import { Physics, DT } from './world/physics';
import { NM, STAND_POSE, staggeredStandPose, type Pose } from './body/biped';
import { Brain, type PopInfo } from './brain/brain';
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
}

export interface LifeStats {
  state: 'standing' | 'walking' | 'fallen';
  falls: number;
  /** distance covered since the creature was last put on its feet */
  attempt: number;
  bestAttempt: number;
  spikeRate: number;
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
  readonly life: LifeStats = { state: 'standing', falls: 0, attempt: 0, bestAttempt: 0, spikeRate: 0 };
  private stateSince = 0;
  private attemptX0 = 0;
  /** seconds of standing before the brainstem gives the walk command */
  standBeforeGo = 1.5;

  constructor(opt: { brainScale?: number; seed?: number } = {}) {
    this.brain = new Brain(this.physics.biped, { params: this.reflexParams, mult: SPINAL_MULT }, { scale: opt.brainScale ?? 1, seed: opt.seed ?? 1 });
    this.placeStanding();
  }

  brainInfo(): BrainInfo {
    return { pops: this.brain.popInfo(), neurons: this.brain.net.n, synapses: this.brain.net.nSynapses };
  }

  /** the "helping hand": puts the creature back on its feet where it is */
  placeStanding(): void {
    const b = this.physics.biped;
    b.setPose(staggeredStandPose(undefined, b.hipX()));
    this.brain.spinal.reset();
    this.life.state = 'standing';
    this.stateSince = this.time;
    this.attemptX0 = b.hipX();
  }

  private lifeTick(): void {
    const b = this.physics.biped;
    const life = this.life;
    const sp = this.brain.spinal;
    const since = this.time - this.stateSince;
    if (life.state === 'standing') {
      sp.go = 0;
      if (since > this.standBeforeGo) {
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
      }
    } else {
      sp.go = 0;
      if (since > 1.5) this.placeStanding();
    }
  }
  readonly manualStim = new Float32Array(2 * NM).fill(0.01);
  readonly reflexParams: number[] = REFLEX_DEFAULTS.map((v, i) => REFLEX_GENOME[i] ?? v);
  readonly reflex = new ReflexController(this.physics.biped, this.reflexParams);

  get time(): number {
    return this.physics.time;
  }

  reset(pose?: Pose): void {
    if (this.mode === 'brain' && !pose) {
      this.placeStanding();
      return;
    }
    const p = pose ?? (this.mode === 'reflex' ? initialPose(this.reflexParams) : STAND_POSE);
    p.x = this.physics.biped.hipX();
    this.physics.biped.setPose(p);
    this.reflex.reset();
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
      this.brain.tick();
    }
    this.physics.step();
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
      life: { ...this.life, spikeRate: this.brain.net.nSpikes },
    };
  }
}

export { DT };
