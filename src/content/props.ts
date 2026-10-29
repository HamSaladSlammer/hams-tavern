// Props: the ordinary stuff in every room that you can sit on, throw, drink, climb, break or
// set on fire. Rooms list what's obviously there; the oracle decides about anything else.
export interface PropDef {
  id: string;
  name: string;
  names: string[];
  tags: string[]; // sit climb throw weapon break burn drink eat light hide lift push water cover smell listen take
  desc: string;
  item?: string; // item you get by taking it (or a piece of it)
}

const P = (id: string, name: string, names: string[], tags: string[], desc: string, item?: string): PropDef => ({ id, name, names, tags, desc, item });

export const ROOM_PROPS: Record<string, PropDef[]> = {
  tavern: [
    P('stool', 'bar stool', ['stool', 'bar stool', 'stools', 'seat'], ['sit', 'throw', 'weapon', 'break', 'lift', 'climb'], 'A three-legged stool, worn smooth by a thousand backsides.', 'chair_leg'),
    P('chair', 'chair', ['chair', 'chairs'], ['sit', 'throw', 'weapon', 'break', 'lift', 'climb'], 'A heavy oak chair. One leg is already a little loose.', 'chair_leg'),
    P('table', 'long table', ['table', 'tables', 'long table'], ['sit', 'climb', 'push', 'cover', 'hide', 'break'], 'A long table, its top carved with forty years of initials.'),
    P('bar', 'bar', ['bar', 'counter', 'bar top'], ['climb', 'cover', 'hide', 'lean'], 'Squib\'s bar. Dark wood, polished by elbows. Don\'t stand on it.'),
    P('mugs', 'spare mugs', ['mugs', 'tankards', 'spare mug', 'clean mug'], ['throw', 'weapon', 'take', 'break'], 'A rack of clay mugs, chipped, cleaned, ready.', 'mug_empty'),
    P('bottles', 'bottles behind the bar', ['bottles', 'bottle', 'shelf of bottles'], ['throw', 'weapon', 'break', 'drink'], 'Dusty bottles of things Squib only pours for people he likes.', 'bottle_empty'),
    P('candles', 'candles', ['candle', 'candles', 'candle stub'], ['light', 'burn', 'take', 'throw'], 'Tallow stubs on every table, each in a puddle of its own wax.', 'candle'),
    P('hearth_fire', 'hearth fire', ['fire', 'flames', 'embers', 'logs'], ['burn', 'light', 'warm'], 'A big fire that never quite goes out.'),
    P('rafters', 'rafters', ['rafters', 'beams', 'ceiling', 'beam'], ['climb', 'hide'], 'Smoke-black beams. You could get up there, if you wanted to be talked about.'),
    P('window', 'window', ['window', 'windows', 'glass'], ['break', 'climb', 'look'], 'Bubbled glass looking out on the square.'),
    P('floor', 'floor', ['floor', 'floorboards', 'boards'], ['sit', 'lie'], 'Sawdust over old boards. Some of the stains are older than you.'),
    P('cards', 'deck of cards', ['cards', 'deck', 'card game', 'dice game'], ['play', 'take'], 'A Galilin deck, soft as cloth from use. The dwarves are always up for a hand.'),
    P('plate', 'plates and cutlery', ['plate', 'plates', 'fork', 'spoon', 'knife', 'cutlery', 'bowl'], ['throw', 'weapon', 'take'], 'Tin plates, bent forks, one knife that has definitely been in a fight.'),
  ],
  breda_square: [
    P('well_water', 'well water', ['bucket', 'well water', 'water'], ['drink', 'water', 'climb'], 'A rope, a bucket, and cold clean water.', 'water_cup'),
    P('cobbles', 'loose cobble', ['cobble', 'cobblestone', 'stone', 'rock', 'stones', 'rocks'], ['throw', 'weapon', 'take', 'lift'], 'One cobble near the well is loose and fist-sized.', 'rock'),
    P('cart', 'farm cart', ['cart', 'wagon', 'hay cart'], ['climb', 'hide', 'push', 'sit'], 'A farm cart full of hay, its owner nowhere in sight.'),
    P('eggs', 'egg stall', ['eggs', 'egg', 'egg stall', 'stall', 'baskets'], ['eat', 'throw', 'take'], 'A farmer\'s stall: eggs, onions and gossip.', 'egg'),
    P('palisade', 'palisade', ['palisade', 'wall', 'fence', 'stakes'], ['climb'], 'A wall of sharpened logs, taller than a man. Built fast, after the war.'),
    P('trough', 'horse trough', ['trough', 'horse trough'], ['water', 'drink', 'sit'], 'Green water, one very old frog.'),
  ],
  goods: [
    P('shelves', 'shelves', ['shelves', 'shelf', 'goods', 'stock'], ['climb', 'search', 'break'], 'Rope, nails, lamp oil, tins, and things Garrick can\'t name either.'),
    P('barrels', 'barrels of nails', ['barrel', 'barrels', 'nails'], ['sit', 'push', 'hide', 'lift'], 'Barrels of nails, salt and something that smells of tar.'),
    P('counter', 'counter', ['counter', 'till'], ['lean', 'climb'], 'A counter with a brass bell for service. Garrick rings it himself when he\'s bored.'),
  ],
  smithy: [
    P('forge_fire', 'forge', ['forge', 'coals', 'fire', 'furnace'], ['burn', 'light', 'warm'], 'The forge glows white at the heart. The heat hits you from across the room.'),
    P('anvil', 'anvil', ['anvil'], ['lift', 'sit', 'push'], 'An anvil older than Breda. Mother Dreyse says it was her grandmother\'s.'),
    P('tongs', 'tongs and hammers', ['hammer', 'tongs', 'tools', 'hammers'], ['weapon', 'take', 'throw'], 'Tongs, hammers, a quench bucket. None of it is for you to touch.'),
    P('quench', 'quench bucket', ['bucket', 'quench bucket', 'water', 'quench'], ['water', 'drink'], 'Black, oily water that hisses when the iron goes in.'),
    P('scrap', 'scrap pile', ['scrap', 'scrap pile', 'iron', 'horseshoe', 'horseshoes'], ['take', 'throw', 'weapon', 'search'], 'Bent horseshoes and failed blades.', 'rock'),
  ],
  tailor: [
    P('bolts', 'bolts of cloth', ['cloth', 'bolts', 'fabric', 'silk', 'wool'], ['hide', 'take', 'burn'], 'Wool, linen and one bolt of shimmering grey silk nobody is allowed to touch.'),
    P('pins', 'pins and needles', ['pins', 'needles', 'pincushion', 'scissors', 'shears'], ['weapon', 'take'], 'Hundreds of pins, all pointing the same way. That\'s Hetch.'),
    P('mannequin', 'mannequin', ['mannequin', 'dummy', 'dress form'], ['push', 'hug', 'dance'], 'A dress form wearing half a coat. It looks expectant.'),
    P('yarn', 'ball of yarn', ['yarn', 'ball of yarn', 'wool ball', 'string'], ['throw', 'play', 'take'], 'A ball of red yarn on the counter. Hetch is pretending not to look at it.'),
  ],
  thornwood: [
    P('trees', 'trees', ['tree', 'trees', 'oak', 'branch', 'branches', 'canopy'], ['climb', 'hide', 'cover'], 'Old oaks and blackthorn, close enough to touch from the path.'),
    P('sticks', 'fallen branch', ['stick', 'sticks', 'branch', 'fallen branch', 'log', 'wood', 'firewood'], ['take', 'weapon', 'throw', 'burn'], 'Deadfall everywhere. A good heavy stick is never far.', 'stick'),
    P('rocks', 'rocks', ['rock', 'rocks', 'stone', 'stones', 'pebble'], ['take', 'throw', 'weapon', 'lift'], 'Mossy stones along the path.', 'rock'),
    P('mushrooms', 'mushrooms', ['mushroom', 'mushrooms', 'fungus', 'toadstool'], ['eat', 'take', 'smell'], 'Pale caps with violet gills at the foot of an oak. Could be dinner. Could be Widow\'s Cap.', 'mushroom'),
    P('charms', 'bone charms', ['charm', 'charms', 'bone charm', 'twig charm'], ['take', 'break', 'look'], 'Little charms of twig and bone hung on the trees. Somebody keeps making new ones.', 'bone'),
    P('stream', 'stream', ['stream', 'brook', 'creek', 'water', 'river'], ['water', 'drink', 'swim'], 'A cold brown stream under the roots.', 'water_cup'),
    P('bushes', 'blackthorn', ['bush', 'bushes', 'blackthorn', 'undergrowth', 'brambles', 'berries'], ['hide', 'cover', 'eat'], 'Blackthorn and bramble. The sloes are bitter.', 'apple'),
  ],
  kessels_rest: [
    P('dome', 'wayshrine dome', ['dome', 'shrine', 'wayshrine', 'roof'], ['climb', 'cover', 'pray'], 'A little stone dome over a dry font. Travellers used to pray here.'),
    P('stones', 'rubble', ['rubble', 'rock', 'rocks', 'stone', 'stones'], ['take', 'throw', 'weapon'], 'Fallen masonry.', 'rock'),
    P('campfire', 'old campfire', ['campfire', 'fire pit', 'ashes', 'firepit'], ['burn', 'light', 'search', 'warm'], 'A ring of black stones and old ash.'),
  ],
  foothills: [
    P('rocks', 'rocks', ['rock', 'rocks', 'boulder', 'stone', 'stones', 'scree'], ['take', 'throw', 'weapon', 'climb', 'hide'], 'Loose scree and grey boulders.', 'rock'),
    P('grass', 'long grass', ['grass', 'long grass', 'heather'], ['hide', 'sit', 'lie'], 'Long wet grass and heather.'),
    P('sheep', 'sheep', ['sheep', 'flock', 'lamb', 'ewe'], ['pet', 'count'], 'Doss\'s flock, grazing and judging you.'),
  ],
  chapel_yard: [
    P('graves', 'graves', ['grave', 'graves', 'headstone', 'headstones', 'tombstone', 'dirt', 'soil'], ['dig', 'search', 'read', 'pray'], 'Leaning headstones. Half the graves are open, from the inside.'),
    P('bones', 'scattered bones', ['bone', 'bones', 'femur', 'skull'], ['take', 'throw', 'weapon'], 'Old bones, the kind that didn\'t get back up.', 'bone'),
    P('wall', 'yard wall', ['wall', 'yard wall', 'gate'], ['climb', 'cover', 'hide'], 'A low drystone wall.'),
    P('stones', 'broken headstone', ['rock', 'rocks', 'stone', 'stones', 'chunk'], ['take', 'throw', 'weapon'], 'Chunks of broken headstone.', 'rock'),
  ],
  nave: [
    P('pews', 'pews', ['pew', 'pews', 'bench', 'benches'], ['sit', 'hide', 'cover', 'break', 'push', 'climb'], 'Rotten pews, half of them overturned.', 'chair_leg'),
    P('candles', 'candles', ['candle', 'candles', 'candelabra'], ['light', 'burn', 'take', 'throw'], 'Old candles on iron stands, some freshly lit. Green-black wax.', 'candle'),
    P('window', 'broken window', ['window', 'stained glass', 'glass'], ['climb', 'look'], 'Stained glass of a crowned sun, mostly holes now.'),
    P('rubble', 'rubble', ['rubble', 'rock', 'stone', 'stones'], ['take', 'throw', 'weapon'], 'Fallen masonry.', 'rock'),
  ],
  vestry: [
    P('wardrobe', 'wardrobe', ['wardrobe', 'cupboard', 'cabinet'], ['open', 'hide', 'search'], 'A tall vestment wardrobe, the door hanging off.'),
    P('desk', 'writing desk', ['desk', 'writing desk', 'drawer', 'drawers'], ['search', 'sit'], 'A priest\'s writing desk, ink long dried.'),
  ],
  tower: [
    P('stairs', 'spiral stairs', ['stairs', 'steps', 'staircase'], ['climb', 'sit'], 'Worn stone steps spiralling up into the dark.'),
    P('ladder', 'ladder', ['ladder'], ['climb'], 'A ladder up to the bell platform.'),
    P('window', 'arrow slit', ['window', 'slit', 'arrow slit'], ['look'], 'A narrow slit with a view of the whole valley.'),
  ],
  crypt: [
    P('sarcophagi', 'sarcophagi', ['sarcophagus', 'sarcophagi', 'coffin', 'coffins', 'tomb', 'tombs', 'lid'], ['open', 'search', 'push', 'hide', 'climb'], 'Stone coffins, their lids carved with sleeping knights.'),
    P('bones', 'bones', ['bone', 'bones', 'skull', 'skulls', 'ossuary'], ['take', 'throw', 'weapon'], 'Bones stacked neatly in niches. Someone loved order down here.', 'bone'),
    P('torches', 'wall sconce', ['sconce', 'torch', 'torches', 'bracket'], ['take', 'light', 'burn'], 'An iron sconce with a torch stub.', 'torch'),
  ],
};

/** What could plausibly be lying around in a kind of place, for when the player asks for something not listed. */
export const PLAUSIBLE: Record<string, string[]> = {
  indoors: ['chair', 'stool', 'table', 'cup', 'mug', 'plate', 'fork', 'spoon', 'knife', 'bottle', 'candle', 'rag', 'broom', 'bucket', 'rope', 'nail', 'book', 'paper', 'pen', 'coin', 'blanket', 'pillow', 'box', 'crate', 'sack', 'pot', 'pan', 'lamp', 'jug', 'curtain', 'rug', 'shelf', 'door', 'window', 'cat', 'dog', 'mouse', 'rat', 'spider', 'dust', 'cobweb', 'wall', 'floor'],
  outdoors: ['rock', 'stone', 'stick', 'branch', 'tree', 'bush', 'grass', 'flower', 'mud', 'puddle', 'leaf', 'leaves', 'dirt', 'log', 'pinecone', 'feather', 'bird', 'squirrel', 'rabbit', 'frog', 'beetle', 'worm', 'acorn', 'berry', 'berries', 'moss', 'vine', 'root', 'hill', 'sky', 'cloud', 'wind', 'snow', 'water'],
  ruins: ['rock', 'stone', 'rubble', 'bone', 'skull', 'candle', 'cobweb', 'rat', 'spider', 'dust', 'brick', 'plank', 'beam', 'nail', 'chain', 'rag', 'ash', 'cloth', 'shard', 'glass', 'pew', 'statue'],
  tavern: ['wall', 'floor', 'door', 'rag', 'broom', 'bucket', 'mouse', 'rat', 'spider', 'cobweb', 'shelf', 'curtain', 'rug', 'jug', 'pot', 'pan', 'blanket', 'box', 'crate', 'sack', 'paper', 'pen', 'book', 'coin', 'ale', 'beer', 'mug', 'tankard', 'glass', 'bottle', 'chair', 'stool', 'table', 'plate', 'fork', 'knife', 'spoon', 'bowl', 'candle', 'dice', 'cards', 'pipe', 'tobacco', 'bread', 'cheese', 'rag', 'broom', 'bucket', 'dog', 'cat', 'drunk', 'song', 'fiddle', 'darts', 'dartboard', 'peanuts', 'pickled egg', 'salt', 'pepper', 'napkin', 'coat', 'hat'],
};

export function roomKind(loc: string, outdoors: boolean): string {
  if (loc === 'tavern') return 'tavern';
  if (['chapel_yard', 'nave', 'vestry', 'tower', 'crypt', 'kessels_rest'].includes(loc)) return 'ruins';
  return outdoors ? 'outdoors' : 'indoors';
}

/** Tags a spawned prop gets from its name. */
export function tagsFor(noun: string): string[] {
  const t: string[] = ['look'];
  if (/rock|stone|brick|stick|branch|bone|skull|bottle|mug|cup|plate|fork|knife|spoon|pan|pot|chair|stool|candle|book|shard|chain|plank|log|pinecone|acorn|apple|egg|boot|hat|jug|lamp|bucket|broom|dart/.test(noun)) t.push('take', 'throw', 'weapon');
  if (/chair|stool|bench|table|log|rock|stone|crate|box|barrel|pew|floor|grass/.test(noun)) t.push('sit');
  if (/tree|wall|ladder|rope|beam|crate|barrel|statue|rafter|hill|cliff|roof/.test(noun)) t.push('climb');
  if (/bottle|mug|cup|plate|glass|chair|stool|window|crate|box|lamp|jug|pot/.test(noun)) t.push('break');
  if (/candle|lamp|torch|fire/.test(noun)) t.push('light', 'burn');
  if (/cloth|rag|paper|book|wood|stick|log|curtain|rug|straw|hay|grass|leaves/.test(noun)) t.push('burn');
  if (/ale|beer|wine|water|milk|tea|puddle|stream|juice|cider/.test(noun)) t.push('drink');
  if (/bread|cheese|apple|berry|berries|egg|meat|mushroom|peanut|carrot|onion|fish/.test(noun)) t.push('eat', 'take');
  if (/cat|dog|mouse|rat|bird|squirrel|rabbit|frog|beetle|horse|sheep|goat|chicken/.test(noun)) t.push('animal', 'pet');
  if (/bush|crate|barrel|table|curtain|tree|wall|cart/.test(noun)) t.push('hide', 'cover');
  return Array.from(new Set(t));
}

/** Which item a spawned or listed prop becomes when you pick it up. */
export function itemFor(noun: string): string | undefined {
  if (/rock|stone|brick|cobble|pebble|rubble/.test(noun)) return 'rock';
  if (/stick|branch|plank|log/.test(noun)) return 'stick';
  if (/bone|femur|skull/.test(noun)) return 'bone';
  if (/chair leg|chair|stool|pew/.test(noun)) return 'chair_leg';
  if (/bottle/.test(noun)) return 'bottle_empty';
  if (/mug|tankard|cup/.test(noun)) return 'mug_empty';
  if (/candle/.test(noun)) return 'candle';
  if (/egg/.test(noun)) return 'egg';
  if (/apple|berry|berries/.test(noun)) return 'apple';
  if (/mushroom|toadstool/.test(noun)) return 'mushroom';
  return undefined;
}
