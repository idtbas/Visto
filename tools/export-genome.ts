// Writes the results of the offline searches into the source tree.
// usage: tsx tools/export-genome.ts <spinal.json>
import { readFileSync, writeFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const r = (a: number[]): string => JSON.stringify(a.map((v) => +v.toFixed(5)));
writeFileSync(
  'src/sim/control/genome.ts',
  `// Innate wiring found by offline optimisation ("evolution"), see tools/tune-reflex.ts and tools/tune-spinal.ts.
// Do not edit by hand.
export const REFLEX_GENOME: number[] = ${r(j.params)};
/** strength multipliers of the spinal pathways, order: ${j.names.join(', ')} */
export const SPINAL_MULT: number[] = ${r(j.mult)};
`,
);
console.log('genome written, fitness', j.fitness);
