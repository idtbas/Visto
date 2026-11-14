import SimWorker from './worker.ts?worker&inline';
import { createHost } from './simHost';
import { BodyView } from './ui/bodyView';
import { BrainView } from './ui/brainView';
import { HormoneView } from './ui/hormoneView';
import { LearnView } from './ui/learnView';
import { Brain3D } from './ui/brain3d';
import { InnerView } from './ui/innerView';
import type { ModuleName } from './sim/brain/brain';
import { TONE_GROUPS } from './sim/brain/spinal';
import { MUSCLE_NAMES, MUSCLE_LABELS, NM } from './sim/body/biped';
import type { FromWorker, ToWorker } from './protocol';
import type { Frame, SimState } from './sim/sim';
import { saveLife, loadLife, deleteLife } from './ui/store';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// The simulation normally runs in a web worker. Where workers are blocked it runs on this thread.
let send: (m: ToWorker) => void = () => undefined;
let onMainThread = false;
let worker: Worker | null = null;
const receive = (m: FromWorker): void => onMessage(m);

function connect(): void {
  worker?.terminate();
  worker = null;
  try {
    const w = new SimWorker();
    w.onmessage = (e: MessageEvent<FromWorker>): void => receive(e.data);
    w.onerror = (e) => console.error('worker error:', e.message, e.filename, e.lineno);
    worker = w;
    send = (m) => w.postMessage(m);
  } catch {
    onMainThread = true;
    const handle = createHost((m) => receive(m));
    send = (m) => handle(m);
  }
}

const bodyView = new BodyView($<HTMLCanvasElement>('world'));
const brainView = new BrainView($<HTMLCanvasElement>('brain'), $('brainTip'));
const hormoneView = new HormoneView($('hormoneRows'));
const learnView = new LearnView($<HTMLCanvasElement>('learn'));
const brain3d = new Brain3D($<HTMLCanvasElement>('gl3d'), $<HTMLCanvasElement>('lab3d'));
{
  // the 3D view lives in a window of its own that can be moved, resized and closed
  const win = $('win3d');
  const head = $('win3dHead');
  $('noGl').hidden = brain3d.supported;
  const show = (on: boolean): void => {
    win.hidden = !on;
    brain3d.open = on;
    $('btn3d').classList.toggle('on', on);
  };
  $('btn3d').addEventListener('click', () => show(win.hidden !== false));
  $('btn3dClose').addEventListener('click', () => show(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !win.hidden) show(false);
  });
  let grab: [number, number] | null = null;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    const r = win.getBoundingClientRect();
    grab = [e.clientX - r.left, e.clientY - r.top];
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!grab) return;
    win.style.left = `${Math.max(-200, Math.min(window.innerWidth - 80, e.clientX - grab[0]))}px`;
    win.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - grab[1]))}px`;
  });
  head.addEventListener('pointerup', () => (grab = null));
}
const innerView = new InnerView($('innerBody'), $<HTMLCanvasElement>('innerCanvas'));
{
  // the diagnostics window: same kind of window as the 3D view
  const win = $('winInner');
  const head = $('winInnerHead');
  const show = (on: boolean): void => {
    win.hidden = !on;
    innerView.open = on;
    $('btnInner').classList.toggle('on', on);
  };
  $('btnInner').addEventListener('click', () => show(win.hidden !== false));
  $('btnInnerClose').addEventListener('click', () => show(false));
  let grab: [number, number] | null = null;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    const r = win.getBoundingClientRect();
    grab = [e.clientX - r.left, e.clientY - r.top];
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!grab) return;
    win.style.right = 'auto';
    win.style.left = `${Math.max(-200, Math.min(window.innerWidth - 80, e.clientX - grab[0]))}px`;
    win.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - grab[1]))}px`;
  });
  head.addEventListener('pointerup', () => (grab = null));
  $('btnPush').addEventListener('click', () => send({ type: 'push', impulse: (Math.random() < 0.5 ? -1 : 1) * 45 }));
  win.querySelectorAll<HTMLInputElement>('input[data-module]').forEach((el) => {
    el.addEventListener('change', () => send({ type: 'module', name: el.dataset.module as ModuleName, on: el.checked }));
  });
}
const toneBars: { fill: HTMLElement; val: HTMLElement }[] = [];
for (const g of TONE_GROUPS) {
  const row = document.createElement('div');
  row.className = 'trow';
  row.title = `${g.label}: ${g.text}. Der Strich markiert die ausgereifte Stärke.`;
  row.innerHTML = `<span>${g.label}</span><span class="tbar"><span></span><i></i></span><span class="tv">0</span>`;
  $('toneRows').appendChild(row);
  toneBars.push({ fill: row.querySelector('.tbar span')!, val: row.querySelector('.tv')! });
}
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
  $('muscleHint').textContent = f.mode === 'manual' ? 'ziehen = anspannen' : 'rot = Anspannung';
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
  $('hud').textContent = `Strecke ${de(f.body[0], 1)} m   Tempo ${de(f.velX)} m/s   Neigung ${((f.lean * 180) / Math.PI).toFixed(0)}°   Leistung ${f.power.toFixed(0)} W`;
  const life = f.life;
  const mind = f.mind;
  $('lifeState').textContent =
    f.mode !== 'brain' ? (f.mode === 'manual' ? 'Handsteuerung' : 'Referenz-Reflexe (ohne Gehirn)') : life.state === 'sleeping' ? (mind.dream ? 'schläft und träumt' : 'schläft') : life.state === 'fallen' ? 'gestürzt – wird gleich aufgehoben' : life.inHand ? 'in der helfenden Hand' : life.state === 'standing' ? 'steht' : 'läuft';
  $('stFalls').textContent = String(life.falls);
  $('stBest').textContent = life.bestAttempt >= 100 ? `${Math.round(life.bestAttempt)} m` : `${de(life.bestAttempt)} m`;
  $('memNote').textContent = `${mind.attempts} Läufe · ${mind.encounters} Hind. · ${mind.dreams} Träume`;
  $('speFill').style.width = `${Math.min(100, mind.spe * 200)}%`;
  $('speMark').style.left = `${Math.min(100, mind.speUsual * 200)}%`;
  $('speVal').textContent = de(mind.spe, 2);
  const dbars = $('decBars').children;
  f.decision.forEach((v, i) => ((dbars[i] as HTMLElement).style.height = `${Math.round(Math.min(1, v / 1.5) * 100)}%`));
  $('decVal').textContent = f.highStep > 0.3 ? '↑' : '';
  hormoneView.update(f.hormones, f.time);
  f.tone.forEach((v, i) => {
    toneBars[i].fill.style.width = `${Math.min(100, v * 50)}%`;
    toneBars[i].val.textContent = `${Math.round(v * 100)}`;
  });
  $('energyFill').style.width = `${Math.round(f.energy * 100)}%`;
  $('painFill').style.width = `${Math.round(Math.min(1, f.painNow) * 100)}%`;
  $('dangerFill').style.width = `${Math.round(Math.min(1, f.danger) * 100)}%`;
  $('dangerVal').textContent = `${Math.round(Math.min(1, f.danger) * 100)}`;
  $('stCookies').textContent = String(f.cookiesEaten);
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
$('btnCookie').addEventListener('click', () => send({ type: 'cookie' }));
window.addEventListener('keydown', (e) => {
  if (e.key === 'c' || e.key === 'C') send({ type: 'cookie' });
});
$<HTMLInputElement>('chkAuto').addEventListener('change', (e) => send({ type: 'autoReward', on: (e.target as HTMLInputElement).checked }));
$<HTMLInputElement>('chkObst').addEventListener('change', (e) => send({ type: 'obstacles', on: (e.target as HTMLInputElement).checked }));
$<HTMLInputElement>('chkShell').addEventListener('change', (e) => (brain3d.shell = (e.target as HTMLInputElement).checked));
$<HTMLInputElement>('chkPain').addEventListener('change', (e) => send({ type: 'pain', on: (e.target as HTMLInputElement).checked }));
$('world').addEventListener('click', (e) => {
  const x = bodyView.worldX(e.offsetX);
  send({ type: 'placeCookie', x });
});
for (const b of Array.from($('goSeg').querySelectorAll('button'))) {
  b.addEventListener('click', () => {
    $('goSeg').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    send({ type: 'wantsToWalk', on: b.dataset.go === '1' });
  });
}
for (const b of Array.from($('speedSeg').querySelectorAll('button'))) {
  b.addEventListener('click', () => {
    $('speedSeg').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    send({ type: 'speed', speed: Number(b.dataset.speed) });
  });
}

let brainMeta = '';
function onMessage(m: FromWorker): void {
  if (m.type === 'frame') {
    const f = m.frame;
    const dt = Math.max(0, f.time - lastFrameTime);
    lastFrameTime = f.time;
    latest = f;
    bodyView.setFrame(f);
    innerView.update(f);
    if (f.activity) {
      brainView.addActivity(f.activity, dt);
      brain3d.addActivity(f.activity, dt);
      if (dt > 0) {
        let n = 0;
        for (let i = 0; i < f.activity.length; i++) n += f.activity[i];
        spikeRate += (n / dt - spikeRate) * 0.1;
      }
    }
  } else if (m.type === 'ready') {
    brainView.setInfo(m.brain);
    brain3d.setInfo(m.brain);
    innerView.setInfo(m.brain);
    brainMeta = `${nf.format(m.brain.neurons)} Neuronen · ${nf.format(m.brain.synapses)} Synapsen`;
    $('brainMeta').title = m.brain.engine === 'wasm' ? 'Rechenkern: WebAssembly mit SIMD' : 'Rechenkern: JavaScript (WebAssembly mit SIMD steht hier nicht zur Verfügung, deshalb langsamer)';
    document.body.classList.toggle('slowEngine', m.brain.engine !== 'wasm');
  } else if (m.type === 'attempts') {
    learnView.setAttempts(m.list);
  } else if (m.type === 'state') {
    saveLife(saveKey(), m.state).then(
      () => ($('saveNote').textContent = `gespeichert ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`),
      () => ($('saveNote').textContent = 'Speichern hier nicht möglich'),
    );
  }
}

function raf(): void {
  if (latest) {
    bodyView.draw();
    brainView.draw();
    brain3d.draw();
    if (latest) innerView.draw(latest.time);
    updatePanels(latest);
  }
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---------- life: restore the saved brain, save regularly ----------
const query = new URLSearchParams(location.search);
const pref = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* preferences are a convenience only */
    }
  },
};
const CEREBELLUM_GRANULES = 12000;
let withCerebellum = query.has('granules') || pref.get('visto-cerebellum') === '1';
$<HTMLInputElement>('chkCb').checked = withCerebellum;
const saveKey = (): string => (withCerebellum ? 'life-1-cb' : 'life-1');

/** starts (or restarts) the simulation; `fresh` begins a new life instead of restoring the saved one */
async function boot(fresh: boolean): Promise<void> {
  if (onMainThread) {
    // the loop on this thread cannot be stopped; start over with a clean page
    location.reload();
    return;
  }
  connect();
  latest = null;
  lastFrameTime = 0;
  const state = fresh || query.has('fresh') ? undefined : await loadLife<SimState>(saveKey());
  // a newborn starts with weak descending tone; "?tone=1" starts with a mature one instead
  const newbornTone = query.has('tone') ? Number(query.get('tone')) : 0.6;
  const granules = query.has('granules') ? Number(query.get('granules')) : withCerebellum ? CEREBELLUM_GRANULES : 0;
  send({ type: 'start', state, mainThread: onMainThread, options: { newbornTone, granules, sleep: !query.has('nosleep'), wasm: !query.has('js') } });
  // bring the new simulation in line with the controls on the page
  const speedBtn = $('speedSeg').querySelector<HTMLElement>('button.on');
  send({ type: 'speed', speed: Number(speedBtn?.dataset.speed ?? 1) });
  send({ type: 'autoReward', on: $<HTMLInputElement>('chkAuto').checked });
  send({ type: 'obstacles', on: $<HTMLInputElement>('chkObst').checked });
  send({ type: 'pain', on: $<HTMLInputElement>('chkPain').checked });
  send({ type: 'wantsToWalk', on: $('goSeg').querySelector<HTMLElement>('button.on')?.dataset.go === '1' });
  if (paused) send({ type: 'pause', paused });
}
void boot(false);
setInterval(() => send({ type: 'save' }), 30000);
window.addEventListener('pagehide', () => send({ type: 'save' }));

// two clicks instead of a dialog: the second one within three seconds confirms
let armed = 0;
$('btnNewLife').addEventListener('click', async () => {
  const btn = $('btnNewLife');
  if (Date.now() - armed > 3000) {
    armed = Date.now();
    btn.textContent = 'Wirklich? Nochmal klicken';
    btn.classList.add('warn');
    setTimeout(() => {
      btn.textContent = 'Neues Leben';
      btn.classList.remove('warn');
    }, 3000);
    return;
  }
  armed = 0;
  btn.textContent = 'Neues Leben';
  btn.classList.remove('warn');
  await deleteLife(saveKey());
  $('saveNote').textContent = '';
  await boot(true);
});
$<HTMLInputElement>('chkCb').addEventListener('change', async (e) => {
  send({ type: 'save' });
  withCerebellum = (e.target as HTMLInputElement).checked;
  pref.set('visto-cerebellum', withCerebellum ? '1' : '0');
  // give the save a moment to arrive before the brain is rebuilt
  setTimeout(() => void boot(false), 150);
});

// small hook for automated screenshots / tests
(window as unknown as { visto: unknown }).visto = { send: (m: ToWorker) => send(m), frame: () => latest };
