// Sanity check of the learning rule on the simplest possible task:
// one pathway must learn to deliver a target firing rate, guided only by dopamine.
import { Network, NT } from '../src/sim/brain/network';
import { gaussian } from '../src/sim/util/rng';
import { currentForRate } from '../src/sim/brain/spinal';

const target = Number(process.argv[2] ?? 60);
const lr = Number(process.argv[3] ?? 2e-7);
const w0 = Number(process.argv[4] ?? 0.4);
const net = new Network(3);
const n = 32;
const aff = net.addPop({ name: 'aff', n, type: NT.RELAY, region: 'x', bias: 2, biasJitter: 0.6, noise: 2 });
const inn = net.addPop({ name: 'in', n, type: NT.RELAY, region: 'x', bias: 1, biasJitter: 1.5, noise: 2.5 });
const ex = net.addPop({ name: 'ex', n: 8, type: NT.RELAY, region: 'x', bias: 2, biasJitter: 0.6, noise: 2 });
const K = 20 * w0;
const w = K / (n * 0.5);
const pr = net.connect({ pre: aff, post: inn, channel: 'E', p: 0.5, w, wJitter: 0.5, delay: [1, 3], plastic: { rule: 'perturb', lr: lr * w, tauE: 400, wMin: 0, wMax: 20 * w } });
net.connect({ pre: ex, post: inn, channel: 'X', p: 1, w: 0.35, wJitter: 0.2, delay: [1, 3] });
net.build();
let x = 0, rate = 0, rbar = 0, da = 0;
const affCur = currentForRate(40);
for (let t = 0; t < 600000; t++) {
  x += -x / 300 + Math.sqrt(2 / 300) * gaussian(net.rng);
  const exRate = Math.min(75, Math.max(0, 30 * (1 + x)));
  const exCur = currentForRate(exRate);
  for (let i = aff.start; i < aff.end; i++) net.iext[i] = affCur;
  for (let i = ex.start; i < ex.end; i++) net.iext[i] = exCur;
  rate += ((inn.count * 1000) / n - rate) / 100; // 100 ms rate estimate
  const reward = -(((rate - target) / 30) ** 2);
  rbar += (reward - rbar) / 5000;
  da = reward - rbar;
  net.dopamine = Math.max(-1, Math.min(3, da * 2));
  net.step();
  if (t % 30000 === 29999) console.log(`t=${((t + 1) / 1000).toFixed(0)} s  rate ${inn.rate.toFixed(1)} Hz (target ${target})  mean weight ${(pr.meanWeight() / w).toFixed(2)}×  reward ${rbar.toFixed(3)}`);
}
