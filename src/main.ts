import SimWorker from './worker.ts?worker&inline';
import { createHost } from './simHost';
import { BodyView } from './ui/bodyView';
import { BrainView } from './ui/brainView';
import { HormoneView } from './ui/hormoneView';
import { LearnView } from './ui/learnView';
import { Brain3D, SHOT_BRAIN, SHOT_CORD } from './ui/brain3d';
import { InnerView } from './ui/innerView';
import type { ModuleName } from './sim/brain/brain';
import { TONE_GROUPS } from './sim/brain/spinal';
import { MUSCLE_NAMES, MUSCLE_LABELS, NM } from './sim/body/biped';
import type { FromWorker, ToWorker } from './protocol';
import type { Frame, SimState } from './sim/sim';
import { PAIN_SITES } from './sim/brain/pain';
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
const viewQuery = new URLSearchParams(location.search);
const brain3d = new Brain3D($<HTMLCanvasElement>('gl3d'), $('legend3d'), {
  // ?ldr: without the deep colour buffer; ?hq: never lower the resolution by itself;
  // ?simclock: animations run in simulated time (for recording clips frame by frame)
  ldr: viewQuery.has('ldr'),
  fullQuality: viewQuery.has('hq'),
  clock: viewQuery.has('simclock') ? () => latest?.time ?? 0 : undefined,
});
/** leaves the flat map, if it is shown (set below) */
let showBrain3d: () => void = () => {};
{
  // the nervous system is shown as the glowing brain; the flat map is the alternative view
  let map = !brain3d.supported;
  const apply = (): void => {
    $('gl3d').hidden = map;
    $('legend3d').hidden = map;
    $('views3d').hidden = map;
    $('brain').hidden = !map;
    brain3d.open = !map;
    brainView.visible = map;
    $('btnMap').classList.toggle('on', map);
    $('btnMap').textContent = map ? 'Gehirn' : 'Karte';
    $('brainLegend').textContent = map
      ? 'Jeder Punkt ist ein Neuron und blitzt bei einem echten Spike auf (blau = hemmend). Linien sind Nervenbahnen; die Lichtpunkte darauf sind eine Stichprobe der Spikes, die gerade hindurchlaufen.'
      : brain3d.supported
        ? 'Jeder helle Punkt ist ein Neuron an seinem anatomischen Ort und flammt bei einem echten Spike auf. Die Fasern sind rund 5.000 echte Synapsen: Feuert die sendende Zelle, leuchtet die Faser auf und ein Impuls läuft zur empfangenden Zelle (stark verlangsamt gezeichnet). Der feine Staub gibt die Form und glimmt mit der momentanen Feuerrate der Zellgruppe daneben. Ein Lichtring markiert ein Ereignis: Zündung im Arbeitsraum, einsetzenden Schmerz (rot), gegessenen Cookie (gold). Ziehen dreht, Mausrad oder zwei Finger zoomen, „Vollbild“ öffnet die Kino-Seite.'
        : 'Dieser Browser stellt kein WebGL bereit, deshalb gibt es hier nur die Karte.';
  };
  $('btnMap').addEventListener('click', () => {
    if (!brain3d.supported) return;
    map = !map;
    apply();
  });
  showBrain3d = () => {
    if (map && brain3d.supported) {
      map = false;
      apply();
    }
  };
  for (const b of Array.from($('views3d').querySelectorAll('button'))) {
    b.addEventListener('click', () => {
      $('views3d').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      brain3d.setView(b.dataset.view ?? 'all');
    });
  }
  apply();
}
let drawPip: () => void = () => {};
{
  // The cinema page: the brain alone, as large as the screen. It is a page of its own
  // (address ending in #kino, the back button leaves it) but shows the same living brain.
  const kino = $('kino');
  const wrap = document.querySelector<HTMLElement>('.brainWrap')!;
  const home = wrap.parentElement!;
  const after = wrap.nextElementSibling;
  const pip = $<HTMLCanvasElement>('kinoPip');
  let on = false;
  let pushed = false;
  let idleTimer = 0;
  let ownExit = false;
  const wake = (): void => {
    kino.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => kino.classList.add('idle'), 2800);
  };
  const fullscreen = (want: boolean): void => {
    try {
      if (want && !document.fullscreenElement) void kino.requestFullscreen?.().catch(() => {});
      else if (!want && document.fullscreenElement) {
        ownExit = true;
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* not allowed here (for example inside an embedded frame): the page still fills its window */
    }
  };
  const open = (): void => {
    if (on || !brain3d.supported) return;
    on = true;
    showBrain3d();
    kino.hidden = false;
    $('kinoStage').appendChild(wrap);
    document.body.classList.add('kinoOpen');
    brain3d.cinema = true;
    brain3d.intro();
    wake();
  };
  const close = (): void => {
    if (!on) return;
    on = false;
    fullscreen(false);
    home.insertBefore(wrap, after);
    kino.hidden = true;
    document.body.classList.remove('kinoOpen');
    brain3d.cinema = false;
    brain3d.setView(document.querySelector<HTMLElement>('#views3d button.on')?.dataset.view ?? 'all');
  };
  const leave = (): void => {
    if (pushed) {
      pushed = false;
      try {
        history.back();
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* the address cannot be changed here; closing still works */
    }
    close();
  };
  $('btnKino').hidden = !brain3d.supported;
  $('btnKino').addEventListener('click', () => {
    fullscreen(true);
    try {
      if (location.hash !== '#kino') {
        location.hash = 'kino';
        pushed = true;
      }
    } catch {
      /* no address to change */
    }
    open();
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#kino') open();
    else {
      pushed = false;
      close();
    }
  });
  $('kinoClose').addEventListener('click', leave);
  $('kinoFull').addEventListener('click', () => fullscreen(!document.fullscreenElement));
  $('kinoIntro').addEventListener('click', () => brain3d.intro());
  const toggle = (id: string, set: (v: boolean) => void): void => {
    $(id).addEventListener('click', () => set($(id).classList.toggle('on')));
  };
  toggle('kinoRegie', (v) => (brain3d.director = v));
  toggle('kinoKey', (v) => kino.classList.toggle('key', v));
  toggle('kinoPipBtn', (v) => kino.classList.toggle('noPip', !v));
  kino.addEventListener('pointermove', wake);
  kino.addEventListener('pointerdown', wake);
  // leaving the browser's full screen with Esc also leaves the cinema page
  // (but not when the page itself ended the full screen, which can arrive late)
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) return;
    if (ownExit) ownExit = false;
    else if (on) leave();
  });
  window.addEventListener('keydown', (e) => {
    if (!on) return;
    // (in the browser's own full screen Esc usually never arrives here; it ends the full screen, see above)
    if (e.key === 'Escape') leave();
    else if (e.key === ' ') {
      e.preventDefault();
      $('kinoRegie').click();
    } else if (e.key === 'f' || e.key === 'F') fullscreen(!document.fullscreenElement);
    else if (e.key >= '1' && e.key <= '6') brain3d.cut(Number(e.key) - 1);
  });
  // a small live picture of the body in the corner
  const world = $<HTMLCanvasElement>('world');
  const pc = pip.getContext('2d');
  drawPip = () => {
    if (!on || !pc || kino.classList.contains('noPip') || world.width < 2) return;
    const w = 520;
    const h = Math.round((w * world.height) / world.width);
    if (pip.width !== w || pip.height !== h) {
      pip.width = w;
      pip.height = h;
    }
    pc.drawImage(world, 0, 0, w, h);
  };
  if (location.hash === '#kino') open();
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
  $('hud').textContent = `Ort ${de(f.worldOffset + f.facing * f.body[0], 1)} m   Tempo ${de(f.velX)} m/s   Neigung ${((f.lean * 180) / Math.PI).toFixed(0)}°   Leistung ${f.power.toFixed(0)} W`;
  const life = f.life;
  const mind = f.mind;
  $('lifeState').textContent =
    f.mode !== 'brain' ? (f.mode === 'manual' ? 'Handsteuerung' : 'Referenz-Reflexe (ohne Gehirn)') : life.state === 'dead'
        ? `verhungert nach ${Math.max(1, Math.round(f.drive.diedAt / 60))} min – „Neues Leben" beginnt von vorn`
        : life.state === 'sleeping'
          ? mind.dream ? 'schläft und träumt' : 'schläft'
          : life.state === 'resting'
            ? f.drive.autonomy ? 'ruht – steht auf, wenn es Hunger bekommt' : 'ruht'
            : life.state === 'fallen'
              ? f.drive.autonomy && !f.drive.go ? 'gestürzt – bleibt liegen' : 'gestürzt – wird gleich aufgehoben'
              : life.inHand ? 'in der helfenden Hand' : life.state === 'standing' ? 'steht' : f.drive.autonomy ? 'läuft aus eigenem Antrieb' : 'läuft';
  $('lifeState').classList.toggle('dead', life.state === 'dead');
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
$<HTMLInputElement>('chkPain').addEventListener('change', (e) => send({ type: 'pain', on: (e.target as HTMLInputElement).checked }));
$('world').addEventListener('click', (e) => {
  const x = bodyView.worldX(e.offsetX);
  send({ type: 'placeCookie', x });
});
/** 'self' = the creature decides; '1' / '0' = it is commanded to walk / to stand */
function sendGoMode(mode: string): void {
  if (mode !== 'self') send({ type: 'wantsToWalk', on: mode === '1' });
  send({ type: 'autonomy', on: mode === 'self' });
}
for (const b of Array.from($('goSeg').querySelectorAll('button'))) {
  b.addEventListener('click', () => {
    $('goSeg').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    sendGoMode(b.dataset.go ?? 'self');
  });
}
for (const b of Array.from($('speedSeg').querySelectorAll('button'))) {
  b.addEventListener('click', () => {
    $('speedSeg').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    send({ type: 'speed', speed: Number(b.dataset.speed) });
  });
}

// Real events are marked in the brain view by a ring of light at the place where they happen.
const CONTENT_LIGHT: Record<string, [number, number, number]> = { Körper: [120, 190, 255], Schmerz: [255, 70, 96], Gefahr: [255, 150, 70], Sehen: [130, 222, 255], Bedürfnis: [255, 200, 80] };
let workspaceNames: string[] = [];
const seen = { content: -1, eaten: -1, hurting: false, painRing: 0, ring: 0, count: [0, 0, 0] };
function announce(f: Frame): void {
  const nowMs = performance.now();
  // a content has just entered the global workspace
  const c = f.inner.content;
  // (shown at most every 2.5 s, otherwise the picture never comes to rest)
  if (c >= 0 && c !== seen.content && nowMs - seen.ring > 2500) {
    seen.ring = nowMs;
    seen.count[0]++;
    brain3d.pulse('workspace', CONTENT_LIGHT[workspaceNames[c]] ?? [255, 118, 190], 0.6);
  }
  seen.content = c;
  // pain has just set in: the ring starts at the part of the body that hurts
  if (f.painNow > 0.25 && !seen.hurting && nowMs - seen.painRing > 1500) {
    seen.hurting = true;
    seen.painRing = nowMs;
    seen.count[1]++;
    let site = 0;
    for (let i = 1; i < f.pain.length; i++) if (f.pain[i] > f.pain[site]) site = i;
    const where = PAIN_SITES[site] ?? '';
    brain3d.pulse(where.includes('links') ? 'pain_0' : where.includes('rechts') ? 'pain_1' : 'pain_c', [255, 60, 80], Math.min(1.5, 0.7 + f.painNow), SHOT_CORD);
  }
  if (f.painNow < 0.08) seen.hurting = false;
  // a cookie has been eaten: the dopamine cells answer
  if (seen.eaten >= 0 && f.cookiesEaten > seen.eaten) {
    seen.count[2]++;
    brain3d.pulse('vta', [255, 200, 90], 1.3, SHOT_BRAIN);
  }
  seen.eaten = f.cookiesEaten;
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
    announce(f);
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
    workspaceNames = m.brain.workspaceNames;
    seen.eaten = -1;
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
    drawPip();
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
  send({ type: 'start', state, mainThread: onMainThread, options: { newbornTone, granules, sleep: !query.has('nosleep'), wasm: !query.has('js'), autonomy: true, mortal: !query.has('immortal'), energy: 0.6 } });
  // bring the new simulation in line with the controls on the page
  const speedBtn = $('speedSeg').querySelector<HTMLElement>('button.on');
  send({ type: 'speed', speed: Number(speedBtn?.dataset.speed ?? 1) });
  send({ type: 'autoReward', on: $<HTMLInputElement>('chkAuto').checked });
  send({ type: 'obstacles', on: $<HTMLInputElement>('chkObst').checked });
  send({ type: 'pain', on: $<HTMLInputElement>('chkPain').checked });
  sendGoMode($('goSeg').querySelector<HTMLElement>('button.on')?.dataset.go ?? 'self');
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
(window as unknown as { visto: unknown }).visto = { send: (m: ToWorker) => send(m), frame: () => latest, brain3d, rings: seen.count };
