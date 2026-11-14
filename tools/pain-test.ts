// What does the pain system report? Runs a newborn and prints every fall: where it hurt, how
// much it cost and how long the dopamine neurons were silenced.
// usage: tsx tools/pain-test.ts [seconds] [seed] [mode]
import { Sim, type PainMode } from '../src/sim/sim';
import { PAIN_SITES } from '../src/sim/brain/pain';
const T = Number(process.argv[2] ?? 60) * 1000;
const sim = new Sim({ learn: true, seed: Number(process.argv[3] ?? 1), newbornTone: process.env.TONE ? Number(process.env.TONE) : 0.6, pain: (process.argv[4] as PainMode) ?? 'graded' });
const pain = sim.brain.pain;
let last = sim.life.state;
let cur: { peak: Float32Array; cost: number; silent: number; relayPeak: number; daMin: number; daInt: number } | null = null;
let walkCost = 0, walkTicks = 0, walkPeak = 0;
const walkSite = new Float32Array(PAIN_SITES.length);
const costs: number[] = [];
const rows: string[] = [];
for (let i = 0; i < T; i++) {
  sim.tick();
  const st = sim.life.state;
  if (st === 'walking') { walkCost += pain.cost * 0.001; walkTicks++; if (pain.relay.rate > walkPeak) walkPeak = pain.relay.rate; for (let k = 0; k < PAIN_SITES.length; k++) walkSite[k] += pain.level[k] * 0.001; }
  if (st === 'fallen' && last !== 'fallen') cur = { peak: new Float32Array(PAIN_SITES.length), cost: 0, silent: 0, relayPeak: 0, daMin: 0, daInt: 0 };
  if (st === 'fallen' && cur) {
    for (let k = 0; k < PAIN_SITES.length; k++) if (pain.level[k] > cur.peak[k]) cur.peak[k] = pain.level[k];
    cur.cost += pain.cost * 0.001;
    if (sim.brain.reward.vta.rate < 1.5) cur.silent++;
    if (pain.relay.rate > cur.relayPeak) cur.relayPeak = pain.relay.rate;
    if (sim.brain.reward.level < cur.daMin) cur.daMin = sim.brain.reward.level;
    cur.daInt += sim.brain.reward.level * 0.001;
  }
  if (st !== 'fallen' && last === 'fallen' && cur) {
    costs.push(cur.cost);
    const where = Array.from(cur.peak).map((v, k) => [v, PAIN_SITES[k]] as [number, string]).filter((x) => x[0] > 0.05).sort((a, b) => b[0] - a[0]).map((x) => `${x[1]} ${x[0].toFixed(2)}`).join(', ');
    rows.push(`cost ${cur.cost.toFixed(2)}  relay peak ${cur.relayPeak.toFixed(0)} Hz  dopamine silent ${cur.silent} ms, min ${cur.daMin.toFixed(2)}, integral ${cur.daInt.toFixed(2)}  | ${where}`);
    cur = null;
  }
  last = st;
}
console.log(rows.slice(0, 16).join('\n'));
const mean = costs.reduce((a, b) => a + b, 0) / Math.max(1, costs.length);
const sd = Math.sqrt(costs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, costs.length));
console.log(`falls ${costs.length}: pain per fall ${mean.toFixed(2)} ± ${sd.toFixed(2)} (min ${Math.min(...costs).toFixed(2)}, max ${Math.max(...costs).toFixed(2)}); expected ${sim.expectedPain.toFixed(2)}`);
console.log(`while walking: pain cost ${(walkCost / (walkTicks / 1000)).toFixed(3)} per second, relay peak ${walkPeak.toFixed(0)} Hz; stressin ${sim.brain.hormones.level.stressin.toFixed(2)}, vigilin ${sim.brain.hormones.level.vigilin.toFixed(2)}`);
console.log('walking pain by site (level·s per minute of walking):', Array.from(walkSite).map((v, k) => [v / (walkTicks / 60000), PAIN_SITES[k]] as [number, string]).filter((x) => x[0] > 0.01).map((x) => `${x[1]} ${x[0].toFixed(2)}`).join(', '));
