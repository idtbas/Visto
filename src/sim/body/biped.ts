// The body: a planar biped with trunk, thighs, shanks and feet, driven by
// seven Hill-type muscle-tendon units per leg. Anthropometry and muscle
// geometry follow Geyer & Herr (2010).
import { World, Vec2, Box, Circle, RevoluteJoint } from 'planck';
import type { Body } from 'planck';
import { Muscle, type MuscleParams } from './muscle';

export const MUSCLE_NAMES = ['HFL', 'GLU', 'HAM', 'VAS', 'GAS', 'SOL', 'TA'] as const;
export type MuscleName = (typeof MUSCLE_NAMES)[number];
export const NM = MUSCLE_NAMES.length;
export const M = { HFL: 0, GLU: 1, HAM: 2, VAS: 3, GAS: 4, SOL: 5, TA: 6 } as const;

export const MUSCLE_LABELS: Record<MuscleName, string> = {
  HFL: 'Hüftbeuger',
  GLU: 'Gesäßmuskel',
  HAM: 'Oberschenkelbeuger',
  VAS: 'Oberschenkelstrecker',
  GAS: 'Wadenmuskel (zweigelenkig)',
  SOL: 'Schollenmuskel',
  TA: 'Schienbeinmuskel',
};

const DEG = Math.PI / 180;

export const MUSCLE_PARAMS: Record<MuscleName, MuscleParams> = {
  HFL: { name: 'HFL', fmax: 2000, lopt: 0.11, vmax: 12, lslack: 0.1 },
  GLU: { name: 'GLU', fmax: 1500, lopt: 0.11, vmax: 12, lslack: 0.13 },
  HAM: { name: 'HAM', fmax: 3000, lopt: 0.1, vmax: 12, lslack: 0.31 },
  VAS: { name: 'VAS', fmax: 6000, lopt: 0.08, vmax: 12, lslack: 0.23 },
  GAS: { name: 'GAS', fmax: 1500, lopt: 0.05, vmax: 12, lslack: 0.4 },
  SOL: { name: 'SOL', fmax: 4000, lopt: 0.04, vmax: 6, lslack: 0.26 },
  TA: { name: 'TA', fmax: 800, lopt: 0.06, vmax: 12, lslack: 0.24 },
};

type JointName = 'hip' | 'knee' | 'ankle';
const J = { hip: 0, knee: 1, ankle: 2 } as const;

interface Attachment {
  joint: number;
  /** +1 if the muscle's torque increases the joint angle (extension / plantarflexion) */
  sign: number;
  r0: number;
  /** angle of maximum moment arm; NaN means constant moment arm */
  phiMax: number;
  /** joint angle at which the MTU is at lopt + lslack */
  phiRef: number;
  rho: number;
}

function att(joint: JointName, sign: number, r0: number, phiMaxDeg: number, phiRefDeg: number, rho: number): Attachment {
  return { joint: J[joint], sign, r0, phiMax: phiMaxDeg * DEG, phiRef: phiRefDeg * DEG, rho };
}

export const ATTACHMENTS: Record<MuscleName, Attachment[]> = {
  HFL: [att('hip', -1, 0.1, NaN, 180, 0.5)],
  GLU: [att('hip', +1, 0.1, NaN, 150, 0.5)],
  HAM: [att('hip', +1, 0.08, NaN, 155, 0.7), att('knee', -1, 0.05, 180, 180, 0.7)],
  VAS: [att('knee', +1, 0.06, 165, 125, 0.7)],
  GAS: [att('knee', -1, 0.05, 140, 165, 0.7), att('ankle', +1, 0.05, 110, 80, 0.7)],
  SOL: [att('ankle', +1, 0.05, 110, 80, 0.5)],
  TA: [att('ankle', -1, 0.04, 80, 110, 0.7)],
};

// segment geometry [m], masses [kg], inertia about the centre of mass [kg m^2]
export const GEOM = {
  trunkLen: 0.8,
  trunkCom: 0.35,
  trunkMass: 53.5,
  trunkI: 3.0,
  thighLen: 0.5,
  thighCom: 0.2,
  thighMass: 8.5,
  thighI: 0.15,
  shankLen: 0.5,
  shankCom: 0.2,
  shankMass: 3.5,
  shankI: 0.05,
  footMass: 1.25,
  footI: 0.005,
  footHeelX: -0.05,
  footToeX: 0.15,
  footSoleY: -0.05,
  footRadius: 0.03,
  footComX: 0.05,
  footComY: -0.04,
};
export const TOTAL_MASS = GEOM.trunkMass + 2 * (GEOM.thighMass + GEOM.shankMass + GEOM.footMass);
export const BODY_WEIGHT = TOTAL_MASS * 9.81;
/** hip height when standing straight */
export const STAND_HIP_HEIGHT = GEOM.thighLen + GEOM.shankLen - GEOM.footSoleY + GEOM.footRadius;

export interface Pose {
  x: number;
  lean: number;
  hip: [number, number];
  knee: [number, number];
  ankle: [number, number];
  vx?: number;
}

export const STAND_POSE: Pose = {
  x: 0,
  lean: 0.03,
  hip: [175 * DEG, 175 * DEG],
  knee: [172 * DEG, 172 * DEG],
  ankle: [93 * DEG, 93 * DEG],
};

/** standing with one foot a little behind the other, both soles flat on the ground */
export function staggeredStandPose(stagger = 7.5 * DEG, x = 0): Pose {
  const lean = 0.03;
  const knee = 176 * DEG;
  const hip: [number, number] = [Math.PI + stagger * 0.6, Math.PI - stagger * 1.4];
  const ankle = hip.map((h) => {
    const shank = -lean + (Math.PI - h) + (knee - Math.PI);
    return Math.PI / 2 + shank;
  }) as [number, number];
  return { x, lean, hip, knee: [knee, knee], ankle };
}

interface FootTag {
  leg: number;
  part: 'heel' | 'toe';
}

const KNEE_SOFT = 175 * DEG;
const SOFT_K = 0.3 / DEG; // N m / rad
const SOFT_WMAX = 1 * DEG; // rad / s

export class Biped {
  readonly world: World;
  trunk!: Body;
  thigh: Body[] = [];
  shank: Body[] = [];
  foot: Body[] = [];
  hipJ: RevoluteJoint[] = [];
  kneeJ: RevoluteJoint[] = [];
  ankleJ: RevoluteJoint[] = [];
  readonly muscles: Muscle[] = [];
  /** neural drive per muscle, index = leg * NM + muscle */
  readonly stim = new Float32Array(2 * NM);

  // ---- proprioception (updated every step) ----
  /** joint angles [leg*3 + joint] in Geyer convention (hip/knee 180° = straight, ankle 90° = neutral) */
  readonly phi = new Float32Array(6);
  readonly dphi = new Float32Array(6);
  /** forward lean of the trunk [rad] and its rate */
  theta = 0;
  dtheta = 0;
  /** low-pass filtered ground reaction per foot part, in body weights */
  readonly heelLoad = new Float32Array(2);
  readonly toeLoad = new Float32Array(2);
  private readonly heelImp = new Float32Array(2);
  private readonly toeImp = new Float32Array(2);
  /** impulse received by non-foot parts this step (pain) */
  private bodyImp = 0;
  /** filtered impact load on trunk / legs, in body weights */
  impact = 0;
  /** total metabolic power [W] */
  power = 0;

  constructor(world: World) {
    this.world = world;
    this.build();
    world.on('post-solve', (contact, impulse) => {
      const fa = contact.getFixtureA();
      const fb = contact.getFixtureB();
      const ta = fa.getUserData() as FootTag | 'body' | null;
      const tb = fb.getUserData() as FootTag | 'body' | null;
      const tag = ta ?? tb;
      if (!tag) return;
      let n = 0;
      const imp = impulse.normalImpulses;
      const count = contact.getManifold().pointCount;
      for (let i = 0; i < count; i++) n += imp[i];
      if (tag === 'body') this.bodyImp += n;
      else if (tag.part === 'heel') this.heelImp[tag.leg] += n;
      else this.toeImp[tag.leg] += n;
    });
    this.setPose(STAND_POSE);
  }

  private build(): void {
    const w = this.world;
    const g = GEOM;
    const filt = { filterGroupIndex: -1, friction: 0.6, restitution: 0 };
    const mk = (mass: number, comX: number, comY: number, icom: number): Body => {
      const b = w.createBody({ type: 'dynamic', position: new Vec2(0, 0), allowSleep: false, bullet: false });
      (b as unknown as { _m: unknown })._m = { mass, center: new Vec2(comX, comY), I: icom + mass * (comX * comX + comY * comY) };
      return b;
    };
    const fin = (b: Body): void => b.setMassData((b as unknown as { _m: { mass: number; center: Vec2; I: number } })._m);

    this.trunk = mk(g.trunkMass, 0, g.trunkCom, g.trunkI);
    this.trunk.createFixture({ shape: new Box(0.09, g.trunkLen / 2 - 0.04, new Vec2(0, g.trunkLen / 2 + 0.02), 0), density: 1, userData: 'body', ...filt });
    this.trunk.createFixture({ shape: new Circle(new Vec2(0, g.trunkLen - 0.1), 0.11), density: 1, userData: 'body', ...filt });
    fin(this.trunk);

    for (let leg = 0; leg < 2; leg++) {
      const th = mk(g.thighMass, 0, -g.thighCom, g.thighI);
      th.createFixture({ shape: new Box(0.06, g.thighLen / 2 - 0.03, new Vec2(0, -g.thighLen / 2), 0), density: 1, userData: 'body', ...filt });
      fin(th);
      const sh = mk(g.shankMass, 0, -g.shankCom, g.shankI);
      sh.createFixture({ shape: new Box(0.045, g.shankLen / 2 - 0.05, new Vec2(0, -g.shankLen / 2 + 0.02), 0), density: 1, userData: 'body', ...filt });
      fin(sh);
      const ft = mk(g.footMass, g.footComX, g.footComY, g.footI);
      const footFilt = { filterGroupIndex: -1, friction: 1.0, restitution: 0 };
      ft.createFixture({ shape: new Circle(new Vec2(g.footHeelX, g.footSoleY), g.footRadius), density: 1, userData: { leg, part: 'heel' } as FootTag, ...footFilt });
      ft.createFixture({ shape: new Circle(new Vec2(g.footToeX, g.footSoleY), g.footRadius), density: 1, userData: { leg, part: 'toe' } as FootTag, ...footFilt });
      fin(ft);
      this.thigh.push(th);
      this.shank.push(sh);
      this.foot.push(ft);

      // all bodies are still at the origin with angle 0, so anchors are simple
      const hip = new RevoluteJoint({ enableLimit: true, lowerAngle: -40 * DEG, upperAngle: 130 * DEG }, this.trunk, th, new Vec2(0, 0));
      th.setPosition(new Vec2(0, 0));
      sh.setPosition(new Vec2(0, -g.thighLen));
      const knee = new RevoluteJoint({ enableLimit: true, lowerAngle: -160 * DEG, upperAngle: -1 * DEG }, th, sh, new Vec2(0, -g.thighLen));
      ft.setPosition(new Vec2(0, -g.thighLen - g.shankLen));
      const ankle = new RevoluteJoint({ enableLimit: true, lowerAngle: -45 * DEG, upperAngle: 25 * DEG }, sh, ft, new Vec2(0, -g.thighLen - g.shankLen));
      this.hipJ.push(w.createJoint(hip)!);
      this.kneeJ.push(w.createJoint(knee)!);
      this.ankleJ.push(w.createJoint(ankle)!);

      for (const name of MUSCLE_NAMES) this.muscles.push(new Muscle(MUSCLE_PARAMS[name]));
    }
  }

  /** places the body in a pose with both feet just above the ground at height groundY */
  setPose(pose: Pose, groundY = 0): void {
    const g = GEOM;
    const tAng = -pose.lean;
    const place = (b: Body, x: number, y: number, a: number): void => {
      b.setTransform(new Vec2(x, y), a);
      b.setLinearVelocity(new Vec2(pose.vx ?? 0, 0));
      b.setAngularVelocity(0);
    };
    // first pass at hip height 0 to find the lowest sole point
    let minY = Infinity;
    const legs: { thA: number; shA: number; ftA: number; kx: number; ky: number; ax: number; ay: number }[] = [];
    for (let leg = 0; leg < 2; leg++) {
      const thA = tAng + (Math.PI - pose.hip[leg]);
      const shA = thA + (pose.knee[leg] - Math.PI);
      const ftA = shA + (Math.PI / 2 - pose.ankle[leg]);
      const kx = Math.sin(thA) * g.thighLen;
      const ky = -Math.cos(thA) * g.thighLen;
      const ax = kx + Math.sin(shA) * g.shankLen;
      const ay = ky - Math.cos(shA) * g.shankLen;
      for (const px of [g.footHeelX, g.footToeX]) {
        const y = ay + Math.sin(ftA) * px + Math.cos(ftA) * g.footSoleY - g.footRadius;
        if (y < minY) minY = y;
      }
      legs.push({ thA, shA, ftA, kx, ky, ax, ay });
    }
    const hy = groundY - minY + 0.002;
    place(this.trunk, pose.x, hy, tAng);
    for (let leg = 0; leg < 2; leg++) {
      const L = legs[leg];
      place(this.thigh[leg], pose.x, hy, L.thA);
      place(this.shank[leg], pose.x + L.kx, hy + L.ky, L.shA);
      place(this.foot[leg], pose.x + L.ax, hy + L.ay, L.ftA);
    }
    this.heelLoad.fill(0);
    this.toeLoad.fill(0);
    this.impact = 0;
    this.readAngles();
    for (let leg = 0; leg < 2; leg++) {
      for (let m = 0; m < NM; m++) this.muscles[leg * NM + m].reset(this.mtuLength(leg, m));
    }
    this.stim.fill(0.01);
  }

  private readAngles(): void {
    const tA = this.trunk.getAngle();
    this.theta = -tA;
    this.dtheta = -this.trunk.getAngularVelocity();
    for (let leg = 0; leg < 2; leg++) {
      const th = this.thigh[leg];
      const sh = this.shank[leg];
      const ft = this.foot[leg];
      const o = leg * 3;
      this.phi[o] = Math.PI - (th.getAngle() - tA);
      this.phi[o + 1] = Math.PI + (sh.getAngle() - th.getAngle());
      this.phi[o + 2] = Math.PI / 2 - (ft.getAngle() - sh.getAngle());
      this.dphi[o] = -(th.getAngularVelocity() - this.trunk.getAngularVelocity());
      this.dphi[o + 1] = sh.getAngularVelocity() - th.getAngularVelocity();
      this.dphi[o + 2] = -(ft.getAngularVelocity() - sh.getAngularVelocity());
    }
  }

  mtuLength(leg: number, m: number): number {
    const name = MUSCLE_NAMES[m];
    const p = MUSCLE_PARAMS[name];
    let l = p.lopt + p.lslack;
    for (const a of ATTACHMENTS[name]) {
      const phi = this.phi[leg * 3 + a.joint];
      if (Number.isNaN(a.phiMax)) l -= a.sign * a.rho * a.r0 * (phi - a.phiRef);
      else l -= a.sign * a.rho * a.r0 * (Math.sin(phi - a.phiMax) - Math.sin(a.phiRef - a.phiMax));
    }
    return l;
  }

  /** advance muscles and apply their joint torques; call right before world.step(dt) */
  preStep(dt: number): void {
    this.readAngles();
    this.heelImp.fill(0);
    this.toeImp.fill(0);
    this.bodyImp = 0;
    let power = 0;
    for (let leg = 0; leg < 2; leg++) {
      let tHip = 0;
      let tKnee = 0;
      let tAnkle = 0;
      for (let m = 0; m < NM; m++) {
        const mu = this.muscles[leg * NM + m];
        mu.step(this.mtuLength(leg, m), this.stim[leg * NM + m], dt);
        power += mu.power;
        for (const a of ATTACHMENTS[MUSCLE_NAMES[m]]) {
          const phi = this.phi[leg * 3 + a.joint];
          const r = Number.isNaN(a.phiMax) ? a.r0 : a.r0 * Math.cos(phi - a.phiMax);
          const t = a.sign * r * mu.force;
          if (a.joint === 0) tHip += t;
          else if (a.joint === 1) tKnee += t;
          else tAnkle += t;
        }
      }
      // soft knee stop (ligaments) and a little passive joint damping
      const o = leg * 3;
      const over = this.phi[o + 1] - KNEE_SOFT;
      if (over > 0) {
        const w = this.dphi[o + 1];
        if (w > -SOFT_WMAX) {
          const damp = Math.min((SOFT_K * over) / SOFT_WMAX, 30);
          tKnee -= SOFT_K * over + damp * w;
        }
      }
      tHip -= 0.5 * this.dphi[o];
      tKnee -= 0.5 * this.dphi[o + 1];
      tAnkle -= 0.2 * this.dphi[o + 2];

      // joint torque τ increases φ: see angle conventions in readAngles()
      this.trunk.applyTorque(tHip, true);
      this.thigh[leg].applyTorque(-tHip - tKnee, true);
      this.shank[leg].applyTorque(tKnee + tAnkle, true);
      this.foot[leg].applyTorque(-tAnkle, true);
    }
    this.power = power;
  }

  /** read contact sensors; call right after world.step(dt) */
  postStep(dt: number): void {
    const k = dt / 0.01; // 10 ms low-pass
    const s = 1 / (dt * BODY_WEIGHT);
    for (let leg = 0; leg < 2; leg++) {
      this.heelLoad[leg] += (this.heelImp[leg] * s - this.heelLoad[leg]) * k;
      this.toeLoad[leg] += (this.toeImp[leg] * s - this.toeLoad[leg]) * k;
    }
    this.impact += (this.bodyImp * s - this.impact) * k;
    this.readAngles();
  }

  legLoad(leg: number): number {
    return this.heelLoad[leg] + this.toeLoad[leg];
  }

  hipX(): number {
    return this.trunk.getPosition().x;
  }
  hipY(): number {
    return this.trunk.getPosition().y;
  }
  velX(): number {
    return this.trunk.getLinearVelocity().x;
  }

  /** centre of mass of the whole body */
  com(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const add = (b: Body): void => {
      const c = b.getWorldCenter();
      const m = b.getMass();
      x += c.x * m;
      y += c.y * m;
    };
    add(this.trunk);
    for (let leg = 0; leg < 2; leg++) {
      add(this.thigh[leg]);
      add(this.shank[leg]);
      add(this.foot[leg]);
    }
    return { x: x / TOTAL_MASS, y: y / TOTAL_MASS };
  }

  /** compact kinematic snapshot for rendering: x, y, angle for trunk, thighs, shanks, feet */
  snapshot(out: Float32Array, offset = 0): void {
    const put = (i: number, b: Body): void => {
      const p = b.getPosition();
      out[offset + i * 3] = p.x;
      out[offset + i * 3 + 1] = p.y;
      out[offset + i * 3 + 2] = b.getAngle();
    };
    put(0, this.trunk);
    for (let leg = 0; leg < 2; leg++) {
      put(1 + leg * 3, this.thigh[leg]);
      put(2 + leg * 3, this.shank[leg]);
      put(3 + leg * 3, this.foot[leg]);
    }
  }
}

export const SNAPSHOT_BODIES = 7;
