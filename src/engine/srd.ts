// Rules data adapted from the System Reference Document 5.2.1 (CC-BY-4.0, Wizards of the Coast).
// See ATTRIBUTION.md. Setting-specific items (firearms, the Kalashscovia names) are original.
import type { ArmorDef, ItemDef, MonsterDef, WeaponDef } from './types';
import { EXTRA_WEAPONS, EXTRA_ARMOR, EXTRA_ITEMS } from '../data/loot';
import { BESTIARY } from '../data/bestiary';

export { SPECIES, speciesById } from '../data/species';
export { CLASSES, classById } from '../data/classes';
export { BACKGROUNDS, backgroundById, FEATS } from '../data/backgrounds';
export { SPELLS } from '../data/spells';
export type { SpellDef } from '../data/spells';

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
  W({ id: 'sickle', name: 'Sickle', category: 'simple', ranged: false, damage: '1d4', dtype: 'slashing', light: true, price: 100 }),
  W({ id: 'club_improvised', name: 'Improvised Weapon', category: 'simple', ranged: false, damage: '1d4', dtype: 'bludgeoning', thrown: true, range: [20, 60], price: 0 }),
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

WEAPONS.push(...EXTRA_WEAPONS);
ARMOR.push(...EXTRA_ARMOR);

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
  { id: 'mug_ale', name: 'Mug of Barrel Brown', kind: 'drink', price: 5, desc: 'Brown, cold enough, and honest. Squib\'s house ale.', aliases: ['mug', 'ale', 'beer', 'drink', 'pint', 'barrel brown', 'brown', 'tankard', 'mug of ale'] },
  { id: 'mug_stout', name: 'Mug of Dwarven Stout', kind: 'drink', price: 10, desc: 'Black as a mineshaft and nearly as thick.', aliases: ['stout', 'mug', 'drink'] },
  { id: 'cider', name: 'Brumandell Cider', kind: 'drink', price: 5, desc: 'Apples, sunshine, and a kick you don\'t see coming.', aliases: ['cider', 'drink'] },
  { id: 'wine', name: 'Carafe of Galilin Red', kind: 'drink', price: 25, desc: 'Rough, red, and generous.', aliases: ['wine', 'red', 'carafe', 'drink'] },
  { id: 'trenchfire_shot', name: 'Shot of Trenchfire', kind: 'drink', price: 5, desc: 'Orcish rotgut. It tastes like regret.', aliases: ['trenchfire', 'shot', 'rotgut', 'whiskey', 'whisky', 'drink'] },
  { id: 'water_cup', name: 'Cup of Water', kind: 'drink', price: 0, desc: 'Cold well water.', aliases: ['water', 'cup'] },
  { id: 'mug_empty', name: 'Empty Mug', kind: 'gear', price: 2, desc: 'Heavy clay, a chip on the rim. Makes a decent club in a pinch.', aliases: ['mug', 'empty mug', 'tankard', 'cup'] },
  { id: 'bottle_empty', name: 'Empty Bottle', kind: 'gear', price: 1, desc: 'Green glass. Smash it and it\'s a weapon.', aliases: ['bottle', 'empty bottle'] },
  { id: 'chair_leg', name: 'Chair Leg', kind: 'gear', price: 0, desc: 'Solid oak, splintered at one end.', aliases: ['chair leg', 'leg', 'club', 'stick'] },
  { id: 'rock', name: 'Rock', kind: 'gear', price: 0, desc: 'A fist-sized rock. Satisfying weight.', aliases: ['rock', 'stone', 'pebble'] },
  { id: 'stick', name: 'Stout Stick', kind: 'gear', price: 0, desc: 'A sturdy fallen branch.', aliases: ['stick', 'branch', 'twig'] },
  { id: 'bone', name: 'Old Bone', kind: 'gear', price: 0, desc: 'A long bone. You try not to think about whose.', aliases: ['bone', 'femur'] },
  { id: 'mushroom', name: 'Pale Mushroom', kind: 'food', price: 2, desc: 'Violet gills. Could be dinner. Could be Widow\'s Cap.', aliases: ['mushroom', 'shroom', 'fungus'] },
  { id: 'egg', name: 'Egg', kind: 'food', price: 1, desc: 'A fresh brown egg.', aliases: ['egg', 'eggs'] },
  { id: 'apple', name: 'Apple', kind: 'food', price: 1, desc: 'A Brumandell apple, a bit bruised.', aliases: ['apple', 'fruit'] },
  { id: 'goodberry', name: 'Goodberry', kind: 'food', price: 0, desc: 'A berry swollen with magic. Eating it heals 1 HP.', aliases: ['berry', 'goodberry', 'berries'] },
  { id: 'lute', name: 'Lute', kind: 'gear', price: 3500, desc: 'Scratched, beloved, slightly out of tune.', aliases: ['lute', 'instrument'] },
  { id: 'herbalism_kit', name: 'Herbalism Kit', kind: 'gear', price: 500, desc: 'Pouches, a mortar, dried leaves.' },
  { id: 'candle', name: 'Candle', kind: 'gear', price: 1, desc: 'An ordinary tallow candle.', aliases: ['candle'] },
  { id: 'book_of_lore', name: 'Book of Lore', kind: 'note', price: 2500, desc: 'A battered history of Lahti, with chapters torn out.', read: 'The chapter on "The Old Court" has been removed so neatly you almost don\'t notice. The index still lists a page for "V—", and the page is missing.', aliases: ['book'] },
  { id: 'smith_tools', name: 'Smith\'s Tools', kind: 'gear', price: 2000, desc: 'Hammer, tongs, a small file.' },
  { id: 'fine_clothes', name: 'Fine Clothes', kind: 'gear', price: 1500, desc: 'Too good for the road, and everyone notices.' },
  { id: 'marked_cards', name: 'Marked Cards', kind: 'gear', price: 100, desc: 'A deck that always tells you the truth.', aliases: ['cards', 'deck'] },
  { id: 'costume', name: 'Costume', kind: 'gear', price: 500, desc: 'A theatre king\'s robe, slightly moth-eaten.' },
  { id: 'lantern', name: 'Hooded Lantern', kind: 'gear', price: 500, desc: 'Bright and steady.', aliases: ['lantern', 'lamp'] },
  { id: 'lamp', name: 'Oil Lamp', kind: 'gear', price: 50, desc: 'A small brass lamp.' },
  { id: 'scales', name: 'Merchant\'s Scales', kind: 'gear', price: 500, desc: 'For weighing coin and lies.' },
  { id: 'signet_ring', name: 'Signet Ring', kind: 'treasure', price: 0, desc: 'Your family crest. It opens some doors in Suomi.' },
  { id: 'bedroll', name: 'Bedroll', kind: 'gear', price: 100, desc: 'Lumpy but yours.' },
  { id: 'keepsake', name: 'Keepsake', kind: 'treasure', price: 0, desc: 'A tin soldier with one arm. The only thing you had when they found you.' },
  { id: 'queens_coin', name: 'Coin with a Queen\'s Face', kind: 'key', price: 0, desc: 'An old silver coin. The crowned woman on it is beautiful, and nobody can tell you who she is. It is always cold.', aliases: ['coin', 'queen coin', 'old coin'] },
  { id: 'travel_cloak', name: 'Travel Cloak', kind: 'gear', price: 500, desc: 'Hetch\'s work: oiled wool, deep hood, a lining that smells faintly of cedar. Warm, and much better than what you had.', aliases: ['cloak'] },
  { id: 'cult_candle', name: 'Green-Black Candle', kind: 'treasure', price: 10, desc: 'Burns with a greenish flame. Smells of graves and honey.', aliases: ['candle', 'candles'] },
);
items.push(...EXTRA_ITEMS);
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
  // ---- townsfolk: anyone can be fought ----
  squib: {
    id: 'squib', name: 'Squib', ac: 14, hp: '9d10+18', speed: 30, abilities: ab(19, 12, 16, 10, 14, 11),
    attacks: [{ name: 'Fists like shovels', toHit: 6, damage: '2d6+4', dtype: 'bludgeoning', verb: 'hammers' }], tags: ['humanoid'], xp: 450,
    desc: 'Seven feet of half-orc stretcher-bearer who has decided you are no longer a guest.', aliases: ['squib', 'barkeep', 'bartender', 'half-orc'],
  },
  road_dwarf: {
    id: 'road_dwarf', name: 'Road Dwarf', plural: 'dwarves', ac: 13, hp: '3d8+6', speed: 25, abilities: ab(15, 10, 15, 10, 11, 10),
    attacks: [{ name: 'Mug and fist', toHit: 4, damage: '1d6+2', dtype: 'bludgeoning', verb: 'wallops' }], tags: ['humanoid'], xp: 50, resist: ['poison'],
    desc: 'Built like a keg and twice as dense.', aliases: ['dwarf', 'dwarves', 'borin', 'odo', 'marrik', 'tokk'], surrenderAt: 3,
  },
  window_scout: {
    id: 'window_scout', name: 'Window-table scout', ac: 13, hp: '3d8', speed: 30, abilities: ab(10, 15, 10, 11, 13, 10),
    attacks: [{ name: 'Knife', toHit: 4, damage: '1d4+2', dtype: 'piercing', verb: 'stabs at' }], tags: ['humanoid'], xp: 50,
    desc: 'Old soldiers who sit facing the door for a reason.', aliases: ['elf', 'elves', 'goblin', 'goblins', 'faelar', 'ithren', 'nix', 'vetch', 'whisperers'], surrenderAt: 4,
  },
  sereza: {
    id: 'sereza', name: 'Sereza Harrow', ac: 15, hp: '6d8+6', speed: 30, abilities: ab(10, 16, 12, 13, 12, 16),
    attacks: [{ name: 'Hidden blade', toHit: 5, damage: '1d6+3', dtype: 'piercing', extra: { damage: '1d6', dtype: 'fire' }, verb: 'opens you up with a blade you never saw' }], tags: ['humanoid'], xp: 200, resist: ['fire'],
    desc: 'She was always closer to the door than you.', aliases: ['sereza', 'harrow', 'tiefling', 'woman'], surrenderAt: 6,
  },
  garrick: {
    id: 'garrick', name: 'Garrick', ac: 10, hp: '2d8', speed: 30, abilities: ab(10, 10, 10, 11, 10, 13),
    attacks: [{ name: 'Ledger', toHit: 2, damage: '1d4', dtype: 'bludgeoning', verb: 'swats at' }], tags: ['humanoid'], xp: 10,
    desc: 'A shopkeeper who has never been in a fight and is not enjoying his first.', aliases: ['garrick', 'shopkeeper', 'merchant'], surrenderAt: 6,
  },
  smith: {
    id: 'smith', name: 'Mother Dreyse', ac: 14, hp: '7d8+14', speed: 30, abilities: ab(18, 10, 15, 10, 12, 10),
    attacks: [{ name: 'Forge hammer', toHit: 5, damage: '1d8+4', dtype: 'bludgeoning', verb: 'swings her hammer at' }], tags: ['humanoid'], xp: 200, resist: ['fire'],
    desc: 'Sixty years old and has been hitting things with hammers for fifty of them.', aliases: ['smith', 'dreyse', 'blacksmith', 'mother dreyse'], surrenderAt: 8,
  },
  hetch: {
    id: 'hetch', name: 'Hetch', ac: 16, hp: '6d6+6', speed: 40, abilities: ab(6, 18, 12, 16, 14, 15),
    attacks: [{ name: 'Storm of pins', toHit: 6, damage: '3d4', dtype: 'piercing', ranged: true, verb: 'flings a storm of pins at' }], tags: ['fey'], xp: 200,
    desc: 'Every pin in the shop rises and turns toward you.', aliases: ['hetch', 'cat', 'tailor'], surrenderAt: 4,
  },
  doss: {
    id: 'doss', name: 'Doss', ac: 10, hp: '2d8', speed: 25, abilities: ab(11, 9, 12, 10, 13, 10),
    attacks: [{ name: 'Crook', toHit: 2, damage: '1d4', dtype: 'bludgeoning', verb: 'swings his crook at' }], tags: ['humanoid'], xp: 10,
    desc: 'An old, deaf shepherd who doesn\'t understand why you\'re doing this.', aliases: ['doss', 'shepherd', 'old man'], surrenderAt: 4,
  },
  merla: {
    id: 'merla', name: 'Merla Thatch', ac: 10, hp: '2d8', speed: 30, abilities: ab(12, 10, 11, 10, 12, 10),
    attacks: [{ name: 'Pitchfork', toHit: 3, damage: '1d6+1', dtype: 'piercing', verb: 'jabs her pitchfork at' }], tags: ['humanoid'], xp: 10,
    desc: 'A farmer defending the only thing she has left.', aliases: ['merla', 'farmer', 'woman', 'wife'], surrenderAt: 4,
  },
  aldwin: {
    id: 'aldwin', name: 'Aldwin Thatch', ac: 8, hp: '3d8+6', speed: 20, abilities: ab(13, 6, 16, 3, 6, 5),
    attacks: [{ name: 'Clumsy grab', toHit: 2, damage: '1d4', dtype: 'bludgeoning', verb: 'paws at' }], tags: ['undead'], xp: 100,
    immune: ['poison'], desc: 'A farmer in his Sunday shirt. Dead a month. Still wearing his ring.', aliases: ['aldwin', 'husband', 'zombie', 'dead man', 'farmer'],
  },
  militia: {
    id: 'militia', name: 'Militia', plural: 'militia', ac: 14, hp: '2d8+2', speed: 30, abilities: ab(13, 12, 12, 10, 11, 10),
    attacks: [{ name: 'Spear', toHit: 3, damage: '1d6+1', dtype: 'piercing', verb: 'jabs a spear at' }], tags: ['humanoid'], xp: 25,
    desc: 'Breda militia: a farmer with a spear and a borrowed helmet.', aliases: ['militia', 'guard', 'guards', 'watch', 'soldier'], surrenderAt: 3,
  },
  sergeant: {
    id: 'sergeant', name: 'Sergeant Voss', ac: 16, hp: '5d8+10', speed: 30, abilities: ab(16, 12, 14, 10, 12, 12),
    attacks: [{ name: 'Longsword', toHit: 5, damage: '1d8+3', dtype: 'slashing', verb: 'cuts at' }], tags: ['humanoid'], xp: 100,
    desc: 'The militia sergeant. Veteran of Greymarch. Tired of this.', aliases: ['sergeant', 'voss', 'captain'], surrenderAt: 6,
  },
  wolf_pack: {
    id: 'wolf_pack', name: 'Wolf', plural: 'wolves', ac: 12, hp: '2d8+2', speed: 40, abilities: ab(14, 15, 12, 3, 12, 6),
    attacks: [{ name: 'Bite', toHit: 4, damage: '1d6+2', dtype: 'piercing', verb: 'bites' }], tags: ['beast'], xp: 50,
    traits: ['pack tactics'], desc: 'Lean, grey, and hungry this spring.', aliases: ['wolf', 'wolves', 'dog'],
  },
  alistair: {
    id: 'alistair', name: 'Alistair', ac: 13, hp: '5d8+5', speed: 30, abilities: ab(8, 12, 12, 16, 9, 15),
    attacks: [{ name: 'Chill Touch', toHit: 5, damage: '1d10', dtype: 'necrotic', verb: 'chill-touches' }], tags: ['undead'], xp: 0,
    immune: ['poison'], vulnerable: ['radiant'], desc: 'A skeleton in the rags of very good clothes, with an amused tilt to the skull.', aliases: ['alistair', 'lich', 'skeleton', 'bro'],
  },
};
for (const m of BESTIARY) MONSTERS[m.id] = m;
const CR_BY_XP: [number, number][] = [[10, 0], [25, 0.125], [50, 0.25], [100, 0.5], [200, 1], [450, 2], [700, 3], [1100, 4], [1800, 5]];
for (const m of Object.values(MONSTERS)) if (m.cr === undefined) m.cr = (CR_BY_XP.find(([xp]) => m.xp <= xp) ?? [0, 5])[1];

export const PROF_BONUS = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);
export { XP_TABLE as XP_FOR_LEVEL } from '../data/progression';
