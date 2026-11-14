// The body-sense cortex (somatosensory cortex).
//
// Everything the body feels arrives here: muscle length and force, the load on the feet, the
// sense of balance, pain, and a copy of the commands to the muscles. A large number of cells
// recombines these signals: each cell listens to a handful of nerve fibres and only fires
// when several of them are active together. Inhibitory cells keep the activity sparse. The
// result is a code for "what posture am I in and what is happening to me", which other
// regions can read – the amygdala uses it to learn which situations end in pain.
//
// There is one area for each leg and one for trunk and balance; every area also hears a
// little from the others.
import { Network, NT, Pop } from './network';
import type { SpinalCord } from './spinal';
import type { Pain } from './pain';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const W_IN = Number(env.S1_W ?? 6);
const BIAS = Number(env.S1_BIAS ?? -6);
const W_INH = Number(env.S1_INH ?? 1.5);
const W_EI = Number(env.S1_EI ?? 6);

export class BodyCortex {
  readonly areas: Pop[] = [];
  readonly inhibitory: Pop[] = [];

  /** @param n number of excitatory cells in total */
  constructor(readonly net: Network, spinal: SpinalCord, pain: Pain, n: number) {
    const aff = net.pops.filter((p) => p.region === 'afferent');
    const ofLeg = (leg: number): Pop[] => [...aff.filter((p) => p.name.endsWith(`_${leg}`)), ...spinal.mn.filter((p) => p.name.endsWith(`_${leg}`))];
    const balance = aff.filter((p) => !/_[01]$/.test(p.name));
    const painOf = (re: RegExp): Pop[] => pain.nociceptors.filter((p) => re.test(p.name));
    const spec = [
      { name: 'Bein_links', n: Math.round(n * 0.375), own: [...ofLeg(0), ...painOf(/links/)], other: [...ofLeg(1), ...balance] },
      { name: 'Bein_rechts', n: Math.round(n * 0.375), own: [...ofLeg(1), ...painOf(/rechts/)], other: [...ofLeg(0), ...balance] },
      {
        name: 'Rumpf', n: Math.round(n * 0.25),
        own: [...balance, ...aff.filter((p) => /^(Load|LoadG|CopF|CopB|HipExt)_/.test(p.name)), ...painOf(/Gesicht|Hinterkopf|Bauch|Rücken/)],
        other: [...ofLeg(0), ...ofLeg(1)],
      },
    ];
    for (const a of spec) {
      const exc = net.addPop({ name: `S1_${a.name}`, n: a.n, type: NT.RS, region: 'cortex_body', bias: BIAS, biasJitter: 1, noise: 1.5 });
      const inh = net.addPop({ name: `S1i_${a.name}`, n: Math.max(16, Math.round(a.n / 16)), type: NT.FS, region: 'cortex_body', bias: 0, biasJitter: 1, noise: 2, inhibitory: true });
      // on average every cell listens to four fibres of its own body part and two from elsewhere
      const wire = (sources: Pop[], perCell: number): void => {
        const fibres = sources.reduce((s, p) => s + p.n, 0);
        for (const src of sources) {
          const fan = Math.max(1, Math.round((a.n * perCell) / fibres));
          net.connect({ pre: src, post: exc, channel: 'E', fanOut: fan, w: W_IN, wJitter: 0.3, delay: [3, 9] });
        }
      };
      wire(a.own, 4);
      wire(a.other, 2);
      net.connect({ pre: exc, post: inh, channel: 'E', fanOut: 2, w: W_EI, wJitter: 0.5, delay: [1, 3] });
      net.connect({ pre: inh, post: exc, channel: 'I', fanOut: Math.min(a.n, 600), w: W_INH, wJitter: 0.5, delay: [1, 3] });
      this.areas.push(exc);
      this.inhibitory.push(inh);
    }
  }

  /** mean firing rate of the excitatory cells [Hz] */
  get rate(): number {
    let sum = 0;
    let n = 0;
    for (const a of this.areas) {
      sum += a.rate * a.n;
      n += a.n;
    }
    return sum / n;
  }
}
