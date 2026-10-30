import { handle, newState, beginGame } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import type { GameState } from '../src/engine/types';

const run = (s: GameState, cmd: string) => handle(s, cmd).filter((l) => l.k !== 'you');
function hero(seed = 3) { const s = newState(seed); beginGame(s, defaultSpec('bard', 'human', 'soldier', 'Vera')); return s; }

describe('the game master answers instead of echoing', () => {
  const inputs = [
    'I look around for anyone suspicious', 'I wink at the barmaid', "I'm hungry", 'we should go', "that's funny", 'I sit by the fire and sharpen my sword',
    'I write a letter to my mother', 'I stand up and announce I will kill the Pale Queen', 'tell squib my name is Vera', 'ask squib if he has seen any wolves',
    'ask squib where he is from', 'I tell the room a joke', 'I clean my gun', "I'm tired", 'I practice my sword forms', 'ask the minstrel to play a song',
  ];
  for (const t of inputs) {
    it(`"${t}" gets a real response`, () => {
      const s = hero();
      const out = run(s, t);
      const text = out.map((l) => l.t).join(' ');
      expect(out.length).toBeGreaterThan(0);
      // not just "You <what I typed>."
      expect(text.trim().toLowerCase()).not.toBe(`you ${t.toLowerCase().replace(/^i /, '')}.`);
      expect(text.split(/\s+/).length).toBeGreaterThan(5);
      expect(text).not.toMatch(/undefined|NaN|\[object|a bug/);
    });
  }
  it('unnamed people in a crowd become real when you talk to them', () => {
    const s = hero();
    const a = run(s, 'talk to the barmaid');
    expect(a.some((l) => l.k === 'say')).toBe(true);
    const name = a.find((l) => l.k === 'say')!.who!;
    const b = run(s, 'what is your name?');
    expect(b.map((l) => l.t).join(' ')).toContain(name);
    run(s, 'go out');
    expect(run(s, 'talk to the barmaid').map((l) => l.t).join(' ')).toMatch(/nobody|isn't|There's/i);
  });
  it('people answer directions with real travel times', () => {
    const s = hero();
    run(s, 'talk to squib');
    const t = run(s, 'where is Brumandell?').map((l) => l.t).join(' ');
    expect(t).toMatch(/day/);
  });
});
