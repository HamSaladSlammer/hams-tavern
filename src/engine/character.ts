import { mod, roll, type Rng } from './dice';
import { BACKGROUNDS, CLASSES, ITEMS, PROF_BONUS, SPECIES, UNARMED, XP_FOR_LEVEL } from './srd';
import type { Ability, Character, Skill, Stack, WeaponDef } from './types';
import { SKILL_ABILITY } from './types';

export const SOLO_GRIT = 4;
export const cls = (c: Character) => CLASSES.find((x) => x.id === c.cls)!;
export const species = (c: Character) => SPECIES.find((x) => x.id === c.species)!;
export const background = (c: Character) => BACKGROUNDS.find((x) => x.id === c.background)!;
export const prof = (c: Character) => PROF_BONUS(c.level);
export const am = (c: Character, a: Ability) => mod(c.abilities[a]);

export function createCharacter(name: string, speciesId: string, clsId: string, bgId: string): Character {
  const k = CLASSES.find((x) => x.id === clsId)!;
  const bg = BACKGROUNDS.find((x) => x.id === bgId)!;
  const sp = SPECIES.find((x) => x.id === speciesId)!;
  const abilities = { ...k.array };
  abilities[bg.boosts[0]] += 2;
  abilities[bg.boosts[1]] += 1;
  for (const a of Object.keys(abilities) as Ability[]) abilities[a] = Math.min(20, abilities[a]);
  const skills = Array.from(new Set<Skill>([...k.skills, ...bg.skills, ...(sp.extraSkills ?? [])]));
  const inventory: Stack[] = [];
  const add = (id: string, qty = 1) => {
    const s = inventory.find((x) => x.id === id);
    if (s) s.qty += qty;
    else inventory.push({ id, qty });
  };
  for (const g of [...k.gear, ...bg.gear]) {
    if (g === 'pistol_cartridge') add(g, 14);
    else if (g === 'arrow') add(g, 20);
    else if (g === 'dart') add(g, 10);
    else if (g === 'rations') add(g, 3);
    else if (g === 'torch') add(g, 2);
    else add(g);
  }
  add('potion_healing', 1);
  const cantrips = [...(k.cantrips ?? [])];
  if (bg.id === 'acolyte' && !cantrips.includes('guidance')) cantrips.push('guidance');
  if (bg.id === 'sage' && !cantrips.includes('prestidigitation')) cantrips.push('prestidigitation');
  const c: Character = {
    name, species: speciesId, cls: clsId, background: bgId, level: 1, xp: 0, abilities,
    hp: 0, maxHp: 0, tempHp: 0, hitDice: 1, skills,
    expertise: clsId === 'rogue' ? ['stealth', 'sleight of hand'] : [],
    saves: k.saves, weaponProf: k.weaponProf, armorProf: k.armorProf,
    cantrips, spells: [...(k.spells ?? [])],
    slots: { max: k.slots?.[1] ?? 0, used: 0 },
    resources: {},
    inventory, equipped: { ...k.equip, worn: [] }, ammo: {},
    copper: k.copper + bg.copper, conditions: [], deathSaves: { ok: 0, fail: 0 }, pronoun: 'they',
  };
  if (bg.id === 'soldier' && clsId !== 'fighter') {
    // Lahti veterans kept one sidearm each.
    add('service_revolver');
    add('pistol_cartridge', 7);
    if (!c.weaponProf.includes('firearm')) c.weaponProf = [...c.weaponProf, 'firearm'];
    if (!c.equipped.ranged) c.equipped.ranged = 'service_revolver';
  }
  // Load firearms
  for (const s of inventory) {
    const w = ITEMS[s.id]?.weapon;
    if (w?.category === 'firearm' && w.capacity) {
      const ammoId = w.ammo === 'pistol' ? 'pistol_cartridge' : 'rifle_cartridge';
      const have = inventory.find((x) => x.id === ammoId)?.qty ?? 0;
      const load = Math.min(w.capacity, have);
      c.ammo[w.id] = load;
      const st = inventory.find((x) => x.id === ammoId);
      if (st) st.qty -= load;
    }
  }
  if (clsId === 'fighter') c.resources.second_wind = { max: 2, used: 0, per: 'long' };
  if (speciesId === 'orc') c.resources.relentless = { max: 1, used: 0, per: 'long' };
  if (speciesId === 'dragonborn') c.resources.breath = { max: 2, used: 0, per: 'long' };
  if (speciesId === 'goliath') c.resources.stone = { max: 2, used: 0, per: 'long' };
  if (speciesId === 'human') c.resources.inspiration = { max: 1, used: 0, per: 'long' };
  // Solo play: a lone adventurer gets a little extra grit (+4 HP at level 1). Noted on the sheet.
  c.maxHp = k.hitDie + am(c, 'con') + (speciesId === 'dwarf' ? 1 : 0) + SOLO_GRIT;
  c.hp = c.maxHp;
  return c;
}

export function levelUp(c: Character): string[] {
  const k = cls(c);
  c.level += 1;
  const gain = Math.max(1, Math.floor(k.hitDie / 2) + 1 + am(c, 'con') + (c.species === 'dwarf' ? 1 : 0));
  c.maxHp += gain;
  c.hp = c.maxHp;
  c.hitDice = c.level;
  const out = [`Your maximum HP rises by ${gain} to ${c.maxHp}.`];
  if (k.slots) {
    c.slots.max = k.slots[Math.min(c.level, k.slots.length - 1)] ?? c.slots.max;
    c.slots.used = 0;
    out.push(`You now have ${c.slots.max} level-1 spell slots.`);
  }
  if (c.level === 2) {
    if (c.cls === 'fighter') c.resources.action_surge = { max: 1, used: 0, per: 'short' };
    if (c.cls === 'monk') c.resources.focus = { max: 2, used: 0, per: 'short' };
    if (c.cls === 'cleric') c.resources.channel = { max: 2, used: 0, per: 'short' };
    for (const f of k.features[2] ?? []) out.push(f);
  }
  return out;
}

export function xpToNext(c: Character): number {
  return XP_FOR_LEVEL[c.level + 1] ?? Infinity;
}

export function hasItem(c: Character, id: string, qty = 1): boolean {
  return (c.inventory.find((s) => s.id === id)?.qty ?? 0) >= qty;
}

export function addItem(c: Character, id: string, qty = 1) {
  const s = c.inventory.find((x) => x.id === id);
  if (s) s.qty += qty;
  else c.inventory.push({ id, qty });
}

export function removeItem(c: Character, id: string, qty = 1): boolean {
  const s = c.inventory.find((x) => x.id === id);
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) {
    c.inventory = c.inventory.filter((x) => x !== s);
    for (const slot of ['main', 'offhand', 'armor', 'shield', 'ranged'] as const) if (c.equipped[slot] === id && !hasItem(c, id)) c.equipped[slot] = undefined;
    c.equipped.worn = c.equipped.worn.filter((w) => hasItem(c, w));
  }
  return true;
}

export function armorClass(c: Character): number {
  const dex = am(c, 'dex');
  let ac = 10 + dex;
  const armor = c.equipped.armor ? ITEMS[c.equipped.armor]?.armor : undefined;
  const shield = c.equipped.shield ? ITEMS[c.equipped.shield]?.armor : undefined;
  if (armor) {
    const cap = armor.dexCap === null ? dex : Math.min(dex, armor.dexCap);
    ac = armor.base + cap;
    if (c.cls === 'fighter') ac += 1; // Defense style
  } else if (c.cls === 'monk' && !shield) {
    ac = 10 + dex + am(c, 'wis');
  }
  if (!armor && c.conditions.includes('shielded' as never)) ac = Math.max(ac, 13 + dex);
  if (c.equipped.worn.includes('mage_armor_active')) ac = Math.max(ac, 13 + dex);
  if (shield) ac += 2;
  for (const w of c.equipped.worn) ac += ITEMS[w]?.acBonus ?? 0;
  return ac;
}

export function saveBonus(c: Character, a: Ability): number {
  let b = am(c, a) + (c.saves.includes(a) ? prof(c) : 0);
  for (const w of c.equipped.worn) b += ITEMS[w]?.saveBonus ?? 0;
  return b;
}

export function skillBonus(c: Character, s: Skill): number {
  const base = am(c, SKILL_ABILITY[s]);
  if (c.expertise.includes(s)) return base + prof(c) * 2;
  if (c.skills.includes(s)) return base + prof(c);
  return base;
}

export function initiativeBonus(c: Character): number {
  return am(c, 'dex') + (c.background === 'criminal' ? prof(c) : 0);
}

export function spellMod(c: Character): number {
  if (c.cls === 'wizard') return am(c, 'int');
  if (c.cls === 'cleric') return am(c, 'wis');
  return Math.max(am(c, 'int'), am(c, 'wis'), am(c, 'cha'));
}

export function spellAttack(c: Character): number {
  return spellMod(c) + prof(c);
}

export function spellDC(c: Character): number {
  return 8 + spellMod(c) + prof(c);
}

export function weaponById(id?: string): WeaponDef | undefined {
  if (!id) return undefined;
  if (id === 'unarmed') return UNARMED;
  return ITEMS[id]?.weapon;
}

export function isProficient(c: Character, w: WeaponDef): boolean {
  if (w.id === 'unarmed') return true;
  if (c.weaponProf.includes(w.category)) return true;
  // Rogues: martial weapons with finesse or light
  if (c.cls === 'rogue' && w.category === 'martial' && (w.finesse || w.light)) return true;
  return false;
}

export function attackAbility(c: Character, w: WeaponDef): Ability {
  if (w.id === 'unarmed') return c.cls === 'monk' && am(c, 'dex') > am(c, 'str') ? 'dex' : 'str';
  if (c.cls === 'monk' && w.category === 'simple' && !w.twoHanded && am(c, 'dex') > am(c, 'str')) return 'dex';
  if (w.ranged && !w.thrown) return 'dex';
  if (w.finesse) return am(c, 'dex') >= am(c, 'str') ? 'dex' : 'str';
  return 'str';
}

export function weaponToHit(c: Character, w: WeaponDef): number {
  return am(c, attackAbility(c, w)) + (isProficient(c, w) ? prof(c) : 0) + (w.bonus ?? 0);
}

export function weaponDamageExpr(c: Character, w: WeaponDef): string {
  const m = am(c, attackAbility(c, w)) + (w.bonus ?? 0);
  let dice = w.damage;
  if (w.id === 'unarmed') {
    if (c.cls === 'monk') dice = '1d6';
    else return `${Math.max(1, 1 + m)}`;
  } else if (c.cls === 'monk' && w.category === 'simple' && !w.twoHanded) {
    // Martial Arts die if better
    const size = parseInt(dice.split('d')[1] ?? '0', 10);
    if (size < 6) dice = '1d6';
  }
  // Firearms don't add ability modifier to damage in Lahti's rules? They do (dex), like bows.
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
