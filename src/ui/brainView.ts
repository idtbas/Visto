// Live view of the nervous system: every neuron is a dot that lights up when it fires.
import type { BrainInfo } from '../sim/sim';
import type { PopInfo } from '../sim/brain/brain';

interface RegionDef {
  key: string;
  title: string;
  /** rectangle in the map, in fractions of its width and height */
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number];
}

// excitatory cells take the colour of their region, inhibitory cells are always blue
const INH: [number, number, number] = [110, 170, 255];

const REGIONS: RegionDef[] = [
  // --- brain ---
  { key: 'visual', title: 'Sehrinde', x: 0.0, y: 0.0, w: 0.3, h: 0.1, color: [120, 220, 255] },
  { key: 'basal', title: 'Basalganglien', x: 0.32, y: 0.0, w: 0.3, h: 0.1, color: [255, 150, 200] },
  { key: 'vta', title: 'Dopamin-Kern', x: 0.64, y: 0.0, w: 0.36, h: 0.1, color: [255, 180, 84] },
  { key: 'cerebellum_granule', title: 'Kleinhirn · Körnerzellen', x: 0.0, y: 0.115, w: 0.7, h: 0.2, color: [170, 200, 255] },
  { key: 'cerebellum', title: 'Kleinhirn · Purkinje, Kerne, Olive', x: 0.72, y: 0.115, w: 0.28, h: 0.2, color: [200, 170, 255] },
  { key: 'explore', title: 'Erkundungs-Kern', x: 0.0, y: 0.33, w: 0.4, h: 0.1, color: [200, 160, 255] },
  { key: 'brainstem', title: 'Hirnstamm', x: 0.42, y: 0.33, w: 0.58, h: 0.1, color: [255, 214, 130] },
  // --- body side ---
  { key: 'afferent', title: 'Gleichgewicht', x: 0.42, y: 0.445, w: 0.16, h: 0.14, color: [150, 235, 170] },
  { key: 'afferent_0', title: 'Sinnesnerven links', x: 0.0, y: 0.445, w: 0.4, h: 0.14, color: [150, 235, 170] },
  { key: 'afferent_1', title: 'Sinnesnerven rechts', x: 0.6, y: 0.445, w: 0.4, h: 0.14, color: [150, 235, 170] },
  { key: 'spinal_0', title: 'Rückenmark links', x: 0.0, y: 0.6, w: 0.49, h: 0.22, color: [255, 190, 110] },
  { key: 'spinal_1', title: 'Rückenmark rechts', x: 0.51, y: 0.6, w: 0.49, h: 0.22, color: [255, 190, 110] },
  { key: 'motor_0', title: 'Motoneuronen links', x: 0.0, y: 0.835, w: 0.49, h: 0.165, color: [255, 120, 100] },
  { key: 'motor_1', title: 'Motoneuronen rechts', x: 0.51, y: 0.835, w: 0.49, h: 0.165, color: [255, 120, 100] },
];

const SPLIT_BY_LEG = new Set(['afferent', 'spinal', 'motor']);

interface Block {
  pop: PopInfo;
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell: number;
  color: [number, number, number];
  rate: number;
}

const TITLE_H = 16;

export class BrainView {
  private readonly ctx: CanvasRenderingContext2D;
  private info: BrainInfo | null = null;
  private blocks: Block[] = [];
  private regionRects: { def: RegionDef; x: number; y: number; w: number; h: number }[] = [];
  private glow = new Float32Array(0);
  private px = new Uint32Array(0);
  private cellOf = new Uint8Array(0);
  private colR = new Uint8Array(0);
  private colG = new Uint8Array(0);
  private colB = new Uint8Array(0);
  private img: ImageData | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private hover: Block | null = null;
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
    this.px = new Uint32Array(info.neurons);
    this.cellOf = new Uint8Array(info.neurons);
    this.colR = new Uint8Array(info.neurons);
    this.colG = new Uint8Array(info.neurons);
    this.colB = new Uint8Array(info.neurons);
    this.layout();
  }

  private regionKey(p: PopInfo): string {
    const m = /_([01])$/.exec(p.name);
    return m && SPLIT_BY_LEG.has(p.region) ? `${p.region}_${m[1]}` : p.region;
  }

  private layout(): void {
    const dpr = (this.dpr = window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    const w = (this.w = Math.max(50, Math.round(r.width * dpr)));
    const h = (this.h = Math.max(50, Math.round(r.height * dpr)));
    this.canvas.width = w;
    this.canvas.height = h;
    this.img = this.ctx.createImageData(w, h);
    this.blocks = [];
    this.regionRects = [];
    if (!this.info) return;
    const pad = Math.round(8 * dpr);
    const title = Math.round(TITLE_H * dpr);
    const byRegion = new Map<string, PopInfo[]>();
    for (const p of this.info.pops) {
      const k = this.regionKey(p);
      if (!byRegion.has(k)) byRegion.set(k, []);
      byRegion.get(k)!.push(p);
    }
    // without a cerebellum its row is closed up and the rest of the map is stretched
    const hasCb = byRegion.has('cerebellum_granule');
    const mapY = (y: number): number => (hasCb ? y : y < 0.11 ? y / 0.785 : (y - 0.215) / 0.785);
    const mapH = (hh: number): number => (hasCb ? hh : hh / 0.785);
    for (const def of REGIONS) {
      const pops = byRegion.get(def.key);
      if (!pops) continue;
      const rx = Math.round(pad + def.x * (w - 2 * pad));
      const ry = Math.round(pad + mapY(def.y) * (h - 2 * pad));
      const rw = Math.round(def.w * (w - 2 * pad));
      const rh = Math.round(mapH(def.h) * (h - 2 * pad));
      this.regionRects.push({ def, x: rx, y: ry, w: rw, h: rh });
      const ix = rx + 5 * dpr;
      const iy = ry + title;
      const iw = rw - 10 * dpr;
      const ih = rh - title - 4 * dpr;
      // find the largest cell size at which all populations of the region fit as a flow of blocks
      const gap = Math.max(2, Math.round(3 * dpr));
      let best: Block[] = [];
      for (let cell = Math.round(7 * dpr); cell >= 1; cell--) {
        const blocks: Block[] = [];
        let cx = ix;
        let cy = iy;
        let rowH = 0;
        let ok = true;
        for (const p of pops) {
          // blocks are a few cells tall so that many of them fit side by side
          const rows = Math.max(1, Math.min(p.n, Math.round(Math.sqrt(p.n / 3))));
          const cols = Math.ceil(p.n / rows);
          const bw = cols * cell;
          const bh = rows * cell;
          if (cx + bw > ix + iw && cx > ix) {
            cx = ix;
            cy += rowH + gap;
            rowH = 0;
          }
          if (cx + bw > ix + iw || cy + bh > iy + ih) {
            ok = false;
            break;
          }
          blocks.push({ pop: p, x: cx, y: cy, cols, rows, cell, color: p.inhibitory ? INH : def.color, rate: 0 });
          cx += bw + gap;
          if (bh > rowH) rowH = bh;
        }
        if (ok) {
          best = blocks;
          break;
        }
      }
      this.blocks.push(...best);
    }
    for (const b of this.blocks) {
      for (let k = 0; k < b.pop.n; k++) {
        const i = b.pop.start + k;
        const cx = b.x + (k % b.cols) * b.cell;
        const cy = b.y + Math.floor(k / b.cols) * b.cell;
        this.px[i] = cy * w + cx;
        this.cellOf[i] = b.cell;
        this.colR[i] = b.color[0];
        this.colG[i] = b.color[1];
        this.colB[i] = b.color[2];
      }
    }
  }

  /** feed the spike counts of one simulation frame */
  addActivity(act: Uint8Array, dtSim: number): void {
    const g = this.glow;
    if (act.length !== g.length) return;
    for (let i = 0; i < g.length; i++) {
      const a = act[i];
      if (a > 0) {
        const v = g[i] + a;
        g[i] = v > 6 ? 6 : v;
      }
    }
    if (dtSim > 0) {
      for (const b of this.blocks) {
        let s = 0;
        for (let i = b.pop.start; i < b.pop.start + b.pop.n; i++) s += act[i];
        b.rate += (s / b.pop.n / dtSim - b.rate) * 0.15;
      }
    }
  }

  draw(): void {
    const img = this.img;
    if (!img) return;
    const { w, h, ctx, dpr } = this;
    const data = new Uint32Array(img.data.buffer);
    data.fill(0xff140f0b); // ABGR: #0b0f14
    const g = this.glow;
    for (let i = 0; i < g.length; i++) {
      const cell = this.cellOf[i];
      if (cell === 0) continue;
      const gl = g[i];
      // a single spike is a clear flash; sustained firing saturates smoothly instead of washing out
      const lum = 0.12 + 0.88 * (1 - Math.exp(-0.9 * gl));
      const white = gl > 3.5 ? (gl - 3.5) * 0.12 : 0;
      const r = Math.min(255, this.colR[i] * lum + 255 * white);
      const gg = Math.min(255, this.colG[i] * lum + 255 * white);
      const b = Math.min(255, this.colB[i] * lum + 255 * white);
      const c = (255 << 24) | (b << 16) | (gg << 8) | r;
      const p = this.px[i];
      const dot = cell > 2 ? cell - 1 : cell;
      for (let yy = 0; yy < dot; yy++) {
        const row = p + yy * w;
        for (let xx = 0; xx < dot; xx++) data[row + xx] = c;
      }
      g[i] = gl * 0.6;
    }
    ctx.putImageData(img, 0, 0);
    // region frames and titles
    ctx.font = `${Math.round(10.5 * dpr)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    for (const r of this.regionRects) {
      ctx.strokeStyle = '#222c3c';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 5 * dpr);
      ctx.stroke();
      ctx.fillStyle = '#7f8ca3';
      ctx.fillText(r.def.title.toUpperCase(), r.x + 6 * dpr, r.y + 4 * dpr);
    }
    // hover
    if (this.mouse) {
      const [mx, my] = this.mouse;
      this.hover = null;
      for (const b of this.blocks) {
        if (mx >= b.x - 2 && mx <= b.x + b.cols * b.cell + 2 && my >= b.y - 2 && my <= b.y + b.rows * b.cell + 2) {
          this.hover = b;
          break;
        }
      }
      if (this.hover) {
        const b = this.hover;
        ctx.strokeStyle = '#ffb454';
        ctx.lineWidth = dpr;
        ctx.strokeRect(b.x - 2.5, b.y - 2.5, b.cols * b.cell + 4, b.rows * b.cell + 4);
        this.tip.style.display = 'block';
        this.tip.style.left = `${Math.min(w / dpr - 190, mx / dpr + 12)}px`;
        this.tip.style.top = `${my / dpr + 14}px`;
        this.tip.textContent = `${b.pop.name} · ${b.pop.n} ${b.pop.inhibitory ? 'hemmende' : 'erregende'} Neuronen · ${b.rate.toFixed(0)} Hz`;
      } else this.tip.style.display = 'none';
    }
    void h;
  }
}
