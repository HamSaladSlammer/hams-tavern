// The twelve classes (SRD 5.2.1, CC-BY-4.0), each with a Kalashscovia twist of its own.
import type { Abilities, Ability, Skill, WeaponCategory } from '../engine/types';

export interface ClassOption { id: string; label: string; choices: { id: string; name: string; desc: string }[] }
export interface Casting { ability: Ability; cantrips: number; prepared: [number, number]; slots: [number, number]; list: string[]; pact?: boolean }

export interface ClassDef {
  id: string;
  name: string;
  title: string; // what Lahti calls them
  hitDie: number;
  primary: Ability[];
  saves: Ability[];
  skillChoices: Skill[];
  skillCount: number;
  weaponProf: WeaponCategory[];
  armorProf: ('light' | 'medium' | 'heavy' | 'shield')[];
  kit: [string, number][];
  equip: { main?: string; armor?: string; shield?: string; ranged?: string };
  copper: number;
  casting?: Casting;
  options?: ClassOption[];
  blurb: string;
  twist: string; // the Kalashscovia twist, in rules terms
  features: Record<number, string[]>;
}

const ALL_SKILLS: Skill[] = ['acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival'];

export const CLASSES: ClassDef[] = [
  {
    id: 'barbarian', name: 'Barbarian', title: 'Trench-Fury', hitDie: 12, primary: ['str', 'con'], saves: ['str', 'con'],
    skillChoices: ['animal handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], skillCount: 2,
    weaponProf: ['simple', 'martial'], armorProf: ['light', 'medium', 'shield'],
    kit: [['greataxe', 1], ['handaxe', 2], ['rations', 3], ['torch', 2]], equip: { main: 'greataxe' }, copper: 1500,
    blurb: 'The war taught some people to stop being afraid. It never taught them to stop being angry.',
    twist: 'Trench-Fury: while raging, you also resist necrotic damage. The cold of the dead can\'t find you through the heat.',
    features: { 1: ['Rage (2 per long rest, bonus action): +2 melee damage, resistance to bludgeoning, piercing, slashing and necrotic, advantage on Strength checks. No spellcasting while raging.', 'Unarmored Defense: AC 10 + Dex + Con without armour.'], 2: ['Reckless Attack: advantage on Strength attacks this turn; attacks against you have advantage too.', 'Danger Sense: advantage on Dexterity saves.', 'A third Rage per long rest.'] },
  },
  {
    id: 'bard', name: 'Bard', title: 'Keeper of Songs', hitDie: 8, primary: ['cha'], saves: ['dex', 'cha'],
    skillChoices: ALL_SKILLS, skillCount: 3, weaponProf: ['simple'], armorProf: ['light'],
    kit: [['leather_armor', 1], ['dagger', 2], ['lute', 1], ['rations', 3]], equip: { main: 'dagger', armor: 'leather_armor' }, copper: 1900,
    casting: { ability: 'cha', cantrips: 2, prepared: [4, 5], slots: [2, 3], list: ['vicious_mockery', 'minor_illusion', 'thunderclap', 'prestidigitation', 'light', 'mage_hand', 'healing_word', 'cure_wounds', 'dissonant_whispers', 'charm_person', 'thunderwave', 'faerie_fire', 'sleep', 'command', 'dread', 'tremor'] },
    blurb: 'In a country that agreed to forget, someone has to remember the words.',
    twist: 'Keeper of Songs: you add your Charisma modifier to History checks, and the old songs you know hold scraps of things the Forgetting erased.',
    features: { 1: ['Bardic Inspiration (Cha mod per long rest, bonus action): add 1d6 to your next d20 roll.', 'Spellcasting (Cha).'], 2: ['Expertise in two skills.', 'Jack of All Trades: add half your proficiency to checks you aren\'t proficient in.'] },
  },
  {
    id: 'cleric', name: 'Cleric', title: 'Priest of the Old Gods', hitDie: 8, primary: ['wis'], saves: ['wis', 'cha'],
    skillChoices: ['history', 'insight', 'medicine', 'persuasion', 'religion'], skillCount: 2,
    weaponProf: ['simple'], armorProf: ['light', 'medium', 'shield'],
    kit: [['chain_shirt', 1], ['mace', 1], ['shield', 1], ['holy_symbol', 1], ['rations', 3], ['torch', 2]], equip: { main: 'mace', armor: 'chain_shirt', shield: 'shield' }, copper: 700,
    casting: { ability: 'wis', cantrips: 3, prepared: [4, 5], slots: [2, 3], list: ['sacred_flame', 'guidance', 'thaumaturgy', 'knell', 'hearthword', 'light', 'cure_wounds', 'healing_word', 'guiding_bolt', 'bless', 'shield_of_faith', 'inflict_wounds', 'command'] },
    options: [
      { id: 'god', label: 'Your god', choices: [
        { id: 'keeper', name: 'The Silent Keeper', desc: 'Guards graves and sees the dead stay dead. Your radiant spells deal +2 damage to undead.' },
        { id: 'hearth', name: 'The Bright Hearth', desc: 'Homes, safe roads and lit windows. Your healing spells heal +2.' },
        { id: 'road', name: 'The Long Road', desc: 'Travellers and wanderers. +5 ft speed, and you know the guidance cantrip for free.' },
        { id: 'old', name: 'The Old Faith', desc: 'The crowned sun nobody prays to any more. Advantage on Religion checks about anything erased or forgotten.' },
      ] },
      { id: 'order', label: 'Divine Order', choices: [
        { id: 'protector', name: 'Protector', desc: 'Heavy armour and martial weapons. You start in chain mail.' },
        { id: 'thaumaturge', name: 'Thaumaturge', desc: 'One extra cantrip, and you add your Wis modifier to Religion and Arcana checks.' },
      ] },
    ],
    blurb: 'The chapels emptied in the war. Someone has to go back in.',
    twist: 'Priest of the Old Gods: you choose one of Lahti\'s gods, and each gives its own blessing.',
    features: { 1: ['Spellcasting (Wis).', 'Divine Order.'], 2: ['Channel Divinity (2 per short rest): Turn Undead. Undead that fail a Wis save flee.'] },
  },
  {
    id: 'druid', name: 'Druid', title: 'Green-Speaker', hitDie: 8, primary: ['wis'], saves: ['int', 'wis'],
    skillChoices: ['arcana', 'animal handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'], skillCount: 2,
    weaponProf: ['simple'], armorProf: ['light', 'shield'],
    kit: [['leather_armor', 1], ['quarterstaff', 1], ['herbalism_kit', 1], ['rations', 3]], equip: { main: 'quarterstaff', armor: 'leather_armor' }, copper: 900,
    casting: { ability: 'wis', cantrips: 2, prepared: [4, 5], slots: [2, 3], list: ['produce_flame', 'shillelagh', 'thorn_whip', 'druidcraft', 'guidance', 'poison_spray', 'frostbite', 'mire_gnats', 'greens_bite', 'cure_wounds', 'healing_word', 'entangle', 'faerie_fire', 'thunderwave', 'goodberry', 'hoarfrost_shard', 'tremor'] },
    options: [{ id: 'order', label: 'Primal Order', choices: [
      { id: 'magician', name: 'Magician', desc: 'One extra cantrip, and you add your Wis modifier to Arcana and Nature checks.' },
      { id: 'warden', name: 'Warden', desc: 'Martial weapons and medium armour.' },
    ] }],
    blurb: 'The plants remember what the people forgot. You can hear them.',
    twist: 'Green-Speaker: you sense undeath and blight. You have advantage on Perception and Survival checks to notice the undead, and The Green sometimes tells you things.',
    features: { 1: ['Druidic.', 'Spellcasting (Wis).', 'Primal Order.'], 2: ['Wild Shape (2 per short rest, bonus action): become a Thornwood wolf (AC 13, bite +4 for 2d4+2) with extra temporary HP.', 'Wild Companion.'] },
  },
  {
    id: 'fighter', name: 'Fighter', title: 'Treaty-War Veteran', hitDie: 10, primary: ['str', 'dex'], saves: ['str', 'con'],
    skillChoices: ['acrobatics', 'animal handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'persuasion', 'survival'], skillCount: 2,
    weaponProf: ['simple', 'martial', 'firearm'], armorProf: ['light', 'medium', 'heavy', 'shield'],
    kit: [['chain_mail', 1], ['longsword', 1], ['shield', 1], ['service_revolver', 1], ['pistol_cartridge', 14], ['rations', 3], ['torch', 2]], equip: { main: 'longsword', armor: 'chain_mail', shield: 'shield', ranged: 'service_revolver' }, copper: 400,
    options: [{ id: 'style', label: 'Fighting Style', choices: [
      { id: 'defense', name: 'Defence', desc: '+1 AC while wearing armour.' },
      { id: 'dueling', name: 'Duelling', desc: '+2 damage with a one-handed melee weapon.' },
      { id: 'archery', name: 'Marksman', desc: '+2 to hit with ranged weapons and firearms.' },
      { id: 'great', name: 'Great Weapon', desc: 'Reroll 1s and 2s on two-handed weapon damage.' },
    ] }],
    blurb: 'You carried a rifle in somebody\'s war. You still clean it every night.',
    twist: 'Treaty-War Veteran: you reload firearms and clear jams as a bonus action.',
    features: { 1: ['Fighting Style.', 'Second Wind (2 per long rest, bonus action): heal 1d10 + level.'], 2: ['Action Surge (1 per short rest): take another action.', 'Tactical Mind.'] },
  },
  {
    id: 'monk', name: 'Monk', title: 'Barroom Ascetic', hitDie: 8, primary: ['dex', 'wis'], saves: ['str', 'dex'],
    skillChoices: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'], skillCount: 2,
    weaponProf: ['simple'], armorProf: [],
    kit: [['quarterstaff', 1], ['dart', 10], ['rations', 3], ['torch', 2]], equip: { main: 'quarterstaff' }, copper: 500,
    blurb: 'Fists, feet, elbows, knees, and a frightening amount of patience.',
    twist: 'Barroom Ascetic: stools, bottles, mugs and chair legs count as monk weapons for you (Martial Arts die).',
    features: { 1: ['Martial Arts: unarmed strikes use Dex and deal 1d6. After an attack, make one unarmed strike as a bonus action.', 'Unarmored Defense: AC 10 + Dex + Wis.'], 2: ['Monk\'s Focus (2 per short rest): Flurry of Blows (two bonus unarmed strikes).', 'Unarmoured Movement.'] },
  },
  {
    id: 'paladin', name: 'Paladin', title: 'Oathbound of the Bell', hitDie: 10, primary: ['str', 'cha'], saves: ['wis', 'cha'],
    skillChoices: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'], skillCount: 2,
    weaponProf: ['simple', 'martial'], armorProf: ['light', 'medium', 'heavy', 'shield'],
    kit: [['chain_mail', 1], ['longsword', 1], ['shield', 1], ['holy_symbol', 1], ['rations', 3]], equip: { main: 'longsword', armor: 'chain_mail', shield: 'shield' }, copper: 300,
    casting: { ability: 'cha', cantrips: 0, prepared: [2, 3], slots: [2, 2], list: ['bless', 'cure_wounds', 'shield_of_faith', 'divine_favor', 'command', 'divine_smite'] },
    blurb: 'You swore an oath on a bell that should never ring wrong.',
    twist: 'Oathbound of the Bell: you can hear a bell rung wrong from a mile away, and you have advantage on saves against the undead\'s fear.',
    features: { 1: ['Lay on Hands (pool of 5 × level HP, bonus action).', 'Spellcasting (Cha).'], 2: ['Fighting Style (Defence).', 'Paladin\'s Smite: after a melee hit, spend a slot for +2d8 radiant (+1d8 vs undead). Type "smite".'] },
  },
  {
    id: 'ranger', name: 'Ranger', title: 'Thornwood Warden', hitDie: 10, primary: ['dex', 'wis'], saves: ['str', 'dex'],
    skillChoices: ['animal handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'], skillCount: 3,
    weaponProf: ['simple', 'martial'], armorProf: ['light', 'medium', 'shield'],
    kit: [['studded_leather', 1], ['shortsword', 2], ['shortbow', 1], ['arrow', 20], ['rations', 3]], equip: { main: 'shortsword', armor: 'studded_leather', ranged: 'shortbow' }, copper: 700,
    casting: { ability: 'wis', cantrips: 0, prepared: [2, 3], slots: [2, 2], list: ['hunters_mark', 'cure_wounds', 'goodberry', 'entangle', 'hoarfrost_shard'] },
    blurb: 'You know which paths the dead walk, and which ones they avoid.',
    twist: 'Thornwood Warden: your Hunter\'s Mark deals 1d8 instead of 1d6 against the undead, and you can\'t get lost in Lahti\'s forests.',
    features: { 1: ['Spellcasting (Wis).', 'Favoured Enemy: Hunter\'s Mark always prepared, cast twice per long rest without a slot.'], 2: ['Deft Explorer (expertise in one skill).', 'Fighting Style (Marksman).'] },
  },
  {
    id: 'rogue', name: 'Rogue', title: 'Largo Cutpurse', hitDie: 8, primary: ['dex'], saves: ['dex', 'int'],
    skillChoices: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleight of hand', 'stealth'], skillCount: 4,
    weaponProf: ['simple', 'martial'], armorProf: ['light'],
    kit: [['leather_armor', 1], ['rapier', 1], ['dagger', 2], ['shortbow', 1], ['arrow', 20], ['thieves_tools', 1], ['rations', 3]], equip: { main: 'rapier', armor: 'leather_armor', ranged: 'shortbow' }, copper: 800,
    blurb: 'Quick hands and quicker exits. Breda has locks; you have opinions about them.',
    twist: 'Largo Cutpurse: you can pickpocket anyone in a crowd (Sleight of Hand against their attention), and fences give you full price.',
    features: { 1: ['Sneak Attack (+1d6 once per turn with advantage, or with an ally beside you).', 'Expertise in two skills.', 'Thieves\' Cant.'], 2: ['Cunning Action: hide or disengage as a bonus action.'] },
  },
  {
    id: 'sorcerer', name: 'Sorcerer', title: 'Treaty-Fire Blood', hitDie: 6, primary: ['cha'], saves: ['con', 'cha'],
    skillChoices: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'], skillCount: 2,
    weaponProf: ['simple'], armorProf: [],
    kit: [['dagger', 2], ['quarterstaff', 1], ['rations', 3], ['torch', 2]], equip: { main: 'quarterstaff' }, copper: 2800,
    casting: { ability: 'cha', cantrips: 4, prepared: [2, 4], slots: [2, 3], list: ['fire_bolt', 'ray_of_frost', 'shocking_grasp', 'poison_spray', 'prestidigitation', 'light', 'mage_hand', 'minor_illusion', 'frostbite', 'thunderclap', 'bonfire', 'magic_missile', 'burning_hands', 'shield', 'sleep', 'chromatic_orb', 'thunderwave', 'charm_person', 'wild_spark', 'hoarfrost_shard', 'tremor'] },
    blurb: 'Your mother was at the treaty signing when the fires were lit. You came out glowing.',
    twist: 'Treaty-Fire Blood: once per long rest, when you\'d drop to 0 HP, your magic flares and you drop to 1 instead, scorching everything near you.',
    features: { 1: ['Spellcasting (Cha).', 'Innate Sorcery (2 per long rest, bonus action): +1 spell save DC and advantage on spell attacks for this fight.'], 2: ['Font of Magic: 2 sorcery points. Turn 2 points into a spell slot (bonus action).', 'Metamagic (twinned spell is coming in a later version).'] },
  },
  {
    id: 'warlock', name: 'Warlock', title: 'Pactbound', hitDie: 8, primary: ['cha'], saves: ['wis', 'cha'],
    skillChoices: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'], skillCount: 2,
    weaponProf: ['simple'], armorProf: ['light'],
    kit: [['leather_armor', 1], ['dagger', 2], ['rations', 3], ['torch', 1]], equip: { main: 'dagger', armor: 'leather_armor' }, copper: 1500,
    casting: { ability: 'cha', cantrips: 2, prepared: [2, 3], slots: [1, 2], pact: true, list: ['eldritch_blast', 'chill_touch', 'minor_illusion', 'prestidigitation', 'mage_hand', 'poison_spray', 'knell', 'frostbite', 'hex', 'charm_person', 'dread', 'dissonant_whispers'] },
    options: [
      { id: 'patron', label: 'Your patron', choices: [
        { id: 'drowned', name: 'The Drowned Below', desc: 'Something under the Southern Mire. Your Eldritch Blast pulls foes toward you, and you can breathe water.' },
        { id: 'green', name: 'The Rot That Feeds', desc: 'The Green\'s hungry side. You gain temporary HP equal to your level when you drop a foe.' },
        { id: 'unremembered', name: 'One Who Was Forgotten', desc: 'A voice that doesn\'t remember its own name. Advantage on History checks, and your Knell deals +1d4.' },
      ] },
      { id: 'invocation', label: 'Eldritch Invocation', choices: [
        { id: 'armor', name: 'Armour of Shadows', desc: 'You can cast Mage Armour on yourself at will.' },
        { id: 'blade', name: 'Pact of the Blade', desc: 'Your melee weapon uses Charisma to hit and for damage.' },
        { id: 'agonizing', name: 'Agonising Blast', desc: 'Add your Charisma modifier to Eldritch Blast damage.' },
      ] },
    ],
    blurb: 'Something answered when you asked. You haven\'t told anyone what you gave it.',
    twist: 'Pactbound: Lahti\'s patrons are old things that lost something in the Forgetting, and they want it back.',
    features: { 1: ['Pact Magic (Cha): slots come back on a short rest.', 'Eldritch Invocation.'], 2: ['Magical Cunning: once per long rest, regain half your pact slots with a minute of focus.', 'A second invocation (Agonising Blast, if you didn\'t take it).'] },
  },
  {
    id: 'wizard', name: 'Wizard', title: 'Loremaster\'s Heir', hitDie: 6, primary: ['int'], saves: ['int', 'wis'],
    skillChoices: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'], skillCount: 2,
    weaponProf: ['simple'], armorProf: [],
    kit: [['quarterstaff', 1], ['dagger', 1], ['spellbook', 1], ['rations', 3], ['torch', 2]], equip: { main: 'quarterstaff' }, copper: 500,
    casting: { ability: 'int', cantrips: 3, prepared: [4, 5], slots: [2, 3], list: ['fire_bolt', 'ray_of_frost', 'shocking_grasp', 'chill_touch', 'prestidigitation', 'light', 'mage_hand', 'minor_illusion', 'frostbite', 'thunderclap', 'mire_gnats', 'bonfire', 'knell', 'magic_missile', 'burning_hands', 'mage_armor', 'shield', 'sleep', 'chromatic_orb', 'thunderwave', 'charm_person', 'hoarfrost_shard', 'tremor', 'dread'] },
    blurb: 'Book-smart. Possibly heart-clumsy. Your spells came from somewhere older than you think.',
    twist: 'Loremaster\'s Heir: once per long rest, you automatically succeed on an Arcana or History check, because your teacher\'s teacher\'s teacher wrote it down somewhere.',
    features: { 1: ['Spellcasting (Int).', 'Ritual Adept.', 'Arcane Recovery: once a day, a short rest restores a spell slot.'], 2: ['Scholar: expertise in one of Arcana, History, Investigation, Medicine, Nature or Religion.'] },
  },
];

export const classById = (id: string) => CLASSES.find((c) => c.id === id) ?? CLASSES[4];

export function arrayFor(cls: ClassDef): Abilities {
  const order: Ability[] = Array.from(new Set<Ability>([...cls.primary, 'con', 'dex', 'wis', 'cha', 'int', 'str']));
  const vals = [15, 14, 13, 12, 10, 8];
  const a = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } as Abilities;
  order.forEach((k, i) => (a[k] = vals[i]));
  return a;
}
