// How many neurons can one thread simulate in real time?
import { Network, NT } from '../src/sim/brain/network';

for (const N of [10000, 30000, 100000]) {
  const net = new Network(1);
  const ne = Math.round(N * 0.8);
  const ni = N - ne;
  const exc = net.addPop({ name: 'exc', n: ne, type: NT.RS, region: 'x', bias: 2.5, biasJitter: 2.5, noise: 3 });
  const inh = net.addPop({ name: 'inh', n: ni, type: NT.FS, region: 'x', bias: 1, biasJitter: 2, noise: 3, inhibitory: true });
  const fan = 100;
  const plastic = process.argv[2] === 'plastic';
  net.connect({ pre: exc, post: exc, channel: 'E', fanOut: fan * 0.8, w: 0.5, wJitter: 0.5, delay: [1, 15],
    plastic: plastic ? { rule: 'rstdp', lr: 0.01, tauE: 1000, aPlus: 0.1, aMinus: 0.12, wMin: 0, wMax: 1.5 } : undefined });
  net.connect({ pre: exc, post: inh, channel: 'E', fanOut: fan * 0.2, w: 0.5, wJitter: 0.5, delay: [1, 5] });
  net.connect({ pre: inh, post: exc, channel: 'I', fanOut: fan * 0.8, w: 1.2, wJitter: 0.5, delay: 1 });
  net.connect({ pre: inh, post: inh, channel: 'I', fanOut: fan * 0.2, w: 1.2, wJitter: 0.5, delay: 1 });
  const t0 = performance.now();
  net.build();
  const tb = performance.now() - t0;
  for (let i = 0; i < 300; i++) net.step();
  net.totalSpikes = 0;
  const t1 = performance.now();
  const T = 1000;
  for (let i = 0; i < T; i++) {
    net.dopamine = i % 500 === 0 ? 0.5 : 0;
    net.step();
  }
  const ms = performance.now() - t1;
  console.log(
    `N=${N} synapses=${(net.nSynapses / 1e6).toFixed(1)}M build=${tb.toFixed(0)}ms  1 s sim = ${ms.toFixed(0)} ms wall (${(1000 / ms).toFixed(2)}× realtime)  mean rate=${(net.totalSpikes / N / (T / 1000)).toFixed(1)} Hz exc=${exc.rate.toFixed(1)} inh=${inh.rate.toFixed(1)}`,
  );
}
