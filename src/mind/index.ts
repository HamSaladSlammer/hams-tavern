// NPC minds: understand what you said, remember what you've told them, notice what's going on,
// and answer the way that particular person would.
import type { Ctx, Npc } from '../content/types';
import type { NpcMemory } from '../engine/types';
import { pick, next } from '../engine/dice';
import { personaOf, hash, type Persona } from './persona';
import { stanceOn, opinionLine, groupOf } from './opinions';
import * as Lore from '../lore';
import { townById, TOWNS } from '../world/atlas';
import { townOfRoom } from '../world/towns';

export { personaOf } from './persona';
export { stanceOn } from './opinions';

export interface Host { presentNpcs: (c: Ctx) => string[]; npcName: (id: string) => string }

// ---------- small helpers ----------
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const q = (s: string) => `"${s}"`;
const dayOf = (c: Ctx) => Math.floor((c.s.minutes + 480) / 1440);
const hereTown = (c: Ctx) => townOfRoom(c.s.loc) ?? c.s.world?.at ?? null;
type Mem = NpcMemory & { claims?: Record<string, string>; asked?: string | null; noticed?: string[]; evasive?: string | null; drinks?: number };
const memOf = (c: Ctx, id: string) => c.npc(id) as Mem;
const isPatterned = (id: string) => /_keeper$|_merchant$|_watch$|^x:|^hire_/.test(id);

function ctxOf(c: Ctx, np: Npc) {
  const home = hereTown(c);
  const k = Lore.knowerFor(np.id, townOfRoom);
  const p = personaOf(np, k?.home ?? home, k?.trades ?? []);
  const m = memOf(c, np.id);
  return { home, k, p, m, mood: moodOf(c, np, p, m) };
}
type MC = ReturnType<typeof ctxOf>;

/** -3 hostile .. 3 warm: who they are, how you've treated them, and what's going on right now. */
export function moodOf(c: Ctx, np: Npc, p: Persona, m: Mem): number {
  let v = m.disposition + p.warmth * 0.5 - m.insults * 0.7;
  const h = c.hour();
  if ((h >= 23 || h < 5) && !/_keeper$|^squib$/.test(np.id)) v -= 0.5;
  if (c.pc.drunk >= 4) v += p.humour >= 1 ? 0.3 : -0.5;
  if (c.flag('chapel_done') || (c.s.world?.renown ?? 0) >= 8) v += 0.5;
  return Math.max(-3, Math.min(3, Math.round(v * 2) / 2));
}
export function moodWord(v: number) { return v <= -2 ? 'hostile' : v < 0 ? 'wary' : v < 1 ? 'neutral' : v < 2 ? 'friendly' : 'warm'; }

const PRON = (p: Persona) => (p.pronoun === 'she' ? { s: 'she', o: 'her', ps: 'her' } : p.pronoun === 'they' ? { s: 'they', o: 'them', ps: 'their' } : { s: 'he', o: 'him', ps: 'his' });
function body(c: Ctx, np: Npc, x: MC): string {
  const n = np.name.replace(/^the /, 'The '), pr = PRON(x.p);
  const w = moodWord(x.mood);
  const B: Record<string, string[]> = {
    hostile: [`${n} doesn't look up.`, `${n}'s jaw tightens.`, `${n} folds ${pr.ps} arms.`, `A flat stare from ${np.name}.`],
    wary: [`${n} looks you over first.`, `${n} takes a moment before answering.`, `A careful glance from ${np.name}.`],
    neutral: [`${n} considers it.`, `${n} shrugs.`, ''],
    friendly: [`${n} leans in a little.`, `A small smile from ${np.name}.`, `${n} sets down what ${pr.s}'s doing.`],
    warm: [`${n} grins.`, `${n} pulls up a stool.`, `${n} laughs.`],
  };
  return pick(c.rng, B[w]);
}
function speak(c: Ctx, np: Npc, x: MC, line: string, o: { beat?: number; name?: boolean } = {}) {
  const b = next(c.rng) < (o.beat ?? 0.25) ? body(c, np, x) : '';
  const nm = x.m.claims?.name && (o.name ?? next(c.rng) < 0.2) && x.mood >= 0 ? `${x.m.claims.name}, ` : '';
  const narrative = /^"|: "|\." |says [A-Z]/.test(line);
  const said = narrative ? line : nm ? q(nm + line.charAt(0).toLowerCase() + line.slice(1)) : q(line);
  c.say(np.id, fixPl(`${b ? `${b} ` : ''}${said}`, np));
}

/** One true thing this person knows about something, in their words, marked as told. */
let ROUND: Set<string> | null = null; // facts already said aloud this moment, by anyone
export function knownFact(c: Ctx, np: Npc, id: string, words = '', juicy = false): string | null {
  const k = Lore.knowerFor(np.id, townOfRoom);
  if (!k) return null;
  const m = memOf(c, np.id);
  const qw = new Set(words.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const fs = Lore.factsAbout(id).filter((f) => Lore.knows(k, f, (n) => c.flag(n)) && !m.topicsSeen.includes(`f:${f.id}`) && !ROUND?.has(f.id) && ![...ROUND ?? []].some((r) => Lore.similar(r, f.id)) && !(k.entity && f.about.includes(k.entity)))
    .map((f) => ({ f, sc: (f.weight ?? 1) + (f.about[0] === id ? 0.5 : 0) + f.text.toLowerCase().split(/\W+/).filter((w) => qw.has(w)).length + next(c.rng) * 0.4 + (juicy ? (f.rumour ? 1.5 : 0) + (f.scope === 'common' ? -1 : 1) : 0) }))
    .sort((a, b) => b.sc - a.sc);
  const f = fs[0]?.f;
  if (!f) return null;
  m.topicsSeen.push(`f:${f.id}`);
  ROUND?.add(f.id);
  const known = (c.s.loreKnown ??= []);
  if (!known.includes(f.id)) known.push(f.id);
  return f.rumour && !/\b(say|says|said|heard|rumour)\b/i.test(f.text.split(' ').slice(0, 6).join(' ')) ? `${pick(c.rng, ['They say ', 'Word is, ', 'I heard '])}${Lore.softStart(f.text)}` : f.text;
}


// Groups ("the dwarves") and "they" people need plural verbs.
const IRREG: Record<string, string> = { "doesn't": "don't", "isn't": "aren't", "wasn't": "weren't", has: 'have', is: 'are', was: 'were', does: 'do', goes: 'go' };
function fixPl(text: string, np: Npc): string {
  const p = personaOf(np, null);
  if (p.pronoun !== 'they') return text;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subs = Array.from(new Set(['They', 'they', ...(/s$/.test(np.name) ? [np.name, np.name.replace(/^the /, 'The ')] : [])])).map(esc).join('|');
  return text
    .replace(new RegExp(`\\b(${subs})'s\\b`, 'g'), "$1're")
    .replace(new RegExp(`\\b(${subs}) ([a-z']+)\\b`, 'g'), (all, sub: string, v: string) => {
      if (IRREG[v]) return `${sub} ${IRREG[v]}`;
      if (v.length > 3 && /s$/.test(v) && !/(ss|us|is|ous)$/.test(v)) return `${sub} ${/(sh|ch|x|o)es$/.test(v) ? v.slice(0, -2) : v.slice(0, -1)}`;
      return all;
    });
}
const nar = (c: Ctx, np: Npc, t: string) => c.narr(fixPl(t, np));
const sy = (c: Ctx, np: Npc, t: string) => c.say(np.id, fixPl(t, np));

/** The most interesting thing this person knows and hasn't told you: gossip, secrets, trouble. */
export function juicyFact(c: Ctx, np: Npc): string | null {
  const home = hereTown(c) ?? 'breda';
  const ids = ['cult', 'bells', 'undead', 'bellwax', home, 'crown', 'treaty', 'drinker', 'grey_mercy', 'pale_queen'];
  const k = Lore.knowerFor(np.id, townOfRoom);
  if (!k) return null;
  const m = memOf(c, np.id);
  let best: { id: string; sc: number } | null = null;
  for (const id of ids) for (const f of Lore.factsAbout(id)) {
    if (!Lore.knows(k, f, (n) => c.flag(n)) || m.topicsSeen.includes(`f:${f.id}`)) continue;
    const sc = (f.rumour ? 1.5 : 0) + (f.scope === 'common' ? 0 : 1.2) + (/cult|dead|bell|smuggl|candle|secret|missing|night|grave|green|crates|nobody/.test(f.text.toLowerCase()) ? 1 : 0) + next(c.rng) * 0.8;
    if (!best || sc > best.sc) best = { id, sc };
  }
  return best ? knownFact(c, np, best.id, 'cult dead bell secret night missing candle', true) : null;
}

// ---------- understanding ----------
const SELF: [RegExp, keyof Persona | 'name' | 'feel' | 'age' | 'married' | 'job_like' | 'here_like'][] = [
  [/\b(what'?s|what is|tell me) your name\b|\bwho are you\b|\bwhat do (they|people|i) call you\b|\byour name\??$/, 'name'],
  [/\bwhere (are|were) you (from|born)\b|\bwhere('re| are) you from\b|\bwhere did you grow up\b|\bwhere'?s home\b|\bare you from (here|around here)\b/, 'from'],
  [/\bhow long (have you|you'?ve) (been|lived|worked|run|had)\b|\bbeen here long\b/, 'years'],
  [/\b(do you have|have you got|got) (any )?(family|kids|children|a wife|a husband|siblings|brothers|sisters)\b|\byour family\b|\bare you married\b/, 'family'],
  [/\bwhat do you do\b|\bwhat'?s your (job|work|trade)\b|\bwhat is your (job|work|trade)\b|\bwhat (are|is) your (story|deal)\b|\babout yourself\b|\btell me about you\b/, 'self'],
  [/\bwhat was the war like\b|\bdid you (fight|serve)\b|\bwere you (in|at) the war\b|\bwhat did you do in the war\b|\byour war\b/, 'war'],
  [/\bwhat are you (afraid|scared) of\b|\bwhat scares you\b|\bare you (afraid|scared)\b|\bdo you fear\b/, 'fears'],
  [/\bwhat do you want\b|\bwhat'?s your dream\b|\bwhat do you dream of\b|\bwhat would you (do|want) if\b|\bif you could have anything\b/, 'wants'],
  [/\bwhat do you (like to )?drink\b|\byour favou?rite drink\b|\bwhat'?s your poison\b|\bwhat do you recommend to drink\b|\bwhat (should|would) i drink\b|\brecommend (a |something to )?drink\b/, 'drink'],
  [/\bdo you (pray|believe in (the )?gods?)\b|\bwhich god\b|\bwho do you pray to\b|\bare you religious\b/, 'god'],
  [/\bhow old are you\b|\byour age\b/, 'age'],
  [/\bdo you like (it )?(here|this town|this place|living here|your job|your work)\b|\bare you happy here\b/, 'here_like'],
];
const PLACE: [RegExp, string][] = [
  [/\bwho (runs|rules|governs|is in charge of|owns|leads) (this|the) (town|village|city|place)\b|\bwho'?s in charge( here| around here)?\b|\bwho runs things\b/, 'ruler'],
  [/\bwho owns this (place|inn|tavern|bar|shop)\b/, 'owner'],
  [/\bwho('?s| is) (the )?most interesting\b|\bwho should i (talk|speak) to\b|\banyone (interesting|worth talking to)\b|\bwho'?s who\b/, 'who'],
  [/\bwhat('?s| is) there to do\b|\banything to do\b|\bwhat do people do (for fun|here)\b|\bwhat'?s good (here|around here)\b|\bsights?\b/, 'todo'],
  [/\b(where can i|how can i|where do i|how do i) (find|get) (work|a job|jobs|coin|money)\b|\bany work\b|\bis there (any )?work\b|\bare you hiring\b|\bneed (a|any) (hand|help)\b|\bwork for me\b/, 'work'],
  [/\bis it safe\b|\bare the roads safe\b|\bsafe (on|to travel|out)\b|\bdangerous (out there|on the roads?)\b/, 'safe'],
  [/\bwhat should i (be careful|watch out|look out|beware)\b|\bany dangers?\b|\bwhat'?s dangerous\b|\banything i should know\b|\bany advice\b/, 'careful'],
  [/\bwhat do you recommend\b|\bwhat'?s good to eat\b|\bwhat should i eat\b|\bhouse special\b|\bbest (food|dish|thing on the menu)\b/, 'food'],
  [/\bseen anything (strange|odd|weird|unusual)\b|\banything strange (lately|happening)\b|\bnoticed anything\b/, 'strange'],
];
type Claim = { kind: string; v: string; ent?: string };
const LOSS = '(brother|sister|father|mother|dad|mum|mom|son|daughter|wife|husband|friend|best friend|family|parents|cousin|uncle|aunt|grandfather|grandmother|comrade|partner|love)';
function claimOf(t: string): Claim | null {
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(?:my name is|my name's|i'?m called|call me|i am called|they call me|the name'?s|name'?s)\s+([a-z' -]{2,24}?)(?:[,.]|\band\b|$)/))) return { kind: 'name', v: m[1].trim() };
  if ((m = t.match(new RegExp(`^(?:i|we)\\s+lost (?:my|our|a) ${LOSS}\\b(.*)$`))) || (m = t.match(new RegExp(`^my ${LOSS} (?:died|was killed|fell|never came (?:home|back))\\b(.*)$`)))) return { kind: 'lost', v: m[1], ent: Lore.findEntities(m[2] ?? '')[0]?.id };
  if ((m = t.match(/^(?:i|we) (?:fought|served|was|were|marched|bled) (?:at|in|with|under|for|on)\s+(.+)$/)) && /war|greymarch|army|militia|siege|battle|front|company|regiment|coltale|field|the line|grolgar|elisiah|crown|orcs|elves/.test(m[1])) return { kind: 'fought', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if (/^i (?:was|am|used to be) a (?:soldier|veteran)\b|^i'?m a veteran\b/.test(t)) return { kind: 'fought', v: 'the war' };
  if ((m = t.match(/^(?:i|we) (?:just )?(?:killed|slew|took down|dealt with|destroyed|stopped|beat|silenced|ended|put down|cleared(?: out)?)\s+(.+)$/))) return { kind: 'killed', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if ((m = t.match(/^(?:i'?m|i am|we'?re|we are) (?:looking|searching|hunting) for\s+(.+)$|^(?:i'?m|i am) (?:after|hunting|seeking|chasing)\s+(.+)$|^i (?:want|need) to find\s+(.+)$/))) { const v = m[1] ?? m[2] ?? m[3]; return { kind: 'looking', v, ent: Lore.findEntities(v)[0]?.id }; }
  if ((m = t.match(/^(?:i'?m|i am|we'?re|we are) (?:going|heading|off|travelling|traveling|leaving|setting off|riding|walking) (?:to|for|towards?)\s+(.+?)(?:\s+(?:tomorrow|today|tonight|soon|next|in the morning|at dawn).*)?$/))) return { kind: 'going', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if (/^(?:i'?m|i am|we'?re|we are) (?:new (?:here|in town|in (?:the )?(?:village|city|area)|to (?:town|these parts|lahti|the area))|just passing through|passing through|a stranger here|not from (?:here|around here))|^(?:i|we) (?:just )?(?:arrived|got here|came in)\b|^(?:first|my first) time (?:here|in)\b/.test(t)) return { kind: 'new', v: '' };
  if ((m = t.match(/^(?:i'?m|i am|i come|i hail|i grew up|i was born)\s+(?:from|in)\s+(.+)$/))) return { kind: 'origin', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if ((m = t.match(/^(?:i'?m|i am) (?:a|an)\s+([a-z -]+?)(?:\s+from\s+(.+))?$/))) return { kind: 'trade', v: m[1].trim(), ent: m[2] ? Lore.findEntities(m[2])[0]?.id : undefined };
  if ((m = t.match(/^(?:i|we) (?:don'?t|do not|never) (?:trust|like|believe|care for) (?:in )?(.+)$/))) return { kind: 'distrust', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if ((m = t.match(/^(?:i|we) (?:love|like|trust|admire|respect|believe in) (.+)$/))) return { kind: 'like', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if ((m = t.match(/^(?:i|we) (?:think|believe|reckon|bet|suspect|know|figure|heard)(?: that)?\s+(.+)$/))) return { kind: 'belief', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if ((m = t.match(/^(?:i|we) (?:saw|spotted|met|found|heard|ran into|came across)\s+(.+)$/))) return { kind: 'saw', v: m[1], ent: Lore.findEntities(m[1])[0]?.id };
  if ((m = t.match(/^(?:i'?m|i am|i feel|feeling)\s+(?:so |really |very |a bit |kind of )?(sad|lonely|scared|afraid|happy|bored|lost|homesick|excited|angry|worried|nervous|broke|rich|hungry|cold|drunk|great|good|fine|awful|terrible)\b/))) return { kind: 'feel', v: m[1] };
  return null;
}

// ---------- the town's rulers, for "who runs this town?" ----------
const RULER: Record<string, string> = {
  breda: 'Nobody, officially. The militia sergeant thinks it\'s him. Squib actually does.',
  suomi: 'The queen. Elisiah herself, from the palace on the hill. And her court, and their cousins.',
  borschardt: 'The guild council. Eleven bankers who agree on nothing except interest rates.',
  tokarev: 'The works overseer, for the crown. The factory whistle runs this town more than any man.',
  largo: 'A harbour-reeve, on paper. In practice, whoever pays the river guild that week.',
  coltale: 'The garrison commander, still. The war\'s been over fifteen years and nobody told the paperwork.',
  brumandell: 'Lord Thimbleton, from the manor in the north-west. Strict. Fair, mostly. Doesn\'t drink beer.',
  herstal: 'A reeve the town elects every winter, when there\'s nothing else to do.',
  tantal: 'Odessa Brask runs the mine, and the mine runs the village.',
  galilin: 'The market wardens. They\'ll tax anything that crosses the ford, including gossip.',
  rastbrook: 'An old knight with one eye and two votes on the village moot.',
  shpagin: 'The eel-catchers\' moot. Whoever shouts loudest at the meeting wins.',
  madsen: 'The fishing families, between them. Their feuds are older than the crown.',
  nagant: 'The lighthouse keeper, near enough. He\'s the only one anyone listens to.',
  radom: 'The border captain. The checkpoint is the town and the captain is the checkpoint.',
  samopal: 'The innkeeper at the crossroads, if you ask honestly. Every road pays her toll.',
  maxim: 'The levee board. If the ditches are dug, nobody minds who\'s on it.',
  carcano: 'The quarry masters\' guild. They\'re carving the chapel steps in their own names.',
  lebel: 'The shepherd families. They don\'t hold with being run.',
};

// ---------- the main entry ----------
/** Answer what was said, as this person. Returns true if handled. scripted: a hand-written line already covers it. */
export function respond(c: Ctx, h: Host, np: Npc, text: string, o: { scripted?: boolean } = {}): boolean {
  if (np.id === 'kettle') return false;
  const x = ctxOf(c, np);
  const t = text.toLowerCase().trim().replace(/["“”]/g, '').replace(/[.!]+$/, '').replace(/^(so|well|hey|ok|okay|um|uh|listen|look),?\s+/, '');
  // 1. an answer to their own question
  if (x.m.asked && !/\?$/.test(text.trim()) && t.split(/\s+/).length <= 7 && answerTheirQuestion(c, h, np, x, t)) return true;
  x.m.asked = null;
  // 2. thanks, sorry
  if (/^(thanks|thank you|thank ye|cheers|ta|many thanks|much obliged|i appreciate (it|that|you))\b/.test(t)) { thanks(c, np, x); return true; }
  if (/^(sorry|i'?m sorry|my apologies|i apologi[sz]e|forgive me|my bad)\b/.test(t)) { apology(c, np, x); return true; }
  // 3. things you tell them about yourself
  const cl = claimOf(t);
  if (cl) { claim(c, h, np, x, cl, t); return true; }
  // 4. offers
  if (/\b(buy|get|stand) you a (drink|pint|round|ale|beer)\b|\b(have|take) a drink (on me|with me)\b|\bdrink with me\b|\bthis one'?s on me\b|\blet me buy you\b/.test(t)) { buyDrink(c, np, x); return true; }
  if (/^(can|could|may) i help( you)?\b|\bdo you need (any )?help\b|\bneed a hand\b|\banything i can do\b|\bcan i do anything for you\b/.test(t)) { offerHelp(c, np, x); return true; }
  if (o.scripted) return false;
  // 5. questions about them
  for (const [re, key] of SELF) if (re.test(t)) { selfAnswer(c, np, x, key as string); return true; }
  // 6. questions about here
  for (const [re, key] of PLACE) if (re.test(t)) { if (placeAnswer(c, h, np, x, key, t)) return true; break; }
  // 7. opinions
  const op = t.match(/\b(?:what do you (?:think|reckon|make) (?:of|about)|how do you feel about|do you (?:like|trust|hate|believe in)|what'?s your (?:opinion|take|view) (?:of|on)|your (?:opinion|thoughts) (?:of|on)|are you (?:a fan of|afraid of|scared of)|thoughts on)\s+(.+?)\??$/);
  if (op) { opinion(c, h, np, x, op[1], t); return true; }
  return false;
}

// ---------- pieces ----------
function thanks(c: Ctx, np: Npc, x: MC) {
  const L = x.mood <= -2 ? ['Don\'t thank me. Just go.', 'Hm.'] : x.p.warmth >= 1 ? ['Any time. I mean it.', 'Go on, it was nothing.', 'Look after yourself out there.', 'That\'s what I\'m here for.'] : ['Don\'t mention it.', 'Mm. You\'re welcome.', 'You can thank me with coin, next time.', 'Right.'];
  speak(c, np, x, pick(c.rng, L), { beat: 0.2 });
  const key = `thanked_${np.id}_${dayOf(c)}`;
  if (!c.flag(key) && x.m.disposition < 2) { c.set(key); x.m.disposition += 0.5; }
}
function apology(c: Ctx, np: Npc, x: MC) {
  if (x.m.disposition < 0 || x.m.insults) {
    const ok = x.p.temper < 1.5 || x.m.insults < 3;
    speak(c, np, x, ok ? pick(c.rng, ['Hm. Fine. Don\'t do it again.', 'Water under the bridge. This once.', 'Apology noted. Not forgotten, mind. Noted.']) : pick(c.rng, ['Sorry doesn\'t pour the ale back in the mug.', 'You\'ve said that before.']), { beat: 0.6 });
    if (ok) { x.m.disposition = Math.min(0, x.m.disposition + 1); x.m.insults = Math.max(0, x.m.insults - 1); }
  } else speak(c, np, x, pick(c.rng, ['For what? You\'ve done nothing wrong.', 'No harm done.', 'Sorry for what?']));
}

function selfAnswer(c: Ctx, np: Npc, x: MC, key: string) {
  const p = x.p;
  if (x.mood <= -2 && key !== 'name') { speak(c, np, x, pick(c.rng, ['Why do you want to know?', 'None of your business.', 'Ask somebody who likes you.']), { beat: 0.7 }); return; }
  if (key === 'war' && p.avoidsWar && x.m.disposition < 3) { nar(c, np, np.id === 'squib' ? 'Squib\'s cloth stops on the mug. He looks at it for a long moment. "Next question."' : `${np.name} goes quiet. "I don't talk about that."`); x.m.evasive = 'war'; return; }
  const town = townById(p.from)?.name ?? 'somewhere';
  const here = townById(hereTown(c) ?? '')?.name;
  const firstName = np.name.replace(/^(Watch-Captain|Master|Mother|Lord|Lady)\s+/, '');
  const A: Record<string, () => string> = {
    name: () => (isPatterned(np.id) || np.id === 'smith' ? `${np.name}. ${x.mood >= 1 ? 'And you are?' : 'Not that it matters.'}` : `${firstName}. ${x.mood >= 1 ? 'Pleased to meet you.' : 'Everybody knows that.'}`),
    from: () => (p.from === hereTown(c) ? `Here. Born and bred in ${town}. ${p.years > 20 ? 'Never saw a reason to leave.' : 'Left once. Came back.'}` : `${town}, originally. ${p.years === 1 ? 'A year' : `${p.years} years`} here now${here ? ` in ${here}` : ''}. ${pick(c.rng, ['Still feels like visiting.', 'Long enough to call it home.', 'The cooking\'s better back home. Don\'t tell anyone.'])}`),
    years: () => (p.years >= 100 ? `Longer than you've been alive. Longer than your grandmother, probably.` : `${p.years === 1 ? 'A year' : `${p.years} years`}. ${p.years > 15 ? 'Since before the treaty.' : p.years < 3 ? 'Still learning where the floorboards creak.' : 'Long enough.'}`),
    family: () => p.family,
    self: () => p.self,
    war: () => p.war,
    fears: () => p.fears,
    wants: () => p.wants,
    drink: () => p.drink,
    god: () => (p.god ? `I pray to ${p.god}` : 'The gods and I aren\'t on speaking terms.'),
    age: () => (p.people === 'elf' ? 'Old enough to remember things you\'ve only read about. Leave it there.' : p.people === 'undead' ? 'Two hundred and something. I stopped having birthdays. Well, I have them. Nobody comes.' : pick(c.rng, ['Old enough to know better.', 'Older than I look. Younger than I feel.', 'Rude question. Forty-something.'])),
    here_like: () => (stanceOn(hereTown(c) ?? '', p, x.k) >= 0 || p.from === hereTown(c) ? pick(c.rng, ['It suits me. Quiet, mostly. People are decent.', 'I like it fine. Wouldn\'t say so in front of them, mind.']) : pick(c.rng, ['It\'s work. Somebody has to.', 'Ask me again when the bell stops.'])),
  };
  const line = A[key]?.() ?? p.self;
  speak(c, np, x, line, { beat: key === 'family' || key === 'war' || key === 'fears' ? 0.6 : 0.3 });
  if (key === 'name' && !x.m.claims?.name && x.mood >= 0 && next(c.rng) < 0.6) { x.m.asked = 'name'; }
}

function placeAnswer(c: Ctx, h: Host, np: Npc, x: MC, key: string, t: string): boolean {
  const town = hereTown(c);
  const tn = townById(town ?? '');
  const L: string[] = [];
  if (key === 'ruler') L.push(np.id === 'squib' && town === 'breda' ? 'Nobody, officially. The militia sergeant thinks it\'s him. People say I do. I just pour.' : RULER[town ?? ''] ?? 'Whoever\'s got the most coin and the fewest scruples. Same as anywhere.');
  else if (key === 'owner') L.push(/_keeper$|^squib$/.test(np.id) ? 'You\'re looking at them.' : `${h.npcName(c.s.loc === 'tavern' ? 'squib' : `${town}_keeper`)} runs it.`);
  else if (key === 'who') {
    const others = h.presentNpcs(c).filter((id) => id !== np.id && id !== 'kettle').slice(0, 3);
    if (!others.length) L.push('In here? Me. Sad, isn\'t it.');
    else L.push(others.map((id, i) => `${i === 0 ? '' : i === others.length - 1 ? 'And ' : ''}${h.npcName(id)}${i === 0 ? ', for a start' : ''}.`).join(' ') + ' ' + pick(c.rng, ['Talk to them. Buy them a drink first.', 'Mind your manners and they\'ll tell you plenty.']));
  } else if (key === 'todo') {
    const f = town ? knownFact(c, np, town, 'market square inn people famous best') : null;
    L.push(`${f ?? (tn ? pick(c.rng, tn.lore) : 'Not much. That\'s the charm.')} ${pick(c.rng, ['Otherwise there\'s drinking.', 'Board in the square has work if you\'re bored.', 'And there\'s always the ale.'])}`);
  } else if (key === 'work') {
    const jobs = (c.s.world?.jobs ?? []).filter((j) => j.town === town && !j.taken && !j.done).length;
    L.push(`${jobs ? `Notice board's got ${jobs === 1 ? 'one posting' : `${jobs} postings`} on it right now.` : 'Check the notice board in the square.'} ${pick(c.rng, ['Honest work, mostly.', 'Some of it even pays.', 'Read the small print.'])}`);
    L.push(`Me? ${x.p.wants}`);
  } else if (key === 'safe' || key === 'careful') {
    const fr = Object.values(c.s.world?.fronts ?? {}).filter((f) => f.active && !f.ended && f.clock >= 2);
    const bits = fr.map((f) => (f.id === 'bells' ? 'The dead walk the roads at night now. More of them every week.' : f.id === 'treaty' ? 'Patrols on the western roads are jumpy. Don\'t give anyone in uniform a reason.' : f.id === 'drinker' ? 'Stay out of the low water. The Mire takes people.' : `${f.name}. Folk are nervous.`));
    if (!c.flag('bell_silenced') && !c.flag('not_bells')) bits.push('That bell at midnight. The night after it rings, something always walks.');
    bits.push(pick(c.rng, ['Bandits on the south road, if you look rich.', 'Wolves run in sixes in the Thornwood.', 'Travel by day. Camp with a fire.']));
    if (key === 'careful' && tn && ['borschardt', 'largo', 'suomi'].includes(tn.id)) bits.push('And mind your purse here. City fingers are quick.');
    L.push(`${key === 'safe' ? (bits.length > 2 ? 'Safe? No.' : 'Safe enough, by day.') : 'Where to start.'} ${bits.slice(0, 2).join(' ')}`);
  } else if (key === 'food') L.push(town === 'brumandell' ? 'The chowder. Don\'t argue, just order the chowder.' : c.s.loc === 'tavern' ? 'Barrel Brown and the stew. The pie if you\'re brave.' : pick(c.rng, ['The stew. It\'s always the stew.', 'Whatever came in fresh today. Ask.', 'Roast chicken, if you\'ve the coin.']));
  else if (key === 'strange') {
    const f = knownFact(c, np, pick(c.rng, ['undead', 'bells', 'cult']), 'strange night dead candles');
    L.push(f ?? 'Strange? Every night, lately.');
  } else return false;
  speak(c, np, x, L.join(' '), { beat: key === 'safe' || key === 'careful' || key === 'strange' ? 0 : 0.25 });
  return true;
}

function opinion(c: Ctx, h: Host, np: Npc, x: MC, what: string, t: string) {
  // about you
  if (/^(me|myself|us)$/.test(what.trim())) {
    const d = x.m.disposition;
    speak(c, np, x, d >= 3 ? 'I like you. Don\'t make me regret saying so.' : d >= 1 ? 'You\'re all right. So far.' : d <= -2 ? 'I think you should leave.' : x.m.met ? 'Haven\'t made my mind up.' : 'I don\'t know you yet.', { beat: 0.6 });
    return;
  }
  const found = Lore.findEntities(what)[0];
  const id = found?.id ?? h.presentNpcs(c).find((pid) => what.includes(h.npcName(pid).toLowerCase().split(' ')[0]))?.replace(/^whisperers$/, 'window_table') ?? null;
  if (!id) {
    speak(c, np, x, pick(c.rng, [`${cap(what)}? I've never given it a moment's thought. Should I?`, `${cap(what)}. Hm. I'll have to get back to you.`, `I don't know enough about ${what} to have an opinion. Most people don't, and they have one anyway.`]));
    return;
  }
  const ent = Lore.ENTITY[id];
  if (ent && Lore.factsAbout(id).length && !Lore.factsAbout(id).some((f) => Lore.gateOpen(f, (n) => c.flag(n)))) { speak(c, np, x, `${ent.name}? Never heard of them. Should I have?`); return; }
  if (x.k?.entity === id) { speak(c, np, x, pick(c.rng, ['Me? I\'m wonderful. Ask anyone.', 'I try not to think about myself. It\'s a full-time job.'])); return; }
  if (x.p.avoidsWar && groupOf(id) === 'war' && x.m.disposition < 3) { nar(c, np, `${np.name} looks at you for a long moment and says nothing at all.`); x.m.evasive = id; return; }
  const st = stanceOn(id, x.p, x.k);
  const fear = /afraid|scared/.test(t);
  let line = fear ? (x.p.bravery >= 1.5 ? `Afraid? No. Careful, yes.` : x.p.bravery <= 0 ? 'Terrified. Who wouldn\'t be?' : 'Some nights. More than I\'d say in daylight.') : opinionLine(id, ent?.name ?? what, st, (a) => pick(c.rng, a));
  const f = next(c.rng) < 0.6 ? knownFact(c, np, id, t) : null;
  if (f) line += ` ${f}`;
  speak(c, np, x, line, { beat: st >= 1 ? 0.4 : st <= -1 ? 0 : 0.25 });
}

function claim(c: Ctx, h: Host, np: Npc, x: MC, cl: Claim, t: string) {
  const m = x.m; m.claims ??= {};
  const p = x.p;
  const own = p.claims?.[cl.kind === 'killed' && cl.ent && ['bells', 'old_chapel', 'merah'].includes(cl.ent) ? 'killed_bell' : cl.kind === 'distrust' && cl.ent && groupOf(cl.ent) === 'crown' ? 'distrust_crown' : cl.kind === 'belief' && cl.ent && ['bells', 'cult'].includes(cl.ent) ? 'bells' : cl.kind];
  const tn = townById(hereTown(c) ?? '');
  switch (cl.kind) {
    case 'name': {
      const nm = cap(cl.v.split(' ')[0]);
      const before = m.claims.name;
      m.claims.name = nm; m.met = true;
      if (before && before.toLowerCase() !== nm.toLowerCase()) { speak(c, np, x, `Last time it was ${before}. Now it's ${nm}? ${x.p.suspicion >= 1 ? 'I\'ll be counting my spoons.' : 'Fine. I\'ve had a few names myself.'}`, { beat: 0.7, name: false }); if (x.p.suspicion >= 1) m.disposition -= 0.5; return; }
      const meName = isPatterned(np.id) ? np.name.split(' ')[0] : np.name;
      speak(c, np, x, x.mood >= 1 ? `${nm}. Good name. ${meName === np.name ? `I'm ${meName}` : `${meName}`}, if nobody's told you.` : x.mood <= -1 ? `${nm}. I'll try to remember. No promises.` : `${nm}. Right you are.`, { name: false });
      if (!m.claims.from && next(c.rng) < 0.5) { sy(c, np, q(`And where are you from, ${nm}?`)); m.asked = 'origin'; }
      return;
    }
    case 'origin': {
      const id = cl.ent && townById(cl.ent) ? cl.ent : null;
      m.claims.from = id ?? cl.v;
      if (!id) { speak(c, np, x, `${cap(cl.v)}? Never been. ${pick(c.rng, ['Is it far?', 'What\'s it like?', 'Good people there?'])}`); return; }
      const nm = townById(id)!.name;
      if (id === p.from) { m.disposition += 1; speak(c, np, x, `${nm}? Me too! ${pick(c.rng, ['Which end?', 'Small world.', 'Is the old baker still there?'])} Well, well.`, { beat: 0.7 }); return; }
      if (id === hereTown(c)) { speak(c, np, x, `A local! ${x.mood >= 0 ? 'Thought I\'d seen your face.' : 'Funny, I don\'t remember you.'}`); return; }
      const st = stanceOn(id, p, x.k);
      const f = knownFact(c, np, id);
      speak(c, np, x, `${nm}. ${opinionLine(id, nm, st, (a) => pick(c.rng, a))}${f ? ` ${f}` : ''}`);
      return;
    }
    case 'trade': {
      const w = cl.v;
      m.claims.trade = w;
      if (cl.ent && townById(cl.ent)) m.claims.from = cl.ent;
      const vet = x.k?.trades.includes('veteran') || x.k?.trades.includes('soldier');
      const T: [RegExp, string[]][] = [
        [/soldier|fighter|mercenary|sellsword|warrior|guard|knight|veteran/, vet ? ['Another one. Sit. We\'re a dying breed, us.', 'Then you know how to keep your back to a wall. Good.'] : ['There\'s work for a sword on the board.', 'A sword. Good. These days we need them.']],
        [/wizard|mage|sorcer|warlock|witch/, stanceOn('magic', p, x.k) < 0 ? ['Don\'t set anything on fire.', 'Magic. Lovely. Keep it in your pockets in here.'] : ['A real one? Do something. Go on. Something small.', 'Useful. The dead don\'t like fire.']],
        [/priest|cleric|paladin|monk/, p.piety >= 1 ? ['Bless this place while you\'re here. It could use it.', 'The gods sent you, then. About time.'] : ['A holy type. We could use one. The dead are walking.']],
        [/thief|rogue|burglar|pickpocket|smuggler|assassin/, x.k?.trades.includes('watch') ? ['Funny thing to tell a watchman.', 'I\'ll remember you said that.'] : ['Said with a straight face, too. Hands where I can see them.', 'Honest about being dishonest. I almost like it.']],
        [/bard|musician|singer|minstrel|performer|poet/, ['Then sing something. Earn your supper.', 'A bard! Lie to me about somewhere nice.']],
        [/druid|ranger|hunter|tracker/, ['The woods are getting strange. You\'ll have noticed.', 'Hetch in Breda buys pelts, if you\'re hunting.']],
        [/merchant|trader|peddler/, ['Competition. Wonderful.', 'Buying or selling? Everyone\'s doing one.']],
        [/adventurer|hero|treasure hunter|explorer|sword for hire/, ['Then you\'ll want the notice board and a good pair of boots.', 'Adventurer. That\'s what we used to call people who got killed.']],
        [/farmer|shepherd|labourer|laborer|miner|smith/, ['Honest work. Not many left who do it.', 'Good. Somebody has to.']],
      ];
      const hit = T.find(([re]) => re.test(w));
      const line = hit ? pick(c.rng, hit[1]) : `${cap(w)}, eh? ${pick(c.rng, ['We get all sorts.', 'Don\'t get many of those through here.', 'Well, try not to get killed.'])}`;
      const from = cl.ent && townById(cl.ent) ? ` ${townById(cl.ent)!.name}, too. ${cl.ent === p.from ? 'Same as me!' : stanceOn(cl.ent, p, x.k) < 0 ? 'Can\'t be helped.' : 'Good place.'}` : '';
      if (/thief|rogue|burglar|pickpocket|smuggler|assassin/.test(w)) m.disposition -= p.suspicion >= 1 ? 0.5 : 0;
      if (vet && /soldier|veteran|mercenary/.test(w)) m.disposition += 0.5;
      speak(c, np, x, line + from);
      return;
    }
    case 'new': {
      m.claims.new = '1';
      if (own) { sy(c, np, pick(c.rng, own)); return; }
      const tip = pick(c.rng, ['Board in the square has work.', 'Rooms are twenty copper, floor\'s five.', `${tn?.id === 'brumandell' ? 'Grog\'s chowder. Trust me.' : 'Don\'t drink the water, drink the ale.'}`, 'Travel by day. That\'s the main thing these days.']);
      speak(c, np, x, `${x.mood >= 0 ? `Welcome to ${tn?.name ?? 'town'}, then.` : 'Thought so.'} ${tip} ${!m.claims.name ? 'What do I call you?' : ''}`.trim());
      if (!m.claims.name) m.asked = 'name';
      return;
    }
    case 'fought': {
      m.claims.fought = cl.v;
      if (own) { sy(c, np, pick(c.rng, own)); m.disposition += 1; return; }
      const vet = x.k?.trades.includes('veteran') || x.k?.trades.includes('soldier');
      const gm = cl.ent === 'greymarch';
      const line = vet
        ? (gm ? 'Greymarch. Gods. I lost friends on that field. Sit down. This one\'s mine.' : `Then we\'re the same kind of tired. ${p.war}`)
        : (gm ? `Greymarch? ${pick(c.rng, ['People don\'t say that name lightly.', 'Then you saw the worst of it. I\'m sorry.'])}` : pick(c.rng, ['Then you\'ve earned a quiet drink. Nobody\'ll bother you here.', 'Fifteen years, and the ones who were there still sit facing the door. You too?']));
      m.disposition += vet ? 1 : 0.5;
      speak(c, np, x, line, { beat: 0 });
      return;
    }
    case 'lost': {
      m.claims.lost = cl.v;
      if (own) { sy(c, np, pick(c.rng, own)); m.disposition += 1; return; }
      const war = /war|greymarch|battle|front/.test(t) || cl.ent === 'war' || cl.ent === 'greymarch';
      const soft = x.p.warmth >= 0 ? `${np.name} is quiet for a moment.` : `${np.name} nods slowly.`;
      const line = war ? pick(c.rng, ['Most of us lost someone. It doesn\'t make yours any smaller. I\'m sorry.', 'Then you know why nobody talks about it. I\'m sorry for your loss.']) : pick(c.rng, [`Your ${cl.v}. I\'m sorry. Truly.`, 'That doesn\'t heal. You just carry it better.']);
      const warn = stanceOn('cult', x.p, x.k) < 0 && next(c.rng) < 0.6 ? ' And listen: if someone offers you a green candle to see them again, walk away. That\'s how they get you.' : '';
      nar(c, np, soft);
      speak(c, np, x, line + warn, { beat: 0 });
      m.disposition += 0.5;
      return;
    }
    case 'killed': {
      const v = cl.v;
      const bell = cl.ent && ['bells', 'old_chapel', 'merah'].includes(cl.ent) || /bell|chapel|merah|woman in the tower/.test(v);
      if (bell) {
        if (c.flag('chapel_done') || c.flag('bell_silenced')) { if (own) sy(c, np, pick(c.rng, own)); else speak(c, np, x, 'We heard. The whole village slept last night for the first time in weeks. Thank you.', { beat: 0.8 }); m.disposition += 1; }
        else { speak(c, np, x, x.p.suspicion >= 1 ? 'Funny. I heard it ring last night.' : 'Did you? Then why did I hear it last night?', { beat: 0.7 }); m.disposition -= 0.5; }
        return;
      }
      const big = /dragon|wyrm|lich|queen|giant|troll|army/.test(v);
      const kills = c.s.stats.kills;
      if (big && kills < 10) { speak(c, np, x, pick(c.rng, ['Course you did. And I\'m the queen of Suomi.', 'Mm-hm. Was it before or after your third drink?']), { beat: 0.6 }); return; }
      if (/wolf|wolves/.test(v) && np.id === 'hetch') { speak(c, np, x, 'And the pelt? Tell me you kept the pelt.'); return; }
      speak(c, np, x, kills ? pick(c.rng, [`Good. One less ${v.replace(/^(a|an|the|some)\s+/, '')} in the world.`, 'Then you\'re handier than you look.', 'Was it hard? You don\'t look scratched.']) : pick(c.rng, ['If you say so.', 'Hm. Not a scratch on you.']), { beat: 0.4 });
      if (kills) m.disposition += 0.5;
      return;
    }
    case 'looking': {
      m.claims.looking = cl.v;
      const id = cl.ent;
      if (id && ['pale_queen', 'vessariel'].includes(id)) { speak(c, np, x, x.p.bravery >= 1.5 ? 'Then you\'re braver than anyone in this room. Or madder.' : 'Don\'t say that so loud. Not here. Not after dark.', { beat: 0.8 }); return; }
      if (id) {
        const present = h.presentNpcs(c).find((pid) => Lore.knowerFor(pid, townOfRoom)?.entity === id);
        if (present) { speak(c, np, x, `${h.npcName(present)}? ${pick(c.rng, ['Right there.', 'You\'re looking at them. Over there.'])}`); return; }
        const f = knownFact(c, np, id, 'where');
        const dir = Lore.directions(id, hereTown(c));
        speak(c, np, x, `${Lore.ENTITY[id]?.name ?? cap(cl.v)}? ${dir && !/standing in it/.test(dir) ? dir + ' ' : ''}${f ?? 'Can\'t help you more than that.'}`);
        return;
      }
      speak(c, np, x, pick(c.rng, [`Can't say I know of ${cl.v}. Ask at the inn in Galilin; every rumour crosses that ford.`, `${cap(cl.v)}? Not round here. Try the notice board; people post what they've lost.`]));
      return;
    }
    case 'going': {
      const id = cl.ent;
      m.claims.going = id ?? cl.v;
      if (!id) { speak(c, np, x, `${cap(cl.v)}? ${pick(c.rng, ['Safe roads.', 'Travel by day.', 'Take a friend.'])}`); return; }
      const nm = Lore.ENTITY[id]?.name ?? cl.v;
      const dir = Lore.directions(id, hereTown(c));
      const st = stanceOn(id, x.p, x.k);
      speak(c, np, x, `${nm}? ${dir && !/standing in it/.test(dir) ? `${dir} ` : ''}${opinionLine(id, nm, st, (a) => pick(c.rng, a))} ${pick(c.rng, ['Travel by day.', 'Mind the roads after dark.', 'Bring me back something.'])}`);
      return;
    }
    case 'distrust': case 'like': case 'belief': {
      const id = cl.ent;
      if (own) { sy(c, np, pick(c.rng, own)); return; }
      if (!id) { speak(c, np, x, pick(c.rng, ['Maybe. Maybe not.', 'Could be. You\'d know better than me.', `Do you? ${pick(c.rng, ['Why\'s that?', 'What makes you say so?'])}`])); return; }
      const st = stanceOn(id, x.p, x.k);
      const theirs = cl.kind === 'like' ? 1 : cl.kind === 'distrust' ? -1 : /behind|evil|bad|liar|lying|dangerous|wrong|corrupt|rotten|up to something|responsible|hiding/.test(cl.v) ? -1 : /good|right|kind|fair|honest|safe|best/.test(cl.v) ? 1 : 0;
      const nm = Lore.ENTITY[id]?.name ?? cl.v;
      const agree = theirs !== 0 && Math.sign(theirs) === Math.sign(st) && st !== 0;
      const disagree = theirs !== 0 && st !== 0 && Math.sign(theirs) !== Math.sign(st);
      const f = knownFact(c, np, id, cl.v);
      if (agree) { speak(c, np, x, `${pick(c.rng, ['You\'re not wrong.', 'You and me both.', 'Now you\'re talking sense.', 'Keep your voice down, but yes.'])}${f ? ` ${f}` : ''}`, { beat: 0.5 }); m.disposition += 0.5; }
      else if (disagree) { speak(c, np, x, `${pick(c.rng, ['I\'d not say that too loud.', 'I don\'t see it that way.', 'Careful.', 'That\'s not how I\'d put it.'])} ${opinionLine(id, nm, st, (a) => pick(c.rng, a))}`, { beat: 0 }); if (Math.abs(st) >= 1.5) m.disposition -= 0.5; }
      else speak(c, np, x, `${pick(c.rng, ['Maybe.', 'Could be.', 'Hard to say.'])}${f ? ` ${f}` : ''}`);
      return;
    }
    case 'saw': {
      const id = cl.ent;
      const und = /dead|zombie|skeleton|ghoul|corpse|walking|ghost|lantern|candle/.test(cl.v);
      if (und || (id && groupOf(id) === 'undead')) { speak(c, np, x, `${x.p.bravery <= 0 ? 'Gods.' : 'Where?'} ${pick(c.rng, ['How many?', 'Which road?', 'Did it see you?'])} ${knownFact(c, np, id ?? 'undead') ?? ''}`.trim(), { beat: 0.8 }); return; }
      const f = id ? knownFact(c, np, id, cl.v) : null;
      speak(c, np, x, f ? `${pick(c.rng, ['Did you now.', 'Interesting.'])} ${f}` : pick(c.rng, ['Did you now. And?', 'Huh. Where was that?', 'Interesting. Tell me more.']));
      if (!f) m.asked = 'more';
      return;
    }
    case 'feel': {
      const v = cl.v;
      const L: Record<string, string[]> = {
        sad: ['Sit a while. Nobody\'s chasing you in here.', 'It gets easier. That\'s what they tell me, anyway.'], lonely: ['You\'re not alone in here. Look around.', 'Talk, then. I\'m listening.'],
        scared: ['Good. Scared keeps you alive.', 'We all are, these days.'], afraid: ['Good. Afraid keeps you alive.', 'We all are, these days.'],
        happy: ['Good! Somebody should be.', 'Then buy a round and spread it about.'], bored: ['Board in the square will cure that.', 'Bored is a luxury. Enjoy it.'],
        homesick: ['Where\'s home? Tell me about it.', 'The road does that.'], broke: ['There\'s work on the board. And I don\'t do tabs.', 'Join the club.'], rich: ['Then the drinks are on you.', 'Not for long, in this town.'],
        drunk: ['I can tell.', 'Water. Then bed.'], angry: ['Not in here, you\'re not.', 'Take it outside and hit a tree.'], worried: ['About what?', 'Worry\'s free. Everything else costs.'],
      };
      speak(c, np, x, pick(c.rng, L[v] ?? ['Is that so. Well, you\'re here now.', 'That\'s how it goes, some days.']));
      if (v === 'homesick') m.asked = 'origin';
      return;
    }
  }
}

function answerTheirQuestion(c: Ctx, h: Host, np: Npc, x: MC, t: string): boolean {
  const a = x.m.asked;
  x.m.asked = null;
  const v = t.replace(/^(it'?s|i'?m|my name is|my name'?s|call me|from|i'?m from|i come from|just|well|um|uh)\s+/, '').replace(/^(the)\s+/, '').trim();
  if (!v || /^(no|nope|never ?mind|not telling|none of your business|why)\b/.test(t)) { speak(c, np, x, pick(c.rng, ['Suit yourself.', 'Keep your secrets, then.', 'Fair enough.'])); if (x.p.suspicion >= 1.5) x.m.disposition -= 0.5; return true; }
  if (a === 'name' && /^[a-z' -]{2,20}$/.test(v) && v.split(' ').length <= 2) return claim(c, h, np, x, { kind: 'name', v }, t), true;
  if (a === 'origin') { const e = Lore.findEntities(v)[0]; return claim(c, h, np, x, { kind: 'origin', v, ent: e?.id }, t), true; }
  if (a === 'purpose') {
    if (/work|job|coin|money|gold/.test(v)) { speak(c, np, x, 'Then you\'ve come to the right place. Board in the square. Read the small print.'); return true; }
    const e = Lore.findEntities(v)[0];
    if (e) return claim(c, h, np, x, { kind: 'looking', v, ent: e.id }, t), true;
    speak(c, np, x, pick(c.rng, ['Fair enough. Everyone\'s got a reason.', 'Keep your reasons. Just pay your tab.']));
    return true;
  }
  if (a === 'more') { speak(c, np, x, pick(c.rng, ['Hm. I\'ll keep an ear out.', 'Strange days. Thanks for telling me.', 'I\'ll pass that on. Quietly.'])); x.m.disposition += 0.25; return true; }
  return false;
}

export function buyDrinkFor(c: Ctx, np: Npc) { buyDrink(c, np, ctxOf(c, np)); }
function buyDrink(c: Ctx, np: Npc, x: MC) {
  const key = `drink_for_${np.id}_${dayOf(c)}`;
  if (c.flag(key)) { speak(c, np, x, pick(c.rng, ['One\'s plenty, thanks. I\'ve work.', 'Another? You\'ll have me singing.'])); return; }
  if (!c.pay(5)) { speak(c, np, x, 'With what? Your pockets are empty, friend.'); return; }
  c.set(key);
  x.m.disposition += 1; x.m.drinks = (x.m.drinks ?? 0) + 1;
  const keeper = /_keeper$|^squib$/.test(np.id);
  nar(c, np, `You put five copper on the table.${keeper ? '' : ` ${np.name} accepts the drink.`}`);
  speak(c, np, x, keeper ? 'Not on shift. But I\'ll take the thought, and the coin.' : `${pick(c.rng, ['Well, now. Thank you.', 'Generous. I\'ll remember that.', 'Here\'s to you.'])} ${x.p.drink.split('.')[0]}.`, { beat: 0.3 });
  const f = juicyFact(c, np);
  if (f) sy(c, np, `${np.name} leans closer. "${f}"`);
}

function offerHelp(c: Ctx, np: Npc, x: MC) {
  const jobs = (c.s.world?.jobs ?? []).filter((j) => j.town === hereTown(c) && !j.taken && !j.done);
  speak(c, np, x, `${x.mood >= 1 ? 'Kind of you.' : 'Help?'} ${x.p.wants} ${jobs.length ? `Short of that, there's ${jobs.length === 1 ? 'a posting' : 'postings'} on the board: "${jobs[0].title}".` : 'Short of that, keep the peace and pay your tab.'}`);
}

// ---------- when nothing else fits: keep the conversation alive ----------
export function fallback(c: Ctx, h: Host, np: Npc, text: string): boolean {
  if (np.id === 'kettle') return false;
  const x = ctxOf(c, np);
  const m = x.m; m.claims ??= {};
  const tn = townById(hereTown(c) ?? '');
  if (x.mood <= -2) { speak(c, np, x, pick(c.rng, ['Are we done?', 'I\'ve nothing to say to you.', 'Go and bother somebody else.']), { beat: 0.8 }); return true; }
  // pick up any name they mentioned
  const ent = Lore.findEntities(text)[0];
  if (ent) {
    const f = knownFact(c, np, ent.id, text);
    if (f) { speak(c, np, x, `${Lore.ENTITY[ent.id].name}? ${f}`); c.set('lore_focus', ent.id); return true; }
  }
  // ask them something back
  const qs: [string, string][] = [];
  if (!m.claims.name) qs.push(['name', pick(c.rng, ['I didn\'t catch your name.', 'And who might you be?', 'What do I call you?'])]);
  if (!m.claims.from) qs.push(['origin', pick(c.rng, ['Where are you from, anyway?', 'You\'re not from round here. Where\'s home?'])]);
  if (!m.claims.purpose) qs.push(['purpose', `What brings you to ${tn?.name ?? 'these parts'}?`]);
  const reacts = x.mood >= 1 ? ['Ha. Go on.', 'You\'re an odd one. I like that.', 'Hm. I\'ll think on that.'] : ['Hm.', 'If you say so.', 'Strange thing to say.', 'Right.'];
  if (qs.length && next(c.rng) < 0.75) {
    const [k, line] = pick(c.rng, qs);
    m.asked = k;
    if (k === 'purpose') m.claims.purpose = '?';
    speak(c, np, x, `${pick(c.rng, reacts)} ${line}`);
    return true;
  }
  // share something of their own
  const own = pick(c.rng, [x.p.wants, x.p.fears && `Know what keeps me up? ${x.p.fears}`, x.p.family].filter(Boolean) as string[]);
  speak(c, np, x, `${pick(c.rng, reacts)} ${own}`);
  return true;
}

// ---------- noticing what's happening ----------
/** A first reaction to something about you or the moment, once per day per person. */
export function beat(c: Ctx, h: Host, np: Npc): void {
  if (np.id === 'kettle') return;
  const x = ctxOf(c, np);
  const m = x.m; m.noticed ??= [];
  const day = dayOf(c);
  const once = (key: string) => { const k = `${key}:${day}`; if (m.noticed!.includes(k)) return false; m.noticed!.push(k); if (m.noticed!.length > 20) m.noticed!.splice(0, m.noticed!.length - 20); return true; };
  const pc = c.pc;
  const n = np.name.replace(/^the /, 'The ');
  const pr = PRON(x.p);
  const lastFight = (c.flag('last_fight') as string) || '';
  const [fl, fm] = lastFight.split('@');
  if (fl === c.s.loc && c.s.minutes - Number(fm) < 120 && once('fight')) {
    nar(c, np, x.p.bravery <= 0 ? `${n} flinches when you come close. ${cap(pr.s)} saw the fight.` : x.mood >= 1 ? `${n} looks you up and down. "That was something. You're not hurt?"` : `${n} watches your hands. After what ${pr.s} just saw, ${pr.s}'s not taking chances.`);
    return;
  }
  if (pc.hp <= pc.maxHp / 2 && once('hurt')) {
    nar(c, np, x.p.warmth >= 1 ? `${n}'s eyes go to the blood on you. "Sit down before you fall down. ${/_keeper$|^squib$/.test(np.id) ? 'Water\'s free.' : 'There\'s a healer in town.'}"` : x.p.suspicion >= 1 ? `${n} looks at the blood on your clothes, then at the door. "Whose is that?"` : `${n} notices the blood. ${cap(pr.s)} doesn't ask.`);
    return;
  }
  if (c.hasCompanion('alistair') && h.presentNpcs(c).includes('alistair') && np.id !== 'alistair' && !c.flag(`seen_alistair_${np.id}`)) {
    c.set(`seen_alistair_${np.id}`);
    nar(c, np, x.p.bravery >= 1.5 ? `${n} looks at Alistair, then at you. "Your friend's missing some skin." That's all.` : x.p.bravery <= 0 ? `${n} goes white at the sight of Alistair and backs up until ${pr.s} hits the wall.` : `${n} stares at Alistair. Alistair waves. ${n} does not wave back.`);
    if (x.p.bravery <= 0) m.disposition -= 0.5;
    return;
  }
  if (pc.drunk >= 4 && once('drunk')) { nar(c, np, x.p.humour >= 1 ? `${n} grins at the state of you. "Somebody's had a good night."` : `${n} wrinkles ${pr.ps} nose. "You've had enough."`); return; }
  if (!m.met && once('stranger')) {
    const people = (c.pc.species ?? '').toLowerCase();
    const grp = /orc/.test(people) ? 'orcs' : /goblin/.test(people) ? 'goblins' : /tiefling/.test(people) ? 'tieflings' : /elf/.test(people) ? 'elves' : /dwarf/.test(people) ? 'dwarves_folk' : null;
    if (grp && stanceOn(grp, x.p, x.k) <= -1) { nar(c, np, `${n} gives you a longer look than ${pr.s} gives most people. It isn't friendly.`); m.disposition -= 0.5; return; }
    if ((c.flag('chapel_done') || (c.s.world?.renown ?? 0) >= 8) && once('famous')) { nar(c, np, `${n} recognises you. "You're the one everyone's talking about."`); m.disposition += 0.5; return; }
  }
  const h0 = c.hour();
  if ((h0 >= 23 || h0 < 4) && /_keeper$|^squib$/.test(np.id) && once('late')) { nar(c, np, `${n} stifles a yawn. "Last orders were an hour ago. What'll it be?"`); return; }
}

// ---------- insight: reading a person ----------
export function read(c: Ctx, h: Host, np: Npc, ok: boolean, focus: 'lie' | 'mood' | 'want'): void {
  const x = ctxOf(c, np);
  const n = np.name.replace(/^the /, 'The ');
  const pr = PRON(x.p);
  if (!ok) { nar(c, np, pick(c.rng, [`${n} gives nothing away. Or you're not reading it.`, `You study ${np.name}. ${cap(pr.s)} catches you at it.`, `If ${np.name} is feeling anything, you can't tell what.`])); if (next(c.rng) < 0.4) x.m.disposition -= 0.25; return; }
  const mw = moodWord(x.mood);
  const feel = { hostile: `${cap(pr.s)} doesn't like you, and isn't trying hard to hide it.`, wary: `${cap(pr.s)}'s wary of you: polite, but watching.`, neutral: `${cap(pr.s)}'s neither for you nor against you. Yet.`, friendly: `${cap(pr.s)} likes you, more than ${pr.s} lets on.`, warm: `${cap(pr.s)} trusts you. That's rare, and you can see it.` }[mw];
  const ev = x.m.evasive;
  const lie = ev ? `When you mentioned ${Lore.ENTITY[ev]?.name ?? ev}, something closed in ${pr.ps} face. There's a story there ${pr.s} isn't telling.` : x.k?.avoids?.length ? `There's something ${pr.s} won't talk about. You'd guess it's to do with ${Lore.ENTITY[x.k.avoids[0]]?.name ?? 'the past'}.` : `As far as you can tell, ${pr.s}'s been straight with you.`;
  const want = `What ${pr.s} wants, underneath: ${x.p.wants.replace(/^"|"$/g, '')} What ${pr.s}'s afraid of: ${x.p.fears.replace(/^"|"$/g, '')}`;
  nar(c, np, focus === 'lie' ? `${lie} ${feel}` : focus === 'want' ? `${want}` : `${feel} ${next(c.rng) < 0.5 ? lie : ''}`.trim());
}

/** How hard it is to read, fool or frighten this person. */
export function dcFor(c: Ctx, np: Npc, kind: 'insight' | 'intimidate' | 'notice' | 'persuade'): number {
  const x = ctxOf(c, np);
  const base = { insight: 12, intimidate: 12, notice: 11, persuade: 12 }[kind];
  const named: Record<string, number> = { squib: 4, sereza: 5, hetch: 3, alistair: 2, dwarves: 1, whisperers: 2, merah: 3, brumandell_keeper: 2 };
  let dc = base + (named[np.id] ?? 0);
  if (kind === 'insight') dc += x.p.suspicion >= 1.5 ? 2 : 0;
  if (kind === 'intimidate') dc += Math.round(x.p.bravery * 2) - (x.mood <= -1 ? 0 : 0);
  if (kind === 'notice') dc += Math.round(x.p.suspicion);
  if (kind === 'persuade') dc -= Math.round(x.mood);
  return Math.max(5, Math.min(25, dc));
}

/** How someone reacts when you scare them, by temperament. */
export function intimidated(c: Ctx, h: Host, np: Npc, ok: boolean, how: string): void {
  const x = ctxOf(c, np);
  const n = np.name.replace(/^the /, 'The ');
  const pr = PRON(x.p);
  x.m.disposition -= 1;
  if (ok) {
    nar(c, np, x.p.bravery >= 1.5 ? `${n} holds your stare for a long moment, then gives the smallest nod. "All right. You've made your point."` : x.p.bravery <= 0 ? `${n} goes pale and steps back. "All right! All right. What do you want?"` : `${n} swallows. ${cap(pr.s)} looks away first.`);
    const f = juicyFact(c, np);
    if (f) sy(c, np, q(`${x.p.bravery <= 0 ? 'Here, take it — ' : ''}${f}`));
    x.m.evasive = null;
  } else {
    nar(c, np, x.p.temper >= 1 ? `${n} laughs in your face. "${pick(c.rng, ['Is that meant to frighten me?', 'You\'ll have to do better than that.', 'Try it, and see what happens.'])}"` : `${n} looks at you, unimpressed. "${pick(c.rng, ['Are you finished?', 'Was that a threat? It was hard to tell.', 'Go home.'])}"`);
    x.m.disposition -= 0.5;
    if (np.id === 'squib' || (x.p.temper >= 1.5 && x.m.disposition <= -3)) { sy(c, np, q(np.id === 'squib' ? 'House rules are on the wall. Read them again.' : 'One more word and we settle this outside.')); }
  }
  void how;
}

export const _test = { claimOf, hash, TOWNS };

// ---------- persuasion and lies, with real outcomes ----------
/** What you were trying to get out of them. */
export function goalOf(text: string): 'drink' | 'discount' | 'info' | 'join' | 'claim' | 'leave' | 'calm' | 'other' {
  const t = text.toLowerCase();
  if (/\b(free|on the house)\b.*\b(drink|ale|beer|pint|round|meal|food|stew|room)\b|\b(drink|ale|beer|pint|round|meal|room)\b.*\b(free|on the house|for nothing)\b/.test(t)) return 'drink';
  if (/\b(discount|cheaper|lower (the|his|her|their) price|knock .* off|better price|deal|haggle|bargain)\b/.test(t)) return 'discount';
  if (/\b(tell me|talk|share|what (he|she|they) knows?|secret|information|info|the truth|spill|explain)\b/.test(t)) return 'info';
  if (/\b(join|come with|travel with|help me|fight (with|for)|follow me)\b/.test(t)) return 'join';
  if (/\b(i am|i'?m|that i am|that i'?m|say i am|say i'?m|pretend|claim)\b/.test(t)) return 'claim';
  if (/\b(leave|go away|back off|let (me|us) (go|pass|through|in))\b/.test(t)) return 'leave';
  if (/\b(calm|relax|stand down|put (it|that|the \w+) down|stop)\b/.test(t)) return 'calm';
  return 'other';
}

export function persuaded(c: Ctx, h: Host, np: Npc, skill: 'persuasion' | 'deception', ok: boolean, text: string): void {
  const x = ctxOf(c, np);
  const n = np.name.replace(/^the /, 'The ');
  const pr = PRON(x.p);
  const g = goalOf(text);
  const lie = skill === 'deception';
  if (!ok) {
    x.m.disposition -= lie ? 1 : 0.5;
    if (lie) x.m.claims = { ...(x.m.claims ?? {}), liar: '1' };
    nar(c, np, lie
      ? pick(c.rng, [`${n} looks at you for a long moment. "No," ${pr.s} says. "Try the truth next time."`, `${n} laughs, not kindly. "Pull the other one."`, `${n}'s eyes narrow. ${cap(pr.s)} doesn't believe a word, and now ${pr.s}'s wondering why you'd lie.`])
      : pick(c.rng, [`${n} hears you out, then shakes ${pr.ps} head. "No."`, `${n} isn't moved. "Nice try."`, `"${g === 'drink' ? 'Coin first. Then ale. That\'s how it works.' : g === 'discount' ? 'Prices are prices.' : g === 'join' ? 'Not a chance.' : 'Ask me again when I know you better.'}"`]));
    return;
  }
  x.m.disposition += lie ? 0.5 : 1;
  switch (g) {
    case 'drink': c.give('ale'); nar(c, np, `${n} sighs, then slides a mug across. "${pick(c.rng, ['On the house. This once.', 'Don\'t tell anyone.', 'You\'ve a silver tongue. Drink up.'])}"`); return;
    case 'discount': c.set(`discount_${np.id}`); nar(c, np, `${n} rubs ${pr.ps} jaw. "Fine. A bit off, for you. Don't spread it around."`); return;
    case 'info': { const f = juicyFact(c, np); nar(c, np, `${n} glances around, then lowers ${pr.ps} voice.`); sy(c, np, q(f ?? x.p.fears)); return; }
    case 'join': nar(c, np, `${n} actually considers it. "${pick(c.rng, ['I\'ve got a living here. But if you\'re ever in real trouble, come find me.', 'Not today. Ask me again when the bell stops.'])}"`); return;
    case 'claim': {
      const m = text.toLowerCase().match(/\b(?:i am|i'?m|that i am|that i'?m)\s+(?:a |an |the )?([a-z' -]{3,30})/);
      const what = m ? m[1].replace(/\s+(and|so|but)\b.*$/, '').trim() : 'someone important';
      x.m.claims = { ...(x.m.claims ?? {}), trade: what };
      const crown = /crown|queen|agent|watch|official|inspector|tax/.test(what);
      nar(c, np, crown ? `${n} straightens up. "${cap(what)}. Of course. ${x.m.claims?.distrust_crown ? 'I didn\'t mean anything by what I said earlier.' : 'Anything you need.'}"` : `${n} takes you at your word. "${cap(what)}? Well, well."`);
      if (crown) x.m.disposition += 0.5;
      return;
    }
    case 'leave': nar(c, np, `${n} steps aside. "${pick(c.rng, ['Go on, then.', 'Fine. Quickly.'])}"`); return;
    case 'calm': nar(c, np, `${n} lets out a breath. The tension goes out of ${pr.ps} shoulders.`); x.m.insults = Math.max(0, x.m.insults - 1); return;
    default: nar(c, np, pick(c.rng, [`${n} comes round. "All right. You make a fair point."`, `${n} warms to you, despite ${pr.o}self.`, `${n} nods slowly. You've won ${pr.o} over, for now.`]));
  }
}

// ---------- asking the whole room ----------
/** "I ask around about the bells": a few people answer, each in their own way. */
export function askRoom(c: Ctx, h: Host, text: string, spawn: (role: string) => Npc | null, npcs: Record<string, Npc>): void {
  const t = text.toLowerCase();
  let ppl = h.presentNpcs(c).filter((id) => id !== 'kettle' && id !== 'alistair').map((id) => npcs[id]).filter(Boolean) as Npc[];
  if (ppl.filter((np) => np.id.startsWith('x:')).length < 2) for (const r of ['patron', 'old man', 'traveller']) { if (ppl.length >= 4) break; const x = spawn(r); if (x && !ppl.includes(x)) ppl.push(x); }
  ppl = ppl.sort(() => next(c.rng) - 0.5).slice(0, 3);
  if (!ppl.length) { c.narr('There\'s nobody here to ask.'); return; }
  const ent = Lore.findEntities(text)[0]?.id ?? (/dead|walk|zombie|ghoul|skeleton|grave/.test(t) ? 'undead' : /bell/.test(t) ? 'bells' : null);
  const hire = /\b(hire|hiring|work|job|sword for hire|need (a )?(sword|guard|hand))\b/.test(t);
  c.narr(pick(c.rng, ['You raise your voice so the room can hear.', 'You go from table to table.', 'You ask, loud enough to carry.']));
  let said = 0;
  ROUND = new Set();
  for (const np of ppl) {
    const x = ctxOf(c, np);
    if (x.mood <= -2) { sy(c, np, `${np.name} turns ${PRON(x.p).ps} back on you.`); continue; }
    let line: string | null = null;
    if (hire) {
      const jobs = (c.s.world?.jobs ?? []).filter((j) => j.town === hereTown(c) && !j.taken && !j.done);
      line = said === 0 && jobs.length ? `Board outside has "${jobs[0].title}". Pays ${Math.round(jobs[0].reward / 100)} gold.` : said === 0 && hereTown(c) === 'breda' ? 'Fenwick Tealeaf\'s been asking for cart guards to Rastbrook. Five gold, paid on arrival.' : pick(c.rng, ['Not me. Can barely pay my tab.', 'Ask the innkeeper. Knows everyone who\'s hiring.', 'If I had coin for a sword, I wouldn\'t be drinking here.']);
    } else if (ent) line = knownFact(c, np, ent, text);
    if (!line) line = said ? pick(c.rng, ['Don\'t look at me.', 'No idea, friend.', 'Ask someone sober.', `${x.p.bravery <= 0 ? 'I don\'t want to know.' : 'Heard nothing worth repeating.'}`]) : juicyFact(c, np) ?? 'Nothing you\'d want to hear.';
    speak(c, np, x, line, { beat: 0.3 });
    said += 1;
  }
  ROUND = null;
  if (ent) c.set('lore_focus', ent);
  c.advance(10);
}
