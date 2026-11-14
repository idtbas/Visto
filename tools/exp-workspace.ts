// Does the workspace behave as a global workspace should?
//  1. Ignition: the response to an input of graded strength is not graded but jumps.
//  2. It holds itself after a short input and then ends by itself.
//  3. Competition: of two contents offered together, one wins.
//  4. Arousal: a drowsy brain ignites less easily, a sleeping one not at all.
//  5. Habituation: the same thing again and again stops getting in, and gets in again after a pause.
// The input is the need "hunger" (and "exhaustion" as the rival), set by hand; nothing else
// is touched. The creature stands still meanwhile.
// usage: tsx tools/exp-workspace.ts
import { Sim } from '../src/sim/sim';
import { IGNITED } from '../src/sim/brain/workspace';

function fresh(): Sim {
  const sim = new Sim({ learn: false, seed: 1, startInStride: false, pain: 'off' });
  sim.setWantsToWalk(false);
  // only the input that is set by hand should reach the workspace in this test
  sim.brain.bodyModel.setOutput(false);
  for (let i = 0; i < 1500; i++) sim.tick();
  return sim;
}
const sim = fresh();
const { workspace: ws, intero } = sim.brain;
const HUNGER = ws.names.indexOf('Bedürfnis');
console.log(`contents: ${ws.names.join(', ')}; neurons ${sim.brain.net.n}`);
const run = (ms: number, f?: (t: number) => void): void => { for (let t = 0; t < ms; t++) { f?.(t); sim.tick(); } };
// between trials everything is brought back to rest, including the long-term habituation (tested on its own in 5)
const rest = (): void => { intero.override.fill(0); run(1500); ws.habit.fill(0); };

// 1. graded input, 400 ms each
console.log('\n1. input strength -> response (input lasts 400 ms)');
console.log('   input   sensor cells   workspace: peak   time above the ignition level   rate 150-300 ms after the input has ended');
for (const lv of [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0]) {
  rest();
  intero.override[0] = lv;
  let src = 0, peak = 0, above = 0;
  run(400, (t) => { if (t >= 200) src += intero.pops[0].rate; const r = ws.pools[HUNGER].rate; if (r > peak) peak = r; if (r > IGNITED) above++; });
  intero.override[0] = 0;
  let after = 0;
  run(300, (t) => { const r = ws.pools[HUNGER].rate; if (r > IGNITED) above++; if (t >= 150) after += r; });
  console.log(`   ${(100 * lv).toFixed(0).padStart(3)} %   ${(src / 200).toFixed(0).padStart(3)} Hz         ${peak.toFixed(0).padStart(3)} Hz            ${String(above).padStart(3)} ms                          ${(after / 150).toFixed(0).padStart(3)} Hz`);
}

// 2. short strong inputs: time course
for (const dur of [30, 60, 150]) {
  console.log(`\n2. input of 100 % for ${dur} ms: workspace rate in steps of 50 ms`);
  rest();
  intero.override[0] = 1;
  const course: string[] = [];
  let acc = 0;
  run(900, (t) => { if (t === dur) intero.override[0] = 0; acc += ws.pools[HUNGER].count * (1000 / ws.pools[HUNGER].n); if (t % 50 === 49) { course.push((acc / 50).toFixed(0)); acc = 0; } });
  console.log('   ' + course.join(' '));
}

// 3. two contents at once: a bodily need and something seen
console.log('\n3. competition: a need and something seen, offered at the same moment (peak rates over 400 ms)');
const SEE = ws.names.indexOf('Sehen');
for (const [a, b] of [[1, 0], [0, 1], [1, 0.3], [1, 0.45], [1, 0.6], [0.5, 0.6], [1, 1]]) {
  rest();
  let wa = 0, wb = 0;
  run(400, () => { intero.override[0] = a; sim.brain.decision.seenDistance = b > 0 ? 0.6 : Infinity; sim.brain.decision.seenHeight = 0.05 * b; wa = Math.max(wa, ws.pools[HUNGER].rate); wb = Math.max(wb, ws.pools[SEE].rate); });
  sim.brain.decision.seenDistance = Infinity;
  console.log(`   need ${a.toFixed(1)}, sight ${b.toFixed(2)}: workspace "Bedürfnis" ${wa.toFixed(0).padStart(3)} Hz, "Sehen" ${wb.toFixed(0).padStart(3)} Hz`);
}
console.log('   the same, but the need comes 120 ms earlier');
for (const [a, b] of [[1, 0.6], [1, 1]]) {
  rest();
  let wa = 0, wb = 0;
  run(520, (t) => { intero.override[0] = a; if (t >= 120) { sim.brain.decision.seenDistance = 0.6; sim.brain.decision.seenHeight = 0.05 * b; } if (t >= 120) { wa = Math.max(wa, ws.pools[HUNGER].rate); wb = Math.max(wb, ws.pools[SEE].rate); } });
  sim.brain.decision.seenDistance = Infinity;
  console.log(`   need ${a.toFixed(1)}, then sight ${b.toFixed(2)}: "Bedürfnis" ${wa.toFixed(0).padStart(3)} Hz, "Sehen" ${wb.toFixed(0).padStart(3)} Hz`);
}

// 4. arousal
const lvA = 0.25;
console.log(`\n4. the same weak input (${100 * lvA} %) at different levels of arousal`);
for (const [label, vig, som] of [['alert', 0.8, 0], ['normal', 0.3, 0], ['drowsy', 0.1, 0.7]] as const) {
  rest();
  let w = 0;
  run(300, () => { sim.brain.hormones.level.vigilin = vig; sim.brain.hormones.level.somnin = som; });
  run(400, () => { sim.brain.hormones.level.vigilin = vig; sim.brain.hormones.level.somnin = som; intero.override[0] = lvA; w = Math.max(w, ws.pools[HUNGER].rate); });
  console.log(`   ${label.padEnd(7)} (arousal ${sim.brain.hormones.effects.arousal.toFixed(2)}): workspace peak ${w.toFixed(0)} Hz`);
}
sim.brain.hormones.level.somnin = 0;

// 5. the same input again and again
console.log('\n5. the same input (60 %, 200 ms) every 2 s: peak rate of the workspace at each repetition');
rest();
const peaks: string[] = [];
for (let rep = 0; rep < 12; rep++) {
  let w = 0;
  run(200, () => { intero.override[0] = 0.6; w = Math.max(w, ws.pools[HUNGER].rate); });
  intero.override[0] = 0;
  run(1800, () => { w = Math.max(w, ws.pools[HUNGER].rate); });
  peaks.push(w.toFixed(0));
}
console.log('   ' + peaks.join(' ') + '   (lost access now: ' + ws.habit[HUNGER].toFixed(1) + ')');
intero.override[0] = 0;
run(180000);
let w = 0;
run(200, () => { intero.override[0] = 0.6; w = Math.max(w, ws.pools[HUNGER].rate); });
intero.override[0] = 0;
run(300, () => { w = Math.max(w, ws.pools[HUNGER].rate); });
console.log(`   after a pause of 3 minutes: ${w.toFixed(0)} Hz`);

// asleep
rest();
sim.brain.bodyState.asleep = true;
let ws0 = 0;
run(400, () => { sim.brain.bodyState.asleep = true; intero.override[0] = 1; ws0 = Math.max(ws0, ws.pools[HUNGER].rate); });
console.log(`\n   asleep, input 100 %: workspace peak ${ws0.toFixed(0)} Hz`);
