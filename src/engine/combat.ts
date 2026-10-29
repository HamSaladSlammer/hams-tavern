// Turn-based combat. The player acts on their turn through parsed intents; foes and
// companions act automatically. Defeat never ends the game: the Pale Queen wants witnesses.
import type { Ctx } from '../content/types';
import { ENCOUNTERS, courierLoot, checkChapelDone } from '../content/world';
import { d20, die, fmtMod, mod, pick, roll, combineAdv, type Adv } from './dice';
import { MONSTERS, SPELLS, ITEMS, UNARMED, WEAPONS } from './srd';
import type { Combatant, Condition, MonsterDef, WeaponDef, DamageType } from './types';
import {
  am, armorClass, attackAbility, hasItem, isProficient, prof, removeItem, addItem, saveBonus, spellAttack, spellDC, spellMod,
  weaponById, weaponDamageExpr, weaponToHit, initiativeBonus, species, variant, IMPROVISED, itemName,
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
const disabled = (u: Combatant) => down(u) || has(u, 'asleep') || has(u, 'charmed');
const mdef = (u: Combatant): MonsterDef | undefined => (u.monster ? MONSTERS[u.monster] : undefined);
const isUndead = (u: Combatant) => !!mdef(u)?.tags.includes('undead');

const WAKE: Record<string, string> = { chapel_yard: 'kessels_rest', nave: 'kessels_rest', vestry: 'kessels_rest', tower: 'kessels_rest', crypt: 'kessels_rest', kessels_rest: 'kessels_rest', foothills: 'foothills', thornwood: 'breda_square', breda_square: 'breda_square' };

export function inCombat(c: Ctx) { return !!c.s.combat; }
export function unit(c: Ctx, key: string) { return c.s.combat!.units.find((u) => u.key === key)!; }
export const pcUnit = (c: Ctx) => unit(c, 'pc');
export const livingFoes = (c: Ctx) => c.s.combat!.units.filter((u) => u.side === 'foe' && !down(u));
const res = (c: Ctx, id: string) => { const r = c.pc.resources[id]; return r && r.used < r.max ? r : null; };

export function pcAC(c: Ctx): number {
  let ac = armorClass(c.pc);
  if (c.pc.conditions.includes('wildshape')) ac = Math.max(ac, 13);
  if (!c.s.combat) return ac;
  const me = pcUnit(c);
  if (has(me, 'shield_spell')) ac += 5;
  if (has(me, 'shielded')) ac += 2;
  if (has(me, 'shifted')) ac += 1;
  if (has(me, 'shell')) ac += 4;
  return ac;
}

function pcResists(c: Ctx, dtype: DamageType): boolean {
  const sp = species(c.pc);
  const vr = variant(c.pc);
  if (sp.resist?.includes(dtype) || vr?.resist?.includes(dtype)) return true;
  if (c.s.combat && has(pcUnit(c), 'raging') && ['bludgeoning', 'piercing', 'slashing', 'necrotic'].includes(dtype)) return true;
  return false;
}

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
  for (const u of units) {
    let bonus = 0;
    if (u.isPc) bonus = initiativeBonus(pc);
    else if (u.companion) bonus = COMPANIONS[u.companion].dex;
    else bonus = mod(mdef(u)!.abilities.dex);
    const adv: Adv = u.isPc && ((c.flag('yard_warned') && encId === 'yard') || pc.feat === 'watchful') ? 'adv' : 'none';
    u.init = d20(c.rng, adv).natural + bonus + (u.isPc ? 0.5 : u.side === 'party' ? 0.25 : 0);
  }
  if (enc.ambush && pc.feat !== 'watchful') for (const u of units) if (u.side === 'foe') u.init += 10;
  units.sort((a, b) => b.init - a.init);
  c.s.combat = { round: 1, order: units.map((u) => u.key), turn: 0, units, encounterId: encId, usedAction: false, usedBonus: false, sneakUsed: false, fleeTo: enc.fleeTo };
  c.set('cb_last_hit', ''); c.set('cb_surprise_used', false); c.set('cb_charge_used', false);
  c.out('title', '⚔ Combat');
  c.narr(enc.intro);
  c.sys('Initiative: ' + units.map((u) => `${u.name} ${Math.floor(u.init)}`).join(' · '));
  runUntilPlayer(c);
}

function currentUnit(c: Ctx): Combatant { const cb = c.s.combat!; return unit(c, cb.order[cb.turn]); }
function nextTurn(c: Ctx) { const cb = c.s.combat!; cb.turn += 1; if (cb.turn >= cb.order.length) { cb.turn = 0; cb.round += 1; } }

export function afterPlayerAction(c: Ctx) {
  if (!c.s.combat) return;
  if (checkEnd(c)) return;
  const cb = c.s.combat;
  if (cb.usedAction && (cb.usedBonus || !bonusOptions(c).length)) endPlayerTurn(c);
}

export function endPlayerTurn(c: Ctx) { if (!c.s.combat) return; nextTurn(c); runUntilPlayer(c); }

export function bonusOptions(c: Ctx): string[] {
  const cb = c.s.combat!;
  if (cb.usedBonus) return [];
  const pc = c.pc;
  const me = pcUnit(c);
  const o: string[] = [];
  const hurt = pc.hp < pc.maxHp * 0.6;
  if (res(c, 'second_wind') && pc.hp < pc.maxHp) o.push('second wind');
  if (hasItem(pc, 'potion_healing') && hurt) o.push('drink potion');
  if (pc.cls === 'monk' && cb.usedAction) o.push('punch');
  if (res(c, 'focus') && cb.usedAction && pc.cls === 'monk') o.push('flurry of blows');
  if (pc.spells.includes('healing_word') && pc.slots.used < pc.slots.max && (pc.hp < pc.maxHp * 0.5 || cb.units.some((u) => u.companion && has(u, 'unconscious')))) o.push('cast healing word');
  if (pc.cls === 'rogue' && pc.level >= 2) o.push('hide');
  if (pc.cls === 'barbarian' && res(c, 'rage') && !has(me, 'raging')) o.push('rage');
  if (pc.cls === 'bard' && res(c, 'inspiration_die') && !has(me, 'inspired')) o.push('bardic inspiration');
  if (pc.cls === 'paladin' && res(c, 'lay_on_hands') && hurt) o.push('lay on hands');
  if (pc.cls === 'paladin' && pc.spells.includes('divine_smite') && c.flag('cb_last_hit') && pc.slots.used < pc.slots.max) o.push('smite');
  if (pc.cls === 'sorcerer' && res(c, 'innate') && !has(me, 'sorcery')) o.push('innate sorcery');
  if (pc.cls === 'druid' && res(c, 'wild_shape') && !pc.conditions.includes('wildshape')) o.push('wild shape');
  if (pc.spells.includes('hunters_mark') && !cb.units.some((u) => has(u, 'marked')) && (res(c, 'favored') || pc.slots.used < pc.slots.max)) o.push("cast hunter's mark");
  if (pc.spells.includes('hex') && !cb.units.some((u) => has(u, 'hexed')) && pc.slots.used < pc.slots.max) o.push('cast hex');
  const sp = species(pc).power;
  if (sp && res(c, sp.id) && ['adrenaline', 'fury', 'cry', 'shell', 'shifting', 'hidden_step', 'hungry_jaws'].includes(sp.id)) o.push(sp.name.toLowerCase());
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
      c.set('cb_last_hit', '');
      del(u, 'dodging'); del(u, 'shield_spell'); del(u, 'reckless'); del(u, 'shell');
      if (has(u, 'prone') && !has(u, 'unconscious')) { del(u, 'prone'); c.narr('You scramble back to your feet.'); }
      if (has(u, 'unconscious')) {
        deathSave(c);
        if (!c.s.combat) return;
        nextTurn(c);
        continue;
      }
      c.sys(`Round ${cb.round} — your turn. ${u.hp}/${u.maxHp} HP${c.pc.tempHp ? ` (+${c.pc.tempHp} temp)` : ''}.`);
      return;
    }
    if (!down(u)) {
      if (u.side === 'foe') foeAct(c, u);
      else companionAct(c, u);
      add(u, 'acted');
    }
    if (!c.s.combat) return;
    nextTurn(c);
  }
}

function checkEnd(c: Ctx): boolean {
  const cb = c.s.combat;
  if (!cb) return true;
  const foes = cb.units.filter((u) => u.side === 'foe');
  if (foes.every((u) => out(u) || has(u, 'frightened') || has(u, 'charmed'))) { victory(c); return true; }
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
  const dmg = Math.floor(amount * mult);
  opts.before?.(dmg);
  if (mult === 2) c.sys(`${t.name} is vulnerable to ${dtype}: double damage.`);
  if (mult === 0) c.sys(`${t.name} is immune to ${dtype}.`);
  t.hp -= dmg;
  if (dmg > 0 && has(t, 'asleep')) { del(t, 'asleep'); c.narr(`${t.name} jolts awake.`); }
  if (dmg > 0 && has(t, 'charmed')) { del(t, 'charmed'); c.narr(`The charm breaks. ${t.name} looks betrayed.`); }
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
    if (c.pc.cls === 'warlock' && c.pc.options.patron === 'green') { c.pc.tempHp = Math.max(c.pc.tempHp, c.pc.level); c.sys(`The Rot That Feeds: +${c.pc.level} temporary HP.`); }
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
    if (pcResists(c, dtype)) { dmg = Math.floor(dmg / 2); }
    const st = res(c, 'stone');
    if (st && dmg >= 6) { st.used += 1; const red = roll(c.rng, '1d12').total + am(pc, 'con'); dmg = Math.max(0, dmg - red); c.sys(`Stone's Endurance: you shrug off ${red} damage.`); }
    if (pc.conditions.includes('wildshape') && pc.wildHp > 0) {
      const a = Math.min(pc.wildHp, dmg); pc.wildHp -= a; dmg -= a;
      if (pc.wildHp <= 0) { pc.conditions = pc.conditions.filter((x) => x !== 'wildshape'); c.narr('The wolf-shape tears away and you\'re yourself again, gasping.'); }
    }
    if (pc.tempHp) { const a = Math.min(pc.tempHp, dmg); pc.tempHp -= a; dmg -= a; }
    announce(dmg);
    t.hp -= dmg;
    if (t.hp <= 0) {
      const rel = res(c, 'relentless');
      const tf = res(c, 'treaty_fire');
      if (rel) { rel.used += 1; t.hp = 1; c.out('good', 'Relentless Endurance: you should be down. You refuse. 1 HP.'); }
      else if (tf) {
        tf.used += 1; t.hp = 1;
        c.out('good', 'Treaty-Fire Blood: your magic flares white-hot. You stay standing with 1 HP, and fire rolls off you in a ring.');
        for (const f of livingFoes(c)) hurtFoe(c, f, roll(c.rng, '1d6').total, 'fire', { before: (d) => c.out('roll', `💥 ${f.name} takes ${d} fire.`) });
      } else {
        t.hp = 0; add(t, 'unconscious'); pc.deathSaves = { ok: 0, fail: 0 };
        pc.conditions = pc.conditions.filter((x) => x !== 'wildshape');
        del(t, 'raging');
        c.out('bad', 'You go down. The world tilts, goes grey, goes quiet.');
        c.s.stats.knockouts += 1;
      }
    }
    pc.hp = Math.max(0, t.hp);
    t.ac = pcAC(c);
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

// ---------- targeting ----------
export function resolveTarget(c: Ctx, name?: string, side: 'foe' | 'party' = 'foe'): Combatant | null {
  const cb = c.s.combat!;
  const pool = cb.units.filter((u) => u.side === side && !has(u, 'dead') && !has(u, 'fled'));
  if (!pool.length) return null;
  const alive = pool.filter((u) => !has(u, 'surrendered'));
  if (!name || /^(it|him|her|them|enemy|foe|target|one|anyone|anything)$/.test(name)) {
    const last = c.s.lastTarget ? pool.find((u) => u.key === c.s.lastTarget) : undefined;
    if (last && !down(last)) return last;
    return (alive.length ? alive : pool).slice().sort((a, b) => a.hp - b.hp)[0];
  }
  if (side === 'party' && /^(me|myself|self)$/.test(name)) return pool.find((u) => u.isPc) ?? null;
  const n = name.toLowerCase().replace(/\s+#?(\d+)$/, ' $1');
  const exact = pool.find((u) => u.name.toLowerCase() === n);
  if (exact) return exact;
  const num = n.match(/(\d+)$/)?.[1];
  const ord = /\b(second|2nd)\b/.test(n) ? 2 : /\b(third|3rd)\b/.test(n) ? 3 : /\b(first|1st)\b/.test(n) ? 1 : num ? parseInt(num, 10) : 0;
  const word = n.replace(/\b(second|2nd|third|3rd|first|1st|other|last)\b/g, '').replace(/\d+/g, '').replace(/'s\b.*$/, '').trim();
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

/** Improvised weapons: anything you can swing or throw. */
export function improvised(name: string, thrown = false): WeaponDef {
  const base = WEAPONS.find((w) => w.id === 'club_improvised')!;
  const sharp = /bottle|glass|shard|knife|fork|sickle|nail/.test(name);
  const fire = /torch|candle|brand|lamp|lantern/.test(name);
  return { ...base, name: name.charAt(0).toUpperCase() + name.slice(1), dtype: fire ? 'fire' : sharp ? 'slashing' : 'bludgeoning', damage: fire ? '1d4' : '1d4', ranged: thrown, thrown: true };
}

function chooseWeapon(c: Ctx, style: AttackStyle, named?: string): WeaponDef | string {
  const pc = c.pc;
  if (pc.conditions.includes('wildshape')) return { ...UNARMED, id: 'wild_bite', name: 'Wolf Bite', damage: '2d4', dtype: 'piercing' };
  if (style === 'unarmed') return UNARMED;
  if (named) {
    const nm = named.toLowerCase().replace(/^(my|the|a|an)\s+/, '');
    if (/^(fist|fists|hand|hands|foot|feet|knee|knees|elbow|head|bare hands|palm|claws?|teeth|horns?|hooves|talons)$/.test(nm)) return UNARMED;
    const stack = pc.inventory.find((s) => { const it = ITEMS[s.id]; return it?.weapon && it.weapon.id !== 'club_improvised' && (it.name.toLowerCase().includes(nm) || nm.includes(it.name.toLowerCase()) || it.weapon.id.replace(/_/g, ' ').includes(nm) || (/gun|pistol|revolver/.test(nm) && it.weapon.category === 'firearm') || (nm === 'bow' && /bow/.test(it.id)) || (nm === 'sword' && /sword/.test(it.id)) || (nm === 'axe' && /axe/.test(it.id))); });
    if (stack) return ITEMS[stack.id].weapon!;
    const imp = pc.inventory.find((s) => IMPROVISED.includes(s.id) && (ITEMS[s.id].name.toLowerCase().includes(nm) || ITEMS[s.id].aliases?.some((a) => a === nm || nm.includes(a))));
    if (imp) return { ...improvised(ITEMS[imp.id].name.toLowerCase(), style === 'thrown'), id: `imp:${imp.id}` };
    const prop = (c.s.props[c.s.loc] ?? []).find((p) => !p.gone && !p.broken && p.tags.includes('weapon') && (p.name.includes(nm) || nm.includes(p.name)));
    const roomProp = findCombatProp(c, nm);
    if (prop || roomProp) return { ...improvised(nm, style === 'thrown'), id: `prop:${nm}` };
    return `You don't have a ${named}.`;
  }
  if (style === 'ranged') {
    const r = weaponById(pc.equipped.ranged) ?? weaponById(pc.equipped.main);
    if (!r || !r.ranged) return 'You have no ranged weapon ready. ("equip revolver", or attack with what you\'re holding.)';
    return r;
  }
  if (style === 'thrown') return 'Throw what? (e.g. "throw dagger at zombie")';
  return weaponById(pc.equipped.main) ?? UNARMED;
}

// a lightweight hook the world can answer: "is there a chair/bone/candle here to grab?"
let PROP_FINDER: (c: Ctx, noun: string) => boolean = () => false;
export function bindPropFinder(f: (c: Ctx, noun: string) => boolean) { PROP_FINDER = f; }
function findCombatProp(c: Ctx, noun: string) { return PROP_FINDER(c, noun); }

export function playerAttack(c: Ctx, style: AttackStyle, verb: string, targetName?: string, weaponName?: string, limb?: string) {
  const cb = c.s.combat!;
  const pc = c.pc;
  const w = chooseWeapon(c, style, weaponName);
  if (typeof w === 'string') { c.sys(w); return; }
  const t = resolveTarget(c, targetName);
  if (!t) { c.sys(targetName ? `You don't see "${targetName}" here to fight.` : 'There\'s nothing left to fight.'); return; }
  if (has(t, 'surrendered')) { c.sys(`${t.name} has surrendered. Type "finish ${t.name.toLowerCase()}" if you really mean it, or "spare".`); return; }
  let bonus = false;
  if (cb.usedAction && pc.cls === 'monk' && (w.id === 'unarmed' || w.id.startsWith('imp:') || w.id.startsWith('prop:') || (w.category === 'simple' && !w.twoHanded)) && !cb.usedBonus) bonus = true;
  if (cb.usedAction && !bonus) { c.sys('You have already used your action this turn. (Type "end turn".)'); return; }
  if (w.category === 'firearm') {
    if (pc.equipped.main !== w.id && pc.equipped.ranged !== w.id) pc.equipped.ranged = w.id;
    if (c.flag(`jam_${w.id}`)) { c.sys(`Your ${w.name} is jammed. ${pc.cls === 'fighter' ? 'Clear it as a bonus action' : 'Spend an action to clear it'} ("unjam").`); return; }
    if ((pc.ammo[w.id] ?? 0) <= 0) { c.sys(`Click. Your ${w.name} is empty. ("reload")`); return; }
  }
  if (w.ammo === 'arrow' && !hasItem(pc, 'arrow')) { c.sys('You\'re out of arrows.'); return; }
  if (w.thrown && style === 'thrown' && !w.id.startsWith('imp:') && !w.id.startsWith('prop:') && !hasItem(pc, w.id)) { c.sys(`You don't have a ${w.name}.`); return; }
  useAction(c, bonus);
  if (bonus) c.sys('Martial Arts: a bonus-action strike.');
  doAttack(c, t, w, style, verb, limb);
  c.s.lastTarget = t.key;
  afterPlayerAction(c);
}

function luckyReroll(c: Ctx, natural: number, total: number, ac: number): { natural: number; extra: number; note?: string } {
  const pc = c.pc;
  const me = pcUnit(c);
  if (total >= ac || natural === 20) return { natural, extra: 0 };
  // Bardic inspiration on yourself
  if (has(me, 'inspired') && ac - total <= 6) { del(me, 'inspired'); const d = die(c.rng, 6); return { natural, extra: d, note: `Bardic Inspiration +${d}` }; }
  const fort = res(c, 'fortune');
  if (fort && ac - total <= 3 && natural !== 1) { fort.used += 1; const allies = c.s.combat!.units.filter((u) => u.side === 'party' && !u.isPc && !down(u)).length; const b = Math.min(3, Math.max(1, allies)); return { natural, extra: b, note: `Fortune from the Many +${b}` }; }
  const luck = res(c, 'luck_points');
  if (luck && ac - total >= 2) { luck.used += 1; const r = die(c.rng, 20); return { natural: r, extra: 0, note: `Survivor's Luck reroll: ${r}` }; }
  return { natural, extra: 0 };
}

function doAttack(c: Ctx, t: Combatant, w: WeaponDef, style: AttackStyle, verb: string, limb?: string) {
  const pc = c.pc;
  const me = pcUnit(c);
  const ranged = w.ranged || style === 'thrown';
  const strMelee = !ranged && attackAbility(pc, w) === 'str';
  const advFlag = has(me, 'hidden') || has(t, 'guided') || has(t, 'restrained') || has(t, 'faerie') || has(t, 'asleep') || has(me, 'cry') || (!ranged && has(t, 'prone')) || (has(me, 'reckless') && strMelee);
  const disFlag = has(me, 'prone') || (ranged && has(t, 'prone')) || (pc.drunk >= 3);
  const adv = combineAdv(advFlag, disFlag);
  del(me, 'hidden'); del(t, 'guided'); del(me, 'cry');
  let r = d20(c.rng, adv);
  if (r.natural === 1 && species(pc).flags?.includes('luck')) { c.sys('Halfling luck: rerolling the 1.'); r = d20(c.rng, 'none'); }
  const wild = w.id === 'wild_bite';
  const toHit = wild ? prof(pc) + Math.max(am(pc, 'str'), am(pc, 'dex'), am(pc, 'wis')) : weaponToHit(pc, w);
  const bless = has(me, 'blessed') ? die(c.rng, 4) : 0;
  let natural = r.natural;
  let total = natural + toHit + bless;
  const lk2 = luckyReroll(c, natural, total, t.ac);
  if (lk2.note) { natural = lk2.natural; total = natural + toHit + bless + lk2.extra; c.sys(lk2.note); }
  const crit = natural === 20 || (has(t, 'asleep') && !ranged);
  const hit = crit || (natural !== 1 && total >= t.ac);
  c.out('roll', `🎲 ${w.name} vs ${t.name}: d20${r.rolls.length > 1 ? `(${r.rolls.join(',')} ${r.adv})` : ''} ${natural} ${fmtMod(toHit)}${bless ? ` +${bless} bless` : ''}${lk2.extra ? ` +${lk2.extra}` : ''} = ${total} vs AC ${t.ac}${crit ? ' — CRITICAL!' : hit ? ' — hit' : ' — miss'}`);
  if (w.category === 'firearm') {
    pc.ammo[w.id] = (pc.ammo[w.id] ?? 1) - 1;
    if (r.natural === 1) { c.set(`jam_${w.id}`, true); c.out('bad', `Your ${w.name} jams.`); }
    if (!c.flag('loud_warned')) { c.set('loud_warned'); c.sys('Gunfire carries a mile in open country.'); }
  }
  if (w.ammo === 'arrow') removeItem(pc, 'arrow');
  if (style === 'thrown') {
    if (w.id.startsWith('imp:')) { const id = w.id.slice(4); removeItem(pc, id); if (!/mug|bottle|egg|apple/.test(id)) (c.s.roomItems[c.s.loc] ??= []).push({ id, qty: 1 }); }
    else if (!w.id.startsWith('prop:')) { removeItem(pc, w.id); (c.s.roomItems[c.s.loc] ??= []).push({ id: w.id, qty: 1 }); }
  }
  const natural_wpn = species(pc).weapon;
  const isUnarmed = w.id === 'unarmed' || wild;
  const lk = isUnarmed ? limbKey(verb, natural_wpn?.verbs) : null;
  const tname = /\d$/.test(t.name) || t.monster === 'merah' || t.companion ? t.name : `the ${t.name.toLowerCase()}`;
  const spot = limb ?? expand(c.rng, STRIKES, isUndead(t) ? 'undead_spot' : 'spot').toLowerCase();
  const improvisedHit = w.id.startsWith('imp:') || w.id.startsWith('prop:');
  if (!hit) {
    const line = lk ? expand(c.rng, STRIKES, `miss_${lk}`, { target: tname, verb: verbWord(verb), spot }) : improvisedHit ? `${w.name} misses ${tname}${style === 'thrown' ? ' and smashes somewhere behind it' : ''}` : expand(c.rng, WEAPON_HITS, w.category === 'firearm' ? 'miss_ranged' : w.ranged ? 'miss_bow' : 'miss_melee', { target: tname, weapon: w.name.toLowerCase(), verb });
    c.out('miss', line + '.');
    if (improvisedHit && /mug|bottle/.test(w.id) && style !== 'thrown') breakImprovised(c, w);
    return;
  }
  let expr = wild ? `2d4+${Math.max(am(pc, 'str'), am(pc, 'dex'), am(pc, 'wis'))}` : weaponDamageExpr(pc, w);
  let dtype: DamageType = w.dtype;
  if (isUnarmed && natural_wpn && !wild && (!lk || natural_wpn.verbs.some((v) => verb.includes(v)) || pc.cls !== 'monk')) dtype = natural_wpn.dtype;
  let dmg = roll(c.rng, expr, crit).total;
  if (pc.feat === 'savage' && !c.s.combat!.sneakUsed && !isUnarmed) { const second = roll(c.rng, expr, crit).total; if (second > dmg) dmg = second; }
  if (pc.feat === 'brawler' && (isUnarmed || improvisedHit) && dmg <= 1) dmg = roll(c.rng, expr, crit).total;
  if (pc.options.style === 'great' && w.twoHanded) dmg += 1;
  const extras: string[] = [];
  if (has(me, 'raging') && strMelee) { dmg += 2; extras.push('+2 rage'); }
  let sneak = 0;
  const allyNear = c.s.combat!.units.some((u) => u.side === 'party' && !u.isPc && !down(u));
  if (pc.cls === 'rogue' && !c.s.combat!.sneakUsed && (w.finesse || w.ranged) && (adv === 'adv' || allyNear) && adv !== 'dis') { sneak = roll(c.rng, '1d6', crit).total; c.s.combat!.sneakUsed = true; extras.push(`${sneak} sneak attack`); }
  dmg += sneak;
  if (has(t, 'marked')) { const d = roll(c.rng, pc.cls === 'ranger' && isUndead(t) ? '1d8' : '1d6', crit).total; dmg += d; extras.push(`${d} hunter's mark`); }
  if (has(me, 'fury')) { del(me, 'fury'); dmg += prof(pc); extras.push(`${prof(pc)} fury`); }
  if (species(pc).flags?.includes('surprise') && !c.flag('cb_surprise_used') && c.s.combat!.round === 1 && !has(t, 'acted')) { c.set('cb_surprise_used', true); const d = roll(c.rng, '2d6', crit).total; dmg += d; extras.push(`${d} surprise attack`); }
  if (species(pc).flags?.includes('charge') && isUnarmed && !c.flag('cb_charge_used')) { c.set('cb_charge_used', true); const d = roll(c.rng, '1d6', crit).total; dmg += d; extras.push(`${d} charge`); }
  dmg = Math.max(1, dmg);
  const line = lk ? expand(c.rng, STRIKES, `hit_${lk}`, { target: tname, verb: verbWord(verb), spot }) : improvisedHit ? improvisedLine(c, w.name.toLowerCase(), tname, style === 'thrown') : expand(c.rng, WEAPON_HITS, w.category === 'firearm' ? 'hit_ranged' : w.ranged ? 'hit_bow' : 'hit_melee', { target: tname, weapon: w.name.toLowerCase(), verb, spot });
  hurtFoe(c, t, dmg, dtype, { crit, silvered: w.silvered, before: (dealt) => { c.out('hit', line + '.'); c.out('roll', `💥 ${dealt} ${dtype} damage${extras.length ? ` (incl. ${extras.join(', ')})` : ''}${crit ? ' (critical)' : ''}.`); } });
  // after-hit riders
  if (has(t, 'hexed') && !down(t)) hurtFoe(c, t, roll(c.rng, '1d6').total, 'necrotic', { before: (d) => c.out('roll', `💥 Hex: +${d} necrotic.`) });
  if (has(me, 'divine_favor') && !ranged && !down(t)) hurtFoe(c, t, roll(c.rng, '1d4').total, 'radiant', { before: (d) => c.out('roll', `💥 Divine Favour: +${d} radiant.`) });
  if (has(me, 'jaws') && isUnarmed && /bite|chomp|gnaw|snap/.test(verb)) { del(me, 'jaws'); pc.tempHp = Math.max(pc.tempHp, prof(pc)); c.sys(`Hungry Jaws: +${prof(pc)} temporary HP.`); }
  if (species(pc).flags?.includes('hammering') && isUnarmed && !down(t) && !has(t, 'prone')) {
    const sv = d20(c.rng).natural + mod(mdef(t)!.abilities.str);
    if (sv < 8 + am(pc, 'str') + prof(pc)) { add(t, 'prone'); c.narr(`Your horns throw ${tname} to the ground.`); }
  }
  if (!ranged) c.set('cb_last_hit', t.key);
  if (improvisedHit) breakImprovised(c, w);
  if (!down(t)) c.sys(`${t.name}: ${hpWord(t)}.`);
}

function improvisedLine(c: Ctx, what: string, target: string, thrown: boolean) {
  if (thrown) return pick(c.rng, [`The ${what} flies end over end and cracks into ${target}`, `You hurl the ${what} and it bounces off ${target}'s skull`, `Your ${what} hits ${target} square on`]);
  return pick(c.rng, [`You smash the ${what} over ${target}`, `The ${what} connects with ${target} with a deeply satisfying crunch`, `You swing the ${what} into ${target}`]);
}

function breakImprovised(c: Ctx, w: WeaponDef) {
  const id = w.id.slice(w.id.indexOf(':') + 1);
  if (w.id.startsWith('imp:') && /mug|bottle|egg|apple/.test(id) && hasItem(c.pc, id)) {
    removeItem(c.pc, id);
    if (/bottle/.test(id)) c.narr('The bottle shatters. You\'re left holding the neck.');
    else if (/mug/.test(id)) c.narr('The mug breaks into three pieces. Squib will hear about this.');
  }
}

function hpWord(t: Combatant) {
  const f = t.hp / t.maxHp;
  return f > 0.75 ? 'barely scratched' : f > 0.4 ? 'hurt' : f > 0.15 ? 'badly hurt' : 'nearly finished';
}

function limbKey(verb: string, natural?: string[]): string {
  if (natural?.some((v) => verb.includes(v))) return /bite|chomp|gnaw|snap/.test(verb) ? 'teeth' : /ram|headbutt|butt|gore|horn/.test(verb) ? 'head' : /kick|stomp|trample|buck|hoof/.test(verb) ? 'foot' : 'nails';
  return UNARMED_VERBS[verb] ?? (/bite|chomp/.test(verb) ? 'teeth' : 'fist');
}
function verbWord(verb: string) { return verb.replace(/-/g, ' '); }

// ---------- spells ----------
export function findSpell(name: string) {
  const n = name.toLowerCase().trim();
  return Object.values(SPELLS).find((s) => s.aliases.includes(n) || s.name.toLowerCase() === n || s.id === n) ?? Object.values(SPELLS).find((s) => s.aliases.some((a) => n.startsWith(a)));
}

function useSlot(c: Ctx, level: number): boolean {
  if (level === 0) return true;
  const pc = c.pc;
  if (pc.slots.used >= pc.slots.max) return false;
  pc.slots.used += 1;
  return true;
}

export function playerCast(c: Ctx, spellName: string, targetName?: string) {
  const pc = c.pc;
  const sp = findSpell(spellName);
  if (!sp || (![...pc.cantrips, ...pc.spells].includes(sp.id))) { c.sys(sp ? `You don't know ${sp.name}.` : `You don't know a spell called "${spellName}". (Your sheet lists your spells.)`); return; }
  const cb = c.s.combat;
  if (cb && has(pcUnit(c), 'raging')) { c.sys('You can\'t cast spells while raging.'); return; }
  if (pc.conditions.includes('wildshape')) { c.sys('Wolves don\'t cast spells. ("revert" to change back.)'); return; }
  const freeMark = sp.id === 'hunters_mark' && !!res(c, 'favored');
  const freeArmor = sp.id === 'mage_armor' && pc.cls === 'warlock' && pc.options.invocation === 'armor';
  if (sp.level === 1 && !freeMark && !freeArmor && pc.slots.used >= pc.slots.max) { c.sys(`You have no spell slots left. They come back after a ${pc.cls === 'warlock' ? 'short' : 'long'} rest.`); return; }
  if (sp.id === 'divine_smite') { playerSmite(c); return; }
  if (!cb) { castOutside(c, sp.id, targetName); return; }
  if (!useAction(c, !!sp.bonusAction)) return;
  if (freeMark) res(c, 'favored')!.used += 1; else if (!freeArmor) useSlot(c, sp.level);
  const me = pcUnit(c);
  const dc = spellDC(pc) + (has(me, 'sorcery') ? 1 : 0);
  const sm = spellMod(pc);
  const undeadBonus = (t: Combatant) => (pc.cls === 'cleric' && pc.options.god === 'keeper' && sp.dtype === 'radiant' && isUndead(t) ? 2 : 0);
  if (sp.kind === 'attack') {
    let t = resolveTarget(c, targetName);
    if (!t) { c.sys('No target.'); cb.usedAction = false; if (sp.level) pc.slots.used -= 1; return; }
    const adv = combineAdv(has(me, 'hidden') || has(t, 'guided') || has(t, 'faerie') || has(t, 'restrained') || has(me, 'sorcery'), has(me, 'prone'));
    del(t, 'guided'); del(me, 'hidden');
    const r = d20(c.rng, adv);
    const tot = r.natural + spellAttack(pc);
    const crit = r.natural === 20;
    const hit = crit || (r.natural !== 1 && tot >= t.ac);
    c.out('roll', `🎲 ${sp.name} vs ${t.name}: ${r.rolls.length > 1 ? `(${r.rolls.join(',')}) ` : ''}${r.natural} ${fmtMod(spellAttack(pc))} = ${tot} vs AC ${t.ac}${crit ? ' — CRITICAL!' : hit ? ' — hit' : ' — miss'}`);
    if (!hit) { c.out('miss', `Your ${sp.name.toLowerCase()} goes wide.`); }
    else {
      let d = roll(c.rng, sp.damage!, crit).total + undeadBonus(t);
      let dtype = sp.dtype as DamageType;
      if (sp.id === 'eldritch_blast' && (pc.options.invocation === 'agonizing' || pc.options.invocation2 === 'agonizing')) d += Math.max(0, sm);
      if (sp.id === 'wild_spark') { const el = pick(c.rng, ['fire', 'cold', 'lightning', 'acid', 'thunder', 'poison'] as DamageType[]); dtype = el; d += roll(c.rng, '1d6').total; }
      const tt = t;
      hurtFoe(c, tt, d, dtype, { crit, before: (dealt) => { c.out('hit', spellHitLine(sp.id, tt.name, dtype)); c.out('roll', `💥 ${dealt} ${dtype} damage.`); } });
      if (sp.id === 'guiding_bolt' && !down(tt)) { add(tt, 'guided'); c.sys(`${tt.name} glows: the next attack against it has advantage.`); }
      if (sp.id === 'eldritch_blast' && pc.options.patron === 'drowned' && !down(tt)) c.narr(`The blast drags ${tt.name} toward you like an undertow.`);
      if (sp.id === 'hoarfrost_shard') for (const o of livingFoes(c).filter((u) => u !== tt).slice(0, 2)) { const sv = d20(c.rng).natural + mod(mdef(o)!.abilities.dex); let dd = roll(c.rng, '2d6').total; if (sv >= dc) dd = Math.floor(dd / 2); hurtFoe(c, o, dd, 'cold', { before: (x) => c.out('roll', `💥 The shard bursts: ${o.name} takes ${x} cold.`) }); }
      if (sp.id === 'wild_spark' && natural8(c)) { const o = livingFoes(c).find((u) => u !== tt); if (o) { const dd = roll(c.rng, '2d8').total; hurtFoe(c, o, dd, dtype, { before: (x) => c.out('hit', `The spark leaps to ${o.name}: ${x} ${dtype}.`) }); } }
      if (!down(tt)) c.sys(`${tt.name}: ${hpWord(tt)}.`);
    }
    c.s.lastTarget = t.key;
  } else if (sp.kind === 'save') {
    const targets = sp.aoe ? livingFoes(c).slice(0, sp.aoe) : [resolveTarget(c, targetName)].filter(Boolean) as Combatant[];
    if (!targets.length) { c.sys('No target.'); return; }
    c.out('hit', saveLine(sp.id));
    for (const t of targets) {
      const def = mdef(t)!;
      const sv = d20(c.rng).natural + mod(def.abilities[sp.save!]);
      const ok = sv >= dc;
      let dice = sp.damage!;
      if (sp.id === 'knell' && t.hp < t.maxHp) dice = '1d12';
      let d = roll(c.rng, dice).total + undeadBonus(t);
      if (sp.id === 'knell' && pc.options.patron === 'unremembered') d += roll(c.rng, '1d4').total;
      if (ok) d = sp.halfOnSave ? Math.floor(d / 2) : 0;
      c.out('roll', `🎲 ${t.name} ${sp.save!.toUpperCase()} save ${sv} vs DC ${dc}: ${ok ? 'saved' : 'failed'}`);
      if (d > 0) hurtFoe(c, t, d, sp.dtype as DamageType, { before: (dealt) => c.out('roll', `💥 ${t.name} takes ${dealt} ${sp.dtype}.`) });
      else c.out('miss', `${t.name} shrugs it off.`);
      if (!ok && !down(t) && sp.effect) applyEffect(c, t, sp.effect);
    }
  } else if (sp.kind === 'control') {
    const targets = sp.aoe ? livingFoes(c).slice(0, sp.aoe) : [resolveTarget(c, targetName)].filter(Boolean) as Combatant[];
    if (!targets.length) { c.sys('No target.'); return; }
    c.out('hit', saveLine(sp.id));
    for (const t of targets) {
      const def = mdef(t)!;
      if (sp.effect === 'asleep' && (def.tags.includes('undead') || def.tags.includes('construct'))) { c.out('miss', `${t.name} doesn't sleep. It hasn't for a long time.`); continue; }
      if (sp.effect === 'charmed' && !def.tags.includes('humanoid')) { c.out('miss', `${t.name} isn't a person. The charm finds nothing to hold on to.`); continue; }
      if (sp.effect === 'frightened' && def.tags.includes('undead') && t.monster !== 'skeleton') { /* undead can still be frightened */ }
      const sv = d20(c.rng).natural + mod(def.abilities[sp.save!]);
      c.out('roll', `🎲 ${t.name} ${sp.save!.toUpperCase()} save ${sv} vs DC ${dc}: ${sv >= dc ? 'saved' : 'failed'}`);
      if (sv < dc) applyEffect(c, t, sp.effect!);
      else c.out('miss', `${t.name} resists.`);
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
    const target = targetName && !/^(me|myself|self)$/.test(targetName) ? (resolveTarget(c, targetName, 'party') ?? me) : me;
    if (target.companion === 'alistair') { c.narr('Healing light washes over Alistair, and he yelps. "OW. Brother. Undead. That\'s the opposite of what I need."'); afterPlayerAction(c); return; }
    const h = roll(c.rng, sp.damage!).total + Math.max(0, sm) + (pc.cls === 'cleric' && pc.options.god === 'hearth' ? 2 : 0);
    healUnit(c, target, h);
    c.out('good', `${sp.name}: ${target.isPc ? 'you heal' : `${target.name} heals`} ${h} HP.`);
  } else if (sp.kind === 'buff') {
    if (sp.id === 'bless') { for (const u of cb.units.filter((u) => u.side === 'party' && !down(u))) add(u, 'blessed'); c.out('good', 'A warm light settles on your shoulders and your allies\'. (+1d4 to attack rolls this fight.)'); }
    else if (sp.id === 'shield') { add(me, 'shield_spell'); c.out('good', `A shimmering barrier springs up. AC ${pcAC(c)} until your next turn.`); }
    else if (sp.id === 'shield_of_faith') { add(me, 'shielded'); c.out('good', `A glowing field surrounds you. AC ${pcAC(c)} for this fight.`); }
    else if (sp.id === 'divine_favor') { add(me, 'divine_favor'); c.out('good', 'Your weapon glows with radiant light: +1d4 radiant on your hits this fight.'); }
    else if (sp.id === 'shillelagh') { if (!pc.conditions.includes('shillelagh')) pc.conditions.push('shillelagh'); c.out('good', 'Your staff swells with the strength of the Thornwood: it hits with your Wisdom for 1d8.'); }
    else if (sp.id === 'mage_armor') castOutside(c, 'mage_armor');
  } else if (sp.kind === 'mark') {
    const t = resolveTarget(c, targetName);
    if (!t) { c.sys('Mark whom?'); return; }
    add(t, sp.id === 'hex' ? 'hexed' : 'marked');
    c.out('good', sp.id === 'hex' ? `You curse ${t.name}. Something in the air around it sours. (+1d6 necrotic on your hits.)` : `You mark ${t.name} as your quarry. (+${pc.cls === 'ranger' && isUndead(t) ? '1d8' : '1d6'} on your weapon hits.)`);
    c.s.lastTarget = t.key;
  } else {
    flavorCantrip(c, sp.id);
  }
  afterPlayerAction(c);
}

function natural8(c: Ctx) { return die(c.rng, 8) >= 5; }

function applyEffect(c: Ctx, t: Combatant, e: string) {
  if (e === 'restrained') { add(t, 'restrained'); c.out('good', `Grasping weeds wrap ${t.name}. It's restrained.`); }
  else if (e === 'frightened') { add(t, 'frightened'); c.out('good', `${t.name} sees something you can't, and cowers.`); }
  else if (e === 'charmed') { add(t, 'charmed'); c.out('good', `${t.name} lowers its weapon and looks at you like an old friend.`); }
  else if (e === 'asleep') { add(t, 'asleep'); c.out('good', `${t.name} slumps and starts to snore.`); }
  else if (e === 'prone') { add(t, 'prone'); c.out('good', `${t.name} goes sprawling.`); }
  else if (e === 'halted') { add(t, 'halted'); c.out('good', `"HALT." ${t.name} stops dead.`); }
  else if (e === 'faerie') { add(t, 'faerie'); c.out('good', `${t.name} is outlined in violet light. Attacks against it have advantage.`); }
  else if (e === 'mocked' || e === 'frostbit') { add(t, e as Condition); c.sys(`${t.name} has disadvantage on its next attack.`); }
  else if (e === 'pushed') { c.narr(`${t.name} is knocked back several feet.`); }
}

function saveLine(id: string) {
  const L: Record<string, string> = {
    burning_hands: 'A sheet of fire fans from your fingertips.', thunderwave: 'A wave of thunder booms out from you.', sacred_flame: 'Radiant flame drops on your target like a falling star.',
    vicious_mockery: 'You say something so cutting that magic carries it.', knell: 'Somewhere a bell tolls once, for one listener only.', frostbite: 'Frost blooms on your target\'s skin.',
    thunderclap: 'You clap your hands and the air cracks like a rifle shot.', mire_gnats: 'A cloud of biting Mire-gnats boils up out of nowhere.', hearthword: 'You speak a word that smells of bread and woodsmoke, and light flares.',
    bonfire: 'Flames leap up from the ground.', dissonant_whispers: 'You hum a tune only your target can hear. It hates it.', inflict_wounds: 'Your hand goes black and you press it home.',
    tremor: 'You stamp, and the ground heaves.', sleep: 'A heavy silver drowsiness rolls out from your hand.', charm_person: 'You smile your warmest smile, with magic behind it.',
    command: 'You speak one word with the weight of a crown behind it.', faerie_fire: 'Violet light blooms in the air.', entangle: 'Weeds and roots burst up through the ground.', dread: 'You show your target its own grave.',
  };
  return L[id] ?? 'You cast.';
}

function spellHitLine(id: string, name: string, dtype?: string) {
  if (id === 'fire_bolt') return `A mote of fire streaks across the room and bursts against ${name}.`;
  if (id === 'ray_of_frost') return `A pale beam of cold strikes ${name}, rimed in frost.`;
  if (id === 'guiding_bolt') return `A flash of light lances into ${name}, and it keeps glowing.`;
  if (id === 'eldritch_blast') return `A crackling beam of something old and hungry slams into ${name}.`;
  if (id === 'chill_touch') return `Your hand goes grave-cold and you clamp it on ${name}.`;
  if (id === 'shocking_grasp') return `Lightning snaps from your fingers into ${name}.`;
  if (id === 'produce_flame') return `You hurl the flame in your palm at ${name}.`;
  if (id === 'thorn_whip') return `A thorny vine lashes ${name}.`;
  if (id === 'greens_bite') return `Your nails turn to thorns and rake ${name}.`;
  if (id === 'poison_spray') return `A puff of green gas catches ${name} full in the face.`;
  if (id === 'wild_spark') return `Raw sorcery crackles out, turns ${dtype}, and hits ${name}.`;
  if (id === 'hoarfrost_shard') return `A shard of ice punches into ${name}.`;
  return `Your spell strikes ${name}.`;
}

function flavorCantrip(c: Ctx, id: string) {
  const L: Record<string, string[]> = {
    prestidigitation: ['You make a low growling noise come from the corner. Everyone looks. Nothing is there.', 'A shower of harmless sparks. Your drink is now perfectly chilled.', 'You make your boots very clean. Nobody is impressed.'],
    thaumaturgy: ['Your voice booms three times louder than it should, and every flame in the room flickers.'],
    druidcraft: ['A tiny flower opens in your palm, and you know it will rain tomorrow.', 'You snuff a candle with a thought. It feels like a small, private victory.'],
    light: ['The tip of your finger glows like a lantern.'],
    mage_hand: ['A ghostly hand appears, waves, and fetches something small for you.'],
    minor_illusion: ['A perfectly convincing cat appears in the corner and stares at everyone.', 'The sound of distant applause fills the room. You bow.'],
  };
  if (id === 'guidance') { c.set('guidance', true); c.good('Guidance: +1d4 on your next ability check.'); return; }
  if (id === 'goodberry') { if (!useSlot(c, 1)) { c.sys('No spell slots left.'); return; } c.give('goodberry', 10); c.good('Ten plump berries ripen in your palm. Each heals 1 HP when eaten.'); return; }
  c.narr(pick(c.rng, L[id] ?? ['The magic fizzes and does something small and pleasant.']));
}

function castOutside(c: Ctx, id: string, target?: string) {
  const pc = c.pc;
  const sp = SPELLS[id];
  if (sp.kind === 'utility') { flavorCantrip(c, id); return; }
  if (id === 'mage_armor') {
    if (pc.equipped.armor) { c.sys('Mage Armour does nothing while you wear armour.'); return; }
    if (pc.equipped.worn.includes('mage_armor_active')) { c.sys('Mage Armour is already up.'); return; }
    if (!(pc.cls === 'warlock' && pc.options.invocation === 'armor')) useSlot(c, 1);
    pc.equipped.worn.push('mage_armor_active');
    c.good(`A shimmer of force settles over you. AC ${armorClass(pc)} until your next long rest.`);
    return;
  }
  if (id === 'shillelagh') { if (!pc.conditions.includes('shillelagh')) pc.conditions.push('shillelagh'); c.good('Your staff swells with the Thornwood\'s strength for the next fight.'); return; }
  if (sp.kind === 'heal') {
    const self = !target || /^(me|myself|self)$/.test(target);
    const h = roll(c.rng, sp.damage!).total + Math.max(0, spellMod(pc)) + (pc.cls === 'cleric' && pc.options.god === 'hearth' ? 2 : 0);
    if (self) { if (pc.hp >= pc.maxHp) { c.sys('You\'re not hurt.'); return; } useSlot(c, 1); pc.hp = Math.min(pc.maxHp, pc.hp + h); c.good(`You heal ${h} HP (${pc.hp}/${pc.maxHp}).`); }
    else {
      const id2 = c.s.companions.find((x) => COMPANIONS[x].name.toLowerCase().startsWith(target!.toLowerCase()));
      if (!id2) { c.sys('Heal whom?'); return; }
      if (id2 === 'alistair') { c.narr('Healing light washes over Alistair, and he yelps. "OW. Brother. Undead. That\'s the opposite of what I need."'); return; }
      useSlot(c, 1);
      c.s.companionHp[id2] = Math.min(COMPANIONS[id2].maxHp, (c.s.companionHp[id2] ?? COMPANIONS[id2].maxHp) + h);
      c.good(`${COMPANIONS[id2].name} heals ${h} HP.`);
    }
    return;
  }
  if (id === 'charm_person' && target) { c.sys('Charm Person on a friendly NPC is coming in a later version. Try persuading them instead.'); return; }
  if (['attack', 'save', 'auto', 'control', 'mark'].includes(sp.kind)) {
    if (target) { c.narr(`You cast ${sp.name} at the ${target}. ${sp.dtype === 'fire' ? 'It scorches, smokes, and is a little warmer than before.' : 'It does what magic does to things that aren\'t trying to kill you: not much.'}`); return; }
    c.sys('There\'s nothing to cast that at.');
    return;
  }
  if (id === 'bless' || id === 'shield' || id === 'shield_of_faith' || id === 'divine_favor') { c.sys(`${sp.name} lasts for one fight; cast it when the fighting starts.`); return; }
}

function healUnit(c: Ctx, t: Combatant, h: number) {
  t.hp = Math.min(t.maxHp, t.hp + h);
  if (has(t, 'unconscious')) { del(t, 'unconscious'); del(t, 'stable'); c.out('good', `${t.isPc ? 'You' : t.name} ${t.isPc ? 'come' : 'comes'} back to your feet.`); }
  if (t.isPc) { c.pc.hp = t.hp; c.pc.deathSaves = { ok: 0, fail: 0 }; }
}

export function playerSmite(c: Ctx) {
  const pc = c.pc;
  const cb = c.s.combat;
  if (!cb) { c.sys('Smite after a melee hit, in a fight.'); return; }
  if (!pc.spells.includes('divine_smite')) { c.sys('Paladins learn to smite at level 2.'); return; }
  const key = c.flag('cb_last_hit') as string;
  const t = key ? cb.units.find((u) => u.key === key && !down(u)) : null;
  if (!t) { c.sys('Smite right after you land a melee hit.'); return; }
  if (pc.slots.used >= pc.slots.max) { c.sys('No spell slots left.'); return; }
  if (!useAction(c, true)) return;
  pc.slots.used += 1;
  const d = roll(c.rng, isUndead(t) ? '3d8' : '2d8').total;
  hurtFoe(c, t, d, 'radiant', { before: (x) => { c.out('hit', `Your weapon blazes with the light of the bell you swore on. ${t.name} burns.`); c.out('roll', `💥 Divine Smite: ${x} radiant.`); } });
  afterPlayerAction(c);
}

export function playerFeature(c: Ctx, name: string, targetName?: string) {
  const pc = c.pc;
  const cb = c.s.combat;
  const me = cb ? pcUnit(c) : null;
  const n = name.toLowerCase();
  const need = (id: string, label: string) => { const r = pc.resources[id]; if (!r) { c.sys(`You don't have ${label}.`); return null; } if (r.used >= r.max) { c.sys(`${label} is spent until you rest.`); return null; } return r; };
  const inFight = (label: string) => { if (!cb) { c.sys(`Save ${label} for a fight.`); return false; } return true; };
  if (n === 'second wind') {
    const r = need('second_wind', 'Second Wind'); if (!r) return;
    if (cb && !useAction(c, true)) return;
    r.used += 1;
    const h = roll(c.rng, `1d10+${pc.level}`).total;
    pc.hp = Math.min(pc.maxHp, pc.hp + h); if (me) me.hp = pc.hp;
    c.out('good', `Second Wind: you grit your teeth and find ${h} HP (${pc.hp}/${pc.maxHp}).`);
  } else if (n === 'action surge') {
    if (!inFight('Action Surge')) return; const r = need('action_surge', 'Action Surge'); if (!r) return;
    r.used += 1; cb!.usedAction = false; c.out('good', 'Action Surge! You push past your limits: take another action.'); return;
  } else if (n === 'flurry') {
    if (!inFight('Flurry of Blows')) return; const r = need('focus', 'Flurry of Blows'); if (!r) return;
    if (!cb!.usedAction) { c.sys('Flurry of Blows follows your attack: attack first.'); return; }
    if (!useAction(c, true)) return;
    r.used += 1;
    for (let i = 0; i < 2; i++) { const t = resolveTarget(c); if (!t || down(t)) break; doAttack(c, t, UNARMED, 'unarmed', i ? 'kick' : 'jab'); }
  } else if (n === 'turn undead') {
    if (!cb) { c.sys('There\'s nothing here to turn.'); return; } const r = need('channel', 'Turn Undead'); if (!r) return;
    if (!useAction(c)) return;
    r.used += 1;
    c.out('hit', 'You raise your holy symbol and speak a word the dead remember. Light spills from it.');
    for (const t of livingFoes(c).filter((u) => isUndead(u))) {
      const sv = d20(c.rng).natural + mod(mdef(t)!.abilities.wis);
      if (sv < spellDC(pc)) { add(t, 'fled'); c.out('good', `${t.name} turns and flees into the dark.`); }
      else c.out('miss', `${t.name} shudders but holds its ground.`);
    }
  } else if (n === 'breath') {
    if (!cb) { c.narr('You breathe a small, impressive puff of your ancestry\'s element. Nobody claps.'); return; } const r = need('breath', 'Breath Weapon'); if (!r) return;
    if (!useAction(c)) return;
    r.used += 1;
    const dtype = (variant(pc)?.breath ?? 'fire') as DamageType;
    const dc = 8 + am(pc, 'con') + prof(pc);
    c.out('hit', `You draw a deep breath and exhale a roaring blast of ${dtype}.`);
    for (const t of livingFoes(c).slice(0, 3)) {
      const sv = d20(c.rng).natural + mod(mdef(t)!.abilities.dex);
      let d = roll(c.rng, '1d10').total; if (sv >= dc) d = Math.floor(d / 2);
      hurtFoe(c, t, d, dtype, { before: (dealt) => c.out('roll', `💥 ${t.name} (Dex ${sv} vs DC ${dc}) takes ${dealt} ${dtype}.`) });
    }
  } else if (n === 'rage') {
    if (!inFight('Rage')) return; const r = need('rage', 'Rage'); if (!r) return;
    if (has(me!, 'raging')) { c.sys('You\'re already raging.'); return; }
    if (!useAction(c, true)) return;
    r.used += 1; add(me!, 'raging');
    c.out('good', 'You let it out: the trench, the shelling, all of it. RAGE. (+2 melee damage; resist bludgeoning, piercing, slashing and necrotic.)');
  } else if (n === 'reckless') {
    if (!inFight('Reckless Attack')) return; if (pc.cls !== 'barbarian' || pc.level < 2) { c.sys('Barbarians learn Reckless Attack at level 2.'); return; }
    add(me!, 'reckless'); c.good('You throw caution away: advantage on Strength attacks this turn, and they get advantage on you.'); return;
  } else if (n === 'inspiration') {
    const r = need('inspiration_die', 'Bardic Inspiration'); if (!r) return;
    if (cb && !useAction(c, true)) return;
    r.used += 1;
    if (me) add(me, 'inspired'); else c.set('inspired_check', true);
    c.good('You hum the first bars of an old marching song. (+1d6 to your next roll that would fail.)');
  } else if (n === 'lay on hands') {
    const r = need('lay_on_hands', 'Lay on Hands'); if (!r) return;
    if (cb && !useAction(c, true)) return;
    const pool = r.max - r.used;
    const target = cb && targetName ? resolveTarget(c, targetName, 'party') ?? me : me;
    if (target?.companion === 'alistair') { c.narr('You lay your hands on Alistair. He smokes faintly. "Brother. BROTHER. Ow."'); return; }
    const missing = (target ? target.maxHp - target.hp : pc.maxHp - pc.hp);
    const amt = Math.max(1, Math.min(pool, missing || pool));
    r.used += amt;
    if (target && cb) healUnit(c, target, amt); else pc.hp = Math.min(pc.maxHp, pc.hp + amt);
    c.out('good', `Lay on Hands: warmth pours out of your palms. +${amt} HP. (${r.max - r.used} left in your pool)`);
  } else if (n === 'innate sorcery') {
    if (!inFight('Innate Sorcery')) return; const r = need('innate', 'Innate Sorcery'); if (!r) return;
    if (!useAction(c, true)) return;
    r.used += 1; add(me!, 'sorcery');
    c.out('good', 'Treaty-fire wakes in your blood. (+1 spell DC and advantage on spell attacks this fight.)');
  } else if (n === 'font of magic') {
    const r = need('sorcery', 'Font of Magic'); if (!r) return;
    if (r.max - r.used < 2) { c.sys('You need 2 sorcery points.'); return; }
    if (pc.slots.used <= 0) { c.sys('Your spell slots are already full.'); return; }
    if (cb && !useAction(c, true)) return;
    r.used += 2; pc.slots.used -= 1; c.good('You wring a spell slot out of raw sorcery.');
  } else if (n === 'wild shape') {
    const r = need('wild_shape', 'Wild Shape'); if (!r) return;
    if (cb && !useAction(c, true)) return;
    r.used += 1; pc.conditions.push('wildshape'); pc.wildHp = pc.level * 3 + 4;
    c.out('good', `Your bones crack and lengthen; fur pours over you. You are a Thornwood wolf. (AC 13, bite for 2d4, ${pc.wildHp} extra HP.)`);
  } else if (n === 'revert') {
    if (!pc.conditions.includes('wildshape')) { c.sys('You\'re already yourself.'); return; }
    pc.conditions = pc.conditions.filter((x) => x !== 'wildshape'); pc.wildHp = 0; c.narr('You shrug off the wolf like a wet coat.'); return;
  } else if (n === 'cunning') {
    if (!cb) { c.sys('Nothing to get away from.'); return; }
    playerFlee(c, pc.cls === 'rogue' && pc.level >= 2); return;
  } else if (n === 'smite') {
    playerSmite(c); return;
  } else if (n === 'stone') {
    c.sys(pc.resources.stone ? 'Stone\'s Endurance kicks in by itself when a big hit lands.' : 'You don\'t have that.'); return;
  } else if (n === 'remedy') {
    if (cb) { c.sys('Herbal Remedy takes a minute. Not in a fight.'); return; }
    const r = need('remedy', 'Herbal Remedy'); if (!r) return; r.used += 1; const h = roll(c.rng, '1d6+4').total; pc.hp = Math.min(pc.maxHp, pc.hp + h); c.good(`You pack the wound with herbs: +${h} HP.`); return;
  } else {
    // species powers
    const sp = species(pc).power;
    if (!sp || !(n === sp.name.toLowerCase() || n === sp.id || n.replace(/ /g, '_') === sp.id || sp.name.toLowerCase().includes(n))) { c.sys(`You don't have a power called "${name}". Your sheet lists what you can do.`); return; }
    const r = need(sp.id, sp.name); if (!r) return;
    switch (sp.id) {
      case 'adrenaline': if (cb && !useAction(c, true)) return; r.used += 1; pc.tempHp = Math.max(pc.tempHp, prof(pc)); c.good(`Adrenaline Rush: +${prof(pc)} temporary HP, and your blood sings.`); break;
      case 'healing_hands': { if (cb && !useAction(c)) return; r.used += 1; const h = roll(c.rng, `${prof(pc)}d4`).total; const target = cb ? (targetName ? resolveTarget(c, targetName, 'party') : null) ?? me! : null; if (target && cb) healUnit(c, target, h); else pc.hp = Math.min(pc.maxHp, pc.hp + h); c.good(`Healing Hands: candle-light spills from your palms. +${h} HP.`); break; }
      case 'fury': if (!inFight(sp.name)) return; if (!useAction(c, true)) return; r.used += 1; add(me!, 'fury'); c.good(`Fury of the Small: your next hit deals +${prof(pc)} damage.`); break;
      case 'cry': if (!inFight(sp.name)) return; if (!useAction(c, true)) return; r.used += 1; add(me!, 'cry'); for (const u of cb!.units.filter((x) => x.side === 'foe')) add(u, 'guided'); c.good('You let out a draconic shriek. Advantage on your next attack, and your allies\'.'); break;
      case 'shell': if (!inFight(sp.name)) return; if (!useAction(c, true)) return; r.used += 1; add(me!, 'shell'); c.good(`You pull into your shell. AC ${pcAC(c)} until your next turn.`); break;
      case 'shifting': if (!inFight(sp.name)) return; if (!useAction(c, true)) return; r.used += 1; add(me!, 'shifted'); pc.tempHp = Math.max(pc.tempHp, prof(pc) * 2); c.good(`You shift: fur, fangs, yellow eyes. +${prof(pc) * 2} temporary HP and +1 AC for the fight.`); break;
      case 'hidden_step': if (!inFight(sp.name)) return; if (!useAction(c, true)) return; r.used += 1; add(me!, 'hidden'); c.good('You step sideways out of sight. Your next attack has advantage.'); break;
      case 'hungry_jaws': if (!inFight(sp.name)) return; r.used += 1; add(me!, 'jaws'); c.good('Your jaws ache with hunger. Your next bite feeds you.'); break;
      case 'escape': if (!cb) { c.sys('Save it for when you need to get out of a fight.'); return; } r.used += 1; escapeNow(c, sp.name); return;
      case 'faerie': if (!inFight(sp.name)) return; if (!useAction(c)) return; r.used += 1; for (const u of livingFoes(c).slice(0, 3)) applyEffect(c, u, 'faerie'); break;
      case 'recall': case 'past_life': c.set(sp.id === 'recall' ? 'recall_check' : 'past_life_check', true); r.used += 1; c.good(`${sp.name}: your next skill check is ${sp.id === 'recall' ? 'made with advantage' : 'boosted by 1d6'}.`); return;
      default: c.sys(`${sp.name} works automatically.`); return;
    }
  }
  if (cb) afterPlayerAction(c);
}

function escapeNow(c: Ctx, how: string) {
  const cb = c.s.combat!;
  const to = cb.fleeTo ?? (c.flag('prev_loc') as string) ?? c.s.loc;
  syncAfterCombat(c);
  c.s.combat = null;
  c.out('good', `${how}: you're gone before they can react.`);
  c.move(to);
}

export function playerShove(c: Ctx, verb: string, targetName: string | undefined, grapple: boolean) {
  const t = resolveTarget(c, targetName);
  if (!t) { c.sys('Shove whom?'); return; }
  if (!useAction(c)) return;
  const pc = c.pc;
  const dc = 8 + am(pc, 'str') + prof(pc) + (species(pc).flags?.includes('powerful') ? 1 : 0);
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
  const bonus = (pc.cls === 'rogue' && pc.level >= 2) || !!species(pc).flags?.includes('nimble');
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
  if (c.s.combat && !useAction(c, pc.cls === 'fighter')) return;
  const n = Math.min(need, have);
  removeItem(pc, ammoId, n); pc.ammo[w.id] = (pc.ammo[w.id] ?? 0) + n;
  c.narr(`You thumb ${n} cartridge${n > 1 ? 's' : ''} into the ${w.name.toLowerCase()}${pc.cls === 'fighter' && c.s.combat ? ' without taking your eyes off the fight' : ''}. ${pc.ammo[w.id]}/${w.capacity}.`);
  if (c.s.combat) afterPlayerAction(c);
}

export function playerUnjam(c: Ctx) {
  const pc = c.pc;
  const w = weaponById(pc.equipped.ranged) ?? weaponById(pc.equipped.main);
  if (!w || !c.flag(`jam_${w.id}`)) { c.sys('Nothing is jammed.'); return; }
  if (c.s.combat && !useAction(c, pc.cls === 'fighter')) return;
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
  if (!cb && pc.hp >= pc.maxHp && self) { c.sys('You\'re not hurt. Save it.'); return; }
  if (cb && !useAction(c, self)) return;
  removeItem(pc, 'potion_healing');
  const h = roll(c.rng, '2d4+2').total;
  if (cb && target) healUnit(c, target, h);
  else pc.hp = Math.min(pc.maxHp, pc.hp + h);
  c.out('good', `${self ? 'You drink' : `You pour the potion into ${target!.name}`}: +${h} HP.${self ? ` (${pc.hp}/${pc.maxHp})` : ''}`);
  if (target?.companion === 'alistair') c.narr('It runs straight through his ribs. "Appreciate the gesture, brother."');
  if (cb) afterPlayerAction(c);
}

export function playerFlee(c: Ctx, cunning = false) {
  const cb = c.s.combat!;
  const pc = c.pc;
  const bonusDisengage = (pc.cls === 'rogue' && pc.level >= 2) || !!species(pc).flags?.includes('nimble');
  if (!useAction(c, cunning || bonusDisengage)) return;
  const foes = livingFoes(c).filter((u) => !disabled(u) && !has(u, 'restrained'));
  const slow = foes.every((u) => (mdef(u)?.speed ?? 30) < 30);
  const dc = bonusDisengage ? 0 : slow ? 5 : 10 + foes.length * 2;
  if (dc === 0 || c.check('acrobatics', dc)) {
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
  if (t.monster === 'merah') merahGone(c, false);
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
  if (c.flag('merah_surrendered') && !c.flag('merah_gone') && !c.flag('merah_dead')) { c.narr('You step aside. Merah looks at you for a long moment, then goes down the stairs and out into the night.'); merahGone(c, true); return; }
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
  c.give('bone_amulet'); c.give('cult_candle', 2); c.give('trenchfire_shot');
  checkChapelDone(c);
}

export function playerSay(c: Ctx, act: string, text: string) {
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
  if (has(u, 'frightened')) { c.narr(`${u.name} cowers.`); if (die(c.rng, 4) === 1) { del(u, 'frightened'); c.narr(`${u.name} shakes off its fear.`); } return; }
  if (has(u, 'asleep')) { c.narr(`${u.name} snores.`); return; }
  if (has(u, 'charmed')) { c.narr(`${u.name} hesitates, smiling at you uncertainly.`); return; }
  if (has(u, 'halted')) { del(u, 'halted'); c.narr(`${u.name} stands frozen, obeying your command.`); return; }
  if (has(u, 'restrained')) {
    const sv = d20(c.rng).natural + mod(def.abilities.str);
    if (sv >= spellDC(c.pc)) { del(u, 'restrained'); c.narr(`${u.name} tears free of the weeds.`); }
    else { c.narr(`${u.name} struggles against the weeds.`); return; }
  }
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
  const debuffed = has(u, 'mocked') || has(u, 'frostbit');
  del(u, 'mocked'); del(u, 'frostbit');
  const adv = combineAdv(!!packAlly || (has(target, 'prone') && !atk.ranged) || (!!target.isPc && has(target, 'reckless')), has(target, 'dodging') || grappledOther || debuffed || has(u, 'restrained'));
  const r = d20(c.rng, adv);
  const ac = target.isPc ? pcAC(c) : target.ac;
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
  const foes = livingFoes(c).filter((x) => !has(x, 'charmed'));
  if (!foes.length) return;
  const t = foes.slice().sort((a, b) => a.hp - b.hp)[0];
  const adv = combineAdv(has(t, 'prone') || has(t, 'guided') || has(t, 'faerie') || has(t, 'restrained'), false);
  const r = d20(c.rng, adv);
  const tot = r.natural + d.toHit;
  const crit = r.natural === 20 || has(t, 'asleep');
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
  const deathless = species(pc).flags?.includes('deathless');
  const r = deathless ? Math.max(die(c.rng, 20), die(c.rng, 20)) : die(c.rng, 20);
  if (r === 20) { me.hp = 1; pc.hp = 1; del(me, 'unconscious'); c.out('good', '🎲 Death save: 20! You gasp awake with 1 HP.'); return; }
  if (r === 1) pc.deathSaves.fail += 2; else if (r >= 10) pc.deathSaves.ok += 1; else pc.deathSaves.fail += 1;
  c.out('roll', `🎲 Death save${deathless ? ' (advantage)' : ''}: ${r} — ${pc.deathSaves.ok} success, ${pc.deathSaves.fail} failure.`);
  if (pc.deathSaves.ok >= 3) { add(me, 'stable'); c.out('good', 'You stabilise. Still unconscious, but you will live.'); }
  if (pc.deathSaves.fail >= 3) defeat(c, 'death');
}

function syncAfterCombat(c: Ctx) {
  const cb = c.s.combat!;
  const me = pcUnit(c);
  c.pc.hp = Math.max(0, me.hp);
  for (const u of cb.units) if (u.companion) c.s.companionHp[u.companion] = has(u, 'unconscious') ? 1 : u.hp;
  c.pc.conditions = c.pc.conditions.filter((x) => x !== 'shillelagh');
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
    if (has(u, 'dead') || has(u, 'surrendered') || has(u, 'charmed')) xp += def.xp;
    else if (has(u, 'fled') || has(u, 'frightened')) xp += Math.floor(def.xp / 2);
  }
  const merah = cb.units.find((u) => u.monster === 'merah');
  c.s.combat = null;
  if (c.pc.conditions.includes('wildshape')) { c.pc.conditions = c.pc.conditions.filter((x) => x !== 'wildshape'); c.pc.wildHp = 0; c.narr('You let the wolf-shape go.'); }
  c.out('title', 'Victory');
  if (xp) c.xp(xp);
  if (pelts) { c.give('wolf_pelt', pelts); c.narr(`You skin the wolf${pelts > 1 ? 'ves' : ''}. ${pelts} pelt${pelts > 1 ? 's' : ''} for Hetch. (The dead one isn't worth skinning.)`); }
  if (cb.encounterId === 'courier') courierLoot(c);
  if (merah) {
    if (has(merah, 'dead')) merahDead(c);
    else if (has(merah, 'surrendered') || has(merah, 'charmed') || has(merah, 'frightened')) { c.set('merah_surrendered'); c.sys('Merah sits on the stair, hands raised. Spare her, or finish her?'); }
  }
  const others = cb.units.filter((u) => u.side === 'foe' && (has(u, 'frightened') || has(u, 'charmed')) && u.monster !== 'merah');
  if (others.length) c.narr(`${others.map((u) => u.name).join(' and ')} ${others.length > 1 ? 'slink' : 'slinks'} away, no longer interested in fighting.`);
  for (const u of cb.units) if (u.companion === 'alistair' && has(u, 'unconscious')) { c.narr('The heap of bones on the floor rattles, then assembles itself, joint by joint. "Ugh. Hate that. Did anybody touch the coat?"'); c.s.companionHp.alistair = 10; }
  for (const u of cb.units) if (u.companion === 'kettle' && has(u, 'unconscious')) { c.narr('Kettle limps back to his feet, shakes himself, and wags.'); c.s.companionHp.kettle = 4; }
  enc?.onWin?.(c);
}

function defeat(c: Ctx, why: 'down' | 'death' | 'surrender') {
  const pc = c.pc;
  const to = (c.s.loc in WAKE) ? WAKE[c.s.loc] : 'breda_square';
  c.s.combat = null;
  c.out('title', 'Darkness');
  c.narr(why === 'death' ? 'You die. You are sure of it: the cold, the quiet, the long way down. And then a woman\'s voice, very kind, very far away: "Not yet, little candle. I need you to remember me."' : 'Everything goes dark.');
  const h = c.hour();
  const toDawn = ((24 - h) + 6) % 24 || 24;
  c.advance(toDawn * 60);
  pc.hp = Math.max(1, Math.floor(pc.maxHp / 2));
  pc.conditions = []; pc.deathSaves = { ok: 0, fail: 0 }; pc.wildHp = 0; pc.drunk = 0;
  const lost = Math.floor(pc.copper / 4);
  pc.copper -= lost;
  const valuables = pc.inventory.filter((s) => { const it = ITEMS[s.id]; return it && it.kind !== 'key' && it.kind !== 'note' && s.id !== pc.equipped.main && s.id !== pc.equipped.armor && s.id !== pc.equipped.shield && s.id !== pc.equipped.ranged && !pc.equipped.worn.includes(s.id) && it.price > 0; });
  let lostItem = '';
  if (valuables.length) { const v = pick(c.rng, valuables); lostItem = itemName(v.id); removeItem(pc, v.id, 1); }
  for (const id of c.s.companions) c.s.companionHp[id] = Math.max(1, Math.floor(COMPANIONS[id].maxHp / 2));
  c.s.chaos = Math.min(9, c.s.chaos + 1);
  c.s.loc = to; c.s.talkingTo = null;
  c.narr(`You wake at dawn${to === 'breda_square' ? ' at the edge of Breda' : to === 'kessels_rest' ? " at Kessel's Rest, curled under the dome of the old wayshrine" : ', on cold ground'}, aching, alive. ${lost || lostItem ? `Someone went through your pack while you were out${lost ? `: ${Math.round(lost / 100)} gold is gone` : ''}${lostItem ? `${lost ? ', and so is' : ': gone is'} your ${lostItem.toLowerCase()}` : ''}.` : ''} The dead didn't kill you. They wanted you to wake up and remember.`);
  c.sys(`You have ${pc.hp}/${pc.maxHp} HP. (Undead in Lahti knock people down rather than kill them. Something wants witnesses.)`);
}

export { addItem, isProficient, attackAbility, saveBonus };
