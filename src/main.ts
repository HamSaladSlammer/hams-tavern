import './ui/styles.css';
import { handle, newState, suggestions, statusLine, peek, migrate, beginGame, mapView } from './engine/game';
import { BattleMap } from './ui/map';
import { openForge } from './ui/forge';
import type { GameState, LogLine } from './engine/types';
import { backend, SAVE_KEY, PREFS_KEY } from './ui/storage';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $('log');
const chipsEl = $('chips');
const input = $<HTMLInputElement>('input');
let state: GameState = newState();
const history: string[] = [];
let histIdx = -1;

interface Prefs { theme: 'dark' | 'light'; size: 'small' | 'normal' | 'large'; dice: 'show' | 'hide'; map: 'on' | 'combat' | 'off'; }
let prefs: Prefs = { theme: 'dark', size: 'normal', dice: 'show', map: 'on' };
try { prefs = { ...prefs, ...JSON.parse(backend.load(PREFS_KEY) ?? '{}') }; } catch { /* defaults */ }
function applyPrefs() {
  const r = document.documentElement;
  r.dataset.theme = prefs.theme; r.dataset.size = prefs.size; r.dataset.dice = prefs.dice;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', prefs.theme === 'light' ? '#dfd2b4' : '#17120d');
  backend.save(PREFS_KEY, JSON.stringify(prefs));
}
applyPrefs();

function lineEl(l: LogLine, fresh: boolean): HTMLElement {
  const p = document.createElement('p');
  p.className = `l ${l.k}${fresh ? ' fresh' : ''}`;
  if (l.k === 'say' && l.who) {
    const w = document.createElement('span'); w.className = 'who'; w.textContent = l.who; p.appendChild(w);
    p.appendChild(document.createTextNode(l.t));
  } else p.textContent = l.t;
  return p;
}

function render(lines: LogLine[], fresh = true) {
  const frag = document.createDocumentFragment();
  for (const l of lines) if (l.t) frag.appendChild(lineEl(l, fresh));
  logEl.appendChild(frag);
  while (logEl.children.length > 400) logEl.removeChild(logEl.firstChild!);
  requestAnimationFrame(() => { logEl.scrollTop = logEl.scrollHeight; });
  refresh();
}

const mapEl = $('map');
const battle = new BattleMap(mapEl, (cmd) => send(cmd));
function refreshMap() {
  const v = mapView(state);
  const show = !!v && (prefs.map === 'on' || (prefs.map === 'combat' && v.inCombat));
  mapEl.hidden = !show;
  mapEl.classList.toggle('combat', !!v?.inCombat);
  document.querySelector<HTMLButtonElement>('[data-panel=map]')?.classList.toggle('on', show);
  if (show) battle.update(v);
}

function refresh() {
  refreshMap();
  const st = statusLine(state);
  const stats = $('stats');
  if (st) {
    stats.hidden = false;
    $('place').textContent = st.place;
    $('clock').textContent = st.clock;
    const f = Math.max(0, st.hp / st.maxHp);
    $('hpfill').style.width = `${f * 100}%`;
    $('hpfill').style.background = f > 0.5 ? 'var(--green)' : f > 0.25 ? 'var(--gold)' : 'var(--blood)';
    $('hptext').textContent = `${st.hp}/${st.maxHp} HP`;
    $('ac').textContent = `AC ${st.ac}`;
    $('lvl').textContent = `Lv ${st.level}`;
    $('gold').textContent = st.gold;
    const sl = $('slots'); sl.hidden = !st.slots; sl.textContent = st.slots ? `✦ ${st.slots}` : '';
    document.querySelector('.top')!.classList.toggle('combat', st.inCombat);
  } else {
    stats.hidden = true;
    $('place').textContent = 'Hams Tavern';
    $('clock').textContent = state.phase === 'create' ? 'Creating your character' : '';
  }
  chipsEl.innerHTML = '';
  for (const s of suggestions(state)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (/^(attack|punch|kick|shoot|cast|stab|finish)/.test(s) ? ' attack' : '');
    b.textContent = s;
    b.onclick = () => send(s);
    chipsEl.appendChild(b);
  }
  chipsEl.scrollLeft = 0;
  input.placeholder = state.combat ? 'Punch, kick, cast, shoot, dodge…' : 'What do you do?';
}

function save() { try { backend.save(SAVE_KEY, JSON.stringify(state)); } catch { /* full storage: ignore */ } }

function send(text: string) {
  const t = text.trim();
  if (!t) return;
  if (state.phase !== 'play') { startNew(); return; }
  if (t) { history.unshift(t); history.length = Math.min(history.length, 50); }
  histIdx = -1;
  const lines = handle(state, t);
  render(lines);
  save();
}

$('form').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; send(v); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && history.length) { histIdx = Math.min(history.length - 1, histIdx + 1); input.value = history[histIdx]; e.preventDefault(); }
  if (e.key === 'ArrowDown') { histIdx = Math.max(-1, histIdx - 1); input.value = histIdx >= 0 ? history[histIdx] : ''; e.preventDefault(); }
});

// ---------- title ----------
$('ver').textContent = VERSION;
const saved = (() => { try { const raw = backend.load(SAVE_KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch { return null; } })();
if (saved && saved.phase === 'play' && saved.pc) $('btn-continue').hidden = false;
$('btn-continue').onclick = () => {
  state = saved!;
  $('title').hidden = true;
  logEl.innerHTML = '';
  render(state.log.slice(-120), false);
  render([{ k: 'sys', t: 'Welcome back.' }]);
};
$('btn-new').onclick = () => {
  if (saved && saved.phase === 'play' && !confirmNew()) return;
  startNew();
};
function confirmNew(): boolean {
  const b = $('btn-new');
  if (b.dataset.armed) return true;
  b.dataset.armed = '1'; b.textContent = 'Tap again to overwrite your save';
  setTimeout(() => { delete b.dataset.armed; b.textContent = 'New game'; }, 4000);
  return false;
}
function startNew() {
  $('title').hidden = true;
  openForge($('forge'), (spec) => {
    state = newState((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    logEl.innerHTML = '';
    render([{ k: 'title', t: 'Hams Tavern: The Bells of Lahti' }]);
    render(beginGame(state, spec));
    save();
    input.focus();
  }, () => { $('title').hidden = false; });
}

// ---------- panels ----------
const panel = $('panel');
function openPanel(kind: string) {
  const body = $('panel-body');
  body.innerHTML = '';
  if (kind === 'menu') { $('panel-title').textContent = 'Menu'; menu(body); }
  else {
    if (!state.pc) { $('panel-title').textContent = 'Not yet'; body.textContent = 'Create your character first.'; panel.hidden = false; return; }
    $('panel-title').textContent = kind === 'sheet' ? 'Character' : kind === 'inventory' ? 'Pack' : 'Journal';
    for (const l of peek(state, kind as 'sheet')) body.appendChild(lineEl(l, false));
  }
  panel.hidden = false;
}
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => (b.onclick = () => {
  if (b.dataset.panel === 'map') { prefs.map = mapEl.hidden ? 'on' : (state.combat ? 'off' : 'combat'); applyPrefs(); refreshMap(); return; }
  openPanel(b.dataset.panel!);
}));
$('panel-close').onclick = () => (panel.hidden = true);
panel.addEventListener('click', (e) => { if (e.target === panel) panel.hidden = true; });

function opt<K extends keyof Prefs>(label: string, key: K, values: [Prefs[K], string][]) {
  const wrap = document.createElement('div');
  const l = document.createElement('div'); l.className = 'small'; l.textContent = label; wrap.appendChild(l);
  const row = document.createElement('div'); row.className = 'row';
  for (const [v, name] of values) {
    const b = document.createElement('button'); b.textContent = name; if (prefs[key] === v) b.className = 'on';
    b.onclick = () => { prefs[key] = v; applyPrefs(); refreshMap(); openPanel('menu'); };
    row.appendChild(b);
  }
  wrap.appendChild(row);
  return wrap;
}

function menuButton(label: string, fn: () => void) {
  const b = document.createElement('button'); b.className = 'menu-btn'; b.textContent = label; b.onclick = fn; return b;
}

function menu(body: HTMLElement) {
  body.appendChild(opt('Theme', 'theme', [['dark', 'Tavern (dark)'], ['light', 'Parchment']]));
  body.appendChild(opt('Text size', 'size', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']]));
  body.appendChild(opt('Dice rolls', 'dice', [['show', 'Show'], ['hide', 'Hide']]));
  body.appendChild(opt('Battle map', 'map', [['on', 'Always'], ['combat', 'In fights'], ['off', 'Off']]));
  body.appendChild(menuButton('How to play', () => { panel.hidden = true; send('help'); }));
  body.appendChild(menuButton('Export save (for bug reports or another device)', exportSave));
  body.appendChild(menuButton('Import save', importSave));
  body.appendChild(menuButton('Back to title', () => location.reload()));
  const about = document.createElement('div'); about.className = 'small';
  about.innerHTML = `<p><b>Hams Tavern: The Bells of Lahti</b> v${VERSION}. A solo fantasy RPG with an offline game master. World and story © Jared ("HamSaladSlammer").</p>
  <p>This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.</p>
  <p>Saves stay on this device. Nothing is sent anywhere.</p>`;
  body.appendChild(about);
}

function exportSave() {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hams-tavern-${(state.pc?.name ?? 'save').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importSave() {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'application/json,.json';
  f.onchange = async () => {
    const file = f.files?.[0]; if (!file) return;
    try {
      const s = migrate(JSON.parse(await file.text()));
      if (!s) throw new Error('bad');
      state = s; save(); panel.hidden = true; $('title').hidden = true; logEl.innerHTML = '';
      render(state.log.slice(-120), false); render([{ k: 'sys', t: 'Save imported.' }]);
    } catch { toast('That file isn\'t a Hams Tavern save.'); }
  };
  f.click();
}

function toast(msg: string, onTap?: () => void) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  t.onclick = () => { t.hidden = true; onTap?.(); };
  if (!onTap) setTimeout(() => (t.hidden = true), 3500);
}

// ---------- offline / updates ----------
const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
if (isNative) { setupNative(); $('get-apk').hidden = true; }
if (!isNative && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready. Tap to update.', () => location.reload());
      });
    });
  }).catch(() => { /* offline support unavailable */ });
}

refresh();

async function setupNative() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: prefs.theme === 'light' ? '#dfd2b4' : '#17120d' });
    await StatusBar.setStyle({ style: prefs.theme === 'light' ? Style.Light : Style.Dark });
  } catch { /* not available */ }
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      if (!panel.hidden) { panel.hidden = true; return; }
      if (!$('forge').hidden) { $('forge').hidden = true; $('title').hidden = false; return; }
      App.minimizeApp();
    });
    App.addListener('pause', () => save());
  } catch { /* not available */ }
}
