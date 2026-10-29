// Seeded RNG and dice. The RNG state lives in the save so a reloaded game rolls the same.

export interface Rng {
  state: number;
}

/** mulberry32 — small, fast, good enough for dice. Mutates rng.state. */
export function next(rng: Rng): number {
  let t = (rng.state = (rng.state + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function die(rng: Rng, sides: number): number {
  return 1 + Math.floor(next(rng) * sides);
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(next(rng) * arr.length)];
}

export interface DiceResult {
  expr: string;
  rolls: number[];
  mod: number;
  total: number;
}

/** Parse and roll "2d6+3", "1d8", "d20", "4", "1d4+1d6+2". */
export function roll(rng: Rng, expr: string, critDouble = false): DiceResult {
  const clean = expr.replace(/\s+/g, '').toLowerCase();
  const parts = clean.match(/[+-]?[^+-]+/g) ?? ['0'];
  const rolls: number[] = [];
  let mod = 0;
  let total = 0;
  for (const raw of parts) {
    const sign = raw.startsWith('-') ? -1 : 1;
    const p = raw.replace(/^[+-]/, '');
    const m = p.match(/^(\d*)d(\d+)$/);
    if (m) {
      let n = m[1] ? parseInt(m[1], 10) : 1;
      if (critDouble) n *= 2;
      const s = parseInt(m[2], 10);
      for (let i = 0; i < n; i++) {
        const r = die(rng, s);
        rolls.push(r);
        total += sign * r;
      }
    } else {
      const v = parseInt(p, 10) || 0;
      mod += sign * v;
      total += sign * v;
    }
  }
  return { expr, rolls, mod, total };
}

export type Adv = 'adv' | 'dis' | 'none';

export interface D20 {
  natural: number;
  rolls: number[];
  adv: Adv;
}

export function d20(rng: Rng, adv: Adv = 'none'): D20 {
  const a = die(rng, 20);
  if (adv === 'none') return { natural: a, rolls: [a], adv };
  const b = die(rng, 20);
  const natural = adv === 'adv' ? Math.max(a, b) : Math.min(a, b);
  return { natural, rolls: [a, b], adv };
}

export function combineAdv(a: boolean, d: boolean): Adv {
  if (a && !d) return 'adv';
  if (d && !a) return 'dis';
  return 'none';
}

export function mod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
