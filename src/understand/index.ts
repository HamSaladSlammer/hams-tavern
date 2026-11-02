// Phase 2: understanding what was said, in the context of the conversation so far.
// Cleans up how people actually type (slang, typos, several sentences at once), keeps track of
// what's being talked about, and turns follow-ups ("and Largo?", "where is he?", "why?") into
// questions the rest of the game master already knows how to answer.
import { ENTITIES } from '../lore/entities';
import { FACTS } from '../lore';

// ---------- the conversation so far ----------
export interface Focus { id: string; by: 'you' | 'them'; turn: number }
export interface Talk {
  with: string | null; // who you're talking to
  focus: Focus[]; // what's being talked about, most recent first
  lastFact: string | null; // the last thing they told you (a lore fact id)
  lastEntity: string | null; // what their last answer was about
  turns: number;
  heard: string[]; // what you've said lately, normalised, for noticing repeats
}
export const newTalk = (): Talk => ({ with: null, focus: [], lastFact: null, lastEntity: null, turns: 0, heard: [] });

export function noteFocus(t: Talk, id: string | null | undefined, by: 'you' | 'them') {
  if (!id) return;
  t.focus = [{ id, by, turn: t.turns }, ...t.focus.filter((f) => f.id !== id)].slice(0, 8);
}

// ---------- how people type ----------
const SLANG: [RegExp, string][] = [
  [/\bwhats\b/g, "what's"], [/\bwheres\b/g, "where's"], [/\bwhos\b/g, "who's"], [/\bhows\b/g, "how's"], [/\bthats\b/g, "that's"], [/\btheres\b/g, "there's"],
  [/\bim\b/g, "i'm"], [/\bive\b/g, "i've"], [/\bdont\b/g, "don't"], [/\bdoesnt\b/g, "doesn't"], [/\bdidnt\b/g, "didn't"], [/\bcant\b/g, "can't"], [/\bwont\b/g, "won't"],
  [/\bisnt\b/g, "isn't"], [/\barent\b/g, "aren't"], [/\bwasnt\b/g, "wasn't"], [/\bwouldnt\b/g, "wouldn't"], [/\bcouldnt\b/g, "couldn't"], [/\bshouldnt\b/g, "shouldn't"],
  [/\byoure\b/g, "you're"], [/\btheyre\b/g, "they're"], [/\bhes\b/g, "he's"], [/\bshes\b/g, "she's"],
  [/\bu\b/g, 'you'], [/\bya\b/g, 'you'], [/\bye\b(?! olde)/g, 'you'], [/\bur\b/g, 'your'], [/\byr\b/g, 'your'], [/\br\b/g, 'are'], [/\bn\b/g, 'and'],
  [/\bwanna\b/g, 'want to'], [/\bgonna\b/g, 'going to'], [/\bgotta\b/g, 'got to'], [/\bdunno\b/g, "don't know"], [/\bkinda\b/g, 'kind of'], [/\bsorta\b/g, 'sort of'], [/\blemme\b/g, 'let me'], [/\bgimme\b/g, 'give me'],
  [/\bpls\b|\bplz\b/g, 'please'], [/\bthx\b|\bty\b|\btnx\b/g, 'thanks'], [/\babt\b/g, 'about'], [/\bbc\b|\bcuz\b|\bcoz\b|\bcos\b/g, 'because'], [/\bppl\b/g, 'people'], [/\bsth\b/g, 'something'],
  [/\bk\b|\bkk\b/g, 'okay'], [/\bnvm\b/g, 'never mind'], [/\bidk\b/g, "i don't know"], [/\btho\b/g, 'though'], [/\bw\/\b/g, 'with'], [/\bwat\b/g, 'what'], [/\bwut\b/g, 'what'], [/\bwher\b/g, 'where'],
];
/** Lower-case and expand texting shorthand. Keeps punctuation that carries meaning (?). */
export function normalise(text: string): string {
  let t = ` ${text.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()} `;
  for (const [re, to] of SLANG) t = t.replace(re, to);
  return t.trim();
}

// ---------- typos in names ----------
let NAMES: Set<string> | null = null; // words that are names we might want to correct to
let KNOWN: Set<string> | null = null; // words we know are real (so we never "correct" them)
const COMMON = 'about above after again against all also always and another any anyone anything are around ask asked away back bad be because been before being best better between big both bring but buy by call came can come could day did do does done down drink each eat else even ever every far feel few find first for friend from get give go going good got great had has have he hear heard help her here him his home how i if in into is it its just keep kind know last leave left let like little live long look lot made make man many may me mean might more most much must my name near need never new next night no not nothing now of off old on once one only or other our out over own people place please put quite rather real really right road room said same saw say see seen she should show side since so some someone something still such sure take talk tell than thank that the their them then there these they thing think this those though thought through time to today told too took town true try two under until up us use very want was way we well went were what when where which while who why will with without woman word work world would year yes yet you young your'.split(' ');
function vocab() {
  if (NAMES && KNOWN) return;
  NAMES = new Set(); KNOWN = new Set(COMMON);
  for (const e of ENTITIES) for (const a of [e.name, ...e.aliases]) for (const w of a.toLowerCase().split(/[^a-z']+/)) if (w.length >= 4) NAMES.add(w);
  for (const f of FACTS) for (const w of f.text.toLowerCase().split(/[^a-z]+/)) if (w.length >= 3) KNOWN.add(w);
}
/** Damerau-Levenshtein distance, capped. */
function dist(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
/** Fix misspelt names ("greymarsh", "thimbelton") without touching ordinary words. */
export function fixTypos(text: string, extraNames: string[] = []): string {
  vocab();
  const names = new Set([...NAMES!, ...extraNames.flatMap((n) => n.toLowerCase().split(/\s+/)).filter((w) => w.length >= 4)]);
  return text.replace(/[a-z']{6,}/g, (w) => {
    if (names.has(w) || KNOWN!.has(w) || KNOWN!.has(w.replace(/s$/, ''))) return w;
    const cap = w.length >= 7 ? 2 : 1;
    let best: string | null = null, bd = cap + 1;
    for (const n of names) {
      if (n[0] !== w[0] && !(w.length >= 7 && n[1] === w[1])) continue;
      const dd = dist(w, n, cap);
      if (dd < bd) { bd = dd; best = n; }
    }
    return best && bd <= cap ? best : w;
  });
}

// ---------- several sentences at once ----------
/** "Hi Squib. I'm Vera. What do you know about the bell?" → three things to answer. */
export function clauses(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=\S)|\s*;\s*/).map((p) => p.trim()).filter(Boolean);
  // glue tiny fragments ("Oh." "Right.") onto what follows
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && /^(oh|ah|hm+|well|right|okay|ok|so|um|uh|huh|yes|no)[.!,]?$/i.test(out[out.length - 1])) out[out.length - 1] = `${out[out.length - 1]} ${p}`;
    else out.push(p);
  }
  return out.slice(0, 4);
}
export const isGreeting = (t: string) => /^(hello|hi|hey|hiya|howdy|greetings|good (morning|evening|afternoon|day)|yo|sup|what'?s up|evening|morning|oi|ahoy)\b[^?]*$/i.test(t.trim()) && t.trim().split(/\s+/).length <= 4;

// ---------- pronouns and follow-ups ----------
const PERSONAL = /\b(he|him|she|her|they|them|it|there|that place|this place|that one|this one)\b/;
const ENTITY_BY_ID = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));
const genderOf = (id: string): 'he' | 'she' | 'they' | 'it' => {
  const e = ENTITY_BY_ID[id];
  if (!e) return 'it';
  if (e.pronoun) return e.pronoun;
  return e.kind === 'person' ? 'they' : e.kind === 'faction' ? 'they' : 'it';
};
const nameOf = (id: string) => ENTITY_BY_ID[id]?.name ?? id;
/** Which focus a pronoun points at. */
export function referent(pron: string, t: Talk): string | null {
  const want = /^(he|him)$/.test(pron) ? ['he', 'they'] : /^(she|her)$/.test(pron) ? ['she', 'they'] : /^(they|them)$/.test(pron) ? ['they', 'he', 'she', 'it'] : ['it'];
  const isPlace = /^(there|that place|this place)$/.test(pron);
  for (const f of t.focus) {
    const e = ENTITY_BY_ID[f.id];
    if (!e) continue;
    if (isPlace) { if (['town', 'place', 'region'].includes(e.kind)) return f.id; continue; }
    if (want.includes(genderOf(f.id))) return f.id;
  }
  return null;
}
// "it" that doesn't point at anything ("is it safe?", "it's late")
const DUMMY_IT = /\bit(?:'s| is| was)? (?:safe|raining|snowing|true|late|early|time|okay|ok|possible|worth|cold|warm|hot|busy|quiet|dangerous|going|fine|me|you|over|done|said|known|getting)\b|\bit's\b|\bmake it\b|\bdo it\b|\bget it\b|\bforget it\b|\bthat's it\b|\bwhat is it\b|\bnever mind it\b/;

/**
 * Rewrite a follow-up into a full question, using what's being talked about.
 * Returns the rewritten text (or the original) and the entity it settled on.
 */
export function resolve(text: string, t: Talk): { text: string; about: string | null; kind: 'as-is' | 'pronoun' | 'ellipsis' } {
  const s = text.trim();
  const low = s.toLowerCase();
  // ellipsis: "and Largo?", "what about the dwarves?", "how about Coltale?", "Coltale?"
  const el = s.match(/^(?:and|what about|how about|and what about|what of|and how about|same for|and the same for)\s+(.+?)[?.!]*$/i);
  if (el) {
    const target = el[1].toLowerCase().replace(/^(the|a|an)\s+/, '');
    if (/^(you|yourself|u)$/.test(target)) return { text: lastQuestionAbout(t, 'you'), about: null, kind: 'ellipsis' };
    const m = PERSONAL.exec(target);
    const id = m ? referent(m[1], t) : null;
    return { text: `tell me about ${id ? nameOf(id) : el[1]}`, about: id, kind: 'ellipsis' };
  }
  if (!t.focus.length) return { text: s, about: null, kind: 'as-is' };
  // pronouns: only in questions and opinions, never in "they say" or dummy "it"
  const asking = /\?$/.test(s) || /^(who|what|where|when|why|how|is|are|was|were|does|do|did|can|could|have|has|tell|what do you think|do you know|have you)\b/.test(low);
  if (!asking) return { text: s, about: null, kind: 'as-is' };
  let about: string | null = null;
  let out = s;
  const swap = (re: RegExp, pron: string, keep?: (m: string) => string) => {
    out = out.replace(re, (m0) => {
      if (about && about !== referent(pron, t)) return m0;
      const id = referent(pron, t);
      if (!id) return m0;
      about = id;
      return keep ? keep(nameOf(id)) : nameOf(id);
    });
  };
  if (!/\bthey say\b|\bthey said\b|\bthey reckon\b/i.test(out)) {
    swap(/\b(?:him|he)\b(?!'s)/gi, 'he');
    swap(/\bhe's\b/gi, 'he', (n) => `${n} is`);
    swap(/\b(?:she)\b(?!'s)/gi, 'she');
    swap(/\bshe's\b/gi, 'she', (n) => `${n} is`);
    swap(/\bher\b(?=\s*[?.!]?$)|(?<=\b(?:of|about|think of|seen|met|find|meet|know|trust|like|is|with)\s)her\b/gi, 'her');
    swap(/(?<=\b(?:of|about|think of|seen|met|find|meet|know|trust|like|with)\s)them\b|\bthem\b(?=\s*[?.!]?$)/gi, 'them');
    swap(/^(?:are|were|do|did|have)\s+they\b|(?<=\bwhere (?:are|were|do|did)\s)they\b|(?<=\bwho (?:are|were)\s)they\b|(?<=\bwhat do\s)they\b/gi, 'they');
  }
  if (!DUMMY_IT.test(out.toLowerCase())) swap(/(?<=\b(?:is|was|about|of|find|reach|get to|visit|see|seen|heard of|know|does|did)\s)it\b|\bit\b(?=\s*[?.!]?$)/gi, 'it');
  {
    const id = /\bthere\b/i.test(out) && (!about || referent('there', t) === about) ? referent('there', t) : null;
    if (id) {
      const n = nameOf(id);
      const before = out;
      out = out.replace(/\b(get|go|going|travel|walk|ride|head)\s+there\b/gi, `$1 to ${n}`)
        .replace(/\b(from|in|over|out of|near)\s+there\b/gi, `$1 ${n}`)
        .replace(/\b(happened|happens|happening)\s+there\b/gi, `$1 at ${n}`)
        .replace(/\b(live|lives|living|stay|stays)\s+there\b/gi, `$1 in ${n}`)
        .replace(/\bis it far\b/gi, `is ${n} far`);
      if (out !== before) about = id;
    }
  }
  if (about) {
    return { text: out, about, kind: 'pronoun' };
  }
  return { text: s, about: null, kind: 'as-is' };
}
function lastQuestionAbout(t: Talk, _who: string) { void t; return 'tell me about yourself'; }

// ---------- pushing back on what they said ----------
export type Probe = 'why' | 'how-know' | 'who-told' | 'really' | 'when' | 'mean' | 'more';
export function probe(text: string): Probe | null {
  const t = text.toLowerCase().trim().replace(/[.!]+$/, '');
  if (/^(why|why'?s that|why is that|why so|how come|why not|but why)\??$/.test(t)) return 'why';
  if (/^(how (do|would|did|could) you know( that)?|how do you know all (this|that)|says who|who says( so)?|how'?d you hear( that)?|where did you hear (that|this))\??$/.test(t)) return 'how-know';
  if (/^(who told you( that| this)?|who said( that)?|who'?s your source|where'?d you hear that)\??$/.test(t)) return 'who-told';
  if (/^(really|seriously|honestly|truly|no way|is that (true|so|right)|are you (sure|serious|joking|kidding)|you'?re joking|you'?re kidding|for real|you sure)\??!?$/.test(t)) return 'really';
  if (/^(since when|when( was that| did that happen| was this)?|how long ago|how long( has that been)?)\??$/.test(t)) return 'when';
  if (/^(what do you mean( by that)?|meaning|meaning what|what'?s that (supposed to )?mean|explain|explain that|in what way|how so)\??$/.test(t)) return 'mean';
  if (/^(go on|and\??|and then\??|then what|what happened (then|next)|keep going|tell me more|more|what else|anything else|continue)\??$/.test(t)) return 'more';
  return null;
}

// ---------- asking them what they remember about you ----------
export type MemQ = 'name' | 'from' | 'trade' | 'remember' | 'told' | 'opinion';
export function memoryQuestion(text: string): MemQ | null {
  const t = text.toLowerCase().trim().replace(/[.!]+$/, '');
  if (/^(what'?s|what is|do you (know|remember)) my name\??$|^who am i\??$|^do you know who i am\??$|^you know my name\??$/.test(t)) return 'name';
  if (/^(where am i from|where('?s| is) my home|do you remember where i'?m from)\??$/.test(t)) return 'from';
  if (/^(what do i do|what'?s my (job|trade|line of work))\??$/.test(t)) return 'trade';
  if (/^(do you remember me|remember me|have we met( before)?|do you recogni[sz]e me)\??$/.test(t)) return 'remember';
  if (/^(what (did|have) i told you|what do you know about me|what have i told you|what did i say( before| earlier)?|what do you remember about me)\??$/.test(t)) return 'told';
  return null;
}

/** Same question asked again (ignoring punctuation and filler)? */
export function isRepeat(t: Talk, text: string): boolean {
  const k = text.toLowerCase().replace(/[^a-z ]/g, '').replace(/\b(so|well|um|uh|again|please|then)\b/g, '').replace(/\s+/g, ' ').trim();
  if (k.split(' ').length < 3) return false;
  const seen = t.heard.includes(k);
  t.heard = [k, ...t.heard.filter((x) => x !== k)].slice(0, 12);
  return seen;
}

/** "Vera" yes, "tired" no: a single word that isn't one we know as ordinary English. */
export function looksLikeName(w: string): boolean {
  vocab();
  const x = w.toLowerCase();
  if (KNOWN!.has(x) || NAMES!.has(x)) return false;
  return !/^(here|back|fine|good|ok|okay|sorry|ready|new|lost|hungry|thirsty|tired|drunk|sober|alone|done|serious|joking|kidding|scared|afraid|happy|sad|bored|busy|late|early|broke|rich|poor|sure|confused|hurt|well|great|awesome|cool|single|married|human|elf|dwarf|orc|halfling|gnome|tiefling|goblin|dragonborn|lucky|famous|nobody|somebody|everyone|leaving|going|staying|listening|waiting|thinking|looking|here)$/.test(x) && !/(ing|ed|ly|ous|ful|less|able|ish)$/.test(x);
}
