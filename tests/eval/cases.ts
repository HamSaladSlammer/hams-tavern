// The game master's report card: ~300 things real players type, in real places, with what a good
// answer should touch on. Scored for echoes, generic replies and relevance.

export interface EvalCase {
  id: string;
  cat: 'lore' | 'small' | 'action' | 'statement' | 'followup' | 'scene' | 'quest' | 'opinion';
  where: string; // 'bells' (Breda tavern) or a town id (its inn)
  talk?: string; // who you're talking to first
  pre?: string[]; // earlier turns
  input: string;
  expect?: string[]; // any of these words should appear (not counting words already in the input)
}

// Entities people ask about, with words a knowledgeable answer would use.
const TOPICS: [string, string[]][] = [
  ['the Treaty Stone', ['grolgar', 'elisiah', 'border', 'signed', 'peace', 'offerings', 'makrovin']],
  ['Greymarch Field', ['battle', 'war', 'grave', 'dead', 'coltale', 'mow', 'bell']],
  ['Coltale', ['garrison', 'cemetery', 'memorial', 'aimo', 'harbour', 'bridge', 'fish', 'veterans']],
  ['Borschardt', ['banks', 'guild', 'counting', 'money', 'river', 'city', 'barge']],
  ['Largo', ['port', 'smuggl', 'river', 'fish', 'harbour', 'crates']],
  ['Suomi', ['capital', 'queen', 'elisiah', 'spires', 'fencing', 'palace']],
  ['Tokarev', ['forge', 'works', 'cartridge', 'rifle', 'steel', 'silver', 'arms']],
  ['Brumandell', ['walled', 'town', 'grog', 'statue', 'thimbleton', 'apples', 'market', 'chowder']],
  ['Herstal', ['snow', 'pass', 'glacier', 'peaks', 'north']],
  ['Tantal', ['mine', 'miners', 'shaft', 'hills', 'workshop']],
  ['Galilin', ['ford', 'market', 'caravan', 'crossing', 'rumour', 'river']],
  ['Shpagin', ['stilt', 'mire', 'eel', 'barge', 'swamp']],
  ['Madsen', ['fishing', 'coast', 'nets', 'mire', 'sea', 'harbour']],
  ['Nagant', ['cliff', 'lighthouse', 'hermit', 'coast', 'light']],
  ['Radom', ['border', 'checkpoint', 'orc', 'watch', 'treaty', 'west']],
  ['Samopal', ['crossroads', 'inn', 'toll', 'royal road', 'stables', 'waystation']],
  ['Maxim', ['farm', 'levee', 'marsh', 'ditch', 'drained']],
  ['Carcano', ['quarry', 'stone', 'chapel', 'mason', 'south']],
  ['Lebel', ['shepherd', 'hills', 'sheep', 'doss', 'west']],
  ['the Southern Mire', ['swamp', 'rivers', 'water', 'shpagin', 'never fills', 'drown']],
  ['the Northern Peaks', ['snow', 'mountain', 'herstal', 'goliath', 'hermit', 'wyrm']],
  ['the Aimo', ['river', 'coltale', 'bridge', 'ferry', 'barge']],
  ['Bellwax', ['candle', 'dream', 'dead', 'green', 'wax', 'grief']],
  ['hushmilk', ['lily', 'pain', 'veteran', 'war', 'syrup', 'healer']],
  ['frostpetal', ['flower', 'suomi', 'salon', 'powder', 'spoon', 'court']],
  ['the green candles', ['cult', 'bellwax', 'queen', 'memorial', 'dead']],
  ['the Silver Watch', ['knights', 'queen', 'honour guard', 'elves', 'suomi', 'gun']],
  ['the old chapel', ['bell', 'midnight', 'foothills', 'north', 'squib', 'merah']],
  ['the war', ['treaty', 'orcs', 'elves', 'fifteen', 'greymarch', 'makrovin']],
  ['Queen Elisiah', ['suomi', 'elves', 'treaty', 'throne', 'queen', 'rules']],
  ['Grolgar', ['orc', 'king', 'makrovin', 'treaty']],
  ['Makrovin', ['orc', 'west', 'grolgar', 'kingdom', 'border']],
  ['the Weeping Glacier', ['herstal', 'ice', 'soldiers', 'melting', 'frozen']],
  ['the Sunken Ferry', ['refugees', 'aimo', 'river', 'lantern', 'war', 'sank']],
  ['the Erased Face', ['cliff', 'coast', 'profile', 'face', 'chisel', 'sailors']],
  ['the Drowned Shrine', ['mire', 'grate', 'candles', 'shpagin', 'water']],
  ['the Greenspire', ['tower', 'lake', 'island', 'green', 'archive', 'stillmere']],
  ['Zenu', ['cult', 'tower', 'letters', 'z', 'greenspire', 'necromancer']],
  ['Squib', ['half-orc', 'tavern', 'barrel', 'medic', 'stretcher', 'war']],
  ['the barrel above the hearth', ['scorched', 'squib', 'war', 'greymarch', "don't ask"]],
  ['Doss', ['shepherd', 'deaf', 'foothills', 'sheep', 'ewes']],
  ['Hetch', ['cat', 'tailor', 'talking']],
  ['Grog', ['brumandell', 'chowder', 'tavern', 'alehouse']],
  ['Lord Thimbleton', ['brumandell', 'lord', 'manor']],
  ['the loremasters', ['rite', 'forget', 'court', 'mages', 'queen']],
  ['the old faith', ['keeper', 'hearth', 'chapel', 'priest', 'gods', 'road']],
  ['the Bright Hearth', ['home', 'hearth', 'light', 'god', 'safe']],
  ['the Velvet Lantern', ['breda', 'discreet', 'house', 'informed']],
  ['the Thornwood', ['forest', 'charms', 'wolves', 'oak', 'north']],
  ['Kessel\'s Rest', ['wayshrine', 'fork', 'pilgrim', 'font', 'dome']],
  ['Fenwick Tealeaf', ['halfling', 'merchant', 'cart', 'gossip', 'rastbrook']],
  ['the dwarves', ['road', 'crew', 'east road', 'borin', 'arm']],
  ['Sereza', ['tiefling', 'stories', 'dead', 'pays', 'city coin']],
  ['firearms', ['rifle', 'revolver', 'cartridge', 'war', 'tokarev', 'jam', 'pistol']],
  ['silver weapons', ['undead', 'silvered', 'tokarev', 'dead', 'steel']],
];

const ASKERS: { where: string; talk: string }[] = [
  { where: 'bells', talk: 'squib' },
  { where: 'brumandell', talk: 'grog' },
  { where: 'coltale', talk: 'innkeeper' },
  { where: 'suomi', talk: 'innkeeper' },
  { where: 'largo', talk: 'innkeeper' },
  { where: 'galilin', talk: 'innkeeper' },
];
const PHRASE = ['what do you know about {x}?', 'tell me about {x}', 'have you heard of {x}?'];

const cases: EvalCase[] = [];
TOPICS.forEach(([x, expect], i) => {
  for (let k = 0; k < 2; k++) {
    const a = ASKERS[(i * 2 + k) % ASKERS.length];
    cases.push({ id: `lore-${i}-${k}`, cat: 'lore', where: a.where, talk: a.talk, input: PHRASE[(i + k) % PHRASE.length].replace('{x}', x), expect });
  }
});
// asked as who/where questions
const WHO = new Set(['Zenu', 'Squib', 'Doss', 'Hetch', 'Grog', 'Lord Thimbleton', 'Queen Elisiah', 'Grolgar', 'Sereza', 'Fenwick Tealeaf', 'the loremasters', 'the dwarves', 'the Silver Watch']);
TOPICS.forEach(([x, expect], i) => {
  const a = ASKERS[(i + 3) % ASKERS.length];
  const q = WHO.has(x) ? `who is ${x}?` : /^(Bellwax|hushmilk|frostpetal|firearms|silver weapons|the war|the old faith|the green candles|the Bright Hearth)$/.test(x) ? `what is ${x}?` : `where is ${x}?`;
  cases.push({ id: `lore-w-${i}`, cat: 'lore', where: a.where, talk: a.talk, input: q, expect: WHO.has(x) || !q.startsWith('where') ? expect : [...expect, 'day', 'north', 'south', 'east', 'west', 'road', 'near', 'past', 'beyond', 'above', 'below'] });
});
// asked without naming who you're talking to
TOPICS.slice(0, 20).forEach(([x, expect], i) => cases.push({ id: `lore-q-${i}`, cat: 'lore', where: ASKERS[i % ASKERS.length].where, input: `What's the story with ${x}?`, expect }));

// follow-ups: pronouns and "tell me more"
const FOLLOW: [string, string, string[]][] = [
  ['tell me about Coltale', 'what else?', ['garrison', 'cemetery', 'memorial', 'aimo', 'bridge', 'fish', 'veterans', 'harbour']],
  ['who is Zenu?', 'where is he?', ['tower', 'greenspire', 'lake', 'west', 'stillmere']],
  ['tell me about the Treaty Stone', 'where is it?', ['border', 'west', 'makrovin', 'radom', 'samopal']],
  ['what do you know about Bellwax?', 'who sells it?', ['peddler', 'cult', 'candle', 'largo', 'goblin', 'memorial']],
  ['tell me about Queen Elisiah', 'what is she like?', ['precise', 'hurr', 'treaty', 'old', 'rules', 'quiet', 'suomi']],
  ['what do you know about Greymarch Field?', 'what happened there?', ['bell', 'battle', 'dead', 'thousands', 'night', 'wrong']],
  ['tell me about Tokarev', 'tell me more', ['forge', 'cartridge', 'works', 'silver', 'steel', 'arms', 'city']],
  ['have you heard of Lord Thimbleton?', 'is he a good lord?', ['brumandell', 'manor', 'lord', 'watch', 'fair', 'strict', 'gold']],
  ['what do you know about the Southern Mire?', 'why does it never fill?', ['water', 'drink', 'nobody', 'down', 'cult', 'rivers', 'know']],
  ['tell me about Suomi', 'how do I get there?', ['day', 'road', 'west', 'royal']],
];
FOLLOW.forEach(([a, b, expect], i) => cases.push({ id: `follow-${i}`, cat: 'followup', where: ASKERS[i % ASKERS.length].where, talk: ASKERS[i % ASKERS.length].talk, pre: [a], input: b, expect }));

// small talk, statements, opinions, quests
const SMALL = ['how are you?', 'what is your name?', 'where are you from?', 'any news?', 'what is there to do around here?', 'nice place you have', 'can I get a room?', 'what do you recommend to drink?', 'is it safe on the roads?', 'what should I be careful of?', 'who runs this town?', 'who is the most interesting person here?', 'where can I find work?', 'do you have any family?', 'how long have you lived here?', 'what do people do for fun here?', 'what was the war like?', 'are you afraid of the dead?', 'what\'s the weather like?', 'thanks for your help'];
SMALL.forEach((t, i) => cases.push({ id: `small-${i}`, cat: 'small', where: ASKERS[i % ASKERS.length].where, talk: ASKERS[i % ASKERS.length].talk, input: t }));
const STATE = ['I\'m a soldier from Tokarev', 'my name is Vera', 'I fought at Greymarch', 'I killed a wolf on the road', 'I\'m looking for the Pale Queen', 'I\'m new in town', 'I lost my brother in the war', 'I don\'t trust the crown', 'I think the cult is behind the bells', 'I\'m going to Suomi tomorrow'];
STATE.forEach((t, i) => cases.push({ id: `state-${i}`, cat: 'statement', where: ASKERS[i % ASKERS.length].where, talk: ASKERS[i % ASKERS.length].talk, input: t }));
const OPIN = ['what do you think of the queen?', 'what do you think of orcs?', 'what do you think about the cult?', 'what do you think of Borschardt?', 'what do you think about firearms?', 'what do you think of the dead walking?', 'do you like elves?', 'what do you think of the treaty?', 'what do you think of Suomi?', 'what do you think of Zenu?'];
OPIN.forEach((t, i) => cases.push({ id: `opinion-${i}`, cat: 'opinion', where: ASKERS[i % ASKERS.length].where, talk: ASKERS[i % ASKERS.length].talk, input: t }));
const QUEST = ['is there any work for me?', 'who is ringing the bell?', 'what is the notice board for?', 'how do I get to the old chapel?', 'is anyone hiring guards?', 'where would bandits hide around here?', 'who would pay for a dead wolf?', 'have you seen anything strange lately?', 'what is the cult after?', 'who should I talk to about the dead?'];
QUEST.forEach((t, i) => cases.push({ id: `quest-${i}`, cat: 'quest', where: ASKERS[i % ASKERS.length].where, talk: ASKERS[i % ASKERS.length].talk, input: t }));

// actions and scene questions (no conversation)
const ACT = ['I look around the room', 'I sit at the bar and order a drink', 'I listen to the conversations around me', 'I check the exits', 'I warm my hands by the fire', 'I study the people at the bar', 'I lean against the wall and watch', 'I count my money', 'I sharpen my blade', 'I search the room for anything unusual', 'I examine the hearth', 'I step outside for some air', 'I tell the room a story about the war', 'I buy a round for everyone', 'I ask the room if anyone has seen the dead walking', 'I write in my journal', 'I pray to the old gods', 'I hum a tune', 'I check my gear', 'I try to pick a pocket', 'I smell the air', 'I look out the window', 'I eavesdrop on the table by the window', 'I flip a coin', 'I stretch and yawn', 'I wipe down the table', 'I challenge someone to arm wrestle', 'I keep an eye on the door', 'I sit in the corner and brood', 'I ask for the house special'];
ACT.push('I ask the barmaid what she has heard', 'I sit down with the strangers by the fire', 'I watch the card game', 'I look for someone who looks like trouble', 'I ask around about the bells', 'I tip the innkeeper', 'I wave at the nearest table', 'I check the notice board', 'I rest my feet', 'I order food', 'I ask who owns this place', 'I spit on the floor', 'I stand on a table', 'I ask if anyone wants to hire a sword', 'I sing a sad song');
ACT.forEach((t, i) => cases.push({ id: `act-${i}`, cat: 'action', where: ['bells', 'brumandell', 'coltale', 'suomi', 'largo'][i % 5], input: t }));
const SCENE = ['look', 'what does this place look like?', 'who is here?', 'describe the room', 'what can I hear?', 'what can I smell?', 'is it busy?', 'what time is it?', 'what\'s the weather like outside?', 'where am I?'];
SCENE.forEach((t, i) => cases.push({ id: `scene-${i}`, cat: 'scene', where: ['bells', 'brumandell', 'coltale', 'suomi', 'largo'][i % 5], input: t }));

export const CASES = cases;
