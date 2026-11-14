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
  if (i >= 23 && i < P_STAND0) return 0; // mid-stride initial conditions are unused when starting from standing
  if (name === 'lean0' || name === 'thetaRef' || name === 'stTheta') return 0.02;
  if (name.startsWith('lOff') || name.endsWith('Off')) return 0.04;
  const rel = mode === 'full' && i < 23 ? 0.08 : 0.2;
  return Math.max(0.01, Math.abs(v) * rel);
});

function fitness(x: number[]): number {
  if (mode === 'stand') {
    let f = 0;
    for (const push of [30, -30, 0]) f += evaluateReflex(x, { T: 6, standFor: 6, push }).fitness;
    return f / 3;
  }
  let f = 0;
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
      const r = evaluateReflex(bestX, mode === 'stand' ? { T: 6, standFor: 6, push: 30 } : { T: 14, standFor: 2, push: 15 });
      console.log(`seed ${seed} gen ${gen} best ${best.toFixed(2)} time ${r.time.toFixed(1)} dist ${r.dist.toFixed(1)} steps ${r.steps} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      writeFileSync(out, JSON.stringify({ fitness: best, params: bestX, names: REFLEX_PARAM_NAMES }, null, 1));
    }
  },
});
console.log('done', res.f);
