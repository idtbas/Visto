// Live view of the nervous system, laid out like the anatomy it models: brain on top
// (seen from the side, facing right), brainstem below it, the spinal cord running down
// with a left and a right half, sensory nerves coming in and motor nerves going out.
//
// Everything that moves is real activity from the simulation:
//  - every dot is one neuron; it flashes when that neuron fires a spike
//  - every line is a nerve tract (all synaptic projections between two regions);
//    it brightens with the firing rate of its source neurons
//  - the sparks travelling along a tract are a random sample of the spikes that are
//    being sent through it at that moment
import type { BrainInfo } from '../sim/sim';
import type { PopInfo } from '../sim/brain/brain';

type RGB = [number, number, number];

interface RegionDef {
  key: string;
  title: string;
  /** rectangle in the map, in fractions of its width and height */
  x: number;
  y: number;
  w: number;
  h: number;
  color: RGB;
}

// excitatory cells take the colour of their region, inhibitory cells are always blue
const INH: RGB = [110, 165, 255];
const SPARK: RGB = [255, 214, 130];

export const REGIONS: RegionDef[] = [
  // --- brain, seen from the side: front is on the right ---
  { key: 'cortex_body', title: 'Körperfühlrinde', x: 0.03, y: 0.02, w: 0.6, h: 0.135, color: [255, 222, 160] },
  { key: 'cortex', title: 'Scheitelrinde · Vorhersage', x: 0.645, y: 0.02, w: 0.325, h: 0.075, color: [255, 236, 170] },
  { key: 'explore', title: 'Erkundungs-Kern', x: 0.645, y: 0.103, w: 0.325, h: 0.089, color: [200, 160, 255] },
  { key: 'visual', title: 'Sehrinde', x: 0.03, y: 0.165, w: 0.15, h: 0.105, color: [120, 220, 255] },
  { key: 'hippocampus', title: 'Hippocampus · Gedächtnis', x: 0.19, y: 0.165, w: 0.29, h: 0.105, color: [140, 240, 210] },
  { key: 'amygdala', title: 'Mandelkern', x: 0.49, y: 0.165, w: 0.145, h: 0.105, color: [255, 140, 120] },
  { key: 'basal', title: 'Basalganglien', x: 0.645, y: 0.2, w: 0.16, h: 0.07, color: [255, 150, 200] },
  { key: 'vta', title: 'Dopamin', x: 0.815, y: 0.2, w: 0.155, h: 0.07, color: [255, 180, 84] },
  { key: 'cerebellum_granule', title: 'Kleinhirn · Körnerzellen', x: 0.03, y: 0.28, w: 0.225, h: 0.22, color: [170, 200, 255] },
  { key: 'cerebellum', title: 'Kleinhirn · Purkinje', x: 0.265, y: 0.285, w: 0.2, h: 0.13, color: [200, 170, 255] },
  { key: 'habenula', title: 'Habenula', x: 0.475, y: 0.285, w: 0.125, h: 0.062, color: [255, 120, 150] },
  { key: 'pain_relay', title: 'Schmerzkern', x: 0.475, y: 0.353, w: 0.125, h: 0.062, color: [255, 90, 80] },
  { key: 'brainstem', title: 'Hirnstamm', x: 0.61, y: 0.285, w: 0.36, h: 0.13, color: [255, 214, 130] },
  { key: 'afferent', title: 'Gleichgewicht', x: 0.265, y: 0.43, w: 0.2, h: 0.07, color: [150, 235, 170] },
  { key: 'pain', title: 'Schmerzrezeptoren', x: 0.475, y: 0.43, w: 0.495, h: 0.07, color: [255, 90, 80] },
  // --- body: spinal cord in the middle, nerves to the left and right leg ---
  { key: 'afferent_0', title: 'Sinnesnerven links', x: 0.02, y: 0.55, w: 0.3, h: 0.19, color: [150, 235, 170] },
  { key: 'afferent_1', title: 'Sinnesnerven rechts', x: 0.68, y: 0.55, w: 0.3, h: 0.19, color: [150, 235, 170] },
  { key: 'spinal_0', title: 'Rückenmark links', x: 0.335, y: 0.545, w: 0.16, h: 0.445, color: [255, 190, 110] },
  { key: 'spinal_1', title: 'Rückenmark rechts', x: 0.505, y: 0.545, w: 0.16, h: 0.445, color: [255, 190, 110] },
  { key: 'motor_0', title: 'Motoneuronen links', x: 0.02, y: 0.775, w: 0.3, h: 0.215, color: [255, 120, 100] },
  { key: 'motor_1', title: 'Motoneuronen rechts', x: 0.68, y: 0.775, w: 0.3, h: 0.215, color: [255, 120, 100] },
];
const SPLIT_BY_LEG = new Set(['afferent', 'spinal', 'motor']);
const GOLDEN = 2.399963229728653;
const LEVELS = 4;

/** which region of the map a population belongs to */
export function regionKeyOf(p: PopInfo): string {
  const m = /_([01])$/.exec(p.name);
  if (m && SPLIT_BY_LEG.has(p.region)) return `${p.region}_${m[1]}`;
  // spinal-type pools that serve both legs (mode gates, gait initiation, tone context) sit in the brainstem
  return p.region === 'spinal' ? 'brainstem' : p.region;
}

interface Cluster {
  pop: PopInfo;
  cx: number;
  cy: number;
  r: number;
  rate: number;
  region: number;
  /** distance between neighbouring cells [px] */
  s: number;
}

interface Region {
  def: RegionDef;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** populations of this region (indices into the population list) */
  pops: number[];
}

interface Tract {
  from: number;
  to: number;
  inh: boolean;
  /** indices of the source populations */
  sources: number[];
  /** number of source neurons */
  n: number;
  // quadratic curve
  x0: number;
  y0: number;
  xc: number;
  yc: number;
  x1: number;
  y1: number;
  /** smoothed firing rate of the source neurons [Hz] */
  rate: number;
  spikes: number;
}

interface Spark {
  tract: number;
  t: number;
  speed: number;
}

export class BrainView {
  private readonly ctx: CanvasRenderingContext2D;
  private info: BrainInfo | null = null;
  private regions: Region[] = [];
  private clusters: Cluster[] = [];
  private tracts: Tract[] = [];
  private sparks: Spark[] = [];
  private glow = new Float32Array(0);
  private nx = new Float32Array(0);
  private ny = new Float32Array(0);
  private colorOf = new Uint8Array(0);
  private popSpikes = new Float32Array(0);
  private palette: RGB[] = [];
  private sprites: HTMLCanvasElement[][] = [];
  private spriteSize = 8;
  private sparkExc = 0;
  private sparkInh = 0;
  private readonly backdrop = document.createElement('canvas');
  private w = 0;
  private h = 0;
  private dpr = 1;
  private dot = 1;
  private hover: Cluster | null = null;
  private mouse: [number, number] | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly tip: HTMLElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.layout()).observe(canvas);
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr];
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse = null;
      this.hover = null;
      this.tip.style.display = 'none';
    });
  }

  setInfo(info: BrainInfo): void {
    this.info = info;
    this.glow = new Float32Array(info.neurons);
    this.nx = new Float32Array(info.neurons);
    this.ny = new Float32Array(info.neurons);
    this.colorOf = new Uint8Array(info.neurons);
    this.popSpikes = new Float32Array(info.pops.length);
    this.sparks = [];
    this.layout();
  }

  private regionKey(p: PopInfo): string {
    return regionKeyOf(p);
  }

  private colorIndex(c: RGB): number {
    let i = this.palette.findIndex((q) => q[0] === c[0] && q[1] === c[1] && q[2] === c[2]);
    if (i < 0) {
      this.palette.push(c);
      i = this.palette.length - 1;
    }
    return i;
  }

  // ------------------------------------------------------------------ layout

  private layout(): void {
    const dpr = (this.dpr = window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = (this.w = Math.max(50, Math.round(rect.width * dpr)));
    const h = (this.h = Math.max(50, Math.round(rect.height * dpr)));
    this.canvas.width = w;
    this.canvas.height = h;
    this.regions = [];
    this.clusters = [];
    this.tracts = [];
    this.sparks = [];
    this.palette = [];
    this.nx.fill(0);
    this.ny.fill(0);
    if (!this.info) return;
    this.sparkExc = this.colorIndex(SPARK);
    this.sparkInh = this.colorIndex(INH);
    const pops = this.info.pops;
    const pad = Math.round(6 * dpr);
    const titleH = Math.round(15 * dpr);
    const byRegion = new Map<string, number[]>();
    pops.forEach((p, i) => {
      const k = this.regionKey(p);
      if (!byRegion.has(k)) byRegion.set(k, []);
      byRegion.get(k)!.push(i);
    });
    const regionOfPop = new Int16Array(pops.length).fill(-1);

    // 1. regions and the spacing of the neurons inside them
    const spacing: number[] = [];
    for (const def of REGIONS) {
      const list = byRegion.get(def.key);
      if (!list) continue;
      const x = pad + def.x * (w - 2 * pad);
      const y = pad + def.y * (h - 2 * pad);
      const rw = def.w * (w - 2 * pad);
      const rh = def.h * (h - 2 * pad);
      const reg: Region = { def, x, y, w: rw, h: rh, cx: x + rw / 2, cy: y + rh / 2 + titleH * 0.3, pops: list };
      for (const i of list) regionOfPop[i] = this.regions.length;
      this.regions.push(reg);
      spacing.push(this.fitSpacing(reg, titleH));
    }
    // regions should not look wildly different: nowhere are the cells spread much wider than
    // in the most crowded region (a region filled by one huge population is judged on its own)
    // (also the cortex with its thousands of cells)
    const crowded = (reg: Region): boolean => reg.pops.length === 1 || reg.pops.reduce((n, i) => n + pops[i].n, 0) > 3000;
    const multi = spacing.filter((_, i) => !crowded(this.regions[i]));
    // (judged by a typical region, so that one cramped region does not shrink all the others)
    const sorted = (multi.length > 0 ? multi : spacing).slice().sort((a, b) => a - b);
    const tightest = sorted[Math.floor(sorted.length / 3)];
    const cap = tightest * 1.7;
    this.dot = Math.max(0.6 * dpr, tightest * 0.4);

    // 2. place every population as a little colony of cells
    this.regions.forEach((reg, ri) => this.placeRegion(reg, ri, crowded(reg) ? spacing[ri] : Math.min(spacing[ri], cap), titleH));

    // 3. nerve tracts: all projections between two different regions, bundled
    const bundles = new Map<string, Tract>();
    for (const [pre, post, inh] of this.info.projs) {
      const a = regionOfPop[pre];
      const b = regionOfPop[post];
      if (a < 0 || b < 0 || a === b) continue;
      const key = `${a}>${b}>${inh}`;
      let t = bundles.get(key);
      if (!t) {
        t = { from: a, to: b, inh: inh === 1, sources: [], n: 0, x0: 0, y0: 0, xc: 0, yc: 0, x1: 0, y1: 0, rate: 0, spikes: 0 };
        bundles.set(key, t);
      }
      if (!t.sources.includes(pre)) {
        t.sources.push(pre);
        t.n += pops[pre].n;
      }
    }
    for (const t of bundles.values()) {
      const A = this.regions[t.from];
      const B = this.regions[t.to];
      const dx = B.cx - A.cx;
      const dy = B.cy - A.cy;
      const len = Math.hypot(dx, dy) || 1;
      // start and end a little inside the regions; bend to one side so that the tracts in
      // the two directions (and the inhibitory ones) do not lie on top of each other
      const inset = (R: Region): number => Math.min(R.w, R.h) * 0.3;
      t.x0 = A.cx + (dx / len) * inset(A);
      t.y0 = A.cy + (dy / len) * inset(A);
      t.x1 = B.cx - (dx / len) * inset(B);
      t.y1 = B.cy - (dy / len) * inset(B);
      const bend = (t.from < t.to ? 1 : -1) * (t.inh ? 0.2 : 0.11) * len;
      t.xc = (t.x0 + t.x1) / 2 + (-dy / len) * bend;
      t.yc = (t.y0 + t.y1) / 2 + (dx / len) * bend;
      this.tracts.push(t);
    }

    this.buildSprites();
    this.drawBackdrop();
  }

  /** the largest distance between neighbouring cells at which all populations of a region fit */
  private fitSpacing(reg: Region, titleH: number): number {
    const pops = this.info!.pops;
    const iw = reg.w - 10 * this.dpr;
    const ih = reg.h - titleH - 6 * this.dpr;
    if (reg.pops.length === 1) {
      // one big population fills the region as an ellipse
      const n = pops[reg.pops[0]].n;
      return Math.sqrt((Math.PI * (iw / 2) * (ih / 2)) / n) * 0.95;
    }
    for (let s = 9 * this.dpr; s > 0.5; s *= 0.94) {
      if (this.flow(reg, s, titleH, null)) return s;
    }
    return 0.5;
  }

  /** flows the cell colonies of a region into rows; returns false if they do not fit */
  private flow(reg: Region, s: number, titleH: number, out: Cluster[] | null, ri = 0): boolean {
    const pops = this.info!.pops;
    const ix = reg.x + 5 * this.dpr;
    const iy = reg.y + titleH + 2 * this.dpr;
    const iw = reg.w - 10 * this.dpr;
    const ih = reg.h - titleH - 6 * this.dpr;
    const gap = s * 0.9;
    let x = ix;
    let y = iy;
    let rowH = 0;
    const rows: Cluster[][] = [[]];
    for (const pi of reg.pops) {
      const r = s * Math.sqrt(pops[pi].n / Math.PI) * 1.05;
      const d = 2 * r;
      if (x + d > ix + iw + 0.5 && x > ix) {
        x = ix;
        y += rowH + gap;
        rowH = 0;
        rows.push([]);
      }
      if (x + d > ix + iw + 0.5 || y + d > iy + ih + 0.5) return false;
      rows[rows.length - 1].push({ pop: pops[pi], cx: x + r, cy: y + r, r, rate: 0, region: ri, s });
      x += d + gap;
      if (d > rowH) rowH = d;
    }
    if (out) {
      // centre every row and the whole block inside the region
      const usedH = y + rowH - iy;
      const offY = (ih - usedH) / 2;
      for (const row of rows) {
        if (row.length === 0) continue;
        const last = row[row.length - 1];
        const offX = (iw - (last.cx + last.r - ix)) / 2;
        for (const c of row) {
          c.cx += offX;
          c.cy += offY;
          out.push(c);
        }
      }
    }
    return true;
  }

  private placeRegion(reg: Region, ri: number, s: number, titleH: number): void {
    const pops = this.info!.pops;
    const first = this.clusters.length;
    if (reg.pops.length === 1) {
      const p = pops[reg.pops[0]];
      const iw = reg.w - 12 * this.dpr;
      const ih = reg.h - titleH - 8 * this.dpr;
      const c: Cluster = { pop: p, cx: reg.x + reg.w / 2, cy: reg.y + titleH + ih / 2 + 3 * this.dpr, r: Math.min(iw, ih) / 2, rate: 0, region: ri, s };
      this.clusters.push(c);
      const ci = this.colorIndex(p.inhibitory ? INH : reg.def.color);
      for (let k = 0; k < p.n; k++) {
        const rr = Math.sqrt((k + 0.5) / p.n);
        const th = k * GOLDEN;
        this.nx[p.start + k] = c.cx + (iw / 2) * rr * Math.cos(th);
        this.ny[p.start + k] = c.cy + (ih / 2) * rr * Math.sin(th);
        this.colorOf[p.start + k] = ci;
      }
      return;
    }
    this.flow(reg, s, titleH, this.clusters, ri);
    for (let q = first; q < this.clusters.length; q++) {
      const c = this.clusters[q];
      const p = c.pop;
      const ci = this.colorIndex(p.inhibitory ? INH : reg.def.color);
      // sunflower arrangement: evenly spread, no grid
      for (let k = 0; k < p.n; k++) {
        const rr = s * Math.sqrt((k + 0.5) / Math.PI);
        const th = k * GOLDEN + q;
        this.nx[p.start + k] = c.cx + rr * Math.cos(th);
        this.ny[p.start + k] = c.cy + rr * Math.sin(th);
        this.colorOf[p.start + k] = ci;
      }
    }
  }

  /** pre-rendered glows: one per colour and brightness level */
  private buildSprites(): void {
    const size = (this.spriteSize = Math.max(6, Math.ceil(this.dot * 9)));
    this.sprites = this.palette.map((col) => {
      const levels: HTMLCanvasElement[] = [];
      for (let l = 0; l < LEVELS; l++) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d')!;
        const f = (l + 1) / LEVELS;
        const white = Math.max(0, f - 0.5) * 0.9;
        const core = col.map((v) => Math.round(v + (255 - v) * white));
        const rad = (size / 2) * (0.5 + 0.5 * f);
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, rad);
        grad.addColorStop(0, `rgba(${core[0]},${core[1]},${core[2]},${0.5 + 0.4 * f})`);
        grad.addColorStop(0.22, `rgba(${col[0]},${col[1]},${col[2]},${0.25 + 0.3 * f})`);
        grad.addColorStop(0.5, `rgba(${col[0]},${col[1]},${col[2]},${0.05 + 0.07 * f})`);
        grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        levels.push(c);
      }
      return levels;
    });
  }

  /** everything that does not change from frame to frame */
  private drawBackdrop(): void {
    const { w, h, dpr } = this;
    this.backdrop.width = w;
    this.backdrop.height = h;
    const c = this.backdrop.getContext('2d')!;
    const bg = c.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#111827');
    bg.addColorStop(1, '#090c12');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    // silhouette: cerebrum, cerebellum, brainstem and the spinal cord, as one soft shape
    const sil = document.createElement('canvas');
    sil.width = w;
    sil.height = h;
    const s = sil.getContext('2d')!;
    s.fillStyle = '#fff';
    const ell = (x: number, y: number, rx: number, ry: number): void => {
      s.beginPath();
      s.ellipse(x * w, y * h, rx * w, ry * h, 0, 0, Math.PI * 2);
      s.fill();
    };
    ell(0.5, 0.15, 0.49, 0.15); // cerebrum
    ell(0.76, 0.16, 0.235, 0.15); // frontal lobe
    ell(0.17, 0.3, 0.165, 0.13); // cerebellum
    ell(0.6, 0.34, 0.37, 0.12); // midbrain and brainstem
    s.beginPath();
    s.roundRect(0.325 * w, 0.42 * h, 0.35 * w, 0.6 * h, 0.05 * w); // spinal cord
    s.fill();
    c.globalAlpha = 0.05;
    c.drawImage(sil, 0, 0);
    c.globalAlpha = 1;

    // regions
    c.font = `600 ${Math.round(9.5 * dpr)}px Inter, system-ui, sans-serif`;
    c.textBaseline = 'top';
    for (const r of this.regions) {
      const [cr, cg, cb] = r.def.color;
      c.fillStyle = `rgba(${cr},${cg},${cb},0.045)`;
      c.strokeStyle = `rgba(${cr},${cg},${cb},0.2)`;
      c.lineWidth = dpr;
      c.beginPath();
      c.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, Math.min(r.w, r.h) * 0.16);
      c.fill();
      c.stroke();
      c.fillStyle = `rgba(${cr},${cg},${cb},0.75)`;
      c.fillText(r.def.title.toUpperCase(), r.x + 8 * dpr, r.y + 5 * dpr, r.w - 12 * dpr);
    }
    // tracts at rest
    c.lineCap = 'round';
    for (const t of this.tracts) {
      c.strokeStyle = t.inh ? 'rgba(110,165,255,0.07)' : 'rgba(255,225,170,0.06)';
      c.lineWidth = dpr;
      c.beginPath();
      c.moveTo(t.x0, t.y0);
      c.quadraticCurveTo(t.xc, t.yc, t.x1, t.y1);
      c.stroke();
    }
    // every neuron as a faint dot
    for (const cl of this.clusters) {
      const d = Math.max(1, cl.s * 0.5);
      const col = this.palette[this.colorOf[cl.pop.start]];
      c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${cl.s < 2.5 * dpr ? 0.32 : 0.2})`;
      for (let i = cl.pop.start; i < cl.pop.start + cl.pop.n; i++) c.fillRect(this.nx[i] - d / 2, this.ny[i] - d / 2, d, d);
    }
  }

  // ------------------------------------------------------------------ activity

  /** feed the spike counts of one simulation frame */
  addActivity(act: Uint8Array, dtSim: number): void {
    const g = this.glow;
    if (act.length !== g.length || !this.info) return;
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
    for (const c of this.clusters) {
      let s = 0;
      for (let i = c.pop.start; i < c.pop.start + c.pop.n; i++) s += act[i];
      c.rate += (s / c.pop.n / dtSim - c.rate) * 0.15;
    }
    for (const t of this.tracts) {
      let s = 0;
      for (const p of t.sources) s += this.popSpikes[p];
      t.spikes += s;
      t.rate += (s / t.n / dtSim - t.rate) * 0.2;
    }
  }

  draw(): void {
    const { ctx, w, h, dpr } = this;
    if (this.backdrop.width !== w || !this.info || this.sprites.length === 0) {
      ctx.fillStyle = '#090c12';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.backdrop, 0, 0);

    // --- tracts light up with the firing rate of their source neurons ---
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let ti = 0; ti < this.tracts.length; ti++) {
      const t = this.tracts[ti];
      const a = Math.min(1, t.rate / 60);
      if (a > 0.03) {
        ctx.strokeStyle = t.inh ? `rgba(110,165,255,${0.05 + 0.3 * a})` : `rgba(255,220,160,${0.04 + 0.26 * a})`;
        ctx.lineWidth = dpr * (0.8 + 1.6 * a);
        ctx.beginPath();
        ctx.moveTo(t.x0, t.y0);
        ctx.quadraticCurveTo(t.xc, t.yc, t.x1, t.y1);
        ctx.stroke();
      }
      // a sample of the spikes that were sent since the last frame becomes sparks
      if (t.spikes > 0 && this.sparks.length < 500) {
        const expected = t.spikes * 0.004;
        let k = Math.floor(expected);
        if (Math.random() < expected - k) k++;
        for (let j = 0; j < k && j < 3; j++) this.sparks.push({ tract: ti, t: 0, speed: 0.035 + Math.random() * 0.02 });
      }
      t.spikes = 0;
    }
    // --- sparks travel along the tracts ---
    const size = this.spriteSize;
    const half = size / 2;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.t += s.speed;
      const t = this.tracts[s.tract];
      if (s.t >= 1 || !t) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      const u = 1 - s.t;
      const x = u * u * t.x0 + 2 * u * s.t * t.xc + s.t * s.t * t.x1;
      const y = u * u * t.y0 + 2 * u * s.t * t.yc + s.t * s.t * t.y1;
      ctx.drawImage(this.sprites[t.inh ? this.sparkInh : this.sparkExc][1], x - half, y - half);
    }
    // --- neurons: one flash per spike, brighter when they fire in quick succession ---
    const g = this.glow;
    for (const cl of this.clusters) {
      // the glow of a cell is a few times wider than the distance to its neighbours
      const sz = Math.max(3 * dpr, Math.min(size, cl.s * 3.4));
      const hz = sz / 2;
      const sprites = this.sprites[this.colorOf[cl.pop.start]];
      const end = cl.pop.start + cl.pop.n;
      for (let i = cl.pop.start; i < end; i++) {
        const gl = g[i];
        if (gl < 0.12) {
          if (gl !== 0) g[i] = 0;
          continue;
        }
        const level = gl < 0.5 ? 0 : gl < 1.2 ? 1 : gl < 2.6 ? 2 : 3;
        ctx.drawImage(sprites[level], this.nx[i] - hz, this.ny[i] - hz, sz, sz);
        g[i] = gl * 0.62;
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // --- hover: which population is this? ---
    if (this.mouse) {
      const [mx, my] = this.mouse;
      this.hover = null;
      let best = Infinity;
      for (const c of this.clusters) {
        const reg = this.regions[c.region];
        const inside = reg.pops.length === 1 ? mx >= reg.x && mx <= reg.x + reg.w && my >= reg.y && my <= reg.y + reg.h : Math.hypot(mx - c.cx, my - c.cy) <= c.r + 3 * dpr;
        if (!inside) continue;
        const d = Math.hypot(mx - c.cx, my - c.cy);
        if (d < best) {
          best = d;
          this.hover = c;
        }
      }
      if (this.hover) {
        const c = this.hover;
        const reg = this.regions[c.region];
        ctx.strokeStyle = '#ffb454';
        ctx.lineWidth = dpr * 1.2;
        ctx.beginPath();
        if (reg.pops.length === 1) ctx.roundRect(reg.x + 1, reg.y + 1, reg.w - 2, reg.h - 2, Math.min(reg.w, reg.h) * 0.16);
        else ctx.arc(c.cx, c.cy, c.r + 2.5 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        this.tip.style.display = 'block';
        this.tip.style.left = `${Math.max(4, Math.min(w / dpr - 250, mx / dpr + 12))}px`;
        this.tip.style.top = `${my / dpr + 16}px`;
        this.tip.textContent = `${c.pop.name} · ${c.pop.n} ${c.pop.inhibitory ? 'hemmende' : 'erregende'} Neuronen · ${c.rate.toFixed(0)} Hz`;
      } else this.tip.style.display = 'none';
    }
    void h;
  }
}
