// Levels 1-20: spell points, extra attacks, ability score improvements, class features and
// subclasses. Class chassis follows SRD 5.2.1 (CC-BY-4.0). Subclasses marked `inspired` play a
// role players will recognise from other books, with original names, wording and rules.
//
// Perks are small machine-readable tags the engine understands:
//   crit:19 · ac:1 · speed:10 · init_adv · resist:<type> · hp_lvl:1 · rage_dmg:N · heal_bonus · spell_mod
//   kill_temp · uncanny · xatk:N · strike:<dice>:<dtype|same>:<when>[:once]  (when = weapon|melee|raging|hurt|round1|any)
//   cantrip:<dice> · drunk_ok · sneak_duel · stat:<ability>:<n> · save_bonus:<ability> · mark_d10 · relentless_rage

export const XP_TABLE = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** Full-caster spell points (sum of slot levels) and highest spell level, by level. */
const FULL_POINTS = [0, 2, 3, 8, 10, 16, 19, 23, 27, 36, 41, 47, 47, 54, 54, 62, 62, 71, 76, 82, 89];
const FULL_MAX = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9];
const PACT_SLOTS = [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const PACT_LEVEL = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

export type CasterKind = 'full' | 'half' | 'pact' | 'none';
export function casterKind(cls: string): CasterKind {
  if (['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(cls)) return 'full';
  if (['paladin', 'ranger'].includes(cls)) return 'half';
  if (cls === 'warlock') return 'pact';
  return 'none';
}
export function spellPoints(cls: string, level: number): number {
  const k = casterKind(cls);
  if (k === 'full') return FULL_POINTS[level];
  if (k === 'half') return FULL_POINTS[Math.ceil(level / 2)];
  if (k === 'pact') return PACT_SLOTS[level] * PACT_LEVEL[level];
  return 0;
}
export function maxSpellLevel(cls: string, level: number): number {
  const k = casterKind(cls);
  if (k === 'full') return FULL_MAX[level];
  if (k === 'half') return Math.min(5, FULL_MAX[Math.ceil(level / 2)]);
  if (k === 'pact') return level >= 17 ? 9 : level >= 15 ? 8 : level >= 13 ? 7 : level >= 11 ? 6 : PACT_LEVEL[level];
  return 0;
}
export const cantripTier = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);

export function attacksPerAction(cls: string, level: number, perks: string[]): number {
  let n = 1;
  if (['barbarian', 'paladin', 'ranger', 'monk'].includes(cls) && level >= 5) n = 2;
  if (cls === 'fighter') n = level >= 20 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  for (const p of perks) if (p.startsWith('xatk:')) n = Math.max(n, Number(p.split(':')[1]));
  return n;
}

export function asiLevels(cls: string): number[] {
  const base = [4, 8, 12, 16, 19];
  if (cls === 'fighter') return [...base, 6, 14];
  if (cls === 'rogue') return [...base, 10];
  return base;
}

export interface Feature { name: string; desc: string; perks?: string[] }
const F = (name: string, desc: string, perks?: string[]): Feature => ({ name, desc, perks });

/** Class features from level 3 to 20 (levels 1-2 live in data/classes.ts). */
export const CLASS_FEATURES: Record<string, Record<number, Feature[]>> = {
  barbarian: {
    5: [F('Extra Attack', 'Two attacks with the Attack action.'), F('Fast Movement', '+10 ft speed when not in heavy armour.', ['speed:10'])],
    7: [F('Feral Instinct', 'Advantage on initiative. Trench nerves never really switch off.', ['init_adv'])],
    9: [F('Brutal Strike', 'Rage damage rises to +3.', ['rage_dmg:3'])],
    11: [F('Relentless Rage', 'While raging, dropping to 0 HP leaves you at 1 instead, once per rest.', ['relentless_rage'])],
    15: [F('Persistent Rage', 'Your rage only ends when you choose.')],
    16: [F('Brutal Strike II', 'Rage damage rises to +4.', ['rage_dmg:4'])],
    18: [F('Indomitable Might', 'Your Strength checks never fall below your Strength score.')],
    20: [F('Primal Champion', 'Strength and Constitution +4 (max 24).', ['stat:str:4', 'stat:con:4'])],
  },
  bard: {
    5: [F('Font of Inspiration', 'Bardic Inspiration returns on a short rest; the die becomes a d8.')],
    10: [F('Magical Secrets', 'You can learn spells from any class list.'), F('Inspiration d10', 'Your Bardic Inspiration die becomes a d10.')],
    15: [F('Inspiration d12', 'Your Bardic Inspiration die becomes a d12.')],
    20: [F('Words of Creation', 'You know the words the world was sung with. Your spell DC rises by 1.')],
  },
  cleric: {
    5: [F('Sear Undead', 'Turn Undead also burns: turned undead take radiant damage.')],
    7: [F('Blessed Strikes', 'Once per turn your weapon hit or cantrip deals +1d8 radiant.', ['strike:1d8:radiant:any:once'])],
    10: [F('Divine Intervention', 'Once a week, call on the Keeper and ask for a miracle ("pray for intervention").')],
    14: [F('Improved Blessed Strikes', 'Blessed Strikes become 2d8.', ['strike:1d8:radiant:any:once'])],
    20: [F('Greater Intervention', 'Your miracles always come.')],
  },
  druid: {
    5: [F('Wild Resurgence', 'You can turn a spell slot into a Wild Shape, or back.')],
    7: [F('Elemental Fury', 'Your cantrips and wild-shape attacks deal +1d8 once per turn.', ['cantrip:1d8'])],
    15: [F('Improved Elemental Fury', 'Elemental Fury becomes 2d8.', ['cantrip:1d8'])],
    18: [F('Beast Spells', 'You can cast while wild-shaped.')],
    20: [F('Archdruid', 'Wild Shape whenever you like; you age slowly now.')],
  },
  fighter: {
    5: [F('Extra Attack', 'Two attacks with the Attack action.')],
    9: [F('Indomitable', 'Reroll a failed save, once per long rest.')],
    11: [F('Two Extra Attacks', 'Three attacks with the Attack action.')],
    13: [F('Studied Attacks', 'Miss once, and your next attack against them has advantage.')],
    17: [F('Action Surge II', 'Two Action Surges per rest.')],
    20: [F('Three Extra Attacks', 'Four attacks with the Attack action.')],
  },
  monk: {
    5: [F('Extra Attack', 'Two attacks with the Attack action.'), F('Martial Arts d8', 'Your unarmed strikes deal 1d8.')],
    6: [F('Empowered Strikes', 'Your unarmed strikes count as magical force.'), F('Unarmoured Movement', '+10 ft speed.', ['speed:10'])],
    7: [F('Evasion', 'Area attacks that allow a Dex save do half or nothing to you.')],
    11: [F('Martial Arts d10', 'Your unarmed strikes deal 1d10.')],
    14: [F('Disciplined Survivor', 'Proficiency in every save.')],
    17: [F('Martial Arts d12', 'Your unarmed strikes deal 1d12.')],
    18: [F('Superior Defence', 'You can spend focus to resist everything but force for a minute.', ['ac:1'])],
    20: [F('Body and Mind', 'Dexterity and Wisdom +4 (max 25).', ['stat:dex:4', 'stat:wis:4'])],
  },
  paladin: {
    5: [F('Extra Attack', 'Two attacks with the Attack action.')],
    6: [F('Aura of Protection', 'Add your Charisma modifier to your saving throws.', ['save_bonus:cha'])],
    10: [F('Aura of Courage', 'You and your allies can\'t be frightened.')],
    11: [F('Radiant Strikes', 'Your melee weapon hits deal +1d8 radiant.', ['strike:1d8:radiant:melee'])],
    14: [F('Restoring Touch', 'Lay on Hands can end conditions.')],
    18: [F('Aura Expansion', 'Your auras reach 30 ft.')],
  },
  ranger: {
    5: [F('Extra Attack', 'Two attacks with the Attack action.')],
    6: [F('Roving', '+10 ft speed.', ['speed:10'])],
    10: [F('Tireless', 'Temporary HP after resting, and less exhaustion.')],
    14: [F('Nature\'s Veil', 'You can step out of sight as a bonus action.')],
    17: [F('Precise Hunter', 'Advantage on attacks against your marked quarry.', ['precise_hunter'])],
    20: [F('Foe Slayer', 'Hunter\'s Mark deals 1d10.', ['mark_d10'])],
  },
  rogue: {
    5: [F('Uncanny Dodge', 'Once a round, halve the damage of a hit you can see.', ['uncanny'])],
    7: [F('Evasion', 'Area attacks that allow a Dex save do half or nothing to you.')],
    11: [F('Reliable Talent', 'Your proficient checks never roll below 10.')],
    14: [F('Devious Strikes', 'Your Sneak Attack can daze or knock down.')],
    18: [F('Elusive', 'No attack against you has advantage.')],
    20: [F('Stroke of Luck', 'Turn a miss into a hit, once per rest.')],
  },
  sorcerer: {
    5: [F('Sorcerous Restoration', 'A short rest restores some sorcery points.')],
    7: [F('Sorcery Incarnate', 'Innate Sorcery can be fuelled with sorcery points.')],
    20: [F('Arcane Apotheosis', 'Treaty-fire burns in you without end.')],
  },
  warlock: {
    5: [F('Pact Weapon Mastery', 'With the Pact of the Blade, two attacks with the Attack action.')],
    9: [F('Contact Patron', 'You can ask your patron one question a day ("ask my patron").')],
    11: [F('Mystic Arcanum', 'You can cast one 6th-level spell a day.')],
    13: [F('Mystic Arcanum (7th)', 'And one 7th-level spell.')],
    15: [F('Mystic Arcanum (8th)', 'And one 8th-level spell.')],
    17: [F('Mystic Arcanum (9th)', 'And one 9th-level spell.')],
    20: [F('Eldritch Master', 'Your pact slots return with a minute of prayer.')],
  },
  wizard: {
    5: [F('Memorise Spell', 'You can swap a prepared spell after a short rest.')],
    18: [F('Spell Mastery', 'A 1st and 2nd-level spell of your choice cost nothing to cast.')],
    20: [F('Signature Spells', 'Two 3rd-level spells are always ready.')],
  },
};

export interface SubclassDef { id: string; cls: string; name: string; inspired?: string; blurb: string; features: Record<number, Feature[]> }
const SC = (s: SubclassDef) => s;

export const SUBCLASSES: SubclassDef[] = [
  // Barbarian
  SC({ id: 'berserker', cls: 'barbarian', name: 'Path of the Berserker', blurb: 'Rage as a weapon, and nothing else.', features: {
    3: [F('Frenzy', 'While raging and attacking recklessly, your first hit each turn deals extra damage.', ['strike:2d6:same:raging:once'])],
    6: [F('Mindless Rage', 'You can\'t be charmed or frightened while raging.')],
    10: [F('Retaliation', 'When you\'re hit in melee, you hit back.')],
    14: [F('Intimidating Presence', 'Your roar can frighten a whole room.')] } }),
  SC({ id: 'zealot', cls: 'barbarian', name: 'Path of the Graveborn Zealot', inspired: 'zealous divine fury', blurb: 'You were dead on Greymarch Field for a minute. Something sent you back angry.', features: {
    3: [F('Graveborn Fury', 'While raging, your first hit each turn deals 1d6 + half your level radiant.', ['strike:1d6:radiant:raging:once']), F('Warrior of the Old Faith', 'Spells that raise the dead work on you without cost.')],
    6: [F('Fanatical Focus', 'Reroll a failed save while raging, once per rage.')],
    10: [F('Zealous Presence', 'Your war cry gives allies advantage on their next attack.')],
    14: [F('Rage Beyond Death', 'While raging, 0 HP doesn\'t knock you out.', ['relentless_rage'])] } }),
  SC({ id: 'ancestor', cls: 'barbarian', name: 'Path of the Ancestor-Ward', inspired: 'ancestral protector spirits', blurb: 'The dead of your family fight beside you, and they are not happy about it.', features: {
    3: [F('Ancestral Protectors', 'While raging, the first foe you hit has a hard time hurting anyone else.', ['ac:1'])],
    6: [F('Spirit Shield', 'Your ancestors turn aside blows meant for your companions.')],
    10: [F('Consult the Spirits', 'Ask the dead a question, once per rest.')],
    14: [F('Vengeful Ancestors', 'Foes your spirits block take force damage.', ['strike:1d8:force:raging:once'])] } }),
  // Bard
  SC({ id: 'lore', cls: 'bard', name: 'College of Lore', blurb: 'You collect knowledge like other people collect debts.', features: {
    3: [F('Bonus Proficiencies', 'Three more skills.'), F('Cutting Words', 'Your mockery spoils an enemy\'s attack.', ['ac:1'])],
    6: [F('Magical Discoveries', 'Two spells from any list.')],
    14: [F('Peerless Skill', 'Add an Inspiration die to your own checks.')] } }),
  SC({ id: 'blades', cls: 'bard', name: 'College of Bayonets and Ballads', inspired: 'blade-dancing bards', blurb: 'Taverns taught you to sing; the war taught you to fight while singing.', features: {
    3: [F('Blade Flourish', 'Your first weapon hit each turn deals an extra 1d6.', ['strike:1d6:same:weapon:once']), F('Training in War', 'Medium armour and a martial weapon.')],
    6: [F('Extra Attack', 'Two attacks with the Attack action.', ['xatk:2'])],
    14: [F('Master\'s Flourish', 'Your flourish die becomes a d8.', ['strike:1d4:same:weapon:once'])] } }),
  SC({ id: 'whispers', cls: 'bard', name: 'College of Whispers', inspired: 'whispering bards', blurb: 'Your songs are pretty. Your gossip ends careers.', features: {
    3: [F('Psychic Blades', 'Once per turn, a weapon hit deals +2d6 psychic.', ['strike:2d6:psychic:weapon:once']), F('Words of Terror', 'A minute of talk can leave someone frightened of you.')],
    6: [F('Mantle of Whispers', 'Steal the shadow of someone who dies near you and wear their face.')],
    14: [F('Shadow Lore', 'Whisper a secret that leaves a person charmed by fear.')] } }),
  // Cleric
  SC({ id: 'life', cls: 'cleric', name: 'Life Domain', blurb: 'The Hearth-Mother keeps people alive. So do you.', features: {
    3: [F('Disciple of Life', 'Your healing spells heal 2 + the spell\'s level more.', ['heal_bonus']), F('Preserve Life', 'Channel Divinity: heal everyone around you.')],
    6: [F('Blessed Healer', 'Healing others heals you a little.')],
    17: [F('Supreme Healing', 'Your healing dice always roll their maximum.')] } }),
  SC({ id: 'forge', cls: 'cleric', name: 'Domain of the Tokarev Forge', inspired: 'forge clerics', blurb: 'The Keeper\'s light burns hottest in a furnace.', features: {
    3: [F('Blessing of the Forge', 'Your armour or weapon becomes +1.', ['ac:1']), F('Heavy Armour', 'Proficiency with heavy armour.')],
    6: [F('Soul of the Forge', 'Resistance to fire.', ['resist:fire'])],
    8: [F('Divine Strike', 'Your weapon hits deal +1d8 fire once per turn.', ['strike:1d8:fire:weapon:once'])],
    17: [F('Saint of Forge and Fire', 'Immune to fire; nonmagical blows hurt you less.', ['resist:bludgeoning', 'resist:piercing', 'resist:slashing'])] } }),
  SC({ id: 'longrows', cls: 'cleric', name: 'Domain of the Long Rows', inspired: 'clerics of the grave', blurb: 'You tend the war cemeteries. The dead are your parish.', features: {
    3: [F('Circle of Mortality', 'Healing someone at 0 HP uses the dice\'s maximum.', ['heal_bonus']), F('Eyes of the Grave', 'You sense undead within 60 ft.')],
    6: [F('Path to the Grave', 'Curse a foe: the next hit on it does double damage.', ['strike:2d8:necrotic:any:once'])],
    8: [F('Potent Spellcasting', 'Add your Wisdom to cantrip damage.', ['spell_mod'])],
    17: [F('Keeper of the Rows', 'Undead you destroy stay destroyed.')] } }),
  // Druid
  SC({ id: 'land', cls: 'druid', name: 'Circle of the Land', blurb: 'You speak for one stretch of Lahti, and it speaks back.', features: {
    3: [F('Land\'s Aid', 'Burst of thorns: damage foes, heal friends.'), F('Circle Spells', 'Extra spells from your land.')],
    6: [F('Natural Recovery', 'Recover spell slots on a short rest.')],
    10: [F('Nature\'s Ward', 'Resistance to poison; immune to disease.', ['resist:poison'])],
    14: [F('Nature\'s Sanctuary', 'Beasts and plants won\'t attack you.')] } }),
  SC({ id: 'hearthdream', cls: 'druid', name: 'Circle of the Hearth-Dream', inspired: 'fey-dream druids', blurb: 'You learned magic in dreams of a summer that never came.', features: {
    3: [F('Balm of Summer', 'Bonus action: heal an ally with a pool of d6s.', ['heal_bonus'])],
    6: [F('Hearth of Moonlight', 'Your camps are hidden and safe.')],
    10: [F('Hidden Paths', 'Step through the dream: teleport 60 ft.')],
    14: [F('Walker in Dreams', 'Visit a sleeper in their dreams.')] } }),
  SC({ id: 'flock', cls: 'druid', name: 'Circle of the Flock', inspired: 'shepherd druids', blurb: 'Every herd animal in the foothills knows your name.', features: {
    3: [F('Spirit Totem', 'A bear spirit: you and your companions gain temporary HP in fights.', ['kill_temp'])],
    6: [F('Mighty Summoner', 'Your beast allies hit harder.')],
    10: [F('Guardian Spirit', 'Allies near your totem heal each turn.')],
    14: [F('Faithful Summons', 'When you fall, beasts come for you.')] } }),
  // Fighter
  SC({ id: 'champion', cls: 'fighter', name: 'Champion', blurb: 'Hit harder. Then hit them again.', features: {
    3: [F('Improved Critical', 'You crit on 19 or 20.', ['crit:19']), F('Remarkable Athlete', 'Advantage on initiative.', ['init_adv'])],
    7: [F('Additional Fighting Style', 'A second style.', ['ac:1'])],
    10: [F('Heroic Warrior', 'Heroic Inspiration every turn you have none.')],
    15: [F('Superior Critical', 'You crit on 18-20.', ['crit:18'])],
    18: [F('Survivor', 'Regain HP each turn while bloodied.')] } }),
  SC({ id: 'bellshot', cls: 'fighter', name: 'Bell-Shot Marksman', inspired: 'arcane archers', blurb: 'Treaty mages taught a few soldiers to put spells in their bullets.', features: {
    3: [F('Bell-Shot', 'Once per turn a ranged hit deals +2d6 force.', ['strike:2d6:force:weapon:once'])],
    7: [F('Curving Shot', 'Missed shots can bend to another target.')],
    10: [F('Ever-Ready Shot', 'You always have a Bell-Shot ready.')],
    15: [F('Improved Shots', 'Bell-Shots deal 4d6.', ['strike:2d6:force:weapon:once'])] } }),
  SC({ id: 'duelist', cls: 'fighter', name: 'Treaty Duelist', inspired: 'samurai', blurb: 'Officer-school fencing and a soldier\'s spite.', features: {
    3: [F('Fighting Spirit', 'Bonus action: advantage this turn and temporary HP.', ['kill_temp']), F('Elegant Courtier', 'Persuasion and Wisdom saves.')],
    7: [F('Tireless Spirit', 'You never run dry of fighting spirit.')],
    10: [F('Rapid Strike', 'Trade advantage for an extra attack.', ['strike:1d8:same:weapon:once'])],
    15: [F('Strength Before Death', 'At 0 HP, take one more turn first.', ['relentless_rage'])] } }),
  // Monk
  SC({ id: 'openhand', cls: 'monk', name: 'Warrior of the Open Hand', blurb: 'Every strike a lesson.', features: {
    3: [F('Open Hand Technique', 'Flurry hits can knock foes prone or away.')],
    6: [F('Wholeness of Body', 'Heal yourself with a breath.')],
    11: [F('Fleet Step', 'Step of the Wind with every bonus action.', ['speed:10'])],
    17: [F('Quivering Palm', 'A touch that can kill later.', ['strike:4d10:force:melee:once'])] } }),
  SC({ id: 'drunken', cls: 'monk', name: 'Way of the Staggering Drunk', inspired: 'drunken masters', blurb: 'The Smoking Barrel\'s most dangerous regular.', features: {
    3: [F('Drunken Technique', 'Drink doesn\'t hurt your fighting; Flurry lets you slip away.', ['drunk_ok', 'speed:10'])],
    6: [F('Tipsy Sway', 'Stumble aside so the blow lands on someone else.', ['ac:1'])],
    11: [F('Drunkard\'s Luck', 'Shrug off a bad roll.')],
    17: [F('Intoxicated Frenzy', 'Your flurries never end.', ['strike:1d8:same:melee:once'])] } }),
  SC({ id: 'bayonet', cls: 'monk', name: 'Way of the Bayonet', inspired: 'weapon-master monks', blurb: 'The trench taught you a kata with a rifle and a blade.', features: {
    3: [F('Bayonet Forms', 'Your martial arts work with a bayonet, spear or rifle butt.'), F('Agile Parry', '+2 AC after an unarmed strike.', ['ac:2'])],
    6: [F('Sharpen the Blade', 'Spend focus for +3 damage.', ['strike:1d4:same:weapon'])],
    11: [F('Deft Strike', 'Spend focus for an extra die.')],
    17: [F('Unerring Accuracy', 'Reroll a miss, once a turn.')] } }),
  // Paladin
  SC({ id: 'devotion', cls: 'paladin', name: 'Oath of Devotion', blurb: 'Honest, kind, unbending.', features: {
    3: [F('Sacred Weapon', 'Your weapon glows: add Charisma to attack rolls.')],
    7: [F('Aura of Devotion', 'You and allies near you can\'t be charmed.')],
    15: [F('Smite of Protection', 'Your smites shield your allies.', ['ac:1'])],
    20: [F('Holy Nimbus', 'Radiant light burns your enemies.', ['strike:2d8:radiant:melee'])] } }),
  SC({ id: 'ironcrown', cls: 'paladin', name: 'Oath of the Iron Crown', inspired: 'oaths of conquest', blurb: 'Peace through fear. The treaty held because someone made it hold.', features: {
    3: [F('Conquering Presence', 'Frighten every foe who can see you.'), F('Guided Strike', '+10 to a single attack.')],
    7: [F('Aura of Conquest', 'Frightened foes near you can\'t move and take damage.')],
    15: [F('Scornful Rebuke', 'Those who hit you take psychic damage.')],
    20: [F('Invincible Conqueror', 'Resist everything; crit on 19-20.', ['crit:19'])] } }),
  SC({ id: 'secondchance', cls: 'paladin', name: 'Oath of the Second Chance', inspired: 'oaths of redemption', blurb: 'Everyone in Lahti did something in the war. Everyone deserves a chance to put it down.', features: {
    3: [F('Emissary of Peace', '+5 Persuasion.'), F('Rebuke the Violent', 'Turn a foe\'s blow back on them.')],
    7: [F('Aura of the Guardian', 'Take the hit for an ally.')],
    15: [F('Protective Spirit', 'Heal at the end of your turn while bloodied.')],
    20: [F('Emissary of Redemption', 'Resistance to all damage from those you haven\'t harmed.')] } }),
  // Ranger
  SC({ id: 'hunter', cls: 'ranger', name: 'Hunter', blurb: 'You track what others flee.', features: {
    3: [F('Hunter\'s Prey', 'Your first hit each turn on a wounded foe deals +1d8.', ['strike:1d8:same:hurt:once'])],
    7: [F('Defensive Tactics', 'Escape the horde.', ['ac:1'])],
    11: [F('Volley', 'Shoot every foe in a small area.')],
    15: [F('Superior Defence', 'Uncanny dodge.', ['uncanny'])] } }),
  SC({ id: 'nightroad', cls: 'ranger', name: 'Night-Road Stalker', inspired: 'gloom stalkers', blurb: 'You walk the roads after dark so other people don\'t have to.', features: {
    3: [F('Dread Ambusher', '+10 ft speed and +1d8 on hits in the first round of a fight; advantage on initiative.', ['init_adv', 'strike:1d8:same:round1']), F('Umbral Sight', 'Darkvision 60 ft; invisible to darkvision.')],
    7: [F('Iron Mind', 'Proficiency in Wisdom saves.')],
    11: [F('Stalker\'s Flurry', 'A miss earns another attack.')],
    15: [F('Shadowy Dodge', 'Impose disadvantage on an attack against you.', ['ac:1'])] } }),
  SC({ id: 'gravewarden', cls: 'ranger', name: 'Gravewarden', inspired: 'monster slayers', blurb: 'You hunt the things the bells raise.', features: {
    3: [F('Slayer\'s Prey', 'Your marked foe takes +1d6 from your first hit each turn.', ['strike:1d6:same:weapon:once']), F('Hunter\'s Sense', 'Know a creature\'s weaknesses.')],
    7: [F('Supernatural Defence', 'Add 1d6 to saves against your quarry.')],
    11: [F('Magic-User\'s Nemesis', 'Foil a spell, once per rest.')],
    15: [F('Slayer\'s Counter', 'Strike back when your quarry tries anything.', ['strike:1d6:radiant:weapon:once'])] } }),
  // Rogue
  SC({ id: 'thief', cls: 'rogue', name: 'Thief', blurb: 'Locks, pockets, rooftops.', features: {
    3: [F('Fast Hands', 'Use objects and tools as a bonus action.'), F('Second-Story Work', 'Climb at full speed.')],
    9: [F('Supreme Sneak', 'Advantage on Stealth.')],
    13: [F('Use Magic Device', 'Use any magic item.')],
    17: [F('Thief\'s Reflexes', 'Two turns in the first round.', ['init_adv'])] } }),
  SC({ id: 'largoduelist', cls: 'rogue', name: 'Largo Duelist', inspired: 'swashbucklers', blurb: 'Dockside knife-work with a theatre bow at the end.', features: {
    3: [F('Fancy Footwork', 'Foes you attack can\'t take opportunity attacks on you.'), F('Rakish Audacity', 'Sneak Attack works when you face a foe alone; add Charisma to initiative.', ['sneak_duel'])],
    9: [F('Panache', 'Charm or goad a foe with words.')],
    13: [F('Elegant Manoeuvre', 'Advantage on Acrobatics and Athletics.')],
    17: [F('Master Duellist', 'Reroll a miss with advantage.')] } }),
  SC({ id: 'inquisitor', cls: 'rogue', name: 'Crown Inquisitor', inspired: 'inquisitive rogues', blurb: 'Queen Elisiah\'s quiet investigators.', features: {
    3: [F('Ear for Deceit', 'Your Insight never rolls below 8.'), F('Insightful Fighting', 'Read a foe with Insight to Sneak Attack it.', ['sneak_duel'])],
    9: [F('Steady Eye', 'Advantage on Perception and Investigation.')],
    13: [F('Unerring Eye', 'You sense illusions and shapechangers.')],
    17: [F('Eye for Weakness', 'Sneak Attack +3d6 on foes you\'ve read.', ['strike:3d6:same:weapon:once'])] } }),
  // Sorcerer
  SC({ id: 'draconic', cls: 'sorcerer', name: 'Draconic Sorcery', blurb: 'An old dragon is in your blood, and it is restless.', features: {
    3: [F('Draconic Resilience', '+1 HP per level; scales harden your skin.', ['hp_lvl:1', 'ac:1'])],
    6: [F('Elemental Affinity', 'Add Charisma to spell damage of your element.', ['spell_mod'])],
    14: [F('Dragon Wings', 'Fly.')],
    18: [F('Dragon Companion', 'Summon a dragon.')] } }),
  SC({ id: 'bellborn', cls: 'sorcerer', name: 'Bellborn Soul', inspired: 'divine-souled sorcerers', blurb: 'You were born the night a chapel bell rang right. Some god noticed.', features: {
    3: [F('Divine Magic', 'You can learn cleric spells.'), F('Favoured', 'Add 2d4 to a failed attack, once per rest.')],
    6: [F('Empowered Healing', 'Reroll healing dice.', ['heal_bonus'])],
    14: [F('Otherworldly Wings', 'Fly.')],
    18: [F('Unearthly Recovery', 'Heal half your HP, once a day.')] } }),
  SC({ id: 'gravecold', cls: 'sorcerer', name: 'Gravecold Sorcery', inspired: 'shadow sorcerers', blurb: 'You died as a child. Something sent you back colder.', features: {
    3: [F('Eyes of the Dark', 'Darkvision 120 ft.'), F('Strength of the Grave', 'When dropped to 0, you can stay at 1.', ['relentless_rage'])],
    6: [F('Hound of Ill Omen', 'A spectral hound hunts your enemy.', ['strike:2d6:necrotic:any:once'])],
    14: [F('Shadow Walk', 'Step between shadows.')],
    18: [F('Umbral Form', 'Resist everything but force and radiant.', ['resist:necrotic', 'resist:cold'])] } }),
  // Warlock
  SC({ id: 'fiend', cls: 'warlock', name: 'Fiend Patron', blurb: 'You made a bargain with something that likes bargains.', features: {
    3: [F('Dark One\'s Blessing', 'Kill something and gain temporary HP.', ['kill_temp'])],
    6: [F('Dark One\'s Own Luck', 'Add 1d10 to a roll, once per rest.')],
    10: [F('Fiendish Resilience', 'Resistance to one damage type.', ['resist:fire'])],
    14: [F('Hurl Through Hell', 'Send a foe somewhere unpleasant.', ['strike:8d10:psychic:any:once'])] } }),
  SC({ id: 'pactblade', cls: 'warlock', name: 'Pactblade of the Unremembered', inspired: 'hexblades', blurb: 'The sword remembers the name you forgot.', features: {
    3: [F('Pactblade\'s Curse', 'Your curse adds your proficiency to damage and lets you crit on 19.', ['crit:19', 'strike:1d4:same:weapon:once']), F('Hex Warrior', 'Use Charisma with your weapon; medium armour and shields.')],
    6: [F('Accursed Spectre', 'Those you slay rise to fight for you.')],
    10: [F('Armour of Hexes', 'Your cursed foe often misses.', ['ac:1'])],
    14: [F('Master of Hexes', 'Pass the curse on when the cursed die.')] } }),
  SC({ id: 'lastlight', cls: 'warlock', name: 'The Last Light Patron', inspired: 'celestial patrons', blurb: 'The Keeper of the Last Light is not quite a god, and needs help.', features: {
    3: [F('Healing Light', 'A pool of d6s to heal at range.', ['heal_bonus'])],
    6: [F('Radiant Soul', 'Resist radiant; add Charisma to radiant and fire spell damage.', ['resist:radiant', 'spell_mod'])],
    10: [F('Celestial Resilience', 'Temporary HP when you rest.')],
    14: [F('Searing Vengeance', 'Rise from 0 HP in a burst of light.', ['relentless_rage'])] } }),
  // Wizard
  SC({ id: 'evoker', cls: 'wizard', name: 'Evoker', blurb: 'Fire, frost, thunder. Mostly fire.', features: {
    3: [F('Potent Cantrip', 'Your cantrips deal half damage on a miss or save.'), F('Sculpt Spells', 'Your allies are safe from your area spells.')],
    10: [F('Empowered Evocation', 'Add Intelligence to evocation damage.', ['spell_mod'])],
    14: [F('Overchannel', 'Maximise a spell\'s damage.')] } }),
  SC({ id: 'battlemage', cls: 'wizard', name: 'Treaty Battlemage', inspired: 'war mages', blurb: 'Trained for the front line of a war that ended.', features: {
    3: [F('Arcane Deflection', '+2 AC when a hit would land, then cantrips only.', ['ac:1']), F('Tactical Wit', 'Add Intelligence to initiative.', ['init_adv'])],
    6: [F('Power Surge', 'Store surges of power and spend them on damage.', ['strike:1d8:force:any:once'])],
    10: [F('Durable Magic', '+2 AC and saves while you concentrate.', ['ac:1'])],
    14: [F('Deflecting Shroud', 'Your deflections lash out with force.')] } }),
  SC({ id: 'unmaking', cls: 'wizard', name: 'School of Unmaking', blurb: 'Original. The loremasters who wrote the Rite of Holy Forgetting. You are what\'s left of them.', features: {
    3: [F('Fragments of the Rite', 'Your spells make foes forget: frightened and charmed effects are harder to shake. You learn the shape of the Rite.')],
    6: [F('Erase the Mark', 'Once per turn, a spell hit deals +1d8 force as part of its target forgets how to be.', ['strike:1d8:force:any:once'])],
    10: [F('Unname', 'Speak a creature\'s true name and it loses its resistances.')],
    14: [F('The Last Loremaster', 'You can attempt the Rite of Holy Forgetting yourself.', ['spell_mod'])] } }),
];

export const subclassesFor = (cls: string) => SUBCLASSES.filter((s) => s.cls === cls);
export const subclassById = (id: string) => SUBCLASSES.find((s) => s.id === id);
