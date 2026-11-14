// Does the circuit behind the amygdala turn a change of expectation into a dopamine signal?
// Drives the amygdala cells with a step and a ramp and prints what the other pools do.
import { Sim } from '../src/sim/sim';
import { currentForRate } from '../src/sim/brain/spinal';
const sim = new Sim({ learn: false, seed: 1, startInStride: false });
sim.setWantsToWalk(false);
const { amygdala: a, net, reward, pain } = sim.brain;
const profile = (t: number): number => (t < 1000 ? 0 : t < 2000 ? 60 : t < 3000 ? 0 : t < 4000 ? ((t - 3000) / 1000) * 80 : t < 5000 ? 80 : t < 6000 ? 80 - ((t - 5000) / 1000) * 80 : 0);
const acc = [0, 0, 0, 0, 0, 0, 0];
for (let t = 0; t < 7000; t++) {
  const r = profile(t);
  sim.tick();
  const cur = r > 0 ? currentForRate(r) + 1.5 : 0;
  for (let i = a.cells.start; i < a.cells.end; i++) net.iext[i] = cur;
  [a.cells, a.slow, a.rising, a.falling, pain.rmtg, reward.vta].forEach((p, k) => (acc[k] += p.count * (1000 / p.n)));
  acc[6] += reward.level;
  if (t % 100 === 99) {
    console.log(`${String(t + 1).padStart(5)} ms  drive ${String(Math.round(profile(t))).padStart(2)} Hz | cells ${(acc[0] / 100).toFixed(0).padStart(3)}  sluggish ${(acc[1] / 100).toFixed(0).padStart(3)}  rising ${(acc[2] / 100).toFixed(0).padStart(3)}  falling ${(acc[3] / 100).toFixed(0).padStart(3)}  RMTg ${(acc[4] / 100).toFixed(0).padStart(3)}  VTA ${(acc[5] / 100).toFixed(1).padStart(5)} Hz  dopamine ${(acc[6] / 100).toFixed(2)}`);
    acc.fill(0);
  }
}
