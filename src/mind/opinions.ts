// What people think about things: a stance from who they are, and words to say it with.
import type { Persona } from './persona';
import type { KnowerProfile } from '../lore/knowers';

/** Topics that share an opinion. */
const GROUP: Record<string, string> = {
  elisiah: 'crown', silver_watch: 'crown', crown: 'crown', suomi: 'suomi',
  grolgar: 'orcs', makrovin: 'orcs', orcs: 'orcs',
  elves: 'elves', dwarves_folk: 'dwarves_folk', goblins: 'goblins', tieflings: 'tieflings',
  cult: 'cult', bellwax: 'cult', zenu: 'cult', merah: 'cult', curtis: 'cult',
  undead: 'undead', bells: 'undead', pale_queen: 'undead', vessariel: 'undead', old_chapel: 'undead', drinker: 'undead',
  treaty: 'treaty', treaty_stone: 'treaty', treaty_statue: 'treaty', war: 'war', greymarch: 'war', veterans: 'war',
  firearms: 'firearms', tokarev_works: 'firearms', silver: 'silver',
  magic: 'magic', loremasters: 'magic', arbys: 'magic',
  old_faith: 'faith', bright_hearth: 'faith', silent_keeper: 'faith', long_road: 'faith',
  hushmilk: 'vice', grey_mercy: 'vice_hard', frostpetal: 'vice_rich', thornleaf: 'vice_soft', march_powder: 'vice', widows_cap: 'vice',
  militia: 'law', thimbleton: 'law', gallows: 'law',
  borschardt: 'town', tokarev: 'town', largo: 'town', coltale: 'town', brumandell: 'town', herstal: 'town', tantal: 'town', galilin: 'town', breda: 'town', rastbrook: 'town', shpagin: 'town', madsen: 'town', nagant: 'town', radom: 'town', samopal: 'town', maxim: 'town', carcano: 'town', lebel: 'town',
  squib: 'squib', food_drink: 'food', grogs: 'food', smoking_barrel: 'food',
  mire: 'wild', peaks: 'wild', thornwood: 'wild', wolves: 'wild', wyrm: 'wild', bandits: 'bandits',
  currency: 'money',
};
export const groupOf = (id: string) => GROUP[id] ?? 'thing';

/** -2 (hates it) .. 2 (loves it). */
export function stanceOn(id: string, p: Persona, k: KnowerProfile | null): number {
  if (p.stances[id] !== undefined) return p.stances[id];
  const g = groupOf(id);
  if (p.stances[g] !== undefined) return p.stances[g];
  const tr = new Set(k?.trades ?? []), fa = new Set(k?.factions ?? []);
  let s = 0;
  switch (g) {
    case 'crown': s = 0.4 + (tr.has('noble') ? 1 : 0) + (fa.has('crown') ? 1.5 : 0) - (tr.has('thief') ? 1 : 0) - (p.people === 'orc' ? 0.6 : 0) + (p.people === 'elf' ? 0.6 : 0); break;
    case 'suomi': s = (p.from === 'suomi' ? 1.5 : -0.4) + (tr.has('noble') ? 1 : 0); break;
    case 'orcs': s = (p.people === 'orc' || p.people === 'half-orc' ? 1.6 : 0) - (p.people === 'elf' && tr.has('veteran') ? 0.8 : 0) + (tr.has('merchant') ? 0.4 : 0); break;
    case 'elves': s = (p.people === 'elf' ? 1.5 : 0.1) - (p.people === 'orc' ? 0.6 : 0); break;
    case 'dwarves_folk': s = p.people === 'dwarf' ? 1.8 : 0.5; break;
    case 'goblins': s = p.people === 'goblin' ? 1.8 : -0.3; break;
    case 'tieflings': s = p.people === 'tiefling' ? 1.5 : 0; break;
    case 'cult': s = fa.has('cult') ? 2 : -1.5 - p.piety * 0.3; break;
    case 'undead': s = fa.has('cult') ? 1 : -1.8; break;
    case 'treaty': s = 1 + (tr.has('veteran') ? -0.4 : 0) + (tr.has('merchant') ? 0.5 : 0); break;
    case 'war': s = -1.5; break;
    case 'firearms': s = (tr.has('soldier') || tr.has('watch') ? 1 : 0) - (tr.has('smith') ? 1 : 0) - (p.people === 'elf' ? 0.3 : 0); break;
    case 'silver': s = 1; break;
    case 'magic': s = (tr.has('scholar') ? 1.2 : 0) - (tr.has('priest') ? 0.6 : 0) - (p.suspicion > 1 ? 0.5 : 0); break;
    case 'faith': s = p.piety - 0.5; break;
    case 'vice': s = (tr.has('veteran') || tr.has('healer') ? 0.6 : -0.4); break;
    case 'vice_hard': s = tr.has('thief') ? 0 : -1.8; break;
    case 'vice_rich': s = tr.has('noble') ? 1 : -0.8; break;
    case 'vice_soft': s = 1; break;
    case 'law': s = (tr.has('watch') ? 1.5 : 0.3) - (tr.has('thief') ? 1.8 : 0); break;
    case 'town': s = id === p.from ? 1.6 : id === 'borschardt' ? -0.4 : id === 'largo' ? (tr.has('thief') ? 1 : -0.5) : id === 'brumandell' ? 0.8 : 0; break;
    case 'squib': s = 1.5; break;
    case 'food': s = 1.2; break;
    case 'wild': s = -0.5 + (tr.has('hunter') ? 1 : 0); break;
    case 'bandits': s = tr.has('thief') ? 0.5 : -1.5; break;
    case 'money': s = tr.has('merchant') ? 1.5 : 0.3; break;
    default: s = 0;
  }
  s += (p.warmth - 0) * 0.1;
  return Math.max(-2, Math.min(2, Math.round(s * 2) / 2));
}

type Bank = { neg: string[]; mid: string[]; pos: string[] };
/** {x} is the thing's name. */
const LINES: Record<string, Bank> = {
  crown: {
    neg: ['The crown? Fifteen years of peace and my taxes doubled. Funny, that.', 'Suomi sends couriers, never coin. The queen\'s peace is the queen\'s business, not mine.', 'I keep my head down when the crown rides through. Heads get counted.'],
    mid: ['The queen keeps the peace. Whatever else you say about her, she keeps it.', 'The crown\'s a long way off, and likes it that way. Suits me.', 'She leaves us alone, we leave her alone. That\'s a good queen, by my measure.'],
    pos: ['Elisiah ended the war with ink, not iron. I\'d drink to her any night.', 'Say what you like about the crown: there\'s bread in the shops and nobody\'s marching. That\'s her doing.', 'The queen is the only reason we\'re not still burying people. Mind how you talk about her.'],
  },
  suomi: {
    neg: ['Suomi people think the world ends at the river.', 'Spires and manners. They\'d sell you your own shadow and call it a favour.', 'I went to Suomi once. Everyone looked at my boots.'],
    mid: ['Suomi\'s grand. Grand and expensive.', 'Pretty city. Couldn\'t live there. Too many stairs, too many opinions.'],
    pos: ['Suomi in spring, with the spires lit up. There\'s nothing like it.', 'Best wine, best music, best fencing schools. Say what you like, Suomi does things properly.'],
  },
  orcs: {
    neg: ['I lost people to orc rifles. I know it was war. I still know it.', 'The treaty says they\'re neighbours. My knees still hurt where an orc put a bullet.'],
    mid: ['Orcs fought on both sides. Honest folk, mostly. Loud.', 'The orc traders from Samopal pay in good coin. That\'s all I need to know.', 'Orcs? They tell you what they think to your face. I\'ll take that over a smiling elf.'],
    pos: ['Best neighbours I ever had were orcs. Loud at weddings, quiet at funerals. Right way round.', 'Grolgar kept his word at the Stone. Not every king does.'],
  },
  elves: {
    neg: ['The elves in Suomi act like the war was something that happened to other people.', 'Elves remember everything, which makes them tiresome at parties and worse at grudges.'],
    mid: ['Elves are elves. They live long and look down. Most of them mean nothing by it.', 'Some elves are kind. Some are just patient. Hard to tell which.'],
    pos: ['Elves built half of what\'s worth looking at in Lahti. Can\'t fault them for it.', 'An elf nursed my father through a fever once. Sat up three nights. I don\'t forget that.'],
  },
  dwarves_folk: { neg: ['Dwarves sold to both sides. Remember that.'], mid: ['Dwarves fix roads and drink. They\'re good at both.'], pos: ['Give me a dwarf on a job any day. They finish what they start, then they finish the barrel.'] },
  goblins: { neg: ['Goblins? Count your spoons.', 'They know every back door in every town. That\'s not a compliment.'], mid: ['Goblins sell mushrooms and know the back roads. Useful folk, if you mind your purse.'], pos: ['The goblins got the worst of the war and nobody talks about it. They\'re tougher than any of us.'] },
  tieflings: { neg: ['Horns make me nervous. I know, I know.'], mid: ['Tieflings are folk like any other. Some folk are nervous about the horns. I\'m not one of them.'], pos: ['I\'ve known good tieflings. Better than most people.'] },
  cult: {
    neg: ['Green candles. If you see them, walk the other way.', 'They find the grieving and sell them their dead back by the candle. That\'s not faith, that\'s a racket.', 'There are more of them than people think. That\'s the trouble.'],
    mid: ['I hear they\'re mostly grieving folk. That doesn\'t make it right, but it makes it sad.', 'Every year somebody new starts a church. This one burns green candles. We\'ll see.'],
    pos: ['They let you see your dead again. Who are you to say that\'s wrong?', 'She\'s kind, in the dreams. Kinder than anyone here.'],
  },
  undead: {
    neg: ['The dead are restless. Something\'s keeping them up, and I don\'t want to meet it.', 'Lock the door at night, and don\'t answer if it knocks.', 'I lie awake counting bells. Then I count the bodies on the road next morning.'],
    mid: ['Silver, fire, or run. That\'s all I know about the dead.', 'The dead were quiet for fifteen years. Something woke them. I\'d like to know what.'],
    pos: ['The dead remember what we forgot. Maybe that\'s not the worst thing.'],
  },
  treaty: {
    neg: ['The treaty\'s paper. Paper burns.', 'Fifteen years. People say the name means it runs out. People are nervous.'],
    mid: ['The treaty\'s held. That\'s more than I expected.', 'Makrovin\'s not the enemy any more. Try telling the old men that.'],
    pos: ['Best thing anyone\'s signed in my lifetime. My son is alive because of that stone.', 'I go to the Treaty Stone every year and leave a flower. Somebody has to say thank you.'],
  },
  war: {
    neg: ['Fifteen years and people still flinch at thunder.', 'Ask anyone over thirty and watch their face. That\'s your answer.', 'I don\'t talk about the war. Nobody does. That\'s how you know.'],
    mid: ['The war was long, then it was over. Now it\'s just in the way people sit near doors.'],
    pos: ['The war taught me who my friends were. That\'s the only good thing I\'ll say about it.'],
  },
  firearms: {
    neg: ['Guns jam. Blades don\'t. You do the arithmetic.', 'Loud, dear and stupid. Like a nobleman.', 'Any idiot can kill with a rifle. That\'s the problem with rifles.'],
    mid: ['A revolver\'s a tool. So\'s a shovel. Depends who\'s holding it.', 'Seven shots and a lot of noise. Handy, when it works.'],
    pos: ['A good rifle never argues. Clean it and it\'ll outlive you.', 'The war would\'ve lasted ten more years without Tokarev rifles. Say what you like.'],
  },
  silver: { neg: ['Silver\'s a rich man\'s answer. Fire\'s cheaper.'], mid: ['Silver bites the dead. Costs a fortune, mind.'], pos: ['A silvered blade is worth every copper. Ask anyone who\'s met a ghoul.'] },
  magic: {
    neg: ['Wizards. They\'ll set your barn on fire and call it research.', 'Magic\'s for people with too much time and not enough sense.'],
    mid: ['Magic is a trade like any other, with worse hours.', 'I\'ve seen a hedge-witch set a bone. I\'ve seen one set a house on fire. Depends.'],
    pos: ['The old court mages could do things nobody can now. That\'s a loss, whatever else they did.'],
  },
  faith: {
    neg: ['The gods went quiet a long time ago. I stopped talking first.'],
    mid: ['The old faith never died. It just got quiet.', 'I light a candle for the Hearth when someone travels. Habit, mostly.'],
    pos: ['The Keeper keeps the dead down. The Hearth keeps the home warm. The Road brings you back. What more do you want from gods?'],
  },
  vice: { neg: ['That stuff hollows people out. I\'ve seen it.'], mid: ['Everybody needs something to get through. Just don\'t need it too much.'], pos: ['Hushmilk got my uncle through his leg. Don\'t knock it.'] },
  vice_hard: { neg: ['Grey Mercy? Gods. Don\'t. I\'ve buried two friends who did.', 'The people on Grey Mercy stop being people. They\'re just hungry.'], mid: ['Bad business, that. Comes up the river in crates marked FISH.'], pos: ['Pays well, if you\'re selling. Not if you\'re buying.'] },
  vice_rich: { neg: ['Frostpetal is for nobles with too much money and not enough to do.'], mid: ['A pinch costs a gold piece. I\'ll stick to ale.'], pos: ['A little Frostpetal makes a dull party sparkle. In moderation, darling.'] },
  vice_soft: { neg: ['Smells like a wet dog.'], mid: ['Thornleaf? Harmless. Makes you hungry and slow.'], pos: ['A pipe of Thornleaf and a quiet evening. That\'s my religion.'] },
  law: {
    neg: ['The watch? They catch the slow ones and miss the clever ones.', 'Laws are for people who can\'t afford lawyers.'],
    mid: ['The watch does its best. Its best isn\'t much, but it\'s something.', 'Strict but fair is the best you\'ll get anywhere.'],
    pos: ['Order is the only thing standing between us and the war coming back.', 'A strong lord keeps the dead out and the thieves honest.'],
  },
  town: {
    neg: ['I\'ve no good word for {x}.', 'Went to {x} once. Came back poorer and none the wiser.'],
    mid: ['It\'s all right, {x}. Wouldn\'t live there.', 'It\'s a place. People there seem to like it.'],
    pos: ['Best place in Lahti. Don\'t tell anyone, they\'ll all move there.', 'I\'ve got a soft spot for {x}. You\'ll see why.'],
  },
  squib: { neg: ['Squib? Big. Quiet. Watches too much.'], mid: ['Squib\'s fair. Pours honest and doesn\'t gossip.'], pos: ['Squib\'s the best man in Breda and he\'d hate to hear me say it.', 'If Squib says sit, you sit. He\'s pulled more people out of trouble than the militia.'] },
  food: { neg: ['I\'ve had better. I\'ve had worse. Mostly better.'], mid: ['The ale\'s honest. The stew is brave.'], pos: ['Grog\'s chowder will change your life. I\'m not joking.', 'Good food is the only thing the war didn\'t ruin.'] },
  wild: { neg: ['Stay out of the wild places. They don\'t want you.', 'Nobody goes into the Mire for fun.'], mid: ['Beautiful, if you like being cold and wet and lost.'], pos: ['I grew up in the woods. The trees are better company than most people.'] },
  bandits: { neg: ['Bandits are deserters who never found their way home. Doesn\'t make them less dangerous.'], mid: ['Pay the toll, keep your eyes down, and you\'ll probably live.'], pos: ['Road tax, they call it. Somebody has to fix the roads.'] },
  money: { neg: ['Money\'s the root of it. All of it.'], mid: ['Everything costs more than it did.', 'Coin is coin. Where it came from is the interesting part.'], pos: ['Money\'s honest. People lie; gold doesn\'t.'] },
  thing: {
    neg: ['{x}? I\'ve no time for it.', 'Don\'t get me started on {x}.'],
    mid: ['{x}? Couldn\'t care either way, honestly.', 'I\'ve heard about {x}. Haven\'t made my mind up.'],
    pos: ['{x}? I like it. Can\'t say fairer than that.', 'Good things, mostly, about {x}.'],
  },
};

export function opinionLine(id: string, name: string, stance: number, pickOne: <T>(a: T[]) => T): string {
  const b = LINES[groupOf(id)] ?? LINES.thing;
  const list = stance <= -1 ? b.neg : stance >= 1 ? b.pos : b.mid;
  const nm = name.replace(/^the /, '');
  return pickOne(list).replace(/\{x\}/g, (_m: string, off: number) => (off === 0 ? nm.charAt(0).toUpperCase() + nm.slice(1) : nm));
}
