import { handle, newState, beginGame, peek } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import type { GameState } from '../src/engine/types';
import { FACTS, ENTITY, findEntities, knows, knowerFor, askKind, topicOf, directions } from '../src/lore';
import { poiById } from '../src/world/atlas';
import { runEval } from '../scripts/eval';

const run = (s: GameState, cmd: string) => handle(s, cmd).filter((l) => l.k !== 'you');
const text = (l: { t: string }[]) => l.map((x) => x.t).join(' ');
function hero(seed = 3) { const s = newState(seed); beginGame(s, defaultSpec('bard', 'human', 'soldier', 'Vera')); return s; }

describe('the lore tables', () => {
  it('has a big, well-formed fact library', () => {
    expect(FACTS.length).toBeGreaterThan(500);
    const ids = new Set<string>();
    for (const f of FACTS) {
      expect(ids.has(f.id)).toBe(false); ids.add(f.id);
      for (const a of f.about) expect(ENTITY[a], `${f.id} → ${a}`).toBeTruthy();
      if (f.reveals) expect(poiById(f.reveals), f.id).toBeTruthy();
      expect(f.text).not.toMatch(/swampfoot|ignatius|branik|hamuel|jimothy|githyanki/i);
    }
  });
  it('finds the most specific name in what you type', () => {
    expect(findEntities('tell me about the Treaty Stone')[0].id).toBe('treaty_stone');
    expect(findEntities('who is Queen Elisiah?')[0].id).toBe('elisiah');
    expect(findEntities('have you heard of the green candles')[0].id).toBe('cult');
    expect(findEntities('can I get a room?')).toEqual([]);
  });
  it('knows who would know what', () => {
    const coltale = FACTS.find((f) => f.scope === 'local:coltale')!;
    expect(knows(knowerFor('coltale_keeper', () => null)!, coltale, () => false)).toBe(true);
    expect(knows(knowerFor('x:town:nagant:inn:pot-boy:1', () => 'nagant')!, coltale, () => false)).toBe(false);
    const secret = FACTS.find((f) => f.scope === 'secret' && f.knownBy?.includes('squib'))!;
    expect(knows(knowerFor('squib', () => null)!, secret, () => true)).toBe(true);
    expect(knows(knowerFor('smith', () => null)!, secret, () => true)).toBe(false);
  });
  it('keeps spoilers locked behind story flags', () => {
    const z = FACTS.filter((f) => f.about.includes('zenu'));
    expect(z.every((f) => !!f.needs)).toBe(true);
  });
  it('reads the shape of a question', () => {
    expect(askKind('where is Greymarch?')).toBe('where');
    expect(askKind('how do I get there?')).toBe('where');
    expect(askKind('tell me more')).toBe('more');
    expect(askKind('I fought at Greymarch')).toBe('statement');
    expect(topicOf('what else?', 'coltale')?.id).toBe('coltale');
    expect(topicOf('nice weather', null)).toBeNull();
  });
  it('gives directions from where you stand', () => {
    expect(directions('greymarch', 'breda')).toMatch(/of here/);
    expect(directions('suomi', 'suomi')).toMatch(/standing in it/);
  });
});

describe('people answer from the lore', () => {
  it('Squib tells you about the Treaty Stone and pins it', () => {
    const s = hero();
    const out = run(s, 'ask squib about the treaty stone');
    expect(text(out)).toMatch(/grolgar|elisiah|offerings|border/i);
    expect(s.world?.found).toContain('treaty_stone');
    expect(s.loreKnown?.length).toBeGreaterThan(0);
  });
  it('"what else" carries on about the same thing without repeating', () => {
    const s = hero();
    const a = text(run(s, 'tell me about Coltale'));
    const b = text(run(s, 'what else?'));
    expect(b).toMatch(/coltale|memorial|garrison|harbour|fish|salt/i);
    expect(b).not.toBe(a);
  });
  it('the journal remembers what you have learned', () => {
    const s = hero();
    run(s, 'tell me about Bellwax');
    expect(text(peek(s, 'journal'))).toMatch(/What you've learned/);
  });
  it('you can try to recall things yourself', () => {
    const s = hero();
    const out = run(s, 'what do I know about the war?');
    expect(text(out)).toMatch(/What you know|surfaces|bell|nothing/i);
  });
  it('Squib will not be drawn on Greymarch', () => {
    const s = hero();
    const out = text(run(s, 'tell me about Greymarch Field'));
    expect(out.length).toBeGreaterThan(10);
    expect(out).not.toMatch(/undefined/);
  });
});

describe('the game master report card', () => {
  it('stays well above the pre-lore baseline', () => {
    const { summary } = runEval();
    expect(summary.errors).toBe(0);
    expect(summary.relevantPct!).toBeGreaterThanOrEqual(85);
    expect(summary.genericPct).toBeLessThanOrEqual(12);
    expect(summary.echoPct).toBeLessThanOrEqual(3);
  }, 60000);
});
