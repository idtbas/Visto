// Spiking neural network engine.
//
// Neurons are Izhikevich neurons integrated in 1 ms ticks. Synapses are conductance based
// with individual weights and axonal delays. Several kinds of synaptic plasticity are
// built in; all of them are local (a synapse only sees its own pre- and postsynaptic
// neuron) plus globally broadcast neuromodulators such as dopamine.
import { mulberry32, gaussian } from '../util/rng';

export interface NeuronType {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Izhikevich parameter sets for the classic cortical cell classes */
export const NT = {
  /** regular spiking (excitatory pyramidal cell) */
  RS: { a: 0.02, b: 0.2, c: -65, d: 8 },
  /** intrinsically bursting */
  IB: { a: 0.02, b: 0.2, c: -55, d: 4 },
  /** chattering */
  CH: { a: 0.02, b: 0.2, c: -50, d: 2 },
  /** fast spiking (inhibitory interneuron) */
  FS: { a: 0.1, b: 0.2, c: -65, d: 2 },
  /** low-threshold spiking (inhibitory) */
  LTS: { a: 0.02, b: 0.25, c: -65, d: 2 },
  /** tonic cell with little adaptation */
  TONIC: { a: 0.02, b: 0.2, c: -65, d: 2 },
  /** fast-recovering relay cell: fires regularly and follows its input rate (afferents, motoneurons) */
  RELAY: { a: 0.1, b: 0.2, c: -65, d: 2 },
} satisfies Record<string, NeuronType>;

export type Channel = 'E' | 'I' | 'S' | 'X' | 'C';

export type Plasticity =
  | {
      /** reward-modulated learning by perturbation: eligibility = presynaptic spikes × deviation
       *  of the postsynaptic exploration input (channel X) from its mean; weight change =
       *  dopamine × eligibility (Fiete & Seung 2006) */
      rule: 'perturb';
      lr: number;
      tauE: number;
      wMin: number;
      wMax: number;
    }
  | {
      /** dopamine-modulated spike-timing-dependent plasticity with eligibility traces
       *  (Izhikevich 2007) */
      rule: 'rstdp';
      lr: number;
      tauE: number;
      aPlus: number;
      aMinus: number;
      wMin: number;
      wMax: number;
    }
  | {
      /** cerebellar learning at parallel fibre synapses: depression when the climbing fibre
       *  (channel C) reports an error, slow potentiation otherwise */
      rule: 'cf';
      ltp: number;
      ltd: number;
      wMin: number;
      wMax: number;
    };

export interface PopSpec {
  name: string;
  n: number;
  type: NeuronType;
  region: string;
  /** constant input current */
  bias?: number;
  /** per-neuron spread of the bias (uniform ±) */
  biasJitter?: number;
  /** amplitude of the membrane noise */
  noise?: number;
  inhibitory?: boolean;
}

export class Pop {
  readonly id: number;
  readonly name: string;
  readonly start: number;
  readonly n: number;
  readonly type: NeuronType;
  readonly region: string;
  readonly inhibitory: boolean;
  noise: number;
  /** multiplies the excitability of the whole population (neuromodulation) */
  drive = 0;
  hasS = false;
  hasX = false;
  hasC = false;
  /** spikes in the current tick */
  count = 0;
  /** low-pass filtered firing rate [Hz per neuron] */
  rate = 0;
  out: Proj[] = [];

  constructor(id: number, start: number, spec: PopSpec) {
    this.id = id;
    this.name = spec.name;
    this.start = start;
    this.n = spec.n;
    this.type = spec.type;
    this.region = spec.region;
    this.noise = spec.noise ?? 0;
    this.inhibitory = spec.inhibitory ?? false;
  }
  get end(): number {
    return this.start + this.n;
  }
}

export interface ProjSpec {
  pre: Pop;
  post: Pop;
  channel: Channel;
  /** connection probability (each pre neuron contacts p * post.n targets) */
  p?: number;
  /** alternatively: fixed number of targets per pre neuron */
  fanOut?: number;
  /** 'one' wires neuron i to neuron i (populations must have equal size) */
  topology?: 'random' | 'one';
  w: number;
  /** relative spread of initial weights (uniform ±) */
  wJitter?: number;
  /** axonal delay in ms, or [min, max] */
  delay: number | [number, number];
  plastic?: Plasticity;
  name?: string;
}

export class Proj {
  readonly name: string;
  readonly pre: Pop;
  readonly post: Pop;
  readonly channel: Channel;
  readonly rowPtr: Uint32Array;
  readonly target: Uint32Array;
  readonly w: Float32Array;
  readonly delay: Uint8Array;
  readonly plastic: Plasticity | null;
  readonly elig: Float32Array | null;
  /** incoming index (only for rules that react to postsynaptic spikes) */
  colPtr: Uint32Array | null = null;
  inSyn: Uint32Array | null = null;
  inPre: Uint32Array | null = null;
  /** dopamine integrated since the last weight sweep */
  daAcc = 0;
  /** multiplies the learning rate (neuromodulation) */
  lrGain = 1;
  readonly w0: number;

  constructor(spec: ProjSpec, rng: () => number) {
    const { pre, post } = spec;
    this.name = spec.name ?? `${pre.name}→${post.name}`;
    this.pre = pre;
    this.post = post;
    this.channel = spec.channel;
    this.plastic = spec.plastic ?? null;
    this.w0 = spec.w;
    const one = spec.topology === 'one';
    const k = one ? 1 : Math.max(1, Math.min(post.n, Math.round(spec.fanOut ?? (spec.p ?? 0.1) * post.n)));
    const nSyn = pre.n * k;
    this.rowPtr = new Uint32Array(pre.n + 1);
    this.target = new Uint32Array(nSyn);
    this.w = new Float32Array(nSyn);
    this.delay = new Uint8Array(nSyn);
    this.elig = this.plastic && this.plastic.rule !== 'cf' ? new Float32Array(nSyn) : null;
    const [d0, d1] = typeof spec.delay === 'number' ? [spec.delay, spec.delay] : spec.delay;
    const jit = spec.wJitter ?? 0;
    const all = k === post.n;
    let s = 0;
    for (let i = 0; i < pre.n; i++) {
      this.rowPtr[i] = s;
      // stratified sampling: k distinct targets, one from each stratum
      const stride = post.n / k;
      for (let j = 0; j < k; j++) {
        let t: number;
        if (one) t = i % post.n;
        else if (all) t = j;
        else t = Math.min(post.n - 1, Math.floor((j + rng()) * stride));
        this.target[s] = post.start + t;
        this.w[s] = spec.w * (1 + jit * (2 * rng() - 1));
        this.delay[s] = Math.max(1, Math.min(MAX_DELAY, Math.round(d0 + (d1 - d0) * rng())));
        s++;
      }
    }
    this.rowPtr[pre.n] = s;
    if (this.plastic?.rule === 'rstdp') this.buildIncoming();
  }

  private buildIncoming(): void {
    const n = this.post.n;
    const counts = new Uint32Array(n + 1);
    for (let s = 0; s < this.target.length; s++) counts[this.target[s] - this.post.start + 1]++;
    for (let i = 0; i < n; i++) counts[i + 1] += counts[i];
    this.colPtr = counts.slice();
    this.inSyn = new Uint32Array(this.target.length);
    this.inPre = new Uint32Array(this.target.length);
    const fill = counts.slice(0, n);
    for (let i = 0; i < this.pre.n; i++) {
      for (let s = this.rowPtr[i]; s < this.rowPtr[i + 1]; s++) {
        const t = this.target[s] - this.post.start;
        const k = fill[t]++;
        this.inSyn[k] = s;
        this.inPre[k] = this.pre.start + i;
      }
    }
  }

  get nSyn(): number {
    return this.w.length;
  }

  meanWeight(): number {
    let sum = 0;
    for (let i = 0; i < this.w.length; i++) sum += this.w[i];
    return sum / this.w.length;
  }
}

export const MAX_DELAY = 31;
const RING = 32;
const RING_MASK = RING - 1;
const NOISE_N = 1 << 16;
const NOISE_MASK = NOISE_N - 1;
const TRACE_T = 256;

const DECAY_E = Math.exp(-1 / 5);
const DECAY_I = Math.exp(-1 / 10);
const DECAY_S = Math.exp(-1 / 150);
const DECAY_X = Math.exp(-1 / 30);
const DECAY_C = Math.exp(-1 / 60);
const K_XBAR = 1 / 4000;
const SWEEP_MS = 20;

export class Network {
  readonly pops: Pop[] = [];
  readonly projs: Proj[] = [];
  private readonly popByName = new Map<string, Pop>();
  n = 0;
  t = 0;
  readonly rng: () => number;

  // per-neuron state (allocated in build())
  v!: Float32Array;
  u!: Float32Array;
  bias!: Float32Array;
  /** external input current, written by sensors every tick */
  iext!: Float32Array;
  gE!: Float32Array;
  gI!: Float32Array;
  gS!: Float32Array;
  gX!: Float32Array;
  xbar!: Float32Array;
  cf!: Float32Array;
  private ringE!: Float32Array;
  private ringI!: Float32Array;
  private ringS!: Float32Array;
  private ringX!: Float32Array;
  private ringC!: Float32Array;
  /** time of the last spike of each neuron and the plasticity trace value right after it */
  private lastSpike!: Int32Array;
  private trace!: Float32Array;
  popOf!: Uint16Array;

  /** neurons that fired in the current tick */
  spikes!: Uint32Array;
  nSpikes = 0;
  totalSpikes = 0;

  /** phasic dopamine: reward prediction error broadcast to all plastic synapses */
  dopamine = 0;
  /** global switch for learning */
  learning = true;

  private readonly noiseTab = new Float32Array(NOISE_N);
  private readonly traceDecay = new Float32Array(TRACE_T);
  private plasticProjs: Proj[] = [];
  private postProjsByPop: Proj[][] = [];

  constructor(seed = 1) {
    this.rng = mulberry32(seed);
    for (let i = 0; i < NOISE_N; i++) this.noiseTab[i] = gaussian(this.rng);
    for (let i = 0; i < TRACE_T; i++) this.traceDecay[i] = Math.exp(-i / 20);
  }

  private pendingBias: { bias: number; jitter: number }[] = [];

  addPop(spec: PopSpec): Pop {
    if (this.popByName.has(spec.name)) throw new Error(`duplicate population ${spec.name}`);
    const p = new Pop(this.pops.length, this.n, spec);
    this.pops.push(p);
    this.popByName.set(spec.name, p);
    this.pendingBias.push({ bias: spec.bias ?? 0, jitter: spec.biasJitter ?? 0 });
    this.n += spec.n;
    return p;
  }

  pop(name: string): Pop {
    const p = this.popByName.get(name);
    if (!p) throw new Error(`unknown population ${name}`);
    return p;
  }

  connect(spec: ProjSpec): Proj {
    const pr = new Proj(spec, this.rng);
    this.projs.push(pr);
    spec.pre.out.push(pr);
    if (spec.channel === 'S') spec.post.hasS = true;
    if (spec.channel === 'X') spec.post.hasX = true;
    if (spec.channel === 'C') spec.post.hasC = true;
    return pr;
  }

  build(): void {
    const n = this.n;
    this.v = new Float32Array(n);
    this.u = new Float32Array(n);
    this.bias = new Float32Array(n);
    this.iext = new Float32Array(n);
    this.gE = new Float32Array(n);
    this.gI = new Float32Array(n);
    this.gS = new Float32Array(n);
    this.gX = new Float32Array(n);
    this.xbar = new Float32Array(n);
    this.cf = new Float32Array(n);
    this.ringE = new Float32Array(n * RING);
    this.ringI = new Float32Array(n * RING);
    this.ringS = new Float32Array(n * RING);
    this.ringX = new Float32Array(n * RING);
    this.ringC = new Float32Array(n * RING);
    this.lastSpike = new Int32Array(n).fill(-100000);
    this.trace = new Float32Array(n);
    this.spikes = new Uint32Array(n);
    this.popOf = new Uint16Array(n);
    for (const p of this.pops) {
      const pb = this.pendingBias[p.id];
      for (let i = p.start; i < p.end; i++) {
        this.v[i] = p.type.c + 10 * this.rng();
        this.u[i] = p.type.b * this.v[i];
        this.bias[i] = pb.bias + pb.jitter * (2 * this.rng() - 1);
        this.popOf[i] = p.id;
      }
    }
    this.plasticProjs = this.projs.filter((p) => p.plastic);
    this.postProjsByPop = this.pops.map((p) => this.projs.filter((q) => q.post === p && q.plastic?.rule === 'rstdp'));
  }

  get nSynapses(): number {
    let s = 0;
    for (const p of this.projs) s += p.nSyn;
    return s;
  }

  /** current value of a neuron's spike trace (decays with 20 ms) */
  private traceOf(i: number): number {
    const dt = this.t - this.lastSpike[i];
    return dt < TRACE_T ? this.trace[i] * this.traceDecay[dt] : 0;
  }

  step(): void {
    const t = this.t;
    const slot = t & RING_MASK;
    const n = this.n;
    const base = slot * n;
    const { v, u, bias, iext, gE, gI, gS, gX, xbar, cf, ringE, ringI, ringS, ringX, ringC, spikes, noiseTab } = this;
    const noiseOff = (this.rng() * NOISE_N) | 0;
    let ns = 0;

    for (let pi = 0; pi < this.pops.length; pi++) {
      const p = this.pops[pi];
      const { a, b, c, d } = p.type;
      const noise = p.noise;
      const drive = p.drive;
      const s0 = p.start;
      const s1 = p.end;
      const first = ns;
      const slow = p.hasS || p.hasX || p.hasC;
      for (let i = s0; i < s1; i++) {
        const r = base + i;
        let ge = gE[i] * DECAY_E + ringE[r];
        if (ge < 1e-4) ge = 0; // avoid slow denormal arithmetic
        ringE[r] = 0;
        gE[i] = ge;
        let gi = gI[i] * DECAY_I + ringI[r];
        if (gi < 1e-4) gi = 0;
        ringI[r] = 0;
        gI[i] = gi;
        let vv = v[i];
        let uu = u[i];
        // synaptic conductances are integrated implicitly so that strong inhibition stays stable:
        // dv/dt = f(v) + cur - gsyn * v   with   cur including the reversal-potential terms
        const gsyn = ge * 0.0153846 + gi * 0.0666667;
        const inv = 1 / (1 + 0.5 * gsyn);
        let cur = bias[i] + drive + iext[i] - gi * 5.333333;
        if (noise !== 0) cur += noise * noiseTab[(i * 7 + noiseOff) & NOISE_MASK];
        if (slow) {
          if (p.hasS) {
            let g = gS[i] * DECAY_S + ringS[r];
            if (g < 1e-4) g = 0;
            ringS[r] = 0;
            gS[i] = g;
            // NMDA-like: voltage dependent, only effective when already depolarised
            const open = vv > -70 ? (vv + 70) * 0.05 : 0;
            cur += g * (open > 1 ? 1 : open);
          }
          if (p.hasX) {
            let g = gX[i] * DECAY_X + ringX[r];
            if (g < 1e-4) g = 0;
            ringX[r] = 0;
            gX[i] = g;
            xbar[i] += (g - xbar[i]) * K_XBAR;
            cur += g - xbar[i];
          }
          if (p.hasC) {
            let g = cf[i] * DECAY_C + ringC[r];
            if (g < 1e-4) g = 0;
            ringC[r] = 0;
            cf[i] = g;
          }
        }
        vv = (vv + 0.5 * (0.04 * vv * vv + 5 * vv + 140 - uu + cur)) * inv;
        if (vv < 30) vv = (vv + 0.5 * (0.04 * vv * vv + 5 * vv + 140 - uu + cur)) * inv;
        uu += a * (b * vv - uu);
        if (vv >= 30) {
          vv = c;
          uu += d;
          spikes[ns++] = i;
        } else if (vv < -90) vv = -90;
        v[i] = vv;
        u[i] = uu;
      }
      p.count = ns - first;
      p.rate += (p.count * (1000 / p.n) - p.rate) * 0.02;
    }
    this.nSpikes = ns;
    this.totalSpikes += ns;

    // ---- spike propagation and spike-triggered plasticity ----
    const learning = this.learning;
    for (let k = 0; k < ns; k++) {
      const i = spikes[k];
      const p = this.pops[this.popOf[i]];
      const local = i - p.start;
      const outs = p.out;
      for (let q = 0; q < outs.length; q++) {
        const pr = outs[q];
        const a0 = pr.rowPtr[local];
        const a1 = pr.rowPtr[local + 1];
        const { target, w, delay } = pr;
        const ring = pr.channel === 'E' ? ringE : pr.channel === 'I' ? ringI : pr.channel === 'S' ? ringS : pr.channel === 'X' ? ringX : ringC;
        for (let s = a0; s < a1; s++) ring[((t + delay[s]) & RING_MASK) * n + target[s]] += w[s];
        const pl = pr.plastic;
        if (pl && learning) {
          if (pl.rule === 'perturb') {
            const el = pr.elig!;
            for (let s = a0; s < a1; s++) {
              const j = target[s];
              el[s] += gX[j] - xbar[j];
            }
          } else if (pl.rule === 'rstdp') {
            const el = pr.elig!;
            for (let s = a0; s < a1; s++) el[s] -= pl.aMinus * this.traceOf(target[s]);
          } else {
            for (let s = a0; s < a1; s++) {
              let nw = w[s] + pl.ltp - pl.ltd * cf[target[s]];
              if (nw < pl.wMin) nw = pl.wMin;
              else if (nw > pl.wMax) nw = pl.wMax;
              w[s] = nw;
            }
          }
        }
      }
      // postsynaptic side of STDP
      if (learning) {
        const posts = this.postProjsByPop[p.id];
        for (let q = 0; q < posts.length; q++) {
          const pr = posts[q];
          const pl = pr.plastic as Extract<Plasticity, { rule: 'rstdp' }>;
          const el = pr.elig!;
          const c0 = pr.colPtr![local];
          const c1 = pr.colPtr![local + 1];
          const inSyn = pr.inSyn!;
          const inPre = pr.inPre!;
          for (let s = c0; s < c1; s++) el[inSyn[s]] += pl.aPlus * this.traceOf(inPre[s]);
        }
      }
      this.trace[i] = this.traceOf(i) + 1;
      this.lastSpike[i] = t;
    }

    // ---- dopamine turns eligibility into lasting weight change ----
    if (learning && this.plasticProjs.length > 0) {
      const da = this.dopamine;
      for (let q = 0; q < this.plasticProjs.length; q++) {
        const pr = this.plasticProjs[q];
        if (!pr.elig) continue;
        pr.daAcc += da;
        if ((t + q * 7) % SWEEP_MS === 0) this.sweep(pr);
      }
    }
    this.t = t + 1;
  }

  private sweep(pr: Proj): void {
    const pl = pr.plastic as Extract<Plasticity, { rule: 'perturb' | 'rstdp' }>;
    const el = pr.elig!;
    const w = pr.w;
    const g = pl.lr * pr.lrGain * pr.daAcc;
    const decay = Math.exp(-SWEEP_MS / pl.tauE);
    const { wMin, wMax } = pl;
    pr.daAcc = 0;
    if (g !== 0) {
      for (let s = 0; s < w.length; s++) {
        const e = el[s];
        if (e !== 0) {
          let nw = w[s] + g * e;
          if (nw < wMin) nw = wMin;
          else if (nw > wMax) nw = wMax;
          w[s] = nw;
          el[s] = e * decay;
        }
      }
    } else {
      for (let s = 0; s < w.length; s++) el[s] *= decay;
    }
  }
}
