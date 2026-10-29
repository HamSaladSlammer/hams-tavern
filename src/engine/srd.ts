// Rules data adapted from the System Reference Document 5.2.1 (CC-BY-4.0, Wizards of the Coast).
// See ATTRIBUTION.md. Setting-specific items (firearms, the Kalashscovia names) are original.
import type { Ability, Abilities, ArmorDef, ItemDef, MonsterDef, Skill, WeaponCategory, WeaponDef } from './types';

// ---------- Species ----------
export interface SpeciesDef {
  id: string;
  name: string;
  speed: number;
  darkvision: number;
  blurb: string;
  traits: string[]; // short rule summaries shown on the sheet
  extraSkills?: Skill[];
}

export const SPECIES: SpeciesDef[] = [
  { id: 'human', name: 'Human', speed: 30, darkvision: 0, blurb: 'Everywhere in Kalashscovia, and stubborn about it.', traits: ['Resourceful: once per long rest, reroll a failed d20 (Heroic Inspiration).', 'Skillful: one extra skill proficiency.'], extraSkills: ['perception'] },
  { id: 'elf', name: 'Elf', speed: 30, darkvision: 60, blurb: "Lahti's people. Long memories, short patience for orcs.", traits: ['Darkvision 60 ft.', 'Keen Senses: proficiency in Perception.', 'Fey Ancestry: advantage on saves against being charmed.'], extraSkills: ['perception'] },
  { id: 'dwarf', name: 'Dwarf', speed: 30, darkvision: 120, blurb: 'Road-menders, miners, drinkers of stout.', traits: ['Darkvision 120 ft.', 'Dwarven Toughness: +1 HP per level.', 'Dwarven Resilience: resistance to poison damage.'] },
  { id: 'halfling', name: 'Halfling', speed: 30, darkvision: 0, blurb: 'Merchants and gossips. Fenwick Tealeaf is one.', traits: ['Luck: when you roll a 1 on a d20 test, reroll it.', 'Brave: advantage on saves against being frightened.'] },
  { id: 'orc', name: 'Orc', speed: 30, darkvision: 120, blurb: "Makrovin's people. Fifteen years ago, the enemy.", traits: ['Darkvision 120 ft.', 'Relentless Endurance: once per long rest, drop to 1 HP instead of 0.'] },
  { id: 'tiefling', name: 'Tiefling', speed: 30, darkvision: 60, blurb: 'Horned, often red, never quite trusted.', traits: ['Darkvision 60 ft.', 'Infernal Legacy: resistance to fire damage.'] },
  { id: 'dragonborn', name: 'Dragonborn', speed: 30, darkvision: 60, blurb: 'Scaled travellers, far from home.', traits: ['Darkvision 60 ft.', 'Breath Weapon (fire): 1d10 fire to up to three foes, Dex save halves. Uses = proficiency bonus per long rest.', 'Damage Resistance: fire.'] },
  { id: 'gnome', name: 'Gnome', speed: 30, darkvision: 60, blurb: 'Small, clever, curious about everything that ticks.', traits: ['Darkvision 60 ft.', 'Gnomish Cunning: advantage on Int, Wis and Cha saves.'] },
  { id: 'goliath', name: 'Goliath', speed: 35, darkvision: 0, blurb: 'Mountain-born giants from the Northern Peaks.', traits: ["Stone's Endurance: once per short rest, reduce damage taken by 1d12 + Con."] },
];

// ---------- Classes ----------
export interface ClassDef {
  id: string;
  name: string;
  hitDie: number;
  primary: Ability;
  saves: Ability[];
  skills: Skill[]; // auto-picked
  weaponProf: WeaponCategory[];
  armorProf: ('light' | 'medium' | 'heavy' | 'shield')[];
  array: Abilities; // standard array assigned for the class
  gear: string[]; // item ids
  equip: { main?: string; offhand?: string; armor?: string; shield?: string; ranged?: string };
  copper: number;
  cantrips?: string[];
  spells?: string[];
  slots?: number[]; // by level
  blurb: string;
  features: Record<number, string[]>;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'fighter', name: 'Fighter', hitDie: 10, primary: 'str', saves: ['str', 'con'],
    skills: ['athletics', 'intimidation'], weaponProf: ['simple', 'martial', 'firearm'], armorProf: ['light', 'medium', 'heavy', 'shield'],
    array: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    gear: ['chain_mail', 'longsword', 'shield', 'service_revolver', 'pistol_cartridge', 'rations', 'torch'],
    equip: { main: 'longsword', armor: 'chain_mail', shield: 'shield', ranged: 'service_revolver' },
    copper: 400,
    blurb: 'A veteran of somebody\'s war. Armour, steel, and a revolver for when steel is too slow.',
    features: { 1: ['Second Wind: bonus action, heal 1d10 + level. Two uses, regain one on a short rest.', 'Fighting Style (Defense): +1 AC while wearing armour.'], 2: ['Action Surge: once per short rest, take one extra action.'] },
  },
  {
    id: 'rogue', name: 'Rogue', hitDie: 8, primary: 'dex', saves: ['dex', 'int'],
    skills: ['stealth', 'sleight of hand', 'perception', 'deception'], weaponProf: ['simple', 'martial'], armorProf: ['light'],
    array: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 },
    gear: ['leather_armor', 'rapier', 'dagger', 'shortbow', 'arrow', 'thieves_tools', 'rations'],
    equip: { main: 'rapier', armor: 'leather_armor', ranged: 'shortbow' },
    copper: 800,
    blurb: 'Quick hands and quicker exits. Breda has locks; you have opinions about them.',
    features: { 1: ['Sneak Attack: +1d6 once per turn when you have advantage, or an ally is fighting beside you.', 'Expertise: double proficiency in Stealth and Sleight of Hand.'], 2: ['Cunning Action: bonus action to hide (advantage on your next attack) or disengage.'] },
  },
  {
    id: 'monk', name: 'Monk', hitDie: 8, primary: 'dex', saves: ['str', 'dex'],
    skills: ['acrobatics', 'insight'], weaponProf: ['simple'], armorProf: [],
    array: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
    gear: ['quarterstaff', 'dart', 'rations', 'torch'],
    equip: { main: 'quarterstaff' },
    copper: 500,
    blurb: 'Fists, feet, elbows, knees, and a frightening amount of patience. Every limb is a weapon.',
    features: { 1: ['Martial Arts: your unarmed strikes use Dex and deal 1d6; after any attack you can make one unarmed strike as a bonus action.', 'Unarmored Defense: AC = 10 + Dex + Wis with no armour or shield.'], 2: ['Focus (2 points, short rest): Flurry of Blows — two bonus unarmed strikes.'] },
  },
  {
    id: 'wizard', name: 'Wizard', hitDie: 6, primary: 'int', saves: ['int', 'wis'],
    skills: ['arcana', 'investigation'], weaponProf: ['simple'], armorProf: [],
    array: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    gear: ['quarterstaff', 'dagger', 'spellbook', 'rations', 'torch'],
    equip: { main: 'quarterstaff' },
    copper: 500,
    cantrips: ['fire_bolt', 'ray_of_frost', 'prestidigitation'],
    spells: ['magic_missile', 'burning_hands', 'mage_armor'],
    slots: [0, 2, 3],
    blurb: 'Book-smart. Possibly heart-clumsy. Your spells came from somewhere older than you think.',
    features: { 1: ['Spellcasting (Int): cantrips at will; level-1 spell slots recover on a long rest.'], 2: ['A third spell slot.'] },
  },
  {
    id: 'cleric', name: 'Cleric', hitDie: 8, primary: 'wis', saves: ['wis', 'cha'],
    skills: ['religion', 'medicine'], weaponProf: ['simple', 'martial'], armorProf: ['light', 'medium', 'heavy', 'shield'],
    array: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 },
    gear: ['chain_mail', 'mace', 'shield', 'holy_symbol', 'rations', 'torch'],
    equip: { main: 'mace', armor: 'chain_mail', shield: 'shield' },
    copper: 500,
    cantrips: ['sacred_flame', 'guidance', 'thaumaturgy'],
    spells: ['cure_wounds', 'healing_word', 'guiding_bolt', 'bless'],
    slots: [0, 2, 3],
    blurb: 'The old faith, the Silent Keeper, the Bright Hearth — whoever you pray to, the dead are their business now.',
    features: { 1: ['Spellcasting (Wis).', 'Divine Order (Protector): heavy armour and martial weapons.'], 2: ['Channel Divinity — Turn Undead: undead that fail a Wis save are frightened and flee.'] },
  },
];

// ---------- Backgrounds (SRD 5.2.1 has these four) ----------
export interface BackgroundDef {
  id: string;
  name: string;
  boosts: [Ability, Ability]; // +2, +1
  skills: Skill[];
  gear: string[];
  copper: number;
  feat: string;
  blurb: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'soldier', name: 'Soldier', boosts: ['str', 'con'], skills: ['athletics', 'intimidation'], gear: ['bayonet'], copper: 1400, feat: 'Savage Attacker: once per turn, roll weapon damage twice and keep the higher.', blurb: 'You served in the civil war, or right after it. You never talk about it.' },
  { id: 'criminal', name: 'Criminal', boosts: ['dex', 'con'], skills: ['sleight of hand', 'stealth'], gear: ['crowbar'], copper: 1600, feat: 'Alert: add your proficiency bonus to initiative.', blurb: 'Largo docks, Borschardt back rooms. You know who buys and who asks questions.' },
  { id: 'acolyte', name: 'Acolyte', boosts: ['wis', 'cha'], skills: ['insight', 'religion'], gear: ['holy_symbol'], copper: 800, feat: 'Magic Initiate: you know the guidance cantrip.', blurb: 'You kept a chapel once. Most of them are empty now.' },
  { id: 'sage', name: 'Sage', boosts: ['int', 'con'], skills: ['arcana', 'history'], gear: ['ink_and_quill'], copper: 800, feat: 'Magic Initiate: you know the prestidigitation cantrip.', blurb: 'An archive clerk, a tutor, a reader of things other people burned.' },
];

// ---------- Weapons ----------
const W = (w: WeaponDef): WeaponDef => w;
export const WEAPONS: WeaponDef[] = [
  W({ id: 'club', name: 'Club', category: 'simple', ranged: false, damage: '1d4', dtype: 'bludgeoning', light: true, price: 10 }),
  W({ id: 'dagger', name: 'Dagger', category: 'simple', ranged: false, damage: '1d4', dtype: 'piercing', finesse: true, light: true, thrown: true, range: [20, 60], price: 200 }),
  W({ id: 'silvered_dagger', name: 'Silvered Dagger', category: 'simple', ranged: false, damage: '1d4', dtype: 'piercing', finesse: true, light: true, thrown: true, range: [20, 60], silvered: true, price: 10200 }),
  W({ id: 'quarterstaff', name: 'Quarterstaff', category: 'simple', ranged: false, damage: '1d6', dtype: 'bludgeoning', price: 20 }),
  W({ id: 'mace', name: 'Mace', category: 'simple', ranged: false, damage: '1d6', dtype: 'bludgeoning', price: 500 }),
  W({ id: 'handaxe', name: 'Handaxe', category: 'simple', ranged: false, damage: '1d6', dtype: 'slashing', light: true, thrown: true, range: [20, 60], price: 500 }),
  W({ id: 'spear', name: 'Spear', category: 'simple', ranged: false, damage: '1d6', dtype: 'piercing', thrown: true, range: [20, 60], price: 100 }),
  W({ id: 'bayonet', name: 'Bayonet', category: 'simple', ranged: false, damage: '1d4', dtype: 'piercing', finesse: true, light: true, price: 200 }),
  W({ id: 'shortsword', name: 'Shortsword', category: 'martial', ranged: false, damage: '1d6', dtype: 'piercing', finesse: true, light: true, price: 1000 }),
  W({ id: 'silvered_shortsword', name: 'Silvered Shortsword', category: 'martial', ranged: false, damage: '1d6', dtype: 'piercing', finesse: true, light: true, silvered: true, price: 11000 }),
  W({ id: 'longsword', name: 'Longsword', category: 'martial', ranged: false, damage: '1d8', dtype: 'slashing', price: 1500 }),
  W({ id: 'rapier', name: 'Rapier', category: 'martial', ranged: false, damage: '1d8', dtype: 'piercing', finesse: true, price: 2500 }),
  W({ id: 'battleaxe', name: 'Battleaxe', category: 'martial', ranged: false, damage: '1d8', dtype: 'slashing', price: 1000 }),
  W({ id: 'warhammer', name: 'Warhammer', category: 'martial', ranged: false, damage: '1d8', dtype: 'bludgeoning', price: 1500 }),
  W({ id: 'greataxe', name: 'Greataxe', category: 'martial', ranged: false, damage: '1d12', dtype: 'slashing', twoHanded: true, price: 3000 }),
  W({ id: 'dart', name: 'Dart', category: 'simple', ranged: true, damage: '1d4', dtype: 'piercing', finesse: true, thrown: true, range: [20, 60], price: 5 }),
  W({ id: 'shortbow', name: 'Shortbow', category: 'simple', ranged: true, damage: '1d6', dtype: 'piercing', range: [80, 320], ammo: 'arrow', twoHanded: true, price: 2500 }),
  W({ id: 'light_crossbow', name: 'Light Crossbow', category: 'simple', ranged: true, damage: '1d8', dtype: 'piercing', range: [80, 320], ammo: 'bolt', twoHanded: true, price: 2500 }),
  // Firearms — original, named for Lahti's arsenals. Jam on a natural 1 (an action to clear). Loud.
  W({ id: 'service_revolver', name: 'Service Revolver', category: 'firearm', ranged: true, damage: '1d8', dtype: 'piercing', range: [30, 90], ammo: 'pistol', capacity: 7, price: 15000 }),
  W({ id: 'officers_pistol', name: "Tokarev-Works Officer's Pistol", category: 'firearm', ranged: true, damage: '1d8', dtype: 'piercing', range: [40, 120], ammo: 'pistol', capacity: 8, price: 25000 }),
  W({ id: 'service_rifle', name: 'Service Rifle', category: 'firearm', ranged: true, damage: '1d12', dtype: 'piercing', range: [80, 240], ammo: 'rifle', capacity: 5, twoHanded: true, price: 40000 }),
];

export const UNARMED: WeaponDef = { id: 'unarmed', name: 'Unarmed Strike', category: 'simple', ranged: false, damage: '1', dtype: 'bludgeoning', price: 0 };

// ---------- Armour ----------
export const ARMOR: ArmorDef[] = [
  { id: 'leather_armor', name: 'Leather Armour', base: 11, dexCap: null, kind: 'light', price: 1000 },
  { id: 'studded_leather', name: 'Studded Leather', base: 12, dexCap: null, kind: 'light', price: 4500 },
  { id: 'chain_shirt', name: 'Chain Shirt', base: 13, dexCap: 2, kind: 'medium', price: 5000 },
  { id: 'scale_mail', name: 'Scale Mail', base: 14, dexCap: 2, kind: 'medium', stealthDis: true, price: 5000 },
  { id: 'chain_mail', name: 'Chain Mail', base: 16, dexCap: 0, kind: 'heavy', stealthDis: true, price: 7500 },
  { id: 'shield', name: 'Shield', base: 2, dexCap: 0, kind: 'shield', price: 1000 },
];

// ---------- Items ----------
const items: ItemDef[] = [];
for (const w of WEAPONS) items.push({ id: w.id, name: w.name, kind: 'weapon', price: w.price, desc: describeWeapon(w), weapon: w });
for (const a of ARMOR) items.push({ id: a.id, name: a.name, kind: 'armor', price: a.price, desc: a.kind === 'shield' ? '+2 AC.' : `AC ${a.base}${a.dexCap === null ? ' + Dex' : a.dexCap ? ` + Dex (max ${a.dexCap})` : ''}. ${a.kind} armour.`, armor: a });

items.push(
  { id: 'potion_healing', name: 'Potion of Healing', kind: 'potion', price: 5000, desc: 'Red, faintly fizzing. Heals 2d4+2.', heal: '2d4+2', aliases: ['potion', 'healing potion', 'red potion'] },
  { id: 'pistol_cartridge', name: 'Pistol Cartridges', kind: 'ammo', price: 100, desc: 'Brass, Tokarev-works stamp. For revolvers and pistols.', ammoFor: 'pistol', aliases: ['bullets', 'cartridges', 'ammo', 'rounds'] },
  { id: 'rifle_cartridge', name: 'Rifle Cartridges', kind: 'ammo', price: 200, desc: 'Long brass rounds on stripper clips.', ammoFor: 'rifle', aliases: ['rifle rounds'] },
  { id: 'arrow', name: 'Arrows', kind: 'ammo', price: 5, desc: 'Goose-fletched.', ammoFor: 'arrow' },
  { id: 'rations', name: 'Rations', kind: 'food', price: 50, desc: 'Hard bread, harder cheese, a sad apple.', aliases: ['food', 'ration'] },
  { id: 'torch', name: 'Torch', kind: 'gear', price: 1, desc: 'Burns for an hour.' },
  { id: 'rope', name: 'Rope (50 ft.)', kind: 'gear', price: 100, desc: 'Hempen. Squib says bring one.', aliases: ['rope'] },
  { id: 'crowbar', name: 'Crowbar', kind: 'gear', price: 200, desc: 'Advantage on checks to force things open.', aliases: ['pry bar'] },
  { id: 'thieves_tools', name: "Thieves' Tools", kind: 'gear', price: 2500, desc: 'Picks and tension wrenches in a leather roll.', aliases: ['lockpicks', 'picks', 'tools'] },
  { id: 'holy_symbol', name: 'Holy Symbol', kind: 'gear', price: 500, desc: 'A sun in a circle, worn smooth by thumbs.' },
  { id: 'old_holy_symbol', name: 'Holy Symbol of the Old Faith', kind: 'treasure', price: 1500, desc: 'A crowned sun. Nobody makes these any more.' },
  { id: 'spellbook', name: 'Spellbook', kind: 'gear', price: 0, desc: 'Your notes. Some of the symbols you copied from your teacher, and they from theirs.' },
  { id: 'ink_and_quill', name: 'Ink and Quill', kind: 'gear', price: 1000, desc: 'For notes nobody will read.' },
  { id: 'robe_of_protection', name: "Pilgrim's Robe of Protection", kind: 'armor', price: 0, desc: 'Grey wool, a faded crowned-sun sigil on the breast. +1 AC and +1 to saving throws while worn. "For the one who comes when the bell rings wrong."', acBonus: 1, saveBonus: 1, aliases: ['robe', 'grey robe', 'pilgrim robe', 'cloak'] },
  { id: 'bone_amulet', name: 'Bone Amulet', kind: 'key', price: 0, desc: 'A crowned skull wreathed in thorns, carved from something that was once a finger. Never the same temperature twice.', aliases: ['amulet'] },
  { id: 'cultist_journal', name: "Cultist's Journal", kind: 'note', price: 0, desc: 'Black wax on the cover.', read: '"The treaty peace made everyone forget Her. Fifteen years of forgetting. But bells remember. Bones remember. When the last seal thins, Her Majesty will not need us to dig." A list of names follows. One, underlined twice, is ALISTAIR.', aliases: ['journal', 'black journal'] },
  { id: 'priests_letter', name: "Priest's Unfinished Letter", kind: 'note', price: 0, desc: 'Forty years old, by the ink.', read: '"...and should I not return, let it be known that the sealed one below must never hear the bell again. We ring it on the holy days and only on the holy days, and only in the old way. If you hear it at midnight, it is not being rung for us—"', aliases: ['letter'] },
  { id: 'burial_coins', name: 'Burial Coins', kind: 'treasure', price: 2500, desc: 'Old crown copper, pressed thin for the eyes of the dead.' },
  { id: 'wolf_pelt', name: 'Wolf Pelt', kind: 'treasure', price: 100, desc: 'Fresh. Hetch might want it.', aliases: ['pelt'] },
  { id: 'scroll_bless', name: 'Scroll of Bless', kind: 'gear', price: 5000, desc: 'Anyone can read it once: +1d4 to attacks for the next fight.', aliases: ['scroll'] },
  { id: 'black_label', name: "Squib's Reserve (black label)", kind: 'food', price: 0, desc: 'He only pours it for people he likes.' },
  { id: 'travel_cloak', name: 'Travel Cloak', kind: 'gear', price: 500, desc: 'Hetch\'s work: oiled wool, deep hood, a lining that smells faintly of cedar. Warm, and much better than what you had.', aliases: ['cloak'] },
  { id: 'cult_candle', name: 'Green-Black Candle', kind: 'treasure', price: 10, desc: 'Burns with a greenish flame. Smells of graves and honey.', aliases: ['candle', 'candles'] },
);
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(items.map((i) => [i.id, i]));

function describeWeapon(w: WeaponDef): string {
  const p: string[] = [`${w.damage} ${w.dtype}`];
  if (w.finesse) p.push('finesse');
  if (w.light) p.push('light');
  if (w.twoHanded) p.push('two-handed');
  if (w.range) p.push(`range ${w.range[0]}/${w.range[1]}`);
  if (w.category === 'firearm') p.push(`${w.capacity} rounds, jams on a 1, loud`);
  if (w.silvered) p.push('silvered');
  return p.join(', ') + '.';
}

// ---------- Spells ----------
export type SpellKind = 'attack' | 'save' | 'auto' | 'heal' | 'buff' | 'utility';
export interface SpellDef {
  id: string;
  name: string;
  level: 0 | 1;
  kind: SpellKind;
  damage?: string; // base
  dtype?: string;
  save?: Ability;
  ranged?: boolean;
  aoe?: number; // max targets
  bonusAction?: boolean;
  desc: string;
  aliases: string[];
}

export const SPELLS: Record<string, SpellDef> = {
  fire_bolt: { id: 'fire_bolt', name: 'Fire Bolt', level: 0, kind: 'attack', damage: '1d10', dtype: 'fire', ranged: true, desc: 'Ranged spell attack, 1d10 fire.', aliases: ['fire bolt', 'firebolt', 'fire'] },
  ray_of_frost: { id: 'ray_of_frost', name: 'Ray of Frost', level: 0, kind: 'attack', damage: '1d8', dtype: 'cold', ranged: true, desc: 'Ranged spell attack, 1d8 cold.', aliases: ['ray of frost', 'frost', 'ice ray'] },
  chill_touch: { id: 'chill_touch', name: 'Chill Touch', level: 0, kind: 'attack', damage: '1d10', dtype: 'necrotic', ranged: false, desc: 'Melee spell attack, 1d10 necrotic.', aliases: ['chill touch'] },
  sacred_flame: { id: 'sacred_flame', name: 'Sacred Flame', level: 0, kind: 'save', damage: '1d8', dtype: 'radiant', save: 'dex', ranged: true, desc: 'Dex save or 1d8 radiant.', aliases: ['sacred flame', 'holy fire'] },
  guidance: { id: 'guidance', name: 'Guidance', level: 0, kind: 'utility', desc: 'Add 1d4 to your next ability check.', aliases: ['guidance'] },
  prestidigitation: { id: 'prestidigitation', name: 'Prestidigitation', level: 0, kind: 'utility', desc: 'Harmless tricks: sparks, smells, chilled drinks, small noises.', aliases: ['prestidigitation', 'presti'] },
  thaumaturgy: { id: 'thaumaturgy', name: 'Thaumaturgy', level: 0, kind: 'utility', desc: 'Your voice booms, flames flicker, the ground trembles a little.', aliases: ['thaumaturgy'] },
  magic_missile: { id: 'magic_missile', name: 'Magic Missile', level: 1, kind: 'auto', damage: '1d4+1', dtype: 'force', ranged: true, desc: 'Three darts, each 1d4+1 force. They never miss.', aliases: ['magic missile', 'missile', 'missiles'] },
  burning_hands: { id: 'burning_hands', name: 'Burning Hands', level: 1, kind: 'save', damage: '3d6', dtype: 'fire', save: 'dex', aoe: 3, desc: 'A sheet of flame: up to three foes, Dex save for half, 3d6 fire.', aliases: ['burning hands', 'flames'] },
  mage_armor: { id: 'mage_armor', name: 'Mage Armour', level: 1, kind: 'buff', desc: 'AC becomes 13 + Dex until your next long rest.', aliases: ['mage armor', 'mage armour'] },
  cure_wounds: { id: 'cure_wounds', name: 'Cure Wounds', level: 1, kind: 'heal', damage: '2d8', desc: 'Touch: heal 2d8 + Wis.', aliases: ['cure wounds', 'cure', 'heal'] },
  healing_word: { id: 'healing_word', name: 'Healing Word', level: 1, kind: 'heal', damage: '2d4', bonusAction: true, desc: 'Bonus action, at range: heal 2d4 + Wis.', aliases: ['healing word'] },
  guiding_bolt: { id: 'guiding_bolt', name: 'Guiding Bolt', level: 1, kind: 'attack', damage: '4d6', dtype: 'radiant', ranged: true, desc: 'Ranged spell attack, 4d6 radiant; the next attack against the target has advantage.', aliases: ['guiding bolt', 'bolt of light'] },
  bless: { id: 'bless', name: 'Bless', level: 1, kind: 'buff', desc: 'You and your allies add 1d4 to attack rolls for this fight.', aliases: ['bless'] },
};

// ---------- Monsters ----------
const ab = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({ str, dex, con, int, wis, cha });
export const MONSTERS: Record<string, MonsterDef> = {
  zombie: {
    id: 'zombie', name: 'Zombie', plural: 'zombies', ac: 8, hp: '2d8+6', speed: 20, abilities: ab(13, 6, 16, 3, 6, 5),
    attacks: [{ name: 'Slam', toHit: 3, damage: '1d8+1', dtype: 'bludgeoning', verb: 'slams' }], tags: ['undead'], xp: 50,
    immune: ['poison'], traits: ['undead fortitude'], desc: 'Grave dirt in its teeth. It moves like it is late for something.', aliases: ['zombie', 'corpse', 'dead man', 'ghoul'],
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton', plural: 'skeletons', ac: 13, hp: '2d8+4', speed: 30, abilities: ab(10, 16, 15, 6, 8, 5),
    attacks: [{ name: 'Rusted Shortsword', toHit: 4, damage: '1d6+2', dtype: 'piercing', verb: 'stabs at' }], tags: ['undead'], xp: 50,
    vulnerable: ['bludgeoning'], immune: ['poison'], desc: 'Bones held together by habit and something worse.', aliases: ['skeleton', 'bones', 'skelly'],
  },
  wolf: {
    id: 'wolf', name: 'Wolf', plural: 'wolves', ac: 12, hp: '2d8+2', speed: 40, abilities: ab(14, 15, 12, 3, 12, 6),
    attacks: [{ name: 'Bite', toHit: 4, damage: '1d6+2', dtype: 'piercing', verb: 'bites' }], tags: ['beast'], xp: 50,
    traits: ['pack tactics'], desc: 'Lean, grey, and hungry this spring.', aliases: ['wolf', 'dog'],
  },
  dead_wolf: {
    id: 'dead_wolf', name: 'Dead Wolf', ac: 10, hp: '2d8+4', speed: 30, abilities: ab(14, 10, 15, 3, 6, 5),
    attacks: [{ name: 'Bite', toHit: 4, damage: '1d6+2', dtype: 'piercing', verb: 'bites' }], tags: ['undead'], xp: 50,
    immune: ['poison'], traits: ['undead fortitude'], desc: 'One of the pack has been dead a while. It has not noticed.', aliases: ['dead wolf', 'undead wolf', 'rotten wolf'],
  },
  cultist: {
    id: 'cultist', name: 'Cultist', plural: 'cultists', ac: 12, hp: '2d8', speed: 30, abilities: ab(11, 12, 10, 10, 11, 10),
    attacks: [{ name: 'Ritual Sickle', toHit: 3, damage: '1d4+1', dtype: 'slashing', extra: { damage: '1', dtype: 'necrotic' }, verb: 'slashes at' }], tags: ['humanoid'], xp: 25,
    desc: 'Grey robes, green-black wax under the fingernails.', aliases: ['cultist'], surrenderAt: 3,
  },
  merah: {
    id: 'merah', name: 'Merah', ac: 12, hp: '3d8', speed: 30, abilities: ab(10, 12, 10, 12, 13, 14),
    attacks: [{ name: 'Ritual Sickle', toHit: 3, damage: '1d4+1', dtype: 'slashing', extra: { damage: '1d4', dtype: 'necrotic' }, verb: 'slashes at' }], tags: ['humanoid'], xp: 100,
    desc: 'A gaunt woman in grey with rope-burned palms. She rings the bell to wake Her Majesty gently.', aliases: ['merah', 'woman', 'cultist', 'bell ringer', 'ringer'], surrenderAt: 4,
  },
  thornling: {
    id: 'thornling', name: 'Thornling', ac: 13, hp: '1d6+1', speed: 20, abilities: ab(6, 13, 12, 4, 8, 3),
    attacks: [{ name: 'Claw', toHit: 3, damage: '1d4+1', dtype: 'piercing', verb: 'rakes' }], tags: ['plant'], xp: 25,
    vulnerable: ['fire'], desc: 'A knot of dead bramble that walks on its roots. Merah grew it from a candle stub.', aliases: ['thornling', 'bramble', 'twig', 'blight', 'plant', 'bush'],
  },
  grasping_hand: {
    id: 'grasping_hand', name: 'Grasping Hand', plural: 'grasping hands', ac: 12, hp: '1d4+1', speed: 20, abilities: ab(13, 14, 11, 5, 10, 4),
    attacks: [{ name: 'Claw', toHit: 3, damage: '1d4+1', dtype: 'bludgeoning', verb: 'claws at' }], tags: ['undead'], xp: 10,
    immune: ['poison'], desc: 'A severed hand that scuttles on its fingertips.', aliases: ['hand', 'grasping hand', 'claw'],
  },
  alistair: {
    id: 'alistair', name: 'Alistair', ac: 13, hp: '5d8+5', speed: 30, abilities: ab(8, 12, 12, 16, 9, 15),
    attacks: [{ name: 'Chill Touch', toHit: 5, damage: '1d10', dtype: 'necrotic', verb: 'chill-touches' }], tags: ['undead'], xp: 0,
    immune: ['poison'], vulnerable: ['radiant'], desc: 'A skeleton in the rags of very good clothes, with an amused tilt to the skull.', aliases: ['alistair', 'lich', 'skeleton', 'bro'],
  },
};

export const PROF_BONUS = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);
export const XP_FOR_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000];
