// "Try anything." When the player does something the story scripts don't cover, this module
// works out what they're doing, what they're doing it to, whether that thing exists (the oracle
// decides), which skill it takes, and what happens. It also owns drinking, eating and props.
import { ambientLine } from './senses';
import type { Ctx, Npc, Feature } from '../content/types';
import { ROOMS } from '../content/world';
import { aftermath } from './dm';
import { ROOM_PROPS, PLAUSIBLE, roomKind, tagsFor, itemFor, type PropDef } from '../content/props';
import { die, pick, roll } from './dice';
import { askOracle, type Odds } from './oracle';
import { ITEMS } from './srd';
import type { Ability, PropState, Skill, Stack } from './types';
import { hasFeat, hasItem, removeItem, addItem, am, prof, species, itemName } from './character';

export interface World {
  matchNpc(c: Ctx, name?: string): Npc | null;
  matchFeature(c: Ctx, name: string): Feature | null;
  matchInventory(c: Ctx, name: string): Stack | null;
  presentNpcs(c: Ctx): string[];
  say(c: Ctx, text: string, to?: string): void;
  npcName(id: string): string;
  npcNames(id: string): string[];
}

// ---------- props ----------
export interface FoundProp { def: PropDef | null; state: PropState; spawned: boolean }

const ODD_THINGS = /dragon|cannon|gold bar|treasure|crown|throne|airship|horse|unicorn|elephant|piano|bazooka|machine gun|grenade|tank|ship|boat|sword of|magic|wand|staff of|god|demon|angel|lich|queen|king|portal|door to/;

function propsHere(c: Ctx): { def: PropDef | null; state: PropState }[] {
  const loc = c.s.loc;
  const states = (c.s.props[loc] ??= []);
  const out: { def: PropDef | null; state: PropState }[] = [];
  for (const d of ROOM_PROPS[loc] ?? []) {
    let st = states.find((x) => x.id === d.id);
    if (!st) st = { id: d.id, name: d.name, tags: d.tags };
    out.push({ def: d, state: st });
  }
  for (const st of states) if (st.spawned) out.push({ def: null, state: st });
  return out.filter((p) => !p.state.gone);
}

function stateFor(c: Ctx, p: { def: PropDef | null; state: PropState }): PropState {
  const states = (c.s.props[c.s.loc] ??= []);
  let st = states.find((x) => x.id === p.state.id);
  if (!st) { st = { ...p.state }; states.push(st); }
  return st;
}

const norm = (s: string) => s.toLowerCase().replace(/^(the|a|an|some|my|that|this|your)\s+/, '').replace(/s$/, '').trim();

export function findProp(c: Ctx, noun: string, allowSpawn = true, quiet = false): FoundProp | null {
  const n = noun.toLowerCase().replace(/^(the|a|an|some|my|that|this|your)\s+/, '').trim();
  if (!n) return null;
  const here = propsHere(c);
  const hit = here.find((p) => (p.def?.names ?? [p.state.name]).some((x) => x === n || norm(x) === norm(n))) ??
    here.find((p) => (p.def?.names ?? [p.state.name]).some((x) => (x.length > 2 && n.includes(x)) || (n.length > 3 && x.includes(n))));
  if (hit) return { def: hit.def, state: stateFor(c, hit), spawned: false };
  if (!allowSpawn) return null;
  // Not listed. Ask the oracle whether it's here.
  const key = `noprop_${c.s.loc}_${norm(n)}`;
  if (c.flag(key)) return null; // already asked and the answer was no
  const r = ROOMS[c.s.loc];
  const kind = roomKind(c.s.loc, !!r?.outdoors);
  const plaus = PLAUSIBLE[kind] ?? [];
  const word = norm(n).split(' ').pop() ?? n;
  let odds: Odds = 'unlikely';
  const structural = /^(wall|walls|floor|ground|ceiling|roof|air|sky|door|corner|dirt|earth|shadow|shadows|light|dark|darkness)$/.test(word) && !(r?.outdoors && /ceiling|roof|floor/.test(word)) && !(!r?.outdoors && /sky|earth/.test(word));
  if (structural) { const st: PropState = { id: `spawn_${word}`, name: n, tags: tagsFor(n), spawned: true }; if (/wall|door/.test(word)) st.tags.push('climb'); (c.s.props[c.s.loc] ??= []).push(st); return { def: null, state: st, spawned: false }; }
  if (plaus.some((p) => p === word || norm(p) === word || n.includes(p))) odds = 'very likely';
  else if (ODD_THINGS.test(n)) odds = 'very unlikely';
  else if (n.split(' ').length > 3) odds = 'very unlikely';
  const a = askOracle(c.rng, odds, c.s.chaos);
  if (!quiet) c.out('roll', `🔮 Is there ${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n} here? (${a.chance}%): ${a.answer}.`);
  if (a.answer === 'No' || a.answer === 'Exceptional no') { c.set(key, true); return null; }
  const st: PropState = { id: `spawn_${norm(n).replace(/\W+/g, '_')}_${die(c.rng, 9999)}`, name: n, tags: tagsFor(n), spawned: true };
  (c.s.props[c.s.loc] ??= []).push(st);
  if (a.answer === 'Exceptional yes') st.tags.push('fine');
  return { def: null, state: st, spawned: true };
}

const propName = (p: FoundProp) => p.def?.name ?? p.state.name;
const propHas = (p: FoundProp, tag: string) => p.state.tags.includes(tag) || !!p.def?.tags.includes(tag);

// ---------- drinking & eating ----------
const ALCOHOL: Record<string, number> = { mug_ale: 1, mug_stout: 2, cider: 1, wine: 2, trenchfire_shot: 2, black_label: 1 };
const AFTER_DRINK: Record<string, string | undefined> = { mug_ale: 'mug_empty', mug_stout: 'mug_empty', wine: 'bottle_empty' };
const DRINK_LINES: Record<string, string[]> = {
  mug_ale: ['You drink. Barrel Brown: brown, cold enough, and honest. It goes down like it was waiting for you.', 'You take a long pull of Barrel Brown. Somewhere, the road gets a little shorter.', 'The ale is malty and plain and exactly right.'],
  mug_stout: ['Dwarven stout, black as a mineshaft. You chew more than drink. The dwarves nod with deep approval.'],
  cider: ['Brumandell cider: apples and sunshine, and then the kick.'],
  wine: ['Galilin red, rough and generous. Your cheeks warm.'],
  trenchfire_shot: ['Trenchfire. It tastes like regret and lamp oil. Your eyes water, your ears ring, and for one second you can see through time.'],
  water_cup: ['Cold, clean water. You feel more like a person.'],
};

export function drunkWord(n: number) { return n <= 0 ? 'sober' : n === 1 ? 'warm' : n === 2 ? 'tipsy' : n === 3 ? 'drunk' : n === 4 ? 'very drunk' : 'blind drunk'; }

function drinkStack(c: Ctx, id: string) {
  const pc = c.pc;
  removeItem(pc, id, 1);
  const after = AFTER_DRINK[id];
  if (after) addItem(pc, after, 1);
  c.s.lastObject = after ? ITEMS[after].name.toLowerCase() : null;
  c.narr(pick(c.rng, DRINK_LINES[id] ?? ['You drink it.']));
  const alc = ALCOHOL[id] ?? 0;
  if (id === 'water_cup' && pc.drunk > 0) { pc.drunk = Math.max(0, pc.drunk - 1); c.sys(`You feel a little clearer. (${drunkWord(pc.drunk)})`); }
  if (!alc) return;
  // dwarves and orcs and goliaths hold their drink
  const sturdy = ['dwarf', 'orc', 'goliath', 'dwarf_hill'].includes(pc.species) || species(pc).resist?.includes('poison');
  const gain = sturdy && alc > 0 && die(c.rng, 2) === 1 ? alc - 1 : alc;
  const before = pc.drunk;
  pc.drunk = Math.min(6, pc.drunk + gain);
  c.set('drank_at', c.s.minutes);
  if (pc.hp < pc.maxHp && id !== 'trenchfire_shot' && before < 2) pc.hp = Math.min(pc.maxHp, pc.hp + 1);
  if (id === 'trenchfire_shot' && c.s.loc === 'tavern') { c.npc('dwarves').disposition += 1; c.narr('The dwarf table erupts. "ONE OF US! ONE OF US!"'); }
  if (pc.drunk !== before) c.sys(`You're ${drunkWord(pc.drunk)}.${pc.drunk === 2 ? ' (+1 to Performance and Intimidation.)' : pc.drunk === 3 ? ' (Disadvantage on attacks; -2 on Dexterity skills.)' : ''}`);
  if (pc.drunk >= 5) passOut(c);
  else if (pc.drunk === 4 && before < 4) c.narr(pick(c.rng, ['The floor has developed opinions.', 'You tell someone you love them. It may have been a coat rack.', 'Everything is very funny and slightly tilted.']));
}

function passOut(c: Ctx) {
  const pc = c.pc;
  c.out('title', 'Blackout');
  if (c.s.loc === 'tavern') {
    c.narr('The room tilts gently sideways, and so do you. The last thing you remember is Squib\'s enormous hand catching your head before it hits the table, and his voice, very soft: "There we go. Floor by the hearth. On the house."');
  } else {
    c.narr('You sit down, which is a mistake, and then lie down, which is a bigger one. The stars spin. Then nothing.');
  }
  const nowMin = (c.s.minutes + 480) % 1440;
  let until = (7 * 60 - nowMin + 1440) % 1440;
  if (until < 4 * 60) until = 6 * 60;
  c.advance(until);
  pc.drunk = 1;
  pc.hp = Math.max(1, pc.hp);
  if (c.s.loc !== 'tavern' && pc.copper > 0 && die(c.rng, 3) === 1) { const lost = Math.min(pc.copper, 50 + die(c.rng, 100)); pc.copper -= lost; c.bad(`You wake with a head like a kicked bucket and a lighter purse.`); }
  else c.narr('You wake with a head like a kicked bucket, a mouth like the bottom of a birdcage, and no clear memory of the song you apparently sang.');
  c.sys('You slept it off. (No rest benefits: you didn\'t so much sleep as stop.)');
}

/** Sober up over time; called from the clock. */
export function soberUp(c: Ctx, minutes: number) {
  const pc = c.s.pc;
  if (!pc || pc.drunk <= 0) return;
  const at = (c.flag('sober_clock') as number) || 0;
  const t = at + minutes;
  const steps = Math.floor(t / 60);
  c.set('sober_clock', t % 60);
  if (steps > 0) { const was = pc.drunk; pc.drunk = Math.max(0, pc.drunk - steps); if (was >= 2 && pc.drunk < 2) c.sys('The drink wears off.'); }
}

export function drink(c: Ctx, w: World, thing: string) {
  const pc = c.pc;
  const t = thing.toLowerCase().replace(/^(from|out of|of|the|my|a|an|some)\s+/g, '').trim();
  const isIt = !t || /^(it|that|this|drink|one|up|deep|heavily|a lot|again|more)$/.test(t);
  // 1. something in your pack
  const drinks = pc.inventory.filter((s) => ITEMS[s.id]?.kind === 'drink' || s.id === 'black_label');
  let st = isIt ? (drinks.find((s) => c.s.lastObject && (ITEMS[s.id].name.toLowerCase().includes(c.s.lastObject) || ITEMS[s.id].aliases?.includes(c.s.lastObject))) ?? drinks[0]) : null;
  if (!st && !isIt) {
    const m = w.matchInventory(c, t);
    if (m && (ITEMS[m.id]?.kind === 'drink' || m.id === 'black_label')) st = m;
    else if (m && ITEMS[m.id]?.kind === 'potion') return 'potion';
    else if (m && (m.id === 'mug_empty' || m.id === 'bottle_empty')) { c.narr(`The ${ITEMS[m.id].name.toLowerCase()} is empty. You tip it back anyway and get one sad drop.`); if (c.s.loc === 'tavern') c.sys('("buy ale" for a refill.)'); return true; }
    else if (!m && /mug|ale|beer|pint|tankard|drink/.test(t)) st = drinks.find((s) => /mug|ale|stout|cider/.test(s.id)) ?? null;
  }
  if (st) {
    if (st.id === 'black_label') return 'use';
    drinkStack(c, st.id);
    return true;
  }
  // 2. something in the room: a well, a stream, the bottles behind the bar
  const prop = !isIt ? findProp(c, t, false) : propsHere(c).map((p) => ({ def: p.def, state: p.state, spawned: false })).find((p) => propHas(p, 'drink'));
  if (prop && propHas(prop, 'drink')) {
    const nm = propName(prop);
    if (prop.state.id === 'bottles') {
      if (w.presentNpcs(c).includes('squib')) { c.say('squib', 'A hand the size of a shovel lands flat on the bottle before you can reach it. "Those are for people I like. Barrel Brown\'s five copper."'); return true; }
    }
    if (/trough/.test(nm)) { c.narr('You drink from the horse trough. The frog watches. It is not your proudest moment, but you are less thirsty.'); return true; }
    if (/quench/.test(nm)) { c.narr('You drink the quench water. It tastes of iron and a hundred hot blades. Mother Dreyse stares. "...That\'s not for drinking." (You\'ll live.)'); return true; }
    if (/stream|brook|creek|river|water|well|bucket|puddle/.test(nm)) { c.narr(pick(c.rng, ['You cup your hands and drink. Cold enough to ache your teeth.', 'You drink deep. It tastes of stone and rain.'])); if (pc.drunk > 0) pc.drunk -= 1; return true; }
    c.narr(`You drink from the ${nm}. It's... a choice.`);
    return true;
  }
  // 3. you're in the tavern: Squib will sell you one
  if (c.s.loc === 'tavern' && w.presentNpcs(c).includes('squib') && !c.npc('squib').banned) {
    const what = /stout/.test(t) ? 'mug_stout' : /cider/.test(t) ? 'cider' : /wine|red/.test(t) ? 'wine' : /trench|shot|rotgut|whisk/.test(t) ? 'trenchfire_shot' : /water/.test(t) ? 'water_cup' : 'mug_ale';
    const price = ITEMS[what].price;
    if (!c.pay(price)) { c.say('squib', `"${ITEMS[what].name}\'s ${price} copper." He waits. You can't.`); return true; }
    c.narr(`${price ? `You put ${price} copper on the bar. ` : ''}Squib slides you a ${ITEMS[what].name.toLowerCase().replace(/^mug of /, 'mug of ')}.`);
    addItem(pc, what, 1);
    drinkStack(c, what);
    return true;
  }
  if (!isIt && w.matchNpc(c, t)) { c.narr('You can\'t drink a person. Not in this version.'); return true; }
  c.narr(isIt ? 'You have nothing to drink.' : `There's no ${t} here to drink.`);
  if (pc.inventory.some((s) => s.id === 'potion_healing')) c.sys('(You do have a healing potion: "drink potion".)');
  return true;
}

const EAT_LINES: Record<string, string> = {
  rations: 'Hard bread, harder cheese, a sad apple. Fuel.', apple: 'Crisp, a little bruised, very good.', egg: 'You crack it and drink it raw. Somebody, somewhere, is impressed.',
  goodberry: 'The berry bursts with warm magic.',
};

export function eat(c: Ctx, w: World, thing: string) {
  const pc = c.pc;
  const t = thing.toLowerCase().replace(/^(the|my|a|an|some)\s+/g, '').trim();
  const foods = pc.inventory.filter((s) => ITEMS[s.id]?.kind === 'food');
  let st = !t || /^(it|that|something|food|a meal|dinner|lunch|breakfast)$/.test(t) ? foods[0] : w.matchInventory(c, t);
  if (st && ITEMS[st.id]?.kind !== 'food') { c.narr(`You gnaw on the ${ITEMS[st.id].name.toLowerCase()}. Your teeth lose.`); return; }
  if (st) {
    removeItem(pc, st.id, 1);
    if (st.id === 'mushroom') { mushroom(c); return; }
    c.narr(EAT_LINES[st.id] ?? 'You eat. It helps.');
    const h = st.id === 'goodberry' ? 1 : st.id === 'rations' ? 2 : 1;
    if (pc.hp < pc.maxHp) { pc.hp = Math.min(pc.maxHp, pc.hp + h); c.sys(`+${h} HP (${pc.hp}/${pc.maxHp}).`); }
    if (pc.drunk > 0 && st.id === 'rations') pc.drunk -= 1;
    return;
  }
  const prop = t ? findProp(c, t, true) : null;
  if (prop && propHas(prop, 'eat')) {
    const it = prop.def?.item ?? itemFor(propName(prop));
    if (it === 'mushroom') { mushroom(c); return; }
    c.narr(`You eat the ${propName(prop)}. ${pick(c.rng, ['Not bad.', 'Better than rations.', 'Surprisingly good.'])}`);
    if (pc.hp < pc.maxHp) pc.hp += 1;
    return;
  }
  if (c.s.loc === 'tavern' && w.presentNpcs(c).includes('squib')) { c.sys('Squib\'s got stew (5 cp), meat pie (8 cp) or roast chicken (25 cp). "buy stew".'); return; }
  if (prop) { c.narr(`You take a bite of the ${propName(prop)}. You regret it immediately.`); return; }
  c.narr(t ? `There's no ${t} to eat.` : 'You have nothing to eat.');
}

function mushroom(c: Ctx) {
  const pc = c.pc;
  if (pc.skills.includes('nature') || pc.skills.includes('survival') ? c.check('nature', 10) : c.check('nature', 14)) { c.narr('You check the gills first: not Widow\'s Cap. It\'s a meadow-cap, earthy and good.'); if (pc.hp < pc.maxHp) pc.hp += 1; return; }
  c.narr('It tastes of earth, then of nothing, then of colours. The trees lean in to listen to you. For about an hour you are absolutely certain the moon is following you personally.');
  const d = roll(c.rng, '1d4').total;
  pc.hp = Math.max(1, pc.hp - d);
  c.bad(`Widow's Cap. ${d} poison damage, and you lose an hour.`);
  c.advance(60);
}

// ---------- the free-action resolver ----------
interface Rule {
  re: RegExp;
  skill?: Skill | Ability | ((c: Ctx, obj: string) => Skill | Ability);
  dc?: number | ((c: Ctx, obj: string, p: FoundProp | null) => number);
  need?: string; // a prop tag the object should have
  needObj?: boolean;
  mins?: number;
  ok?: string[];
  fail?: string[];
  run?: (c: Ctx, w: World, obj: string, p: FoundProp | null, np: Npc | null, raw: string) => boolean | void; // custom; return false to fall back to generic
}

const you = (raw: string) => raw.trim().replace(/[.!]+$/, '')
  .replace(/^(i want to|i'd like to|i try to|i attempt to|i'll|i will|let me|try to|attempt to|i|please|can i|could i)\s+/i, '')
  .replace(/\bmyself\b/gi, 'yourself').replace(/\bmy\b/gi, 'your').replace(/\bme\b/gi, 'you').replace(/\bmine\b/gi, 'yours').replace(/\bi'm\b/gi, 'you\'re').replace(/\bi\b/g, 'you');
const sentence = (raw: string) => { const s = you(raw); return 'You ' + s.charAt(0).toLowerCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.'); };

function tavernFrown(c: Ctx, w: World, what: string, cost = 0) {
  if (c.s.loc !== 'tavern' || !w.presentNpcs(c).includes('squib')) return;
  const m = c.npc('squib');
  m.disposition -= 1;
  if (cost && c.pc.copper >= cost) { c.pay(cost); c.say('squib', `Squib looks at the ${what}, then at you. He holds out his hand. You put ${cost} copper in it. "Thank you."`); }
  else c.say('squib', `Squib looks at the ${what}, then at you, for a long time. "Don't."`);
}

const LORE: [RegExp, Skill, number, string][] = [
  [/bell|chapel|toll/, 'religion', 12, 'Old Lahti chapels rang their bells at midnight to "sing the dead to sleep". The custom stopped after the war, when nobody was left to ring them.'],
  [/queen|pale|crown|vessariel|lich/, 'history', 15, 'Lahti had a queen before the civil war, and something odd is true of her: the records disagree on her name. Every portrait of her was burned in the same year.'],
  [/war|greymarch|treaty|makrovin/, 'history', 10, 'The civil war split Lahti from Makrovin and ended fifteen years ago with the Treaty Stone. Greymarch Field was the last battle. Both sides claim they won it.'],
  [/undead|zombie|skeleton|dead|ghoul/, 'religion', 12, 'The walking dead of Lahti don\'t rot the way they should. Old priests said it\'s because something is keeping them, the way you keep a promise.'],
  [/thornwood|forest|wood|wolf|wolves/, 'nature', 10, 'The Thornwood is old growth: oak, blackthorn, and wolves that run in sixes. The bone charms in the trees are a peasant ward against "the walking hunger".'],
  [/silver|weapon|blade/, 'arcana', 10, 'Silvered weapons bite things that shrug off steel. The Tokarev works silver blades for a hundred gold.'],
  [/magic|spell|sorcer|treaty-fire|treaty fire/, 'arcana', 12, 'Sorcery came into Kalashscovia\'s bloodlines during the war, when the treaty mages burned things that should not have burned. People call it treaty-fire.'],
  [/barrel|smoking barrel|squib/, 'history', 14, 'Squib was a stretcher-bearer at Greymarch. The scorched barrel came home with him. Some say it held the fire that ended the battle.'],
  [/god|gods|keeper|hearth|faith/, 'religion', 10, 'The old faith of Lahti honours the Keeper of the Last Light, the Hearth-Mother, the Road-Walker and the Old Ones in the stone. Most chapels have been empty since the war.'],
];

const RULES: Rule[] = [
  // resting your body
  { re: /^(sit|sit down|take a seat|have a seat|perch|plop down|lie down|lay down|lie|recline|lean|lean against|lean on|kneel|crouch|squat|stand|stand up|get up|stretch|yawn|relax|chill|lounge)\b/, run: (c, w, obj, p) => {
    const nm = p ? propName(p) : obj;
    if (/stand|get up/.test(c.flag('raw_low') as string)) { c.narr('You get to your feet.'); return; }
    if (p && /^(bar|counter|bar top)$/.test(nm) && /sit|perch/.test(c.flag('raw_low') as string)) { c.narr('You hop up onto the bar. Squib looks at you until you hop back down.'); return; }
    if (p || obj) { c.narr(`${sentence(c.flag('raw') as string)} ${ambientLine(c, w)}`); return; }
    c.narr(sentence(c.flag('raw') as string) + ' ' + ambientLine(c, w));
  } },
  { re: /^(climb down|get down|jump down|hop down|come down)\b/, run: (c) => { c.set('perched', ''); c.narr('You drop back down to the ground.'); } },
  { re: /^(climb|scale|clamber|shimmy|scramble up|climb up|climb onto|climb on|get on|get onto|stand on|hop onto|jump onto)\b/, skill: 'athletics', needObj: true, dc: (c, o, p) => (/rafter|palisade|wall|tower|cliff|roof|dome/.test(o) ? 13 : /tree/.test(o) ? 10 : /table|bar|cart|stool|chair|bench|pew|crate|barrel|rock|boulder/.test(o) ? 5 : 11),
    ok: ['You haul yourself up. The view is better.', 'Up you go, clean and quick.'], fail: ['You get halfway, slip, and land hard on your backside.', 'Your grip goes and you slide back down, scraping a knuckle.'],
    run: (c, w, obj, p, np, raw) => {
      if (np) { c.narr(`${np.name} does not want to be climbed.`); return; }
      const ok = c.check('athletics', /table|bar|stool|chair|bench|pew|crate|barrel|cart|rock/.test(obj) ? 5 : /rafter|palisade|wall|roof|dome/.test(obj) ? 13 : 10);
      c.narr(ok ? `You climb ${/onto|on/.test(raw) ? 'onto' : 'up'} the ${p ? propName(p) : obj}. ${pick(c.rng, ['The view is better from here.', 'You feel very tall.', 'Somebody points at you.'])}` : pick(c.rng, ['You get halfway, slip, and land hard on your backside.', 'Your grip goes and you slide back down, scraping a knuckle.']));
      if (ok && /table|bar/.test(obj) && c.s.loc === 'tavern') { if (/bar/.test(obj)) tavernFrown(c, w, 'boots on his bar'); else c.narr('The dwarves start a slow clap. Someone shouts "SPEECH!"'); }
      if (!ok) { c.pc.hp = Math.max(1, c.pc.hp - (/rafter|palisade|wall|roof|tree|dome/.test(obj) ? 1 : 0)); }
      if (ok && /rafter|tree|roof|dome/.test(obj)) { c.set('perched', c.s.loc); c.sys('You\'re up high. ("climb down" when you\'re done.)'); }
    } },
  { re: /^(jump|leap|vault|hop|bound)\b/, skill: 'athletics', dc: (c, o) => (/over|across|gap|stream|wall|fence|table/.test(o) ? 10 : 5), ok: ['You land it, light as a cat.', 'Clean. You even stick the landing.'], fail: ['You catch a foot and go sprawling.', 'You jump. Gravity has notes.'] },
  { re: /^(swim|wade|bathe|wash|dive|take a bath|go for a swim|splash)\b/, skill: 'athletics', dc: 8, run: (c, w, obj, p) => {
    const water = p && propHas(p, 'water') || propsHere(c).some((x) => x.state.tags.includes('water'));
    if (!water) { c.narr(/wash/.test(c.flag('raw_low') as string) ? 'You give yourself a quick wash with a rag and spit. It helps a little.' : 'There\'s no water here deep enough for that.'); return; }
    if (/wash|bathe|splash/.test(c.flag('raw_low') as string)) { c.narr('You wash off the road. The cold is a shock, then a mercy.'); if (c.pc.drunk > 0) c.pc.drunk -= 1; c.advance(10); return; }
    c.narr(c.check('athletics', 8) ? 'You swim a few strokes in the cold water and climb out, gasping, very awake.' : 'You flounder, swallow water, and haul yourself out coughing.');
    c.pc.drunk = Math.max(0, c.pc.drunk - 1);
  } },
  { re: /^(cartwheel|do a cartwheel|somersault|handstand|do a handstand|tumble|roll around|do a roll|do a flip|do a somersault|balance|walk on|tightrope|spin around|spin|twirl|pirouette)\b/, skill: 'acrobatics', dc: 10, ok: ['Perfect. Someone whistles.', 'You nail it, and don\'t even look surprised.'], fail: ['You end up in a heap, laughing.', 'It goes wrong halfway through. Very wrong. Nobody saw. Everybody saw.'] },
  { re: /^(juggle)\b/, skill: 'performance', dc: 10, ok: ['Three, four, five, round and round. People stop to watch. A copper lands at your feet.'], fail: ['Everything comes down at once, mostly on your head.'], run: (c, w, obj, p) => {
    const ok = c.check('performance', 10);
    c.narr(ok ? `You juggle ${obj || 'whatever comes to hand'}: up, round, never down. People stop to watch.` : 'Everything comes down at once, mostly on your head.');
    if (ok && w.presentNpcs(c).length) c.money(die(c.rng, 3));
    if (!ok && /mug|bottle|egg|plate/.test(obj) && c.s.loc === 'tavern') tavernFrown(c, w, 'mess on his floor', 2);
  } },
  { re: /^(lift|heft|carry|pick up|hoist|raise|deadlift|bench|bench press|bend|arm wrestle|arm-wrestle|armwrestle|flex at|pull up|do push ?ups|do pushups|do chin ?ups|work out|exercise)\b/, skill: 'athletics', dc: (c, o) => (/anvil|boulder|cart|table|barrel|sarcophag|coffin|lid|bar/.test(o) ? 15 : 10), run: (c, w, obj, p, np, raw) => {
    if (/arm.?wrestle/.test(raw)) { if (np) { w.say(c, 'arm wrestle', np.names[0]); return; } if (c.s.loc === 'tavern') { w.say(c, 'arm wrestle', 'dwarves'); return; } c.narr('There\'s nobody here to arm-wrestle.'); return; }
    if (/push ?ups|chin ?ups|work out|exercise/.test(raw)) { c.narr('You knock out a set right there. ' + (c.s.loc === 'tavern' ? 'The dwarves count along, loudly and badly.' : 'Your arms burn. You feel strong.')); c.advance(10); return; }
    if (np) { if (np.id === 'kettle') { c.narr('You scoop Kettle up. He licks your whole face. He is heavier than he looks.'); return; } if (np.id === 'hetch') { c.narr('Hetch looks at you. You put him down. You had not picked him up.'); return; } if (np.id === 'alistair') { c.narr('Alistair weighs about as much as a coat rack. You lift him over your head. "WHEEE," he says, flatly.'); return; } c.narr(`${np.name} steps back out of reach. "Absolutely not."`); return; }
    const heavy = /anvil|boulder|cart|table|barrel|sarcophag|coffin|lid/.test(obj);
    const ok = c.check('athletics', heavy ? 15 : 8);
    if (/pick up/.test(raw) && p && (p.def?.item || itemFor(propName(p))) && !heavy) return false; // fall back to taking it
    c.narr(ok ? `You get your shoulder under the ${obj || 'weight'} and lift. ${heavy ? 'It comes up off the ground, and so do a few eyebrows.' : 'Easy.'}` : `You strain. The ${obj || 'weight'} wins.`);
    if (ok && heavy && c.s.loc === 'tavern') { c.npc('dwarves').disposition += 1; c.narr('Borin bangs the table. "That one can stay!"'); }
  } },
  { re: /^(break|smash|snap|shatter|crush|destroy|wreck|tear|rip|demolish|dismantle|take apart|kick over|knock over|flip|overturn|throw down)\b/, skill: 'athletics', needObj: true, run: (c, w, obj, p, np, raw) => {
    if (np) return false;
    if (!p) { c.narr(`You don't see any ${obj} to break.`); return; }
    const nm = propName(p);
    if (p.state.broken) { c.narr(`The ${nm} is already broken.`); return; }
    if (/flip|overturn|knock over|kick over/.test(raw) && /table|cart|pew|bench/.test(nm)) {
      c.narr(`You heave the ${nm} over with a crash.${c.s.loc === 'tavern' ? ' Mugs fly. The room goes quiet.' : ''}`);
      if (c.s.loc === 'tavern') tavernFrown(c, w, 'overturned table', 10);
      return;
    }
    if (!propHas(p, 'break') && !propHas(p, 'weapon')) { c.narr(`The ${nm} is not the kind of thing you can break with your hands.`); return; }
    const ok = c.check('athletics', /window|bottle|mug|glass|plate/.test(nm) ? 5 : 10);
    if (!ok) { c.narr(`You strain at the ${nm}. It holds.`); return; }
    p.state.broken = true;
    const piece = p.def?.item ?? itemFor(nm);
    c.narr(`The ${nm} breaks with a satisfying crack.${piece && piece !== 'rock' ? ` You're left holding a ${ITEMS[piece].name.toLowerCase()}.` : ''}`);
    if (piece && piece !== 'rock') { c.give(piece); c.s.lastObject = ITEMS[piece].name.toLowerCase(); }
    if (c.s.loc === 'tavern') tavernFrown(c, w, `broken ${nm}`, /window/.test(nm) ? 50 : 10);
    if (c.s.loc === 'goods') { c.say('garrick', '"You BREAK it, you BUY it! That\'s the rule! It\'s a sign! I have a sign!"'); c.pay(25); }
    if (c.s.loc === 'nave' && /candle/.test(nm)) c.narr('The green flame gutters out. The shadows in the nave seem to lean back.');
  } },
  { re: /^(light|ignite|set fire to|set alight|burn|torch|kindle|start a fire|build a fire|make a fire|light a fire|make a campfire|light up)\b/, run: (c, w, obj, p, np, raw) => {
    const pc = c.pc;
    const hasFire = hasItem(pc, 'torch') || hasItem(pc, 'candle') || pc.cantrips.some((x) => ['fire_bolt', 'produce_flame', 'prestidigitation', 'bonfire', 'thaumaturgy', 'druidcraft'].includes(x)) || propsHere(c).some((x) => x.state.tags.includes('burn') && x.state.tags.includes('light') && /fire|forge|candle|hearth|flame/.test(x.state.name)) || species(pc).resist?.includes('fire');
    if (/start a fire|build a fire|make a fire|light a fire|campfire/.test(raw) || /^(fire|campfire)$/.test(obj)) {
      if (!ROOMS[c.s.loc]?.outdoors && !/kessels/.test(c.s.loc)) { c.narr('You\'re indoors. Somebody would kill you.'); return; }
      const ok = c.check('survival', 10);
      c.narr(ok ? 'You build a small, smokeless fire out of deadfall. It crackles, and the dark backs off a few feet.' : 'You make a lot of smoke and very little fire. Eventually it takes.');
      c.set(`fire_${c.s.loc}`, true); c.advance(15); return;
    }
    if (!obj) { c.narr('Light what?'); return; }
    if (np) { c.narr(`You are not setting ${np.name} on fire. (If you mean it, it's a fight: "attack ${np.names[0]}".)`); return; }
    if (!hasFire) { c.narr('You have nothing to light it with. (A torch, a candle, or a fire cantrip would do.)'); return; }
    const own = w.matchInventory(c, obj);
    if (own && /torch|candle|lantern|lamp|pipe/.test(own.id)) { c.narr(`You light the ${ITEMS[own.id].name.toLowerCase()}. Warm light pushes the shadows back.`); c.set('light_on', true); return; }
    if (!p) { c.narr(`There's no ${obj} here to light.`); return; }
    const nm = propName(p);
    if (!propHas(p, 'burn')) { c.narr(`You hold a flame to the ${nm}. It blackens a little and refuses to catch.`); return; }
    if (/candle|lamp|lantern|fire|hearth|forge|campfire|torch|sconce/.test(nm)) { c.narr(`You light the ${nm}. The flame stands up straight.`); return; }
    p.state.gone = true;
    c.narr(`The ${nm} catches. Flames climb it fast, then faster.`);
    if (!ROOMS[c.s.loc]?.outdoors) { c.bad('Smoke fills the room.'); if (c.s.loc === 'tavern') { c.narr('Squib is across the room before you see him move. A bucket of water, a hiss, steam. Then he looks at you.'); c.npc('squib').disposition -= 2; c.say('squib', '"Out. Come back when you\'ve remembered how to be a guest."'); c.move('breda_square'); } else if (c.s.loc === 'tailor') { c.say('hetch', 'Hetch smothers the flames with a bolt of wool and an expression you will remember on your deathbed.'); c.npc('hetch').disposition -= 3; } }
  } },
  { re: /^(extinguish|put out|snuff|blow out|douse|smother)\b/, run: (c, w, obj) => { c.narr(`You put out the ${obj || 'flame'}. ${c.s.loc === 'nave' && /candle/.test(obj) ? 'The green light dies and the nave feels a little less watched.' : 'It\'s darker now.'}`); c.set('light_on', false); } },
  { re: /^(smell|sniff|inhale|breathe in|take a whiff)\b/, skill: 'perception', dc: 8, run: (c, w, obj, p, np) => {
    if (np) { c.narr(np.id === 'kettle' ? 'Kettle smells like wet dog and loyalty.' : np.id === 'alistair' ? 'Alistair smells faintly of grave dirt and expensive cologne. "It\'s called Eternity," he says.' : np.id === 'hetch' ? 'Hetch smells of cedar and lavender. He knows you sniffed him.' : `${np.name} catches you sniffing and edges away.`); return; }
    const S: Record<string, string> = { tavern: 'Woodsmoke, pipe smoke, roasting meat, spilled ale, and under it all, very faintly, something like burnt sugar from the barrel.', breda_square: 'Mud, horses, fresh bread from somewhere, and rain coming.', thornwood: 'Leaf rot, wet bark, and, once, the musk of wolf.', chapel_yard: 'Turned earth and old rot. And honey. Why honey?', nave: 'Dust, cold stone, and that honey-and-graves smell from the green candles.', crypt: 'Dry bone and old incense.', smithy: 'Coal, hot iron and sweat.', tailor: 'Cedar, lavender, and cat.', goods: 'Tar, salt, lamp oil, and Garrick\'s cologne, which is aggressive.', foothills: 'Sheep. So much sheep.', kessels_rest: 'Wet stone and old ashes.' };
    if (obj && p) { c.narr(`You sniff the ${propName(p)}. ${/mushroom/.test(propName(p)) ? 'Earthy, with something sweet and wrong underneath.' : /candle/.test(propName(p)) && /nave/.test(c.s.loc) ? 'Honey and graves. It makes your head swim.' : 'It smells like what it is.'}`); return; }
    c.narr(S[c.s.loc] ?? 'It smells like the world: dirt, smoke, and other people.');
  } },
  { re: /^(listen|eavesdrop|overhear|listen in|listen to|listen for|put (my|your) ear to|press (my|your) ear)\b/, skill: 'perception', dc: 12, run: (c, w, obj, p, np) => {
    const ok = c.check(c.s.loc === 'tavern' ? 'stealth' : 'perception', c.s.loc === 'tavern' ? 10 : 12);
    if (c.s.loc === 'tavern') {
      if (!ok) { c.narr('You lean in a little too obviously. The elves and goblins by the window stop talking and look at you until you go away.'); return; }
      const R = ['Faelar, low: "...every grave on the north side, pushed up from inside..."', 'Nix: "...not dead, QUIET. Doors open, dinner on the table..."', 'One of the dwarves: "...Marrik swears he heard knocking. From under the road..."', 'Vetch: "...silver\'s a hundred gold at Tokarev. Fire works on everything, though..."', 'Sereza, to nobody: "...crown coin, fresh minted. Someone in Suomi is paying for this..."'];
      c.narr(pick(c.rng, R)); return;
    }
    if (!ok) { c.narr('You hear your own heartbeat and not much else.'); return; }
    const L: Record<string, string> = { thornwood: 'Birdsong. Then, far off, a howl, answered by another. Then birdsong again.', chapel_yard: 'Wind in the grass. And under the ground, very faint, a scratching.', nave: 'Dripping water. And from below the altar, a draught: there\'s space down there.', tower: 'The bell rope creaks, though nothing is touching it.', crypt: 'Silence, the thick kind.', breda_square: 'Farmers haggling, a dog barking, a militia sergeant complaining about the north gate.', foothills: 'Sheep, wind, and someone singing very badly in the distance. Doss.' };
    c.narr(L[c.s.loc] ?? 'Nothing out of the ordinary.');
  } },
  { re: /^(taste|lick|sniff at|kiss the|hug the)\b/, needObj: true, run: (c, w, obj, p, np) => {
    if (np) { c.narr(np.id === 'kettle' ? 'You lick Kettle. Kettle licks you back, much more thoroughly. You lose.' : np.id === 'alistair' ? 'You lick Alistair. "Brother," he says, after a long pause. "Brother, no."' : `${np.name} sees it coming and is suddenly on the other side of the room.`); if (np && !['kettle', 'alistair'].includes(np.id)) c.npc(np.id).disposition -= 1; return; }
    c.narr(`You lick the ${p ? propName(p) : obj}. ${pick(c.rng, ['It tastes about how you\'d expect.', 'Salty. Why is it salty?', 'You learn nothing, except about yourself.'])}`);
  } },
  { re: /^(pet|stroke|scratch behind|scratch|rub|boop|cuddle|snuggle|play with|throw a stick for|fetch)\b/, skill: 'animal handling', dc: 8, needObj: true, run: (c, w, obj, p, np) => {
    if (np) return false; // npc emote handles kettle, hetch
    if (p && propHas(p, 'animal')) { const ok = c.check('animal handling', 8); c.narr(ok ? `The ${propName(p)} lets you. It even leans into it.` : `The ${propName(p)} bolts.`); return; }
    if (p && /yarn/.test(propName(p))) { c.narr('You bat the ball of yarn across the counter. Hetch\'s eyes follow it. He holds out for three full seconds before he pounces. "That never happened," he says.'); c.npc('hetch').disposition += 1; return; }
    return false;
  } },
  { re: /^(steal|pickpocket|pick (\w+'s )?pocket|lift (\w+'s )?purse|cut (\w+'s )?purse|rob|mug|filch|pinch)\b/, skill: 'sleight of hand', run: (c, w, obj, p, np, raw) => {
    const target = np ?? w.matchNpc(c, obj.replace(/'s.*$/, '').replace(/\bfrom\b.*$/, '').trim()) ?? (obj.match(/from (.+)$/) ? w.matchNpc(c, obj.match(/from (.+)$/)![1]) : null);
    if (!target) {
      if (p && (p.def?.item || itemFor(propName(p)))) return false;
      c.narr(obj ? `You don't see ${obj} here to rob.` : 'Steal from whom?'); return;
    }
    if (['kettle', 'alistair'].includes(target.id)) { c.narr(target.id === 'kettle' ? 'Kettle has nothing but fleas and love.' : 'Alistair\'s pockets contain a single dried rose and a lot of dust. You put them back.'); return; }
    const dc = target.id === 'hetch' ? 20 : target.id === 'squib' ? 18 : target.id === 'sereza' ? 17 : 14;
    if (c.check('sleight of hand', dc)) {
      const cp = target.id === 'sereza' ? 500 : target.id === 'garrick' ? 300 : 20 + die(c.rng, 80);
      c.money(cp); c.good(`Your fingers come away with ${cp >= 100 ? `${Math.floor(cp / 100)} gold` : `${cp} copper`}. Nobody noticed. Probably.`);
      if (target.id === 'sereza') { c.narr('And a folded note in a crisp hand: "Payment for the Breda account, as agreed. — S." The seal is a crowned sun, scraped half off.'); c.journal('You lifted a note from Sereza Harrow: payment "for the Breda account", sealed with a half-scraped crowned sun.'); }
      c.set(`stole_${target.id}`, true);
    } else {
      c.npc(target.id).disposition -= 3;
      if (c.s.loc === 'tavern') { c.say('squib', 'Squib\'s hand closes around your wrist like a door shutting. "Bother my regulars and drink elsewhere." A pause. "That was your warning."'); c.npc('squib').disposition -= 2; }
      else c.say(target.id, `${target.name} catches your hand in theirs. "${pick(c.rng, ['Really?', 'Try that again and lose the hand.', 'Bold. Stupid, but bold.'])}"`);
    }
  } },
  { re: /^(forage|gather|hunt|go hunting|fish|go fishing|look for food|find food|look for herbs|gather herbs|pick berries|pick mushrooms|collect firewood|gather firewood)\b/, skill: 'survival', run: (c) => {
    const r = ROOMS[c.s.loc];
    if (!r?.outdoors) { c.narr('There\'s nothing to forage indoors except other people\'s food.'); return; }
    if (c.flag(`foraged_${c.s.loc}_${Math.floor((c.s.minutes + 480) / 1440)}`)) { c.narr('You\'ve already picked this area clean today.'); return; }
    c.set(`foraged_${c.s.loc}_${Math.floor((c.s.minutes + 480) / 1440)}`, true);
    c.advance(60);
    if (c.check('survival', 10)) {
      const finds = c.s.loc === 'thornwood' ? [['mushroom', 2], ['apple', 2], ['stick', 1]] : c.s.loc === 'foothills' ? [['apple', 1], ['rock', 1]] : [['apple', 1]];
      for (const [id, q] of finds) c.give(id as string, q as number);
      c.good(`An hour's foraging: ${finds.map(([id, q]) => `${q} × ${ITEMS[id as string].name.toLowerCase()}`).join(', ')}.`);
    } else c.narr('An hour of scratched hands and wet knees. You find nothing worth eating.');
  } },
  { re: /^(track|follow (the )?tracks|look for tracks|search for tracks|read the ground|find tracks)\b/, skill: 'survival', dc: 12, run: (c) => {
    const ok = c.check('survival', 12);
    const T: Record<string, string> = { thornwood: 'Wolf prints, a pack of six, heading north. And one set of bare human feet walking a straight line through the brambles, as if they didn\'t feel them.', chapel_yard: 'Dozens of shuffling bare feet, all leading in from the graves toward the chapel doors. None leading out.', foothills: 'Sheep, sheep, sheep, and one ewe\'s prints wandering off toward the rocks on their own.', kessels_rest: 'Boot prints in the ash of the old fire. Someone in hobnailed boots camped here a few nights ago, alone. A courier, maybe.', breda_square: 'Hundreds of feet. Too many to read.' };
    c.narr(ok ? (T[c.s.loc] ?? 'Nothing worth following.') : 'The ground tells you nothing.');
  } },
  { re: /^(pray|meditate|commune|kneel and pray|say a prayer|give thanks|reflect|contemplate)\b/, skill: (c) => (/meditat|reflect|contemplat/.test(c.flag('raw_low') as string) ? 'insight' : 'religion'), dc: 10, run: (c, w, obj, p, np, raw) => {
    const day = Math.floor((c.s.minutes + 480) / 1440);
    const med = /meditat|reflect|contemplat/.test(raw);
    c.advance(10);
    if (c.flag('prayed_day') === day) { c.narr(med ? 'You sit with your breath for a while. It\'s quiet.' : 'You pray again. The silence is the same silence.'); return; }
    c.set('prayed_day', day);
    if (c.check(med ? 'insight' : 'religion', 10)) {
      c.set('guidance', true);
      c.good(med ? 'Your mind settles, sharp and still. (+1d4 on your next check.)' : `${c.s.loc === 'nave' || c.s.loc === 'kessels_rest' ? 'In this old place the prayer feels heard. ' : ''}A small warmth answers, from somewhere. (+1d4 on your next check.)`);
    } else c.narr(med ? 'Your thoughts keep sliding back to the bell.' : 'Nobody answers. You feel a little better anyway.');
  } },
  { re: /^(recall|remember|think about|think of|what do i know about|do i know|try to remember|try to recall|ponder|consider|study)\b/, run: (c, w, obj, p, np, raw) => {
    const topic = obj || raw;
    const L = LORE.find(([re]) => re.test(topic));
    if (!L) return false;
    const [, sk, dc, text] = L;
    if (c.check(sk, dc)) c.narr(text);
    else c.narr('You turn it over in your head. Nothing useful surfaces.');
  } },
  { re: /^(hide|conceal|stash|tuck|slip|palm)\s+(?!in |behind |under |from )/, skill: 'sleight of hand', dc: 10, run: (c, w, obj) => {
    const st = w.matchInventory(c, obj.replace(/\b(in|under|behind|up)\b.*$/, '').trim());
    if (!st) return false;
    const ok = c.check('sleight of hand', 10);
    c.narr(ok ? `You tuck the ${itemName(st.id).toLowerCase()} out of sight. Nobody saw.` : `You fumble the ${itemName(st.id).toLowerCase()}. Someone definitely saw.`);
  } },
  { re: /^(hide (in|behind|under)|duck behind|crouch behind|get behind|take cover behind)\b/, skill: 'stealth', dc: 10, run: (c, w, obj, p) => {
    if (!p) { c.narr(`There's no ${obj} here to hide behind.`); return; }
    c.narr(c.check('stealth', 10) ? `You tuck yourself ${/under/.test(c.flag('raw_low') as string) ? 'under' : 'behind'} the ${propName(p)}. Out of sight.` : `You try to hide behind the ${propName(p)}. Your elbow is very visible.`);
  } },
  { re: /^(dig|dig up|excavate|shovel|burrow)\b/, skill: 'athletics', dc: 10, run: (c, w, obj, p, np, raw) => {
    if (!ROOMS[c.s.loc]?.outdoors && !/chapel_yard|crypt/.test(c.s.loc)) { c.narr('The floor here is not for digging.'); return; }
    c.advance(30);
    if (/grave/.test(obj) || c.s.loc === 'chapel_yard') {
      c.narr('You dig into one of the graves. A foot down, the soil is loose, already turned. Two feet down, the coffin lid is open, splintered outward. Empty.');
      if (!c.flag('dug_grave')) { c.set('dug_grave'); c.give('bone'); c.journal('The chapel-yard graves were opened from inside. The coffins are empty.'); }
      return;
    }
    if (!c.check('athletics', 10)) { c.narr('Half an hour of blisters and a shallow hole.'); return; }
    const a = askOracle(c.rng, 'unlikely', c.s.chaos);
    c.out('roll', `🔮 Find anything? (${a.chance}%): ${a.answer}.`);
    if (a.answer.includes('Yes')) { const cp = a.answer === 'Exceptional yes' ? 300 : 5 + die(c.rng, 20); c.money(cp); c.good(`Your fingers find something hard and round: ${cp >= 100 ? 'an old crown coin' : 'a few lost coppers'}. (+${cp} cp)`); }
    else c.narr('Dirt, roots, one confused worm.');
  } },
  { re: /^(gamble|play cards|play dice|bet|wager|play a game|play a hand|deal (me )?in|play galilin|cheat at cards|cheat)\b/, skill: 'deception', run: (c, w, obj, p, np, raw) => {
    if (c.s.loc !== 'tavern') { c.narr('There\'s nobody here to take your money.'); return; }
    const stake = Math.min(c.pc.copper, 20);
    if (stake <= 0) { c.say('dwarves', '"No coin, no cards," says Borin, kindly.'); return; }
    const cheat = /cheat/.test(raw) || hasItem(c.pc, 'marked_cards');
    c.narr(`You sit in on a hand of Galilin with the dwarves, ${stake} copper on the table.${cheat ? ' Your sleeve is doing some of the work.' : ''}`);
    c.advance(20);
    const ok = cheat ? c.check('sleight of hand', 13) : c.abilityCheck(pick(c.rng, ['wis', 'cha', 'int'] as Ability[]), 12);
    if (ok) { c.money(stake); c.good(`You win ${stake} copper. Odo accuses you of witchcraft, affectionately.`); }
    else if (cheat && die(c.rng, 2) === 1) { c.pay(stake); c.npc('dwarves').disposition -= 2; c.narr('Marrik quietly turns over the card in your sleeve. The table goes silent. Then Borin laughs so hard he cries, and keeps your stake as a "tax on stupidity".'); }
    else { c.pay(stake); c.narr(`You lose ${stake} copper. Tokk wins, and is so happy about it you almost don't mind.`); }
  } },
  { re: /^(carve|whittle|scratch (my|your) name|write|draw|sketch|doodle|scribble|paint|graffiti)\b/, run: (c, w, obj, p, np, raw) => {
    c.narr(sentence(c.flag('raw') as string));
    if (c.s.loc === 'tavern' && /table|bar|wall|chair/.test(obj + raw)) c.narr('Squib sees. He doesn\'t say anything. He brings you a better knife and points at a spot where there\'s still room. It\'s tradition.');
    else c.narr(pick(c.rng, ['It\'s not bad.', 'It\'s art, technically.', 'Somebody will find it in a hundred years and wonder about you.']));
  } },
  { re: /^(tie|knot|lasso|rope|tie up)\b/, run: (c, w, obj, p, np) => {
    if (!hasItem(c.pc, 'rope')) { c.narr('You need rope for that.'); return; }
    if (np) { c.narr(`${np.name} declines to be tied up.`); return; }
    c.narr(`You tie off the rope${obj ? ` to the ${obj}` : ''}. Good knot. Your old sergeant would approve.`);
  } },
  { re: /^(mend|repair|fix|patch|sew|darn)\b/, run: (c, w, obj) => {
    const tools = hasItem(c.pc, 'smith_tools') || hasFeat(c.pc, 'forgewise');
    const ok = c.check(tools ? 'investigation' : 'sleight of hand', tools ? 8 : 13);
    c.narr(ok ? `You fix the ${obj || 'thing'} up. It\'ll hold.` : `You make the ${obj || 'thing'} worse, then better, then about the same.`);
  } },
  { re: /^(count|tally|stare|gaze|look out|watch the|people watch|people-watch|daydream|zone out|wait for|admire)\b/, run: (c, w, obj) => { c.advance(10); c.narr(sentence(c.flag('raw') as string) + ' ' + pick(c.rng, ['Time passes, peacefully.', 'Nothing happens, and that\'s nice.', 'You notice things you hadn\'t.'])); } },
  { re: /^(cook|roast|fry|boil|bake|brew)\b/, skill: 'survival', dc: 10, run: (c, w, obj) => {
    const fire = c.flag(`fire_${c.s.loc}`) || propsHere(c).some((x) => /fire|forge|hearth|campfire/.test(x.state.name));
    if (!fire) { c.narr('You\'ll need a fire for that. ("build a fire")'); return; }
    const st = obj ? w.matchInventory(c, obj) : c.pc.inventory.find((s) => ITEMS[s.id]?.kind === 'food') ?? null;
    if (!st || ITEMS[st.id]?.kind !== 'food') { c.narr(`You have nothing ${obj ? `called "${obj}"` : ''} to cook.`); return; }
    removeItem(c.pc, st.id);
    if (c.check('survival', 10)) { const h = 1 + die(c.rng, 4); c.pc.hp = Math.min(c.pc.maxHp, c.pc.hp + h); c.good(`You cook the ${ITEMS[st.id].name.toLowerCase()} over the flames. Hot food. +${h} HP.`); }
    else c.narr('You burn it. You eat it anyway.');
    c.advance(20);
  } },
  { re: /^(tickle|nudge|elbow gently|tap|tap on the shoulder|poke gently|boop)\b/, run: (c, w, obj, p, np) => {
    if (!np) return false;
    const R: Record<string, string> = { squib: 'Squib looks down at your finger, then at you. "Can I help you."', dwarves: 'Tokk giggles. Borin pretends he didn\'t. Odo starts telling you about a boar.', kettle: 'Kettle rolls over for more.', alistair: '"Brother, I don\'t have nerves. ...Do it again."', hetch: 'Hetch\'s tail goes very stiff. "We are not. On those terms."', sereza: 'Sereza catches your wrist without looking up. "Careful."', garrick: '"Ha! Ha! Stop! Ha!" Garrick is extremely ticklish, and now you know.' };
    c.narr(R[np.id] ?? `${np.name} gives you a look.`);
  } },
  { re: /^(sing|hum|whistle|play (my |your |the )?(lute|music|a song|a tune)|serenade|recite|tell a joke|tell a story|do an impression|do a dance|dance with|perform)\b/, skill: 'performance', run: (c, w, obj, p, np, raw) => {
    const instrument = /lute/.test(raw) && hasItem(c.pc, 'lute');
    const ok = c.check('performance', instrument ? 10 : 12, { adv: hasFeat(c.pc, 'crowd_pleaser') && c.s.loc === 'tavern' });
    const crowd = w.presentNpcs(c).filter((x) => x !== 'kettle').length;
    if (np && /serenade|dance with/.test(raw)) { c.narr(ok ? `${np.name} ${np.id === 'squib' ? 'pretends not to enjoy it, and fails' : 'laughs, and plays along'}.` : `${np.name} edges away.`); if (ok) c.npc(np.id).disposition += 1; return; }
    if (ok && /joke|story|impression|recite/.test(raw)) {
      c.narr(pick(c.rng, /joke/.test(raw) ? ['It lands. Borin laughs so hard ale comes out of his nose.', 'Even Squib\'s mouth twitches. That\'s a standing ovation, from him.', 'The punchline gets a roar. Someone makes you tell it again.'] : ['The room leans in. By the end, nobody is drinking.', 'You have them in the palm of your hand. Someone asks for another.']));
      if (crowd && c.s.loc === 'tavern') { const cp = (hasFeat(c.pc, 'crowd_pleaser') ? 20 : 5) + die(c.rng, 10); c.money(cp); c.good(`Coins land at your feet: ${cp} copper.`); }
    } else if (!ok && /joke|story|impression|recite/.test(raw)) c.narr(pick(c.rng, ['Silence. A cough. Somebody\'s chair creaks.', 'You forget the punchline halfway through.', 'Tokk laughs, alone, and then stops.']));
    else if (ok) {
      c.narr(pick(c.rng, ['The room goes quiet to listen, then joins in on the chorus.', 'By the second verse people are stamping along.', 'It\'s good. It\'s genuinely good. Someone wipes their eye and blames the smoke.']));
      if (crowd && c.s.loc === 'tavern') { const cp = (hasFeat(c.pc, 'crowd_pleaser') ? 20 : 5) + die(c.rng, 10); c.money(cp); c.good(`Coins land at your feet: ${cp} copper.`); }
    } else c.narr(pick(c.rng, ['A dog starts howling along. That\'s the best part.', 'Somebody throws a crust of bread. It\'s not a tip.', 'The silence afterwards has texture.']));
  } },
];

const STOP = /\b(the|a|an|some|my|your|his|her|their|its|this|that|these|those|up|down|on|onto|in|into|at|to|with|from|over|under|behind|around|across|off|out|of|for|about)\b/g;

function objectOf(rest: string): string {
  return rest.replace(/\b(with|using)\b.*$/, '').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
}

/** Guess the skill for a verb we don't have a rule for. */
function guessSkill(verb: string): Skill | null {
  const v = verb.toLowerCase();
  if (/^(push|pull|drag|haul|lift|shove|force|pry|bend|throw|toss|wrestle|hold|carry|kick|ram|shoulder|smash|swim|climb|jump)/.test(v)) return 'athletics';
  if (/^(dodge|duck|roll|balance|flip|tumble|slide|swing|twirl|spin|catch|vault)/.test(v)) return 'acrobatics';
  if (/^(sneak|creep|tiptoe|skulk|shadow|tail|stalk)/.test(v)) return 'stealth';
  if (/^(steal|palm|swipe|filch|plant|slip|pocket|juggle|shuffle|flick)/.test(v)) return 'sleight of hand';
  if (/^(study|examine|analy|decipher|deduce|figure|solve|inspect|probe|test|measure|map)/.test(v)) return 'investigation';
  if (/^(notice|spot|watch|scan|peer|peek|spy|observe|look)/.test(v)) return 'perception';
  if (/^(read|judge|sense|gauge|size up|study (him|her|them))/.test(v)) return 'insight';
  if (/^(soothe|calm|tame|ride|train|feed|whistle for|call)/.test(v)) return 'animal handling';
  if (/^(heal|bandage|treat|tend|stitch|splint|diagnose|check (the )?pulse)/.test(v)) return 'medicine';
  if (/^(survive|navigate|forage|track|hunt|fish|camp)/.test(v)) return 'survival';
  if (/^(bless|pray|exorcise|consecrate|anoint|chant)/.test(v)) return 'religion';
  if (/^(dispel|identify|enchant|attune|channel|focus|scry)/.test(v)) return 'arcana';
  if (/^(perform|sing|dance|act|recite|entertain|play|mime|impersonate)/.test(v)) return 'performance';
  if (/^(convince|flatter|compliment|bargain|haggle|beg|plead|negotiate|bribe|woo|seduce|befriend)/.test(v)) return 'persuasion';
  if (/^(lie|bluff|fake|pretend|disguise|forge|feint|trick)/.test(v)) return 'deception';
  if (/^(scare|threaten|glare|loom|growl|roar|stare down|intimidate)/.test(v)) return 'intimidation';
  return null;
}

const OK_GENERIC: Partial<Record<Skill | 'none', string[]>> = {
  athletics: ['It takes some muscle, but it works.', 'You put your back into it, and it gives.'],
  acrobatics: ['Smooth. You make it look easy.', 'Neat and quick.'],
  stealth: ['Nobody notices a thing.', 'Quiet as dust.'],
  'sleight of hand': ['Your fingers are quicker than anyone\'s eyes.', 'Done, and nobody\'s the wiser.'],
  investigation: ['It comes together: you see how it works.', 'You work it out.'],
  perception: ['You catch it.', 'Your eyes find it.'],
  insight: ['You read it right.', 'You get the measure of it.'],
  'animal handling': ['It settles and lets you.', 'It trusts you, just a bit.'],
  medicine: ['Your hands know what to do.', 'Done properly.'],
  survival: ['Old road sense pays off.', 'You manage.'],
  religion: ['It feels right, and maybe someone notices.', 'The old words come easily.'],
  arcana: ['The magic answers, faintly.', 'You feel it click into place.'],
  performance: ['People watch. Some of them clap.', 'It lands.'],
  persuasion: ['They come round to your way of seeing it.', 'It works on them.'],
  deception: ['They buy it.', 'Not a flicker of doubt.'],
  intimidation: ['They back off.', 'Point made.'],
  none: ['It works.', 'Done.', 'Easy enough.', 'Nothing goes wrong. It\'s almost suspicious.'],
};
const FAIL_GENERIC = ['It doesn\'t work.', 'It goes wrong.', 'Not this time.', 'You make a mess of it.', 'Nope.'];

const stripLead = (raw: string) => raw.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/^(i want to|i'd like to|i try to|i attempt to|i'll|i will|let me|try to|attempt to|i|please|can i|could i|go ahead and)\s+/, '');
/** Does this look like a physical action we have a rule or skill for? */
export function looksLikeAction(raw: string): boolean {
  const low = stripLead(raw);
  return RULES.some((r) => r.re.test(low)) || !!guessSkill(low.split(' ')[0]);
}

/** The main entry: try to make sense of anything. Returns true if handled. */
export function freeAction(c: Ctx, w: World, raw: string): boolean {
  const low = raw.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/^(i want to|i'd like to|i try to|i attempt to|i'll|i will|let me|try to|attempt to|i|please|can i|could i|go ahead and)\s+/, '').replace(/^(try to|attempt to)\s+/, '');
  if (!low) return false;
  c.set('raw', raw); c.set('raw_low', low);
  const rule = RULES.find((r) => r.re.test(low));
  const verbM = rule ? low.match(rule.re)! : low.match(/^(\w+(?:\s+(?:up|down|out|off|over|in|on|around|away|through|back))?)/);
  const verb = verbM ? verbM[0] : low.split(' ')[0];
  const rest = low.slice(verb.length).trim();
  let obj = objectOf(rest);
  if (/^(it|that|this|them|him|her)$/.test(obj) && c.s.lastObject) obj = c.s.lastObject;
  obj = obj.replace(/\b\w+ly\b/g, '').replace(/\b(very|really|so|too|quite|again|now|please|carefully|quickly|slowly|gently|hard|loud)\b/g, '').replace(/\s+/g, ' ').trim();
  if (/^(me|myself|yourself|us|you|everyone|everybody|all|around|here|there|now|again|away|meaning life|life)$/.test(obj)) obj = '';
  // resolve the object (a person only if their name is actually in it, as a word)
  let np: Npc | null = null;
  if (obj) {
    for (const id of w.presentNpcs(c)) {
      const names = w.npcNames(id);
      if (names.some((n) => new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|'s)`).test(obj))) { np = w.matchNpc(c, names[0]); break; }
    }
  }
  const own = obj && !np ? w.matchInventory(c, obj) : null;
  const feat = obj && !np && !own ? w.matchFeature(c, obj) : null;
  let p: FoundProp | null = null;
  if (obj && /'|\b(should|would|could|is|are|am|was|were|be|been|go|going|gonna|want|need|think|feel)\b/.test(obj)) { c.narr(sentence(raw) + ' ' + aftermath(c, w, 'mundane')); return true; }
  if (obj && !np && !own && !feat) p = findProp(c, obj, !!rule?.needObj || !rule);
  if (obj && !np && !own && !feat && !p && (rule?.needObj || !rule) && !LORE.some(([re]) => re.test(obj))) {
    // nothing like that here
    if (!rule) { c.narr(`You look around for ${/s$/.test(obj) ? '' : /^[aeiou]/.test(obj) ? 'an ' : 'a '}${obj}. There isn't one.`); return true; }
    c.narr(`There's no ${obj} here.`);
    return true;
  }
  if (p?.spawned) c.narr(`There is ${/s$/.test(propName(p)) ? 'some' : /^[aeiou]/.test(propName(p)) ? 'an' : 'a'} ${propName(p)} here${p.state.tags.includes('fine') ? ', and a good one' : ''}.`);
  if (p || own) c.s.lastObject = p ? propName(p) : itemName(own!.id).toLowerCase();
  if (rule) {
    if (rule.run) {
      const r = rule.run(c, w, obj, p, np, low);
      if (r !== false) return true;
      if (/pick up|steal|lift/.test(verb) && p) return takeProp(c, w, p);
      if (rule.re.source.includes('pet') && np) return false;
    } else {
      const sk = typeof rule.skill === 'function' ? rule.skill(c, obj) : rule.skill;
      const dc = typeof rule.dc === 'function' ? rule.dc(c, obj, p) : rule.dc ?? 10;
      const ok = sk ? (sk.length === 3 ? c.abilityCheck(sk as Ability, dc) : c.check(sk as Skill, dc)) : true;
      c.narr(sentence(raw) + ' ' + pick(c.rng, ok ? rule.ok ?? ['It works.'] : rule.fail ?? FAIL_GENERIC));
      if (rule.mins) c.advance(rule.mins);
      return true;
    }
  }
  // no rule: generic resolution
  const sk = guessSkill(verb);
  if (np && !sk) {
    // doing something odd to a person: they react
    const R: Record<string, string[]> = {
      squib: ['Squib watches you do it. He says nothing. Somehow that\'s worse.', 'Squib raises one enormous eyebrow, then goes back to polishing the mug.'],
      dwarves: ['The dwarves find this hilarious.', 'Borin slaps the table. "Again!"'],
      kettle: ['Kettle wags uncertainly.', 'Kettle tilts his head, then decides it\'s a game.'],
      alistair: ['"Brother," says Alistair, "I have been dead for a long time and that is still new to me."', 'Alistair copies you exactly, a beat late.'],
      hetch: ['Hetch watches you with the patience of a cat who has outlived better.', 'Hetch flicks one ear. That\'s all you get.'],
      sereza: ['Sereza\'s mouth twitches. She writes something down.', 'Sereza looks at you as if pricing you.'],
    };
    c.narr(sentence(raw) + ' ' + pick(c.rng, R[np.id] ?? [`${np.name} isn't sure what to make of that.`, `${np.name} gives you a long look.`, `${np.name} takes a half-step back. "Can I help you?"`, `${np.name} laughs, uncertain whether they're meant to.`]));
    return true;
  }
  if (sk) {
    const dc = /carefully|gently|slowly/.test(low) ? 8 : /quickly|fast|hard|perfectly|all at once/.test(low) ? 14 : 11;
    const ok = c.check(sk, dc, { adv: /carefully|slowly|take (my|your) time/.test(low) });
    c.narr(sentence(raw) + ' ' + pick(c.rng, ok ? OK_GENERIC[sk] ?? OK_GENERIC.none! : FAIL_GENERIC));
    if (ok && p && /^(push|shove|drag|pull|move|tip|roll)/.test(verb)) c.narr(`The ${propName(p)} moves.`);
    return true;
  }
  // nothing to roll and nothing to do it to: it simply happens, and the room reacts
  if (!obj && !p) {
    c.narr(sentence(raw) + ' ' + aftermath(c, w, /shout|yell|scream|sing|stomp|bang|slam|whistle|howl|roar/.test(low) ? 'loud' : /cry|weep|sigh|smile|hum/.test(low) ? 'tender' : 'odd'));
    return true;
  }
  // nothing to roll: let the oracle decide whether it simply works
  const a = askOracle(c.rng, 'likely', c.s.chaos);
  c.out('roll', `🔮 Does it work? (${a.chance}%): ${a.answer}.${a.event ? ' — ' + a.event : ''}`);
  const text = a.answer === 'Exceptional yes' ? pick(c.rng, ['It works better than it has any right to.', 'Perfectly. Someone even notices.']) : a.answer === 'Yes' ? pick(c.rng, OK_GENERIC.none!) : a.answer === 'No' ? pick(c.rng, FAIL_GENERIC) : pick(c.rng, ['It goes badly wrong, in a way you\'ll tell stories about.', 'Absolutely not. The world refuses.']);
  c.narr(sentence(raw) + ' ' + text);
  return true;
}

export function takeProp(c: Ctx, w: World, p: FoundProp): boolean {
  const nm = propName(p);
  const item = p.def?.item ?? itemFor(nm);
  if (!item || !ITEMS[item] || p.state.broken && !/chair|stool|pew/.test(nm)) {
    if (/table|bar|anvil|cart|tree|wall|palisade|rafter|dome|sarcophag|grave|fire|forge|hearth|stair|ladder|window|floor/.test(nm)) { c.narr(`You can't exactly pocket the ${nm}.`); return true; }
    if (propHas(p, 'animal')) { c.narr(`The ${nm} declines to be taken.`); return true; }
    c.narr(`You take the ${nm}. It's not much use, but it's yours now.`);
    p.state.gone = true;
    c.pc.inventory.push({ id: `custom:${nm.charAt(0).toUpperCase() + nm.slice(1)}`, qty: 1 });
    c.s.lastObject = nm;
    return true;
  }
  if (/chair|stool|pew/.test(nm) && !p.state.broken) { c.narr(`The ${nm} is too big to carry around. You could break a leg off it.`); return true; }
  const key = `took_${c.s.loc}_${p.state.id}`;
  const n = ((c.flag(key) as number) || 0) + 1;
  if (n > 3 && !p.state.spawned) { c.narr(`You've taken all the ${nm} worth having.`); return true; }
  c.set(key, n);
  if (p.state.spawned) p.state.gone = true;
  addItem(c.pc, item, 1);
  c.s.lastObject = ITEMS[item].name.toLowerCase();
  c.good(`Taken: ${ITEMS[item].name}.`);
  if (c.s.loc === 'tavern' && /mug|bottle|plate|cutlery|candle/.test(nm) && w.presentNpcs(c).includes('squib')) c.narr(pick(c.rng, ['Squib watches it go into your pack. "That comes back," he says.', 'Squib makes a note on his slate.']));
  if (c.s.loc === 'goods') { if (!c.pay(10)) c.say('garrick', '"Hey! Hey! Ten copper! ...Fine, but I\'m watching you."'); else c.narr('Garrick snatches ten copper out of the air as you pass. "Pleasure!"'); }
  return true;
}

/** "throw X" outside combat, at nothing or at a thing. */
export function throwThing(c: Ctx, w: World, what: string, at?: string) {
  const own = w.matchInventory(c, what);
  const p = own ? null : findProp(c, what, true);
  if (!own && !p) { c.narr(`You have no ${what} to throw.`); return; }
  const nm = own ? itemName(own.id).toLowerCase() : propName(p!);
  if (p && /table|bar|anvil|cart|tree|wall|window|floor/.test(nm)) { c.narr(`You are not throwing the ${nm}.`); return; }
  const np = at ? w.matchNpc(c, at) : null;
  if (np) { c.narr(`You wing the ${nm} at ${np.name}.`); if (np.onAttack) { np.onAttack(c); return; } c.narr(np.id === 'kettle' ? 'Kettle catches it in his mouth and brings it back, delighted.' : np.id === 'alistair' ? 'It goes straight through his ribs. "Missed!" he says. It didn\'t.' : `${np.name} ducks. "${pick(c.rng, ['Hey!', 'What is WRONG with you?', 'Do that again and see.'])}"`); if (!['kettle', 'alistair'].includes(np.id)) c.npc(np.id).disposition -= 1; if (c.s.loc === 'tavern') tavernFrown(c, w, 'flying ' + nm); }
  else if (at) { const ok = c.check('athletics', 10); c.narr(ok ? `The ${nm} hits the ${at} dead centre.` : `The ${nm} sails wide of the ${at}.`); }
  else c.narr(`You throw the ${nm}. It lands some way off.`);
  if (own) { removeItem(c.pc, own.id); if (/mug|bottle|egg/.test(own.id)) { c.narr(/egg/.test(own.id) ? 'Splat.' : 'It shatters.'); if (c.s.loc === 'tavern') tavernFrown(c, w, 'broken ' + nm, 2); } else (c.s.roomItems[c.s.loc] ??= []).push({ id: own.id, qty: 1 }); }
}

/** Split "drink the mug then talk to squib, and go outside" into separate commands. */
export function splitCommands(raw: string): string[] {
  if (/["“]/.test(raw)) return [raw];
  if (/^(say|yell|shout|whisper|tell|ask)\b/i.test(raw.trim())) return [raw];
  const VERB = '(?:go|walk|head|run|drink|eat|take|grab|get|pick|drop|look|examine|search|read|open|close|talk|ask|tell|buy|sell|give|hand|attack|hit|punch|kick|shoot|cast|equip|wield|draw|wear|use|climb|jump|sit|stand|sleep|rest|wait|pull|push|break|light|throw|toss|hide|sneak|pray|sing|dance|leave|enter|return|follow|pay|order|reload|dodge|flee|smash|steal|listen|smell|wave|bow|hug|pet|dig|track|forage|cook|wash|swim|thank|toast|nod|shrug|laugh|cheer|clap|kiss|flirt|lift|carry|lick|taste|juggle|play|bet|gamble|carve|write|fix|tie|count|meditate|recall|remember|check|inspect|loot|finish|spare|end)';
  const parts = raw.split(new RegExp(`\\s*(?:;|,?\\s+and then\\s+|,?\\s+then\\s+|,\\s*(?=${VERB}\\b)|\\s+and\\s+(?=${VERB}\\b))\\s*`, 'i')).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts.slice(0, 5) : [raw];
}

export function propDef(loc: string, id: string): PropDef | undefined { return (ROOM_PROPS[loc] ?? []).find((p) => p.id === id); }

export function ambientHere(c: Ctx, w: World): string { return ambientLine(c, w); }
