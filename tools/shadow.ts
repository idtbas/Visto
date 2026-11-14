// Shadow calibration: the reference controller walks the body while the spiking spinal cord
// receives the same sensations. For every reflex pathway we compare what the neurons deliver
// with what the reference equations ask for, and derive a correction of its synaptic strength.
// usage: tsx tools/shadow.ts <params.json> <out.json> [iterations] [scale]
// The reference first stands (and is pushed around), then walks.
import { readFileSync, writeFileSync } from 'node:fs';
import { Vec2 } from 'planck';
import { Physics } from '../src/sim/world/physics';
import { Network } from '../src/sim/brain/network';
import { SpinalCord, EXTRA_NAMES } from '../src/sim/brain/spinal';
import { ReflexController, initialPose, REFLEX_DEFAULTS } from '../src/sim/control/reflex';
import { NM, MUSCLE_NAMES, staggeredStandPose } from '../src/sim/body/biped';

const p = REFLEX_DEFAULTS.slice();
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (let i = 0; i < j.params.length; i++) p[i] = j.params[i];
const out = process.argv[3];
const iterations = Number(process.argv[4] ?? 3);
const scale = Number(process.argv[5] ?? 1);

let mult: number[] | null = j.mult ?? null;
for (let it = 0; it < iterations; it++) {
  const rows: string[] = [];
  for (const standMode of [true, false]) {
    const ph = new Physics();
    const b = ph.biped;
    b.setPose(standMode ? staggeredStandPose() : initialPose(p));
    const ctrl = new ReflexController(b, p);
    ctrl.mode = standMode ? 'stand' : 'walk';
    const net = new Network(1 + it);
    const sc = new SpinalCord(net, b, p, { scale, mult: mult ?? undefined });
    net.build();
    sc.go = standMode ? 0 : 1;
    if (!mult) mult = sc.pathNames.map(() => 1);
    const nP = sc.defs.length;
    const sumT = new Float64Array(nP);
    const sumR = new Float64Array(nP);
    const used = new Float64Array(nP);
    const stimRef = new Float64Array(2 * NM);
    const stimNet = new Float64Array(2 * NM);
    const cnt = [0, 0];
    const netStim = new Float32Array(2 * NM);
    let trOn = 0, trOnN = 0, trOff = 0, trOffN = 0;
    const T = standMode ? 8000 : 10000;
    let i = 0;
    for (; i < T; i++) {
      sc.sense();
      net.step();
      sc.act();
      netStim.set(b.stim);
      ctrl.step();
      if (i > 400) {
        for (let leg = 0; leg < 2; leg++) {
          const st = ctrl.stance[leg];
          const ph01 = st ? 0 : 1;
          cnt[ph01]++;
          for (let m = 0; m < NM; m++) {
            stimRef[ph01 * NM + m] += b.stim[leg * NM + m];
            stimNet[ph01 * NM + m] += netStim[leg * NM + m];
          }
          const load = b.legLoad(leg);
          sc.defs.forEach((d, k) => {
            if ((d.mode === 'stand') !== standMode) return;
            const gate = d.phase === 'any' || standMode ? 1 : d.phase === 'stance' ? (st ? 1 : 0) : st ? 0 : 1;
            let target = d.gain * sc.affValue(d.global ? d.aff : `${d.aff}_${leg}`) * gate;
            if (!standMode && d.global && d.phase === 'stance') target *= load / 0.6;
            sumT[k] += target * 100;
            used[k]++;
            sumR[k] += sc.pathIn[leg][k].count * (1000 / sc.pathIn[leg][k].n);
          });
          if (standMode) continue;
          const other = 1 - leg;
          const trailing = st && ctrl.stance[other] && b.foot[leg].getPosition().x < b.foot[other].getPosition().x;
          const tr = net.pop(`TR_${leg}`);
          if (trailing) { trOn += tr.count * (1000 / tr.n); trOnN++; } else { trOff += tr.count * (1000 / tr.n); trOffN++; }
        }
      }
      if (standMode && i % 2000 === 1500) {
        // pushes excite the balance reflexes so that they can be calibrated too
        const dir = (i / 2000) & 1 ? -1 : 1;
        b.trunk.applyLinearImpulse(new Vec2(22 * dir, 0), b.trunk.getWorldPoint(new Vec2(0, 0.3)), true);
      }
      ph.step();
      if (b.hipY() < 0.7) { console.log(`reference fell at ${i} ms (${standMode ? 'standing' : 'walking'})`); break; }
    }
    sc.defs.forEach((d, k) => {
      if ((d.mode === 'stand') !== standMode) return;
      // pathways that were hardly used in this run cannot be judged: leave them alone
      const n = Math.max(1, used[k]);
      const ok = sumT[k] / n > 0.7;
      const ratio = ok && sumR[k] > 0 ? sumT[k] / sumR[k] : 1;
      rows.push(`${d.name}: want ${(sumT[k] / n).toFixed(1)} Hz got ${(sumR[k] / n).toFixed(1)} Hz → ×${ratio.toFixed(2)}`);
      mult![k] *= Math.pow(Math.min(3, Math.max(0.33, ratio)), 0.6);
    });
    if (!standMode) rows.push(`TR (swing initiation): ${(trOn / Math.max(1, trOnN)).toFixed(0)} Hz when trailing in double support, ${(trOff / Math.max(1, trOffN)).toFixed(1)} Hz otherwise; walked ${b.hipX().toFixed(1)} m`);
    for (const [ph01, label] of [[0, 'stance'], [1, 'swing ']] as const) {
      if (cnt[ph01] === 0) continue;
      const a: string[] = [];
      for (let m = 0; m < NM; m++) a.push(`${MUSCLE_NAMES[m]} ${(stimRef[ph01 * NM + m] / cnt[ph01]).toFixed(2)}/${(stimNet[ph01 * NM + m] / cnt[ph01]).toFixed(2)}`);
      rows.push(`${standMode ? 'standing' : 'walking'} ${label} mean stim ref/net: ${a.join('  ')}`);
    }
  }
  console.log(`--- iteration ${it}`);
  console.log(rows.join('\n'));
}
const names = new SpinalCord(new Network(1), new Physics().biped, p).pathNames;
writeFileSync(out, JSON.stringify({ fitness: 0, params: p, mult, names, extra: EXTRA_NAMES }, null, 1));
