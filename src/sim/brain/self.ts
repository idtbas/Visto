// A minimal self: five areas that together give the creature a running account of itself.
//
// None of this is a claim about experience. Each area does one thing that theories of the
// self name as an ingredient, as cells and synapses, and each can be cut off to see what is
// lost (see tools/exp-self.ts):
//
//  1. Insula – "how am I". Two groups of cells that oppose each other: one is driven by
//     hunger, tiredness, exhaustion, pain and expected danger ("unwell"), the other by a full
//     energy store and by dopamine ("well"). The unwell cells tire: a state that just stays
//     the same is reported less and less over some tens of seconds. This is a report, not a
//     punishment; it does not act on the dopamine cells.
//  2. A third basal-ganglia loop, "rest". Tiredness and exhaustion drive it, hunger and danger
//     hold it back, and it brakes the loop for "go". The creature lies down because its own
//     cells say so, and gets up again when hunger wins.
//  3. Agency (temporo-parietal). "I am moving": the command to walk and the felt motion
//     coincide. "I am being moved": motion is felt that no command of its own explains.
//  4. Self-monitoring (anterior cingulate). Confidence and doubt, opposing each other: doubt
//     grows when the body is not as predicted, when danger is expected, when something from
//     outside acts on it, and – learned – in situations in which prediction failed before.
//     Doubt braces the posture and makes it hesitate to set off.
//  5. A core (precuneus) where everything about the creature itself comes together: posture,
//     how it is, who is moving it, what it intends, what is in the workspace, how sure it is.
//     Each cell fires only for a combination of these. A cell that has fired stays
//     depolarised for a moment (a plateau potential) and tires as it goes on firing, so the
//     pattern outlasts its inputs by a few hundred milliseconds: one moment carries over
//     into the next.
//
// All areas are added after everything else, so that lives saved before them still fit.
import { Network, NT, Pop, Proj } from './network';
import { currentForRate } from './spinal';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const num = (key: string, d: number): number => Number(env[key] ?? d);

const N_AREA = 320;
const N_INH = 48;
const N_LOOP = 32;
/** cells of the core */
const N_CORE = num('SELF_CORE', 3072);
/** input strengths (n·p·w) */
const K_NEED = num('SELF_KNEED', 14);
const K_PAIN = num('SELF_KPAIN', 14);
const K_DANGER = num('SELF_KDANGER', 8);
const K_WELL = num('SELF_KWELL', 16);
const K_OPP = num('SELF_KOPP', 8);
/** the unwell cells tire: firing makes them less excitable, with this time constant [ms],
 *  by this much input current at a sustained full rate */
const ADAPT_TAU = num('SELF_ATAU', 15000);
const K_ADAPT = num('SELF_KADAPT', 12);
/** rest loop */
const K_TIRED = num('SELF_KTIRED', 26);
const K_AWAKE = num('SELF_KAWAKE', 14);
const K_UNWELL_REST = num('SELF_KUR', 8);
const K_BRAKE = num('SELF_KBRAKE', 16);
const REST_ON = 30;
const REST_OFF = 12;
/** agency */
const K_CMD = num('SELF_KCMD', 9);
const K_MOTION = num('SELF_KMOTION', 12);
const K_EXPLAIN = num('SELF_KEXPLAIN', 4);
/** monitoring */
const K_MISMATCH = num('SELF_KMIS', 30);
const K_DOUBT_OUT = num('SELF_KOUT', 5);
const K_HESITATE = num('SELF_KHES', 5);
const DOUBT_LR = num('SELF_LR', 1e-4);
/** core */
const W_CORE = num('SELF_W', 6);
const CORE_BIAS = num('SELF_BIAS', -6);
const W_CORE_INH = num('SELF_INH', 1.5);
/** Plateau of the core cells: after a spike a cell is depolarised by this much, fading with
 *  PLATEAU_TAU [ms]; every spike also tires it a little (FATIGUE per spike, recovering with
 *  FATIGUE_TAU [ms]), which ends the plateau. */
const PLATEAU = num('SELF_PA', 40);
const PLATEAU_TAU = num('SELF_PTAU', 150);
const FATIGUE = num('SELF_PF', 0.6);
const FATIGUE_TAU = num('SELF_FTAU', 2000);
const FULL = 80;

export interface SelfSources {
  /** hunger, tiredness, exhaustion */
  needs: Pop[];
  painRelay: Pop;
  dangerRising: Pop;
  danger: Pop;
  vta: Pop;
  /** locomotor command of the brainstem (a copy of "I am walking") */
  walkCommand: Pop;
  /** head accelerated forwards / backwards */
  otolith: Pop[];
  /** unexplained sensation, from the body model */
  external: Pop;
  /** cells that fire when more / less is felt than predicted */
  mismatch: Pop[];
  /** body-sense cortex */
  body: Pop[];
  /** striatum of the loop "go" and the commands "go" and "turn" */
  goStriatum: Pop;
  commands: Pop[];
  workspace: Pop[];
  /** brainstem nucleus that braces the posture */
  brace: Pop;
}

export class Self {
  // ---- insula ----
  readonly sated: Pop;
  readonly unwell: Pop;
  readonly well: Pop;
  /** how it is, -1 (unwell) .. +1 (well), from the two groups of cells */
  mood = 0;
  /** experiments can set the level of "sated" by hand (NaN = from the body) */
  satedOverride = NaN;
  // ---- rest ----
  readonly restStriatum: Pop;
  readonly restCommand: Pop;
  /** the creature wants to lie down */
  rest = false;
  // ---- agency ----
  readonly moving: Pop;
  readonly moved: Pop;
  /** "I am moving" and "I am being moved", 0..1 */
  agencySelf = 0;
  agencyOther = 0;
  // ---- monitoring ----
  readonly confidence: Pop;
  readonly doubt: Pop;
  /** 0 = in doubt, 1 = sure of itself */
  sureness = 0.5;
  /** learned synapses from the core onto the doubt cells */
  readonly learned: Proj;
  learning = true;
  // ---- core ----
  readonly core: Pop;
  readonly coreInh: Pop;
  /** share of the core's cells that fired in the last 100 ms */
  coreActive = 0;
  enabled = true;
  restEnabled = true;
  private readonly outputs: Proj[] = [];
  private readonly restOutputs: Proj[] = [];
  /** plateau and fatigue of every core cell */
  private readonly plateau: Float32Array;
  private readonly fatigue: Float32Array;
  private plateauOn = true;
  private readonly coreInputs: Proj[] = [];
  /** how much the unwell cells have tired, 0..1 */
  tired = 0;
  private belowSince = 0;
  private surpriseSlow = 0;
  private readonly seen: Uint8Array;
  private seenAt = 0;

  constructor(readonly net: Network, readonly src: SelfSources, learn: boolean) {
    const pool = (name: string, n: number, region: string, bias: number, inhibitory = false, type = inhibitory ? NT.FS : NT.RELAY): Pop =>
      net.addPop({ name, n, type, region, bias, biasJitter: 0.8, noise: 2, inhibitory });
    const link = (pre: Pop, post: Pop, channel: 'E' | 'I' | 'S', k: number, p = 0.5): Proj =>
      net.connect({ pre, post, channel, p, w: k / (pre.n * p), wJitter: 0.3, delay: [2, 6] });

    // ---------------- insula: how am I ----------------
    this.sated = net.addPop({ name: 'Intero_Satt', n: 16, type: NT.RELAY, region: 'intero', bias: 2.0, biasJitter: 0.5, noise: 1.5 });
    this.unwell = pool('Insel_Unwohl', N_AREA, 'insula', -1.5);
    this.well = pool('Insel_Wohl', N_AREA, 'insula', -1.5);
    const unwellI = pool('Insel_Unwohl_i', N_INH, 'insula', 0.5, true);
    const wellI = pool('Insel_Wohl_i', N_INH, 'insula', 0.5, true);
    for (const n of src.needs) link(n, this.unwell, 'E', K_NEED);
    link(src.painRelay, this.unwell, 'E', K_PAIN);
    link(src.dangerRising, this.unwell, 'E', K_DANGER);
    link(this.sated, this.well, 'E', K_WELL);
    link(src.vta, this.well, 'E', K_WELL);
    // the two oppose each other
    link(this.unwell, unwellI, 'E', 20);
    link(unwellI, this.well, 'I', K_OPP);
    link(this.well, wellI, 'E', 20);
    link(wellI, this.unwell, 'I', K_OPP);

    // ---------------- rest: a third basal-ganglia loop ----------------
    this.restStriatum = net.addPop({ name: 'STR_Ruhen', n: 2 * N_LOOP, type: NT.RELAY, region: 'drive', bias: 0.5, biasJitter: 1.5, noise: 2.5, inhibitory: true });
    const gp = pool('GPi_Ruhen', N_LOOP, 'drive', 8, true);
    const th = pool('THAL_Ruhen', N_LOOP, 'drive', 8);
    this.restCommand = pool('Befehl_Ruhen', N_LOOP, 'drive', 2.0);
    const awake = pool('Wach_halten', 16, 'drive', 0.5, true);
    const brake = pool('Los_bremsen', 16, 'drive', 0.5, true);
    this.restOutputs.push(link(src.needs[1], this.restStriatum, 'E', K_TIRED), link(src.needs[2], this.restStriatum, 'E', K_TIRED));
    // feeling bad for whatever reason also asks for a pause (after a run of painful falls, say)
    this.restOutputs.push(link(this.unwell, this.restStriatum, 'E', K_UNWELL_REST));
    // hunger and danger keep it on its feet
    link(src.needs[0], awake, 'E', 20);
    link(src.danger, awake, 'E', 12);
    link(awake, this.restStriatum, 'I', K_AWAKE);
    net.connect({ pre: this.restStriatum, post: gp, channel: 'I', p: 0.5, w: 30 / (2 * N_LOOP * 0.5), wJitter: 0.3, delay: [1, 3] });
    net.connect({ pre: gp, post: th, channel: 'I', p: 0.5, w: 40 / (N_LOOP * 0.5), wJitter: 0.3, delay: [1, 3] });
    this.restOutputs.push(net.connect({ pre: th, post: this.restCommand, channel: 'E', p: 0.5, w: 34 / (N_LOOP * 0.5), wJitter: 0.3, delay: [1, 3] }));
    // wanting to rest brakes wanting to go
    link(this.restCommand, brake, 'E', 20);
    this.restOutputs.push(link(brake, src.goStriatum, 'I', K_BRAKE));

    // ---------------- agency: who is moving me ----------------
    this.moving = pool('Ich_bewege_mich', 256, 'agency', -3);
    this.moved = pool('Ich_werde_bewegt', 256, 'agency', num('SELF_MBIAS', -1.5));
    const explained = pool('Eigenbewegung', 32, 'agency', 0.5, true);
    // "I am moving" needs both the command and the felt motion
    link(src.walkCommand, this.moving, 'E', K_CMD);
    for (const o of src.otolith) link(o, this.moving, 'E', K_MOTION / 2);
    // "I am being moved": felt motion, less what the command explains
    for (const o of src.otolith) link(o, this.moved, 'E', K_MOTION);
    link(src.external, this.moved, 'E', K_MOTION);
    link(src.walkCommand, explained, 'E', 20);
    link(explained, this.moved, 'I', K_EXPLAIN);

    // ---------------- monitoring: how sure am I of myself ----------------
    this.confidence = pool('Zuversicht', 256, 'monitor', num('SELF_CBIAS', 3));
    this.doubt = pool('Zweifel', 256, 'monitor', -1.5);
    const confI = pool('Zuversicht_i', N_INH, 'monitor', 0.5, true);
    const doubtI = pool('Zweifel_i', N_INH, 'monitor', 0.5, true);
    const hesitate = pool('Zögern', 16, 'monitor', 0.5, true);
    const cells = src.mismatch.reduce((s, p) => s + p.n, 0);
    for (const m of src.mismatch) link(m, this.doubt, 'E', (K_MISMATCH * m.n) / cells);
    link(src.danger, this.doubt, 'E', K_DANGER);
    link(this.moved, this.doubt, 'E', num('SELF_KMD', 16));
    link(src.vta, this.confidence, 'E', 6);
    link(this.moving, this.confidence, 'E', 4);
    link(this.doubt, doubtI, 'E', 20);
    link(doubtI, this.confidence, 'I', K_OPP);
    link(this.confidence, confI, 'E', 20);
    link(confI, this.doubt, 'I', 0.4 * K_OPP);
    // a doubt lingers for a moment
    link(this.doubt, this.doubt, 'S', 2, 0.2);
    // what doubt does: brace, and hesitate to set off
    this.outputs.push(link(this.doubt, src.brace, 'E', K_DOUBT_OUT));
    link(this.doubt, hesitate, 'E', 20);
    this.outputs.push(link(hesitate, src.goStriatum, 'I', K_HESITATE));

    // ---------------- the core: everything about itself in one place ----------------
    this.core = net.addPop({ name: 'Ich_Kern', n: N_CORE, type: NT.RS, region: 'selfcore', bias: CORE_BIAS, biasJitter: 1, noise: 1.5 });
    this.coreInh = net.addPop({ name: 'Ich_Kern_i', n: Math.max(16, Math.round(N_CORE / 16)), type: NT.FS, region: 'selfcore', bias: 0, biasJitter: 1, noise: 2, inhibitory: true });
    // every cell listens to a handful of fibres from each kind of source and fires only when
    // several of them are active together
    const wire = (sources: Pop[], perCell: number): void => {
      const fibres = sources.reduce((s, p) => s + p.n, 0);
      for (const s of sources) {
        const fan = Math.max(1, Math.min(N_CORE, Math.round((N_CORE * perCell) / fibres)));
        this.coreInputs.push(net.connect({ pre: s, post: this.core, channel: 'E', fanOut: fan, w: W_CORE, wJitter: 0.3, delay: [3, 9] }));
      }
    };
    wire(src.body, 3); // posture and touch
    wire([this.unwell, this.well, ...src.needs, this.sated], 2); // how it is
    wire([this.moving, this.moved], 1.5); // who is moving
    wire([...src.commands, this.restCommand, src.walkCommand], 2); // what it intends
    wire(src.workspace, 1.5); // what is globally available
    wire([this.confidence, this.doubt], 1.5); // how sure it is
    net.connect({ pre: this.core, post: this.coreInh, channel: 'E', fanOut: 2, w: 6, wJitter: 0.5, delay: [1, 3] });
    net.connect({ pre: this.coreInh, post: this.core, channel: 'I', fanOut: Math.min(N_CORE, 600), w: W_CORE_INH, wJitter: 0.5, delay: [1, 3] });
    // learned: in which situations did the body turn out not to be as predicted?
    this.learned = net.connect({
      name: 'Ich_Kern→Zweifel (gelernt)',
      pre: this.core, post: this.doubt, channel: 'E', p: 0.1, w: 0.002, wJitter: 0.5, delay: [2, 6],
      plastic: learn ? { rule: 'trace', lr: DOUBT_LR, tauE: 400, wMin: 0, wMax: 0.6 } : undefined,
    });
    this.outputs.push(this.learned);
    this.seen = new Uint8Array(N_CORE);
    this.plateau = new Float32Array(N_CORE);
    this.fatigue = new Float32Array(N_CORE);
  }

  /** @param energy store 0..1 */
  step(energy: number, asleep: boolean): void {
    const net = this.net;
    const iext = net.iext;
    // the sense of being full
    let sated = Math.min(1, Math.max(0, (energy - 0.75) / 0.2));
    if (!Number.isNaN(this.satedOverride)) sated = this.satedOverride;
    const cur = sated > 0.02 && !asleep ? currentForRate(100 * sated) : -4;
    for (let i = this.sated.start; i < this.sated.end; i++) iext[i] = cur;
    // the command cells are silent unless their thalamus drives them
    for (let i = this.restCommand.start; i < this.restCommand.end; i++) iext[i] = -2;

    // The unwell cells tire: a state that just stays bad is reported less and less. (A new
    // or stronger one still gets through; this is what keeps the report from turning into a
    // lasting bad state.)
    this.tired += (Math.min(1.2, this.unwell.rate / FULL) - this.tired) / ADAPT_TAU;
    this.unwell.drive = -K_ADAPT * this.tired;
    this.mood = Math.max(-1, Math.min(1, (this.well.rate - this.unwell.rate) / FULL));
    this.agencySelf = Math.min(1, this.moving.rate / FULL);
    this.agencyOther = Math.min(1, this.moved.rate / FULL);
    const c = this.confidence.rate;
    const d = this.doubt.rate;
    this.sureness = c + d > 1 ? c / (c + d) : 0.5;

    // the wish to rest, with a little hysteresis
    const r = this.restCommand.rate;
    if (r > REST_ON) {
      this.rest = true;
      this.belowSince = net.t;
    } else if (r > REST_OFF) this.belowSince = net.t;
    else if (net.t - this.belowSince > 1500) this.rest = false;
    if (asleep || !this.restEnabled) this.rest = false;

    // Teaching signal of the learned doubt: the moment the body turns out not to be as
    // predicted (unexplained sensation setting in), less the doubt that was there already.
    // Without such a moment an existing doubt slowly unlearns.
    const s = Math.min(1.5, this.src.external.rate / FULL);
    this.surpriseSlow += (s - this.surpriseSlow) / 150;
    const onset = s > this.surpriseSlow ? 2 * (s - this.surpriseSlow) : 0;
    const have = Math.min(1.5, d / FULL);
    this.learned.mod = asleep || !this.learning ? 0 : onset > have ? onset - have : s > 0.1 ? 0 : -0.25 * have;

    // how much of the core is in use: cells that fired within the last 100 ms
    const { spikes, nSpikes } = net;
    const a = this.core.start;
    const b = this.core.end;
    const pl = this.plateau;
    const fa = this.fatigue;
    for (let k = 0; k < nSpikes; k++) {
      const i = spikes[k];
      if (i >= a && i < b) {
        this.seen[i - a] = 1;
        pl[i - a] = 1;
        fa[i - a] += FATIGUE;
      }
    }
    // A cell of the core that has just fired stays depolarised for a moment (a plateau
    // potential) and goes on firing by itself; every spike tires it, which ends the plateau
    // after a few hundred milliseconds. This is a property of the cell, not a synapse. It is
    // what lets the pattern of one moment carry over into the next.
    const kp = Math.exp(-1 / PLATEAU_TAU);
    const kf = Math.exp(-1 / FATIGUE_TAU);
    const amp = this.plateauOn && !asleep ? PLATEAU : 0;
    for (let i = 0; i < pl.length; i++) {
      pl[i] *= kp;
      fa[i] *= kf;
      iext[a + i] = amp * pl[i] - fa[i];
    }
    if (net.t - this.seenAt >= 100) {
      let n = 0;
      for (let i = 0; i < this.seen.length; i++) n += this.seen[i];
      this.coreActive = n / this.seen.length;
      this.seen.fill(0);
      this.seenAt = net.t;
    }
  }

  /** lesion: doubt no longer acts on posture and setting off */
  setEnabled(on: boolean): void {
    this.enabled = on;
    for (const pr of this.outputs) pr.gain = on ? 1 : 0;
  }

  /** lesion: the loop "rest" no longer hears the needs and reaches nothing */
  setRest(on: boolean): void {
    this.restEnabled = on;
    for (const pr of this.restOutputs) pr.gain = on ? 1 : 0;
  }

  /** experiment: the core is cut off from everything it listens to */
  setCoreInput(on: boolean): void {
    for (const pr of this.coreInputs) pr.gain = on ? 1 : 0;
  }

  /** lesion: the cells of the core no longer hold a plateau */
  setRecurrent(on: boolean): void {
    this.plateauOn = on;
  }
}
