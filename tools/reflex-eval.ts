import { Vec2 } from 'planck';
import { Physics } from '../src/sim/world/physics';
import { ReflexController, initialPose } from '../src/sim/control/reflex';
import { staggeredStandPose } from '../src/sim/body/biped';

export interface EvalResult {
  fitness: number;
  time: number;
  dist: number;
  steps: number;
  energy: number;
}

export interface EvalOptions {
  T?: number;
  /** seconds of standing (with a push) before the walk command; 0 = start in mid-stride with initial speed */
  standFor?: number;
  push?: number;
  /** repeat the push every two seconds with alternating direction */
  pushes?: boolean;
  /** impulse applied to the trunk three seconds into walking */
  walkPush?: number;
  log?: boolean;
}

export function evaluateReflex(p: ArrayLike<number>, opt: EvalOptions = {}): EvalResult {
  const T = opt.T ?? 12;
  const standFor = opt.standFor ?? 0;
  const ph = new Physics();
  const b = ph.biped;
  b.setPose(standFor > 0 ? staggeredStandPose() : initialPose(p));
  const ctrl = new ReflexController(b, p);
  ctrl.mode = standFor > 0 ? 'stand' : 'walk';
  const n = Math.round(T * 1000);
  const goTick = Math.round(standFor * 1000);
  let steps = 0;
  let energy = 0;
  let sway = 0;
  let xGo = 0;
  const lastStance = [true, true];
  let i = 0;
  for (; i < n; i++) {
    if (i === goTick) {
      ctrl.mode = 'walk';
      xGo = b.hipX();
    }
    if (standFor > 0 && opt.push) {
      if (opt.pushes) {
        // alternating pushes every two seconds while standing
        if (i % 2000 === 1500 && i < goTick - 300) b.trunk.applyLinearImpulse(new Vec2(((i / 2000) & 1 ? -1 : 1) * opt.push, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
      } else if (i === Math.round(standFor * 400)) {
        b.trunk.applyLinearImpulse(new Vec2(opt.push, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
      }
    }
    if (opt.walkPush && i === 3000) b.trunk.applyLinearImpulse(new Vec2(opt.walkPush, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
    ctrl.step();
    ph.step();
    energy += b.power * 0.001;
    if (i < goTick) sway += Math.abs(b.velX()) * 0.001;
    else {
      for (let leg = 0; leg < 2; leg++) {
        if (ctrl.stance[leg] && !lastStance[leg]) steps++;
        lastStance[leg] = ctrl.stance[leg];
      }
    }
    if (opt.log && i % 100 === 0) {
      console.log(
        `t=${(i / 1000).toFixed(1)} ${ctrl.mode} x=${b.hipX().toFixed(2)} y=${b.hipY().toFixed(2)} v=${b.velX().toFixed(2)} lean=${b.theta.toFixed(2)} st=${ctrl.stance.map((s) => (s ? 1 : 0)).join('')} ` +
          `knee=${((b.phi[1] * 180) / Math.PI).toFixed(0)}/${((b.phi[4] * 180) / Math.PI).toFixed(0)} hip=${((b.phi[0] * 180) / Math.PI).toFixed(0)}/${((b.phi[3] * 180) / Math.PI).toFixed(0)} ank=${((b.phi[2] * 180) / Math.PI).toFixed(0)}/${((b.phi[5] * 180) / Math.PI).toFixed(0)} cop=${(b.toeLoad[0] - b.heelLoad[0]).toFixed(2)}`,
      );
    }
    if (b.hipY() < 0.7 || Math.abs(b.theta) > 1.0 || b.impact > 0.05) break;
  }
  const time = i / 1000;
  const walkTime = Math.max(0, time - standFor);
  const dist = b.hipX() - xGo;
  let fitness = time - 2 * sway;
  if (i >= goTick) {
    fitness += Math.min(Math.max(dist, -1), 1.3 * walkTime) + Math.min(steps, 2 * walkTime) * 0.3;
  }
  if (i >= n) {
    const v = dist / Math.max(walkTime, 0.5);
    const cot = energy / (80 * 9.81 * Math.max(dist, 0.1));
    fitness += 5 - 3 * Math.abs(v - 1.2) - Math.min(3, cot);
  }
  return { fitness, time, dist, steps, energy };
}
