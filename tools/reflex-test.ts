import { REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { evaluateReflex } from './reflex-eval';
import { readFileSync } from 'node:fs';
const file = process.argv[2];
const standFor = Number(process.argv[3] ?? 0);
let p = REFLEX_DEFAULTS.slice();
if (file && file !== '-') {
  const q = JSON.parse(readFileSync(file, 'utf8')).params as number[];
  for (let i = 0; i < q.length; i++) p[i] = q[i];
}
const t0 = performance.now();
const r = evaluateReflex(p, { T: Number(process.argv[4] ?? 12), standFor, push: Number(process.argv[5] ?? 0), log: true });
console.log(r, `${(performance.now() - t0).toFixed(0)} ms`);
