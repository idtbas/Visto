// Reference controller: the purely reflex-driven walking model of Geyer & Herr (2010),
// written as plain equations (no neurons). It is a development tool: it proves that the
// body can walk and provides the blueprint for the innate spinal wiring of the creature.
import { Biped, NM, M, MUSCLE_PARAMS, MUSCLE_NAMES, type Pose } from '../body/biped';

const DEG = Math.PI / 180;

export const REFLEX_PARAM_NAMES = [
  'gSol', 'gTa', 'lOffTa', 'gSolTa', 'gGas', 'gVas', 'kPhi', 'kp', 'kd', 'thetaRef',
  'kbw', 'gluFactor', 'deltaS', 'kbwVas', 'gHam', 'gGlu', 'gHfl', 'lOffHfl', 'gHamHfl', 'lOffHam',
  'kLean', 's0Vas', 's0Hip',
  // initial conditions
  'vx0', 'lean0', 'hipStance0', 'hipSwing0', 'kneeStance0', 'kneeSwing0', 'ankleStance0', 'ankleSwing0',
  // standing reflexes
  'stKp', 'stKd', 'stTheta', 'stSolL', 'stSolOff', 'stSolCop', 'stTaL', 'stTaOff', 'stTaCop', 'stVasL', 'stVasOff', 'stS0Vas', 'stS0Sol', 'stS0Hip',
  // gait initiation: a transient at the onset of the walk command (anticipatory postural adjustment)
  'initTau', 'initTa', 'initHfl', 'initSolOff',
] as const;

export const REFLEX_DEFAULTS: number[] = [
  1.2, 1.1, 0.71, 0.3, 1.1, 1.15, 2.0, 1.91, 0.25, 0.105,
  1.2, 0.68, 0.25, 1.0, 0.65, 0.4, 0.35, 0.6, 4.0, 0.85,
  1.15, 0.09, 0.05,
  1.3, 0.1, 160, 190, 175, 170, 95, 100,
  2.0, 0.3, 0.03, 2.0, 0.9, 0.5, 2.0, 0.8, 0.5, 2.0, 0.9, 0.05, 0.05, 0.03,
  0.25, 0.4, 0.3, 1.0,
];

export const P_INIT0 = 45;

export const P_STAND0 = 31;

export const N_REFLEX_PARAMS = REFLEX_DEFAULTS.length;

const BUF = 32;

class Delay {
  private readonly buf = new Float32Array(BUF);
  private i = 0;
  push(v: number): void {
    this.i = (this.i + 1) % BUF;
    this.buf[this.i] = v;
  }
  get(delayMs: number): number {
    return this.buf[(this.i - delayMs + BUF) % BUF];
  }
  fill(v: number): void {
    this.buf.fill(v);
  }
}

// Reflex latencies [ms]. Longer than in the original model: they include the time the spiking
// implementation needs for synaptic transmission and integration in afferents, interneurons and
// motoneurons, so that gains tuned here remain stable when neurons take over.
const D_S = 20; // hip
const D_M = 25; // knee
const D_L = 30; // ankle

export function initialPose(p: ArrayLike<number>): Pose {
  return {
    x: 0,
    lean: p[24],
    hip: [p[26] * DEG, p[25] * DEG],
    knee: [p[28] * DEG, p[27] * DEG],
    ankle: [p[30] * DEG, p[29] * DEG],
    vx: p[23],
  };
}

export class ReflexController {
  private readonly fSol = [new Delay(), new Delay()];
  private readonly fGas = [new Delay(), new Delay()];
  private readonly fVas = [new Delay(), new Delay()];
  private readonly fHam = [new Delay(), new Delay()];
  private readonly fGlu = [new Delay(), new Delay()];
  private readonly lTa = [new Delay(), new Delay()];
  private readonly lHfl = [new Delay(), new Delay()];
  private readonly lHam = [new Delay(), new Delay()];
  private readonly lSol = [new Delay(), new Delay()];
  private readonly lVas = [new Delay(), new Delay()];
  private readonly cop = [new Delay(), new Delay()];
  private readonly phiK = [new Delay(), new Delay()];
  private readonly dphiK = [new Delay(), new Delay()];
  private readonly load = [new Delay(), new Delay()];
  private readonly theta = new Delay();
  private readonly dtheta = new Delay();
  readonly stance = [true, true];
  /** 'stand': postural reflexes; 'walk': locomotor reflexes */
  mode: 'stand' | 'walk' = 'walk';
  /** decaying transient that starts when the mode switches from stand to walk */
  private init = 0;
  private lastMode: 'stand' | 'walk' = 'walk';
  private readonly pto = [0, 0];

  constructor(readonly biped: Biped, readonly p: ArrayLike<number>) {
    this.reset();
  }

  reset(): void {
    const b = this.biped;
    for (let leg = 0; leg < 2; leg++) {
      this.lTa[leg].fill(b.muscles[leg * NM + M.TA].lce / MUSCLE_PARAMS.TA.lopt);
      this.lHfl[leg].fill(b.muscles[leg * NM + M.HFL].lce / MUSCLE_PARAMS.HFL.lopt);
      this.lHam[leg].fill(b.muscles[leg * NM + M.HAM].lce / MUSCLE_PARAMS.HAM.lopt);
      this.lSol[leg].fill(b.muscles[leg * NM + M.SOL].lce / MUSCLE_PARAMS.SOL.lopt);
      this.lVas[leg].fill(b.muscles[leg * NM + M.VAS].lce / MUSCLE_PARAMS.VAS.lopt);
      this.phiK[leg].fill(b.phi[leg * 3 + 1]);
      this.stance[leg] = true;
      this.pto[leg] = 0;
    }
    this.theta.fill(b.theta);
  }

  step(): void {
    const b = this.biped;
    const p = this.p;
    for (let leg = 0; leg < 2; leg++) {
      const o = leg * NM;
      const mu = b.muscles;
      this.fSol[leg].push(mu[o + M.SOL].force / MUSCLE_PARAMS.SOL.fmax);
      this.fGas[leg].push(mu[o + M.GAS].force / MUSCLE_PARAMS.GAS.fmax);
      this.fVas[leg].push(mu[o + M.VAS].force / MUSCLE_PARAMS.VAS.fmax);
      this.fHam[leg].push(mu[o + M.HAM].force / MUSCLE_PARAMS.HAM.fmax);
      this.fGlu[leg].push(mu[o + M.GLU].force / MUSCLE_PARAMS.GLU.fmax);
      this.lTa[leg].push(mu[o + M.TA].lce / MUSCLE_PARAMS.TA.lopt);
      this.lHfl[leg].push(mu[o + M.HFL].lce / MUSCLE_PARAMS.HFL.lopt);
      this.lHam[leg].push(mu[o + M.HAM].lce / MUSCLE_PARAMS.HAM.lopt);
      this.lSol[leg].push(mu[o + M.SOL].lce / MUSCLE_PARAMS.SOL.lopt);
      this.lVas[leg].push(mu[o + M.VAS].lce / MUSCLE_PARAMS.VAS.lopt);
      this.cop[leg].push(b.toeLoad[leg] - b.heelLoad[leg]);
      this.phiK[leg].push(b.phi[leg * 3 + 1]);
      this.dphiK[leg].push(b.dphi[leg * 3 + 1]);
      this.load[leg].push(b.legLoad(leg));
    }
    this.theta.push(b.theta);
    this.dtheta.push(b.dtheta);

    const [gSol, gTa, lOffTa, gSolTa, gGas, gVas, kPhi, kp, kd, thetaRef, kbw, gluFactor, deltaS, kbwVas, gHam, gGlu, gHfl, lOffHfl, gHamHfl, lOffHam, kLean, s0Vas, s0Hip] =
      p as unknown as number[];
    const S0 = 0.01;
    const th = this.theta.get(D_S);
    const dth = this.dtheta.get(D_S);
    const pd = kp * (th - thetaRef) + kd * dth;
    const ankleX = [b.foot[0].getPosition().x, b.foot[1].getPosition().x];

    if (this.mode === 'walk' && this.lastMode === 'stand') this.init = 1;
    this.lastMode = this.mode;
    if (this.mode === 'stand') {
      this.standStep(th, dth);
      return;
    }
    const q = P_INIT0;
    const init = this.init;
    this.init -= (this.init * 0.001) / Math.max(0.02, p[q]);
    const hipExt = [b.phi[0], b.phi[3]];
    for (let leg = 0; leg < 2; leg++) {
      const other = 1 - leg;
      const load = this.load[leg].get(D_M);
      const wasStance = this.stance[leg];
      const isStance = wasStance ? load > 0.02 : load > 0.08;
      if (wasStance && !isStance) this.pto[leg] = kLean * (th - thetaRef);
      this.stance[leg] = isStance;
      const s = b.stim;
      const o = leg * NM;
      const lTa = this.lTa[leg].get(D_L);
      if (isStance) {
        const fSol = this.fSol[leg].get(D_L);
        s[o + M.SOL] = S0 + gSol * fSol;
        s[o + M.TA] = S0 + Math.max(0, gTa * (lTa - lOffTa)) - gSolTa * fSol;
        s[o + M.GAS] = S0 + gGas * this.fGas[leg].get(D_L);
        const phiK = this.phiK[leg].get(D_M);
        const dphiK = this.dphiK[leg].get(D_M);
        let vas = s0Vas + gVas * this.fVas[leg].get(D_M);
        if (phiK > 170 * DEG && dphiK > 0) vas -= kPhi * (phiK - 170 * DEG);
        let ham = s0Hip + Math.max(0, pd) * kbw * load;
        let glu = s0Hip + gluFactor * Math.max(0, pd) * kbw * load;
        let hfl = s0Hip + Math.max(0, -pd) * kbw * load;
        const otherStance = this.stance[other];
        if (otherStance && ankleX[leg] < ankleX[other]) {
          // trailing leg in double support: prepare swing
          vas -= kbwVas * this.load[other].get(D_M);
          glu -= deltaS;
          hfl += deltaS;
        }
        s[o + M.VAS] = vas;
        s[o + M.HAM] = ham;
        s[o + M.GLU] = glu;
        s[o + M.HFL] = hfl;
      } else {
        s[o + M.SOL] = S0;
        s[o + M.GAS] = S0;
        s[o + M.VAS] = S0;
        s[o + M.TA] = S0 + Math.max(0, gTa * (lTa - lOffTa));
        s[o + M.HAM] = S0 + gHam * this.fHam[leg].get(D_S);
        s[o + M.GLU] = S0 + gGlu * this.fGlu[leg].get(D_S);
        s[o + M.HFL] =
          S0 +
          Math.max(0, gHfl * (this.lHfl[leg].get(D_S) - lOffHfl)) -
          Math.max(0, gHamHfl * (this.lHam[leg].get(D_S) - lOffHam)) +
          this.pto[leg];
      }
      for (let m = 0; m < NM; m++) {
        const v = s[o + m];
        s[o + m] = v < 0.01 ? 0.01 : v > 1 ? 1 : v;
      }
    }
  }
  /** postural reflexes: stretch reflexes at ankle and knee, pressure sense under the feet, vestibular trunk control */
  private standStep(th: number, dth: number): void {
    const b = this.biped;
    const q = P_STAND0;
    const p = this.p;
    const pd = p[q] * (th - p[q + 2]) + p[q + 1] * dth;
    const s = b.stim;
    for (let leg = 0; leg < 2; leg++) {
      const o = leg * NM;
      this.stance[leg] = this.load[leg].get(D_M) > 0.05;
      const cop = this.cop[leg].get(D_L);
      s[o + M.SOL] = p[q + 12] + Math.max(0, p[q + 3] * (this.lSol[leg].get(D_L) - p[q + 4])) + Math.max(0, p[q + 5] * cop);
      s[o + M.GAS] = 0.01 + 0.5 * Math.max(0, p[q + 5] * cop);
      s[o + M.TA] = 0.01 + Math.max(0, p[q + 6] * (this.lTa[leg].get(D_L) - p[q + 7])) + Math.max(0, -p[q + 8] * cop);
      s[o + M.VAS] = p[q + 11] + Math.max(0, p[q + 9] * (this.lVas[leg].get(D_M) - p[q + 10]));
      s[o + M.HAM] = p[q + 13] + Math.max(0, pd);
      s[o + M.GLU] = p[q + 13] + 0.7 * Math.max(0, pd);
      s[o + M.HFL] = p[q + 13] + Math.max(0, -pd);
      for (let m = 0; m < NM; m++) {
        const v = s[o + m];
        s[o + m] = v < 0.01 ? 0.01 : v > 1 ? 1 : v;
      }
    }
  }
}

export { MUSCLE_NAMES };
