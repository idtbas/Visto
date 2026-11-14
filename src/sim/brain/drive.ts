// Drive: the creature decides for itself whether to walk, to rest or to turn around.
//
// Two new senses and two basal-ganglia loops:
//
//  - Smell. Two groups of cells report how strongly a cookie can be smelled ahead and behind
//    (stronger when nearer, and much weaker when the creature is not hungry).
//  - "Go". Striatal cells are driven by hunger and by smell. When they fire strongly enough
//    they silence the pallidum, the thalamus is released and drives the command "walk" –
//    the same command that until now was switched on from outside.
//  - "Turn". A second loop of the same kind gives the command to turn around. The smell
//    ahead inhibits it, so the two smells are compared: it turns when what is behind smells
//    stronger than what is ahead.
//
// What is innate: hunger makes restless (hunger → "go" is wired from birth), and a smell that
// gets stronger is good. Everything else about the cookies is learned: the synapses from the
// two smells onto the two loops start at half strength, and trial actions come from an
// exploration nucleus.
//
// The teaching signal of these synapses is the change of the smell itself, as for an animal
// following a scent: while walking, whether the smell is getting stronger or weaker; after
// turning around, whether the turn made it stronger. A synapse whose smell was unusually
// strong just before changes in the direction of that signal. (The general dopamine signal
// was tried first and failed: single large bursts at every cookie drowned the fine signal,
// and the creature learned the wrong way round.)
import { Network, NT, Pop, Proj } from './network';
import { currentForRate } from './spinal';
import { gaussian } from '../util/rng';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const N = 32;
const STR_BIAS = 0.5;
const EX_W = Number(env.DRV_EX_W ?? 0.45);
const EX_TAU = 1500; // ms: a trial action lasts a second or two
/** n·p·w of the innate drive from hunger onto "go" */
const K_HUNGER = Number(env.DRV_KH ?? 26);
/** n·p·w of a fully learned smell synapse */
const K_SMELL = Number(env.DRV_KS ?? 20);
/** the walk command is given above this rate of the command cells and withdrawn below the lower one [Hz] */
const TURN_START = Number(env.DRV_TS ?? 0.3);
/** inhibition of the turn loop by the smell ahead (n·p·w) */
const K_HOLD = Number(env.DRV_HOLD ?? 12);
const GO_ON = 30;
const GO_OFF = 12;
const TURN_ON = 40;

export class Drive {
  /** smell of a cookie ahead / behind */
  readonly smell: Pop[] = [];
  readonly striatum: Pop[] = [];
  readonly command: Pop[] = [];
  readonly explorer: Pop[] = [];
  /** learned synapses: [smell ahead → go, smell behind → go, smell ahead → turn, smell behind → turn] */
  readonly proj: Proj[] = [];
  /** set by the world: how strongly a cookie is smelled ahead / behind, 0..1 */
  smellFront = 0;
  smellBack = 0;
  /** set by the body: hunger 0..1 */
  hunger = 0;
  /** the creature wants to walk */
  go = false;
  /** the command to turn around has just been given */
  turn = false;
  exploreGain = 1;
  /** teaching signals, set by the world: how fast the smell is changing while walking [1/s],
   *  and what the last turn did to it (paid out over about a second) */
  goTeach = 0;
  turnTeach = 0;
  enabled = true;
  private readonly x = [0, 0];
  /** how clearly each loop has learned its smells, 0..1 */
  readonly decided = [0, 0];
  private belowSince = 0;
  private turnWas = false;
  private readonly outputs: Proj[] = [];

  constructor(readonly net: Network, hunger: Pop, opt: { learn: boolean; lr: number }) {
    const pool = (name: string, n: number, type = NT.RELAY, bias = 2.0, inhibitory = false, region = 'drive'): Pop =>
      net.addPop({ name, n, type, region, bias, biasJitter: type === NT.FS ? 1 : 0.6, noise: 2, inhibitory });
    this.smell.push(pool('Geruch_vorn', N, NT.RELAY, 2.0, false, 'smell'), pool('Geruch_hinten', N, NT.RELAY, 2.0, false, 'smell'));
    const wSmell = K_SMELL / (N * 0.5);
    ['Los', 'Wenden'].forEach((name, a) => {
      const str = net.addPop({ name: `STR_${name}`, n: 2 * N, type: NT.RELAY, region: 'drive', bias: STR_BIAS, biasJitter: 1.5, noise: 2.5, inhibitory: true });
      const gp = pool(`GPi_${name}`, N, NT.FS, 8, true);
      const th = pool(`THAL_${name}`, N, NT.RELAY, 8);
      const cmd = pool(`Befehl_${name}`, N, NT.RELAY, 2.0);
      const ex = net.addPop({ name: `EX_${name}`, n: 8, type: NT.RELAY, region: 'explore', bias: 2.0, biasJitter: 0.6, noise: 2 });
      for (const s of this.smell) {
        this.proj.push(
          net.connect({
            // "go" starts undecided (half strength); turning starts as something rarely tried
            pre: s, post: str, channel: 'E', p: 0.5, w: (a === 0 ? 0.5 : TURN_START) * wSmell, wJitter: 0.3, delay: [2, 5],
            plastic: opt.learn ? { rule: 'trace', lr: opt.lr * wSmell, tauE: 1500, wMin: 0, wMax: 1.5 * wSmell } : undefined,
          }),
        );
      }
      if (opt.learn) net.connect({ pre: ex, post: str, channel: 'X', p: 1, w: EX_W, wJitter: 0.2, delay: [1, 3] });
      net.connect({ pre: str, post: gp, channel: 'I', p: 0.5, w: 30 / (2 * N * 0.5), wJitter: 0.3, delay: [1, 3] });
      net.connect({ pre: gp, post: th, channel: 'I', p: 0.5, w: 40 / (N * 0.5), wJitter: 0.3, delay: [1, 3] });
      this.outputs.push(net.connect({ pre: th, post: cmd, channel: 'E', p: 0.5, w: 34 / (N * 0.5), wJitter: 0.3, delay: [1, 3] }));
      this.striatum.push(str);
      this.command.push(cmd);
      this.explorer.push(ex);
    });
    // innate: what smells ahead holds the course. The smell ahead inhibits the turn loop, so
    // that turning needs the smell behind to be the stronger one – this is where two cookies
    // are compared.
    const hold = pool('Kurs_halten', 16, NT.FS, 0.5, true);
    net.connect({ pre: this.smell[0], post: hold, channel: 'E', p: 0.5, w: 20 / (N * 0.5), wJitter: 0.3, delay: [1, 3] });
    net.connect({ pre: hold, post: this.striatum[1], channel: 'I', p: 0.5, w: K_HOLD / (16 * 0.5), wJitter: 0.3, delay: [1, 3] });
    // innate: hunger makes restless
    this.outputs.push(net.connect({ pre: hunger, post: this.striatum[0], channel: 'E', p: 0.5, w: K_HUNGER / (hunger.n * 0.5), wJitter: 0.3, delay: [2, 5] }));
  }

  step(asleep: boolean): void {
    const net = this.net;
    const iext = net.iext;
    const smell = [this.smellFront, this.smellBack];
    // a hungry nose is a keen nose: when the creature is full, food smells of little
    const keen = 0.15 + 0.85 * Math.min(1, this.hunger / 0.15);
    for (let k = 0; k < 2; k++) {
      const cur = smell[k] > 0.02 && !asleep ? currentForRate(100 * keen * Math.min(1, smell[k])) : -2;
      const p = this.smell[k];
      for (let i = p.start; i < p.end; i++) iext[i] = cur;
    }
    // trial actions, only when there is something to decide about
    const something = smell[0] > 0.02 || smell[1] > 0.02;
    const kk = 1 / EX_TAU;
    // the more clearly it has learned which smell calls for an action, the less it tries things out
    if ((net.t & 255) === 0) {
      const w = this.weights();
      this.decided[0] = Math.min(1, Math.abs(w[0] - w[1]) / 0.8);
      this.decided[1] = Math.min(1, Math.abs(w[3] - w[2]) / 0.8);
    }
    for (let a = 0; a < 2; a++) {
      this.x[a] += -this.x[a] * kk + Math.sqrt(2 * kk) * gaussian(net.rng);
      let rate = 30 * (1 + (something ? this.exploreGain * (1 - 0.85 * this.decided[a]) * this.x[a] : 0));
      if (rate < 0) rate = 0;
      else if (rate > 90) rate = 90;
      const cur = currentForRate(rate);
      const ex = this.explorer[a];
      for (let i = ex.start; i < ex.end; i++) iext[i] = cur;
      // the command cells are silent unless the thalamus drives them
      const cmd = this.command[a];
      for (let i = cmd.start; i < cmd.end; i++) iext[i] = -2;
    }
    this.proj[0].mod = this.proj[1].mod = asleep ? 0 : this.goTeach;
    this.proj[2].mod = this.proj[3].mod = asleep ? 0 : this.turnTeach;
    // read the commands
    const goRate = this.command[0].rate;
    if (goRate > GO_ON) {
      this.go = true;
      this.belowSince = net.t;
    } else if (goRate > GO_OFF) this.belowSince = net.t;
    else if (net.t - this.belowSince > 1500) this.go = false;
    const turning = this.command[1].rate > TURN_ON;
    this.turn = turning && !this.turnWas;
    this.turnWas = turning || (this.turnWas && this.command[1].rate > TURN_ON * 0.5);
    if (asleep || !this.enabled) {
      this.go = false;
      this.turn = false;
    }
  }

  /** learned strength of the four smell synapses (1 = fully committed) */
  weights(): number[] {
    return this.proj.map((p) => p.meanWeight() / (K_SMELL / (N * 0.5)));
  }

  /** lesion: the loops no longer reach their commands */
  setEnabled(on: boolean): void {
    this.enabled = on;
    for (const pr of this.outputs) pr.gain = on ? 1 : 0;
  }
}
