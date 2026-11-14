// Do the creature's own needs make it act, and does it learn where to go?
//
// Nobody commands it to walk. It is hungry or not, smells cookies ahead or behind, and its
// own drive circuit decides whether to walk, rest or turn around. If its energy runs out, it
// dies. Printed every half minute:
//   - how its time was spent (walking / resting / sleeping / fallen)
//   - energy at the end, cookies eaten, turns
//   - how much of its walking was towards the cookie that smelled strongest
//   - turns that were right (the stronger smell was behind) and wrong
//   - what it has learned: strength of smell ahead → go, behind → go, ahead → turn, behind → turn
// usage: tsx tools/exp-autonomy.ts [minutes] [seed] [energy at start]
//   TONE=1 (default) a creature that can already walk; TONE=0.6 a newborn
//   LESION=drive   the drive circuit is cut off          SHAM=1   dopamine arrives 17 s late (no learning signal)
import { Sim } from '../src/sim/sim';
import type { ModuleName } from '../src/sim/brain/brain';

const minutes = Number(process.argv[2] ?? 6);
const seed = Number(process.argv[3] ?? 1);
const energy = Number(process.argv[4] ?? 0.5);
const tone = Number(process.env.TONE ?? 1);
const sim = new Sim({ learn: true, newbornTone: tone, learningRate: tone >= 1 ? 0 : undefined, seed, autonomy: true, mortal: true, energy, sleep: !!process.env.SLEEP });
// a creature that can walk has walked before: cookies may lie behind it from the start
if (tone >= 1) sim.life.bestAttempt = 25;
for (const m of (process.env.LESION ?? '').split(',').filter(Boolean)) sim.brain.setModule(m as ModuleName, false);
if (process.env.SHAM) sim.brain.reward.shamDelay = 17000;
const d = sim.brain.drive;
console.log(`seed ${seed}, tone ${tone}, energy at start ${energy}${process.env.LESION ? ', switched off: ' + process.env.LESION : ''}${process.env.SHAM ? ', sham dopamine' : ''}; neurons ${sim.brain.net.n}`);
let turns0 = 0, cookies0 = 0, falls0 = 0;
for (let h = 0; h < minutes * 2 && sim.life.state !== 'dead'; h++) {
  const spent: Record<string, number> = { walking: 0, resting: 0, sleeping: 0, fallen: 0, standing: 0, dead: 0 };
  let towards = 0, walk = 0, right = 0, wrong = 0, lastTurns = sim.turns;
  let prevF = 0, prevB = 0;
  for (let i = 0; i < 30000 && (sim.life.state as string) !== 'dead'; i++) {
    prevF = d.smellFront; prevB = d.smellBack;
    sim.tick();
    spent[sim.life.state]++;
    if (sim.turns !== lastTurns) { lastTurns = sim.turns; if (prevB > prevF) right++; else wrong++; }
    if (sim.life.state === 'walking') { walk++; if (d.smellFront >= d.smellBack) towards++; }
  }
  const pct = (k: string): string => `${Math.round(spent[k] / 300)} %`;
  console.log(
    `${((h + 1) / 2).toFixed(1).padStart(4)} min: walking ${pct('walking')}, resting ${pct('resting')}, sleeping ${pct('sleeping')}, fallen ${pct('fallen')} | energy ${sim.brain.hormones.energy.toFixed(2)}, cookies ${sim.cookiesEaten - cookies0}, falls ${sim.life.falls - falls0}, turns ${sim.turns - turns0} (right ${right}, wrong ${wrong}) | walking towards the stronger smell ${walk ? Math.round((100 * towards) / walk) : 0} % | learned ${d.weights().map((w) => w.toFixed(2)).join(' ')} | go ${d.command[0].rate.toFixed(0)} Hz`,
  );
  turns0 = sim.turns; cookies0 = sim.cookiesEaten; falls0 = sim.life.falls;
}
if (sim.life.state === 'dead') console.log(`died of hunger after ${(sim.diedAt / 60).toFixed(1)} minutes`);
