// Bars and short histories for the creature's hormones.
import { HORMONES, HORMONE_INFO } from '../sim/brain/hormones';

const HIST = 240;

export class HormoneView {
  private readonly rows: { fill: HTMLElement; val: HTMLElement; canvas: HTMLCanvasElement; hist: Float32Array }[] = [];
  private head = 0;
  private lastSample = -1;

  constructor(root: HTMLElement) {
    for (const h of HORMONES) {
      const info = HORMONE_INFO[h];
      const row = document.createElement('div');
      row.className = 'hrow';
      row.title = `${info.label} (Vorbild: ${info.model}) – ${info.text}`;
      row.innerHTML =
        `<span class="hname"><i style="background:${info.color}"></i>${info.label}</span>` +
        `<span class="hbar"><span class="hfill" style="background:${info.color}"></span></span>` +
        `<canvas class="hspark" width="240" height="44"></canvas>` +
        `<span class="hval">0</span>`;
      root.appendChild(row);
      this.rows.push({
        fill: row.querySelector('.hfill')!,
        val: row.querySelector('.hval')!,
        canvas: row.querySelector('canvas')!,
        hist: new Float32Array(HIST),
      });
    }
  }

  update(levels: number[], simTime: number): void {
    const sample = Math.floor(simTime * 4); // four samples per simulated second: one minute of history
    const push = sample !== this.lastSample;
    if (push) {
      this.lastSample = sample;
      this.head = (this.head + 1) % HIST;
    }
    HORMONES.forEach((h, k) => {
      const r = this.rows[k];
      const v = levels[k];
      r.fill.style.width = `${Math.round(v * 100)}%`;
      r.val.textContent = String(Math.round(v * 100));
      if (!push) return;
      r.hist[this.head] = v;
      const c = r.canvas.getContext('2d')!;
      const w = r.canvas.width;
      const hh = r.canvas.height;
      c.clearRect(0, 0, w, hh);
      c.strokeStyle = HORMONE_INFO[h].color;
      c.lineWidth = 2.5;
      c.beginPath();
      for (let i = 0; i < HIST; i++) {
        const val = r.hist[(this.head + 1 + i) % HIST];
        const x = (i / (HIST - 1)) * w;
        const y = hh - 3 - val * (hh - 6);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    });
  }
}
