// The creature's own neuromodulators and hormones.
//
// Each substance has sources that release it, a clearance time, and effects on the nervous
// system. They also influence each other. None of this is "emotion" – these are slow control
// loops that switch the brain between operating modes (alert, cautious, exploring, resting).
//
// All levels are dimensionless; 0 is absence, around 0.2–0.5 is everyday, 1 is very high.

export const HORMONES = ['dopamin', 'vigilin', 'fokin', 'serenin', 'stressin', 'ergin', 'somnin', 'plastin'] as const;
export type HormoneName = (typeof HORMONES)[number];

export const HORMONE_INFO: Record<HormoneName, { label: string; model: string; text: string; color: string }> = {
  dopamin: { label: 'Dopamin', model: 'Dopamin', text: 'Besser oder schlechter als erwartet. Schreibt kürzlich benutzte Synapsen fest.', color: '#ffb454' },
  vigilin: { label: 'Vigilin', model: 'Noradrenalin', text: 'Wachheit bei Überraschung. Macht Neuronen empfindlicher und das Lernen schneller.', color: '#78dcff' },
  fokin: { label: 'Fokin', model: 'Acetylcholin', text: 'Steigt bei Unsicherheit. Schaltet auf Ausprobieren statt Abspulen.', color: '#b9a3ff' },
  serenin: { label: 'Serenin', model: 'Serotonin', text: 'Ruhe in stabilen Phasen. Bremst hastige Bewegungen.', color: '#7ee0a1' },
  stressin: { label: 'Stressin', model: 'Cortisol', text: 'Nach Stürzen und Misserfolg. Macht vorsichtig; dauerhaft hoch stört es das Lernen.', color: '#ff6b6b' },
  ergin: { label: 'Ergin', model: 'Hungerhormon', text: 'Steigt, wenn die Energiereserve sinkt. Macht Cookies wertvoller.', color: '#f4d35e' },
  somnin: { label: 'Somnin', model: 'Adenosin', text: 'Schlafdruck. Wächst im Wachen, wird im Schlaf abgebaut.', color: '#8fa3c7' },
  plastin: { label: 'Plastin', model: 'Wachstumsfaktor BDNF', text: 'Nach sinnvoller Aktivität. Verstärkt das Lernen der Synapsen.', color: '#ff9ed8' },
};

/** what the body and the reward system report to the endocrine system every tick */
export interface HormoneInputs {
  /** reward prediction error (signed) */
  rpe: number;
  /** phasic dopamine level from the dopamine neurons */
  dopamine: number;
  /** a painful event happened in this tick (fall), 0..1 */
  pain: number;
  /** sudden sensory surprise 0..1 (push, stumble, something new in sight) */
  surprise: number;
  /** metabolic power of the muscles [W] */
  power: number;
  /** energy taken in this tick (cookies), in fractions of the full store */
  intake: number;
  /** the creature is asleep */
  asleep: boolean;
  /** overall neural activity, spikes per neuron per second */
  activity: number;
}

/** how the current hormone levels change the way the nervous system works */
export interface HormoneEffects {
  /** multiplies all synaptic learning rates */
  learningRate: number;
  /** amplitude of exploratory variation */
  exploration: number;
  /** extra excitability (input current) for interneurons */
  arousal: number;
  /** scales the walk command: 1 = normal pace */
  vigor: number;
  /** multiplies the value of food rewards */
  appetite: number;
  /** extra muscle tone when cautious 0..1 */
  caution: number;
  /** strength available to the muscles (drops when starving) */
  strength: number;
  wantsSleep: boolean;
}

const DT = 0.001;
/** full energy store in joules: enough for roughly ten minutes of walking */
export const ENERGY_CAPACITY = 250_000;
const BASAL_POWER = 40; // W, cost of being alive
// standard deviation of the (smoothed) reward prediction error during smooth walking, and the
// range above it that counts as fully unpredictable
const UNCERTAINTY_FLOOR = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.UFLOOR ?? 0.45);
const UNCERTAINTY_SPAN = 0.6;
const EXPLORE_SPAN = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.EXPLORE_SPAN ?? 1.5);

export class Hormones {
  readonly level: Record<HormoneName, number> = {
    dopamin: 0,
    vigilin: 0.2,
    fokin: 0.5,
    serenin: 0.3,
    stressin: 0.1,
    ergin: 0.2,
    somnin: 0,
    plastin: 0.4,
  };
  /** sleep pressure only builds up when the creature is able to sleep */
  sleepEnabled = false;
  /** energy store 0..1 */
  energy = 0.8;
  /** running variance of the reward prediction error: how unpredictable is the world right now? */
  rpeVar = 0.05;
  /** 0 = rewards arrive as expected, 1 = very unpredictable */
  uncertainty = 0.5;
  private rpeFast = 0;
  readonly effects: HormoneEffects = { learningRate: 1, exploration: 1, arousal: 0, vigor: 1, appetite: 1, caution: 0, strength: 1, wantsSleep: false };

  step(inp: HormoneInputs): void {
    const L = this.level;
    const relax = (name: HormoneName, target: number, tau: number): void => {
      L[name] += ((target - L[name]) * DT) / tau;
    };
    const clamp01 = (name: HormoneName): void => {
      const v = L[name];
      L[name] = v < 0 ? 0 : v > 1 ? 1 : v;
    };

    // --- energy and hunger ---
    this.energy += inp.intake - ((inp.power + BASAL_POWER) * DT) / ENERGY_CAPACITY;
    if (this.energy > 1) this.energy = 1;
    if (this.energy < 0) this.energy = 0;
    relax('ergin', 1 - this.energy, 5);

    // --- dopamine: taken from the dopamine neurons (phasic part), shown on a 0..1 scale ---
    L.dopamin += (Math.min(1, Math.max(0, 0.3 + 0.22 * inp.dopamine)) - L.dopamin) * 0.02;

    // --- vigilin: surprise and pain, cleared within seconds; sleep pressure dampens it ---
    const unsigned = Math.min(1, Math.abs(inp.rpe) * 0.6);
    const vigTarget = Math.min(1, 0.15 + 0.2 * L.ergin) * (1 - 0.6 * L.somnin);
    L.vigilin += (Math.max(inp.surprise, inp.pain) * 0.35 + unsigned * 0.0003) * (1 - 0.5 * L.somnin);
    relax('vigilin', inp.asleep ? 0.02 : vigTarget, 2.5);

    // --- fokin: tracks how unpredictable rewards currently are ---
    this.rpeFast += (inp.rpe - this.rpeFast) * (DT / 0.3);
    this.rpeVar += (this.rpeFast * this.rpeFast - this.rpeVar) * (DT / 20);
    this.uncertainty = Math.min(1, Math.max(0, (Math.sqrt(this.rpeVar) - UNCERTAINTY_FLOOR) / UNCERTAINTY_SPAN));
    const uncertainty = this.uncertainty;
    relax('fokin', inp.asleep ? 0.05 : 0.08 + 0.92 * uncertainty, 8);

    // --- stressin: pain and sustained failure push it up, it decays slowly; serenin protects ---
    // repeated pain adds less and less: the system habituates
    L.stressin += inp.pain * 0.08 * (1 - L.stressin) * (1 - 0.5 * L.serenin);
    if (inp.rpe < -0.5) L.stressin += 0.00002 * -inp.rpe;
    relax('stressin', inp.asleep ? 0 : 0.05 + 0.3 * Math.max(0, L.ergin - 0.7), inp.asleep ? 30 : 90);

    // --- serenin: calm, well-fed, pain-free periods ---
    const calm = Math.max(0, 1 - 2.5 * L.stressin) * (1 - 0.5 * L.ergin);
    relax('serenin', 0.1 + 0.7 * calm, 40);

    // --- somnin: sleep pressure builds with time awake and neural activity ---
    if (inp.asleep) relax('somnin', 0, 25);
    // sleep pressure builds faster while much is being learned (a newborn sleeps a lot)
    else if (this.sleepEnabled) L.somnin += DT * (1 / 900) * (0.6 + 0.4 * Math.min(2, inp.activity / 20)) * (1 + 2.5 * L.fokin);

    // --- plastin: released by rewarding activity, suppressed by stress ---
    const success = inp.rpe > 0 ? Math.min(1, inp.rpe) : 0;
    relax('plastin', Math.min(1, 0.35 + 0.5 * success + (inp.asleep ? 0.3 : 0)) * (1 - 0.7 * Math.max(0, L.stressin - 0.3) / 0.7), 30);
    L.plastin += success * 0.00003;

    for (const h of HORMONES) clamp01(h);

    // --- effects ---
    const e = this.effects;
    // moderate arousal helps learning, both drowsiness and panic hurt it (inverted U)
    const arousalU = 1 - Math.min(1, Math.abs(L.vigilin - 0.4) * 1.2);
    // fokin gates plasticity: when everything goes as expected there is little reason to change
    e.learningRate = (0.4 + 1.2 * L.plastin) * (0.7 + 0.5 * arousalU) * (1 - 0.4 * Math.max(0, L.stressin - 0.6) * 2.5) * (0.1 + 1.6 * L.fokin);
    if (e.learningRate < 0.05) e.learningRate = 0.05;
    // Even at full uncertainty the variation must stay small enough that a creature which
    // can already walk is not knocked over by its own experiments; otherwise falls raise the
    // uncertainty, which raises the exploration, which causes more falls.
    e.exploration = Math.max(0.15, (0.15 + EXPLORE_SPAN * L.fokin) * (1 - 0.3 * L.serenin) * (1 - 0.5 * L.somnin));
    e.arousal = 1.5 * (L.vigilin - 0.2) - 1.5 * L.somnin;
    e.vigor = Math.min(1.15, Math.max(0.5, 1 + 0.25 * (L.ergin - 0.3) - 0.5 * L.stressin - 0.3 * L.somnin));
    e.appetite = 0.3 + 1.7 * L.ergin;
    e.caution = Math.min(1, L.stressin * 1.2);
    e.strength = this.energy < 0.1 ? 0.5 + 5 * this.energy : 1;
    e.wantsSleep = L.somnin > 0.9 || (e.wantsSleep && L.somnin > 0.15 && inp.asleep);
  }

  snapshot(): number[] {
    return HORMONES.map((h) => this.level[h]);
  }
}
