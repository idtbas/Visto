// Runs the simulation loop. Lives in a web worker; if workers are not available it runs on
// the main thread instead (slower for the display, but it works).
import { Sim, DT } from './sim/sim';
import type { FromWorker, ToWorker } from './protocol';

export function createHost(post: (m: FromWorker) => void): (m: ToWorker) => void {
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
  /** time the loop may compute before yielding [ms] */
  let budget = 12;

  function loop(): void {
    const now = performance.now();
    const wall = Math.min(now - lastWall, 100) / 1000;
    lastWall = now;
    if (!paused) {
      const budgetEnd = now + budget;
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

  return (m: ToWorker): void => {
    switch (m.type) {
      case 'start': {
        sim = new Sim(m.options ?? {});
        if (m.mainThread) budget = 8;
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
      case 'debugSomnin':
        // for tests and screenshots: make the creature tired right away
        sim.brain.hormones.level.somnin = m.level;
        break;
      case 'obstacles':
        sim.obstaclesOn = m.on;
        break;
      case 'pain':
        sim.setPainMode(m.on ? 'graded' : 'off');
        break;
      case 'autoReward':
        sim.autoRewardOn = m.on;
        sim.autoCookies = m.on;
        break;
    }
  };
}
