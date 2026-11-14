// How strongly does random exploration of each reflex pathway influence the reward that follows?
// usage: tsx tools/explore-corr.ts <minutes> <newborn> <exploreW>
import { Sim } from '../src/sim/sim';
const minutes = Number(process.argv[2] ?? 10);
const newborn = Number(process.argv[3] ?? 0.4);
const exW = Number(process.argv[4] ?? 0.05);
const sim = new Sim({ learn: true, learningRate: 0, newborn, exploreW: exW });
sim.autoCookies = false;
const sp = sim.brain.spinal;
const nE = sp.explorers.length;
const names = sp.defs.map((d) => d.name);
const STEP = 100; // ms
const xs: Float32Array[] = [];
const rs: number[] = [];
const walking: boolean[] = [];
let accX = new Float32Array(nE);
let accR = 0;
const T = minutes * 60000;
for (let t = 0; t < T; t++) {
  sim.tick();
  for (let k = 0; k < nE; k++) accX[k] += sp.explorers[k].x / STEP;
  accR += sim.brain.reward.rpe / STEP;
  if (t % STEP === STEP - 1) {
    xs.push(accX);
    rs.push(Math.max(-8, accR));
    walking.push(sim.life.state === 'walking');
    accX = new Float32Array(nE);
    accR = 0;
  }
}
// predictor: exploration during the last 300 ms; outcome: reward prediction error over the next 800 ms
const out: { name: string; r: number; t: number }[] = [];
for (let k = 0; k < nE; k++) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 3; i < rs.length - 8; i++) {
    if (!walking[i]) continue;
    const x = (xs[i][k] + xs[i - 1][k] + xs[i - 2][k]) / 3;
    let y = 0;
    for (let j = 1; j <= 8; j++) y += rs[i + j] / 8;
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const r = (sxy - (sx * sy) / n) / Math.sqrt((sxx - (sx * sx) / n) * (syy - (sy * sy) / n));
  out.push({ name: names[k], r, t: r * Math.sqrt(n / 5) }); // samples overlap; effective n is smaller
}
out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
console.log(`falls ${sim.life.falls} in ${minutes} min, exploreW ${exW}, newborn ${newborn}`);
for (const o of out) console.log(`${o.name.padEnd(10)} r=${o.r.toFixed(3).padStart(7)}  t≈${o.t.toFixed(1)}`);
