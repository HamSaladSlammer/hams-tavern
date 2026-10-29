// Offline intent parser. Turns free text into an Intent the engine can resolve.
// Design rule: anything a player might type to hit something maps to an attack, and the
// *verb* is kept so the narration can describe the punch, kick, bite or headbutt they asked for.

export type AttackStyle = 'unarmed' | 'melee' | 'ranged' | 'thrown' | 'default';

export type Intent =
  | { type: 'help' }
  | { type: 'look' }
  | { type: 'inventory' }
  | { type: 'sheet' }
  | { type: 'journal' }
  | { type: 'exits' }
  | { type: 'go'; dest: string }
  | { type: 'attack'; style: AttackStyle; verb: string; target?: string; weapon?: string; limb?: string }
  | { type: 'cast'; spell: string; target?: string }
  | { type: 'shove'; verb: string; target?: string }
  | { type: 'grapple'; verb: string; target?: string }
  | { type: 'use'; item: string; target?: string }
  | { type: 'equip'; item: string }
  | { type: 'unequip'; item: string }
  | { type: 'reload' }
  | { type: 'unjam' }
  | { type: 'take'; item: string }
  | { type: 'drop'; item: string }
  | { type: 'examine'; thing: string }
  | { type: 'search'; thing: string }
  | { type: 'read'; thing: string }
  | { type: 'open'; thing: string; method: 'normal' | 'force' | 'pick' | 'kick' }
  | { type: 'pull'; thing: string }
  | { type: 'ring'; thing: string }
  | { type: 'cut'; thing: string }
  | { type: 'talk'; npc?: string; topic?: string }
  | { type: 'say'; text: string; to?: string }
  | { type: 'buy'; item: string; qty: number }
  | { type: 'sell'; item: string }
  | { type: 'shop' }
  | { type: 'give'; item: string; npc?: string }
  | { type: 'social'; skill: 'persuasion' | 'intimidation' | 'deception' | 'performance'; npc?: string; text: string }
  | { type: 'emote'; act: string; target?: string }
  | { type: 'rest'; kind: 'short' | 'long' }
  | { type: 'wait' }
  | { type: 'hide' }
  | { type: 'sneak'; dest?: string }
  | { type: 'dodge' }
  | { type: 'flee' }
  | { type: 'surrender' }
  | { type: 'feature'; name: 'second wind' | 'action surge' | 'flurry' | 'turn undead' | 'breath' }
  | { type: 'oracle'; question: string }
  | { type: 'spare'; target?: string }
  | { type: 'finish'; target?: string }
  | { type: 'sleep' }
  | { type: 'save' }
  | { type: 'unknown'; raw: string };

// verb -> limb/description for narration. All of these resolve to an Unarmed Strike.
export const UNARMED_VERBS: Record<string, string> = {
  punch: 'fist', 'sucker punch': 'fist', jab: 'fist', uppercut: 'fist', hook: 'fist', haymaker: 'fist', 'right hook': 'fist', 'left hook': 'fist', 'gut punch': 'fist', 'gut-punch': 'fist', 'falcon punch': 'fist', pummel: 'fist', box: 'fist', clobber: 'fist', sock: 'fist', deck: 'fist', 'knock out': 'fist', 'ko': 'fist',
  kick: 'foot', roundhouse: 'foot', 'roundhouse kick': 'foot', 'mule kick': 'foot', 'mule-kick': 'foot', dropkick: 'foot', 'drop kick': 'foot', 'axe kick': 'foot', 'front kick': 'foot', 'flying kick': 'foot', stomp: 'foot', 'curb stomp': 'foot', boot: 'foot', 'punt': 'foot', trample: 'foot',
  knee: 'knee', 'knee strike': 'knee',
  elbow: 'elbow', 'elbow drop': 'elbow', 'elbow strike': 'elbow',
  headbutt: 'head', 'head-butt': 'head', 'head butt': 'head', 'glasgow kiss': 'head',
  bite: 'teeth', chomp: 'teeth', gnaw: 'teeth', nibble: 'teeth', 'sink my teeth into': 'teeth',
  slap: 'palm', 'bitch slap': 'palm', smack: 'palm', backhand: 'palm', 'palm strike': 'palm', spank: 'palm',
  poke: 'finger', 'eye poke': 'finger', 'poke in the eye': 'finger', flick: 'finger', jab_finger: 'finger',
  chop: 'hand', 'karate chop': 'hand', 'knife hand': 'hand', 'nerve strike': 'hand',
  scratch: 'nails', claw: 'nails',
  bodyslam: 'body', 'body slam': 'body', suplex: 'body', clothesline: 'arm', lariat: 'arm', 'flying elbow': 'elbow', piledrive: 'body', piledriver: 'body', 'spear tackle': 'body',
  strike: 'fist', hit: 'fist', beat: 'fist', 'beat up': 'fist', thump: 'fist', wallop: 'fist', bonk: 'fist', bop: 'fist', 'throw hands': 'fist', 'throw hands at': 'fist', brawl: 'fist', 'fist fight': 'fist', 'fistfight': 'fist',
};

const MELEE_VERBS = ['stab', 'slash', 'hack', 'slice', 'cleave', 'skewer', 'impale', 'run through', 'lunge at', 'lunge', 'thrust at', 'swing at', 'swing', 'bash', 'bludgeon', 'smash', 'whack', 'club', 'stick', 'gut', 'shank', 'behead', 'decapitate', 'chop at', 'cut down', 'carve', 'sword', 'axe'];
const RANGED_VERBS = ['shoot', 'fire at', 'fire on', 'open fire on', 'snipe', 'blast', 'gun down', 'pop', 'plug', 'pistol whip', 'unload on', 'put a bullet in', 'shoot at', 'loose an arrow at', 'loose at'];
const THROWN_VERBS = ['throw', 'toss', 'hurl', 'chuck', 'lob', 'fling', 'pitch'];
const GENERIC_ATTACK = ['attack', 'fight', 'kill', 'murder', 'take down', 'engage', 'assault', 'charge', 'go after', 'destroy', 'hurt', 'wound', 'end', 'slay', 'smite'];
const SHOVE_VERBS = ['shove', 'push', 'trip', 'tackle', 'sweep', 'knock down', 'knock over', 'shoulder check', 'bowl over', 'leg sweep'];
const GRAPPLE_VERBS = ['grapple', 'grab', 'choke', 'strangle', 'wrestle', 'restrain', 'pin', 'hold down', 'headlock', 'put in a headlock', 'bear hug', 'tackle and hold', 'subdue', 'tie up'];

const EMOTES: Record<string, string> = {
  'high five': 'high five', 'high-five': 'high five', highfive: 'high five', 'fist bump': 'fist bump', fistbump: 'fist bump', 'bro fist': 'fist bump',
  hug: 'hug', wave: 'wave', bow: 'bow', curtsy: 'bow', salute: 'salute', dance: 'dance', laugh: 'laugh', cry: 'cry', spit: 'spit', wink: 'wink', nod: 'nod', shrug: 'shrug', cheer: 'cheer', toast: 'toast', clap: 'clap', sing: 'sing', flex: 'flex', backflip: 'backflip', 'do a backflip': 'backflip', sit: 'sit', pray: 'pray', apologize: 'apologize', apologise: 'apologize', 'say sorry': 'apologize', sorry: 'apologize', thank: 'thank', thanks: 'thank', 'thank you': 'thank', vomit: 'vomit', puke: 'vomit', 'throw up': 'vomit', fart: 'fart', burp: 'burp', pet: 'pet', 'shake hands': 'handshake', handshake: 'handshake', 'shake hand': 'handshake', kiss: 'kiss', flirt: 'flirt', 'wink at': 'wink',
};

const DIRS: Record<string, string> = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down', north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down', upstairs: 'up', downstairs: 'down', out: 'out', outside: 'out', back: 'back', inside: 'in', in: 'in' };

const ARTICLES = /\b(the|a|an|that|this|those|these|some|my|his|her|its|their|at|to|on|onto|into|in the|with all my might|as hard as i can|really hard|hard|again|quickly|right|nearest|closest|first|one)\b/g;

export function clean(s: string): string {
  return s.replace(ARTICLES, ' ').replace(/\s+/g, ' ').trim();
}

function startsWithPhrase(text: string, phrases: string[]): string | null {
  // longest match first
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    if (text === p || text.startsWith(p + ' ')) return p;
  }
  return null;
}

function splitWith(rest: string): { target: string; weapon?: string } {
  const m = rest.match(/^(.*?)\s+(?:with|using)\s+(.+)$/);
  if (m) return { target: clean(m[1]), weapon: clean(m[2]) };
  return { target: clean(rest) };
}

/** Parse one line of player input. `spellNames` lets "fire bolt the zombie" beat "fire at". */
export function parse(rawInput: string, spellNames: string[] = []): Intent {
  let raw = rawInput.trim();
  if (!raw) return { type: 'unknown', raw };
  // quoted speech
  const quoted = raw.match(/^(?:say|yell|shout|whisper|tell\s+(\w+))?\s*["“](.+?)["”]?$/i);
  if (quoted && /["“]/.test(raw)) return { type: 'say', text: quoted[2], to: quoted[1]?.toLowerCase() };
  if (/^(say|yell|shout|whisper|scream)\s+/i.test(raw)) return { type: 'say', text: raw.replace(/^\w+\s+/, '') };
  if (raw.startsWith('?')) return { type: 'oracle', question: raw.slice(1).trim() };

  let t = raw.toLowerCase().replace(/[.!]+$/g, '').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(i want to|i'd like to|i would like to|i try to|i attempt to|i'll|i will|let me|try to|attempt to|i|please|can i|could i|go ahead and|quickly|then)\s+/g, '');
  t = t.replace(/^(i want to|i try to|try to|attempt to|please)\s+/, '');
  t = t.replace(/\?$/, '');

  // --- system ---
  if (/^(help|commands|what can i do|\?|h)$/.test(t)) return { type: 'help' };
  if (/^(l|look|look around|where am i|describe|survey|scan|look about)$/.test(t)) return { type: 'look' };
  if (/^(i|inv|inventory|bag|pack|backpack|items|gear|what do i have|check (my )?(bag|inventory|pack))$/.test(t)) return { type: 'inventory' };
  if (/^(stats|sheet|char|character|status|me|hp|health|check (myself|me|hp|health)|who am i)$/.test(t)) return { type: 'sheet' };
  if (/^(journal|quests?|notes|log|quest log)$/.test(t)) return { type: 'journal' };
  if (/^(exits|where can i go|directions|paths|map)$/.test(t)) return { type: 'exits' };
  if (/^(save|save game)$/.test(t)) return { type: 'save' };
  if (/^(wait|z|pass|end turn|do nothing|wait around|bide)$/.test(t)) return { type: 'wait' };
  if (/^(short rest|take a short rest|rest a bit|catch (my|our) breath|take a breather|breather)$/.test(t)) return { type: 'rest', kind: 'short' };
  if (/^(long rest|take a long rest|sleep|go to sleep|go to bed|camp|make camp|rest for the night|bed down|get a room|rent a room|turn in|rest)$/.test(t)) return { type: 'rest', kind: /room/.test(t) ? 'long' : t === 'rest' ? 'short' : 'long' };
  if (/^(oracle|ask the oracle)\s+/.test(t)) return { type: 'oracle', question: t.replace(/^(oracle|ask the oracle)\s+/, '') };

  // --- combat features ---
  if (/second wind/.test(t)) return { type: 'feature', name: 'second wind' };
  if (/action surge/.test(t)) return { type: 'feature', name: 'action surge' };
  if (/flurry/.test(t)) return { type: 'feature', name: 'flurry' };
  if (/turn undead|channel divinity|present (my )?holy symbol/.test(t)) return { type: 'feature', name: 'turn undead' };
  if (/breath weapon|breathe fire|breath attack|use (my )?breath/.test(t)) return { type: 'feature', name: 'breath' };
  if (/^(dodge|defend|take cover|duck|brace|block|parry|go defensive|full defense)\b/.test(t)) return { type: 'dodge' };
  if (/^(flee|run away|run|retreat|escape|get out of here|leg it|bail|scram|run for it|disengage)\b/.test(t)) return { type: 'flee' };
  if (/^(surrender|give up|yield|i yield|i give up)$/.test(t)) return { type: 'surrender' };
  if (/^(hide|take cover and hide|hide in the shadows|duck behind)/.test(t)) return { type: 'hide' };
  if (/^(reload|load (my )?(gun|revolver|pistol|rifle)|reload (my )?\w+)$/.test(t)) return { type: 'reload' };
  if (/(unjam|clear (the )?jam|fix (my )?(gun|revolver|pistol|rifle)|clear (my )?(gun|revolver|pistol|rifle))/.test(t)) return { type: 'unjam' };
  if (/^(spare|let (her|him|them|it) (go|live)|show mercy|mercy|stop fighting|stand down|let \w+ go)/.test(t)) return { type: 'spare', target: clean(t.replace(/^(spare|let|show mercy|mercy)/, '').replace(/\b(go|live)\b/, '')) || undefined };
  if (/^(finish (her|him|them|it) off|finish off|execute|coup de grace|finish)\b/.test(t)) return { type: 'finish', target: clean(t.replace(/^(finish (her|him|them|it) off|finish off|execute|coup de grace|finish)/, '')) || undefined };

  // --- spells: "cast X at Y", or "X the Y" where X is a known spell ---
  const castM = t.match(/^(?:cast|use|throw|fling|launch|hurl)\s+(.+?)(?:\s+(?:at|on|against|toward|towards|onto)\s+(.+))?$/);
  if (castM) {
    const spell = spellNames.find((n) => castM[1].startsWith(n));
    if (spell) return { type: 'cast', spell, target: castM[2] ? clean(castM[2]) : clean(castM[1].slice(spell.length)) || undefined };
    if (/^cast\b/.test(t)) return { type: 'cast', spell: castM[1], target: castM[2] ? clean(castM[2]) : undefined };
  }
  for (const n of [...spellNames].sort((a, b) => b.length - a.length)) {
    if (t === n || t.startsWith(n + ' ')) {
      const rest = t.slice(n.length).replace(/^\s*(at|on|against)\s+/, '');
      return { type: 'cast', spell: n, target: clean(rest) || undefined };
    }
  }

  // --- emotes (before attacks: "high five alistair" is not an attack) ---
  const emo = startsWithPhrase(t, Object.keys(EMOTES));
  if (emo && !/^(hit|beat)/.test(emo)) {
    const rest = clean(t.slice(emo.length).replace(/^\s*(with|to|at|for)\s+/, ''));
    return { type: 'emote', act: EMOTES[emo], target: rest || undefined };
  }

  // --- kicking doors open beats kicking people ---
  {
    const dm = t.match(/^(?:kick|boot|mule kick|mule-kick|shoulder|bash|break|break down|batter|ram|smash|kick down|kick in|kick open|shoulder open)\s+(?:open\s+|down\s+|in\s+)?(.+?)(?:\s+open|\s+down|\s+in)?$/);
    if (dm && /\b(door|gate|lock|chest|trapdoor|hatch)\b/.test(dm[1])) return { type: 'open', thing: clean(dm[1]), method: /kick|boot/.test(t) ? 'kick' : 'force' };
  }
  // --- unarmed strikes ---
  const unarmed = startsWithPhrase(t, Object.keys(UNARMED_VERBS));
  if (unarmed) {
    let rest = t.slice(unarmed.length).trim();
    // "hit X with my sword" -> weapon attack
    const sp = splitWith(rest);
    if (sp.weapon && !/(fist|fists|foot|feet|hand|hands|knee|elbow|head|teeth|bare hands|palm)/.test(sp.weapon)) {
      return { type: 'attack', style: 'default', verb: unarmed, target: sp.target || undefined, weapon: sp.weapon };
    }
    rest = rest.replace(/\b(in|on)\s+(the\s+)?(face|gut|stomach|jaw|nose|head|ribs|chest|groin|nuts|balls|crotch|family jewels|knee|kneecap|shin|neck|throat|back|eye|eyes|skull|teeth|mouth|chin|kidney|kidneys)\b.*$/, '');
    const limbM = t.match(/\b(face|gut|stomach|jaw|nose|head|ribs|chest|groin|nuts|balls|crotch|family jewels|knee|kneecap|shin|neck|throat|back|eye|eyes|skull|teeth|mouth|chin|kidney|kidneys)\b/);
    const generic = ['strike', 'hit', 'beat', 'beat up', 'thump', 'wallop', 'bonk', 'bop'].includes(unarmed);
    return { type: 'attack', style: generic ? 'default' : 'unarmed', verb: unarmed, target: clean(splitWith(rest).target) || undefined, limb: limbM?.[1] };
  }
  const shove = startsWithPhrase(t, SHOVE_VERBS);
  if (shove) return { type: 'shove', verb: shove, target: clean(t.slice(shove.length)) || undefined };
  const grap = startsWithPhrase(t, GRAPPLE_VERBS);
  if (grap && !/^grab\s+(the\s+)?(coin|coins|gold|item|key|potion|candle|amulet|journal|book|letter|robe|sword|dagger|it|everything|loot|bottle|drink|mug)/.test(t)) {
    return { type: 'grapple', verb: grap, target: clean(t.slice(grap.length)) || undefined };
  }

  // --- weapon attacks ---
  const ranged = startsWithPhrase(t, RANGED_VERBS);
  if (ranged) {
    const sp = splitWith(t.slice(ranged.length));
    return { type: 'attack', style: 'ranged', verb: ranged, target: sp.target || undefined, weapon: sp.weapon };
  }
  const thrown = startsWithPhrase(t, THROWN_VERBS);
  if (thrown) {
    // "throw dagger at zombie" / "throw a punch at" (handled above)
    const m = t.slice(thrown.length).trim().match(/^(.+?)\s+(?:at|toward|towards|into)\s+(.+)$/);
    if (m) return { type: 'attack', style: 'thrown', verb: thrown, target: clean(m[2]), weapon: clean(m[1]) };
  }
  const melee = startsWithPhrase(t, MELEE_VERBS);
  if (melee) {
    const sp = splitWith(t.slice(melee.length));
    return { type: 'attack', style: 'melee', verb: melee, target: sp.target || undefined, weapon: sp.weapon };
  }
  const gen = startsWithPhrase(t, GENERIC_ATTACK);
  if (gen) {
    const sp = splitWith(t.slice(gen.length));
    return { type: 'attack', style: 'default', verb: gen, target: sp.target || undefined, weapon: sp.weapon };
  }
  // "cut the rope" vs "cut the zombie": cut is a world action; engine falls back to attack if the target is a creature
  if (/^(cut|sever|slice through|saw through)\s+/.test(t)) return { type: 'cut', thing: clean(t.replace(/^(cut|sever|slice through|saw through)\s+/, '')) };

  // --- items ---
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(?:drink|quaff|chug|down|sip|swig|use|apply|eat|consume|read and use)\s+(.+?)(?:\s+on\s+(.+))?$/))) {
    if (/^(read)/.test(t)) return { type: 'read', thing: clean(m[1]) };
    return { type: 'use', item: clean(m[1]), target: m[2] ? clean(m[2]) : undefined };
  }
  if ((m = t.match(/^(?:equip|wield|draw|ready|hold|wear|put on|don|switch to|take out|pull out|unsheathe|unholster)\s+(.+)$/))) return { type: 'equip', item: clean(m[1]) };
  if ((m = t.match(/^(?:unequip|sheathe|holster|put away|take off|remove|doff|stow)\s+(.+)$/))) return { type: 'unequip', item: clean(m[1]) };
  if ((m = t.match(/^(?:take|get|grab|pick up|pocket|collect|loot|steal|swipe|nab|snag|lift|pilfer)\s+(.+)$/))) return { type: 'take', item: clean(m[1].replace(/\bfrom\b.*$/, '')) || 'all' };
  if (/^(loot|take all|get all|grab everything|take everything|loot (the )?(bodies|body|corpse|room))$/.test(t)) return { type: 'take', item: 'all' };
  if ((m = t.match(/^(?:drop|discard|leave|ditch)\s+(.+)$/))) return { type: 'drop', item: clean(m[1]) };
  if ((m = t.match(/^(?:give|hand|offer|pass)\s+(.+?)\s+(?:to)\s+(.+)$/))) return { type: 'give', item: clean(m[1]), npc: clean(m[2]) };
  if ((m = t.match(/^(?:give|hand|offer|pass)\s+(\w+)\s+(.+)$/))) return { type: 'give', item: clean(m[2]), npc: clean(m[1]) };

  // --- world interaction ---
  if ((m = t.match(/^(?:read|study|peruse|skim)\s+(.+)$/))) return { type: 'read', thing: clean(m[1]) };
  if ((m = t.match(/^(?:search|investigate|rummage through|rummage in|rummage|check|inspect closely|frisk|pat down|search for|look for|feel around)\s*(.*)$/))) return { type: 'search', thing: clean(m[1]) };
  if ((m = t.match(/^(?:look at|look|examine|inspect|x|study|observe|check out|eye|peer at|stare at|watch)\s+(.+)$/))) return { type: 'examine', thing: clean(m[1].replace(/^at\s+/, '')) };
  if ((m = t.match(/^(?:kick|boot|mule kick|shoulder|bash|break|break down|batter|ram|smash)\s+(?:open\s+)?(.+?)(?:\s+open|\s+down|\s+in)?$/)) && /door|gate|lock|chest|trapdoor|hatch/.test(t)) return { type: 'open', thing: clean(m[1]), method: /kick|boot/.test(t) ? 'kick' : 'force' };
  if ((m = t.match(/^(?:force|pry|prise|prize|lever|jimmy|crowbar)\s+(?:open\s+)?(.+?)(?:\s+open)?$/))) return { type: 'open', thing: clean(m[1]), method: 'force' };
  if ((m = t.match(/^(?:pick|lockpick|pick the lock on|pick the lock of|pick lock|unlock)\s+(?:the\s+)?(?:lock\s+(?:on|of)\s+)?(.+)$/))) return { type: 'open', thing: clean(m[1]), method: /pick/.test(t) ? 'pick' : 'normal' };
  if ((m = t.match(/^(?:open|unlatch|lift the lid of|lift)\s+(.+)$/))) return { type: 'open', thing: clean(m[1]), method: 'normal' };
  if ((m = t.match(/^(?:pull|yank|tug|press|push|flip|turn|activate|use)\s+(.+)$/)) && /lever|switch|handle|button|stone|candle|sconce|rope/.test(t)) return { type: 'pull', thing: clean(m[1]) };
  if ((m = t.match(/^(?:ring|toll|strike|sound)\s+(.+)$/)) && /bell/.test(t)) return { type: 'ring', thing: clean(m[1]) };
  if (/^(silence|stop|muffle|wrap|disable|stop the bell|take down) (the )?bell/.test(t)) return { type: 'cut', thing: 'bell' };

  // --- shops & social ---
  if (/^(shop|browse|trade|wares|what do you sell|what('s| is) for sale|see wares|buy something|menu|what('s| is) on the menu)$/.test(t)) return { type: 'shop' };
  if ((m = t.match(/^(?:buy|purchase|order|get me|i'll have|ill have|grab me|pour me)\s+(?:(\d+|a|an|one|two|three|four|five|some)\s+)?(.+)$/))) {
    const n = m[1] ? ({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, some: 1 } as Record<string, number>)[m[1]] ?? parseInt(m[1], 10) : 1;
    return { type: 'buy', item: clean(m[2]), qty: n || 1 };
  }
  if ((m = t.match(/^(?:sell|pawn|hawk|fence)\s+(.+?)(?:\s+to\s+.+)?$/))) return { type: 'sell', item: clean(m[1]) };
  if ((m = t.match(/^(?:persuade|convince|charm|reason with|plead with|beg|sweet talk|sweet-talk|bargain with|haggle with|negotiate with)\s+(\S+)?\s*(.*)$/))) return { type: 'social', skill: 'persuasion', npc: m[1] ? clean(m[1]) : undefined, text: m[2] ?? '' };
  if ((m = t.match(/^(?:intimidate|threaten|menace|scare|frighten|lean on|strong-arm|strongarm|bully)\s+(\S+)?\s*(.*)$/))) return { type: 'social', skill: 'intimidation', npc: m[1] ? clean(m[1]) : undefined, text: m[2] ?? '' };
  if ((m = t.match(/^(?:lie to|deceive|bluff|trick|con|fool|mislead)\s+(\S+)?\s*(.*)$/))) return { type: 'social', skill: 'deception', npc: m[1] ? clean(m[1]) : undefined, text: m[2] ?? '' };
  if ((m = t.match(/^(?:perform|play music|tell a joke|tell jokes|tell a story|juggle|do a trick|show off|sing a song)\s*(.*)$/))) return { type: 'social', skill: 'performance', text: m[1] ?? '' };
  if ((m = t.match(/^(?:ask|question|quiz|interrogate|query)\s+(\S+)\s+(?:about|regarding|on|for|if|whether|what|why|where|who|how)\s+(.+)$/))) return { type: 'talk', npc: clean(m[1]), topic: clean(m[2]) };
  if ((m = t.match(/^(?:ask|inquire|enquire)\s+(?:about|regarding)\s+(.+)$/))) return { type: 'talk', topic: clean(m[1]) };
  if ((m = t.match(/^(?:tell)\s+(\S+)\s+(?:about)\s+(.+)$/))) return { type: 'talk', npc: /^(me|us)$/.test(m[1]) ? undefined : clean(m[1]), topic: clean(m[2]) };
  if ((m = t.match(/^(?:tell)\s+(\S+)\s+(?:to)\s+(.+)$/))) return { type: 'talk', npc: clean(m[1]), topic: clean(m[2]) };
  if ((m = t.match(/^(?:talk|speak|chat|converse|gossip)(?:\s+(?:to|with))?\s*(.*?)(?:\s+about\s+(.+))?$/))) return { type: 'talk', npc: clean(m[1]) || undefined, topic: m[2] ? clean(m[2]) : undefined };
  if ((m = t.match(/^(?:greet|hail|approach|say hello to|say hi to|introduce myself to|wave to|wave at)\s+(.+)$/))) return { type: 'talk', npc: clean(m[1]) };
  if (/^(hello|hi|hey|hiya|howdy|greetings|good (morning|evening|afternoon|day)|yo|sup|what's up|whats up|evening|morning|ahoy|oi)\b/.test(t)) return { type: 'say', text: raw };
  if (/^(bye|goodbye|farewell|see you|later|leave conversation|stop talking|end conversation|never ?mind)\b/.test(t)) return { type: 'talk', npc: '__end__' };

  // --- movement ---
  if ((m = t.match(/^(?:sneak|creep|tiptoe|slip|skulk)\s*(?:to|into|toward|towards|up|down|past|through|in|out)?\s*(.*)$/))) return { type: 'sneak', dest: clean(m[1]) || undefined };
  if ((m = t.match(/^(?:go|walk|head|travel|move|journey|return|proceed|wander|stroll|march|hike|climb|descend|ascend|enter|leave|exit|follow|take the|run|jog|hurry|make my way|make our way|set off|set out|cross|step|back)\b\s*(to|into|toward|towards|up|down|through|in|out|over|inside|outside|for|along|on|the)?\s*(.*)$/))) {
    const prep = m[1];
    const rest = clean(m[2] ?? '');
    const dest = rest || (prep && DIRS[prep] ? DIRS[prep] : '') || (/^(leave|exit)/.test(t) ? 'out' : /^climb/.test(t) ? 'up' : /^descend/.test(t) ? 'down' : /^(back|return)/.test(t) ? 'back' : '');
    return { type: 'go', dest: DIRS[dest] ?? dest };
  }
  if (DIRS[t]) return { type: 'go', dest: DIRS[t] };

  // vocative: "squib, what's with the barrel" -> say to squib
  const voc = raw.match(/^([A-Za-z]+)\s*[,:]\s*(.+)$/);
  if (voc) return { type: 'say', text: raw, to: voc[1].toLowerCase() };

  // A bare noun might be a destination or a thing to look at; let the engine decide.
  return { type: 'unknown', raw };
}
