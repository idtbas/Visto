// sanity check: does the body stand on tonic muscle tone, and what does it weigh on its feet?
import { Physics } from '../src/sim/world/physics';
import { MUSCLE_NAMES, NM, M, STAND_POSE } from '../src/sim/body/biped';

for (const tone of [0.01, 0.1]) {
  const ph = new Physics();
  const b = ph.biped;
  b.setPose(STAND_POSE);
  const t0 = performance.now();
  for (let i = 0; i < 3000; i++) {
    b.stim.fill(tone);
    ph.step();
    if (i % 500 === 499) {
      const f = [...b.muscles.slice(0, NM)].map((m) => m.force.toFixed(0)).join(' ');
      console.log(
        `tone ${tone} t=${ph.time.toFixed(2)} hipY=${b.hipY().toFixed(3)} lean=${b.theta.toFixed(3)} load=${b.legLoad(0).toFixed(2)}/${b.legLoad(1).toFixed(2)} ` +
          `hip=${((b.phi[0] * 180) / Math.PI).toFixed(0)} knee=${((b.phi[1] * 180) / Math.PI).toFixed(0)} ankle=${((b.phi[2] * 180) / Math.PI).toFixed(0)} F[${f}] impact=${b.impact.toFixed(2)}`,
      );
    }
  }
  console.log(`  3 s simulated in ${(performance.now() - t0).toFixed(0)} ms`, MUSCLE_NAMES.join(' '), M.SOL);
}
