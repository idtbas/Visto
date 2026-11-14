// The simulation lives in this worker so the page stays smooth while the brain computes.
import { Sim, DT } from './sim/sim';
import type { FromWorker, ToWorker } from './protocol';

let sim: Sim;
let paused = false;
/** target simulated seconds per real second; 0 = as fast as possible */
let targetSpeed = 1;
let simDebt = 0;
let lastWall = performance.now();
let lastFrame = 0;
let measured = 0;
let measSim = 0;
let measWall = performance.now();
let sentAttempts = -1;

const post = (m: FromWorker): void => (self as unknown as Worker).postMessage(m);

function loop(): void {
  const now = performance.now();
  const wall = Math.min(now - lastWall, 100) / 1000;
  lastWall = now;
  if (!paused) {
    const budgetEnd = now + 12;
    if (targetSpeed > 0) {
      simDebt = Math.min(simDebt + wall * targetSpeed, 0.25 * Math.max(1, targetSpeed));
      while (simDebt >= DT && performance.now() < budgetEnd) {
        for (let i = 0; i < 4 && simDebt >= DT; i++) {
          sim.tick();
          simDebt -= DT;
          measSim += DT;
        }
      }
    } else {
      while (performance.now() < budgetEnd) {
        for (let i = 0; i < 8; i++) sim.tick();
        measSim += 8 * DT;
      }
    }
  }
  if (now - measWall > 500) {
    measured = measSim / ((now - measWall) / 1000);
    measSim = 0;
    measWall = now;
  }
  if (now - lastFrame >= 15) {
    lastFrame = now;
    post({ type: 'frame', frame: sim.frame(measured) });
    if (sim.attemptCount !== sentAttempts) {
      sentAttempts = sim.attemptCount;
      post({ type: 'attempts', list: sim.attempts.slice() });
    }
  }
  setTimeout(loop, 0);
}

self.onmessage = (e: MessageEvent<ToWorker>): void => {
  const m = e.data;
  switch (m.type) {
    case 'start': {
      sim = new Sim(m.options ?? {});
      const restored = m.state ? sim.loadState(m.state) : false;
      post({ type: 'ready', brain: sim.brainInfo(), restored });
      loop();
      break;
    }
    case 'save':
      post({ type: 'state', state: sim.saveState() });
      break;
    case 'pause':
      paused = m.paused;
      break;
    case 'speed':
      targetSpeed = m.speed;
      simDebt = 0;
      break;
    case 'mode':
      sim.setMode(m.mode);
      break;
    case 'manualStim':
      sim.manualStim.set(m.values);
      break;
    case 'reset':
      sim.reset();
      break;
    case 'cookie':
      sim.giveCookie();
      break;
    case 'placeCookie':
      sim.placeCookie(m.x);
      break;
    case 'wantsToWalk':
      sim.setWantsToWalk(m.on);
      break;
    case 'autoReward':
      sim.autoRewardOn = m.on;
      sim.autoCookies = m.on;
      break;
  }
};
