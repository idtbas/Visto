import { Sim } from '../src/sim/sim';
const sim = new Sim({ learn: true, newbornTone: 1, sleep: true });
sim.brain.hormones.level.somnin = 0.88;
let last = '';
for (let i = 0; i < 150000; i++) {
  sim.tick();
  if (sim.life.state !== last && (sim.life.state === 'sleeping' || last === 'sleeping')) {
    console.log(`t=${(i / 1000).toFixed(1)} s: ${last} → ${sim.life.state}, somnin ${sim.brain.hormones.level.somnin.toFixed(2)}, hip height ${sim.physics.biped.hipY().toFixed(2)}, falls ${sim.life.falls}`);
  }
  last = sim.life.state;
}
console.log('end', sim.life.state, 'somnin', sim.brain.hormones.level.somnin.toFixed(2), 'falls', sim.life.falls, 'x', sim.physics.biped.hipX().toFixed(0));
