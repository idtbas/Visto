import { REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { SpinalCord } from '../src/sim/brain/spinal';
import { Network } from '../src/sim/brain/network';
import { Physics } from '../src/sim/world/physics';
import { evaluateSpinal } from './spinal-eval';
import { readFileSync } from 'node:fs';
// usage: tsx tools/spinal-test.ts <params.json|-> <standFor> <T> <push> [name=mult ...]
const file = process.argv[2];
const standFor = Number(process.argv[3] ?? 0);
const p = REFLEX_DEFAULTS.slice();
const names = new SpinalCord(new Network(1), new Physics().biped, p).pathNames;
let mult: number[] = names.map(() => 1);
if (file && file !== '-') {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  for (let i = 0; i < j.params.length; i++) p[i] = j.params[i];
  if (j.mult) mult = j.mult;
}
for (const a of process.argv.slice(6)) {
  const [k, v] = a.split('=');
  names.forEach((n, i) => {
    if (n.startsWith(k)) mult[i] *= Number(v);
  });
}
const t0 = performance.now();
const r = evaluateSpinal(p, { T: Number(process.argv[4] ?? 12), standFor, push: Number(process.argv[5] ?? 0), log: true, mult });
console.log(r, `${(performance.now() - t0).toFixed(0)} ms`);
