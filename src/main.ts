import { BodyView } from './ui/bodyView';
import { MUSCLE_NAMES, MUSCLE_LABELS, NM } from './sim/body/biped';
import type { FromWorker, ToWorker } from './protocol';
import type { Frame } from './sim/sim';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker): void => worker.postMessage(m);

const bodyView = new BodyView($<HTMLCanvasElement>('world'));
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
  $('hud').textContent =
    `Strecke   ${f.body[0].toFixed(2)} m\n` +
    `Tempo     ${f.velX.toFixed(2)} m/s\n` +
    `Neigung   ${((f.lean * 180) / Math.PI).toFixed(0)}°\n` +
    `Leistung  ${f.power.toFixed(0)} W`;
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

worker.onmessage = (e: MessageEvent<FromWorker>): void => {
  if (e.data.type === 'frame') {
    latest = e.data.frame;
    bodyView.setFrame(latest);
  }
};

function raf(): void {
  if (latest) {
    bodyView.draw();
    updatePanels(latest);
  }
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
send({ type: 'start' });

// small hook for automated screenshots / tests
(window as unknown as { visto: unknown }).visto = { send, frame: () => latest };
