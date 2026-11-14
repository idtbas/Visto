// A global neuronal workspace (after Baars; Dehaene & Changeux).
//
// The specialised regions of this brain work side by side and mostly do not know of each
// other. The workspace is a small set of cells with long-range connections where their
// results compete for a limited-capacity, brain-wide state:
//
//  - Every content (unexplained body sensation, pain, expected danger, something seen, a
//    bodily need) has its own pool of workspace cells, driven by the region that computes it.
//  - Only what is new gets in: every content has a gate that passes its input on, and a
//    sluggish inhibitory copy of the input that closes the gate again after about 150 ms if
//    the signal just stays the same (habituation).
//  - What keeps igniting loses access: every ignition makes the gate of that content a
//    little less excitable, and this wears off only over a minute or two. Something that
//    happens with every step stops reaching the workspace; something rare and strong still
//    does. (This also keeps a pain that repeats again and again in the same way from
//    occupying the workspace every time.)
//  - Each pool excites itself through slow recurrent synapses. A weak input dies away; an
//    input above a threshold makes the pool "ignite": its activity jumps up and holds itself
//    for a few hundred milliseconds, even if the input has already gone.
//  - Every pool has inhibitory cells that suppress all the other pools (competition,
//    limited capacity).
//  - Slow inhibition builds up behind every ignition and ends it. For a short while after
//    that, nothing new can ignite.
//  - An ignited content is broadcast: its cells project to the hormone system (arousal),
//    to a brainstem nucleus that braces the posture, and – in later steps – to memory and
//    the self-model. That is what "globally available" means here.
//  - How easily the workspace ignites depends on arousal (Vigilin up, Somnin down).
//
// Whether such a state has anything to do with experience is an open question. What can be
// checked is whether it behaves as the theory requires: non-linear ignition, self-sustained
// activity, competition, and effects of its removal. See tools/exp-workspace.ts.
import { Network, NT, Pop, Proj } from './network';

export interface WorkspaceSource {
  /** name of the content, as shown in the display */
  name: string;
  /** populations whose activity stands for this content */
  pops: Pop[];
  /** how strongly this content should brace the posture (0 = not at all) */
  brace: number;
}

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const N_W = 40;
const N_INH = 32;
/** bottom-up strength (n·p·w) from each source population */
const K_IN = Number(env.WS_KIN ?? 12);
/** slow self-excitation */
const K_REC = Number(env.WS_KREC ?? 7);
/** fast competition between contents */
const K_TO_INH = Number(env.WS_KTI ?? 10);
const K_INH = Number(env.WS_KI ?? 4);
/** slow inhibition that ends an ignition */
const K_TO_SLOW = Number(env.WS_KTS ?? 3.4);
const K_SLOW_INH = Number(env.WS_KSI ?? 20);
const K_BRACE = Number(env.WS_BRACE ?? 14);
/** resting input of the workspace cells: negative, so that silence is a stable state */
const W_BIAS = Number(env.WS_BIAS ?? -1.5);
/** sluggish copy of the input and how strongly it cancels the input */
const K_HAB_SLOW = Number(env.WS_KHS ?? 3.4);
/** inhibition of the gate by the sluggish copy: a little more than cancels an equal input */
const K_HAB = Number(env.WS_KHAB ?? 10);
/** how strongly an ignited content suppresses each of the others */
const K_RIVAL = Number(env.WS_KRIV ?? 10);
/** long-term habituation: loss of gate excitability per ignition, and its recovery time [ms] */
const HABIT_STEP = Number(env.WS_HSTEP ?? 0.8);
const HABIT_TAU = Number(env.WS_HTAU ?? 90000);
/** a content counts as ignited above this rate [Hz] */
export const IGNITED = 25;

export class Workspace {
  readonly names: string[];
  readonly pools: Pop[] = [];
  readonly fastInh: Pop;
  readonly slow: Pop;
  readonly slow2: Pop;
  readonly slowInh: Pop;
  /** brainstem nucleus through which an ignition braces the posture */
  readonly brace: Pop;
  /** which content is ignited right now (-1 = none) and since when */
  content = -1;
  /** number of ignitions of each content since birth */
  readonly ignitions: number[];
  /** an ignition started in this tick */
  justIgnited = false;
  /** broadcast strength 0..1: how strongly anything is globally available right now */
  broadcast = 0;
  enabled = true;
  /** input gates, one per content: they pass on what is new */
  readonly gates: Pop[] = [];
  private readonly rivals: Pop[] = [];
  private readonly inputs: Proj[] = [];
  private readonly outputs: Proj[] = [];
  private readonly was: boolean[];
  /** how much access each content has lost through repetition (0 = fresh) */
  readonly habit: Float32Array;

  constructor(readonly net: Network, sources: WorkspaceSource[], braceTargets: Pop[]) {
    this.names = sources.map((s) => s.name);
    this.ignitions = sources.map(() => 0);
    this.was = sources.map(() => false);
    this.habit = new Float32Array(sources.length);
    const pool = (name: string, n: number, type = NT.RELAY, inhibitory = false, bias = 0.5): Pop =>
      net.addPop({ name, n, type, region: 'workspace', bias, biasJitter: 0.8, noise: 2, inhibitory });
    const link = (pre: Pop, post: Pop, channel: 'E' | 'I' | 'S', k: number, p = 0.5): Proj =>
      net.connect({ pre, post, channel, p, w: k / (pre.n * p), wJitter: 0.3, delay: [2, 6] });
    for (const s of sources) this.pools.push(pool(`Arbeitsraum_${s.name}`, N_W, NT.RELAY, false, W_BIAS));
    this.fastInh = pool('Arbeitsraum_Hemmung', N_INH, NT.FS, true);
    this.slow = pool('Arbeitsraum_träge', N_INH);
    this.slow2 = pool('Arbeitsraum_träger', N_INH);
    this.slowInh = pool('Arbeitsraum_Ende', N_INH, NT.FS, true);
    this.brace = net.addPop({ name: 'Stützreaktion', n: 32, type: NT.RELAY, region: 'brainstem', bias: 0.5, biasJitter: 0.8, noise: 2 });
    sources.forEach((s, k) => {
      const w = this.pools[k];
      const gate = pool(`Tor_${s.name}`, 24, NT.RELAY, false, 1.0);
      const habE = pool(`gewohnt_${s.name}`, 16);
      const habI = pool(`gewohnt_i_${s.name}`, 16, NT.FS, true);
      for (const src of s.pops) {
        this.inputs.push(link(src, gate, 'E', 20));
        link(src, habE, 'S', K_HAB_SLOW);
      }
      link(habE, habI, 'E', 20);
      link(habI, gate, 'I', K_HAB);
      link(gate, w, 'E', K_IN);
      this.gates.push(gate);
      this.rivals.push(pool(`Arbeitsraum_i_${s.name}`, 16, NT.FS, true));
      link(w, w, 'S', K_REC, 0.4);
      link(w, this.fastInh, 'E', K_TO_INH);
      link(w, this.rivals[k], 'E', 20);
      link(w, this.slow, 'S', K_TO_SLOW);
      if (s.brace > 0) this.outputs.push(link(w, this.brace, 'E', K_BRACE * s.brace));
    });
    this.pools.forEach((w, k) => {
      link(this.fastInh, w, 'I', K_INH);
      link(this.slowInh, w, 'I', K_SLOW_INH);
      this.rivals.forEach((r, j) => j !== k && link(r, w, 'I', K_RIVAL));
    });
    // two sluggish stages in a row: the brake arrives late and then holds for a while
    link(this.slow, this.slow2, 'S', K_TO_SLOW);
    link(this.slow2, this.slowInh, 'E', 20);
    // bracing: a short push of extra descending tone onto the given brainstem nuclei
    for (const t of braceTargets) this.outputs.push(link(this.brace, t, 'E', Number(env.WS_BRACE_TONE ?? 6)));
  }

  /** @param arousal extra excitability from the hormone system (positive = alert, negative = drowsy) */
  step(arousal: number, asleep: boolean): void {
    // asleep nothing ignites: the workspace cells are held down
    const drive = asleep ? -8 : 1.2 * arousal;
    let best = -1;
    let bestRate = IGNITED;
    this.justIgnited = false;
    for (let k = 0; k < this.pools.length; k++) {
      const p = this.pools[k];
      p.drive = drive;
      const on = p.rate > IGNITED;
      if (on && !this.was[k]) {
        this.ignitions[k]++;
        this.justIgnited = true;
        this.habit[k] += HABIT_STEP;
      }
      this.habit[k] -= this.habit[k] / HABIT_TAU;
      this.gates[k].drive = -this.habit[k];
      // hysteresis: an ignition is over when the rate has fallen well below the threshold
      this.was[k] = on || (this.was[k] && p.rate > IGNITED * 0.5);
      if (p.rate > bestRate) {
        bestRate = p.rate;
        best = k;
      }
    }
    this.content = best;
    this.broadcast = best >= 0 ? Math.min(1, bestRate / 80) : 0;
  }

  /** lesion: the workspace neither receives nor sends (its cells stay, silent) */
  setEnabled(on: boolean): void {
    this.enabled = on;
    for (const pr of [...this.inputs, ...this.outputs]) pr.gain = on ? 1 : 0;
  }

  /** lesion of the broadcast only: contents still ignite but reach nothing */
  setBroadcast(on: boolean): void {
    for (const pr of this.outputs) pr.gain = on ? 1 : 0;
  }
}
