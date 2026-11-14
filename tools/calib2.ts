// open-loop transfer of one reflex pathway: afferent signal -> interneurons -> motoneurons -> stimulation
import { Network, NT } from '../src/sim/brain/network';
const [n, p, noise, jit, bc, bj, K, typ] = process.argv.slice(2).map(Number);
const type = typ === 1 ? NT.FS : typ === 2 ? { a: 0.02, b: 0.2, c: -65, d: 0.5 } : NT.TONIC;
const out: string[] = [];
for (const sig of [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1]) {
  const net = new Network(1);
  const mk = (name: string, nn: number, bias: number, j: number) => net.addPop({ name, n: nn, type, region: 'x', bias, biasJitter: j, noise });
  const a = mk('a', n, 2.0, 0.6), b = mk('b', n, bc, bj), c = mk('c', 2 * n, bc, bj);
  net.connect({ pre: a, post: b, channel: 'E', p, w: K / (n * p), wJitter: jit, delay: [2, 6] });
  net.connect({ pre: b, post: c, channel: 'E', p, w: K / (n * p), wJitter: jit, delay: [2, 6] });
  net.build();
  let tr = 0, sum = 0, sum2 = 0, cnt = 0, ra = 0, rb = 0;
  for (let i = 0; i < 3000; i++) {
    for (let k = a.start; k < a.end; k++) net.iext[k] = sig > 0 ? 0.2 + 14.5 * sig : 0;
    net.step();
    tr += ((c.count * 1000) / (c.n * 80) - tr) / 12;
    if (i >= 1000) { sum += tr; sum2 += tr * tr; cnt++; ra += a.count; rb += b.count; }
  }
  const m = sum / cnt;
  out.push(`s=${sig}: ${(ra / n / 2).toFixed(0)}→${(rb / n / 2).toFixed(0)}Hz stim ${m.toFixed(2)}±${Math.sqrt(sum2 / cnt - m * m).toFixed(2)}`);
}
console.log(process.argv.slice(2).join(' '), '|', out.join(' | '));
