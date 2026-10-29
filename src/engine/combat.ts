// Turn-based combat. The player acts on their turn through parsed intents; foes and
// companions act automatically. Defeat never ends the game: the Pale Queen wants witnesses.
import type { Ctx } from '../content/types';
import { ENCOUNTERS, courierLoot, checkChapelDone } from '../content/world';
import { d20, die, fmtMod, mod, pick, roll, combineAdv, type Adv } from './dice';
import { MONSTERS, SPELLS, ITEMS, UNARMED } from './srd';
import type { Combatant, Condition, MonsterDef, WeaponDef, DamageType } from './types';
import {
  am, armorClass, attackAbility, hasItem, isProficient, prof, removeItem, addItem, saveBonus, spellAttack, spellDC,
  weaponById, weaponDamageExpr, weaponToHit, initiativeBonus,
} from './character';
import { expand, STRIKES, WEAPON_HITS, FLAVOR } from '../nlp/grammar';
import { UNARMED_VERBS, type AttackStyle } from '../nlp/parse';

export interface CompanionDef { id: string; name: string; ac: number; maxHp: number; toHit: number; damage: string; dtype: DamageType; dex: number; verb: string; }
export const COMPANIONS: Record<string, CompanionDef> = {
  kettle: { id: 'kettle', name: 'Kettle', ac: 13, maxHp: 11, toHit: 4, damage: '2d4+2', dtype: 'piercing', dex: 2, verb: 'bites' },
  alistair: { id: 'alistair', name: 'Alistair', ac: 13, maxHp: 27, toHit: 5, damage: '1d10', dtype: 'necrotic', dex: 1, verb: 'chill-touches' },
};

const has = (u: Combatant, k: Condition) => u.conditions.includes(k);
const add = (u: Combatant, k: Condition) => { if (!has(u, k)) u.conditions.push(k); };
const del = (u: Combatant, k: Condition) => { u.conditions = u.conditions.filter((x) => x !== k); };
const out = (u: Combatant) => has(u, 'dead') || has(u, 'fled') || has(u, 'surrendered');
const down = (u: Combatant) => out(u) || has(u, 'unconscious');
const mdef = (u: Combatant): MonsterDef | undefined => (u.monster ? MONSTERS[u.monster] : undefined);

const WAKE: Record<string, string> = { chapel_yard: 'kessels_rest', nave: 'kessels_rest', vestry: 'kessels_rest', tower: 'kessels_rest', crypt: 'kessels_rest', kessels_rest: 'kessels_rest', foothills: 'foothills', thornwood: 'breda_square', breda_square: 'breda_square' };

export function inCombat(c: Ctx) { return !!c.s.combat; }
export function unit(c: Ctx, key: string) { return c.s.combat!.units.find((u) => u.key === key)!; }
export const pcUnit = (c: Ctx) => unit(c, 'pc');
export const livingFoes = (c: Ctx) => c.s.combat!.units.filter((u) => u.side === 'foe' && !down(u));

export function startCombat(c: Ctx, encId: string) {
  const enc = ENCOUNTERS[encId];
  if (!enc || c.s.combat) return;
  const units: Combatant[] = [];
  const pc = c.pc;
  units.push({ key: 'pc', name: pc.name, side: 'party', isPc: true, hp: pc.hp, maxHp: pc.maxHp, ac: armorClass(pc), init: 0, conditions: [] });
  for (const id of c.s.companions) {
    const d = COMPANIONS[id];
    if (!d) continue;
    const hp = c.s.companionHp[id] ?? d.maxHp;
    units.push({ key: id, name: d.name, side: 'party', companion: id, hp: Math.max(1, hp), maxHp: d.maxHp, ac: d.ac, init: 0, conditions: [] });
  }
  const partySize = units.length;
  const counts: Record<string, number> = {};
  for (const [mid, n0] of enc.foes) {
    let n = n0;
    if (enc.scaleWithParty && partySize >= 3) n += 1;
    for (let i = 0; i < n; i++) {
      const m = MONSTERS[mid];
      counts[mid] = (counts[mid] ?? 0) + 1;
      const total = enc.foes.filter(([x]) => x === mid).reduce((a, [, k]) => a + k, 0) + (enc.scaleWithParty && partySize >= 3 ? 1 : 0);
      const name = total > 1 ? `${m.name} ${counts[mid]}` : m.name;
      const hp = Math.max(1, roll(c.rng, m.hp).total);
      units.push({ key: `${mid}${counts[mid]}`, name, side: 'foe', monster: mid, hp, maxHp: hp, ac: m.ac, init: 0, conditions: [] });
    }
  }
  // initiative
  for (const u of units) {
    let bonus = 0;
    if (u.isPc) bonus = initiativeBonus(pc);
    else if (u.companion) bonus = COMPANIONS[u.companion].dex;
    else bonus = mod(mdef(u)!.abilities.dex);
    const adv: Adv = u.isPc && (c.flag('yard_warned') && encId === 'yard') ? 'adv' : 'none';
    u.init = d20(c.rng, adv).natural + bonus + (u.isPc ? 0.5 : u.side === 'party' ? 0.25 : 0);
  }
  if (enc.ambush) for (const u of units) if (u.side === 'foe') u.init += 10;
  units.sort((a, b) => b.init - a.init);
  c.s.combat = { round: 1, order: units.map((u) => u.key), turn: 0, units, encounterId: encId, usedAction: false, usedBonus: false, sneakUsed: false, fleeTo: enc.fleeTo };
  c.out('title', '⚔ Combat');
  c.narr(enc.intro);
  c.sys('Initiative: ' + units.map((u) => `${u.name} ${Math.floor(u.init)}`).join(' · '));
  runUntilPlayer(c);
}

function currentUnit(c: Ctx): Combatant {
  const cb = c.s.combat!;
  return unit(c, cb.order[cb.turn]);
}

function nextTurn(c: Ctx) {
  const cb = c.s.combat!;
  cb.turn += 1;
  if (cb.turn >= cb.order.length) { cb.turn = 0; cb.round += 1; }
}

/** After the player's action: finish their turn if nothing useful remains. */
export function afterPlayerAction(c: Ctx) {
  if (!c.s.combat) return;
  if (checkEnd(c)) return;
  const cb = c.s.combat;
  if (cb.usedAction && (cb.usedBonus || !bonusOptions(c).length)) endPlayerTurn(c);
}

export function endPlayerTurn(c: Ctx) {
  if (!c.s.combat) return;
  nextTurn(c);
  runUntilPlayer(c);
}

export function bonusOptions(c: Ctx): string[] {
  const cb = c.s.combat!;
  if (cb.usedBonus) return [];
  const pc = c.pc;
  const o: string[] = [];
  if (pc.cls === 'fighter' && pc.resources.second_wind && pc.resources.second_wind.used < pc.resources.second_wind.max && pc.hp < pc.maxHp) o.push('second wind');
  if (hasItem(pc, 'potion_healing') && pc.hp < pc.maxHp * 0.6) o.push('drink potion');
  if (pc.cls === 'monk' && cb.usedAction) o.push('punch');
  if (pc.cls === 'monk' && pc.resources.focus && pc.resources.focus.used < pc.resources.focus.max && cb.usedAction) o.push('flurry of blows');
  if (pc.cls === 'cleric' && pc.slots.used < pc.slots.max && (pc.hp < pc.maxHp * 0.5 || c.s.combat!.units.some((u) => u.companion && has(u, 'unconscious')))) o.push('healing word');
  if (pc.cls === 'rogue' && pc.level >= 2) o.push('hide');
  return o;
}

function runUntilPlayer(c: Ctx) {
  let guard = 0;
  while (c.s.combat && guard++ < 200) {
    if (checkEnd(c)) return;
    const u = currentUnit(c);
    if (u.isPc) {
      const cb = c.s.combat;
      cb.usedAction = false; cb.usedBonus = false; cb.sneakUsed = false;
      del(u, 'dodging');
      if (has(u, 'prone') && !has(u, 'unconscious')) { del(u, 'prone'); c.narr('You scramble back to your feet.'); }
      if (has(u, 'unconscious')) {
        deathSave(c);
        if (!c.s.combat) return;
        nextTurn(c);
        continue;
      }
      c.sys(`Round ${cb.round} — your turn. ${u.hp}/${u.maxHp} HP.`);
      return;
    }
    if (!down(u)) {
      if (u.side === 'foe') foeAct(c, u);
      else companionAct(c, u);
    } else if (u.companion && has(u, 'unconscious')) {
      // companions stabilise on their own
    }
    if (!c.s.combat) return;
    nextTurn(c);
  }
}

function checkEnd(c: Ctx): boolean {
  const cb = c.s.combat;
  if (!cb) return true;
  const foes = cb.units.filter((u) => u.side === 'foe');
  if (foes.every((u) => out(u) || (has(u, 'frightened')))) { victory(c); return true; }
  const party = cb.units.filter((u) => u.side === 'party');
  if (party.every((u) => down(u))) { defeat(c, 'down'); return true; }
  return false;
}

// ---------- damage ----------
function damageMult(def: MonsterDef | undefined, dtype: DamageType, silvered = false): number {
  if (!def) return 1;
  if (def.immune?.includes(dtype)) return 0;
  if (def.vulnerable?.includes(dtype)) return 2;
  if (def.resist?.includes(dtype) && !silvered) return 0.5;
  return 1;
}

function hurtFoe(c: Ctx, t: Combatant, amount: number, dtype: DamageType, opts: { crit?: boolean; silvered?: boolean; before?: (dealt: number) => void } = {}): number {
  const def = mdef(t);
  const mult = damageMult(def, dtype, opts.silvered);
  let dmg = Math.floor(amount * mult);
  opts.before?.(dmg);
  if (mult === 2) c.sys(`${t.name} is vulnerable to ${dtype}: double damage.`);
  if (mult === 0) c.sys(`${t.name} is immune to ${dtype}.`);
  t.hp -= dmg;
  if (t.hp <= 0) {
    if (def?.traits?.includes('undead fortitude') && dtype !== 'radiant' && !opts.crit && dmg > 0) {
      const sv = d20(c.rng).natural + mod(def.abilities.con);
      if (sv >= 5 + dmg) { t.hp = 1; c.narr(expand(c.rng, FLAVOR, 'undead_fortitude', { target: def.name.toLowerCase() }) + '.'); c.out('roll', `Undead Fortitude: ${sv} vs DC ${5 + dmg} — it stays up with 1 HP.`); return dmg; }
    }
    t.hp = 0;
    add(t, 'dead');
    const key = t.monster === 'zombie' || t.monster === 'dead_wolf' ? 'zombie_down' : t.monster === 'skeleton' ? 'skeleton_down' : t.monster === 'wolf' ? 'wolf_down' : 'other_down';
    c.out('good', expand(c.rng, FLAVOR, key, { target: t.name }) + '.');
    c.s.stats.kills += 1;
  } else if (def?.surrenderAt && t.hp <= def.surrenderAt && !has(t, 'surrendered')) {
    add(t, 'surrendered');
    c.narr(t.monster === 'merah' ? 'Merah drops her sickle and sinks onto the stairs, both hands raised. "Enough. Enough. She\'ll forgive you." She means it, which is worse.' : `${t.name} throws down their weapon and begs for mercy.`);
    c.sys(`${t.name} has surrendered. You can spare them or finish them.`);
  }
  return dmg;
}

function hurtParty(c: Ctx, t: Combatant, amount: number, dtype: DamageType, attacker: string, before?: (dealt: number) => void) {
  let dmg = amount;
  let announced = false;
  const announce = (d: number) => { if (!announced) { announced = true; before?.(d); } };
  if (t.isPc) {
    const pc = c.pc;
    if ((dtype === 'fire' && (pc.species === 'tiefling' || pc.species === 'dragonborn')) || (dtype === 'poison' && pc.species === 'dwarf')) { dmg = Math.floor(dmg / 2); c.sys('You resist the damage.'); }
    const st = pc.resources.stone;
    if (st && st.used < st.max && dmg >= 6) {
      st.used += 1;
      const red = roll(c.rng, '1d12').total + am(pc, 'con');
      dmg = Math.max(0, dmg - red);
      c.sys(`Stone's Endurance: you shrug off ${red} damage.`);
    }
    if (pc.tempHp) { const a = Math.min(pc.tempHp, dmg); pc.tempHp -= a; dmg -= a; }
    announce(dmg);
    t.hp -= dmg;
    if (t.hp <= 0) {
      const rel = pc.resources.relentless;
      if (rel && rel.used < rel.max) { rel.used += 1; t.hp = 1; c.out('good', 'Relentless Endurance: you should be down. You refuse. 1 HP.'); }
      else {
        t.hp = 0; add(t, 'unconscious'); pc.deathSaves = { ok: 0, fail: 0 };
        c.out('bad', `You go down. The world tilts, goes grey, goes quiet.`);
        c.s.stats.knockouts += 1;
      }
    }
    pc.hp = Math.max(0, t.hp);
    t.ac = armorClass(pc);
  } else {
    announce(dmg);
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.hp = 0; add(t, 'unconscious');
      if (t.companion === 'alistair') c.narr('Alistair collapses into a heap of bones and very good fabric. The skull, rolling, says: "Be right back, brother. Don\'t let them touch my coat."');
      else if (t.companion === 'kettle') c.narr('Kettle yelps and goes down, but his tail is still moving.');
      else c.narr(`${t.name} goes down.`);
    }
  }
  return dmg;
}

// ---------- player actions ----------
export function resolveTarget(c: Ctx, name?: string, side: 'foe' | 'party' = 'foe'): Combatant | null {
  const cb = c.s.combat!;
  const pool = cb.units.filter((u) => u.side === side && !has(u, 'dead') && !has(u, 'fled'));
  if (!pool.length) return null;
  const alive = pool.filter((u) => !has(u, 'surrendered'));
  if (!name || /^(it|him|her|them|enemy|foe|target|one)$/.test(name)) {
    const last = c.s.lastTarget ? pool.find((u) => u.key === c.s.lastTarget) : undefined;
    if (last && !down(last)) return last;
    return (alive.length ? alive : pool).sort((a, b) => a.hp - b.hp)[0];
  }
  const n = name.toLowerCase().replace(/\s+#?(\d+)$/, ' $1');
  const exact = pool.find((u) => u.name.toLowerCase() === n);
  if (exact) return exact;
  const num = n.match(/(\d+)$/)?.[1];
  const ord = /\b(second|2nd)\b/.test(n) ? 2 : /\b(third|3rd)\b/.test(n) ? 3 : /\b(first|1st)\b/.test(n) ? 1 : num ? parseInt(num, 10) : 0;
  const word = n.replace(/\b(second|2nd|third|3rd|first|1st|other|last)\b/g, '').replace(/\d+/g, '').trim();
  const matches = pool.filter((u) => {
    const def = mdef(u);
    const names = [u.name.toLowerCase(), ...(def?.aliases ?? []), def?.plural ?? '', COMPANIONS[u.companion ?? '']?.name.toLowerCase() ?? ''];
    return names.some((x) => x && (x === word || x.startsWith(word) || word.startsWith(x) || word.split(' ').some((w) => w.length > 2 && x.includes(w))));
  });
  if (!matches.length) return null;
  if (ord) return matches[ord - 1] ?? matches[0];
  if (/other/.test(n) && c.s.lastTarget) return matches.find((u) => u.key !== c.s.lastTarget && !down(u)) ?? matches[0];
  return matches.filter((u) => !down(u))[0] ?? matches[0];
}

function useAction(c: Ctx, bonus = false): boolean {
  const cb = c.s.combat!;
  if (bonus) {
    if (cb.usedBonus) { c.sys('You have already used your bonus action this turn.'); return false; }
    cb.usedBonus = true; return true;
  }
  if (cb.usedAction) { c.sys('You have already used your action this turn. (Type "end turn", or use a bonus action.)'); return false; }
  cb.usedAction = true; return true;
}

function chooseWeapon(c: Ctx, style: AttackStyle, named?: string): WeaponDef | string {
  const pc = c.pc;
  if (style === 'unarmed') return UNARMED;
  if (named) {
    const nm = named.toLowerCase();
    if (/(fist|fists|hand|hands|foot|feet|knee|elbow|head|bare)/.test(nm)) return UNARMED;
    const stack = pc.inventory.find((s) => { const it = ITEMS[s.id]; return it?.weapon && (it.name.toLowerCase().includes(nm) || nm.includes(it.name.toLowerCase()) || it.weapon.id.replace(/_/g, ' ').includes(nm) || (nm.match(/gun|pistol|revolver/) && it.weapon.category === 'firearm') || (nm === 'bow' && /bow/.test(it.id))); });
    if (!stack) return `You don't have a ${named}.`;
    return ITEMS[stack.id].weapon!;
  }
  if (style === 'ranged') {
    const r = weaponById(pc.equipped.ranged) ?? weaponById(pc.equipped.main);
    if (!r || !r.ranged) return 'You have no ranged weapon ready. ("equip revolver", or attack with what you\'re holding.)';
    return r;
  }
  if (style === 'thrown') return 'Throw what? (e.g. "throw dagger at zombie")';
  const m = weaponById(pc.equipped.main);
  return m ?? UNARMED;
}

export function playerAttack(c: Ctx, style: AttackStyle, verb: string, targetName?: string, weaponName?: string, limb?: string) {
  const cb = c.s.combat!;
  const pc = c.pc;
  const w = chooseWeapon(c, style, weaponName);
  if (typeof w === 'string') { c.sys(w); return; }
  const t = resolveTarget(c, targetName);
  if (!t) { c.sys(targetName ? `You don't see "${targetName}" here.` : 'There\'s nothing left to fight.'); return; }
  if (has(t, 'surrendered')) { c.sys(`${t.name} has surrendered. Type "finish ${t.name.toLowerCase()}" if you really mean it, or "spare".`); return; }
  // Monk martial arts: unarmed strike as bonus after an action
  let bonus = false;
  if (cb.usedAction && pc.cls === 'monk' && (w.id === 'unarmed' || (w.category === 'simple' && !w.twoHanded)) && !cb.usedBonus) bonus = true;
  if (cb.usedAction && !bonus) { c.sys('You have already used your action this turn. (Type "end turn".)'); return; }
  if (w.category === 'firearm') {
    if (pc.equipped.main !== w.id && pc.equipped.ranged !== w.id) pc.equipped.ranged = w.id;
    if (c.flag(`jam_${w.id}`)) { c.sys(`Your ${w.name} is jammed. Spend an action to clear it ("unjam").`); return; }
    if ((pc.ammo[w.id] ?? 0) <= 0) { c.sys(`Click. Your ${w.name} is empty. ("reload")`); return; }
  }
  if (w.ammo === 'arrow' && !hasItem(pc, 'arrow')) { c.sys('You\'re out of arrows.'); return; }
  if (w.thrown && style === 'thrown' && !hasItem(pc, w.id)) { c.sys(`You don't have a ${w.name}.`); return; }
  useAction(c, bonus);
  if (bonus) c.sys('Martial Arts: a bonus-action strike.');
  doAttack(c, t, w, style, verb, limb);
  c.s.lastTarget = t.key;
  afterPlayerAction(c);
}

function doAttack(c: Ctx, t: Combatant, w: WeaponDef, style: AttackStyle, verb: string, limb?: string) {
  const pc = c.pc;
  const me = pcUnit(c);
  const ranged = w.ranged || style === 'thrown';
  let advFlag = has(me, 'hidden') || has(t, 'guided') || (!ranged && has(t, 'prone'));
  let disFlag = has(me, 'prone') || (ranged && has(t, 'prone'));
  const adv = combineAdv(advFlag, disFlag);
  del(me, 'hidden'); del(t, 'guided');
  let r = d20(c.rng, adv);
  if (r.natural === 1 && pc.species === 'halfling') { c.sys('Halfling luck: rerolling the 1.'); r = d20(c.rng, 'none'); }
  const toHit = weaponToHit(pc, w);
  let bless = 0;
  if (has(me, 'blessed')) bless = die(c.rng, 4);
  const total = r.natural + toHit + bless;
  const crit = r.natural === 20;
  const hit = crit || (r.natural !== 1 && total >= t.ac);
  c.out('roll', `🎲 ${w.name} vs ${t.name}: d20${r.rolls.length > 1 ? `(${r.rolls.join(',')} ${r.adv})` : ''} ${r.natural} ${fmtMod(toHit)}${bless ? ` +${bless} bless` : ''} = ${total} vs AC ${t.ac}${crit ? ' — CRITICAL!' : hit ? ' — hit' : ' — miss'}`);
  // ammo
  if (w.category === 'firearm') {
    pc.ammo[w.id] = (pc.ammo[w.id] ?? 1) - 1;
    if (r.natural === 1) { c.set(`jam_${w.id}`, true); c.out('bad', `Your ${w.name} jams.`); }
    if (!c.flag('loud_warned')) { c.set('loud_warned'); c.sys('Gunfire carries a mile in open country.'); }
  }
  if (w.ammo === 'arrow') removeItem(pc, 'arrow');
  if (style === 'thrown') { removeItem(pc, w.id); c.s.roomItems[c.s.loc] = [...(c.s.roomItems[c.s.loc] ?? []), { id: w.id, qty: 1 }]; }
  const lk = w.id === 'unarmed' ? (limb ? limbKey(verb) : limbKey(verb)) : null;
  const tname = /\d$/.test(t.name) || t.monster === 'merah' || t.companion ? t.name : `the ${t.name.toLowerCase()}`;
  const spotSym = mdef(t)?.tags.includes('undead') ? 'undead_spot' : 'spot';
  const spot = limb ?? expand(c.rng, STRIKES, spotSym).toLowerCase();
  if (!hit) {
    const line = lk ? expand(c.rng, STRIKES, `miss_${lk}`, { target: tname, verb: verbWord(verb), spot }) : expand(c.rng, WEAPON_HITS, w.ranged && w.category === 'firearm' ? 'miss_ranged' : w.ranged ? 'miss_bow' : 'miss_melee', { target: tname, weapon: w.name.toLowerCase(), verb });
    c.out('miss', line + '.');
    return;
  }
  let expr = weaponDamageExpr(pc, w);
  let dmg = roll(c.rng, expr, crit).total;
  if (pc.background === 'soldier' && !c.s.combat!.sneakUsed && w.id !== 'unarmed') {
    const second = roll(c.rng, expr, crit).total;
    if (second > dmg) { dmg = second; }
  }
  let sneak = 0;
  const allyAdjacent = c.s.combat!.units.some((u) => u.side === 'party' && !u.isPc && !down(u));
  if (pc.cls === 'rogue' && !c.s.combat!.sneakUsed && (w.finesse || w.ranged) && (adv === 'adv' || allyAdjacent) && adv !== 'dis') {
    sneak = roll(c.rng, '1d6', crit).total; c.s.combat!.sneakUsed = true;
  }
  dmg = Math.max(1, dmg + sneak);
  const line = lk ? expand(c.rng, STRIKES, `hit_${lk}`, { target: tname, verb: verbWord(verb), spot }) : expand(c.rng, WEAPON_HITS, w.ranged && w.category === 'firearm' ? 'hit_ranged' : w.ranged ? 'hit_bow' : 'hit_melee', { target: tname, weapon: w.name.toLowerCase(), verb, spot });
  hurtFoe(c, t, dmg, w.dtype, { crit, silvered: w.silvered, before: (dealt) => { c.out('hit', line + '.'); c.out('roll', `💥 ${dealt} ${w.dtype} damage${sneak ? ` (incl. ${sneak} sneak attack)` : ''}${crit ? ' (critical)' : ''}.`); } });
  if (!down(t)) c.sys(`${t.name}: ${hpWord(t)}.`);
}

function hpWord(t: Combatant) {
  const f = t.hp / t.maxHp;
  return f > 0.75 ? 'barely scratched' : f > 0.4 ? 'hurt' : f > 0.15 ? 'badly hurt' : 'nearly finished';
}

function limbKey(verb: string): string {
  return UNARMED_VERBS[verb] ?? 'fist';
}
function verbWord(verb: string) { return verb.replace(/-/g, ' '); }

export function playerCast(c: Ctx, spellName: string, targetName?: string) {
  const pc = c.pc;
  const sp = Object.values(SPELLS).find((s) => s.aliases.includes(spellName.toLowerCase()) || s.name.toLowerCase() === spellName.toLowerCase() || s.id === spellName);
  if (!sp || (![...pc.cantrips, ...pc.spells].includes(sp.id))) { c.sys(sp ? `You don't know ${sp.name}.` : `You don't know a spell called "${spellName}".`); return; }
  const cb = c.s.combat;
  if (sp.level === 1 && pc.slots.used >= pc.slots.max) { c.sys('You have no spell slots left. They come back after a long rest.'); return; }
  if (!cb) { castOutside(c, sp.id, targetName); return; }
  if (!useAction(c, !!sp.bonusAction)) return;
  if (sp.level === 1) pc.slots.used += 1;
  const me = pcUnit(c);
  const dc = spellDC(pc);
  if (sp.kind === 'attack') {
    const t = resolveTarget(c, targetName);
    if (!t) { c.sys('No target.'); cb.usedAction = false; if (sp.level === 1) pc.slots.used -= 1; return; }
    const adv = combineAdv(has(me, 'hidden') || has(t, 'guided'), has(me, 'prone'));
    del(t, 'guided'); del(me, 'hidden');
    const r = d20(c.rng, adv);
    const tot = r.natural + spellAttack(pc);
    const crit = r.natural === 20;
    const hit = crit || (r.natural !== 1 && tot >= t.ac);
    c.out('roll', `🎲 ${sp.name} vs ${t.name}: ${r.natural} ${fmtMod(spellAttack(pc))} = ${tot} vs AC ${t.ac}${crit ? ' — CRITICAL!' : hit ? ' — hit' : ' — miss'}`);
    if (!hit) { c.out('miss', `Your ${sp.name.toLowerCase()} goes wide.`); }
    else {
      const d = roll(c.rng, sp.damage!, crit).total;
      hurtFoe(c, t, d, sp.dtype as DamageType, { crit, before: (dealt) => { c.out('hit', spellHitLine(sp.id, t.name)); c.out('roll', `💥 ${dealt} ${sp.dtype} damage.`); } });
      if (!down(t)) c.sys(`${t.name}: ${hpWord(t)}.`);
      if (sp.id === 'guiding_bolt' && !down(t)) { add(t, 'guided'); c.sys(`${t.name} glows: the next attack against it has advantage.`); }
    }
    c.s.lastTarget = t.key;
  } else if (sp.kind === 'save') {
    const targets = sp.aoe ? livingFoes(c).slice(0, sp.aoe) : [resolveTarget(c, targetName)].filter(Boolean) as Combatant[];
    if (!targets.length) { c.sys('No target.'); return; }
    c.out('hit', sp.id === 'burning_hands' ? 'A sheet of fire fans from your fingertips.' : 'Radiant flame drops on your target like a falling star.');
    for (const t of targets) {
      const def = mdef(t)!;
      const sv = d20(c.rng).natural + mod(def.abilities[sp.save!]);
      const ok = sv >= dc;
      let d = roll(c.rng, sp.damage!).total;
      if (ok) d = sp.level === 0 ? 0 : Math.floor(d / 2);
      c.out('roll', `🎲 ${t.name} ${sp.save!.toUpperCase()} save ${sv} vs DC ${dc}: ${ok ? 'saved' : 'failed'}`);
      if (d > 0) { hurtFoe(c, t, d, sp.dtype as DamageType, { before: (dealt) => c.out('roll', `💥 ${t.name} takes ${dealt} ${sp.dtype}.`) }); }
      else c.out('miss', `${t.name} dodges clear.`);
    }
  } else if (sp.kind === 'auto') {
    const t = resolveTarget(c, targetName);
    if (!t) { c.sys('No target.'); return; }
    let total = 0;
    for (let i = 0; i < 3; i++) total += roll(c.rng, sp.damage!).total;
    hurtFoe(c, t, total, 'force', { before: (dealt) => { c.out('hit', `Three darts of blue light streak from your hand and slam into ${t.name}. They never miss.`); c.out('roll', `💥 ${dealt} force damage.`); } });
    if (!down(t)) c.sys(`${t.name}: ${hpWord(t)}.`);
    c.s.lastTarget = t.key;
  } else if (sp.kind === 'heal') {
    const t = resolveTarget(c, targetName && !/^(me|myself|self)$/.test(targetName) ? targetName : 'pc_self', 'party') ?? me;
    const target = targetName && !/^(me|myself|self)$/.test(targetName) ? t : me;
    const h = roll(c.rng, sp.damage!).total + Math.max(0, am(pc, 'wis'));
    healUnit(c, target, h);
    c.out('good', `${sp.name}: ${target.isPc ? 'you heal' : `${target.name} heals`} ${h} HP.`);
  } else if (sp.kind === 'buff') {
    if (sp.id === 'bless') { for (const u of cb.units.filter((u) => u.side === 'party' && !down(u))) add(u, 'blessed'); c.out('good', 'A warm light settles on your shoulders and your allies\'. (+1d4 to attack rolls this fight.)'); }
    if (sp.id === 'mage_armor') { castOutside(c, 'mage_armor'); }
  } else {
    flavorCantrip(c, sp.id);
  }
  afterPlayerAction(c);
}

function spellHitLine(id: string, name: string) {
  if (id === 'fire_bolt') return `A mote of fire streaks across the room and bursts against ${name}.`;
  if (id === 'ray_of_frost') return `A pale beam of cold strikes ${name}, rimed in frost.`;
  if (id === 'guiding_bolt') return `A flash of light lances into ${name}, and it keeps glowing.`;
  return `Your spell strikes ${name}.`;
}

function flavorCantrip(c: Ctx, id: string) {
  if (id === 'prestidigitation') c.narr(pick(c.rng, ['You make a low growling noise come from the corner. Everyone looks. Nothing is there.', 'A shower of harmless sparks. Your drink is now perfectly chilled.', 'You make your boots very clean. Nobody is impressed.']));
  else if (id === 'thaumaturgy') c.narr('Your voice booms three times louder than it should, and every flame in the room flickers.');
  else if (id === 'guidance') { c.set('guidance', true); c.good('Guidance: +1d4 on your next ability check.'); }
}

function castOutside(c: Ctx, id: string, target?: string) {
  const pc = c.pc;
  const sp = SPELLS[id];
  if (sp.kind === 'utility') { flavorCantrip(c, id); return; }
  if (id === 'mage_armor') {
    if (pc.equipped.armor) { c.sys('Mage Armour does nothing while you wear armour.'); return; }
    if (pc.equipped.worn.includes('mage_armor_active')) { c.sys('Mage Armour is already up.'); return; }
    pc.slots.used += 1; pc.equipped.worn.push('mage_armor_active');
    c.good(`A shimmer of force settles over you. AC ${armorClass(pc)} until your next long rest.`);
    return;
  }
  if (sp.kind === 'heal') {
    const self = !target || /^(me|myself|self)$/.test(target);
    pc.slots.used += 1;
    const h = roll(c.rng, sp.damage!).total + Math.max(0, am(pc, 'wis'));
    if (self) { pc.hp = Math.min(pc.maxHp, pc.hp + h); c.good(`You heal ${h} HP (${pc.hp}/${pc.maxHp}).`); }
    else {
      const id2 = c.s.companions.find((x) => COMPANIONS[x].name.toLowerCase().startsWith(target!.toLowerCase()));
      if (!id2) { c.sys('Heal whom?'); pc.slots.used -= 1; return; }
      if (id2 === 'alistair') { c.narr('Healing light washes over Alistair, and he yelps. "OW. Brother. Undead. Necrotic. That\'s the opposite of what I need."'); return; }
      c.s.companionHp[id2] = Math.min(COMPANIONS[id2].maxHp, (c.s.companionHp[id2] ?? COMPANIONS[id2].maxHp) + h);
      c.good(`${COMPANIONS[id2].name} heals ${h} HP.`);
    }
    return;
  }
  if (sp.kind === 'attack' || sp.kind === 'save' || sp.kind === 'auto') {
    if (id === 'fire_bolt' && target) { c.narr(`A bolt of fire scorches the ${target}. Nothing else happens, except that it\'s a little warmer.`); return; }
    c.sys('There\'s nothing to cast that at.');
    return;
  }
  if (id === 'bless') { c.sys('Bless lasts for one fight; cast it when the fighting starts.'); return; }
}

function healUnit(c: Ctx, t: Combatant, h: number) {
  t.hp = Math.min(t.maxHp, t.hp + h);
  if (has(t, 'unconscious')) { del(t, 'unconscious'); del(t, 'stable'); c.out('good', `${t.isPc ? 'You' : t.name} ${t.isPc ? 'come' : 'comes'} back to your feet.`); }
  if (t.isPc) { c.pc.hp = t.hp; c.pc.deathSaves = { ok: 0, fail: 0 }; }
}

export function playerFeature(c: Ctx, name: string) {
  const pc = c.pc;
  const cb = c.s.combat;
  const me = cb ? pcUnit(c) : null;
  if (name === 'second wind') {
    const r = pc.resources.second_wind;
    if (!r) { c.sys('Only fighters have Second Wind.'); return; }
    if (r.used >= r.max) { c.sys('No Second Wind left. It comes back after a rest.'); return; }
    if (cb && !useAction(c, true)) return;
    r.used += 1;
    const h = roll(c.rng, `1d10+${pc.level}`).total;
    pc.hp = Math.min(pc.maxHp, pc.hp + h); if (me) me.hp = pc.hp;
    c.out('good', `Second Wind: you grit your teeth and find ${h} HP (${pc.hp}/${pc.maxHp}).`);
  } else if (name === 'action surge') {
    const r = pc.resources.action_surge;
    if (!r || !cb) { c.sys(cb ? 'You don\'t have Action Surge yet.' : 'Save it for a fight.'); return; }
    if (r.used >= r.max) { c.sys('Action Surge is spent until you rest.'); return; }
    r.used += 1; cb.usedAction = false; c.out('good', 'Action Surge! You push past your limits: take another action.'); return;
  } else if (name === 'flurry') {
    const r = pc.resources.focus;
    if (!r || !cb) { c.sys(cb ? 'You don\'t have Flurry of Blows yet.' : 'Save it for a fight.'); return; }
    if (r.used >= r.max) { c.sys('No Focus left.'); return; }
    if (!cb.usedAction) { c.sys('Flurry of Blows follows your attack: attack first.'); return; }
    if (!useAction(c, true)) return;
    r.used += 1;
    for (let i = 0; i < 2; i++) { const t = resolveTarget(c); if (!t) break; doAttack(c, t, UNARMED, 'unarmed', i ? 'kick' : 'jab'); }
  } else if (name === 'turn undead') {
    const r = pc.resources.channel;
    if (!r || !cb) { c.sys(cb ? 'Turn Undead comes at level 2.' : 'There\'s nothing here to turn.'); return; }
    if (r.used >= r.max) { c.sys('Channel Divinity is spent until you rest.'); return; }
    if (!useAction(c)) return;
    r.used += 1;
    c.out('hit', 'You raise your holy symbol and speak a word the dead remember. Light spills from it.');
    for (const t of livingFoes(c).filter((u) => mdef(u)?.tags.includes('undead'))) {
      const sv = d20(c.rng).natural + mod(mdef(t)!.abilities.wis);
      if (sv < spellDC(pc)) { add(t, 'fled'); c.out('good', `${t.name} turns and flees into the dark.`); }
      else c.out('miss', `${t.name} shudders but holds its ground.`);
    }
  } else if (name === 'breath') {
    const r = pc.resources.breath;
    if (!r || !cb) { c.sys(cb ? 'Only dragonborn breathe fire. Mostly.' : 'You breathe a small, impressive puff of flame. Nobody claps.'); return; }
    if (r.used >= r.max) { c.sys('Your throat is raw. No breath left until a long rest.'); return; }
    if (!useAction(c)) return;
    r.used += 1;
    const dc = 8 + am(pc, 'con') + prof(pc);
    c.out('hit', 'You draw a deep breath and exhale a roaring cone of fire.');
    for (const t of livingFoes(c).slice(0, 3)) {
      const sv = d20(c.rng).natural + mod(mdef(t)!.abilities.dex);
      let d = roll(c.rng, '1d10').total; if (sv >= dc) d = Math.floor(d / 2);
      hurtFoe(c, t, d, 'fire', { before: (dealt) => c.out('roll', `💥 ${t.name} (Dex ${sv} vs DC ${dc}) takes ${dealt} fire.`) });
    }
  }
  if (cb) afterPlayerAction(c);
}

export function playerShove(c: Ctx, verb: string, targetName: string | undefined, grapple: boolean) {
  const t = resolveTarget(c, targetName);
  if (!t) { c.sys('Shove whom?'); return; }
  if (!useAction(c)) return;
  const pc = c.pc;
  const dc = 8 + am(pc, 'str') + prof(pc);
  const def = mdef(t)!;
  const sv = d20(c.rng).natural + Math.max(mod(def.abilities.str), mod(def.abilities.dex));
  c.out('roll', `🎲 ${t.name} resists: ${sv} vs DC ${dc}`);
  if (sv >= dc) c.out('miss', `${t.name} ${grapple ? 'twists out of your grip' : 'keeps its feet'}.`);
  else if (grapple) { add(t, 'grappled'); c.out('hit', `You ${verb} ${t.name} and hold on. It's grappled: it can't get away, and it struggles to hit anyone but you.`); }
  else { add(t, 'prone'); c.out('hit', `You ${verb} ${t.name} and it goes sprawling. Prone: melee attacks against it have advantage.`); }
  c.s.lastTarget = t.key;
  afterPlayerAction(c);
}

export function playerDodge(c: Ctx) { if (!useAction(c)) return; add(pcUnit(c), 'dodging'); c.out('good', 'You go on the defensive. Attacks against you have disadvantage until your next turn.'); afterPlayerAction(c); }

export function playerHide(c: Ctx) {
  const pc = c.pc;
  const bonus = pc.cls === 'rogue' && pc.level >= 2;
  if (!useAction(c, bonus)) return;
  const best = Math.max(...livingFoes(c).map((u) => 10 + mod(mdef(u)!.abilities.wis)));
  if (c.check('stealth', best)) { add(pcUnit(c), 'hidden'); c.good('You slip out of sight. Your next attack has advantage.'); }
  else c.narr('They can still see you.');
  afterPlayerAction(c);
}

export function playerReload(c: Ctx) {
  const pc = c.pc;
  const w = weaponById(pc.equipped.ranged) ?? weaponById(pc.equipped.main);
  if (!w || w.category !== 'firearm') { c.sys('You have no firearm ready.'); return; }
  const ammoId = w.ammo === 'pistol' ? 'pistol_cartridge' : 'rifle_cartridge';
  const have = pc.inventory.find((s) => s.id === ammoId)?.qty ?? 0;
  const need = (w.capacity ?? 0) - (pc.ammo[w.id] ?? 0);
  if (need <= 0) { c.sys('It\'s already fully loaded.'); return; }
  if (!have) { c.sys('You have no cartridges for it.'); return; }
  if (c.s.combat && !useAction(c)) return;
  const n = Math.min(need, have);
  removeItem(pc, ammoId, n); pc.ammo[w.id] = (pc.ammo[w.id] ?? 0) + n;
  c.narr(`You thumb ${n} cartridge${n > 1 ? 's' : ''} into the ${w.name.toLowerCase()}. ${pc.ammo[w.id]}/${w.capacity}.`);
  if (c.s.combat) afterPlayerAction(c);
}

export function playerUnjam(c: Ctx) {
  const pc = c.pc;
  const w = weaponById(pc.equipped.ranged) ?? weaponById(pc.equipped.main);
  if (!w || !c.flag(`jam_${w.id}`)) { c.sys('Nothing is jammed.'); return; }
  if (c.s.combat && !useAction(c)) return;
  c.set(`jam_${w.id}`, false);
  c.narr(`You work the action, knock the bad cartridge loose, and the ${w.name.toLowerCase()} is ready again.`);
  if (c.s.combat) afterPlayerAction(c);
}

export function playerUsePotion(c: Ctx, targetName?: string) {
  const pc = c.pc;
  if (!hasItem(pc, 'potion_healing')) { c.sys('You have no healing potions.'); return; }
  const cb = c.s.combat;
  let target: Combatant | null = cb ? pcUnit(c) : null;
  if (targetName && !/^(me|myself|self)$/.test(targetName) && cb) target = resolveTarget(c, targetName, 'party');
  const self = !target || target.isPc;
  if (cb && !useAction(c, self)) return;
  removeItem(pc, 'potion_healing');
  const h = roll(c.rng, '2d4+2').total;
  if (cb && target) { healUnit(c, target, h); }
  else { pc.hp = Math.min(pc.maxHp, pc.hp + h); }
  c.out('good', `${self ? 'You drink' : `You pour the potion into ${target!.name}`}: +${h} HP.${self ? ` (${pc.hp}/${pc.maxHp})` : ''}`);
  if (target?.companion === 'alistair') c.narr('It runs straight through his ribs. "Appreciate the gesture, brother."');
  if (cb) afterPlayerAction(c);
}

export function playerFlee(c: Ctx) {
  const cb = c.s.combat!;
  if (!useAction(c)) return;
  const foes = livingFoes(c);
  const slow = foes.every((u) => (mdef(u)?.speed ?? 30) < 30);
  const dc = slow ? 5 : 10 + foes.length * 2;
  if (c.check('acrobatics', dc)) {
    const to = cb.fleeTo ?? (c.flag('prev_loc') as string) ?? c.s.loc;
    syncAfterCombat(c);
    c.s.combat = null;
    c.out('good', 'You break away and run, and keep running until the sounds of pursuit fade.');
    c.move(to);
  } else { c.out('bad', 'You try to break away, but they cut you off.'); afterPlayerAction(c); }
}

export function playerSpare(c: Ctx, targetName?: string) {
  if (!c.s.combat) { spareOutside(c); return; }
  const t = c.s.combat.units.find((u) => has(u, 'surrendered')) ?? null;
  if (!t) { c.sys('Nobody has surrendered.'); return; }
  add(t, 'fled');
  c.narr(t.monster === 'merah' ? 'You let her go. Merah stumbles down the stairs and out into the night without looking back.' : `${t.name} scrambles away.`);
  if (t.monster === 'merah') { merahGone(c, false); }
  checkEnd(c);
}

export function playerFinish(c: Ctx, targetName?: string) {
  if (!c.s.combat) { finishOutside(c); return; }
  const t = c.s.combat.units.find((u) => has(u, 'surrendered')) ?? resolveTarget(c, targetName);
  if (!t) { c.sys('Finish whom?'); return; }
  del(t, 'surrendered');
  hurtFoe(c, t, t.hp + 50, 'slashing', { crit: true });
  if (t.monster === 'merah') { c.narr('It\'s quick. It isn\'t clean. Afterwards the tower is very quiet.'); merahDead(c); }
  checkEnd(c);
}

function spareOutside(c: Ctx) {
  if (c.flag('merah_surrendered') && !c.flag('merah_gone') && !c.flag('merah_dead')) {
    c.narr('You step aside. Merah looks at you for a long moment, then goes down the stairs and out into the night.');
    merahGone(c, true);
    return;
  }
  c.sys('There\'s nobody to spare.');
}
function finishOutside(c: Ctx) {
  if (c.flag('merah_surrendered') && !c.flag('merah_gone') && !c.flag('merah_dead')) {
    if (c.hasCompanion('alistair')) c.narr('Alistair\'s finger bones flare cold. "Let me, brother. She was a terrible boss." Merah doesn\'t fight it. She turns to dust in her robes, smiling.');
    else c.narr('Merah closes her eyes. It\'s quick.');
    merahDead(c);
    return;
  }
  c.sys('There\'s nobody to finish.');
}

function merahGone(c: Ctx, handover: boolean) {
  c.set('merah_gone');
  c.narr('On the step where she sat, she\'s left something: a bone amulet carved into a crowned skull. "Take it," she said, or you imagine she did. "I don\'t want to dream any more."');
  c.give('bone_amulet');
  c.xp(50);
  checkChapelDone(c);
}

function merahDead(c: Ctx) {
  c.set('merah_dead');
  c.narr('In her robes: a flask of something strong, two green-black candles, and a bone amulet carved into a crowned skull. The amulet is cold. Then it isn\'t.');
  c.give('bone_amulet'); c.give('cult_candle', 2);
  checkChapelDone(c);
}

export function playerSay(c: Ctx, act: string, text: string) {
  // talking during combat: insults taunt intelligent foes
  if (!c.s.combat) return;
  const foes = livingFoes(c);
  if (act === 'insult' || act === 'threat') {
    const smart = foes.filter((u) => !mdef(u)?.tags.includes('undead') && !mdef(u)?.tags.includes('plant'));
    if (smart.length) { for (const f of smart) add(f, 'taunted'); c.narr(`${smart.map((u) => u.name).join(' and ')} ${smart.length > 1 ? 'turn' : 'turns'} on you, furious.`); }
    else c.narr(pick(c.rng, ['The dead do not understand the insult. They understand you, though.', 'The skeleton\'s jaw works, as if it would have had a comeback, once.', 'Your words echo. The dead keep coming.']));
  } else if (act === 'exclamation' || act === 'emphatic') {
    c.narr(pick(c.rng, ['Your voice cracks off the stone.', 'Fair.', 'Nobody disagrees.']));
  }
}

// ---------- AI ----------
function foeAct(c: Ctx, u: Combatant) {
  const def = mdef(u)!;
  if (has(u, 'frightened')) { c.narr(`${u.name} cowers.`); return; }
  if (has(u, 'prone')) { del(u, 'prone'); c.narr(`${u.name} struggles back to its feet.`); }
  if (u.monster === 'skeleton' && die(c.rng, 6) === 1) { c.narr(`${u.name} stops mid-stride and stands perfectly still, as if it has forgotten its orders. Her control is weak.`); return; }
  const party = c.s.combat!.units.filter((x) => x.side === 'party' && !down(x));
  if (!party.length) return;
  let target: Combatant;
  const me = party.find((x) => x.isPc);
  if (has(u, 'taunted') && me) target = me;
  else if (me && (party.length === 1 || die(c.rng, 2) === 1)) target = me;
  else target = pick(c.rng, party);
  const atk = def.attacks[0];
  const packAlly = def.traits?.includes('pack tactics') && c.s.combat!.units.some((x) => x !== u && x.side === 'foe' && !down(x));
  const grappledOther = has(u, 'grappled') && !target.isPc;
  const adv = combineAdv(!!packAlly || (has(target, 'prone') && !atk.ranged), has(target, 'dodging') || grappledOther);
  const r = d20(c.rng, adv);
  const ac = target.isPc ? armorClass(c.pc) : target.ac;
  const tot = r.natural + atk.toHit;
  const crit = r.natural === 20;
  const hit = crit || (r.natural !== 1 && tot >= ac);
  const tname = target.isPc ? 'you' : target.name;
  if (!hit) { c.out('miss', `${u.name} ${atk.verb ?? 'attacks'} ${tname} and misses. (${tot} vs AC ${ac})`); return; }
  let dmg = roll(c.rng, atk.damage, crit).total;
  if (atk.extra) dmg += roll(c.rng, atk.extra.damage, crit).total;
  hurtParty(c, target, dmg, atk.dtype, u.name, (dealt) => c.out('bad', `${u.name} ${atk.verb ?? 'hits'} ${tname}${crit ? ' — a critical hit' : ''}: ${dealt} damage.${target.isPc ? ` (${Math.max(0, c.pc.hp - dealt)}/${c.pc.maxHp} HP)` : ''}`));
  if (u.monster === 'wolf' && target.isPc && !has(target, 'unconscious') && !has(target, 'prone')) {
    if (!c.save('str', 11)) { add(target, 'prone'); c.narr('The wolf drags you off your feet. You\'re prone until your turn.'); }
  }
}

function companionAct(c: Ctx, u: Combatant) {
  const d = COMPANIONS[u.companion!];
  const me = pcUnit(c);
  if (u.companion === 'alistair' && has(me, 'unconscious') && !c.flag('one_more_round_used')) {
    c.set('one_more_round_used');
    const h = roll(c.rng, '2d4+2').total;
    c.narr('Alistair kneels, pours something questionable down your throat, and slaps your cheek with a bony hand. "One more round, brother. One. More. Round."');
    healUnit(c, me, h);
    c.out('good', `+${h} HP.`);
    return;
  }
  if (has(u, 'prone')) del(u, 'prone');
  const foes = livingFoes(c);
  if (!foes.length) return;
  const t = foes.slice().sort((a, b) => a.hp - b.hp)[0];
  const adv = combineAdv(has(t, 'prone') || has(t, 'guided'), false);
  const r = d20(c.rng, adv);
  const tot = r.natural + d.toHit;
  const crit = r.natural === 20;
  const hit = crit || (r.natural !== 1 && tot >= t.ac);
  if (!hit) { c.out('miss', `${d.name} ${d.verb} at ${t.name} and misses.`); return; }
  const dmg = roll(c.rng, d.damage, crit).total;
  if (u.companion === 'alistair' && die(c.rng, 3) === 1) c.say('alistair', pick(c.rng, ['"Watch this watch this WATCH THIS—"', '"Brother, are you seeing this?"', '"I used to be able to do this all day!"', '"Chill touch! Get it? Because I\'m chill!"']));
  hurtFoe(c, t, dmg, d.dtype, { crit, before: (dealt) => c.out('hit', `${d.name} ${d.verb} ${t.name}: ${dealt} ${d.dtype}.`) });
}

function deathSave(c: Ctx) {
  const me = pcUnit(c);
  const pc = c.pc;
  if (has(me, 'stable')) return;
  const r = d20(c.rng).natural;
  if (r === 20) { me.hp = 1; pc.hp = 1; del(me, 'unconscious'); c.out('good', '🎲 Death save: 20! You gasp awake with 1 HP.'); return; }
  if (r === 1) pc.deathSaves.fail += 2; else if (r >= 10) pc.deathSaves.ok += 1; else pc.deathSaves.fail += 1;
  c.out('roll', `🎲 Death save: ${r} — ${pc.deathSaves.ok} success, ${pc.deathSaves.fail} failure.`);
  if (pc.deathSaves.ok >= 3) { add(me, 'stable'); c.out('good', 'You stabilise. Still unconscious, but you will live.'); }
  if (pc.deathSaves.fail >= 3) defeat(c, 'death');
}

function syncAfterCombat(c: Ctx) {
  const cb = c.s.combat!;
  const me = pcUnit(c);
  c.pc.hp = Math.max(0, me.hp);
  for (const u of cb.units) if (u.companion) c.s.companionHp[u.companion] = has(u, 'unconscious') ? 1 : u.hp;
  c.pc.equipped.worn = c.pc.equipped.worn.filter((w) => w !== 'blessed');
  c.advance(1);
}

function victory(c: Ctx) {
  const cb = c.s.combat!;
  const enc = ENCOUNTERS[cb.encounterId];
  const me = pcUnit(c);
  if (has(me, 'unconscious')) { me.hp = 1; c.narr('You come to with your companions standing over you.'); }
  syncAfterCombat(c);
  let xp = 0;
  const pelts = cb.units.filter((u) => u.monster === 'wolf' && has(u, 'dead')).length;
  for (const u of cb.units.filter((x) => x.side === 'foe')) {
    const def = mdef(u)!;
    if (has(u, 'dead') || has(u, 'surrendered')) xp += def.xp;
    else if (has(u, 'fled')) xp += Math.floor(def.xp / 2);
  }
  const merah = cb.units.find((u) => u.monster === 'merah');
  c.s.combat = null;
  c.out('title', 'Victory');
  if (xp) c.xp(xp);
  if (pelts) { c.give('wolf_pelt', pelts); c.narr(`You skin the wolf${pelts > 1 ? 'ves' : ''}. ${pelts} pelt${pelts > 1 ? 's' : ''} for Hetch. (The dead one isn't worth skinning.)`); }
  if (cb.encounterId === 'courier') courierLoot(c);
  if (merah) {
    if (has(merah, 'dead')) merahDead(c);
    else if (has(merah, 'surrendered')) { c.set('merah_surrendered'); c.sys('Merah sits on the stair, hands raised. Spare her, or finish her?'); }
  }
  for (const u of cb.units) if (u.companion === 'alistair' && has(u, 'unconscious')) { c.narr('The heap of bones on the floor rattles, then assembles itself, joint by joint. "Ugh. Hate that. Did anybody touch the coat?"'); c.s.companionHp.alistair = 10; }
  for (const u of cb.units) if (u.companion === 'kettle' && has(u, 'unconscious')) { c.narr('Kettle limps back to his feet, shakes himself, and wags.'); c.s.companionHp.kettle = 4; }
  enc?.onWin?.(c);
}

function defeat(c: Ctx, why: 'down' | 'death' | 'surrender') {
  const cb = c.s.combat!;
  const pc = c.pc;
  const region = (c.s.loc in WAKE) ? WAKE[c.s.loc] : 'breda_square';
  const to = region;
  c.s.combat = null;
  c.out('title', 'Darkness');
  c.narr(why === 'death' ? 'You die. You are sure of it: the cold, the quiet, the long way down. And then a woman\'s voice, very kind, very far away: "Not yet, little candle. I need you to remember me."' : 'Everything goes dark.');
  // Fail forward: wake at dawn, poorer.
  const h = c.hour();
  const toDawn = ((24 - h) + 6) % 24 || 24;
  c.advance(toDawn * 60);
  pc.hp = Math.max(1, Math.floor(pc.maxHp / 2));
  pc.conditions = []; pc.deathSaves = { ok: 0, fail: 0 };
  const lost = Math.floor(pc.copper / 4);
  pc.copper -= lost;
  const valuables = pc.inventory.filter((s) => { const it = ITEMS[s.id]; return it && it.kind !== 'key' && it.kind !== 'note' && s.id !== pc.equipped.main && s.id !== pc.equipped.armor && s.id !== pc.equipped.shield && s.id !== pc.equipped.ranged && !pc.equipped.worn.includes(s.id) && it.price > 0; });
  let lostItem = '';
  if (valuables.length) { const v = pick(c.rng, valuables); lostItem = ITEMS[v.id].name; removeItem(pc, v.id, 1); }
  for (const id of c.s.companions) c.s.companionHp[id] = Math.max(1, Math.floor(COMPANIONS[id].maxHp / 2));
  c.s.chaos = Math.min(9, c.s.chaos + 1);
  c.s.loc = to; c.s.talkingTo = null;
  c.narr(`You wake at dawn${to === 'breda_square' ? ' at the edge of Breda' : to === 'kessels_rest' ? " at Kessel's Rest, curled under the dome of the old wayshrine" : ', on cold ground'}, aching, alive. ${lost || lostItem ? `Someone went through your pack while you were out${lost ? `: ${Math.round(lost / 100)} gold is gone` : ''}${lostItem ? `${lost ? ', and so is' : ': gone is'} your ${lostItem.toLowerCase()}` : ''}.` : ''} The dead didn't kill you. They wanted you to wake up and remember.`);
  c.sys(`You have ${pc.hp}/${pc.maxHp} HP. (Undead in Lahti knock people down rather than kill them. Something wants witnesses.)`);
}

export function attackNpcOutside(c: Ctx, npcId: string) {
  // handled by content's onAttack
}
export { addItem, isProficient, attackAbility, saveBonus };
