// Does the forward model learn to predict the senses, and what does its error tell?
import { Vec2 } from 'planck';
import { Sim } from '../src/sim/sim';
const sim = new Sim({ learn: true, newbornTone: 0.9, learningRate: 0 });
sim.autoCookies = false;
const pr = sim.brain.predictor;
const b = sim.physics.biped;
let acc = 0, n = 0;
const row: string[] = [];
// keep the last second of the error to look back from the moment of a fall
const hist = new Float32Array(1000);
const beforeFall: number[] = [];
const ordinary: number[] = [];
let walkedFor = 0;
for (let i = 0; i < 360000; i++) {
  const was = sim.life.state;
  sim.tick();
  hist[i % 1000] = pr.spe;
  if (sim.life.state === 'walking') {
    acc += pr.spe; n++; walkedFor++;
    // an ordinary half second: far from any fall (checked afterwards by only sampling long walks)
    if (i > 120000 && walkedFor > 3000 && walkedFor % 500 === 0) {
      let p = 0;
      for (let k = 0; k < 500; k++) p = Math.max(p, hist[(i - k + 1000) % 1000]);
      ordinary.push(p);
    }
  } else walkedFor = 0;
  if (was === 'walking' && sim.life.state === 'fallen' && i > 120000) {
    let p = 0;
    for (let k = 0; k < 500; k++) p = Math.max(p, hist[(i - k + 1000) % 1000]);
    beforeFall.push(p);
    // the last ordinary samples of this walk were in fact the run-up to the fall
    ordinary.splice(-2);
  }
  if (i % 30000 === 29999) { row.push((acc / Math.max(1, n)).toFixed(3)); acc = 0; n = 0; }
}
const stat = (a: number[]): string => { if (a.length === 0) return 'n=0'; const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return `${m.toFixed(3)} ± ${sd.toFixed(3)} (n=${a.length})`; };
console.log('mean prediction error while walking, per 30 s:', row.join(' '));
console.log(`peak error in the half second before a fall: ${stat(beforeFall)}; in an ordinary half second: ${stat(ordinary)}`);
const thr = pr.usual * 1.8 + 0.04;
console.log(`threshold for "surprise" ${thr.toFixed(3)}: exceeded before ${beforeFall.filter((v) => v > thr).length} of ${beforeFall.length} falls and in ${ordinary.filter((v) => v > thr).length} of ${ordinary.length} ordinary half seconds`);
// gentle shoves of 12 N·s every 6 s
const withShove: number[] = [];
const without: number[] = [];
let peak = 0, clean = true, shoved = false;
for (let i = 0; i < 120000; i++) {
  const ph = i % 6000;
  if (ph % 500 === 0) {
    if (i > 0 && clean) (shoved ? withShove : without).push(peak);
    peak = 0; clean = sim.life.state === 'walking'; shoved = false;
  }
  if (ph === 3000 && sim.life.state === 'walking') {
    shoved = true;
    b.trunk.applyLinearImpulse(new Vec2(((i / 6000) & 1 ? 1 : -1) * 12, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
  }
  sim.tick();
  if (sim.life.state !== 'walking') clean = false;
  if (pr.spe > peak) peak = pr.spe;
}
console.log(`peak error in the half second after a gentle shove: ${stat(withShove)}; without: ${stat(without)}`);
