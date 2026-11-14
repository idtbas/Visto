// Experiment 1 and 4: does the creature tell what it causes itself from what comes from outside,
// and does it have a working model of its own body?
//
// A creature that can already walk first learns its forward model for some minutes. Then,
// every three seconds while it walks, one of these happens:
//   - an outside shove on the trunk (forwards or backwards, several strengths)
//   - nothing (sham)
//   - an action of its own: it gives itself the command to lift the feet high for half a second
// For the 400 ms after each event three detectors are read out:
//   A  the pool "Fremdeinwirkung" (mismatch between predicted and felt, full body model)
//   B  the same pool when the copies of the motor commands are cut out of the prediction
//   C  plain change of the senses, no model at all: |felt now − felt 50 ms ago|
//   D  the otolith cells alone: how hard was the head jolted (no model)
// How well each detector separates an event from the shams is given as AUC (0.5 = chance, 1 = perfect).
//
// usage: tsx tools/exp-self-other.ts [training minutes] [events] [seed]     (UNTRAINED=1: forward model never learns)
import { Sim } from '../src/sim/sim';

const trainMin = Number(process.argv[2] ?? 4);
const nEvents = Number(process.argv[3] ?? 240);
const seed = Number(process.argv[4] ?? 1);
const untrained = !!process.env.UNTRAINED;
const sim = new Sim({ learn: true, newbornTone: 1, learningRate: 0, seed });
sim.autoCookies = false;
const { bodyModel: bm, predictor, net } = sim.brain;
if (untrained) predictor.learning = false;
const targets = predictor.targets;

// ---- training: how much of what is felt does the model explain? ----
console.log(`neurons ${net.n}; forward model ${untrained ? 'never learns (control)' : 'learns'}; training ${trainMin} min`);
const explained = (): { run: () => void; result: () => string } => {
  const n = targets.length;
  const sumE = new Float64Array(n), sumS = new Float64Array(n), sumS2 = new Float64Array(n);
  let k = 0;
  return {
    run: () => {
      if (sim.life.state !== 'walking') return;
      k++;
      for (let j = 0; j < n; j++) {
        const s = targets[j].rate, e = s - predictor.pops[j].rate;
        sumE[j] += e * e; sumS[j] += s; sumS2[j] += s * s;
      }
    },
    result: () => targets.map((t, j) => { const v = sumS2[j] / k - (sumS[j] / k) ** 2; return `${t.name} ${(100 * (1 - sumE[j] / k / v)).toFixed(0)} %`; }).join(', '),
  };
};
for (let m = 0; m < trainMin * 2; m++) {
  const ex = explained();
  let mm = 0, ext = 0, cnt = 0;
  const ign0 = sim.brain.workspace.ignitions[0];
  for (let i = 0; i < 30000; i++) { sim.tick(); ex.run(); if (sim.life.state === 'walking') { mm += bm.mismatch; ext += bm.external.rate; cnt++; } }
  console.log(`  ${((m + 1) / 2).toFixed(1)} min: mismatch cells ${(mm / cnt).toFixed(1)} Hz, Fremdeinwirkung ${(ext / cnt).toFixed(1)} Hz, "Körper" ignited ${sim.brain.workspace.ignitions[0] - ign0} times, variance of each sense explained by the prediction: ${ex.result()}; falls so far ${sim.life.falls}`);
}

// ---- test ----
type Trial = { kind: string; a: number; c: number; d: number; fell: boolean };
function block(label: string, events: number): Trial[] {
  const strengths = [12, 20, 30, 45, 60, 90];
  const trials: Trial[] = [];
  const hist = targets.map(() => new Float32Array(64));
  let tick = 0, since = 0, cur: (Trial & { left: number }) | null = null, stepLeft = 0, k = 0;
  while (trials.length < events) {
    sim.brain.spinal.highStep = stepLeft > 0 ? 1 : 0;
    if (stepLeft > 0) stepLeft--;
    sim.tick();
    tick++;
    let change = 0;
    targets.forEach((t, j) => { change += Math.abs(t.rate - hist[j][(tick - 50) & 63]); hist[j][tick & 63] = t.rate; });
    change /= targets.length;
    since = sim.life.state === 'walking' && !sim.life.inHand ? since + 1 : 0;
    if (cur) {
      if (bm.external.rate > cur.a) cur.a = bm.external.rate;
      if (change > cur.c) cur.c = change;
      const oto = Math.max(bm.otolith[0].rate, bm.otolith[1].rate);
      if (oto > cur.d) cur.d = oto;
      if (sim.life.state === 'fallen') cur.fell = true;
      if (--cur.left <= 0) { trials.push(cur); cur = null; since = Math.min(since, 1); }
    } else if (since >= 2000) {
      // a random event after a random extra wait, so that nothing is locked to the rhythm of the steps
      const r = Math.floor(net.rng() * 10);
      since -= Math.floor(net.rng() * 700);
      k++;
      let kind = 'sham';
      if (r < 6) { const dir = net.rng() < 0.5 ? -1 : 1; sim.push(dir * strengths[r]); kind = `shove ${strengths[r]} N·s`; }
      else if (r === 6) { stepLeft = 500; kind = 'own high step'; }
      cur = { kind, a: 0, c: 0, d: 0, fell: false, left: 300 };
    }
  }
  sim.brain.spinal.highStep = 0;
  void label;
  return trials;
}
function auc(pos: number[], neg: number[]): number {
  let c = 0;
  for (const p of pos) for (const q of neg) c += p > q ? 1 : p === q ? 0.5 : 0;
  return c / (pos.length * neg.length);
}
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

const full = block('full', nEvents);
bm.setEfference(false);
for (let i = 0; i < 60000; i++) sim.tick(); // let the mismatch pool get used to the new situation
const cut = block('no efference copy', nEvents);
bm.setEfference(true);

// The sharper question: the same amount of felt jolt, once caused by the creature's own
// movement and once from outside – is the unexplained part larger when it came from outside?
// For that the response A is compared at equal otolith response D: a straight line is fitted
// to the shams (A against D), and for every event the distance of its A from that line is taken.
{
  const xs = full.filter((t) => t.kind === 'sham');
  const mx = mean(xs.map((t) => t.d)), my = mean(xs.map((t) => t.a));
  const slope = xs.reduce((s, t) => s + (t.d - mx) * (t.a - my), 0) / Math.max(1e-9, xs.reduce((s, t) => s + (t.d - mx) ** 2, 0));
  const resid = (t: Trial): number => t.a - (my + slope * (t.d - mx));
  const shoves = full.filter((t) => t.kind.startsWith('shove'));
  const own = full.filter((t) => t.kind.startsWith('own'));
  console.log(`\nat equal jolt of the head (line fitted to the shams: A = ${my.toFixed(1)} + ${slope.toFixed(2)} · (D − ${mx.toFixed(0)})):`);
  console.log(`  unexplained part beyond that line: shoves ${mean(shoves.map(resid)).toFixed(1)} Hz (AUC against shams ${auc(shoves.map(resid), xs.map(resid)).toFixed(2)}), own high steps ${mean(own.map(resid)).toFixed(1)} Hz (AUC ${auc(own.map(resid), xs.map(resid)).toFixed(2)})`);
}

const kinds = [...new Set(full.map((t) => t.kind))].filter((k) => k !== 'sham').sort((x, y) => (x.startsWith('own') ? 1 : 0) - (y.startsWith('own') ? 1 : 0) || parseFloat(x.slice(6)) - parseFloat(y.slice(6)));
const shamA = full.filter((t) => t.kind === 'sham');
const shamB = cut.filter((t) => t.kind === 'sham');
console.log(`\nevents: ${full.length} + ${cut.length}; shams ${shamA.length} / ${shamB.length}`);
console.log('event              n   A: Fremdeinwirkung    B: without efference copy   C: plain sensory change    D: otolith cells alone   fell');
console.log(`sham              ${String(shamA.length).padStart(2)}   peak ${mean(shamA.map((t) => t.a)).toFixed(0).padStart(3)} Hz            peak ${mean(shamB.map((t) => t.a)).toFixed(0).padStart(3)} Hz                 ${mean(shamA.map((t) => t.c)).toFixed(1).padStart(5)} Hz              ${mean(shamA.map((t) => t.d)).toFixed(0).padStart(3)} Hz               ${shamA.filter((t) => t.fell).length}`);
for (const k of kinds) {
  const a = full.filter((t) => t.kind === k), b = cut.filter((t) => t.kind === k);
  console.log(
    `${k.padEnd(17)} ${String(a.length).padStart(2)}   peak ${mean(a.map((t) => t.a)).toFixed(0).padStart(3)} Hz  AUC ${auc(a.map((t) => t.a), shamA.map((t) => t.a)).toFixed(2)}   peak ${mean(b.map((t) => t.a)).toFixed(0).padStart(3)} Hz  AUC ${auc(b.map((t) => t.a), shamB.map((t) => t.a)).toFixed(2)}        ${mean(a.map((t) => t.c)).toFixed(1).padStart(5)} Hz  AUC ${auc(a.map((t) => t.c), shamA.map((t) => t.c)).toFixed(2)}     ${mean(a.map((t) => t.d)).toFixed(0).padStart(3)} Hz  AUC ${auc(a.map((t) => t.d), shamA.map((t) => t.d)).toFixed(2)}     ${a.filter((t) => t.fell).length}`,
  );
}
