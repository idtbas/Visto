// How well does the innate (mature) nervous system walk? usage: tsx tools/mature-test.ts [seconds] [seeds]
import { Sim } from '../src/sim/sim';
import type { ModuleName } from '../src/sim/brain/brain';
const T = Number(process.argv[2] ?? 60);
const seeds = Number(process.argv[3] ?? 4);
for (let seed = 1; seed <= seeds; seed++) {
  const sim = new Sim({ learn: false, seed });
  // LESION=workspace,efference ... switches parts of the architecture off
  for (const m of (process.env.LESION ?? '').split(',').filter(Boolean)) sim.brain.setModule(m as ModuleName, false);
  const t0 = performance.now();
  const x0 = sim.physics.biped.hipX();
  for (let i = 0; i < T * 1000; i++) sim.tick();
  console.log(`seed ${seed} (${sim.brain.net.engine}): falls ${sim.life.falls}, ignitions ${sim.brain.workspace.names.map((n, k) => `${n} ${sim.brain.workspace.ignitions[k]}`).join(' ')}, distance ${(sim.physics.biped.hipX() - x0).toFixed(1)} m, ${((T * 1000) / (performance.now() - t0)).toFixed(2)}x realtime`);
}
