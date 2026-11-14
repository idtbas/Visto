// How high do the feet travel during swing, with and without the high-step command?
import { Sim } from '../src/sim/sim';
import { GEOM } from '../src/sim/body/biped';
for (const hs of [0, 0.5, 1]) {
  const sim = new Sim({ learn: false, newbornTone: 1, seed: 1 });
  sim.autoCookies = false;
  const b = sim.physics.biped;
  let peakSum = 0, n = 0, peak = 0, minMid = 9, minMidSum = 0;
  let inSwing = false;
  let fell = false;
  for (let i = 0; i < 10000; i++) {
    sim.brain.spinal.highStep = i > 3000 ? hs : 0;
    sim.tick();
    if (sim.life.state === 'fallen') { fell = true; break; }
    if (i < 4000) continue;
    const f = b.foot[0];
    const toe = f.getWorldPoint({ x: GEOM.footToeX, y: GEOM.footSoleY - GEOM.footRadius } as never).y;
    const heel = f.getWorldPoint({ x: GEOM.footHeelX, y: GEOM.footSoleY - GEOM.footRadius } as never).y;
    const low = Math.min(toe, heel);
    const sw = b.legLoad(0) < 0.02;
    if (sw) {
      inSwing = true;
      if (low > peak) peak = low;
      // clearance while the swing foot passes the stance foot
      if (Math.abs(f.getPosition().x - b.foot[1].getPosition().x) < 0.15 && low < minMid) minMid = low;
    } else if (inSwing) {
      inSwing = false;
      peakSum += peak; minMidSum += minMid < 9 ? minMid : 0; n++;
      peak = 0; minMid = 9;
    }
  }
  console.log(`high-step ${hs}: ${n} swings, mean peak height of lowest foot point ${(peakSum / n * 100).toFixed(1)} cm, clearance passing stance foot ${(minMidSum / n * 100).toFixed(1)} cm, speed ${b.velX().toFixed(2)}${fell ? ' FELL' : ''}`);
}
