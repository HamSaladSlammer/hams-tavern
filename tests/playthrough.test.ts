// Scripted, headless playthroughs of Act One. A player who keeps trying should always be able to finish.
import { handle, newState, suggestions } from '../src/engine/game';
import type { GameState } from '../src/engine/types';

let LOG = '';
function play(s: GameState, cmds: string[]) {
  for (const cmd of cmds) for (const l of handle(s, cmd)) LOG += `${l.k}${l.who ? `[${l.who}]` : ''}: ${l.t}\n`;
}

function fightOut(s: GameState, prefer?: string, max = 80) {
  for (let i = 0; i < max && s.combat; i++) {
    const sug = suggestions(s);
    const hp = s.pc!.hp / s.pc!.maxHp;
    let pick = sug[0];
    if (hp < 0.35 && sug.includes('drink potion')) pick = 'drink potion';
    else if (hp < 0.5 && sug.includes('second wind')) pick = 'second wind';
    else if (prefer) pick = sug.find((x) => x.startsWith(prefer)) ?? sug[0];
    play(s, [pick]);
  }
}

/** Keep trying something until a flag is set — like a stubborn player. */
function until(s: GameState, flag: string, attempt: () => void, tries = 8) {
  for (let i = 0; i < tries && !s.flags[flag]; i++) attempt();
  expect(s.flags[flag], LOG.slice(-3000)).toBeTruthy();
}

function makeHero(cls: string, species = 'human', bg = 'soldier', seed = 42) {
  const s = newState(seed);
  LOG = '';
  play(s, ['New game', 'Tess', species, cls, bg, 'begin']);
  return s;
}

function walkTo(s: GameState, target: string) {
  const routes: Record<string, string[]> = {
    tavern: ['go tavern'],
    chapel_yard: ['go chapel path'],
  };
  play(s, routes[target] ?? []);
}

describe('character creation', () => {
  for (const cls of ['fighter', 'rogue', 'monk', 'wizard', 'cleric']) {
    it(`creates a ${cls}`, () => {
      const s = makeHero(cls);
      expect(s.phase).toBe('play');
      expect(s.pc!.cls).toBe(cls);
      expect(s.pc!.hp).toBeGreaterThan(5);
      expect(s.loc).toBe('tavern');
    });
  }
});

const RUNS: [string, string, string, number][] = [
  ['fighter', 'human', 'soldier', 1], ['wizard', 'elf', 'sage', 7], ['monk', 'goliath', 'acolyte', 3], ['rogue', 'halfling', 'criminal', 11], ['cleric', 'dwarf', 'acolyte', 5],
  ['fighter', 'orc', 'soldier', 99], ['wizard', 'tiefling', 'soldier', 123], ['monk', 'dragonborn', 'criminal', 77],
];

describe('Act One playthrough', () => {
  for (const [cls, sp, bg, seed] of RUNS) {
    it(`${sp} ${cls} (${bg}) can finish the chapel`, () => {
      const s = makeHero(cls, sp, bg, seed);
      const prefer = cls === 'monk' ? 'punch' : undefined;
      play(s, ['ask about the bell', 'ask about the dog', 'ask about potion', 'go out', 'read notice board', 'go north']);
      fightOut(s, prefer);
      if (s.loc === 'breda_square') { play(s, ['go north']); fightOut(s, prefer); }
      play(s, ['search charms', 'go north', 'search font', 'search font', 'wear robe']);
      until(s, 'cleared_yard', () => { if (s.loc !== 'chapel_yard') play(s, ['short rest', 'go chapel path']); else play(s, ['go down', 'go chapel path']); fightOut(s, prefer); });
      play(s, ['take the ewe', 'short rest']);
      until(s, 'cleared_nave', () => { if (s.loc === 'kessels_rest') play(s, ['short rest', 'go chapel path']); fightOut(s, prefer); play(s, ['go in']); fightOut(s, prefer); });
      until(s, 'vestry_open', () => play(s, [s.pc!.inventory.some((x) => x.id === 'thieves_tools') ? 'pick the vestry lock' : 'kick the vestry door']), 20);
      play(s, ['go vestry', 'open chest', 'read letter', 'go out']);
      until(s, 'lever_found', () => play(s, ['search the altar']), 20);
      play(s, ['pull lever', 'go down', 'high five alistair', 'ask alistair who he is', 'join me', 'search sarcophagi', 'go up']);
      expect(s.companions, LOG.slice(-2000)).toContain('alistair');
      until(s, 'tower_open', () => play(s, ['kick the tower door']), 20);
      until(s, 'chapel_done', () => {
        if (s.loc === 'kessels_rest') play(s, ['short rest', 'go chapel path', 'go in']);
        play(s, ['short rest', 'go tower', 'attack merah']);
        fightOut(s, prefer);
        if (s.flags.merah_surrendered && !s.flags.merah_gone && !s.flags.merah_dead) play(s, ['spare merah']);
        play(s, ['cut the bell rope']);
      });
      expect(s.flags.bell_silenced, LOG.slice(-2000)).toBe(true);
      play(s, ['go down', 'go out', 'go down', 'go main trail', 'go back', 'go south']);
      for (let i = 0; i < 4 && s.loc !== 'breda_square'; i++) { fightOut(s, prefer); play(s, ['go south']); }
      fightOut(s, prefer);
      play(s, ['go tavern', 'persuade squib he acts on his own', 'persuade squib he acts on his own', 'talk to squib', 'sleep']);
      expect(s.flags.chapel_paid, LOG.slice(-3000)).toBe(true);
      expect(s.flags.act1_finale, LOG.slice(-2000)).toBe(true);
      expect(s.pc!.level, LOG.slice(-2000)).toBe(2);
      expect(LOG).not.toMatch(/a bug/i);
      expect(LOG).not.toMatch(/undefined|NaN|\[object/);
    });
  }
});

describe('social and profanity reactions', () => {
  it('Squib bans you after two insults, and an apology can fix it', () => {
    const s = makeHero('fighter', 'orc', 'soldier', 9);
    play(s, ['fuck you squib']);
    expect(LOG).toMatch(/Once/);
    play(s, ['squib, you bastard']);
    expect(s.npc.squib.banned).toBe(true);
    play(s, ['buy ale']);
    expect(LOG).toMatch(/won't serve/);
  });
  it('an exclamation does not offend Squib', () => {
    const s = makeHero('fighter');
    play(s, ['oh shit']);
    expect(LOG).toMatch(/doesn't blink/);
    expect(s.npc.squib.insults).toBe(0);
  });
  it('dwarves love swearing', () => {
    const s = makeHero('fighter');
    play(s, ['talk to the dwarves', 'hell yeah']);
    expect(LOG).toMatch(/roar with approval/);
  });
  it('free-form questions route to the right topic', () => {
    const s = makeHero('fighter');
    play(s, ["what's with the barrel?", 'seriously, the barrel', 'come on, tell me about the barrel']);
    expect(LOG).toMatch(/Don't ask about the barrel/);
    expect(LOG).toMatch(/That was asking about the barrel/);
  });
  it('Hetch objects to language', () => {
    const s = makeHero('fighter');
    play(s, ['go out', 'go tailor', 'hello hetch', 'damn, nice shop']);
    expect(LOG).toMatch(/Language/);
  });
});
