import { Vec2 } from 'planck';
import { Physics } from '../src/sim/world/physics';
import { Network } from '../src/sim/brain/network';
import { SpinalCord } from '../src/sim/brain/spinal';
import { initialPose } from '../src/sim/control/reflex';
import { staggeredStandPose, NM, MUSCLE_NAMES } from '../src/sim/body/biped';
import type { EvalResult } from './reflex-eval';

export interface SpinalEvalOptions {
  T?: number;
  standFor?: number;
  push?: number;
  log?: boolean;
  scale?: number;
  mult?: ArrayLike<number>;
  seed?: number;
}

export function evaluateSpinal(p: ArrayLike<number>, opt: SpinalEvalOptions = {}): EvalResult & { neurons: number; synapses: number } {
  const T = opt.T ?? 12;
  const standFor = opt.standFor ?? 0;
  const ph = new Physics();
  const b = ph.biped;
  b.setPose(standFor > 0 ? staggeredStandPose() : initialPose(p));
  const net = new Network(opt.seed ?? 1);
  const sc = new SpinalCord(net, b, p, { scale: opt.scale ?? 1, mult: opt.mult });
  net.build();
  sc.go = standFor > 0 ? 0 : 1;
  // let the network settle on the initial posture before the body is released
  for (let i = 0; i < 200; i++) {
    if (standFor > 0) {
      b.heelLoad.fill(0.25);
      b.toeLoad.fill(0.25);
    } else {
      b.heelLoad[1] = b.toeLoad[1] = 0.5;
    }
    sc.sense();
    net.step();
    sc.act();
  }
  const n = Math.round(T * 1000);
  const goTick = Math.round(standFor * 1000);
  let steps = 0;
  let energy = 0;
  let sway = 0;
  let xGo = 0;
  const stance = [true, true];
  let i = 0;
  for (; i < n; i++) {
    if (i === goTick) {
      sc.go = 1;
      xGo = b.hipX();
    }
    if (standFor > 0 && opt.push && i === Math.round(standFor * 400)) {
      b.trunk.applyLinearImpulse(new Vec2(opt.push, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
    }
    sc.sense();
    net.step();
    sc.act();
    ph.step();
    energy += b.power * 0.001;
    if (i < goTick) sway += Math.abs(b.velX()) * 0.001;
    else {
      for (let leg = 0; leg < 2; leg++) {
        const s = stance[leg] ? b.legLoad(leg) > 0.02 : b.legLoad(leg) > 0.08;
        if (s && !stance[leg]) steps++;
        stance[leg] = s;
      }
    }
    if (opt.log && i % 100 === 0) {
      const st = [...b.stim].map((v) => Math.round(v * 99).toString().padStart(2, ' ')).join(' ');
      console.log(
        `t=${(i / 1000).toFixed(1)} x=${b.hipX().toFixed(2)} y=${b.hipY().toFixed(2)} v=${b.velX().toFixed(2)} lean=${b.theta.toFixed(2)} ld=${b.legLoad(0).toFixed(1)}/${b.legLoad(1).toFixed(1)} ` +
          `knee=${((b.phi[1] * 180) / Math.PI).toFixed(0)}/${((b.phi[4] * 180) / Math.PI).toFixed(0)} hip=${((b.phi[0] * 180) / Math.PI).toFixed(0)}/${((b.phi[3] * 180) / Math.PI).toFixed(0)} | ${st}`,
      );
    }
    if (b.hipY() < 0.7 || Math.abs(b.theta) > 1.0 || b.impact > 0.05) break;
  }
  if (opt.log) console.log('muscles:', MUSCLE_NAMES.join(' '), NM);
  const time = i / 1000;
  const walkTime = Math.max(0, time - standFor);
  const dist = b.hipX() - xGo;
  let fitness = time - 2 * sway;
  if (i >= goTick) fitness += Math.min(Math.max(dist, -1), 1.3 * walkTime) + Math.min(steps, 2 * walkTime) * 0.3;
  if (i >= n) {
    const v = dist / Math.max(walkTime, 0.5);
    const cot = energy / (80 * 9.81 * Math.max(dist, 0.1));
    fitness += 5 - 3 * Math.abs(v - 1.2) - Math.min(3, cot);
  }
  return { fitness, time, dist, steps, energy, neurons: net.n, synapses: net.nSynapses };
}
