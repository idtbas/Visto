// Does the hippocampus store walking attempts, and does replay in sleep reproduce them?
import { Sim } from '../src/sim/sim';
const sim = new Sim({ learn: true, newbornTone: 0.6, sleep: true, learningRate: 0 });
const mem = sim.brain.memory;
const sp = sim.brain.spinal;
const stored = new Map<number, { dev: number[]; val: number }>();
const orig = mem.rememberAttempt.bind(mem);
let lastUnit = -1;
mem.rememberAttempt = (v: number) => {
  orig(v);
  lastUnit = (mem as unknown as { writeA: number }).writeA;
  stored.set(lastUnit, { dev: Array.from(sp.toneRecent), val: v });
};
for (let i = 0; i < 60000; i++) sim.tick();
console.log(`after 60 s: ${sim.life.falls} falls, ${stored.size} memories`);
let n = 0;
for (const [u, st] of stored) {
  if (n++ >= 6) break;
  const r = mem.recall(u);
  console.log(`memory ${u}: tried ${st.dev.map((v) => v.toFixed(2).padStart(5)).join(' ')} outcome ${st.val.toFixed(2).padStart(5)} | stored weights ${r.tone.map((v) => v.toFixed(2)).join(' ')} good ${r.good.toFixed(2)} bad ${r.bad.toFixed(2)}`);
}
// sleep
sim.brain.hormones.level.somnin = 0.95;
const acc = new Map<number, { rate: number[]; da: number; n: number }>();
let slept = 0;
for (let i = 0; i < 70000; i++) {
  sim.tick();
  if (sim.life.state !== 'sleeping') { if (slept > 0) break; continue; }
  slept++;
  const u = mem.replaying;
  if (u < 0) continue;
  let a = acc.get(u);
  if (!a) acc.set(u, (a = { rate: [0, 0, 0, 0, 0], da: 0, n: 0 }));
  sp.tone.forEach((tn, k) => (a!.rate[k] += tn.ex.count * 1000 / tn.ex.n));
  a.da += sim.brain.reward.level;
  a.n++;
}
console.log(`slept ${(slept / 1000).toFixed(0)} s, replayed ${mem.replayCount} memories (${acc.size} different)`);
let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0, agree = 0, tot = 0;
for (const [u, a] of acc) {
  const st = stored.get(u);
  if (!st) continue;
  for (let k = 0; k < 5; k++) {
    const x = st.dev[k], y = a.rate[k] / a.n / 30 - 1;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; m++;
  }
  if (Math.abs(st.val) > 0.3) { tot++; if (Math.sign(a.da / a.n) === Math.sign(st.val)) agree++; }
}
const corr = (sxy - sx * sy / m) / Math.sqrt((sxx - sx * sx / m) * (syy - sy * sy / m));
console.log(`replayed exploration pattern vs what was tried: correlation ${corr.toFixed(2)} (${m} values); dopamine sign matches outcome in ${agree} of ${tot} replays`);
let k2 = 0;
for (const [u, a] of acc) { if (k2++ >= 5) break; const st = stored.get(u)!; console.log(`  replay of ${u}: tried ${st.dev.map((v) => v.toFixed(2)).join(' ')} → replayed ${a.rate.map((v) => (v / a.n / 30 - 1).toFixed(2)).join(' ')} | outcome ${st.val.toFixed(2)} → dopamine ${(a.da / a.n).toFixed(2)}`); }
