// which pools drive a motoneuron pool in the closed loop?
import { readFileSync } from 'node:fs';
import { Sim } from '../src/sim/sim';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const target = process.argv[3] ?? 'MN_HFL_0';
const t0 = Number(process.argv[4] ?? 100), t1 = Number(process.argv[5] ?? 300);
const sim = new Sim({ params: j.params, mult: j.mult, learn: false });
sim.standBeforeGo = Number(process.argv[6] ?? 2);
const net = sim.brain.net;
const sums = new Map<string, number>();
for (let i = 0; i < t1; i++) {
  sim.tick();
  if (i >= t0) for (const pop of net.pops) sums.set(pop.name, (sums.get(pop.name) ?? 0) + (pop.count * 1000) / pop.n / (t1 - t0));
}
console.log(target, 'rate', sums.get(target)!.toFixed(1), 'lean', sim.physics.biped.theta.toFixed(3));
for (const pr of net.projs) if (pr.post.name === target) console.log(`  ${pr.channel} from ${pr.pre.name.padEnd(16)} rate ${sums.get(pr.pre.name)!.toFixed(1).padStart(6)} Hz  K=${(pr.w0 * pr.pre.n * 0.5).toFixed(1)}`);
for (const n of ['MLR', 'GOi', 'RESTi', 'POST', 'INIT', 'ST_0', 'STi_0', 'SWi_0', 'TR_0', 'Load_0', 'HipExt_0', 'VestF', 'VestB', 'VTA']) console.log(n, sums.get(n)!.toFixed(1));
