import type { Character, GameState, NpcMemory, Skill, Ability } from '../engine/types';
import type { Rng } from '../engine/dice';
import type { SpeechAct } from '../nlp/profanity';

/** Everything content scripts may do. Implemented in engine/game.ts. */
export interface Ctx {
  s: GameState;
  rng: Rng;
  pc: Character;
  out(k: 'narr' | 'say' | 'you' | 'roll' | 'sys' | 'hit' | 'miss' | 'good' | 'bad' | 'title', t: string, who?: string): void;
  narr(t: string): void;
  say(npcId: string, t: string): void;
  sys(t: string): void;
  good(t: string): void;
  bad(t: string): void;
  check(skill: Skill, dc: number, opts?: { adv?: boolean; dis?: boolean; quiet?: boolean }): boolean;
  abilityCheck(a: Ability, dc: number, opts?: { adv?: boolean }): boolean;
  save(a: Ability, dc: number): boolean;
  flag(name: string): number | string | boolean | undefined;
  set(name: string, v?: number | string | boolean): void;
  give(itemId: string, qty?: number): void;
  money(cp: number): void;
  pay(cp: number): boolean;
  xp(n: number): void;
  fight(encounter: string | EncounterDef): void;
  move(roomId: string, opts?: { quiet?: boolean }): void;
  npc(id: string): NpcMemory;
  hasCompanion(id: string): boolean;
  addCompanion(id: string): void;
  journal(t: string): void;
  advance(minutes: number): void;
  timeOfDay(): 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'midnight';
  hour(): number;
  roomHasFoes(): boolean;
  toolCheck(dc: number): boolean;
  talkTo(npcId: string | null): void;
}

export interface Exit {
  to: string;
  names: string[]; // what the player can type
  label: string; // shown on chips
  minutes: number;
  travel?: string; // random-encounter table id to roll on
  blocked?: (c: Ctx) => string | null; // return a message to block
  hidden?: (c: Ctx) => boolean;
}

export interface Feature {
  id: string;
  names: string[];
  look: (c: Ctx) => string;
  search?: (c: Ctx) => void;
  open?: (c: Ctx, method: 'normal' | 'force' | 'pick' | 'kick') => void;
  pull?: (c: Ctx) => void;
  ring?: (c: Ctx) => void;
  cut?: (c: Ctx) => void;
  read?: (c: Ctx) => void;
  take?: (c: Ctx) => void;
  hidden?: (c: Ctx) => boolean;
}

export interface Room {
  id: string;
  name: string;
  region: string;
  desc: (c: Ctx) => string;
  exits: Exit[];
  npcs?: (c: Ctx) => string[];
  features?: Feature[];
  onEnter?: (c: Ctx) => void;
  rest?: 'long' | 'short' | 'none';
  shop?: string; // npc id that sells here
  outdoors?: boolean;
  chips?: (c: Ctx) => string[];
}

export interface Topic {
  id: string;
  keys: string[];
  say: (c: Ctx) => void;
  when?: (c: Ctx) => boolean;
  chip?: string; // label for suggestion chip
}

export interface ShopItem {
  id: string;
  price?: number; // override copper
  stock?: number;
}

export interface Npc {
  id: string;
  name: string;
  names: string[];
  short: string; // one-line who
  look: (c: Ctx) => string;
  greet: (c: Ctx) => void;
  topics: Topic[];
  unknown: string[]; // fallback lines when no topic matches
  speech?: (c: Ctx, act: SpeechAct, severity: number, text: string) => boolean; // returns true if handled
  hears?: (c: Ctx, text: string) => boolean; // custom handling of say (e.g. Doss is deaf)
  shop?: ShopItem[];
  buys?: string[]; // item ids they'll buy (or 'any')
  emote?: (c: Ctx, act: string) => boolean;
  social?: (c: Ctx, skill: 'persuasion' | 'intimidation' | 'deception' | 'performance', text: string) => boolean;
  give?: (c: Ctx, itemId: string) => boolean;
  attackable?: boolean; // if attacked outside combat, what happens is in onAttack
  onAttack?: (c: Ctx) => void;
  fightAs?: string; // monster id used if someone picks a fight with them
}

export interface EncounterDef {
  id: string;
  foes: [string, number][]; // monster id, count
  intro: string;
  fleeTo?: string;
  onWin?: (c: Ctx) => void;
  ambush?: boolean; // foes act first
  scaleWithParty?: boolean;
  names?: Record<string, string>; // monster id -> display name
  spawnAt?: Record<string, { x: number; y: number }>; // monster id -> fixed square
  nonlethal?: boolean; // a brawl: people at 0 HP are knocked out, not killed
  npcIds?: string[]; // townsfolk fighting in this encounter (they leave their spots)
  unitNames?: string[]; // names for each foe, in order
  onLose?: (c: Ctx) => void;
}

export interface TravelTable {
  id: string;
  chance: number; // 0..1 per trip
  entries: ((c: Ctx) => void)[];
}
