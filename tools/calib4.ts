// single-stage transfer: afferent pool at a given rate -> relay pool; looking for a linear setting
import { Network, NT } from '../src/sim/brain/network';
const n = 32, p = 0.5;
for (const [bias, bj, noise, K] of [[1.5, 1.5, 2.5, 20], [2.5, 1.0, 2.5, 20], [2.5, 1.0, 5, 20], [3.0, 1.0, 3, 18], [3.0, 0.7, 5, 18], [3.3, 0.5, 3, 16]]) {
  const out: string[] = [];
  for (const sig of [0, 0.03, 0.06, 0.12, 0.25, 0.5, 1]) {
    const net = new Network(1);
    const a = net.addPop({ name: 'a', n, type: NT.RELAY, region: 'x', bias: 2, biasJitter: 0.6, noise: 2 });
    const b = net.addPop({ name: 'b', n, type: NT.RELAY, region: 'x', bias, biasJitter: bj, noise });
    net.connect({ pre: a, post: b, channel: 'E', p, w: K / (n * p), wJitter: 0.5, delay: [2, 4] });
    net.build();
    let ra = 0, rb = 0;
    for (let i = 0; i < 4000; i++) {
      for (let k = a.start; k < a.end; k++) net.iext[k] = sig > 0 ? 0.5 + 10.5 * sig : -3;
      net.step();
      if (i >= 1000) { ra += a.count; rb += b.count; }
    }
    out.push(`${(ra / n / 3).toFixed(0)}→${(rb / n / 3).toFixed(0)}`);
  }
  console.log(`bias ${bias}±${bj} noise ${noise} K ${K}: ${out.join('  ')}`);
}
