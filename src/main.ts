import './ui/styles.css';
import { handle, newState, suggestionGroups, statusLine, peek, migrate, beginGame, mapView } from './engine/game';
import { BattleMap } from './ui/map';
import { openForge } from './ui/forge';
import { openCampaigns } from './ui/campaigns';
import { WorldMap } from './ui/worldmap';
import { DiceTray, DEFAULT_LOOK, d20Of, type DiceLook } from './ui/dice';
import { THEMES, applyTheme, paletteFor, luminance, type CustomColours } from './ui/themes';
import { worldView } from './world';
import type { GameState, LogLine } from './engine/types';
import { backend, SAVE_KEY, PREFS_KEY } from './ui/storage';
import { checkForUpdates, nativeReady, BUILD } from './ui/updates';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $('log');
const chipsEl = $('chips');
const input = $<HTMLInputElement>('input');
let state: GameState = newState();
const history: string[] = [];
let histIdx = -1;

interface Prefs { theme: string; size: 'small' | 'normal' | 'large'; dice: 'show' | 'hide'; map: 'on' | 'combat' | 'off'; look?: DiceLook; colors?: CustomColours }
let prefs: Prefs = { theme: 'dark', size: 'normal', dice: 'show', map: 'on' };
try { prefs = { ...prefs, ...JSON.parse(backend.load(PREFS_KEY) ?? '{}') }; } catch { /* defaults */ }
function applyPrefs() {
  const r = document.documentElement;
  r.dataset.size = prefs.size; r.dataset.dice = prefs.dice;
  const pal = applyTheme(prefs.theme, prefs.colors ?? {});
  backend.save(PREFS_KEY, JSON.stringify(prefs));
  void nativeBars(pal.bg2);
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

const tray = new DiceTray($('dicetray'), { ...DEFAULT_LOOK, ...(prefs.look ?? {}) }, (l) => { prefs.look = l; applyPrefs(); }, (txt) => { const l: LogLine = { k: 'roll', t: txt }; state.log.push(l); logEl.appendChild(lineEl(l, true)); requestAnimationFrame(() => { logEl.scrollTop = logEl.scrollHeight; }); save(); });

function render(lines: LogLine[], fresh = true) {
  if (fresh) { const d = lines.map((l) => (l.k === 'roll' ? d20Of(l.t) : null)).find(Boolean); if (d) tray.flash(d.value, d.outcome); }
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

const worldEl = $('world');
const world = new WorldMap(worldEl, (cmd) => send(cmd));
function openWorld() { if (!state.pc || state.phase !== 'play') return; panel.hidden = true; world.open(worldView(state)); }

function refresh() {
  refreshMap();
  if (world.isOpen && state.pc) world.update(worldView(state));
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
  renderActionBar();
  input.placeholder = state.combat ? 'Punch, kick, cast, shoot, dodge…' : 'What do you do?';
}

// ---------- save slots ----------
const SLOTS = 3;
const slotKey = (i: number) => (i === 0 ? SAVE_KEY : `${SAVE_KEY}.s${i + 1}`);
let slot = (() => { try { const n = Number(backend.load('hams.slot')); return n >= 0 && n < SLOTS ? n : 0; } catch { return 0; } })();
function readSlot(i: number): GameState | null { try { const raw = backend.load(slotKey(i)); const g = raw ? migrate(JSON.parse(raw)) : null; return g && g.phase === 'play' && g.pc ? g : null; } catch { return null; } }
// ---------- the action bar: dropdowns for talking, moving, doing and fighting ----------
let openGroup: string | null = null;
const dropEl = document.createElement('div');
dropEl.className = 'actdrop'; dropEl.hidden = true;
chipsEl.insertAdjacentElement('beforebegin', dropEl);
chipsEl.className = 'actbar';
function renderActionBar() {
  const groups = suggestionGroups(state);
  chipsEl.innerHTML = '';
  if (openGroup && !groups.some((g) => g.id === openGroup)) openGroup = null;
  for (const g of groups) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `actbtn${g.id === 'fight' ? ' fight' : ''}${openGroup === g.id ? ' open' : ''}`;
    b.setAttribute('aria-expanded', String(openGroup === g.id));
    b.innerHTML = `<span class="ai">${g.icon}</span>${g.label}<span class="caret">▾</span>`;
    b.onclick = () => { openGroup = openGroup === g.id ? null : g.id; renderActionBar(); };
    chipsEl.appendChild(b);
  }
  const g = groups.find((x) => x.id === openGroup);
  dropEl.hidden = !g;
  dropEl.innerHTML = '';
  if (!g) return;
  const head = document.createElement('div'); head.className = 'actdrop-h'; head.textContent = g.label; dropEl.appendChild(head);
  for (const it of g.items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `actitem${it.prompt ? ' prompt' : ''}${/^(attack|punch|kick|shoot|cast|stab|finish)/.test(it.cmd) ? ' attack' : ''}`;
    b.textContent = it.label;
    b.onclick = () => {
      openGroup = null;
      if (it.prompt) { dropEl.hidden = true; renderActionBar(); input.value = it.cmd; input.focus(); input.setSelectionRange(input.value.length, input.value.length); return; }
      send(it.cmd);
    };
    dropEl.appendChild(b);
  }
}
document.addEventListener('click', (e) => {
  if (!openGroup) return;
  const t = e.target as HTMLElement;
  if (!t.isConnected || t.closest('.actdrop') || t.closest('.actbar')) return;
  openGroup = null; renderActionBar();
});

function save() { try { backend.save(slotKey(slot), JSON.stringify(state)); backend.save('hams.slot', String(slot)); } catch { /* full storage: ignore */ } }

function send(text: string) {
  const t = text.trim();
  if (!t) return;
  if (state.phase !== 'play') { startNew(); return; }
  if (/^\/?(roll|r)\s+[\dd+\- ]+(adv|advantage|dis|disadvantage)?$/i.test(t) || /^\/(roll|r)$/i.test(t) || /^(dice|dice tray|open (the )?dice( tray)?)$/i.test(t)) { if (/^\/?(roll|r)\s/i.test(t)) { if (!tray.rollText(t)) toast('Try something like "roll 2d6+3" or "roll d20 adv".'); } else tray.open(); return; }
  if (/^(open (the )?(world )?map|world map|world|show (me )?the (world )?map|look at (the|my) map|check (the|my) map|atlas)$/i.test(t)) { openWorld(); return; }
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
function slotLabel(g: GameState) {
  const pc = g.pc!;
  const cls = pc.cls.charAt(0).toUpperCase() + pc.cls.slice(1);
  return `${pc.name} · Lv ${pc.level} ${cls}${pc.subclass ? '' : ''} · ${statusLine(g)?.place ?? ''}`;
}
function loadSlot(i: number) {
  const g = readSlot(i); if (!g) return;
  slot = i; state = g;
  $('title').hidden = true;
  logEl.innerHTML = '';
  render(state.log.slice(-120), false);
  render([{ k: 'sys', t: 'Welcome back.' }]);
  save();
}
function renderSlots() {
  const cont = $('btn-continue');
  const wrap = document.getElementById('slots-list') ?? (() => { const d = document.createElement('div'); d.id = 'slots-list'; d.className = 'slots'; cont.insertAdjacentElement('afterend', d); return d; })();
  wrap.innerHTML = '';
  const cur = readSlot(slot);
  cont.hidden = !cur;
  if (cur) { cont.textContent = `Continue: ${cur.pc!.name}`; cont.onclick = () => loadSlot(slot); }
  const saved = Array.from({ length: SLOTS }, (_, i) => [i, readSlot(i)] as const).filter(([, g]) => g);
  if (saved.length) { const h = document.createElement('div'); h.className = 'slots-h'; h.textContent = `Saved campaigns (${saved.length}/${SLOTS})`; wrap.appendChild(h); }
  for (const [i, g] of saved) {
    const row = document.createElement('div'); row.className = 'slot-row';
    const b = document.createElement('button'); b.className = `slot${i === slot ? ' current' : ''}`; b.textContent = slotLabel(g!); b.onclick = () => loadSlot(i);
    const d = document.createElement('button'); d.className = 'slot-del'; d.setAttribute('aria-label', `Delete ${g!.pc!.name}`); d.textContent = '🗑';
    d.onclick = () => confirmPanel('Delete this campaign?', `This permanently deletes ${describeSlot(g!)}. It can't be undone.`, 'Delete it', () => deleteSlot(i), true);
    row.append(b, d); wrap.appendChild(row);
  }
}
$('btn-settings').onclick = () => {
  const body = $('panel-body'); body.innerHTML = '';
  $('panel-title').textContent = 'Settings';
  settings(body, () => $('btn-settings').click());
  panel.classList.add('over-title'); panel.hidden = false;
};
renderSlots();
$('btn-new').onclick = () => {
  const empty = Array.from({ length: SLOTS }, (_, i) => i).find((i) => !readSlot(i));
  if (empty !== undefined) { slot = empty; startNew(); return; }
  if (!confirmNew()) return;
  startNew();
};
function confirmNew(): boolean {
  const b = $('btn-new');
  if (b.dataset.armed) return true;
  const g = readSlot(slot);
  b.dataset.armed = '1'; b.textContent = `All ${SLOTS} slots are full. Tap again to overwrite ${g?.pc?.name ?? 'this save'}`;
  setTimeout(() => { delete b.dataset.armed; b.textContent = 'New game'; }, 5000);
  return false;
}
function startNew() {
  $('title').hidden = true;
  openCampaigns($('forge'), (choice, label) => {
    openForge($('forge'), (spec) => {
      state = newState((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
      logEl.innerHTML = '';
      render([{ k: 'title', t: 'Hams Tavern' }]);
      render(beginGame(state, spec, choice));
      save();
      input.focus();
    }, () => startNew(), label);
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
  if (b.dataset.panel === 'world') { openWorld(); return; }
  if (b.dataset.panel === 'dice') { tray.isOpen ? tray.close() : tray.open(); return; }
  if (b.dataset.panel === 'map') { prefs.map = mapEl.hidden ? 'on' : (state.combat ? 'off' : 'combat'); applyPrefs(); refreshMap(); return; }
  openPanel(b.dataset.panel!);
}));
$('panel-close').onclick = () => { panel.hidden = true; panel.classList.remove('over-title'); };
panel.addEventListener('click', (e) => { if (e.target === panel) { panel.hidden = true; panel.classList.remove('over-title'); } });

function opt<K extends keyof Prefs>(label: string, key: K, values: [Prefs[K], string][], reopen: () => void = () => openPanel('menu')) {
  const wrap = document.createElement('div');
  const l = document.createElement('div'); l.className = 'small'; l.textContent = label; wrap.appendChild(l);
  const row = document.createElement('div'); row.className = 'row';
  for (const [v, name] of values) {
    const b = document.createElement('button'); b.textContent = name; if (prefs[key] === v) b.className = 'on';
    b.onclick = () => { prefs[key] = v; applyPrefs(); refreshMap(); reopen(); };
    row.appendChild(b);
  }
  wrap.appendChild(row);
  return wrap;
}

function menuButton(label: string, fn: () => void, cls = '') {
  const b = document.createElement('button'); b.className = `menu-btn ${cls}`.trim(); b.textContent = label; b.onclick = fn; return b;
}
function section(body: HTMLElement, title: string) { const h = document.createElement('h3'); h.className = 'menu-h'; h.textContent = title; body.appendChild(h); }

/** Settings, shared by the title screen and the in-game menu. */
function settings(body: HTMLElement, reopen: () => void) {
  const wrap = document.createElement('div');
  const l = document.createElement('div'); l.className = 'small'; l.textContent = 'Colour theme'; wrap.appendChild(l);
  const grid = document.createElement('div'); grid.className = 'theme-grid';
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `theme-sw${prefs.theme === t.id ? ' on' : ''}`;
    b.style.background = t.p.bg; b.style.color = t.p.ink; b.style.borderColor = prefs.theme === t.id ? t.p.accent : t.p.line;
    b.innerHTML = `<span class="dot" style="background:${t.p.accent}"></span><span class="dot" style="background:${t.p.gold}"></span><span>${t.name}</span>`;
    b.onclick = () => { prefs.theme = t.id; applyPrefs(); reopen(); };
    grid.appendChild(b);
  }
  wrap.appendChild(grid);
  body.appendChild(wrap);
  const cur = paletteFor(prefs.theme, prefs.colors ?? {});
  const own = document.createElement('div');
  own.innerHTML = `<div class="small">Your own colours (on top of the theme)</div><div class="color-row">
    <label class="color-pick"><input type="color" data-c="accent" value="${cur.accent}"><span>Accent</span></label>
    <label class="color-pick"><input type="color" data-c="bg" value="${cur.bg}"><span>Background</span></label>
    <label class="color-pick"><input type="color" data-c="ink" value="${cur.ink}"><span>Text</span></label>
    <button type="button" class="menu-btn small-btn" data-reset="1"${prefs.colors && Object.keys(prefs.colors).length ? '' : ' disabled'}>Reset</button></div>`;
  own.querySelectorAll<HTMLInputElement>('input[type=color]').forEach((inp) => {
    inp.oninput = () => { prefs.colors = { ...(prefs.colors ?? {}), [inp.dataset.c!]: inp.value }; applyPrefs(); };
    inp.onchange = () => reopen();
  });
  own.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => { prefs.colors = {}; applyPrefs(); reopen(); };
  body.appendChild(own);
  if (luminance(cur.bg) > 0.5 === luminance(cur.ink) > 0.5) { const w = document.createElement('p'); w.className = 'small warn'; w.textContent = 'Your text and background are both light or both dark, so the text may be hard to read.'; body.appendChild(w); }
  body.appendChild(opt('Text size', 'size', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], reopen));
  body.appendChild(opt('Dice rolls in the story', 'dice', [['show', 'Show'], ['hide', 'Hide']], reopen));
  body.appendChild(opt('Battle map', 'map', [['on', 'Always'], ['combat', 'In fights'], ['off', 'Off']], reopen));
  body.appendChild(menuButton('Dice and mat colours…', () => { panel.hidden = true; tray.open(); tray.showLook(); }));
  body.appendChild(menuButton('Check for updates', () => { panel.hidden = true; void checkForUpdates(updateBanner, true); }));
}

/** A yes/no question in the panel. */
function confirmPanel(title: string, text: string, yes: string, onYes: () => void, overTitle = false) {
  const body = $('panel-body');
  body.innerHTML = '';
  $('panel-title').textContent = title;
  const p = document.createElement('p'); p.textContent = text; body.appendChild(p);
  const row = document.createElement('div'); row.className = 'confirm-row';
  row.appendChild(menuButton('Cancel', () => { panel.hidden = true; panel.classList.remove('over-title'); }));
  row.appendChild(menuButton(yes, () => { panel.hidden = true; panel.classList.remove('over-title'); onYes(); }, 'danger'));
  body.appendChild(row);
  panel.classList.toggle('over-title', overTitle);
  panel.hidden = false;
}

function deleteSlot(i: number) {
  backend.remove(slotKey(i));
  if (i === slot) {
    state = newState();
    logEl.innerHTML = '';
    const next = Array.from({ length: SLOTS }, (_, k) => k).find((k) => k !== i && readSlot(k));
    slot = next ?? 0;
    try { backend.save('hams.slot', String(slot)); } catch { /* ignore */ }
  }
  toast('Campaign deleted.');
  $('title').hidden = false;
  renderSlots();
  refresh();
}
function describeSlot(g: GameState) {
  const camp = g.world?.campaign?.title;
  return `${g.pc!.name}, level ${g.pc!.level}${camp ? `, in ${camp}` : ''}`;
}

function menu(body: HTMLElement) {
  section(body, 'Game');
  body.appendChild(menuButton('How to play', () => { panel.hidden = true; send('help'); }));
  body.appendChild(menuButton('Back to the title screen (switch character)', () => { panel.hidden = true; save(); $('title').hidden = false; renderSlots(); }));
  body.appendChild(menuButton('Export save (for bug reports or another device)', exportSave));
  body.appendChild(menuButton('Import save', importSave));
  if (state.pc) body.appendChild(menuButton('Delete this campaign…', () => confirmPanel('Delete this campaign?', `This permanently deletes ${describeSlot(state)}. It can't be undone. (Export the save first if you might want it back.)`, 'Delete it', () => deleteSlot(slot)), 'danger'));
  section(body, 'Settings');
  settings(body, () => openPanel('menu'));
  section(body, 'About');
  const about = document.createElement('div'); about.className = 'small';
  about.innerHTML = `<p><b>Hams Tavern: The Bells of Lahti</b> v${VERSION}${BUILD ? ` (build ${BUILD})` : ''}. A solo fantasy RPG with an offline game master. World and story © Jared ("HamSaladSlammer").</p>
  <p>This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.</p>
  <p>This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.</p>
  <p>Fonts: Alegreya, IM Fell English and IBM Plex Mono, under the SIL Open Font License 1.1. Hams Tavern is not affiliated with or endorsed by Wizards of the Coast.</p>
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
        if (nw.state === 'installed' && navigator.serviceWorker.controller) updateBanner('A new version of Hams Tavern is ready.', () => location.reload());
      });
    });
  }).catch(() => { /* offline support unavailable */ });
}

refresh();
// ---------- "an update is ready" banner ----------
let bannerShownFor = '';
function updateBanner(msg: string, onTap?: () => void) {
  if (!onTap) { toast(msg); return; }
  if (bannerShownFor === msg) return;
  bannerShownFor = msg;
  let el = document.getElementById('update-banner');
  if (!el) { el = document.createElement('div'); el.id = 'update-banner'; el.className = 'update-banner'; el.setAttribute('role', 'alert'); $('app').appendChild(el); }
  el.innerHTML = `<span class="ub-ico">⬆</span><span class="ub-msg"></span><button type="button" class="ub-go">Update</button><button type="button" class="ub-later" aria-label="Later">Later</button>`;
  el.querySelector('.ub-msg')!.textContent = msg;
  el.hidden = false;
  el.querySelector<HTMLButtonElement>('.ub-go')!.onclick = () => { el!.hidden = true; save(); onTap(); };
  el.querySelector<HTMLButtonElement>('.ub-later')!.onclick = () => { el!.hidden = true; };
}
const autoCheck = () => { if (navigator.onLine !== false) void checkForUpdates(updateBanner); };
window.setTimeout(autoCheck, 1200);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoCheck(); });

async function nativeBars(color: string) {
  if (!(window as any).Capacitor?.isNativePlatform?.()) return;
  try { const { StatusBar, Style } = await import('@capacitor/status-bar'); await StatusBar.setBackgroundColor({ color }); await StatusBar.setStyle({ style: luminance(color) > 0.5 ? Style.Light : Style.Dark }); } catch { /* not available */ }
}

async function setupNative() {
  void nativeReady();
  void nativeBars(paletteFor(prefs.theme, prefs.colors ?? {}).bg2);
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      if (!panel.hidden) { panel.hidden = true; panel.classList.remove('over-title'); return; }
      if (world.isOpen) { world.close(); return; }
      if (tray.isOpen) { tray.close(); return; }
      if (!$('forge').hidden) { $('forge').hidden = true; $('title').hidden = false; return; }
      App.minimizeApp();
    });
    App.addListener('pause', () => save());
    App.addListener('resume', () => autoCheck());
  } catch { /* not available */ }
}
