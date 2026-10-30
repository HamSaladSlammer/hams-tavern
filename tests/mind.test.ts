import { handle, newState, beginGame, rollResponse } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import type { GameState } from '../src/engine/types';
import { randomSpec } from '../src/world/campaigns';

const run = (s: GameState, cmd: string) => handle(s, cmd).filter((l) => l.k !== 'you');
const text = (l: { t: string }[]) => l.map((x) => x.t).join(' ');
function hero(cls = 'rogue', seed = 3) { const s = newState(seed); beginGame(s, defaultSpec(cls, 'human', 'criminal', 'Vera')); return s; }

describe('you roll your own checks', () => {
  it('asks for the roll instead of rolling it', () => {
    const s = hero(); s.rollMode = 'you';
    const a = run(s, 'I lie to Squib and say I am a crown agent');
    expect(a.some((l) => l.k === 'ask' && /Deception/.test(l.t))).toBe(true);
    expect(a.some((l) => l.k === 'roll')).toBe(false);
    expect(s.pendingRoll?.ask.label).toBe('Deception');
    const b = run(s, '18');
    expect(b.find((l) => l.k === 'roll')!.t).toMatch(/Deception: 18 /);
    expect(s.pendingRoll).toBeNull();
  });
  it('the game can roll for you when you say "roll"', () => {
    const s = hero(); s.rollMode = 'you';
    run(s, 'I hide under a table');
    const b = run(s, 'roll');
    expect(b.some((l) => l.k === 'roll' && /Stealth/.test(l.t))).toBe(true);
  });
  it('a number on the die has to be a real d20 result', () => {
    const s = hero(); s.rollMode = 'you';
    run(s, 'I juggle three mugs');
    expect(text(run(s, '25'))).toMatch(/1 to 20/);
    expect(s.pendingRoll).toBeTruthy();
    expect(text(run(s, 'cancel'))).toMatch(/better of it|let it go|second thoughts/);
    expect(s.pendingRoll).toBeNull();
  });
  it('doing something else lets the roll go', () => {
    const s = hero(); s.rollMode = 'you';
    run(s, 'I juggle three mugs');
    const b = run(s, 'look');
    expect(text(b)).toMatch(/let the Performance roll go/);
    expect(text(b)).toMatch(/Smoking Barrel/);
  });
  it('nothing happens to the world until you roll', () => {
    const s = hero(); s.rollMode = 'you';
    const money = s.pc!.copper;
    run(s, 'I try to pick a pocket');
    expect(s.pc!.copper).toBe(money);
    run(s, '20 20');
    expect(s.pc!.copper).toBeGreaterThan(money);
  });
  it('reads what players type', () => {
    const ask = { kind: 'skill' as const, label: 'Stealth', bonus: 3, adv: 'none' as const };
    expect(rollResponse('14', ask)).toEqual([14]);
    expect(rollResponse('I rolled a 7', ask)).toEqual([7]);
    expect(rollResponse('nat 20', ask)).toEqual([20]);
    expect(rollResponse('roll', ask)).toBe('auto');
    expect(rollResponse('never mind', ask)).toBe('cancel');
    expect(rollResponse('0', ask)).toBe('bad');
    expect(rollResponse('I go outside', ask)).toBeNull();
    expect(rollResponse('9 and 15', { ...ask, adv: 'adv' })).toEqual([9, 15]);
  });
  it('automatic mode still rolls for you', () => {
    const s = hero(); s.rollMode = 'auto';
    expect(run(s, 'I hide under a table').some((l) => l.k === 'roll')).toBe(true);
  });
});

describe('doing things calls for the right check', () => {
  const cases: [string, RegExp][] = [
    ['I try to pick a pocket', /Sleight of hand/], ['I climb onto the roof beams', /Athletics/], ['I intimidate Squib', /Intimidation/], ['I try to tell if Squib is lying', /Insight/],
    ['I read the dwarves\' body language', /Insight/], ['I look for hidden doors', /Investigation/], ['I search for traps', /Perception/], ['I try to calm the dog', /Animal handling/],
    ['I steal a bottle from behind the bar', /Sleight of hand/], ['I persuade Squib to give me a free drink', /Persuasion/],
  ];
  for (const [t, re] of cases) it(`"${t}"`, () => { const s = hero(); const out = run(s, t); expect(out.find((l) => l.k === 'roll')?.t ?? '').toMatch(re); });
  it('touching the barrel above the hearth is not allowed', () => {
    const s = hero();
    expect(text(run(s, 'I try to lift the barrel above the hearth'))).toMatch(/Mind the barrel/);
  });
});

describe('people react to what you say', () => {
  it('remembers your name and uses it', () => {
    const s = hero();
    run(s, 'talk to squib'); run(s, 'my name is Vera');
    expect((s.npc.squib as { claims?: Record<string, string> }).claims?.name).toBe('Vera');
  });
  it('Squib answers a Greymarch veteran in his own way', () => {
    const s = hero();
    run(s, 'talk to squib');
    expect(text(run(s, 'I fought at Greymarch'))).toMatch(/Then you know/);
  });
  it('a lie about the bell gets caught out', () => {
    const s = hero();
    run(s, 'talk to squib');
    expect(text(run(s, 'I silenced the bell'))).toMatch(/last night|ring/);
  });
  it('people you have insulted stop answering properly', () => {
    const s = hero();
    run(s, 'talk to the dwarves');
    s.npc.dwarves.disposition = -4; s.npc.dwarves.insults = 3;
    expect(text(run(s, 'where are you from?'))).toMatch(/business|Why do you want|likes you/);
  });
  it('opinions come from who they are', () => {
    const s = hero();
    run(s, 'talk to the dwarves');
    const out = text(run(s, 'what do you think of the cult?'));
    expect(out).toMatch(/candle|grieving|racket|more of them|cult|Bellwax/i);
  });
  it('groups get plural verbs', () => {
    const s = hero('rogue', 9);
    run(s, 'talk to the dwarves');
    for (let i = 0; i < 6; i++) expect(text(run(s, 'I read the dwarves\' body language'))).not.toMatch(/They (likes|doesn't|trusts|isn't)|The dwarves (holds|looks)/);
  });
  it('asking the room gets several different answers', () => {
    const s = hero();
    const out = run(s, 'I ask around about the bells').filter((l) => l.k === 'say');
    expect(out.length).toBeGreaterThan(1);
    expect(new Set(out.map((l) => l.t)).size).toBe(out.length);
  });
  it('you can talk to a town innkeeper by name', () => {
    const s = newState(5);
    beginGame(s, defaultSpec('fighter', 'human', 'soldier', 'Vera'), { id: 'open_road', spec: { ...randomSpec({ state: 7 }, 1), start: 'brumandell' } });
    run(s, 'go inn');
    expect(text(run(s, 'talk to grog'))).not.toMatch(/nobody called/);
    expect(s.talkingTo).toBe('brumandell_keeper');
  });
  it('thanks and apologies go to the person you are talking to', () => {
    const s = hero();
    run(s, 'talk to the dwarves');
    expect(text(run(s, 'thanks for your help'))).not.toMatch(/nobody called/);
  });
});
