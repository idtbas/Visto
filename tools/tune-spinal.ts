// Offline "evolution" of the innate spinal wiring: per-pathway multipliers on the synaptic strengths.
// usage: tsx tools/tune-spinal.ts <seed> <generations> <out.json> <walk|full> <params.json> [init.json]
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { SpinalCord } from '../src/sim/brain/spinal';
import { Network } from '../src/sim/brain/network';
import { Physics } from '../src/sim/world/physics';
import { evaluateSpinal } from './spinal-eval';
import { cmaes } from './cmaes';

const seed = Number(process.argv[2] ?? 1);
const gens = Number(process.argv[3] ?? 100);
const out = process.argv[4] ?? `out/spinal-${seed}.json`;
const mode = process.argv[5] ?? 'walk';
const paramFile = process.argv[6] ?? 'out/reflex-2.json';
const init = process.argv[7] ?? out;
const p = REFLEX_DEFAULTS.slice();
{
  const q = JSON.parse(readFileSync(paramFile, 'utf8')).params as number[];
  for (let i = 0; i < q.length; i++) p[i] = q[i];
}
const names = new SpinalCord(new Network(1), new Physics().biped, p).pathNames;
let x0 = names.map(() => 0);
if (existsSync(init)) {
  const m = JSON.parse(readFileSync(init, 'utf8')).mult as number[];
  x0 = names.map((_, i) => Math.log(m[i] ?? 1));
}
const sigma = names.map((n) => (mode === 'walk' && (n.startsWith('s') || n.endsWith('Stand') || n.startsWith('i')) ? 0 : 0.18));
const toMult = (x: number[]): number[] => x.map(Math.exp);

let evalSeed = 1;
function fitness(x: number[]): number {
  const mult = toMult(x);
  if (mode === 'walk') return (evaluateSpinal(p, { T: 8, mult, seed: evalSeed }).fitness + evaluateSpinal(p, { T: 8, mult, seed: evalSeed + 10 }).fitness) / 2;
  let f = 0;
  for (const push of [15, -15]) f += evaluateSpinal(p, { T: 11, standFor: 2, push, mult, seed: evalSeed }).fitness;
  return f / 2;
}

const t0 = Date.now();
cmaes({
  x0,
  sigma,
  seed,
  lambda: 16,
  generations: gens,
  evaluate: fitness,
  onGeneration: (gen, best, bestX, mean) => {
    evalSeed = 1 + (gen % 3); // vary the network's random wiring so the solution does not depend on one instance
    if (gen % 2 === 0 || gen === gens - 1) {
      const r = evaluateSpinal(p, mode === 'walk' ? { T: 8, mult: toMult(mean) } : { T: 11, standFor: 2, push: 15, mult: toMult(mean) });
      console.log(`seed ${seed} gen ${gen} best ${best.toFixed(2)} | mean: time ${r.time.toFixed(1)} dist ${r.dist.toFixed(1)} steps ${r.steps} fit ${r.fitness.toFixed(2)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      writeFileSync(out, JSON.stringify({ fitness: r.fitness, params: p, mult: toMult(mean), bestMult: toMult(bestX), names }, null, 1));
    }
  },
});
