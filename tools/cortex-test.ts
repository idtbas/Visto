// How active is the body-sense cortex, and what does the amygdala learn?
// usage: tsx tools/cortex-test.ts [minutes] [seed]
import { Sim } from '../src/sim/sim';
const minutes = Number(process.argv[2] ?? 3);
const sim = new Sim({ learn: true, seed: Number(process.argv[3] ?? 1), newbornTone: process.env.TONE ? Number(process.env.TONE) : 0.6 });
const { cortex, amygdala, net, pain, reward } = sim.brain;
console.log(`neurons ${net.n}, synapses ${net.nSynapses}, engine ${net.engine}`);
const HIST = 1500;
const ring = new Float32Array(HIST);
let last = sim.life.state;
for (let m = 0; m < minutes; m++) {
  const t0 = performance.now();
  let rate = 0, active = 0, samples = 0;
  const seen = new Uint8Array(net.n);
  // danger in the time before each fall, aligned to the moment of the fall
  const pre = new Float32Array(HIST); let nFalls = 0;
  let walkD = 0, walkN = 0, vtaWalk = 0;
  for (let i = 0; i < 60000; i++) {
    sim.tick();
    for (let k = 0; k < net.nSpikes; k++) seen[net.spikes[k]] = 1;
    ring[i % HIST] = amygdala.danger;
    const st = sim.life.state;
    if (st === 'walking') { walkD += amygdala.danger; walkN++; vtaWalk += reward.vta.rate; }
    if (st === 'fallen' && last === 'walking' && i >= HIST) { for (let k = 0; k < HIST; k++) pre[k] += ring[(i + 1 + k) % HIST]; nFalls++; }
    last = st;
    if (i % 100 === 0) { rate += cortex.rate; samples++; }
  }
  for (const a of cortex.areas) for (let i = a.start; i < a.end; i++) active += seen[i];
  const at = (ms: number): string => (nFalls ? pre[HIST - 1 - ms] / nFalls : 0).toFixed(2);
  console.log(`min ${m + 1}: cortex ${(rate / samples).toFixed(1)} Hz, cells that fired ${(100 * active / cortex.areas.reduce((s, a) => s + a.n, 0)).toFixed(0)} %, inh ${cortex.inhibitory.map((p) => p.rate.toFixed(0)).join('/')} Hz | falls ${nFalls}, danger while walking ${(walkD / Math.max(1, walkN)).toFixed(2)}, before a fall: -1000 ms ${at(1000)}, -500 ms ${at(500)}, -300 ms ${at(300)}, -150 ms ${at(150)}, -50 ms ${at(50)}, 0 ms ${at(0)} | weights mean ${amygdala.inputs.map((p) => p.meanWeight().toFixed(4)).join(' ')}, top 1 % above ${amygdala.inputs.map((p) => Array.from(p.w).sort((x, y) => y - x)[Math.floor(p.w.length / 100)].toFixed(3)).join(' ')} | VTA walking ${(vtaWalk / Math.max(1, walkN)).toFixed(1)} Hz | pain ${sim.expectedPain.toFixed(2)} | ${(60000 / (performance.now() - t0)).toFixed(1)}x`);
}
