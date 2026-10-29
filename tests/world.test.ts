import { handle, newState, beginGame, migrate } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import { worldView, discover, ensureRoom } from '../src/world';
import { TOWNS, POIS } from '../src/world/atlas';
import { MONSTERS, ITEMS } from '../src/engine/srd';
import { ROOMS } from '../src/content/world';
import type { GameState } from '../src/engine/types';

let LOG = '';
const play = (s: GameState, cmds: string[]) => { for (const c of cmds) for (const l of handle(s, c)) LOG += `${l.k}${l.who ? `[${l.who}]` : ''}: ${l.t}\n`; };
const fightOut = (s: GameState, n = 150) => {
  for (let i = 0; i < n && s.combat; i++) {
    const foe = s.combat.units.find((u) => u.side === 'foe' && !u.conditions.some((x) => ['dead', 'fled', 'surrendered', 'unconscious'].includes(x)));
    const lines = handle(s, foe ? `attack ${foe.name.toLowerCase()}` : 'end turn');
    for (const l of lines) LOG += `${l.k}: ${l.t}\n`;
    if (s.combat && lines.some((l) => /already used|no movement left|can't reach/.test(l.t))) for (const l of handle(s, 'end turn')) LOG += `${l.k}: ${l.t}\n`;
  }
};
function hero(cls = 'fighter', seed = 7, level = 1) {
  const s = newState(seed); LOG = '';
  beginGame(s, defaultSpec(cls, 'human', 'soldier', 'Vera'));
  if (level > 1) { s.pc!.level = level; s.pc!.maxHp = s.pc!.hp = 12 * level; }
  return s;
}
const clean = () => { expect(LOG).not.toMatch(/a bug/i); expect(LOG).not.toMatch(/undefined|NaN|\[object/); };
const travelTo = (s: GameState, dest: string) => {
  play(s, [`travel to ${dest}`]);
  for (let i = 0; i < 30 && (s.world.journey || s.combat); i++) { if (s.combat) { s.pc!.hp = s.pc!.maxHp; fightOut(s); } if (s.flags.toll_pending) play(s, ['fight']); if (s.world.journey && !s.combat) play(s, ['continue']); }
};

describe('the open world', () => {
  it('every monster and item the world references exists', () => {
    const src = [...Object.values(MONSTERS)].length;
    expect(src).toBeGreaterThan(50);
    for (const id of ['thornling', 'zombie', 'skeleton', 'cultist', 'ghoul', 'drowned_captain', 'vessariel', 'drinker', 'wyrm_adult', 'roll_keeper', 'founding_partner', 'zenu']) expect(MONSTERS[id], id).toBeTruthy();
    for (const id of ['sabre_plus1', 'signet_ring', 'potion_greater', 'webley_revolver', 'pistol_cartridge', 'arisaka_carbine', 'toggle_pistol', 'crown_bond', 'old_vaults_key', 'true_name', 'bell_pattern', 'chisel_of_unmaking', 'parcel', 'greatsword_plus3', 'jade_idol']) expect(ITEMS[id], id).toBeTruthy();
  });

  it('travels from Breda to Brumandell and finds a real town', () => {
    const s = hero('fighter', 3, 5);
    play(s, ['go out']);
    travelTo(s, 'brumandell');
    expect(s.world.at).toBe('brumandell');
    expect(s.loc).toBe('town:brumandell:square');
    expect(LOG).toMatch(/Arrived: Brumandell/);
    play(s, ['go to the inn', 'talk to grog', 'any rumours?']);
    expect(LOG).toMatch(/Grog/);
    play(s, ['shop']);
    clean();
  });

  it('every town can be built and visited', () => {
    const s = hero('fighter', 4, 10);
    for (const t of TOWNS) { ensureRoom(s, t.id === 'breda' ? 'breda_square' : `town:${t.id}:square`); expect(ROOMS[t.id === 'breda' ? 'breda_square' : `town:${t.id}:square`], t.id).toBeTruthy(); }
    play(s, ['go out']);
    travelTo(s, 'suomi');
    expect(s.world.at).toBe('suomi');
    expect(s.world.visited).toContain('suomi');
    clean();
  });

  it('notice board jobs: take one, clear the site, get paid', () => {
    const s = hero('fighter', 21, 6);
    play(s, ['go out']);
    travelTo(s, 'coltale');
    play(s, ['read the notice board']);
    expect(LOG).toMatch(/notices/);
    const before = s.world.found.length;
    const clearJob = s.world.jobs.find((j) => j.town === 'coltale' && !j.taken && j.site);
    const idx = s.world.jobs.filter((j) => j.town === 'coltale' && !j.taken).indexOf(clearJob!) + 1;
    play(s, [`take job ${idx}`]);
    expect(clearJob!.taken).toBe(true);
    expect(s.world.found.length).toBeGreaterThan(before);
    travelTo(s, s.world.sites[clearJob!.site!].name);
    expect(s.loc).toMatch(/^site:/);
    s.pc!.level = 20; s.pc!.maxHp = s.pc!.hp = 300;
    for (let i = 0; i < 12 && !s.world.sites[clearJob!.site!].cleared; i++) { s.pc!.hp = s.pc!.maxHp; fightOut(s); play(s, ['search the chest', 'go deeper']); }
    if (!s.world.sites[clearJob!.site!].cleared) console.log(LOG.split('\n').slice(-60).join('\n'), s.loc);
    expect(s.world.sites[clearJob!.site!].cleared).toBe(true);
    expect(clearJob!.done).toBe(true);
    const cash = s.pc!.copper;
    travelTo(s, 'coltale');
    expect(s.pc!.copper).toBeGreaterThan(cash);
    expect(clearJob!.paid).toBe(true);
    clean();
  });

  it('explore finds new places, and they pin to the map', () => {
    const s = hero('ranger', 9, 3);
    play(s, ['go out']);
    for (let i = 0; i < 6; i++) { play(s, ['explore']); if (s.combat) { s.pc!.hp = s.pc!.maxHp; fightOut(s); } }
    const v = worldView(s);
    expect(v.pins.filter((p) => p.kind === 'site' || p.kind === 'story').length).toBeGreaterThan(0);
    expect(v.pins.filter((p) => p.kind === 'town').length).toBe(19);
    clean();
  });

  it('you can buy a tavern, name it, upgrade it, staff it and earn from it', () => {
    const s = hero('bard', 5, 5);
    s.pc!.copper = 400000;
    play(s, ['go out', 'property for sale', 'buy the tavern']);
    expect(s.world.properties.length).toBe(1);
    expect(s.loc).toMatch(/^prop:/);
    play(s, ['name it The Ham and Fiddle', 'upgrade kitchen', 'upgrade stage', 'hire a barkeep', 'hire a bouncer', 'work the bar']);
    const p = s.world.properties[0];
    expect(p.name).toBe('The Ham And Fiddle');
    expect(p.upgrades).toContain('kitchen');
    expect(p.staff).toContain('barkeep');
    play(s, ['sleep', 'sleep', 'sleep', 'collect']);
    expect(LOG).toMatch(/You empty the strongbox/);
    play(s, ['go out', 'go to my property']);
    expect(s.loc).toBe(`prop:${p.id}`);
    // survives a save/load
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(ROOMS[back.loc]).toBeTruthy();
    clean();
  });

  it('threats advance on their own and Act Two arrives after the chapel', () => {
    const s = hero('cleric', 12, 4);
    s.flags.act1_finale = true; s.flags.bell_silenced = true;
    play(s, ['sleep', 'sleep', 'sleep']);
    expect(s.flags.act2_letter).toBe(true);
    for (const id of ['coltale_memorial', 'largo_bell', 'borschardt_chapel']) expect(s.world.found).toContain(id);
    expect(s.world.fronts.treaty.active).toBe(true);
    for (let i = 0; i < 20; i++) play(s, ['sleep']);
    expect(s.world.fronts.treaty.clock).toBeGreaterThan(0);
    play(s, ['threats']);
    expect(LOG).toMatch(/state of Lahti/);
    clean();
  });

  it('a story site plays through: the Coltale bell', () => {
    const s = hero('paladin', 31, 20);
    s.pc!.maxHp = s.pc!.hp = 400;
    play(s, ['go out']);
    const lines: string[] = [];
    discover({ s, out: () => {}, journal: (t: string) => lines.push(t) } as never, 'coltale_memorial');
    travelTo(s, 'coltale memorial');
    expect(s.loc).toMatch(/^site:coltale_memorial:/);
    for (let i = 0; i < 12 && !s.flags.tower_coltale; i++) { s.pc!.hp = s.pc!.maxHp; fightOut(s); play(s, ['search the chest', 'go deeper']); }
    expect(s.flags.tower_coltale).toBe(true);
    clean();
  });

  it('hire a sellsword in an inn; they fight with you, get paid daily, and can be dismissed', () => {
    const s = hero('wizard', 44, 4);
    s.pc!.copper = 50000;
    play(s, ['hirelings', 'hire a sellsword', 'hire a rifleman', 'hire a brawler']);
    expect(s.world.hires!.length).toBe(2);
    expect(s.companions.length).toBe(2);
    const cash = s.pc!.copper;
    play(s, ['sleep']);
    expect(s.pc!.copper).toBeLessThan(cash);
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(back.world.hires!.length).toBe(2);
    play(s, ['go out']);
    play(s, ['explore', 'explore', 'explore']);
    if (s.combat) expect(s.combat.units.filter((u) => u.side === 'party').length).toBeGreaterThanOrEqual(3);
    fightOut(s);
    play(s, [`dismiss ${s.world.hires![0].name}`]);
    expect(s.world.hires!.length).toBe(1);
    clean();
  });

  it('every POI has a sensible place on the map', () => {
    for (const p of POIS) { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(1); }
  });
});
