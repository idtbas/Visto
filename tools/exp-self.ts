// The five "self" areas: do they do what they were built for, and what is lost without them?
//
// usage: tsx tools/exp-self.ts <test> [seed]
//   rates     – walk for a while and print the firing rates of the new areas (sanity)
//   mood      – insula: hunger, pain, fullness and a cookie; does "unwell" habituate?
//   rest      – tiredness / exhaustion / hunger set by hand: does it lie down, does hunger win?
//   agency    – shoves while standing still and while walking: "I am being moved" against the bare sense
//   core      – can the situation be read from the core, and for how long after its inputs are cut?
// LESION=rest,self switches modules off.
import { Sim } from '../src/sim/sim';
import type { ModuleName } from '../src/sim/brain/brain';

const test = process.argv[2] ?? 'rates';
const seed = Number(process.argv[3] ?? 1);
const make = (opt: Record<string, unknown> = {}): Sim => {
  const sim = new Sim({ learn: true, newbornTone: 1, learningRate: 0, seed, autonomy: true, mortal: false, energy: 0.5, ...opt } as never);
  sim.life.bestAttempt = 25;
  for (const m of (process.env.LESION ?? '').split(',').filter(Boolean)) sim.brain.setModule(m as ModuleName, false);
  return sim;
};
const hz = (v: number): string => v.toFixed(1).padStart(5);

if (test === 'rates') {
  const sim = make();
  const s = sim.brain.self;
  console.log(`neurons ${sim.brain.net.n}, synapses ${sim.brain.net.nSynapses}`);
  for (let sec = 1; sec <= 30; sec++) {
    for (let i = 0; i < 1000; i++) sim.tick();
    if (sec % 3 === 0)
      console.log(
        `${String(sec).padStart(3)} s ${sim.life.state.padEnd(8)} | unwell ${hz(s.unwell.rate)} well ${hz(s.well.rate)} mood ${s.mood.toFixed(2)} | rest cmd ${hz(s.restCommand.rate)} | moving ${hz(s.moving.rate)} moved ${hz(s.moved.rate)} | conf ${hz(s.confidence.rate)} doubt ${hz(s.doubt.rate)} | core ${hz(s.core.rate)} Hz, ${(100 * s.coreActive).toFixed(1)} % active | go ${hz(sim.brain.drive.command[0].rate)} falls ${sim.life.falls}`,
      );
  }
}

if (test === 'mood') {
  // lying awake, so that nothing else happens (the loops for "go" and "rest" are cut, so it
  // stays down and awake); the states of the body are set by hand
  const sim = make();
  sim.brain.setModule('drive', false);
  sim.brain.setModule('rest', false);
  for (let i = 0; i < 6000; i++) sim.tick();
  const s = sim.brain.self;
  const b = sim.brain;
  const phase = (name: string, secs: number, set: () => void): void => {
    set();
    const out: string[] = [];
    for (let sec = 1; sec <= secs; sec++) {
      for (let i = 0; i < 1000; i++) sim.tick();
      if (sec === 1 || sec === 2 || sec === 5 || sec === 15 || sec === secs) out.push(`${sec} s: unwell ${hz(s.unwell.rate)} well ${hz(s.well.rate)} mood ${s.mood.toFixed(2).padStart(5)}`);
    }
    console.log(`${name.padEnd(26)} [${sim.life.state}] ${out.join(' | ')}`);
  };
  const need = (h: number, t = 0, e = 0, full = 0): void => {
    b.intero.override[0] = h; b.intero.override[1] = t; b.intero.override[2] = e; s.satedOverride = full;
  };
  phase('nothing', 5, () => need(0));
  phase('hunger 0.3', 5, () => need(0.3));
  phase('hunger 0.8 (stays)', 60, () => need(0.8));
  phase('nothing', 10, () => need(0));
  phase('hunger+tired+exhausted', 60, () => need(0.8, 0.8, 0.8));
  phase('full', 10, () => need(0, 0, 0, 1));
  phase('nothing', 5, () => need(0));
  phase('a cookie in the mouth', 3, () => { b.bodyState.intake += 0.1; sim.giveCookie?.(); });
}

if (test === 'rest') {
  const sim = make({ sleep: true });
  const s = sim.brain.self;
  const b = sim.brain;
  const phase = (name: string, secs: number, set: () => void): void => {
    set();
    const spent: Record<string, number> = {};
    let first = -1;
    const before = sim.life.state;
    for (let i = 0; i < secs * 1000; i++) {
      sim.tick();
      spent[sim.life.state] = (spent[sim.life.state] ?? 0) + 1;
      if (first < 0 && sim.life.state !== before) first = i / 1000;
    }
    const parts = Object.entries(spent).map(([k, v]) => `${k} ${Math.round(v / (secs * 10))} %`).join(', ');
    console.log(`${name.padEnd(34)} ${parts.padEnd(48)} | first change after ${first < 0 ? '-' : first.toFixed(1) + ' s'} | rest cmd ${hz(s.restCommand.rate)} Hz, go cmd ${hz(b.drive.command[0].rate)} Hz, unwell ${hz(s.unwell.rate)}, falls ${sim.life.falls}`);
  };
  const need = (h: number, t: number, e: number): void => { b.intero.override[0] = h; b.intero.override[1] = t; b.intero.override[2] = e; };
  phase('hungry 0.4, fresh', 15, () => need(0.4, 0, 0));
  phase('hungry 0.4, exhausted 0.8', 15, () => need(0.4, 0, 0.8));
  phase('hungry 0.4, fresh again', 15, () => need(0.4, 0, 0));
  phase('hungry 0.9, exhausted 0.5', 15, () => need(0.9, 0, 0.5));
  phase('hungry 0.1, exhausted 0.5', 15, () => need(0.1, 0, 0.5));
  phase('hungry 0.4, fresh again', 15, () => need(0.4, 0, 0));
  phase('hungry 0.2, sleepy (somnin 0.8)', 20, () => { b.intero.override[1] = NaN; b.intero.override[0] = 0.2; b.hormones.level.somnin = 0.8; });
}

if (test === 'walk') {
  // does a creature that can walk still walk as well? Hunger is held at 0.4 so that it keeps going.
  const secs = Number(process.argv[4] ?? 180);
  const sim = make();
  sim.brain.intero.override[0] = 0.4;
  const s = sim.brain.self;
  const t0 = Date.now();
  let walking = 0, doubt = 0, conf = 0, core = 0, brace = 0;
  for (let i = 0; i < secs * 1000; i++) {
    sim.tick();
    if (sim.life.state === 'walking') { walking++; doubt += s.doubt.rate; conf += s.confidence.rate; core += s.core.rate; brace += sim.brain.workspace.brace.rate; }
  }
  const w = Math.max(1, walking);
  console.log(`seed ${seed}${process.env.LESION ? ' without ' + process.env.LESION : ''}: ${secs} s, walking ${Math.round(walking / (secs * 10))} %, falls ${sim.life.falls}, best ${sim.life.bestAttempt.toFixed(0)} m, cookies ${sim.cookiesEaten} | while walking: doubt ${hz(doubt / w)} Hz, confidence ${hz(conf / w)} Hz, core ${hz(core / w)} Hz, brace ${hz(brace / w)} Hz | ${(secs / ((Date.now() - t0) / 1000)).toFixed(2)}x real time, ${sim.brain.net.n} neurons`);
}

function auc(pos: number[], neg: number[]): number {
  let c = 0;
  for (const p of pos) for (const q of neg) c += p > q ? 1 : p === q ? 0.5 : 0;
  return pos.length && neg.length ? c / (pos.length * neg.length) : NaN;
}
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

if (test === 'agency') {
  // Every two to three seconds one of three things happens: a shove from outside, nothing,
  // or (while walking) an action of its own, the command to lift the feet high for half a
  // second. Measured in the 300 ms after: the peak rate of each kind of cell.
  const events = Number(process.argv[4] ?? 90);
  for (const setting of ['standing', 'walking'] as const) {
    const sim = make({ autonomy: setting === 'walking' });
    if (setting === 'standing') { sim.wantsToWalk = false; sim.place(); }
    else sim.brain.intero.override[0] = 0.4;
    sim.autoCookies = false;
    const b = sim.brain;
    const s = b.self;
    for (let i = 0; i < 20000; i++) sim.tick();
    type Trial = { kind: string; moved: number; moving: number; doubt: number; oto: number; ext: number; fell: boolean; left: number };
    const trials: Trial[] = [];
    let since = 0, cur: Trial | null = null, stepLeft = 0;
    const strengths = [15, 25, 40, 60];
    while (trials.length < events) {
      b.spinal.highStep = stepLeft > 0 ? 1 : 0;
      if (stepLeft > 0) stepLeft--;
      sim.tick();
      since = sim.life.state === setting && !sim.life.inHand ? since + 1 : 0;
      if (cur) {
        cur.moved = Math.max(cur.moved, s.moved.rate);
        cur.moving = Math.max(cur.moving, s.moving.rate);
        cur.doubt = Math.max(cur.doubt, s.doubt.rate);
        cur.oto = Math.max(cur.oto, b.bodyModel.otolith[0].rate, b.bodyModel.otolith[1].rate);
        cur.ext = Math.max(cur.ext, b.bodyModel.external.rate);
        if (sim.life.state === 'fallen') cur.fell = true;
        if (--cur.left <= 0) { trials.push(cur); cur = null; since = Math.min(since, 1); }
      } else if (since >= 2000) {
        const r = Math.floor(b.net.rng() * 8);
        since -= Math.floor(b.net.rng() * 700);
        let kind = 'nothing';
        if (r < 4) { sim.push((b.net.rng() < 0.5 ? -1 : 1) * strengths[r]); kind = `shove ${strengths[r]} N·s`; }
        else if (r === 4 && setting === 'walking') { stepLeft = 500; kind = 'own high step'; }
        cur = { kind, moved: 0, moving: 0, doubt: 0, oto: 0, ext: 0, fell: false, left: 300 };
      }
    }
    b.spinal.highStep = 0;
    const sham = trials.filter((t) => t.kind === 'nothing');
    console.log(`\n${setting}${process.env.LESION ? ' (without ' + process.env.LESION + ')' : ''}: ${trials.length} events, ${sham.length} times nothing, falls ${sim.life.falls}`);
    console.log('event             n | "being moved"       | "I am moving" | doubt             | otolith cells alone | "Fremdeinwirkung" (body model) | fell');
    const row = (name: string, ts: Trial[]): void => {
      const col = (f: (t: Trial) => number): string => `${mean(ts.map(f)).toFixed(0).padStart(3)} Hz${ts === sham ? '         ' : ' AUC ' + auc(ts.map(f), sham.map(f)).toFixed(2)}`;
      console.log(`${name.padEnd(16)} ${String(ts.length).padStart(2)} | ${col((t) => t.moved)}     | ${mean(ts.map((t) => t.moving)).toFixed(0).padStart(3)} Hz        | ${col((t) => t.doubt)}   | ${col((t) => t.oto)}     | ${col((t) => t.ext)}                | ${ts.filter((t) => t.fell).length}`);
    };
    row('nothing', sham);
    for (const k of [...new Set(trials.map((t) => t.kind))].filter((k) => k !== 'nothing').sort((x, y) => (x.startsWith('own') ? 1 : 0) - (y.startsWith('own') ? 1 : 0) || parseFloat(x.slice(6)) - parseFloat(y.slice(6)))) row(k, trials.filter((t) => t.kind === k));
    const shoves = trials.filter((t) => t.kind.startsWith('shove'));
    console.log(`all shoves against nothing: "being moved" AUC ${auc(shoves.map((t) => t.moved), sham.map((t) => t.moved)).toFixed(2)}, otolith alone ${auc(shoves.map((t) => t.oto), sham.map((t) => t.oto)).toFixed(2)}, body model ${auc(shoves.map((t) => t.ext), sham.map((t) => t.ext)).toFixed(2)}, doubt ${auc(shoves.map((t) => t.doubt), sham.map((t) => t.doubt)).toFixed(2)}`);
  }
}

if (test === 'core') {
  // 1. Can the situation the creature is in be read from the core?  2. For how long does the
  // core keep its pattern when everything it listens to is cut off – with and without the
  // slow synapses between its cells?
  const sim = make({ sleep: true });
  const b = sim.brain;
  const s = b.self;
  const n = s.core.n;
  const a0 = s.core.start;
  const count = new Float32Array(n);
  const collect = (): void => { const { spikes, nSpikes } = b.net; for (let k = 0; k < nSpikes; k++) { const i = spikes[k] - a0; if (i >= 0 && i < n) count[i]++; } };
  const take = (): Float32Array => { const v = count.slice(); count.fill(0); return v; };
  const corr = (x: Float32Array, y: Float32Array): number => {
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i]; }
    const c = sxy - (sx * sy) / n, vx = sxx - (sx * sx) / n, vy = syy - (sy * sy) / n;
    return vx > 0 && vy > 0 ? c / Math.sqrt(vx * vy) : 0;
  };
  // --- 1. situations: 250 ms windows, labelled by what the creature is doing ---
  const samples: { label: string; v: Float32Array }[] = [];
  const run = (secs: number, set: () => void): void => {
    set();
    for (let w = 0; w < secs * 4; w++) {
      const state = sim.life.state;
      let same = true;
      for (let i = 0; i < 250; i++) { sim.tick(); collect(); if (sim.life.state !== state) same = false; }
      const v = take();
      if (same && w > 3) samples.push({ label: state, v });
    }
  };
  const need = (h: number, t: number, e: number): void => { b.intero.override[0] = h; b.intero.override[1] = t; b.intero.override[2] = e; };
  for (let rep = 0; rep < (process.env.PERSIST_ONLY ? 0 : 3); rep++) {
    run(25, () => need(0.4, 0, 0)); // walking (and falling now and then)
    run(12, () => need(0.1, 0, 0.7)); // resting
    run(12, () => { need(0.1, NaN, 0); b.hormones.level.somnin = 0.8; }); // falling asleep
    b.hormones.level.somnin = 0;
    run(6, () => need(0.4, 0, 0));
  }
  const labels = [...new Set(samples.map((x) => x.label))];
  const train = samples.filter((_, i) => i % 2 === 0), testSet = samples.filter((_, i) => i % 2 === 1);
  const centroid = new Map<string, Float32Array>();
  for (const l of labels) {
    const m = new Float32Array(n);
    const xs = train.filter((x) => x.label === l);
    for (const x of xs) for (let i = 0; i < n; i++) m[i] += x.v[i] / xs.length;
    centroid.set(l, m);
  }
  let right = 0;
  const per: Record<string, [number, number]> = {};
  for (const x of testSet) {
    let best = '', bc = -2;
    for (const l of labels) { const c = corr(x.v, centroid.get(l)!); if (c > bc) { bc = c; best = l; } }
    per[x.label] ??= [0, 0];
    per[x.label][1]++;
    if (best === x.label) { right++; per[x.label][0]++; }
  }
  if (!process.env.PERSIST_ONLY) {
  console.log(`situations read from the core (250 ms windows, nearest mean pattern, half of the windows held back for the test):`);
  console.log(`  ${right} of ${testSet.length} right (${Math.round((100 * right) / testSet.length)} %; guessing the most frequent one would give ${Math.round((100 * Math.max(...labels.map((l) => testSet.filter((x) => x.label === l).length))) / testSet.length)} %): ` + labels.map((l) => `${l} ${per[l]?.[0] ?? 0}/${per[l]?.[1] ?? 0}`).join(', '));
  }
  // --- 2. persistence while walking ---
  need(0.4, 0, 0);
  for (const rec of [true, false]) {
    s.setRecurrent(rec);
    for (let i = 0; i < 5000; i++) sim.tick();
    const bins = 12;
    const rate = new Float64Array(bins), sim0 = new Float64Array(bins);
    let trials = 0;
    while (trials < 40) {
      for (let i = 0; i < 1500; i++) sim.tick();
      if (sim.life.state !== 'walking') continue;
      take();
      for (let i = 0; i < 200; i++) { sim.tick(); collect(); }
      const before = take();
      s.setCoreInput(false);
      for (let k = 0; k < bins; k++) {
        for (let i = 0; i < 50; i++) { sim.tick(); collect(); }
        const v = take();
        let sum = 0;
        for (let i = 0; i < n; i++) sum += v[i];
        rate[k] += sum / n / 0.05;
        sim0[k] += corr(v, before);
      }
      s.setCoreInput(true);
      trials++;
    }
    console.log(`core cut off from its inputs while walking, ${rec ? 'with' : 'WITHOUT'} the plateau of its cells (${trials} times):`);
    console.log(`  core while walking ${s.core.rate.toFixed(2)} Hz, ${(100 * s.coreActive).toFixed(1)} % of its cells active within 100 ms`);
    console.log('  ' + Array.from({ length: bins }, (_, k) => `${k * 50}-${k * 50 + 50} ms: ${(rate[k] / trials).toFixed(2)} Hz, likeness to before ${(sim0[k] / trials).toFixed(2)}`).join(' | '));
  }
}
