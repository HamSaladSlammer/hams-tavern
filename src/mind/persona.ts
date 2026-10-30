// Who an NPC is inside: temperament, life story, what they want and fear, and how they feel about
// the world. Named people are written by hand; everyone else is grown from a seed, so the same
// innkeeper gives the same answers every time you ask.
import type { Npc } from '../content/types';
import { pick, die, type Rng } from '../engine/dice';
import { TOWNS, townById } from '../world/atlas';

export type People = 'human' | 'half-orc' | 'orc' | 'elf' | 'dwarf' | 'goblin' | 'tiefling' | 'halfling' | 'dragonborn' | 'cat' | 'undead' | 'mixed';
export interface Persona {
  id: string;
  people: People;
  pronoun: 'he' | 'she' | 'they';
  warmth: number; // -2 cold .. 2 kind
  temper: number; // 0 slow to anger .. 2 quick
  humour: number; // 0 dry .. 2 jolly
  suspicion: number; // 0 trusting .. 2 wary
  piety: number; // 0 .. 2
  bravery: number; // -1 coward .. 2 fearless
  from: string; // town id
  years: number; // years in this place
  self: string; // "who are you" in their words
  family: string;
  war: string; // what they did in the war, in their words
  wants: string;
  fears: string;
  drink: string;
  god?: string;
  stances: Record<string, number>; // entity id -> -2..2 overrides
  claims?: Partial<Record<string, string[]>>; // their own reactions to things you tell them
  avoidsWar?: boolean;
}

const R = (seed: number): Rng => ({ state: seed >>> 0 });
export const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The people we know by name. */
const NAMED: Record<string, Partial<Persona>> = {
  squib: {
    people: 'half-orc', pronoun: 'he', warmth: 1, temper: 0.5, humour: 1, suspicion: 1, piety: 0.5, bravery: 2, from: 'breda', years: 12,
    self: 'I pour drinks and keep the peace. In that order, most nights.',
    family: 'Kettle. The regulars. That\'s family enough for one man.',
    war: 'I carried stretchers. That\'s all I\'ll say about it.',
    wants: 'For people to sit down in here and be safe. That\'s the whole plan.',
    fears: 'Bells. Don\'t laugh.',
    drink: 'Barrel Brown. I brew it, I drink it, I stand behind it.',
    god: 'the Bright Hearth. The fire\'s never gone out in here. Not once.',
    stances: { war: -2, greymarch: -2, cult: -2, bellwax: -2, undead: -2, bells: -2, orcs: 1, elves: 0, crown: 0, sereza: -1, dwarves: 2, treaty: 1, firearms: -1, kettle: 2 },
    avoidsWar: true,
    claims: {
      fought: ['His cloth stops. He sets a mug in front of you and fills it, and when you reach for your purse he shakes his head once. "Then you know." That\'s all he says.'],
      lost: ['He doesn\'t say anything for a moment. Then he pours two small glasses of something dark and slides one to you. "To yours," he says quietly, and drinks.'],
      killed_bell: ['"I heard." He taps the bar twice. "Drink\'s on the house. All night, if you want it."'],
      new: ['"Then welcome to Breda. Board by the door has honest work. House rules are on the wall. Mind the barrel."'],
    },
  },
  dwarves: {
    people: 'dwarf', pronoun: 'they', warmth: 2, temper: 1, humour: 2, suspicion: 0, piety: 0.5, bravery: 1.5, from: 'tantal', years: 1,
    self: 'Road crew! Borin, Odo, Marrik, and the little one\'s Tokk. We fix what the war broke. Slowly. For the crown.',
    family: '"Eleven children between us," says Borin. "Twelve," says Odo. "That\'s not mine," says Marrik.',
    war: '"Dug graves for both sides," Borin says. "Paid by both sides, too. We don\'t talk about that."',
    wants: '"Payday," says Borin. "A bigger boar," says Odo. Marrik says nothing. Tokk wants to win one arm-wrestle.',
    fears: '"Nothing!" says Borin. "Graves that knock," Marrik says quietly. Nobody laughs.',
    drink: '"Dwarven stout. Ten copper and worth twelve."',
    god: 'the Long Road, mostly. We\'re always on it.',
    stances: { crown: 1, firearms: 1, undead: -2, cult: -1, elves: 0, orcs: 1, food_drink: 2 },
  },
  whisperers: {
    people: 'elf', pronoun: 'they', warmth: 0, temper: 0.5, humour: 0, suspicion: 2, piety: 1, bravery: 0.5, from: 'breda', years: 0,
    self: 'Faelar: "Travellers. Watchers. We count the dead that get back up."',
    family: 'Nix: "My cousin\'s village was family. It went quiet." Nobody adds anything.',
    war: 'Faelar: "I kept graves. The war kept me busy."',
    wants: 'Ithren: "For someone to believe us. Then for someone to stop it."',
    fears: 'Faelar: "The north side of every graveyard."',
    drink: 'Vetch: "Whatever\'s cheapest. Silver costs money."',
    stances: { undead: -2, cult: -2, bells: -2, silver: 2, crown: -1 },
  },
  sereza: {
    people: 'tiefling', pronoun: 'she', warmth: 0, temper: 0.5, humour: 1, suspicion: 2, piety: 0, bravery: 1.5, from: 'suomi', years: 0,
    self: 'A collector. Of stories, mostly. I pay well for the true ones.',
    family: 'Ask me something I\'d answer.',
    war: 'I was a child in Suomi. I remember the bread lines, not the battles.',
    wants: 'To know why the bells ring. And who\'s pulling the rope.',
    fears: 'Being bored. And being wrong.',
    drink: 'Suomi vintage, when someone else is paying.',
    stances: { crown: 1, elisiah: 2, cult: -2, bellwax: -1, undead: -1, frostpetal: 1 },
    claims: {
      distrust_crown: ['She writes something down. Small, quick handwriting. "Interesting," she says, and smiles. It isn\'t a warm smile.'],
      bells: ['She leans in. "Go on. Every detail. Who, when, what colour were the candles?"'],
    },
  },
  garrick: {
    people: 'tiefling', pronoun: 'he', warmth: 0, temper: 0, humour: 0, suspicion: 2, piety: 0.5, bravery: -1, from: 'breda', years: 7,
    self: 'Garrick. General goods. Rope, oil, shovels. Nothing exciting. Please don\'t make it exciting.',
    family: 'A sister in Galilin. She writes. I don\'t write back. It\'s complicated.',
    war: 'I sold blankets to the army. Both armies. Is that a crime? It wasn\'t then.',
    wants: 'A quiet week. One. Is that so much?',
    fears: 'Thieves. The dead. Green candles. You, a little, if I\'m honest.',
    drink: 'Small beer. Two copper. I don\'t like to lose my head.',
    stances: { cult: -2, undead: -2, money: 2, crown: 0, firearms: -1 },
  },
  smith: {
    people: 'human', pronoun: 'she', warmth: 2, temper: 1, humour: 2, suspicion: 0, piety: 0.5, bravery: 1.5, from: 'breda', years: 30,
    self: 'Mother Dreyse. I make things hard and sharp. People too, if they stand still.',
    family: 'Three sons, all bigger than me, all scared of me. As it should be.',
    war: 'I shod cavalry horses for three years and fixed bayonets for two. Never fired a shot. Never needed to.',
    wants: 'Good iron, an honest price, and a bit of gossip with my tea.',
    fears: 'Rust. And quiet. Quiet means trouble.',
    drink: 'A strong stout and a stronger opinion.',
    god: 'the Bright Hearth. A forge is just a hearth with ambitions.',
    stances: { firearms: -1, silver: 1, tokarev: -1, dwarves_folk: 1, cult: -2, squib: 2 },
  },
  hetch: {
    people: 'cat', pronoun: 'he', warmth: 0, temper: 1, humour: 1, suspicion: 1, piety: 0, bravery: 1, from: 'suomi', years: 5,
    self: 'I am a tailor. I make people look less like what they are.',
    family: 'I have a great many cousins. Most of them catch mice. We do not discuss it.',
    war: 'I made officers\' coats. Both sides wanted the same cut. That tells you everything about war.',
    wants: 'Good pelts, good thread, and customers who wash.',
    fears: 'Water. Moths. Your sense of style.',
    drink: 'Cream. Do not comment.',
    stances: { elves: 1, suomi: 1, wolves: 1, orcs: 0, cult: -1, firearms: -1 },
  },
  doss: {
    people: 'human', pronoun: 'he', warmth: 2, temper: 0.5, humour: 1, suspicion: 0, piety: 1, bravery: 1, from: 'breda', years: 60,
    self: 'Doss. Sheep. Forty ewes and one ram with opinions.',
    family: 'Wife\'s gone ten winters now. The sheep don\'t mind my stories.',
    war: 'Militia. Held a bridge for a week with a pitchfork and a dozen farm boys. Nobody remembers. I do.',
    wants: 'Somebody to sit and listen of an evening.',
    fears: 'Nothing much. I can\'t hear half of it coming.',
    drink: 'Whatever you\'re pouring, if you\'re pouring.',
    god: 'the Silent Keeper. He\'s been patient with me.',
    stances: { militia: 2, veterans: 2, war: -1, undead: -1 },
  },
  alistair: {
    people: 'undead', pronoun: 'he', warmth: 2, temper: 0, humour: 2, suspicion: 0, piety: 0, bravery: 2, from: 'suomi', years: 200,
    self: 'Alistair! Court mage, bon vivant, technically deceased. Brother, I contain multitudes, and also very little else.',
    family: 'I had cousins. They had cousins. Everyone\'s dead now. I\'m the only one who kept up the parties.',
    war: 'Which war? I slept through the last one. Literally.',
    wants: 'A good party. A bigger party. To remember why I can\'t remember things.',
    fears: 'Being boring. Also holy water, a bit.',
    drink: 'I can\'t, brother. It goes straight through me. I still like holding one.',
    stances: { magic: 2, loremasters: 1, undead: 1, cult: -1, crown: 0, food_drink: 2 },
  },
  merah: {
    people: 'human', pronoun: 'she', warmth: -2, temper: 1, humour: 0, suspicion: 2, piety: 2, bravery: 1, from: 'breda', years: 40,
    self: 'A mourner. Like everyone, if they\'d admit it.', family: 'They\'re waiting for me. All of them.', war: 'It took everyone.', wants: 'To wake Her gently.', fears: 'Forgetting.', drink: 'Nothing. Not any more.',
    stances: { cult: 2, pale_queen: 2, bells: 2, crown: -2, undead: 1 },
  },
  brumandell_keeper: {
    pronoun: 'he', warmth: 2, temper: 0.5, humour: 1, suspicion: 0, bravery: 1, from: 'brumandell', years: 14,
    self: 'Grog. The alehouse is mine, the chowder is mine, and the rules are mine. Sit.',
    family: 'Everyone who drinks here more than twice. I\'ve too many cousins already.',
    war: 'I fed soldiers. Both kinds. Hungry men are all the same shape.',
    wants: 'Full tables and an empty pot by closing.',
    fears: 'Running out of clams.',
    drink: 'Brumandell cider. Best apples in the province, and I\'ll fight you on it.',
    stances: { brumandell: 2, thimbleton: 1, grok: 2, cult: -2, food_drink: 2 },
  },
};

// ---------- everyone else, grown from a seed ----------
const FAMILY = [
  'A wife and two girls, back home. I send money. Sometimes I go.', 'Nobody, now. The war saw to that.', 'A brother in the army and a mother who thinks I should be.',
  'Married twice. Widowed once, divorced once. I\'m not saying which was worse.', 'Three kids. All loud. All mine.', 'My father. He\'s ninety and meaner than ever.',
  'A husband who snores and a dog who doesn\'t. I prefer the dog.', 'Cousins everywhere. You can\'t throw a stone in Lahti without hitting one.', 'Just me. I like it that way.',
];
const WAR_VET = [
  'Infantry. Two years. I came home with all my fingers, which makes me lucky.', 'I was at the Coltale siege. We ate the horses. I don\'t eat horse now.',
  'Quartermaster\'s clerk. I counted boots. A lot of the boots came back empty.', 'Rifles. I was good at it. I don\'t like that I was good at it.',
  'I drove supply wagons. Got shot at by both sides, once in the same afternoon.', 'Medic\'s runner. I don\'t talk about it much.',
];
const WAR_CIVVY = [
  'I was a child. I remember the soldiers marching through, and the ones who didn\'t march back.', 'I kept my head down and my farm running. That was my war.',
  'Too young to fight, old enough to bury people.', 'I hid in a cellar for most of it. I\'m not ashamed.', 'My village was on the road. Everybody marched through it eventually.',
];
const WANTS = [
  'Enough coin to stop worrying about coin.', 'A quiet life. Honestly. That\'s it.', 'To see the sea before I die.', 'For my kids to never see a war.',
  'A little shop of my own. With my name over the door.', 'To get out of this town before it gets me.', 'A good night\'s sleep without that bell.',
];
const FEARS = ['The dead. Who isn\'t?', 'Fire. I\'ve seen a town burn.', 'Being forgotten.', 'Another war.', 'The Mire. It keeps getting closer.', 'Debt.', 'Wolves. Ever since I was small.', 'Bells at midnight.'];
const DRINKS = ['Ale. Nothing fancy.', 'Cider, if there\'s any.', 'Trenchfire, but only on bad days.', 'Galilin red, when I\'m flush.', 'Small beer. I\'m working.', 'Mead-brandy. It\'s sweet, it\'s strong, it\'s honest.'];
const GODS = ['the Bright Hearth, like my mother did.', 'the Long Road. I\'ve been on it enough.', 'the Silent Keeper, these days. Seems the right one to keep happy.', 'nobody, really. The gods have been quiet.'];

const PEOPLE_BAG: People[] = ['human', 'human', 'human', 'human', 'human', 'elf', 'elf', 'half-orc', 'orc', 'dwarf', 'goblin', 'halfling', 'tiefling', 'dragonborn'];

function peopleFromText(t: string): People | null {
  const m = t.toLowerCase().match(/\b(half-orc|orc|elf|elven|dwarf|dwarven|goblin|tiefling|halfling|dragonborn|human)\b/);
  if (!m) return null;
  return ({ elven: 'elf', dwarven: 'dwarf' } as Record<string, People>)[m[1]] ?? (m[1] as People);
}

const CACHE: Record<string, Persona> = {};
/** The persona for any NPC: hand-written for the named, seeded for everyone else. */
export function personaOf(np: Npc, home: string | null, trades: string[] = []): Persona {
  if (CACHE[np.id]) return CACHE[np.id];
  const r = R(hash(`${np.id}:mind`));
  const vet = trades.includes('veteran') || trades.includes('soldier') || trades.includes('watch') || die(r, 3) === 1;
  const look = `${np.short} ${(() => { try { return np.look({} as never); } catch { return ''; } })()}`;
  const fem = /\b(she|her|woman|wife|girl|mother|barmaid|lady|matron|widow)\b/i.test(look) || /^(Anka|Ilse|Lida|Hana|Dorota|Greta|Kasia|Magda|Olga|Sabina|Una|Zofia|Brana|Fenna|Ruta|Vera)\b/.test(np.name);
  const masc = /\b(he|his|man|husband|father|boy)\b/i.test(look);
  const base: Persona = {
    id: np.id,
    people: peopleFromText(look) ?? pick(r, PEOPLE_BAG),
    pronoun: fem ? 'she' : masc ? 'he' : pick(r, ['he', 'she'] as const),
    warmth: die(r, 5) - 3, temper: (die(r, 3) - 1), humour: die(r, 3) - 1, suspicion: die(r, 3) - 1, piety: die(r, 3) - 1, bravery: die(r, 4) - 2,
    from: home && die(r, 3) > 1 ? home : pick(r, TOWNS).id,
    years: 1 + die(r, 25),
    self: '', family: pick(r, FAMILY), war: pick(r, vet ? WAR_VET : WAR_CIVVY), wants: pick(r, WANTS), fears: pick(r, FEARS), drink: pick(r, DRINKS), god: pick(r, GODS),
    stances: {},
  };
  const p: Persona = { ...base, ...(NAMED[np.id] ?? {}), stances: { ...base.stances, ...(NAMED[np.id]?.stances ?? {}) } } as Persona;
  if (!p.self) {
    const town = townById(home ?? '')?.name;
    p.self = /_keeper$/.test(np.id) ? `I run this place. ${p.years} years now${town ? `, the longest anyone's kept an inn in ${town}` : ''}.`
      : /_merchant$/.test(np.id) ? `I sell things. Good things, at fair prices, to people who don't haggle too hard.`
        : /_watch$/.test(np.id) ? `I keep the peace${town ? ` in ${town}` : ''}. Some days it keeps me.`
          : `${cap(np.short.replace(/^(a|an|the) /, ''))}. Not much more to it.`;
  }
  CACHE[np.id] = p;
  return p;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
