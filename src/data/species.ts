// Species of Mosnag. The first nine follow the SRD 5.2.1 species (CC-BY-4.0); the rest are
// Hams Tavern originals that play a familiar role with their own names, traits and lore.
import type { Ability, DamageType, Skill } from '../engine/types';

export interface NaturalWeapon { name: string; damage: string; dtype: DamageType; verbs: string[] }
export interface SpeciesPower { id: string; name: string; desc: string; uses: 'prof' | number; per: 'short' | 'long' }
export interface SpeciesVariant { id: string; name: string; desc: string; resist?: DamageType[]; cantrip?: string; speed?: number; darkvision?: number; breath?: DamageType; skills?: Skill[] }

export interface SpeciesDef {
  id: string;
  name: string;
  group: 'Common folk' | 'Rare folk' | 'Strange folk' | 'Your own';
  size: 'Small' | 'Medium' | 'Small or Medium';
  speed: number;
  darkvision: number;
  blurb: string;
  lore: string;
  traits: string[];
  resist?: DamageType[];
  skills?: Skill[];
  naturalArmor?: { base: number; dex: boolean };
  weapon?: NaturalWeapon;
  fly?: boolean;
  power?: SpeciesPower;
  flags?: string[]; // luck, brave, relentless, toughness, magic-res, cunning, hare-trigger, reach, powerful, sneaky
  cantrip?: string;
  variantLabel?: string;
  variants?: SpeciesVariant[];
}

export const SPECIES: SpeciesDef[] = [
  { id: 'custom_lineage', name: 'Custom Lineage', group: 'Your own', size: 'Small or Medium', speed: 30, darkvision: 0, blurb: 'Something the world has no name for yet: a mixed heritage, a strange birth, a people from beyond the Northern Ocean.',
    lore: 'Kalashscovia is a crossroads. After the war, every kind of person ended up somewhere they didn\'t start. Describe yourself however you like.',
    traits: ['Ability: +2 to one ability score of your choice (on top of your background).', 'Feat: one feat of your choice.', 'Variable trait: darkvision 60 ft, or proficiency in one skill of your choice.', 'Size: Small or Medium, your choice.'],
    variantLabel: 'Variable trait', variants: [
      { id: 'dv', name: 'Darkvision 60 ft', desc: 'You see in dim light as if it were bright, and in darkness as if it were dim, out to 60 feet.', darkvision: 60 },
      { id: 'skill', name: 'A skill proficiency', desc: 'Proficiency in one skill of your choice.' },
    ] },
  // ---------- Common folk (SRD 5.2.1) ----------
  { id: 'human', name: 'Human', group: 'Common folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Everywhere in Kalashscovia, and stubborn about it.',
    lore: 'Humans farmed both sides of the front line and buried both sides\' dead. Nobody trusts them completely, which suits them.',
    traits: ['Resourceful: once per long rest, reroll a failed d20 (Heroic Inspiration).', 'Skillful: proficiency in one extra skill (Perception).'], skills: ['perception'],
    power: { id: 'inspiration', name: 'Heroic Inspiration', desc: 'Reroll a failed d20 once per long rest (automatic).', uses: 1, per: 'long' } },
  { id: 'elf', name: 'Elf', group: 'Common folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Lahti\'s people. Long memories, and the habit of choosing what to forget.',
    lore: 'Elves rule Lahti from white-spired Suomi. The oldest of them were alive the night the crown erased a queen, and none of them remember it.',
    traits: ['Darkvision 60 ft.', 'Keen Senses: proficiency in Perception.', 'Fey Ancestry: advantage on saves against being charmed.', 'Trance: you need only four hours to finish a long rest.'], skills: ['perception'], flags: ['fey'],
    variantLabel: 'Elven lineage', variants: [
      { id: 'suomi', name: 'Suomi-born (high elf)', desc: 'Court-raised. You know the prestidigitation cantrip.', cantrip: 'prestidigitation' },
      { id: 'thornwood', name: 'Thornwood (wood elf)', desc: 'Your speed is 35 ft, and you know the druidcraft cantrip.', speed: 35, cantrip: 'druidcraft' },
      { id: 'underlahti', name: 'Underlahti (deep elf)', desc: 'Born in the old mine-cities. Darkvision 120 ft, and you know the light cantrip.', darkvision: 120, cantrip: 'light' },
    ] },
  { id: 'dwarf', name: 'Dwarf', group: 'Common folk', size: 'Medium', speed: 30, darkvision: 120, blurb: 'Road-menders, miners, drinkers of stout.',
    lore: 'Dwarves dug Lahti\'s mines and fixed its roads, and they mended the treaty roads before the ink was dry. They hear stone talk.',
    traits: ['Darkvision 120 ft.', 'Dwarven Resilience: resistance to poison damage.', 'Dwarven Toughness: +1 HP per level.', 'Stonecunning: you can sense hollows and tunnels in worked stone.'], resist: ['poison'], flags: ['toughness'] },
  { id: 'halfling', name: 'Halfling', group: 'Common folk', size: 'Small', speed: 30, darkvision: 0, blurb: 'Merchants and gossips. Fenwick Tealeaf is one.',
    lore: 'Halflings ran the war\'s supply carts for both armies, at a fair price, and remember exactly who still owes them.',
    traits: ['Luck: when you roll a 1 on a d20 test, reroll it.', 'Brave: advantage on saves against being frightened.', 'Halfling Nimbleness: you can move through the space of larger creatures.', 'Naturally Stealthy.'], flags: ['luck', 'brave'], skills: ['stealth'] },
  { id: 'orc', name: 'Orc', group: 'Common folk', size: 'Medium', speed: 30, darkvision: 120, blurb: 'Makrovin\'s people. Fifteen years ago, the enemy.',
    lore: 'King Grolgar\'s people. In Lahti they get looked at twice, and talked about after they leave.',
    traits: ['Darkvision 120 ft.', 'Relentless Endurance: once per long rest, drop to 1 HP instead of 0.', 'Adrenaline Rush: once per short rest, dash as a bonus action and gain temporary HP equal to your proficiency bonus.'],
    power: { id: 'adrenaline', name: 'Adrenaline Rush', desc: 'Bonus action: gain temporary HP equal to your proficiency bonus.', uses: 'prof', per: 'short' }, flags: ['relentless'] },
  { id: 'tiefling', name: 'Tiefling', group: 'Common folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Horned, often red, never quite trusted.',
    lore: 'Tieflings were born on both sides of the war and blamed by both. Plenty of them keep shops, and plenty work for the crown.',
    traits: ['Darkvision 60 ft.', 'Fiendish Legacy: a resistance and a cantrip.', 'Otherworldly Presence: you know the thaumaturgy cantrip.'], cantrip: 'thaumaturgy',
    variantLabel: 'Fiendish legacy', variants: [
      { id: 'infernal', name: 'Infernal', desc: 'Resistance to fire. You know the fire bolt cantrip.', resist: ['fire'], cantrip: 'fire_bolt' },
      { id: 'abyssal', name: 'Abyssal', desc: 'Resistance to poison. You know the poison spray cantrip.', resist: ['poison'], cantrip: 'poison_spray' },
      { id: 'chthonic', name: 'Chthonic', desc: 'Resistance to necrotic. You know the chill touch cantrip.', resist: ['necrotic'], cantrip: 'chill_touch' },
    ] },
  { id: 'dragonborn', name: 'Dragonborn', group: 'Common folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Scaled travellers, far from home.',
    lore: 'Dragonborn came over the Northern Ocean as mercenaries for both kings and stayed for the peace. Arby, the arcanist in Brumandell, is one.',
    traits: ['Darkvision 60 ft.', 'Breath Weapon: up to three foes make a Dex save or take 1d10 damage of your ancestry\'s type. Uses = proficiency bonus per long rest.', 'Damage Resistance to your ancestry\'s type.'],
    power: { id: 'breath', name: 'Breath Weapon', desc: 'Action: up to three foes, Dex save, 1d10 damage (half on a save).', uses: 'prof', per: 'long' },
    variantLabel: 'Draconic ancestry', variants: [
      { id: 'fire', name: 'Red or gold (fire)', desc: 'Fire breath, fire resistance.', resist: ['fire'], breath: 'fire' },
      { id: 'cold', name: 'White or silver (cold)', desc: 'Cold breath, cold resistance.', resist: ['cold'], breath: 'cold' },
      { id: 'lightning', name: 'Blue or bronze (lightning)', desc: 'Lightning breath, lightning resistance.', resist: ['lightning'], breath: 'lightning' },
      { id: 'acid', name: 'Black or copper (acid)', desc: 'Acid breath, acid resistance.', resist: ['acid'], breath: 'acid' },
      { id: 'poison', name: 'Green (poison)', desc: 'Poison breath, poison resistance.', resist: ['poison'], breath: 'poison' },
    ] },
  { id: 'gnome', name: 'Gnome', group: 'Common folk', size: 'Small', speed: 30, darkvision: 60, blurb: 'Small, clever, curious about everything that ticks.',
    lore: 'Gnomes built half the clockwork in Borschardt\'s counting-houses, and repaired the other half.',
    traits: ['Darkvision 60 ft.', 'Gnomish Cunning: advantage on Intelligence, Wisdom and Charisma saves.'], flags: ['cunning'],
    variantLabel: 'Gnomish lineage', variants: [
      { id: 'forest', name: 'Forest gnome', desc: 'You know the minor illusion cantrip.', cantrip: 'minor_illusion' },
      { id: 'rock', name: 'Rock gnome', desc: 'You know the mage hand and prestidigitation cantrips.', cantrip: 'prestidigitation' },
      { id: 'stonewhisper', name: 'Stonewhisper gnome', desc: 'From the deep shafts. Darkvision 120 ft, and proficiency in Stealth.', darkvision: 120, skills: ['stealth'] },
    ] },
  { id: 'goliath', name: 'Goliath', group: 'Common folk', size: 'Medium', speed: 35, darkvision: 0, blurb: 'Mountain-born giants from the Northern Peaks.',
    lore: 'Goliaths come down from the Peaks in winter to trade furs, and to settle arguments the old way.',
    traits: ['Speed 35 ft.', 'Stone\'s Endurance: reduce damage you take by 1d12 + Con. Uses = proficiency bonus per long rest.', 'Powerful Build.'],
    power: { id: 'stone', name: 'Stone\'s Endurance', desc: 'Reduce a hit by 1d12 + Con (automatic on big hits).', uses: 'prof', per: 'long' }, flags: ['powerful'] },

  // ---------- Rare folk (Hams Tavern originals) ----------
  { id: 'candleborn', name: 'Candleborn', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Born in a house where a vigil candle burned for the dead.',
    lore: 'During the war, families kept candles lit for their missing. Some children born by that light come out a little bright around the edges. The dead turn their heads to watch them pass.',
    traits: ['Darkvision 60 ft.', 'Vigil-Blessed: resistance to necrotic and radiant damage.', 'Vigil Hands: once per long rest, heal yourself or an ally for a number of d4s equal to your proficiency bonus.', 'Candle-Light: you know the light cantrip.'],
    resist: ['necrotic', 'radiant'], cantrip: 'light', power: { id: 'healing_hands', name: 'Vigil Hands', desc: 'Action: heal (proficiency bonus)d4.', uses: 1, per: 'long' } },
  { id: 'felisk', name: 'Felisk', group: 'Rare folk', size: 'Small or Medium', speed: 30, darkvision: 60, blurb: 'Cat-folk from across the Northern Ocean.',
    lore: 'Felisk sailors jumped ship in Madsen and never left. Hetch the tailor insists he has never met one, which they find hilarious.',
    traits: ['Darkvision 60 ft.', 'Claws: unarmed strikes deal 1d6 slashing, and you can climb as fast as you walk.', 'Sudden Bolt: once per short rest, burst away from any fight (automatic escape).', 'Prowler\'s Gift: proficiency in Perception and Stealth.'],
    skills: ['perception', 'stealth'], weapon: { name: 'Claws', damage: '1d6', dtype: 'slashing', verbs: ['claw', 'scratch', 'swipe', 'rake', 'maul'] },
    power: { id: 'escape', name: 'Sudden Bolt', desc: 'Automatically escape from a fight.', uses: 1, per: 'short' } },
  { id: 'rookkin', name: 'Rookkin', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Crow-folk who gather wherever battles were.',
    lore: 'Rookkin came to Greymarch after the war and never left. Lahti calls them the Rememberers, because they can repeat anything they ever heard in the voice that said it.',
    traits: ['Perfect Copy: advantage when you forge or copy something.', 'Rookkin Recall: advantage on a skill check. Uses = proficiency bonus per long rest.', 'Mimicry: you can perfectly imitate any voice you have heard.', 'Proficiency in Deception and History.'],
    skills: ['deception', 'history'], power: { id: 'recall', name: 'Rookkin Recall', desc: 'Your next skill check has advantage.', uses: 'prof', per: 'long' } },
  { id: 'kestren', name: 'Kestren', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Bird-folk of the Northern Peaks\' high cliffs.',
    lore: 'Kestren carried messages for the crown in the war, over the heads of both armies. Some still do.',
    traits: ['Flight: you can fly, unless you wear medium or heavy armour.', 'Talons: unarmed strikes deal 1d6 slashing.', 'Take Wing: once per short rest, escape from any fight into the air.'], fly: true,
    weapon: { name: 'Talons', damage: '1d6', dtype: 'slashing', verbs: ['claw', 'rake', 'talon', 'scratch', 'peck'] },
    power: { id: 'escape', name: 'Take Wing', desc: 'Automatically escape from a fight.', uses: 1, per: 'short' } },
  { id: 'mossback', name: 'Mossback', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Gentle half-giants who tend the Thornwood.',
    lore: 'Mossbacks keep to the deep Thornwood and tend it like a garden. They speak for The Green, quietly, when it lets them.',
    traits: ['Fade into the Leaves: once per short rest, turn invisible until your next attack (advantage on it).', 'Green Tongue: animals and plants understand your meaning.', 'Green Magic: you know the druidcraft cantrip.', 'Powerful Build.'],
    cantrip: 'druidcraft', flags: ['powerful'], skills: ['nature'], power: { id: 'hidden_step', name: 'Fade into the Leaves', desc: 'Bonus action: turn invisible; your next attack has advantage.', uses: 1, per: 'short' } },
  { id: 'goblin', name: 'Goblin', group: 'Rare folk', size: 'Small', speed: 30, darkvision: 60, blurb: 'Quick, small, and from the Mire.',
    lore: 'Goblins of the Southern Mire worship rot and growth, sell mushrooms, and know every back way into every town.',
    traits: ['Darkvision 60 ft.', 'Small but Vicious: add your proficiency bonus to the damage of one hit. Uses = proficiency bonus per long rest.', 'Slippery: hide or disengage as a bonus action.'],
    power: { id: 'fury', name: 'Small but Vicious', desc: 'Bonus action: your next hit deals extra damage equal to your proficiency bonus.', uses: 'prof', per: 'long' }, flags: ['nimble'] },
  { id: 'hobgoblin', name: 'Hobgoblin', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Disciplined, proud, and good at teamwork.',
    lore: 'Hobgoblin companies fought for Makrovin and then, after the treaty, for whoever paid. Grok in Brumandell is one.',
    traits: ['Darkvision 60 ft.', 'Strength in Numbers: when you miss or fail, add +1 per ally fighting with you (minimum +1, maximum +3). Uses = proficiency bonus per long rest.', 'Comrade\'s Gift: helping someone gives them temporary HP.'],
    power: { id: 'fortune', name: 'Strength in Numbers', desc: 'Automatic: turns a near miss into a hit.', uses: 'prof', per: 'long' } },
  { id: 'bugbear', name: 'Bugbear', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Huge, hairy, and surprisingly quiet.',
    lore: 'Bugbears were the war\'s scouts and its night raiders. In peacetime they make excellent bouncers.',
    traits: ['Darkvision 60 ft.', 'Long Arms: your melee reach is longer.', 'From the Shadows: your first hit in a fight deals an extra 2d6, if you act before the target.', 'Sneaky: proficiency in Stealth.', 'Powerful Build.'],
    skills: ['stealth'], flags: ['surprise', 'powerful', 'reach'] },
  { id: 'kobold', name: 'Kobold', group: 'Rare folk', size: 'Small', speed: 30, darkvision: 60, blurb: 'Small dragon-kin, loud in groups.',
    lore: 'Kobolds keep the deep mine-shrines at Tantal and Carcano, and claim the dragons left them in charge.',
    traits: ['Darkvision 60 ft.', 'War-Shriek: you and your allies gain advantage on your next attacks. Uses = proficiency bonus per long rest.', 'Dragon\'s Spark: you know one sorcerer cantrip (fire bolt).'],
    cantrip: 'fire_bolt', power: { id: 'cry', name: 'War-Shriek', desc: 'Bonus action: you and your allies have advantage on your next attacks.', uses: 'prof', per: 'long' } },
  { id: 'mirefolk', name: 'Mirefolk', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Scaled, patient hunters of the Southern Mire.',
    lore: 'Mirefolk pole-barges carry anything through the Mire for the right price. They know the water never fills it, and won\'t say where it goes.',
    traits: ['Natural Armour: your AC is 13 + Dex without armour.', 'Bite: unarmed strikes deal 1d6 piercing.', 'Feeding Bite: once per short rest, a bite heals you (temporary HP = proficiency bonus).', 'Hold Breath: 15 minutes.', 'Mire-Wise: proficiency in Survival and Nature.'],
    naturalArmor: { base: 13, dex: true }, skills: ['survival', 'nature'], weapon: { name: 'Bite', damage: '1d6', dtype: 'piercing', verbs: ['bite', 'chomp', 'gnaw', 'snap'] },
    power: { id: 'hungry_jaws', name: 'Feeding Bite', desc: 'Your next bite also grants temporary HP equal to your proficiency bonus.', uses: 1, per: 'short' } },
  { id: 'shellback', name: 'Shellback', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Turtle-folk from the southern coasts.',
    lore: 'Shellbacks walk the coast road between Madsen and Lugera with their whole lives on their backs.',
    traits: ['Natural Armour: your AC is 17 (Dex doesn\'t apply, and armour doesn\'t help).', 'Claws: unarmed strikes deal 1d6 slashing.', 'Pull In: once per short rest, withdraw into your shell (+4 AC until your next turn).', 'Hold Breath: 1 hour.'],
    naturalArmor: { base: 17, dex: false }, weapon: { name: 'Claws', damage: '1d6', dtype: 'slashing', verbs: ['claw', 'scratch', 'swipe'] },
    power: { id: 'shell', name: 'Pull In', desc: 'Bonus action: +4 AC until your next turn.', uses: 1, per: 'short' } },
  { id: 'tidebound', name: 'Tidebound', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Sea-folk from under the Northern Ocean.',
    lore: 'The Tidebound guard something deep under the Northern Ocean. A few come ashore at Nagant to trade, and to watch the lighthouse.',
    traits: ['Amphibious: you breathe air and water. You swim as fast as you walk.', 'Darkvision 60 ft.', 'Child of the Deep: resistance to cold.', 'Deep Cold: you know the ray of frost cantrip.'],
    resist: ['cold'], cantrip: 'ray_of_frost' },
  { id: 'elementborn', name: 'Elementborn', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'People with an element in their blood.',
    lore: 'Elementborn are born where the old magic leaked into the land: Tokarev\'s forges, the Peaks\' gales, Carcano\'s quarries, the Mire\'s deep water.',
    traits: ['Darkvision 60 ft.', 'Elemental heritage: a resistance and a cantrip.'],
    variantLabel: 'Element', variants: [
      { id: 'ember', name: 'Emberborn (fire)', desc: 'Resistance to fire. You know the produce flame cantrip.', resist: ['fire'], cantrip: 'produce_flame' },
      { id: 'gale', name: 'Galeborn (air)', desc: 'Resistance to lightning, speed 35 ft. You know the shocking grasp cantrip.', resist: ['lightning'], cantrip: 'shocking_grasp', speed: 35 },
      { id: 'stone', name: 'Stoneborn (earth)', desc: 'Resistance to poison. You know the rifle-crack cantrip.', resist: ['poison'], cantrip: 'thunderclap' },
      { id: 'tide', name: 'Tideborn (water)', desc: 'Resistance to acid. You know the numbing frost cantrip, and you swim as fast as you walk.', resist: ['acid'], cantrip: 'frostbite' },
    ] },
  { id: 'changeling', name: 'Changeling', group: 'Rare folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Faces that change at will.',
    lore: 'Changelings say the war made them: you couldn\'t be from the wrong side if you could be anyone. Sereza Harrow may or may not be one.',
    traits: ['Shapechanger: change your appearance and voice at will.', 'Read the Room: proficiency in Deception and Insight.', 'A Borrowed Smile: once per long rest, gain advantage on a Deception or Persuasion check.'],
    skills: ['deception', 'insight'], power: { id: 'recall', name: 'A Borrowed Smile', desc: 'Your next skill check has advantage.', uses: 1, per: 'long' } },
  { id: 'satyr', name: 'Satyr', group: 'Strange folk', size: 'Medium', speed: 35, darkvision: 0, blurb: 'Goat-legged revellers of the old woods.',
    lore: 'Satyrs claim the Thornwood\'s fairy rings belong to them. Alistair says the parties were better in their day.',
    traits: ['Speed 35 ft.', 'Fey: advantage on saves against spells (Magic Resistance).', 'Ram: unarmed strikes deal 1d6 bludgeoning.', 'Life of the Party: proficiency in Performance and Persuasion.'],
    skills: ['performance', 'persuasion'], flags: ['magic-res'], weapon: { name: 'Horns', damage: '1d6', dtype: 'bludgeoning', verbs: ['ram', 'headbutt', 'butt', 'gore'] } },
  { id: 'centaur', name: 'Centaur', group: 'Strange folk', size: 'Medium', speed: 40, darkvision: 0, blurb: 'Horse-bodied wanderers of the open plains.',
    lore: 'Centaur herds roam Sakosta\'s grasslands. The ones in Lahti are traders, couriers, or exiles.',
    traits: ['Speed 40 ft.', 'Hooves: unarmed strikes deal 1d6 bludgeoning.', 'Charge: your first hit in a fight with your hooves deals an extra 1d6.', 'Natural Affinity: proficiency in Survival.'],
    skills: ['survival'], flags: ['charge', 'powerful'], weapon: { name: 'Hooves', damage: '1d6', dtype: 'bludgeoning', verbs: ['kick', 'stomp', 'trample', 'buck', 'hoof'] } },
  { id: 'minotaur', name: 'Minotaur', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Bull-headed, maze-minded.',
    lore: 'Minotaurs built the labyrinth-cellars under Borschardt\'s banks, and are still the only people who can find their way out of them.',
    traits: ['Horns: unarmed strikes deal 1d6 piercing.', 'Shoving Horns: after a melee hit, shove the target (free).', 'Maze-Sense: you always know which way is north.'],
    flags: ['hammering'], weapon: { name: 'Horns', damage: '1d6', dtype: 'piercing', verbs: ['gore', 'headbutt', 'ram', 'horn'] } },
  { id: 'hareling', name: 'Hareling', group: 'Strange folk', size: 'Small or Medium', speed: 30, darkvision: 0, blurb: 'Rabbit-folk with springs in their legs.',
    lore: 'Harelings run Lahti\'s fastest courier routes, and they are terrible at staying in one place.',
    traits: ['Quick Start: add your proficiency bonus to initiative.', 'Long Ears: proficiency in Perception.', 'Spring Away: once per short rest, bound away from any fight.'],
    skills: ['perception'], flags: ['hare-trigger'], power: { id: 'escape', name: 'Spring Away', desc: 'Automatically escape from a fight.', uses: 'prof', per: 'long' } },
  { id: 'owlkin', name: 'Owlkin', group: 'Strange folk', size: 'Small or Medium', speed: 30, darkvision: 120, blurb: 'Feathered and silent, with very large eyes.',
    lore: 'Owlkin keep the archive towers\' rafters. The Greenspire had a colony once.',
    traits: ['Darkvision 120 ft.', 'Flight: you can fly, unless you wear medium or heavy armour.', 'Hush-Wing: proficiency in Stealth.'], fly: true, skills: ['stealth'] },
  { id: 'fairy', name: 'Fairy', group: 'Strange folk', size: 'Small', speed: 30, darkvision: 0, blurb: 'Tiny, winged, older than they look.',
    lore: 'Fairies came out of the Thornwood\'s rings when the bells began. They say something woke them.',
    traits: ['Flight: you can fly.', 'Ring Magic: you know druidcraft, and once per long rest you can outline foes in light (faerie fire).'], fly: true, cantrip: 'druidcraft', flags: ['fey'],
    power: { id: 'faerie', name: 'Ring Magic', desc: 'Action: foes glow; attacks against them have advantage.', uses: 1, per: 'long' } },
  { id: 'wolfblood', name: 'Wolfblood', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Someone in your family married a wolf, or so they say.',
    lore: 'Wolfbloods come from the Thornwood\'s edge villages. When they get angry, they get hairy.',
    traits: ['Darkvision 60 ft.', 'Wolf-Rage: bonus action, gain temporary HP equal to twice your proficiency bonus, and +1 AC until the fight ends. Uses = proficiency bonus per long rest.', 'Keen Senses: proficiency in Perception.'],
    skills: ['perception'], power: { id: 'shifting', name: 'Wolf-Rage', desc: 'Bonus action: temporary HP (2 × proficiency) and +1 AC for the fight.', uses: 'prof', per: 'long' } },
  { id: 'ashdelver', name: 'Ashdelver', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 120, blurb: 'Grey dwarves of the deepest shafts.',
    lore: 'Ashdelvers dug below where the Tantal miners dare. They say the loremasters paid them to, once, and paid them to forget.',
    traits: ['Darkvision 120 ft.', 'Ashdelver Resilience: resistance to poison, and advantage on saves against being charmed.', 'Unshakeable: advantage on saves against being frightened.'], resist: ['poison'], flags: ['brave', 'fey'] },
  { id: 'veilkin', name: 'Veilkin', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Grey elves who lost something in the Forgetting.',
    lore: 'Some elven families came out of the Forgetting paler, quieter, and missing a name. They feel the cold of the dead the way others feel weather.',
    traits: ['Darkvision 60 ft.', 'Necrotic Resistance.', 'Blessing of the Unremembered: once per short rest, step through shadow out of any fight.', 'Trance: four hours of rest is enough.'],
    resist: ['necrotic'], skills: ['perception'], power: { id: 'escape', name: 'Shadow Step', desc: 'Automatically escape from a fight.', uses: 'prof', per: 'long' } },
  { id: 'voidborn', name: 'Voidborn', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'Silver-eyed folk from somewhere between the stars.',
    lore: 'Voidborn arrived during the war, saying the stars had gone quiet where they came from. Grog\'s barkeep in Brumandell is one.',
    traits: ['Star-Learning: proficiency in Arcana and History.', 'Void Mind: resistance to psychic damage.', 'Void Hands: you know the mage hand cantrip, and the hand is invisible.'],
    resist: ['psychic'], skills: ['arcana', 'history'], cantrip: 'mage_hand' },
  { id: 'serpentblood', name: 'Serpentblood', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 60, blurb: 'Scaled, still, and very hard to poison.',
    lore: 'Serpentbloods run the apothecaries of the south. Po of Po\'s Potions buys half her stock from them.',
    traits: ['Darkvision 60 ft.', 'Magic Resistance: advantage on saves against spells.', 'Cold Blood: resistance to poison.', 'Venom Gift: you know the poison spray cantrip.'], resist: ['poison'], cantrip: 'poison_spray', flags: ['magic-res'] },
  { id: 'returned', name: 'Returned', group: 'Strange folk', size: 'Medium', speed: 30, darkvision: 0, blurb: 'You died in the war. You came back. Nobody knows why.',
    lore: 'A few soldiers dug themselves out of Greymarch Field the morning after. They don\'t sleep, they don\'t quite eat, and on still nights they can hear a woman humming.',
    traits: ['Already Dead: you don\'t need to eat or breathe, you have advantage on death saves, and you resist poison.', 'Echoes of Before: add 1d6 to a skill check. Uses = proficiency bonus per long rest.', 'The Queen hums to you: the dead can sense you.'],
    resist: ['poison'], flags: ['deathless'], power: { id: 'past_life', name: 'Echoes of Before', desc: 'Your next skill check gets +1d6.', uses: 'prof', per: 'long' } },
];

export const speciesById = (id: string) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];
export const SPECIES_NOTE = 'Common folk follow the SRD 5.2.1. Rare and strange folk are Hams Tavern originals.';
export type { Ability };
