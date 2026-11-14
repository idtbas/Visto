import { Network, NT } from '../src/sim/brain/network';
const [n, p, noise, jit, bj] = process.argv.slice(2).map(Number);
const sig = 0.5;
const net = new Network(1);
const mk = (name: string, nn: number, bias: number) => net.addPop({ name, n: nn, type: NT.TONIC, region: 'x', bias, biasJitter: bj, noise });
const a = mk('a', n, 2.0), b = mk('b', n, 2.0), c = mk('c', 2 * n, 1.9);
net.connect({ pre: a, post: b, channel: 'E', p, w: 33.3 / (n * p), wJitter: jit, delay: [2, 6] });
net.connect({ pre: b, post: c, channel: 'E', p, w: 33.3 / (n * p), wJitter: jit, delay: [2, 6] });
net.build();
let la = '', lb = '', lc = '';
for (let i = 0; i < 1100; i++) {
  for (let k = a.start; k < a.end; k++) net.iext[k] = 0.2 + 14.5 * sig;
  net.step();
  if (i >= 1000) { la += a.count.toString(36); lb += b.count.toString(36); lc += Math.min(35, c.count).toString(36); }
}
console.log('aff', la); console.log('in ', lb); console.log('mn ', lc);
