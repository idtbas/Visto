// Draws the creature and its world from the frames the simulation sends.
import { GEOM, NM } from '../sim/body/biped';
import type { Frame } from '../sim/sim';

type P = [body: number, x: number, y: number];

// purely visual muscle paths: origin, via points, insertion (body-local coordinates)
// body indices within a leg: 0 trunk, 1 thigh, 2 shank, 3 foot
const PATHS: { pts: P[]; width: number }[] = [
  /* HFL */ { pts: [[0, 0.07, 0.13], [1, 0.045, -0.15]], width: 0.05 },
  /* GLU */ { pts: [[0, -0.085, 0.14], [1, -0.04, -0.17]], width: 0.055 },
  /* HAM */ { pts: [[0, -0.07, 0.02], [1, -0.065, -0.43], [2, -0.04, -0.07]], width: 0.05 },
  /* VAS */ { pts: [[1, 0.05, -0.1], [1, 0.07, -0.47], [2, 0.045, -0.08]], width: 0.06 },
  /* GAS */ { pts: [[1, -0.045, -0.44], [2, -0.065, -0.2], [3, -0.06, -0.02]], width: 0.045 },
  /* SOL */ { pts: [[2, -0.045, -0.1], [3, -0.06, -0.02]], width: 0.04 },
  /* TA  */ { pts: [[2, 0.045, -0.07], [2, 0.04, -0.44], [3, 0.07, -0.035]], width: 0.032 },
];
// fraction of the path taken up by the muscle belly (the rest is tendon)
const BELLY = [0.8, 0.8, 0.62, 0.7, 0.42, 0.55, 0.6];

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function muscleColor(act: number, alpha: number): string {
  const t = Math.min(1, Math.max(0, act));
  const e = Math.pow(t, 0.6);
  const r = Math.round(mix(96, 255, e));
  const g = Math.round(mix(44, 92, e) + 60 * Math.max(0, e - 0.7));
  const b = Math.round(mix(58, 64, e));
  return `rgba(${r},${g},${b},${alpha})`;
}

export class BodyView {
  private readonly ctx: CanvasRenderingContext2D;
  private camX = 0;
  private w = 0;
  private h = 0;
  private scale = 100;
  private groundY = 0;
  private frame: Frame | null = null;
  /** recent hip positions for the motion trail */
  private readonly trail: number[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(100, r.width);
    this.h = Math.max(100, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = this.h / 2.75;
    this.groundY = this.h * 0.8;
    this.draw();
  }

  setFrame(f: Frame): void {
    this.frame = f;
    const hipX = f.body[0];
    // the camera leads slightly ahead and follows smoothly
    const target = hipX + 0.25;
    if (Math.abs(target - this.camX) > 5) this.camX = target;
    this.camX += (target - this.camX) * 0.12;
    this.trail.push(hipX, f.body[1]);
    if (this.trail.length > 240) this.trail.splice(0, 2);
  }

  private sx(x: number): number {
    return this.w / 2 + (x - this.camX) * this.scale;
  }
  private sy(y: number): number {
    return this.groundY - y * this.scale;
  }

  draw(): void {
    const c = this.ctx;
    const { w, h } = this;
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0f17');
    sky.addColorStop(1, '#131a26');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    this.drawGround();
    const f = this.frame;
    if (!f) return;
    for (const o of f.obstacles) {
      c.fillStyle = '#2a3445';
      c.strokeStyle = '#51607a';
      c.lineWidth = 1.5;
      const x = this.sx(o.x);
      const y = this.sy(o.h);
      c.beginPath();
      c.rect(x, y, o.w * this.scale, o.h * this.scale);
      c.fill();
      c.stroke();
    }
    this.drawLeg(f, 0, 0.5);
    this.drawTrunk(f);
    this.drawLeg(f, 1, 1);
  }

  private drawGround(): void {
    const c = this.ctx;
    const { w, h, groundY } = this;
    const g = c.createLinearGradient(0, groundY, 0, h);
    g.addColorStop(0, '#1c2533');
    g.addColorStop(1, '#0d1118');
    c.fillStyle = g;
    c.fillRect(0, groundY, w, h - groundY);
    c.strokeStyle = '#4a5870';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, groundY);
    c.lineTo(w, groundY);
    c.stroke();
    // metre marks
    const x0 = Math.floor(this.camX - w / 2 / this.scale) - 1;
    const x1 = Math.ceil(this.camX + w / 2 / this.scale) + 1;
    c.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.textAlign = 'center';
    for (let m = x0; m <= x1; m++) {
      const x = this.sx(m);
      c.strokeStyle = m % 5 === 0 ? '#5d6d88' : '#33405380';
      c.beginPath();
      c.moveTo(x, groundY);
      c.lineTo(x, groundY + (m % 5 === 0 ? 10 : 5));
      c.stroke();
      if (m % 5 === 0) {
        c.fillStyle = '#6f7f9a';
        c.fillText(`${m} m`, x, groundY + 24);
      }
    }
  }

  private pt(f: Frame, body: number, lx: number, ly: number): [number, number] {
    const x = f.body[body * 3];
    const y = f.body[body * 3 + 1];
    const a = f.body[body * 3 + 2];
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    return [this.sx(x + cs * lx - sn * ly), this.sy(y + sn * lx + cs * ly)];
  }

  private bone(f: Frame, body: number, x0: number, y0: number, x1: number, y1: number, width: number, color: string): void {
    const c = this.ctx;
    const a = this.pt(f, body, x0, y0);
    const b = this.pt(f, body, x1, y1);
    c.strokeStyle = color;
    c.lineWidth = width * this.scale;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  }

  private drawTrunk(f: Frame): void {
    const c = this.ctx;
    const g = GEOM;
    this.bone(f, 0, 0, 0.0, 0, g.trunkLen - 0.22, 0.2, '#2b3546');
    this.bone(f, 0, 0, 0.02, 0, g.trunkLen - 0.24, 0.045, '#cfc9ba');
    // pelvis
    this.bone(f, 0, -0.07, 0.06, 0.07, 0.06, 0.07, '#cfc9ba');
    // head
    const hd = this.pt(f, 0, 0, g.trunkLen - 0.1);
    c.fillStyle = '#2b3546';
    c.strokeStyle = '#cfc9ba';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(hd[0], hd[1], 0.11 * this.scale, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // eye looks forward
    const eye = this.pt(f, 0, 0.065, g.trunkLen - 0.08);
    c.fillStyle = '#9fe8ff';
    c.beginPath();
    c.arc(eye[0], eye[1], 0.018 * this.scale, 0, Math.PI * 2);
    c.fill();
  }

  private drawLeg(f: Frame, leg: number, alpha: number): void {
    const c = this.ctx;
    const g = GEOM;
    const th = 1 + leg * 3;
    const sh = 2 + leg * 3;
    const ft = 3 + leg * 3;
    const boneCol = `rgba(207,201,186,${alpha})`;
    c.globalAlpha = 1;
    this.bone(f, th, 0, 0, 0, -g.thighLen, 0.04, boneCol);
    this.bone(f, sh, 0, 0, 0, -g.shankLen, 0.034, boneCol);
    // foot
    this.bone(f, ft, g.footHeelX, g.footSoleY, g.footToeX, g.footSoleY, g.footRadius * 2, boneCol);
    this.bone(f, ft, 0, 0, 0.02, g.footSoleY, 0.04, boneCol);
    // ground contact glow
    const loads = [f.heel[leg], f.toe[leg]];
    const xs = [g.footHeelX, g.footToeX];
    for (let i = 0; i < 2; i++) {
      if (loads[i] < 0.02) continue;
      const p = this.pt(f, ft, xs[i], g.footSoleY - g.footRadius);
      const r = (0.03 + 0.05 * Math.min(1.5, loads[i])) * this.scale;
      const gr = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      gr.addColorStop(0, `rgba(120,220,255,${0.75 * alpha})`);
      gr.addColorStop(1, 'rgba(120,220,255,0)');
      c.fillStyle = gr;
      c.beginPath();
      c.arc(p[0], p[1], r, 0, Math.PI * 2);
      c.fill();
    }
    // muscles and tendons
    for (let m = 0; m < NM; m++) {
      const path = PATHS[m];
      const bodyOf = (b: number): number => (b === 0 ? 0 : leg * 3 + b);
      const pts = path.pts.map(([b, x, y]) => this.pt(f, bodyOf(b), x, y));
      const act = f.muscles[(leg * NM + m) * 3];
      const lrel = f.muscles[(leg * NM + m) * 3 + 1];
      const force = f.muscles[(leg * NM + m) * 3 + 2];
      // total path length
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const bellyLen = total * BELLY[m];
      // tendon: full path, thin
      c.strokeStyle = `rgba(226,214,176,${(0.55 + 0.45 * Math.min(1, force * 1.5)) * alpha})`;
      c.lineWidth = Math.max(1, 0.012 * this.scale);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      // belly: the first part of the path, thicker when shortened
      const bulge = Math.min(1.5, Math.max(0.7, 1 / Math.max(0.5, lrel)));
      c.strokeStyle = muscleColor(act, alpha);
      c.lineWidth = path.width * this.scale * bulge * 0.62;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      let left = bellyLen;
      for (let i = 1; i < pts.length && left > 0; i++) {
        const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const t = Math.min(1, left / seg);
        c.lineTo(mix(pts[i - 1][0], pts[i][0], t), mix(pts[i - 1][1], pts[i][1], t));
        left -= seg;
      }
      c.stroke();
    }
    // joints on top
    c.fillStyle = `rgba(236,232,222,${alpha})`;
    for (const [b, r] of [[th, 0.032], [sh, 0.028], [ft, 0.022]] as const) {
      const p = this.pt(f, b, 0, 0);
      c.beginPath();
      c.arc(p[0], p[1], r * this.scale, 0, Math.PI * 2);
      c.fill();
    }
  }
}
