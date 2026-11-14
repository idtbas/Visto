// The nervous system in three dimensions, shaped like the real thing: two folded cerebral
// hemispheres, the cerebellum behind and below them, the brainstem, and the spinal cord
// running down with its nerves. The surface is drawn like glass so that the neurons inside
// stay visible.
//
// As in the flat map, everything that moves is real activity: every dot is one neuron and
// flashes with its real spikes, the lines are the real nerve tracts and brighten with the
// firing of their source neurons, the sparks on them are a sample of the spikes travelling
// through. Drag to rotate, wheel or pinch to zoom.
//
// The regions sit where their biological counterparts are: body-sense cortex behind the
// central sulcus (the left leg in the right hemisphere), visual cortex at the back,
// hippocampus and amygdala deep in the temporal lobes, basal ganglia and thalamus in the
// middle, dopamine cells in the midbrain.
//
// Coordinates: x = left/right, y = up, z = front (the creature looks towards +z).
import type { BrainInfo } from '../sim/sim';
import type { PopInfo } from '../sim/brain/brain';
import { REGIONS, regionKeyOf } from './brainView';

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

const SEG = 14; // line segments per tract
const MAX_SPARKS = 600;

const VS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aGlow;
uniform mat4 uMVP; uniform float uScale;
varying vec3 vCol; varying float vGlow;
void main() {
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  float g = min(aGlow, 4.0);
  gl_PointSize = uScale * (0.55 + 0.85 * min(g, 1.6)) / p.w;
  vCol = aCol; vGlow = g;
}`;
const FS = `
precision mediump float;
varying vec3 vCol; varying float vGlow;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = (1.0 - r) * (1.0 - r);
  float a = (0.3 + 0.7 * min(vGlow, 1.0)) * core;
  vec3 c = mix(vCol, vec3(1.0), clamp((vGlow - 1.2) * 0.25, 0.0, 0.55));
  gl_FragColor = vec4(c * a, a);
}`;
const LVS = `
attribute vec3 aPos; attribute vec4 aCol;
uniform mat4 uMVP; varying vec4 vCol;
void main() { gl_Position = uMVP * vec4(aPos, 1.0); vCol = aCol; }`;
const LFS = `
precision mediump float; varying vec4 vCol;
void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }`;
// the surface: glass that is clear when you look straight through it and bright at the
// edges; the folds stay visible because the sulci are darker than the gyri
const MVS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aGlow;
uniform mat4 uMVP;
varying vec3 vN; varying vec3 vP; varying float vFold;
void main() { gl_Position = uMVP * vec4(aPos, 1.0); vN = aCol; vP = aPos; vFold = aGlow; }`;
const MFS = `
precision mediump float;
varying vec3 vN; varying vec3 vP; varying float vFold;
uniform vec3 uEye; uniform vec3 uTint; uniform float uAlpha;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(uEye - vP);
  float ndv = abs(dot(n, v));
  float rim = pow(1.0 - ndv, 2.2);
  if (dot(n, v) < 0.0) discard;
  float fold = smoothstep(0.2, 0.92, vFold);
  float light = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.35, 0.8, 0.45))), 0.0);
  float a = uAlpha * (0.01 + 0.17 * fold * light * (0.3 + 0.7 * ndv) + 0.34 * rim * (0.25 + 0.75 * fold));
  gl_FragColor = vec4(uTint * a, a);
}`;

interface Tract3 {
  inh: boolean;
  sources: number[];
  n: number;
  a: V3;
  c: V3;
  b: V3;
  rate: number;
  spikes: number;
}

interface Mesh {
  pos: WebGLBuffer;
  nrm: WebGLBuffer;
  fold: WebGLBuffer;
  idx: WebGLBuffer;
  count: number;
  tint: V3;
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

/** builds a closed surface from a grid of points (nu × nv, wrapping in v) */
function gridMesh(nu: number, nv: number, at: (i: number, j: number) => { p: V3; fold: number }, centre: (p: V3) => V3): { pos: Float32Array; nrm: Float32Array; fold: Float32Array; idx: Uint16Array } {
  const pos = new Float32Array((nu + 1) * nv * 3);
  const fold = new Float32Array((nu + 1) * nv);
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j < nv; j++) {
      const s = at(i, j);
      pos.set(s.p, (i * nv + j) * 3);
      fold[i * nv + j] = s.fold;
    }
  }
  const idx = new Uint16Array(nu * nv * 6);
  let k = 0;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * nv + j;
      const b = i * nv + ((j + 1) % nv);
      const c = (i + 1) * nv + j;
      const d = (i + 1) * nv + ((j + 1) % nv);
      idx[k++] = a; idx[k++] = c; idx[k++] = b;
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  // normals from the faces, pointing away from the inside
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [i0, i1, i2] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[i1] - pos[i0], uy = pos[i1 + 1] - pos[i0 + 1], uz = pos[i1 + 2] - pos[i0 + 2];
    const vx = pos[i2] - pos[i0], vy = pos[i2 + 1] - pos[i0 + 1], vz = pos[i2 + 2] - pos[i0 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [i0, i1, i2]) { nrm[i] += nx; nrm[i + 1] += ny; nrm[i + 2] += nz; }
  }
  for (let i = 0; i < pos.length; i += 3) {
    const c = centre([pos[i], pos[i + 1], pos[i + 2]]);
    let nx = nrm[i], ny = nrm[i + 1], nz = nrm[i + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (nx * (pos[i] - c[0]) + ny * (pos[i + 1] - c[1]) + nz * (pos[i + 2] - c[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    nrm[i] = nx; nrm[i + 1] = ny; nrm[i + 2] = nz;
  }
  return { pos, nrm, fold, idx };
}

export class Brain3D {
  private readonly gl: WebGLRenderingContext | null;
  private readonly labels: CanvasRenderingContext2D;
  private info: BrainInfo | null = null;
  private pointProg: WebGLProgram | null = null;
  private lineProg: WebGLProgram | null = null;
  private bufPos: WebGLBuffer | null = null;
  private bufCol: WebGLBuffer | null = null;
  private bufGlow: WebGLBuffer | null = null;
  private bufLinePos: WebGLBuffer | null = null;
  private bufLineCol: WebGLBuffer | null = null;
  private meshProg: WebGLProgram | null = null;
  private readonly meshes: Mesh[] = [];
  private eye: V3 = [0, 0, 6];
  /** draw the glass surface of the brain */
  shell = true;
  private bufSparkPos: WebGLBuffer | null = null;
  private bufSparkCol: WebGLBuffer | null = null;
  private bufSparkGlow: WebGLBuffer | null = null;
  private glow = new Float32Array(0);
  private popSpikes = new Float32Array(0);
  private tracts: Tract3[] = [];
  private lineCol = new Float32Array(0);
  private sparks: { tract: number; t: number; speed: number }[] = [];
  private readonly sparkPos = new Float32Array(MAX_SPARKS * 3);
  private readonly sparkCol = new Float32Array(MAX_SPARKS * 3);
  private readonly sparkGlow = new Float32Array(MAX_SPARKS).fill(1.6);
  private regionCentres: { title: string; c: V3; color: string }[] = [];
  // camera
  private yaw = 0.95;
  private pitch = 0.1;
  private dist = 5.6;
  private dragging = false;
  private lastInteraction = 0;
  private readonly mvp = new Float32Array(16);
  open = false;
  /** false if the browser offers no WebGL */
  readonly supported: boolean;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly labelCanvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    this.labels = labelCanvas.getContext('2d')!;
    this.supported = !!this.gl;
    if (this.gl) this.initGl(this.gl);
    let px = 0;
    let py = 0;
    let pinch = 0;
    const pts = new Map<number, [number, number]>();
    labelCanvas.addEventListener('pointerdown', (e) => {
      labelCanvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      this.dragging = true;
      px = e.clientX;
      py = e.clientY;
      pinch = 0;
    });
    labelCanvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      this.lastInteraction = performance.now();
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) this.dist = Math.min(12, Math.max(2.2, (this.dist * pinch) / d));
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
    labelCanvas.addEventListener('pointerup', up);
    labelCanvas.addEventListener('pointercancel', up);
    labelCanvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = Math.min(12, Math.max(2.2, this.dist * Math.exp(e.deltaY * 0.0012)));
        this.lastInteraction = performance.now();
      },
      { passive: false },
    );
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
    this.meshProg = compile(MVS, MFS);
    for (const k of ['bufPos', 'bufCol', 'bufGlow', 'bufLinePos', 'bufLineCol', 'bufSparkPos', 'bufSparkCol', 'bufSparkGlow'] as const) {
      this[k] = gl.createBuffer();
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    this.buildSurface(gl);
  }

  /** the glass surface of cerebrum, cerebellum, brainstem and spinal cord */
  private buildSurface(gl: WebGLRenderingContext): void {
    const add = (m: ReturnType<typeof gridMesh>, tint: V3): void => {
      const mk = (data: Float32Array | Uint16Array, target: number): WebGLBuffer => {
        const b = gl.createBuffer()!;
        gl.bindBuffer(target, b);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return b;
      };
      this.meshes.push({ pos: mk(m.pos, gl.ARRAY_BUFFER), nrm: mk(m.nrm, gl.ARRAY_BUFFER), fold: mk(m.fold, gl.ARRAY_BUFFER), idx: mk(m.idx, gl.ELEMENT_ARRAY_BUFFER), count: m.idx.length, tint });
    };
    const NA = 128;
    const NB = 104;
    for (const side of [-1, 1]) {
      add(
        gridMesh(NA, NB, (i, j) => cerebrum(side, (i / NA) * Math.PI, (j / NB) * Math.PI * 2), () => [side * HEMI_X, BRAIN_Y, 0]),
        [1.0, 0.76, 0.72],
      );
    }
    add(gridMesh(60, 80, (i, j) => cerebellum(1 - (2 * i) / 60, (j / 80) * Math.PI * 2), () => CEREBELLUM_C), [0.98, 0.66, 0.58]);
    const y0 = STEM[0][0];
    const y1 = STEM[STEM.length - 1][0];
    add(
      gridMesh(70, 20, (i, j) => {
        const y = y0 + (i / 70) * (y1 - y0);
        const s = stemAt(y);
        const ph = (j / 20) * Math.PI * 2;
        return { p: [s.rx * Math.cos(ph), y, s.z + s.rz * Math.sin(ph)], fold: 0.75 };
      }, (p) => [0, p[1], stemAt(p[1]).z]),
      [0.9, 0.8, 0.66],
    );
  }

  setInfo(info: BrainInfo): void {
    this.info = info;
    this.glow = new Float32Array(info.neurons);
    this.popSpikes = new Float32Array(info.pops.length);
    this.sparks = [];
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
    const anchors = new Map<string, V3>();
    this.regionCentres = [];
    for (const [key, list] of byRegion) {
      const pl = PLACE[key];
      const def = REGIONS.find((r) => r.key === (/^pain_[01c]$/.test(key) ? 'pain' : key));
      if (!pl || !def) continue;
      const total = list.reduce((s, i) => s + info.pops[i].n, 0);
      // where the tracts of this region start and end, and where its name is written
      let anchor = anchorOf(pl);
      let label: V3 = [anchor[0], anchor[1], anchor[2]];
      if (pl.kind === 'cortex') {
        const am = (pl.patch[0] + pl.patch[1]) / 2;
        const bm = Math.min(1.5, (pl.patch[2] + pl.patch[3]) / 2);
        const q = cerebrum(1, am, bm, 0.14).p;
        anchor = [0, q[1], q[2]];
      } else if (pl.kind === 'nucleus') label = [anchor[0], anchor[1] + pl.r[1] + 0.05, anchor[2]];
      else if (pl.kind === 'cerebellum') label = [0, CEREBELLUM_C[1] - CEREBELLUM_R[1] - 0.12, CEREBELLUM_C[2] - 0.2];
      else label = [pl.side * 0.3, pl.y[0] - 0.16, 0];
      anchors.set(key, anchor);
      if (key !== 'pain_0' && key !== 'pain_1' && key !== 'cerebellum_granule') this.regionCentres.push({ title: def.title, c: label, color: `rgb(${def.color.join(',')})` });

      const cols = Math.ceil(Math.sqrt(list.length));
      const rows = Math.ceil(list.length / cols);
      let done = 0;
      list.forEach((pi, j) => {
        const p = info.pops[pi];
        const rnd = rand(pi * 7919 + 13);
        regionOfPop[pi] = key;
        const c = p.inhibitory ? [110, 165, 255] : def.color;
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGlow);
    gl.bufferData(gl.ARRAY_BUFFER, this.glow, gl.DYNAMIC_DRAW);

    // tracts between regions
    const bundles = new Map<string, Tract3>();
    for (const [pre, post, inh] of info.projs) {
      const a = regionOfPop[pre];
      const b = regionOfPop[post];
      if (!a || !b || a === b) continue;
      const key = `${a}>${b}>${inh}`;
      let t = bundles.get(key);
      if (!t) {
        const A = anchors.get(a)!;
        const B = anchors.get(b)!;
        // long tracts run through the brainstem and the cord rather than through the air
        const mid: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
        const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
        const side = a < b ? 1 : -1;
        const pull = Math.min(1, len / 1.5);
        const s = stemAt(Math.max(-1.6, Math.min(1.3, mid[1])));
        const c: V3 = [mid[0] * (1 - 0.7 * pull) + side * 0.05 * len * (inh ? 1.6 : 1), mid[1], mid[2] * (1 - 0.7 * pull) + s.z * 0.7 * pull + 0.05 * len * (inh ? -1 : 1)];
        t = { inh: inh === 1, sources: [], n: 0, a: A, c, b: B, rate: 0, spikes: 0 };
        bundles.set(key, t);
      }
      if (!t.sources.includes(pre)) {
        t.sources.push(pre);
        t.n += info.pops[pre].n;
      }
    }
    this.tracts = [...bundles.values()];
    const linePos = new Float32Array(this.tracts.length * SEG * 2 * 3);
    this.lineCol = new Float32Array(this.tracts.length * SEG * 2 * 4);
    this.tracts.forEach((t, ti) => {
      for (let s = 0; s < SEG; s++) {
        for (let e = 0; e < 2; e++) {
          const p = this.curve(t, (s + e) / SEG);
          linePos.set(p, (ti * SEG * 2 + s * 2 + e) * 3);
        }
      }
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinePos);
    gl.bufferData(gl.ARRAY_BUFFER, linePos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLineCol);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineCol, gl.DYNAMIC_DRAW);
  }

  private curve(t: Tract3, s: number): V3 {
    const u = 1 - s;
    return [
      u * u * t.a[0] + 2 * u * s * t.c[0] + s * s * t.b[0],
      u * u * t.a[1] + 2 * u * s * t.c[1] + s * s * t.b[1],
      u * u * t.a[2] + 2 * u * s * t.c[2] + s * s * t.b[2],
    ];
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
    for (let p = 0; p < pops.length; p++) {
      let s = 0;
      const end = pops[p].start + pops[p].n;
      for (let i = pops[p].start; i < end; i++) s += act[i];
      this.popSpikes[p] = s;
    }
    for (const t of this.tracts) {
      let s = 0;
      for (const p of t.sources) s += this.popSpikes[p];
      t.spikes += s;
      t.rate += (s / t.n / dtSim - t.rate) * 0.2;
    }
  }

  private camera(aspect: number): void {
    // view: orbit around a point between brain and spinal cord
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const spt = Math.sin(this.pitch);
    const target: V3 = [0, 0.36, -0.05];
    const eye: V3 = [target[0] + this.dist * cp * sy, target[1] + this.dist * spt, target[2] + this.dist * cp * cy];
    this.eye = eye;
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
    const fov = 0.7;
    const near = 0.1;
    const far = 40;
    const t = 1 / Math.tan(fov / 2);
    const m = this.mvp;
    // projection * view, written out
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

  private project(p: V3, w: number, h: number): [number, number, number] {
    const m = this.mvp;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const ww = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / ww * 0.5 + 0.5) * w, (1 - (y / ww * 0.5 + 0.5)) * h, ww];
  }

  draw(): void {
    const gl = this.gl;
    if (!gl || !this.open || !this.info) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width * dpr));
    const h = Math.max(10, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.labelCanvas.width = w;
      this.labelCanvas.height = h;
    }
    // slow turn while nobody is touching it
    if (!this.dragging && performance.now() - this.lastInteraction > 2500) this.yaw += 0.0016;
    this.camera(w / h);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.035, 0.047, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // --- the glass surface ---
    if (this.shell) {
      gl.useProgram(this.meshProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProg!, 'uMVP'), false, this.mvp);
      gl.uniform3fv(gl.getUniformLocation(this.meshProg!, 'uEye'), this.eye);
      gl.uniform1f(gl.getUniformLocation(this.meshProg!, 'uAlpha'), 1);
      for (const m of this.meshes) {
        gl.uniform3fv(gl.getUniformLocation(this.meshProg!, 'uTint'), m.tint);
        this.attrib(this.meshProg!, 'aPos', m.pos, 3);
        this.attrib(this.meshProg!, 'aCol', m.nrm, 3);
        this.attrib(this.meshProg!, 'aGlow', m.fold, 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      }
    }

    // --- tracts ---
    const lc = this.lineCol;
    this.tracts.forEach((t, ti) => {
      const a = Math.min(1, t.rate / 60);
      const al = 0.03 + 0.4 * a;
      const r = t.inh ? 0.43 : 1.0;
      const g = t.inh ? 0.65 : 0.86;
      const b = t.inh ? 1.0 : 0.62;
      for (let k = ti * SEG * 2; k < (ti + 1) * SEG * 2; k++) {
        lc[k * 4] = r;
        lc[k * 4 + 1] = g;
        lc[k * 4 + 2] = b;
        lc[k * 4 + 3] = al;
      }
      if (t.spikes > 0 && this.sparks.length < MAX_SPARKS) {
        const expected = t.spikes * 0.004;
        let k = Math.floor(expected);
        if (Math.random() < expected - k) k++;
        for (let j = 0; j < k && j < 3; j++) this.sparks.push({ tract: ti, t: 0, speed: 0.03 + Math.random() * 0.02 });
      }
      t.spikes = 0;
    });
    gl.useProgram(this.lineProg);
    gl.disableVertexAttribArray(2);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProg!, 'uMVP'), false, this.mvp);
    this.attrib(this.lineProg!, 'aPos', this.bufLinePos, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLineCol);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, lc);
    this.attrib(this.lineProg!, 'aCol', this.bufLineCol, 4);
    gl.drawArrays(gl.LINES, 0, this.tracts.length * SEG * 2);

    // --- points: neurons, sparks ---
    gl.useProgram(this.pointProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.pointProg!, 'uMVP'), false, this.mvp);
    const scale = h * 0.026;
    gl.uniform1f(gl.getUniformLocation(this.pointProg!, 'uScale'), scale);
    this.attrib(this.pointProg!, 'aPos', this.bufPos, 3);
    this.attrib(this.pointProg!, 'aCol', this.bufCol, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGlow);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glow);
    this.attrib(this.pointProg!, 'aGlow', this.bufGlow, 1);
    gl.drawArrays(gl.POINTS, 0, this.glow.length);
    const g = this.glow;
    for (let i = 0; i < g.length; i++) g[i] = g[i] < 0.05 ? 0 : g[i] * 0.66;

    let ns = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.t += s.speed;
      const t = this.tracts[s.tract];
      if (s.t >= 1 || !t) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      if (ns >= MAX_SPARKS) continue;
      this.sparkPos.set(this.curve(t, s.t), ns * 3);
      this.sparkCol[ns * 3] = t.inh ? 0.43 : 1;
      this.sparkCol[ns * 3 + 1] = t.inh ? 0.65 : 0.84;
      this.sparkCol[ns * 3 + 2] = t.inh ? 1 : 0.51;
      ns++;
    }
    if (ns > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSparkPos);
      gl.bufferData(gl.ARRAY_BUFFER, this.sparkPos, gl.DYNAMIC_DRAW);
      this.attrib(this.pointProg!, 'aPos', this.bufSparkPos, 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSparkCol);
      gl.bufferData(gl.ARRAY_BUFFER, this.sparkCol, gl.DYNAMIC_DRAW);
      this.attrib(this.pointProg!, 'aCol', this.bufSparkCol, 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSparkGlow);
      gl.bufferData(gl.ARRAY_BUFFER, this.sparkGlow, gl.DYNAMIC_DRAW);
      this.attrib(this.pointProg!, 'aGlow', this.bufSparkGlow, 1);
      gl.drawArrays(gl.POINTS, 0, ns);
    }

    // --- region names: nearest first, and none on top of another ---
    const c = this.labels;
    c.clearRect(0, 0, w, h);
    c.font = `600 ${Math.round(10 * dpr)}px Inter, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    const placed: [number, number, number, number][] = [];
    const items = this.regionCentres.map((r) => ({ r, s: this.project(r.c, w, h) })).filter((q) => q.s[2] > 0).sort((p, q) => p.s[2] - q.s[2]);
    for (const { r, s } of items) {
      const text = r.title.toUpperCase();
      const tw = c.measureText(text).width / 2 + 4 * dpr;
      const th = 13 * dpr;
      const box: [number, number, number, number] = [s[0] - tw, s[1] - th, s[0] + tw, s[1]];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      c.globalAlpha = Math.max(0.3, Math.min(0.95, 1.9 - s[2] / this.dist));
      c.fillStyle = r.color;
      c.fillText(text, s[0], s[1]);
    }
    c.globalAlpha = 1;
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
