// Spells. Most follow SRD 5.2.1 (CC-BY-4.0). Entries marked "original" are Hams Tavern spells
// that fill familiar niches under their own names and wording.
import type { Ability, DamageType } from '../engine/types';

export type SpellKind = 'attack' | 'save' | 'auto' | 'heal' | 'buff' | 'control' | 'mark' | 'utility' | 'summon';

export interface SpellDef {
  id: string;
  name: string;
  level: number; // 0 cantrip .. 9
  kind: SpellKind;
  damage?: string;
  dtype?: DamageType;
  save?: Ability;
  ranged?: boolean;
  aoe?: number; // max targets
  bonusAction?: boolean;
  effect?: 'restrained' | 'frightened' | 'charmed' | 'asleep' | 'prone' | 'halted' | 'faerie' | 'mocked' | 'frostbit' | 'pushed' | 'paralyzed' | 'banished';
  rays?: number; // separate attack rolls
  area?: 'self' | 'target'; // where an area spell is centred
  radius?: number; // squares
  special?: string; // engine hook: teleport, guardians, weapon, haste, invisible, blur, mantle, raise, mass_heal, aid, drain, pwk
  classes?: string[]; // for spells beyond level 1: which classes learn it
  halfOnSave?: boolean;
  desc: string;
  aliases: string[];
  original?: boolean;
}

const S = (s: SpellDef) => s;
export const SPELLS: Record<string, SpellDef> = Object.fromEntries([
  // ----- cantrips -----
  S({ id: 'fire_bolt', name: 'Fire Bolt', level: 0, kind: 'attack', damage: '1d10', dtype: 'fire', ranged: true, desc: 'Ranged spell attack, 1d10 fire.', aliases: ['fire bolt', 'firebolt'] }),
  S({ id: 'ray_of_frost', name: 'Ray of Frost', level: 0, kind: 'attack', damage: '1d8', dtype: 'cold', ranged: true, desc: 'Ranged spell attack, 1d8 cold.', aliases: ['ray of frost', 'frost ray'] }),
  S({ id: 'shocking_grasp', name: 'Shocking Grasp', level: 0, kind: 'attack', damage: '1d8', dtype: 'lightning', ranged: false, desc: 'Melee spell attack, 1d8 lightning.', aliases: ['shocking grasp', 'shock'] }),
  S({ id: 'chill_touch', name: 'Chill Touch', level: 0, kind: 'attack', damage: '1d10', dtype: 'necrotic', ranged: false, desc: 'Melee spell attack, 1d10 necrotic.', aliases: ['chill touch'] }),
  S({ id: 'eldritch_blast', name: 'Eldritch Blast', level: 0, kind: 'attack', damage: '1d10', dtype: 'force', ranged: true, desc: 'Ranged spell attack, 1d10 force.', aliases: ['eldritch blast', 'blast', 'eb'] }),
  S({ id: 'produce_flame', name: 'Produce Flame', level: 0, kind: 'attack', damage: '1d8', dtype: 'fire', ranged: true, desc: 'A flame in your palm; hurl it: ranged spell attack, 1d8 fire.', aliases: ['produce flame', 'flame'] }),
  S({ id: 'thorn_whip', name: 'Thorn Whip', level: 0, kind: 'attack', damage: '1d6', dtype: 'piercing', ranged: false, desc: 'Melee spell attack with a thorny vine, 1d6 piercing.', aliases: ['thorn whip', 'whip'] }),
  S({ id: 'sacred_flame', name: 'Sacred Flame', level: 0, kind: 'save', damage: '1d8', dtype: 'radiant', save: 'dex', ranged: true, desc: 'Dex save or 1d8 radiant.', aliases: ['sacred flame', 'holy fire'] }),
  S({ id: 'poison_spray', name: 'Poison Spray', level: 0, kind: 'attack', damage: '1d12', dtype: 'poison', ranged: true, desc: 'Ranged spell attack, 1d12 poison.', aliases: ['poison spray', 'poison'] }),
  S({ id: 'vicious_mockery', name: 'Vicious Mockery', level: 0, kind: 'save', damage: '1d6', dtype: 'psychic', save: 'wis', effect: 'mocked', ranged: true, desc: 'An insult with magic in it: Wis save or 1d6 psychic, and disadvantage on its next attack.', aliases: ['vicious mockery', 'mockery', 'mock'] }),
  S({ id: 'shillelagh', name: 'Shillelagh', level: 0, kind: 'buff', bonusAction: true, desc: 'Bonus action: your club or quarterstaff hits with your spellcasting ability for 1d8.', aliases: ['shillelagh'] }),
  S({ id: 'guidance', name: 'Guidance', level: 0, kind: 'utility', desc: 'Add 1d4 to your next ability check.', aliases: ['guidance'] }),
  S({ id: 'prestidigitation', name: 'Prestidigitation', level: 0, kind: 'utility', desc: 'Small tricks: sparks, smells, chilled drinks, little noises.', aliases: ['prestidigitation', 'presti'] }),
  S({ id: 'thaumaturgy', name: 'Thaumaturgy', level: 0, kind: 'utility', desc: 'Your voice booms, flames flicker, the ground trembles a little.', aliases: ['thaumaturgy'] }),
  S({ id: 'druidcraft', name: 'Druidcraft', level: 0, kind: 'utility', desc: 'Make a flower bloom, predict the weather, light or snuff a candle.', aliases: ['druidcraft'] }),
  S({ id: 'light', name: 'Light', level: 0, kind: 'utility', desc: 'An object sheds bright light for an hour.', aliases: ['light'] }),
  S({ id: 'mage_hand', name: 'Mage Hand', level: 0, kind: 'utility', desc: 'A spectral hand moves small things up to 30 ft away.', aliases: ['mage hand', 'hand'] }),
  S({ id: 'minor_illusion', name: 'Minor Illusion', level: 0, kind: 'utility', desc: 'A sound or image that isn\'t really there.', aliases: ['minor illusion', 'illusion'] }),
  S({ id: 'knell', name: 'Knell', level: 0, kind: 'save', damage: '1d8', dtype: 'necrotic', save: 'wis', ranged: true, original: true, desc: 'Original. A bell tolls for the target alone: Wis save or 1d8 necrotic (1d12 if it is already hurt).', aliases: ['knell', 'toll', 'death knell'] }),
  S({ id: 'frostbite', name: 'Numbing Frost', level: 0, kind: 'save', damage: '1d6', dtype: 'cold', save: 'con', effect: 'frostbit', ranged: true, original: true, desc: 'Original. Numbing frost: Con save or 1d6 cold, and disadvantage on its next attack.', aliases: ['numbing frost', 'frostbite', 'frost bite'] }),
  S({ id: 'thunderclap', name: 'Rifle-Crack', level: 0, kind: 'save', damage: '1d6', dtype: 'thunder', save: 'con', aoe: 3, original: true, desc: 'Original. A crack of thunder around you: up to three foes, Con save or 1d6 thunder.', aliases: ['rifle-crack', 'rifle crack', 'thunderclap', 'clap'] }),
  S({ id: 'mire_gnats', name: 'Mire-Gnats', level: 0, kind: 'save', damage: '1d6', dtype: 'poison', save: 'con', ranged: true, original: true, desc: 'Original. A cloud of biting Mire-gnats: Con save or 1d6 poison.', aliases: ['mire gnats', 'mire-gnats', 'gnats', 'infestation'] }),
  S({ id: 'greens_bite', name: 'The Green\'s Bite', level: 0, kind: 'attack', damage: '1d10', dtype: 'acid', ranged: false, original: true, desc: 'Original. Your teeth or nails grow thorny for a moment: melee spell attack, 1d10 acid.', aliases: ["green's bite", 'greens bite', 'green bite', 'primal savagery'] }),
  S({ id: 'hearthword', name: 'Hearthword', level: 0, kind: 'save', damage: '1d6', dtype: 'radiant', save: 'con', aoe: 3, original: true, desc: 'Original. You speak a word of home-light: up to three foes, Con save or 1d6 radiant.', aliases: ['hearthword', 'hearth word', 'word of radiance'] }),
  S({ id: 'bonfire', name: 'Bonfire', level: 0, kind: 'save', damage: '1d8', dtype: 'fire', save: 'dex', ranged: true, original: true, desc: 'Original. Flames leap up beneath a foe: Dex save or 1d8 fire.', aliases: ['bonfire', 'create bonfire'] }),
  // ----- level 1 -----
  S({ id: 'magic_missile', name: 'Magic Missile', level: 1, kind: 'auto', damage: '1d4+1', dtype: 'force', ranged: true, desc: 'Three darts, each 1d4+1 force. They never miss.', aliases: ['magic missile', 'missile', 'missiles'] }),
  S({ id: 'burning_hands', name: 'Burning Hands', level: 1, kind: 'save', damage: '3d6', dtype: 'fire', save: 'dex', aoe: 3, halfOnSave: true, desc: 'A sheet of flame: up to three foes, Dex save for half, 3d6 fire.', aliases: ['burning hands'] }),
  S({ id: 'thunderwave', name: 'Thunderwave', level: 1, kind: 'save', damage: '2d8', dtype: 'thunder', save: 'con', aoe: 3, halfOnSave: true, effect: 'pushed', desc: 'A wave of force: up to three foes, Con save for half, 2d8 thunder, and they\'re knocked back.', aliases: ['thunderwave', 'thunder wave'] }),
  S({ id: 'chromatic_orb', name: 'Chromatic Orb', level: 1, kind: 'attack', damage: '3d8', dtype: 'fire', ranged: true, desc: 'Ranged spell attack, 3d8 of an element you choose (fire here).', aliases: ['chromatic orb', 'orb'] }),
  S({ id: 'mage_armor', name: 'Mage Armour', level: 1, kind: 'buff', desc: 'AC becomes 13 + Dex until your next long rest.', aliases: ['mage armor', 'mage armour'] }),
  S({ id: 'shield', name: 'Shield', level: 1, kind: 'buff', bonusAction: true, desc: 'A shimmering barrier: +5 AC until your next turn.', aliases: ['shield'] }),
  S({ id: 'sleep', name: 'Sleep', level: 1, kind: 'control', save: 'wis', aoe: 2, effect: 'asleep', desc: 'Up to two foes make a Wis save or fall asleep until hurt. Undead and the sleepless are immune.', aliases: ['sleep'] }),
  S({ id: 'charm_person', name: 'Charm Person', level: 1, kind: 'control', save: 'wis', effect: 'charmed', desc: 'A humanoid makes a Wis save or regards you as a friend. A charmed foe stops fighting.', aliases: ['charm person', 'charm'] }),
  S({ id: 'command', name: 'Command', level: 1, kind: 'control', save: 'wis', effect: 'halted', desc: 'One word: "Halt!" A foe makes a Wis save or loses its next turn.', aliases: ['command', 'halt'] }),
  S({ id: 'dissonant_whispers', name: 'Dissonant Whispers', level: 1, kind: 'save', damage: '3d6', dtype: 'psychic', save: 'wis', halfOnSave: true, ranged: true, desc: 'A maddening melody: Wis save for half, 3d6 psychic.', aliases: ['dissonant whispers', 'whispers'] }),
  S({ id: 'faerie_fire', name: 'Faerie Fire', level: 1, kind: 'control', save: 'dex', aoe: 3, effect: 'faerie', desc: 'Up to three foes make a Dex save or glow; attacks against them have advantage.', aliases: ['faerie fire', 'fairy fire'] }),
  S({ id: 'entangle', name: 'Entangle', level: 1, kind: 'control', save: 'str', aoe: 3, effect: 'restrained', desc: 'Grasping weeds: up to three foes make a Str save or are restrained.', aliases: ['entangle'] }),
  S({ id: 'cure_wounds', name: 'Cure Wounds', level: 1, kind: 'heal', damage: '2d8', desc: 'Touch: heal 2d8 + your spellcasting modifier.', aliases: ['cure wounds', 'cure', 'heal'] }),
  S({ id: 'healing_word', name: 'Healing Word', level: 1, kind: 'heal', damage: '2d4', bonusAction: true, desc: 'Bonus action, at range: heal 2d4 + your spellcasting modifier.', aliases: ['healing word'] }),
  S({ id: 'goodberry', name: 'Goodberry', level: 1, kind: 'utility', desc: 'Ten berries; eating one heals 1 HP. They last a day.', aliases: ['goodberry', 'goodberries', 'berries'] }),
  S({ id: 'guiding_bolt', name: 'Guiding Bolt', level: 1, kind: 'attack', damage: '4d6', dtype: 'radiant', ranged: true, desc: 'Ranged spell attack, 4d6 radiant; the next attack against the target has advantage.', aliases: ['guiding bolt'] }),
  S({ id: 'inflict_wounds', name: 'Inflict Wounds', level: 1, kind: 'save', damage: '2d10', dtype: 'necrotic', save: 'con', halfOnSave: true, ranged: false, desc: 'Touch: Con save for half, 2d10 necrotic.', aliases: ['inflict wounds', 'inflict'] }),
  S({ id: 'bless', name: 'Bless', level: 1, kind: 'buff', desc: 'You and your allies add 1d4 to attack rolls for this fight.', aliases: ['bless'] }),
  S({ id: 'shield_of_faith', name: 'Shield of Faith', level: 1, kind: 'buff', bonusAction: true, desc: 'Bonus action: +2 AC for this fight.', aliases: ['shield of faith'] }),
  S({ id: 'divine_favor', name: 'Divine Favour', level: 1, kind: 'buff', bonusAction: true, desc: 'Bonus action: your weapon hits deal an extra 1d4 radiant this fight.', aliases: ['divine favor', 'divine favour'] }),
  S({ id: 'divine_smite', name: 'Divine Smite', level: 1, kind: 'utility', bonusAction: true, desc: 'Right after a melee hit: +2d8 radiant (+1d8 more against undead and fiends). Type "smite".', aliases: ['divine smite', 'smite'] }),
  S({ id: 'hunters_mark', name: 'Hunter\'s Mark', level: 1, kind: 'mark', bonusAction: true, desc: 'Bonus action: mark a foe; your weapon hits on it deal an extra 1d6.', aliases: ["hunter's mark", 'hunters mark', 'mark'] }),
  S({ id: 'hex', name: 'Hex', level: 1, kind: 'mark', bonusAction: true, desc: 'Bonus action: curse a foe; your hits on it deal an extra 1d6 necrotic.', aliases: ['hex', 'curse'] }),
  S({ id: 'hoarfrost_shard', name: 'Hoarfrost Shard', level: 1, kind: 'attack', damage: '1d10', dtype: 'piercing', ranged: true, original: true, desc: 'Original. A shard of ice: ranged spell attack, 1d10 piercing, then it bursts for 2d6 cold on nearby foes (Dex save).', aliases: ['hoarfrost shard', 'hoarfrost', 'ice shard', 'ice knife'] }),
  S({ id: 'wild_spark', name: 'Wild Spark', level: 1, kind: 'attack', damage: '2d8', dtype: 'lightning', ranged: true, original: true, desc: 'Original. Raw sorcery that picks its own colour: ranged spell attack, 2d8 + 1d6 of a random element, and it can leap to a second foe.', aliases: ['wild spark', 'spark', 'chaos bolt'] }),
  S({ id: 'dread', name: 'Dread', level: 1, kind: 'control', save: 'wis', effect: 'frightened', desc: 'Original. You show a foe its own grave: Wis save or it is frightened and cowers.', aliases: ['dread', 'cause fear', 'fear'], original: true }),
  S({ id: 'tremor', name: 'Tremor', level: 1, kind: 'save', damage: '1d6', dtype: 'bludgeoning', save: 'dex', aoe: 3, effect: 'prone', original: true, desc: 'Original. The ground heaves: up to three foes, Dex save or 1d6 bludgeoning and knocked prone.', aliases: ['tremor', 'earth tremor', 'quake'] }),
].map((s) => [s.id, s]));

import { HIGH_SPELLS } from './spells_high';
for (const sp of HIGH_SPELLS) SPELLS[sp.id] = sp;
