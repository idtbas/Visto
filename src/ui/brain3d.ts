// The nervous system in three dimensions, in the same visual language as the flat map:
// every dot is one neuron and flashes with its real spikes, the lines are the real nerve
// tracts and brighten with the firing of their source neurons, the sparks on them are a
// sample of the spikes travelling through. Drag to rotate, wheel or pinch to zoom.
//
// Coordinates: x = left/right, y = up, z = front (the creature looks towards +z).
import type { BrainInfo } from '../sim/sim';
import { REGIONS, regionKeyOf } from './brainView';

type V3 = [number, number, number];

/** centre and half-axes of every region */
const SHAPE: Record<string, { c: V3; r: V3 }> = {
  cortex: { c: [0, 1.98, 0.05], r: [0.5, 0.1, 0.55] },
  visual: { c: [0, 1.6, -0.88], r: [0.4, 0.26, 0.18] },
  explore: { c: [0, 1.62, 0.82], r: [0.42, 0.28, 0.22] },
  hippocampus: { c: [0, 1.32, -0.2], r: [0.55, 0.12, 0.36] },
  basal: { c: [0, 1.6, 0.18], r: [0.28, 0.15, 0.22] },
  vta: { c: [0, 1.06, 0.24], r: [0.15, 0.07, 0.12] },
  cerebellum_granule: { c: [0, 0.88, -0.82], r: [0.55, 0.28, 0.28] },
  cerebellum: { c: [0, 0.92, -0.42], r: [0.32, 0.2, 0.1] },
  brainstem: { c: [0, 0.68, 0.04], r: [0.2, 0.3, 0.2] },
  afferent: { c: [0, 1.04, -0.02], r: [0.62, 0.06, 0.07] },
  spinal_0: { c: [-0.14, -0.5, 0], r: [0.11, 0.82, 0.13] },
  spinal_1: { c: [0.14, -0.5, 0], r: [0.11, 0.82, 0.13] },
  afferent_0: { c: [-0.8, -0.3, -0.22], r: [0.3, 0.45, 0.18] },
  afferent_1: { c: [0.8, -0.3, -0.22], r: [0.3, 0.45, 0.18] },
  motor_0: { c: [-0.8, -0.98, 0.22], r: [0.3, 0.3, 0.18] },
  motor_1: { c: [0.8, -0.98, 0.22], r: [0.3, 0.3, 0.18] },
};
const GOLDEN = 2.399963229728653;
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
  private bufShellPos: WebGLBuffer | null = null;
  private bufShellCol: WebGLBuffer | null = null;
  private bufShellGlow: WebGLBuffer | null = null;
  private bufSparkPos: WebGLBuffer | null = null;
  private bufSparkCol: WebGLBuffer | null = null;
  private bufSparkGlow: WebGLBuffer | null = null;
  private shellCount = 0;
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
  private yaw = 0.65;
  private pitch = 0.12;
  private dist = 6.0;
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
    for (const k of ['bufPos', 'bufCol', 'bufGlow', 'bufLinePos', 'bufLineCol', 'bufShellPos', 'bufShellCol', 'bufShellGlow', 'bufSparkPos', 'bufSparkCol', 'bufSparkGlow'] as const) {
      this[k] = gl.createBuffer();
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
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
      const k = regionKeyOf(p);
      if (!byRegion.has(k)) byRegion.set(k, []);
      byRegion.get(k)!.push(i);
    });
    const centreOfPop: V3[] = info.pops.map(() => [0, 0, 0]);
    const regionOfPop: string[] = info.pops.map(() => '');
    this.regionCentres = [];
    for (const def of REGIONS) {
      const list = byRegion.get(def.key);
      const shape = SHAPE[def.key];
      if (!list || !shape) continue;
      this.regionCentres.push({ title: def.title, c: [shape.c[0], shape.c[1] + shape.r[1] + 0.07, shape.c[2]], color: `rgb(${def.color.join(',')})` });
      const total = list.reduce((s, i) => s + info.pops[i].n, 0);
      const vol = shape.r[0] * shape.r[1] * shape.r[2];
      list.forEach((pi, j) => {
        const p = info.pops[pi];
        const rnd = rand(pi * 7919 + 13);
        regionOfPop[pi] = def.key;
        // where the colony of this population sits inside the region
        let cx = shape.c[0];
        let cy = shape.c[1];
        let cz = shape.c[2];
        let rr: V3 = shape.r;
        if (list.length > 1) {
          const t = (j + 0.5) / list.length;
          const rho = 0.72 * Math.cbrt(t);
          const th = j * GOLDEN;
          const cosPhi = 1 - 2 * ((j * 0.6180339887) % 1);
          const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
          cx += shape.r[0] * rho * sinPhi * Math.cos(th);
          cy += shape.r[1] * rho * cosPhi;
          cz += shape.r[2] * rho * sinPhi * Math.sin(th);
          const share = Math.cbrt((vol * (p.n / total)) * 0.55);
          rr = [share, share, share];
        }
        centreOfPop[pi] = [cx, cy, cz];
        const c = p.inhibitory ? [110, 165, 255] : def.color;
        for (let k = 0; k < p.n; k++) {
          // uniform inside the ellipsoid
          let x = 0;
          let y = 0;
          let z = 0;
          do {
            x = 2 * rnd() - 1;
            y = 2 * rnd() - 1;
            z = 2 * rnd() - 1;
          } while (x * x + y * y + z * z > 1);
          const o = (p.start + k) * 3;
          pos[o] = cx + x * rr[0];
          pos[o + 1] = cy + y * rr[1];
          pos[o + 2] = cz + z * rr[2];
          col[o] = c[0] / 255;
          col[o + 1] = c[1] / 255;
          col[o + 2] = c[2] / 255;
        }
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
        const A = SHAPE[a].c;
        const B = SHAPE[b].c;
        // bend outwards from the body axis so that tracts do not all run through the middle
        const mid: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
        const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
        const side = a < b ? 1 : -1;
        const c: V3 = [mid[0] + side * 0.1 * len * (inh ? 1.6 : 1), mid[1], mid[2] + 0.16 * len * (inh ? -1 : 1)];
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

    // a faint shell of the brain and the spinal cord, for orientation only
    const shell: number[] = [];
    const rnd = rand(4242);
    const ellipsoid = (c: V3, r: V3, count: number): void => {
      for (let i = 0; i < count; i++) {
        const u = 2 * rnd() - 1;
        const th = rnd() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        shell.push(c[0] + r[0] * s * Math.cos(th), c[1] + r[1] * u, c[2] + r[2] * s * Math.sin(th));
      }
    };
    ellipsoid([0, 1.55, 0], [0.72, 0.62, 1.22], 2600); // cerebrum
    ellipsoid([0, 0.88, -0.78], [0.66, 0.36, 0.42], 900); // cerebellum
    ellipsoid([0, -0.4, 0], [0.3, 1.0, 0.2], 900); // spinal cord
    this.shellCount = shell.length / 3;
    const shellCol = new Float32Array(shell.length);
    for (let i = 0; i < shellCol.length; i += 3) {
      shellCol[i] = 0.3;
      shellCol[i + 1] = 0.42;
      shellCol[i + 2] = 0.65;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufShellPos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shell), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufShellCol);
    gl.bufferData(gl.ARRAY_BUFFER, shellCol, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufShellGlow);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.shellCount).fill(0.0), gl.STATIC_DRAW);
    void centreOfPop;
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
    const target: V3 = [0, 0.38, 0];
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

    // --- tracts ---
    const lc = this.lineCol;
    this.tracts.forEach((t, ti) => {
      const a = Math.min(1, t.rate / 60);
      const al = 0.035 + 0.4 * a;
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

    // --- points: shell, neurons, sparks ---
    gl.useProgram(this.pointProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.pointProg!, 'uMVP'), false, this.mvp);
    const scale = h * 0.03;
    gl.uniform1f(gl.getUniformLocation(this.pointProg!, 'uScale'), scale * 0.7);
    this.attrib(this.pointProg!, 'aPos', this.bufShellPos, 3);
    this.attrib(this.pointProg!, 'aCol', this.bufShellCol, 3);
    this.attrib(this.pointProg!, 'aGlow', this.bufShellGlow, 1);
    gl.drawArrays(gl.POINTS, 0, this.shellCount);

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

    // --- region names ---
    const c = this.labels;
    c.clearRect(0, 0, w, h);
    c.font = `600 ${Math.round(10 * dpr)}px Inter, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (const r of this.regionCentres) {
      const [x, y, ww] = this.project(r.c, w, h);
      if (ww <= 0) continue;
      c.globalAlpha = Math.max(0.25, Math.min(0.9, 1.9 - ww / this.dist));
      c.fillStyle = r.color;
      c.fillText(r.title.toUpperCase(), x, y);
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
