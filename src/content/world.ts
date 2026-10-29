// Act One: Breda, the Thornwood March, and the Old Chapel Bell.
import type { Ctx, EncounterDef, Room, TravelTable } from './types';
import { hasItem } from '../engine/character';
import { pick, die } from '../engine/dice';
import { maybeLevel } from './npcs';

const closedGate = (where: string) => (c: Ctx) => `The guard at the ${where} gate shakes her head. "Road's shut past the ford till the patrol's back. North's where the trouble is anyway." (This road opens in a later version.)`;

export const ROOMS: Record<string, Room> = {
  breda_square: {
    id: 'breda_square', name: 'Breda — Market Square', region: 'Breda', outdoors: true,
    desc: (c) => {
      const t = c.timeOfDay();
      const crowd = t === 'night' || t === 'midnight' ? 'The square is empty except for a guard yawning by the well.' : 'Farmers sell eggs and gossip in equal measure around the well.';
      return `Cobbles, a stone well, and the low palisade of a village that grew up fast after the war. ${crowd} The Smoking Barrel squats in the dead centre of everything, a notice board nailed beside its door. Around the square: Garrick's General Goods, the blacksmith's, and a tailor's shop with a cat painted on the sign. Gates lead north, west, east and south.`;
    },
    exits: [
      { to: 'tavern', names: ['tavern', 'smoking barrel', 'barrel', 'inn', 'pub', 'bar', 'in', 'inside'], label: 'Smoking Barrel', minutes: 1 },
      { to: 'goods', names: ['general goods', 'goods', 'garrick', 'store', 'shop', 'general store', 'garricks'], label: 'General Goods', minutes: 2 },
      { to: 'smithy', names: ['blacksmith', 'smith', 'smithy', 'forge', 'dreyse'], label: 'Blacksmith', minutes: 2 },
      { to: 'tailor', names: ['tailor', 'hetch', 'cat', 'tailors', 'clothes'], label: 'Tailor', minutes: 2 },
      { to: 'thornwood', names: ['north', 'north gate', 'thornwood', 'chapel', 'foothills', 'north road', 'old chapel'], label: 'North gate → Thornwood', minutes: 180, travel: 'thornwood' },
      { to: 'breda_square', names: ['west', 'west gate', 'suomi', 'royal road', 'makrovin'], label: 'West gate', minutes: 0, blocked: closedGate('west') },
      { to: 'breda_square', names: ['east', 'east gate', 'galilin'], label: 'East gate', minutes: 0, blocked: closedGate('east') },
      { to: 'breda_square', names: ['south', 'south gate', 'rastbrook', 'mire', 'wetlands', 'south road'], label: 'South gate', minutes: 0, blocked: closedGate('south') },
    ],
    features: [
      { id: 'board', names: ['notice board', 'board', 'notices', 'quests', 'postings', 'notice'], look: () => 'NOTICES & HONEST WORK — postings vetted by Squib · no bounty paid without proof', read: (c) => {
        c.narr('NOTICES & HONEST WORK — Breda market square. Postings vetted by Squib. No bounty paid without proof.');
        c.narr('① MISSING: Aldwin Thatch. 25 gold. — Merla Thatch, the east farms. [Someone has written FOUND underneath. Then, smaller: "but not right."]');
        c.narr('② Wolves on the South Road. 1 gold per pelt, fresh only. — Hetch, tailor.');
        c.narr('③ Guards wanted: cart to Rastbrook. 5 gold each, paid on arrival. Conversation guaranteed. — Master Fenwick Tealeaf. [Leaves next week.]');
        c.narr('④ THE OLD CHAPEL BELL. 50 gold to whoever stops it ringing. Bring a rope. Bring sense. — Squib.');
        if (!c.flag('quest_chapel')) { c.set('quest_chapel'); c.journal('The Old Chapel Bell: the abandoned chapel in the northern foothills rings at midnight. Squib pays 50 gp to silence it. North gate, through the Thornwood, then the chapel path at Kessel\'s Rest.'); c.good('Quest noted: The Old Chapel Bell. Ask Squib about it.'); }
        if (!c.flag('quest_pelts')) { c.set('quest_pelts'); c.journal('Hetch the tailor pays 1 gp per fresh wolf pelt.'); }
      }, search: (c) => ROOMS.breda_square.features![0].read!(c) },
      { id: 'well', names: ['well', 'water'], look: () => 'An old stone well. Someone has scratched a tally of days into the rim, and stopped about fifteen years ago.' },
      { id: 'guard', names: ['guard', 'guards', 'militia', 'watch'], look: () => 'Breda keeps about a dozen militia. The ones on the north gate look like they haven\'t slept.' },
    ],
    onEnter: (c) => {
      if (c.hasCompanion('alistair') && !c.flag('breda_saw_alistair')) {
        c.set('breda_saw_alistair');
        c.narr('A farmer drops a basket of eggs. A child points. Alistair waves at everyone. "Morning! Lovely village! Very alive!" People stare, then, slowly, go back to their business. A skeleton that waves is apparently not the strangest thing Breda has seen since the war.');
      }
      if (c.flag('chapel_done') && !c.flag('chapel_paid')) c.sys('Squib will want to hear about the chapel.');
    },
    chips: (c) => ['read notice board', 'go to the Smoking Barrel'],
  },

  tavern: {
    id: 'tavern', name: 'The Smoking Barrel', region: 'Breda', rest: 'long', shop: 'squib',
    desc: (c) => {
      let s = 'Woodsmoke, pipe smoke, and the char of something roasting. One big room around a stone hearth, long tables worn smooth by decades of elbows. Above the hearth hangs an actual barrel, scorched black. Squib works the bar. Dwarves hammer mugs in one corner; by the window, two elves and two goblins keep their voices down.';
      if (c.hour() >= 12 || c.flag('sereza_met')) s += ' A tiefling woman sits alone where she can see the door.';
      if (c.hasCompanion('alistair') && !c.flag('squib_ok_alistair')) s += ' (Alistair is waiting outside. Squib hasn\'t let him in yet.)';
      return s;
    },
    exits: [{ to: 'breda_square', names: ['out', 'outside', 'square', 'leave', 'exit', 'door', 'street'], label: 'Out to the square', minutes: 1 }],
    npcs: (c) => {
      const n = ['squib', 'dwarves', 'whisperers'];
      if (c.hour() >= 12 || c.flag('sereza_met')) n.push('sereza');
      return n;
    },
    features: [
      { id: 'barrel', names: ['barrel', 'scorched barrel', 'black barrel', 'hearth barrel'], look: (c) => c.flag('barrel_hint') ? 'The scorched barrel above the hearth. Now that you know to look, the char marks form a pattern, like someone wrote on it with fire.' : 'A barrel, scorched black, mounted above the hearth like a trophy. Nobody you\'ve asked has heard Squib explain it.', search: (c) => { if (c.check('religion', 15)) c.narr('Burned into the staves, almost lost under the soot: the same crowned-sun sigil as the old faith. A ward. Someone made this barrel a seal.'); else c.narr('Just charred wood. Squib is watching you.'); } },
      { id: 'hearth', names: ['hearth', 'fire', 'fireplace'], look: () => 'A big stone hearth. The fire never quite goes out. You suspect that\'s deliberate.' },
      { id: 'menu', names: ['menu', 'chalkboard', 'prices'], look: () => '"Breda · The Market Square · Est. after the war. Drink, board & bed — mind the barrel, don\'t ask about the barrel." (Say "shop" to order.)' },
      { id: 'rules', names: ['rules', 'house rules', 'sign'], look: () => 'HOUSE RULES. No weapons drawn under this roof. No mocking the war dead — either side\'s. Bother my regulars and drink elsewhere. Forever. — Squib' },
    ],
    onEnter: (c) => {
      if (c.hasCompanion('alistair') && !c.flag('squib_ok_alistair') && !c.flag('squib_saw_alistair')) {
        c.set('squib_saw_alistair');
        c.narr('Alistair follows you in. The room goes silent. Squib sets down his mug.');
        c.say('squib', '"No." Just that. Then, softer: "Not until someone tells me whose he is." Alistair backs out the door, hands up. "Totally fair, big man. I\'ll be on the step."');
      }
    },
    chips: (c) => ['talk to Squib', 'shop', 'rent a room'],
  },

  goods: {
    id: 'goods', name: "Garrick's General Goods", region: 'Breda', shop: 'garrick',
    desc: () => 'Shelves of rope, lamp oil, torches, and anything else a traveller forgets. A thin tiefling hovers behind the counter like he\'s expecting to be robbed.',
    exits: [{ to: 'breda_square', names: ['out', 'outside', 'square', 'leave', 'exit', 'street'], label: 'Out to the square', minutes: 1 }],
    npcs: () => ['garrick'],
    features: [{ id: 'shelves', names: ['shelves', 'counter', 'goods'], look: () => 'Behind the counter, a locked drawer marked CURIOSITIES. Garrick moves to stand in front of it when you look.' }],
    chips: () => ['shop', 'talk to Garrick'],
  },

  smithy: {
    id: 'smithy', name: 'The Blacksmith', region: 'Breda', shop: 'smith',
    desc: () => 'Heat, noise, and the smell of quenched steel. Blades hang from hooks; a rack of war-surplus service revolvers sits behind the counter. Mother Dreyse hammers something and yells pleasantries.',
    exits: [{ to: 'breda_square', names: ['out', 'outside', 'square', 'leave', 'exit', 'street'], label: 'Out to the square', minutes: 1 }],
    npcs: () => ['smith'],
    chips: () => ['shop', 'talk to the smith'],
  },

  tailor: {
    id: 'tailor', name: "Hetch's Tailoring", region: 'Breda', shop: 'hetch',
    desc: () => 'Bolts of fine elven cloth, cold-weather wool for the northern passes, and pins everywhere. On the cutting table sits a grey cat in a waistcoat.',
    exits: [{ to: 'breda_square', names: ['out', 'outside', 'square', 'leave', 'exit', 'street'], label: 'Out to the square', minutes: 1 }],
    npcs: () => ['hetch'],
    chips: () => ['talk to Hetch', 'shop'],
  },

  thornwood: {
    id: 'thornwood', name: 'The Thornwood March', region: 'Northern foothills', outdoors: true, rest: 'short',
    desc: () => 'Three hours of old-growth forest on an old logging road. Carved wooden charms hang from the trees at the treeline, an old habit from the war years. Some are weathered grey. Some are new.',
    exits: [
      { to: 'breda_square', names: ['south', 'breda', 'back', 'village', 'home', 'town'], label: 'South to Breda', minutes: 180, travel: 'thornwood' },
      { to: 'kessels_rest', names: ['north', 'fork', 'kessels rest', "kessel's rest", 'shrine', 'onward', 'forward', 'chapel', 'foothills'], label: "North to Kessel's Rest", minutes: 30 },
    ],
    features: [
      { id: 'charms', names: ['charms', 'charm', 'carvings', 'trees', 'wooden charms'], look: () => 'Little carved discs and knots of wood, tied to branches with twine. Protective, the locals say, without being able to say against what.', search: (c) => {
        if (c.flag('saw_charms')) { c.narr('The new charms still have the crowned skull hidden in their pattern.'); return; }
        if (c.check('religion', 14)) { c.set('saw_charms'); c.narr('The old charms follow a pattern you half-recognise from chapel carvings: a binding, a seal. The newest ones are wrong. Twisted into their knots is a crowned skull. Someone is replacing the old charms, one tree at a time.'); c.xp(25); c.journal('Someone is replacing the Thornwood charms with ones hiding a crowned skull.'); }
        else c.narr('Pretty work. You don\'t see anything more in it.');
      } },
    ],
  },

  kessels_rest: {
    id: 'kessels_rest', name: "Kessel's Rest", region: 'Northern foothills', outdoors: true, rest: 'short',
    desc: (c) => `A ruined pilgrims' wayshrine at a fork in the trail: a mossy stone dome over a dry font, and a kneeling-bench worn smooth by a century of knees. The main trail runs on toward the shepherds' pastures. A narrower path climbs toward the chapel on its hilltop${c.flag('bell_silenced') ? '.' : ', and you can see the bell tower from here.'}`,
    exits: [
      { to: 'thornwood', names: ['south', 'back', 'thornwood', 'breda', 'woods', 'forest'], label: 'Back to the Thornwood', minutes: 30 },
      { to: 'chapel_yard', names: ['chapel', 'chapel path', 'up', 'hill', 'hilltop', 'old chapel', 'narrow path', 'left'], label: 'Chapel path', minutes: 60 },
      { to: 'foothills', names: ['main trail', 'pastures', 'doss', 'shepherd', 'foothills', 'hut', 'right', 'pasture'], label: 'Main trail → pastures', minutes: 60 },
    ],
    features: [
      { id: 'font', names: ['font', 'basin', 'dry font', 'inscription', 'base'], look: (c) => c.flag('robe_found') ? 'The dry font. Its base stone sits slightly askew now.' : 'A dry stone font. Around its base, worn letters: FOR THE ONE WHO COMES WHEN THE BELL RINGS WRONG.', read: (c) => { c.narr('"For the one who comes when the bell rings wrong."'); if (!c.flag('robe_found')) c.sys('The base stone looks like it could move.'); },
        search: (c) => {
          if (c.flag('robe_found')) { c.narr('Nothing else under the font.'); return; }
          if (c.check('investigation', 12)) { c.set('robe_found'); c.narr('The base stone lifts. Wrapped in oilcloth beneath it: a grey wool pilgrim\'s robe, a faded crowned-sun sigil on the breast. It is warm, as if someone took it off a minute ago.'); c.give('robe_of_protection'); c.xp(25); c.sys('Wear it with "wear robe". (+1 AC and +1 to saving throws.)'); }
          else c.narr('Old stone, moss, a dead beetle. Something about the base bothers you, though.');
        } },
      { id: 'bench', names: ['bench', 'kneeling bench', 'pew'], look: () => 'Worn into a gentle hollow by a century of pilgrims. Somebody prayed here a lot.' },
    ],
  },

  foothills: {
    id: 'foothills', name: "Doss's Pasture", region: 'Northern foothills', outdoors: true, rest: 'short',
    desc: (c) => `Sheep country gone quiet. Most of the shepherd families have left. A stone hut with a turf roof, a dog-less sheepfold, and forty ewes grazing as if nothing were wrong. ${c.flag('ewe_returned') ? 'Daisy grazes among them, facing the chapel.' : ''} An old man sits on the wall, whittling.`,
    exits: [{ to: 'kessels_rest', names: ['back', 'fork', 'kessels rest', "kessel's rest", 'shrine', 'south', 'trail'], label: "Back to Kessel's Rest", minutes: 60 }],
    npcs: () => ['doss'],
    onEnter: (c) => {
      if (c.flag('ewe_found') && !c.flag('ewe_returned')) {
        c.set('ewe_returned');
        c.narr('Daisy bolts from your side straight to the flock. Doss drops his knife and stands up so fast his knees crack.');
        c.say('doss', '"DAISY!" He holds her face in both hands. Then he sees the charm braided in her wool, and his face changes. "I didn\'t put that there." He cuts it out and throws it in the fire. "Here. You earned this. It was mine, in the militia."');
        c.give('potion_healing', 2); c.give('silvered_shortsword'); c.xp(75);
        c.good('Quest complete: Daisy the Ewe. Doss gives you 2 potions of healing and his silvered shortsword.');
      }
    },
    chips: (c) => c.flag('doss_heard') ? ['ask Doss about his sheep', 'listen to his stories'] : ['shout HELLO!'],
  },

  chapel_yard: {
    id: 'chapel_yard', name: 'The Old Chapel — Graveyard', region: 'The Old Chapel', outdoors: true,
    desc: (c) => {
      let s = 'The chapel stands alone on an exposed hilltop, visible for miles. A low graveyard wall, leaning headstones, and a porch with its doors hanging open. Above, the bell tower.';
      if (!c.flag('cleared_yard')) s += ' Several graves have been disturbed.';
      else s += ' Two graves gape open, dug from the inside.';
      if (!c.flag('ewe_found') && c.flag('cleared_yard')) s += ' A ewe is standing among the graves, perfectly still, facing the chapel door.';
      return s;
    },
    exits: [
      { to: 'nave', names: ['in', 'inside', 'chapel', 'porch', 'door', 'doors', 'nave', 'enter'], label: 'Into the chapel', minutes: 1 },
      { to: 'kessels_rest', names: ['down', 'back', 'path', 'fork', 'kessels rest', 'shrine', 'south'], label: "Down to Kessel's Rest", minutes: 60 },
    ],
    features: [
      { id: 'graves', names: ['graves', 'grave', 'dirt', 'headstones', 'headstone', 'graveyard'], look: (c) => c.flag('cleared_yard') ? 'The open graves were dug outward. Whoever was buried here left on their own.' : 'The dirt on several graves is mounded oddly.', search: (c) => { if (c.check('perception', 12)) c.narr('The dirt was pushed up from inside. Not dug. Pushed.'); else c.narr('Graves. Old ones.'); } },
      { id: 'ewe', names: ['ewe', 'sheep', 'daisy', 'lamb'], hidden: (c) => !c.flag('cleared_yard') || !!c.flag('ewe_found'), look: () => 'A ewe with a little crowned-skull charm braided into her wool. She doesn\'t move. She\'s listening to something you can\'t hear.', take: (c) => { c.set('ewe_found'); c.narr('You take the ewe by the scruff. She blinks, shakes herself, and bleats as if waking up. She\'ll follow you now.'); if (!c.flag('quest_ewe')) c.sys('Someone in the pastures must be missing a sheep.'); } },
      { id: 'tower', names: ['tower', 'bell tower', 'bell', 'belfry'], look: (c) => c.flag('bell_silenced') ? 'The bell hangs still.' : 'A squat tower with a bronze bell. A rope runs down inside.' },
    ],
    onEnter: (c) => {
      if (!c.flag('cleared_yard')) {
        if (c.check('perception', 12, { quiet: false })) { c.narr('You notice it before you\'re ten steps in: the dirt on two graves is pushed up from inside. Then it moves.'); c.set('yard_warned'); }
        c.fight('yard');
      }
    },
    chips: (c) => c.flag('cleared_yard') && !c.flag('ewe_found') ? ['take the ewe', 'go into the chapel'] : ['go into the chapel'],
  },

  nave: {
    id: 'nave', name: 'The Old Chapel — Nave', region: 'The Old Chapel',
    desc: (c) => {
      let s = 'Rows of rotten pews face a stone altar. The aisle has been swept clean, not by a broom, but by feet dragging back and forth for weeks. ';
      s += 'The altar\'s holy sigils have been scraped off and re-carved: a crowned skull wreathed in thorns, dribbled with black wax. One candle is still warm. ';
      s += 'Doors lead to a vestry on the left and a bell tower on the right.';
      if (c.flag('stairs_open')) s += ' Behind the altar, a stair descends into the dark.';
      return s;
    },
    exits: [
      { to: 'chapel_yard', names: ['out', 'outside', 'yard', 'graveyard', 'porch', 'leave', 'exit'], label: 'Out to the graveyard', minutes: 1 },
      { to: 'vestry', names: ['vestry', 'left', 'left door', 'priest', "priest's room"], label: 'Vestry', minutes: 1, blocked: (c) => c.flag('vestry_open') ? null : 'The vestry door is locked. (Try "pick the lock", "force the door", or "kick the door".)' },
      { to: 'tower', names: ['tower', 'bell tower', 'right', 'right door', 'stairs up', 'up', 'belfry'], label: 'Bell tower', minutes: 2, blocked: (c) => c.flag('tower_open') ? null : 'The tower door is barred from the other side. Old wood, though. (Try kicking it.)' },
      { to: 'crypt', names: ['down', 'stairs', 'stair', 'crypt', 'below', 'downstairs', 'hidden stairs'], label: 'Down to the crypt', minutes: 2, hidden: (c) => !c.flag('stairs_open') },
    ],
    features: [
      { id: 'altar', names: ['altar', 'lever', 'iron lever', 'seam', 'slab', 'sigil', 'skull', 'carving', 'crowned skull'], look: () => 'The old sigils have been scraped away and replaced with a crowned skull wreathed in thorns. Black wax drips down the front.', search: (c) => {
        if (c.flag('stairs_open')) { c.narr('The lever is pulled. The stair is open.'); return; }
        const adv = hasItem(c.pc, 'crowbar');
        const tries = ((c.flag('altar_tries') as number) || 0) + 1; c.set('altar_tries', tries);
        if (tries >= 3 && !c.check('investigation', 13, { adv, quiet: true })) { c.set('lever_found'); c.advance(30); c.narr('It takes the better part of half an hour, following the draught with a wet finger, but you find it: a seam in the stone, and a small iron lever set flush with it. Tucked beside it, a journal bound in black wax.'); c.give('cultist_journal'); c.sys('Pull the lever?'); return; }
        if (tries >= 3) { c.set('lever_found'); c.narr('Following the draught, you find a seam, then a small iron lever set flush with the stone. Tucked beside it: a journal bound in black wax.'); c.give('cultist_journal'); c.sys('Pull the lever?'); return; }
        if (c.check('investigation', 13, { adv })) { c.set('lever_found'); c.narr('Running your hands along the altar, you find a seam, then a small iron lever set flush with the stone. Tucked beside it: a journal bound in black wax.'); c.give('cultist_journal'); c.sys('Pull the lever?'); }
        else c.narr('Solid stone. But there\'s a draught coming from somewhere near the altar.');
      }, pull: (c) => {
        if (!c.flag('lever_found')) { c.narr('You don\'t see anything to pull. Yet.'); return; }
        if (c.flag('stairs_open')) { c.narr('Already open.'); return; }
        c.set('stairs_open'); c.narr('The lever grinds. Behind the altar, a slab sinks into the floor, revealing a stair that breathes cold air. Somewhere below, very faintly, someone is humming.'); c.xp(25);
      }, open: (c) => ROOMS.nave.features![0].search!(c) },
      { id: 'religion', names: ['sigils', 'old sigils', 'scraped'], look: (c) => { if (c.check('religion', 13)) return 'Underneath the scraping you can still make out an older sigil: a crowned queen. It was erased long before the cultists came. Someone wanted her forgotten. Someone else wants her back.'; return 'Scraped stone. Something used to be carved here.'; } },
      { id: 'pews', names: ['pews', 'pew', 'benches'], look: (c) => c.flag('cleared_nave') ? 'Rotten pews and scattered bones.' : 'Rotten pews. Past the second row, the shadows look wrong.' },
      { id: 'vestry_door', names: ['vestry door', 'left door', 'vestry'], look: (c) => c.flag('vestry_open') ? 'Open.' : 'A stout oak door, locked.', open: (c, method) => {
        if (c.flag('vestry_open')) { c.narr('It\'s already open.'); return; }
        let ok = false;
        if (method === 'pick') { if (!hasItem(c.pc, 'thieves_tools')) { c.narr('You need thieves\' tools to pick it.'); return; } ok = c.toolCheck(12); }
        else if (method === 'kick' || method === 'force') ok = c.check('athletics', 15, { adv: hasItem(c.pc, 'crowbar') });
        else { c.narr('Locked. Pick it, force it, or kick it.'); return; }
        if (ok) { c.set('vestry_open'); c.narr(method === 'pick' ? 'The lock gives with a click.' : 'The door bursts inward in a spray of rotten splinters.'); }
        else c.narr(method === 'pick' ? 'The lock is old and stubborn. You can try again.' : 'The door shudders but holds. Your shoulder disagrees with this plan.');
        c.advance(5);
      } },
      { id: 'tower_door', names: ['tower door', 'right door', 'tower', 'door'], look: (c) => c.flag('tower_open') ? 'Hanging off one hinge.' : 'Barred from the other side. The wood is old.', open: (c, method) => {
        if (c.flag('tower_open')) { c.narr('It\'s already open.'); return; }
        if (method === 'normal' || method === 'pick') { c.narr('It\'s barred from the inside. No lock to pick. It\'ll have to be forced, or kicked.'); return; }
        if (c.check('athletics', 12, { adv: hasItem(c.pc, 'crowbar') })) { c.set('tower_open'); c.narr(method === 'kick' ? 'You mule-kick the door. The bar snaps, the door flies open, and above you the bell rope sways.' : 'You heave. The bar snaps.'); }
        else c.narr('The door bangs but holds. Somewhere up the stairs, someone stops humming.');
        c.advance(2);
      } },
    ],
    onEnter: (c) => { if (!c.flag('cleared_nave')) c.fight('nave'); },
  },

  vestry: {
    id: 'vestry', name: 'The Old Chapel — Vestry', region: 'The Old Chapel',
    desc: (c) => `The priest's room, untouched by the cultists: a narrow cot, a writing desk, vestments rotting on their hooks. ${c.flag('vestry_looted') ? 'The chest stands open and empty.' : 'An iron-banded chest sits under the window.'} A half-written letter lies on the desk.`,
    exits: [{ to: 'nave', names: ['out', 'nave', 'back', 'chapel', 'leave', 'exit'], label: 'Back to the nave', minutes: 1 }],
    features: [
      { id: 'chest', names: ['chest', 'iron chest', 'box', 'trunk'], look: (c) => c.flag('vestry_looted') ? 'Empty.' : 'Iron-banded, not locked. The priest trusted people.', open: (c) => {
        if (c.flag('vestry_looted')) { c.narr('Empty.'); return; }
        c.set('vestry_looted'); c.narr('Inside: a purse of old coin, two red potions, a silvered dagger, and a holy symbol of the old faith — a crowned sun.');
        c.money(4000); c.give('potion_healing', 2); c.give('silvered_dagger'); c.give('old_holy_symbol');
        c.good('+40 gp, 2 potions of healing, a silvered dagger, a holy symbol of the old faith.');
      }, search: (c) => ROOMS.vestry.features![0].open!(c, 'normal'), take: (c) => ROOMS.vestry.features![0].open!(c, 'normal') },
      { id: 'letter', names: ['letter', 'desk', 'note', 'writing desk', 'paper'], look: () => 'A half-written letter, the ink faded to brown. About forty years old.', read: (c) => { c.narr('"...and should I not return, let it be known that the sealed one below must never hear the bell again. We ring it on the holy days and only on the holy days, and only in the old way. If you hear it at midnight, it is not being rung for us—"'); c.narr('The letter stops there.'); if (!hasItem(c.pc, 'priests_letter')) c.give('priests_letter'); }, take: (c) => { if (!hasItem(c.pc, 'priests_letter')) { c.give('priests_letter'); c.narr('You take the letter.'); } } },
    ],
  },

  tower: {
    id: 'tower', name: 'The Old Chapel — Bell Tower', region: 'The Old Chapel',
    desc: (c) => {
      if (c.flag('bell_silenced')) return 'A spiral stair ends under the bell. The rope is cut. Green-black candle stubs line the steps, cold now. Through the louvres you can see the Thornwood, and the smoke of Breda beyond it.';
      return 'A spiral stair climbs to the bell chamber. Green-black candles burn on every step. The bell rope hangs down the middle of the tower, worn shiny by hands.';
    },
    exits: [{ to: 'nave', names: ['down', 'out', 'nave', 'back', 'stairs', 'leave', 'exit'], label: 'Down to the nave', minutes: 2 }],
    npcs: (c) => (!c.flag('merah_gone') && !c.flag('merah_dead') ? ['merah'] : []),
    features: [
      { id: 'bell', names: ['bell', 'rope', 'bell rope', 'clapper'], look: (c) => c.flag('bell_silenced') ? 'The rope is cut. The bell hangs silent, as it should.' : 'An old bronze bell, green with age, its rope worn shiny. There\'s something written around its lip.', read: (c) => c.narr('Around the lip of the bell, in old letters: WE RING TO HOLD WHAT MUST NOT WAKE.'),
        cut: (c) => silenceBell(c), take: (c) => silenceBell(c),
        ring: (c) => { if (c.flag('bell_silenced')) { c.narr('The rope is cut. You\'d have to climb up and swing the clapper by hand, and you get the feeling you really, really shouldn\'t.'); return; } c.narr('You pull the rope. BONG. The sound goes on and on, out over the hills, and west, and down. Far below, something you can\'t see turns over in its sleep.'); c.bad('Somewhere, something remembers a little more.'); c.s.chaos = Math.min(9, c.s.chaos + 1); } },
    ],
    onEnter: (c) => {
      if (!c.flag('merah_gone') && !c.flag('merah_dead') && !c.flag('merah_greeted')) {
        c.set('merah_greeted');
        c.narr('At the top of the stairs a gaunt woman in grey stands under the bell, her hands on the rope. A knot of dead bramble sits at her feet like a pet. She turns, and smiles at you as if you were expected.');
        c.say('merah', '"You came up the stairs. Everyone does, eventually. Would you like to hear what the bell is for? Or would you rather we skip to the part where you try to stop me?"');
        c.talkTo('merah'); c.npc('merah').met = true;
      }
    },
    chips: (c) => (!c.flag('merah_gone') && !c.flag('merah_dead') ? ['ask Merah what the bell is for', 'tell Merah to stop', 'attack Merah'] : c.flag('bell_silenced') ? [] : ['cut the bell rope']),
  },

  crypt: {
    id: 'crypt', name: 'The Old Chapel — Crypt', region: 'The Old Chapel', rest: 'short',
    desc: (c) => {
      let s = 'A low vault, cold as a cellar in winter. Three stone sarcophagi; one lid lies shattered on the floor. On the far wall, a mural of a crowned woman, her face gouged out of the plaster. Green-black candles burn around it.';
      if (!c.hasCompanion('alistair') && !c.flag('alistair_dead')) s += ' On the intact sarcophagus, a skeleton in the rags of very good clothes sits with its legs crossed, humming.';
      return s;
    },
    exits: [{ to: 'nave', names: ['up', 'stairs', 'nave', 'back', 'out', 'leave', 'exit', 'upstairs'], label: 'Up to the nave', minutes: 2 }],
    npcs: (c) => (!c.hasCompanion('alistair') && !c.flag('alistair_dead') ? ['alistair'] : []),
    features: [
      { id: 'mural', names: ['mural', 'painting', 'woman', 'face', 'crowned woman', 'wall'], look: () => 'A coronation scene. Courtiers, banners, a crowned woman in white at the centre. Her face has been gouged out, over and over, down to bare stone. Someone hated her. Or loved her too much to let anyone look.' },
      { id: 'sarcophagi', names: ['sarcophagi', 'sarcophagus', 'coffin', 'coffins', 'tombs', 'shattered', 'lid'], look: () => 'Three stone coffins. One shattered from inside. One intact. One with its lid slightly ajar.', search: (c) => {
        if (c.flag('crypt_looted')) { c.narr('Nothing else but dust and old bones.'); return; }
        c.set('crypt_looted'); c.narr('Inside the ajar sarcophagus: a handful of burial coins pressed thin for the eyes of the dead, and a scroll case. Inside the case, a scroll of blessing.');
        c.give('burial_coins'); c.give('scroll_bless');
        if (c.hasCompanion('alistair')) c.say('alistair', '"Oh, that was Bertram. He won\'t mind. He minded everything when he was alive, so honestly it\'s growth."');
      }, open: (c) => ROOMS.crypt.features![1].search!(c) },
      { id: 'candles', names: ['candles', 'candle', 'green candles'], look: () => 'Green-black candles, the wax smelling of graves and honey.', take: (c) => { c.give('cult_candle', 3); c.narr('You pocket three of the candles. Your fingers smell of honey and cold earth for an hour.'); } },
    ],
    onEnter: (c) => {
      if (!c.flag('alistair_met')) NPC_GREET('alistair', c);
    },
    chips: (c) => (!c.hasCompanion('alistair') && !c.flag('alistair_dead') ? ['high five Alistair', 'ask Alistair who he is', 'invite Alistair along'] : ['search the sarcophagi']),
  },
};

// late-bound greeting hook to avoid an import cycle
let NPC_GREET: (id: string, c: Ctx) => void = () => {};
export function bindGreet(f: (id: string, c: Ctx) => void) { NPC_GREET = f; }

function silenceBell(c: Ctx) {
  if (c.flag('bell_silenced')) { c.narr('It\'s already silent.'); return; }
  if (!c.flag('merah_gone') && !c.flag('merah_dead') && !c.flag('merah_talked_down')) { c.narr('Merah stands between you and the rope.'); return; }
  c.set('bell_silenced');
  c.narr('You cut the bell rope as high as you can reach and wind the clapper in cloth. The tower is suddenly, enormously quiet.');
  c.good('The Old Chapel bell is silenced.');
  c.journal('The bell is silenced. Go back to Squib in Breda for the reward.');
  c.xp(50);
  checkChapelDone(c);
}

export function checkChapelDone(c: Ctx) {
  if (c.flag('bell_silenced') && (c.flag('merah_dead') || c.flag('merah_gone') || c.flag('merah_talked_down')) && !c.flag('chapel_done')) {
    c.set('chapel_done');
    c.sys('The chapel is quiet. Squib will want to hear about this. (Head back to Breda.)');
  }
}

export const ENCOUNTERS: Record<string, EncounterDef> = {
  yard: { id: 'yard', foes: [['zombie', 2]], intro: 'Two graves heave open. The dead climb out, slow and certain, between you and the porch.', fleeTo: 'kessels_rest', onWin: (c) => { c.set('cleared_yard'); c.narr('The graveyard is quiet. Among the headstones, a ewe stands perfectly still, facing the chapel door.'); } },
  nave: { id: 'nave', foes: [['skeleton', 1], ['grasping_hand', 1]], intro: 'Past the second row of pews, bones stir. A skeleton rises from under the benches, rusted sword in hand, and steps into the aisle. Something small scuttles along the pew backs toward you on its fingertips.', fleeTo: 'chapel_yard', scaleWithParty: true, onWin: (c) => c.set('cleared_nave') },
  tower: { id: 'tower', foes: [['merah', 1], ['thornling', 1]], intro: 'Merah lights a green candle. The bramble at her feet unfolds into something with claws.', fleeTo: 'nave', onWin: (c) => { checkChapelDone(c); } },
  alistair_fight: { id: 'alistair_fight', foes: [['alistair', 1]], intro: 'Alistair sighs. "Oh, come ON." Cold light gathers in his finger bones.', fleeTo: 'nave' },
  wolves: { id: 'wolves', foes: [['wolf', 1], ['dead_wolf', 1]], intro: 'Two wolves step onto the trail ahead. One moves wrong: its ribs show through the fur, and it doesn\'t breathe.', fleeTo: 'breda_square' },
  wolf_single: { id: 'wolf_single', foes: [['wolf', 1]], intro: 'A lean grey wolf lopes out of the trees, alone and hungry.' },
  courier: { id: 'courier', foes: [['cultist', 1]], intro: 'The grey-robed courier drops her bundle of candles and draws a sickle.' },
};

// Random travel events on the Thornwood road. ~1 in 2 trips.
export const TRAVEL: Record<string, TravelTable> = {
  thornwood: {
    id: 'thornwood', chance: 0.5, entries: [
      (c) => { c.narr('Three corpses shamble along the road ahead of you, all walking north toward the chapel. They don\'t attack. They don\'t seem to notice you at all. After a while they turn off into the trees, still heading north.'); },
      (c) => { if (c.flag('fought_wolves')) { c.fight('wolf_single'); } else { c.set('fought_wolves'); c.fight('wolves'); } },
      (c) => { c.narr('A thick, cold mist rolls across the road. Your breath steams in the spring air. For a moment, somewhere in the white, a woman is humming a lullaby you almost know. Then the mist is gone.'); c.s.chaos = Math.min(9, c.s.chaos + 0); },
      (c) => { if (c.flag('courier_done')) { c.narr('Two Breda militia patrol nervously, much too far from the gate. "Seen anything?" one asks. He looks like he hopes you haven\'t.'); return; } c.set('courier_done'); c.narr('A traveller in grey hurries toward you with a bundle of green-black candles. She sees you and freezes.'); if (c.check('perception', 12, { quiet: true })) c.narr('There\'s a letter in her hand, and she\'s raising it to her mouth.'); c.fight('courier'); },
      (c) => { c.narr('Two Breda militia, much too far from the gate, startle when they see you. "Seen anything?" one asks. He clearly hopes you haven\'t. "Bell kept me up again. Every night. Every bloody night."'); },
      (c) => { c.narr('A carved wooden charm hangs low over the path, freshly tied. Something about the knot is wrong.'); if (!c.flag('saw_charms')) c.sys('Maybe look more closely at the charms.'); },
    ],
  },
};

// A cult courier carries a letter. Looted after the fight.
export function courierLoot(c: Ctx) {
  c.money(1500); c.give('cult_candle', 2);
  c.narr('In the courier\'s satchel: 15 gold in tithes and a half-chewed letter. What\'s legible reads: "...the wetlands, at the new moon. Bring every candle. Z."');
  c.journal('A cult courier carried orders signed "Z" about a meeting in the wetlands at the new moon.');
}

export { pick, die };
export { maybeLevel };
