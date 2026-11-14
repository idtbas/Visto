// f-I curves and pool-to-pool transfer, to design the innate wiring
import { Network, NT } from '../src/sim/brain/network';
for (const [name, type] of Object.entries(NT)) {
  const row: string[] = [];
  for (const I of [2, 3, 4, 5, 6, 8, 10, 15, 20, 30]) {
    const net = new Network(1);
    const p = net.addPop({ name: 'p', n: 100, type, region: 'x', bias: I, biasJitter: 1, noise: 1.5 });
    net.build();
    for (let i = 0; i < 500; i++) net.step();
    net.totalSpikes = 0;
    for (let i = 0; i < 2000; i++) net.step();
    row.push(`${I}:${(net.totalSpikes / 100 / 2).toFixed(0)}`);
  }
  console.log(name.padEnd(6), row.join('  '));
}
// transfer: pre pool at rate r -> post pool
console.log('transfer (pre 40 neurons, p=0.5, w): post rate for pre current');
for (const w of [0.2, 0.4, 0.8]) {
  const row: string[] = [];
  for (const I of [4, 6, 10, 15, 20, 30]) {
    const net = new Network(1);
    const a = net.addPop({ name: 'a', n: 40, type: NT.TONIC, region: 'x', bias: I, biasJitter: 1, noise: 1.5 });
    const b = net.addPop({ name: 'b', n: 40, type: NT.TONIC, region: 'x', bias: 2, biasJitter: 1, noise: 1.5 });
    net.connect({ pre: a, post: b, channel: 'E', p: 0.5, w, delay: [1, 3] });
    net.build();
    for (let i = 0; i < 500; i++) net.step();
    let sa = 0, sb = 0;
    for (let i = 0; i < 2000; i++) { net.step(); sa += a.count; sb += b.count; }
    row.push(`${(sa / 80).toFixed(0)}→${(sb / 80).toFixed(0)}`);
  }
  console.log(`w=${w}`, row.join('  '));
}
