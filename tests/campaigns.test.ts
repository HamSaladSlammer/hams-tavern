import { handle, newState, beginGame, migrate } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import { CAMPAIGNS, randomSpec, generate } from '../src/world/campaigns';
import { MONSTERS } from '../src/engine/srd';
import { ROOMS } from '../src/content/world';
import type { GameState } from '../src/engine/types';

let LOG = '';
const play = (s: GameState, cmds: string[]) => { for (const c of cmds) for (const l of handle(s, c)) LOG += `${l.k}: ${l.t}\n`; };
const fightOut = (s: GameState, n = 200) => {
  for (let i = 0; i < n && s.combat; i++) {
    s.pc!.hp = s.pc!.maxHp; const me = s.combat.units.find((u) => u.isPc); if (me) me.hp = me.maxHp;
    const foe = s.combat.units.find((u) => u.side === 'foe' && !u.conditions.some((x) => ['dead', 'fled', 'surrendered', 'unconscious'].includes(x)));
    const lines = handle(s, foe ? `attack ${foe.name.toLowerCase()}` : 'end turn');
    for (const l of lines) LOG += `${l.k}: ${l.t}\n`;
    if (s.combat && lines.some((l) => /already used|no movement left|can't reach/.test(l.t))) for (const l of handle(s, 'end turn')) LOG += `${l.k}: ${l.t}\n`;
  }
};
const clean = () => { expect(LOG).not.toMatch(/a bug/i); expect(LOG).not.toMatch(/undefined|NaN|\[object/); };

/** Play a campaign to the end with a strong hero, chapter by chapter. */
function runCampaign(s: GameState) {
  for (let guard = 0; guard < 12 && !s.world.campaign?.done; guard++) {
    const st = s.world.campaign!;
    const site = s.world.sites[st.sites[st.chapter]];
    play(s, [`travel to ${site.name}`]);
    for (let i = 0; i < 40 && (s.world.journey || s.combat || s.flags.toll_pending); i++) { fightOut(s); if (s.flags.toll_pending) play(s, ['pay the toll']); if (s.world.journey && !s.combat) play(s, ['continue']); }
    for (let i = 0; i < 14 && !site.cleared; i++) { fightOut(s); play(s, ['go deeper']); fightOut(s); }
    if (!site.cleared) console.log(LOG.split("\n").filter((l) => !/Exits:|go deeper|can.t go/.test(l)).slice(-40).join("\n"));
    expect(site.cleared, `${st.title} ch${st.chapter} ${site.name} @ ${s.loc}`).toBe(true);
  }
}

describe('campaigns', () => {
  for (const def of CAMPAIGNS) {
    it(`${def.title} starts in ${def.start} and can be finished`, () => {
      const s = newState(7); LOG = '';
      for (const l of beginGame(s, defaultSpec('paladin', 'human', 'soldier', 'Ser Tess'), { id: def.id })) LOG += `${l.k}: ${l.t}\n`;
      expect(s.world.at).toBe(def.start);
      expect(s.world.campaign?.id).toBe(def.id);
      expect(s.world.found.length).toBeGreaterThan(0);
      s.pc!.level = 20; s.pc!.maxHp = s.pc!.hp = 500;
      runCampaign(s);
      expect(s.world.campaign!.done).toBe(true);
      expect(LOG).toMatch(/the end/);
      clean();
    });
  }
  it('random campaigns are endless and finishable', () => {
    for (let k = 1; k <= 6; k++) {
      const s = newState(100 + k); LOG = '';
      const spec = randomSpec({ state: 999 * k }, 1);
      for (const l of beginGame(s, defaultSpec('fighter', 'orc', 'soldier', 'Grub'), { id: 'random', spec })) LOG += `${l.k}: ${l.t}\n`;
      expect(s.world.campaign?.spec?.villain).toBe(spec.villain);
      s.pc!.level = 20; s.pc!.maxHp = s.pc!.hp = 500;
      runCampaign(s);
      expect(MONSTERS[`villain_gen_${spec.seed}`]).toBeTruthy();
      play(s, ['seek a new adventure']);
      expect(s.world.campaign?.done).toBeFalsy();
      clean();
    }
  });
  it('a custom campaign uses what the player chose, and survives a reload', () => {
    const s = newState(5); LOG = '';
    const spec = { title: 'The Ballad of Me', start: 'galilin', villain: 'Grandmother Wick', villainTitle: 'the Lantern Witch', kind: 'hag', goal: 'rescue' as const, target: 'my little brother', chapters: 3, tone: 'comic' as const, level: 5, seed: 4242 };
    for (const l of beginGame(s, defaultSpec('wizard', 'elf', 'sage', 'Ayla'), { id: 'custom', spec })) LOG += `${l.k}: ${l.t}\n`;
    expect(s.pc!.level).toBe(5);
    expect(s.world.at).toBe('galilin');
    expect(generate(spec).chapters.length).toBe(3);
    expect(LOG).toMatch(/Grandmother Wick/);
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(ROOMS[back.loc]).toBeTruthy();
    play(back, ['campaign']);
    expect(LOG).toMatch(/Chapter 1/);
    clean();
  });
  it('the open road has no story until you ask for one', () => {
    const s = newState(9); LOG = '';
    for (const l of beginGame(s, defaultSpec('rogue', 'halfling', 'criminal', 'Pip'), { id: 'open_road', spec: { ...randomSpec({ state: 3 }, 1), start: 'madsen' } })) LOG += `${l.k}: ${l.t}\n`;
    expect(s.loc).toMatch(/madsen/);
    play(s, ['seek a new adventure', 'campaign']);
    expect(s.world.campaign?.done).toBeFalsy();
    clean();
  });
});
