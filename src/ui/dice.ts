// The dice tray: roll any dice you like on a mat, with your own dice and mat colours. The same
// dice also tumble in the corner whenever the game rolls a d20 for you (if you want them to).

export interface DiceLook { dice: string; ink: string; mat: string; style: 'solid' | 'gem' | 'metal'; animate: boolean }
export const DEFAULT_LOOK: DiceLook = { dice: '#b3261e', ink: '#ffffff', mat: '#1f5132', style: 'solid', animate: true };
export const DICE_PRESETS: [string, string, string][] = [['Blood', '#b3261e', '#ffffff'], ['Bone', '#e8dcc0', '#2b2118'], ['Brass', '#c99a3a', '#1a1209'], ['Jade', '#2f8f6b', '#f2fff8'], ['Midnight', '#1f2a5a', '#ffd76a'], ['Amethyst', '#7a3fa0', '#ffffff'], ['Ink', '#141414', '#e8e8e8'], ['Frost', '#bfe3f2', '#123040']];
export const MAT_PRESETS: [string, string][] = [['Green felt', '#1f5132'], ['Red velvet', '#5a1620'], ['Blue baize', '#1c3a5e'], ['Black leather', '#191716'], ['Tavern oak', '#6b4423'], ['Parchment', '#cbb88f'], ['Violet', '#3a2350']];

const SIDES = [4, 6, 8, 10, 12, 20, 100];
type Pool = Record<number, number>;
interface Rolled { sides: number; value: number; kept: boolean }
interface HistoryEntry { label: string; total: number; dice: Rolled[]; mod: number }

const SHAPES: Record<number, string> = {
  4: '50,6 94,86 6,86',
  6: '12,12 88,12 88,88 12,88',
  8: '50,4 94,50 50,96 6,50',
  10: '50,4 92,40 76,92 24,92 8,40',
  12: '50,4 93,34 77,90 23,90 7,34',
  20: '50,3 92,27 92,73 50,97 8,73 8,27',
  100: '50,4 92,40 76,92 24,92 8,40',
};

export function rollExpr(expr: string, rnd: () => number = Math.random): { total: number; dice: Rolled[]; mod: number; label: string } | null {
  const e = expr.toLowerCase().replace(/\s+/g, '').replace(/^\/?r(oll)?/, '');
  const adv = /adv|advantage$/.test(e) ? 'adv' : /dis|disadvantage$/.test(e) ? 'dis' : '';
  const body = e.replace(/(adv|advantage|dis|disadvantage)$/, '');
  if (!/^([+-]?(\d*d\d+|\d+))+$/.test(body)) return null;
  const terms = body.match(/[+-]?(\d*d\d+|\d+)/g) ?? [];
  const dice: Rolled[] = [];
  let mod = 0;
  for (const t of terms) {
    const sign = t.startsWith('-') ? -1 : 1;
    const x = t.replace(/^[+-]/, '');
    const m = x.match(/^(\d*)d(\d+)$/);
    if (m) {
      const n = Math.min(30, Number(m[1] || 1)); const sides = Math.min(1000, Number(m[2]));
      if (sides < 2) return null;
      for (let i = 0; i < n; i++) dice.push({ sides, value: 1 + Math.floor(rnd() * sides), kept: true });
      if (sign < 0) dice.slice(-n).forEach((d) => (d.value = -d.value));
    } else mod += sign * Number(x);
  }
  if (adv && dice.length === 1 && dice[0].sides === 20) {
    const second: Rolled = { sides: 20, value: 1 + Math.floor(rnd() * 20), kept: true };
    dice.push(second);
    const [a, b] = dice;
    if ((adv === 'adv' && a.value >= b.value) || (adv === 'dis' && a.value <= b.value)) b.kept = false; else a.kept = false;
  }
  const total = dice.filter((d) => d.kept).reduce((n, d) => n + d.value, 0) + mod;
  return { total, dice, mod, label: `${body}${adv ? ` (${adv === 'adv' ? 'advantage' : 'disadvantage'})` : ''}` };
}

export class DiceTray {
  private pool: Pool = {};
  private mod = 0;
  private adv: '' | 'adv' | 'dis' = '';
  private history: HistoryEntry[] = [];
  private mini: HTMLElement;
  private check: { label: string; done: (rolls: number[]) => void } | null = null;
  constructor(private root: HTMLElement, private look: DiceLook, private onLook: (l: DiceLook) => void, private onRoll: (text: string) => void) {
    this.mini = document.createElement('div');
    this.mini.className = 'dice-mini';
    this.mini.hidden = true;
    document.getElementById('app')!.appendChild(this.mini);
    this.applyLook();
  }

  setLook(l: DiceLook) { this.look = l; this.applyLook(); }
  private applyLook() {
    const st = document.documentElement.style;
    st.setProperty('--die', this.look.dice); st.setProperty('--die-ink', this.look.ink); st.setProperty('--mat', this.look.mat);
    st.setProperty('--die-hi', shade(this.look.dice, this.look.style === 'metal' ? 0.6 : 0.3));
    document.documentElement.dataset.dicestyle = this.look.style;
  }

  get isOpen() { return !this.root.hidden; }
  open() { this.root.hidden = false; this.render(); }
  close() { this.root.hidden = true; if (this.check) { this.check = null; this.pool = {}; this.mod = 0; this.adv = ''; } }

  /** The game asked for a check: set up a d20 with the right bonus, and hand back what lands. */
  rollFor(ask: { label: string; bonus: number; adv: 'adv' | 'dis' | 'none' }, done: (rolls: number[]) => void, auto = true) {
    this.pool = { 20: 1 }; this.mod = ask.bonus; this.adv = ask.adv === 'none' ? '' : ask.adv;
    this.check = { label: ask.label, done };
    this.root.hidden = false;
    this.render();
    if (auto) (this.root.querySelector('[data-dt="roll"]') as HTMLButtonElement | null)?.click();
  }
  showLook() { const d = this.root.querySelector('details'); if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); } }

  /** Roll an expression from the text box ("/roll 2d6+3"). */
  rollText(expr: string) {
    const r = rollExpr(expr);
    if (!r) return false;
    this.open();
    this.show(r);
    return true;
  }

  private render(tumble?: { dice: Rolled[]; total: number; mod: number; label: string }) {
    const poolText = this.poolExpr() || 'Tap dice to add them';
    const L = this.look;
    this.root.innerHTML = `<div class="dt-inner">
      ${this.check ? `<div class="dt-check-h">🎲 ${esc(this.check.label)} check <span>tap Roll</span></div>` : ''}
      <div class="dt-head"><b>Dice</b><span class="dt-sub">${esc(poolText)}${this.mod ? ` ${this.mod > 0 ? '+' : ''}${this.mod}` : ''}${this.adv ? ` · ${this.adv === 'adv' ? 'advantage' : 'disadvantage'}` : ''}</span><button class="dt-x" data-dt="close" aria-label="Close">✕</button></div>
      <div class="dt-mat" id="dt-mat">${tumble ? '' : `<p class="dt-hint">${this.history[0] ? `Last: ${esc(this.history[0].label)} = <b>${this.history[0].total}</b>` : 'Pick your dice below, then roll.'}</p>`}</div>
      <div class="dt-row">${SIDES.map((n) => `<button class="dt-die" data-dt="add" data-n="${n}" aria-label="Add a d${n}">${dieSvg(n, n === 100 ? '%' : String(n), 38)}<span>d${n}${this.pool[n] ? ` ×${this.pool[n]}` : ''}</span></button>`).join('')}</div>
      <div class="dt-row dt-ctl">
        <button data-dt="mod-">−1</button><span class="dt-mod">${this.mod >= 0 ? '+' : ''}${this.mod}</span><button data-dt="mod+">+1</button>
        <button data-dt="adv" class="${this.adv === 'adv' ? 'on' : ''}">Adv</button><button data-dt="dis" class="${this.adv === 'dis' ? 'on' : ''}">Dis</button>
        <button data-dt="clear">Clear</button><button data-dt="roll" class="primary">Roll</button>
      </div>
      <details class="dt-look"><summary>Dice and mat colours</summary>
        <div class="lbl">Dice</div><div class="dt-swatches">${DICE_PRESETS.map(([n, d, i]) => `<button class="sw${L.dice === d ? ' on' : ''}" data-dt="dice" data-d="${d}" data-i="${i}" title="${n}" style="background:${d};color:${i}">${n}</button>`).join('')}<label class="sw pick">Custom <input type="color" data-dt-in="dice" value="${L.dice}"></label><label class="sw pick">Numbers <input type="color" data-dt-in="ink" value="${L.ink}"></label></div>
        <div class="lbl">Finish</div><div class="dt-swatches">${(['solid', 'gem', 'metal'] as const).map((x) => `<button class="sw${L.style === x ? ' on' : ''}" data-dt="style" data-s="${x}">${x === 'solid' ? 'Solid' : x === 'gem' ? 'Gemstone' : 'Metal'}</button>`).join('')}</div>
        <div class="lbl">Mat</div><div class="dt-swatches">${MAT_PRESETS.map(([n, m]) => `<button class="sw${L.mat === m ? ' on' : ''}" data-dt="mat" data-m="${m}" style="background:${m};color:${contrast(m)}">${n}</button>`).join('')}<label class="sw pick">Custom <input type="color" data-dt-in="mat" value="${L.mat}"></label></div>
        <label class="dt-check"><input type="checkbox" data-dt-in="animate"${L.animate ? ' checked' : ''}> Show the game's d20 rolls as dice</label>
      </details>
      ${this.history.length ? `<div class="dt-hist">${this.history.slice(0, 8).map((h) => `<div><span>${esc(h.label)}</span><span>${h.dice.map((d) => `<i class="${d.kept ? '' : 'dropped'}">${d.value}</i>`).join(' ')}${h.mod ? ` ${h.mod > 0 ? '+' : ''}${h.mod}` : ''}</span><b>${h.total}</b></div>`).join('')}</div>` : ''}
      <p class="small">Tip: type <b>/roll 2d6+3</b> or <b>roll d20 adv</b> in the box.</p>
    </div>`;
    this.root.onclick = (e) => this.click(e);
    this.root.onchange = (e) => this.change(e);
    this.root.oninput = (e) => this.change(e);
    if (tumble) this.tumble(tumble);
  }

  private poolExpr() { return SIDES.filter((n) => this.pool[n]).map((n) => `${this.pool[n]}d${n}`).join(' + '); }

  private click(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-dt]') as HTMLElement | null;
    if (!t) { if (e.target === this.root) this.close(); return; }
    const a = t.dataset.dt!;
    if (a === 'close') { this.close(); return; }
    if (a === 'add') { const n = Number(t.dataset.n); this.pool[n] = Math.min(20, (this.pool[n] ?? 0) + 1); }
    else if (a === 'clear') { this.pool = {}; this.mod = 0; this.adv = ''; }
    else if (a === 'mod+') this.mod += 1;
    else if (a === 'mod-') this.mod -= 1;
    else if (a === 'adv' || a === 'dis') this.adv = this.adv === a ? '' : a;
    else if (a === 'roll') {
      const expr = (this.poolExpr() || '1d20').replace(/\s/g, '') + (this.mod ? `${this.mod > 0 ? '+' : ''}${this.mod}` : '') + (this.adv && this.poolExpr() === '1d20' || this.adv && !this.poolExpr() ? this.adv : '');
      const r = rollExpr(expr);
      if (r) this.show(r);
      return;
    }
    else if (a === 'dice') { this.look = { ...this.look, dice: t.dataset.d!, ink: t.dataset.i! }; this.saveLook(); }
    else if (a === 'mat') { this.look = { ...this.look, mat: t.dataset.m! }; this.saveLook(); }
    else if (a === 'style') { this.look = { ...this.look, style: t.dataset.s as DiceLook['style'] }; this.saveLook(); }
    const open = this.root.querySelector('details')?.open;
    this.render();
    if (open) this.root.querySelector('details')!.open = true;
  }
  private change(e: Event) {
    const t = e.target as HTMLInputElement;
    const k = t.dataset.dtIn;
    if (!k) return;
    if (k === 'animate') this.look = { ...this.look, animate: t.checked };
    else this.look = { ...this.look, [k]: t.value };
    this.saveLook();
    if (e.type === 'change') { this.render(); this.root.querySelector('details')!.open = true; }
  }
  private saveLook() { this.applyLook(); this.onLook(this.look); }

  private show(r: { total: number; dice: Rolled[]; mod: number; label: string }) {
    this.history.unshift({ label: r.label, total: r.total, dice: r.dice, mod: r.mod });
    this.history.length = Math.min(this.history.length, 20);
    const chk = this.check;
    if (chk) {
      this.render(r);
      this.check = null;
      const d20s = r.dice.filter((d) => d.sides === 20).map((d) => Math.abs(d.value));
      window.setTimeout(() => { chk.done(d20s); this.pool = {}; this.mod = 0; this.adv = ''; window.setTimeout(() => { if (!this.check) this.root.hidden = true; }, 900); }, 1300);
      return;
    }
    this.render(r);
    this.onRoll(`🎲 ${r.label}: ${r.dice.map((d) => (d.kept ? d.value : `(${d.value})`)).join(', ')}${r.mod ? ` ${r.mod > 0 ? '+' : ''}${r.mod}` : ''} = ${r.total}`);
  }

  private tumble(r: { dice: Rolled[]; total: number; mod: number }) {
    const mat = this.root.querySelector('#dt-mat') as HTMLElement;
    const W = mat.clientWidth || 320, H = mat.clientHeight || 180;
    const n = r.dice.length;
    const size = n > 12 ? 40 : n > 6 ? 52 : 64;
    const placed: { x: number; y: number }[] = [];
    const els: HTMLElement[] = [];
    r.dice.forEach((d, i) => {
      let x = 0, y = 0;
      for (let k = 0; k < 30; k++) { x = 8 + Math.random() * Math.max(10, W - size - 16); y = 8 + Math.random() * Math.max(10, H - size - 64); if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > size * 0.9)) break; }
      placed.push({ x, y });
      const el = document.createElement('div');
      el.className = `dt-roll${d.kept ? '' : ' dropped'}`;
      el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.width = el.style.height = `${size}px`;
      el.style.setProperty('--fx', `${(Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120)}px`);
      el.style.setProperty('--fy', `${-80 - Math.random() * 80}px`);
      el.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 540)}deg`);
      el.style.animationDelay = `${i * 40}ms`;
      el.innerHTML = dieSvg(d.sides, '?', size);
      mat.appendChild(el);
      els.push(el);
      let ticks = 0;
      const iv = window.setInterval(() => {
        ticks += 1;
        const txt = el.querySelector('text');
        if (txt) txt.textContent = String(1 + Math.floor(Math.random() * d.sides));
        if (ticks > 9) { window.clearInterval(iv); if (txt) txt.textContent = String(Math.abs(d.value)); el.classList.add('landed'); if (d.sides === 20 && Math.abs(d.value) === 20 && d.kept) el.classList.add('crit'); if (d.sides === 20 && Math.abs(d.value) === 1 && d.kept) el.classList.add('fumble'); }
      }, 60);
    });
    const tot = document.createElement('div');
    tot.className = 'dt-total';
    tot.innerHTML = `<b>${r.total}</b>`;
    window.setTimeout(() => mat.appendChild(tot), 700 + n * 40);
    void els;
  }

  /** Show the game's own d20 tumbling in the corner. */
  flash(value: number, outcome?: 'success' | 'fail') {
    if (!this.look.animate || this.isOpen) return;
    const el = this.mini;
    el.hidden = false;
    el.className = 'dice-mini rolling';
    el.innerHTML = dieSvg(20, '?', 56) + (outcome ? `<span class="dm-out ${outcome}">${outcome === 'success' ? '✓' : '✗'}</span>` : '');
    let ticks = 0;
    const iv = window.setInterval(() => {
      ticks += 1;
      const t = el.querySelector('text');
      if (t) t.textContent = String(1 + Math.floor(Math.random() * 20));
      if (ticks > 7) {
        window.clearInterval(iv);
        if (t) t.textContent = String(value);
        el.className = `dice-mini landed${value === 20 ? ' crit' : value === 1 ? ' fumble' : ''}`;
        window.clearTimeout((el as unknown as { _t?: number })._t);
        (el as unknown as { _t?: number })._t = window.setTimeout(() => (el.hidden = true), 1400);
      }
    }, 55);
  }
}

let GID = 0;
function dieSvg(sides: number, label: string, size: number) {
  const pts = SHAPES[sides] ?? SHAPES[20];
  const gid = `dg${sides}_${++GID}`;
  const fs = label.length > 2 ? 26 : label.length > 1 ? 32 : 38;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--die-hi)"/><stop offset="1" stop-color="var(--die)"/></linearGradient></defs><polygon class="dface" points="${pts}" fill="url(#${gid})"/><polygon class="dedge" points="${pts}" fill="none"/><text x="50" y="${sides === 4 ? 70 : 56}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}">${label}</text></svg>`;
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v + (255 - v) * amt);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
function contrast(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#1a1209' : '#fff';
}
const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

/** Pull the natural d20 out of a game roll line, if there is one. */
export function d20Of(line: string): { value: number; outcome?: 'success' | 'fail' } | null {
  if (!line.startsWith('🎲')) return null;
  if (/damage|💥|Hit Die|HP/.test(line)) return null;
  const m = line.match(/d20 (\d{1,2})\b/) ?? line.match(/^🎲 [^:]+: (?:\((\d+),\d+\) )?(\d{1,2})\b/);
  const v = m ? Number(m[2] ?? m[1]) : NaN;
  if (!(v >= 1 && v <= 20)) return null;
  const outcome = /— success|— hit|— crit/.test(line) ? 'success' : /— fail|— miss/.test(line) ? 'fail' : undefined;
  return { value: v, outcome };
}
