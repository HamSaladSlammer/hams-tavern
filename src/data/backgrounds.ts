// Backgrounds. Acolyte, Criminal, Sage and Soldier follow SRD 5.2.1 (CC-BY-4.0); the rest,
// and every feat not named in the SRD, are Hams Tavern originals set in Kalashscovia.
import type { Ability, Skill } from '../engine/types';

export interface FeatDef { id: string; name: string; desc: string }
export interface BackgroundDef { id: string; name: string; abilities: [Ability, Ability, Ability]; skills: [Skill, Skill]; feat: string; kit: [string, number][]; copper: number; blurb: string }

export const FEATS: Record<string, FeatDef> = {
  alert: { id: 'alert', name: 'Alert', desc: 'Add your proficiency bonus to initiative.' },
  magic_cleric: { id: 'magic_cleric', name: 'Magic Initiate (Cleric)', desc: 'You know the guidance and sacred flame cantrips.' },
  magic_wizard: { id: 'magic_wizard', name: 'Magic Initiate (Wizard)', desc: 'You know the prestidigitation and fire bolt cantrips.' },
  magic_druid: { id: 'magic_druid', name: 'Magic Initiate (Druid)', desc: 'You know the druidcraft and produce flame cantrips.' },
  savage: { id: 'savage', name: 'Savage Attacker', desc: 'Once per turn, roll weapon damage twice and keep the higher.' },
  skilled: { id: 'skilled', name: 'Skilled', desc: 'Proficiency in three more skills of your choice.' },
  forgewise: { id: 'forgewise', name: 'Forgewise', desc: 'Original. You buy gear at 20% off, and you can mend broken weapons and armour.' },
  silver_tongue: { id: 'silver_tongue', name: 'Silver Tongue', desc: 'Original. Once per long rest, reroll a failed Deception or Persuasion check.' },
  crowd_pleaser: { id: 'crowd_pleaser', name: 'Crowd-Pleaser', desc: 'Original. Performing in a tavern earns you coin, and you have advantage on Performance checks there.' },
  stout: { id: 'stout', name: 'Stout', desc: 'Original. +2 maximum HP per level.' },
  watchful: { id: 'watchful', name: 'Watchful', desc: 'Original. +5 to passive Perception, and you can\'t be ambushed.' },
  pathfinder: { id: 'pathfinder', name: 'Pathfinder', desc: 'Original. Travel encounters happen half as often, and you never get lost.' },
  remedy: { id: 'remedy', name: 'Herbal Remedy', desc: 'Original. Once per short rest, spend a minute to heal yourself or an ally 1d6 + 4.' },
  haggler: { id: 'haggler', name: 'Haggler', desc: 'Original. Merchants buy from you at three quarters of the price instead of half, and sell to you at 10% off.' },
  name_of_note: { id: 'name_of_note', name: 'Name of Note', desc: 'Original. Officials, nobles and guards take you seriously: advantage on Persuasion with them.' },
  brawler: { id: 'brawler', name: 'Barroom Brawler', desc: 'Original. Your unarmed strikes deal 1d4 + Str, you are proficient with improvised weapons (stools, bottles, mugs), and you reroll 1s on their damage.' },
  survivors_luck: { id: 'survivors_luck', name: 'Survivor\'s Luck', desc: 'Original. Three times per long rest, reroll a d20 you don\'t like (automatic on failures).' },
};

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'acolyte', name: 'Acolyte', abilities: ['int', 'wis', 'cha'], skills: ['insight', 'religion'], feat: 'magic_cleric', kit: [['holy_symbol', 1], ['candle', 5]], copper: 800, blurb: 'You kept a chapel once. Most of them are empty now.' },
  { id: 'criminal', name: 'Criminal', abilities: ['dex', 'con', 'int'], skills: ['sleight of hand', 'stealth'], feat: 'alert', kit: [['crowbar', 1], ['thieves_tools', 1]], copper: 1600, blurb: 'Largo docks, Borschardt back rooms. You know who buys and who asks questions.' },
  { id: 'sage', name: 'Sage', abilities: ['con', 'int', 'wis'], skills: ['arcana', 'history'], feat: 'magic_wizard', kit: [['ink_and_quill', 1], ['book_of_lore', 1]], copper: 800, blurb: 'An archive clerk, a tutor, a reader of things other people burned.' },
  { id: 'soldier', name: 'Soldier', abilities: ['str', 'dex', 'con'], skills: ['athletics', 'intimidation'], feat: 'savage', kit: [['bayonet', 1], ['service_revolver', 1], ['pistol_cartridge', 7]], copper: 1400, blurb: 'You served in the civil war, or right after it. You kept one sidearm, like everybody did.' },
  { id: 'artisan', name: 'Tokarev Artisan', abilities: ['str', 'dex', 'int'], skills: ['investigation', 'persuasion'], feat: 'forgewise', kit: [['smith_tools', 1]], copper: 2500, blurb: 'You worked the forges of Tokarev, where the crown presses its cartridges.' },
  { id: 'swindler', name: 'Borschardt Swindler', abilities: ['dex', 'con', 'cha'], skills: ['deception', 'sleight of hand'], feat: 'silver_tongue', kit: [['fine_clothes', 1], ['marked_cards', 1]], copper: 1500, blurb: 'You sold bridges in a city of bridges. Some of them twice.' },
  { id: 'player', name: 'Travelling Player', abilities: ['str', 'dex', 'cha'], skills: ['acrobatics', 'performance'], feat: 'crowd_pleaser', kit: [['lute', 1], ['costume', 1]], copper: 1100, blurb: 'You\'ve played every tavern from Nagant to Madsen, and been thrown out of half of them.' },
  { id: 'farmhand', name: 'Maxim Farmhand', abilities: ['str', 'con', 'wis'], skills: ['animal handling', 'nature'], feat: 'stout', kit: [['sickle', 1], ['rations', 3]], copper: 1000, blurb: 'You dug ditches behind the levees, until the ditches started giving things back.' },
  { id: 'militia', name: 'Breda Militia', abilities: ['str', 'int', 'wis'], skills: ['athletics', 'perception'], feat: 'watchful', kit: [['spear', 1], ['lantern', 1]], copper: 1200, blurb: 'You stood on the north gate. You heard the bell every night.' },
  { id: 'guide', name: 'Thornwood Guide', abilities: ['dex', 'con', 'wis'], skills: ['stealth', 'survival'], feat: 'pathfinder', kit: [['shortbow', 1], ['arrow', 20], ['rope', 1]], copper: 300, blurb: 'You know every logging road in the Thornwood, and which trees have the new charms.' },
  { id: 'hermit', name: 'Peak Hermit', abilities: ['con', 'wis', 'cha'], skills: ['medicine', 'religion'], feat: 'remedy', kit: [['herbalism_kit', 1], ['quarterstaff', 1]], copper: 1600, blurb: 'You spent years alone in the Northern Peaks. You came down because something changed in the ice.' },
  { id: 'trader', name: 'Galilin Trader', abilities: ['con', 'int', 'cha'], skills: ['animal handling', 'persuasion'], feat: 'haggler', kit: [['scales', 1]], copper: 2200, blurb: 'Every caravan crosses at Galilin. You were the one weighing the coin.' },
  { id: 'courtier', name: 'Suomi Courtier', abilities: ['str', 'int', 'cha'], skills: ['history', 'persuasion'], feat: 'name_of_note', kit: [['fine_clothes', 1], ['signet_ring', 1]], copper: 2900, blurb: 'You grew up in the white spires, close enough to the Queen to hear her laugh twice.' },
  { id: 'bargehand', name: 'Largo Bargehand', abilities: ['str', 'dex', 'wis'], skills: ['athletics', 'perception'], feat: 'brawler', kit: [['rope', 1], ['club', 1]], copper: 1000, blurb: 'River barges, crates marked FISH, and fights in every dockside tavern on the Aimo.' },
  { id: 'clerk', name: 'Archive Clerk', abilities: ['dex', 'int', 'wis'], skills: ['investigation', 'perception'], feat: 'skilled', kit: [['ink_and_quill', 1], ['lamp', 1]], copper: 2300, blurb: 'You copied the crown\'s records in a back room in Suomi. Some pages had been scraped clean.' },
  { id: 'orphan', name: 'War Orphan', abilities: ['dex', 'wis', 'cha'], skills: ['insight', 'stealth'], feat: 'survivors_luck', kit: [['bedroll', 1], ['keepsake', 1]], copper: 1600, blurb: 'You don\'t remember your parents. You remember the camps, and the people who kept you alive.' },
];

export const backgroundById = (id: string) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[3];
