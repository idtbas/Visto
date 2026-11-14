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
}

export interface SpinalOptions {
  /** multiplies all pool sizes */
  scale?: number;
  /** per-pathway multipliers on the innate gains (same order as SpinalCord.pathNames) */
  mult?: ArrayLike<number>;
  /** make the afferent → interneuron synapses plastic */
  plastic?: Plasticity;
}

function paramsByName(p: ArrayLike<number>): Record<string, number> {
  const o: Record<string, number> = {};
  REFLEX_PARAM_NAMES.forEach((n, i) => (o[n] = p[i]));
  return o;
}

// afferent signals are divided by these so that they span roughly 0..1
const SC = { len: 0.4, knee: 10 * DEG, vest: 0.25, cop: 0.5 };

export function pathDefs(g: Record<string, number>): PathDef[] {
  const w = (name: string, aff: string, muscle: MuscleName, sign: 1 | -1, gain: number, phase: Phase, delay: 'S' | 'M' | 'L', global = false): PathDef => ({
    name, aff, muscle, sign, gain, phase, mode: 'walk', delay, global,
  });
  const s = (name: string, aff: string, muscle: MuscleName, gain: number, delay: 'S' | 'M' | 'L', global = false): PathDef => ({
    name, aff, muscle, sign: 1, gain, phase: 'any', mode: 'stand', delay, global,
  });
  const pdW = g.kp * SC.vest * g.kbw * 0.6;
  return [
    // ---- walking, stance phase ----
    w('wSolF', 'IbSOL', 'SOL', 1, g.gSol, 'stance', 'L'),
    w('wSolTa', 'IbSOL', 'TA', -1, g.gSolTa, 'stance', 'L'),
    w('wGasF', 'IbGAS', 'GAS', 1, g.gGas, 'stance', 'L'),
    w('wVasF', 'IbVAS', 'VAS', 1, g.gVas, 'stance', 'M'),
    w('wKneeVas', 'KneeExt', 'VAS', -1, g.kPhi * SC.knee, 'stance', 'M'),
    w('wVestHam', 'VestF', 'HAM', 1, pdW, 'stance', 'S', true),
    w('wVestGlu', 'VestF', 'GLU', 1, pdW * g.gluFactor, 'stance', 'S', true),
    w('wVestHfl', 'VestB', 'HFL', 1, pdW, 'stance', 'S', true),
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
    s('sSolCop', 'CopF', 'SOL', g.stSolCop * SC.cop, 'L'),
    s('sGasCop', 'CopF', 'GAS', 0.5 * g.stSolCop * SC.cop, 'L'),
    s('sTaL', 'IITAst', 'TA', g.stTaL * SC.len, 'L'),
    s('sTaCop', 'CopB', 'TA', g.stTaCop * SC.cop, 'L'),
    s('sVasL', 'IIVAS', 'VAS', g.stVasL * SC.len, 'M'),
    s('sVestHam', 'VestF', 'HAM', g.stKp * SC.vest, 'S', true),
    s('sVestGlu', 'VestF', 'GLU', 0.7 * g.stKp * SC.vest, 'S', true),
    s('sVestHfl', 'VestB', 'HFL', g.stKp * SC.vest, 'S', true),
  ];
}

/** tonic drives and the swing-initiation circuit also have tunable strengths */
export const EXTRA_NAMES = ['tVasStance', 'tHipStance', 'trVas', 'trGlu', 'trHfl', 'tVasStand', 'tSolStand', 'tHipStand'] as const;

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
  /** locomotor command 0 (stand) .. 1 (walk), set by the brain */
  go = 0;
  private goLevel = 0;
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

    const exc = (name: string, n: number, bias = 1.5): Pop => net.addPop({ name, n, type: NT.RELAY, region: 'spinal', bias, biasJitter: 1.5, noise: 2.5 });
    const inh = (name: string, n: number, bias = 0.5): Pop => net.addPop({ name, n, type: NT.FS, region: 'spinal', bias, biasJitter: 1.5, noise: 2.5, inhibitory: true });
    const affPop = (name: string): Pop => {
      const pop = net.addPop({ name, n: nA, type: NT.RELAY, region: 'afferent', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
      this.aff.set(name, { pop, value: 0 });
      return pop;
    };
    const E = (pre: Pop, post: Pop, K: number, delay: number, plastic?: Plasticity): Proj =>
      net.connect({ pre, post, channel: 'E', p: P_CONN, w: K / (pre.n * P_CONN), wJitter: 0.5, delay: [delay, delay + 2], plastic });
    const I = (pre: Pop, post: Pop, K: number, delay: number): Proj =>
      net.connect({ pre, post, channel: 'I', p: P_CONN, w: K / (pre.n * P_CONN), wJitter: 0.5, delay: [delay, delay + 2] });

    // ---- brainstem: locomotor command and the mode gates ----
    this.mlr = net.addPop({ name: 'MLR', n: nI, type: NT.RELAY, region: 'brainstem', bias: AFF_BIAS, biasJitter: 0.6, noise: 2 });
    const goI = inh('GOi', nI);
    const restI = inh('RESTi', nI, 8);
    const post = exc('POST', nI, 8);
    E(this.mlr, goI, K_UNITY_FS * 1.5, 1);
    I(goI, restI, K_GATE, 1);
    I(goI, post, K_GATE, 1);

    // ---- vestibular afferents are shared by both legs ----
    affPop('VestF');
    affPop('VestB');

    const st: Pop[] = [];
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      for (const a of ['IbSOL', 'IbGAS', 'IbVAS', 'IbHAM', 'IbGLU', 'IITA', 'IITAst', 'IIHFL', 'IIHAM', 'IISOL', 'IIVAS', 'KneeExt', 'Load', 'CopF', 'CopB', 'HipExt']) affPop(a + L);
      for (let m = 0; m < NM; m++) {
        this.mn.push(net.addPop({ name: `MN_${MUSCLE_NAMES[m]}${L}`, n: nM, type: NT.RELAY, region: 'motor', bias: 1.5, biasJitter: 1.5, noise: 2.5 }));
      }
      // phase of the step, from the load on the sole
      const load = this.aff.get('Load' + L)!.pop;
      const stE = exc('ST' + L, nI);
      const stI = inh('STi' + L, nI);
      const swI = inh('SWi' + L, nI, 8);
      E(load, stE, K_UNITY, 2);
      E(load, stI, K_UNITY_FS * 2, 2);
      I(stI, swI, K_GATE, 1);
      st.push(stE);

      const mnOf = (m: MuscleName): Pop => this.mn[leg * NM + M[m]];
      for (const d of defs) {
        const aff = this.aff.get(d.global ? d.aff : d.aff + L)!.pop;
        const [dA, dM] = DELAYS[d.delay];
        const gain = d.gain * mult(d.name);
        let inPop: Pop;
        let proj: Proj;
        if (d.sign > 0) {
          inPop = exc(`IN_${d.name}${L}`, nI);
          proj = E(aff, inPop, K_UNITY * gain, dA, opt.plastic);
          E(inPop, mnOf(d.muscle), K_UNITY, dM);
        } else {
          inPop = inh(`IN_${d.name}${L}`, nI);
          proj = E(aff, inPop, K_UNITY_FS * gain, dA, opt.plastic);
          I(inPop, mnOf(d.muscle), K_INH_UNITY, dM);
        }
        if (d.phase === 'stance') I(swI, inPop, K_GATE, 1);
        if (d.phase === 'swing') I(stI, inPop, K_GATE, 1);
        I(d.mode === 'walk' ? restI : goI, inPop, K_GATE, 1);
        this.pathIn[leg].push(inPop);
        this.pathProj[leg].push(proj);
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
    const e = b.theta - ref + kdr * b.dtheta;
    this.set('VestF', e / SC.vest);
    this.set('VestB', -e / SC.vest);
    for (let leg = 0; leg < 2; leg++) {
      const L = `_${leg}`;
      const mu = (m: number): { f: number; l: number } => {
        const x = b.muscles[leg * NM + m];
        return { f: x.force / x.p.fmax, l: x.lce / x.p.lopt };
      };
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
      const cop = b.toeLoad[leg] - b.heelLoad[leg];
      this.set('CopF' + L, cop / SC.cop);
      this.set('CopB' + L, -cop / SC.cop);
      this.set('HipExt' + L, (b.phi[leg * 3] - 178 * DEG) / (20 * DEG));
    }
    const iext = this.net.iext;
    const gainI = R_AFF / SLOPE;
    for (const a of this.aff.values()) {
      const cur = a.value > 0 ? 0.5 + gainI * a.value : 0;
      for (let i = a.pop.start; i < a.pop.end; i++) iext[i] = cur;
    }
    const cmd = this.go > 0 ? 0.5 + gainI * this.go : 0;
    for (let i = this.mlr.start; i < this.mlr.end; i++) iext[i] = cmd;
  }

  /** motoneuron firing drives the muscles */
  act(): void {
    const b = this.biped;
    for (let i = 0; i < 2 * NM; i++) {
      const p = this.mn[i];
      const inst = (p.count * 1000) / (p.n * R_MN);
      this.stimTrace[i] += (inst - this.stimTrace[i]) * (1 / 12);
      b.stim[i] = this.stimTrace[i];
    }
  }

  reset(): void {
    this.stimTrace.fill(0);
  }

  affValue(name: string): number {
    return this.aff.get(name)!.value;
  }
  affNames(): string[] {
    return [...this.aff.keys()];
  }
}

export { MUSCLE_PARAMS };
