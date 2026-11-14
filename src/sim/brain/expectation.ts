// Expectation of falling.
//
// At first every walking attempt ends with a fall, so the fall by itself says nothing about
// whether an attempt went well. What matters is *when* it happens compared with experience.
// From the durations of recent attempts this module estimates the hazard of falling at each
// moment of an attempt. Staying on its feet through a moment at which it usually falls is
// better than expected (dopamine rises a little all the time); the fall itself is always
// worse than expected. On average the two cancel exactly, so only attempts that last longer
// or shorter than usual leave a net trace.
const STEP = 0.05; // s
const WINDOW = 0.4; // s, smoothing of the hazard estimate

export class FallExpectation {
  private readonly durations: number[] = [];
  private table = new Float32Array(0);
  private tail = 0.5;

  constructor(private readonly memory = 40) {
    this.rebuild();
  }

  /** an attempt ended after `duration` seconds */
  record(duration: number): void {
    this.durations.push(duration);
    if (this.durations.length > this.memory) this.durations.shift();
    this.rebuild();
  }

  get mean(): number {
    if (this.durations.length === 0) return 0;
    return this.durations.reduce((a, b) => a + b, 0) / this.durations.length;
  }

  private rebuild(): void {
    const d = this.durations;
    if (d.length < 3) {
      this.table = new Float32Array(0);
      this.tail = 0.5;
      return;
    }
    const max = Math.max(...d);
    const n = Math.ceil(max / STEP) + 1;
    this.table = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i * STEP;
      let alive = 0;
      let ending = 0;
      for (const x of d) {
        if (x >= t) {
          alive++;
          if (x < t + WINDOW) ending++;
        }
      }
      // one pseudo-observation keeps the estimate finite when few attempts got this far
      this.table[i] = ending / ((alive + 1) * WINDOW);
    }
    this.tail = 1 / (this.mean + 1);
  }

  /** expected falls per second at `t` seconds into an attempt */
  hazard(t: number): number {
    const i = Math.floor(t / STEP);
    return i < this.table.length ? this.table[i] : this.tail;
  }

  save(): number[] {
    return this.durations.slice();
  }
  load(d: number[]): void {
    this.durations.length = 0;
    this.durations.push(...d.slice(-this.memory));
    this.rebuild();
  }
}
