// Small separable CMA-ES (diagonal covariance) for offline parameter searches.
import { mulberry32, gaussian } from '../src/sim/util/rng';

export interface CmaOptions {
  x0: number[];
  sigma: number[];
  lambda?: number;
  seed?: number;
  generations: number;
  /** returns fitness to MAXIMISE */
  evaluate: (x: number[]) => number;
  onGeneration?: (gen: number, best: number, bestX: number[], mean: number[]) => void;
}

export function cmaes(opt: CmaOptions): { x: number[]; f: number } {
  const n = opt.x0.length;
  const rng = mulberry32(opt.seed ?? 1);
  const lambda = opt.lambda ?? 4 + Math.floor(3 * Math.log(n));
  const mu = Math.floor(lambda / 2);
  const w: number[] = [];
  for (let i = 0; i < mu; i++) w.push(Math.log(mu + 0.5) - Math.log(i + 1));
  const ws = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < mu; i++) w[i] /= ws;
  const mueff = 1 / w.reduce((a, b) => a + b * b, 0);
  const cs = (mueff + 2) / (n + mueff + 5);
  const ds = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cs;
  const cc = (4 + mueff / n) / (n + 4 + (2 * mueff) / n);
  const sep = (n + 2) / 3;
  const c1 = Math.min(1, (sep * 2) / ((n + 1.3) ** 2 + mueff));
  const cmu = Math.min(1 - c1, (sep * 2 * (mueff - 2 + 1 / mueff)) / ((n + 2) ** 2 + mueff));
  const chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
  let sigma = 1;
  const mean = new Array<number>(n).fill(0); // in units of opt.sigma around x0
  const C = new Array<number>(n).fill(1);
  const ps = new Array<number>(n).fill(0);
  const pc = new Array<number>(n).fill(0);
  let bestF = -Infinity;
  let bestX = opt.x0.slice();
  const toX = (z: number[]): number[] => z.map((v, i) => opt.x0[i] + v * opt.sigma[i]);
  for (let gen = 0; gen < opt.generations; gen++) {
    const pop: { z: number[]; y: number[]; f: number }[] = [];
    for (let k = 0; k < lambda; k++) {
      const y = new Array<number>(n);
      const z = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        y[i] = Math.sqrt(C[i]) * gaussian(rng);
        z[i] = mean[i] + sigma * y[i];
      }
      const f = opt.evaluate(toX(z));
      pop.push({ z, y, f });
      if (f > bestF) {
        bestF = f;
        bestX = toX(z);
      }
    }
    pop.sort((a, b) => b.f - a.f);
    const yw = new Array<number>(n).fill(0);
    for (let k = 0; k < mu; k++) for (let i = 0; i < n; i++) yw[i] += w[k] * pop[k].y[i];
    for (let i = 0; i < n; i++) mean[i] += sigma * yw[i];
    let psn = 0;
    for (let i = 0; i < n; i++) {
      ps[i] = (1 - cs) * ps[i] + Math.sqrt(cs * (2 - cs) * mueff) * (yw[i] / Math.sqrt(C[i]));
      psn += ps[i] * ps[i];
    }
    psn = Math.sqrt(psn);
    const hsig = psn / Math.sqrt(1 - (1 - cs) ** (2 * (gen + 1))) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
    for (let i = 0; i < n; i++) {
      pc[i] = (1 - cc) * pc[i] + hsig * Math.sqrt(cc * (2 - cc) * mueff) * yw[i];
      let rankMu = 0;
      for (let k = 0; k < mu; k++) rankMu += w[k] * pop[k].y[i] * pop[k].y[i];
      C[i] = (1 - c1 - cmu) * C[i] + c1 * (pc[i] * pc[i] + (1 - hsig) * cc * (2 - cc) * C[i]) + cmu * rankMu;
    }
    sigma *= Math.exp((cs / ds) * (psn / chiN - 1));
    opt.onGeneration?.(gen, bestF, bestX, toX(mean));
  }
  return { x: bestX, f: bestF };
}
