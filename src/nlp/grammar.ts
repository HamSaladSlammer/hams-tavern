// A tiny Tracery-style grammar: "#symbol#" expands to a random rule; "{name}" fills a variable.
import { pick, type Rng } from '../engine/dice';

export type Grammar = Record<string, string[]>;

export function expand(rng: Rng, g: Grammar, start: string, vars: Record<string, string> = {}, depth = 0): string {
  const rules = g[start];
  let s = rules ? pick(rng, rules) : start;
  if (depth > 8) return s;
  s = s.replace(/#([a-zA-Z_]+)#/g, (_, sym) => expand(rng, g, sym, vars, depth + 1));
  s = s.replace(/\{([a-zA-Z_]+)\}/g, (_, v) => vars[v] ?? '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Narration for strikes. Keyed by limb so a kick never reads like a punch.
export const STRIKES: Grammar = {
  hit_fist: ['you drive a fist into {target}\'s {spot}', 'your knuckles crack against {target}\'s {spot}', 'you land a {verb} square on {target}\'s {spot}', 'you put your whole shoulder into a {verb} that rocks {target}'],
  miss_fist: ['your {verb} whistles past {target}', '{target} sways and your fist finds only air', 'you swing wide and nearly lose your footing'],
  hit_foot: ['your boot slams into {target}\'s {spot}', 'you plant a {verb} in {target}\'s {spot} and feel something give', 'you {verb} {target} hard enough to stagger it'],
  miss_foot: ['your {verb} catches nothing but air', '{target} twists aside and your foot thumps the ground', 'you kick, slip, and recover with no dignity at all'],
  hit_knee: ['you drive a knee up into {target}\'s {spot}', 'your knee connects with an ugly thud'],
  miss_knee: ['your knee finds only air', '{target} turns and your knee glances off'],
  hit_elbow: ['your elbow cracks across {target}\'s {spot}', 'you whip an elbow into {target}\'s {spot}'],
  miss_elbow: ['your elbow misses by an inch', 'you throw the elbow too early'],
  hit_head: ['you slam your forehead into {target}\'s {spot}. Stars, for both of you', 'your headbutt lands with a sound like a dropped melon'],
  miss_head: ['you lunge forehead-first and headbutt the air', '{target} pulls back and your headbutt falls short'],
  hit_teeth: ['you sink your teeth into {target}\'s {spot}. It tastes exactly as bad as you feared', 'you bite down hard on {target}\'s {spot}'],
  miss_teeth: ['your teeth snap shut on nothing', 'you go for a bite and get a mouthful of air'],
  hit_palm: ['the slap rings out like a gunshot across {target}\'s {spot}', 'you backhand {target} across the {spot}'],
  miss_palm: ['your slap whiffs, which is somehow worse than missing a punch', '{target} leans away from the slap'],
  hit_finger: ['you jab two fingers straight into {target}\'s {spot}', 'your poke lands right where it hurts'],
  miss_finger: ['you poke at {target} and poke nothing', 'your finger jab misses'],
  hit_hand: ['your knife-hand chop cracks against {target}\'s {spot}', 'you chop down on {target}\'s {spot}'],
  miss_hand: ['your chop cuts nothing but air', '{target} slips the chop'],
  hit_nails: ['you rake your nails across {target}\'s {spot}', 'you claw at {target} and draw a line of hurt'],
  miss_nails: ['your nails scrape at nothing'],
  hit_body: ['you hurl your whole body into {target} and you both go down hard', 'you hoist {target} and slam it into the ground'],
  miss_body: ['you throw yourself at {target} and hit the floor alone'],
  hit_arm: ['your arm catches {target} across the {spot} and folds it in half', 'you clothesline {target} clean off its feet'],
  miss_arm: ['you swing your arm out and {target} ducks under it'],
  spot: ['jaw', 'ribs', 'gut', 'temple', 'chest', 'nose', 'shoulder', 'side'],
  undead_spot: ['jaw', 'ribs', 'skull', 'sternum', 'collarbone', 'brow', 'cheekbone'],
};

export const WEAPON_HITS: Grammar = {
  hit_melee: ['your {weapon} bites into {target}', 'you {verb} {target} with your {weapon}', 'your {weapon} catches {target} across the {spot}', 'you land a solid blow on {target} with your {weapon}'],
  miss_melee: ['your {weapon} glances off', '{target} turns your {weapon} aside', 'you overreach and your {weapon} hits nothing'],
  hit_ranged: ['the shot takes {target} in the {spot}', 'your {weapon} barks and {target} jerks back', 'you squeeze the trigger and {target} staggers'],
  miss_ranged: ['the shot whines off stone', 'you fire and miss; the echo goes on for a long time', 'your round buries itself in the wall'],
  hit_bow: ['your arrow thuds into {target}\'s {spot}', 'the arrow takes {target} high in the {spot}'],
  miss_bow: ['the arrow hisses past {target}', 'your arrow skips off the ground'],
  spot: ['shoulder', 'side', 'chest', 'arm', 'leg', 'ribs'],
};

export const FLAVOR: Grammar = {
  zombie_down: ['the zombie folds up like wet laundry', 'it falls and, finally, stays down', 'the zombie topples, and the grave smell goes with it'],
  skeleton_down: ['the skeleton comes apart in a clatter of bone', 'its bones spill across the floor and lie still', 'the skull rolls away, jaw still working, then stops'],
  wolf_down: ['the wolf yelps once and lies still', 'the wolf drops and does not get up'],
  other_down: ['{target} goes down and stays down', '{target} collapses'],
  undead_fortitude: ['it should be down. It isn\'t. The {target} drags itself up with a sound like snapping celery', 'the {target} staggers, sags, and refuses to die a second time'],
  enemy_miss: ['{target} lunges and misses', '{target} swings wide', 'you twist away from {target}', 'your armour turns {target}\'s blow'],
};
