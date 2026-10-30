import type { Rng } from './dice';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export type Abilities = Record<Ability, number>;

export type Skill =
  | 'acrobatics' | 'animal handling' | 'arcana' | 'athletics' | 'deception' | 'history'
  | 'insight' | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight of hand' | 'stealth' | 'survival';

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex', 'animal handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  'sleight of hand': 'dex', stealth: 'dex', survival: 'wis',
};

export type DamageType =
  | 'bludgeoning' | 'piercing' | 'slashing' | 'fire' | 'cold' | 'necrotic' | 'radiant'
  | 'force' | 'poison' | 'psychic' | 'thunder' | 'lightning' | 'acid';

export type WeaponCategory = 'simple' | 'martial' | 'firearm';

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  ranged: boolean;
  damage: string; // e.g. "1d8"
  dtype: DamageType;
  finesse?: boolean;
  light?: boolean;
  thrown?: boolean;
  twoHanded?: boolean;
  range?: [number, number];
  ammo?: 'pistol' | 'rifle' | 'arrow' | 'bolt';
  capacity?: number; // firearms: rounds before reload
  silvered?: boolean;
  bonus?: number; // magic +N
  price: number; // copper
}

export interface ArmorDef {
  id: string;
  name: string;
  base: number;
  dexCap: number | null; // null = full dex, 0 = none
  kind: 'light' | 'medium' | 'heavy' | 'shield';
  stealthDis?: boolean;
  price: number;
}

export type ItemKind = 'weapon' | 'armor' | 'potion' | 'ammo' | 'gear' | 'key' | 'treasure' | 'food' | 'note' | 'drink';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number; // copper; 0 = cannot be sold
  desc: string;
  weapon?: WeaponDef;
  armor?: ArmorDef;
  heal?: string; // potion dice
  ammoFor?: 'pistol' | 'rifle' | 'arrow' | 'bolt';
  read?: string; // text when read
  aliases?: string[];
  acBonus?: number; // e.g. robe of protection
  saveBonus?: number;
}

export interface Stack {
  id: string;
  qty: number;
}

export interface Attack {
  name: string;
  toHit: number;
  damage: string;
  dtype: DamageType;
  extra?: { damage: string; dtype: DamageType };
  ranged?: boolean;
  verb?: string; // narration verb
}

export interface MonsterDef {
  id: string;
  name: string;
  plural?: string;
  ac: number;
  hp: string; // dice expr
  speed: number;
  abilities: Abilities;
  attacks: Attack[];
  tags: string[]; // undead, beast, humanoid, construct
  xp: number;
  resist?: DamageType[];
  vulnerable?: DamageType[];
  immune?: DamageType[];
  traits?: string[]; // 'undead fortitude', 'pack tactics', 'sunlight'
  desc: string;
  aliases?: string[];
  surrenderAt?: number; // hp threshold
  multiattack?: number; // attacks per turn
  cr?: number; // challenge rating, for encounter building
}

export type Condition = 'prone' | 'unconscious' | 'stable' | 'dead' | 'frightened' | 'dodging' | 'grappled' | 'surrendered' | 'fled' | 'hidden' | 'blessed' | 'shielded' | 'guided' | 'taunted'
  | 'raging' | 'restrained' | 'charmed' | 'asleep' | 'halted' | 'marked' | 'hexed' | 'inspired' | 'sorcery' | 'reckless' | 'wildshape' | 'shield_spell' | 'favored' | 'mocked' | 'faerie' | 'frostbit' | 'shifted' | 'shell' | 'divine_favor' | 'fury' | 'jaws' | 'cry' | 'surprised' | 'charged' | 'shillelagh' | 'acted' | 'ko'
  | 'paralyzed' | 'spiritual' | 'guardians' | 'hasted' | 'invisible' | 'blurred' | 'mantle' | 'branded' | 'staggering' | 'warded';

export interface Combatant {
  key: string; // unique in fight
  name: string;
  side: 'party' | 'foe';
  monster?: string; // MonsterDef id
  isPc?: boolean;
  companion?: string; // companion id
  hp: number;
  maxHp: number;
  ac: number;
  init: number;
  conditions: Condition[];
  jammed?: boolean;
  ammoLoaded?: number;
  deathSaves?: { ok: number; fail: number };
  tauntedBy?: string;
  x: number;
  y: number;
  reaction?: boolean; // reaction used this round
}

export interface Combat {
  round: number;
  order: string[]; // keys
  turn: number; // index into order
  units: Combatant[];
  encounterId: string;
  usedBonus: boolean;
  usedAction: boolean;
  sneakUsed: boolean;
  fleeTo?: string;
  moveLeft: number; // feet of movement left this turn (player)
  attacksLeft?: number; // extra attacks remaining from the Attack action
  dashed?: boolean;
  disengaged?: boolean;
  loc: string; // map id
  blockers?: { x: number; y: number }[]; // bystanders standing on the map
}

export interface SpellSlots {
  max: number;
  used: number;
}

export interface Character {
  name: string;
  species: string;
  cls: string;
  background: string;
  level: number;
  xp: number;
  abilities: Abilities;
  hp: number;
  maxHp: number;
  tempHp: number;
  hitDice: number; // remaining
  skills: Skill[];
  expertise: Skill[];
  saves: Ability[];
  weaponProf: WeaponCategory[];
  armorProf: ('light' | 'medium' | 'heavy' | 'shield')[];
  cantrips: string[];
  spells: string[];
  slots: SpellSlots; // spell points: a spell costs its level
  resources: Record<string, { max: number; used: number; per: 'short' | 'long' }>;
  inventory: Stack[];
  equipped: { main?: string; offhand?: string; armor?: string; shield?: string; ranged?: string; worn: string[] };
  ammo: Record<string, number>; // loaded rounds per firearm id
  copper: number;
  conditions: Condition[];
  deathSaves: { ok: number; fail: number };
  pronoun: 'he' | 'she' | 'they';
  options: Record<string, string>; // class/species choices: fighting style, divine order, genasi element...
  feat: string;
  feats?: string[]; // extra feats (custom lineage)
  customBg?: import('../data/backgrounds').BackgroundDef;
  tools?: string[];
  look: string;
  backstory: string;
  life: Record<string, string>; // life-path results
  drunk: number; // 0 sober, 1-2 tipsy, 3-4 drunk, 5+ passed out
  wildHp: number; // druid beast form temporary hit points
  perks: string[]; // machine-readable feature tags (see data/progression.ts)
  subclass?: string;
  features: string[]; // names of features gained after level 2, for the sheet
}

export interface NpcMemory {
  disposition: number; // -5..+5
  insults: number;
  banned: boolean;
  met: boolean;
  topicsSeen: string[];
}

/** A check the game is waiting on the player to roll. */
export interface RollAsk { kind: 'skill' | 'ability' | 'tool' | 'save'; label: string; bonus: number; adv: 'adv' | 'dis' | 'none' }
export interface PendingRoll { input: string; rolls: number[][]; ask: RollAsk }

export interface LogLine {
  k: 'narr' | 'say' | 'you' | 'roll' | 'sys' | 'hit' | 'miss' | 'good' | 'bad' | 'title' | 'ask';
  t: string;
  who?: string;
}

export type Phase = 'title' | 'create' | 'play' | 'end';

export interface Creation {
  step: 'name' | 'species' | 'class' | 'background' | 'confirm';
  name?: string;
  species?: string;
  cls?: string;
  background?: string;
}

export interface GameState {
  version: number;
  rng: Rng;
  phase: Phase;
  creation: Creation;
  pc: Character | null;
  loc: string;
  minutes: number; // minutes since campaign start (May 1, 08:00 = 0)
  flags: Record<string, number | string | boolean>;
  npc: Record<string, NpcMemory>;
  companions: string[]; // ids of companions in party
  companionHp: Record<string, number>;
  combat: Combat | null;
  roomFoes: Record<string, { key: string; monster: string; hp: number; conditions: Condition[]; name: string }[]>;
  roomItems: Record<string, Stack[]>;
  talkingTo: string | null;
  lastTarget: string | null;
  chaos: number;
  log: LogLine[];
  journal: string[];
  loreKnown?: string[]; // ids of lore facts the player has heard
  rollMode?: 'you' | 'auto'; // who rolls checks: the player (the app asks) or the game. The UI sets it.
  pendingRoll?: PendingRoll | null; // a check waiting for the player's d20
  stats: { kills: number; knockouts: number; insults: number };
  props: Record<string, PropState[]>; // props the oracle added, or that changed (broken, taken)
  lastObject: string | null;
  pos: { x: number; y: number } | null; // where you stand on the current room's map
  explored: Record<string, string>; // per room: squares seen ('1') for fog of war
  bounty: number; // copper the Breda militia want from you
  world: WorldState;
}

export interface SiteState {
  id: string;
  name: string;
  kind: string; // theme
  x: number;
  y: number;
  level: number;
  seed: number;
  rooms: number;
  near: string; // town id it hangs off
  poi?: string; // named place id
  cleared?: boolean;
  boss?: string; // monster id override for the last room
  campaign?: number; // campaign chapter index this site belongs to
  descs?: string[]; // room descriptions written by a campaign
}
export interface Job { id: string; town: string; kind: 'clear' | 'bounty' | 'deliver' | 'fetch'; title: string; text: string; reward: number; site?: string; dest?: string; taken?: boolean; done?: boolean; paid?: boolean; posted: number; item?: string }
export interface Front { id: string; name: string; clock: number; max: number; active: boolean; ended?: boolean; lastTick: number; omens: number[] }
export interface Property { id: string; town: string; type: 'tavern' | 'shop' | 'farm' | 'house' | 'smithy'; name: string; upgrades: string[]; staff: string[]; cash: number; rep: number; lastDay: number; events: number }
export interface Journey { route: string[]; legs: number[]; leg: number; day: number; dest: string }
export interface WorldState { at: string; visited: string[]; found: string[]; sites: Record<string, SiteState>; journey: Journey | null; jobs: Job[]; fronts: Record<string, Front>; properties: Property[]; nextId: number; seed: number; renown: number; hires?: Hire[]; campaign?: CampaignState }
export interface CampaignSpec { title: string; start: string; villain: string; villainTitle: string; kind: string; goal: 'stop' | 'rescue' | 'recover' | 'avenge'; target: string; chapters: number; tone: 'heroic' | 'grim' | 'comic'; level: number; seed: number }
export interface CampaignState { id: string; title: string; chapter: number; sites: string[]; done?: boolean; spec?: CampaignSpec; started: number }
export interface Hire { id: string; name: string; role: string; level: number; wage: number; since: number; kind: string }

export interface PropState {
  id: string;
  name: string;
  tags: string[];
  broken?: boolean;
  gone?: boolean;
  spawned?: boolean;
}

export interface CreationSpec {
  name: string;
  pronoun: 'he' | 'she' | 'they';
  species: string;
  variant?: string;
  cls: string;
  options: Record<string, string>;
  background: string;
  boost: { plus2: Ability; plus1: Ability; even: boolean };
  base: Abilities;
  skills: Skill[];
  cantrips: string[];
  spells: string[];
  removedKit: string[];
  customItems: string[];
  look: string;
  backstory: string;
  life: Record<string, string>;
  customBg?: import('../data/backgrounds').CustomBackground;
  lineage?: { plus2: Ability; feat: string; skill?: Skill; size: 'Small' | 'Medium' };
  featSkills?: Skill[];
}
