// The nervous system as a cloud of light.
//
// Every neuron of the simulation is one point, placed where its biological counterpart
// sits: body-sense cortex behind the central sulcus (the left leg in the right hemisphere),
// visual cortex at the back, hippocampus and amygdala deep in the temporal lobes, basal
// ganglia and thalamus in the middle, dopamine cells in the midbrain, the spinal cord
// running down inside the vertebrae with the nerves of the legs beside it.
//
// What is real activity:
//  - a neuron's point flashes when that neuron fires
//  - the star of fine lines around a group of cells brightens with that group's firing rate
//  - the fibres between regions are the real nerve tracts; they brighten with the firing
//    of their source cells, and the sparks on them are a sample of the spikes on their way
//  - the faint dust that gives the brain its shape carries no data of its own; each part of
//    it glows with the firing rate of the cells of that part
//
// What is decoration: the shape itself (made from formulas, not a scanned brain), the
// vertebrae and ribs, the web of fine lines in the dust, the depth of field.
//
// Coordinates: x = left/right, y = up, z = front (the creature looks towards +z).
import type { BrainInfo } from '../sim/sim';
import type { PopInfo } from '../sim/brain/brain';
import { regionKeyOf } from './brainView';

type V3 = [number, number, number];

// ------------------------------------------------------------------ anatomy

/** centre of the cerebrum and how far each hemisphere's centre is from the midline */
const BRAIN_Y = 1.58;
const HEMI_X = 0.34;

/** A point on the surface of one hemisphere.
 *  a: angle from the frontal pole (0) to the occipital pole (π); b: angle around the long
 *  axis (0 = lateral, π/2 = top, π = medial wall, 3π/2 = underside); side: -1 left, +1 right.
 *  Returns the point, the outward direction and how high it lies in the folding (0 = bottom
 *  of a sulcus, 1 = crown of a gyrus). */
function cerebrum(side: number, a: number, b: number, depth = 0): { p: V3; n: V3; fold: number } {
  const sa = Math.sin(a);
  const dl = sa * Math.cos(b); // lateral component
  const dy = sa * Math.sin(b);
  const dz = Math.cos(a);
  // basic shape: long, wide at the side, flat at the midline and underneath
  const rx = dl >= 0 ? 0.42 : 0.32;
  let xl = dl >= 0 ? rx * dl : -rx * Math.pow(-dl, 0.55);
  const ry = dy >= 0 ? 0.64 : 0.5;
  let yl = dy >= 0 ? ry * dy : -ry * Math.pow(-dy, 0.8);
  const zl = 1.04 * dz * (dz < 0 ? 1.04 : 1);
  // temporal lobe: hangs down at the side, a little in front of the middle
  if (dy < 0 && dl > -0.3) {
    const t = Math.exp(-(((zl - 0.2) / 0.42) ** 2));
    yl -= 0.2 * t * -dy * (0.45 + 0.55 * Math.max(0, dl));
    xl += 0.03 * t * Math.max(0, dl);
  }
  // the underside of the frontal lobe rises towards the front
  if (dy < 0 && zl > 0.5) yl += 0.14 * ((zl - 0.5) / 0.55) * -dy;
  // folding: meandering bands of gyri with narrow sulci between them
  const X = side * xl;
  const q =
    15 * (0.85 * zl + 0.35 * yl + 0.2 * X) +
    2.6 * Math.sin(5.1 * yl + 3.3 * X + 1.7 * Math.sin(4.3 * zl)) +
    2.1 * Math.sin(6.7 * X - 4.1 * zl + 1.3 * Math.sin(5.9 * yl + 0.7)) +
    1.2 * Math.sin(9.3 * yl - 3.7 * zl);
  let fold = Math.sqrt(Math.abs(Math.sin(q)));
  let disp = 0.05 * (fold - 0.78) * (dl < -0.6 ? 0.45 : 1);
  if (dl > 0.1) {
    // lateral (Sylvian) fissure: from the front underside up towards the back
    const d1 = yl - (-0.07 - 0.27 * zl);
    if (zl > -0.5 && zl < 0.62) {
      const g = Math.exp(-((d1 / 0.04) ** 2)) * Math.min(1, (dl - 0.1) * 4);
      disp -= 0.07 * g;
      fold *= 1 - g;
    }
  }
  if (yl > 0.02) {
    // central sulcus: from the top down the side, between movement and body sense
    const d2 = zl - (0.08 - 0.42 * yl);
    const g = Math.exp(-((d2 / 0.032) ** 2)) * Math.min(1, yl * 6);
    disp -= 0.05 * g;
    fold *= 1 - 0.9 * g;
  }
  // outward direction of the smooth shape (good enough for moving in and out)
  let nx = (side * xl) / (rx * rx);
  let ny = yl / (ry * ry);
  let nz = zl / 1.1;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const off = disp - depth;
  return { p: [side * (HEMI_X + xl) + nx * off, BRAIN_Y + yl + ny * off, zl + nz * off], n: [nx, ny, nz], fold };
}

const CEREBELLUM_C: V3 = [0, 0.99, -0.7];
const CEREBELLUM_R: V3 = [0.6, 0.33, 0.4];

/** a point on the cerebellum: an ellipsoid with fine horizontal leaves (folia) and a dent in the middle */
function cerebellum(u: number, th: number, depth = 0): { p: V3; n: V3; fold: number } {
  const s = Math.sqrt(1 - u * u);
  const dx = s * Math.cos(th);
  const dz = s * Math.sin(th);
  const leaf = Math.sin(44 * u * CEREBELLUM_R[1] + 2.2 * Math.sin(3 * dx) + 1.2 * dz);
  const fold = 0.5 + 0.5 * leaf;
  const vermis = Math.exp(-((dx / 0.16) ** 2)) * (dz < 0.3 ? 1 : 0);
  const k = 1 + 0.035 * leaf - 0.07 * vermis - depth;
  return { p: [CEREBELLUM_C[0] + CEREBELLUM_R[0] * dx * k, CEREBELLUM_C[1] + CEREBELLUM_R[1] * u * k, CEREBELLUM_C[2] + CEREBELLUM_R[2] * dz * k], n: [dx, u, dz], fold: fold * (1 - 0.6 * vermis) };
}

/** centre line of brainstem and spinal cord: y, z of the centre, half-width, half-depth */
const STEM: [number, number, number, number][] = [
  [1.3, -0.02, 0.13, 0.12],
  [1.16, 0.0, 0.17, 0.16],
  [1.0, 0.04, 0.2, 0.2], // pons bulges forward
  [0.86, 0.0, 0.16, 0.15],
  [0.7, -0.07, 0.11, 0.1],
  // the cord is drawn about twice as thick as it would be, so that its neurons can be told apart
  [0.52, -0.09, 0.1, 0.08],
  [0.2, -0.07, 0.13, 0.095],
  [-0.4, -0.05, 0.15, 0.105],
  [-1.0, -0.04, 0.16, 0.11], // lumbar swelling, where the nerves of the legs leave
  [-1.45, -0.03, 0.11, 0.08],
  [-1.75, -0.03, 0.03, 0.025],
];

function stemAt(y: number): { z: number; rx: number; rz: number } {
  for (let i = 1; i < STEM.length; i++) {
    if (y >= STEM[i][0]) {
      const t = (y - STEM[i][0]) / (STEM[i - 1][0] - STEM[i][0]);
      return { z: STEM[i][1] + t * (STEM[i - 1][1] - STEM[i][1]), rx: STEM[i][2] + t * (STEM[i - 1][2] - STEM[i][2]), rz: STEM[i][3] + t * (STEM[i - 1][3] - STEM[i][3]) };
    }
  }
  const l = STEM[STEM.length - 1];
  return { z: l[1], rx: l[2], rz: l[3] };
}

type Place =
  /** on the cortex: patches given as [a0, a1, b0, b1]; 'cross' puts populations whose name ends in links/_0 into the right hemisphere */
  | { kind: 'cortex'; patch: [number, number, number, number]; sides: 'both' | 'cross'; anchor: V3; split?: boolean }
  /** a nucleus: ellipsoid with centre and half-axes; bilateral ones are mirrored to the other side */
  | { kind: 'nucleus'; c: V3; r: V3; bilateral?: boolean; along?: 0 | 1 | 2 }
  | { kind: 'cerebellum'; depth: [number, number] }
  /** inside the spinal cord, one half; populations are stacked from top to bottom */
  | { kind: 'cord'; side: number; y: [number, number] };

const PLACE: Record<string, Place> = {
  cortex_body: { kind: 'cortex', patch: [1.66, 1.98, 0.55, 2.25], sides: 'cross', anchor: [0, 2.3, -0.2], split: true },
  cortex: { kind: 'cortex', patch: [2.06, 2.42, 0.6, 2.0], sides: 'both', anchor: [0, 2.2, -0.72] },
  visual: { kind: 'cortex', patch: [2.62, 3.05, 0.0, 6.283], sides: 'both', anchor: [0, 1.75, -1.2] },
  explore: { kind: 'cortex', patch: [0.42, 1.0, 0.45, 2.1], sides: 'both', anchor: [0, 2.12, 0.78], split: true },
  // the workspace cells sit in the frontal lobe in front of the central sulcus, the comparison
  // of prediction and sensation behind the prediction cells in the parietal lobe
  workspace: { kind: 'cortex', patch: [1.08, 1.5, 0.5, 2.1], sides: 'both', anchor: [0, 2.28, 0.32], split: true },
  bodymodel: { kind: 'cortex', patch: [2.44, 2.6, 0.6, 2.0], sides: 'both', anchor: [0, 2.05, -1.0], split: true },
  // smell arrives at the olfactory bulbs under the frontal lobes
  smell: { kind: 'nucleus', c: [0.1, 1.22, 0.82], r: [0.045, 0.035, 0.11], bilateral: true },
  // the body's interior reports to the insula, deep in the side of the brain
  intero: { kind: 'nucleus', c: [0.4, 1.52, 0.22], r: [0.035, 0.08, 0.12], bilateral: true, along: 2 },
  hippocampus: { kind: 'nucleus', c: [0.33, 1.3, -0.2], r: [0.07, 0.06, 0.4], bilateral: true, along: 2 },
  amygdala: { kind: 'nucleus', c: [0.33, 1.27, 0.3], r: [0.085, 0.075, 0.085], bilateral: true },
  basal: { kind: 'nucleus', c: [0.25, 1.66, 0.2], r: [0.1, 0.12, 0.18], bilateral: true },
  pain_relay: { kind: 'nucleus', c: [0.1, 1.53, -0.08], r: [0.075, 0.07, 0.12], bilateral: true },
  habenula: { kind: 'nucleus', c: [0.035, 1.62, -0.3], r: [0.03, 0.035, 0.045], bilateral: true },
  vta: { kind: 'nucleus', c: [0.05, 1.24, -0.01], r: [0.045, 0.04, 0.06], bilateral: true },
  afferent: { kind: 'nucleus', c: [0.11, 0.93, -0.06], r: [0.045, 0.06, 0.05], bilateral: true },
  brainstem: { kind: 'nucleus', c: [0, 0.98, 0.0], r: [0.13, 0.3, 0.12], along: 1 },
  cerebellum: { kind: 'cerebellum', depth: [0.02, 0.2] },
  cerebellum_granule: { kind: 'cerebellum', depth: [0.2, 0.75] },
  spinal_0: { kind: 'cord', side: -1, y: [-1.55, 0.4] },
  spinal_1: { kind: 'cord', side: 1, y: [-1.55, 0.4] },
  afferent_0: { kind: 'nucleus', c: [-0.52, -0.62, -0.24], r: [0.2, 0.52, 0.07], along: 1 },
  afferent_1: { kind: 'nucleus', c: [0.52, -0.62, -0.24], r: [0.2, 0.52, 0.07], along: 1 },
  motor_0: { kind: 'nucleus', c: [-0.5, -1.15, 0.2], r: [0.18, 0.4, 0.07], along: 1 },
  motor_1: { kind: 'nucleus', c: [0.5, -1.15, 0.2], r: [0.18, 0.4, 0.07], along: 1 },
  pain_0: { kind: 'nucleus', c: [-0.92, -0.9, -0.14], r: [0.08, 0.36, 0.06], along: 1 },
  pain_1: { kind: 'nucleus', c: [0.92, -0.9, -0.14], r: [0.08, 0.36, 0.06], along: 1 },
  pain_c: { kind: 'nucleus', c: [0, 0.0, -0.36], r: [0.3, 0.12, 0.05], along: 0 },
};

/** like the regions of the flat map, but the pain receptors are split by where they sit in the body */
function key3d(p: PopInfo): string {
  const k = regionKeyOf(p);
  if (k !== 'pain') return k;
  return p.name.includes('links') ? 'pain_0' : p.name.includes('rechts') ? 'pain_1' : 'pain_c';
}

function anchorOf(pl: Place): V3 {
  if (pl.kind === 'cortex') return pl.anchor;
  if (pl.kind === 'nucleus') return pl.bilateral ? [0, pl.c[1], pl.c[2]] : pl.c;
  if (pl.kind === 'cerebellum') return CEREBELLUM_C;
  return [pl.side * 0.045, (pl.y[0] + pl.y[1]) / 2, -0.05];
}


// ------------------------------------------------------------------ colours

/** groups of regions that share a colour */
export const FAMILIES: { name: string; color: V3; regions: string[] }[] = [
  { name: 'Hirnstamm · Zwischenhirn', color: [64, 232, 204], regions: ['brainstem', 'vta', 'afferent', 'pain_relay', 'habenula'] },
  { name: 'Körpersinn · Vorhersage', color: [92, 150, 255], regions: ['cortex_body', 'cortex', 'bodymodel'] },
  { name: 'Sehen', color: [130, 222, 255], regions: ['visual'] },
  { name: 'Arbeitsraum · Erkundung', color: [255, 118, 190], regions: ['workspace', 'explore'] },
  { name: 'Gedächtnis · Gefahr · Antrieb', color: [255, 188, 66], regions: ['hippocampus', 'amygdala', 'basal', 'intero', 'smell'] },
  { name: 'Kleinhirn', color: [172, 140, 255], regions: ['cerebellum', 'cerebellum_granule'] },
  { name: 'Rückenmark', color: [214, 240, 236], regions: ['spinal_0', 'spinal_1'] },
  { name: 'Sinnesnerven', color: [118, 236, 150], regions: ['afferent_0', 'afferent_1'] },
  { name: 'Motoneuronen', color: [255, 122, 92], regions: ['motor_0', 'motor_1'] },
  { name: 'Schmerz', color: [255, 70, 96], regions: ['pain_0', 'pain_1', 'pain_c'] },
];
const FAMILY_OF = new Map<string, number>();
FAMILIES.forEach((f, i) => f.regions.forEach((r) => FAMILY_OF.set(r, i)));
const F_STEM = 0;
const F_PARIETAL = 1;
const F_OCCIPITAL = 2;
const F_FRONTAL = 3;
const F_TEMPORAL = 4;
const F_CEREBELLUM = 5;
const F_CORD = 6;

const SEG = 12; // line segments per fibre
/** cells per unit of area (as seen on screen) up to which a group is shown at full brightness */
const DENSITY = 2600;
const MAX_SPARKS = 700;

const VS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aGlow;
uniform mat4 uMVP; uniform float uScale, uBase, uGain, uPulse, uHalo, uFocus, uAperture;
varying vec3 vCol; varying float vA, vBlur, vFlash;
void main() {
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  float g = min(aGlow, 4.0);
  float bright = mix(g * uGain, 0.13 + 0.87 * min(g, 1.0), uPulse);
  float size = uScale * (uBase + uPulse * 0.75 * min(g, 1.6)) / p.w;
  // second pass over the neurons: a wide soft glow around the ones that are firing
  if (uHalo > 0.0) { bright = uHalo * max(0.0, min(g, 2.5) - 0.4); size *= 6.0; }
  // depth of field: away from the plane of focus a point spreads into a dim disc
  float coc = uAperture * abs(p.w - uFocus) / max(p.w, 0.2);
  float s = size + coc;
  gl_PointSize = clamp(s, 1.0, 72.0);
  float spread = max(size, 1.0) / max(s, 1.0);
  vA = bright * spread * spread * min(1.0, size * size + 0.35);
  vBlur = clamp(coc / max(s, 1.0), 0.0, 1.0);
  vFlash = uPulse * (1.0 - step(0.001, uHalo)) * clamp((g - 1.3) * 0.2, 0.0, 0.32);
  vCol = aCol;
}`;
const FS = `
precision mediump float;
varying vec3 vCol; varying float vA, vBlur, vFlash;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float sharp = (1.0 - r) * (1.0 - r);
  float disc = smoothstep(1.0, 0.75, r) * 0.55;
  float a = vA * mix(sharp, disc, vBlur);
  // a firing cell flashes towards white in its own hue, whatever its resting brightness
  vec3 c = mix(vCol, vec3(1.0), vFlash) + vFlash * 1.1 * normalize(vCol + 0.001);
  gl_FragColor = vec4(c * a, a);
}`;
const LVS = `
attribute vec3 aPos; attribute vec4 aCol;
uniform mat4 uMVP; uniform float uFocus, uGain;
varying vec4 vCol;
void main() {
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  // lines fade a little with distance from the plane of focus
  float fade = clamp(1.25 - 0.9 * abs(p.w - uFocus) / uFocus, 0.25, 1.0);
  vCol = vec4(aCol.rgb, aCol.a * fade * uGain);
}`;
const LFS = `
precision mediump float; varying vec4 vCol;
void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }`;

interface Fibre {
  a: V3;
  c: V3;
  b: V3;
}
interface Tract3 {
  inh: boolean;
  family: number;
  sources: number[];
  n: number;
  fibres: Fibre[];
  /** index of its first vertex in the dynamic line buffer */
  first: number;
  rate: number;
  spikes: number;
}
interface Star {
  pop: number;
  first: number;
  count: number;
}

function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bezier(f: Fibre, s: number): V3 {
  const u = 1 - s;
  return [u * u * f.a[0] + 2 * u * s * f.c[0] + s * s * f.b[0], u * u * f.a[1] + 2 * u * s * f.c[1] + s * s * f.b[1], u * u * f.a[2] + 2 * u * s * f.c[2] + s * s * f.b[2]];
}

/** the dust that gives brain, brainstem and cord their shape, sorted by colour family */
function buildDust(): { pos: Float32Array; col: Float32Array; glow: Float32Array; ranges: [number, number][]; web: number[] } {
  const rnd = rand(90210);
  const by: { p: V3; g: number }[][] = FAMILIES.map(() => []);
  // cerebrum: a dense shell just under the folded surface and a thin filling of the white matter
  for (const side of [-1, 1]) {
    for (let i = 0; i < 46000; i++) {
      const a = Math.acos(1 - 2 * rnd());
      const b = rnd() * Math.PI * 2;
      const deep = rnd() < 0.16;
      const depth = deep ? 0.06 + 0.4 * rnd() * rnd() : 0.03 * rnd();
      const s = cerebrum(side, a, b, depth);
      const y = s.p[1] - BRAIN_Y;
      const z = s.p[2] + 0.1 * (rnd() - 0.5);
      const lateral = Math.abs(s.p[0]) > 0.27;
      let fam = F_PARIETAL;
      if (y < -0.1 + 0.08 * (rnd() - 0.5) && z > -0.55 && z < 0.62 && lateral) fam = F_TEMPORAL;
      else if (z > 0.1 - 0.42 * Math.max(0, y)) fam = F_FRONTAL;
      else if (z < -0.62) fam = F_OCCIPITAL;
      // the crowns of the folds are brighter than the furrows between them
      by[fam].push({ p: s.p, g: deep ? 0.1 + 0.08 * rnd() : 0.1 + 0.5 * s.fold * s.fold });
    }
  }
  for (let i = 0; i < 16000; i++) {
    const s = cerebellum(2 * rnd() - 1, rnd() * Math.PI * 2, rnd() < 0.25 ? 0.5 * rnd() : 0.04 * rnd());
    by[F_CEREBELLUM].push({ p: s.p, g: 0.1 + 0.42 * s.fold });
  }
  // brainstem and, above it, the thalamus
  for (let i = 0; i < 8000; i++) {
    const y = 0.42 + 0.9 * rnd();
    const s = stemAt(y);
    const ph = rnd() * Math.PI * 2;
    const rho = Math.sqrt(rnd());
    by[F_STEM].push({ p: [s.rx * rho * Math.cos(ph), y, s.z + s.rz * rho * Math.sin(ph)], g: 0.2 + 0.3 * rnd() });
  }
  for (let i = 0; i < 4200; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = 2 * rnd() - 1;
      y = 2 * rnd() - 1;
      z = 2 * rnd() - 1;
    } while (x * x + y * y + z * z > 1);
    const side = rnd() < 0.5 ? -1 : 1;
    by[F_STEM].push({ p: [side * (0.13 + 0.11 * x), 1.5 + 0.1 * y, -0.06 + 0.17 * z], g: 0.2 + 0.32 * rnd() });
  }
  for (let i = 0; i < 1500; i++) {
    const y = -1.7 + 2.15 * rnd();
    const s = stemAt(y);
    const ph = rnd() * Math.PI * 2;
    by[F_CORD].push({ p: [s.rx * Math.cos(ph), y, s.z + s.rz * Math.sin(ph)], g: 0.1 + 0.14 * rnd() });
  }
  const n = by.reduce((s, l) => s + l.length, 0);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const glow = new Float32Array(n);
  const ranges: [number, number][] = [];
  let k = 0;
  by.forEach((list, fam) => {
    ranges.push([k, list.length]);
    const c = FAMILIES[fam].color;
    for (const d of list) {
      pos.set(d.p, k * 3);
      col[k * 3] = c[0] / 255;
      col[k * 3 + 1] = c[1] / 255;
      col[k * 3 + 2] = c[2] / 255;
      glow[k++] = d.g;
    }
  });
  // a web of short lines between neighbouring grains
  const web: number[] = [];
  const cell = 0.07;
  const grid = new Map<number, number[]>();
  const keyOf = (x: number, y: number, z: number): number => (Math.floor(x / cell) + 64) * 65536 + (Math.floor(y / cell) + 64) * 256 + Math.floor(z / cell) + 64;
  for (let i = 0; i < n; i += 2) {
    const kk = keyOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    let l = grid.get(kk);
    if (!l) grid.set(kk, (l = []));
    l.push(i);
  }
  for (let i = 0; i < n; i += 4) {
    const l = grid.get(keyOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
    if (!l || l.length < 2) continue;
    const j = l[Math.floor(rnd() * l.length)];
    if (j === i) continue;
    const a = 0.07 + 0.13 * rnd();
    for (const q of [i, j]) web.push(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2], col[q * 3], col[q * 3 + 1], col[q * 3 + 2], a);
  }
  return { pos, col, glow, ranges, web };
}

/** vertebrae and ribs as fine wire: [x, y, z, r, g, b, a] per vertex, two vertices per line */
function buildSkeleton(): number[] {
  const out: number[] = [];
  const line = (p: V3, q: V3, a: number): void => {
    out.push(p[0], p[1], p[2], 0.8, 0.94, 0.92, a, q[0], q[1], q[2], 0.8, 0.94, 0.92, a);
  };
  const N = 24;
  for (let v = 0; v < N; v++) {
    const y = 0.36 - (v / (N - 1)) * 2.02;
    const s = stemAt(y);
    const rx = s.rx + 0.085;
    const rz = s.rz + 0.075;
    const h = 0.03;
    const ring = (yy: number, k: number): V3[] => {
      const pts: V3[] = [];
      for (let i = 0; i < 18; i++) {
        const ph = (i / 18) * Math.PI * 2;
        pts.push([rx * k * Math.cos(ph), yy, s.z + rz * k * Math.sin(ph)]);
      }
      return pts;
    };
    const top = ring(y + h, 1);
    const bottom = ring(y - h, 1.04);
    for (let i = 0; i < 18; i++) {
      line(top[i], top[(i + 1) % 18], 0.42);
      line(bottom[i], bottom[(i + 1) % 18], 0.42);
      if (i % 3 === 0) line(top[i], bottom[i], 0.26);
    }
    // processes to the sides and to the back
    for (const side of [-1, 1]) line([side * rx, y, s.z - 0.02], [side * (rx + 0.2), y - 0.015, s.z - 0.1], 0.4);
    line([0, y, s.z - rz], [0, y - 0.06, s.z - rz - 0.17], 0.32);
    // ribs along the chest
    if (v >= 5 && v <= 15) {
      const reach = 0.5 + 0.22 * Math.sin(((v - 5) / 10) * Math.PI);
      for (const side of [-1, 1]) {
        let prev: V3 = [side * (rx + 0.2), y - 0.015, s.z - 0.1];
        for (let i = 1; i <= 9; i++) {
          const t = (i / 9) * 1.9;
          const p: V3 = [side * (rx + 0.2 + reach * Math.sin(t)), y - 0.015 - 0.16 * (i / 9), s.z - 0.1 + reach * 0.85 * (1 - Math.cos(t))];
          line(prev, p, 0.26 * (1 - 0.6 * (i / 9)));
          prev = p;
        }
      }
    }
  }
  return out;
}

const VIEWS: Record<string, { y: number; dist: number }> = {
  all: { y: 0.55, dist: 5.6 },
  brain: { y: 1.38, dist: 3.1 },
  cord: { y: -0.7, dist: 3.3 },
};

export class Brain3D {
  private readonly gl: WebGLRenderingContext | null;
  private info: BrainInfo | null = null;
  private pointProg: WebGLProgram | null = null;
  private lineProg: WebGLProgram | null = null;
  private readonly buf: Record<string, WebGLBuffer | null> = {};
  private dustRanges: [number, number][] = [];
  private staticLines = 0;
  private skeletonFirst = 0;
  private glow = new Float32Array(0);
  private popSpikes = new Float32Array(0);
  private popRate = new Float32Array(0);
  private familyOfPop = new Int8Array(0);
  private readonly familyRate = new Float32Array(FAMILIES.length);
  private readonly familyCells = new Float32Array(FAMILIES.length);
  private tracts: Tract3[] = [];
  private stars: Star[] = [];
  private dynCol = new Float32Array(0);
  private dynLines = 0;
  private sparks: { tract: number; fibre: number; t: number; speed: number }[] = [];
  private readonly sparkPos = new Float32Array(MAX_SPARKS * 3);
  private readonly sparkCol = new Float32Array(MAX_SPARKS * 3);
  private readonly sparkGlow = new Float32Array(MAX_SPARKS).fill(1.5);
  private legendBars: HTMLElement[] = [];
  private frame = 0;
  // camera
  private yaw = 0.9;
  private pitch = 0.08;
  private dist = 5.6;
  private targetY = 0.55;
  private goal = { y: 0.55, dist: 5.6 };
  private dragging = false;
  private lastInteraction = 0;
  private readonly mvp = new Float32Array(16);
  open = false;
  /** false if the browser offers no WebGL */
  readonly supported: boolean;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly legend: HTMLElement | null = null) {
    this.gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    this.supported = !!this.gl;
    if (this.gl) this.initGl(this.gl);
    let px = 0;
    let py = 0;
    let pinch = 0;
    const pts = new Map<number, [number, number]>();
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      this.dragging = true;
      px = e.clientX;
      py = e.clientY;
      pinch = 0;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      this.lastInteraction = performance.now();
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) this.goal.dist = this.dist = Math.min(12, Math.max(1.3, (this.dist * pinch) / d));
        pinch = d;
        return;
      }
      this.yaw += (e.clientX - px) * 0.008;
      this.pitch = Math.min(1.3, Math.max(-1.3, this.pitch + (e.clientY - py) * 0.006));
      px = e.clientX;
      py = e.clientY;
    });
    const up = (e: PointerEvent): void => {
      pts.delete(e.pointerId);
      pinch = 0;
      this.dragging = pts.size > 0;
      this.lastInteraction = performance.now();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.goal.dist = Math.min(12, Math.max(1.3, this.goal.dist * Math.exp(e.deltaY * 0.0012)));
        this.lastInteraction = performance.now();
      },
      { passive: false },
    );
  }

  /** move the camera to one of the standard views: 'all', 'brain' or 'cord' */
  setView(name: string): void {
    const v = VIEWS[name];
    if (v) this.goal = { y: v.y, dist: v.dist };
  }

  private initGl(gl: WebGLRenderingContext): void {
    const compile = (vs: string, fs: string): WebGLProgram => {
      const prog = gl.createProgram()!;
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      }
      // fixed attribute slots, so that the unused one can be switched off for the lines
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.bindAttribLocation(prog, 1, 'aCol');
      gl.bindAttribLocation(prog, 2, 'aGlow');
      gl.linkProgram(prog);
      return prog;
    };
    this.pointProg = compile(VS, FS);
    this.lineProg = compile(LVS, LFS);
    for (const k of ['pos', 'col', 'glow', 'dustPos', 'dustCol', 'dustGlow', 'staticPos', 'staticCol', 'dynPos', 'dynCol', 'sparkPos', 'sparkCol', 'sparkGlow']) this.buf[k] = gl.createBuffer();
    gl.enable(gl.BLEND);
    // "screen" blending: light adds up, but it approaches white only gradually
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.disable(gl.DEPTH_TEST);
    const fill = (name: string, data: Float32Array, usage: number = gl.STATIC_DRAW): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    };
    // the dust, its web and the skeleton never change
    const dust = buildDust();
    this.dustRanges = dust.ranges;
    fill('dustPos', dust.pos);
    fill('dustCol', dust.col);
    fill('dustGlow', dust.glow);
    const lines = [...dust.web];
    this.skeletonFirst = lines.length / 7;
    lines.push(...buildSkeleton());
    this.staticLines = lines.length / 7;
    const sp = new Float32Array(this.staticLines * 3);
    const sc = new Float32Array(this.staticLines * 4);
    for (let i = 0; i < this.staticLines; i++) {
      sp.set(lines.slice(i * 7, i * 7 + 3), i * 3);
      sc.set(lines.slice(i * 7 + 3, i * 7 + 7), i * 4);
    }
    fill('staticPos', sp);
    fill('staticCol', sc);
  }

  setInfo(info: BrainInfo): void {
    this.info = info;
    this.glow = new Float32Array(info.neurons);
    this.popSpikes = new Float32Array(info.pops.length);
    this.popRate = new Float32Array(info.pops.length);
    this.familyOfPop = new Int8Array(info.pops.length).fill(-1);
    this.familyRate.fill(0);
    this.familyCells.fill(0);
    this.sparks = [];
    this.buildLegend();
    const gl = this.gl;
    if (!gl) return;
    const pos = new Float32Array(info.neurons * 3);
    const col = new Float32Array(info.neurons * 3);
    const byRegion = new Map<string, number[]>();
    info.pops.forEach((p, i) => {
      const k = key3d(p);
      if (!byRegion.has(k)) byRegion.set(k, []);
      byRegion.get(k)!.push(i);
    });
    const regionOfPop: string[] = info.pops.map(() => '');
    for (const [key, list] of byRegion) {
      const pl = PLACE[key];
      const family = FAMILY_OF.get(key);
      if (!pl || family === undefined) continue;
      const total = list.reduce((s, i) => s + info.pops[i].n, 0);
      for (const pi of list) {
        this.familyOfPop[pi] = family;
        this.familyCells[family] += info.pops[pi].n;
      }
      const def = { color: FAMILIES[family].color };
      const cols = Math.ceil(Math.sqrt(list.length));
      const rows = Math.ceil(list.length / cols);
      let done = 0;
      list.forEach((pi, j) => {
        const p = info.pops[pi];
        const rnd = rand(pi * 7919 + 13);
        regionOfPop[pi] = key;
        const fc = def.color;
        const c = p.inhibitory ? [0.45 * fc[0] + 95, 0.45 * fc[1] + 110, 0.45 * fc[2] + 140] : fc;
        // inhibitory cells of the cortex share the patch of the cells they inhibit
        const leftBody = /links|_0$/.test(p.name);
        const rightBody = /rechts|_1$/.test(p.name);
        let put: (k: number) => V3;
        if (pl.kind === 'cortex') {
          let [a0, a1, b0, b1] = pl.patch;
          let fixedSide = 0;
          if (pl.sides === 'cross') {
            // legs lie at the top next to the midline, of the opposite hemisphere; the trunk further out on both
            if (leftBody || rightBody) {
              fixedSide = leftBody ? 1 : -1;
              b0 = 1.3;
            } else b1 = 1.3;
          } else if (pl.split) {
            const cj = j % cols;
            const rj = Math.floor(j / cols);
            const da = (a1 - a0) / rows;
            const db = (b1 - b0) / cols;
            a0 += rj * da + 0.12 * da;
            a1 = a0 + 0.76 * da;
            b0 += cj * db + 0.12 * db;
            b1 = b0 + 0.76 * db;
          } else {
            const da = (a1 - a0) / list.length;
            a0 += j * da + 0.08 * da;
            a1 = a0 + 0.84 * da;
          }
          put = (k) => cerebrum(fixedSide || (k % 2 ? 1 : -1), a0 + rnd() * (a1 - a0), b0 + rnd() * (b1 - b0), 0.015 + 0.075 * rnd()).p;
        } else if (pl.kind === 'cerebellum') {
          const th0 = (j / list.length) * Math.PI * 2;
          const dth = (Math.PI * 2) / list.length;
          put = () => cerebellum(1.8 * rnd() - 0.9, th0 + rnd() * dth, pl.depth[0] + rnd() * (pl.depth[1] - pl.depth[0])).p;
        } else if (pl.kind === 'cord') {
          const h = pl.y[1] - pl.y[0];
          const top = pl.y[1] - (done / total) * h;
          const bottom = pl.y[1] - ((done + p.n) / total) * h;
          put = () => {
            const y = bottom + rnd() * (top - bottom);
            const s = stemAt(y);
            const ph = rnd() * Math.PI * 2;
            const rho = 0.85 * Math.sqrt(rnd());
            return [pl.side * (0.012 + Math.abs(s.rx * rho * Math.cos(ph))), y, s.z + s.rz * rho * Math.sin(ph)];
          };
        } else {
          // a colony inside the nucleus
          const vol = pl.r[0] * pl.r[1] * pl.r[2];
          let cx = pl.c[0];
          let cy = pl.c[1];
          let cz = pl.c[2];
          let rr: V3 = pl.r;
          if (list.length > 1) {
            const share = Math.min(Math.cbrt(vol * (p.n / total) * 0.55), Math.min(pl.r[0], pl.r[1], pl.r[2]) * 1.2);
            rr = [share, share, share];
            if (pl.along !== undefined) {
              const t = (j + 0.5) / list.length;
              const o = pl.r[pl.along] * 0.88 * (pl.along === 1 ? 1 - 2 * t : 2 * t - 1);
              // two rows side by side when there are many
              const wob = list.length > 6 ? (j % 2 ? 0.45 : -0.45) : 0;
              if (pl.along === 0) { cx += o; cz += wob * pl.r[2]; }
              else if (pl.along === 1) { cy += o; cx += wob * pl.r[0]; }
              else { cz += o; cy += wob * pl.r[1]; }
            } else {
              const t = (j + 0.5) / list.length;
              const rho = 0.72 * Math.cbrt(t);
              const th = j * 2.399963229728653;
              const cosPhi = 1 - 2 * ((j * 0.6180339887) % 1);
              const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
              cx += pl.r[0] * rho * sinPhi * Math.cos(th);
              cy += pl.r[1] * rho * cosPhi;
              cz += pl.r[2] * rho * sinPhi * Math.sin(th);
            }
          }
          const bil = !!pl.bilateral;
          const curved = key === 'hippocampus';
          put = (k) => {
            let x = 0;
            let y = 0;
            let z = 0;
            do {
              x = 2 * rnd() - 1;
              y = 2 * rnd() - 1;
              z = 2 * rnd() - 1;
            } while (x * x + y * y + z * z > 1);
            let px = cx + x * rr[0];
            let py = cy + y * rr[1];
            const pz = cz + z * rr[2];
            if (curved) {
              // the hippocampus curves upwards and inwards towards the back
              const zr = (pz - pl.c[2]) / pl.r[2];
              py += 0.1 * zr * zr * (zr < 0 ? 1.6 : 0.4);
              px -= 0.07 * (zr < 0 ? zr * zr : 0);
            }
            return [bil && k % 2 ? -px : px, py, pz];
          };
        }
        for (let k = 0; k < p.n; k++) {
          const q = put(k);
          const o = (p.start + k) * 3;
          pos[o] = q[0];
          pos[o + 1] = q[1];
          pos[o + 2] = q[2];
          col[o] = c[0] / 255;
          col[o + 1] = c[1] / 255;
          col[o + 2] = c[2] / 255;
        }
        done += p.n;
      });
    }
    // Where many cells sit close together their light would add up to a white patch. Each
    // group is therefore dimmed according to how densely it is packed as seen on the screen;
    // a cell that fires still flashes at full strength.
    info.pops.forEach((p, pi) => {
      if (!regionOfPop[pi]) return;
      let cx = 0, cy = 0, cz = 0;
      for (let i = p.start; i < p.start + p.n; i++) { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
      cx /= p.n; cy /= p.n; cz /= p.n;
      let r2 = 0;
      for (let i = p.start; i < p.start + p.n; i++) r2 += (pos[i * 3] - cx) ** 2 + (pos[i * 3 + 1] - cy) ** 2 + (pos[i * 3 + 2] - cz) ** 2;
      r2 = Math.max(0.0006, r2 / p.n);
      const f = Math.min(1, Math.max(0.16, Math.sqrt(DENSITY / (p.n / r2))));
      for (let i = p.start * 3; i < (p.start + p.n) * 3; i++) col[i] *= f;
    });
    const fill = (name: string, data: Float32Array, usage: number = gl.STATIC_DRAW): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    };
    fill('pos', pos);
    fill('col', col);
    fill('glow', this.glow, gl.DYNAMIC_DRAW);

    const rnd = rand(777);
    const at = (i: number): V3 => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const member = (pi: number): number => info.pops[pi].start + Math.floor(rnd() * info.pops[pi].n);
    const dyn: number[] = [];
    const seg = (p: V3, q: V3): void => {
      dyn.push(p[0], p[1], p[2], q[0], q[1], q[2]);
    };

    // stars: from one cell of a group to cells of the same group nearby
    this.stars = [];
    info.pops.forEach((p, pi) => {
      if (!regionOfPop[pi]) return;
      const hubs = Math.min(10, Math.max(1, Math.round(p.n / 140)));
      const first = dyn.length / 3;
      for (let h = 0; h < hubs; h++) {
        const c = at(member(pi));
        let made = 0;
        for (let tries = 0; tries < 40 && made < 9; tries++) {
          const q = at(member(pi));
          const d = Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]);
          if (d > 0.005 && d < 0.3) {
            seg(c, q);
            made++;
          }
        }
      }
      const count = dyn.length / 3 - first;
      if (count > 0) this.stars.push({ pop: pi, first, count });
    });

    // tracts between regions, each drawn as a few fibres from cell to cell
    const bundles = new Map<string, Tract3 & { targets: number[] }>();
    for (const [pre, post, inh] of info.projs) {
      const a = regionOfPop[pre];
      const b = regionOfPop[post];
      if (!a || !b || a === b) continue;
      const key = `${a}>${b}>${inh}`;
      let t = bundles.get(key);
      if (!t) {
        t = { inh: inh === 1, family: FAMILY_OF.get(a) ?? 0, sources: [], targets: [], n: 0, fibres: [], first: 0, rate: 0, spikes: 0 };
        bundles.set(key, t);
      }
      if (!t.sources.includes(pre)) {
        t.sources.push(pre);
        t.n += info.pops[pre].n;
      }
      if (!t.targets.includes(post)) t.targets.push(post);
    }
    this.tracts = [...bundles.values()];
    for (const t of this.tracts) {
      const k = Math.min(7, Math.max(2, Math.round(t.n / 60)));
      t.first = dyn.length / 3;
      for (let f = 0; f < k; f++) {
        const A = at(member(t.sources[Math.floor(rnd() * t.sources.length)]));
        const targets = (t as Tract3 & { targets: number[] }).targets;
        const B = at(member(targets[Math.floor(rnd() * targets.length)]));
        // long fibres run through the brainstem and the cord rather than through the air
        const mid: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
        const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
        const pull = Math.min(1, len / 1.5);
        const s = stemAt(Math.max(-1.6, Math.min(1.3, mid[1])));
        const j = 0.12 * len;
        const c: V3 = [mid[0] * (1 - 0.7 * pull) + j * (rnd() - 0.5), mid[1] + j * (rnd() - 0.5), mid[2] * (1 - 0.7 * pull) + s.z * 0.7 * pull + j * (rnd() - 0.5)];
        const fibre = { a: A, c, b: B };
        t.fibres.push(fibre);
        let prev = A;
        for (let i = 1; i <= SEG; i++) {
          const q = bezier(fibre, i / SEG);
          seg(prev, q);
          prev = q;
        }
      }
    }
    this.dynLines = dyn.length / 3;
    this.dynCol = new Float32Array(this.dynLines * 4);
    fill('dynPos', new Float32Array(dyn));
    fill('dynCol', this.dynCol, gl.DYNAMIC_DRAW);
  }

  /** a small key to the colours, with a live bar for each family */
  private buildLegend(): void {
    this.legendBars = [];
    if (!this.legend) return;
    this.legend.textContent = '';
    FAMILIES.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'lg';
      const dot = document.createElement('i');
      dot.style.background = `rgb(${f.color.join(',')})`;
      dot.style.boxShadow = `0 0 8px rgb(${f.color.join(',')})`;
      const name = document.createElement('span');
      name.textContent = f.name;
      const bar = document.createElement('b');
      const fillEl = document.createElement('u');
      fillEl.style.background = `rgb(${f.color.join(',')})`;
      bar.appendChild(fillEl);
      row.append(dot, name, bar);
      this.legend!.appendChild(row);
      this.legendBars.push(fillEl);
    });
  }

  addActivity(act: Uint8Array, dtSim: number): void {
    if (!this.open || !this.info || act.length !== this.glow.length) return;
    const g = this.glow;
    for (let i = 0; i < g.length; i++) {
      const a = act[i];
      if (a > 0) {
        const v = g[i] + a;
        g[i] = v > 6 ? 6 : v;
      }
    }
    if (dtSim <= 0) return;
    const pops = this.info.pops;
    const fam = new Float32Array(FAMILIES.length);
    for (let p = 0; p < pops.length; p++) {
      let s = 0;
      const end = pops[p].start + pops[p].n;
      for (let i = pops[p].start; i < end; i++) s += act[i];
      this.popSpikes[p] = s;
      this.popRate[p] += (s / pops[p].n / dtSim - this.popRate[p]) * 0.25;
      if (this.familyOfPop[p] >= 0) fam[this.familyOfPop[p]] += s;
    }
    for (let f = 0; f < fam.length; f++) {
      if (this.familyCells[f] > 0) this.familyRate[f] += (fam[f] / this.familyCells[f] / dtSim - this.familyRate[f]) * 0.15;
    }
    for (const t of this.tracts) {
      let s = 0;
      for (const p of t.sources) s += this.popSpikes[p];
      t.spikes += s;
      t.rate += (s / t.n / dtSim - t.rate) * 0.2;
    }
  }

  private camera(aspect: number): void {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const spt = Math.sin(this.pitch);
    const target: V3 = [0, this.targetY, -0.05];
    const eye: V3 = [target[0] + this.dist * cp * sy, target[1] + this.dist * spt, target[2] + this.dist * cp * cy];
    const f: V3 = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(f[0], f[1], f[2]);
    f[0] /= fl;
    f[1] /= fl;
    f[2] /= fl;
    const s: V3 = [-f[2], 0, f[0]]; // f × up, with up = (0, 1, 0)
    const sl = Math.hypot(s[0], s[2]) || 1;
    s[0] /= sl;
    s[2] /= sl;
    const u: V3 = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const near = 0.1;
    const far = 40;
    const t = 1 / Math.tan(0.7 / 2);
    const m = this.mvp;
    const v = [
      s[0], u[0], -f[0], 0,
      s[1], u[1], -f[1], 0,
      s[2], u[2], -f[2], 0,
      -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1,
    ];
    const p = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += p[k * 4 + r] * v[c * 4 + k];
        m[c * 4 + r] = sum;
      }
    }
  }

  draw(): void {
    const gl = this.gl;
    if (!gl || !this.open || !this.info) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width * dpr));
    const h = Math.max(10, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // slow turn while nobody is touching it; the camera glides to where it was sent
    if (!this.dragging && performance.now() - this.lastInteraction > 2500) this.yaw += 0.0014;
    this.dist += (this.goal.dist - this.dist) * 0.08;
    this.targetY += (this.goal.y - this.targetY) * 0.08;
    this.camera(w / h);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.012, 0.016, 0.027, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const aperture = h * 0.026;
    const scale = h * 0.022;

    // ---- lines ----
    const lp = this.lineProg!;
    gl.useProgram(lp);
    gl.disableVertexAttribArray(2);
    gl.uniformMatrix4fv(gl.getUniformLocation(lp, 'uMVP'), false, this.mvp);
    gl.uniform1f(gl.getUniformLocation(lp, 'uFocus'), this.dist);
    // the web in the dust, then the skeleton (a little brighter when the cord is busy)
    this.attrib(lp, 'aPos', this.buf.staticPos, 3);
    this.attrib(lp, 'aCol', this.buf.staticCol, 4);
    gl.uniform1f(gl.getUniformLocation(lp, 'uGain'), 1);
    gl.drawArrays(gl.LINES, 0, this.skeletonFirst);
    gl.uniform1f(gl.getUniformLocation(lp, 'uGain'), 0.75 + Math.min(0.6, this.familyRate[F_CORD] / 60));
    gl.drawArrays(gl.LINES, this.skeletonFirst, this.staticLines - this.skeletonFirst);
    // stars and fibres: brightness is firing rate
    const dc = this.dynCol;
    for (const st of this.stars) {
      const c = FAMILIES[this.familyOfPop[st.pop]].color;
      const a = 0.025 + 0.4 * Math.min(1, this.popRate[st.pop] / 70);
      for (let k = st.first; k < st.first + st.count; k++) {
        dc[k * 4] = c[0] / 255;
        dc[k * 4 + 1] = c[1] / 255;
        dc[k * 4 + 2] = c[2] / 255;
        // bright at the hub, fading along the ray
        dc[k * 4 + 3] = k % 2 === 0 ? a : a * 0.25;
      }
    }
    this.tracts.forEach((t, ti) => {
      const c = FAMILIES[t.family].color;
      const a = 0.03 + 0.42 * Math.min(1, t.rate / 60);
      const r = t.inh ? 0.45 : 0.55 + 0.45 * (c[0] / 255);
      const g = t.inh ? 0.62 : 0.55 + 0.45 * (c[1] / 255);
      const b = t.inh ? 1.0 : 0.55 + 0.45 * (c[2] / 255);
      const end = t.first + t.fibres.length * SEG * 2;
      for (let k = t.first; k < end; k++) {
        dc[k * 4] = r;
        dc[k * 4 + 1] = g;
        dc[k * 4 + 2] = b;
        dc[k * 4 + 3] = a;
      }
      if (t.spikes > 0 && this.sparks.length < MAX_SPARKS) {
        const expected = t.spikes * 0.004;
        let k = Math.floor(expected);
        if (Math.random() < expected - k) k++;
        for (let j = 0; j < k && j < 3; j++) this.sparks.push({ tract: ti, fibre: Math.floor(Math.random() * t.fibres.length), t: 0, speed: 0.025 + Math.random() * 0.02 });
      }
      t.spikes = 0;
    });
    this.attrib(lp, 'aPos', this.buf.dynPos, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.dynCol);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dc);
    this.attrib(lp, 'aCol', this.buf.dynCol, 4);
    gl.uniform1f(gl.getUniformLocation(lp, 'uGain'), 1);
    gl.drawArrays(gl.LINES, 0, this.dynLines);

    // ---- points ----
    const pp = this.pointProg!;
    gl.useProgram(pp);
    const U = (n: string): WebGLUniformLocation | null => gl.getUniformLocation(pp, n);
    gl.uniformMatrix4fv(U('uMVP'), false, this.mvp);
    gl.uniform1f(U('uFocus'), this.dist);
    gl.uniform1f(U('uAperture'), aperture);
    // the dust: every colour family glows with the firing rate of its cells
    gl.uniform1f(U('uScale'), scale);
    gl.uniform1f(U('uBase'), 0.36);
    gl.uniform1f(U('uPulse'), 0);
    gl.uniform1f(U('uHalo'), 0);
    this.attrib(pp, 'aPos', this.buf.dustPos, 3);
    this.attrib(pp, 'aCol', this.buf.dustCol, 3);
    this.attrib(pp, 'aGlow', this.buf.dustGlow, 1);
    this.dustRanges.forEach(([first, count], fam) => {
      gl.uniform1f(U('uGain'), 0.8 + 1.3 * Math.min(1, this.familyRate[fam] / (fam === F_PARIETAL ? 4 : 30)));
      gl.drawArrays(gl.POINTS, first, count);
    });
    // the neurons
    gl.uniform1f(U('uBase'), 0.3);
    gl.uniform1f(U('uPulse'), 1);
    gl.uniform1f(U('uGain'), 1);
    this.attrib(pp, 'aPos', this.buf.pos, 3);
    this.attrib(pp, 'aCol', this.buf.col, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.glow);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glow);
    this.attrib(pp, 'aGlow', this.buf.glow, 1);
    gl.drawArrays(gl.POINTS, 0, this.glow.length);
    gl.uniform1f(U('uHalo'), 0.014);
    gl.drawArrays(gl.POINTS, 0, this.glow.length);
    gl.uniform1f(U('uHalo'), 0);
    const g = this.glow;
    for (let i = 0; i < g.length; i++) g[i] = g[i] < 0.05 ? 0 : g[i] * 0.66;
    // sparks: a sample of the spikes on their way
    let ns = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.t += s.speed;
      const t = this.tracts[s.tract];
      if (s.t >= 1 || !t || !t.fibres[s.fibre]) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      if (ns >= MAX_SPARKS) continue;
      this.sparkPos.set(bezier(t.fibres[s.fibre], s.t), ns * 3);
      this.sparkCol[ns * 3] = t.inh ? 0.45 : 1;
      this.sparkCol[ns * 3 + 1] = t.inh ? 0.66 : 0.9;
      this.sparkCol[ns * 3 + 2] = t.inh ? 1 : 0.7;
      ns++;
    }
    if (ns > 0) {
      const dynFill = (name: string, data: Float32Array): void => {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      };
      dynFill('sparkPos', this.sparkPos);
      this.attrib(pp, 'aPos', this.buf.sparkPos, 3);
      dynFill('sparkCol', this.sparkCol);
      this.attrib(pp, 'aCol', this.buf.sparkCol, 3);
      dynFill('sparkGlow', this.sparkGlow);
      this.attrib(pp, 'aGlow', this.buf.sparkGlow, 1);
      gl.drawArrays(gl.POINTS, 0, ns);
    }

    // ---- the key: a live bar for every colour ----
    if (this.frame++ % 8 === 0) {
      this.legendBars.forEach((el, f) => {
        el.style.width = `${Math.round(Math.min(1, Math.sqrt(this.familyRate[f] / (f === F_PARIETAL ? 6 : 60))) * 100)}%`;
      });
    }
  }

  private attrib(prog: WebGLProgram, name: string, buf: WebGLBuffer | null, size: number): void {
    const gl = this.gl!;
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
}

void F_STEM;
void F_OCCIPITAL;
void F_FRONTAL;
void F_TEMPORAL;
void F_CEREBELLUM;
