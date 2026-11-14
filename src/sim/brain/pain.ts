// Pain.
//
// Pain receptors (nociceptors) sit in the skin of the body parts that are not made for
// carrying weight, and in the ligaments of the joints. They are silent in normal walking
// and fire when a body part hits the ground hard or a joint is forced against its end stop.
// How strongly and how long they fire depends on how hard the impact was.
//
// Their signal travels through a relay nucleus to the habenula. The habenula excites
// inhibitory cells (rostromedial tegmentum) that silence the dopamine neurons: pain is
// "worse than expected", and the synapses that were just active are weakened. The same
// signal raises the stress hormone.
import { Network, NT, Pop } from './network';
import { currentForRate } from './spinal';
import { N_SKIN, SKIN, type Biped } from '../body/biped';

export const PAIN_SITES = [
  'Gesicht', 'Hinterkopf', 'Bauch', 'Rücken',
  'Oberschenkel links', 'Oberschenkel rechts', 'Knie links', 'Knie rechts',
  'Hüftgelenk links', 'Hüftgelenk rechts', 'Kniegelenk links', 'Kniegelenk rechts', 'Sprunggelenk links', 'Sprunggelenk rechts',
] as const;
export const N_PAIN = PAIN_SITES.length;

/** load on the skin that starts to hurt, in body weights (lying still is below this) */
const SKIN_THRESHOLD = 2;
/** torque on the end stop of hip, knee and ankle that starts to hurt [N m]; the knee stop is
 *  touched in every normal step with up to about 65 N m */
const JOINT_THRESHOLD = [40, 100, 60];
const JOINT_SCALE = 400;
/** how quickly a pain builds up per unit of excess load, and how long it lingers [ms] */
const GAIN = 6 / 1000;
const TAU = 250;
/** a receptor that is pressed continuously stops responding within about this time [ms] */
const TAU_ADAPT = 200;
const N_NOCI = 12;
const N_RELAY = 64;
const N_HAB = 48;
const N_RMTG = 32;
/** numeric cost of pain per second at a relay rate of 100 Hz, calibrated so that an average
 *  fall costs about as much as the fixed fall cost used before (1.5) */
const COST = 3.6;

export class Pain {
  /** current pain level per site, 0 = none, about 1 = a hard fall */
  readonly level = new Float32Array(N_PAIN);
  readonly nociceptors: Pop[] = [];
  readonly relay: Pop;
  readonly habenula: Pop;
  readonly rmtg: Pop;
  /** pain as a negative reward rate (per second), decoded from the relay nucleus */
  cost = 0;
  /** switch the pain system off (nothing hurts) */
  enabled = true;
  private readonly drive = new Float32Array(N_PAIN);
  private readonly adapt = new Float32Array(N_PAIN);

  constructor(readonly net: Network, readonly biped: Biped, vta: Pop) {
    for (let s = 0; s < N_PAIN; s++) {
      this.nociceptors.push(net.addPop({ name: `Noz_${PAIN_SITES[s]}`, n: N_NOCI, type: NT.RELAY, region: 'pain', bias: 2.0, biasJitter: 0.4, noise: 1.5 }));
    }
    this.relay = net.addPop({ name: 'Schmerzkern', n: N_RELAY, type: NT.RELAY, region: 'pain_relay', bias: 0.5, biasJitter: 0.6, noise: 1.5 });
    this.habenula = net.addPop({ name: 'Habenula', n: N_HAB, type: NT.RELAY, region: 'habenula', bias: 0.5, biasJitter: 0.6, noise: 1.5 });
    this.rmtg = net.addPop({ name: 'RMTg', n: N_RMTG, type: NT.FS, region: 'habenula', bias: 0, biasJitter: 0.6, noise: 1.5, inhibitory: true });
    for (const noz of this.nociceptors) {
      net.connect({ pre: noz, post: this.relay, channel: 'E', p: 0.5, w: 14 / (N_NOCI * 0.5), wJitter: 0.3, delay: [3, 8] });
    }
    net.connect({ pre: this.relay, post: this.habenula, channel: 'E', p: 0.5, w: 22 / (N_RELAY * 0.5), wJitter: 0.3, delay: [2, 5] });
    net.connect({ pre: this.habenula, post: this.rmtg, channel: 'E', p: 0.5, w: 24 / (N_HAB * 0.5), wJitter: 0.3, delay: [1, 3] });
    net.connect({ pre: this.rmtg, post: vta, channel: 'I', p: 0.5, w: 60 / (N_RMTG * 0.5), wJitter: 0.3, delay: [1, 3] });
  }

  /** read the pain receptors of the body and drive the nociceptor neurons */
  sense(asleep: boolean): void {
    const b = this.biped;
    const d = this.drive;
    d.fill(0);
    // In sleep the pain pathway is shut (the limp body sinking to the ground does not hurt).
    if (this.enabled && !asleep) {
      const skin = (load: number): number => (load > SKIN_THRESHOLD ? load - SKIN_THRESHOLD : 0);
      // head and trunk: the side that is turned to the ground
      const front = b.theta > 0 ? 0 : 1;
      d[0 + front] = skin(b.skinLoad[SKIN.head]);
      d[2 + front] = skin(b.skinLoad[SKIN.trunk]);
      for (let leg = 0; leg < 2; leg++) {
        d[4 + leg] = skin(b.skinLoad[SKIN.thigh + leg]);
        d[6 + leg] = skin(b.skinLoad[SKIN.shank + leg]);
        for (let j = 0; j < 3; j++) {
          const over = b.jointStrain[leg * 3 + j] - JOINT_THRESHOLD[j];
          // scaled so that a badly overstretched joint hurts about as much as a hard impact
          if (over > 0) d[8 + j * 2 + leg] = Math.min(12, (over / JOINT_SCALE) * 5);
        }
      }
    }
    const iext = this.net.iext;
    const lv = this.level;
    for (let s = 0; s < N_PAIN; s++) {
      // the receptors answer to a new load, not to one that just stays
      const a = this.adapt[s];
      this.adapt[s] = a + ((d[s] > 1 ? 1 : d[s]) - a) / TAU_ADAPT;
      let l = lv[s] + GAIN * d[s] * (1 - a) - lv[s] / TAU;
      if (l > 1.5) l = 1.5;
      lv[s] = l;
      const cur = l > 0.03 ? currentForRate(100 * l) : -4;
      const p = this.nociceptors[s];
      for (let i = p.start; i < p.end; i++) iext[i] = cur;
    }
    this.cost = this.relay.rate > 3 ? (COST * this.relay.rate) / 100 : 0;
  }

  /** overall pain right now, 0..1 */
  get intensity(): number {
    return Math.min(1, this.relay.rate / 120);
  }

  reset(): void {
    this.level.fill(0);
    this.adapt.fill(0);
  }
}

void N_SKIN;
