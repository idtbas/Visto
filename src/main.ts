import { BodyView } from './ui/bodyView';
import { BrainView } from './ui/brainView';
import { MUSCLE_NAMES, MUSCLE_LABELS, NM } from './sim/body/biped';
import type { FromWorker, ToWorker } from './protocol';
import type { Frame } from './sim/sim';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker): void => worker.postMessage(m);
worker.onerror = (e) => console.error('worker error:', e.message, e.filename, e.lineno);

const bodyView = new BodyView($<HTMLCanvasElement>('world'));
const brainView = new BrainView($<HTMLCanvasElement>('brain'), $('brainTip'));
const nf = new Intl.NumberFormat('de-DE');
const de = (v: number, digits = 1): string => v.toFixed(digits).replace('.', ',');
let lastFrameTime = 0;
let spikeRate = 0;
let latest: Frame | null = null;

// ---------- muscle panel ----------
const manual = new Array<number>(2 * NM).fill(0.01);
const bars: { act: HTMLElement; force: HTMLElement; knob: HTMLElement }[] = [];
{
  const rows = $('muscleRows');
  const head = document.createElement('div');
  head.className = 'mrow head';
  head.innerHTML = '<span></span><span>links</span><span>rechts</span>';
  rows.appendChild(head);
  for (let m = 0; m < NM; m++) {
    const row = document.createElement('div');
    row.className = 'mrow';
    row.title = MUSCLE_LABELS[MUSCLE_NAMES[m]];
    row.innerHTML = `<span class="name">${MUSCLE_NAMES[m]}</span>`;
    for (let leg = 0; leg < 2; leg++) {
      const bar = document.createElement('div');
      bar.className = 'mbar';
      bar.innerHTML = '<div class="act"></div><div class="force"></div><div class="knob"></div>';
      const idx = leg * NM + m;
      const set = (e: PointerEvent): void => {
        const r = bar.getBoundingClientRect();
        manual[idx] = Math.min(1, Math.max(0.01, (e.clientX - r.left) / r.width));
        send({ type: 'manualStim', values: manual });
      };
      bar.addEventListener('pointerdown', (e) => {
        bar.setPointerCapture(e.pointerId);
        set(e);
      });
      bar.addEventListener('pointermove', (e) => {
        if (bar.hasPointerCapture(e.pointerId)) set(e);
      });
      bar.addEventListener('dblclick', () => {
        manual[idx] = 0.01;
        send({ type: 'manualStim', values: manual });
      });
      row.appendChild(bar);
      bars[idx] = {
        act: bar.querySelector('.act')!,
        force: bar.querySelector('.force')!,
        knob: bar.querySelector('.knob')!,
      };
    }
    rows.appendChild(row);
  }
}

function updatePanels(f: Frame): void {
  document.body.classList.toggle('manual', f.mode === 'manual');
  $('muscleHint').textContent =
    f.mode === 'manual'
      ? 'Handsteuerung: Ziehe in einem Balken, um den Muskel anzuspannen. Doppelklick lässt ihn los.'
      : 'Rot: Anspannung des Muskels. Heller Strich: Kraft an der Sehne.';
  for (let i = 0; i < 2 * NM; i++) {
    bars[i].act.style.width = `${Math.min(100, f.muscles[i * 3] * 100)}%`;
    bars[i].force.style.width = `${Math.min(100, f.muscles[i * 3 + 2] * 100)}%`;
    bars[i].knob.style.left = `${manual[i] * 100}%`;
  }
  const t = Math.floor(f.time);
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  $('simTime').textContent = (hh ? `${hh}:${String(mm).padStart(2, '0')}` : `${mm}`) + `:${String(ss).padStart(2, '0')}`;
  $('simSpeed').textContent = `×${f.speed.toFixed(f.speed < 10 ? 1 : 0)}`;
  $('hud').textContent = `Strecke ${de(f.body[0], 2)} m   Neigung ${((f.lean * 180) / Math.PI).toFixed(0)}°`;
  const life = f.life;
  $('lifeState').textContent =
    f.mode !== 'brain' ? (f.mode === 'manual' ? 'Handsteuerung' : 'Referenz-Reflexe (ohne Gehirn)') : life.state === 'fallen' ? 'gestürzt – wird gleich aufgestellt' : life.state === 'standing' ? 'steht' : 'läuft';
  $('stFalls').textContent = String(life.falls);
  $('stAttempt').textContent = `${de(life.attempt)} m`;
  $('stBest').textContent = `${de(life.bestAttempt)} m`;
  $('stSpeed').textContent = `${de(f.velX)} m/s`;
  $('stPower').textContent = `${f.power.toFixed(0)} W`;
  if (brainMeta) $('brainMeta').textContent = `${brainMeta} · ${nf.format(Math.round(spikeRate))} Spikes/s`;
}

// ---------- controls ----------
let paused = false;
$('btnPause').addEventListener('click', () => {
  paused = !paused;
  $('btnPause').textContent = paused ? '▶' : '❚❚';
  send({ type: 'pause', paused });
});
$('btnReset').addEventListener('click', () => send({ type: 'reset' }));
for (const b of Array.from($('speedSeg').querySelectorAll('button'))) {
  b.addEventListener('click', () => {
    $('speedSeg').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    send({ type: 'speed', speed: Number(b.dataset.speed) });
  });
}

let brainMeta = '';
worker.onmessage = (e: MessageEvent<FromWorker>): void => {
  const m = e.data;
  if (m.type === 'frame') {
    const f = m.frame;
    const dt = Math.max(0, f.time - lastFrameTime);
    lastFrameTime = f.time;
    latest = f;
    bodyView.setFrame(f);
    if (f.activity) {
      brainView.addActivity(f.activity, dt);
      if (dt > 0) {
        let n = 0;
        for (let i = 0; i < f.activity.length; i++) n += f.activity[i];
        spikeRate += (n / dt - spikeRate) * 0.1;
      }
    }
  } else if (m.type === 'ready') {
    brainView.setInfo(m.brain);
    brainMeta = `${nf.format(m.brain.neurons)} Neuronen · ${nf.format(m.brain.synapses)} Synapsen`;
  }
};

function raf(): void {
  if (latest) {
    bodyView.draw();
    brainView.draw();
    updatePanels(latest);
  }
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
send({ type: 'start' });

// small hook for automated screenshots / tests
(window as unknown as { visto: unknown }).visto = { send, frame: () => latest };
