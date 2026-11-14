import { Physics, DT } from '../src/sim/world/physics';
import { ReflexController, initialPose, REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { REFLEX_GENOME } from '../src/sim/control/genome';
const p = REFLEX_DEFAULTS.map((v, i) => REFLEX_GENOME[i] ?? v);
for (const [vi, pi] of [[8, 3], [4, 2], [3, 1]]) {
  const ph = new Physics();
  const b = ph.biped;
  b.setPose(initialPose(p));
  const c = new ReflexController(b, p);
  let tPre = 0, tStep = 0, tCtl = 0;
  const N = 8000;
  for (let i = 0; i < N; i++) {
    let t = performance.now();
    c.step();
    tCtl += performance.now() - t;
    t = performance.now();
    b.preStep(DT);
    tPre += performance.now() - t;
    t = performance.now();
    ph.world.step(DT, vi, pi);
    tStep += performance.now() - t;
    b.postStep(DT);
  }
  console.log(`iters ${vi}/${pi}: ctl ${(tCtl / N * 1000).toFixed(1)} µs, muscles ${(tPre / N * 1000).toFixed(1)} µs, world.step ${(tStep / N * 1000).toFixed(1)} µs, x=${b.hipX().toFixed(2)} y=${b.hipY().toFixed(2)}`);
}
