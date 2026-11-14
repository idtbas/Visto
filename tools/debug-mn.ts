import { readFileSync } from 'node:fs';
import { Physics } from '../src/sim/world/physics';
import { Network } from '../src/sim/brain/network';
import { SpinalCord } from '../src/sim/brain/spinal';
import { ReflexController, REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { staggeredStandPose } from '../src/sim/body/biped';
const p = REFLEX_DEFAULTS.slice();
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (let i = 0; i < j.params.length; i++) p[i] = j.params[i];
const target = process.argv[3] ?? 'MN_HFL_0';
const ph = new Physics();
const b = ph.biped;
b.setPose(staggeredStandPose());
const ctrl = new ReflexController(b, p);
ctrl.mode = 'stand';
const net = new Network(1);
const sc = new SpinalCord(net, b, p, {});
net.build();
sc.go = 0;
const sums = new Map<string, number>();
const T = 4000;
for (let i = 0; i < T; i++) {
  sc.sense(); net.step(); sc.act(); ctrl.step(); ph.step();
  for (const pop of net.pops) sums.set(pop.name, (sums.get(pop.name) ?? 0) + pop.count * 1000 / pop.n / T);
}
console.log(target, 'rate', sums.get(target)!.toFixed(1));
for (const pr of net.projs) if (pr.post.name === target) console.log(`  ${pr.channel} from ${pr.pre.name.padEnd(16)} rate ${sums.get(pr.pre.name)!.toFixed(1).padStart(6)} Hz  K=${(pr.w0 * pr.pre.n * 0.5).toFixed(1)}`);
for (const n of ['MLR', 'GOi', 'RESTi', 'POST', 'ST_0', 'STi_0', 'SWi_0', 'TR_0', 'TONw_0', 'Load_0', 'VestF', 'VestB']) console.log(n, sums.get(n)!.toFixed(1));
