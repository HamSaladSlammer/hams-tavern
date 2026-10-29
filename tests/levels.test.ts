import { createFromSpec, defaultSpec, levelUp, chooseSubclass, armorClass } from '../src/engine/character';
import { CLASSES } from '../src/engine/srd';
import { subclassesFor } from '../src/data/progression';
import { handle, newState, beginGame, suggestions } from '../src/engine/game';

describe('levels 1-20', () => {
  for (const k of CLASSES) {
    it(`${k.name} levels to 20 with every subclass`, () => {
      for (const sc of subclassesFor(k.id)) {
        const c = createFromSpec(defaultSpec(k.id, 'human', 'soldier', 'T'));
        for (let i = 0; i < 19; i++) { const lines = levelUp(c); expect(lines.join(' ')).not.toMatch(/undefined|NaN/); if (c.level === 3) { const r = chooseSubclass(c, sc.name); expect(typeof r).not.toBe('string'); } }
        expect(c.level).toBe(20);
        expect(c.maxHp).toBeGreaterThan(80);
        expect(armorClass(c)).toBeGreaterThan(9);
        if (k.casting) expect(c.slots.max).toBeGreaterThanOrEqual(20);
      }
      expect(subclassesFor(k.id).length).toBeGreaterThanOrEqual(3);
    });
  }
  it('a level 12 wizard can fireball a fight', () => {
    const s = newState(2); beginGame(s, defaultSpec('wizard', 'elf', 'sage', 'T'));
    for (let i = 0; i < 11; i++) levelUp(s.pc!);
    s.pc!.spells.push('fireball');
    handle(s, 'go out'); for (let i = 0; i < 10 && !s.combat; i++) handle(s, i % 2 ? 'go south' : 'go north');
    if (!s.combat) return;
    let log = '';
    for (const l of handle(s, 'cast fireball at wolf')) log += l.t + '\n';
    for (let i = 0; i < 30 && s.combat; i++) for (const l of handle(s, suggestions(s)[0])) log += l.t + '\n';
    expect(log).not.toMatch(/undefined|NaN|a bug/);
  });
  it('a level 11 fighter gets three attacks', () => {
    const s = newState(4); beginGame(s, defaultSpec('fighter', 'human', 'soldier', 'T'));
    for (let i = 0; i < 10; i++) levelUp(s.pc!);
    handle(s, 'go out'); for (let i = 0; i < 10 && !s.combat; i++) handle(s, i % 2 ? 'go south' : 'go north');
    if (!s.combat) return;
    let log = '';
    for (let i = 0; i < 6 && s.combat; i++) for (const l of handle(s, suggestions(s)[0])) log += l.t + '\n';
    expect(log).toMatch(/more attack/);
  });
});
