// What you can hear, smell and see right now: built from the place, the hour, the weather and
// who's around, so the answer changes with the moment.
import type { Ctx } from '../content/types';
import type { World } from './actions';
import { pick } from './dice';
import { crowdHere, weather } from './dm';
import { ROOMS } from '../content/world';

export function senses(c: Ctx, w: World, kind: 'hear' | 'smell' | 'see'): void {
  const crowd = crowdHere(c.s.loc);
  const r = ROOMS[c.s.loc];
  const tod = c.timeOfDay();
  const night = tod === 'night' || tod === 'midnight';
  const wx = weather(c);
  const ppl = w.presentNpcs(c).filter((id) => id !== 'kettle');
  const dwarves = ppl.includes('dwarves'), kettle = w.presentNpcs(c).includes('kettle');
  const out: string[] = [];
  if (kind === 'hear') {
    if (crowd === 'tavern') {
      out.push(pick(c.rng, ['The fire cracks and settles.', 'Mugs knock on wood.', 'A bench scrapes.', 'Someone laughs too loud at the far end.']));
      if (dwarves) out.push(pick(c.rng, ['The dwarves are arguing about the size of a boar.', 'Borin is losing a bet loudly.']));
      if (ppl.includes('whisperers')) out.push('From the window table, low voices: "...north side, every one of them..."');
      if (ppl.length > 1 || !c.s.loc.startsWith('town')) out.push(pick(c.rng, ['Two farmers are complaining about the price of seed.', 'A woman at the bar is telling someone her cousin saw lights on the old road.', 'Somebody behind you mutters "green candles" and then goes quiet.', 'A traveller is asking the way to Galilin.']));
    } else if (crowd === 'square' || crowd === 'market') {
      out.push(night ? pick(c.rng, ['A shutter bangs somewhere.', 'A dog barks twice and stops.', 'The watch\'s boots on the cobbles, far off.']) : pick(c.rng, ['Hammering from a forge.', 'A hawker crying apples, two copper.', 'Cartwheels on stone.', 'Children chasing a hoop.']));
      out.push(pick(c.rng, ['Pigeons.', 'Someone haggling, badly.', 'A snatch of a marching song from an open window.']));
    } else if (r?.outdoors) {
      out.push(night ? pick(c.rng, ['An owl, close by.', 'Something moving in the undergrowth, then nothing.', 'The wind in the trees.']) : pick(c.rng, ['Birds, and the wind.', 'Running water somewhere off to your left.', 'Your own boots, and not much else.']));
      if (/rain|storm/.test(wx.word)) out.push('Rain hissing on leaves.');
    } else out.push(pick(c.rng, ['Dripping water.', 'Your own breathing, loud in the quiet.', 'Something settling in the dark. Stone, probably.']));
    if (c.hour() === 0 && !c.flag('bell_silenced') && !c.flag('not_bells')) out.push('And far off, from the hills: a bell. Slow. Wrong.');
  } else if (kind === 'smell') {
    if (crowd === 'tavern') { out.push(pick(c.rng, ['Woodsmoke and spilled ale.', 'Stew that\'s been going for years.', 'Pipe smoke, sweet: someone\'s got good Thornleaf.'])); if (kettle) out.push('Wet dog. Kettle.'); if (/brumandell/.test(c.s.loc)) out.push('Clam chowder. Of course.'); }
    else if (crowd === 'square' || crowd === 'market') out.push(pick(c.rng, ['Horse, bread and woodsmoke.', 'Fresh bread from somewhere, and something less fresh from the gutter.', 'Hot iron from the smithy.']));
    else if (r?.outdoors) out.push(pick(c.rng, ['Pine and wet earth.', 'Grass, and rain on the way.', /mire|swamp|marsh/.test(r.name.toLowerCase()) ? 'Rot and still water.' : 'Cold air. Clean, for once.']));
    else out.push(pick(c.rng, ['Damp stone and old dust.', 'Mould. And under it, something sweeter, like old candles.']));
    if (c.pc.drunk >= 3) out.push('Mostly, you smell of ale.');
  } else {
    out.push(r?.desc(c) ?? 'Not much.');
  }
  out.push(`(${tod === 'midnight' ? 'Midnight' : tod.charAt(0).toUpperCase() + tod.slice(1)}. ${wx.line})`);
  c.narr(out.join(' '));
}

/** One small thing going on around you, for when you stop and take it in. */
export function ambientLine(c: Ctx, w: World): string {
  const crowd = crowdHere(c.s.loc);
  const ppl = w.presentNpcs(c);
  const night = ['night', 'midnight'].includes(c.timeOfDay());
  if (crowd === 'tavern') return pick(c.rng, [
    'At the next table, someone is telling a story about a goat and a bishop. It gets worse.',
    ppl.includes('dwarves') ? 'The dwarves start a drinking song. Tokk gets the words wrong and is shouted down.' : 'Somebody starts a drinking song. It dies after one verse.',
    'A traveller comes in shaking rain off her coat and asks if the road north is open.',
    'Two men argue in low voices about money. One of them keeps looking at the door.',
    'The fire pops. A log settles. For a moment the whole room is quiet, and then it isn\'t.',
    ppl.includes('kettle') ? 'Kettle wanders over, sniffs your boots, and lies down on them.' : 'A cat threads between the table legs, looking for scraps.',
    'Someone by the hearth says the word "candles" and the people near him go quiet.',
  ]);
  if (crowd === 'square' || crowd === 'market') return night ? pick(c.rng, ['A lamp gutters. The square is empty except for you and one watchman.', 'Somewhere a door closes, and a bolt slides home.']) : pick(c.rng, ['A cart loses a wheel and three people shout advice.', 'A child sells you nothing, very persistently.', 'Two old men play draughts on an upturned barrel.']);
  return pick(c.rng, ['The wind shifts.', 'A bird calls, and another answers.', 'Nothing moves. You let yourself breathe.']);
}
