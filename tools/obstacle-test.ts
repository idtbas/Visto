// Can the walker get over a block, with and without the high-step command?
// usage: tsx tools/obstacle-test.ts <height m> <high-step 0..1> [seed] [width]
import { Sim } from '../src/sim/sim';
const h = Number(process.argv[2] ?? 0.06);
const hs = Number(process.argv[3] ?? 0);
const results: string[] = [];
for (let seed = 1; seed <= Number(process.argv[4] ?? 4); seed++) {
  const sim = new Sim({ learn: false, newbornTone: 1, seed });
  sim.autoCookies = false;
  const x0 = 5 + 0.13 * seed; // vary where the feet meet the block
  sim.physics.terrain.addBlock(x0, Number(process.argv[5] ?? 0.2), h);
  let fellAt = -1;
  for (let i = 0; i < 12000; i++) {
    const x = sim.physics.biped.hipX();
    sim.brain.spinal.highStep = x > x0 - 1.2 && x < x0 + 0.6 ? hs : 0;
    sim.tick();
    if (sim.life.state === 'fallen') { fellAt = x; break; }
  }
  results.push(fellAt < 0 ? `ok(${sim.physics.biped.hipX().toFixed(1)}m)` : `fell@${fellAt.toFixed(1)}`);
}
console.log(`block ${h} m, high-step ${hs}: ${results.join('  ')}`);
