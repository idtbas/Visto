import { Physics } from '../src/sim/world/physics';
import { Network } from '../src/sim/brain/network';
import { SpinalCord } from '../src/sim/brain/spinal';
import { REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { staggeredStandPose } from '../src/sim/body/biped';
const ph = new Physics();
ph.biped.setPose(staggeredStandPose());
const net = new Network(1);
const sc = new SpinalCord(net, ph.biped, REFLEX_DEFAULTS, { scale: Number(process.argv[2] ?? 1) });
net.build();
let a = 0, b = 0, c = 0, d = 0;
const N = 3000;
for (let i = 0; i < N; i++) {
  let t = performance.now(); sc.sense(); a += performance.now() - t;
  t = performance.now(); net.step(); b += performance.now() - t;
  t = performance.now(); sc.act(); c += performance.now() - t;
  t = performance.now(); ph.step(); d += performance.now() - t;
}
console.log(`neurons ${net.n} syn ${net.nSynapses} | sense ${(a / N * 1000).toFixed(1)} µs, net ${(b / N * 1000).toFixed(1)} µs, act ${(c / N * 1000).toFixed(1)} µs, physics ${(d / N * 1000).toFixed(1)} µs | spikes/tick ${(net.totalSpikes / N).toFixed(1)}`);
