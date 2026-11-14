// Hill-type muscle-tendon unit (MTU).
//
// A contractile element (CE, the muscle fibres) sits in series with an elastic
// tendon (SE). The CE can only pull; how hard depends on its activation, its
// current length (force-length curve) and its velocity (force-velocity curve).
// Formulation follows Geyer, Seyfarth & Blickhan (2003) / Geyer & Herr (2010).

export interface MuscleParams {
  name: string;
  /** maximum isometric force [N] */
  fmax: number;
  /** optimum fibre length [m] */
  lopt: number;
  /** maximum contraction velocity [lopt/s] */
  vmax: number;
  /** tendon slack length [m] */
  lslack: number;
}

const W = 0.56; // width of the force-length bell
const C = Math.log(0.05);
const N_ECC = 1.5; // eccentric force enhancement
const K_CURV = 5; // curvature of the force-velocity relation
const EPS_REF = 0.04; // tendon strain at fmax
const TAU_ACT = 0.01; // excitation-contraction coupling [s]
const FV_KNEE = 1.4; // above this the f-v inverse is continued linearly
const SUBSTEPS = 4;

// slope of the inverse force-velocity curve at FV_KNEE (in units of vmax)
const _den = N_ECC - 1 + 7.56 * K_CURV * (N_ECC - FV_KNEE);
const V_KNEE = (FV_KNEE - 1) / _den;
const DV_KNEE = (_den + (FV_KNEE - 1) * 7.56 * K_CURV) / (_den * _den);

/** inverse force-velocity relation; returns CE velocity in units of vmax (negative = shortening) */
function fvInverse(fv: number): number {
  if (fv <= 0) return -1;
  if (fv <= 1) return (fv - 1) / (1 + K_CURV * fv);
  if (fv <= FV_KNEE) return (fv - 1) / (N_ECC - 1 + 7.56 * K_CURV * (N_ECC - fv));
  return V_KNEE + (fv - FV_KNEE) * DV_KNEE;
}

export class Muscle {
  readonly p: MuscleParams;
  /** neural stimulation 0..1 (input) */
  stim = 0.01;
  /** active state 0..1 */
  act = 0.01;
  /** fibre (CE) length [m] */
  lce: number;
  /** fibre velocity [m/s], positive = lengthening */
  vce = 0;
  /** tendon force [N] */
  force = 0;
  /** total muscle-tendon length [m] */
  lmtu: number;
  /** slow fatigue state 0 (fresh) .. 1 (exhausted) */
  fatigue = 0;
  /** metabolic power estimate [W] */
  power = 0;

  constructor(p: MuscleParams) {
    this.p = p;
    this.lce = p.lopt;
    this.lmtu = p.lopt + p.lslack;
  }

  reset(lmtu: number): void {
    this.stim = 0.01;
    this.act = 0.01;
    this.vce = 0;
    this.force = 0;
    this.fatigue = 0;
    this.power = 0;
    this.lmtu = lmtu;
    // start with a slack-free tendon
    this.lce = Math.min(Math.max(lmtu - this.p.lslack, 0.5 * this.p.lopt), 1.3 * this.p.lopt);
  }

  step(lmtu: number, stim: number, dt: number): void {
    const p = this.p;
    this.lmtu = lmtu;
    this.stim = stim < 0.01 ? 0.01 : stim > 1 ? 1 : stim;
    const h = dt / SUBSTEPS;
    const fmax = p.fmax * (1 - 0.5 * this.fatigue);
    const lmin = p.lopt * (1 - W);
    let lce = this.lce;
    let act = this.act;
    let fse = 0;
    let v = 0;
    for (let i = 0; i < SUBSTEPS; i++) {
      act += ((this.stim - act) * h) / TAU_ACT;
      const lse = lmtu - lce;
      const eps = (lse - p.lslack) / p.lslack;
      fse = eps > 0 ? fmax * (eps / EPS_REF) * (eps / EPS_REF) : 0;
      const x = (lce - p.lopt) / (p.lopt * W);
      const fl = Math.exp(C * Math.abs(x * x * x));
      const fhpe = x > 0 ? fmax * x * x : 0;
      const y = (lmin - lce) / (p.lopt * 0.5 * W);
      const flpe = y > 0 ? fmax * y * y : 0;
      const fv = (fse + flpe) / (act * fmax * fl + fhpe + 1e-6);
      v = fvInverse(fv) * p.vmax * p.lopt;
      lce += v * h;
      if (lce < 0.2 * p.lopt) lce = 0.2 * p.lopt;
      const lceMax = lmtu - 0.5 * p.lslack;
      if (lce > lceMax) lce = lceMax;
    }
    this.act = act;
    this.lce = lce;
    this.vce = v;
    this.force = fse;
    // simple metabolic cost: maintenance heat + shortening work
    const work = v < 0 ? -v * fse : 0;
    this.power = p.fmax * p.lopt * (0.25 * act + 0.75 * act * act) * 1.5 + work * 1.25;
    // fatigue builds with strong sustained activation and recovers slowly
    const drive = act > 0.3 ? (act - 0.3) / 0.7 : 0;
    this.fatigue += dt * (drive * (1 - this.fatigue) / 60 - this.fatigue / 120);
    if (this.fatigue < 0) this.fatigue = 0;
  }
}
