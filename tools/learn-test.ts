// Does the creature get better with experience? Runs a life headless and prints its progress.
// usage: tsx tools/learn-test.ts <minutes> <newborn sigma> <learn 0|1> [lr] [mult.json] [seed]
import { readFileSync, existsSync } from 'node:fs';
import { Sim } from '../src/sim/sim';

const minutes = Number(process.argv[2] ?? 10);
const newborn = Number(process.argv[3] ?? 0.4);
const learn = process.argv[4] !== '0';
const lr = process.argv[5] ? Number(process.argv[5]) : undefined;
const multFile = process.argv[6];
const seed = Number(process.argv[7] ?? 1);
const mult = multFile && existsSync(multFile) ? (JSON.parse(readFileSync(multFile, 'utf8')).mult as number[]) : undefined;
const exploreW = process.env.EXW ? Number(process.env.EXW) : undefined;
const sim = new Sim({ learn, newborn, learningRate: lr, mult, seed, exploreW });
sim.autoCookies = !process.env.NOCOOKIES;
const sp = sim.brain.spinal;
const w0 = sp.pathProj.map((leg) => leg.map((p) => p.meanWeight()));
console.log(`neurons ${sim.brain.net.n}, synapses ${sim.brain.net.nSynapses}, learn=${learn}, newborn=${newborn}`);
const t0 = Date.now();
let lastFalls = 0;
let distSum = 0;
let lastX = sim.physics.biped.hipX();
let walkTicks = 0;
let daAbs = 0;
for (let m = 0; m < minutes; m++) {
  for (let i = 0; i < 60000; i++) {
    sim.tick();
    if (sim.life.state === 'walking') walkTicks++;
    daAbs += Math.abs(sim.brain.reward.level);
  }
  const falls = sim.life.falls - lastFalls;
  lastFalls = sim.life.falls;
  const x = sim.physics.biped.hipX();
  distSum = x - lastX;
  lastX = x;
  // how far have the pathway strengths moved from where they started?
  let drift = 0;
  let cnt = 0;
  sp.pathProj.forEach((leg, l) => leg.forEach((p, k) => { drift += Math.abs(Math.log(p.meanWeight() / w0[l][k])); cnt++; }));
  console.log(
    `min ${m + 1}: falls ${falls}, distance ${distSum.toFixed(1)} m, walking ${(walkTicks / 1000).toFixed(0)} s (${(walkTicks / 1000 / Math.max(1, falls)).toFixed(1)} s/attempt), best ${sim.life.bestAttempt.toFixed(1)} m, ` +
      `|DA| ${(daAbs / 60000).toFixed(2)}, drift ${(drift / cnt).toFixed(3)}, exp ${sim.brain.reward.expected.map((v) => v.toFixed(2)).join('/')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
  walkTicks = 0;
  daAbs = 0;
}
