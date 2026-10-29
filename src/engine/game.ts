// The game master. Takes one line of player input, updates the state, returns what happened.
import type { Ctx, Npc, Room } from '../content/types';
import { ROOMS, TRAVEL, bindGreet, checkChapelDone } from '../content/world';
import { NPCS, MENU, maybeLevel } from '../content/npcs';
import { d20, die, fmtMod, pick, roll, combineAdv, type Rng } from './dice';
import { ITEMS, MONSTERS, SPELLS, XP_FOR_LEVEL, FEATS } from './srd';
import type { Ability, CreationSpec, GameState, LogLine, NpcMemory, Skill } from './types';
import { ABILITIES } from './types';
import {
  addItem, am, armorClass, cls, createFromSpec, fmtMoney, itemName, species as speciesOf, hasItem, prof, removeItem, saveBonus, skillBonus,
  spellAttack, spellDC, weaponById, weaponDamageExpr, weaponToHit, xpToNext, species as spOf, background as bgOf, rollHitDie,
} from './character';
import { parse, type Intent } from '../nlp/parse';
import { classifySpeech } from '../nlp/profanity';
import { askOracle, guessOdds } from './oracle';
import * as Combat from './combat';
import * as Act from './actions';

export const SAVE_VERSION = 1;
const START_MIN = 0; // May 1, 08:00

export function newState(seed = Date.now() >>> 0): GameState {
  return {
    version: SAVE_VERSION, rng: { state: seed }, phase: 'title', creation: { step: 'name' }, pc: null,
    loc: 'tavern', minutes: START_MIN, flags: {}, npc: {}, companions: [], companionHp: {}, combat: null,
    roomFoes: {}, roomItems: {}, talkingTo: null, lastTarget: null, chaos: 5, log: [], journal: [],
    stats: { kills: 0, knockouts: 0, insults: 0 }, props: {}, lastObject: null,
  };
}

// ---------- context ----------
function makeCtx(s: GameState, lines: LogLine[]): Ctx {
  const push = (k: LogLine['k'], t: string, who?: string) => { const l: LogLine = { k, t, who }; lines.push(l); s.log.push(l); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); };
  const c: Ctx = {
    s, rng: s.rng, get pc() { return s.pc!; },
    out: push,
    narr: (t) => push('narr', t),
    say: (id, t) => push('say', t, NPCS[id]?.name ?? id),
    sys: (t) => push('sys', t),
    good: (t) => push('good', t),
    bad: (t) => push('bad', t),
    check: (skill, dc, o = {}) => skillCheck(c, skill, dc, o),
    abilityCheck: (a, dc, o = {}) => abilityCheck(c, a, dc, o),
    save: (a, dc) => {
      const r = d20(s.rng).natural; const b = saveBonus(s.pc!, a); const tot = r + b;
      push('roll', `🎲 ${a.toUpperCase()} save: ${r} ${fmtMod(b)} = ${tot} vs DC ${dc} — ${tot >= dc ? 'success' : 'fail'}`);
      return tot >= dc;
    },
    toolCheck: (dc) => {
      const pc = s.pc!; const b = am(pc, 'dex') + (hasItem(pc, 'thieves_tools') && (pc.cls === 'rogue' || pc.background === 'criminal') ? prof(pc) : 0);
      const r = d20(s.rng).natural; const tot = r + b;
      push('roll', `🎲 Thieves' tools: ${r} ${fmtMod(b)} = ${tot} vs DC ${dc} — ${tot >= dc ? 'success' : 'fail'}`);
      return tot >= dc;
    },
    flag: (n) => s.flags[n],
    set: (n, v = true) => { s.flags[n] = v; },
    give: (id, qty = 1) => { addItem(s.pc!, id, qty); },
    money: (cp) => { s.pc!.copper += cp; },
    pay: (cp) => { if (s.pc!.copper < cp) return false; s.pc!.copper -= cp; return true; },
    xp: (n) => {
      const pc = s.pc!; pc.xp += n; push('good', `+${n} XP`);
      if (pc.level < 2 && pc.xp >= xpToNext(pc) && !s.flags.level_hint) { s.flags.level_hint = true; push('sys', 'You feel ready to grow. Rest at the Smoking Barrel and Squib will see it. (Level 2 waits for you there.)'); }
    },
    fight: (id) => Combat.startCombat(c, id),
    move: (to, o = {}) => moveTo(c, to, o.quiet),
    npc: (id) => npcMem(s, id),
    hasCompanion: (id) => s.companions.includes(id),
    addCompanion: (id) => { if (!s.companions.includes(id)) s.companions.push(id); },
    journal: (t) => { if (!s.journal.includes(t)) s.journal.push(t); },
    advance: (m) => advanceTime(c, m),
    hour: () => Math.floor(((s.minutes + 8 * 60) % 1440) / 60),
    timeOfDay: () => {
      const h = Math.floor(((s.minutes + 8 * 60) % 1440) / 60);
      if (h === 0) return 'midnight';
      if (h < 5 || h >= 21) return 'night';
      if (h < 7) return 'dawn';
      if (h < 12) return 'morning';
      if (h < 17) return 'afternoon';
      return 'evening';
    },
    roomHasFoes: () => !!s.combat,
    talkTo: (id) => { s.talkingTo = id; },
  };
  return c;
}

bindGreet((id, c) => NPCS[id]?.greet(c));
Combat.bindPropFinder((c, noun) => !!Act.findProp(c, noun, true, true)?.state.tags.some((t) => t === 'weapon' || t === 'throw'));

const W: Act.World = {
  matchNpc: (c, n) => matchNpc(c, n), matchFeature: (c, n) => matchFeature(c, n), matchInventory: (c, n) => matchInventory(c, n),
  presentNpcs: (c) => presentNpcs(c), say: (c, t, to) => say(c, t, to), npcName: (id) => NPCS[id]?.name ?? id, npcNames: (id) => NPCS[id]?.names ?? [id],
};
let RAW = '';

function npcMem(s: GameState, id: string): NpcMemory {
  return (s.npc[id] ??= { disposition: 0, insults: 0, banned: false, met: false, topicsSeen: [] });
}

function skillCheck(c: Ctx, skill: Skill, dc: number, o: { adv?: boolean; dis?: boolean; quiet?: boolean }) {
  const pc = c.pc;
  const recall = !!c.flag('recall_check');
  if (recall) c.set('recall_check', false);
  let adv = combineAdv(!!o.adv || recall, !!o.dis || (pc.drunk >= 4 && !['performance', 'intimidation'].includes(skill)));
  let r = d20(c.rng, adv);
  if (r.natural === 1 && speciesOf(pc).flags?.includes('luck')) r = d20(c.rng);
  const b = skillBonus(pc, skill);
  let g = 0;
  if (c.flag('guidance')) { g += die(c.rng, 4); c.set('guidance', false); }
  if (c.flag('past_life_check')) { g += die(c.rng, 6); c.set('past_life_check', false); }
  let tot = r.natural + b + g;
  const reroll = (label: string) => {
    const r2 = d20(c.rng).natural; const t2 = r2 + b + g;
    c.out('roll', `🎲 ${cap(skill)}: ${r.natural} ${fmtMod(b)}${g ? ` +${g}` : ''} = ${tot}. ${label} — reroll: ${r2} → ${t2} vs DC ${dc} — ${t2 >= dc ? 'success' : 'fail'}`);
    tot = t2;
  };
  const avail = (id: string) => pc.resources[id] && pc.resources[id].used < pc.resources[id].max;
  if (tot < dc && !o.quiet && c.flag('inspired_check') && dc - tot <= 6) {
    c.set('inspired_check', false); const d = die(c.rng, 6);
    c.out('roll', `🎲 ${cap(skill)}: ${r.natural} ${fmtMod(b)}${g ? ` +${g}` : ''} = ${tot}, +${d} Bardic Inspiration = ${tot + d} vs DC ${dc} — ${tot + d >= dc ? 'success' : 'fail'}`);
    tot += d;
  } else if (tot < dc && !o.quiet && (skill === 'persuasion' || skill === 'deception') && avail('silver_tongue')) { pc.resources.silver_tongue.used += 1; reroll('Silver Tongue'); }
  else if (tot < dc && dc >= 12 && !o.quiet && avail('inspiration')) { pc.resources.inspiration.used += 1; reroll('Heroic Inspiration'); }
  else if (tot < dc && dc >= 12 && !o.quiet && avail('luck_points')) { pc.resources.luck_points.used += 1; reroll('Survivor\'s Luck'); }
  else {
    c.out('roll', `🎲 ${cap(skill)}: ${r.rolls.length > 1 ? `(${r.rolls.join(',')}) ` : ''}${r.natural} ${fmtMod(b)}${g ? ` +${g} guidance` : ''} = ${tot} vs DC ${dc} — ${tot >= dc ? 'success' : 'fail'}`);
  }
  return tot >= dc;
}

function abilityCheck(c: Ctx, a: Ability, dc: number, o: { adv?: boolean }) {
  const r = d20(c.rng, o.adv ? 'adv' : 'none').natural; const b = am(c.pc, a); const tot = r + b;
  c.out('roll', `🎲 ${a.toUpperCase()} check: ${r} ${fmtMod(b)} = ${tot} vs DC ${dc}`);
  return tot >= dc;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- time ----------
function advanceTime(c: Ctx, m: number) {
  const s = c.s;
  const before = s.minutes;
  s.minutes += m;
  Act.soberUp(c, m);
  // crossed midnight? (midnight is when (minutes + 480) % 1440 == 0)
  const mid = (x: number) => Math.floor((x + 480) / 1440);
  if (mid(s.minutes) > mid(before)) {
    if (!c.flag('bell_silenced')) {
      const near = ['thornwood', 'kessels_rest', 'foothills', 'chapel_yard', 'nave', 'vestry', 'crypt', 'breda_square', 'tavern'].includes(s.loc);
      if (near) c.out('bad', s.loc === 'tower' ? '' : 'Midnight. Far off, from the hills, a bell begins to toll. Slow, patient, wrong.');
      if (c.flag('cleared_yard') && s.loc !== 'chapel_yard') { c.set('cleared_yard', false); }
    } else if (!c.flag('first_quiet_midnight')) {
      c.set('first_quiet_midnight');
    }
  }
}

export function clock(s: GameState): string {
  const total = s.minutes + 8 * 60;
  const day = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return `${days[day % 7]}, May ${1 + day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------- rooms ----------
function room(s: GameState): Room { return ROOMS[s.loc]; }

function presentNpcs(c: Ctx): string[] {
  const r = room(c.s);
  const here = r.npcs ? r.npcs(c) : [];
  const comp = c.s.companions.filter((id) => !(id === 'alistair' && c.s.loc === 'tavern' && !c.flag('squib_ok_alistair')));
  return Array.from(new Set([...here, ...comp]));
}

function describe(c: Ctx, full = true) {
  const r = room(c.s);
  c.out('title', r.name);
  if (full) c.narr(r.desc(c));
  const npcs = (r.npcs ? r.npcs(c) : []).map((id) => NPCS[id]);
  if (npcs.length && full) c.sys('Here: ' + npcs.map((n) => `${n.name} (${n.short})`).join('; ') + '.');
  if (c.s.companions.length && full) c.sys('With you: ' + c.s.companions.map((id) => NPCS[id]?.name ?? id).join(', ') + '.');
  const exits = r.exits.filter((e) => !e.hidden?.(c) && !(e.blocked && e.to === r.id));
  c.sys('Exits: ' + exits.map((e) => e.label).join(' · '));
}

function moveTo(c: Ctx, to: string, quiet = false) {
  const s = c.s;
  if (!ROOMS[to]) return;
  c.set('prev_loc', s.loc);
  s.loc = to;
  s.talkingTo = null;
  if (!quiet) describe(c, true);
  const r = ROOMS[to];
  r.onEnter?.(c);
}

function findExit(c: Ctx, dest: string) {
  const r = room(c.s);
  const d = dest.toLowerCase().trim();
  if (!d) return null;
  if (d === 'back' && c.flag('prev_loc')) {
    const ex = r.exits.find((e) => e.to === c.flag('prev_loc') && !e.hidden?.(c));
    if (ex) return ex;
  }
  return r.exits.find((e) => !e.hidden?.(c) && (e.names.includes(d) || e.label.toLowerCase() === d)) ??
    r.exits.find((e) => !e.hidden?.(c) && e.names.some((n) => n.length > 2 && (d.includes(n) || n.includes(d)))) ?? null;
}

function go(c: Ctx, dest: string) {
  if (c.s.combat) { c.sys('You\'re in a fight. Try "flee" to run.'); return; }
  const ex = findExit(c, dest);
  if (!ex) {
    if (dest && /^(climb|jump|run|step|hop|cross|wade|swim)/.test(RAW.toLowerCase()) && Act.freeAction(c, W, RAW)) return;
    if (dest && (matchFeature(c, dest) || Act.findProp(c, dest, false))) { c.narr(`You walk over to the ${dest}.`); c.s.lastObject = dest; return; }
    c.sys(dest ? `You can't go "${dest}" from here.` : 'Go where?'); listExits(c); return;
  }
  const msg = ex.blocked?.(c);
  if (msg) { c.narr(msg); return; }
  if (ex.to === 'thornwood' && c.s.loc === 'breda_square' && !c.flag('quest_chapel')) c.sys('(Tip: the notice board and Squib can tell you what\'s up north.)');
  c.advance(ex.minutes);
  if (ex.minutes >= 60) c.narr(travelLine(c, ex.minutes));
  moveTo(c, ex.to);
  if (ex.travel && !c.s.combat) {
    const t = TRAVEL[ex.travel];
    if (t && c.rng && (die(c.rng, 100) / 100) <= t.chance) { const e = pick(c.rng, t.entries); c.out('title', 'On the road'); e(c); }
  }
}

function travelLine(c: Ctx, m: number) {
  const h = Math.round(m / 60);
  return `You travel for ${h} hour${h > 1 ? 's' : ''}. ${pick(c.rng, ['Birdsong, mud, and the creak of old trees.', 'The road is empty. That\'s the strange part.', 'Wind in the canopy, and the smell of rain coming.', 'Somewhere a woodpecker hammers, and stops.'])}`;
}

function listExits(c: Ctx) {
  const r = room(c.s);
  c.sys('Exits: ' + r.exits.filter((e) => !e.hidden?.(c)).map((e) => e.label).join(' · '));
}

// ---------- finding things ----------
function matchNpc(c: Ctx, name?: string): Npc | null {
  const ids = presentNpcs(c);
  if (!name) return null;
  const n = name.toLowerCase();
  const word = (x: string) => new RegExp(`(^|[^a-z])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(n);
  for (const id of ids) { const np = NPCS[id]; if (np && np.names.some((x) => x === n || word(x) || (n.length > 3 && x.startsWith(n)))) return np; }
  return null;
}

function matchFeature(c: Ctx, name: string) {
  const r = room(c.s);
  const n = name.toLowerCase();
  const fs = (r.features ?? []).filter((f) => !f.hidden?.(c));
  return fs.find((f) => f.names.includes(n)) ?? fs.find((f) => f.names.some((x) => n.includes(x) || (n.length > 2 && x.includes(n)))) ?? null;
}

function matchInventory(c: Ctx, name: string) {
  const n = name.toLowerCase().replace(/^(my|the)\s+/, '');
  const inv = c.pc.inventory;
  if (/^(it|that|this)$/.test(n) && c.s.lastObject && c.s.lastObject !== n) return matchInventory(c, c.s.lastObject);
  const custom = inv.find((s) => s.id.startsWith('custom:') && s.id.slice(7).toLowerCase().includes(n));
  if (custom) return custom;
  return inv.find((s) => { const it = ITEMS[s.id]; return it && (it.name.toLowerCase() === n || it.id === n.replace(/ /g, '_')); }) ??
    inv.find((s) => { const it = ITEMS[s.id]; return it && (it.name.toLowerCase().includes(n) || it.aliases?.some((a) => a === n || n.includes(a)) || (n.length > 3 && it.id.includes(n.replace(/ /g, '_')))); }) ?? null;
}

// ---------- talking ----------
function talk(c: Ctx, npcName?: string, topic?: string) {
  if (npcName === '__end__') { if (c.s.talkingTo) c.narr('You end the conversation.'); c.s.talkingTo = null; return; }
  let np = npcName ? matchNpc(c, npcName) : (c.s.talkingTo ? NPCS[c.s.talkingTo] : null);
  if (!np && !npcName) { const ids = presentNpcs(c).filter((id) => id !== 'kettle'); if (ids.length === 1 || (topic && ids.length)) np = NPCS[ids[0]]; }
  if (!np) {
    if (npcName) c.sys(`There's nobody called "${npcName}" here.`);
    else { const ids = presentNpcs(c); c.sys(ids.length ? 'Talk to whom? ' + ids.map((i) => NPCS[i].name).join(', ') : 'There\'s nobody here to talk to.'); }
    return;
  }
  const mem = c.npc(np.id);
  if (c.s.talkingTo !== np.id && !topic) { c.s.talkingTo = np.id; np.greet(c); mem.met = true; listTopics(c, np); return; }
  c.s.talkingTo = np.id;
  if (!mem.met) { np.greet(c); mem.met = true; }
  if (topic) answerTopic(c, np, topic);
  else listTopics(c, np);
}

function listTopics(c: Ctx, np: Npc) {
  const ts = np.topics.filter((t) => !t.when || t.when(c));
  if (ts.length) c.sys(`Ask ${np.name} about: ${ts.map((t) => t.keys[0]).join(', ')}.`);
}

function answerTopic(c: Ctx, np: Npc, text: string): boolean {
  const t = text.toLowerCase();
  if (np.id === 'squib' && c.npc('squib').banned) { c.narr('Squib doesn\'t answer.'); return true; }
  let best: { score: number; topic: typeof np.topics[number] } | null = null;
  for (const tp of np.topics) {
    if (tp.when && !tp.when(c)) continue;
    for (const k of tp.keys) {
      const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (re.test(t)) { const sc = k.length; if (!best || sc > best.score) best = { score: sc, topic: tp }; }
    }
  }
  if (best) { best.topic.say(c); c.npc(np.id).topicsSeen.push(best.topic.id); return true; }
  // Unknown: let the oracle decide whether they know anything, phrased in character.
  c.say(np.id, pick(c.rng, np.unknown));
  return false;
}

function topicHit(c: Ctx, np: Npc | undefined, text: string): boolean {
  if (!np) return false;
  const t = text.toLowerCase();
  return np.topics.some((tp) => (!tp.when || tp.when(c)) && tp.keys.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(t)));
}

function say(c: Ctx, text: string, to?: string) {
  c.set('last_said', text);
  const present = presentNpcs(c);
  const names = present.flatMap((id) => NPCS[id]?.names ?? []);
  const foeNames = c.s.combat ? c.s.combat.units.filter((u) => u.side === 'foe').map((u) => u.name.toLowerCase()) : [];
  const sp = classifySpeech(text, [...names, ...foeNames]);
  if (sp.present && (sp.act === 'insult' || sp.act === 'threat')) c.s.stats.insults += 1;
  if (/vessariel/i.test(text)) { c.bad('Somewhere far to the west, something hears its name. The chaos rises.'); c.s.chaos = Math.min(9, c.s.chaos + 1); }
  // who is it aimed at?
  let np: Npc | null = null;
  if (to) np = matchNpc(c, to);
  if (!np && sp.addressee) np = matchNpc(c, sp.addressee);
  if (!np && c.s.talkingTo && present.includes(c.s.talkingTo)) np = NPCS[c.s.talkingTo];
  if (!np) { const ppl = present.filter((id) => id !== 'kettle'); if (ppl.length === 1) np = NPCS[ppl[0]]; else if (ppl.includes('squib') && c.s.loc === 'tavern') np = NPCS.squib; }
  if (c.s.combat) {
    if (sp.present) { Combat.playerSay(c, sp.act, text); if (np && np.speech && present.includes(np.id)) np.speech(c, sp.act, sp.severity, text); return; }
    if (np?.id === 'merah' || /merah/i.test(text)) { const m = NPCS.merah; answerTopic(c, m, text); return; }
    c.narr('Nobody is listening. They\'re busy trying to kill you.');
    return;
  }
  if (np?.hears && np.hears(c, text)) return;
  if (sp.present) {
    if (np?.speech && np.speech(c, sp.act, sp.severity, text)) return;
    if (!np) { c.narr(sp.act === 'exclamation' ? pick(c.rng, ['Your voice echoes.', 'Nobody\'s around to hear it, which is probably for the best.', 'Fair enough.']) : 'Nobody is here to hear it.'); return; }
    if (sp.act === 'insult') { c.narr(`${np.name} stiffens.`); c.npc(np.id).disposition -= 1; return; }
  }
  if (!np) { c.narr(pick(c.rng, ['Nobody answers.', 'The words hang in the air.'])); return; }
  c.s.talkingTo = np.id;
  const mem = c.npc(np.id);
  const greeting = /^(hello|hi|hey|hiya|howdy|greetings|good (morning|evening|afternoon|day)|yo|sup|what'?s up|evening|morning|oi|ahoy)\b/i.test(text.trim());
  if (!mem.met || greeting) { np.greet(c); mem.met = true; if (greeting && text.trim().split(/\s+/).length <= 3) { listTopics(c, np); return; } }
  answerTopic(c, np, text);
}

// ---------- shops ----------
function shop(c: Ctx) {
  const r = room(c.s);
  const np = r.shop ? NPCS[r.shop] : null;
  if (!np?.shop) { c.sys('There\'s nothing for sale here.'); return; }
  if (c.npc(np.id).banned) { c.narr(`${np.name} won't serve you.`); return; }
  const disc = discount(c, np.id);
  c.out('title', `${np.name} — for sale`);
  for (const si of np.shop) {
    const nm = MENU[si.id]?.name ?? ITEMS[si.id]?.name ?? si.id;
    const price = Math.ceil((si.price ?? ITEMS[si.id]?.price ?? 0) * disc);
    const extra = ITEMS[si.id] ? ` — ${ITEMS[si.id].desc}` : MENU[si.id] ? ` — ${MENU[si.id].text}` : '';
    c.narr(`• ${nm}: ${fmtMoney(price)}${extra}`);
  }
  c.sys(`You have ${fmtMoney(c.pc.copper)}. Type "buy <item>"${np.buys ? ', or "sell <item>"' : ''}.`);
}

function discount(c: Ctx, npcId: string) {
  let d = 1;
  if (npcId === 'garrick' && c.flag('garrick_scared')) d *= 0.9;
  if (npcId === 'garrick' && c.flag('garrick_friend')) d *= 0.9;
  if (npcId === 'squib' && c.flag('chapel_paid')) d = 0;
  return d;
}

function buy(c: Ctx, name: string, qty: number) {
  const r = room(c.s);
  const np = r.shop ? NPCS[r.shop] : null;
  if (!np?.shop) { c.sys('Nobody here is selling.'); return; }
  if (c.npc(np.id).banned) { c.narr(`${np.name} won't serve you.`); return; }
  const n = name.toLowerCase();
  const si = np.shop.find((x) => { const nm = (MENU[x.id]?.name ?? ITEMS[x.id]?.name ?? x.id).toLowerCase(); return nm === n || x.id === n.replace(/ /g, '_') || nm.includes(n) || n.includes(nm) || ITEMS[x.id]?.aliases?.some((a) => a === n || n.includes(a)) || (x.id === 'ale' && /ale|beer|brown|drink|pint/.test(n)) || (x.id === 'stew' && /stew|soup|food/.test(n)) || (x.id === 'room_private' && /room|bed/.test(n)) || (x.id === 'room_floor' && /floor|hearth/.test(n)) || (x.id === 'trenchfire' && /shot|rotgut|whisk|trench/.test(n)) || (x.id === 'meat_pie' && /pie/.test(n)) || (x.id === 'roast_chicken' && /chicken|roast|meal/.test(n)); });
  if (!si) { c.sys(`${np.name} doesn't sell "${name}". Type "shop" to see what's for sale.`); return; }
  const unit = Math.ceil((si.price ?? ITEMS[si.id]?.price ?? 0) * discount(c, np.id));
  const qtyEff = ITEMS[si.id]?.kind === 'ammo' ? qty : qty;
  const total = unit * qtyEff;
  if (!c.pay(total)) { c.bad(`That costs ${fmtMoney(total)}. You have ${fmtMoney(c.pc.copper)}.`); return; }
  if (MENU[si.id]) {
    const m = MENU[si.id];
    if (si.id.startsWith('room_')) { c.set('room_paid', si.id); c.narr(`${m.name}: ${m.text} (Say "sleep" when you're ready.)`); }
    else if (si.id === 'ale' || si.id === 'trenchfire') {
      const id = si.id === 'ale' ? 'mug_ale' : 'trenchfire_shot';
      c.give(id, qtyEff);
      c.s.lastObject = si.id === 'ale' ? 'mug' : 'shot';
      c.narr(si.id === 'ale' ? `Squib pulls ${qtyEff > 1 ? `${qtyEff} mugs` : 'a mug'} of Barrel Brown and slides ${qtyEff > 1 ? 'them' : 'it'} down the bar to you. Brown, cold enough, and honest.` : 'Squib pours a shot of Trenchfire with the face of a man handing someone a loaded gun. The dwarves lean in to watch.');
      c.sys('("drink it" when you\'re ready.)');
    } else {
      c.narr(`${m.name}. ${m.text}`);
      if (m.heal) { c.pc.hp = Math.min(c.pc.maxHp, c.pc.hp + m.heal); }
    }
  } else {
    const it = ITEMS[si.id];
    const count = it.kind === 'ammo' && it.ammoFor !== 'arrow' ? qtyEff : it.kind === 'ammo' ? qtyEff * 20 : qtyEff;
    c.give(si.id, count);
    c.good(`Bought ${count > 1 ? count + ' × ' : ''}${it.name} for ${fmtMoney(total)}.`);
    if (it.weapon || it.armor) c.sys(`Type "equip ${it.name.toLowerCase()}" to use it.`);
  }
  if (total === 0 && np.id === 'squib') c.narr('Squib waves away your coin. "Your money\'s no good tonight."');
}

function sell(c: Ctx, name: string) {
  const r = room(c.s);
  const np = r.shop ? NPCS[r.shop] : (c.s.loc === 'tavern' && /amulet/.test(name) && presentNpcs(c).includes('sereza') ? NPCS.sereza : null);
  if (/amulet/.test(name) && presentNpcs(c).includes('sereza')) {
    if (!hasItem(c.pc, 'bone_amulet')) { c.sys('You don\'t have it.'); return; }
    removeItem(c.pc, 'bone_amulet'); c.money(7500); c.set('sold_amulet');
    c.say('sereza', 'She counts out seventy-five gold in crisp crown coin and wraps the amulet in silk without touching it. "Pleasure." She leaves before you finish your drink.');
    c.journal('You sold the bone amulet to Sereza Harrow for 75 gp. She paid in crown-minted gold.');
    return;
  }
  if (!np?.buys) { c.sys('Nobody here is buying.'); return; }
  const st = matchInventory(c, name);
  if (!st) { c.sys(`You don't have "${name}".`); return; }
  const it = ITEMS[st.id];
  const ok = np.buys.includes('any') || np.buys.includes(it.kind) || np.buys.includes(it.id);
  if (!ok || !it.price) { c.say(np.id, `"Not something I buy."`); return; }
  if ([c.pc.equipped.main, c.pc.equipped.armor, c.pc.equipped.shield, c.pc.equipped.ranged].includes(it.id) && st.qty <= 1) { c.sys('You\'re using that. Unequip it first.'); return; }
  const price = it.id === 'wolf_pelt' ? 100 : Math.floor(it.price / 2);
  const qty = it.id === 'wolf_pelt' ? st.qty : 1;
  removeItem(c.pc, it.id, qty);
  c.money(price * qty);
  c.good(`Sold ${qty > 1 ? qty + ' × ' : ''}${it.name} for ${fmtMoney(price * qty)}.`);
  if (it.id === 'wolf_pelt') c.say('hetch', '"Mm. Fresh. Adequate." He looks pleased in a way only cats can hide.');
}

// ---------- items ----------
function take(c: Ctx, name: string) {
  const r = room(c.s);
  if (name === 'all' || /^(everything|all|loot)$/.test(name)) {
    const items = c.s.roomItems[c.s.loc] ?? [];
    if (!items.length) { const f = (r.features ?? []).find((x) => x.take && !x.hidden?.(c)); if (f) { f.take!(c); return; } c.sys('There\'s nothing here to take.'); return; }
    for (const s of items) { c.give(s.id, s.qty); c.good(`Taken: ${itemName(s.id)}${s.qty > 1 ? ` × ${s.qty}` : ''}.`); }
    c.s.roomItems[c.s.loc] = [];
    return;
  }
  const f = matchFeature(c, name);
  if (f?.take) { f.take(c); return; }
  const items = c.s.roomItems[c.s.loc] ?? [];
  const n = name.toLowerCase();
  const idx = items.findIndex((s) => itemName(s.id).toLowerCase().includes(n) || n.includes(itemName(s.id).toLowerCase()) || !!ITEMS[s.id]?.aliases?.includes(n));
  if (idx >= 0) { const s = items[idx]; c.give(s.id, s.qty); items.splice(idx, 1); c.s.lastObject = itemName(s.id).toLowerCase(); c.good(`Taken: ${itemName(s.id)}.`); return; }
  if (f) { c.narr('You can\'t take that.'); return; }
  if (matchNpc(c, name)) { c.narr('People aren\'t items, however tempting.'); return; }
  const p = Act.findProp(c, name, true);
  if (p) { Act.takeProp(c, W, p); return; }
  c.narr(`You look around for ${/s$/.test(name) ? '' : /^[aeiou]/.test(name) ? 'an ' : 'a '}${name}. There isn't one.`);
}

function drop(c: Ctx, name: string) {
  const st = matchInventory(c, name);
  if (!st) { c.sys(`You don't have "${name}".`); return; }
  const it = ITEMS[st.id];
  if (it && (it.kind === 'key' || it.kind === 'note')) { c.sys('Better hold on to that.'); return; }
  removeItem(c.pc, st.id, 1);
  (c.s.roomItems[c.s.loc] ??= []).push({ id: st.id, qty: 1 });
  c.narr(`You drop the ${itemName(st.id).toLowerCase()}.`);
}

function equip(c: Ctx, name: string) {
  const pc = c.pc;
  const st = matchInventory(c, name);
  if (!st) {
    if (/fist|fists|hands|bare/.test(name)) { pc.equipped.main = undefined; c.narr('You put your weapons away and raise your fists.'); return; }
    c.sys(`You don't have "${name}".`); return;
  }
  const it = ITEMS[st.id];
  if (!it) { c.narr(`You hold the ${itemName(st.id).toLowerCase()} at the ready. It's not much of a weapon, but it's yours.`); return; }
  if (!it.weapon && !it.armor && !it.acBonus && /^(mug_|bottle_|chair_leg|rock|stick|bone|torch|candle|crowbar|lute)/.test(it.id)) { c.narr(`You heft the ${it.name.toLowerCase()}. It'll do as a club. ("hit zombie with ${it.name.toLowerCase()}" in a fight.)`); c.s.lastObject = it.name.toLowerCase(); return; }
  if (it.weapon) {
    if (it.weapon.ranged && !it.weapon.thrown) { pc.equipped.ranged = it.id; c.narr(`You ready your ${it.name.toLowerCase()}.${it.weapon.category === 'firearm' ? ` (${pc.ammo[it.id] ?? 0}/${it.weapon.capacity} loaded)` : ''}`); }
    else { pc.equipped.main = it.id; if (it.weapon.twoHanded) pc.equipped.shield = undefined; c.narr(`You draw your ${it.name.toLowerCase()}.`); }
    if (!(pc.weaponProf.includes(it.weapon.category) || (pc.cls === 'rogue' && (it.weapon.finesse || it.weapon.light)))) c.sys('You aren\'t trained with this: no proficiency bonus.');
    return;
  }
  if (it.armor) {
    if (it.armor.kind === 'shield') { pc.equipped.shield = it.id; c.narr('You sling the shield onto your arm.'); }
    else { pc.equipped.armor = it.id; pc.equipped.worn = pc.equipped.worn.filter((w) => w !== 'mage_armor_active'); c.narr(`You put on the ${it.name.toLowerCase()}.`); if (!pc.armorProf.includes(it.armor.kind)) c.bad('You aren\'t trained in this armour. (You can\'t cast spells in it, and it will slow you.)'); }
    c.sys(`AC ${armorClass(pc)}.`);
    return;
  }
  if (it.acBonus || it.saveBonus) { if (!pc.equipped.worn.includes(it.id)) pc.equipped.worn.push(it.id); c.narr(`You put on the ${it.name.toLowerCase()}. It's warm, like someone just took it off.`); c.sys(`AC ${armorClass(pc)}.`); return; }
  c.sys('You can\'t equip that.');
}

function unequip(c: Ctx, name: string) {
  const pc = c.pc;
  const st = matchInventory(c, name);
  if (!st) { c.sys(`You don't have "${name}".`); return; }
  for (const k of ['main', 'offhand', 'armor', 'shield', 'ranged'] as const) if (pc.equipped[k] === st.id) pc.equipped[k] = undefined;
  pc.equipped.worn = pc.equipped.worn.filter((w) => w !== st.id);
  c.narr(`You put away the ${itemName(st.id).toLowerCase()}.`);
}

function use(c: Ctx, name: string, target?: string) {
  const st = matchInventory(c, name);
  if (!st) {
    const f = matchFeature(c, name); if (f?.pull) { f.pull(c); return; } if (f?.open) { f.open(c, 'normal'); return; }
    if (Act.freeAction(c, W, RAW)) return;
    c.sys(`You don't have "${name}".`); return;
  }
  const it = ITEMS[st.id];
  if (!it) { c.narr(`You use the ${itemName(st.id).toLowerCase()}. ${pick(c.rng, ['It does what it does.', 'It\'s a comfort, at least.', 'Nothing much happens, but you feel better for having it.'])}`); return; }
  if (it.kind === 'drink') { Act.drink(c, W, it.name); return; }
  if (it.id === 'potion_healing') { Combat.playerUsePotion(c, target); return; }
  if (it.id === 'scroll_bless') {
    if (!c.s.combat) { c.sys('Save it for a fight. ("read scroll" when the fighting starts.)'); return; }
    removeItem(c.pc, 'scroll_bless');
    for (const u of c.s.combat.units.filter((u) => u.side === 'party')) if (!u.conditions.includes('blessed')) u.conditions.push('blessed');
    c.good('You read the scroll aloud. Warm light settles on you and your allies: +1d4 to attack rolls this fight.');
    Combat.afterPlayerAction(c); return;
  }
  if (it.id === 'black_label') { removeItem(c.pc, 'black_label'); c.pc.tempHp = Math.max(c.pc.tempHp, 5); c.narr('Squib\'s Reserve. It tastes like smoke and old oak and being forgiven. (+5 temporary HP.)'); if (c.hasCompanion('alistair')) c.say('alistair', '"Is that black label? Brother. BROTHER. Pour some through me."'); return; }
  if (it.kind === 'food') { Act.eat(c, W, it.name.toLowerCase()); return; }
  if (/torch|candle|lantern|lamp/.test(it.id)) { Act.freeAction(c, W, `light ${it.name.toLowerCase()}`); return; }
  if (it.id === 'lute') { Act.freeAction(c, W, 'play my lute'); return; }
  if (it.id === 'marked_cards') { Act.freeAction(c, W, 'cheat at cards'); return; }
  if (it.id === 'rope') { Act.freeAction(c, W, RAW.replace(/^use\s+/i, 'tie ')); return; }
  if (it.id === 'cult_candle') {
    removeItem(c.pc, 'cult_candle');
    c.narr('You light the green-black candle. The flame is the wrong colour. The smell of honey and graves fills your head, and for a moment you see someone you lost, smiling, and behind them, far away, a pale woman in a crown, watching kindly.');
    c.bad('Something remembers you now. (Chaos +1)'); c.s.chaos = Math.min(9, c.s.chaos + 1); return;
  }
  if (it.read) { read(c, name); return; }
  if (it.weapon || it.armor || it.acBonus) { equip(c, name); return; }
  if (target || RAW.split(/\s+/).length > 3) { if (Act.freeAction(c, W, RAW)) return; }
  c.narr(`You fiddle with the ${it.name.toLowerCase()}. Nothing happens.`);
}

function read(c: Ctx, name: string) {
  if (!name) { c.sys('Read what?'); return; }
  const f = matchFeature(c, name);
  if (f?.read) { f.read(c); return; }
  const st = matchInventory(c, name);
  if (st && ITEMS[st.id].read) { c.narr(ITEMS[st.id].read!); if (st.id === 'cultist_journal' && !c.flag('read_journal')) { c.set('read_journal'); c.journal('The cultist\'s journal underlines the name ALISTAIR. Whoever that is, he\'s below the chapel.'); } return; }
  if (st?.id === 'scroll_bless') { use(c, name); return; }
  if (f) { c.narr(f.look(c)); return; }
  c.sys(`There's nothing called "${name}" to read.`);
}

function examine(c: Ctx, name: string) {
  if (!name || /^(around|room|here|area)$/.test(name)) { describe(c); return; }
  if (/^(me|myself|self)$/.test(name)) { sheet(c); return; }
  if (c.s.combat) {
    const t = Combat.resolveTarget(c, name);
    if (t && t.monster) { const def = MONSTERS[t.monster]; c.narr(`${t.name}: ${def.desc} (AC ${t.ac}; ${hpDesc(t.hp, t.maxHp)})`); return; }
  }
  const np = matchNpc(c, name);
  if (np) { c.narr(np.look(c)); return; }
  const f = matchFeature(c, name);
  if (f) { c.narr(f.look(c)); return; }
  const st = matchInventory(c, name);
  if (st) { const it = ITEMS[st.id]; c.s.lastObject = itemName(st.id).toLowerCase(); c.narr(it ? `${it.name}${st.qty > 1 ? ` (× ${st.qty})` : ''}: ${it.desc}` : `${itemName(st.id)}: yours, and important to you.`); return; }
  const ex = findExit(c, name);
  if (ex) { c.narr(`That way lies ${ROOMS[ex.to].name}.`); return; }
  const ri = (c.s.roomItems[c.s.loc] ?? []).find((x) => itemName(x.id).toLowerCase().includes(name.toLowerCase()));
  if (ri) { c.narr(`${itemName(ri.id)}, lying here. ${ITEMS[ri.id]?.desc ?? ''}`); return; }
  const p = Act.findProp(c, name, true);
  if (p) { c.s.lastObject = p.def?.name ?? p.state.name; c.narr(p.def?.desc ?? `${p.spawned ? 'There is one here: ' : ''}${/^[aeiou]/.test(p.state.name) ? 'an' : 'a'} ${p.state.name}${p.state.tags.includes('fine') ? ', and a fine one' : ''}${p.state.broken ? ', broken' : ''}. Nothing remarkable about it.`); return; }
  c.narr(`You look for ${/s$/.test(name) ? '' : /^[aeiou]/.test(name) ? 'an ' : 'a '}${name}. There isn't one here.`);
}


function search(c: Ctx, name: string) {
  const r = room(c.s);
  if (name) {
    const f = matchFeature(c, name);
    if (f?.search) { c.advance(10); f.search(c); return; }
    if (f) { c.narr(f.look(c)); return; }
    if (/bod(y|ies)|corpse|robes|remains/.test(name)) { c.narr('Nothing more on the dead.'); return; }
    if (!/^(room|area|around|here|everything|place)$/.test(name)) {
      const np = matchNpc(c, name);
      if (np) { Act.freeAction(c, W, `pickpocket ${name}`); return; }
      const p = Act.findProp(c, name, true);
      if (p) {
        c.advance(5);
        const a = askOracle(c.rng, 'unlikely', c.s.chaos);
        c.out('roll', `🔮 Anything in the ${name}? (${a.chance}%): ${a.answer}.`);
        const key = `searched_prop_${c.s.loc}_${p.state.id}`;
        if (c.flag(key) || !a.answer.includes('Yes')) { c.set(key, true); c.narr(`You search the ${name}. ${pick(c.rng, ['Dust and nothing.', 'Nothing of use.', 'Cobwebs, one dead beetle.'])}`); return; }
        c.set(key, true);
        const cp = a.answer === 'Exceptional yes' ? 100 + die(c.rng, 100) : 1 + die(c.rng, 12);
        c.money(cp); c.good(`Tucked away in the ${name}: ${cp >= 100 ? `${Math.floor(cp / 100)} gold and change` : `${cp} copper`}.`);
        return;
      }
      c.narr(`There's no ${name} here to search.`); return;
    }
  }
  const fs = (r.features ?? []).filter((f) => f.search && !f.hidden?.(c));
  if (!fs.length) { c.narr('You search the area and find nothing of interest.'); return; }
  c.advance(10);
  // search the first feature not yet searched, then cycle
  const key = `searched_${c.s.loc}`;
  const i = ((c.flag(key) as number) || 0) % fs.length;
  c.set(key, i + 1);
  c.narr(`You search the ${fs[i].names[0]}.`);
  fs[i].search!(c);
}

function interact(c: Ctx, kind: 'open' | 'pull' | 'ring' | 'cut', thing: string, method: 'normal' | 'force' | 'pick' | 'kick' = 'normal') {
  const f = matchFeature(c, thing || (kind === 'ring' || kind === 'cut' ? 'bell' : 'door'));
  if (kind === 'cut' && c.s.combat && Combat.resolveTarget(c, thing)) { Combat.playerAttack(c, 'melee', 'cut', thing); return; }
  if (!f) {
    const p = Act.findProp(c, thing, true);
    if (p) {
      const nm = p.def?.name ?? p.state.name;
      if (kind === 'open') { if (method === 'kick' || method === 'force') { Act.freeAction(c, W, `break ${nm}`); return; } c.narr(/wardrobe|cupboard|cabinet|drawer|desk|box|crate|chest|sarcophag|coffin|lid|door|window/.test(nm) ? `You open the ${nm}. ${pick(c.rng, ['Empty.', 'Nothing inside but dust.', 'It creaks, and holds nothing you need.'])}` : `The ${nm} doesn't open.`); return; }
      if (kind === 'pull' || kind === 'cut') { Act.freeAction(c, W, RAW); return; }
    }
    if (kind === 'cut' && Act.freeAction(c, W, RAW)) return;
    c.narr(`You don't see any ${thing} here.`); return;
  }
  const h = kind === 'open' ? f.open : kind === 'pull' ? f.pull : kind === 'ring' ? f.ring : f.cut;
  if (!h) { c.narr(kind === 'open' ? 'It doesn\'t open.' : 'Nothing happens.'); return; }
  if (kind === 'open') f.open!(c, method); else (h as (c: Ctx) => void)(c);
}

// ---------- rest ----------
function rest(c: Ctx, kind: 'short' | 'long') {
  const pc = c.pc;
  if (c.s.combat) { c.sys('Not in the middle of a fight.'); return; }
  const r = room(c.s);
  if (kind === 'long') {
    if (r.id === 'tavern') {
      if (c.npc('squib').banned) { c.narr('Squib won\'t rent to you.'); return; }
      if (!c.flag('room_paid') && !c.flag('chapel_paid')) {
        if (!c.pay(5)) { c.bad('You can\'t afford even the floor by the hearth (5 cp).'); return; }
        c.narr('You pay five copper for the floor by the hearth. Blanket included, dignity not.');
      }
      c.set('room_paid', false);
    } else if (!r.outdoors && r.rest !== 'long') { c.sys('This isn\'t a safe place to sleep. Find the tavern, or camp outdoors.'); return; }
    else if (r.outdoors) {
      c.narr('You make camp off the road.');
      if (r.region !== 'Breda' && die(c.rng, 6) === 1) { c.out('title', 'In the night'); c.narr('Something moves at the edge of the firelight.'); c.fight('wolf_single'); return; }
    }
    if (r.id === 'tavern' && c.flag('chapel_paid') && !c.flag('act1_finale')) finale(c);
    // sleep until 07:00 the next morning (or 8 hours, if it's already morning)
    const nowMin = (c.s.minutes + 480) % 1440;
    let until = (7 * 60 - nowMin + 1440) % 1440;
    if (until < 6 * 60) until += nowMin < 7 * 60 ? 0 : 1440 - until > 0 ? 0 : 0;
    if (until < 6 * 60) until = 8 * 60;
    c.advance(until);
    pc.hp = pc.maxHp; pc.tempHp = 0; pc.hitDice = pc.level; pc.slots.used = 0; pc.deathSaves = { ok: 0, fail: 0 }; pc.drunk = 0;
    pc.conditions = pc.conditions.filter((x) => x !== 'wildshape' && x !== 'shillelagh'); pc.wildHp = 0;
    for (const k of Object.keys(pc.resources)) pc.resources[k].used = 0;
    pc.equipped.worn = pc.equipped.worn.filter((w) => w !== 'mage_armor_active');
    for (const id of c.s.companions) c.s.companionHp[id] = 999;
    for (const id of c.s.companions) c.s.companionHp[id] = (Combat.COMPANIONS[id]?.maxHp ?? 10);
    c.set('one_more_round_used', false);
    c.good(`You sleep, and wake rested. HP ${pc.hp}/${pc.maxHp}. Spells and abilities restored. (${clock(c.s)})`);
    if (r.id === 'tavern') maybeLevel(c);
    return;
  }
  // short rest: 1 hour, spend hit dice until healthy
  c.advance(60);
  let spent = 0; let healed = 0;
  while (pc.hitDice > 0 && pc.hp < pc.maxHp) { const h = rollHitDie(c.rng, pc); pc.hp = Math.min(pc.maxHp, pc.hp + h); healed += h; pc.hitDice -= 1; spent += 1; }
  for (const k of Object.keys(pc.resources)) if (pc.resources[k].per === 'short') pc.resources[k].used = 0;
  if (pc.resources.second_wind && pc.resources.second_wind.used > 0) pc.resources.second_wind.used -= 1;
  if (cls(pc).casting?.pact) pc.slots.used = 0;
  const ar = pc.resources.arcane_recovery;
  if (pc.cls === 'wizard' && ar && ar.used < ar.max && pc.slots.used > 0) { ar.used += 1; pc.slots.used -= 1; c.sys('Arcane Recovery: you study your notes and recover a spell slot.'); }
  for (const id of c.s.companions) c.s.companionHp[id] = Math.min(Combat.COMPANIONS[id].maxHp, (c.s.companionHp[id] ?? 1) + 5);
  c.good(`You rest for an hour.${spent ? ` You spend ${spent} hit ${spent > 1 ? 'dice' : 'die'} and recover ${healed} HP.` : ''} HP ${pc.hp}/${pc.maxHp}.${pc.hitDice === 0 && pc.hp < pc.maxHp ? ' (No hit dice left: you need a long rest.)' : ''}`);
}

function finale(c: Ctx) {
  c.set('act1_finale');
  c.out('title', 'Midnight');
  c.narr('That evening the Smoking Barrel is full. The dwarves sing. Someone dances badly. And at midnight, the whole room goes quiet at once, listening.');
  c.narr('No bell.');
  c.narr('Squib raises a mug of water. "To the silence." The room roars. Mugs bang. And every candle in the tavern gutters, for one heartbeat, green.');
  if (hasItem(c.pc, 'bone_amulet')) c.bad('The bone amulet at your throat flares hot, and stays hot. When you face west, toward Suomi, it burns.');
  if (c.hasCompanion('alistair')) {
    c.say('alistair', 'Alistair has gone very still. "Huh," he says. "That\'s funny." He isn\'t laughing. "The bell wasn\'t for keeping her down, you know. It was for singing to her. All the way down the... the west road. To the old vaults."');
    c.say('alistair', 'His jaw clicks. "Why do I know that?"');
  }
  c.out('title', 'End of Act One');
  c.narr('Somewhere to the west, beneath the white spires of the capital, something that should be sleeping turns over, and remembers a little more.');
  c.sys('Thank you for playing Hams Tavern v0.1. The bells at Coltale, Largo and Borschardt are still ringing, and that\'s the next version. You can keep exploring Breda and the foothills.');
  c.journal('Act One complete. The bell was a signal, not a lock. Something waits in "the old vaults," down the west road.');
}

// ---------- sheet / inventory / help ----------
function sheet(c: Ctx) {
  const pc = c.pc;
  const k = cls(pc); const sp = spOf(pc); const bg = bgOf(pc);
  c.out('title', `${pc.name} — level ${pc.level} ${sp.name} ${k.name}`);
  c.narr(`${bg.name}. HP ${pc.hp}/${pc.maxHp}${pc.tempHp ? ` (+${pc.tempHp} temp)` : ''} · AC ${armorClass(pc)} · Proficiency +${prof(pc)} · XP ${pc.xp}/${XP_FOR_LEVEL[pc.level + 1] ?? '—'} · ${fmtMoney(pc.copper)}`);
  c.narr(ABILITIES.map((a) => `${a.toUpperCase()} ${pc.abilities[a]} (${fmtMod(am(pc, a))})`).join(' · '));
  const main = weaponById(pc.equipped.main);
  const ranged = weaponById(pc.equipped.ranged);
  const unarmed = weaponById('unarmed')!;
  const atk = [main, ranged, unarmed].filter(Boolean).map((w) => `${w!.name} ${fmtMod(weaponToHit(pc, w!))} (${weaponDamageExpr(pc, w!)} ${w!.dtype})${w!.category === 'firearm' ? ` [${pc.ammo[w!.id] ?? 0}/${w!.capacity}${c.flag(`jam_${w!.id}`) ? ', JAMMED' : ''}]` : ''}`);
  c.narr('Attacks: ' + atk.join(' · '));
  if (pc.cantrips.length || pc.spells.length) c.narr(`Spells (attack ${fmtMod(spellAttack(pc))}, DC ${spellDC(pc)}): cantrips ${pc.cantrips.map((s) => SPELLS[s].name).join(', ')}${pc.spells.length ? `; level 1 (${pc.slots.max - pc.slots.used}/${pc.slots.max} slots) ${pc.spells.map((s) => SPELLS[s].name).join(', ')}` : ''}`);
  c.narr('Skills: ' + pc.skills.map((s) => `${s} ${fmtMod(skillBonus(pc, s))}`).join(', '));
  const feat = FEATS[pc.feat];
  c.narr(`Class (${k.title}): ` + [...(k.features[1] ?? []), ...(pc.level >= 2 ? k.features[2] ?? [] : [])].join(' · '));
  c.narr(`${sp.name}: ` + sp.traits.join(' · ') + (sp.power ? ` · ${sp.power.name}: ${sp.power.desc}` : ''));
  if (feat) c.narr(`Feat — ${feat.name}: ${feat.desc}`);
  c.narr('Solo Grit: +4 HP at level 1, for adventuring alone.');
  const res = Object.entries(pc.resources).map(([k2, v]) => `${k2.replace(/_/g, ' ')} ${v.max - v.used}/${v.max}`);
  if (res.length) c.narr('Resources: ' + res.join(' · '));
  if (pc.drunk > 0) c.narr(`You are ${Act.drunkWord(pc.drunk)}.`);
  if (pc.look) c.narr('Look: ' + pc.look);
  if (pc.backstory) c.narr('Backstory: ' + pc.backstory);
}

function inventory(c: Ctx) {
  const pc = c.pc;
  c.out('title', 'Your pack');
  const eq = pc.equipped;
  for (const s of pc.inventory) {
    const it = ITEMS[s.id]; if (!it) { c.narr(`• ${itemName(s.id)}${s.qty > 1 ? ` × ${s.qty}` : ''}`); continue; }
    const tags: string[] = [];
    if (eq.main === s.id) tags.push('in hand'); if (eq.ranged === s.id) tags.push('ready'); if (eq.armor === s.id) tags.push('worn'); if (eq.shield === s.id) tags.push('on arm'); if (eq.worn.includes(s.id)) tags.push('worn');
    if (it.weapon?.category === 'firearm') tags.push(`${pc.ammo[it.id] ?? 0}/${it.weapon.capacity} loaded`);
    c.narr(`• ${it.name}${s.qty > 1 ? ` × ${s.qty}` : ''}${tags.length ? ` (${tags.join(', ')})` : ''}`);
  }
  c.narr(`Purse: ${fmtMoney(pc.copper)}`);
  if (c.flag('ewe_found') && !c.flag('ewe_returned')) c.narr('• Daisy the ewe is following you.');
}

const HELP = `Type what you want to do, in plain words. Some examples:
• look · go north · go to the tavern · read the notice board
• talk to Squib · ask Squib about the barrel · "What's with the barrel?"
• buy ale · shop · sell pelt · rent a room · sleep · short rest
• drink the ale · eat · sit on a stool · climb the rafters · smell the air · listen at the window
• pick up a rock · break a chair · throw a mug at the wall · light a candle · play cards with the dwarves
• search the altar · pull the lever · kick the door · pick the lock
• punch the zombie · kick it · headbutt the skeleton · shoot the wolf · cast fire bolt at the zombie
• drink potion · equip revolver · reload · dodge · flee · end turn
• high five Alistair · apologise · persuade Squib
• Chain things: "take the mug, drink it, then go outside"
• Anything else you can think of — the game will find a skill, roll it, and tell you what happens
• ? Is anyone watching me — ask the oracle a yes/no question
• sheet · inventory · journal · save`;

function journal(c: Ctx) {
  c.out('title', 'Journal');
  if (!c.s.journal.length) c.narr('Nothing yet. The notice board in Breda\'s square is a good start.');
  for (const j of c.s.journal) c.narr('• ' + j);
}

// ---------- character creation ----------
/** Start a new game from a finished Forge character. */
export function beginGame(s: GameState, spec: CreationSpec): LogLine[] {
  const lines: LogLine[] = [];
  const c = makeCtx(s, lines);
  s.pc = createFromSpec(spec);
  s.phase = 'play';
  const pc = s.pc;
  for (const t of Object.keys(spec.life)) { const f = spec.life[t]; if (f) s.flags[`life_${t}_${f}`] = true; }
  if (spec.life.born === 'breda') s.flags.local = true;
  c.out('title', 'Breda · Monday, May 1');
  c.narr('Fifteen years ago the civil war ended, and everyone in Kalashscovia agreed to stop counting the dead. The road brings you to Breda the way it brings everyone now: looking for work, or for somewhere to sit down and be safe.');
  if (pc.backstory) c.narr(`You are ${pc.name}. ${pc.backstory.trim().replace(/([^.!?])$/, '$1.')}`);
  c.narr('You push open the door of the only tavern in town.');
  moveTo(c, 'tavern');
  NPCS.squib.greet(c);
  s.talkingTo = 'squib';
  c.sys('Type anything you can think of. Try "drink the ale", "ask about the bell", "read notice board", or "help".');
  return lines;
}

// ---------- main entry ----------
export function handle(s: GameState, input: string): LogLine[] {
  const lines: LogLine[] = [];
  const c = makeCtx(s, lines);
  const raw = input.trim();
  if (s.phase !== 'play' || !s.pc) {
    s.phase = 'create';
    c.out('title', 'Hams Tavern: The Bells of Lahti');
    c.sys('Make your character in the Forge to begin.');
    return lines;
  }
  if (!raw) return lines;
  c.out('you', raw);
  const parts = Act.splitCommands(raw);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const wasCombat = !!s.combat;
    const spellNames = [...s.pc.cantrips, ...s.pc.spells].flatMap((id) => SPELLS[id]?.aliases ?? []).filter((a) => a.length > 3 && a !== 'fire');
    let intent = parse(part, spellNames);
    intent = withPronoun(c, intent);
    RAW = part;
    c.set('last_verb', part.split(/\s+/)[0].toLowerCase());
    try {
      dispatch(c, intent, part);
    } catch (e) {
      c.sys('Something went wrong in the game master\'s notes. (This is a bug — your game is safe.)');
      console.error(e);
      break;
    }
    if (!!s.combat !== wasCombat && i < parts.length - 1) { c.sys('(Things changed. The rest of what you meant to do will have to wait.)'); break; }
  }
  return lines;
}

/** "drink it", "throw that at him": fill pronouns from what you last handled. */
function withPronoun(c: Ctx, it: Intent): Intent {
  const lo = c.s.lastObject;
  if (!lo) return it;
  const pr = (x?: string) => (x && /^(it|that|this|this one|that one)$/.test(x) ? lo : x);
  const o = it as Record<string, unknown>;
  for (const k of ['item', 'thing', 'weapon']) if (typeof o[k] === 'string') o[k] = pr(o[k] as string);
  return it;
}

function dispatch(c: Ctx, it: Intent, raw: string) {
  const s = c.s;
  const cb = s.combat;
  // turn control
  if (cb && /^(end turn|end|done|pass|next|end my turn|wait)$/i.test(raw.trim())) { Combat.endPlayerTurn(c); return; }
  switch (it.type) {
    case 'help': c.narr(HELP); return;
    case 'look': if (cb) { combatStatus(c); return; } describe(c); return;
    case 'inventory': inventory(c); return;
    case 'sheet': sheet(c); return;
    case 'journal': journal(c); return;
    case 'exits': listExits(c); return;
    case 'save': c.sys('Your game saves automatically after every move.'); return;
    case 'oracle': { const a = askOracle(c.rng, guessOdds(it.question), s.chaos); c.out('roll', `🔮 Oracle (${a.chance}%): ${a.answer}.${a.event ? ' Random event — ' + a.event : ''}`); return; }
    case 'go': if (cb) { if (/away|back|out/.test(it.dest)) { Combat.playerFlee(c); return; } c.sys('You\'re in a fight. Try "flee".'); return; } go(c, it.dest); return;
    case 'sneak': c.check('stealth', 10); if (it.dest) go(c, it.dest); return;
    case 'attack': return attack(c, it);
    case 'cast': Combat.playerCast(c, it.spell, it.target); return;
    case 'shove': if (!cb) { outsideViolence(c, it.target); return; } Combat.playerShove(c, it.verb, it.target, false); return;
    case 'grapple': if (!cb) { outsideViolence(c, it.target); return; } Combat.playerShove(c, it.verb, it.target, true); return;
    case 'feature': Combat.playerFeature(c, it.name, it.target); return;
    case 'dodge': if (!cb) { c.narr('You duck. Nothing was coming. You feel prepared, though.'); return; } Combat.playerDodge(c); return;
    case 'flee': if (!cb) { c.narr('Nothing is chasing you. Yet.'); return; } Combat.playerFlee(c); return;
    case 'hide': if (!cb) { if (/\b(in|behind|under)\b/.test(raw)) { Act.freeAction(c, W, raw); return; } c.check('stealth', 10); c.narr('You find a shadow and stay in it.'); return; } Combat.playerHide(c); return;
    case 'reload': Combat.playerReload(c); return;
    case 'unjam': Combat.playerUnjam(c); return;
    case 'surrender': if (cb) { c.narr('You raise your hands. The dead don\'t care.'); return; } c.narr('Surrender to whom?'); return;
    case 'spare': Combat.playerSpare(c, it.target); return;
    case 'finish': Combat.playerFinish(c, it.target); return;
    case 'drink': {
      const r = Act.drink(c, W, it.item);
      if (r === 'potion') Combat.playerUsePotion(c);
      else if (r === 'use') use(c, 'black label');
      if (cb && r === true && s.combat) { s.combat.usedAction = true; Combat.afterPlayerAction(c); }
      return;
    }
    case 'eat': if (cb) { c.sys('No time to eat. Fight first.'); return; } Act.eat(c, W, it.item); return;
    case 'use': if (/potion/.test(it.item)) { Combat.playerUsePotion(c, it.target); return; } use(c, it.item, it.target); return;
    case 'equip': equip(c, it.item); return;
    case 'unequip': unequip(c, it.item); return;
    case 'rest': rest(c, it.kind); return;
    case 'sleep': rest(c, 'long'); return;
    case 'wait': if (cb) { Combat.endPlayerTurn(c); return; } c.advance(30); c.narr(`Time passes. (${clock(s)})`); return;
  }
  if (cb) {
    // during combat, limited world interaction
    if (it.type === 'say') { say(c, it.text, it.to); return; }
    if (it.type === 'social' && (it.npc === 'merah' || cb.units.some((u) => u.monster === 'merah' && !u.conditions.includes('dead')))) {
      const m = cb.units.find((u) => u.monster === 'merah');
      if (m && c.check('persuasion', 16)) { m.conditions.push('surrendered'); c.narr('Merah hesitates. The candle in her hand gutters. "...Maybe," she whispers, and lowers her sickle.'); Combat.afterPlayerAction(c); }
      else { c.narr('She only smiles.'); }
      return;
    }
    if (it.type === 'social' && it.skill === 'intimidation') { combatIntimidate(c, it.npc); return; }
    if (it.type === 'examine') { examine(c, it.thing); return; }
    if (it.type === 'take') { combatGrab(c, it.item); return; }
    if (it.type === 'emote') { c.narr(it.act === 'spit' ? 'You spit. It\'s a statement.' : 'Now isn\'t the time.'); return; }
    if (it.type === 'unknown' && classifySpeech(raw).present) { say(c, raw); return; }
    combatImprovise(c, raw);
    return;
  }
  switch (it.type) {
    case 'talk': talk(c, it.npc, it.topic); return;
    case 'say': say(c, it.text, it.to); return;
    case 'take': take(c, it.item); return;
    case 'drop': drop(c, it.item); return;
    case 'examine': examine(c, it.thing); return;
    case 'search': search(c, it.thing); return;
    case 'read': read(c, it.thing); return;
    case 'open': interact(c, 'open', it.thing, it.method); return;
    case 'pull': interact(c, 'pull', it.thing); return;
    case 'ring': interact(c, 'ring', it.thing); return;
    case 'cut': interact(c, 'cut', it.thing); return;
    case 'shop': shop(c); return;
    case 'buy': if (/room|bed/.test(it.item) && s.loc === 'tavern') { buy(c, 'room_private', 1); return; } buy(c, it.item, it.qty); return;
    case 'sell': sell(c, it.item); return;
    case 'give': give(c, it.item, it.npc); return;
    case 'social': social(c, it.skill, it.npc, it.text); return;
    case 'emote': emote(c, it.act, it.target); return;
    case 'unknown': unknown(c, raw); return;
  }
}

/** Grab something mid-fight: a bottle, a chair leg, a rock. Costs your bonus action. */
function combatGrab(c: Ctx, name: string) {
  const cb = c.s.combat!;
  const items = c.s.roomItems[c.s.loc] ?? [];
  const idx = items.findIndex((x) => itemName(x.id).toLowerCase().includes(name.toLowerCase()));
  const p = idx < 0 ? Act.findProp(c, name, true) : null;
  if (idx < 0 && !p) { c.narr(`There's no ${name} within reach.`); return; }
  if (cb.usedBonus && cb.usedAction) { c.sys('You\'ve already acted this turn. ("end turn")'); return; }
  if (!cb.usedBonus) cb.usedBonus = true; else cb.usedAction = true;
  if (idx >= 0) { const st = items[idx]; c.give(st.id, st.qty); items.splice(idx, 1); c.good(`You snatch up the ${itemName(st.id).toLowerCase()}.`); c.s.lastObject = itemName(st.id).toLowerCase(); }
  else Act.takeProp(c, W, p!);
  Combat.afterPlayerAction(c);
}

function combatIntimidate(c: Ctx, who?: string) {
  const cb = c.s.combat!;
  if (cb.usedAction) { c.sys('You\'ve already used your action.'); return; }
  cb.usedAction = true;
  const foes = Combat.livingFoes(c).filter((u) => !MONSTERS[u.monster!]?.tags.includes('undead') && !MONSTERS[u.monster!]?.tags.includes('construct'));
  const t = who ? Combat.resolveTarget(c, who) : foes[0];
  if (!t || !foes.includes(t)) { c.narr('The dead are past being scared of you.'); Combat.afterPlayerAction(c); return; }
  const dc = 10 + Math.floor((MONSTERS[t.monster!].abilities.wis - 10) / 2) + 2;
  if (c.check('intimidation', dc)) { t.conditions.push('frightened'); c.good(`${t.name} flinches back from you, eyes wide.`); }
  else c.narr(`${t.name} isn't impressed.`);
  Combat.afterPlayerAction(c);
}

/** Anything else in a fight: knock a candle into their face, kick sand, swing from the rafters. */
function combatImprovise(c: Ctx, raw: string) {
  const cb = c.s.combat!;
  const low = raw.toLowerCase();
  if (cb.usedAction) { c.sys('You\'ve already used your action this turn. ("end turn", or a bonus action.)'); return; }
  const t = Combat.livingFoes(c)[0];
  if (!t) return;
  cb.usedAction = true;
  const sk: Skill = /swing|flip|jump|leap|vault|tumble|slide|roll|duck/.test(low) ? 'acrobatics' : /sand|dirt|blind|throw|kick .* (dirt|sand|ash)|distract|trick|feint|fake|bluff/.test(low) ? 'sleight of hand' : /shout|roar|scream|glare|scare/.test(low) ? 'intimidation' : /lift|push|topple|knock over|tip|overturn|drop .* on/.test(low) ? 'athletics' : 'athletics';
  const ok = c.check(sk, 12);
  c.narr(`You ${raw.replace(/^(i|i try to|try to)\s+/i, '').replace(/[.!]$/, '')}.`);
  if (ok) {
    const choice = /blind|sand|dirt|ash|distract|feint|trick|bluff/.test(low) ? 'blind' : /knock|topple|push|tip|overturn|drop|trip/.test(low) ? 'prone' : /scare|roar|shout|scream|glare/.test(low) ? 'fear' : 'open';
    if (choice === 'prone') { t.conditions.push('prone'); c.good(`${t.name} goes down.`); }
    else if (choice === 'fear' && !MONSTERS[t.monster!].tags.includes('undead')) { t.conditions.push('frightened'); c.good(`${t.name} recoils.`); }
    else { t.conditions.push('guided'); c.good(`${t.name} is caught off guard: the next attack on it has advantage.`); }
  } else c.narr('It doesn\'t come off. You\'re wide open for a moment.');
  Combat.afterPlayerAction(c);
}

function attack(c: Ctx, it: Extract<Intent, { type: 'attack' }>) {
  if (c.s.combat) { Combat.playerAttack(c, it.style, it.verb, it.target, it.weapon, it.limb); return; }
  if (it.style === 'thrown' && it.weapon) { Act.throwThing(c, W, it.weapon, it.target); return; }
  if (it.target && matchInventory(c, it.target) && ITEMS[matchInventory(c, it.target)!.id]?.kind === 'food' && /bite|chomp|gnaw|nibble/.test(it.verb)) { Act.eat(c, W, it.target); return; }
  outsideViolence(c, it.target);
}

function outsideViolence(c: Ctx, target?: string) {
  const np = target ? matchNpc(c, target) : null;
  if (np?.onAttack) { np.onAttack(c); return; }
  if (np) {
    if (c.s.loc === 'tavern') { c.say('squib', 'A hand the size of a shovel closes gently on your wrist. "No weapons drawn under this roof." He lets go. The rule was not a suggestion.'); c.npc('squib').disposition -= 1; return; }
    if (np.id === 'hetch') { c.narr('The cat looks at you. Every pin in the shop rises an inch off the table. You decide against it.'); return; }
    if (np.id === 'kettle') { c.narr('Kettle looks at you with total, betrayed disappointment. You can\'t do it.'); return; }
    c.narr(`${np.name} sees it coming and steps back, hands up. "Whoa. Whoa." This isn't a fight anyone wants, and you let it go.`); return;
  }
  if (target) { const f = matchFeature(c, target); if (f) { if (f.open) { f.open(c, 'kick'); return; } c.narr(`You hit the ${f.names[0]}. It does not hit back.`); return; } }
  if (target) {
    const p = Act.findProp(c, target, true);
    if (p) {
      const nm = p.def?.name ?? p.state.name;
      if (p.state.tags.includes('animal')) { c.narr(`The ${nm} sees it coming and is gone.`); return; }
      if (/push|shove|tip|knock|kick|tackle/.test(RAW.toLowerCase()) || p.state.tags.includes('break')) { Act.freeAction(c, W, /push|shove/.test(RAW.toLowerCase()) ? RAW : `break ${nm}`); return; }
      c.narr(`You ${RAW.split(/\s+/)[0].toLowerCase()} the ${nm}. It does not hit back. ${c.s.loc === 'tavern' ? 'The dwarves give it a six.' : 'You feel a bit better.'}`);
      return;
    }
  }
  c.narr(target ? `There's no ${target} here to fight.` : 'You shadow-box the air. Nothing here wants a fight. Yet.');
}

function give(c: Ctx, item: string, npc?: string) {
  const np = npc ? matchNpc(c, npc) : c.s.talkingTo ? NPCS[c.s.talkingTo] : null;
  if (!np) { c.sys('Give it to whom?'); return; }
  const st = matchInventory(c, item);
  if (!st) {
    if (/ewe|sheep|daisy/.test(item) && np.id === 'doss') { ROOMS.foothills.onEnter!(c); return; }
    if (/money|gold|coin|tip/.test(item)) { if (c.pay(100)) { c.narr(`You press a gold coin into ${np.name}'s hand.`); c.npc(np.id).disposition += 1; } else c.bad('You\'re broke.'); return; }
    c.sys(`You don't have "${item}".`); return;
  }
  if (np.give && np.give(c, st.id)) { if (ITEMS[st.id].kind === 'food') removeItem(c.pc, st.id); return; }
  if (st.id === 'wolf_pelt' && np.id === 'hetch') { sell(c, 'pelt'); return; }
  c.narr(`${np.name} doesn't want that.`);
}

function social(c: Ctx, skill: 'persuasion' | 'intimidation' | 'deception' | 'performance', npc: string | undefined, text: string) {
  const np = npc ? matchNpc(c, npc) : c.s.talkingTo ? NPCS[c.s.talkingTo] : (presentNpcs(c).length === 1 ? NPCS[presentNpcs(c)[0]] : null);
  if (skill === 'performance' && Act.freeAction(c, W, RAW)) return;
  if (skill === 'performance' && !np) { const ok = c.check('performance', 12); c.narr(ok ? 'People stop to watch. A few clap. Someone throws a copper.' : 'Nobody stops to watch. A dog leaves.'); if (ok) c.money(1); return; }
  if (!np) { c.sys('Who are you trying to ' + (skill === 'persuasion' ? 'persuade' : skill === 'intimidation' ? 'intimidate' : 'fool') + '?'); return; }
  if (np.social && np.social(c, skill, text)) return;
  if (np.id === 'merah' && skill === 'persuasion') { answerTopic(c, np, 'stop'); return; }
  const ok = c.check(skill, 12);
  const m = c.npc(np.id);
  if (ok) { m.disposition += skill === 'intimidation' ? -1 : 1; c.narr(skill === 'intimidation' ? `${np.name} backs off a step. Point taken.` : `${np.name} warms to you.`); }
  else { m.disposition -= 1; c.narr(`${np.name} isn't buying it.`); }
}

function emote(c: Ctx, act: string, target?: string) {
  const np = target ? matchNpc(c, target) : c.s.talkingTo ? NPCS[c.s.talkingTo] : null;
  if (act === 'apologize') { const t = np ?? (c.npc('squib').banned && c.s.loc === 'tavern' ? NPCS.squib : null); if (t?.emote && t.emote(c, act)) return; c.narr('You apologise. It\'s accepted, more or less.'); return; }
  if (np?.emote && np.emote(c, act)) return;
  const who = np ? np.name : null;
  const lines: Record<string, string> = {
    'high five': who ? `${who} looks at your raised hand, unsure what to do with it.` : 'You high-five the air. The air is unmoved.',
    'fist bump': who ? `${who} bumps your fist, a little confused.` : 'You fist-bump nobody.',
    wave: who ? `${who} nods back.` : 'You wave at nobody in particular.',
    bow: 'You bow, with some flourish.', dance: 'You dance. It\'s brave.', laugh: 'You laugh. It echoes.', cry: 'You let yourself cry for a moment. Nobody minds.',
    spit: c.s.loc === 'tavern' ? 'You spit on Squib\'s floor. Squib looks at the spit, then at you, then hands you a rag.' : 'You spit.', vomit: 'You throw up. It doesn\'t help, but it doesn\'t hurt.',
    fart: c.s.loc === 'tavern' ? 'The dwarves give it a seven out of ten.' : 'Nobody is around to judge you. Except you.', burp: 'A respectable burp.',
    toast: who ? `You raise a toast with ${who}.` : 'You toast to absent friends.', pray: 'You pray. If anyone\'s listening, they don\'t say.',
    pet: who ? `${who} doesn't want to be petted.` : 'There\'s nothing here to pet.', hug: who ? `You hug ${who}. It's a little awkward.` : 'You hug yourself. Fair.', thank: who ? `${who} nods.` : 'You thank the room.',
    handshake: who ? `You shake ${who}'s hand.` : 'You shake hands with nobody.', kiss: who ? `${who} leans away, politely.` : 'You blow a kiss at nothing.', flirt: who ? `${who} raises an eyebrow.` : 'You wink at the scenery.', wink: 'You wink.', nod: 'You nod.', shrug: 'You shrug.', cheer: 'You cheer!', clap: 'You clap.', sing: 'You sing a few bars. Not bad.', flex: 'You flex. Impressive, in context.', salute: 'You salute.', sit: 'You sit down for a moment.',
  };
  if (!np && target && ['sit', 'dance', 'hug', 'pet', 'kiss', 'pray', 'cry', 'laugh', 'sing', 'bow', 'clap', 'cheer'].includes(act)) { if (Act.freeAction(c, W, RAW)) return; }
  if (act === 'backflip') { c.narr(c.abilityCheck('dex', 12) ? 'You land the backflip clean. Somebody whistles.' : 'You attempt a backflip and land on your back. Somebody whistles anyway.'); return; }
  c.narr(lines[act] ?? `You ${act}.`);
}

function unknown(c: Ctx, raw: string) {
  const low = raw.toLowerCase().trim().replace(/[?.!]+$/, '').replace(/^(the|a|an)\s+/, '');
  const sp0 = classifySpeech(raw);
  const short = low.split(/\s+/).length <= 3 && !sp0.present && !/^(what|why|who|where|how|when|is|are|do|does|can|will|would|tell)\b/.test(low);
  // bare exit / npc / feature names
  if (short && !Act.looksLikeAction(raw)) {
    const r = room(c.s);
    const ex = r.exits.find((e) => !e.hidden?.(c) && (e.names.includes(low) || e.label.toLowerCase() === low));
    if (ex) { go(c, low); return; }
    const np = presentNpcs(c).map((id) => NPCS[id]).find((n) => n?.names.includes(low));
    if (np) { talk(c, low); return; }
    const f = (r.features ?? []).find((x) => !x.hidden?.(c) && x.names.includes(low));
    if (f) { c.narr(f.look(c)); return; }
  }
  // a species power or class feature named on its own
  const pw = speciesOf(c.pc).power;
  if (pw && (low === pw.name.toLowerCase() || low === pw.id.replace(/_/g, ' ') || low === `use ${pw.name.toLowerCase()}`)) { Combat.playerFeature(c, pw.id); return; }
  // speech with profanity, or a question to whoever we're talking to
  const sp = classifySpeech(raw);
  const question = /\?$/.test(raw.trim()) || /^(what|why|who|where|how|when|is|are|do|does|can|will|would|tell me|have you|did you|could you|should)\b/.test(low);
  if (sp.present || question) { say(c, raw); return; }
  // talking to someone and it sounds like one of their topics: it's speech
  if (c.s.talkingTo && presentNpcs(c).includes(c.s.talkingTo) && topicHit(c, NPCS[c.s.talkingTo], raw) && !Act.looksLikeAction(raw)) { say(c, raw); return; }
  // an action: try anything
  if (Act.freeAction(c, W, raw)) return;
  if (c.s.talkingTo) { say(c, raw); return; }
  c.sys(pick(c.rng, ['I\'m not sure what you mean. Try "help" for examples.', 'The game master squints at that. Try rephrasing, or "help".']));
}

function unknownCombat(c: Ctx, raw: string) {
  c.sys('In a fight you can: attack (punch, kick, stab, shoot…), cast a spell, shove, grapple, dodge, drink a potion, reload, flee, or "end turn".');
}

function combatStatus(c: Ctx) {
  const cb = c.s.combat!;
  c.out('title', `Round ${cb.round}`);
  for (const u of cb.units) {
    const st = u.conditions.filter((x) => x !== 'blessed').join(', ');
    c.narr(`${u.side === 'party' ? '◆' : '◇'} ${u.name}: ${u.side === 'party' ? `${u.hp}/${u.maxHp} HP` : hpDesc(u.hp, u.maxHp)}${st ? ` (${st})` : ''}`);
  }
}
function hpDesc(hp: number, max: number) { if (hp <= 0) return 'down'; const f = hp / max; return f > 0.75 ? 'unhurt' : f > 0.4 ? 'hurt' : f > 0.15 ? 'badly hurt' : 'nearly finished'; }

// ---------- suggestions ----------
export function suggestions(s: GameState): string[] {
  if (s.phase !== 'play' || !s.pc) return [];
  const lines: LogLine[] = [];
  const c = makeCtx({ ...s, log: [] } as GameState, lines);
  const pc = s.pc!;
  if (s.combat) {
    const cb = s.combat;
    const foes = cb.units.filter((u) => u.side === 'foe' && !u.conditions.some((x) => ['dead', 'fled', 'surrendered'].includes(x)));
    const out: string[] = [];
    if (!cb.usedAction) {
      const f = foes[0];
      if (f) {
        const n = f.name.toLowerCase();
        const main = weaponById(pc.equipped.main);
        if (pc.cls === 'wizard') out.push(`cast fire bolt at ${n}`);
        if (pc.cls === 'cleric' && pc.slots.used < pc.slots.max && foes.length >= 1 && cb.round === 1) out.push(`cast bless`);
        out.push(main ? `attack ${n}` : `punch ${n}`);
        if (main && pc.cls !== 'monk') out.push(`punch ${n}`); else out.push(`kick ${n}`);
        const r = weaponById(pc.equipped.ranged);
        if (r) out.push(r.category === 'firearm' ? ((pc.ammo[r.id] ?? 0) > 0 && !s.flags[`jam_${r.id}`] ? `shoot ${n}` : s.flags[`jam_${r.id}`] ? 'unjam' : 'reload') : `shoot ${n}`);
        for (const sp of pc.cantrips.filter((x) => ['attack', 'save'].includes(SPELLS[x].kind))) out.push(`cast ${SPELLS[sp].name.toLowerCase()} at ${n}`);
        if (pc.slots.used < pc.slots.max) for (const sp of pc.spells.filter((x) => ['attack', 'auto', 'save'].includes(SPELLS[x].kind)).slice(0, 2)) out.push(`cast ${SPELLS[sp].name.toLowerCase()} at ${n}`);
        if (pc.resources.breath && pc.resources.breath.used < pc.resources.breath.max) out.push('breath weapon');
        if (pc.cls === 'barbarian' && !cb.usedBonus && pc.resources.rage && pc.resources.rage.used < pc.resources.rage.max && !cb.units.find((u) => u.isPc)!.conditions.includes('raging')) out.unshift('rage');
        if (pc.resources.channel && foes.some((u) => MONSTERS[u.monster!]?.tags.includes('undead'))) out.push('turn undead');
        if (foes.length > 1) { const g = foes[1]; out.push(main ? `attack ${g.name.toLowerCase()}` : `punch ${g.name.toLowerCase()}`); }
        out.push(`shove ${n}`, 'dodge');
      }
      if (cb.units.some((u) => u.conditions.includes('surrendered'))) out.unshift('spare', 'finish');
      if (hasItem(pc, 'potion_healing')) out.push('drink potion');
      out.push('flee');
    } else {
      out.push(...Combat.bonusOptions(c).map((b) => b === 'punch' && foes[0] ? `punch ${foes[0].name.toLowerCase()}` : b));
      if (cb.units.some((u) => u.conditions.includes('surrendered'))) out.unshift('spare', 'finish');
      out.push('end turn');
    }
    return Array.from(new Set(out)).slice(0, 10);
  }
  const r = room(s);
  const out: string[] = [];
  if (s.flags.merah_surrendered && !s.flags.merah_gone && !s.flags.merah_dead && s.loc === 'tower') out.push('spare Merah', 'finish her');
  if (s.loc === 'tower' && !s.flags.bell_silenced && (s.flags.merah_gone || s.flags.merah_dead || s.flags.merah_talked_down)) out.push('cut the bell rope');
  if (s.talkingTo && NPCS[s.talkingTo]) {
    const np = NPCS[s.talkingTo];
    for (const t of np.topics) if ((!t.when || t.when(c)) && !npcMem(s, np.id).topicsSeen.includes(t.id)) out.push(t.chip ?? `ask about ${t.keys[0]}`);
  }
  if (r.chips) out.push(...r.chips(c));
  if (s.loc === 'tavern' && s.companions.includes('alistair') && !s.flags.squib_ok_alistair) out.push('persuade Squib to let Alistair in');
  if (s.loc === 'tavern' && npcMem(s, 'squib').banned) out.push('apologise to Squib');
  if (s.flags.lever_found && !s.flags.stairs_open && s.loc === 'nave') out.push('pull the lever');
  if (s.loc === 'nave' && !s.flags.lever_found) out.push('search the altar');
  if (s.loc === 'nave' && !s.flags.vestry_open) out.push(hasItem(pc, 'thieves_tools') ? 'pick the vestry lock' : 'kick the vestry door');
  if (s.loc === 'nave' && !s.flags.tower_open) out.push('kick the tower door');
  if (s.loc === 'kessels_rest' && !s.flags.robe_found) out.push('search the font');
  if (hasItem(pc, 'robe_of_protection') && !pc.equipped.worn.includes('robe_of_protection')) out.push('wear robe');
  const drinkSt = pc.inventory.find((x) => ITEMS[x.id]?.kind === 'drink');
  if (drinkSt) out.unshift(`drink the ${ITEMS[drinkSt.id].name.toLowerCase().replace(/^mug of /, '').replace(/^shot of /, '')}`);
  if (pc.hp < pc.maxHp && r.rest !== 'none') out.push(pc.hitDice > 0 ? 'short rest' : r.id === 'tavern' ? 'sleep' : 'drink potion');
  if (hasItem(pc, 'wolf_pelt') && s.loc === 'tailor') out.push('sell pelt');
  if (hasItem(pc, 'bone_amulet') && s.loc === 'tavern' && !s.flags.sold_amulet && s.flags.sereza_met) out.push('ask Sereza about the amulet');
  for (const e of r.exits.filter((e) => !e.hidden?.(c) && !(e.blocked && e.to === r.id))) out.push(`go ${e.names[0]}`);
  out.push('look');
  return Array.from(new Set(out)).slice(0, 12);
}

export function statusLine(s: GameState) {
  if (!s.pc) return null;
  const pc = s.pc;
  return { name: pc.name, hp: pc.hp, maxHp: pc.maxHp, ac: armorClass(pc), level: pc.level, gold: fmtMoney(pc.copper), clock: clock(s), place: ROOMS[s.loc]?.name ?? '', inCombat: !!s.combat, xp: pc.xp, slots: pc.slots.max ? `${pc.slots.max - pc.slots.used}/${pc.slots.max}` : null };
}

export { ROOMS, NPCS };

/** Run a read-only command (sheet, inventory, journal) without touching the real state or story log. */
export function peek(s: GameState, cmd: 'sheet' | 'inventory' | 'journal' | 'look'): LogLine[] {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  copy.log = [];
  const lines = handle(copy, cmd);
  return lines.filter((l) => l.k !== 'you');
}

export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as GameState;
  if (typeof s.version !== 'number' || !s.rng) return null;
  const fresh = newState(1);
  const out: GameState = { ...fresh, ...s, flags: s.flags ?? {}, npc: s.npc ?? {}, stats: s.stats ?? fresh.stats, roomItems: s.roomItems ?? {}, companionHp: s.companionHp ?? {}, journal: s.journal ?? [], props: s.props ?? {}, lastObject: s.lastObject ?? null };
  if (out.pc) {
    const pc = out.pc;
    pc.options ??= {}; pc.feat ??= 'savage'; pc.look ??= ''; pc.backstory ??= ''; pc.life ??= {}; pc.drunk ??= 0; pc.wildHp ??= 0; pc.pronoun ??= 'they';
    if (!(pc.feat in FEATS)) { const map: Record<string, string> = {}; pc.feat = map[pc.feat] ?? 'savage'; }
  }
  if (out.phase === 'create' && !out.pc) out.phase = 'title';
  return out;
}
