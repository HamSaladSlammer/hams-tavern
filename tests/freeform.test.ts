// "Do whatever you can think of": free-form actions, drinks, props, chaining, and every class/species.
import { handle, newState, beginGame, suggestions } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import { CLASSES, SPECIES, BACKGROUNDS } from '../src/engine/srd';
import type { GameState } from '../src/engine/types';

let LOG = '';
function play(s: GameState, cmds: string[]) {
  for (const cmd of cmds) for (const l of handle(s, cmd)) LOG += `${l.k}${l.who ? `[${l.who}]` : ''}: ${l.t}\n`;
}
function hero(cls = 'fighter', sp = 'human', bg = 'soldier', seed = 5) {
  const s = newState(seed);
  LOG = '';
  for (const l of beginGame(s, defaultSpec(cls, sp, bg, 'Tess'))) LOG += `${l.k}: ${l.t}\n`;
  return s;
}
const clean = () => { expect(LOG).not.toMatch(/a bug/i); expect(LOG).not.toMatch(/undefined|NaN|\[object/); };

describe('the mug Squib hands you', () => {
  it('can be drunk', () => {
    const s = hero();
    expect(s.pc!.inventory.some((x) => x.id === 'mug_ale')).toBe(true);
    play(s, ['drink from the mug']);
    expect(LOG).not.toMatch(/can't|don't have/i);
    expect(s.pc!.inventory.some((x) => x.id === 'mug_ale')).toBe(false);
    expect(s.pc!.inventory.some((x) => x.id === 'mug_empty')).toBe(true);
    expect(s.pc!.drunk).toBeGreaterThan(0);
    clean();
  });
  for (const cmd of ['drink', 'drink it', 'drink the ale', 'drink my beer', 'take a sip of the ale', 'chug the mug', 'down the pint']) {
    it(`"${cmd}" works`, () => {
      const s = hero();
      play(s, [cmd]);
      expect(s.pc!.inventory.some((x) => x.id === 'mug_ale'), LOG).toBe(false);
      clean();
    });
  }
  it('buying another and drinking a lot ends in a blackout, not a crash', () => {
    const s = hero('fighter', 'elf');
    s.pc!.copper = 1000;
    play(s, ['drink', 'buy ale', 'drink it', 'buy trenchfire', 'drink it', 'buy ale', 'drink', 'drink trenchfire', 'drink stout']);
    expect(LOG).toMatch(/Blackout|very drunk|blind drunk|drunk/);
    clean();
  });
  it('the empty mug can be thrown and swung', () => {
    const s = hero();
    play(s, ['drink', 'throw the mug at the wall']);
    expect(LOG).toMatch(/mug/);
    clean();
  });
});

describe('try anything', () => {
  const cmds = [
    'sit on a stool', 'climb onto the table', 'climb the rafters', 'climb down', 'smell the air', 'listen to the whisperers', 'eavesdrop',
    'juggle three mugs', 'pick up a mug', 'break a chair', 'light a candle', 'play cards with the dwarves', 'sing a song', 'pray', 'meditate',
    'lick the bar', 'tickle squib', 'lift a table', 'do push ups', 'carve my name into the table', 'recall what I know about the bell', 'remember the war',
    'look at the window', 'search the floorboards', 'take a fork', 'pet the cat', 'stare into the fire', 'dance on the table', 'pickpocket sereza',
    'flip the table', 'wink at squib', 'do a cartwheel', 'yodel loudly', 'ponder the meaning of life', 'eat', 'buy stew', 'take the mug, drink it, then go outside',
  ];
  for (const cmd of cmds) {
    it(`"${cmd}" gets a real answer`, () => {
      const s = hero('rogue', 'halfling', 'criminal', 13);
      s.pc!.copper = 500;
      LOG = '';
      play(s, [cmd]);
      expect(LOG, LOG).not.toMatch(/I'm not sure what you mean|squints at that/);
      clean();
    });
  }
  it('chained commands all happen', () => {
    const s = hero();
    play(s, ['drink the ale, then go out and read the notice board']);
    expect(s.loc).toBe('breda_square');
    expect(s.flags.quest_chapel).toBe(true);
    clean();
  });
  it('outdoors: forage, pick up a rock, build a fire, cook', () => {
    const s = hero('ranger', 'elf', 'guide', 3);
    play(s, ['go out', 'go north']);
    for (let i = 0; i < 30 && s.combat; i++) play(s, [suggestions(s)[0]]);
    play(s, ['pick up a rock', 'pick up a stick', 'forage', 'build a fire', 'cook an apple', 'climb a tree', 'track', 'drink from the stream']);
    expect(s.pc!.inventory.some((x) => x.id === 'rock')).toBe(true);
    clean();
  });
  it('a chair leg is a weapon in a fight', () => {
    const s = hero('wizard', 'gnome', 'sage', 4);
    play(s, ['break a chair']);
    play(s, ['go out', 'go north']);
    for (let i = 0; i < 40 && s.combat; i++) play(s, [i % 2 ? 'hit it with the chair leg' : 'end turn']);
    clean();
  });
});

describe('every class and species can start and fight', () => {
  for (const k of CLASSES) {
    it(`${k.name} starts`, () => {
      const s = hero(k.id, 'human', 'soldier', 21);
      expect(s.pc!.cls).toBe(k.id);
      play(s, ['sheet', 'inventory', 'go out', 'go north']);
      for (let i = 0; i < 60 && s.combat; i++) play(s, [suggestions(s)[i % 3] ?? 'end turn']);
      clean();
    });
  }
  for (const sp of SPECIES) {
    it(`${sp.name} starts`, () => {
      const bg = BACKGROUNDS[SPECIES.indexOf(sp) % BACKGROUNDS.length].id;
      const k = CLASSES[SPECIES.indexOf(sp) % CLASSES.length].id;
      const s = hero(k, sp.id, bg, 30 + SPECIES.indexOf(sp));
      expect(s.pc!.species).toBe(sp.id);
      expect(s.pc!.hp).toBeGreaterThan(4);
      play(s, ['sheet', sp.power ? sp.power.name.toLowerCase() : 'look', 'drink']);
      clean();
    });
  }
});
