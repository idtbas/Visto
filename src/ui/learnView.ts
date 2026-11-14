// The learning curve: how far did each walking attempt get?
export class LearnView {
  private readonly ctx: CanvasRenderingContext2D;
  private list: number[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  setAttempts(list: number[]): void {
    this.list = list;
    this.draw();
  }

  draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(50, r.width);
    const h = Math.max(30, r.height);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const list = this.list;
    const padL = 34;
    const padB = 4;
    const padT = 6;
    const plotW = w - padL - 6;
    const plotH = h - padB - padT;
    // square-root scale keeps both the first stumbles and long walks readable
    const maxV = Math.max(4, ...list);
    const y = (v: number): number => padT + plotH * (1 - Math.sqrt(v / maxV));
    c.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    const ticks = maxV > 60 ? [0, 10, 50, Math.round(maxV)] : maxV > 12 ? [0, 2, 10, Math.round(maxV)] : [0, 1, Math.round(maxV)];
    for (const t of ticks) {
      c.strokeStyle = '#1e2736';
      c.beginPath();
      c.moveTo(padL, y(t));
      c.lineTo(w - 6, y(t));
      c.stroke();
      c.fillStyle = '#6f7f9a';
      c.fillText(`${t} m`, padL - 6, y(t));
    }
    if (list.length === 0) {
      c.fillStyle = '#6f7f9a';
      c.textAlign = 'center';
      c.fillText('noch kein Versuch beendet', padL + plotW / 2, padT + plotH / 2);
      return;
    }
    const n = list.length;
    const step = plotW / Math.max(n, 40);
    // one dot per attempt
    c.fillStyle = 'rgba(120, 220, 255, 0.55)';
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.arc(padL + (i + 0.5) * step, y(list[i]), n > 300 ? 1.2 : 2, 0, Math.PI * 2);
      c.fill();
    }
    // running average over the last 15 attempts
    c.strokeStyle = '#ffb454';
    c.lineWidth = 2;
    c.beginPath();
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += list[i];
      if (i >= 15) sum -= list[i - 15];
      const avg = sum / Math.min(i + 1, 15);
      const px = padL + (i + 0.5) * step;
      if (i === 0) c.moveTo(px, y(avg));
      else c.lineTo(px, y(avg));
    }
    c.stroke();
  }
}
