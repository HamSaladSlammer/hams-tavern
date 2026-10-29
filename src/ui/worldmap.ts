// The World map: Jared's map of Lahti, with every town, every place you've found, where you are,
// and a tap-to-travel popup. Pan with a finger or mouse, pinch or wheel to zoom.
import type { WorldViewData, WorldPin } from '../world';

const MAP_URL = './lahti-map.webp';
const ICON: Record<WorldPin['kind'], string> = { town: '', site: '✦', story: '❖', here: '', property: '⌂' };

export class WorldMap {
  private root: HTMLElement;
  private view!: HTMLElement;
  private inner!: HTMLElement;
  private card!: HTMLElement;
  private head!: HTMLElement;
  private z = 1;
  private tx = 0;
  private ty = 0;
  private data: WorldViewData | null = null;
  private centred = false;
  constructor(root: HTMLElement, private send: (cmd: string) => void) {
    this.root = root;
    root.innerHTML = `
      <div class="wm-head"><div class="wm-title"><b>Lahti</b><span class="wm-sub"></span></div><button class="wm-close" aria-label="Close">✕</button></div>
      <div class="wm-view"><div class="wm-inner"><img class="wm-img" src="${MAP_URL}" alt="Map of Lahti" draggable="false" /><div class="wm-pins"></div></div></div>
      <div class="wm-foot"><span><i class="k town"></i>Town</span><span><i class="k site">✦</i>Found</span><span><i class="k story">❖</i>Story</span><span><i class="k prop">⌂</i>Yours</span><span><i class="k here"></i>You</span><button class="wm-zoom" data-z="1.4">＋</button><button class="wm-zoom" data-z="0.7">－</button></div>
      <div class="wm-card" hidden></div>`;
    this.view = root.querySelector('.wm-view')!;
    this.inner = root.querySelector('.wm-inner')!;
    this.card = root.querySelector('.wm-card')!;
    this.head = root.querySelector('.wm-sub')!;
    root.querySelector<HTMLButtonElement>('.wm-close')!.onclick = () => this.close();
    root.querySelectorAll<HTMLButtonElement>('.wm-zoom').forEach((b) => (b.onclick = () => this.zoomAt(Number(b.dataset.z), this.view.clientWidth / 2, this.view.clientHeight / 2)));
    this.bindGestures();
    window.addEventListener('resize', () => { if (!root.hidden) this.layout(); });
  }

  open(d: WorldViewData) {
    this.root.hidden = false;
    this.update(d);
    this.layout(); this.centreOn(d.here); this.centred = true;
  }
  close() { this.root.hidden = true; this.card.hidden = true; }
  get isOpen() { return !this.root.hidden; }

  update(d: WorldViewData) {
    this.data = d;
    const fr = d.fronts.filter((f) => !f.ended).map((f) => `${f.name} ${'●'.repeat(Math.ceil((f.clock / f.max) * 5))}${'○'.repeat(5 - Math.ceil((f.clock / f.max) * 5))}`);
    this.head.textContent = `${d.journey ? `On the road to ${d.journey}` : `You are at ${d.atName}`}${fr.length ? ' · ' + fr.join(' · ') : ''}`;
    const pins = this.root.querySelector('.wm-pins')!;
    pins.innerHTML = '';
    const order = { town: 0, property: 1, site: 2, story: 3, here: 4 };
    for (const p of [...d.pins].sort((a, b) => order[a.kind] - order[b.kind])) {
      const el = document.createElement('button');
      el.className = `wm-pin ${p.kind}${p.visited ? ' visited' : ''}${p.cleared ? ' cleared' : ''}`;
      el.style.left = `${p.x * 100}%`; el.style.top = `${p.y * 100}%`;
      el.innerHTML = `<i>${ICON[p.kind]}</i>${p.kind === 'town' ? '' : `<span>${esc(p.name)}</span>`}`;
      el.setAttribute('aria-label', p.name);
      el.onclick = (e) => { e.stopPropagation(); this.show(p); };
      pins.appendChild(el);
    }
    if (d.here) { const h = document.createElement('div'); h.className = 'wm-pin here'; h.style.left = `${d.here.x * 100}%`; h.style.top = `${d.here.y * 100}%`; h.innerHTML = '<i></i>'; pins.appendChild(h); }
    this.applyTransform();
  }

  private show(p: WorldPin) {
    const d = this.data!;
    const here = p.name === d.atName && !d.journey;
    const lvl = p.level ? `<span class="wm-tag">level ${p.level}+</span>` : '';
    const days = !here && p.days !== undefined ? `<span class="wm-tag">${p.days <= 0.5 ? 'half a day' : p.days === 1 ? '1 day' : `${p.days} days`}</span>` : '';
    const st = p.kind === 'town' ? (p.visited ? '<span class="wm-tag">visited</span>' : '<span class="wm-tag">never been</span>') : p.cleared ? '<span class="wm-tag ok">cleared</span>' : '';
    this.card.innerHTML = `<div class="wm-card-h"><b>${esc(p.name)}</b><button class="wm-x" aria-label="Close">✕</button></div><p>${esc(p.blurb ?? '')}</p><div class="wm-tags">${days}${lvl}${st}</div>`;
    const row = document.createElement('div'); row.className = 'wm-actions';
    const btn = (label: string, cmd: string, primary = false) => { const b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'primary'; b.onclick = () => { this.close(); this.send(cmd); }; row.appendChild(b); };
    if (p.kind === 'property') btn('Go there', 'go to my property', true);
    else if (here) { this.card.querySelector('.wm-tags')!.insertAdjacentHTML('beforeend', '<span class="wm-tag ok">you are here</span>'); btn('Explore the area', 'explore'); }
    else btn(d.journey ? 'Change course: travel here' : 'Travel here', `travel to ${p.name}`, true);
    if (d.journey) btn('Continue journey', 'continue');
    this.card.appendChild(row);
    this.card.querySelector<HTMLButtonElement>('.wm-x')!.onclick = () => (this.card.hidden = true);
    this.card.hidden = false;
  }

  // ---------- pan & zoom ----------
  private base() { const w = this.view.clientWidth, h = this.view.clientHeight; const s = Math.max(w / 2048, h / 1536); return { w, h, s }; }
  private layout() { const { s } = this.base(); this.inner.style.width = `${2048 * s}px`; this.inner.style.height = `${1536 * s}px`; this.clamp(); this.applyTransform(); }
  private centreOn(p: { x: number; y: number } | null) {
    const { w, h, s } = this.base();
    if (!p) return;
    this.z = Math.max(this.z, 1.6);
    this.tx = w / 2 - p.x * 2048 * s * this.z; this.ty = h / 2 - p.y * 1536 * s * this.z;
    this.clamp(); this.applyTransform();
  }
  private clamp() {
    const { w, h, s } = this.base();
    this.z = Math.min(5, Math.max(1, this.z));
    const W = 2048 * s * this.z, H = 1536 * s * this.z;
    this.tx = Math.min(0, Math.max(w - W, this.tx)); this.ty = Math.min(0, Math.max(h - H, this.ty));
  }
  private applyTransform() {
    this.inner.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.z})`;
    this.inner.style.setProperty('--inv', String(1 / this.z));
  }
  private zoomAt(f: number, cx: number, cy: number) {
    const z0 = this.z; this.z = Math.min(5, Math.max(1, this.z * f)); const k = this.z / z0;
    this.tx = cx - (cx - this.tx) * k; this.ty = cy - (cy - this.ty) * k;
    this.clamp(); this.applyTransform();
  }
  private bindGestures() {
    const pts = new Map<number, { x: number; y: number }>();
    let lastDist = 0; let moved = 0;
    const v = this.view;
    v.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; lastDist = Math.hypot(a.x - b.x, a.y - b.y); } });
    v.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { try { v.setPointerCapture(e.pointerId); } catch { /* */ } } this.tx += dx; this.ty += dy; this.clamp(); this.applyTransform(); }
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const r = v.getBoundingClientRect(); if (lastDist) this.zoomAt(d / lastDist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); lastDist = d; moved = 99; }
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) lastDist = 0; };
    v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
    v.addEventListener('wheel', (e) => { e.preventDefault(); const r = v.getBoundingClientRect(); this.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    v.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); return; } if (!(e.target as HTMLElement).closest('.wm-pin')) this.card.hidden = true; }, true);
    this.root.querySelector<HTMLImageElement>('.wm-img')!.addEventListener('load', () => { if (!this.root.hidden) this.layout(); });
  }
}

const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
