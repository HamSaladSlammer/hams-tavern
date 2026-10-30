// Things you try that a real game master would ask you to roll for: reading people, frightening
// them, picking pockets, lifting things off counters, snooping, patching yourself up, searching for
// what's hidden. Each calls for the right check, and the world answers the result.
import type { Ctx, Npc } from '../content/types';
import type { World } from './actions';
import * as Act from './actions';
import * as Mind from '../mind';
import { pick, die } from './dice';
import { askOracle } from './oracle';
import { hasItem } from './character';
import { spawnExtra, crowdHere } from './dm';
import { NPCS } from '../content/npcs';
import * as Freedom from '../content/freedom';

const strip = (raw: string) => raw.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/^(i want to|i'd like to|i'll|i will|let me|i)\s+/, '').replace(/^(try to|attempt to|try and|carefully|quietly|subtly|secretly)\s+/, '').replace(/^(try to|attempt to)\s+/, '');
const noun = (s: string) => s.replace(/^(the|a|an|that|this|some)\s+/, '').replace(/'s$|s'$/, '').trim();

/** Returns true if the attempt was handled. */
export function attempt(c: Ctx, w: World, raw: string): boolean {
  const t = strip(raw);
  if (!t) return false;
  const who = (s: string | undefined): Npc | null => (s ? w.matchNpc(c, noun(s)) : null) ?? (c.s.talkingTo && w.presentNpcs(c).includes(c.s.talkingTo) && (!s || /^(him|her|them|they|he|she)$/.test(s)) ? NPCS[c.s.talkingTo] ?? null : null);
  let m: RegExpMatchArray | null;

  // ---- talk that the parser would read as something else ----
  const talking = c.s.talkingTo && w.presentNpcs(c).includes(c.s.talkingTo) ? NPCS[c.s.talkingTo] : null;
  if (!c.s.combat && talking && /^(thanks|thank you|thank ye|cheers|ta|many thanks|much obliged|sorry|i'?m sorry|i apologi[sz]e|my apologies|forgive me)\b/.test(raw.toLowerCase().trim()) && !(talking.id === 'squib' && c.npc('squib').banned)) { w.say(c, raw.trim(), talking.names[0]); return true; }
  if ((m = t.match(/^(?:buy|get|stand|order) (you|him|her|them|.+?) (?:a|another|one more|some) (?:drink|round|pint|ale|beer|cider|mug)\b/)) && !c.s.combat) {
    const np = m[1] === 'you' ? talking : who(m[1]);
    if (np && np.id !== 'kettle') { Mind.buyDrinkFor(c, np); return true; }
  }
  // ---- insight: reading a person ----
  if ((m = t.match(/^(?:read|study|watch|search|scan|size up|gauge|judge|sense|look at|examine) (.+?)(?:'s|s'|'| s)? (?:face|expression|eyes|body language|mood|reaction|tells?|motives?|intentions?|demeanou?r|posture)$/))
    || (m = t.match(/^(?:tell|tell me|see|figure out|work out|check|sense|guess|judge|notice|gauge|read) (?:if|whether|what|how) (.+?) (?:is|'s|are|was|feels?|thinks?|wants?|really)\b.*$/))
    || (m = t.match(/^(?:is|does|do|was|are) (.+?) (?:lying|telling the truth|being honest|hiding something|trust me|like me|afraid|scared|nervous|serious)\??$/))
    || (m = t.match(/^(?:insight|sense motive|read)(?: on| check on)? (.+)$/))
    || (m = t.match(/^(?:size up|suss out|get a read on) (.+)$/))) {
    const np = who(m[1]);
    if (np && np.id !== 'kettle') {
      const focus = /ly|truth|honest|hiding|secret/.test(t) ? 'lie' : /want|after|motive|intention/.test(t) ? 'want' : 'mood';
      const ok = c.check('insight', Mind.dcFor(c, np, 'insight'));
      Mind.read(c, w, np, ok, focus);
      c.advance(1);
      return true;
    }
  }

  // ---- intimidation (when there's a person to frighten) ----
  if ((m = t.match(/^(?:intimidate|threaten|scare|frighten|menace|lean on|loom over|glare at|stare down|growl at|bully|strong-?arm|spook|terrify|crack my knuckles at)\s+(.+?)(?:\s+(?:into|to|with|until|so)\b.*)?$/)) && !c.s.combat) {
    const np = who(m[1]);
    if (np && np.id !== 'kettle') {
      if (/\b(money|coin|coins|till|purse|gold|cash|everything|hand (it )?over|valuables|wallet|pay up|give me)\b/.test(t) && Freedom.robbery(c, np)) return true;
      if (np.social && np.social(c, 'intimidation', raw)) return true;
      const ok = c.check('intimidation', Mind.dcFor(c, np, 'intimidate'));
      Mind.intimidated(c, w, np, ok, raw);
      return true;
    }
  }

  // ---- pickpocketing ----
  if ((m = t.match(/^(?:pick|pinch from|go through|dip into|rifle through) (.+?)(?:'s|s'|') (?:pocket|pockets|purse|pouch|coin ?purse|belt pouch)$/))
    || (m = t.match(/^(?:pickpocket|pick-pocket|pick the pocket of|rob|lift (?:a|the) (?:purse|pouch|wallet) (?:from|off)|steal (?:from|(?:a|the|some) (?:coins?|purse|pouch|money|gold|wallet) (?:from|off)))\s+(.+)$/))
    || (m = t.match(/^(?:pick (?:a|some) pockets?|pickpocket(?: someone| somebody| a (?:patron|drunk|mark))?|find a mark)$/) as RegExpMatchArray | null)) {
    if (c.s.combat) { c.narr('Not in the middle of a fight.'); return true; }
    let np = m[1] ? who(m[1]) : null;
    if (!np && !m[1]) { const ppl = w.presentNpcs(c).filter((id) => id.startsWith('x:')); np = ppl.length ? NPCS[ppl[0]] ?? null : crowdHere(c.s.loc) ? spawnExtra(c, pick(c.rng, ['patron', 'drunk', 'traveller'])) : null; }
    if (!np) { c.narr(m[1] ? `You don't see ${noun(m[1])} here.` : 'There\'s nobody here with pockets worth picking.'); return true; }
    if (np.id === 'kettle') { c.narr('Kettle has no pockets. He has a stick, and you cannot have it.'); return true; }
    if (np.id === 'alistair') { c.narr('Alistair\'s pockets contain a dried rose, three teeth that aren\'t his, and a dance card from two hundred years ago. You put them back. He pats your head.'); return true; }
    const key = `picked_${np.id}`;
    if (c.flag(key)) { c.narr(`You've already lightened ${np.name}'s pockets. Twice would be greedy, and greedy gets caught.`); return true; }
    const dc = 10 + Mind.dcFor(c, np, 'notice') - 11 + 2;
    const ok = c.check('sleight of hand', dc, { adv: c.pc.drunk === 0 && w.presentNpcs(c).length > 2 });
    if (ok) {
      c.set(key);
      const cp = np.id === 'sereza' ? 300 + die(c.rng, 200) : /keeper|merchant|squib|garrick/.test(np.id) ? 20 + die(c.rng, 40) : 3 + die(c.rng, 18);
      c.money(cp);
      c.narr(`${pick(c.rng, ['A bump, a smile, an apology.', 'Your fingers are in and out while they\'re looking the other way.', 'You wait for the laugh, then dip.'])} ${np.name} never feels a thing. You come away ${cp >= 100 ? `with ${Math.floor(cp / 100)} gold and change` : `${cp} copper richer`}.${np.id === 'sereza' ? ' There\'s a folded note in the purse too, in small precise handwriting: "Breda. Bells. Report weekly." No signature.' : ''}`);
      c.s.stats.insults += 0;
      return true;
    }
    const mem = c.npc(np.id);
    mem.disposition -= 3;
    c.set(key);
    if (np.id === 'squib') { c.say('squib', 'A hand the size of a shovel closes around your wrist. Squib doesn\'t squeeze. He doesn\'t need to. "Bother my regulars," he says softly, "and drink elsewhere. That counts for me, too." He lets go. You are not welcome tonight.'); mem.banned = true; return true; }
    c.narr(`${np.name} feels your hand and spins round. ${pick(c.rng, ['"THIEF!"', '"Oi! Get your hand out of my—"', '"Really? REALLY?"'])}`);
    if (c.s.loc === 'tavern' && w.presentNpcs(c).includes('squib')) { c.say('squib', 'Squib is beside you before you hear him move. "Give it back." You hadn\'t got anything. "Then leave it there. And sit somewhere I can see you."'); c.npc('squib').disposition -= 2; }
    else if (/_watch$/.test(np.id) || w.presentNpcs(c).some((id) => /_watch$/.test(id))) { c.bad('The watch take an interest. You\'re fined 5 gold on the spot.'); c.pay(Math.min(500, c.pc.copper)); }
    else c.narr('People turn to look. You\'re going to have a hard time doing business here today.');
    return true;
  }

  // ---- lifting something off a counter while the owner watches ----
  if ((m = t.match(/^(?:steal|swipe|nick|pinch|pocket|filch|palm|lift|snatch|sneak|slip) (?:a |an |the |some |one of the )?(.+?)(?: (?:from|off|behind|under|out of) (?:the )?(.+?))?(?: (?:while|when) .+)?(?: (?:unseen|unnoticed|without (?:being seen|anyone noticing|him noticing|her noticing|them noticing)))?$/))
    && /^(steal|swipe|nick|pinch|filch|palm|snatch|pocket)/.test(t) && !c.s.combat) {
    const thing = noun(m[1]);
    if (Freedom.shoplift(c, thing)) return true;
    const owner = w.presentNpcs(c).map((id) => NPCS[id]).find((np) => np && (np.shop || /_keeper$|^squib$|_merchant$|^garrick$|^smith$|^hetch$/.test(np.id))) ?? null;
    if (!owner) return false; // nobody to steal from: the normal "take" handles it
    const shopItem = owner.shop?.find((s) => s.id.replace(/_/g, ' ').includes(thing) || thing.includes(s.id.replace(/_/g, ' ')) || (thing === 'bottle' && /ale|trenchfire|stout|wine/.test(s.id)) || (/drink|beer|ale|mug/.test(thing) && s.id === 'ale'));
    const ok = c.check('sleight of hand', Mind.dcFor(c, owner, 'notice') + 2);
    if (ok) {
      const id = shopItem?.id ?? (/bottle|drink|ale|beer/.test(thing) ? 'ale' : null);
      if (id) c.give(id); else c.money(die(c.rng, 6));
      c.narr(`${pick(c.rng, ['You wait for the moment', 'A glance, a reach, a step back'])}, and the ${thing} is under your coat. ${owner.name} never looks up.${id ? '' : ' (Whatever it was, it was worth a few copper.)'}`);
      return true;
    }
    const mem = c.npc(owner.id); mem.disposition -= 2;
    c.say(owner.id, owner.id === 'squib' ? `"Put it back." Squib doesn't look up from the mug he's polishing. "And pay for the one you thought about."` : `${owner.name}'s hand comes down flat on the counter. "${pick(c.rng, ['I saw that.', 'Put. It. Back.', 'Thief. Out.'])}"`);
    return true;
  }

  // ---- eavesdropping and reading over shoulders ----
  if ((m = t.match(/^(?:read|peek at|peer at|glance at|look at|steal a look at|sneak a look at) (.+?)(?:'s|s'|') (letter|letters|notes?|papers?|cards|hand|journal|book|ledger|map)(?: over (?:his|her|their) shoulder)?$/))) {
    const np = who(m[1]);
    if (np) {
      const ok = c.check('sleight of hand', Mind.dcFor(c, np, 'notice') + 1);
      if (!ok) { c.npc(np.id).disposition -= 1; c.narr(`${np.name} turns the ${m[2]} face-down and looks at you. "${pick(c.rng, ['Can I help you?', 'Do you mind?', 'Mine.'])}"`); return true; }
      const f = Mind.knownFact(c, np, np.id === 'sereza' ? 'crown' : np.id === 'whisperers' ? 'undead' : 'cult', 'secret letter report');
      c.narr(np.id === 'sereza' ? 'Small, fast handwriting: "...bells at Breda, Coltale, Largo, Borschardt. Same pattern. Someone is ringing them backwards. Request authority to..." She turns the page.' : `You catch a few lines before ${np.name} shifts. ${f ? `Something about this: ${f}` : 'Mostly sums, and a shopping list.'}`);
      return true;
    }
  }

  // ---- searching for what's hidden ----
  if (/^(?:look|search|check|feel|hunt) (?:for|around for) (?:any )?(?:hidden|secret|concealed) (?:doors?|passages?|compartments?|panels?|switches|levers|traps?|rooms?|stash(?:es)?|drawers?|catches)\b|^(?:search|check) (?:the room |the walls |the floor )?for (?:traps|secret doors|hidden doors|a secret door|a hidden door)\b|^(?:tap|knock on|sound) the walls\b/.test(t)) {
    const trap = /trap/.test(t);
    const ok = c.check(trap ? 'perception' : 'investigation', 13);
    const dungeon = /^site:|crypt|vestry|tower|nave|vault/.test(c.s.loc);
    const a = askOracle(c.rng, dungeon ? 'likely' : 'unlikely', c.s.chaos);
    const exists = /yes/i.test(a.answer);
    c.advance(10);
    if (!ok) { c.narr(pick(c.rng, ['You poke at the walls and floor for ten minutes. If anything\'s hidden, it stays that way.', 'Nothing jumps out at you. That doesn\'t mean nothing\'s there.'])); return true; }
    if (!exists) { c.narr(trap ? 'You go over every likely spot. No wires, no loose stones, no pressure plates. It\'s safe, as far as anyone can tell.' : 'You\'re thorough: every panel, every flagstone. There\'s nothing hidden here. You\'re sure of it.'); return true; }
    if (trap) { c.narr(pick(c.rng, ['There: a thread of wire at ankle height, nearly invisible. You step over it.', 'One flagstone sits a finger higher than the rest. You don\'t step on it.'])); c.set(`trap_seen_${c.s.loc}`); return true; }
    const cp = 10 + die(c.rng, 40);
    c.money(cp);
    c.narr(`${pick(c.rng, ['A loose board, and under it a twist of cloth', 'A brick that rocks when you press it; behind it, a dusty niche', 'A false bottom in a drawer'])}. Somebody hid ${cp} copper here and never came back for it.`);
    return true;
  }

  // ---- first aid ----
  if (/^(?:treat|bandage|dress|stitch|tend|clean|patch up|bind|look after) (?:my|your own|our) (?:wounds?|cuts?|injur(?:y|ies)|arm|leg|side|head|hand|self)\b|^(?:patch|fix) myself up\b|^first aid\b/.test(t)) {
    const pc = c.pc;
    if (pc.hp >= pc.maxHp) { c.narr('You check yourself over. A few bruises, nothing that needs a needle.'); return true; }
    const key = `self_aid_${Math.floor((c.s.minutes + 480) / 240)}`;
    if (c.flag(key)) { c.narr('You\'ve done what you can for now. It needs rest more than bandages.'); return true; }
    c.set(key);
    const kit = hasItem(pc, 'healers_kit');
    const ok = c.check('medicine', kit ? 8 : 12);
    const heal = ok ? Math.min(pc.maxHp - pc.hp, die(c.rng, 4) + (kit ? 2 : 0)) : 0;
    pc.hp += heal;
    c.advance(10);
    c.narr(ok ? `You clean the worst of it and bind it tight.${kit ? ' The kit helps.' : ''} (+${heal} HP, ${pc.hp}/${pc.maxHp})` : 'You fumble the knot and the bandage slips. It\'ll have to heal on its own.');
    return true;
  }

  // ---- animals ----
  if ((m = t.match(/^(?:calm|soothe|settle|gentle|tame|befriend|approach|win over) (?:the |a |that )?(dog|hound|horse|mule|pony|cat|goat|sheep|ox|animal|beast|wolf|kettle)\b/))) {
    const tgt = m[1];
    if (tgt === 'cat' && w.presentNpcs(c).includes('hetch')) { c.say('hetch', '"I am not," says Hetch, "an animal to be soothed."'); return true; }
    if ((tgt === 'dog' || tgt === 'hound' || tgt === 'kettle') && w.presentNpcs(c).includes('kettle')) { const ok = c.check('animal handling', 8); c.narr(ok ? 'You crouch and offer the back of your hand. Kettle sniffs it, thumps his tail twice, and leans his whole weight against your leg.' : 'Kettle watches you warily from behind Squib\'s legs. Not yet.'); if (ok) c.npc('kettle').disposition += 1; return true; }
    const ok = c.check('animal handling', /wolf|beast/.test(tgt) ? 15 : 10);
    c.narr(ok ? `You keep your voice low and your movements slow. The ${tgt} settles, and lets you near.` : `The ${tgt} shies away from you, ears back.`);
    return true;
  }

  // ---- the barrel above the hearth ----
  if (c.s.loc === 'tavern' && /\bbarrel\b/.test(t) && /hearth|scorched|black|above|mounted|burnt|burned/.test(t) && /^(lift|heft|hoist|pick up|raise|carry|take|grab|touch|move|take down|get down|open|climb|reach for)/.test(t) && w.presentNpcs(c).includes('squib')) {
    c.say('squib', 'Squib\'s hand is on your shoulder before your fingers touch the wood. He doesn\'t grip. He doesn\'t have to. "Mind the barrel," he says, very quietly. It is not a request.');
    c.npc('squib').disposition -= 1;
    return true;
  }
  // ---- routes the parser sends the wrong way ----
  if (/^(climb|scale|clamber|shimmy) (?:up |onto |on |over |into )?(?:the )?(rafters?|roof|roof beams?|beams?|wall|walls|tree|chimney|bar|table|palisade|tower|rope|cliff|rocks?|fence|gate|barrel|crates?|statue)\b/.test(t)
    || /^(lift|heft|hoist|pick up|raise|carry) (?:the |a |that )?(barrel|table|anvil|boulder|cart|bench|crate|statue|sarcophagus|coffin|lid|keg)\b/.test(t)
    || /^slip (?:a|the|some|my|one) /.test(t)) {
    if (Act.freeAction(c, w, raw)) return true;
  }
  return false;
}
