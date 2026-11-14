// The cerebellum: learns to anticipate.
//
// Mossy fibres bring in everything the body feels and does. A huge number of granule cells
// recombines these signals into a sparse code of the current situation. Purkinje cells read
// that code through plastic parallel-fibre synapses and inhibit the cerebellar nuclei, which
// can add drive to a muscle. Whenever a balance reflex has to work much harder than usual
// (a push, a stumble), the inferior olive fires and its climbing fibres weaken the
// parallel-fibre synapses that were just active. Next time the same situation comes up, the
// Purkinje cells pause, the nuclei fire and the muscle is activated before the reflex has
// to react. Ordinary reflex activity during normal walking is not an error and leaves the
// synapses in balance.
import { Network, NT, Pop, Proj } from './network';
import type { SpinalCord } from './spinal';
import { M, NM, type MuscleName } from '../body/biped';

export interface CerebellumOptions {
  /** number of granule cells */
  granules: number;
}

interface Zone {
  name: string;
  muscle: MuscleName;
  leg: number;
  /** spinal reflex interneuron pools whose activity is the teaching signal */
  teachers: Pop[];
  io: Pop;
  pc: Pop;
  dcn: Pop;
  pf: Proj;
  /** smoothed teaching signal 0..1 */
  error: number;
  /** what this reflex usually does [Hz] */
  usual: number;
}

const N_PC = 16;
const N_DCN = 16;
const N_IO = 4;

// which reflex pathways report that a muscle had to correct the posture
const TEACHERS: { muscle: MuscleName; paths: string[] }[] = [
  { muscle: 'HAM', paths: ['wVestHam', 'sVestHam'] },
  { muscle: 'GLU', paths: ['wVestGlu', 'sVestGlu'] },
  { muscle: 'HFL', paths: ['wVestHfl', 'sVestHfl'] },
  { muscle: 'VAS', paths: ['sVasL'] },
  { muscle: 'SOL', paths: ['sSolCop'] },
  { muscle: 'TA', paths: ['sTaCop'] },
];

export class Cerebellum {
  readonly granule: Pop;
  readonly golgi: Pop;
  readonly zones: Zone[] = [];
  /** scales how strongly the nuclei drive the muscles */
  outputGain = 1;

  constructor(readonly net: Network, spinal: SpinalCord, opt: CerebellumOptions) {
    const nGr = opt.granules;
    this.granule = net.addPop({ name: 'Granule', n: nGr, type: NT.RS, region: 'cerebellum_granule', bias: -3, biasJitter: 1, noise: 1.5 });
    this.golgi = net.addPop({ name: 'Golgi', n: Math.max(16, Math.round(nGr / 100)), type: NT.FS, region: 'cerebellum', bias: 0, biasJitter: 1, noise: 2, inhibitory: true });

    // mossy fibres: sensation (afferents) and efference copy (motoneurons)
    const sources: Pop[] = [...net.pops.filter((p) => p.region === 'afferent'), ...spinal.mn];
    for (const src of sources) {
      // on average every granule cell listens to four mossy fibres
      const fan = Math.max(1, Math.round((nGr * 4) / (sources.length * src.n)));
      net.connect({ pre: src, post: this.granule, channel: 'E', fanOut: fan, w: 9, wJitter: 0.3, delay: [2, 5] });
    }
    // Golgi cells keep the granule code sparse
    net.connect({ pre: this.granule, post: this.golgi, channel: 'E', fanOut: 2, w: 0.6, wJitter: 0.5, delay: [1, 3] });
    net.connect({ pre: this.golgi, post: this.granule, channel: 'I', fanOut: Math.min(nGr, 600), w: 1.2, wJitter: 0.5, delay: [1, 3] });

    for (let leg = 0; leg < 2; leg++) {
      for (const t of TEACHERS) {
        const name = `${t.muscle}_${leg}`;
        const teachers = t.paths.map((p) => spinal.pathIn[leg][spinal.defs.findIndex((d) => d.name === p)]);
        const io = net.addPop({ name: `IO_${name}`, n: N_IO, type: NT.RS, region: 'cerebellum', bias: 2.1, biasJitter: 0.4, noise: 2 });
        const pc = net.addPop({ name: `PC_${name}`, n: N_PC, type: NT.FS, region: 'cerebellum', bias: 2.5, biasJitter: 0.8, noise: 2, inhibitory: true });
        const dcn = net.addPop({ name: `DCN_${name}`, n: N_DCN, type: NT.RELAY, region: 'cerebellum', bias: 7, biasJitter: 1, noise: 2 });
        // every granule cell contacts two Purkinje cells of each zone
        const pf = net.connect({
          pre: this.granule, post: pc, channel: 'E', fanOut: 2, w: 0.3, wJitter: 0.3, delay: [2, 6],
          plastic: { rule: 'cf', ltp: 0.00006, ltd: 0.0004, wMin: 0.05, wMax: 0.8 },
        });
        net.connect({ pre: io, post: pc, channel: 'C', p: 1, w: 1, delay: 2 });
        net.connect({ pre: pc, post: dcn, channel: 'I', p: 0.6, w: 40 / (N_PC * 0.6), wJitter: 0.3, delay: [1, 3] });
        const out = net.connect({ pre: dcn, post: spinal.mn[leg * NM + M[t.muscle]], channel: 'E', p: 0.5, w: 4 / (N_DCN * 0.5), wJitter: 0.3, delay: [2, 4] });
        void out;
        this.zones.push({ name, muscle: t.muscle, leg, teachers, io, pc, dcn, pf, error: 0, usual: 20 });
      }
    }
  }

  /** drive the inferior olive with the current teaching signals */
  step(): void {
    const iext = this.net.iext;
    for (const z of this.zones) {
      let r = 0;
      for (const t of z.teachers) r += t.rate;
      // only activity well above the usual level of this reflex counts as an error
      z.usual += (r - z.usual) * (1 / 20000);
      const e = Math.min(1, Math.max(0, (r - 1.6 * z.usual - 8) / 50));
      z.error += (e - z.error) * 0.02;
      const cur = 9 * z.error;
      for (let i = z.io.start; i < z.io.end; i++) iext[i] = cur;
    }
  }
}
