// Scores the innate spinal wiring by letting the creature live for a few seconds.
import { Vec2 } from 'planck';
import { Sim } from '../src/sim/sim';
import type { EvalResult } from './reflex-eval';

export interface SpinalEvalOptions {
  T?: number;
  /** seconds of standing before the walk command; Infinity = only stand */
  standFor?: number;
  push?: number;
  log?: boolean;
  scale?: number;
  mult?: ArrayLike<number>;
  seed?: number;
}

export function evaluateSpinal(p: ArrayLike<number>, opt: SpinalEvalOptions = {}): EvalResult & { neurons: number; synapses: number } {
  const T = opt.T ?? 12;
  const standFor = opt.standFor ?? 2;
  const sim = new Sim({ params: Array.from(p), mult: opt.mult ? Array.from(opt.mult) : undefined, learn: false, seed: opt.seed ?? 1, brainScale: opt.scale ?? 1 });
  sim.autoCookies = false;
  sim.standBeforeGo = Math.min(standFor, 1e6);
  sim.wantsToWalk = Number.isFinite(standFor);
  const b = sim.physics.biped;
  const n = Math.round(T * 1000);
  let steps = 0;
  let energy = 0;
  let sway = 0;
  let xGo = b.hipX();
  let walking = false;
  const stance = [true, true];
  let i = 0;
  const pushAt = Math.round(Math.min(standFor, T) * 500);
  for (; i < n; i++) {
    if (opt.push && i === pushAt) b.trunk.applyLinearImpulse(new Vec2(opt.push, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
    sim.tick();
    energy += b.power * 0.001;
    if (sim.life.state === 'fallen') break;
    if (sim.life.state === 'standing') sway += Math.abs(b.velX()) * 0.001;
    else {
      if (!walking) {
        walking = true;
        xGo = b.hipX();
      }
      for (let leg = 0; leg < 2; leg++) {
        const s = stance[leg] ? b.legLoad(leg) > 0.02 : b.legLoad(leg) > 0.08;
        if (s && !stance[leg]) steps++;
        stance[leg] = s;
      }
    }
    if (opt.log && i % 100 === 0) {
      const st = [...b.stim].map((v) => Math.round(v * 99).toString().padStart(2, ' ')).join(' ');
      console.log(
        `t=${(i / 1000).toFixed(1)} ${sim.life.state.slice(0, 5)} x=${b.hipX().toFixed(2)} y=${b.hipY().toFixed(2)} v=${b.velX().toFixed(2)} lean=${b.theta.toFixed(2)} ld=${b.legLoad(0).toFixed(1)}/${b.legLoad(1).toFixed(1)} ` +
          `knee=${((b.phi[1] * 180) / Math.PI).toFixed(0)}/${((b.phi[4] * 180) / Math.PI).toFixed(0)} hip=${((b.phi[0] * 180) / Math.PI).toFixed(0)}/${((b.phi[3] * 180) / Math.PI).toFixed(0)} | ${st}`,
      );
    }
  }
  if (opt.log) console.log('muscles: HFL GLU HAM VAS GAS SOL TA (left, right)');
  const time = i / 1000;
  const standTime = Math.min(time, standFor);
  const walkTime = Math.max(0, time - standFor);
  const dist = walking ? b.hipX() - xGo : 0;
  let fitness = time - 2 * sway;
  if (walking) fitness += Math.min(Math.max(dist, -1), 1.3 * walkTime) + Math.min(steps, 2 * walkTime) * 0.3;
  if (i >= n && walking) {
    const v = dist / Math.max(walkTime, 0.5);
    const cot = energy / (80 * 9.81 * Math.max(dist, 0.1));
    fitness += 5 - 3 * Math.abs(v - 1.2) - Math.min(3, cot);
  }
  void standTime;
  return { fitness, time, dist, steps, energy, neurons: sim.brain.net.n, synapses: sim.brain.net.nSynapses };
}
