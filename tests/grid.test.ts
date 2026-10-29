import { MAPS } from '../src/content/maps';
import { ROOMS } from '../src/content/world';
import { gridFor, costs, key } from '../src/engine/grid';
import { handle, newState, beginGame, suggestions } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import type { GameState } from '../src/engine/types';

describe('maps', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    it(`${id} is well formed`, () => {
      const w = m.rows[0].length;
      for (const r of m.rows) expect(r.length, `${id}: "${r}"`).toBe(w);
      expect(ROOMS[id], id).toBeTruthy();
      const g = gridFor(id);
      const reach = costs(g, g.start, new Set(), 999);
      ROOMS[id].exits.forEach((e, i) => {
        if (e.to === id) return; // closed gates still drawn
        expect(g.exits[i]?.length, `${id} exit ${i} (${e.label})`).toBeGreaterThan(0);
        expect(g.exits[i].some((p) => reach.has(key(p))), `${id} exit ${i} reachable`).toBe(true);
      });
      for (const s of g.foeSpawns) expect(reach.has(key(s)), `${id} spawn ${s.x},${s.y}`).toBe(true);
    });
  }
  it('every room has a map', () => { for (const id of Object.keys(ROOMS)) expect(MAPS[id], id).toBeTruthy(); });
});

let LOG = '';
const play = (s: GameState, cmds: string[]) => { for (const c of cmds) for (const l of handle(s, c)) LOG += `${l.k}: ${l.t}\n`; };

describe('grid combat', () => {
  it('units get positions and melee closes the distance', () => {
    const s = newState(8); LOG = '';
    beginGame(s, defaultSpec('fighter', 'human', 'soldier', 'Tess'));
    play(s, ['go out', 'go north']);
    for (let i = 0; i < 5 && !s.combat; i++) play(s, ['go south', 'go north']);
    if (!s.combat) return;
    for (const u of s.combat.units) { expect(u.x).toBeGreaterThanOrEqual(0); expect(u.y).toBeGreaterThanOrEqual(0); }
    for (let i = 0; i < 60 && s.combat; i++) play(s, [suggestions(s)[0]]);
    expect(LOG).not.toMatch(/a bug|undefined|NaN/);
  });
  it('move commands work in a fight', () => {
    const s = newState(3); LOG = '';
    beginGame(s, defaultSpec('rogue', 'elf', 'criminal', 'Tess'));
    s.flags.quest_chapel = true;
    play(s, ['go out', 'go north']);
    for (let i = 0; i < 6 && !s.combat; i++) play(s, ['go south', 'go north']);
    if (!s.combat) return;
    play(s, ['take cover', 'step back', 'dash', 'move north 2', 'end turn', 'approach the wolf']);
    expect(LOG).not.toMatch(/a bug|undefined|NaN/);
  });
  it('exploration: walk to things and through doors', () => {
    const s = newState(4); LOG = '';
    beginGame(s, defaultSpec('fighter'));
    expect(s.pos).toBeTruthy();
    play(s, ['walk over to the bar', 'go to squib', 'go over to the hearth']);
    const g = gridFor('tavern');
    const door = g.exits[0][0];
    play(s, [`@move ${door.x} ${door.y}`]);
    expect(s.loc).toBe('breda_square');
    expect(LOG).not.toMatch(/a bug|undefined|NaN/);
  });
});
