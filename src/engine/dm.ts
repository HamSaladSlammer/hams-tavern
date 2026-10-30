// The game master's voice: what people say back when nothing scripted fits, what the room does
// when you do something, the unnamed people in every crowd, thoughts said out loud, and weather.
// Everything here is table-driven and seeded, so it runs offline and stays consistent.
import type { Ctx, Npc } from '../content/types';
import type { World } from './actions';
import { NPCS } from '../content/npcs';
import { ROOMS } from '../content/world';
import { die, next, pick, type Rng } from './dice';
import { askOracle, type Odds } from './oracle';
import { itemName, weaponById, hasItem } from './character';
import { ITEMS } from './srd';
import { TOWNS, townById, POIS } from '../world/atlas';
import { townOfRoom } from '../world/towns';
import { matchDestination, route, locName, syncAt } from '../world';
import * as Mind from '../mind';

const R = (seed: number): Rng => ({ state: seed >>> 0 });
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayOf = (c: Ctx) => Math.floor((c.s.minutes + 480) / 1440);

// ---------- weather ----------
export function weather(c: Ctx): { word: string; line: string } {
  const town = c.s.world?.at ?? 'breda';
  const t = townById(town);
  const north = (t?.y ?? 0.45) < 0.25;
  const r = R(hash(`${dayOf(c)}:${north ? 'n' : t && t.y > 0.7 ? 's' : 'm'}`) + c.s.rng.state % 1);
  const opts = north
    ? [['snow', 'Snow comes sideways off the Peaks.'], ['clear', 'A hard blue sky, cold enough to crack teeth.'], ['wind', 'A wind straight down from the mountains.'], ['fog', 'Fog sits in the valleys like milk.']]
    : t && t.y > 0.7
      ? [['rain', 'Warm rain, and the smell of the Mire.'], ['fog', 'Marsh fog, thick enough to lose your feet in.'], ['clear', 'Sticky and bright.'], ['storm', 'Thunder rolls up from the south.']]
      : [['rain', 'A thin grey rain that gets into everything.'], ['clear', 'A clear day, for once.'], ['overcast', 'A low grey lid of cloud.'], ['wind', 'Wind in the trees, and leaves on the road.'], ['fog', 'Morning fog that never quite burns off.']];
  const [word, line] = pick(r, opts);
  return { word, line };
}

// ---------- voices ----------
type Voice = 'gruff' | 'warm' | 'formal' | 'sly' | 'nervous';
const VOICE_OVERRIDE: Record<string, Voice> = { squib: 'gruff', garrick: 'nervous', sereza: 'sly', smith: 'warm', hetch: 'formal', doss: 'warm', alistair: 'sly', merah: 'formal', dwarves: 'warm', window: 'sly' };
export function voiceOf(np: Npc): Voice {
  if (VOICE_OVERRIDE[np.id]) return VOICE_OVERRIDE[np.id];
  const s = np.short.toLowerCase();
  if (/nervous|anxious|jumpy/.test(s)) return 'nervous';
  if (/captain|officer|notary|priest|clerk/.test(s)) return 'formal';
  return (['gruff', 'warm', 'formal', 'sly', 'nervous'] as Voice[])[hash(np.id) % 5];
}
const V: Record<Voice, { yes: string[]; no: string[]; dunno: string[]; think: string[]; bye: string[]; thanks: string[]; pleased: string[]; laugh: string[] }> = {
  gruff: { yes: ['Aye.', 'Yes.', 'Could be.', 'Mm. Yes.'], no: ['No.', 'Not that I know.', 'Nope.', 'No, and don\'t ask again.'], dunno: ['Couldn\'t say.', 'Not my business.', 'Don\'t know, don\'t care.'], think: ['He grunts.', 'A long pause.', 'A shrug like a landslide.'], bye: ['"Mind how you go."', '"Door\'s that way."', '"Go on, then."'], thanks: ['"Hm."', '"Don\'t mention it. Really. Don\'t."'], pleased: ['Something that might be a smile.', '"...Thanks."'], laugh: ['A short bark of a laugh.', 'His shoulders shake, once.'] },
  warm: { yes: ['Oh, yes!', 'Yes, love.', 'Sure enough.', 'That I can tell you: yes.'], no: ['Oh, no, sorry.', 'Afraid not.', 'No, no.', 'Not that I\'ve heard, love.'], dunno: ['Ooh, I wouldn\'t know.', 'You\'ve got me there.', 'Now there\'s a question.'], think: ['They tilt their head, thinking.', 'They tap their lip.', 'A thoughtful hum.'], bye: ['"Look after yourself!"', '"Come back soon, mind!"', '"Safe roads, friend."'], thanks: ['"Any time!"', '"Oh, go on. It was nothing."'], pleased: ['They beam at you.', '"Aren\'t you sweet."'], laugh: ['A big, warm laugh.', 'They laugh until they have to sit down.'] },
  formal: { yes: ['That is correct.', 'Indeed.', 'Yes.', 'I believe so.'], no: ['No.', 'That is not the case.', 'I\'m afraid not.', 'Certainly not.'], dunno: ['I could not say.', 'That is outside my knowledge.', 'I have no information on that.'], think: ['A measured pause.', 'They consider the question carefully.', 'They straighten their cuffs.'], bye: ['"Good day."', '"Until we meet again."', '"Go carefully."'], thanks: ['"You are welcome."', '"It is my duty."'], pleased: ['A small, correct nod.', '"Most kind."'], laugh: ['A dry chuckle.', 'The corner of their mouth moves.'] },
  sly: { yes: ['Maybe yes.', 'For you? Yes.', 'Now how did you know that?', 'Yes, as it happens.'], no: ['Mm, no.', 'Not that I\'d tell you for free.', 'Wouldn\'t that be nice. No.'], dunno: ['Information costs, friend.', 'Who\'s asking?', 'I might. I might not.'], think: ['They study you, smiling.', 'Their eyes go to your purse, then back.', 'A slow, amused look.'], bye: ['"We\'ll see each other again."', '"Watch your pockets."', '"Don\'t do anything I wouldn\'t."'], thanks: ['"You owe me one."', '"I\'ll remember that."'], pleased: ['"Flattery. I like it."', 'A crooked smile.'], laugh: ['A low, knowing laugh.', '"Oh, that\'s good."'] },
  nervous: { yes: ['Y-yes?', 'Yes. I think. Yes.', 'Oh! Yes.'], no: ['No! No. Why?', 'Gods, no.', 'I don\'t— no.'], dunno: ['I don\'t want to know.', 'Please don\'t ask me that.', 'I really couldn\'t say.'], think: ['They glance at the door.', 'They wring their hands.', 'A nervous swallow.'], bye: ['"Yes! Bye! Good!"', '"Be careful out there. Please."'], thanks: ['"Oh! Oh, you\'re welcome."', '"It\'s really fine."'], pleased: ['They go pink.', '"Really? Oh."'], laugh: ['A startled giggle.', 'A laugh that ends in a squeak.'] },
};

// ---------- subjects ----------
const SUBJ_STRIP = /^(do you know|have you (ever )?(seen|heard of|heard)|what do you (know|think) (about|of)|tell me about|what about|who is|who was|what is|what's|where is|where's|where are|where can i find|how do i get to|is there|are there|any)\s+/;
export function subjectOf(text: string): string {
  return text.toLowerCase().replace(/[?!.]+$/, '').replace(/^(so|well|hey|hi|ok|okay|and|but|um|uh),?\s+/, '').replace(SUBJ_STRIP, '').replace(/^(the|a|an|any|some)\s+/, '').trim();
}

const OPINIONS: [RegExp, string[]][] = [
  [/queen|elisiah|crown|capital|suomi/, ['The queen keeps the peace. Whatever else you say about her, she keeps it.', 'The crown\'s a long way off, and likes it that way.', 'Suomi people think the world ends at the river.']],
  [/bell|bells|chapel|toll/, ['Bells used to mean church. Now they mean get indoors.', 'I hear it in my sleep, and I\'m nowhere near a chapel.', 'Somebody\'s ringing them. Bells don\'t ring themselves.']],
  [/war|greymarch|soldier|army|makrovin|treaty/, ['Fifteen years and people still flinch at thunder.', 'The treaty\'s paper. Paper burns.', 'I lost two brothers at Greymarch. Don\'t ask me about the war.', 'Makrovin\'s not the enemy any more. Try telling the old men that.']],
  [/dead|undead|zombie|ghoul|skeleton|ghost/, ['The dead are restless. Something\'s keeping them up.', 'Silver, fire, or run. That\'s all I know about the dead.', 'Lock the door at night, and don\'t answer if it knocks.']],
  [/cult|candle|green|wax/, ['Green candles. If you see them, walk the other way.', 'There are more of them than people think. That\'s the trouble.', 'Bellwax. The young ones burn it for the dreams. Then they stop coming home.']],
  [/orc|orcs/, ['Orcs fought on both sides. Honest folk, mostly. Loud.', 'The orc traders from Samopal pay in good coin.']],
  [/elf|elves/, ['Elves remember everything, which makes them tiresome at parties.', 'The elves in Suomi act like the war was something that happened to other people.']],
  [/money|gold|coin|rich|price/, ['Everything costs more than it did.', 'Coin is coin. Where it came from is the interesting part.']],
  [/god|gods|faith|pray|keeper/, ['The old faith never died. It just got quiet.', 'I pray to the Keeper of the Last Light, when I remember.']],
  [/mire|swamp|bog/, ['The Mire\'s growing. Ask anyone in Shpagin.', 'Nobody goes into the Mire for fun.']],
  [/dragon|wyrm/, ['There\'s something big up in the Peaks. Nobody who\'s seen it talks sense after.', 'Dragons are a story for children. Mostly.']],
  [/food|ale|beer|drink|stew/, ['The ale here\'s honest. The stew is brave.', 'You want good food, Brumandell. Grog\'s chowder.']],
];

const ROLE_WORDS: Record<string, string> = {
  barmaid: 'barmaid', 'serving girl': 'barmaid', waitress: 'barmaid', server: 'barmaid', 'serving boy': 'pot-boy', 'pot boy': 'pot-boy', potboy: 'pot-boy', waiter: 'pot-boy',
  patron: 'patron', patrons: 'patron', drinker: 'patron', regular: 'patron', regulars: 'patron', drunk: 'drunk', stranger: 'stranger', traveller: 'traveller', traveler: 'traveller',
  farmer: 'farmer', child: 'child', kid: 'child', urchin: 'child', 'old man': 'old man', 'old woman': 'old woman', grandmother: 'old woman', grandfather: 'old man',
  minstrel: 'minstrel', musician: 'minstrel', fiddler: 'minstrel', bard: 'minstrel', singer: 'minstrel', sailor: 'sailor', soldier: 'soldier', veteran: 'soldier', priest: 'priest', priestess: 'priest', pilgrim: 'pilgrim',
  merchant: 'trader', trader: 'trader', peddler: 'trader', hawker: 'trader', woman: 'woman', lady: 'woman', girl: 'woman', man: 'man', guy: 'man', fellow: 'man', gentleman: 'man', bloke: 'man', someone: 'patron', somebody: 'patron', person: 'patron',
  guard: 'guard', watchman: 'guard', gambler: 'gambler', 'card player': 'gambler', dockhand: 'dockhand', labourer: 'dockhand', laborer: 'dockhand', courier: 'courier', mercenary: 'traveller',
};
const ROLE_DESC: Record<string, string[]> = {
  barmaid: ['quick on her feet, with a tray balanced on one hip and a look that says she has heard every line', 'a round-faced barmaid with flour on her apron and a pencil behind her ear', 'a sharp-eyed young woman carrying four mugs in each hand'],
  'pot-boy': ['a gangly lad collecting mugs faster than the room can empty them', 'a boy of fourteen pretending to be twenty'],
  patron: ['a regular who has clearly been here since noon', 'a carter with mud to the knees and a pint to the brim', 'a pair of off-duty clerks arguing about money'],
  drunk: ['a man who is having a wonderful time at an angle', 'a red-faced drunk singing a marching song nobody else remembers'],
  stranger: ['a hooded traveller who sits with their back to the wall', 'a stranger in a good coat, too good for this place', 'a quiet woman with ink-stained fingers who watches the door'],
  traveller: ['a dusty traveller with a pack bigger than they are', 'a pilgrim of the old faith with a carved staff'],
  farmer: ['a farmer counting coins from the morning market', 'a broad-shouldered farmer with straw in his hat'],
  child: ['a barefoot child with a stick and big plans', 'a little girl selling apples from a basket, badly'],
  'old man': ['an old soldier with one sleeve pinned up', 'an old man feeding pigeons with grim concentration'],
  'old woman': ['an old woman knitting something enormous', 'a grandmother with a pipe and a cutting eye'],
  minstrel: ['a minstrel tuning a fiddle that has seen several wars', 'a half-elf bard who keeps losing the thread of his own song'],
  sailor: ['a sailor off a Madsen boat, tattooed to the eyebrows'],
  soldier: ['a veteran in a faded uniform coat, medals and all', 'a young soldier on leave, trying to look older'],
  priest: ['a priest of the old faith with a tin bell at his belt', 'a tired priestess with chalk dust on her hands'],
  pilgrim: ['a pilgrim with road-blistered feet'],
  trader: ['a peddler with a tray of ribbons and dubious charms', 'a trader with three coats on, each pocket full'],
  woman: ['a woman in a travelling cloak, reading a letter twice', 'a tall woman laughing at something her friend said'],
  man: ['a man in a battered hat whittling a little horse', 'a broad man with a broken nose and a kind smile'],
  guard: ['a bored guard leaning on a spear', 'a town guard eating an apple on duty'],
  gambler: ['a card sharp shuffling a deck with one hand', 'a gambler with a stack of coins and a face like a locked door'],
  dockhand: ['an orc dockhand with arms like hams', 'a labourer with plaster in his hair'],
  courier: ['a crown courier in Elisiah\'s colours, gulping water'],
};
const ROLE_FIGHT: Record<string, string> = { guard: 'militia', soldier: 'militia', dockhand: 'thug', gambler: 'bandit', sailor: 'thug', stranger: 'bandit', traveller: 'bandit' };
const FIRST = ['Anka', 'Bohdan', 'Ilse', 'Mirek', 'Vera', 'Oskar', 'Lida', 'Tomas', 'Hana', 'Pavel', 'Dorota', 'Emil', 'Greta', 'Jarek', 'Kasia', 'Lev', 'Magda', 'Nils', 'Olga', 'Radek', 'Sabina', 'Teodor', 'Una', 'Viktor', 'Zofia', 'Aleks', 'Brana', 'Fenna', 'Ruta', 'Ivo'];
const FEM = new Set(['barmaid', 'old woman', 'woman']);
const MASC = new Set(['old man', 'man', 'pot-boy']);
const FEM_NAMES = ['Anka', 'Ilse', 'Lida', 'Hana', 'Dorota', 'Greta', 'Kasia', 'Magda', 'Olga', 'Sabina', 'Una', 'Zofia', 'Brana', 'Fenna', 'Ruta'];
const MASC_NAMES = ['Bohdan', 'Mirek', 'Oskar', 'Tomas', 'Pavel', 'Emil', 'Jarek', 'Lev', 'Nils', 'Radek', 'Teodor', 'Viktor', 'Aleks', 'Ivo'];

export function crowdHere(loc: string): 'tavern' | 'square' | 'market' | 'farm' | null {
  if (loc === 'tavern' || /:inn$/.test(loc) || /^prop:/.test(loc)) return 'tavern';
  if (loc === 'breda_square' || /:square$/.test(loc)) return 'square';
  if (loc === 'goods' || loc === 'smithy' || loc === 'tailor' || /:market$/.test(loc)) return 'market';
  if (loc === 'east_farms') return 'farm';
  return null;
}
export function roleOf(noun: string): string | null {
  const n = noun.toLowerCase().replace(/^(the|a|an|that|this|some|one of the|one)\s+/, '').replace(/^(pretty|cute|old|young|tall|short|drunk|quiet|hooded|nearest|other|friendly)\s+(?=\w)/, (m) => (/old/.test(m) ? m : '')).trim();
  return ROLE_WORDS[n] ?? ROLE_WORDS[n.replace(/s$/, '')] ?? null;
}

/** An unnamed person in the crowd, made real the moment you address them. */
export function spawnExtra(c: Ctx, noun: string): Npc | null {
  const role = roleOf(noun);
  const crowd = crowdHere(c.s.loc);
  if (!role || !crowd) return null;
  if (role === 'barmaid' && crowd !== 'tavern') return null;
  if (role === 'farmer' && crowd === 'tavern' && c.s.loc !== 'tavern') { /* fine */ }
  const id = `x:${c.s.loc}:${role.replace(/\s/g, '_')}:${dayOf(c)}`;
  ensureExtra(id);
  const list = extrasHere(c);
  if (!list.includes(id)) { list.push(id); c.set(`extras:${c.s.loc}`, JSON.stringify(list)); }
  return NPCS[id] ?? null;
}
export function extrasHere(c: Ctx): string[] {
  try {
    const all: string[] = JSON.parse((c.flag(`extras:${c.s.loc}`) as string) || '[]');
    const fresh = all.filter((id) => id.endsWith(`:${dayOf(c)}`) && !c.flag(`${id}_dead`) && !c.flag(`${id}_gone`));
    for (const id of fresh) ensureExtra(id);
    return fresh;
  } catch { return []; }
}
export function ensureExtra(id: string) {
  if (NPCS[id]) return;
  const m = id.match(/^x:(.+):([a-z_-]+):(\d+)$/);
  if (!m) return;
  const role = m[2].replace(/_/g, ' ');
  const r = R(hash(id));
  const name = FEM.has(role) ? pick(r, FEM_NAMES) : MASC.has(role) ? pick(r, MASC_NAMES) : pick(r, FIRST);
  const desc = pick(r, ROLE_DESC[role] ?? ROLE_DESC.patron);
  const roleNames = Object.entries(ROLE_WORDS).filter(([, v]) => v === role).map(([k]) => k);
  const np: Npc = {
    id, name, names: [name.toLowerCase(), role, ...roleNames], short: `${desc.split(',')[0]}`,
    look: () => `${cap(desc)}.`,
    greet: (c) => c.say(id, pick(c.rng, ['"Hm? Oh. Hello."', `"Yes?"`, `"Well, hello yourself."`, `"Can I help you?"`])),
    topics: [
      { id: 'rumour', keys: ['rumor', 'rumour', 'news', 'gossip', 'heard', 'going on'], say: (c) => smallRumour(c, id) },
      { id: 'name', keys: ['your name', 'who are you', 'call you'], say: (c) => c.say(id, `"${name}. ${pick(c.rng, ['And you are?', 'Not that it matters.', 'Pleased, I\'m sure.'])}"`) },
    ],
    unknown: ['"Couldn\'t tell you."'],
    fightAs: ROLE_FIGHT[role] ?? 'commoner',
  };
  NPCS[id] = np;
}

function smallRumour(c: Ctx, id: string) {
  const fr = Object.values(c.s.world?.fronts ?? {}).filter((f) => f.active && !f.ended);
  const lines = [
    ...fr.map((f) => (f.id === 'bells' ? 'They say the bells are ringing in more places than the old chapel.' : f.id === 'treaty' ? 'My cousin says the orcs and elves are at each other\'s throats in Samopal again.' : 'The Mire\'s creeping north. Nobody knows why.')),
    'There\'s good money on the notice board, if you\'ve the stomach for it.',
    'Somebody saw lights out past the edge of town. Bandits, or worse.',
    `A courier came through from ${pick(c.rng, TOWNS).name} yesterday, looking like he\'d seen a ghost.`,
  ];
  const near = POIS.filter((p) => !c.s.world?.found.includes(p.id) && !p.story);
  if (near.length && next(c.rng) < 0.25) { const p = pick(c.rng, near); lines.push(`My gran used to talk about ${p.name}. ${p.blurb}`); }
  c.say(id, `"${pick(c.rng, lines)}"`);
}

/** "ask Squib where he is from" -> "where are you from". */
export function secondPerson(t: string): string {
  return t.replace(/\b(he|she|they) (is|was)\b/gi, (_, __, v) => (v.toLowerCase() === 'is' ? 'you are' : 'you were'))
    .replace(/\b(he|she|they) (has|have)\b/gi, 'you have').replace(/\b(he|she|they) (does|do)\b/gi, 'you do').replace(/\b(he|she|they) (knows)\b/gi, 'you know')
    .replace(/\b(he|she|they)'s\b/gi, 'you are').replace(/\b(he|she|they)\b/gi, 'you').replace(/\b(his|their)\b/gi, 'your').replace(/\b(him|them)\b/gi, 'you')
    .replace(/^(if|whether)\s+(you)\s+(have|are|know|do|can|will|were|would|could|saw|heard|like)\b/i, (_, __, y, v) => `${v.toLowerCase() === 'saw' ? 'did you see' : v.toLowerCase() === 'heard' ? 'did you hear' : v.toLowerCase() === 'like' ? 'do you like' : `${v} ${y}`}`);
}

// ---------- talk ----------
/** When nothing scripted matches what you said to someone, answer like a person would. */
export function smalltalk(c: Ctx, w: World, np: Npc, text: string) {
  const t = secondPerson(text.toLowerCase().trim().replace(/["“”]/g, ''));
  const v = V[voiceOf(np)];
  const mem = c.npc(np.id);
  const say = (x: string) => c.say(np.id, x);
  const q = (x: string) => `"${x}"`;
  const subj = subjectOf(t);
  const town = townById(townOfRoom(c.s.loc) ?? c.s.world?.at ?? '');
  // farewells
  if (/^(bye|goodbye|good bye|farewell|see you|see ya|later|good night|night|i'?m off|i must go|i have to go|take care|cheers,? bye)\b/.test(t)) { say(pick(c.rng, v.bye)); c.s.talkingTo = null; return; }
  if (/\b(thank|thanks|cheers|much obliged|appreciate)\b/.test(t)) { say(pick(c.rng, v.thanks)); if (mem.disposition < 2 && !c.flag(`thanked_${np.id}_${dayOf(c)}`)) { c.set(`thanked_${np.id}_${dayOf(c)}`); mem.disposition += 1; } return; }
  // how are you
  if (/^(how are you|how'?s it going|how are things|how have you been|how do you do|you (ok|okay|alright|all right)|how'?s (life|business|your day)|what'?s new)/.test(t)) {
    const mood = mem.disposition >= 2 ? ['Better for seeing you.', 'Can\'t complain. Well, I can, but I won\'t.'] : mem.disposition <= -2 ? ['Fine until a minute ago.', 'What do you want?'] : ['Tired. Busy. Alive. In that order.', 'Same as yesterday. Hope tomorrow\'s different.', `Oh, you know. ${weather(c).line}`];
    say(q(pick(c.rng, mood))); return;
  }
  // compliments and flirting
  if (/\b(beautiful|pretty|handsome|gorgeous|lovely eyes|cute|stunning)\b|\bflirt|\b(buy|get) you a drink\b|\bdrink with me\b|\bdinner with me\b|\bcan i (sit|join)\b|\bgo out with\b|\bdate\b/.test(t)) {
    const ok = c.check('persuasion', 12 - Math.max(-2, Math.min(4, mem.disposition)));
    if (ok) { mem.disposition += 1; say(pick(c.rng, [`${pick(c.rng, v.pleased)} "${pick(c.rng, ['Smooth. You\'re smooth.', 'Buy me a drink and say that again.', 'Careful. I might believe you.', 'Well. Sit, then.'])}"`, `They hold your eye a moment longer than they need to. "${pick(c.rng, ['Is that so.', 'You\'re trouble, aren\'t you.', 'Ask me again later.'])}"`])); }
    else say(pick(c.rng, [`"${pick(c.rng, ['Nice try.', 'Does that usually work?', 'I\'m working, love.', 'Not tonight.'])}"`, `${pick(c.rng, v.think)} "${pick(c.rng, ['No.', 'Ha. No.', 'Keep walking.'])}"`]));
    return;
  }
  if (/\b(i like your|nice (hat|coat|place|beard|shop|work|sword|dog|cat|bar|tavern|inn))\b|you('re| are) (great|kind|good|clever|smart|funny|the best|wonderful|amazing)/.test(t)) { say(`${pick(c.rng, v.pleased)}`); if (!c.flag(`complimented_${np.id}`)) { c.set(`complimented_${np.id}`); mem.disposition += 1; } return; }
  // jokes
  if (/\bjoke\b|knock knock|walks into a bar/.test(t)) { const ok = c.check('performance', 11); say(ok ? pick(c.rng, v.laugh) : pick(c.rng, ['"...Was that the joke?"', 'A polite, painful smile.', '"I\'ve heard that one. It was better then."'])); if (ok) mem.disposition += 0.5; return; }
  // about the player
  const myName = t.match(/^(?:my name is|my name's|i'm called|call me|i am called|they call me)\s+([a-z' -]{2,24})$/);
  if (myName) { say(q(`${cap(myName[1].trim())}. ${pick(c.rng, ['I\'ll remember that.', 'Suits you.', 'Can\'t say I\'ve heard of you. Yet.', 'Right you are.'])}`)); mem.met = true; return; }
  if (/^(i'?m|i am) (a|an) /.test(t)) { const what = t.replace(/^(i'?m|i am) (a|an) /, ''); say(`${pick(c.rng, v.think)} "${cap(what)}, eh? ${pick(c.rng, ['We get all sorts.', 'There\'s work for one of those on the notice board, maybe.', 'Don\'t get many of those through here.', 'Well, try not to get killed.'])}"`); return; }
  // about them
  // requests: "ask X to play a song"
  const req = t.match(/^(?:to|could you|can you|would you|will you|please)\s+(?:please\s+)?([a-z]+)\b\s*(.*?)\??$/);
  if (req && req[1] === 'tell' && /story|tale|joke|legend|yarn/.test(req[2])) {
    if (/joke/.test(req[2])) { say(`${pick(c.rng, v.think)} ${pick(c.rng, JOKES)}`); return; }
    c.narr(`${np.name} settles in and tells you ${pick(c.rng, STORIES)}. ${pick(c.rng, ['It takes the best part of an hour and every word is a lie, probably.', 'By the end, half the room is listening.', 'You\'re not sure how much of it is true. Some of it, maybe.'])}`);
    c.advance(30);
    return;
  }
  if (req && !/^(tell|help|join|come|travel|fight|be)$/.test(req[1])) {
    const verb = req[1], rest = req[2].replace(/\bme\b/g, 'you').replace(/\bmy\b/g, 'your');
    const third = /(s|sh|ch|x|o)$/.test(verb) ? `${verb}es` : /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ies` : `${verb}s`;
    const odds: Odds = mem.disposition >= 2 ? 'very likely' : mem.disposition <= -2 ? 'unlikely' : 'likely';
    const a = askOracle(c.rng, odds, c.s.chaos);
    c.out('roll', `🔮 Will ${np.name} do it? ${a.answer} (${a.chance}%)`);
    if (a.answer.endsWith('yes')) {
      c.narr(`${np.name} ${third}${rest ? ` ${rest}` : ''}${a.answer === 'Exceptional yes' ? `, and makes a proper job of it. ${/play|sing|dance|perform/.test(verb) ? 'Half the room joins in.' : 'You get more than you asked for.'}` : '.'}`);
      if (/play|sing|perform/.test(verb) && crowdHere(c.s.loc) === 'tavern') c.narr(pick(c.rng, ['The tune is an old marching song, slowed down until it\'s sad.', 'It\'s a drinking song with eleven verses, and the room knows all of them.', 'A love song from Suomi. The dwarves pretend they aren\'t crying.']));
    } else say(`"${pick(c.rng, v.no)}" ${pick(c.rng, ['They don\'t move.', 'Not for free, anyway.', 'Ask nicer.', ''])}`.trim());
    return;
  }
  if (/\b(about yourself|where are you from|where('re| are) you from|where you('re| are) from|your family|your story|how long have you|what do you do|your job|are you married|do you have (kids|children|family))\b/.test(t)) { say(q(backstory(c, np))); return; }
  // about here
  if (/\b(this (town|place|village|city|inn|tavern)|about here|around here|what('s| is) there to do|anything to do)\b/.test(t)) {
    if (town) { say(q(pick(c.rng, [...town.lore, town.blurb]))); return; }
    say(q(pick(c.rng, ['Quiet. Usually.', 'Nothing much happens here. That\'s the appeal.', 'You\'re looking at it.']))); return;
  }
  // weather
  if (/\b(weather|rain|snow|cold|hot|storm|fog)\b/.test(t)) { say(q(`${weather(c).line} ${pick(c.rng, ['Typical.', 'Could be worse.', 'Bad for the knees.', 'The roads\'ll be mud.'])}`)); return; }
  // hunger
  if (/\b(hungry|starving|food|eat|thirsty|drink)\b/.test(t)) { say(q(crowdHere(c.s.loc) === 'tavern' ? 'Say the word and there\'s stew. Or "shop" for the lot.' : town ? `The inn does food. ${town.id === 'brumandell' ? 'Grog\'s chowder, if you\'ve any sense.' : 'Stew, mostly.'}` : 'Should\'ve packed something.')); return; }
  // directions
  const dir = t.match(/(?:where(?:'s| is| are)|how (?:do|can) i get to|which way (?:is|to)|directions to|the way to|how far(?: is it)? to)\s+(?:the\s+)?(.+?)\??$/);
  if (dir) {
    const target = dir[1].replace(/^(the|a)\s+/, '').trim();
    const r = ROOMS[c.s.loc];
    const ex = r?.exits.find((e) => !e.hidden?.(c) && (e.names.some((n) => target.includes(n) || n.includes(target)) || e.label.toLowerCase().includes(target)));
    if (ex) { say(q(`${cap(ex.label)}? ${pick(c.rng, ['Just there.', 'Right over there.', 'You\'re practically standing in it.'])}`)); c.sys(`("go ${ex.names[0]}")`); return; }
    const dest = c.s.world ? findDest(c, target) : null;
    if (dest) { say(q(`${dest.name}? ${dest.days ? `${dest.days <= 1 ? 'About a day' : `${dest.days} days`} on the road${dest.via ? `, by way of ${dest.via}` : ''}.` : 'Not far.'} ${pick(c.rng, ['Travel by day.', 'Watch the woods.', 'Take a friend.', ''])}`.trim())); c.sys(`("travel to ${dest.name}", or tap it on the World map)`); return; }
    if (/smith|forge|shop|store|market|inn|tavern|temple|chapel|board/.test(target)) { say(q(`Try the square. Most things in ${town?.name ?? 'town'} are off the square.`)); return; }
    say(q(pick(c.rng, [`${cap(target)}? Never heard of it.`, `Couldn't tell you where ${target} is.`, `Ask at an inn. Innkeepers know everything.`]))); return;
  }
  // opinions
  if (/\b(what do you think|your opinion|how do you feel about|do you like|what'?s your take)\b/.test(t)) {
    const op = OPINIONS.find(([re]) => re.test(subj));
    say(q(op ? pick(c.rng, op[1]) : pick(c.rng, [`${cap(subj || 'that')}? Not much, if I\'m honest.`, `I try not to think about ${subj || 'that'}.`, `${cap(subj || 'that')}. Hm. It\'s complicated.`])));
    return;
  }
  // requests to join / help
  if (/\b(join me|come with me|help me|travel with me|fight with me|be my|adventure with)\b/.test(t)) { say(q(pick(c.rng, ['I\'ve a living to make. Sellswords drink at the inn, if you\'re hiring.', 'Me? Gods, no.', 'Not for any money you\'ve got.', 'Ask me again when you\'re famous.']))); return; }
  // yes/no questions: the oracle decides, and they answer in their own voice
  if (/^(do|does|did|is|are|was|were|can|could|will|would|have|has|had|should|shall|may|might)\b/.test(t) || /\?$/.test(text.trim()) && !/^(what|why|who|where|how|when|which)\b/.test(t)) {
    const odds: Odds = mem.disposition >= 2 ? 'likely' : mem.disposition <= -2 ? 'unlikely' : '50/50';
    const a = askOracle(c.rng, odds, c.s.chaos);
    c.out('roll', `🔮 ${a.answer} (${a.chance}%)`);
    const seen = /\b(seen|heard|know|noticed|met)\b/.test(t);
    if (a.answer === 'Exceptional yes' && seen) { say(`"${pick(c.rng, v.yes)} More than I'd like." ${pick(c.rng, v.think)}`); smallRumour(c, np.id); return; }
    if (a.answer === 'Exceptional yes') { say(`"${pick(c.rng, v.yes)} And then some."`); return; }
    if (a.answer === 'Yes') { say(`"${pick(c.rng, v.yes)}${seen && subj ? ` ${cap(subj)}... yes. Not round here, though.` : ''}"`); return; }
    if (a.answer === 'No') { say(`"${pick(c.rng, v.no)} ${seen ? pick(c.rng, ['Not round here, anyway.', 'Can\'t say I have. Ask on the road.', 'And I\'d rather keep it that way.']) : pick(c.rng, ['Why do you ask?', 'Should it?', 'Not as far as I know.', 'Afraid that\'s the answer.'])}"`); return; }
    say(`"${pick(c.rng, v.no)}" ${pick(c.rng, ['And that\'s the end of it.', 'They look at you as if you\'d asked something indecent.', 'They turn away.'])}`); return;
  }
  // open questions they don't know
  if (/^(what|why|who|where|how|when|which)\b/.test(t)) {
    const op = OPINIONS.find(([re]) => re.test(subj));
    if (op) { say(q(pick(c.rng, op[1]))); return; }
    const others = w.presentNpcs(c).filter((x) => x !== np.id && !x.startsWith('x:') && x !== 'kettle');
    say(`${pick(c.rng, v.think)} "${pick(c.rng, v.dunno)}${others.length && next(c.rng) < 0.5 ? ` Ask ${w.npcName(others[0])}.` : crowdHere(c.s.loc) === 'tavern' ? ' Listen to the room long enough, you\'ll hear something.' : ''}"`);
    return;
  }
  // statements: respond to the content instead of repeating it
  const op = OPINIONS.find(([re]) => re.test(t));
  if (op) { say(`${pick(c.rng, v.think)} "${pick(c.rng, op[1])}"`); return; }
  if (/\b(sorry|apologi[sz]e)\b/.test(t)) { say(q(pick(c.rng, ['Forget it.', 'Water under the bridge.', 'Hm. Don\'t do it again.']))); if (mem.disposition < 0) mem.disposition += 1; return; }
  if (/^(yes|yeah|yep|aye|sure|ok|okay|alright|fine|no|nope|nah)\b/.test(t)) { say(pick(c.rng, [`${pick(c.rng, v.think)} "Right."`, '"Glad we agree."', '"If you say so."'])); return; }
  if (/\b(sad|tired|scared|afraid|lonely|lost|hurt|miss)\b/.test(t)) { say(`${pick(c.rng, ['Their face softens.', 'They lower their voice.'])} "${pick(c.rng, ['We all are, these days.', 'Sit a while. Nobody\'s chasing you in here.', 'It gets easier. That\'s what they tell me, anyway.'])}"`); return; }
  if (Mind.fallback(c, w, np, text)) return;
  say(`${pick(c.rng, v.think)} "${pick(c.rng, ['Is that right.', 'Huh. Go on.', 'Can\'t say I\'d thought about it.'])}"`);
}

function backstory(c: Ctx, np: Npc): string {
  if (!np.id.startsWith('x:') && !/_keeper$|_merchant$|_watch$|^hire_/.test(np.id)) return pick(c.rng, [`Not much to tell. I'm ${np.short}. That's the story.`, `You know what I am. ${cap(np.short)}. The rest is mine.`]);
  const r = R(hash(np.id + 'story'));
  const from = pick(r, TOWNS).name;
  const yrs = 3 + die(r, 25);
  return pick(r, [
    `Born in ${from}. Been here ${yrs} years. Long enough to stop counting.`,
    `I was a soldier, once. Everyone was. Now I'm this. ${from} was home, before.`,
    `My family's from ${from}. I came here for a girl. The girl left. I didn't.`,
    `Not much to tell. Work, sleep, work. ${yrs} years of it.`,
    `I had a farm near ${from}. The war had other plans.`,
  ]);
}

function findDest(c: Ctx, target: string): { name: string; days?: number; via?: string } | null {
  const id = matchDestination(c.s, target);
  if (!id) return null;
  syncAt(c.s);
  const r = route(c.s, c.s.world.at, id);
  return { name: locName(c.s, id), days: r?.days, via: r && r.path.length > 2 ? r.path.slice(1, -1).map((x) => locName(c.s, x)).join(', ') : undefined };
}

const STORIES = [
  'a tale about a Greymarch quartermaster who sold the same mule to both armies, twice',
  'the story of the Coltale ferryman who rowed the dead across the bay for a copper each, until one of them paid in gold',
  'a long, shaggy yarn about a goblin who became mayor of Shpagin by accident and was the best one they ever had',
  'the legend of the Weeping Glacier, and the soldier who walked into it to fetch his brother, and walked out with someone else',
  'a story about Madsen smugglers hiding a whole cannon in a coffin, with a priest who knew',
  'the one about the Thornwood charmwright who carved a ward so good the Devil went round by the road',
];
const JOKES = [
  '"An elf, an orc and a dwarf walk into the Treaty Stone. The dwarf ducks."',
  '"How many Suomi courtiers does it take to change a candle? None. They have it declared lit."',
  '"What\'s the difference between a Tokarev rifle and a Tokarev foreman? You can make the rifle shut up."',
  '"Why did the zombie cross the road? Bell rang. Couldn\'t help it."',
  '"A goblin asks a cop if he\'s a cop. The cop says no. The goblin sells him Bellwax. That\'s the whole joke. That\'s Largo."',
];
const plural = (np: Npc) => /^the .+s$/i.test(np.name);
const nm = (np: Npc) => cap(np.name);
const vb = (np: Npc, one: string, many: string) => (plural(np) ? many : one);

/** Winks, smiles, waves and blown kisses at a real person. */
export function emoteAt(c: Ctx, np: Npc, act: string): string | null {
  const mem = c.npc(np.id);
  const v = V[voiceOf(np)];
  if (['wink', 'flirt', 'kiss', 'smile'].includes(act)) {
    const ok = c.check('persuasion', 12 - Math.max(-2, Math.min(3, Math.round(mem.disposition))), { quiet: false });
    if (ok) { if (!c.flag(`flirted_${np.id}_${dayOf(c)}`)) { c.set(`flirted_${np.id}_${dayOf(c)}`); mem.disposition += 0.5; } return `You ${act === 'kiss' ? 'blow a kiss to' : act === 'flirt' ? 'catch the eye of' : `${act} at`} ${np.name}. ${pick(c.rng, [`${np.name} ${act === 'smile' ? 'smiles back' : 'winks back'}, slow and deliberate.`, `${pick(c.rng, v.pleased)}`, `${np.name} laughs and shakes their head, but they're still smiling a minute later.`])}`; }
    return `You ${act === 'kiss' ? 'blow a kiss to' : act === 'flirt' ? 'try your luck with' : `${act} at`} ${np.name}. ${pick(c.rng, [`${np.name} rolls their eyes.`, `${np.name} looks straight through you.`, `"Not a chance," says ${np.name}, not unkindly.`])}`;
  }
  if (act === 'wave') return `You wave at ${np.name}. ${pick(c.rng, [`${nm(np)} ${vb(np, 'waves', 'wave')} back.`, `${nm(np)} ${vb(np, 'lifts a hand', 'raise their mugs')}.`])}`;
  if (act === 'nod') return `You nod to ${np.name}. ${nm(np)} ${vb(np, 'nods', 'nod')} back.`;
  if (act === 'bow') return `You bow to ${np.name}. ${nm(np)} ${vb(np, 'bows', 'bow')} back, amused.`;
  if (act === 'toast') return `You raise your drink to ${np.name}. ${nm(np)} ${vb(np, 'raises', 'raise')} theirs. "${pick(c.rng, ['To absent friends.', 'To the living.', 'To the road.', 'To whatever comes next.'])}"`;
  if (act === 'salute') return `You salute ${np.name}. ${/soldier|veteran|guard|captain|militia/.test(np.short) ? `${np.name} snaps a salute back without thinking.` : `${np.name} looks baffled.`}`;
  return null;
}

// ---------- the room reacts ----------
/** A sentence or two of how the world responds to something you just did. */
export function aftermath(c: Ctx, w: World, kind: 'mundane' | 'loud' | 'odd' | 'tender' | 'craft' | 'rest'): string {
  const ppl = w.presentNpcs(c).filter((x) => !['kettle', 'alistair'].includes(x) && !x.startsWith('hire_'));
  const crowd = crowdHere(c.s.loc);
  const tod = c.timeOfDay();
  const comp = c.s.companions.find((x) => x !== 'kettle') ?? (c.hasCompanion('kettle') ? 'kettle' : null);
  const pool: string[] = [];
  if (ppl.length) {
    const who = w.npcName(pick(c.rng, ppl));
    if (kind === 'loud') pool.push(`${who} looks up sharply.`, `Heads turn. ${who} raises an eyebrow.`, `Somebody shushes you. It might have been ${who}.`);
    else if (kind === 'odd') pool.push(`${who} watches you do it, and decides not to ask.`, `${who} stares, then carefully looks elsewhere.`);
    else if (kind === 'tender') pool.push(`${who} pretends not to notice, kindly.`, `${who} gives you a small nod.`);
    else pool.push(`${who} glances over, then goes back to what they were doing.`, `If ${who} noticed, they don't show it.`);
  }
  if (crowd === 'tavern') pool.push(tod === 'evening' || tod === 'night' ? pick(c.rng, ['Around you the evening roars on: dice, a fiddle, someone losing an argument.', 'The fire pops. Somebody calls for another round.', 'A card game at the next table erupts into accusations.']) : pick(c.rng, ['The room is quiet at this hour. A cat cleans itself on the bar.', 'Sunlight lies across the tables in dusty bars.']));
  if (crowd === 'square') pool.push(pick(c.rng, ['A cart rattles past. A child chases a chicken.', 'Somewhere a hawker shouts the price of eggs.', `${weather(c).line}`]));
  if (crowd === 'market') pool.push(pick(c.rng, ['The shopkeeper\'s eyes follow you, and your hands.', 'Somebody haggles loudly over the price of rope.']));
  if (!crowd) pool.push(pick(c.rng, c.s.loc.startsWith('site:') || ROOMS[c.s.loc]?.region?.match(/vault|crypt|chapel|barrow/i) ? ['Your sound goes a long way in here. Something might have heard.', 'Dust sifts down from above. Then silence.'] : ['The wind moves the trees. A crow complains.', 'Nobody\'s around to see. The world carries on.', `${weather(c).line}`]));
  if (comp && next(c.rng) < 0.4) pool.push(comp === 'alistair' ? pick(c.rng, ['"Bold," says Alistair. "I respect it."', 'Alistair does it too, slightly worse.']) : comp === 'kettle' ? pick(c.rng, ['Kettle tilts his head at you.', 'Kettle wags, supportively.']) : `${NPCS[comp]?.name ?? 'Your companion'} ${pick(c.rng, ['snorts.', 'shakes their head, smiling.', 'says nothing, loudly.'])}`);
  return pick(c.rng, pool);
}

// ---------- thoughts said out loud ----------
/** "I'm hungry", "we should go", "that's funny": not commands, but they deserve an answer. */
export function thought(c: Ctx, w: World, raw: string): boolean {
  const t = raw.toLowerCase().trim().replace(/[.!]+$/, '');
  const comp = c.s.companions.find((x) => x !== 'kettle');
  const compSays = (x: string) => { if (comp && NPCS[comp]) c.say(comp, x); };
  if (/^(i'?m|i am|i feel|feeling) (so |really |very |a bit |kind of |pretty )?(hungry|starving|peckish)/.test(t)) {
    const food = c.pc.inventory.find((x) => ['food', 'drink'].includes(ITEMS[x.id]?.kind ?? '') || /ration|bread|apple|jerky|pie|stew/.test(x.id));
    c.narr(pick(c.rng, ['Your stomach agrees, loudly.', 'You\'re hungry. When did you last eat?']) + ' ' + (food ? `You've got ${itemName(food.id).toLowerCase()} in your pack.` : crowdHere(c.s.loc) === 'tavern' ? 'The smell from the kitchen isn\'t helping.' : 'Nothing in your pack but crumbs.'));
    c.sys(food ? `("eat ${itemName(food.id).toLowerCase()}")` : crowdHere(c.s.loc) === 'tavern' ? '("buy stew", or "shop")' : '(An inn, a market, or "forage" in the wild.)');
    return true;
  }
  if (/^(i'?m|i am|i feel) (so |really |very )?(thirsty|parched)/.test(t)) { c.narr('Your mouth is dry as road dust.'); c.sys(crowdHere(c.s.loc) === 'tavern' ? '("buy ale")' : hasItem(c.pc, 'waterskin') ? '("drink from the waterskin")' : '(Find a well, a stream or an inn.)'); return true; }
  if (/^(i'?m|i am|i feel) (so |really |very )?(tired|exhausted|sleepy|knackered|worn out)/.test(t)) { c.narr(pick(c.rng, ['Your eyes are gritty and your legs are lead.', 'You could sleep standing up, like a horse.'])); c.sys(ROOMS[c.s.loc]?.rest === 'long' ? '("sleep")' : '("short rest", or find an inn to sleep)'); return true; }
  if (/^(i'?m|i am|i feel) (so |really |very )?(cold|freezing|wet|soaked)/.test(t)) { c.narr(`${weather(c).line} You pull your collar up.`); if (crowdHere(c.s.loc) === 'tavern') c.narr('There\'s a fire. Go and stand by it.'); return true; }
  if (/^(i'?m|i am|i feel) (so |really |very )?(scared|afraid|nervous|frightened)/.test(t)) { c.narr(pick(c.rng, ['Fear is sensible. It\'s kept a lot of people alive.', 'Your hands shake, a little. You make them stop.'])); compSays(pick(c.rng, ['"So am I. Let\'s be scared together, then."', '"Good. Fear keeps you careful."'])); return true; }
  if (/^(i'?m|i am|i feel) (so |really |very )?(bored)/.test(t)) { c.narr('Then go and do something. There\'s a whole country out there.'); c.sys('("explore", "read the notice board", "any rumours?", or open the World map)'); return true; }
  if (/^(i'?m|i am) (so |really |completely )?(lost)|where (am i|do i go|should i go)|what (now|should i do|do i do)( now| next)?$/.test(t)) {
    const j = c.s.journal.slice(-2);
    c.narr(`You take stock. You're at ${ROOMS[c.s.loc]?.name ?? 'somewhere'}.${j.length ? ` The last thing in your journal: "${j[j.length - 1]}"` : ''}`);
    c.sys('Ideas: talk to people, "any rumours?", "read the notice board", "explore", open the World map, or just do whatever you like.');
    return true;
  }
  if (/^(i'?m|i am|i feel) (so |really |very )?(sad|lonely|down|miserable|homesick)/.test(t)) { c.narr(pick(c.rng, ['It comes over you all at once, the way it does.', 'You let it sit with you for a moment.'])); compSays(pick(c.rng, ['"Hey. I\'m here."', '"Drink? My treat. Well, your treat."'])); if (!comp) c.narr(aftermath(c, w, 'tender')); return true; }
  if (/^(i'?m|i am|i feel) (so |really |very )?(happy|great|good|fine|alive|ok|okay)/.test(t)) { c.narr(pick(c.rng, ['Good. Hold on to it.', 'For once, everything is all right.'])); compSays(pick(c.rng, ['"Don\'t jinx it."', '"Me too."'])); return true; }
  if (/^(let'?s|we should|we need to|we must|time to) (go|leave|move|get going|head out|press on|get out)/.test(t)) {
    compSays(pick(c.rng, ['"Lead on."', '"About time."', '"Right behind you."']));
    const r = ROOMS[c.s.loc];
    c.sys(`Where to? ${r ? r.exits.filter((e) => !e.hidden?.(c)).map((e) => e.label).join(' · ') : ''}${c.s.world ? ' · or "travel to <place>"' : ''}`);
    return true;
  }
  if (/^(ha(ha)+|lol|lmao|that'?s (funny|hilarious)|hilarious)/.test(t)) { c.narr(`You laugh. ${aftermath(c, w, 'mundane')}`); return true; }
  if (/^(hmm+|huh|interesting|wow|whoa|oh|ah|damn|dammit|ugh|great|perfect|nice|cool)$/.test(t)) { c.narr(pick(c.rng, ['You take that in.', 'You let out a breath.', 'Indeed.']) + ' ' + aftermath(c, w, 'mundane')); return true; }
  if (/^i (wonder|think|guess|suppose|bet|hope|wish)\b/.test(t)) {
    const ppl = w.presentNpcs(c).filter((x) => x !== 'kettle');
    if (ppl.length && next(c.rng) < 0.5) { w.say(c, raw); return true; }
    c.narr(`You say it half to yourself. ${aftermath(c, w, 'mundane')}`);
    return true;
  }
  return false;
}

// ---------- looking around ----------
export function lookAround(c: Ctx, w: World, raw: string): boolean {
  const t = raw.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/^(i |let me |i want to |i try to )/, '');
  if (/^(look|glance) (around|about)$/.test(t)) return false;
  if (!/^(look|glance|peer|scan|search|check|survey|watch) (around|about|the room|the crowd|the area|the square|the bar|for (anyone|anybody|someone|somebody|people|trouble|danger|threats|suspicious|enemies|a way|clues|signs|tracks))|^(scan|survey|watch) the (room|crowd|area|people)|^people[- ]watch|^keep (an eye|watch|lookout)|^(is anyone|is anybody|anyone) (watching|following|suspicious)/.test(t)) return false;
  const crowd = crowdHere(c.s.loc);
  const ok = c.check('perception', 12);
  const ppl = w.presentNpcs(c).filter((x) => x !== 'kettle');
  const extras = crowd ? roleSample(c, crowd) : [];
  if (ppl.length) c.narr(`You take in the ${crowd === 'tavern' ? 'room' : crowd ? 'crowd' : 'area'}. ${ppl.map((id) => `${w.npcName(id)} (${NPCS[id]?.short ?? 'someone'})`).join('; ')}.`);
  if (extras.length) c.narr(`Also here: ${extras.join('; ')}.`);
  if (!ppl.length && !extras.length) c.narr('Nobody. Just you and the ' + (ROOMS[c.s.loc]?.outdoors ? 'weather.' : 'dust.'));
  if (ok) {
    const feats = (ROOMS[c.s.loc]?.features ?? []).filter((f) => !f.hidden?.(c)).map((f) => f.names[0]);
    const susp = /suspicious|watching|following|trouble|danger|threat|enem/.test(t);
    const a = askOracle(c.rng, susp ? 'unlikely' : 'very unlikely', c.s.chaos);
    if (a.answer.includes('yes') && crowd) {
      const role = pick(c.rng, ['stranger', 'traveller', 'man', 'woman']);
      const x = spawnExtra(c, role);
      if (x) { c.out('roll', `🔮 Is anyone watching you? ${a.answer}.`); c.narr(`One face doesn't fit: ${x.short}, who looks away a moment too late. (${x.name}, if anyone asks.)`); c.set(`watcher_${x.id}`, true); return true; }
    }
    if (feats.length) c.narr(`You notice: ${feats.slice(0, 6).join(', ')}.`);
    if (crowd === 'tavern' && next(c.rng) < 0.5) { c.narr('A fragment of conversation drifts over from the next table:'); smallRumour(c, ppl[0] ?? 'squib'); }
  } else c.narr(pick(c.rng, ['Nothing jumps out at you.', 'If anything is off, you don\'t catch it.']));
  return true;
}

function roleSample(c: Ctx, crowd: 'tavern' | 'square' | 'market' | 'farm'): string[] {
  const r = R(hash(`${c.s.loc}:${dayOf(c)}:${Math.floor(c.hour() / 4)}`));
  const pool = crowd === 'tavern' ? ['barmaid', 'patron', 'drunk', 'stranger', 'minstrel', 'gambler', 'soldier', 'traveller'] : crowd === 'square' ? ['farmer', 'child', 'old woman', 'trader', 'guard', 'priest', 'courier'] : crowd === 'market' ? ['trader', 'old man', 'woman'] : ['farmer', 'child'];
  const n = c.timeOfDay() === 'night' || c.timeOfDay() === 'midnight' ? 1 : 2 + die(r, 2);
  const roles: string[] = [];
  for (let i = 0; i < n; i++) { const x = pick(r, pool); if (!roles.includes(x)) roles.push(x); }
  return roles.map((role) => `${pick(R(hash(role + c.s.loc)), ROLE_DESC[role] ?? ROLE_DESC.patron)} (the ${role})`);
}

// ---------- doing ordinary things well ----------
/** Upkeep and pastimes: sharpen, clean, mend, write, sketch, read, whittle, count. */
export function pastime(c: Ctx, w: World, raw: string): boolean {
  const t = raw.toLowerCase().trim().replace(/[.!]+$/, '').replace(/^(i |let me |i want to |i try to |i'll )/, '').replace(/^(sit (down )?(by|at|near|in) (the )?\w+ and |sit and )/, '');
  const main = weaponById(c.pc.equipped.main);
  const m = t.match(/^(sharpen|hone|whet|oil|clean|polish|maintain|mend|repair|fix|patch|darn|stitch|whittle|carve|write|sketch|draw|read|count|tally|check|inspect|organi[sz]e|pack|repack|braid|shave|wash|meditate|journal|practi[cs]e|train|exercise|stretch|cook|brew|fletch|tune)\b\s*(.*)$/);
  if (m && !m[2] && /^(journal|pack|read|check|count|inspect)$/.test(m[1])) return false;
  if (!m) return false;
  const [, verb, rest0] = m;
  const rest = rest0.replace(/^(my|the|a|an|some)\s+/, '');
  const mins = /write|sketch|draw|read|whittle|carve|meditate|practi|train|cook|brew|fletch/.test(verb) ? 60 : 20;
  let line = '';
  if (/sharpen|hone|whet/.test(verb)) line = main && !main.ranged ? `You draw the whetstone along the ${main.name.toLowerCase()} in long, even strokes until the edge catches the light. It sings when you test it on a hair.` : 'You sharpen what you\'ve got. It\'s more ritual than necessity, but your hands like the work.';
  else if (/oil|clean|polish|maintain/.test(verb)) line = /gun|rifle|revolver|pistol|carbine/.test(rest) || weaponById(c.pc.equipped.ranged)?.category === 'firearm' ? 'You strip the action, wipe the old grit out, oil the springs and put it back together in the order the army drilled into you. It clicks home sweetly.' : `You clean and polish ${rest ? `the ${rest}` : 'your kit'} until it looks like someone cares about it. Someone does.`;
  else if (/mend|repair|fix|patch|darn|stitch/.test(verb)) line = `You ${verb} ${rest ? `the ${rest}` : 'what\'s torn'} with needle, cord and patience. It's not pretty, but it'll hold.`;
  else if (/whittle|carve/.test(verb)) line = `You whittle ${rest ? `a little ${rest.replace(/^(a|an)\s+/, '')}` : 'a little wooden figure'} out of a scrap of wood. ${c.check('sleight of hand', 10, { quiet: true }) ? 'It comes out rather good.' : 'It looks like a potato with ambitions.'}`;
  else if (/write|journal/.test(verb)) line = `You write ${rest ? (/^(letter|note|poem|song|story|list|entry|page|diary|journal|will|confession|prayer|report)\b/.test(rest) ? `a ${rest}` : /^to\b/.test(rest) ? rest : `about ${rest}`).replace(/\bmy\b/g, 'your').replace(/\bme\b/g, 'you') : 'for a while'}. The words come slowly, then all at once. ${pick(c.rng, ['Somebody will find this in a hundred years and wonder about you.', 'You feel lighter for it.', 'You read it back and decide never to show anyone.'])}`;
  else if (/sketch|draw/.test(verb)) line = `You sketch ${rest ? `the ${rest}` : ROOMS[c.s.loc]?.outdoors ? 'the view' : 'the room'} in charcoal. ${pick(c.rng, ['It has something.', 'The proportions are off, but the mood is right.', 'Someone leans over your shoulder and says "huh".'])}`;
  else if (/read/.test(verb)) return false;
  else if (/count|tally/.test(verb)) line = `You count your money: ${(c.pc.copper / 100).toFixed(2)} gold, give or take. ${c.pc.copper > 100000 ? 'You could buy a tavern with that.' : c.pc.copper < 500 ? 'It doesn\'t take long.' : 'Enough to get by.'}`;
  else if (/check|inspect|organi|pack|repack/.test(verb) && (!rest || /gear|kit|pack|bag|equipment|supplies|stuff|things|inventory/.test(rest))) line = `You lay everything out and pack it again properly: ${c.pc.inventory.slice(0, 6).map((x) => itemName(x.id).toLowerCase()).join(', ')}${c.pc.inventory.length > 6 ? ', and the rest' : ''}.`;
  else if (/meditate/.test(verb)) line = 'You close your eyes and breathe until the noise goes away. For a while, you\'re nowhere at all.';
  else if (/practi|train|exercise|stretch/.test(verb)) line = `You run through your drills ${main ? `with the ${main.name.toLowerCase()}` : 'with your fists'} until you're sweating. ${pick(c.rng, ['Your body remembers.', 'Slow is smooth. Smooth is fast.', 'Somebody watching mutters "show-off".'])}`;
  else if (/cook|brew/.test(verb)) line = crowdHere(c.s.loc) === 'tavern' ? 'You talk your way into the kitchen and make something. It\'s better than the stew. Don\'t tell anyone.' : 'You get a small fire going and cook what you\'ve got. Hot food on the road is a kind of magic.';
  else if (/fletch/.test(verb)) line = 'You trim feathers and bind them to shafts. A slow, quiet craft.';
  else if (/tune/.test(verb)) line = 'You tune your instrument by ear until it rings true.';
  else if (/braid|shave|wash/.test(verb)) line = `You ${verb} and tidy yourself up. You look almost respectable.`;
  else return false;
  if (c.s.combat) { c.sys('Not in the middle of a fight.'); return true; }
  c.advance(mins);
  c.narr(`${line} ${aftermath(c, w, 'craft')}`);
  return true;
}

/** "announce", "declare", "proclaim", "shout that": speech to everyone. */
export function announce(c: Ctx, w: World, raw: string): boolean {
  const m = raw.trim().match(/^(?:i\s+)?(?:stand up and |get up and |climb (?:on|onto) (?:a|the) \w+ and )?(announce|declare|proclaim|shout|yell|bellow|cry out|tell (?:the room|everyone|everybody|the crowd|the tavern))(?: to (?:the room|everyone|everybody|the crowd|all))?(?: that)?\s+(.+)$/i);
  if (!m) return false;
  const what = m[2].replace(/^["“]|["”]$/g, '');
  const crowd = crowdHere(c.s.loc);
  if (/^(a |another |the )?(joke|story|tale|anecdote|limerick)\b/i.test(what)) {
    const ok = c.check('performance', 11);
    const joke = /joke|limerick/i.test(what);
    c.narr(ok ? pick(c.rng, joke ? ['It lands. Somebody laughs so hard ale comes out of their nose.', 'The punchline gets a roar. Someone makes you tell it again.', 'A groan, then a laugh, then a better laugh.'] : ['The room leans in. By the end, nobody is drinking.', 'You have them. Someone asks for another.']) : pick(c.rng, ['Silence. A cough. Somebody\'s chair creaks.', 'You forget the punchline halfway through.', 'One person laughs, alone, and then stops.']));
    if (ok && crowd === 'tavern') { const cp = 5 + die(c.rng, 10); c.money(cp); c.good(`Coins land at your feet: ${cp} copper.`); }
    else if (!crowd) c.narr(aftermath(c, w, 'mundane'));
    return true;
  }
  c.narr(`You ${/stand|get up/.test(raw) ? 'stand up and ' : ''}${m[1].startsWith('tell') ? 'tell the room' : m[1]}: "${cap(what)}"`);
  if (!crowd && !w.presentNpcs(c).length) { c.narr('The words go out across the empty land. A crow answers.'); return true; }
  const bold = /kill|slay|destroy|end|defeat/.test(what);
  const queen = /queen|vessariel|bell|cult/.test(what);
  const drinks = /drinks?|round|on me/.test(what);
  if (drinks && crowd === 'tavern') {
    const cost = 50 + die(c.rng, 50);
    if (c.pay(cost)) { c.narr(`A cheer goes up that rattles the shutters. It costs you ${cost} copper, and for one evening, everyone here loves you.`); for (const id of w.presentNpcs(c)) c.npc(id).disposition += 0.5; }
    else c.narr('A cheer goes up, then dies as everyone watches you count your coins. It\'s not enough. The silence is magnificent.');
    return true;
  }
  if (queen && bold) c.narr(pick(c.rng, ['The room goes very quiet. Someone makes the old sign against the dead. Somebody else quietly leaves.', 'A few people laugh, uneasily. One old soldier raises his mug to you, slowly, and doesn\'t laugh at all.']));
  else if (bold) c.narr(pick(c.rng, ['A ragged cheer. Someone shouts "And who\'s paying?"', 'People look at you the way they look at the weather: interested, but not about to change their plans.']));
  else c.narr(aftermath(c, w, 'loud'));
  if (queen) { c.s.chaos = Math.min(9, c.s.chaos + 1); c.sys('(Word of this will get around.)'); }
  return true;
}

export { roleSample };
