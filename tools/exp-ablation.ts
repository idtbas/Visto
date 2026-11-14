// What is lost when parts of the architecture are switched off?
//
// A creature that can walk learns its forward model for some minutes and is then shoved hard
// from outside every few seconds. Measured for each condition:
//   - how often the shove ignites the content "Körper" in the global workspace
//   - how the arousal hormone (Vigilin) responds in the second after the shove
//   - how strongly the bracing nucleus fires
//   - how often the creature falls within 1.5 s
// usage: tsx tools/exp-ablation.ts [training minutes] [shoves] [seed]     LESION=broadcast,workspace,bodymodel,efference
import { Sim } from '../src/sim/sim';
import type { ModuleName } from '../src/sim/brain/brain';

const trainMin = Number(process.argv[2] ?? 3);
const nShoves = Number(process.argv[3] ?? 60);
const seed = Number(process.argv[4] ?? 1);
const lesions = (process.env.LESION ?? '').split(',').filter(Boolean) as ModuleName[];
const strengths = (process.env.STRENGTHS ?? '30,45,60').split(',').map(Number);
const sim = new Sim({ learn: true, newbornTone: 1, learningRate: 0, seed, pain: 'off' });
sim.autoCookies = false;
const { workspace: ws, hormones, net } = sim.brain;
for (let i = 0; i < trainMin * 60000; i++) sim.tick();
for (const m of lesions) sim.brain.setModule(m, false);
for (let i = 0; i < 20000; i++) sim.tick();
const rows = strengths.map((s) => ({ s, n: 0, ignited: 0, fell: 0, vig: 0, brace: 0, shamVig: 0, shamN: 0, shamFell: 0, shamIgn: 0 }));
let since = 0, done = 0;
while (done < nShoves * 2) {
  sim.tick();
  since = sim.life.state === 'walking' && !sim.life.inHand ? since + 1 : 0;
  if (since < 2500 + (done % 7) * 130) continue;
  const row = rows[Math.floor(net.rng() * rows.length)];
  const sham = done % 2 === 1;
  if (!sham) sim.push((net.rng() < 0.5 ? -1 : 1) * row.s);
  const v0 = hormones.level.vigilin;
  const ign0 = ws.ignitions[0];
  let vmax = v0, fell = false, brace = 0;
  for (let i = 0; i < 1500; i++) {
    sim.tick();
    if (i < 1000 && hormones.level.vigilin > vmax) vmax = hormones.level.vigilin;
    if (i < 400 && ws.brace.rate > brace) brace = ws.brace.rate;
    if (sim.life.state === 'fallen') fell = true;
  }
  if (sham) { row.shamN++; row.shamVig += vmax - v0; if (fell) row.shamFell++; if (ws.ignitions[0] > ign0) row.shamIgn++; }
  else { row.n++; row.vig += vmax - v0; row.brace += brace; if (fell) row.fell++; if (ws.ignitions[0] > ign0) row.ignited++; }
  since = 0;
  done++;
}
console.log(`seed ${seed}, switched off: ${lesions.length ? lesions.join(', ') : 'nothing'}`);
for (const r of rows) console.log(`  shove ${String(r.s).padStart(2)} N·s (n=${r.n}): "Körper" ignited after ${((100 * r.ignited) / r.n).toFixed(0).padStart(3)} %, Vigilin +${(r.vig / r.n).toFixed(3)}, bracing nucleus peak ${(r.brace / r.n).toFixed(0).padStart(3)} Hz, fell ${r.fell} of ${r.n}  |  no shove (n=${r.shamN}): ignited ${((100 * r.shamIgn) / r.shamN).toFixed(0)} %, Vigilin +${(r.shamVig / r.shamN).toFixed(3)}, fell ${r.shamFell}`);
