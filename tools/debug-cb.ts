import { Sim } from '../src/sim/sim';
const sim = new Sim({ learn: true, newbornTone: 1, granules: Number(process.argv[2] ?? 6000) });
const net = sim.brain.net;
const sums = new Map<string, number>();
const T = 12000;
const t0 = Date.now();
for (let i = 0; i < T; i++) {
  sim.tick();
  if (i >= 2000) for (const p of net.pops) if (p.region.startsWith('cerebellum')) sums.set(p.name, (sums.get(p.name) ?? 0) + (p.count * 1000) / p.n / (T - 2000));
}
console.log(`neurons ${net.n}, synapses ${net.nSynapses}, ${((Date.now() - t0) / 12).toFixed(0)} ms per simulated second, falls ${sim.life.falls}`);
for (const [k, v] of sums) if (!/_1$/.test(k)) console.log(k.padEnd(12), v.toFixed(1), 'Hz');
const cb = sim.brain.cerebellum!;
console.log('PF mean weights', cb.zones.slice(0, 6).map((z) => z.pf.meanWeight().toFixed(3)).join(' '));
