// Diagnostics for the architecture behind an integrated point of view.
// Everything shown here is read from the neurons of the running simulation:
//  - which content holds the global workspace, as a scrolling record of the last seconds
//  - what the body model predicted for each sense and what was actually felt
//  - how much of the sensation is unexplained ("from outside")
//  - the bodily needs reported by the interoceptive cells
import type { BrainInfo, Frame } from '../sim/sim';

const SENSE_LABEL: Record<string, string> = {
  VestF: 'Rumpf kippt vor',
  VestB: 'Rumpf kippt zurück',
  Load_0: 'Last linker Fuß',
  Load_1: 'Last rechter Fuß',
  OtoVor: 'Kopf ruckt vor',
  OtoRück: 'Kopf ruckt zurück',
};
const CONTENT_COLOR: Record<string, string> = { Körper: '#9fe8ff', Schmerz: '#ff5a50', Gefahr: '#ff8a7a', Sehen: '#78dcff', Bedürfnis: '#f4d35e' };
const NEED_LABEL = ['Hunger', 'Müdigkeit', 'Erschöpfung'];
const SPAN = 20; // seconds of history
const IGNITED = 25;

interface Sample {
  t: number;
  rates: number[];
  external: number;
}

export class InnerView {
  open = false;
  private info: BrainInfo | null = null;
  private readonly ctx: CanvasRenderingContext2D;
  private samples: Sample[] = [];
  private marks: { t: number; kind: 'push' | 'fall' }[] = [];
  private senseRows: { felt: HTMLElement; pred: HTMLElement }[] = [];
  private needRows: HTMLElement[] = [];
  private lastPush = -1;
  private lastFalls = -1;

  constructor(private readonly root: HTMLElement, private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setInfo(info: BrainInfo): void {
    this.info = info;
    this.samples = [];
    this.marks = [];
    this.lastPush = -1;
    this.lastFalls = -1;
    const senses = this.root.querySelector<HTMLElement>('#innerSenses')!;
    senses.textContent = '';
    this.senseRows = info.senseNames.map((name) => {
      const row = document.createElement('div');
      row.className = 'irow';
      row.innerHTML = `<span></span><span class="ibar"><span class="felt"></span><i class="pred"></i></span>`;
      row.firstElementChild!.textContent = SENSE_LABEL[name] ?? name;
      senses.appendChild(row);
      return { felt: row.querySelector<HTMLElement>('.felt')!, pred: row.querySelector<HTMLElement>('.pred')! };
    });
    const needs = this.root.querySelector<HTMLElement>('#innerNeeds')!;
    needs.textContent = '';
    this.needRows = NEED_LABEL.map((label) => {
      const row = document.createElement('div');
      row.className = 'irow';
      row.innerHTML = `<span></span><span class="ibar"><span class="felt need"></span></span>`;
      row.firstElementChild!.textContent = label;
      needs.appendChild(row);
      return row.querySelector<HTMLElement>('.felt')!;
    });
  }

  update(f: Frame): void {
    const inner = f.inner;
    const s = this.samples;
    // a new life or a restored one starts a new record
    if (s.length > 0 && f.time < s[s.length - 1].t) {
      this.samples = [];
      this.marks = [];
    }
    this.samples.push({ t: f.time, rates: inner.workspace, external: inner.external });
    while (this.samples.length > 0 && this.samples[0].t < f.time - SPAN) this.samples.shift();
    if (inner.lastPush >= 0 && inner.lastPush !== this.lastPush) this.marks.push({ t: inner.lastPush, kind: 'push' });
    this.lastPush = inner.lastPush;
    if (this.lastFalls >= 0 && f.life.falls > this.lastFalls) this.marks.push({ t: f.time, kind: 'fall' });
    this.lastFalls = f.life.falls;
    while (this.marks.length > 0 && this.marks[0].t < f.time - SPAN) this.marks.shift();
    if (!this.open || !this.info) return;
    const pct = (v: number): string => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
    this.senseRows.forEach((r, j) => {
      r.felt.style.width = pct(inner.felt[j] / 1.5);
      r.pred.style.left = pct(inner.predicted[j] / 1.5);
    });
    this.needRows.forEach((r, k) => (r.style.width = pct(inner.needs[k])));
    const q = <T extends HTMLElement>(id: string): T => this.root.querySelector<T>(id)!;
    q('#innerExternal').style.width = pct(inner.external);
    q('#innerMismatch').textContent = `${inner.mismatch.toFixed(1)} Hz`;
    q('#innerBrace').style.width = pct(inner.brace / 80);
    const names = this.info.workspaceNames;
    q('#innerNow').textContent = inner.content >= 0 ? names[inner.content] : '–';
    q('#innerNow').style.color = inner.content >= 0 ? (CONTENT_COLOR[names[inner.content]] ?? '#fff') : '';
    q('#innerCount').textContent = names.map((n, k) => `${n} ${inner.ignitions[k]}`).join(' · ');
    this.root.querySelectorAll<HTMLInputElement>('input[data-module]').forEach((el, k) => {
      if (document.activeElement !== el) el.checked = inner.modules[k];
    });
  }

  draw(now: number): void {
    if (!this.open || !this.info) return;
    const c = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width * dpr));
    const h = Math.max(10, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    c.clearRect(0, 0, w, h);
    const names = this.info.workspaceNames;
    const left = 78 * dpr;
    const rows = names.length + 1;
    const rh = h / rows;
    const x = (t: number): number => left + ((t - (now - SPAN)) / SPAN) * (w - left);
    c.font = `${11 * dpr}px Inter, system-ui, sans-serif`;
    c.textBaseline = 'middle';
    names.forEach((name, k) => {
      const y = k * rh;
      c.fillStyle = '#111823';
      c.fillRect(left, y + 2 * dpr, w - left, rh - 4 * dpr);
      c.fillStyle = CONTENT_COLOR[name] ?? '#cfd8e8';
      c.fillText(name, 4 * dpr, y + rh / 2);
      for (let i = 1; i < this.samples.length; i++) {
        const r = this.samples[i].rates[k];
        if (r < 3) continue;
        const x0 = x(this.samples[i - 1].t);
        const x1 = x(this.samples[i].t);
        // faint below the ignition level, full colour above it
        c.globalAlpha = r > IGNITED ? Math.min(1, 0.55 + r / 150) : 0.07 + 0.25 * (r / IGNITED);
        c.fillRect(x0, y + 2 * dpr, Math.max(1, x1 - x0 + 0.5), rh - 4 * dpr);
      }
      c.globalAlpha = 1;
    });
    // last row: unexplained sensation
    const y = names.length * rh;
    c.fillStyle = '#6f7f9a';
    c.fillText('unerklärt', 4 * dpr, y + rh / 2);
    c.strokeStyle = '#9fe8ff';
    c.lineWidth = 1.2 * dpr;
    c.beginPath();
    this.samples.forEach((s, i) => {
      const px = x(s.t);
      const py = y + rh - 3 * dpr - Math.min(1, s.external) * (rh - 6 * dpr);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    });
    c.stroke();
    // events
    for (const m of this.marks) {
      const px = x(m.t);
      if (px < left) continue;
      c.strokeStyle = m.kind === 'push' ? '#ffffff' : '#ff6b6b';
      c.setLineDash(m.kind === 'push' ? [] : [3 * dpr, 3 * dpr]);
      c.lineWidth = 1 * dpr;
      c.beginPath();
      c.moveTo(px, 0);
      c.lineTo(px, h);
      c.stroke();
    }
    c.setLineDash([]);
  }
}
