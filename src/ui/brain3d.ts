// The nervous system as a cloud of light.
//
// Every neuron of the simulation is one point, placed where its biological counterpart
// sits: body-sense cortex behind the central sulcus (the left leg in the right hemisphere),
// visual cortex at the back, hippocampus and amygdala deep in the temporal lobes, basal
// ganglia and thalamus in the middle, dopamine cells in the midbrain, the spinal cord
// running down inside the vertebrae with the nerves of the legs beside it.
//
// What is real activity:
//  - a neuron's point flares up when that neuron fires and fades within about a tenth of a second
//  - the fibres are a sample of about 5000 synapses that really exist, each drawn from its
//    sending cell to its receiving cell; a fibre lights up at the moment its sending cell fires
//  - an impulse (a point with a short tail) is one real spike travelling along one of those
//    real synapses, started in the frame the spike arrives from the simulation; it ends in a
//    small flash at the receiving cell
//  - the faint dust that gives the brain its shape carries no data of its own; each grain
//    glows with the present firing rate of the group of cells it lies next to
//  - the star of fine lines around a group of cells brightens with that group's firing rate
//  - a ring of light that spreads through the cloud marks a real event (a content entering the
//    global workspace, the onset of pain, a cookie eaten) at the place where it happens
//
// What is not shown as it is: an impulse takes 1-8 ms in the simulation and is drawn about a
// hundred times slower; a synapse shows at most one impulse every 0.3 s and at most 1500 are
// under way at once, so at high firing rates only a part of the spikes gets an impulse.
//
// What is decoration: the shape itself (made from formulas, not a scanned brain), the course
// a fibre takes between its two cells, the vertebrae and ribs, the web of fine lines in the
// dust, the specks floating in the room, the slow drift and twinkling of the dust, the way a
// ring spreads, the gathering of the cloud at the start, and everything the camera and the
// "film" do: depth of field, glow around bright light, vignette, grain, and the camera
// moving by itself.
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
  | { kind: 'cortex'; patch: [number, number, number, number]; sides: 'both' | 'cross'; anchor: V3; split?: boolean; mix?: boolean }
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
  // The areas that concern the creature itself lie on the inner wall of the hemispheres:
  // the core at the back (precuneus), self-monitoring at the front (anterior cingulate).
  // Agency sits where temporal and parietal lobe meet, the insula deep in the side.
  selfcore: { kind: 'cortex', patch: [1.72, 2.5, 2.6, 3.7], sides: 'both', anchor: [0, 1.9, -0.6], mix: true },
  monitor: { kind: 'cortex', patch: [0.72, 1.5, 2.6, 3.7], sides: 'both', anchor: [0, 1.9, 0.5], split: true },
  agency: { kind: 'cortex', patch: [2.0, 2.45, -0.35, 0.45], sides: 'both', anchor: [0, 1.5, -0.6], split: true },
  insula: { kind: 'nucleus', c: [0.38, 1.6, -0.1], r: [0.045, 0.1, 0.2], bilateral: true, along: 2 },
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
  { name: 'Selbst · Befinden', color: [214, 255, 110], regions: ['selfcore', 'monitor', 'agency', 'insula'] },
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

const SEG = 8; // line segments per fibre
/** cells per unit of area (as seen on screen) up to which a group is shown at full brightness */
const DENSITY = 2600;
/** at most this many impulses are shown on their way at the same time */
const MAX_SPARKS = 1500;
/** an impulse is drawn as it travels along its synapse at this speed [units/s]; in the
 *  simulation the trip takes 1–8 ms, so this is slowed down roughly a hundredfold */
const IMPULSE_SPEED = 2.4;
/** a synapse shows a new impulse at the earliest this long after its last one [s] */
const IMPULSE_GAP = 0.3;
/** how long the flash at the receiving end of a synapse lasts [s] */
const BURST = 0.14;

const VS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aGlow;
uniform mat4 uMVP;
uniform float uScale, uBase, uGain, uPulse, uHalo, uFocus, uAperture, uTime, uAssemble, uDrift, uWaves, uBoost;
uniform vec4 uWaveO[4];
uniform vec4 uWaveC[4];
varying vec3 vCol; varying float vA, vBlur, vFlash;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float h = hash(aPos);
  // every grain drifts a little, each in its own slow rhythm
  vec3 pos = aPos + uDrift * 0.011 * vec3(sin(uTime * 0.7 + h * 40.0), sin(uTime * 0.9 + h * 71.0), sin(uTime * 0.6 + h * 23.0));
  // at the start the cloud gathers from far away
  float e = clamp(uAssemble * 1.4 - h * 0.4, 0.0, 1.0);
  e = 1.0 - pow(1.0 - e, 3.0);
  vec3 dir = normalize(vec3(hash(aPos.yzx) - 0.5, hash(aPos.zxy) - 0.5, hash(aPos + 3.1) - 0.5) + 0.001);
  pos = mix(aPos * 0.25 + dir * (3.0 + 3.5 * h) + vec3(0.0, 0.5, 0.0), pos, e);
  vec4 p = uMVP * vec4(pos, 1.0);
  gl_Position = p;
  float g = min(aGlow, 4.0);
  // rings of light that spread from the place of an event
  float wave = 0.0;
  vec3 wcol = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float age = uTime - uWaveO[i].w;
    if (age > 0.0 && age < 3.2) {
      float ph = age * 1.7 - distance(aPos, uWaveO[i].xyz);
      float ring = (exp(-ph * ph * 26.0) + 0.25 * exp(-ph * ph * 2.5) * step(0.0, ph)) * uWaveC[i].a * (1.0 - age / 3.2) * uWaves;
      wave += ring;
      wcol += ring * uWaveC[i].rgb;
    }
  }
  float twinkle = 0.78 + 0.22 * sin(uTime * (0.8 + 2.2 * h) + h * 50.0);
  // a cell at rest is a dim point; at a spike it flares up to several times that
  // (a little less where cells are packed densely, so that a nucleus does not burn out)
  float flash = clamp(g - 1.0, 0.0, 2.0);
  float dens = clamp(max(aCol.r, max(aCol.g, aCol.b)) * 1.1, 0.3, 1.0);
  float lit = 0.1 + 0.9 * min(g, 1.0) + uBoost * flash * dens;
  float bright = uGain * mix(g * twinkle, lit, uPulse) + 0.55 * wave * (1.0 - 0.6 * uPulse);
  // A point of light does not grow as much as a solid thing would when the camera comes
  // close: it stays a fine point and becomes brighter instead.
  float q = min(1.0, p.w / (0.42 * p.w + 2.3));
  bright *= inversesqrt(q);
  float size = q * uScale * (uBase + uPulse * (0.5 * min(g, 1.0) + 0.38 * flash * dens) + 0.3 * min(wave, 1.5)) / p.w;
  // second pass over the neurons: a wide soft glow around the ones that are firing
  if (uHalo > 0.0) { bright = uHalo * max(0.0, min(g, 2.5) - 0.4); size *= 6.0; }
  // depth of field: away from the plane of focus a point spreads into a dim disc
  float coc = uAperture * abs(p.w - uFocus) / max(p.w, 0.2);
  float s = size + coc;
  gl_PointSize = clamp(s, 1.0, 96.0);
  float spread = max(size, 1.0) / max(s, 1.0);
  // while the cloud is still gathering it is dimmer, so that the crowd of grains does not turn into one white patch
  vA = bright * spread * spread * min(1.0, size * size + 0.15) * smoothstep(0.0, 0.25, e) * mix(0.4, 1.0, e * e);
  vBlur = clamp(coc / max(s, 1.0), 0.0, 1.0);
  vFlash = uPulse * (1.0 - step(0.001, uHalo)) * clamp((g - 0.9) * 0.3, 0.0, 0.45) * dens;
  vCol = mix(aCol, wcol / max(wave, 0.001), clamp(wave * 0.8, 0.0, 0.8));
}`;
const FS = `
precision mediump float;
varying vec3 vCol; varying float vA, vBlur, vFlash;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float sharp = (1.0 - r) * (1.0 - r);
  // out of focus: a flat disc with a slightly brighter rim, like a lens does it
  // (it carries the same amount of light as the sharp point, only spread out)
  float disc = smoothstep(1.0, 0.8, r) * (0.26 + 0.2 * smoothstep(0.55, 0.95, r));
  float a = vA * mix(sharp, disc, vBlur);
  // a firing cell flashes towards white in its own hue, whatever its resting brightness
  vec3 c = mix(vCol, vec3(1.0), vFlash) + vFlash * 1.1 * normalize(vCol + 0.001);
  gl_FragColor = vec4(c * a, a);
}`;
const LVS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aGlow;
uniform mat4 uMVP; uniform float uFocus, uGain, uAssemble;
varying vec4 vCol;
void main() {
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  // lines fade a little with distance from the plane of focus
  float fade = clamp(1.25 - 0.9 * abs(p.w - uFocus) / uFocus, 0.25, 1.0);
  vCol = vec4(aCol, aGlow * fade * uGain * smoothstep(0.55, 1.0, uAssemble));
}`;
const LFS = `
precision mediump float;
varying vec4 vCol;
void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }`;
// ---- the picture is drawn into a buffer first and then developed like film ----
const QVS = `
attribute vec2 aPos; varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const DOWN_FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(uTex, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(uTex, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(uTex, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  gl_FragColor = vec4(max(c - uThreshold, 0.0), 1.0);
}`;
const BLUR_FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb * 0.227;
  c += (texture2D(uTex, vUv + uDir * 1.385).rgb + texture2D(uTex, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(uTex, vUv + uDir * 3.231).rgb + texture2D(uTex, vUv - uDir * 3.231).rgb) * 0.0703;
  gl_FragColor = vec4(c, 1.0);
}`;
const FINAL_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uScene, uB1, uB2, uB3;
uniform float uGrain, uExposure, uBloom, uVignette;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  // a lens separates the colours a little towards the edge
  vec2 ab = d * r2 * 0.014;
  vec3 c = vec3(texture2D(uScene, vUv + ab).r, texture2D(uScene, vUv).g, texture2D(uScene, vUv - ab).b);
  // bright light spills over into its surroundings: narrow, medium and wide glow
  vec3 bloom = texture2D(uB1, vUv).rgb * 0.5 + texture2D(uB2, vUv).rgb * 0.8 + texture2D(uB3, vUv).rgb;
  c += bloom * uBloom;
  // the room behind the brain is not quite black
  float rr = length(d * vec2(uRes.x / uRes.y, 1.0));
  c += vec3(0.009, 0.013, 0.023) + vec3(0.007, 0.015, 0.03) * (1.0 - smoothstep(0.0, 0.8, rr));
  // film response: bright parts roll off softly instead of clipping, and keep most of their colour
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722)) + 0.0001;
  vec3 white = 1.0 - exp(-c * uExposure);
  vec3 hue = min(c * ((1.0 - exp(-L * uExposure)) / L), 1.0);
  c = mix(white, hue, 0.7);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);
  c *= mix(1.0 - uVignette, 1.0, smoothstep(1.0, 0.25, length(d) * 1.2));
  c += (hash(vUv * uRes + uGrain * 91.7) - 0.5) * 0.02;
  gl_FragColor = vec4(c, 1.0);
}`;

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

/** specks floating in the room around the brain; out of focus they become soft discs of light */
function buildMotes(): { pos: Float32Array; col: Float32Array; glow: Float32Array } {
  const rnd = rand(4711);
  const n = 520;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const glow = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = 2 * rnd() - 1;
    const th = rnd() * Math.PI * 2;
    const r = 1.9 + 4.6 * Math.cbrt(rnd());
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(th);
    pos[i * 3 + 1] = 0.4 + r * u * 0.7;
    pos[i * 3 + 2] = r * s * Math.sin(th);
    const warm = rnd() < 0.2;
    col[i * 3] = warm ? 0.9 : 0.42;
    col[i * 3 + 1] = warm ? 0.7 : 0.62;
    col[i * 3 + 2] = warm ? 0.5 : 0.9;
    glow[i] = 0.22 + 0.6 * rnd() * rnd();
  }
  return { pos, col, glow };
}

const VIEWS: Record<string, { y: number; dist: number }> = {
  all: { y: 0.55, dist: 5.6 },
  brain: { y: 1.38, dist: 3.1 },
  cord: { y: -0.7, dist: 3.3 },
};

/** the shots the camera moves through on its own in the cinema view:
 *  height it looks at, distance, tilt, turning speed [rad/s] and how long it stays [s] */
const SHOTS: { y: number; dist: number; pitch: number; turn: number; hold: number }[] = [
  { y: 0.55, dist: 5.4, pitch: 0.08, turn: 0.1, hold: 13 }, // the whole nervous system
  { y: 1.45, dist: 2.7, pitch: 0.16, turn: 0.15, hold: 12 }, // around the brain
  { y: 1.5, dist: 3.2, pitch: 1.0, turn: 0.09, hold: 9 }, // from above
  { y: -0.65, dist: 3.0, pitch: -0.04, turn: 0.16, hold: 10 }, // along the cord
  { y: 1.58, dist: 1.75, pitch: 0.3, turn: 0.19, hold: 9 }, // very close
  { y: 0.75, dist: 6.6, pitch: -0.32, turn: 0.07, hold: 9 }, // wide, from below
];
export const SHOT_BRAIN = 1;
export const SHOT_CORD = 3;

/** number of points drawn for one spark: its head and the tail behind it */
const TRAIL = 7;
const TRAIL_GLOW = [2.2, 0.8, 0.55, 0.38, 0.25, 0.15, 0.08];
/** the picture is never rendered with more pixels than this (about 2560 × 1440) */
const MAX_PIXELS = 3_700_000;

interface Target {
  fb: WebGLFramebuffer | null;
  tex: WebGLTexture | null;
  w: number;
  h: number;
}

export class Brain3D {
  private readonly gl: WebGLRenderingContext | null;
  private info: BrainInfo | null = null;
  private pointProg: WebGLProgram | null = null;
  private lineProg: WebGLProgram | null = null;
  private downProg: WebGLProgram | null = null;
  private blurProg: WebGLProgram | null = null;
  private finalProg: WebGLProgram | null = null;
  private readonly locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private readonly buf: Record<string, WebGLBuffer | null> = {};
  // the dust: where each grain is, how bright it is by itself, which group of cells it lies
  // next to (-1 = none) and which colour family it belongs to
  private dustPos: Float32Array = new Float32Array(0);
  private dustBase: Float32Array = new Float32Array(0);
  private dustLive = new Float32Array(0);
  private dustPop = new Int16Array(0);
  private dustFam = new Int8Array(0);
  private motes = 0;
  private staticLines = 0;
  private skeletonFirst = 0;
  private glow = new Float32Array(0);
  private popSpikes = new Float32Array(0);
  private popRate = new Float32Array(0);
  private familyOfPop = new Int8Array(0);
  private readonly familyRate = new Float32Array(FAMILIES.length);
  private readonly familyCells = new Float32Array(FAMILIES.length);
  private readonly regionCentre = new Map<string, V3>();
  private stars: Star[] = [];
  private dynA = new Float32Array(0);
  private dynLines = 0;
  private starLines = 0;
  /** firing rate of every group of cells, following within about 70 ms [Hz] */
  private popFast = new Float32Array(0);
  private popGain = new Float32Array(0);
  // the sampled synapses ("fibres"): three control points each, colour of their impulses,
  // how long an impulse is under way, how far apart the points of its tail are, how brightly
  // the line glows right now, and when it may show its next impulse
  private nFibres = 0;
  private fibreCtl = new Float32Array(0);
  private fibreCol = new Float32Array(0);
  private fibreDur = new Float32Array(0);
  private fibreStep = new Float32Array(0);
  private fibreGlow = new Float32Array(0);
  private fibreFree = new Float32Array(0);
  /** for every neuron: the fibres that start at it (preList[preStart[i] .. preStart[i + 1]]) */
  private preStart = new Int32Array(1);
  private preList = new Int32Array(0);
  // impulses under way: which fibre, and for how long already [s]
  private readonly spFibre = new Int32Array(MAX_SPARKS);
  private readonly spAge = new Float32Array(MAX_SPARKS);
  private nSp = 0;
  private readonly sparkPos = new Float32Array(MAX_SPARKS * (TRAIL + 1) * 3);
  private readonly sparkCol = new Float32Array(MAX_SPARKS * (TRAIL + 1) * 3);
  private readonly sparkGlow = new Float32Array(MAX_SPARKS * (TRAIL + 1));
  private readonly burstPos = new Float32Array(MAX_SPARKS * 3);
  private readonly burstCol = new Float32Array(MAX_SPARKS * 3);
  private readonly burstGlow = new Float32Array(MAX_SPARKS);
  private legendBars: HTMLElement[] = [];
  private frame = 0;
  // time
  private time = 0;
  private last = 0;
  private assembleStart = -1;
  // rings of light
  private readonly waveO = new Float32Array(16).fill(-100);
  private readonly waveC = new Float32Array(16);
  private waveNext = 0;
  // the film developing
  private texType = 0;
  private hdr = false;
  private postOk = false;
  private post: { w: number; h: number; scene: Target; levels: [Target, Target][] } | null = null;
  // camera
  private yaw = 0.9;
  private yawVel = 0;
  private readonly cam = { dist: 5.6, y: 0.55, pitch: 0.08, focus: 5.6 };
  private readonly vel = { dist: 0, y: 0, pitch: 0, focus: 0 };
  private goal = { y: 0.55, dist: 5.6 };
  private goalPitch = 0.08;
  private dragging = false;
  private lastInteraction = 0;
  private shot = 0;
  private shotStart = 0;
  private fit = 1;
  private readonly mvp = new Float32Array(16);
  // how much of the full resolution is rendered (lowered by itself on a slow device)
  private quality = 1;
  private slow = 0;
  private slowFrames = 0;
  private readonly adaptive: boolean;
  /** where the time for the animations comes from, if not from the wall clock (used for recording clips frame by frame) */
  private readonly clock: (() => number) | null;
  open = false;
  /** the full-screen view: stronger depth of field, and the camera may direct itself */
  cinema = false;
  /** in the cinema view: the camera moves from shot to shot on its own */
  director = true;
  /** false if the browser offers no WebGL */
  readonly supported: boolean;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly legend: HTMLElement | null = null, opts: { ldr?: boolean; fullQuality?: boolean; clock?: () => number } = {}) {
    this.adaptive = !opts.fullQuality;
    this.clock = opts.clock ?? null;
    this.gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    this.supported = !!this.gl;
    if (this.gl) this.initGl(this.gl, !!opts.ldr);
    let px = 0;
    let py = 0;
    let pinch = 0;
    let lastMove = 0;
    const pts = new Map<number, [number, number]>();
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      this.dragging = true;
      this.yawVel = 0;
      px = e.clientX;
      py = e.clientY;
      pinch = 0;
      lastMove = performance.now();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const now = performance.now();
      this.lastInteraction = now;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) this.goal.dist = this.cam.dist = Math.min(12, Math.max(1.3, (this.cam.dist * pinch) / d));
        pinch = d;
        return;
      }
      const dYaw = (e.clientX - px) * 0.008;
      this.yaw += dYaw;
      // the brain keeps turning for a moment after it is let go
      const dtm = Math.max(8, now - lastMove) / 1000;
      this.yawVel = Math.max(-6, Math.min(6, 0.5 * this.yawVel + 0.5 * (dYaw / dtm)));
      lastMove = now;
      this.cam.pitch = this.goalPitch = Math.min(1.3, Math.max(-1.3, this.cam.pitch + (e.clientY - py) * 0.006));
      this.vel.pitch = 0;
      px = e.clientX;
      py = e.clientY;
    });
    const up = (e: PointerEvent): void => {
      pts.delete(e.pointerId);
      pinch = 0;
      this.dragging = pts.size > 0;
      if (performance.now() - lastMove > 90) this.yawVel = 0;
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

  /** in the cinema view: go to one of the shots now and let the camera carry on from there */
  cut(shot: number): void {
    if (shot < 0 || shot >= SHOTS.length) return;
    this.shot = shot;
    this.shotStart = this.time;
    this.lastInteraction = 0;
  }

  /** let the cloud gather once more, as at the start */
  intro(): void {
    this.assembleStart = this.time;
    this.shot = 0;
    this.shotStart = this.time;
  }

  /** A ring of light that spreads from a region. It marks a real event at the place where it
   *  happens; the spreading itself is illustration, not a measured wave of activity.
   *  color: 0..255; shot: a shot the directing camera should cut to (if it has held its current one long enough) */
  pulse(region: string, color: V3, strength = 1, shot = -1): void {
    if (!this.open || !this.info) return;
    const c = this.regionCentre.get(region) ?? [0, 1.4, 0];
    const k = this.waveNext;
    this.waveNext = (k + 1) % 4;
    this.waveO.set([c[0], c[1], c[2], this.time], k * 4);
    this.waveC.set([color[0] / 255, color[1] / 255, color[2] / 255, strength], k * 4);
    if (shot >= 0 && shot !== this.shot && this.cinema && this.director && this.time - this.shotStart > 4) {
      this.shot = shot;
      this.shotStart = this.time;
    }
  }

  private u(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.locs.get(prog);
    if (!m) this.locs.set(prog, (m = new Map()));
    let l = m.get(name);
    if (l === undefined) m.set(name, (l = this.gl!.getUniformLocation(prog, name)));
    return l;
  }

  private initGl(gl: WebGLRenderingContext, forceLdr: boolean): void {
    const compile = (vs: string, fs: string): WebGLProgram => {
      const prog = gl.createProgram()!;
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      }
      // fixed attribute slots, so that the unused ones can be switched off
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.bindAttribLocation(prog, 1, 'aCol');
      gl.bindAttribLocation(prog, 2, 'aGlow');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
      return prog;
    };
    this.pointProg = compile(VS, FS);
    this.lineProg = compile(LVS, LFS);
    this.downProg = compile(QVS, DOWN_FS);
    this.blurProg = compile(QVS, BLUR_FS);
    this.finalProg = compile(QVS, FINAL_FS);
    for (const k of ['pos', 'col', 'glow', 'dustPos', 'dustCol', 'dustGlow', 'motePos', 'moteCol', 'moteGlow', 'staticPos', 'staticCol', 'staticA', 'dynPos', 'dynCol', 'dynA', 'sparkPos', 'sparkCol', 'sparkGlow', 'quad']) this.buf[k] = gl.createBuffer();
    gl.disable(gl.DEPTH_TEST);
    const fill = (name: string, data: Float32Array, usage: number = gl.STATIC_DRAW): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    };
    // one triangle that covers the screen, for the steps after the scene is drawn
    fill('quad', new Float32Array([-1, -1, 3, -1, -1, 3]));
    // the dust, its web, the specks in the room and the skeleton never change
    const dust = buildDust();
    this.dustPos = dust.pos;
    this.dustBase = dust.glow;
    this.dustLive = new Float32Array(dust.glow.length);
    this.dustPop = new Int16Array(dust.glow.length).fill(-1);
    this.dustFam = new Int8Array(dust.glow.length);
    dust.ranges.forEach(([first, count], fam) => this.dustFam.fill(fam, first, first + count));
    fill('dustPos', dust.pos);
    fill('dustCol', dust.col);
    fill('dustGlow', this.dustLive, gl.DYNAMIC_DRAW);
    const motes = buildMotes();
    this.motes = motes.glow.length;
    fill('motePos', motes.pos);
    fill('moteCol', motes.col);
    fill('moteGlow', motes.glow);
    const lines = [...dust.web];
    this.skeletonFirst = lines.length / 7;
    lines.push(...buildSkeleton());
    this.staticLines = lines.length / 7;
    const sp = new Float32Array(this.staticLines * 3);
    const sc = new Float32Array(this.staticLines * 3);
    const sa = new Float32Array(this.staticLines);
    for (let i = 0; i < this.staticLines; i++) {
      sp.set(lines.slice(i * 7, i * 7 + 3), i * 3);
      sc.set(lines.slice(i * 7 + 3, i * 7 + 6), i * 3);
      sa[i] = lines[i * 7 + 6];
    }
    fill('staticPos', sp);
    fill('staticCol', sc);
    fill('staticA', sa);

    // Can the scene be drawn into a buffer with more than 8 bits per colour? Then light can
    // really add up and is turned into a picture afterwards, as film does.
    const works = (type: number): boolean => {
      const t = this.makeTarget(4, 4, type);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      this.freeTarget(t);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    };
    const half = forceLdr ? null : gl.getExtension('OES_texture_half_float');
    const linear = forceLdr ? null : gl.getExtension('OES_texture_half_float_linear');
    if (!forceLdr) gl.getExtension('EXT_color_buffer_half_float');
    if (half && linear && works(half.HALF_FLOAT_OES)) {
      this.texType = half.HALF_FLOAT_OES;
      this.hdr = true;
      this.postOk = true;
    } else if (works(gl.UNSIGNED_BYTE)) {
      this.texType = gl.UNSIGNED_BYTE;
      this.postOk = true;
    }
  }

  private makeTarget(w: number, h: number, type: number = this.texType): Target {
    const gl = this.gl!;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }

  private freeTarget(t: Target): void {
    this.gl!.deleteFramebuffer(t.fb);
    this.gl!.deleteTexture(t.tex);
  }

  private targets(w: number, h: number): NonNullable<Brain3D['post']> {
    if (this.post && this.post.w === w && this.post.h === h) return this.post;
    if (this.post) {
      this.freeTarget(this.post.scene);
      for (const l of this.post.levels) l.forEach((t) => this.freeTarget(t));
    }
    const levels: [Target, Target][] = [];
    for (let i = 1; i <= 3; i++) {
      const lw = Math.max(2, w >> i);
      const lh = Math.max(2, h >> i);
      levels.push([this.makeTarget(lw, lh), this.makeTarget(lw, lh)]);
    }
    this.post = { w, h, scene: this.makeTarget(w, h), levels };
    return this.post;
  }

  setInfo(info: BrainInfo): void {
    this.info = info;
    this.glow = new Float32Array(info.neurons);
    this.popSpikes = new Float32Array(info.pops.length);
    this.popRate = new Float32Array(info.pops.length);
    this.familyOfPop = new Int8Array(info.pops.length).fill(-1);
    this.familyRate.fill(0);
    this.familyCells.fill(0);
    this.regionCentre.clear();
    this.nSp = 0;
    this.popFast = new Float32Array(info.pops.length);
    this.popGain = new Float32Array(info.pops.length);
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
      const centre: V3 = [0, 0, 0];
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
          } else if (pl.mix) {
            // all groups of this area share the whole patch
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
          centre[0] += q[0];
          centre[1] += q[1];
          centre[2] += q[2];
          col[o] = c[0] / 255;
          col[o + 1] = c[1] / 255;
          col[o + 2] = c[2] / 255;
        }
        done += p.n;
      });
      if (total > 0) this.regionCentre.set(key, [centre[0] / total, centre[1] / total, centre[2] / total]);
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
    const popOf = new Int16Array(info.neurons);
    info.pops.forEach((p, pi) => popOf.fill(pi, p.start, p.start + p.n));

    // Which group of cells does each grain of dust lie next to? It will glow with the firing
    // of that group; grains far from any cell glow with their colour family as a whole.
    {
      const cell = 0.11;
      const reach2 = 0.17 * 0.17;
      const grid = new Map<number, number[]>();
      const keyOf = (x: number, y: number, z: number): number => (Math.floor(x / cell) + 64) * 65536 + (Math.floor(y / cell) + 64) * 256 + Math.floor(z / cell) + 64;
      info.pops.forEach((p, pi) => {
        if (!regionOfPop[pi]) return;
        const stride = p.n > 90 ? 3 : 1;
        for (let i = p.start; i < p.start + p.n; i += stride) {
          const k = keyOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          let l = grid.get(k);
          if (!l) grid.set(k, (l = []));
          l.push(i);
        }
      });
      const dp = this.dustPos;
      for (let d = 0; d < this.dustPop.length; d++) {
        const x = dp[d * 3];
        const y = dp[d * 3 + 1];
        const z = dp[d * 3 + 2];
        let best = reach2;
        let who = -1;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const l = grid.get(keyOf(x + dx * cell, y + dy * cell, z + dz * cell));
              if (!l) continue;
              for (const i of l) {
                const r2 = (pos[i * 3] - x) ** 2 + (pos[i * 3 + 1] - y) ** 2 + (pos[i * 3 + 2] - z) ** 2;
                if (r2 < best) {
                  best = r2;
                  who = i;
                }
              }
            }
          }
        }
        this.dustPop[d] = who >= 0 ? popOf[who] : -1;
      }
    }

    const dyn: number[] = [];
    const dynCol: number[] = [];
    const seg = (p: V3, q: V3, c: number[]): void => {
      dyn.push(p[0], p[1], p[2], q[0], q[1], q[2]);
      dynCol.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    };

    // stars: from one cell of a group to cells of the same group nearby
    this.stars = [];
    info.pops.forEach((p, pi) => {
      if (!regionOfPop[pi]) return;
      const fc = FAMILIES[this.familyOfPop[pi]].color;
      const c = [fc[0] / 255, fc[1] / 255, fc[2] / 255];
      const hubs = Math.min(10, Math.max(1, Math.round(p.n / 140)));
      const first = dyn.length / 3;
      for (let h = 0; h < hubs; h++) {
        const hub = at(member(pi));
        let made = 0;
        for (let tries = 0; tries < 40 && made < 9; tries++) {
          const q = at(member(pi));
          const d = Math.hypot(q[0] - hub[0], q[1] - hub[1], q[2] - hub[2]);
          if (d > 0.005 && d < 0.3) {
            seg(hub, q, c);
            made++;
          }
        }
      }
      const count = dyn.length / 3 - first;
      if (count > 0) this.stars.push({ pop: pi, first, count });
    });
    this.starLines = dyn.length / 3;

    // Fibres: a sample of synapses that really exist, each drawn from its sending cell to its
    // receiving cell. Long ones run through the brainstem and the cord rather than through the air.
    const wires = info.wires ?? new Int32Array(0);
    const keep: number[] = [];
    for (let w = 0; w < wires.length; w += 4) {
      if (regionOfPop[popOf[wires[w]]] && regionOfPop[popOf[wires[w + 1]]]) keep.push(w);
    }
    // sorted by sending cell, so that a spike finds its fibres at once
    keep.sort((a, b) => wires[a] - wires[b]);
    const nF = keep.length;
    this.nFibres = nF;
    this.fibreCtl = new Float32Array(nF * 9);
    this.fibreCol = new Float32Array(nF * 3);
    this.fibreDur = new Float32Array(nF);
    this.fibreStep = new Float32Array(nF);
    this.fibreGlow = new Float32Array(nF);
    this.fibreFree = new Float32Array(nF);
    this.preStart = new Int32Array(info.neurons + 1);
    this.preList = new Int32Array(nF);
    keep.forEach((w, f) => {
      const pre = wires[w];
      const inh = wires[w + 3] === 1;
      this.preStart[pre + 1]++;
      this.preList[f] = f;
      const A = at(pre);
      const B = at(wires[w + 1]);
      const mid: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      const len = Math.max(0.02, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]));
      const pull = Math.min(1, Math.max(0, (len - 0.35) / 1.2));
      const st = stemAt(Math.max(-1.6, Math.min(1.3, mid[1])));
      const j = 0.14 * len;
      const C: V3 = [mid[0] * (1 - 0.7 * pull) + j * (rnd() - 0.5), mid[1] + j * (rnd() - 0.5), mid[2] * (1 - 0.7 * pull) + st.z * 0.7 * pull + j * (rnd() - 0.5)];
      this.fibreCtl.set([A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2]], f * 9);
      this.fibreDur[f] = Math.min(1.1, Math.max(0.16, len / IMPULSE_SPEED));
      this.fibreStep[f] = Math.min(0.09, 0.03 / len);
      // excitatory impulses carry the colour of the sending region, inhibitory ones are blue
      const fc = FAMILIES[this.familyOfPop[popOf[pre]]].color;
      const line = inh ? [0.4, 0.58, 1.0] : [0.3 + 0.7 * (fc[0] / 255), 0.3 + 0.7 * (fc[1] / 255), 0.3 + 0.7 * (fc[2] / 255)];
      this.fibreCol.set(inh ? [0.42, 0.64, 1.0] : [0.5 + 0.5 * (fc[0] / 255), 0.5 + 0.5 * (fc[1] / 255), 0.5 + 0.5 * (fc[2] / 255)], f * 3);
      let prev = A;
      for (let i = 1; i <= SEG; i++) {
        const t = i / SEG;
        const u = 1 - t;
        const q: V3 = [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1], u * u * A[2] + 2 * u * t * C[2] + t * t * B[2]];
        seg(prev, q, line);
        prev = q;
      }
    });
    for (let i = 0; i < info.neurons; i++) this.preStart[i + 1] += this.preStart[i];
    this.dynLines = dyn.length / 3;
    this.dynA = new Float32Array(this.dynLines);
    fill('dynPos', new Float32Array(dyn));
    fill('dynCol', new Float32Array(dynCol));
    fill('dynA', this.dynA, gl.DYNAMIC_DRAW);
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
    const ps = this.preStart;
    const fg = this.fibreGlow;
    const free = this.fibreFree;
    const now = this.time;
    let n = this.nSp;
    // When very many impulses are under way already, only a part of the new ones is shown
    // (chosen by chance, the same for all regions).
    const full = n / MAX_SPARKS;
    const accept = full < 0.4 ? 1 : Math.max(0.03, (1 - full) / 0.6);
    for (let i = 0; i < g.length; i++) {
      const a = act[i];
      if (a > 0) {
        const v = (g[i] < 1 ? 1 : g[i]) + a;
        g[i] = v > 6 ? 6 : v;
        // the synapses of this cell light up, and an impulse sets off along each
        for (let f = ps[i]; f < ps[i + 1]; f++) {
          fg[f] = 1;
          if (now >= free[f] && n < MAX_SPARKS && (accept >= 1 || Math.random() < accept)) {
            this.spFibre[n] = f;
            this.spAge[n] = 0;
            n++;
            free[f] = now + IMPULSE_GAP;
          }
        }
      }
    }
    this.nSp = n;
    if (dtSim <= 0) return;
    const pops = this.info.pops;
    const fam = new Float32Array(FAMILIES.length);
    const quick = 1 - Math.exp(-dtSim / 0.07);
    for (let p = 0; p < pops.length; p++) {
      let s = 0;
      const end = pops[p].start + pops[p].n;
      for (let i = pops[p].start; i < end; i++) s += act[i];
      const rate = s / pops[p].n / dtSim;
      this.popRate[p] += (rate - this.popRate[p]) * 0.25;
      this.popFast[p] += (rate - this.popFast[p]) * quick;
      if (this.familyOfPop[p] >= 0) fam[this.familyOfPop[p]] += s;
    }
    for (let f = 0; f < fam.length; f++) {
      if (this.familyCells[f] > 0) this.familyRate[f] += (fam[f] / this.familyCells[f] / dtSim - this.familyRate[f]) * 0.15;
    }
  }

  /** glide towards a goal without a jolt at the start or at the end */
  private glide(key: 'dist' | 'y' | 'pitch' | 'focus', goal: number, tau: number, dt: number): void {
    const omega = 2 / tau;
    const x = omega * dt;
    const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.cam[key] - goal;
    const temp = (this.vel[key] + omega * change) * dt;
    this.vel[key] = (this.vel[key] - omega * temp) * k;
    this.cam[key] = goal + (change + temp) * k;
  }

  private moveCamera(dt: number): void {
    const idle = !this.dragging && performance.now() - this.lastInteraction > (this.cinema ? 4500 : 2500);
    if (!this.dragging) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.exp(-dt / 0.45);
    }
    let tau = 0.4;
    const directing = idle && this.cinema && this.director;
    if (directing) {
      if (this.time - this.shotStart > SHOTS[this.shot].hold) {
        this.shot = (this.shot + 1) % SHOTS.length;
        this.shotStart = this.time;
      }
      const s = SHOTS[this.shot];
      this.goal.y = s.y;
      this.goal.dist = s.dist;
      this.goalPitch = s.pitch;
      this.yaw += s.turn * dt;
      tau = 2.4;
    } else if (idle) this.yaw += 0.085 * dt;
    this.glide('dist', this.goal.dist, tau, dt);
    this.glide('y', this.goal.y, tau, dt);
    if (directing) this.glide('pitch', this.goalPitch, tau, dt);
    // the focus is pulled to where the camera is heading, so the picture sharpens as it arrives
    // (close up it is set on the near side of the brain rather than on its middle)
    const near = Math.min(1, Math.max(0, (3.4 - this.goal.dist) / 1.8));
    this.glide('focus', this.goal.dist - 0.45 * near, directing ? 1.9 : 0.5, dt);
  }

  private camera(aspect: number, assemble: number): void {
    // at the start the camera comes in from further away, in an arc
    const k = (1 - assemble) * (1 - assemble);
    const yaw = this.yaw - 1.1 * k + (this.cinema ? 0.02 * Math.sin(this.time * 0.31) : 0);
    const pitch = this.cam.pitch + (this.cinema ? 0.012 * Math.sin(this.time * 0.23 + 1) : 0);
    // on an upright screen the camera steps back, so that the brain still fits in from the side
    this.fit = Math.min(1.5, Math.max(1, 0.62 / aspect));
    const dist = this.cam.dist * this.fit * (1 + 0.5 * k) * (1 + 0.012 * Math.sin(this.time * 0.42));
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const spt = Math.sin(pitch);
    const target: V3 = [0, this.cam.y, -0.05];
    const eye: V3 = [target[0] + dist * cp * sy, target[1] + dist * spt, target[2] + dist * cp * cy];
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
        for (let q = 0; q < 4; q++) sum += p[q * 4 + r] * v[c * 4 + q];
        m[c * 4 + r] = sum;
      }
    }
  }

  draw(): void {
    const gl = this.gl;
    if (!gl || !this.open || !this.info) return;
    const now = this.clock ? this.clock() : performance.now() / 1000;
    const dt = this.last ? Math.min(0.1, Math.max(this.clock ? 0 : 0.001, now - this.last)) : 0.016;
    this.last = now;
    this.time += dt;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    // If the device cannot keep up, the picture is rendered with fewer pixels (never with
    // fewer neurons): checked every 90 frames, one step down when it runs below about 22 a second.
    this.slow += dt;
    if (++this.slowFrames >= 90) {
      if (this.adaptive && this.slow / this.slowFrames > 0.045 && this.quality > 0.5) this.quality = Math.max(0.5, this.quality - 0.17);
      this.slow = 0;
      this.slowFrames = 0;
    }
    let w = rect.width * dpr * this.quality;
    let h = rect.height * dpr * this.quality;
    if (w * h > MAX_PIXELS) {
      const k = Math.sqrt(MAX_PIXELS / (w * h));
      w *= k;
      h *= k;
    }
    w = Math.max(10, Math.round(w));
    h = Math.max(10, Math.round(h));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (this.assembleStart < 0) this.assembleStart = this.time;
    const assemble = Math.min(1, (this.time - this.assembleStart) / 3.4);
    this.moveCamera(dt);
    this.camera(w / h, assemble);
    // On a screen with coarse pixels the scene is drawn larger than it is shown and scaled
    // down afterwards, which smooths the fine lines.
    let ss = this.postOk && dpr < 1.5 && this.quality === 1 ? 1.5 : 1;
    if (w * h * ss * ss > MAX_PIXELS) ss = Math.max(1, Math.sqrt(MAX_PIXELS / (w * h)));
    const sw = Math.round(w * ss);
    const sh = Math.round(h * ss);
    const post = this.postOk ? this.targets(sw, sh) : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, post ? post.scene.fb : null);
    gl.viewport(0, 0, sw, sh);
    gl.enable(gl.BLEND);
    // With the deep buffer light simply adds up. Without it, "screen" blending keeps it from
    // running into white too quickly.
    gl.blendFunc(gl.ONE, this.hdr ? gl.ONE : gl.ONE_MINUS_SRC_COLOR);
    if (post) gl.clearColor(0, 0, 0, 1);
    else gl.clearColor(0.012, 0.016, 0.027, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Close to the brain everything in front of and behind the plane of focus would blur
    // away, so the lens is stopped down there.
    const close = Math.min(1, Math.max(0, (3.4 - this.cam.dist) / 1.8));
    const aperture = sh * 0.026 * (this.cinema ? 1.15 : 1) * (1 - 0.62 * close);
    const scale = sh * 0.022;
    const focus = this.cam.focus * this.fit;

    // ---- lines ----
    const lp = this.lineProg!;
    gl.useProgram(lp);
    gl.uniformMatrix4fv(this.u(lp, 'uMVP'), false, this.mvp);
    gl.uniform1f(this.u(lp, 'uFocus'), focus);
    gl.uniform1f(this.u(lp, 'uAssemble'), assemble);
    // the web in the dust, then the skeleton (a little brighter when the cord is busy)
    this.attrib(lp, 'aPos', this.buf.staticPos, 3);
    this.attrib(lp, 'aCol', this.buf.staticCol, 3);
    this.attrib(lp, 'aGlow', this.buf.staticA, 1);
    gl.uniform1f(this.u(lp, 'uGain'), 1);
    gl.drawArrays(gl.LINES, 0, this.skeletonFirst);
    gl.uniform1f(this.u(lp, 'uGain'), 0.75 + Math.min(0.6, this.familyRate[F_CORD] / 60));
    gl.drawArrays(gl.LINES, this.skeletonFirst, this.staticLines - this.skeletonFirst);
    if (this.dynLines > 0) {
      const da = this.dynA;
      // stars: as bright as their group of cells is firing right now
      for (const st of this.stars) {
        const a = 0.02 + 0.5 * (1 - Math.exp(-this.popFast[st.pop] / 25));
        // bright at the hub, fading along the ray
        for (let k = st.first; k < st.first + st.count; k++) da[k] = k % 2 === 0 ? a : a * 0.25;
      }
      // fibres: each lights up when its sending cell fires and fades within a quarter of a second
      const fg = this.fibreGlow;
      const fade = Math.exp(-dt / 0.22);
      let k = this.starLines;
      for (let f = 0; f < this.nFibres; f++) {
        const v = fg[f];
        const a = 0.006 + 0.06 * v;
        for (const e = k + SEG * 2; k < e; k++) da[k] = a;
        fg[f] = v < 0.01 ? 0 : v * fade;
      }
      this.attrib(lp, 'aPos', this.buf.dynPos, 3);
      this.attrib(lp, 'aCol', this.buf.dynCol, 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.dynA);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, da);
      this.attrib(lp, 'aGlow', this.buf.dynA, 1);
      // a line is never thinner than one pixel, so in a small picture the same lines would
      // add up to far more light; they are dimmed accordingly
      gl.uniform1f(this.u(lp, 'uGain'), Math.min(1, Math.max(0.25, sh / 1150)));
      gl.drawArrays(gl.LINES, 0, this.dynLines);
    }

    // ---- points ----
    const pp = this.pointProg!;
    gl.useProgram(pp);
    const U = (n: string): WebGLUniformLocation | null => this.u(pp, n);
    gl.uniformMatrix4fv(U('uMVP'), false, this.mvp);
    gl.uniform1f(U('uFocus'), focus);
    gl.uniform1f(U('uAperture'), aperture);
    gl.uniform1f(U('uTime'), this.time);
    gl.uniform1f(U('uAssemble'), assemble);
    gl.uniform4fv(U('uWaveO'), this.waveO);
    gl.uniform4fv(U('uWaveC'), this.waveC);
    gl.uniform1f(U('uScale'), scale);
    gl.uniform1f(U('uPulse'), 0);
    gl.uniform1f(U('uHalo'), 0);
    gl.uniform1f(U('uBoost'), 0);
    // specks in the room
    gl.uniform1f(U('uBase'), 0.55);
    gl.uniform1f(U('uDrift'), 7);
    gl.uniform1f(U('uGain'), 10);
    gl.uniform1f(U('uWaves'), 0);
    this.attrib(pp, 'aPos', this.buf.motePos, 3);
    this.attrib(pp, 'aCol', this.buf.moteCol, 3);
    this.attrib(pp, 'aGlow', this.buf.moteGlow, 1);
    gl.drawArrays(gl.POINTS, 0, this.motes);
    // The dust: dim where nothing fires. Every grain glows with the firing rate of the group
    // of cells it lies next to (or, far from any cell, of its colour family), right now.
    {
      const k0 = this.hdr ? 1.1 : 1;
      const level = (rate: number): number => k0 * (0.6 + 2.2 * (1 - Math.exp(-rate / 14)));
      const pg = this.popGain;
      for (let p = 0; p < pg.length; p++) pg[p] = level(this.popFast[p]);
      const fgain = FAMILIES.map((_, f) => level(this.familyRate[f]));
      const dl = this.dustLive;
      const db = this.dustBase;
      const dpop = this.dustPop;
      const dfam = this.dustFam;
      for (let i = 0; i < dl.length; i++) dl[i] = db[i] * (dpop[i] >= 0 ? pg[dpop[i]] : fgain[dfam[i]]);
      gl.uniform1f(U('uBase'), 0.36);
      gl.uniform1f(U('uDrift'), 0.6);
      gl.uniform1f(U('uWaves'), 1);
      gl.uniform1f(U('uGain'), 1);
      this.attrib(pp, 'aPos', this.buf.dustPos, 3);
      this.attrib(pp, 'aCol', this.buf.dustCol, 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.dustGlow);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dl);
      this.attrib(pp, 'aGlow', this.buf.dustGlow, 1);
      gl.drawArrays(gl.POINTS, 0, dl.length);
    }
    // the neurons
    gl.uniform1f(U('uBase'), 0.25);
    gl.uniform1f(U('uDrift'), 0);
    gl.uniform1f(U('uPulse'), 1);
    gl.uniform1f(U('uGain'), this.hdr ? 0.75 : 1);
    gl.uniform1f(U('uBoost'), this.hdr ? 0.8 : 0.4);
    this.attrib(pp, 'aPos', this.buf.pos, 3);
    this.attrib(pp, 'aCol', this.buf.col, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.glow);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glow);
    this.attrib(pp, 'aGlow', this.buf.glow, 1);
    gl.drawArrays(gl.POINTS, 0, this.glow.length);
    // (with the deep buffer the glow around bright light is made afterwards, from the picture itself)
    gl.uniform1f(U('uHalo'), this.hdr ? 0.003 : 0.014);
    gl.drawArrays(gl.POINTS, 0, this.glow.length);
    gl.uniform1f(U('uHalo'), 0);
    gl.uniform1f(U('uBoost'), 0);
    // a spike is a flash of about a tenth of a second; after it the cell glows on faintly for a moment
    const g = this.glow;
    const fast = Math.exp(-dt / 0.075);
    const slow = Math.exp(-dt / 0.3);
    for (let i = 0; i < g.length; i++) {
      const v = g[i];
      if (v > 0) g[i] = v < 0.02 ? 0 : v > 0.28 ? v * fast : v * slow;
    }
    // Impulses: each one is a real spike on a real synapse, drawn with a short tail on its way
    // from the sending to the receiving cell, where it ends in a small flash.
    let ns = 0;
    let nb = 0;
    const ctl = this.fibreCtl;
    const fcol = this.fibreCol;
    for (let i = this.nSp - 1; i >= 0; i--) {
      const f = this.spFibre[i];
      const age = (this.spAge[i] += dt);
      const dur = this.fibreDur[f];
      if (age > dur + BURST || f >= this.nFibres) {
        const l = --this.nSp;
        this.spFibre[i] = this.spFibre[l];
        this.spAge[i] = this.spAge[l];
        continue;
      }
      const o = f * 9;
      const cr = fcol[f * 3];
      const cg = fcol[f * 3 + 1];
      const cb = fcol[f * 3 + 2];
      if (age >= dur) {
        this.burstPos[nb * 3] = ctl[o + 6];
        this.burstPos[nb * 3 + 1] = ctl[o + 7];
        this.burstPos[nb * 3 + 2] = ctl[o + 8];
        this.burstCol[nb * 3] = cr;
        this.burstCol[nb * 3 + 1] = cg;
        this.burstCol[nb * 3 + 2] = cb;
        this.burstGlow[nb++] = 1 - (age - dur) / BURST;
      }
      const head = age / dur;
      const step = this.fibreStep[f];
      for (let q = 0; q < TRAIL; q++) {
        const t = head - q * step;
        if (t < 0) break;
        if (t > 1) continue;
        const u = 1 - t;
        const w0 = u * u;
        const w1 = 2 * u * t;
        const w2 = t * t;
        this.sparkPos[ns * 3] = w0 * ctl[o] + w1 * ctl[o + 3] + w2 * ctl[o + 6];
        this.sparkPos[ns * 3 + 1] = w0 * ctl[o + 1] + w1 * ctl[o + 4] + w2 * ctl[o + 7];
        this.sparkPos[ns * 3 + 2] = w0 * ctl[o + 2] + w1 * ctl[o + 5] + w2 * ctl[o + 8];
        this.sparkCol[ns * 3] = cr;
        this.sparkCol[ns * 3 + 1] = cg;
        this.sparkCol[ns * 3 + 2] = cb;
        this.sparkGlow[ns++] = TRAIL_GLOW[q];
      }
    }
    if (ns + nb > 0) {
      // the flashes at the receiving ends go into the same buffers, behind the impulses
      this.sparkPos.set(this.burstPos.subarray(0, nb * 3), ns * 3);
      this.sparkCol.set(this.burstCol.subarray(0, nb * 3), ns * 3);
      this.sparkGlow.set(this.burstGlow.subarray(0, nb), ns);
      const dynFill = (name: string, data: Float32Array, len: number): void => {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]);
        gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, len), gl.DYNAMIC_DRAW);
      };
      gl.uniform1f(U('uAssemble'), 1);
      gl.uniform1f(U('uWaves'), 0);
      dynFill('sparkPos', this.sparkPos, (ns + nb) * 3);
      this.attrib(pp, 'aPos', this.buf.sparkPos, 3);
      dynFill('sparkCol', this.sparkCol, (ns + nb) * 3);
      this.attrib(pp, 'aCol', this.buf.sparkCol, 3);
      dynFill('sparkGlow', this.sparkGlow, ns + nb);
      this.attrib(pp, 'aGlow', this.buf.sparkGlow, 1);
      gl.uniform1f(U('uBase'), 0.24);
      gl.uniform1f(U('uGain'), this.hdr ? 1.15 : 1);
      gl.drawArrays(gl.POINTS, 0, ns);
      if (nb > 0) {
        gl.uniform1f(U('uBase'), 0.6);
        gl.uniform1f(U('uGain'), this.hdr ? 0.7 : 0.6);
        gl.drawArrays(gl.POINTS, ns, nb);
      }
    }

    // ---- developing the picture: glow around bright light, lens, film grain ----
    if (post) {
      gl.disable(gl.BLEND);
      gl.disableVertexAttribArray(1);
      gl.disableVertexAttribArray(2);
      gl.activeTexture(gl.TEXTURE0);
      const pass = (prog: WebGLProgram, to: Target | null, from: WebGLTexture | null): void => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fb : null);
        gl.viewport(0, 0, to ? to.w : w, to ? to.h : h);
        gl.useProgram(prog);
        this.attrib(prog, 'aPos', this.buf.quad, 2);
        gl.bindTexture(gl.TEXTURE_2D, from);
        gl.uniform1i(this.u(prog, to ? 'uTex' : 'uScene'), 0);
      };
      let src: Target = post.scene;
      post.levels.forEach(([a, b], i) => {
        pass(this.downProg!, a, src.tex);
        gl.uniform2f(this.u(this.downProg!, 'uTexel'), 1 / src.w, 1 / src.h);
        gl.uniform1f(this.u(this.downProg!, 'uThreshold'), i === 0 ? (this.hdr ? 0.7 : 0.22) : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        for (let rep = 0; rep < (i === 2 ? 2 : 1); rep++) {
          pass(this.blurProg!, b, a.tex);
          gl.uniform2f(this.u(this.blurProg!, 'uDir'), 1 / a.w, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          pass(this.blurProg!, a, b.tex);
          gl.uniform2f(this.u(this.blurProg!, 'uDir'), 0, 1 / a.h);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        src = a;
      });
      const fp = this.finalProg!;
      pass(fp, null, post.scene.tex);
      post.levels.forEach(([a], i) => {
        gl.activeTexture(gl.TEXTURE1 + i);
        gl.bindTexture(gl.TEXTURE_2D, a.tex);
        gl.uniform1i(this.u(fp, `uB${i + 1}`), i + 1);
      });
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(this.u(fp, 'uGrain'), (this.time * 7.31) % 1);
      gl.uniform1f(this.u(fp, 'uExposure'), this.hdr ? 1.15 : 1.5);
      gl.uniform1f(this.u(fp, 'uBloom'), this.hdr ? 0.42 : 0.7);
      gl.uniform1f(this.u(fp, 'uVignette'), this.cinema ? 0.6 : 0.42);
      gl.uniform2f(this.u(fp, 'uRes'), w, h);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.BLEND);
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
