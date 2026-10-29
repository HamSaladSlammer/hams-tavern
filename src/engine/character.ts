import { mod, roll, type Rng } from './dice';
import { ITEMS, PROF_BONUS, UNARMED, XP_FOR_LEVEL } from './srd';
import { CLASSES, classById, arrayFor, type ClassDef } from '../data/classes';
import { SPECIES, speciesById, type SpeciesDef } from '../data/species';
import { BACKGROUNDS, backgroundById, FEATS } from '../data/backgrounds';
import { LIFE } from '../data/lifepath';
import { spellPoints, maxSpellLevel, attacksPerAction, asiLevels, CLASS_FEATURES, subclassById, subclassesFor, cantripTier, casterKind } from '../data/progression';
import type { Abilities, Ability, Character, CreationSpec, Skill, Stack, WeaponDef } from './types';
import { ABILITIES, SKILL_ABILITY } from './types';

export const SOLO_GRIT = 4;
export const cls = (c: Character): ClassDef => classById(c.cls);
export const species = (c: Character): SpeciesDef => speciesById(c.species);
export const background = (c: Character) => backgroundById(c.background);
export const prof = (c: Character) => PROF_BONUS(c.level);
export const am = (c: Character, a: Ability) => mod(c.abilities[a]);
export const variant = (c: Character) => species(c).variants?.find((v) => v.id === c.options.variant);

/** A complete, valid spec with sensible defaults — used for quick starts and tests. */
export function defaultSpec(clsId: string, speciesId = 'human', bgId = 'soldier', name = 'Wanderer'): CreationSpec {
  const k = classById(clsId);
  const bg = backgroundById(bgId);
  const sp = speciesById(speciesId);
  const options: Record<string, string> = {};
  for (const o of k.options ?? []) options[o.id] = o.choices[0].id;
  const skills: Skill[] = [];
  for (const s of k.skillChoices) { if (skills.length >= k.skillCount) break; if (!bg.skills.includes(s)) skills.push(s); }
  const list = k.casting?.list ?? [];
  const cantrips = list.filter((id) => isCantrip(id)).slice(0, k.casting?.cantrips ?? 0);
  const spells = list.filter((id) => !isCantrip(id)).slice(0, k.casting?.prepared[0] ?? 0);
  return {
    name, pronoun: 'they', species: speciesId, variant: sp.variants?.[0]?.id, cls: clsId, options, background: bgId,
    boost: { plus2: bg.abilities.includes(k.primary[0]) ? k.primary[0] : bg.abilities[0], plus1: bg.abilities.find((a) => a !== (bg.abilities.includes(k.primary[0]) ? k.primary[0] : bg.abilities[0]))!, even: false },
    base: arrayFor(k), skills, cantrips, spells, removedKit: [], customItems: [], look: '', backstory: '',
    life: Object.fromEntries(LIFE.map((t) => [t.id, t.entries[0].id])),
  };
}

import { SPELLS } from '../data/spells';
export const isCantrip = (id: string) => SPELLS[id]?.level === 0;

export function finalAbilities(spec: CreationSpec): Abilities {
  const a = { ...spec.base };
  const bg = backgroundById(spec.background);
  if (spec.boost.even) for (const k of bg.abilities) a[k] += 1;
  else { a[spec.boost.plus2] += 2; if (spec.boost.plus1 !== spec.boost.plus2) a[spec.boost.plus1] += 1; }
  for (const k of ABILITIES) a[k] = Math.min(20, a[k]);
  return a;
}

export function createFromSpec(spec: CreationSpec): Character {
  const k = classById(spec.cls);
  const bg = backgroundById(spec.background);
  const sp = speciesById(spec.species);
  const vr = sp.variants?.find((v) => v.id === spec.variant) ?? sp.variants?.[0];
  const abilities = finalAbilities(spec);
  const inventory: Stack[] = [];
  const add = (id: string, qty = 1) => { if (!ITEMS[id]) return; const s = inventory.find((x) => x.id === id); if (s) s.qty += qty; else inventory.push({ id, qty }); };
  const options: Record<string, string> = { ...spec.options, variant: vr?.id ?? '' };
  // kit
  let kit = [...k.kit, ...bg.kit];
  if (k.id === 'cleric' && options.order === 'protector') kit = kit.map(([id, q]) => [id === 'chain_shirt' ? 'chain_mail' : id, q] as [string, number]);
  for (const [id, q] of kit) if (!spec.removedKit.includes(id)) add(id, q);
  add('potion_healing', 1);
  for (const t of LIFE) { const e = t.entries.find((x) => x.id === spec.life[t.id]); if (e?.item) add(e.item, 1); }
  // spells
  const cantrips = new Set<string>(spec.cantrips);
  if (sp.cantrip) cantrips.add(sp.cantrip);
  if (vr?.cantrip) cantrips.add(vr.cantrip);
  if (bg.feat === 'magic_cleric') { cantrips.add('guidance'); cantrips.add('sacred_flame'); }
  if (bg.feat === 'magic_wizard') { cantrips.add('prestidigitation'); cantrips.add('fire_bolt'); }
  if (bg.feat === 'magic_druid') { cantrips.add('druidcraft'); cantrips.add('produce_flame'); }
  if (k.id === 'cleric' && options.god === 'road') cantrips.add('guidance');
  const spells = new Set<string>(spec.spells);
  if (k.id === 'ranger') spells.add('hunters_mark');
  // skills
  const skills = new Set<Skill>([...spec.skills, ...bg.skills, ...(sp.skills ?? []), ...(vr?.skills ?? [])]);
  const weaponProf = [...k.weaponProf];
  const armorProf = [...k.armorProf];
  if ((k.id === 'cleric' && options.order === 'protector')) { if (!weaponProf.includes('martial')) weaponProf.push('martial'); if (!armorProf.includes('heavy')) armorProf.push('heavy'); }
  if (k.id === 'druid' && options.order === 'warden') { if (!weaponProf.includes('martial')) weaponProf.push('martial'); if (!armorProf.includes('medium')) armorProf.push('medium'); }
  if (inventory.some((s) => ITEMS[s.id]?.weapon?.category === 'firearm') && spec.background === 'soldier' && !weaponProf.includes('firearm')) weaponProf.push('firearm');
  const c: Character = {
    name: spec.name.trim() || 'Wanderer', species: sp.id, cls: k.id, background: bg.id, level: 1, xp: 0, abilities,
    hp: 0, maxHp: 0, tempHp: 0, hitDice: 1, skills: Array.from(skills), expertise: [],
    saves: k.saves, weaponProf, armorProf, cantrips: Array.from(cantrips), spells: Array.from(spells),
    slots: { max: spellPoints(k.id, 1), used: 0 }, resources: {}, inventory,
    equipped: { ...k.equip, worn: [] }, ammo: {}, copper: k.copper + bg.copper, conditions: [], deathSaves: { ok: 0, fail: 0 },
    pronoun: spec.pronoun, options, feat: bg.feat, look: spec.look, backstory: spec.backstory, life: { ...spec.life }, drunk: 0, wildHp: 0, perks: [], features: [],
  };
  if (k.id === 'cleric' && options.order === 'protector') c.equipped.armor = 'chain_mail';
  if (!c.equipped.ranged && hasItem(c, 'service_revolver')) c.equipped.ranged = 'service_revolver';
  for (const slot of ['main', 'armor', 'shield', 'ranged'] as const) if (c.equipped[slot] && !hasItem(c, c.equipped[slot]!)) c.equipped[slot] = undefined;
  if (k.id === 'rogue') c.expertise = (['stealth', 'sleight of hand'] as Skill[]).filter((s) => c.skills.includes(s)).concat(c.skills.filter((s) => !['stealth', 'sleight of hand'].includes(s))).slice(0, 2);
  for (const extra of spec.customItems) if (extra.trim()) c.inventory.push({ id: 'custom:' + extra.trim().slice(0, 60), qty: 1 });
  loadFirearms(c);
  setResources(c);
  c.maxHp = maxHpAt(c, 1);
  c.hp = c.maxHp;
  return c;
}

export function loadFirearms(c: Character) {
  for (const s of c.inventory) {
    const w = ITEMS[s.id]?.weapon;
    if (w?.category === 'firearm' && w.capacity && c.ammo[w.id] === undefined) {
      const ammoId = w.ammo === 'pistol' ? 'pistol_cartridge' : 'rifle_cartridge';
      const st = c.inventory.find((x) => x.id === ammoId);
      const load = Math.min(w.capacity, st?.qty ?? 0);
      c.ammo[w.id] = load;
      if (st) st.qty -= load;
    }
  }
  c.inventory = c.inventory.filter((s) => s.qty > 0);
}

function setResources(c: Character) {
  const r = c.resources;
  const L = c.level;
  const p = prof(c);
  const set = (id: string, max: number, per: 'short' | 'long') => { const used = r[id]?.used ?? 0; r[id] = { max, used: Math.min(used, max), per }; };
  switch (c.cls) {
    case 'barbarian': set('rage', L >= 17 ? 6 : L >= 12 ? 5 : L >= 6 ? 4 : L >= 2 ? 3 : 2, 'long'); break;
    case 'bard': set('inspiration_die', Math.max(1, am(c, 'cha')), L >= 5 ? 'short' : 'long'); break;
    case 'cleric': if (L >= 2) set('channel', L >= 18 ? 4 : L >= 6 ? 3 : 2, 'short'); break;
    case 'druid': if (L >= 2) set('wild_shape', L >= 17 ? 4 : L >= 6 ? 3 : 2, 'short'); break;
    case 'fighter': set('second_wind', L >= 10 ? 4 : L >= 4 ? 3 : 2, 'long'); if (L >= 2) set('action_surge', L >= 17 ? 2 : 1, 'short'); if (L >= 9) set('indomitable', L >= 17 ? 3 : L >= 13 ? 2 : 1, 'long'); break;
    case 'monk': if (L >= 2) set('focus', L, 'short'); break;
    case 'paladin': set('lay_on_hands', 5 * L, 'long'); break;
    case 'ranger': set('favored', Math.max(2, p), 'long'); break;
    case 'sorcerer': set('innate', 2, 'long'); set('treaty_fire', 1, 'long'); if (L >= 2) set('sorcery', L, 'long'); break;
    case 'warlock': if (L >= 2) set('cunning', 1, 'long'); break;
    case 'wizard': set('arcane_recovery', 1, 'long'); set('loremaster', 1, 'long'); break;
  }
  const sp = species(c);
  if (sp.power) set(sp.power.id, sp.power.uses === 'prof' ? p : sp.power.uses, sp.power.per);
  if (sp.flags?.includes('relentless')) set('relentless', 1, 'long');
  if (c.feat === 'silver_tongue') set('silver_tongue', 1, 'long');
  if (c.feat === 'remedy') set('remedy', 1, 'short');
  if (c.feat === 'survivors_luck') set('luck_points', 3, 'long');
}

export function maxHpAt(c: Character, level: number): number {
  const k = cls(c);
  const con = am(c, 'con');
  const perLevel = (c.species === 'dwarf' ? 1 : 0) + (c.feat === 'stout' ? 2 : 0);
  const perLevel2 = perLevel + (c.perks ?? []).filter((p) => p.startsWith('hp_lvl:')).reduce((n, p) => n + Number(p.split(':')[1]), 0);
  let hp = k.hitDie + con + perLevel2 + SOLO_GRIT;
  for (let l = 2; l <= level; l++) hp += Math.max(1, Math.floor(k.hitDie / 2) + 1 + con) + perLevel2;
  return Math.max(1, hp);
}

/** Every spell this character's class can learn, up to the level they can cast. */
export function learnableSpells(c: Character): string[] {
  const k = cls(c);
  const max = maxSpellLevel(c.cls, c.level);
  const base = (k.casting?.list ?? []).filter((id) => !isCantrip(id));
  const high = Object.values(SPELLS).filter((sp) => sp.level >= 2 && sp.level <= max && ((sp.classes ?? []).includes(c.cls) || (c.cls === 'bard' && c.level >= 10) || (c.subclass === 'bellborn' && (sp.classes ?? []).includes('cleric')))).sort((a, b) => b.level - a.level).map((sp) => sp.id);
  return [...high, ...base].filter((id) => SPELLS[id] && SPELLS[id].level <= Math.max(1, max));
}

export function levelUp(c: Character): string[] {
  const k = cls(c);
  const before = c.maxHp;
  c.level += 1;
  c.perks ??= []; c.features ??= [];
  const L = c.level;
  const out: string[] = [];
  // ability score improvement: +2 to your main ability (or spread it once that's maxed)
  if (asiLevels(c.cls).includes(L)) {
    const order = Array.from(new Set([...k.primary, 'con', 'dex', 'wis', 'cha', 'str', 'int'])) as Ability[];
    let pts = 2; const got: string[] = [];
    for (const a of order) { while (pts > 0 && c.abilities[a] < 20) { c.abilities[a] += 1; pts -= 1; got.push(a.toUpperCase()); } if (!pts) break; }
    if (got.length) out.push(`Ability Score Improvement: ${Array.from(new Set(got)).map((a) => `${a} +${got.filter((x) => x === a).length}`).join(', ')}.`);
  }
  // class and subclass features
  const feats = [...(L === 2 ? (k.features[2] ?? []).map((t) => ({ name: t.split(':')[0].split('(')[0].trim(), desc: t, perks: [] as string[] })) : []), ...(CLASS_FEATURES[c.cls]?.[L] ?? [])];
  const sub = c.subclass ? subclassById(c.subclass) : undefined;
  if (sub) feats.push(...(sub.features[L] ?? []));
  for (const f of feats) {
    out.push(`${f.name}: ${f.desc}`);
    if (L > 2) c.features.push(`${f.name} (${L})`);
    for (const p of f.perks ?? []) {
      c.perks.push(p);
      if (p.startsWith('stat:')) { const [, ab, n] = p.split(':'); c.abilities[ab as Ability] = Math.min(24, c.abilities[ab as Ability] + Number(n)); }
    }
  }
  if (L === 3 && !c.subclass) out.push(`Choose your path: ${subclassesFor(c.cls).map((x) => x.name).join(' · ')}. (Say "choose ${subclassesFor(c.cls)[0]?.name.toLowerCase()}", or tap it on your sheet.)`);
  // hit points
  c.maxHp = maxHpAt(c, L);
  c.hp = c.maxHp;
  c.hitDice = L;
  out.unshift(`Your maximum HP rises by ${c.maxHp - before} to ${c.maxHp}.`);
  // attacks
  const atk = attacksPerAction(c.cls, L, c.perks) + (c.cls === 'warlock' && L >= 5 && c.options.invocation === 'blade' ? 1 : 0);
  const prevAtk = attacksPerAction(c.cls, L - 1, c.perks);
  if (atk > prevAtk) out.push(`You now make ${atk} attacks when you take the Attack action.`);
  // spells
  if (k.casting) {
    c.slots.max = spellPoints(c.cls, L);
    c.slots.used = 0;
    const max = maxSpellLevel(c.cls, L);
    out.push(`Spell power: ${c.slots.max} points (a spell costs its level), up to ${['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'][max]}-level spells${k.casting.pact ? ', back on a short rest' : ''}.`);
    const learn = c.cls === 'wizard' ? 2 : 1;
    const pool = learnableSpells(c).filter((id) => !c.spells.includes(id));
    for (const id of pool.slice(0, learn)) { c.spells.push(id); out.push(`You learn ${SPELLS[id].name}.`); }
    if ([4, 10].includes(L)) { const cn = k.casting.list.find((id) => isCantrip(id) && !c.cantrips.includes(id)); if (cn) { c.cantrips.push(cn); out.push(`You learn the ${SPELLS[cn].name} cantrip.`); } }
    if ([5, 11, 17].includes(L) && c.cantrips.some((x) => SPELLS[x]?.damage)) out.push(`Your cantrips grow stronger (${cantripTier(L)}× damage dice).`);
  }
  if (c.cls === 'rogue' && L % 2 === 1) out.push(`Sneak Attack: ${Math.ceil(L / 2)}d6.`);
  if (L === 2) {
    if (c.cls === 'paladin' && !c.spells.includes('divine_smite')) c.spells.push('divine_smite');
    if (c.cls === 'bard') c.expertise = Array.from(new Set([...c.expertise, ...c.skills.slice(0, 2)]));
    if (c.cls === 'ranger') c.expertise = Array.from(new Set([...c.expertise, c.skills[0]]));
    if (c.cls === 'wizard') { const sch = (['arcana', 'history', 'investigation', 'religion'] as Skill[]).find((s) => c.skills.includes(s)); if (sch) c.expertise.push(sch); }
    if (c.cls === 'warlock' && c.options.invocation !== 'agonizing') c.options.invocation2 = 'agonizing';
    if ((c.cls === 'paladin' || c.cls === 'ranger') && !c.options.style) c.options.style = c.cls === 'paladin' ? 'defense' : 'archery';
  }
  if (c.cls === 'rogue' && [6].includes(L)) { const more = c.skills.filter((x) => !c.expertise.includes(x)).slice(0, 2); c.expertise.push(...more); }
  setResources(c);
  return out;
}

/** Pick a subclass (at level 3 or later). Applies every feature you've already reached. */
export function chooseSubclass(c: Character, name: string): string[] | string {
  if (c.level < 3) return 'Subclasses open up at level 3.';
  if (c.subclass) return `You already walk the ${subclassById(c.subclass)?.name}.`;
  const n = name.toLowerCase().replace(/^(the|a|an)\s+/, '');
  const sc = subclassesFor(c.cls).find((x) => x.name.toLowerCase().includes(n) || x.id === n || n.includes(x.name.toLowerCase().replace(/^(path|college|domain|circle|oath|way|school) of (the )?/, '')));
  if (!sc) return `Your choices: ${subclassesFor(c.cls).map((x) => x.name).join(', ')}.`;
  c.subclass = sc.id;
  c.perks ??= []; c.features ??= [];
  const out = [`You take up the ${sc.name}. ${sc.blurb}`];
  for (const [lv, fs] of Object.entries(sc.features)) {
    if (Number(lv) > c.level) continue;
    for (const f of fs) { out.push(`${f.name}: ${f.desc}`); c.features.push(`${f.name} (${lv})`); for (const p of f.perks ?? []) { c.perks.push(p); if (p.startsWith('stat:')) { const [, ab, v] = p.split(':'); c.abilities[ab as Ability] = Math.min(24, c.abilities[ab as Ability] + Number(v)); } } }
  }
  c.maxHp = maxHpAt(c, c.level); c.hp = Math.min(c.hp, c.maxHp);
  return out;
}

export { casterKind };

export function xpToNext(c: Character): number { return XP_FOR_LEVEL[c.level + 1] ?? Infinity; }

export function hasItem(c: Character, id: string, qty = 1): boolean { return (c.inventory.find((s) => s.id === id)?.qty ?? 0) >= qty; }
export function addItem(c: Character, id: string, qty = 1) { const s = c.inventory.find((x) => x.id === id); if (s) s.qty += qty; else c.inventory.push({ id, qty }); }
export function removeItem(c: Character, id: string, qty = 1): boolean {
  const s = c.inventory.find((x) => x.id === id);
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) {
    c.inventory = c.inventory.filter((x) => x !== s);
    for (const slot of ['main', 'offhand', 'armor', 'shield', 'ranged'] as const) if (c.equipped[slot] === id && !hasItem(c, id)) c.equipped[slot] = undefined;
    c.equipped.worn = c.equipped.worn.filter((w) => w === 'mage_armor_active' || hasItem(c, w));
  }
  return true;
}

export function itemName(id: string): string {
  if (id.startsWith('custom:')) return id.slice(7);
  return ITEMS[id]?.name ?? id;
}

export function armorClass(c: Character): number {
  const dex = am(c, 'dex');
  const sp = species(c);
  const armor = c.equipped.armor ? ITEMS[c.equipped.armor]?.armor : undefined;
  const shield = c.equipped.shield ? ITEMS[c.equipped.shield]?.armor : undefined;
  let ac = 10 + dex;
  if (sp.naturalArmor) ac = Math.max(ac, sp.naturalArmor.base + (sp.naturalArmor.dex ? dex : 0));
  if (armor && !(sp.naturalArmor && !sp.naturalArmor.dex)) {
    const cap = armor.dexCap === null ? dex : Math.min(dex, armor.dexCap);
    ac = Math.max(ac, armor.base + cap);
    if (c.options.style === 'defense') ac += 1;
  } else if (!armor) {
    if (c.cls === 'barbarian') ac = Math.max(ac, 10 + dex + am(c, 'con'));
    if (c.cls === 'monk' && !shield) ac = Math.max(ac, 10 + dex + am(c, 'wis'));
    if (c.equipped.worn.includes('mage_armor_active') || (c.cls === 'warlock' && c.options.invocation === 'armor')) ac = Math.max(ac, 13 + dex);
  }
  if (shield) ac += 2;
  for (const w of c.equipped.worn) ac += ITEMS[w]?.acBonus ?? 0;
  for (const p of c.perks ?? []) if (p.startsWith('ac:')) ac += Number(p.split(':')[1]);
  return ac;
}

export function saveBonus(c: Character, a: Ability): number {
  let b = am(c, a) + (c.saves.includes(a) || (c.cls === 'monk' && c.level >= 14) ? prof(c) : 0);
  for (const p of c.perks ?? []) if (p.startsWith('save_bonus:')) b += Math.max(1, am(c, p.split(':')[1] as Ability));
  for (const w of c.equipped.worn) b += ITEMS[w]?.saveBonus ?? 0;
  return b;
}

export function skillBonus(c: Character, s: Skill): number {
  const base = am(c, SKILL_ABILITY[s]);
  let b = base;
  if (c.expertise.includes(s)) b = base + prof(c) * 2;
  else if (c.skills.includes(s)) b = base + prof(c);
  else if (c.cls === 'bard' && c.level >= 2) b = base + Math.floor(prof(c) / 2);
  if (c.cls === 'bard' && s === 'history') b += Math.max(0, am(c, 'cha'));
  if (((c.cls === 'cleric' && c.options.order === 'thaumaturge') && (s === 'religion' || s === 'arcana')) || (c.cls === 'druid' && c.options.order === 'magician' && (s === 'arcana' || s === 'nature'))) b += Math.max(1, am(c, 'wis'));
  if (c.drunk >= 3 && SKILL_ABILITY[s] === 'dex') b -= 2;
  if (c.drunk >= 1 && (s === 'performance' || s === 'intimidation')) b += 1;
  return b;
}

export function passivePerception(c: Character) { return 10 + skillBonus(c, 'perception') + (c.feat === 'watchful' ? 5 : 0); }

export function initiativeBonus(c: Character): number {
  return am(c, 'dex') + (c.feat === 'alert' ? prof(c) : 0) + (species(c).flags?.includes('hare-trigger') ? prof(c) : 0) + ((c.perks ?? []).includes('init_adv') ? 3 : 0);
}

export function castingAbility(c: Character): Ability {
  const k = cls(c);
  if (k.casting) return k.casting.ability;
  return am(c, 'int') >= am(c, 'wis') ? (am(c, 'int') >= am(c, 'cha') ? 'int' : 'cha') : am(c, 'wis') >= am(c, 'cha') ? 'wis' : 'cha';
}
export function spellMod(c: Character): number { return am(c, castingAbility(c)); }
export function spellAttack(c: Character): number { return spellMod(c) + prof(c); }
export function spellDC(c: Character): number { return 8 + spellMod(c) + prof(c) + (c.cls === 'bard' && c.level >= 20 ? 1 : 0); }

export function weaponById(id?: string): WeaponDef | undefined {
  if (!id) return undefined;
  if (id === 'unarmed') return UNARMED;
  return ITEMS[id]?.weapon;
}

export const IMPROVISED = ['mug_empty', 'mug_ale', 'mug_stout', 'bottle_empty', 'chair_leg', 'rock', 'stick', 'bone', 'torch', 'candle', 'lute', 'crowbar', 'egg', 'apple', 'mushroom', 'lantern'];

export function isProficient(c: Character, w: WeaponDef): boolean {
  if (w.id === 'unarmed') return true;
  if (w.id === 'club_improvised' || w.id.startsWith('imp:') || w.id.startsWith('prop:')) return c.feat === 'brawler' || c.cls === 'monk';
  if (c.weaponProf.includes(w.category)) return true;
  if (c.cls === 'rogue' && w.category === 'martial' && (w.finesse || w.light)) return true;
  return false;
}

export function attackAbility(c: Character, w: WeaponDef): Ability {
  if (c.cls === 'warlock' && c.options.invocation === 'blade' && !w.ranged) return 'cha';
  if (c.conditions.includes('shillelagh' as never) && (w.id === 'quarterstaff' || w.id === 'club')) return castingAbility(c);
  if (w.id === 'unarmed') return c.cls === 'monk' && am(c, 'dex') > am(c, 'str') ? 'dex' : 'str';
  if (c.cls === 'monk' && w.category === 'simple' && !w.twoHanded && am(c, 'dex') > am(c, 'str')) return 'dex';
  if (w.ranged && !w.thrown) return 'dex';
  if (w.finesse) return am(c, 'dex') >= am(c, 'str') ? 'dex' : 'str';
  return 'str';
}

export function weaponToHit(c: Character, w: WeaponDef): number {
  let b = am(c, attackAbility(c, w)) + (isProficient(c, w) ? prof(c) : 0) + (w.bonus ?? 0);
  if (c.options.style === 'archery' && w.ranged && !w.thrown) b += 2;
  if (c.drunk >= 3) b -= 1;
  return b;
}

export function unarmedDice(c: Character): string | null {
  const sp = species(c);
  const sizes: number[] = [];
  if (sp.weapon) sizes.push(parseInt(sp.weapon.damage.split('d')[1], 10));
  if (c.cls === 'monk') sizes.push(c.level >= 17 ? 12 : c.level >= 11 ? 10 : c.level >= 5 ? 8 : 6);
  if (c.feat === 'brawler') sizes.push(4);
  if (!sizes.length) return null;
  return `1d${Math.max(...sizes)}`;
}

export function weaponDamageExpr(c: Character, w: WeaponDef): string {
  const m = am(c, attackAbility(c, w)) + (w.bonus ?? 0) + (c.options.style === 'dueling' && !w.ranged && !w.twoHanded && w.id !== 'unarmed' ? 2 : 0);
  let dice = w.damage;
  if (w.id === 'unarmed') {
    const d = unarmedDice(c);
    if (!d) return `${Math.max(1, 1 + am(c, attackAbility(c, w)))}`;
    dice = d;
  } else if (c.conditions.includes('shillelagh' as never) && (w.id === 'quarterstaff' || w.id === 'club')) dice = '1d8';
  else if ((c.cls === 'monk' && w.category === 'simple' && !w.twoHanded) || (c.cls === 'monk' && w.id === 'club_improvised')) {
    const size = parseInt(dice.split('d')[1] ?? '0', 10);
    if (!(size >= 6)) dice = '1d6';
  }
  return m === 0 ? dice : `${dice}${m > 0 ? '+' : ''}${m}`;
}

export function fmtMoney(cp: number): string {
  const gp = Math.floor(cp / 100);
  const c = cp % 100;
  if (gp && c) return `${gp} gp ${c} cp`;
  if (gp) return `${gp} gp`;
  return `${c} cp`;
}

export function rollHitDie(rng: Rng, c: Character): number {
  return Math.max(1, roll(rng, `1d${cls(c).hitDie}`).total + am(c, 'con'));
}

export function featDesc(c: Character) { return FEATS[c.feat]; }
export { CLASSES, SPECIES, BACKGROUNDS };
