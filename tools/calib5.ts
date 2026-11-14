// onset-transient cells: response of strongly adapting neurons to a step of input
import { Network } from '../src/sim/brain/network';
for (const [a, b, d, I] of [[0.004, 0.2, 12, 12], [0.004, 0.2, 25, 12], [0.006, 0.25, 20, 12], [0.003, 0.25, 20, 12], [0.004, 0.26, 20, 14]]) {
  const net = new Network(1);
  const p = net.addPop({ name: 'p', n: 64, type: { a, b, c: -65, d }, region: 'x', bias: 0, biasJitter: 1.5, noise: 2.5 });
  net.build();
  const out: string[] = [];
  let acc = 0;
  for (let i = 0; i < 2600; i++) {
    for (let k = p.start; k < p.end; k++) net.iext[k] = i >= 500 && i < 2000 ? I : 0;
    net.step();
    acc += p.count;
    if (i % 100 === 99) { out.push((acc / 64 * 10).toFixed(0)); acc = 0; }
  }
  console.log(`a=${a} b=${b} d=${d} I=${I}: ${out.join(' ')}`);
}
