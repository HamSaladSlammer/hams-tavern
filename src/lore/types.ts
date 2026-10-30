// The shared design for the game master's knowledge, used by all four phases.
//
//   Phase 1 (lore brain):     Entity, Fact, Scope, Knower
//   Phase 2 (understanding):  Utterance, Discourse
//   Phase 3 (NPC minds):      Mind (personality, mood, goals, secrets) built on Knower
//   Phase 4 (scenes):         SceneLayer tables keyed by the same tags
//
// Everything is plain data so it stays offline, seeded and testable.

/** Anything the world can talk about. */
export type EntityKind = 'town' | 'place' | 'person' | 'faction' | 'event' | 'thing' | 'creature' | 'custom' | 'region' | 'god';
export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  aliases: string[]; // lower-case names players might type
  home?: string; // town id it belongs to, if any
  pronoun?: 'he' | 'she' | 'they' | 'it';
  tags?: string[];
}

/**
 * Who would know a fact.
 *  common          everyone in Lahti
 *  local:<town>    people from (or within a day of) that town
 *  trade:<trade>   people in that line of work
 *  faction:<id>    members of a faction (cult, crown, watch, veterans, faith)
 *  secret          only the knowers listed in `knownBy`
 */
export type Scope = 'common' | `local:${string}` | `trade:${string}` | `faction:${string}` | 'secret';

export interface Fact {
  id: string;
  about: string[]; // entity ids, most important first
  text: string; // one speakable sentence (or two), neutral voice
  scope: Scope;
  rumour?: boolean; // hearsay: told as "they say…"
  knownBy?: string[]; // npc ids for secrets (or extra knowers)
  needs?: string; // a state flag that must be set before anyone will say it (avoids spoilers)
  reveals?: string; // a place id that gets pinned on the World map when told
  weight?: number; // how central (default 1)
  dc?: number; // recall difficulty when the player tries to remember it themselves
}

export type Trade = 'innkeeper' | 'merchant' | 'smith' | 'watch' | 'soldier' | 'veteran' | 'farmer' | 'priest' | 'scholar' | 'sailor' | 'noble' | 'healer' | 'thief' | 'miner' | 'courier' | 'entertainer' | 'child' | 'drunk' | 'tailor' | 'hunter';

/** What an NPC can know: built from who they are. Phase 3 adds a Mind on top. */
export interface Knower {
  id: string;
  home: string; // town id
  trades: Trade[];
  factions: string[];
  worldly: number; // 0 = never left the village, 3 = knows the whole province
  secrets?: string[]; // fact ids only they know
}

/** Phase 2: what the player just said, understood. */
export interface Utterance {
  raw: string;
  act: 'ask-what' | 'ask-who' | 'ask-where' | 'ask-why' | 'ask-how' | 'ask-when' | 'ask-yesno' | 'request' | 'offer' | 'threat' | 'flatter' | 'insult' | 'joke' | 'greet' | 'farewell' | 'thanks' | 'statement' | 'claim' | 'more';
  entities: string[];
  pronounRefs: string[]; // entity ids filled in from the discourse
  sentiment: number; // -2..2
}

/** Phase 2: the running conversation. */
export interface Discourse {
  with: string | null; // npc id
  focus: string[]; // entity ids, most recent first
  told: string[]; // fact ids this NPC has told the player
  claims: Record<string, string>; // what the player has claimed: name, trade, goal…
  turns: number;
}
