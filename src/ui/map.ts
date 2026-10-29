// The battle map: a canvas grid with tokens, fog of war, movement range and tap actions.
import type { MapView, MapToken } from '../engine/game';

type Send = (cmd: string) => void;

const C = {
  bg: '#0d0a07', grid: 'rgba(255,240,210,0.07)', fog: '#050403', dim: 'rgba(5,4,3,0.6)',
  wood: '#3b2c1e', wood2: '#33261a', ground: '#4b4430', ground2: '#443d2b', grass: '#3b4a29', grass2: '#34421f', water: '#284556', water2: '#30505f',
  wall: '#1b1510', wallTop: '#4a3a2a', stone: '#6c6658', stone2: '#8a8373', dark: '#231a12', gold: '#d2ad55', blood: '#c0503f', green: '#7fae86', blue: '#7f97b3', ink: '#f2e6cf',
};

export class BattleMap {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private menu: HTMLElement;
  private view: MapView | null = null;
  private cell = 24;
  private send: Send;
  private ox = 0;
  private oy = 0;

  constructor(el: HTMLElement, send: Send) {
    this.el = el;
    this.send = send;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Battle map. Tap a square, a person or a thing.');
    this.el.appendChild(this.canvas);
    this.menu = document.createElement('div');
    this.menu.className = 'map-menu';
    this.menu.hidden = true;
    this.el.appendChild(this.menu);
    this.ctx = this.canvas.getContext('2d')!;
    let downAt: { x: number; y: number; t: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) return;
      this.tap(e.clientX, e.clientY);
      downAt = null;
    });
    document.addEventListener('pointerdown', (e) => { if (!this.menu.hidden && !this.menu.contains(e.target as Node) && e.target !== this.canvas) this.menu.hidden = true; });
    new ResizeObserver(() => this.draw()).observe(this.el);
  }

  update(v: MapView | null) { this.view = v; this.menu.hidden = true; this.draw(); }

  private draw() {
    const v = this.view;
    if (!v || this.el.hidden) return;
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    this.cell = Math.max(14, Math.floor(Math.min(W / v.w, H / v.h)));
    const cw = this.cell * v.w, ch = this.cell * v.h;
    this.ox = Math.floor((W - cw) / 2);
    this.oy = Math.floor((H - ch) / 2);
    this.canvas.width = Math.floor(W * dpr);
    this.canvas.height = Math.floor(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.translate(this.ox, this.oy);
    const s = this.cell;
    const seen = (x: number, y: number) => v.explored[y * v.w + x] === '1' || v.visible.has(`${x},${y}`);
    // tiles
    for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) {
      if (!seen(x, y)) { g.fillStyle = C.fog; g.fillRect(x * s, y * s, s, s); continue; }
      this.tile(v, v.tiles[y][x], x, y);
    }
    // grid
    g.strokeStyle = C.grid; g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= v.w; x++) { g.moveTo(x * s + .5, 0); g.lineTo(x * s + .5, v.h * s); }
    for (let y = 0; y <= v.h; y++) { g.moveTo(0, y * s + .5); g.lineTo(v.w * s, y * s + .5); }
    g.stroke();
    // movement range
    if (v.reach) {
      g.fillStyle = 'rgba(240,200,95,0.30)';
      g.strokeStyle = 'rgba(240,200,95,0.75)'; g.lineWidth = 1;
      for (const k of v.reach) { const [x, y] = k.split(',').map(Number); g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); }
      for (const k of v.reach) {
        const [x, y] = k.split(',').map(Number);
        const edge = (dx: number, dy: number) => !v.reach!.has(`${x + dx},${y + dy}`);
        g.beginPath();
        if (edge(0, -1)) { g.moveTo(x * s, y * s + .5); g.lineTo(x * s + s, y * s + .5); }
        if (edge(0, 1)) { g.moveTo(x * s, y * s + s - .5); g.lineTo(x * s + s, y * s + s - .5); }
        if (edge(-1, 0)) { g.moveTo(x * s + .5, y * s); g.lineTo(x * s + .5, y * s + s); }
        if (edge(1, 0)) { g.moveTo(x * s + s - .5, y * s); g.lineTo(x * s + s - .5, y * s + s); }
        g.stroke();
      }
    }
    // exits
    for (const e of v.exits) {
      if (e.state === 'hidden' || !seen(e.x, e.y)) continue;
      g.strokeStyle = e.state === 'open' ? C.gold : C.blood; g.lineWidth = 2;
      g.strokeRect(e.x * s + 3, e.y * s + 3, s - 6, s - 6);
      g.fillStyle = e.state === 'open' ? C.gold : C.blood;
      g.font = `${Math.floor(s * 0.55)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(e.state === 'open' ? '⇲' : '🔒', e.x * s + s / 2, e.y * s + s / 2 + 1);
    }
    // fog dim for remembered but not visible
    for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) if (seen(x, y) && !v.visible.has(`${x},${y}`)) { g.fillStyle = C.dim; g.fillRect(x * s, y * s, s, s); }
    // tokens
    for (const t of v.tokens) if (v.visible.has(`${t.x},${t.y}`) || t.side === 'pc' || t.side === 'party') this.token(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private tile(v: MapView, ch: string, x: number, y: number) {
    const g = this.ctx, s = this.cell, X = x * s, Y = y * s;
    const alt = (x + y) % 2 === 0;
    const base = v.outdoors ? (v.tiles.join('').includes(',') ? (alt ? C.ground : C.ground2) : (alt ? C.grass : C.grass2)) : (alt ? C.wood : C.wood2);
    const floor = () => { g.fillStyle = v.outdoors ? base : base; g.fillRect(X, Y, s, s); if (!v.outdoors) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(X, Y + s / 2); g.lineTo(X + s, Y + s / 2); g.stroke(); } };
    const blob = (col: string, r = 0.38, dx = 0, dy = 0) => { g.fillStyle = col; g.beginPath(); g.arc(X + s / 2 + dx * s, Y + s / 2 + dy * s, s * r, 0, Math.PI * 2); g.fill(); };
    const rect = (col: string, inset = 0.12, r = 3) => { g.fillStyle = col; const i = s * inset; g.beginPath(); (g as any).roundRect ? (g as any).roundRect(X + i, Y + i, s - 2 * i, s - 2 * i, r) : g.rect(X + i, Y + i, s - 2 * i, s - 2 * i); g.fill(); };
    switch (ch) {
      case '#': g.fillStyle = C.wall; g.fillRect(X, Y, s, s); g.fillStyle = C.wallTop; g.fillRect(X, Y, s, Math.max(2, s * 0.18)); return;
      case '=': g.fillStyle = C.wall; g.fillRect(X, Y, s, s); g.fillStyle = '#7fa9c4'; g.fillRect(X + s * 0.15, Y + s * 0.4, s * 0.7, s * 0.2); return;
      case ',': case '.': case '"': floor(); if (ch === '"' && alt) { g.strokeStyle = 'rgba(120,160,80,0.35)'; g.beginPath(); g.moveTo(X + s * .3, Y + s * .7); g.lineTo(X + s * .35, Y + s * .45); g.moveTo(X + s * .6, Y + s * .75); g.lineTo(X + s * .65, Y + s * .5); g.stroke(); } return;
      case '~': g.fillStyle = alt ? C.water : C.water2; g.fillRect(X, Y, s, s); g.strokeStyle = 'rgba(180,220,240,0.25)'; g.beginPath(); g.moveTo(X + s * .2, Y + s * .5); g.quadraticCurveTo(X + s * .35, Y + s * .35, X + s * .5, Y + s * .5); g.quadraticCurveTo(X + s * .65, Y + s * .65, X + s * .8, Y + s * .5); g.stroke(); return;
    }
    floor();
    switch (ch) {
      case 'T': rect('#6b4a2c', 0.06); return;
      case 'B': rect('#2a1d12', 0.04, 1); g.fillStyle = '#5a3d22'; g.fillRect(X + s * .04, Y + s * .04, s * .92, s * .2); return;
      case 's': blob('#7a5634', 0.22); return;
      case 'b': blob('#5b3b1f', 0.36); g.strokeStyle = '#2b1b0e'; g.lineWidth = 1.5; g.beginPath(); g.arc(X + s / 2, Y + s / 2, s * .24, 0, Math.PI * 2); g.stroke(); return;
      case 'H': rect('#3a2a20', 0.05); blob('#e0702a', 0.28); blob('#f6c45a', 0.14); return;
      case 'F': rect('#40302a', 0.05); blob('#c94a20', 0.3); blob('#f3a03a', 0.15); return;
      case 'P': rect('#5a4128', 0.12, 2); return;
      case 'A': rect(C.stone, 0.08); return;
      case 'S': rect(C.stone2, 0.08, 4); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.strokeRect(X + s * .25, Y + s * .2, s * .5, s * .6); return;
      case 'g': g.fillStyle = C.stone2; g.beginPath(); g.moveTo(X + s * .3, Y + s * .85); g.lineTo(X + s * .3, Y + s * .4); g.arc(X + s * .5, Y + s * .4, s * .2, Math.PI, 0); g.lineTo(X + s * .7, Y + s * .85); g.fill(); return;
      case 't': blob('#1f3318', 0.48); blob('#2d4a22', 0.34, -0.05, -0.05); return;
      case 'r': blob(C.stone, 0.4); blob(C.stone2, 0.2, -0.1, -0.1); return;
      case 'w': blob(C.stone2, 0.45); blob('#1d3340', 0.28); return;
      case 'C': rect('#5d4428', 0.08); blob('#2b1d10', 0.12, -0.28, 0.3); blob('#2b1d10', 0.12, 0.28, 0.3); return;
      case 'K': rect('#3f2d1c', 0.04, 1); g.fillStyle = '#8a6a3f'; for (let i = 0; i < 3; i++) g.fillRect(X + s * (.15 + i * .25), Y + s * .2, s * .15, s * .6); return;
      case 'N': g.fillStyle = '#4f5257'; g.fillRect(X + s * .15, Y + s * .3, s * .7, s * .25); g.fillRect(X + s * .35, Y + s * .5, s * .3, s * .35); return;
      case 'c': blob('#3a2e24', 0.14); blob('#9ad07a', 0.08, 0, -0.2); return;
      case 'L': g.strokeStyle = '#c9a66b'; g.lineWidth = 3; g.beginPath(); g.moveTo(X + s / 2, Y); g.lineTo(X + s / 2, Y + s * .8); g.stroke(); return;
      case '^': g.strokeStyle = C.stone2; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(X + s * .15, Y + i * s / 4); g.lineTo(X + s * .85, Y + i * s / 4); g.stroke(); } return;
      case ':': g.fillStyle = '#c8bca6'; for (const [a, b] of [[.3, .35], [.6, .55], [.4, .7], [.7, .3]]) g.fillRect(X + s * a, Y + s * b, s * .12, s * .06); return;
      case ';': blob('#e8e2d2', 0.3); blob('#2b2722', 0.1, 0.22, -0.1); return;
      default:
        if (/[0-9]/.test(ch)) return; // doors: drawn as floor; outline added later
    }
  }

  private token(t: MapToken) {
    const g = this.ctx, s = this.cell;
    const cx = t.x * s + s / 2, cy = t.y * s + s / 2, r = s * 0.42;
    const col = t.side === 'pc' ? C.gold : t.side === 'party' ? C.green : t.side === 'foe' ? C.blood : C.blue;
    g.globalAlpha = t.down ? 0.45 : 1;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(cx + 1.5, cy + 2, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b140e'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = Math.max(2, s * 0.1); g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, r - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
    if (t.hp !== undefined && t.maxHp) {
      const f = Math.max(0, Math.min(1, t.hp / t.maxHp));
      g.strokeStyle = f > 0.5 ? C.green : f > 0.25 ? C.gold : C.blood; g.lineWidth = Math.max(2, s * 0.08);
      g.beginPath(); g.arc(cx, cy, r + g.lineWidth, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.stroke();
    }
    g.fillStyle = C.ink; g.font = `600 ${Math.floor(s * 0.36)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t.label, cx, cy + 1);
    if (t.down) { g.strokeStyle = C.blood; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - r * .6, cy - r * .6); g.lineTo(cx + r * .6, cy + r * .6); g.moveTo(cx + r * .6, cy - r * .6); g.lineTo(cx - r * .6, cy + r * .6); g.stroke(); }
    if (t.conds.includes('prone')) { g.fillStyle = C.ink; g.font = `${Math.floor(s * .3)}px system-ui`; g.fillText('⤓', cx + r * .8, cy - r * .8); }
    g.globalAlpha = 1;
  }

  private tap(clientX: number, clientY: number) {
    const v = this.view;
    if (!v) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - this.ox) / this.cell);
    const y = Math.floor((clientY - rect.top - this.oy) / this.cell);
    if (x < 0 || y < 0 || x >= v.w || y >= v.h) return;
    const seen = v.explored[y * v.w + x] === '1' || v.visible.has(`${x},${y}`);
    if (!seen) return;
    const tok = v.tokens.find((t) => t.x === x && t.y === y && (v.visible.has(`${x},${y}`) || t.side !== 'foe'));
    const ex = v.exits.find((e) => e.x === x && e.y === y && e.state !== 'hidden');
    const ch = v.tiles[y][x];
    const thing = v.tileNames[ch];
    const opts: [string, string][] = [];
    if (tok) {
      const n = tok.name.toLowerCase().replace(/^the\s+/, '');
      if (tok.side === 'foe') {
        opts.push([`⚔ Attack ${tok.name}`, `attack ${n}`], ['Shove', `shove ${n}`], ['Grapple', `grapple ${n}`], ['Move next to', `approach ${n}`], ['Look', `look at ${n}`]);
      } else if (tok.side === 'npc') {
        opts.push([`💬 Talk to ${tok.name}`, `talk to ${n}`], ['Look', `look at ${n}`], ['Walk over', `go over to ${n}`], ['⚔ Attack', `attack ${n}`]);
      } else if (tok.side === 'party' && tok.key !== 'pc') {
        opts.push([`💬 Talk to ${tok.name}`, `talk to ${n}`], ['High five', `high five ${n}`], ['Look', `look at ${n}`]);
        if (v.inCombat) opts.push(['Heal (potion)', `use potion on ${n}`]);
      } else {
        opts.push(['📜 Sheet', 'sheet'], ['Search here', 'search'], v.inCombat ? ['Dodge', 'dodge'] : ['Short rest', 'short rest'], v.inCombat ? ['End turn', 'end turn'] : ['Look around', 'look']);
        if (v.inCombat) opts.push(['Take cover', 'take cover']);
      }
    } else if (ex) {
      opts.push([ex.state === 'open' ? `🚪 ${ex.label}` : `🔒 ${ex.label}`, `@move ${x} ${y}`]);
      if (ex.state === 'locked') opts.push(['Kick it', `kick the ${/vestry/i.test(ex.label) ? 'vestry ' : /tower/i.test(ex.label) ? 'tower ' : ''}door`], ['Pick the lock', `pick the ${/vestry/i.test(ex.label) ? 'vestry ' : ''}lock`]);
    } else if (thing && !/[.,"~]/.test(ch)) {
      const t = thing;
      opts.push([`👁 Look at the ${t}`, `examine ${t}`]);
      if (/table|bar|stool|chair|pew|bench|barrel|rock|boulder|log|grave|gravestone|cart|altar|anvil|sarcophag|wall/.test(t)) opts.push(['Sit / lean', `sit on the ${t}`]);
      if (/tree|rafter|wall|cart|table|boulder|rock|altar|sarcophag|palisade|dome|shelves/.test(t)) opts.push(['Climb', `climb the ${t}`]);
      if (/stool|chair|mug|bottle|window|pew|candle|barrel|shelves/.test(t)) opts.push(['Break', `break the ${t}`]);
      if (/rock|stone|stick|bone|mug|candle|rubble|scrap|mushroom/.test(t)) opts.push(['Pick up', `pick up a ${t.replace(/s$/, '')}`]);
      if (/fire|hearth|forge|candle|campfire|torch|sconce/.test(t)) opts.push(['Warm up / light', `light a candle`]);
      if (/well|stream|water|trough|quench/.test(t)) opts.push(['Drink', `drink from the ${t}`]);
      if (/table|pew|barrel|cart|bar|boulder|rock|tree|grave|sarcophag|altar|wall/.test(t)) opts.push([v.inCombat ? 'Take cover here' : 'Hide behind', v.inCombat ? 'take cover' : `hide behind the ${t}`]);
      opts.push(['Search', `search the ${t}`], ['Walk to', `go over to the ${t}`]);
    } else {
      // empty floor
      if (v.inCombat) { if (v.reach?.has(`${x},${y}`)) { this.send(`@move ${x} ${y}`); return; } opts.push(['Move here (as far as you can)', `@move ${x} ${y}`], ['Dash', 'dash'], ['End turn', 'end turn']); }
      else { this.send(`@move ${x} ${y}`); return; }
    }
    this.popup(opts, clientX - rect.left, clientY - rect.top);
  }

  private popup(opts: [string, string][], px: number, py: number) {
    const m = this.menu;
    m.innerHTML = '';
    for (const [label, cmd] of opts) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => { m.hidden = true; this.send(cmd); };
      m.appendChild(b);
    }
    m.hidden = false;
    const W = this.el.clientWidth, H = this.el.clientHeight;
    const mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = `${Math.max(4, Math.min(W - mw - 4, px - mw / 2))}px`;
    m.style.top = `${py + mh + 16 < H ? py + 12 : Math.max(4, py - mh - 12)}px`;
  }
}
