import { rollExpr, d20Of } from '../src/ui/dice';
describe('dice tray', () => {
  it('rolls expressions', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollExpr('2d6+3')!;
      expect(r.dice.length).toBe(2);
      expect(r.total).toBeGreaterThanOrEqual(5); expect(r.total).toBeLessThanOrEqual(15);
    }
    const a = rollExpr('roll d20 adv')!;
    expect(a.dice.length).toBe(2);
    expect(a.dice.filter((d) => d.kept).length).toBe(1);
    expect(a.total).toBe(Math.max(...a.dice.map((d) => d.value)));
    expect(rollExpr('/roll 1d100')!.total).toBeLessThanOrEqual(100);
    expect(rollExpr('banana')).toBeNull();
  });
  it('reads the game\'s d20s', () => {
    expect(d20Of('🎲 Perception: 14 +3 = 17 vs DC 12 — success')).toEqual({ value: 14, outcome: 'success' });
    expect(d20Of('🎲 Longsword vs Zombie: d20 10 +6 = 16 vs AC 8 — hit')?.value).toBe(10);
    expect(d20Of('🎲 Stealth: (3,17) 17 +2 = 19 vs DC 10 — success')?.value).toBe(17);
    expect(d20Of('💥 10 slashing damage.')).toBeNull();
  });
});
