// Player freedom. Anyone can be fought, robbed or crossed, and the world answers instead of
// saying no: militia, bounties, bans, grudges, and people who are simply gone afterwards.
// The main quest is optional; Breda has work, cards, side roads and other troubles.
import type { Ctx, EncounterDef, Npc, Room } from './types';
import { ROOMS } from './world';
import { NPCS } from './npcs';
import { MONSTERS, ITEMS } from '../engine/srd';
import { die, pick } from '../engine/dice';
import { hasItem, removeItem, fmtMoney } from '../engine/character';
import { gridFor } from '../engine/grid';
import { lastFight } from '../engine/combat';

const BREDA = new Set(['breda_square', 'tavern', 'goods', 'smithy', 'tailor', 'east_farms', 'thatch_barn', 'south_road']);
export const inBreda = (c: Ctx) => BREDA.has(c.s.loc);

/** Which monster stands in for each townsperson, and who else gets involved. */
const FIGHTERS: Record<string, { foes: [string, number][]; names?: string[]; lethalAllies?: [string, number][]; allyNames?: string[] }> = {
  squib: { foes: [['squib', 1]], lethalAllies: [['road_dwarf', 2]], allyNames: ['Borin', 'Odo'] },
  dwarves: { foes: [['road_dwarf', 4]], names: ['Borin', 'Odo', 'Marrik', 'Tokk'], lethalAllies: [['squib', 1]], allyNames: ['Squib'] },
  whisperers: { foes: [['window_scout', 4]], names: ['Faelar', 'Ithren', 'Nix', 'Vetch'], lethalAllies: [['squib', 1]], allyNames: ['Squib'] },
  sereza: { foes: [['sereza', 1]], lethalAllies: [['squib', 1]], allyNames: ['Squib'] },
  garrick: { foes: [['garrick', 1]] },
  smith: { foes: [['smith', 1]] },
  hetch: { foes: [['hetch', 1]] },
  doss: { foes: [['doss', 1]] },
  merla: { foes: [['merla', 1]] },
};
const MONSTER_NPC: Record<string, string> = { squib: 'squib', road_dwarf: 'dwarves', window_scout: 'whisperers', sereza: 'sereza', garrick: 'garrick', smith: 'smith', hetch: 'hetch', doss: 'doss', merla: 'merla', militia: 'militia', sergeant: 'sergeant', aldwin: 'aldwin' };
const LOOT: Record<string, { cp: number; items?: string[]; note?: string }> = {
  squib: { cp: 2400, items: ['black_label'], note: 'Behind the bar: the till, a black bottle, and a stretcher-bearer\'s armband from Greymarch, folded small.' },
  dwarves: { cp: 900, items: ['mug_stout'] },
  whisperers: { cp: 400, items: ['silvered_dagger'] },
  sereza: { cp: 7500, items: ['potion_healing'], note: 'In her coat: crown-minted gold, and a letter: "Payment for the Breda account. Keep the old faith away from the bell. — S." The seal is a crowned sun, scraped half off.' },
  garrick: { cp: 800 },
  smith: { cp: 600, items: ['warhammer'] },
  hetch: { cp: 300, note: 'Under the counter, a little silver bell on a ribbon. A collar. Someone loved him once.' },
  doss: { cp: 120, items: ['potion_healing'] },
  merla: { cp: 60 },
};

const deadKey = (id: string) => `${id}_dead`;
export const isDead = (c: Ctx, id: string) => !!c.flag(deadKey(id));

/** Rooms ask this so the dead stay gone. */
export function aliveFilter(c: Ctx, ids: string[]) { return ids.filter((id) => !isDead(c, id)); }

function addBounty(c: Ctx, cp: number, why: string) {
  if (!inBreda(c)) return;
  c.s.bounty += cp;
  c.bad(`The Breda militia will want you for this. (Bounty: ${fmtMoney(c.s.bounty)}.)`);
  c.journal(`Breda wants you: ${why}. Bounty ${fmtMoney(c.s.bounty)}.`);
}

/** Someone attacked a townsperson. The first time, they get a chance to back down. */
export function attackNpc(c: Ctx, np: Npc, raw: string): boolean {
  const low = raw.toLowerCase();
  if (np.id === 'kettle') {
    if (c.flag('confirm_kettle')) {
      c.narr('Kettle yelps, more surprised than hurt, and backs away from you with his ears flat. Then he turns and runs, all the way back to Breda, to Squib.');
      c.s.companions = c.s.companions.filter((x) => x !== 'kettle'); c.set('kettle_left'); c.npc('squib').disposition -= 3;
      c.journal('You hurt Kettle. He ran home to Squib. Squib will have heard.');
      return true;
    }
    c.set('confirm_kettle'); c.narr('Kettle looks up at you, tail slowing, not understanding. (Do it again if you mean it.)'); return true;
  }
  const f = FIGHTERS[np.id];
  if (!f) return false;
  if (c.npc(np.id).banned && np.id === 'squib' && false) return false;
  const lethal = !/\b(punch|kick|slap|headbutt|tackle|brawl|fist|fists|knee|elbow|shove|wrestle|knock (him|her|them)? ?out|knock out|subdue|beat up|bitch slap|smack|sock|deck|jab|uppercut|hook)\b/.test(low) && !/\bwith (a |my |the )?(mug|bottle|stool|chair|chair leg|fist|hands)\b/.test(low);
  const ck = `confirm_attack_${np.id}`;
  const armed = (c.pc.equipped.main && lethal) ? ITEMS[c.pc.equipped.main]?.name.toLowerCase() : null;
  if (c.flag(ck) !== c.s.minutes) {
    c.set(ck, c.s.minutes);
    const warn: Record<string, string> = {
      squib: lethal ? 'Squib sees your hand go to your weapon. The whole room sees it. He puts the mug down. "Think very carefully," he says, very softly.' : 'Squib looks at your fists, then at you, with something almost like amusement. "Go on, then."',
      dwarves: lethal ? 'Four dwarves stop laughing at once. Borin\'s hand finds the mace under the table.' : 'Borin\'s face splits into an enormous grin. "Oh, YES." Tokk is already taking his coat off.',
      whisperers: 'Four chairs scrape back at once. These are old soldiers, and they sit facing the door for a reason.',
      sereza: 'Sereza doesn\'t look up. "I\'d reconsider," she says, and you realise one of her hands is no longer on the table.',
      garrick: 'Garrick goes white and holds up his ledger like a shield. "Now, now, now. Let\'s talk about this. I have discounts!"',
      smith: 'Mother Dreyse sets down the tongs and picks up the big hammer. She doesn\'t say anything. She doesn\'t need to.',
      hetch: 'Every pin in the shop lifts an inch off the table and turns, slowly, toward you. Hetch\'s tail goes still.',
      doss: 'Doss squints at you. "EH? What\'re you doing with your face?" He hasn\'t understood. He will.',
      merla: 'Merla grabs the pitchfork from the wall. "Not him. You won\'t touch him."',
    };
    c.narr(warn[np.id] ?? `${np.name} sees it coming.`);
    c.sys(lethal ? `(Do it again to start the fight. ${armed ? `You'll be using your ${armed}: people can die.` : 'This one could be lethal.'} Punch or kick for a brawl instead.)` : '(Do it again to start the brawl. Fists, mugs and chairs: people get knocked out, not killed.)');
    return true;
  }
  c.set(ck, -1);
  const foes: [string, number][] = [...f.foes];
  const names: string[] = [...(f.names ?? f.foes.map(([m, n]) => (n === 1 ? MONSTERS[m].name : '')).filter(Boolean))];
  const npcIds = [np.id];
  const alive = (id: string) => !isDead(c, id) && (ROOMS[c.s.loc]?.npcs?.(c) ?? []).includes(id);
  if (lethal && f.lethalAllies && c.s.loc === 'tavern') {
    for (const [m, n] of f.lethalAllies) {
      const nid = MONSTER_NPC[m];
      if (!alive(nid) || nid === np.id) continue;
      foes.push([m, n]); npcIds.push(nid);
    }
    names.push(...(f.allyNames ?? []));
    c.narr(np.id === 'squib' ? 'Borin and Odo come over the table with their mugs still in their hands.' : 'Squib vaults the bar. For a man that size, it is a terrible thing to see.');
  }
  const g = gridFor(c.s.loc);
  const spawnAt: Record<string, { x: number; y: number }> = {};
  for (const [m] of foes) { const nid = MONSTER_NPC[m]; if (g.npcSpots[nid]) spawnAt[m] = g.npcSpots[nid]; }
  const enc: EncounterDef = {
    id: `fight_${np.id}_${c.s.minutes}`, foes, unitNames: names.length >= foes.reduce((a, [, n]) => a + n, 0) ? names : undefined, spawnAt, npcIds,
    nonlethal: !lethal, intro: lethal ? `${np.name === 'the dwarves' ? 'The dwarves' : np.name} ${np.id === 'garrick' ? 'screams for the militia' : 'comes for you'}. This is real.` : 'A brawl! Somebody whoops. Somebody else moves the good bottles.',
    fleeTo: 'breda_square',
    onWin: (cc) => afterFight(cc, npcIds, lethal),
    onLose: (cc) => lostFight(cc, np, lethal),
  };
  if (lethal && inBreda(c)) addBounty(c, 1000, `assault on ${np.name}`);
  for (const id of npcIds) c.npc(id).disposition -= lethal ? 5 : 1;
  c.fight(enc);
  return true;
}

function afterFight(c: Ctx, npcIds: string[], lethal0: boolean) {
  const lethal = lethal0 || !!c.flag('brawl_escalated');
  if (!lethal0 && lethal) addBounty(c, 1000, 'drawing steel in a brawl');
  c.set('brawl_escalated', false);
  const units = lastFight.units.filter((u) => u.side === 'foe');
  for (const id of npcIds) {
    const mine = units.filter((u) => MONSTER_NPC[u.monster ?? ''] === id);
    if (!mine.length) continue;
    const allDead = mine.every((u) => u.conditions.includes('dead'));
    const anyDead = mine.some((u) => u.conditions.includes('dead'));
    const np = NPCS[id];
    if (allDead) {
      c.set(deadKey(id));
      const L = LOOT[id];
      c.narr(`${np?.name ?? id} ${id === 'dwarves' || id === 'whisperers' ? 'are' : 'is'} dead.`);
      if (L) { c.money(L.cp); for (const it of L.items ?? []) c.give(it); c.good(`You take ${fmtMoney(L.cp)}${L.items?.length ? ` and ${L.items.map((x) => ITEMS[x]?.name).join(', ')}` : ''}.`); if (L.note) c.narr(L.note); }
      if (id === 'sereza') c.journal('You killed Sereza Harrow. She carried crown gold and orders to keep the old faith away from the bell.');
      if (id === 'squib') { c.journal('You killed Squib. The Smoking Barrel is dark. Nobody in Breda will forget it.'); c.s.chaos = Math.min(9, c.s.chaos + 1); }
      if (inBreda(c)) addBounty(c, 5000, `the murder of ${np?.name ?? id}`);
      if (c.hasCompanion('kettle') && id === 'squib') { c.narr('Kettle lies down next to Squib and will not get up. When you leave, he doesn\'t follow.'); c.s.companions = c.s.companions.filter((x) => x !== 'kettle'); }
      if (c.hasCompanion('alistair')) c.say('alistair', pick(c.rng, ['"Brother," Alistair says quietly. "Brother, that was a lot."', '"Okay. Okay. We\'re doing murder now. I\'m... adjusting."', '"I\'ve been dead a long time and that still felt like a choice."']));
    } else {
      if (anyDead) c.narr(`Not all of ${np?.name ?? id} got up again.`);
      const m = c.npc(id);
      if (!lethal) {
        if (id === 'dwarves') { m.disposition += 2; c.narr('The dwarves pick themselves up off the floor, bleeding and delighted. Borin hugs you. "BEST. NIGHT. IN. MONTHS." Odo orders a round for the house, on you.'); c.pay(Math.min(c.pc.copper, 40)); }
        else if (id === 'squib') { m.disposition += 1; c.narr('Squib gets up slowly, works his jaw, and spits a tooth into his hand. He looks at it. Then he laughs, once, like a barrel dropping. "Good hands." He pours you a drink and charges you for the chair.'); c.give('mug_ale'); c.s.lastObject = 'mug'; }
        else { m.disposition -= 2; c.narr(`${np?.name ?? id} comes round on the floor, groaning, and won't look at you.`); if (['garrick', 'smith', 'hetch'].includes(id)) { m.banned = true; c.say(id, `"Out. Get out of my shop."`); } }
      } else {
        m.disposition = -5; m.banned = true;
        c.narr(`${np?.name ?? id} ${id === 'dwarves' || id === 'whisperers' ? 'scramble' : 'scrambles'} away from you, bleeding, ${pick(c.rng, ['and runs for the militia', 'shouting for help', 'begging'])}.`);
        if (id === 'garrick') { c.money(800); c.good('Garrick empties the till into your hands to make you stop. (+8 gp)'); addBounty(c, 1000, 'robbing Garrick'); }
      }
    }
  }
}

function lostFight(c: Ctx, np: Npc, lethal0: boolean) {
  const lethal = lethal0 || !!c.flag('brawl_escalated');
  c.set('brawl_escalated', false);
  c.advance(60);
  if (!lethal) {
    c.narr(pick(c.rng, ['You come to on the cobbles outside with a split lip and no memory of the last punch.', 'Somebody pours a bucket of water over you. You\'re outside. Your ribs are making a noise.']));
    if (np.id === 'dwarves') { c.narr('Borin sticks his head out of the door. "Good fight! Come back when you can see straight!"'); c.npc('dwarves').disposition += 1; }
    if (np.id === 'squib') c.say('squib', 'Squib leans in the doorway. "Come back tomorrow. Bring better hands."');
    if (inBreda(c) && c.s.loc !== 'breda_square') c.move('breda_square', { quiet: false });
    return;
  }
  // a lethal fight in town you lost: the militia lock you up
  if (inBreda(c)) {
    const fine = Math.min(c.pc.copper, c.s.bounty || 1000);
    c.pc.copper -= fine;
    c.advance(24 * 60);
    c.narr(`You wake in the militia lockup under the north gate, chained to a ring in the wall. A day goes by. Sergeant Voss takes ${fmtMoney(fine)} from your purse "for the damages" and lets you out with a look you won't forget.`);
    c.s.bounty = 0;
    c.s.loc = 'breda_square'; c.s.pos = null;
    return;
  }
  c.narr('You wake on cold ground, robbed, alive. Whoever beat you didn\'t bother to finish the job.');
  c.pc.copper = Math.floor(c.pc.copper / 2);
}

// ---------- the militia ----------
export function militiaCheck(c: Ctx) {
  if (c.s.bounty <= 0 || !inBreda(c) || c.s.combat) return;
  const day = Math.floor((c.s.minutes + 480) / 1440);
  if (c.flag('militia_waved') === day || c.flag('militia_confront')) return;
  if (isDead(c, 'sergeant') && die(c.rng, 3) > 1) return;
  if (die(c.rng, 3) === 1 && c.s.loc !== 'breda_square') return;
  c.set('militia_confront', true);
  c.out('title', 'The militia');
  c.narr(`${isDead(c, 'sergeant') ? 'Three' : 'Two'} militia with spears ${isDead(c, 'sergeant') ? 'block your way, nervous, no sergeant to tell them what to do' : 'and Sergeant Voss, sword drawn, block your way'}. "${c.s.bounty >= 5000 ? 'Murderer' : 'You'}. ${c.s.bounty >= 5000 ? 'Hands where I can see them.' : `There's a matter of ${fmtMoney(c.s.bounty)}.`}"`);
  c.sys(`Pay the bounty (${fmtMoney(c.s.bounty)}), come quietly, talk your way out, run, or fight.`);
}

export function militiaRespond(c: Ctx, raw: string): boolean {
  if (!c.flag('militia_confront') || c.s.combat) return false;
  const low = raw.toLowerCase();
  const day = Math.floor((c.s.minutes + 480) / 1440);
  const done = () => c.set('militia_confront', false);
  if (/^(pay|pay (the )?(bounty|fine)|pay them|i'?ll pay|settle)/.test(low)) {
    if (c.pc.copper >= c.s.bounty) { c.pay(c.s.bounty); c.good(`You pay ${fmtMoney(c.s.bounty)}. Voss counts it twice. "Don't make me come looking again."`); c.s.bounty = 0; done(); return true; }
    c.narr(`You don't have ${fmtMoney(c.s.bounty)}.`); return true;
  }
  if (/^(surrender|come quietly|give up|i surrender|go quietly|hands up|put (my|your) hands up|turn myself in)/.test(low)) {
    done();
    const fine = Math.min(c.pc.copper, Math.floor(c.s.bounty / 2));
    c.pc.copper -= fine; c.advance(c.s.bounty >= 5000 ? 3 * 24 * 60 : 24 * 60);
    c.narr(`They walk you to the lockup under the north gate. ${c.s.bounty >= 5000 ? 'Three days' : 'A day'} in the dark, ${fine ? `${fmtMoney(fine)} lighter` : 'and nothing left to take'}. When they let you out, Voss says only: "Breda remembers."`);
    c.s.bounty = 0; c.s.loc = 'breda_square'; c.s.pos = null;
    return true;
  }
  const social = /^(persuade|convince|talk|reason|explain|plead|beg|lie|bluff|deceive|trick|intimidate|threaten|bribe|scare)/.test(low) || /\b(wasn't me|self.?defen[cs]e|mistake|misunderstanding|you've got the wrong)\b/.test(low);
  if (social) {
    done();
    const bribe = /bribe/.test(low);
    const sk = /lie|bluff|deceive|trick|wasn't me|wrong/.test(low) ? 'deception' : /intimidate|threaten|scare/.test(low) ? 'intimidation' : 'persuasion';
    const dc = (c.s.bounty >= 5000 ? 18 : 13) + (bribe ? -3 : 0);
    if (bribe) { const b = Math.min(c.pc.copper, Math.ceil(c.s.bounty / 3)); c.pay(b); c.narr(`You press ${fmtMoney(b)} into the sergeant's hand.`); }
    if (c.check(sk as 'persuasion', dc)) { c.set('militia_waved', day); if (sk === 'intimidation') c.s.bounty += 500; c.narr(sk === 'intimidation' ? 'The militia look at each other, then at your face, and find somewhere else to be. Voss will remember this.' : bribe ? 'Voss pockets the coin. "I didn\'t see you today." The bounty stands, but not today.' : 'Voss lowers his sword, slowly. "Fine. Today. Don\'t make me regret it."'); return true; }
    c.narr('Voss isn\'t having it. "Get them."');
    militiaFight(c); return true;
  }
  if (/^(run|flee|escape|leg it|bolt|scram|get out of here|run away)/.test(low)) {
    done();
    if (c.check('athletics', 13)) { c.set('militia_waved', day); c.narr('You duck under a spear and run, through a market stall and over a wall. Behind you, Voss is shouting. You lose them in the alleys.'); return true; }
    c.narr('A spear shaft catches your ankle. You go down hard.');
    militiaFight(c); return true;
  }
  done();
  c.narr('You try to ignore them. That goes about as well as you\'d expect.');
  militiaFight(c);
  return true;
}

function militiaFight(c: Ctx) {
  const voss = !isDead(c, 'sergeant');
  const foes: [string, number][] = voss ? [['sergeant', 1], ['militia', 2]] : [['militia', 3]];
  c.fight({
    id: `militia_${c.s.minutes}`, foes, intro: 'The militia close in, spears levelled.', fleeTo: 'breda_square',
    onWin: (cc) => {
      const u = lastFight.units.filter((x) => x.side === 'foe');
      const killed = u.filter((x) => x.conditions.includes('dead')).length;
      if (u.some((x) => x.monster === 'sergeant' && x.conditions.includes('dead'))) { cc.set('sergeant_dead'); cc.journal('You killed Sergeant Voss. Breda has no one left who knows how to fight.'); }
      if (killed) addBounty(cc, 2500 * killed, `killing ${killed} of the militia`);
      else { cc.s.bounty += 500; cc.narr('The militia limp away to lick their wounds. They\'ll be back, with more friends.'); }
    },
    onLose: (cc) => { cc.narr('Spear butts, boots, then the dark.'); lostFightLockup(cc); },
  });
}

function lostFightLockup(c: Ctx) {
  const fine = Math.min(c.pc.copper, c.s.bounty);
  c.pc.copper -= fine; c.advance(2 * 24 * 60);
  c.narr(`You wake in the lockup. Two days. ${fmtMoney(fine)} gone "for the bounty". They let you go because the cells are needed for the dead the bell keeps bringing.`);
  c.s.bounty = 0; c.s.loc = 'breda_square'; c.s.pos = null;
}

// ---------- shoplifting and robbery ----------
export function shoplift(c: Ctx, name: string): boolean {
  const r = ROOMS[c.s.loc];
  if (!r?.shop) return false;
  const owner = NPCS[r.shop];
  const list = owner?.shop ?? [];
  const n = name.toLowerCase();
  const si = list.find((x) => { const it = ITEMS[x.id]; return it && (it.name.toLowerCase().includes(n) || n.includes(it.name.toLowerCase()) || it.aliases?.some((a) => a === n || n.includes(a)) || x.id.replace(/_/g, ' ').includes(n)); });
  if (!si) return false;
  const it = ITEMS[si.id];
  if (isDead(c, owner.id)) { c.give(si.id, it.kind === 'ammo' ? 20 : 1); c.narr(`Nobody's left to stop you. You take the ${it.name.toLowerCase()}.`); return true; }
  const dc = (owner.id === 'hetch' ? 18 : owner.id === 'squib' ? 16 : owner.id === 'smith' ? 14 : 12) + Math.min(6, Math.floor(it.price / 2000));
  if (c.check('sleight of hand', dc, { adv: c.pc.cls === 'rogue' })) {
    c.give(si.id, it.kind === 'ammo' ? 10 : 1);
    c.good(`The ${it.name.toLowerCase()} goes into your pack. Nobody saw. ${owner.id === 'hetch' ? 'Probably. Hetch\'s ear twitches.' : ''}`);
    c.set(`stole_${owner.id}`, ((c.flag(`stole_${owner.id}`) as number) || 0) + 1);
    return true;
  }
  const m = c.npc(owner.id);
  m.disposition -= 3; m.banned = true;
  c.say(owner.id, owner.id === 'garrick' ? '"THIEF! THIEF! Militia! I have a SIGN!"' : owner.id === 'smith' ? 'A hand like a vice closes on your wrist. "Put. It. Back." You put it back.' : owner.id === 'hetch' ? 'A hundred pins pin your sleeve to the counter. "I think not."' : '"Put it back."');
  addBounty(c, Math.max(200, it.price * 2), `stealing from ${owner.name}`);
  return true;
}

export function robbery(c: Ctx, np: Npc): boolean {
  const DC: Record<string, number> = { garrick: 11, doss: 10, merla: 12, smith: 18, squib: 25, hetch: 20, sereza: 19, dwarves: 22, whisperers: 18 };
  if (!(np.id in DC)) return false;
  if (c.check('intimidation', DC[np.id])) {
    const cp = np.id === 'garrick' ? 800 : np.id === 'sereza' ? 2500 : np.id === 'smith' ? 400 : 60 + die(c.rng, 100);
    c.money(cp); c.npc(np.id).disposition = -5;
    c.narr(`${np.name} hands it over with shaking hands: ${fmtMoney(cp)}. ${np.id === 'sereza' ? '"You\'ll regret this," she says, and means it.' : ''}`);
    addBounty(c, 1000, `robbing ${np.name}`);
    return true;
  }
  c.narr(np.id === 'squib' ? 'Squib looks at you for a long moment, then laughs. It\'s not a nice laugh. "No."' : `${np.name} doesn't scare that easily.`);
  c.npc(np.id).disposition -= 2;
  return true;
}

// ---------- odd jobs ----------
const JOBS: Record<string, { npc: string; text: string; skill: 'athletics' | 'performance' | 'animal handling' | 'survival' | 'investigation'; dc: number; pay: number }> = {
  tavern: { npc: 'squib', text: 'You wash mugs, haul two kegs up from the cellar, and throw out a drunk who is mostly grateful.', skill: 'athletics', dc: 10, pay: 20 },
  smithy: { npc: 'smith', text: 'You work the bellows for Mother Dreyse until your shoulders burn and the iron sings.', skill: 'athletics', dc: 12, pay: 25 },
  goods: { npc: 'garrick', text: 'You stock shelves and count nails while Garrick tells you about his cousin\'s business ventures.', skill: 'investigation', dc: 10, pay: 15 },
  tailor: { npc: 'hetch', text: 'You hold pins, fetch bolts of wool and are told, repeatedly, that you are doing it wrong.', skill: 'investigation', dc: 13, pay: 20 },
  foothills: { npc: 'doss', text: 'You help Doss move the flock to the high pasture, shouting at sheep and being ignored by them.', skill: 'animal handling', dc: 11, pay: 15 },
  east_farms: { npc: 'merla', text: 'You dig turnips and mend a fence while Merla works beside you without saying much.', skill: 'athletics', dc: 10, pay: 15 },
};

export function work(c: Ctx): boolean {
  const j = JOBS[c.s.loc];
  if (!j) { c.narr(ROOMS[c.s.loc]?.outdoors ? 'There\'s no one out here to pay you. You could forage, or hunt.' : 'There\'s no work here.'); return true; }
  if (isDead(c, j.npc)) { c.narr('There\'s nobody left here to pay you.'); return true; }
  if (c.npc(j.npc).banned || c.npc(j.npc).disposition <= -3) { c.say(j.npc, '"Not from you."'); return true; }
  const day = Math.floor((c.s.minutes + 480) / 1440);
  if (c.flag(`worked_${c.s.loc}`) === day) { c.narr(`${NPCS[j.npc]?.name ?? 'They'} has nothing else for you today.`); return true; }
  c.set(`worked_${c.s.loc}`, day);
  c.advance(4 * 60);
  const ok = c.check(j.skill, j.dc);
  const pay = ok ? j.pay + die(c.rng, 10) : Math.floor(j.pay / 2);
  c.narr(j.text);
  c.money(pay);
  c.good(`Four hours' work: ${fmtMoney(pay)}${ok ? '' : ' (you were slow, and got paid like it)'}.`);
  c.npc(j.npc).disposition += ok ? 1 : 0;
  return true;
}

// ---------- the cult ----------
export function joinCult(c: Ctx) {
  if (c.flag('cult_joined')) { c.say('merah', '"You already serve. Ring it with me, at midnight."'); return; }
  c.set('cult_joined');
  c.say('merah', 'Merah\'s face opens like a window. "Oh." She takes your hands; hers are rope-burned and very cold. "Then you\'ll ring with me. Every midnight, a little more. And when the new moon comes, carry the candles south, to the wetlands. Z will want to meet you."');
  c.give('cult_candle', 3);
  c.narr('She ties a bone charm into your hair with careful fingers, the way you\'d dress a child for a festival.');
  c.good('You have joined the Bell-Ringers of the Pale Queen.');
  c.journal('You swore yourself to the Pale Queen\'s bell-ringers. Merah asks you to ring the bell at midnight, and carry the candles south to the wetlands at the new moon.');
  if (c.hasCompanion('alistair')) { c.say('alistair', 'Alistair\'s skull turns slowly toward you. "Brother. Brother, she\'s the one who woke ME up." A long pause. "...I\'m still coming. Somebody has to keep an eye on you."'); }
  c.s.chaos = Math.min(9, c.s.chaos + 1);
}

export function cultFinale(c: Ctx) {
  c.set('act1_finale');
  c.out('title', 'Midnight');
  c.narr('You dream of the bell. You are ringing it, and the rope is warm in your hands, and every toll goes down and down into the dark under Lahti like a stone into a well.');
  c.narr('At the bottom of the well, a woman in a crown opens her eyes. She is beautiful, and patient, and she knows your name. "Thank you," she says. "Little candle. I remember you now."');
  c.narr('In Breda, Squib wakes in the dark and can\'t say why he\'s afraid.');
  c.out('title', 'End of Act One — the Bell-Ringer\'s road');
  c.sys('Thank you for playing Hams Tavern. You took the other road: the cult will remember, and so will everyone else. The wetlands and the new moon are the next version.');
  c.journal('Act One complete, the other way: you rang for Her Majesty, and she remembers you.');
}

// ---------- side roads: the east farms and the south road ----------
const merla: Npc = {
  id: 'merla', name: 'Merla Thatch', names: ['merla', 'merla thatch', 'farmer', 'woman', 'wife', 'mrs thatch'],
  short: 'a farmer who put up the notice about her missing husband',
  look: () => 'A broad, tired woman with soil to the elbows and a pitchfork never far from her hand. She keeps glancing at the barn.',
  greet: (c) => {
    if (isDead(c, 'aldwin')) { c.say('merla', c.flag('aldwin_rested') ? '"You gave him back his rest." She doesn\'t smile, but something in her face unknots. "Thank you."' : '"You killed him." She says it flatly. "He was already dead. I know. You still killed him."'); return; }
    c.say('merla', c.npc('merla').met ? '"You again." She doesn\'t put the pitchfork down.' : '"If you\'re here about the notice, he\'s found." She says it too fast. "Aldwin\'s found. He\'s home. He\'s resting. In the barn." Her knuckles are white on the pitchfork.');
  },
  topics: [
    { id: 'aldwin', keys: ['aldwin', 'husband', 'found', 'notice', 'missing', 'barn', 'not right'], chip: 'Ask about Aldwin', say: (c) => {
      if (isDead(c, 'aldwin')) { c.say('merla', '"He\'s in the ground now. Properly. I dug it myself."'); return; }
      c.say('merla', '"He walked out a month ago, on the night the bell started. Came back four nights later." She looks at the barn. "He doesn\'t eat. He doesn\'t sleep. He doesn\'t breathe. But he knows me. He KNOWS me." Her voice cracks. "The militia would burn him. Please. Don\'t tell them."');
      if (!c.flag('quest_aldwin')) { c.set('quest_aldwin'); c.journal('Aldwin Thatch came home dead and walking. Merla keeps him chained in the barn at the east farms. The militia would burn him. What you do about it is up to you.'); c.good('Quest: Not Right (the Thatch farm).'); }
    } },
    { id: 'pay', keys: ['reward', 'pay', '25', 'gold', 'money'], say: (c) => c.say('merla', '"The notice said twenty-five. He\'s found, so I suppose I owe it." She looks at you hard. "I\'ll pay it twice over if nobody else ever hears about him."') },
    { id: 'rest', keys: ['rest', 'put him down', 'end it', 'kill him', 'release', 'mercy', 'let him go', 'bury'], chip: 'Offer to give him rest', say: (c) => {
      if (c.npc('merla').disposition >= 1 || c.check('persuasion', 13)) {
        c.say('merla', 'She\'s quiet for a long time. "He wouldn\'t want this," she says at last. "He hated being cold." She leans the pitchfork against the wall. "Do it gently. Let me say goodbye first."');
        c.set('merla_consents');
      } else c.say('merla', '"No. NO. Get off my land."');
    } },
    { id: 'bell', keys: ['bell', 'chapel', 'midnight'], say: (c) => c.say('merla', '"He stands at the barn door every midnight. Facing north. Facing the bell. Like he\'s listening for his name."') },
  ],
  unknown: ['"I\'ve work to do."', 'She doesn\'t answer. She\'s looking at the barn.'],
  shop: undefined,
  speech: (c, act) => { if (act === 'insult' || act === 'threat') { c.say('merla', '"Say that again and you\'ll be wearing this pitchfork."'); c.npc('merla').disposition -= 1; return true; } return false; },
  emote: (c, act) => { if (act === 'hug') { c.narr('Merla goes stiff, then, for one second, holds on very hard.'); c.npc('merla').disposition += 1; return true; } return false; },
};

const aldwinNpc: Npc = {
  id: 'aldwin', name: 'Aldwin Thatch', names: ['aldwin', 'aldwin thatch', 'husband', 'zombie', 'dead man', 'farmer'],
  short: 'Merla\'s husband, a month dead, chained to a post',
  look: (c) => c.flag('bell_silenced') ? 'Aldwin sits against the post with his eyes closed. When the bell stopped, he lay down. He might almost be asleep.' : 'A farmer in his Sunday shirt, chained by the ankle to the centre post. Grey skin, clouded eyes, a wedding ring on a swollen finger. He turns his head to follow you. He doesn\'t blink.',
  greet: (c) => c.say('aldwin', c.flag('bell_silenced') ? 'He doesn\'t move. There\'s nothing in him any more to answer.' : 'His jaw works. One word comes out of him, dry as a leaf: "...bell."'),
  topics: [
    { id: 'merla', keys: ['merla', 'wife', 'love'], say: (c) => c.say('aldwin', 'At her name his hand opens and closes, the way you\'d reach for someone in a dream.') },
    { id: 'queen', keys: ['queen', 'who', 'calling', 'bell', 'north'], say: (c) => c.say('aldwin', '"...she... is... kind." He turns his face north. "...she... remembers... everyone."') },
  ],
  unknown: ['He only stares.', '"...bell."'],
  onAttack: (c) => {
    if (c.flag('merla_consents')) { c.narr('Merla stands in the barn door with her apron over her mouth. "Gently," she says.'); }
    else if (!isDead(c, 'merla')) { c.narr('Behind you, Merla screams.'); c.npc('merla').disposition = -5; }
    c.fight({ id: `aldwin_${c.s.minutes}`, foes: [['aldwin', 1]], intro: 'Aldwin pulls against the chain, reaching for you, not angry. Just reaching.', fleeTo: 'east_farms',
      onWin: (cc) => {
        cc.set('aldwin_dead');
        if (cc.flag('merla_consents')) { cc.set('aldwin_rested'); cc.narr('When it\'s over, Merla kneels in the straw and closes his eyes. She takes his ring and puts it on her thumb. Then she counts out fifty gold coins into your palm, one by one, and doesn\'t say anything at all.'); cc.money(5000); cc.xp(150); cc.journal('You gave Aldwin Thatch his rest, with Merla\'s blessing. She paid 50 gp.'); }
        else { cc.narr('Merla is in the barn door. She doesn\'t scream again. She just looks at you.'); cc.xp(100); cc.journal('You put Aldwin Thatch down against his wife\'s wishes.'); }
      } });
  },
};

export const EXTRA_ROOMS: Record<string, Room> = {
  east_farms: {
    id: 'east_farms', name: 'The East Farms — Thatch Farm', region: 'Breda', outdoors: true, rest: 'short',
    desc: (c) => `A long field of turnips behind the levee, a stone farmhouse, and a barn with its door chained shut.${isDead(c, 'aldwin') ? ' The barn door hangs open now.' : ' Something inside it shifts, now and then, against the wood.'} The road runs back west to Breda's east gate.`,
    exits: [
      { to: 'breda_square', names: ['west', 'back', 'breda', 'town', 'gate', 'village', 'road'], label: 'West to Breda', minutes: 40 },
      { to: 'thatch_barn', names: ['barn', 'in', 'inside', 'the barn', 'shed'], label: 'Into the barn', minutes: 1, blocked: (c) => (c.flag('barn_open') || isDead(c, 'merla') || c.flag('merla_consents') || c.npc('merla').disposition >= 2 ? null : 'The barn door is chained. Merla watches you look at it. ("ask Merla about Aldwin", or force it, or pick the lock.)') },
    ],
    npcs: (c) => aliveFilter(c, ['merla']),
    features: [
      { id: 'barn_door', names: ['barn door', 'chain', 'barn chain', 'padlock', 'lock', 'door'], look: () => 'A heavy chain through the barn door handles, and a new padlock.', open: (c, method) => {
        if (method === 'pick') { if (c.toolCheck(12)) { c.set('barn_open'); c.narr('The padlock clicks open.'); if (!isDead(c, 'merla')) { c.npc('merla').disposition -= 2; c.say('merla', '"Get AWAY from there!"'); } } else c.narr('The lock holds.'); return; }
        if (method === 'force' || method === 'kick') { if (c.abilityCheck('str', 14)) { c.set('barn_open'); c.narr('The hasp tears out of the old wood.'); if (!isDead(c, 'merla')) { c.npc('merla').disposition -= 3; c.say('merla', '"No! Please!"'); } } else c.narr('The chain rattles. The door holds.'); return; }
        c.narr('It\'s chained.');
      } },
      { id: 'field', names: ['field', 'turnips', 'levee', 'crops'], look: () => 'Good dark soil behind the levee. Half the field has gone unpicked this month.' },
    ],
    chips: (c) => ['talk to Merla', 'ask Merla about Aldwin', 'work'],
  },
  thatch_barn: {
    id: 'thatch_barn', name: 'Thatch Farm — The Barn', region: 'Breda',
    desc: (c) => isDead(c, 'aldwin') ? 'An empty barn. A chain lies coiled at the foot of the centre post. Somebody has swept the straw into a neat pile.' : 'Dust in slats of light, the smell of hay and something under it. A man sits chained to the centre post. He turns his head when you come in.',
    exits: [{ to: 'east_farms', names: ['out', 'outside', 'back', 'farm', 'leave', 'exit'], label: 'Out to the farm', minutes: 1 }],
    npcs: (c) => aliveFilter(c, ['aldwin']),
    features: [
      { id: 'chain', names: ['chain', 'post', 'shackle', 'ankle chain'], look: () => 'An ox chain, locked around his ankle and the centre post.', open: (c) => {
        if (isDead(c, 'aldwin')) { c.narr('There\'s nothing on the chain any more.'); return; }
        if (c.flag('aldwin_freed')) { c.narr('It\'s already open.'); return; }
        c.set('aldwin_freed'); c.set('aldwin_dead');
        c.narr('You unlock the chain. Aldwin stands, very slowly, and walks past you without looking at you, out of the barn and north, across the field, toward the Thornwood and the bell. He doesn\'t look back.');
        if (!isDead(c, 'merla')) { c.say('merla', 'Merla runs after him as far as the levee, and stops, and stands there a long time.'); c.npc('merla').disposition -= 2; }
        c.journal('You let Aldwin Thatch go. He walked north, toward the bell.'); c.s.chaos = Math.min(9, c.s.chaos + 1);
      } },
      { id: 'straw', names: ['straw', 'hay'], look: () => 'Old straw. Merla has left a clean shirt folded on a bale.' },
    ],
  },
  south_road: {
    id: 'south_road', name: 'The South Road', region: 'Breda', outdoors: true, rest: 'long',
    desc: () => 'The road south out of Breda runs between hedges toward Rastbrook and the wetlands. Cart ruts, sloe bushes, and every so often a set of wolf prints wider than your hand. A mile on, the bridge over the Aimo is down: washed out in the spring floods.',
    exits: [
      { to: 'breda_square', names: ['north', 'back', 'breda', 'town', 'gate', 'village'], label: 'North to Breda', minutes: 30 },
      { to: 'south_road', names: ['south', 'rastbrook', 'wetlands', 'bridge', 'mire', 'onward'], label: 'South (bridge out)', minutes: 0, blocked: () => 'The bridge over the Aimo is gone. You could swim it, if you hate yourself, but the far bank is a cliff of mud. (Rastbrook and the wetlands open in a later version.)' },
    ],
    features: [
      { id: 'tracks', names: ['tracks', 'prints', 'wolf prints'], look: () => 'Wolf prints, a big pack. They come down here to hunt along the river.', search: (c) => { if (c.check('survival', 11)) { c.narr('You follow the prints to a hollow under the hedges. The pack is close.'); huntWolves(c); } else c.narr('The prints vanish into the hedges.'); } },
      { id: 'bridge', names: ['bridge', 'river', 'aimo'], look: () => 'Two stumps of a bridge and a fast brown river between them.' },
    ],
    chips: () => ['hunt wolves', 'search the tracks', 'forage'],
  },
};

export function huntWolves(c: Ctx) {
  const day = Math.floor((c.s.minutes + 480) / 1440);
  if (c.flag('hunted_day') === day) { c.narr('The pack has moved on for today.'); return; }
  c.set('hunted_day', day);
  c.advance(60);
  c.fight({ id: `wolfpack_${c.s.minutes}`, foes: [['wolf', 2 + (die(c.rng, 2) - 1)]], intro: 'Grey shapes slide out of the hedges on three sides. The pack has decided you\'re the hunt.', fleeTo: 'breda_square',
    onWin: (cc) => { const pelts = lastFight.units.filter((u) => u.side === 'foe' && u.conditions.includes('dead') && u.monster === 'wolf_pack').length; if (pelts) cc.give('wolf_pelt', pelts); } });
}

/** Wire the new rooms and people into the world. */
export function installFreedom() {
  Object.assign(ROOMS, EXTRA_ROOMS);
  NPCS.merla = merla;
  NPCS.aldwin = aldwinNpc;
  const sq = ROOMS.breda_square;
  sq.exits[6] = { to: 'east_farms', names: ['east', 'east gate', 'east farms', 'farms', 'thatch farm', 'thatch', 'merla', 'galilin'], label: 'East gate → farms', minutes: 40 };
  sq.exits[7] = { to: 'south_road', names: ['south', 'south gate', 'south road', 'rastbrook', 'mire', 'wetlands'], label: 'South gate → South Road', minutes: 30 };
  // Merah can be joined
  const merah = NPCS.merah;
  if (merah && !merah.topics.some((t) => t.id === 'join')) merah.topics.push({ id: 'join', keys: ['join', 'serve', 'i want to serve', 'join you', 'join the cult', 'can i join', 'pledge', 'swear', 'with you', 'help you', 'ring it with you', 'teach me'], chip: 'Offer to join her', say: (c) => joinCult(c) });
}

export { hasItem, removeItem };
