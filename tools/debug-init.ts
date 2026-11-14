// time course of the gait-initiation circuit after the walk command
import { Physics } from '../src/sim/world/physics';
import { Network } from '../src/sim/brain/network';
import { SpinalCord } from '../src/sim/brain/spinal';
import { REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { staggeredStandPose } from '../src/sim/body/biped';
const ph = new Physics();
ph.biped.setPose(staggeredStandPose());
const net = new Network(1);
const sc = new SpinalCord(net, ph.biped, REFLEX_DEFAULTS, {});
net.build();
const names = ['MLR', 'GOslow', 'INIT', 'INITi', 'INITtr_0', 'INITtr_1', 'GOi', 'RESTi'];
const acc = names.map(() => 0);
for (let i = 0; i < 1200; i++) {
  sc.go = i >= 300 ? 1 : 0;
  sc.sense(); net.step();
  names.forEach((n, k) => (acc[k] += net.pop(n).count * 1000 / net.pop(n).n / 50));
  if (i % 50 === 49) { console.log(`t=${i - 299} ms  ` + names.map((n, k) => `${n} ${acc[k].toFixed(0)}`).join('  ')); acc.fill(0); }
}
