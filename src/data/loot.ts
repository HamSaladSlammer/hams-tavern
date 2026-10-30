// Gear and treasure for the open world: the "Arms of the Last War" firearms, better armour,
// magic weapons, potions and saleable valuables.
import type { ArmorDef, ItemDef, WeaponDef } from '../engine/types';

const W = (w: WeaponDef) => w;
export const EXTRA_WEAPONS: WeaponDef[] = [
  W({ id: 'webley_revolver', name: 'Wexley-pattern Revolver', category: 'firearm', ranged: true, damage: '1d8', dtype: 'piercing', range: [30, 90], ammo: 'pistol', capacity: 6, price: 17500 }),
  W({ id: 'toggle_pistol', name: 'Borschardt Toggle-lock Pistol', category: 'firearm', ranged: true, damage: '1d8', dtype: 'piercing', range: [40, 120], ammo: 'pistol', capacity: 8, price: 35000 }),
  W({ id: 'mosin_rifle', name: 'Mosin-pattern Service Rifle', category: 'firearm', ranged: true, damage: '1d12', dtype: 'piercing', range: [80, 240], ammo: 'rifle', capacity: 5, twoHanded: true, price: 40000 }),
  W({ id: 'lee_rifle', name: 'Lee Long-magazine Rifle', category: 'firearm', ranged: true, damage: '1d12', dtype: 'piercing', range: [80, 240], ammo: 'rifle', capacity: 10, twoHanded: true, price: 45000 }),
  W({ id: 'carcano_carbine', name: 'Carcano Cavalry Carbine', category: 'firearm', ranged: true, damage: '1d10', dtype: 'piercing', range: [60, 180], ammo: 'rifle', capacity: 6, price: 30000 }),
  W({ id: 'arisaka_carbine', name: 'Arisaka Rugged Carbine', category: 'firearm', ranged: true, damage: '1d10', dtype: 'piercing', range: [60, 180], ammo: 'rifle', capacity: 5, price: 32500 }),
  W({ id: 'suomi_smg', name: 'Suomi Drum-fed Gun', category: 'firearm', ranged: true, damage: '2d8', dtype: 'piercing', range: [30, 90], ammo: 'pistol', capacity: 30, twoHanded: true, price: 120000 }),
  W({ id: 'madsen_gun', name: 'Madsen Light Gun', category: 'firearm', ranged: true, damage: '2d10', dtype: 'piercing', range: [80, 240], ammo: 'rifle', capacity: 25, twoHanded: true, price: 250000 }),
  W({ id: 'greatsword', name: 'Greatsword', category: 'martial', ranged: false, damage: '2d6', dtype: 'slashing', twoHanded: true, price: 5000 }),
  W({ id: 'longbow', name: 'Longbow', category: 'martial', ranged: true, damage: '1d8', dtype: 'piercing', range: [150, 600], ammo: 'arrow', twoHanded: true, price: 5000 }),
  W({ id: 'sabre_plus1', name: 'Officer\'s Sabre +1', category: 'martial', ranged: false, damage: '1d8', dtype: 'slashing', finesse: true, bonus: 1, silvered: true, price: 60000 }),
  W({ id: 'longsword_plus1', name: 'Longsword +1', category: 'martial', ranged: false, damage: '1d8', dtype: 'slashing', bonus: 1, price: 50000 }),
  W({ id: 'rapier_plus1', name: 'Suomi Fencing Blade +1', category: 'martial', ranged: false, damage: '1d8', dtype: 'piercing', finesse: true, bonus: 1, price: 50000 }),
  W({ id: 'greataxe_plus1', name: 'Greataxe +1', category: 'martial', ranged: false, damage: '1d12', dtype: 'slashing', twoHanded: true, bonus: 1, price: 50000 }),
  W({ id: 'warhammer_plus2', name: 'Dreyse\'s Hammer +2', category: 'martial', ranged: false, damage: '1d8', dtype: 'bludgeoning', bonus: 2, price: 200000 }),
  W({ id: 'dagger_plus2', name: 'Moon-silver Dagger +2', category: 'simple', ranged: false, damage: '1d4', dtype: 'piercing', finesse: true, light: true, thrown: true, range: [20, 60], bonus: 2, silvered: true, price: 200000 }),
  W({ id: 'revolver_plus1', name: 'Engraved Service Revolver +1', category: 'firearm', ranged: true, damage: '1d8', dtype: 'piercing', range: [30, 90], ammo: 'pistol', capacity: 7, bonus: 1, price: 75000 }),
  W({ id: 'rifle_plus2', name: 'The Widowmaker (Mosin +2)', category: 'firearm', ranged: true, damage: '1d12', dtype: 'piercing', range: [100, 300], ammo: 'rifle', capacity: 5, twoHanded: true, bonus: 2, price: 300000 }),
  W({ id: 'greatsword_plus3', name: 'Treaty-Breaker (Greatsword +3)', category: 'martial', ranged: false, damage: '2d6', dtype: 'slashing', twoHanded: true, bonus: 3, price: 1000000 }),
  W({ id: 'chisel_of_unmaking', name: 'The Chisel of Unmaking', category: 'simple', ranged: false, damage: '1d4', dtype: 'piercing', finesse: true, light: true, bonus: 2, price: 0 }),
];

export const EXTRA_ARMOR: ArmorDef[] = [
  { id: 'breastplate', name: 'Breastplate', base: 14, dexCap: 2, kind: 'medium', price: 40000 },
  { id: 'half_plate', name: 'Half Plate', base: 15, dexCap: 2, kind: 'medium', stealthDis: true, price: 75000 },
  { id: 'splint', name: 'Splint', base: 17, dexCap: 0, kind: 'heavy', stealthDis: true, price: 20000 },
  { id: 'plate', name: 'Plate Armour', base: 18, dexCap: 0, kind: 'heavy', stealthDis: true, price: 150000 },
  { id: 'elven_chain', name: 'Suomi Mithral Shirt', base: 13, dexCap: null, kind: 'light', price: 300000 },
];

export const EXTRA_ITEMS: ItemDef[] = [
  { id: 'potion_greater', name: 'Potion of Greater Healing', kind: 'potion', price: 15000, desc: 'Deep red. Heals 4d4+4.', heal: '4d4+4', aliases: ['greater potion', 'greater healing'] },
  { id: 'potion_superior', name: 'Potion of Superior Healing', kind: 'potion', price: 50000, desc: 'Almost black. Heals 8d4+8.', heal: '8d4+8', aliases: ['superior potion', 'superior healing'] },
  { id: 'potion_supreme', name: 'Potion of Supreme Healing', kind: 'potion', price: 135000, desc: 'It glows. Heals 10d4+20.', heal: '10d4+20', aliases: ['supreme potion', 'supreme healing'] },
  { id: 'ring_protection', name: 'Ring of Protection', kind: 'treasure', price: 350000, desc: '+1 AC and saving throws while worn.', acBonus: 1, saveBonus: 1, aliases: ['ring'] },
  { id: 'cloak_protection', name: 'Cloak of Protection', kind: 'treasure', price: 350000, desc: '+1 AC and saving throws while worn.', acBonus: 1, saveBonus: 1, aliases: ['cloak'] },
  { id: 'bellbronze_wraps', name: 'Bellbronze Wraps', kind: 'treasure', price: 0, desc: 'Handwraps with bronze from an anchor-chapel bell sewn in: your unarmed strikes are +1 and magical, and deal +1d4 thunder to the dead. "Bells remember what they were made to hold down."', acBonus: 0, aliases: ['wraps', 'handwraps'] },
  { id: 'amulet_drunkard', name: 'Amulet of the Drunkard', kind: 'treasure', price: 50000, desc: 'A tin flask on a chain, always a third full. While worn, drink never makes you worse at anything.', aliases: ['amulet', 'flask'] },
  { id: 'silver_locket', name: 'Silver Locket', kind: 'treasure', price: 2500, desc: 'Inside: a painted face, worn away by a thumb.', aliases: ['locket'] },
  { id: 'gold_ring', name: 'Gold Ring', kind: 'treasure', price: 7500, desc: 'A plain gold band. Someone\'s wedding.', aliases: ['ring', 'gold ring'] },
  { id: 'war_medal', name: 'War Medal', kind: 'treasure', price: 1000, desc: 'For valour at a battle nobody names any more.', aliases: ['medal'] },
  { id: 'jade_idol', name: 'Jade Idol', kind: 'treasure', price: 25000, desc: 'A little green figure from across the Northern Ocean.', aliases: ['idol', 'statuette'] },
  { id: 'crown_bond', name: 'Crown Promissory Note', kind: 'treasure', price: 20000, desc: 'A bank note on a Borschardt counting-house. Somebody will want this back.', aliases: ['note', 'bond', 'promissory note'] },
  { id: 'parcel', name: 'Sealed Parcel', kind: 'treasure', price: 0, desc: 'Brown paper, string, and a wax seal you are not to break. It ticks, faintly. Probably a clock.', aliases: ['parcel', 'package'] },
  { id: 'old_vaults_key', name: 'Key to the Old Vaults', kind: 'key', price: 0, desc: 'Bone, not iron. It is always colder than the room.', aliases: ['vault key', 'bone key'] },
  { id: 'bell_pattern', name: 'The Old Bell Pattern', kind: 'note', price: 0, desc: 'Sheet music for a bell, written in a hand two centuries old.', read: 'Seven strokes, a rest, three, a rest, one. Rung forwards it holds. Rung backwards it wakes. Merah rang it backwards.', aliases: ['bell pattern', 'pattern', 'music'] },
  { id: 'true_name', name: 'A Name Scratched in Wax', kind: 'note', price: 0, desc: 'A strip of wax with five letters you can\'t read aloud without your teeth aching.', read: 'V-E-S-S-A. The rest has been scraped away, and then written back in, smaller, by a different hand.', aliases: ['true name', 'name', 'wax'] },
];
