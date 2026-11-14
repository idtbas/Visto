// The inner loop of the spiking network, compiled to WebAssembly with SIMD (AssemblyScript).
// It advances all neurons by one millisecond, four at a time. The JavaScript engine in
// src/sim/brain/network.ts contains the same loop as a fallback; both must stay in step.
//
// build: node tools/build-kernel.cjs

let N: i32 = 0;
let nPops: i32 = 0;
let pV: usize = 0;
let pU: usize = 0;
let pBias: usize = 0;
let pIext: usize = 0;
let pGE: usize = 0;
let pGI: usize = 0;
let pGS: usize = 0;
let pGX: usize = 0;
let pXbar: usize = 0;
let pCf: usize = 0;
let pExtra: usize = 0;
let pRingE: usize = 0;
let pRingI: usize = 0;
let pRingS: usize = 0;
let pRingX: usize = 0;
let pRingC: usize = 0;
let pNoise: usize = 0;
let pSpikes: usize = 0;
let pPops: usize = 0;

let DECAY_E: f32 = 0;
let DECAY_I: f32 = 0;
let DECAY_S: f32 = 0;
let DECAY_X: f32 = 0;
let DECAY_C: f32 = 0;

/** bytes per entry of the population table */
const POP_BYTES: usize = 40;
const EPS: f32 = 1e-4;

export function heapBase(): usize {
  return __heap_base;
}

/** all pointers are byte offsets of per-neuron f32 arrays, laid out one after another in the order of this list */
export function init(n: i32, pops: i32, first: usize, ringLen: i32, noiseLen: i32): usize {
  N = n;
  nPops = pops;
  const per: usize = <usize>n << 2;
  let p = first;
  pV = p; p += per;
  pU = p; p += per;
  pBias = p; p += per;
  pIext = p; p += per;
  pGE = p; p += per;
  pGI = p; p += per;
  pGS = p; p += per;
  pGX = p; p += per;
  pXbar = p; p += per;
  pCf = p; p += per;
  pExtra = p; p += per;
  const ring: usize = per * <usize>ringLen;
  pRingE = p; p += ring;
  pRingI = p; p += ring;
  pRingS = p; p += ring;
  pRingX = p; p += ring;
  pRingC = p; p += ring;
  pNoise = p; p += <usize>noiseLen << 2;
  pSpikes = p; p += per;
  pPops = p; p += <usize>pops * POP_BYTES;
  return p;
}

export function setDecay(e: f32, i: f32, s: f32, x: f32, c: f32): void {
  DECAY_E = e;
  DECAY_I = i;
  DECAY_S = s;
  DECAY_X = x;
  DECAY_C = c;
}

// @ts-ignore: decorator
@inline
function half(vv: f32, uu: f32, cur: f32, inv: f32): f32 {
  return (vv + 0.5 * (0.04 * vv * vv + 5 * vv + 140 - uu + cur)) * inv;
}

/** advances every neuron by 1 ms; returns the number of spikes (their indices are in the spike list) */
export function step(slot: i32, noiseOff: i32, kx: f32): i32 {
  let ns: i32 = 0;
  const base: usize = (<usize>slot * <usize>N) << 2;
  const rE = pRingE + base;
  const rI = pRingI + base;
  const rS = pRingS + base;
  const rX = pRingX + base;
  const rC = pRingC + base;
  const noiseP = pNoise + (<usize>noiseOff << 2);

  const zero = f32x4.splat(0);
  const vEps = f32x4.splat(EPS);
  const vDE = f32x4.splat(DECAY_E);
  const vDI = f32x4.splat(DECAY_I);
  const one = f32x4.splat(1);
  const vHalf = f32x4.splat(0.5);
  const kE = f32x4.splat(0.0153846);
  const kI = f32x4.splat(0.0666667);
  const kIrev = f32x4.splat(5.333333);
  const c004 = f32x4.splat(0.04);
  const five = f32x4.splat(5);
  const c140 = f32x4.splat(140);
  const thirty = f32x4.splat(30);
  const vm90 = f32x4.splat(-90);

  for (let pi = 0; pi < nPops; pi++) {
    const pp = pPops + <usize>pi * POP_BYTES;
    const s0 = load<i32>(pp);
    const s1 = load<i32>(pp, 4);
    const a = load<f32>(pp, 8);
    const b = load<f32>(pp, 12);
    const c = load<f32>(pp, 16);
    const d = load<f32>(pp, 20);
    const noise = load<f32>(pp, 24);
    const drive = load<f32>(pp, 28);
    const flags = load<i32>(pp, 32);
    const first = ns;

    // slow channels: their contribution to the input current goes into `extra`
    if (flags != 0) {
      const hasS = (flags & 1) != 0;
      const hasX = (flags & 2) != 0;
      const hasC = (flags & 4) != 0;
      for (let i = s0; i < s1; i++) {
        const o: usize = <usize>i << 2;
        let ex: f32 = 0;
        if (hasS) {
          let g = load<f32>(pGS + o) * DECAY_S + load<f32>(rS + o);
          if (g < EPS) g = 0;
          store<f32>(rS + o, 0);
          store<f32>(pGS + o, g);
          // NMDA-like: voltage dependent, only effective when already depolarised
          const vv = load<f32>(pV + o);
          let open: f32 = vv > -70 ? (vv + 70) * 0.05 : 0;
          if (open > 1) open = 1;
          ex += g * open;
        }
        if (hasX) {
          let g = load<f32>(pGX + o) * DECAY_X + load<f32>(rX + o);
          if (g < EPS) g = 0;
          store<f32>(rX + o, 0);
          store<f32>(pGX + o, g);
          let xb = load<f32>(pXbar + o);
          xb += (g - xb) * kx;
          store<f32>(pXbar + o, xb);
          ex += g - xb;
        }
        if (hasC) {
          let g = load<f32>(pCf + o) * DECAY_C + load<f32>(rC + o);
          if (g < EPS) g = 0;
          store<f32>(rC + o, 0);
          store<f32>(pCf + o, g);
        }
        store<f32>(pExtra + o, ex);
      }
    }

    const va = f32x4.splat(a);
    const vb = f32x4.splat(b);
    const vc = f32x4.splat(c);
    const vd = f32x4.splat(d);
    const vNoise = f32x4.splat(noise);
    const vDrive = f32x4.splat(drive);
    let i = s0;
    for (; i + 4 <= s1; i += 4) {
      const o: usize = <usize>i << 2;
      let ge = f32x4.add(f32x4.mul(v128.load(pGE + o), vDE), v128.load(rE + o));
      ge = v128.and(ge, f32x4.ge(ge, vEps)); // avoid slow denormal arithmetic
      v128.store(rE + o, zero);
      v128.store(pGE + o, ge);
      let gi = f32x4.add(f32x4.mul(v128.load(pGI + o), vDI), v128.load(rI + o));
      gi = v128.and(gi, f32x4.ge(gi, vEps));
      v128.store(rI + o, zero);
      v128.store(pGI + o, gi);
      let vv = v128.load(pV + o);
      let uu = v128.load(pU + o);
      // synaptic conductances are integrated implicitly so that strong inhibition stays stable
      const gsyn = f32x4.add(f32x4.mul(ge, kE), f32x4.mul(gi, kI));
      const inv = f32x4.div(one, f32x4.add(one, f32x4.mul(vHalf, gsyn)));
      let cur = f32x4.add(f32x4.add(v128.load(pBias + o), vDrive), v128.load(pIext + o));
      cur = f32x4.sub(cur, f32x4.mul(gi, kIrev));
      cur = f32x4.add(cur, f32x4.mul(vNoise, v128.load(noiseP + o)));
      cur = f32x4.add(cur, v128.load(pExtra + o));
      const rest = f32x4.add(f32x4.sub(c140, uu), cur);
      const k1 = f32x4.add(f32x4.add(f32x4.mul(f32x4.mul(c004, vv), vv), f32x4.mul(five, vv)), rest);
      const v1 = f32x4.mul(f32x4.add(vv, f32x4.mul(vHalf, k1)), inv);
      const k2 = f32x4.add(f32x4.add(f32x4.mul(f32x4.mul(c004, v1), v1), f32x4.mul(five, v1)), rest);
      const v2 = f32x4.mul(f32x4.add(v1, f32x4.mul(vHalf, k2)), inv);
      vv = v128.bitselect(v2, v1, f32x4.lt(v1, thirty));
      uu = f32x4.add(uu, f32x4.mul(va, f32x4.sub(f32x4.mul(vb, vv), uu)));
      const sp = f32x4.ge(vv, thirty);
      const m = i32x4.bitmask(sp);
      vv = v128.bitselect(vc, f32x4.max(vv, vm90), sp);
      uu = v128.bitselect(f32x4.add(uu, vd), uu, sp);
      v128.store(pV + o, vv);
      v128.store(pU + o, uu);
      if (m != 0) {
        if (m & 1) { store<i32>(pSpikes + (<usize>ns << 2), i); ns++; }
        if (m & 2) { store<i32>(pSpikes + (<usize>ns << 2), i + 1); ns++; }
        if (m & 4) { store<i32>(pSpikes + (<usize>ns << 2), i + 2); ns++; }
        if (m & 8) { store<i32>(pSpikes + (<usize>ns << 2), i + 3); ns++; }
      }
    }
    // the last one to three neurons of a population
    for (; i < s1; i++) {
      const o: usize = <usize>i << 2;
      let ge = load<f32>(pGE + o) * DECAY_E + load<f32>(rE + o);
      if (ge < EPS) ge = 0;
      store<f32>(rE + o, 0);
      store<f32>(pGE + o, ge);
      let gi = load<f32>(pGI + o) * DECAY_I + load<f32>(rI + o);
      if (gi < EPS) gi = 0;
      store<f32>(rI + o, 0);
      store<f32>(pGI + o, gi);
      let vv = load<f32>(pV + o);
      let uu = load<f32>(pU + o);
      const gsyn: f32 = ge * 0.0153846 + gi * 0.0666667;
      const inv: f32 = 1 / (1 + 0.5 * gsyn);
      const cur: f32 = load<f32>(pBias + o) + drive + load<f32>(pIext + o) - gi * 5.333333 + noise * load<f32>(noiseP + o) + load<f32>(pExtra + o);
      vv = half(vv, uu, cur, inv);
      if (vv < 30) vv = half(vv, uu, cur, inv);
      uu += a * (b * vv - uu);
      if (vv >= 30) {
        vv = c;
        uu += d;
        store<i32>(pSpikes + (<usize>ns << 2), i);
        ns++;
      } else if (vv < -90) vv = -90;
      store<f32>(pV + o, vv);
      store<f32>(pU + o, uu);
    }
    store<i32>(pp, ns - first, 36);
  }
  return ns;
}
