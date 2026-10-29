// The battle grid: parsing room maps, movement, line of sight, cover and range. Squares are 5 ft.
import { MAPS, HIDDEN_EXIT_TILES, type MapDef } from '../content/maps';

export interface Pt { x: number; y: number }
export interface Grid {
  id: string;
  w: number;
  h: number;
  tiles: string[]; // one char per square, npc letters and spawns replaced by floor
  raw: string[];
  start: Pt;
  foeSpawns: Pt[];
  compSpawns: Pt[];
  npcSpots: Record<string, Pt>;
  exits: Record<number, Pt[]>;
  dark: boolean;
  def: MapDef;
}

const BLOCK = new Set('#=TBbHPASgrtwCKNFcL;'.split(''));
const COVER = new Set('TBbPASgrwCKNs;'.split(''));
const OPAQUE = new Set('#t'.split(''));

const cache: Record<string, Grid> = {};

const DEFAULT_MAP: MapDef = { rows: ['##########', '#........#', '#..x..x..#', '#........#', '#...@k...#', '#........#', '####0#####'] };

export function gridFor(loc: string): Grid {
  if (cache[loc]) return cache[loc];
  const def = MAPS[loc] ?? DEFAULT_MAP;
  const raw = def.rows;
  const h = raw.length;
  const w = Math.max(...raw.map((r) => r.length));
  const outdoors = raw.join('').includes(',') || raw.join('').includes('"');
  const floorCh = def.floor ?? (outdoors ? (raw.join('').includes(',') ? ',' : '"') : '.');
  const g: Grid = { id: loc, w, h, tiles: [], raw, start: { x: 1, y: 1 }, foeSpawns: [], compSpawns: [], npcSpots: {}, exits: {}, dark: !!def.dark, def };
  const hidden = HIDDEN_EXIT_TILES[loc] ?? {};
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      let ch = raw[y][x] ?? '#';
      if (ch === '@') { g.start = { x, y }; ch = floorCh; }
      else if (ch === 'x') { g.foeSpawns.push({ x, y }); ch = floorCh; }
      else if (ch === 'k') { g.compSpawns.push({ x, y }); ch = floorCh; }
      else if (def.npcs?.[ch]) { g.npcSpots[def.npcs[ch]] = { x, y }; ch = floorCh; }
      else if (/[0-9]/.test(ch)) { (g.exits[Number(ch)] ??= []).push({ x, y }); }
      for (const [idx, tch] of Object.entries(hidden)) if (ch === tch) (g.exits[Number(idx)] ??= []).push({ x, y });
      row += ch;
    }
    g.tiles.push(row);
  }
  cache[loc] = g;
  return g;
}

export const tile = (g: Grid, p: Pt) => (p.x < 0 || p.y < 0 || p.x >= g.w || p.y >= g.h ? '#' : g.tiles[p.y][p.x]);
export const inBounds = (g: Grid, p: Pt) => p.x >= 0 && p.y >= 0 && p.x < g.w && p.y < g.h;
export const blocksMove = (ch: string) => BLOCK.has(ch);
export const givesCover = (ch: string) => COVER.has(ch);
export const opaque = (ch: string) => OPAQUE.has(ch);
export const dist = (a: Pt, b: Pt) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const feet = (a: Pt, b: Pt) => dist(a, b) * 5;
export const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
export const key = (p: Pt) => `${p.x},${p.y}`;
export function exitAt(g: Grid, p: Pt): number | null {
  for (const [i, pts] of Object.entries(g.exits)) if (pts.some((q) => same(q, p))) return Number(i);
  return null;
}

/** Squares on the line between a and b, excluding both ends (Bresenham). */
export function lineBetween(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = [];
  let x0 = a.x, y0 = a.y;
  const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 200; i++) {
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    if (x0 === b.x && y0 === b.y) break;
    out.push({ x: x0, y: y0 });
  }
  return out;
}

export function hasLOS(g: Grid, a: Pt, b: Pt): boolean {
  return !lineBetween(a, b).some((p) => opaque(tile(g, p)));
}

/** Half cover (+2 AC) if furniture or another creature sits between attacker and target. */
export function coverBonus(g: Grid, from: Pt, to: Pt, creatures: Pt[] = []): number {
  if (dist(from, to) <= 1) return 0;
  const line = lineBetween(from, to).filter((p) => dist(p, from) > 1 || dist(from, to) === 2);
  if (line.some((p) => givesCover(tile(g, p)))) return 2;
  if (line.some((p) => creatures.some((c) => same(c, p)))) return 2;
  return 0;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Movement cost to enter a square, in squares (water costs 2). Infinity if blocked. */
function cost(g: Grid, p: Pt, occupied: Set<string>): number {
  const ch = tile(g, p);
  if (blocksMove(ch) || occupied.has(key(p))) return Infinity;
  return ch === '~' ? 2 : 1;
}

/** Dijkstra over 8 directions. Returns cost map (in squares) from `from`. */
export function costs(g: Grid, from: Pt, occupied: Set<string>, max = 40): Map<string, { c: number; prev: string | null }> {
  const best = new Map<string, { c: number; prev: string | null }>();
  best.set(key(from), { c: 0, prev: null });
  const q: [Pt, number][] = [[from, 0]];
  while (q.length) {
    q.sort((a, b) => a[1] - b[1]);
    const [p, c0] = q.shift()!;
    if (c0 > max) continue;
    if ((best.get(key(p))?.c ?? Infinity) < c0) continue;
    for (const [dx, dy] of DIRS) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (!inBounds(g, n)) continue;
      // no cutting corners around walls
      if (dx && dy && (blocksMove(tile(g, { x: p.x + dx, y: p.y })) && blocksMove(tile(g, { x: p.x, y: p.y + dy })))) continue;
      const step = cost(g, n, occupied);
      if (step === Infinity) continue;
      const nc = c0 + step;
      if (nc < (best.get(key(n))?.c ?? Infinity)) { best.set(key(n), { c: nc, prev: key(p) }); q.push([n, nc]); }
    }
  }
  return best;
}

export function pathTo(map: Map<string, { c: number; prev: string | null }>, to: Pt): Pt[] {
  const out: Pt[] = [];
  let k: string | null = key(to);
  if (!map.has(k)) return [];
  while (k) { const [x, y] = k.split(',').map(Number); out.unshift({ x, y }); k = map.get(k)!.prev; }
  return out.slice(1);
}

/** Best square to stand on to be within `reach` squares of target, reachable from `from`. */
export function approachSquare(g: Grid, from: Pt, target: Pt, reach: number, occupied: Set<string>, needLOS = false): { dest: Pt; cost: number } | null {
  if (dist(from, target) <= reach && (!needLOS || hasLOS(g, from, target))) return { dest: from, cost: 0 };
  const map = costs(g, from, occupied);
  let best: { dest: Pt; cost: number } | null = null;
  for (const [k, v] of map) {
    const [x, y] = k.split(',').map(Number);
    const p = { x, y };
    if (dist(p, target) > reach || (needLOS && !hasLOS(g, p, target))) continue;
    if (!best || v.c < best.cost || (v.c === best.cost && dist(p, target) > dist(best.dest, target))) best = { dest: p, cost: v.c };
  }
  return best;
}

/** A free square near p (for placing units). */
export function freeNear(g: Grid, p: Pt, occupied: Set<string>): Pt {
  if (!blocksMove(tile(g, p)) && !occupied.has(key(p))) return p;
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inBounds(g, q)) continue;
      if (!blocksMove(tile(g, q)) && !occupied.has(key(q)) && exitAt(g, q) === null) return q;
    }
  }
  return p;
}

/** Squares visible from p within radius (in squares). */
export function visibleFrom(g: Grid, p: Pt, radius: number): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const q = { x, y };
    if (dist(p, q) > radius) continue;
    if (same(p, q) || hasLOS(g, p, q)) out.add(key(q));
  }
  return out;
}

/** Name for the thing on a tile, for tap menus and narration. */
export const TILE_NAMES: Record<string, string> = {
  '#': 'wall', '=': 'window', T: 'table', B: 'bar', s: 'stool', b: 'barrel', H: 'fire', P: 'pew', A: 'altar', c: 'candles', S: 'sarcophagus', g: 'gravestone',
  t: 'tree', r: 'boulder', w: 'well', C: 'cart', K: 'shelves', N: 'anvil', F: 'forge', L: 'bell rope', '^': 'stairs', ':': 'rubble', '~': 'water', ';': 'sheep',
};
