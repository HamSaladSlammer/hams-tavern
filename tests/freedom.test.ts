import { handle, newState, beginGame, suggestions } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import type { GameState } from '../src/engine/types';

let LOG = '';
const play = (s: GameState, cmds: string[]) => { for (const c of cmds) for (const l of handle(s, c)) LOG += `${l.k}${l.who ? `[${l.who}]` : ''}: ${l.t}\n`; };
const fight = (s: GameState, cmd: string, n = 80) => { for (let i = 0; i < n && s.combat; i++) play(s, [cmd]); };
function hero(cls = 'fighter', seed = 7) { const s = newState(seed); LOG = ''; beginGame(s, defaultSpec(cls, 'orc', 'soldier', 'Tess')); return s; }
const clean = () => { expect(LOG).not.toMatch(/a bug/i); expect(LOG).not.toMatch(/undefined|NaN|\[object/); };

describe('player freedom', () => {
  it('a tavern brawl with the dwarves is a brawl, not a massacre', () => {
    const s = hero();
    play(s, ['punch borin']);
    expect(s.combat).toBeNull();
    expect(LOG).toMatch(/Do it again/);
    play(s, ['punch borin']);
    expect(s.combat).toBeTruthy();
    expect(s.combat!.units.filter((u) => u.side === 'foe').length).toBe(4);
    fight(s, 'punch borin');
    fight(s, 'punch odo'); fight(s, 'punch marrik'); fight(s, 'punch tokk');
    expect(s.flags.dwarves_dead).toBeFalsy();
    clean();
  });
  it('you can murder Garrick, and the militia come for you', () => {
    const s = hero('fighter', 11);
    s.pc!.level = 5; s.pc!.maxHp = s.pc!.hp = 60;
    play(s, ['go out', 'go goods', 'attack garrick', 'attack garrick']);
    expect(s.combat).toBeTruthy();
    fight(s, 'attack garrick');
    play(s, ['finish garrick']);
    fight(s, 'attack garrick');
    expect(s.bounty).toBeGreaterThan(0);
    play(s, ['go out']);
    for (let i = 0; i < 6 && !s.flags.militia_confront && !s.combat; i++) play(s, ['go goods', 'go out']);
    if (s.flags.militia_confront) { play(s, ['come quietly']); expect(s.bounty).toBe(0); }
    clean();
  });
  it('shoplifting works or gets you caught', () => {
    const s = hero('rogue', 5);
    play(s, ['go out', 'go goods', 'steal a crowbar', 'steal the rope', 'pocket a torch']);
    expect(LOG).toMatch(/pack|THIEF|Put it back/);
    clean();
  });
  it('robbing someone with threats', () => {
    const s = hero('fighter', 3);
    play(s, ['go out', 'go goods', 'intimidate garrick into handing over the till money']);
    expect(LOG).toMatch(/hands it over|scare/);
    clean();
  });
  it('you can work instead of questing', () => {
    const s = hero();
    const before = s.pc!.copper;
    play(s, ['work', 'go out', 'go smithy', 'work']);
    expect(s.pc!.copper).toBeGreaterThan(before);
    clean();
  });
  it('the east farms and the south road are open', () => {
    const s = hero('cleric', 9);
    play(s, ['go out', 'go east', 'talk to merla', 'ask merla about aldwin', 'ask merla about rest', 'go barn', 'look', 'go out', 'go west', 'go south', 'look', 'hunt wolves']);
    fight(s, suggestions(s)[0] ?? 'end turn', 1);
    for (let i = 0; i < 60 && s.combat; i++) play(s, [suggestions(s)[0]]);
    expect(LOG).toMatch(/Thatch|South Road/);
    clean();
  });
  it('you can join the cult', () => {
    const s = hero();
    s.loc = 'tower'; s.pos = null; s.talkingTo = 'merah';
    play(s, ['can I join you?']);
    expect(s.flags.cult_joined).toBe(true);
    clean();
  });
});
