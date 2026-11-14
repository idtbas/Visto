// How high do the feet travel during swing with the high-step command, and does the gait survive it?
// usage: tsx tools/clearance.ts <level> [seconds]
import { Sim } from '../src/sim/sim';
import { GEOM } from '../src/sim/body/biped';
const hs = Number(process.argv[2] ?? 1);
const secs = Number(process.argv[3] ?? 20);
const out: string[] = [];
for (let seed = 1; seed <= 4; seed++) {
  const sim = new Sim({ learn: false, newbornTone: 1, seed });
  sim.autoCookies = false;
  const b = sim.physics.biped;
  let n = 0, minMid = 9, minMidSum = 0, falls = 0, inSwing = false;
  let last = sim.life.falls;
  for (let i = 0; i < secs * 1000; i++) {
    sim.brain.spinal.highStep = i > 4000 ? hs : 0;
    sim.tick();
    if (i < 4000) { last = sim.life.falls; continue; }
    if (sim.life.falls > last) { falls++; last = sim.life.falls; }
    if (sim.life.state !== 'walking') continue;
    const f = b.foot[0];
    const toe = f.getWorldPoint({ x: GEOM.footToeX, y: GEOM.footSoleY - GEOM.footRadius } as never).y;
    const heel = f.getWorldPoint({ x: GEOM.footHeelX, y: GEOM.footSoleY - GEOM.footRadius } as never).y;
    const low = Math.min(toe, heel);
    if (b.legLoad(0) < 0.02) {
      inSwing = true;
      if (Math.abs(f.getPosition().x - b.foot[1].getPosition().x) < 0.15 && low < minMid) minMid = low;
    } else if (inSwing) {
      inSwing = false;
      if (minMid < 9) { minMidSum += minMid; n++; }
      minMid = 9;
    }
  }
  out.push(`${(minMidSum / Math.max(1, n) * 100).toFixed(1)}cm/${falls}f`);
}
console.log(`high-step ${hs}: clearance / falls in ${secs - 4} s per seed: ${out.join('  ')}`);
