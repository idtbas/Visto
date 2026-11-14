// One living creature in its world: body, (later) brain and hormones, advanced in 1 ms ticks.
import { Physics, DT } from './world/physics';
import { NM, STAND_POSE, type Pose } from './body/biped';

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
}

export class Sim {
  readonly physics = new Physics();
  mode: ControlMode = 'manual';
  readonly manualStim = new Float32Array(2 * NM).fill(0.01);

  get time(): number {
    return this.physics.time;
  }

  reset(pose: Pose = STAND_POSE): void {
    this.physics.biped.setPose(pose);
  }

  tick(): void {
    const b = this.physics.biped;
    if (this.mode === 'manual') b.stim.set(this.manualStim);
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
    };
  }
}

export { DT };
