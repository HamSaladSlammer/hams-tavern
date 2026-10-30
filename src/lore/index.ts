// The lore brain: finds what you're asking about, works out what this person would know about it,
// and says it in their voice. Pure functions: the game applies the result.
import type { Entity, Fact } from './types';
import { ENTITIES } from './entities';
import { WORLD_FACTS } from './facts_world';
import { TOWN_FACTS } from './facts_towns';
import { PLACE_FACTS, PEOPLE_FACTS } from './facts_people';
import { MORE_FACTS } from './facts_more';
import { knowerFor, type KnowerProfile } from './knowers';
import { townById, poiById, daysBetween } from '../world/atlas';

export { knowerFor };
export const FACTS: Fact[] = [...WORLD_FACTS, ...TOWN_FACTS, ...PLACE_FACTS, ...PEOPLE_FACTS, ...MORE_FACTS];
export const FACT: Record<string, Fact> = Object.fromEntries(FACTS.map((f) => [f.id, f]));
export const ENTITY: Record<string, Entity> = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));
const BY_ENTITY: Record<string, Fact[]> = {};
for (const f of FACTS) for (const a of f.about) (BY_ENTITY[a] ??= []).push(f);
export const factsAbout = (id: string) => BY_ENTITY[id] ?? [];
// Facts that say nearly the same thing, so nobody repeats themselves in other words.
const wset = (t: string) => new Set(t.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const SIM: Record<string, Set<string>> = {};
{
  const ws = FACTS.map((f) => wset(f.text));
  for (let i = 0; i < FACTS.length; i++) for (let j = i + 1; j < FACTS.length; j++) {
    const a = ws[i], b = ws[j];
    if (!FACTS[i].about.some((x) => FACTS[j].about.includes(x))) continue;
    let n = 0; for (const w of a) if (b.has(w)) n++;
    if (n / Math.max(1, Math.min(a.size, b.size)) > 0.55) { (SIM[FACTS[i].id] ??= new Set()).add(FACTS[j].id); (SIM[FACTS[j].id] ??= new Set()).add(FACTS[i].id); }
  }
}
export const similar = (a: string, b: string) => !!SIM[a]?.has(b);

/** Entity id -> the place id it sits at on the world map (if different). */
const PLACE_OF: Record<string, string> = { counting_chapel: 'borschardt_chapel', grogs: 'brumandell', treaty_statue: 'brumandell', thimbleton_manor: 'brumandell', pos_potions: 'brumandell', arbys: 'brumandell', smoking_barrel: 'breda', scorched_barrel: 'breda', velvet_lantern: 'breda', kessels_rest: 'old_chapel', foothills: 'old_chapel', aimo_bridge: 'coltale', salt_anchor: 'coltale', tokarev_works: 'tokarev', zenu: 'greenspire', grog: 'brumandell', thimbleton: 'brumandell', squib: 'breda', doss: 'old_chapel', hetch: 'breda', elisiah: 'suomi', silver_watch: 'suomi', grolgar: 'makrovin', odessa: 'tantal' };
const REGION_POINT: Record<string, { x: number; y: number }> = { makrovin: { x: 0.12, y: 0.3 }, peaks: { x: 0.55, y: 0.12 }, mire: { x: 0.68, y: 0.8 }, thornwood: { x: 0.64, y: 0.33 }, stillmere: { x: 0.44, y: 0.33 }, aimo: { x: 0.58, y: 0.38 } };

// ---------- finding what you're talking about ----------
// Too vague to count as naming something on their own.
const VAGUE = new Set(['the village', 'this village', 'the river', 'the woods', 'the forest', 'the sea', 'the ocean', 'the lake', 'the country', 'this country', 'the world', 'this world', 'the province', 'this province', 'the march', 'the west', 'the capital', 'capital', 'the swamp', 'the mountains', 'the main road', 'here', 'company', 'friend', 'the dead']);
type Alias = { text: string; id: string; re: RegExp };
const ALIASES: Alias[] = [];
for (const e of ENTITIES) {
  for (const a of new Set([e.name.toLowerCase(), ...e.aliases])) {
    const t = a.toLowerCase().trim();
    if (t.length < 3 || VAGUE.has(t)) continue;
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, '[\'’]?');
    ALIASES.push({ text: t, id: e.id, re: new RegExp(`(?:^|[^a-z])${esc}(?:s|es|'s)?(?=$|[^a-z])`, 'i') });
  }
}
ALIASES.sort((a, b) => b.text.length - a.text.length);

export interface Mention { id: string; alias: string; at: number }
/** Every entity named in the text, longest names first, without overlaps. */
export function findEntities(text: string): Mention[] {
  const t = ` ${text.toLowerCase().replace(/[“”"?!.,]/g, ' ')} `;
  const taken: [number, number][] = [];
  const out: Mention[] = [];
  for (const a of ALIASES) {
    const m = a.re.exec(t);
    if (!m) continue;
    const start = m.index, end = m.index + m[0].length;
    if (taken.some(([s, e]) => start < e && end > s)) continue;
    taken.push([start, end]);
    if (!out.some((o) => o.id === a.id)) out.push({ id: a.id, alias: a.text, at: start });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- who knows what ----------
const pointOf = (id: string): { x: number; y: number } | null => {
  const pid = PLACE_OF[id] ?? id;
  return townById(pid) ?? poiById(pid) ?? REGION_POINT[pid] ?? null;
};
const daysFrom = (a: string, b: string) => { const pa = pointOf(a), pb = pointOf(b); return pa && pb ? daysBetween(pa, pb) : 99; };

export type Flags = (name: string) => unknown;
export function gateOpen(f: Fact, flag: Flags) {
  if (!f.needs) return true;
  return f.needs.startsWith('!') ? !flag(f.needs.slice(1)) : !!flag(f.needs);
}

export function knows(k: KnowerProfile, f: Fact, flag: Flags): boolean {
  if (!gateOpen(f, flag)) return false;
  if (f.knownBy?.includes(k.id) || k.secrets?.includes(f.id)) return true;
  if (k.entity && f.knownBy?.includes(k.entity)) return true;
  const sc = f.scope;
  if (sc === 'common') return true;
  if (sc === 'secret') return false;
  const [kind, what] = sc.split(':');
  if (kind === 'local') {
    if (k.home === what) return true;
    const d = daysFrom(k.home, what);
    return d <= 1.5 + k.worldly * 0.75 || (k.worldly >= 3 && !!f.rumour);
  }
  if (kind === 'trade') return k.trades.includes(what as never) || (k.worldly >= 3 && !!f.rumour);
  if (kind === 'faction') return k.factions.includes(what);
  return false;
}

// ---------- understanding the question (just enough for Phase 1) ----------
export type Ask = 'where' | 'who' | 'what' | 'more' | 'how' | 'why' | 'opinion' | 'statement';
export function askKind(text: string): Ask {
  const t = text.toLowerCase().trim();
  if (/^(what else|tell me more|more|go on|and\??$|anything else|keep going|continue|what more|say more)/.test(t)) return 'more';
  if (/\bwhere\b|how (do|can|would|should) (i|we|you|one) (get|reach|find)|how far|which way|directions? to|way to\b|get there/.test(t)) return 'where';
  if (/what do you (think|reckon|make)|how do you feel|do you like|your (opinion|take)|what'?s your view/.test(t)) return 'opinion';
  if (/^(who|whose)\b/.test(t)) return 'who';
  if (/^why\b/.test(t)) return 'why';
  if (/^how\b/.test(t)) return 'how';
  if (/^(i|i'm|im|i've|my|we|we're)\b/.test(t) && !/\?$/.test(t) && !/^i (want|need|would like|wonder|was wondering|heard|hear)\b/.test(t)) return 'statement';
  return 'what';
}
const PRONOUN = /\b(he|she|it|they|him|her|them|his|its|their|there|that place|that one|this one)\b/i;
const STOP = new Set('the a an of to in on at is are was were be been do does did you your i me my what who where when why how about tell know heard have has any some this that there it he she they them him her and or but for with from can could would should will tell me more else like s'.split(' '));
const words = (t: string) => t.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

// ---------- answering ----------
export interface LoreLine { k: 'say' | 'narr'; t: string }
export interface LoreAnswer { entity: string; lines: LoreLine[]; told: string[]; reveal: string[] }
export interface LoreCtx {
  npcId: string;
  npcName: string;
  pronoun?: 'he' | 'she' | 'they';
  here: string | null; // town id you're in
  flag: Flags;
  told: (factId: string) => boolean; // has this NPC already told it?
  rand: () => number;
  disposition: number;
}

const pickR = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length) % a.length];
const LOWER_OK = /^(The|A|An|There|Some|Someone|Somebody|Every|Everyone|Nobody|People|Folk|In|On|At|Most|Any|All|One|Two|If|When|During|Before|After|This|It)\b/;
const PROPER = new Set(ENTITIES.flatMap((e) => e.name.replace(/^the /i, '').split(/\s+/)).filter((w) => /^[A-Z]/.test(w)).concat(['I', 'Queen', 'King', 'Lord', 'Old', 'Mother', 'Master', 'Lahti', 'Elisiah', 'Grolgar']));
export const softStart = (t: string) => { const w = t.split(/[\s,:'’]/)[0]; return LOWER_OK.test(t) || !PROPER.has(w) ? t[0].toLowerCase() + t.slice(1) : t; };

function compass(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = (to.x - from.x) * 2000, dy = (to.y - from.y) * 1500;
  if (Math.hypot(dx, dy) < 40) return 'just near here';
  const a = (Math.atan2(-dy, dx) * 180) / Math.PI; // 0 = east, 90 = north
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return dirs[Math.round(((a + 360) % 360) / 45) % 8];
}
function daysWords(d: number) {
  if (d < 0.35) return 'a few hours\' walk';
  if (d < 0.75) return 'half a day on foot';
  const r = Math.max(1, Math.round(d * 2) / 2);
  return r === 1 ? 'a day on the road' : `${r % 1 ? r.toFixed(1) : r} days on the road`;
}
/** "North-west of here, two days on the road, out past Coltale." */
export function directions(id: string, here: string | null): string | null {
  const pid = PLACE_OF[id] ?? id;
  const to = pointOf(id);
  if (!to) return null;
  if (here && pid === here) return 'You\'re standing in it.';
  const from = here ? pointOf(here) : null;
  const poi = poiById(pid);
  const near = poi ? townById(poi.near) : null;
  const nearBit = near && near.id !== here ? ` Out past ${near.name}.` : near ? ' Not far from here at all.' : '';
  if (!from) return `${nearBit.trim() || 'Somewhere out on the roads of Lahti.'}`;
  const d = daysFrom(here!, pid) * 1.25;
  return `${compass(from, to)[0].toUpperCase()}${compass(from, to).slice(1)} of here, ${daysWords(d)}.${nearBit}`;
}

function leadFor(f: Fact, k: KnowerProfile, r: () => number): string {
  if (f.scope === 'secret') return '';
  if (f.rumour) return pickR(r, ['They say ', 'Word is, ', 'I heard ', 'Folk say ', 'Rumour has it ']);
  if (f.scope.startsWith('local:') && f.scope.slice(6) === k.home && r() < 0.5) return pickR(r, ['Round here, ', 'Everyone here knows: ', '']);
  if (f.scope.startsWith('trade:') && r() < 0.5) return pickR(r, ['In my line of work, you hear it: ', 'Between us trade folk, ', '']);
  return '';
}
const sayFact = (f: Fact, k: KnowerProfile, r: () => number) => { const l = leadFor(f, k, r); return l ? l + softStart(f.text) : f.text; };

/** Where someone would know more. */
function askElsewhere(id: string, here: string | null, flag: Flags): string | null {
  const locals = factsAbout(id).filter((f) => f.scope.startsWith('local:') && gateOpen(f, flag)).map((f) => f.scope.slice(6)).filter((t) => t !== here && townById(t));
  const t = locals[0] ?? (townById(PLACE_OF[id] ?? id)?.id !== here ? townById(PLACE_OF[id] ?? id)?.id : undefined) ?? (poiById(PLACE_OF[id] ?? id)?.near);
  const town = t ? townById(t) : null;
  return town && town.id !== here ? `Ask in ${town.name}; they'd know more.` : null;
}

/** Rank what this person knows about an entity for this question. */
function ranked(id: string, k: KnowerProfile, lc: LoreCtx, question: string): Fact[] {
  const qw = new Set(words(question));
  const ent = ENTITY[id];
  const nameW = new Set(words([ent?.name ?? '', ...(ent?.aliases ?? [])].join(' ')));
  return factsAbout(id).filter((f) => knows(k, f, lc.flag) && !lc.told(f.id) && !(k.entity && f.about.includes(k.entity)))
    .map((f) => {
      const fw = words(f.text);
      const overlap = fw.filter((w) => qw.has(w) && !nameW.has(w)).length;
      const lead = f.about[0] === id ? 1 : 0.4;
      return { f, sc: (f.weight ?? 1) * lead + (f.rumour ? 0 : 0.35) + overlap * 1.2 + (f.scope === 'secret' ? 0.5 : 0) + lc.rand() * 0.3 };
    })
    .sort((a, b) => b.sc - a.sc).map((x) => x.f);
}

export interface AnswerOpts { id: string; ask: Ask; question: string }
/** What this NPC says about an entity, or null if this isn't something lore should answer. */
export function answer(lc: LoreCtx, o: AnswerOpts): LoreAnswer | null {
  const k = knowerFor(lc.npcId, () => lc.here);
  if (!k) return null;
  const { id, ask, question } = o;
  const ent = ENTITY[id];
  if (!ent) return null;
  if (k.entity === id) return null; // asking someone about themselves: their own lines do that
  const lines: LoreLine[] = [];
  const out: LoreAnswer = { entity: id, lines, told: [], reveal: [] };
  const say = (t: string) => lines.push({ k: 'say', t: `"${t.trim().charAt(0).toUpperCase()}${t.trim().slice(1)}"` });
  if (k.avoids?.includes(id) && lc.disposition < 3) { lines.push({ k: 'narr', t: k.deflect ?? `${lc.npcName} changes the subject.` }); const e = askElsewhere(id, lc.here, lc.flag); if (e) lines.push({ k: 'say', t: `"${e}"` }); return out; }
  const facts = ranked(id, k, lc, question);
  const anyKnown = factsAbout(id).some((f) => knows(k, f, lc.flag));
  const isPlace = ent.kind === 'town' || ent.kind === 'place' || ent.kind === 'region' || !!poiById(PLACE_OF[id] ?? id);
  const chosen: Fact[] = [];
  for (const f of facts) {
    if (chosen.length >= 2) break;
    if (chosen.some((c) => similar(c.id, f.id)) || [...(SIM[f.id] ?? [])].some((x) => lc.told(x))) continue;
    chosen.push(f);
  }
  // where: give directions first
  if (ask === 'where' && (anyKnown || ent.kind === 'town')) {
    const dir = directions(id, lc.here);
    const place = PLACE_OF[id] ?? id;
    if (dir) {
      const who = ent.kind === 'person' && PLACE_OF[id] ? `${ent.name}? ${ent.pronoun === 'she' ? 'She' : ent.pronoun === 'it' ? 'It' : 'He'}'s at ${townById(place)?.name ?? poiById(place)?.name ?? 'home'}. ` : `${ent.name}? `;
      say(`${who}${dir}${chosen[0] ? ` ${sayFact(chosen[0], k, lc.rand)}` : ''}`);
      if (chosen[0]) out.told.push(chosen[0].id);
      if (poiById(place)) out.reveal.push(place);
      for (const f of chosen.slice(0, 1)) if (f.reveals) out.reveal.push(f.reveals);
      return out;
    }
  }
  if (!chosen.length) {
    if (anyKnown) { say(`${pickR(lc.rand, ['That\'s everything I\'ve got on', 'I\'ve told you all I know about', 'You\'ve had it all on'])} ${ent.name}. ${askElsewhere(id, lc.here, lc.flag) ?? 'Somebody who\'s been there might know more.'}`); return out; }
    if (!factsAbout(id).length) return null;
    if (!factsAbout(id).some((f) => gateOpen(f, lc.flag))) { say(`${ent.name}? ${pickR(lc.rand, ['Doesn\'t ring a bell. Odd sort of name.', 'First I\'ve heard of it. Where\'d you hear that?', 'No idea. And I hear most things in here.'])}`); return out; }
    const e = askElsewhere(id, lc.here, lc.flag);
    say(`${ent.name}? ${pickR(lc.rand, ['Heard the name. Not much more.', 'Not my end of the world.', 'That\'s beyond my patch.', 'Only the name, and that from a drunk.'])} ${e ?? (isPlace ? 'Somebody who travels would know.' : 'Ask somebody who gets about more.')}`);
    return out;
  }
  const startsWithName = chosen[0].text.toLowerCase().startsWith(ent.name.toLowerCase().replace(/^the /, '')) || chosen[0].text.toLowerCase().startsWith(ent.name.toLowerCase());
  const opener = ask === 'more' ? pickR(lc.rand, ['', 'What else. ', 'Let me think. ', 'Hm. ']) : pickR(lc.rand, startsWithName ? ['', '', 'Ah. ', 'Well. '] : ['', `${ent.name}? `, `${ent.name}. `, 'Ah. ']);
  const body = chosen.map((f) => sayFact(f, k, lc.rand)).join(' ');
  const secret = chosen.some((f) => f.scope === 'secret' || f.scope.startsWith('faction:'));
  if (secret) lines.push({ k: 'narr', t: `${lc.npcName} lowers ${lc.pronoun === 'she' ? 'her' : lc.pronoun === 'they' ? 'their' : 'his'} voice.` });
  say(`${opener}${body}`);
  out.told = chosen.map((f) => f.id);
  out.reveal = chosen.map((f) => f.reveals).filter((x): x is string => !!x);
  return out;
}

/** Is this text something lore should try to answer (a question or a bare topic), and about what? */
export function topicOf(text: string, focus: string | null): { id: string; ask: Ask; alias: string } | null {
  const ask = askKind(text);
  if (ask === 'statement') return null;
  const found = findEntities(text);
  if (found.length) {
    // "what is the war like" vs. a weather chat: keep the small-talk subjects for small talk
    const m = found.find((f) => !(f.id === 'weather' && !/tell me about|what do you know/.test(text.toLowerCase()))) ?? null;
    return m ? { id: m.id, ask, alias: m.alias } : null;
  }
  if (focus && (ask === 'more' || PRONOUN.test(text))) return { id: focus, ask, alias: '' };
  return null;
}

/** Recall: what you can remember (or work out) about something yourself. */
export function recallable(id: string, known: string[], flag: Flags, home: string | null): { remembered: Fact[]; fresh: Fact[] } {
  const all = factsAbout(id).filter((f) => gateOpen(f, flag) && f.scope !== 'secret');
  const remembered = all.filter((f) => known.includes(f.id));
  const fresh = all.filter((f) => !known.includes(f.id) && (f.scope === 'common' || (home && f.scope === `local:${home}`) || f.dc)).sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  return { remembered, fresh };
}
export function recallDc(f: Fact) { return f.dc ?? (f.scope === 'common' ? (f.rumour ? 12 : 10) : f.scope.startsWith('local:') ? 13 : 15); }
export function recallSkill(id: string): 'history' | 'religion' | 'arcana' | 'nature' {
  const e = ENTITY[id];
  if (!e) return 'history';
  if (e.kind === 'god' || ['old_faith', 'bright_hearth', 'silent_keeper', 'long_road', 'undead', 'old_chapel', 'kessels_rest', 'charms'].includes(id)) return 'religion';
  if (['magic', 'loremasters', 'forgetting', 'bellwax', 'bone_amulet', 'bell_pattern', 'vessariel', 'alistair', 'zenu', 'pale_queen'].includes(id)) return 'arcana';
  if (e.kind === 'creature' || ['wolves', 'wyrm', 'peaks', 'mire', 'thornwood', 'weather', 'hushmilk', 'frostpetal', 'thornleaf', 'widows_cap'].includes(id)) return 'nature';
  return 'history';
}
