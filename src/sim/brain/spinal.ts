// The spinal cord: innate reflex wiring made of spiking neurons.
//
// Sensory afferents (muscle spindles, Golgi tendon organs, sole pressure, the balance organ)
// feed pathway interneurons, which excite or inhibit the motoneuron pools of the 14 muscles.
// Which pathways are open depends on the phase of the step (stance / swing, signalled by the
// load on the foot) and on the locomotor command from the brainstem ("go" vs. "stand").
// The wiring diagram follows the reflex model of Geyer & Herr (2010); the strength of each
// pathway is a synaptic weight.
import { Network, NT, Pop, Proj, type Plasticity } from './network';
import { Biped, NM, M, MUSCLE_NAMES, MUSCLE_PARAMS, type MuscleName } from '../body/biped';
import { REFLEX_PARAM_NAMES } from '../control/reflex';
import { mulberry32, gaussian } from '../util/rng';

const DEG = Math.PI / 180;
/** afferent firing rate at signal = 1 [Hz] */
const R_AFF = 100;
/** motoneuron pool rate that corresponds to full muscle stimulation [Hz] */
const R_MN = 100;
const SLOPE = 9.5; // Hz per unit current (relay cells)
/** n·p·w needed for a pool of relay cells to follow its excitatory input 1:1 */
const K_UNITY = 20;
const K_UNITY_FS = 20;
const K_INH_UNITY = 6.3; // inhibitory n·p·w that removes 1 Hz of motoneuron rate per Hz
const K_GATE = 40;
/** connection probability between pools; sparse so that neurons do not all see the same input */
const P_CONN = 0.5;
const AFF_BIAS = 2.0;

// transduction curve of the relay cells (measured): input current needed for a given firing rate
const FI_RATE = [0, 8, 22, 36, 46, 63, 79, 124, 170];
const FI_CUR = [2.3, 3, 4, 5, 6, 8, 10, 15, 20];
/** external current that makes a relay cell with bias AFF_BIAS fire at `rate` Hz */
export function currentForRate(rate: number): number {
  if (rate <= 0) return -2;
  let k = 1;
  while (k < FI_RATE.length - 1 && FI_RATE[k] < rate) k++;
  const t = (rate - FI_RATE[k - 1]) / (FI_RATE[k] - FI_RATE[k - 1]);
  return FI_CUR[k - 1] + t * (FI_CUR[k] - FI_CUR[k - 1]) - AFF_BIAS;
}
// exploration nucleus
const N_EX = 8;
const EX_RATE = 30; // mean firing rate [Hz]
const EX_TAU = 300; // correlation time of the random variation [ms]
const EX_W = 0.05;
/** firing rate of a tone nucleus that corresponds to the mature reflex strength [Hz] */
const TONE_RATE = 50;
/** n·p·w from the context pool onto a mature tone nucleus (context fires at about 63 Hz) */
const TONE_K = 0.78;
const TONE_EX_W = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TONE_EX_W ?? 0.07);
// A variation of the tone is tried out for about as long as a walking attempt lasts, and the
// synapses remember it for equally long, so that the outcome of the attempt can be credited to it.
const TONE_EX_TAU = 4000; // ms
/** the modulator released by a tone nucleus acts with a time constant of 300 ms */
const TONE_SMOOTH = 1 / 300;
const TONE_TAU_E = 3000; // ms
/** individual reflex pathways learn much more slowly than the tone nuclei */
const FINE_LR = 0.1;
const GOSLOW_W = 0.1;
/** smoothing of the motoneuron pool rate before it reaches the muscle [ms] */
const STIM_TAU = 5;
/** extra stimulation of the swing-leg muscles at full high-step command */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const HIGH_STEP = { hfl: Number(env.HS_HFL ?? 0), ta: Number(env.HS_TA ?? 0.4), ham: Number(env.HS_HAM ?? 0), swing: Number(env.HS_SWING ?? 0.5) };
/** depth (in units of input current) by which unloaded legs are cut off from the trunk balance reflex */
const LOAD_GATE = 6;
const VEST_TAU = 6;

export type Phase = 'stance' | 'swing' | 'any';
export type Mode = 'walk' | 'stand';

interface PathDef {
  name: string;
  aff: string;
  /** afferent is shared by both legs (vestibular) */
  global?: boolean;
  muscle: MuscleName;
  sign: 1 | -1;
  /** stimulation per unit of afferent signal */
  gain: number;
  phase: Phase;
  mode: Mode;
  delay: 'S' | 'M' | 'L';
  /** the pathway only passes signals in proportion to the weight the leg carries */
  loadGated?: boolean;
  /** index of the brainstem tone nucleus that scales this pathway */
  group: number;
}

/** Brainstem nuclei that set the overall strength of whole groups of reflexes (descending tone).
 *  Their drive is learned; a newborn starts with weak tone. */
export const TONE_GROUPS = [
  { key: 'extensor', label: 'Streck-Tonus', text: 'trägt das Körpergewicht in der Standphase' },
  { key: 'trunk', label: 'Rumpf-Balance', text: 'hält den Oberkörper aufrecht' },
  { key: 'swing', label: 'Schwung', text: 'führt das Bein nach vorn' },
  { key: 'ankle', label: 'Fußheber', text: 'hebt die Fußspitze und bremst die Wade' },
  { key: 'posture', label: 'Haltung', text: 'Gleichgewicht im ruhigen Stand' },
] as const;
const GROUP_OF: Record<string, number> = {
  wSolF: 0, wGasF: 0, wVasF: 0, wKneeVas: 0,
  wVestHam: 1, wVestGlu: 1, wVestHfl: 1,
  wHamF: 2, wGluF: 2, wHflL: 2, wHamHfl: 2, wLeanHfl: 2,
  wTaL: 3, wSolTa: 3,
};

export interface SpinalOptions {
  /** multiplies all pool sizes */
  scale?: number;
  /** per-pathway multipliers on the innate gains (same order as SpinalCord.pathNames) */
  mult?: ArrayLike<number>;
  /** make the afferent → interneuron synapses plastic and add the exploration nucleus */
  learn?: { lr: number; tauE: number; exploreW?: number };
  /** descending tone of a newborn relative to the mature value (1 = mature) */
  newbornTone?: number;
  /** spread (std of log strength) of random deviations from the innate blueprint: an untrained newborn */
  newborn?: number;
}

function paramsByName(p: ArrayLike<number>): Record<string, number> {
  const o: Record<string, number> = {};
  REFLEX_PARAM_NAMES.forEach((n, i) => (o[n] = p[i]));
  return o;
}

// afferent signals are divided by these so that they span roughly 0..1
const SC = { len: 0.4, knee: 10 * DEG, vest: 0.25, cop: 0.5, vel: 1.5 };

export function pathDefs(g: Record<string, number>): PathDef[] {
  const w = (name: string, aff: string, muscle: MuscleName, sign: 1 | -1, gain: number, phase: Phase, delay: 'S' | 'M' | 'L', global = false): PathDef => ({
    name, aff, muscle, sign, gain, phase, mode: 'walk', delay, global, group: GROUP_OF[name],
  });
  const s = (name: string, aff: string, muscle: MuscleName, gain: number, delay: 'S' | 'M' | 'L', global = false): PathDef => ({
    name, aff, muscle, sign: 1, gain, phase: 'any', mode: 'stand', delay, global, group: 4,
  });
  const pdW = g.kp * SC.vest * g.kbw * 0.6;
  return [
    // ---- walking, stance phase ----
    w('wSolF', 'IbSOL', 'SOL', 1, g.gSol, 'stance', 'L'),
    w('wSolTa', 'IbSOL', 'TA', -1, g.gSolTa, 'stance', 'L'),
    w('wGasF', 'IbGAS', 'GAS', 1, g.gGas, 'stance', 'L'),
    w('wVasF', 'IbVAS', 'VAS', 1, g.gVas, 'stance', 'M'),
    w('wKneeVas', 'KneeExt', 'VAS', -1, g.kPhi * SC.knee, 'stance', 'M'),
    { ...w('wVestHam', 'VestF', 'HAM', 1, pdW, 'stance', 'S', true), loadGated: true },
    { ...w('wVestGlu', 'VestF', 'GLU', 1, pdW * g.gluFactor, 'stance', 'S', true), loadGated: true },
    { ...w('wVestHfl', 'VestB', 'HFL', 1, pdW, 'stance', 'S', true), loadGated: true },
    // ---- walking, both phases ----
    w('wTaL', 'IITA', 'TA', 1, g.gTa * SC.len, 'any', 'L'),
    // ---- walking, swing phase ----
    w('wHamF', 'IbHAM', 'HAM', 1, g.gHam, 'swing', 'S'),
    w('wGluF', 'IbGLU', 'GLU', 1, g.gGlu, 'swing', 'S'),
    w('wHflL', 'IIHFL', 'HFL', 1, g.gHfl * SC.len, 'swing', 'S'),
    w('wHamHfl', 'IIHAM', 'HFL', -1, g.gHamHfl * SC.len, 'swing', 'S'),
    w('wLeanHfl', 'VestF', 'HFL', 1, g.kLean * SC.vest, 'swing', 'S', true),
    // ---- standing ----
    s('sSolL', 'IISOL', 'SOL', g.stSolL * SC.len, 'L'),
    // pressure under the forefoot (CopF) or heel (CopB); the sign of the evolved gain decides which one is used
    s('sSolCop', g.stSolCop >= 0 ? 'CopF' : 'CopB', 'SOL', Math.abs(g.stSolCop) * SC.cop, 'L'),
    s('sGasCop', g.stSolCop >= 0 ? 'CopF' : 'CopB', 'GAS', 0.5 * Math.abs(g.stSolCop) * SC.cop, 'L'),
    s('sTaL', 'IITAst', 'TA', g.stTaL * SC.len, 'L'),
    s('sTaCop', g.stTaCop >= 0 ? 'CopB' : 'CopF', 'TA', Math.abs(g.stTaCop) * SC.cop, 'L'),
    s('sVasL', 'IIVAS', 'VAS', g.stVasL * SC.len, 'M'),
    s('sSolV', 'IaSOL', 'SOL', g.stSolV * SC.vel, 'L'),
    s('sTaV', 'IaTA', 'TA', g.stTaV * SC.vel, 'L'),
    s('sVasV', 'IaVAS', 'VAS', g.stVasV * SC.vel, 'M'),
    s('sVestHam', 'VestF', 'HAM', g.stKp * SC.vest, 'S', true),
    s('sVestGlu', 'VestF', 'GLU', 0.7 * g.stKp * SC.vest, 'S', true),
    s('sVestHfl', 'VestB', 'HFL', g.stKp * SC.vest, 'S', true),
  ];
}

/** tonic drives and the swing-initiation circuit also have tunable strengths */
export const EXTRA_NAMES = ['tVasStance', 'tHipStance', 'trVas', 'trGlu', 'trHfl', 'tVasStand', 'tSolStand', 'tHipStand', 'iTa', 'iSol', 'iHfl'] as const;

const DELAYS: Record<'S' | 'M' | 'L', [number, number]> = { S: [1, 1], M: [3, 2], L: [6, 4] };

export class SpinalCord {
  readonly net: Network;
  readonly biped: Biped;
  readonly g: Record<string, number>;
  readonly defs: PathDef[];
  readonly pathNames: string[];
  /** afferent pools by name ("IbSOL_0", "VestF") with their current signal value */
  private readonly aff = new Map<string, { pop: Pop; value: number }>();
  readonly mn: Pop[] = [];
  /** plastic afferent → interneuron projections, [leg][pathway] */
  readonly pathProj: Proj[][] = [[], []];
  readonly pathIn: Pop[][] = [[], []];
  readonly mlr: Pop;
  readonly explorers: { pop: Pop; x: number }[] = [];
  /** tone nuclei: learned drive -> firing rate -> gain of a reflex group */
  readonly tone: { pop: Pop; proj: Proj; ex: Pop; x: number; gain: number; targets: Proj[] }[] = [];
  private toneCtx!: Pop;
  /** locomotor command 0 (stand) .. 1 (walk), set by the brain */
  go = 0;
  /** "lift the feet higher" command 0..1, set by the brain */
  highStep = 0;
  readonly stepCmd: Pop;
  stepLevel = 0;
  private goLevel = 0;
  private dthetaF = 0;
  private readonly stimTrace = new Float32Array(2 * NM);
  readonly nA: number;
  readonly nI: number;
  readonly nM: number;

  constructor(net: Network, biped: Biped, reflexParams: ArrayLike<number>, opt: SpinalOptions = {}) {
    this.net = net;
    this.biped = biped;
    const g = (this.g = paramsByName(reflexParams));
    const k = opt.scale ?? 1;
    const nA = (this.nA = Math.round(32 * k));
    const nI = (this.nI = Math.round(32 * k));
    const nM = (this.nM = Math.round(64 * k));
    const defs = (this.defs = pathDefs(g));
    this.pathNames = [...defs.map((d) => d.name), ...EXTRA_NAMES];
    const mult = (name: string): number => opt.mult?.[this.pathNames.indexOf(name)] ?? 1;

    const exc = (name: string, n: number, bias = 1.0): Pop => net.addPop({ name, n, type: NT.RELAY, region: 'spinal', bias, biasJitter: 1.5, noise: 2.5 });
    const inh = (name: string, n: number, bias = 0.5): Pop => net.addPop({ name, n, type: NT.FS, region: 'spinal', bias, biasJitter: 1.5, noise: 2.5, inhibitory: true });
    const affPop = (name: string): Pop => {
      const pop = net.addPop({ name, n: nA, type: NT.RELAY, region: 'afferent', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
      this.aff.set(name, { pop, value: 0 });
      return pop;
    };
    const E = (pre: Pop, post: Pop, K: number, delay: number, learnable = false): Proj => {
      const w = K / (pre.n * P_CONN);
      const plastic: Plasticity | undefined =
        learnable && opt.learn ? { rule: 'perturb', lr: opt.learn.lr * FINE_LR * w, tauE: opt.learn.tauE, wMin: 0, wMax: 4 * w } : undefined;
      return net.connect({ pre, post, channel: 'E', p: P_CONN, w, wJitter: 0.5, delay: [delay, delay + 2], plastic });
    };
    const nb = opt.newborn ?? 0;
    const nbRng = mulberry32(977);
    const nbFactor = (): number => (nb > 0 ? Math.exp(nb * gaussian(nbRng)) : 1);
    const I = (pre: Pop, post: Pop, K: number, delay: number): Proj =>
      net.connect({ pre, post, channel: 'I', p: P_CONN, w: K / (pre.n * P_CONN), wJitter: 0.5, delay: [delay, delay + 2] });

    // ---- brainstem: locomotor command and the mode gates ----
    this.mlr = net.addPop({ name: 'MLR', n: nI, type: NT.RELAY, region: 'brainstem', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
    const goI = inh('GOi', nI, -1.5);
    const restI = inh('RESTi', nI, 8);
    const post = exc('POST', nI, 8);
    E(this.mlr, goI, K_UNITY_FS * 1.5, 1);
    I(goI, restI, K_GATE, 1);
    I(goI, post, K_GATE, 1);

    // ---- tone nuclei: a tonically active context pool drives one nucleus per reflex group
    // through plastic synapses; the nucleus' firing rate sets the gain of its reflexes ----
    this.toneCtx = exc('TONctx', nI, 8);
    for (const grp of TONE_GROUPS) {
      const pop = net.addPop({ name: `TONE_${grp.key}`, n: nI, type: NT.RELAY, region: 'brainstem', bias: 1.0, biasJitter: 1.5, noise: 2.5 });
      const w = (K_UNITY * TONE_K * (opt.newbornTone ?? 1)) / (this.toneCtx.n * P_CONN);
      const wMature = (K_UNITY * TONE_K) / (this.toneCtx.n * P_CONN);
      const proj = net.connect({
        pre: this.toneCtx, post: pop, channel: 'E', p: P_CONN, w, wJitter: 0.3, delay: [1, 3],
        plastic: opt.learn ? { rule: 'perturb', lr: opt.learn.lr * wMature, tauE: TONE_TAU_E, wMin: 0, wMax: 2.5 * wMature } : undefined,
      });
      const ex = net.addPop({ name: `EXT_${grp.key}`, n: N_EX, type: NT.RELAY, region: 'explore', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
      if (opt.learn) net.connect({ pre: ex, post: pop, channel: 'X', p: 1, w: TONE_EX_W, wJitter: 0.2, delay: [1, 3] });
      this.tone.push({ pop, proj, ex, x: 0, gain: 1, targets: [] });
    }

    // ---- gait initiation: a burst at the onset of the walk command. The slowly charging
    // inhibitory pool GOslow ends it after a few hundred milliseconds. ----
    const goSlow = inh('GOslow', nI, -1.0);
    net.connect({ pre: this.mlr, post: goSlow, channel: 'S', p: P_CONN, w: GOSLOW_W, wJitter: 0.5, delay: [1, 3] });
    const init = exc('INIT', nI);
    const initI = inh('INITi', nI, -1.0);
    E(this.mlr, init, K_UNITY, 1);
    I(goSlow, init, 34, 1);
    E(init, initI, K_UNITY_FS, 1);

    // ---- vestibular afferents are shared by both legs ----
    affPop('VestF');
    affPop('VestB');

    const st: Pop[] = [];
    const nbFactors: number[] = [];
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      for (const a of ['IbSOL', 'IbGAS', 'IbVAS', 'IbHAM', 'IbGLU', 'IITA', 'IITAst', 'IIHFL', 'IIHAM', 'IISOL', 'IIVAS', 'IaSOL', 'IaTA', 'IaVAS', 'KneeExt', 'Load', 'LoadG', 'CopF', 'CopB', 'HipExt']) affPop(a + L);
      for (let m = 0; m < NM; m++) {
        this.mn.push(net.addPop({ name: `MN_${MUSCLE_NAMES[m]}${L}`, n: nM, type: NT.RELAY, region: 'motor', bias: 1.0, biasJitter: 1.5, noise: 2.5 }));
      }
      // phase of the step, from the load on the sole
      const load = this.aff.get('Load' + L)!.pop;
      const stE = exc('ST' + L, nI);
      const stI = inh('STi' + L, nI, -1.5);
      const swI = inh('SWi' + L, nI, 8);
      E(load, stE, K_UNITY, 2);
      E(load, stI, K_UNITY_FS * 2, 2);
      I(stI, swI, K_GATE, 1);
      st.push(stE);

      const mnOf = (m: MuscleName): Pop => this.mn[leg * NM + M[m]];
      for (const d of defs) {
        const aff = this.aff.get(d.global ? d.aff : d.aff + L)!.pop;
        const [dA, dM] = DELAYS[d.delay];
        // both legs of a newborn deviate from the blueprint in the same way
        if (leg === 0) nbFactors.push(nbFactor());
        const gain = d.gain * mult(d.name) * nbFactors[this.pathIn[leg].length];
        let inPop: Pop;
        let proj: Proj;
        if (d.sign > 0) {
          // load-gated pathways sit far below threshold; the graded load signal lifts them up to it
          inPop = exc(`IN_${d.name}${L}`, nI, d.loadGated ? 1.0 - LOAD_GATE : 1.0);
          if (d.loadGated) E(this.aff.get('LoadG' + L)!.pop, inPop, LOAD_GATE / (0.0055 * R_AFF), 2);
          proj = E(aff, inPop, K_UNITY * gain, dA, true);
          E(inPop, mnOf(d.muscle), K_UNITY, dM);
        } else {
          inPop = inh(`IN_${d.name}${L}`, nI);
          proj = E(aff, inPop, K_UNITY_FS * gain, dA, true);
          I(inPop, mnOf(d.muscle), K_INH_UNITY, dM);
        }
        if (d.phase === 'stance') I(swI, inPop, K_GATE, 1);
        if (d.phase === 'swing') I(stI, inPop, K_GATE, 1);
        I(d.mode === 'walk' ? restI : goI, inPop, K_GATE, 1);
        this.pathIn[leg].push(inPop);
        this.pathProj[leg].push(proj);
        this.tone[d.group].targets.push(proj);
        if (opt.learn) {
          // exploration: a small group of cells that randomly nudges this pathway up and down,
          // in both legs alike
          const k = this.pathIn[leg].length - 1;
          if (leg === 0) {
            const ex = net.addPop({ name: `EX_${d.name}`, n: N_EX, type: NT.RELAY, region: 'explore', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
            this.explorers.push({ pop: ex, x: 0 });
          }
          net.connect({ pre: this.explorers[k].pop, post: inPop, channel: 'X', p: 1, w: opt.learn.exploreW ?? EX_W, wJitter: 0.2, delay: [1, 3] });
        }
      }

      // tonic drive while the leg carries weight (walking)
      const tonW = exc('TONw' + L, nI);
      E(stE, tonW, K_UNITY, 1);
      I(restI, tonW, K_GATE, 1);
      const tonic = (pre: Pop, m: MuscleName, s0: number, preRate: number): void => {
        E(pre, mnOf(m), (s0 * R_MN) / (SLOPE * 0.0055 * preRate), 2);
      };
      tonic(tonW, 'VAS', g.s0Vas * mult('tVasStance'), 90);
      for (const m of ['HAM', 'GLU', 'HFL'] as const) tonic(tonW, m, g.s0Hip * mult('tHipStance'), 90);
      // postural tone (standing)
      tonic(post, 'VAS', g.stS0Vas * mult('tVasStand'), 60);
      tonic(post, 'SOL', g.stS0Sol * mult('tSolStand'), 60);
      for (const m of ['HAM', 'GLU', 'HFL'] as const) tonic(post, m, g.stS0Hip * mult('tHipStand'), 60);
    }

    // ---- gait initiation outputs: release the calf, pull with the shin, lift the rear leg ----
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      const mnOf = (m: MuscleName): Pop => this.mn[leg * NM + M[m]];
      E(init, mnOf('TA'), g.initTa * 1.25 * K_UNITY * mult('iTa'), 2);
      I(initI, mnOf('SOL'), g.initSolOff * 0.6 * K_INH_UNITY * mult('iSol'), 2);
      I(initI, mnOf('GAS'), g.initSolOff * 0.6 * K_INH_UNITY * mult('iSol'), 2);
      const lift = exc('INITtr' + L, nI, -12);
      const liftI = inh('INITtri' + L, nI, -1.0);
      E(init, lift, 33, 1);
      E(this.aff.get('HipExt' + L)!.pop, lift, 40, 2);
      E(lift, liftI, K_UNITY_FS, 1);
      E(lift, mnOf('HFL'), g.initHfl * 2 * K_UNITY * mult('iHfl'), 2);
      I(liftI, mnOf('VAS'), g.initSolOff * K_INH_UNITY, 2);
    }

    // ---- high step: a descending command that adds flexion to the swinging leg ----
    this.stepCmd = net.addPop({ name: 'STEP', n: nI, type: NT.RELAY, region: 'brainstem', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      const mnOf = (m: MuscleName): Pop => this.mn[leg * NM + M[m]];
      const hs = exc('HS' + L, nI);
      E(this.stepCmd, hs, K_UNITY, 1);
      // only while the leg is in the air
      I(net.pop('STi' + L), hs, K_GATE, 1);
      E(hs, mnOf('HFL'), HIGH_STEP.hfl * K_UNITY, 1);
      E(hs, mnOf('TA'), HIGH_STEP.ta * K_UNITY, 1);
      E(hs, mnOf('HAM'), HIGH_STEP.ham * K_UNITY, 1);
    }

    // ---- swing initiation: the trailing leg in double support is unloaded and flexed ----
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      const tr = exc('TR' + L, nI, -7);
      const trI = inh('TRi' + L, nI);
      E(st[1 - leg], tr, 15, 2);
      E(this.aff.get('HipExt' + L)!.pop, tr, 15, 2);
      I(restI, tr, K_GATE, 1);
      E(tr, trI, K_UNITY_FS, 1);
      const mnOf = (m: MuscleName): Pop => this.mn[leg * NM + M[m]];
      const trRate = 50;
      I(trI, mnOf('VAS'), ((g.kbwVas * 0.8 * R_MN) / trRate) * K_INH_UNITY * mult('trVas'), 2);
      I(trI, mnOf('GLU'), ((g.deltaS * R_MN) / trRate) * K_INH_UNITY * mult('trGlu'), 2);
      E(tr, mnOf('HFL'), ((g.deltaS * R_MN) / trRate) * K_UNITY * mult('trHfl'), 2);
    }
  }

  /** amplitude of the exploratory variation (neuromodulated) */
  exploreGain = 1;

  /** tone nuclei: explore, then translate their firing into the gain of their reflex groups */
  private stepTone(): void {
    // how strongly the high-step command is currently being given (from the command neurons)
    this.stepLevel += (Math.min(1, this.stepCmd.rate / R_AFF) - this.stepLevel) * 0.05;
    const iext = this.net.iext;
    const rng = this.net.rng;
    const k = 1 / TONE_EX_TAU;
    const sd = Math.sqrt(2 * k);
    for (const tn of this.tone) {
      tn.x += -tn.x * k + sd * gaussian(rng);
      let rate = EX_RATE * (1 + this.exploreGain * tn.x);
      if (rate < 0) rate = 0;
      else if (rate > 2.5 * EX_RATE) rate = 2.5 * EX_RATE;
      const cur = currentForRate(rate);
      for (let i = tn.ex.start; i < tn.ex.end; i++) iext[i] = cur;
      // the modulator released by the nucleus acts with a time constant of 50 ms
      const g = Math.min(2.2, tn.pop.rate / TONE_RATE);
      tn.gain += (g - tn.gain) * TONE_SMOOTH;
      // the high-step command invigorates the swing reflexes
      const boost = tn === this.tone[2] ? 1 + HIGH_STEP.swing * this.stepLevel : 1;
      for (const pr of tn.targets) pr.gain = tn.gain * boost;
    }
  }

  private stepExplorers(): void {
    const iext = this.net.iext;
    const rng = this.net.rng;
    const k = 1 / EX_TAU;
    const sd = Math.sqrt(2 * k);
    for (const ex of this.explorers) {
      ex.x += -ex.x * k + sd * gaussian(rng);
      let rate = EX_RATE * (1 + this.exploreGain * ex.x);
      if (rate < 0) rate = 0;
      else if (rate > 2.5 * EX_RATE) rate = 2.5 * EX_RATE;
      const cur = currentForRate(rate);
      for (let i = ex.pop.start; i < ex.pop.end; i++) iext[i] = cur;
    }
  }

  private set(name: string, value: number): void {
    this.aff.get(name)!.value = value < 0 ? 0 : value > 1.8 ? 1.8 : value;
  }

  /** translate the state of the body into afferent input currents */
  sense(): void {
    const b = this.biped;
    const g = this.g;
    // the locomotor command shifts the set point of the balance reflex forward
    this.goLevel += (Math.min(1, this.mlr.rate / 80) - this.goLevel) * 0.01;
    const ref = g.stTheta + (g.thetaRef - g.stTheta) * this.goLevel;
    const kdr = (g.kd / g.kp) * this.goLevel + (g.stKd / g.stKp) * (1 - this.goLevel);
    // the balance organ reports a smoothed turning rate; without this the reflex would amplify
    // the tremor that noisy motoneuron firing causes in the trunk
    this.dthetaF += (b.dtheta - this.dthetaF) * (1 / VEST_TAU);
    const e = b.theta - ref + kdr * this.dthetaF;
    this.set('VestF', e / SC.vest);
    this.set('VestB', -e / SC.vest);
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      const mu = (m: number): { f: number; l: number; v: number } => {
        const x = b.muscles[leg * NM + m];
        return { f: x.force / x.p.fmax, l: x.lce / x.p.lopt, v: x.vce / x.p.lopt };
      };
      this.set('IaSOL' + L, mu(M.SOL).v / SC.vel);
      this.set('IaTA' + L, mu(M.TA).v / SC.vel);
      this.set('IaVAS' + L, mu(M.VAS).v / SC.vel);
      this.set('IbSOL' + L, mu(M.SOL).f);
      this.set('IbGAS' + L, mu(M.GAS).f);
      this.set('IbVAS' + L, mu(M.VAS).f);
      this.set('IbHAM' + L, mu(M.HAM).f);
      this.set('IbGLU' + L, mu(M.GLU).f);
      this.set('IITA' + L, (mu(M.TA).l - g.lOffTa) / SC.len);
      this.set('IITAst' + L, (mu(M.TA).l - g.stTaOff) / SC.len);
      this.set('IIHFL' + L, (mu(M.HFL).l - g.lOffHfl) / SC.len);
      this.set('IIHAM' + L, (mu(M.HAM).l - g.lOffHam) / SC.len);
      this.set('IISOL' + L, (mu(M.SOL).l - g.stSolOff) / SC.len);
      this.set('IIVAS' + L, (mu(M.VAS).l - g.stVasOff) / SC.len);
      const phiK = b.phi[leg * 3 + 1];
      this.set('KneeExt' + L, b.dphi[leg * 3 + 1] > 0 ? (phiK - 170 * DEG) / SC.knee : 0);
      this.set('Load' + L, Math.min(1, b.legLoad(leg) / 0.2));
      this.set('LoadG' + L, Math.min(1, b.legLoad(leg) / 0.8));
      const cop = b.toeLoad[leg] - b.heelLoad[leg];
      this.set('CopF' + L, cop / SC.cop);
      this.set('CopB' + L, -cop / SC.cop);
      this.set('HipExt' + L, (b.phi[leg * 3] - 178 * DEG) / (20 * DEG));
    }
    const iext = this.net.iext;
    for (const a of this.aff.values()) {
      const cur = currentForRate(R_AFF * a.value);
      for (let i = a.pop.start; i < a.pop.end; i++) iext[i] = cur;
    }
    const cmd = currentForRate(R_AFF * this.go);
    for (let i = this.mlr.start; i < this.mlr.end; i++) iext[i] = cmd;
    const stepCur = currentForRate(R_AFF * this.highStep);
    for (let i = this.stepCmd.start; i < this.stepCmd.end; i++) iext[i] = stepCur;
    if (this.explorers.length > 0) this.stepExplorers();
    this.stepTone();
  }

  /** sleep paralysis: motoneurons no longer reach the muscles */
  atonia = false;

  /** motoneuron firing drives the muscles */
  act(): void {
    const b = this.biped;
    for (let i = 0; i < 2 * NM; i++) {
      const p = this.mn[i];
      const inst = (p.count * 1000) / (p.n * R_MN);
      this.stimTrace[i] += (inst - this.stimTrace[i]) * (1 / STIM_TAU);
      b.stim[i] = this.atonia ? 0.01 : this.stimTrace[i];
    }
  }

  reset(): void {
    this.stimTrace.fill(0);
    this.dthetaF = 0;
  }

  affValue(name: string): number {
    return this.aff.get(name)!.value;
  }
  affNames(): string[] {
    return [...this.aff.keys()];
  }
}

export { MUSCLE_PARAMS };
