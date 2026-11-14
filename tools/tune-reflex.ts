// Offline "evolution" of the reflex gains for the reference controller.
// usage: tsx tools/tune-reflex.ts <seed> <generations> <out.json> <stand|full> [init.json]
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { REFLEX_DEFAULTS, REFLEX_PARAM_NAMES, P_STAND0 } from '../src/sim/control/reflex';
import { evaluateReflex } from './reflex-eval';
import { cmaes } from './cmaes';

const seed = Number(process.argv[2] ?? 1);
const gens = Number(process.argv[3] ?? 200);
const out = process.argv[4] ?? `out/reflex-${seed}.json`;
const mode = process.argv[5] ?? 'full';
const init = process.argv[6] ?? out;
const x0 = REFLEX_DEFAULTS.slice();
if (existsSync(init)) {
  const q = JSON.parse(readFileSync(init, 'utf8')).params as number[];
  for (let i = 0; i < q.length; i++) x0[i] = q[i];
}
const sigma = REFLEX_DEFAULTS.map((v, i) => {
  const name = REFLEX_PARAM_NAMES[i];
  if (mode === 'stand' && i < P_STAND0) return 0;
  if (mode === 'walk' && i >= P_STAND0) return 0; // standing and gait initiation are not exercised
  if (mode === 'walk' && i >= 23) return name === 'vx0' ? 0.08 : name === 'lean0' ? 0.02 : 3;
  if (i >= 23 && i < P_STAND0) return 0; // mid-stride initial conditions are unused when starting from standing
  if (name === 'lean0' || name === 'thetaRef' || name === 'stTheta') return 0.02;
  if (name.startsWith('lOff') || name.endsWith('Off')) return 0.04;
  const rel = mode === 'full' && i < 23 ? 0.08 : 0.2;
  return Math.max(0.01, Math.abs(v) * rel);
});

// keep the solution physiologically sensible: reflex gains must not change sign
const lower = REFLEX_PARAM_NAMES.map((name) => {
  if (name === 'stKp') return 0.8;
  if (name === 'stKd') return 0.1;
  if (name === 'stTheta' || name === 'lean0' || name === 'thetaRef') return -0.1;
  if (name === 'initTau') return 0.1;
  return 0;
});
for (let i = 0; i < x0.length; i++) if (x0[i] < lower[i]) x0[i] = lower[i] + 0.05;

function penalty(x: number[]): number {
  let pen = 0;
  for (let i = 0; i < x.length; i++) if (x[i] < lower[i]) pen += 20 * (lower[i] - x[i]) + 1;
  return pen;
}

function fitness(x: number[]): number {
  const pen = penalty(x);
  if (pen > 0) return -pen;
  if (mode === 'stand') {
    let f = 0;
    for (const push of [30, -30, 0]) f += evaluateReflex(x, { T: 6, standFor: 6, push }).fitness;
    return f / 3;
  }
  if (mode === 'walk') {
    // started in mid-stride; must also cope with a shove from behind or in front
    let f = 0;
    for (const push of [0, 12, -12]) f += evaluateReflex(x, { T: 12, standFor: 0, walkPush: push }).fitness;
    return f / 3;
  }
  // standing must be stable for long (and cheap), and walking must start from standing
  let f = 0;
  for (const push of [25, -25]) {
    const r = evaluateReflex(x, { T: 9, standFor: 9, push, pushes: true });
    f += 0.5 * (r.fitness - r.energy / r.time / 400);
  }
  for (const push of [15, -15]) f += evaluateReflex(x, { T: 14, standFor: 2, push }).fitness;
  return f / 2;
}

const t0 = Date.now();
const res = cmaes({
  x0,
  sigma,
  seed,
  lambda: 24,
  generations: gens,
  evaluate: fitness,
  onGeneration: (gen, best, bestX) => {
    if (gen % 5 === 0 || gen === gens - 1) {
      const r = evaluateReflex(bestX, mode === 'stand' ? { T: 6, standFor: 6, push: 30 } : mode === 'walk' ? { T: 12 } : { T: 14, standFor: 2, push: 15 });
      console.log(`seed ${seed} gen ${gen} best ${best.toFixed(2)} time ${r.time.toFixed(1)} dist ${r.dist.toFixed(1)} steps ${r.steps} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      writeFileSync(out, JSON.stringify({ fitness: best, params: bestX, names: REFLEX_PARAM_NAMES }, null, 1));
    }
  },
});
console.log('done', res.f);
