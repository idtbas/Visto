import { Network, NT } from '../src/sim/brain/network';
const N = 30000;
for (const mode of ['noconn', 'conn']) {
  const net = new Network(1);
  const exc = net.addPop({ name: 'exc', n: N * 0.8, type: NT.RS, region: 'x', bias: 2.5, biasJitter: 2.5, noise: 3 });
  const inh = net.addPop({ name: 'inh', n: N * 0.2, type: NT.FS, region: 'x', bias: 1, biasJitter: 2, noise: 3, inhibitory: true });
  if (mode === 'conn') {
    net.connect({ pre: exc, post: exc, channel: 'E', fanOut: 80, w: 0.5, wJitter: 0.5, delay: [1, 15] });
    net.connect({ pre: exc, post: inh, channel: 'E', fanOut: 20, w: 0.5, wJitter: 0.5, delay: [1, 5] });
    net.connect({ pre: inh, post: exc, channel: 'I', fanOut: 80, w: 1.2, wJitter: 0.5, delay: 1 });
    net.connect({ pre: inh, post: inh, channel: 'I', fanOut: 20, w: 1.2, wJitter: 0.5, delay: 1 });
  }
  net.build();
  for (let i = 0; i < 300; i++) net.step();
  net.totalSpikes = 0;
  const t1 = performance.now();
  for (let i = 0; i < 1000; i++) net.step();
  const ms = performance.now() - t1;
  console.log(mode, `${ms.toFixed(0)} ms, ${((ms * 1e6) / (N * 1000)).toFixed(1)} ns/neuron-tick, rate ${(net.totalSpikes / N).toFixed(1)} Hz`);
}
