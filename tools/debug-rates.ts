import { Sim } from '../src/sim/sim';
const sim = new Sim({ learn: true, newbornTone: 0.9 });
const net = sim.brain.net;
const want = /^(STR_step|GPi_step|THAL_step|STEP|HS_0|EX_step|V_0\.3m|VTA|TONE_extensor|TONctx)$/;
const sums = new Map<string, number>();
const T = 10000;
for (let i = 0; i < T; i++) {
  sim.tick();
  for (const p of net.pops) if (want.test(p.name)) sums.set(p.name, (sums.get(p.name) ?? 0) + (p.count * 1000) / p.n / T);
}
console.log([...sums].map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  '), '| stepLevel', sim.brain.spinal.stepLevel.toFixed(3), 'falls', sim.life.falls);
