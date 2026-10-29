// NPCs of Breda and the northern foothills. Personalities from the Kalashscovia world bible.
import type { Ctx, Npc } from './types';
import { fmtMoney, hasItem, removeItem, addItem, levelUp, xpToNext } from '../engine/character';
import { pick } from '../engine/dice';
import { ITEMS } from '../engine/srd';

const banned = (c: Ctx, id: string) => c.npc(id).banned;

// ---------- Squib ----------
const squib: Npc = {
  id: 'squib', name: 'Squib', names: ['squib', 'barkeep', 'bartender', 'innkeeper', 'half-orc', 'half orc', 'tavern keeper', 'owner'],
  short: 'the half-orc who runs the Smoking Barrel',
  look: () => 'Enormous, grey at the temples, with hands like shovels and a voice so soft you lean in to hear it. He polishes the same mug whenever someone mentions the war.',
  greet: (c) => {
    const m = c.npc('squib');
    if (m.banned) { c.narr('Squib looks through you as if you were a draught from the door. He does not serve you.'); return; }
    if (c.flag('chapel_done') && !c.flag('chapel_paid')) { squibPayout(c); return; }
    if (!m.met) {
      m.met = true;
      c.say('squib', '"New face." He sets a mug down in front of you before you ask. "Barrel Brown. First one\'s on the house, on account of you look like you walked here." He taps the bar twice.');
      c.give('mug_ale'); c.s.lastObject = 'mug';
      if (c.flag('local')) c.say('squib', 'He looks at you again. "...You\'re the one from two streets over. Grew up, didn\'t you." That\'s as warm as Squib gets.');
      c.say('squib', '"Board by the door has honest work. Mind the barrel. Don\'t ask about the barrel."');
      return;
    }
    c.say('squib', pick(c.rng, ['"Back again." He reaches for your usual without asking.', '"Sit. You look like the road chewed you."', '"Evening. Or morning. They run together in here."']));
    if (!c.pc.inventory.some((x) => x.id === 'mug_ale') && c.pc.copper >= 5 && !c.flag('chapel_paid')) { c.pay(5); c.give('mug_ale'); c.s.lastObject = 'mug'; c.narr('A mug of Barrel Brown arrives in front of you. Five copper disappears from the bar.'); }
    else if (!c.pc.inventory.some((x) => x.id === 'mug_ale') && c.flag('chapel_paid')) { c.give('mug_ale'); c.s.lastObject = 'mug'; c.narr('A mug of Barrel Brown arrives in front of you. Your money\'s no good here now.'); }
  },
  topics: [
    { id: 'bell', keys: ['bell', 'chapel', 'old chapel', 'job', 'quest', 'work', 'notice', '50', 'fifty', 'ringing', 'midnight'], chip: 'Ask about the chapel bell', say: (c) => {
      c.say('squib', '"The old chapel up in the foothills. Been empty since before the war. Bell\'s been ringing at midnight, three weeks now. Nobody up there to ring it."');
      c.say('squib', 'He polishes the mug. "Heard that bell once before. End of the war. Night before something I don\'t talk about." A pause. "Fifty gold to whoever makes it stop. Bring a rope. Bring sense."');
      if (!c.flag('quest_chapel')) { c.set('quest_chapel'); c.journal('The Old Chapel Bell: the abandoned chapel in the northern foothills rings at midnight. Squib pays 50 gp to silence it. North gate, through the Thornwood, then the chapel path at Kessel\'s Rest.'); c.good('Quest taken: The Old Chapel Bell.'); }
    } },
    { id: 'barrel', keys: ['barrel', 'scorched', 'burnt barrel', 'black barrel', 'hearth'], chip: 'Ask about the barrel', say: (c) => {
      const n = (c.flag('asked_barrel') as number) || 0;
      c.set('asked_barrel', n + 1);
      if (n === 0) c.say('squib', '"Don\'t ask about the barrel."');
      else if (n === 1) c.say('squib', '"That was asking about the barrel."');
      else { c.say('squib', 'He looks at it for a long moment. "Some things you keep somewhere loud and full of life. That\'s all you get." He does not look at it again.'); c.set('barrel_hint'); }
    } },
    { id: 'war', keys: ['war', 'civil war', 'greymarch', 'orcs', 'fight', 'army', 'soldier', 'veteran', 'company'], say: (c) => {
      c.narr('Squib picks up a clean mug and polishes it. And polishes it. The conversation is over until he puts it down.');
      if (c.npc('squib').disposition >= 3) c.say('squib', '"Carried stretchers. Too young to fight. Fifteen years and I can still tell you the weight of every one." He puts the mug down.');
    } },
    { id: 'queen', keys: ['pale queen', 'pale woman', 'her majesty', 'queen', 'vessariel', 'lich queen'], say: (c) => {
      if (/vessariel/i.test(String(c.flag('last_said') ?? ''))) c.bad('Somewhere far to the west, something hears the name.');
      c.narr('Squib goes very still. "Elves have a queen in Suomi. That\'s the only one I know." He moves down the bar. Half-orcs remember the war stories elves prefer forgotten, and he wants no part of this one.');
    } },
    { id: 'kettle', keys: ['kettle', 'dog', 'hound', 'war hound', 'borrow', 'help', 'companion', 'company'], chip: 'Ask about the dog', say: (c) => {
      if (c.hasCompanion('kettle')) { c.say('squib', '"Bring him back with all three legs."'); return; }
      c.say('squib', 'A three-legged war hound thumps its tail under the bar. "Kettle. Served longer than I did." Squib scratches his ears. "Take him if you\'re going up to that chapel. He\'s better than most swords. Bring him back."');
      c.addCompanion('kettle');
      c.good('Kettle joins you. (Three-legged war hound: AC 13, 11 HP, bite +4.)');
    } },
    { id: 'potion', keys: ['potion', 'healing', 'supplies', 'advice', 'tips'], say: (c) => {
      if (c.flag('squib_potion')) { c.say('squib', '"Already gave you one. Don\'t waste it on a hangover."'); return; }
      c.set('squib_potion'); c.give('potion_healing');
      c.say('squib', 'He sets a small red bottle on the bar. "Chapel jobs went bad before. Drink it before you need it, not after."');
    } },
    { id: 'room', keys: ['room', 'bed', 'sleep', 'stay', 'lodging', 'night'], say: (c) => c.say('squib', '"Floor by the hearth\'s five copper, blanket included, dignity not. Private room\'s fifty. Say \'rent a room\' and I\'ll take the coin."') },
    { id: 'menu', keys: ['menu', 'food', 'drink', 'ale', 'eat', 'stew', 'beer'], say: (c) => c.say('squib', '"Barrel Brown, five copper. Stew\'s been going for years. It\'s fine. Meat pie is rabbit, allegedly." He nods at the chalkboard. Type "shop" to see it.') },
    { id: 'sereza', keys: ['sereza', 'tiefling woman', 'woman in the corner', 'stranger', 'corner'], when: (c) => c.hour() >= 12 || !!c.flag('sereza_met'), say: (c) => c.say('squib', '"Pays for stories about the dead. Pays in crisp coin. City coin." He wipes the bar. "Don\'t like it. Don\'t have to."') },
    { id: 'dwarves', keys: ['dwarves', 'dwarf', 'borin', 'odo', 'marrik', 'tokk'], say: (c) => c.say('squib', '"Road crew. Fixing the east road for the crown. Tab\'s paid every Friday and they\'ve never once lost an arm-wrestle they told me about."') },
    { id: 'doss', keys: ['doss', 'shepherd', 'foothills', 'sheep'], say: (c) => c.say('squib', '"Old Doss. Grazes up past the Thornwood. Deaf as a post. Only man up there sleeping through that bell. Take him something to drink and let him talk; he\'s earned it."') },
    { id: 'alistair', keys: ['alistair', 'skeleton', 'lich', 'friend'], when: (c) => c.hasCompanion('alistair'), say: (c) => {
      if (c.flag('squib_ok_alistair')) c.say('squib', '"He drinks, he pays, he follows my rules. That\'s all I ask of anybody."');
      else c.say('squib', '"Your friend. He\'s waiting outside, and that\'s where he stays until you give me a reason." (Try persuading Squib.)');
    } },
    { id: 'rumor', keys: ['rumor', 'rumour', 'rumors', 'rumours', 'news', 'gossip', 'heard', 'anything new', 'whats new', "what's new", 'going on'], chip: 'Ask for rumours', say: (c) => {
      c.say('squib', pick(c.rng, [
        '"The undead table by the window swears the graves at Faelar\'s old hamlet are dug from the inside."',
        '"Merla Thatch\'s husband came home babbling about a pale woman under the hill. Talking through his dead brother\'s mouth, he said."',
        '"Tanner says one of the wolves on the south road was dead already. Still bit him."',
        '"Brumandell folk stopped talking about the bell. That\'s how you know they hear it."',
        '"Somebody\'s been leaving green candles on the chapel steps. Not the faithful kind."',
      ]));
    } },
  ],
  unknown: ['Squib taps the bar twice, which can mean anything.', '"Couldn\'t say."', '"Ask the board. Board knows more than me."'],
  speech: (c, act, sev) => {
    const m = c.npc('squib');
    if (act === 'insult' || act === 'threat') {
      m.insults += 1; m.disposition -= 2;
      if (m.insults >= 2 || act === 'threat') {
        m.banned = true;
        c.say('squib', 'Squib sets the mug down very gently. "Drink elsewhere. Forever." He turns his back. The room has gone quiet.');
        c.bad('Squib will not serve you. An apology might help, if you mean it.');
      } else c.say('squib', 'He stops polishing. "Once," he says softly. Just the one word. The dwarves stop laughing.');
      return true;
    }
    if (act === 'exclamation' || act === 'emphatic' || act === 'self') { c.narr(sev >= 3 ? 'Squib doesn\'t blink. He\'s heard worse from men with no legs left.' : 'Squib doesn\'t blink.'); return true; }
    if (act === 'cheer') { c.narr('Squib\'s mouth does something that might be a smile.'); return true; }
    return false;
  },
  emote: (c, act) => {
    const m = c.npc('squib');
    if (act === 'apologize' && (m.banned || m.insults > 0)) {
      if (m.disposition <= -5) { c.narr('Squib does not turn around.'); return true; }
      if (c.check('persuasion', m.banned ? 13 : 8)) { m.banned = false; m.insults = 0; m.disposition = Math.max(m.disposition, 0); c.say('squib', 'A long silence. Then a mug slides down the bar to you. "Once," he says. "That was your once."'); }
      else c.narr('Squib listens. He doesn\'t say anything. Maybe tomorrow.');
      return true;
    }
    if (act === 'high five' || act === 'fist bump') { c.narr('Squib looks at your raised hand for a while, then taps it with one enormous finger.'); return true; }
    if (act === 'toast') { c.narr('Squib raises a mug of water. "To the ones who sat down and were safe."'); m.disposition += 1; return true; }
    return false;
  },
  social: (c, skill) => {
    if (c.hasCompanion('alistair') && !c.flag('squib_ok_alistair')) {
      const ok = skill === 'persuasion' ? c.check('persuasion', 12) : skill === 'intimidation' ? c.check('intimidation', 16) : c.check('deception', 14);
      if (ok) { c.set('squib_ok_alistair'); c.say('squib', 'Squib studies you. "He acts on his own? Not hers?" A long breath. "He drinks, he pays, he follows my rules. Bring him in."'); c.narr('Alistair strolls in like he owns the place. "Brother! Love what you\'ve done with it. Is that a barrel on the wall? Bold."'); }
      else c.say('squib', '"No." He doesn\'t raise his voice. He doesn\'t need to.');
      return true;
    }
    if (skill === 'intimidation') { c.narr('Squib looks at you the way a mountain looks at weather.'); c.npc('squib').disposition -= 1; return true; }
    return false;
  },
  shop: [{ id: 'ale', price: 5 }, { id: 'stew', price: 5 }, { id: 'meat_pie', price: 8 }, { id: 'roast_chicken', price: 25 }, { id: 'trenchfire', price: 5 }, { id: 'room_floor', price: 5 }, { id: 'room_private', price: 50 }],
};

function squibPayout(c: Ctx) {
  c.set('chapel_paid');
  c.say('squib', 'Squib looks up when you come in, and the whole room follows his eyes. "Bell didn\'t ring last night." It isn\'t a question.');
  c.say('squib', 'He counts fifty gold onto the bar, then reaches under it and sets down a bottle with a black label. Nobody in the room says anything. "Your money\'s no good tonight."');
  c.money(5000);
  c.give('black_label');
  c.good('Quest complete: The Old Chapel Bell. +50 gp.');
  c.xp(100);
  if (c.hasCompanion('kettle')) { c.narr('Kettle hops back behind the bar and collapses with a satisfied groan.'); c.s.companions = c.s.companions.filter((x) => x !== 'kettle'); }
  maybeLevel(c);
  c.sys('Stay the night. ("sleep")');
}

export function maybeLevel(c: Ctx) {
  if (c.pc.level >= 2) return;
  if (c.pc.xp >= xpToNext(c.pc)) {
    c.narr('Squib pours you a measure from the black bottle and looks at you properly for the first time. "You\'ve grown," he says.');
    for (const l of levelUp(c.pc)) c.good(l);
    c.good(`You are now level ${c.pc.level}.`);
  }
}

// ---------- The dwarves ----------
const dwarves: Npc = {
  id: 'dwarves', name: 'the dwarves', names: ['dwarves', 'dwarf', 'borin', 'odo', 'marrik', 'tokk', 'road crew', 'dwarf table', 'corner table'],
  short: 'four dwarves of the east-road crew',
  look: () => 'Four dwarves hammering mugs in the corner: Borin Coppervein, the loudest laugher; Odo Gravelsson, whose boar story grows every round; quiet Marrik Emberfall, who waits for the perfect moment; and young Tokk Bramblebeard, patchy-bearded and trying to keep up.',
  greet: (c) => { c.say('dwarves', '"Sit, sit!" Borin booms. "Odo\'s telling the boar story. It was the size of a cart last round."'); c.say('dwarves', '"Size of a barn," Odo corrects.'); c.say('dwarves', 'Marrik, without looking up: "Size of Odo\'s mother." The table erupts.'); },
  topics: [
    { id: 'arm', keys: ['arm wrestle', 'arm-wrestle', 'armwrestle', 'wrestle', 'challenge', 'contest', 'strength'], chip: 'Arm-wrestle Borin', say: (c) => {
      if (c.flag('borin_wrestled')) { c.say('dwarves', '"Once a night, friend. My arm\'s got a family."'); return; }
      c.set('borin_wrestled');
      c.narr('Borin plants his elbow, grinning. The table bets on him. Of course they do.');
      if (c.check('athletics', 14)) { c.good('Your knuckles hit the table first— his knuckles. His. The room explodes.'); c.say('dwarves', 'Borin stares at his hand. "Never," he says, and pays for a round, and means it. "You\'ll drink with us any night you like."'); c.npc('dwarves').disposition += 3; c.xp(10); }
      else { c.narr('Borin slams your hand down so hard the mugs jump. He helps you up, laughing. "Next time! Bring your other arm."'); c.npc('dwarves').disposition += 1; }
    } },
    { id: 'road', keys: ['road', 'east road', 'work', 'repair', 'crew', 'job'], say: (c) => c.say('dwarves', '"Fixing war damage on the east road," Borin says. "Dug up three helmets and a boot this week. Boot still had a foot in it." Tokk goes a little green.') },
    { id: 'boar', keys: ['boar', 'story', 'hunt', 'odo'], say: (c) => c.say('dwarves', 'Odo leans in. "Tusks like scythes. Eyes like coals. Big as—" "A barn," says everyone. "A CASTLE," says Odo.') },
    { id: 'bell', keys: ['bell', 'chapel', 'undead', 'dead', 'rumor', 'rumour', 'gossip'], say: (c) => c.say('dwarves', 'Marrik, quietly: "Road-menders hear things. Things that knock. Graves along the north road, dirt pushed up from inside." The table goes quiet for exactly one mouthful.') },
    { id: 'tokk', keys: ['tokk', 'young one', 'beard'], say: (c) => c.say('dwarves', 'Tokk puffs up. "I can drink any of you under the—" He slides gently under the table. Coins change hands.') },
  ],
  unknown: ['"Couldn\'t tell you, but Odo\'ll make something up."', 'Borin laughs at something you didn\'t say.'],
  speech: (c, act) => {
    if (act === 'exclamation' || act === 'emphatic' || act === 'cheer' || act === 'self') { c.narr('The dwarves roar with approval. Borin hammers the table. "THAT\'S the spirit!"'); c.npc('dwarves').disposition += 1; return true; }
    if (act === 'insult') {
      c.say('dwarves', 'Borin stands up, and keeps standing up for longer than you expected. "Say that across a table, friend." He plants his elbow.');
      if (c.npc('squib').insults === 0) c.say('squib', 'From the bar, softly: "Bother my regulars and drink elsewhere."');
      c.npc('dwarves').disposition -= 1; return true;
    }
    if (act === 'threat') { c.narr('Four dwarves put their mugs down at the same time. It is a very specific sound.'); c.npc('dwarves').disposition -= 3; return true; }
    return false;
  },
  emote: (c, act) => {
    if (['toast', 'cheer', 'high five', 'fist bump', 'dance', 'sing', 'burp'].includes(act)) { c.narr(act === 'burp' ? 'Odo answers with a burp that rattles the shutters. You have been out-burped. The table cheers anyway.' : 'The dwarves join in at twice the volume.'); c.npc('dwarves').disposition += 1; return true; }
    return false;
  },
};

// ---------- The undead table ----------
const whisperers: Npc = {
  id: 'whisperers', name: 'the window table', names: ['window table', 'elves', 'goblins', 'faelar', 'ithren', 'nix', 'vetch', 'undead table', 'whisperers', 'goblin', 'elf', 'muttering'],
  short: 'two elves and two goblins muttering about the dead',
  look: () => 'By the window, two elves and two goblins keep their voices down. Faelar Duskmere, a grim former grave-warden; Ithren Vael, younger, who sleeps facing the door; Nix, a jumpy goblin who talks fast; and Vetch, a practical goblin who knows exactly what silver costs.',
  greet: (c) => c.say('whisperers', 'Four heads turn. Faelar looks you over like a grave he\'s been asked to dig. "You\'re not from here. Good. People from here stop listening."'),
  topics: [
    { id: 'graves', keys: ['graves', 'grave', 'dead', 'undead', 'zombies', 'warden'], chip: 'Ask about the dead', say: (c) => c.say('whisperers', 'Faelar: "I kept graves for thirty years. You learn how dirt lies. Last month, at my hamlet, the dirt was pushed up and out. From inside. Every grave on the north side."') },
    { id: 'village', keys: ['village', 'cousin', 'quiet', 'nix'], say: (c) => c.say('whisperers', 'Nix, very fast: "My cousin\'s village went quiet. Not dead. Quiet. Doors open, dinner on the table, nobody home. You don\'t believe me. Nobody believes me. Ithren believes me."') },
    { id: 'silver', keys: ['silver', 'weapons', 'silvered', 'vetch', 'cost'], say: (c) => c.say('whisperers', 'Vetch: "Silvering a blade costs a hundred gold at the Tokarev works. Blacksmith here charges more for less. Bludgeons work fine on skeletons. Fire works on everything."') },
    { id: 'bell', keys: ['bell', 'chapel'], say: (c) => c.say('whisperers', 'Ithren: "The chapel bell rings at midnight. The night after it rings, something always walks. We\'ve been keeping count."') },
  ],
  unknown: ['They exchange a look and lower their voices further.'],
  speech: (c, act) => {
    if (act === 'insult' || act === 'threat') { c.narr('The window table goes silent and turns its back on you, all four at once.'); c.npc('whisperers').disposition -= 2; return true; }
    if (act === 'exclamation') { c.narr('Nix flinches. Ithren\'s hand drifts to his knife, then relaxes.'); return true; }
    return false;
  },
};

// ---------- Sereza ----------
const sereza: Npc = {
  id: 'sereza', name: 'Sereza Harrow', names: ['sereza', 'harrow', 'tiefling', 'tiefling woman', 'woman', 'stranger', 'corner woman'],
  short: 'a tiefling woman who pays for stories about the dead',
  look: (c) => {
    const base = 'A tiefling woman in a good travelling coat, sitting where she can see the door. A notebook, a cup she isn\'t drinking, and a small stack of very new coins.';
    return c.flag('sereza_read') ? base + ' Her coins are crown-minted. Nobody in Breda pays in crown gold.' : base;
  },
  greet: (c) => {
    c.set('sereza_met');
    c.say('sereza', '"Sit, if you like. I pay for stories. Undead sightings, bells, graves that don\'t stay closed." She taps the coins. "Accurate ones pay better."');
    if (hasItem(c.pc, 'bone_amulet')) c.say('sereza', 'Her eyes drop to the bone amulet and stay there a beat too long. "That\'s an interesting piece. I\'d give seventy-five gold for it."');
  },
  topics: [
    { id: 'who', keys: ['who', 'job', 'work', 'employer', 'why', 'buyer', 'pay'], say: (c) => {
      if (c.check('insight', 15)) { c.set('sereza_read'); c.narr('She\'s good. But her coins are crown-minted, her boots are city boots, and she writes in a cipher. She isn\'t buying stories. She\'s collecting reports.'); c.say('sereza', '"A collector," she says, smiling at whatever she sees on your face.'); }
      else c.say('sereza', '"A collector. Of stories. Some people collect spoons."');
    } },
    { id: 'amulet', keys: ['amulet', 'bone amulet', 'sell amulet', 'buy amulet', 'seventy-five', '75'], when: (c) => hasItem(c.pc, 'bone_amulet'), say: (c) => c.say('sereza', '"Seventy-five gold. Say \'sell amulet\' and it\'s yours. Or don\'t. It\'s warmer when you face west, isn\'t it?"') },
    { id: 'bell', keys: ['bell', 'chapel', 'story', 'stories', 'undead', 'report'], say: (c) => {
      if (c.flag('chapel_done') && !c.flag('sereza_paid')) { c.set('sereza_paid'); c.money(500); c.say('sereza', 'She writes while you talk, fast and small. When you mention the woman in the bell tower, she stops writing for a moment. "Five gold. You were worth ten, but I\'m on a budget."'); }
      else c.say('sereza', '"The chapel bell? I know it rings. I\'d pay to know who rings it."');
    } },
  ],
  unknown: ['"I\'ll pay you to tell me, not the other way around."'],
  speech: (c, act) => {
    if (act === 'insult' || act === 'threat') { c.say('sereza', 'She writes something down. "Noted," she says, and you have the distinct feeling you are now in a report.'); c.npc('sereza').disposition -= 2; c.set('sereza_noted'); return true; }
    return false;
  },
};

// ---------- Garrick ----------
const garrick: Npc = {
  id: 'garrick', name: 'Garrick', names: ['garrick', 'shopkeeper', 'merchant', 'clerk', 'tiefling', 'shop keeper', 'trader'],
  short: 'the nervous tiefling who runs General Goods',
  look: () => 'A thin tiefling with ink-stained fingers and one chipped horn, sweating slightly. He has the look of a man expecting to be robbed by every customer.',
  greet: (c) => c.say('garrick', '"Welcome to Garrick\'s General Goods. Rope, torches, rations, cartridges. Curiosities bought, few questions." He swallows. "Fair prices. Very fair. Say \'shop\'."'),
  topics: [
    { id: 'curios', keys: ['curiosities', 'curios', 'buy', 'sell', 'questions'], say: (c) => c.say('garrick', '"I buy odd things. Candles. Old coins. I don\'t ask where they came from, and I\'d really prefer you didn\'t tell me."') },
    { id: 'candles', keys: ['candle', 'candles', 'green', 'wax'], say: (c) => c.say('garrick', 'He goes pale. "Green ones? A woman in grey bought every candle stub I had last month. Paid double. I didn\'t ask. I don\'t ask."') },
  ],
  unknown: ['"I— I wouldn\'t know. Very sorry."'],
  speech: (c, act) => {
    if (act === 'insult' || act === 'threat') { c.narr('Garrick flinches like you threw something.'); c.say('garrick', '"Ten— ten percent off. For you. Today only. Please."'); c.set('garrick_scared'); c.npc('garrick').disposition -= 2; return true; }
    if (act === 'exclamation') { c.narr('Garrick jumps.'); return true; }
    return false;
  },
  social: (c, skill) => {
    if (skill === 'intimidation') { if (c.check('intimidation', 10)) { c.set('garrick_scared'); c.say('garrick', '"Ten percent! Fifteen! Whatever you like!"'); } else c.say('garrick', '"I have a cousin in the guard," he squeaks. He does not.'); return true; }
    if (skill === 'persuasion') { if (c.check('persuasion', 13)) { c.set('garrick_friend'); c.say('garrick', 'He relaxes for the first time. "You\'re... nice. Nobody\'s nice. Here, a discount, a real one."'); } else c.narr('Garrick nods along nervously.'); return true; }
    return false;
  },
  shop: [{ id: 'rope' }, { id: 'torch' }, { id: 'rations' }, { id: 'crowbar' }, { id: 'pistol_cartridge' }, { id: 'rifle_cartridge' }, { id: 'arrow' }, { id: 'thieves_tools' }],
  buys: ['any'],
};

// ---------- The smith ----------
const smith: Npc = {
  id: 'smith', name: 'Mother Dreyse', names: ['smith', 'blacksmith', 'dreyse', 'mother dreyse', 'smithy'],
  short: 'Breda\'s blacksmith, who hears everything over the hammer',
  look: () => 'A broad woman with forearms like hams and burn-scars like freckles. She talks over the hammer, so she talks loud, so she hears everything everyone says back.',
  greet: (c) => c.say('smith', '"WHAT? Oh, a customer!" Clang. "Blades, armour, and I keep a few service pieces from the war. No stamp needed these days. Say \'shop\'." Clang.'),
  topics: [
    { id: 'gossip', keys: ['gossip', 'rumor', 'rumour', 'news', 'heard', 'hear'], say: (c) => c.say('smith', '"Guards say the night watch on the north gate quit. Twice! Bell gets in your teeth, they say. Also Merla Thatch is selling her husband\'s boots, which tells you something."') },
    { id: 'silver', keys: ['silver', 'silvered', 'undead'], say: (c) => c.say('smith', '"Silvered dagger, a hundred and two gold, because the silver\'s from Tokarev and Tokarev\'s greedy. Maces don\'t care what metal they are. Skeletons hate maces."') },
    { id: 'guns', keys: ['gun', 'guns', 'revolver', 'rifle', 'pistol', 'firearm', 'stamp'], say: (c) => c.say('smith', '"Service revolvers from the war. Seven shots, loud as sin, jams if you look at it wrong. Clean it. Blades never jam, mind."') },
  ],
  unknown: ['"WHAT?" Clang.'],
  speech: (c, act) => { if (act === 'exclamation' || act === 'emphatic') { c.say('smith', '"HA! Said worse when I dropped an anvil on my foot."'); return true; } if (act === 'insult') { c.say('smith', 'She lifts the hammer, thoughtfully. "Say again? Couldn\'t hear you over the hammer." She could.'); return true; } return false; },
  shop: [{ id: 'dagger' }, { id: 'mace' }, { id: 'handaxe' }, { id: 'spear' }, { id: 'shortsword' }, { id: 'longsword' }, { id: 'rapier' }, { id: 'warhammer' }, { id: 'battleaxe' }, { id: 'greataxe' }, { id: 'silvered_dagger' }, { id: 'shortbow' }, { id: 'light_crossbow' }, { id: 'service_revolver' }, { id: 'leather_armor' }, { id: 'chain_shirt' }, { id: 'scale_mail' }, { id: 'chain_mail' }, { id: 'shield' }],
  buys: ['weapon', 'armor'],
};

// ---------- Hetch ----------
const hetch: Npc = {
  id: 'hetch', name: 'Hetch', names: ['hetch', 'cat', 'tailor', 'talking cat'],
  short: 'the talking cat who runs the tailor\'s',
  look: (c) => c.flag('hetch_seen') ? 'A grey cat in a waistcoat, sitting on the cutting table among pins he never seems to step on. His eyes catch the lamplight the way old trees catch the sun.' : 'A grey cat in a tiny waistcoat sits on the cutting table, measuring tape around his neck. He is looking at your clothes with open pity.',
  greet: (c) => {
    c.set('hetch_seen');
    c.say('hetch', 'The cat speaks. Of course the cat speaks. "Mm. Come in. Don\'t touch the silk. Those seams were sewn by someone who hated you personally, didn\'t they?"');
    if (c.hasCompanion('alistair')) c.say('hetch', 'He regards Alistair. "No body. All drape. I could do wonders."');
  },
  topics: [
    { id: 'pelts', keys: ['pelt', 'pelts', 'wolf', 'wolves', 'hides', 'fur'], chip: 'Ask about pelts', say: (c) => c.say('hetch', '"Wolf pelts, a gold apiece if they\'re fresh. Not the dead one. If you meet a wolf that\'s already dead, burn it and bring me nothing. Say \'sell pelt\'."') },
    { id: 'self', keys: ['cat', 'talking', 'how', 'who', 'what are you', 'druid', 'magic'], say: (c) => {
      if (c.check('insight', 18, { quiet: false })) { c.set('hetch_druid'); c.narr('For a moment you\'re certain the cat is much older than the shop, and much older than the town, and that he is choosing to be small.'); c.say('hetch', '"Mm. Don\'t tell anyone. They\'d expect things."'); }
      else c.say('hetch', '"A tailor," says the cat. "And you\'re a customer. Let\'s both be what we are."');
    } },
    { id: 'clothes', keys: ['clothes', 'outfit', 'cloak', 'coat', 'fashion', 'look'], say: (c) => c.say('hetch', '"Travel cloaks for the north. Cold-weather wool for the Peaks. And something for you that isn\'t... that."') },
    { id: 'bell', keys: ['bell', 'chapel', 'charms', 'thornwood'], say: (c) => c.say('hetch', '"The charms on the Thornwood trees," says the cat, licking a paw. "Look closely at the new ones. Old hands carved the old ones. New hands carve the new ones. Different hands. Different prayers."') },
  ],
  unknown: ['"Mm." He returns to his pins.'],
  speech: (c, act, sev) => {
    if (act === 'none') return false;
    if (act === 'insult' || act === 'threat') { c.say('hetch', 'His tail goes very still. "Out." The door opens by itself. You are, somehow, outside.'); c.npc('hetch').disposition -= 3; c.move('breda_square'); return true; }
    if (sev >= 1) { c.say('hetch', '"Language," says the cat, without looking up.'); c.npc('hetch').disposition -= 1; return true; }
    return false;
  },
  emote: (c, act) => { if (act === 'pet') { c.say('hetch', '"I am a professional," he says, and allows exactly three strokes.'); c.npc('hetch').disposition += 1; return true; } return false; },
  shop: [{ id: 'travel_cloak' }],
  buys: ['wolf_pelt'],
};

// ---------- Kettle ----------
const kettle: Npc = {
  id: 'kettle', name: 'Kettle', names: ['kettle', 'dog', 'hound', 'war hound', 'doggo', 'good boy'],
  short: 'Squib\'s three-legged war hound',
  look: () => 'A scarred grey war hound with three legs and the calm of a dog who has seen everything twice.',
  greet: (c) => c.narr('Kettle\'s tail thumps twice, like Squib tapping the bar.'),
  topics: [],
  unknown: ['Kettle tilts his head.'],
  emote: (c, act) => { if (act === 'pet' || act === 'hug') { c.narr('Kettle leans his whole weight against your leg. Good boy.'); return true; } return false; },
  speech: (c, act) => { if (act === 'insult') { c.narr('Kettle looks at you with enormous disappointment.'); return true; } return false; },
};

// ---------- Doss ----------
const doss: Npc = {
  id: 'doss', name: 'Doss', names: ['doss', 'shepherd', 'old man', 'old doss'],
  short: 'a half-deaf old shepherd',
  look: () => 'A leathery old man older than the treaty, with forty ewes, a crook, and an ear-trumpet he refuses to use.',
  greet: (c) => {
    if (!c.flag('doss_heard')) { c.say('doss', '"EH?" He cups a hand to his ear. "Speak up! Wind\'s in my good ear." (He can\'t hear normal speech. Try shouting.)'); return; }
    if (!c.npc('doss').met) c.say('doss', '"AH! A visitor! Nobody visits! Sit, sit. Have I told you about the winter of the three-headed lamb? No? Good."');
    else c.say('doss', '"Ah, you again! Sit, sit. Have I told you about the winter of the three-headed lamb?"');
  },
  hears: (c, text) => {
    const loud = /!|^[^a-z]*[A-Z]{3,}/.test(text) || /^(shout|yell|scream)/i.test(String(c.flag('last_verb') ?? ''));
    if (!loud && !c.flag('doss_heard')) { c.say('doss', pick(c.rng, ['"Eh? Lovely weather, aye."', '"What? Speak UP, I\'m not made of ears."', '"Sheep? Aye, I\'ve got sheep."'])); return true; }
    c.set('doss_heard');
    return false;
  },
  topics: [
    { id: 'ewe', keys: ['ewe', 'sheep', 'lost', 'missing', 'lamb', 'flock'], chip: 'Ask about his sheep', say: (c) => {
      if (c.flag('ewe_returned')) { c.say('doss', '"Daisy\'s right as rain. Mostly. Still faces the chapel when she sleeps."'); return; }
      c.say('doss', '"Lost one! Daisy. Best ewe I\'ve got. Wandered up toward the chapel three nights back, and the others that went that way came back... wrong. Bring Daisy home and I\'ll make it worth your while."');
      if (!c.flag('quest_ewe')) { c.set('quest_ewe'); c.journal('Doss\'s ewe Daisy wandered toward the Old Chapel. Bring her back to his hut in the foothills.'); c.good('Quest taken: Daisy the Ewe.'); }
    } },
    { id: 'bell', keys: ['bell', 'chapel', 'ringing', 'midnight', 'noise'], say: (c) => c.say('doss', '"Bell? What bell?" He grins. "Can\'t hear it. Only man up here sleeping through the night. The others moved down to Brumandell. Their loss."') },
    { id: 'stories', keys: ['story', 'stories', 'war', 'past', 'young', 'life', 'listen', 'militia', 'tell me'], chip: 'Listen to his stories', say: (c) => {
      if (c.flag('doss_stories')) { c.say('doss', '"...and that\'s why you never trust a goat." He beams. You have no idea how you got here.'); return; }
      c.set('doss_stories'); c.advance(60);
      c.narr('You sit with Doss for an hour while he talks: the militia, the winter of the three-headed lamb, a girl in Lebel he should have married. Nobody has listened to him in years. You can tell.');
      c.say('doss', 'At the end he goes quiet. "The chapel bell rang one other time I know of. War\'s end. My company was camped at Greymarch. Next night..." He stops. "Never mind next night. You were kind to listen. Here." He presses a stoppered bottle into your hand.');
      c.give('potion_healing'); c.npc('doss').disposition += 3; c.xp(25);
    } },
  ],
  unknown: ['"Eh? Aye, aye."', '"Speak UP."'],
  speech: (c, act) => { if (act !== 'none') { c.say('doss', '"Eh? Lovely weather, aye." He heard none of it. Perhaps that\'s best.'); return true; } return false; },
};

// ---------- Alistair ----------
const alistair: Npc = {
  id: 'alistair', name: 'Alistair', names: ['alistair', 'lich', 'skeleton', 'bro', 'brother', 'skelly', 'al'],
  short: 'a lich with the manners of a man who never left the party',
  look: () => 'A skeleton in the rags of very expensive clothes, a faint cold light in his eye sockets, and the posture of a man leaning on a bar that isn\'t there. His skull has an amused tilt to it.',
  greet: (c) => {
    if (!c.flag('alistair_met')) {
      c.set('alistair_met');
      c.say('alistair', 'The skeleton on the sarcophagus sits bolt upright. "Oh! OH! Company!" He swings his legs down. "Brother! Sister! Whoever! Do you know how long I\'ve been down here? Neither do I! That\'s the problem!"');
      c.say('alistair', '"Alistair." He offers a hand of bare bone for a fist bump. "Court mage. Party enthusiast. Sealed in a crypt for, what, a century? Two? Getting ghosted by literally everyone I knew. You\'re not here to kill me, right? Because that would be SUCH a vibe-killer."');
      return;
    }
    c.say('alistair', pick(c.rng, ['"Brother! What are we doing? Tell me it\'s fun."', '"Still here. Still dead. Still delightful."', '"You know what this needs? Music. Everything needs music."']));
  },
  topics: [
    { id: 'join', keys: ['join', 'come with', 'come along', 'with me', 'travel', 'party', 'adventure', 'follow', 'team', 'help me', 'tag along'], chip: 'Invite Alistair along', say: (c) => {
      if (c.hasCompanion('alistair')) { c.say('alistair', '"Brother, I\'m already here. Spiritually AND physically. Mostly physically."'); return; }
      c.addCompanion('alistair'); c.set('alistair_joined');
      c.say('alistair', '"Out? Of the crypt? With people?" He presses a bony hand to where his heart isn\'t. "Brother. Yes. A thousand times yes. Let\'s go make some terrible decisions."');
      c.good('Alistair joins you. (Companion lich: AC 13, 27 HP, Chill Touch +5 for 1d10 necrotic. Once a day he can pour an ally "One More Round" to heal them.)');
      c.journal('Alistair, a lich from the old court, has joined you. He says the loremasters sealed him under the chapel. He doesn\'t remember why.');
      c.xp(50);
    } },
    { id: 'who', keys: ['who', 'you', 'yourself', 'lich', 'name', 'how', 'why', 'dead', 'undead'], say: (c) => c.say('alistair', '"Court mage. Back when there was a court here worth the name. The parties, brother. The PARTIES. I didn\'t want them to end, so I made sure I wouldn\'t." He shrugs. "Lichdom. Very exclusive. Would not recommend. Ten out of ten."') },
    { id: 'vess', keys: ['queen', 'pale queen', 'vessariel', 'vess', 'her majesty', 'her'], say: (c) => c.say('alistair', '"Vess? Terrifying. Great dancer. Wait—" He stops. "Why do I know that? Why do you ask? That whole decade is just... gone, brother. Like someone cut it out with scissors."') },
    { id: 'sealed', keys: ['sealed', 'crypt', 'chapel', 'here', 'loremasters', 'trapped', 'prison'], say: (c) => c.say('alistair', '"The loremasters. Stuffy types. Robes. Couldn\'t un-lich me, so they parked me under a chapel and said \'stay.\' Like a DOG. No offence, Kettle." Kettle, if present, is not offended.') },
    { id: 'goblet', keys: ['goblet', 'phylactery', 'soul', 'cup', 'tether'], say: (c) => c.say('alistair', '"Location: not on me, brother." He taps his skull. "And that\'s all anybody gets. Not because I don\'t trust you. Because I don\'t trust ME. Have you met me?"') },
    { id: 'merah', keys: ['merah', 'cultist', 'boss', 'bell ringer', 'woman', 'tower'], say: (c) => c.say('alistair', '"My former boss! She woke me up, months ago. Told me to guard the stairs. Didn\'t pay. Didn\'t even bring snacks." He waves a hand. "Worst. Boss. Ever."') },
    { id: 'amulet', keys: ['amulet', 'bone amulet', 'sigil', 'skull'], when: (c) => hasItem(c.pc, 'bone_amulet'), say: (c) => c.say('alistair', 'He leans in close, then back. "That\'s got Vess\'s sigil on it. The crowned skull. Somebody\'s been making new ones." His jaw clicks. "That\'s not great, brother."') },
    { id: 'bell', keys: ['bell', 'ringing', 'midnight'], say: (c) => c.say('alistair', '"The bell? It used to ring on holy days. In a pattern. Merah rings it at midnight, every night, all wrong. Gives me a headache. And I don\'t have a head. Well. I have the outside of one."') },
    { id: 'party', keys: ['parties', 'fun', 'drink', 'drinks', 'music', 'dance'], say: (c) => c.say('alistair', '"We had a party once that went for nine days. On the sixth day the Queen\'s horse gave a speech. A good speech, brother!"') },
  ],
  unknown: ['"No idea, brother. But I love that you asked."', '"That\'s above my pay grade. I don\'t get paid. I\'m dead."', 'He thinks about it so hard his jaw clicks. "Gone. That one\'s gone."'],
  speech: (c, act) => {
    if (act === 'insult') { c.say('alistair', '"Language! HA!" He slaps his own femur. "Brother, I have been called worse by better. I love it. Say it again, but louder, for the people in the back."'); c.npc('alistair').disposition += 1; return true; }
    if (act === 'exclamation' || act === 'emphatic' || act === 'cheer') { c.say('alistair', '"THAT\'S what I\'m talking about!"'); return true; }
    if (act === 'threat') { c.say('alistair', '"Ooh. Spicy. I\'m already dead, brother, but I respect the energy."'); return true; }
    return false;
  },
  emote: (c, act) => {
    if (['high five', 'fist bump', 'handshake', 'toast', 'dance', 'cheer'].includes(act)) {
      c.narr(act === 'high five' ? 'Your palm meets bone with a CLACK that echoes off the walls. Alistair whoops.' : act === 'fist bump' ? 'Knuckle meets knuckle-bone. "Bone-bump," Alistair says. "Coined it. Just now. Mine."' : act === 'toast' ? 'Alistair raises a drink he doesn\'t have and pours it through his ribcage. "It\'s about the gesture."' : 'Alistair joins in with alarming enthusiasm.');
      c.npc('alistair').disposition += 1;
      if (!c.hasCompanion('alistair') && c.npc('alistair').disposition >= 1) c.say('alistair', '"Okay, I like you. Can I come with? Say yes. Say \'join me.\'"');
      return true;
    }
    return false;
  },
  give: (c, itemId) => {
    if (['black_label', 'trenchfire', 'ale'].includes(itemId) || ITEMS[itemId]?.kind === 'food') { c.narr('Alistair pours it straight through his ribcage onto the floor. "It\'s about the gesture, brother." He looks genuinely moved.'); c.npc('alistair').disposition += 2; return true; }
    return false;
  },
  onAttack: (c) => { c.fight('alistair_fight'); },
};

// ---------- Merah ----------
const merah: Npc = {
  id: 'merah', name: 'Merah', names: ['merah', 'woman', 'cultist', 'bell ringer', 'ringer'],
  short: 'the gaunt woman who rings the bell',
  look: () => 'A gaunt woman in grey with rope-burned palms. She looks like she hasn\'t slept in weeks, and she looks happy.',
  greet: (c) => c.say('merah', '"You came up the stairs." She smiles, kind and terrible. "Everyone comes eventually. She\'s so patient. Would you like to hear what the bell is for?"'),
  topics: [
    { id: 'bell', keys: ['bell', 'why', 'ring', 'ringing', 'for'], chip: 'Ask what the bell is for', say: (c) => c.say('merah', '"To wake Her Majesty gently. You can\'t wake a queen all at once. That would be rude. Every night a little more. Every night she remembers a little more of us."') },
    { id: 'queen', keys: ['queen', 'her', 'majesty', 'pale', 'who'], say: (c) => c.say('merah', '"The treaty peace made everyone forget her. Fifteen years of forgetting. But bells remember. Bones remember." She touches her chest. "I remember. When the last seal thins, she won\'t need us to dig."') },
    { id: 'sent', keys: ['sent', 'orders', 'leader', 'who sent', 'boss', 'z'], say: (c) => c.say('merah', '"The letters come signed Z. That\'s all I know, and all I need to." She smiles. "Z says the dead are only sleeping. Z is right."') },
    { id: 'stop', keys: ['stop', 'quit', 'leave', 'surrender', 'give up', 'come quietly', 'yield'], say: (c) => {
      if (c.check('persuasion', 14)) {
        c.set('merah_talked_down');
        c.say('merah', 'Her hands fall from the rope. For a long moment she just looks at them. "I buried my son in the war," she says. "She showed him to me. In the dreams. He was smiling." She sits down on the stair. "I\'ll go. Don\'t ring it. Please don\'t ring it."');
        c.good('Merah gives up the bell without a fight.');
        c.xp(100);
        c.narr('Before she goes, she takes a bone amulet from around her neck, a crowned skull, and presses it into your hand. "Take it. I don\'t want to dream any more." Then she\'s gone down the stairs.');
        c.give('bone_amulet'); c.set('merah_gone'); c.talkTo(null);
      } else { c.say('merah', '"No," she says, almost apologetic, and lights a green candle. The wax on the floor begins to move.'); c.fight('tower'); }
    } },
  ],
  unknown: ['"She knows. Ask her yourself, soon."'],
  speech: (c, act) => {
    if (act === 'insult' || act === 'threat') { c.say('merah', 'She smiles sadly. "She forgives you too."'); return true; }
    return false;
  },
  onAttack: (c) => c.fight('tower'),
};

export const NPCS: Record<string, Npc> = Object.fromEntries([squib, dwarves, whisperers, sereza, garrick, smith, hetch, kettle, doss, alistair, merah].map((n) => [n.id, n]));

// Tavern menu items (consumed on purchase)
export const MENU: Record<string, { name: string; text: string; heal?: number }> = {
  ale: { name: 'Barrel Brown ale', text: 'Brown, cold enough, and honest.' },
  stew: { name: 'Bowl of the eternal stew', text: 'It\'s been going for years. It\'s fine. It\'s actually quite good.', heal: 1 },
  meat_pie: { name: 'Meat pie', text: 'Rabbit, allegedly. You decide not to investigate.', heal: 1 },
  roast_chicken: { name: 'Roast chicken and roots', text: 'The best meal you\'ve had in weeks.', heal: 2 },
  trenchfire: { name: 'Trenchfire (orcish rotgut)', text: 'It tastes like regret. The dwarves cheer as you cough.' },
  room_floor: { name: 'Floor by the hearth', text: 'Blanket included, dignity not.' },
  room_private: { name: 'Private room', text: 'A real bed and a door that locks.' },
};

export { fmtMoney, addItem, removeItem };
