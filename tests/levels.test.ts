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

import { createFromSpec as cfs, defaultSpec as ds, hasFeat as hf } from '../src/engine/character';
describe('custom origins', () => {
  it('a custom background gives chosen abilities, skills, feat and tool', () => {
    const s = ds('rogue', 'human', 'soldier', 'Ilka');
    s.background = 'custom';
    s.customBg = { name: 'Coltale Gravedigger', abilities: ['con', 'wis', 'dex'], skills: ['religion', 'medicine'], feat: 'skilled', tool: 'Herbalism kit' };
    s.boost = { plus2: 'dex', plus1: 'con', even: false };
    s.featSkills = ['history', 'nature', 'arcana'];
    const base = s.base.dex;
    const c = cfs(s);
    expect(c.abilities.dex).toBe(Math.min(20, base + 2));
    for (const k of ['religion', 'medicine', 'history', 'nature', 'arcana'] as const) expect(c.skills).toContain(k);
    expect(c.customBg?.name).toBe('Coltale Gravedigger');
    expect(c.tools).toContain('Herbalism kit');
    expect(hf(c, 'skilled')).toBe(true);
  });
  it('a custom lineage gives +2, a second feat, and darkvision or a skill', () => {
    const s = ds('wizard', 'custom_lineage', 'sage', 'Nyx');
    s.variant = 'skill';
    s.lineage = { plus2: 'int', feat: 'alert', skill: 'stealth', size: 'Small' };
    const c = cfs(s);
    expect(hf(c, 'alert')).toBe(true);
    expect(hf(c, 'magic_wizard')).toBe(true);
    expect(c.skills).toContain('stealth');
  });
});
