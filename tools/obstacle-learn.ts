// Does the creature learn to lift its feet when it sees an obstacle?
// usage: tsx tools/obstacle-learn.ts <minutes> <learn 0|1> [decisionLr] [seed]   (SHAM=1 for the control)
import { Sim } from '../src/sim/sim';
const minutes = Number(process.argv[2] ?? 20);
const learn = process.argv[3] !== '0';
const decisionLr = process.argv[4] ? Number(process.argv[4]) : undefined;
const seed = Number(process.argv[5] ?? 1);
const sim = new Sim({ learn: true, newbornTone: 1, seed, decisionLr: learn ? decisionLr : 0 });
// first let the creature settle into steady walking without obstacles
const pre = Number(process.env.PRE ?? 0);
for (let i = 0; i < pre * 60000; i++) sim.tick();
if (pre > 0) console.log(`after ${pre} min without obstacles: ${sim.life.falls} falls in total, tone ${sim.brain.spinal.tone.map((t) => t.gain.toFixed(2)).join(' ')}`);
const fallsPre = sim.life.falls;
sim.obstaclesOn = true;
if (process.env.BLOCK_H) { const h = Number(process.env.BLOCK_H); sim.obstacleHeight = [h, h]; }
const policy = process.env.POLICY ?? '';
if (process.env.NORECALL) sim.brain.memory.recallEnabled = false;
const every = Number(process.env.EVERY ?? 2);
if (process.env.SHAM) sim.brain.reward.shamDelay = 17000;
const dec = sim.brain.decision;
const pending = new Map<number, true>();
const done = new Set<number>();
let pass = 0, fail = 0, falls0 = fallsPre, stepNear = 0, nearN = 0, stepFar = 0, farN = 0;
const t0 = Date.now();
for (let m = 0; m < minutes; m++) {
  for (let i = 0; i < 60000; i++) {
    if (policy === 'near') sim.brain.spinal.highStep = dec.seenDistance < 1.2 ? 1 : 0;
    sim.tick();
    if (i % 20 !== 0) continue;
    const x = sim.physics.biped.hipX();
    for (const o of sim.physics.terrain.obstacles) if (!pending.has(o.x) && !done.has(o.x)) pending.set(o.x, true);
    for (const ox of [...pending.keys()]) {
      if (sim.life.state === 'fallen' && Math.abs(ox - x) < 1.6) { fail++; pending.delete(ox); done.add(ox); }
      else if (x > ox + 0.7) { pass++; pending.delete(ox); done.add(ox); }
    }
    const d = dec.seenDistance;
    if (sim.life.state === 'walking') {
      if (d < 1.0) { stepNear += sim.brain.spinal.stepLevel; nearN++; }
      else if (!Number.isFinite(d)) { stepFar += sim.brain.spinal.stepLevel; farN++; }
    }
  }
  if (m % every === every - 1) {
    console.log(
      `min ${m + 1}: obstacles passed ${pass}, tripped ${fail} (${Math.round((100 * pass) / Math.max(1, pass + fail))} %), other falls ${sim.life.falls - falls0 - fail}, ` +
        `high-step near obstacle ${(stepNear / Math.max(1, nearN)).toFixed(2)} / elsewhere ${(stepFar / Math.max(1, farN)).toFixed(2)}, weights ${dec.weights().map((w) => w.toFixed(2)).join(' ')}, memories ${sim.brain.memory.writtenB.filter(Boolean).length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
    );
    pass = 0; fail = 0; falls0 = sim.life.falls; stepNear = 0; nearN = 0; stepFar = 0; farN = 0;
  }
}
