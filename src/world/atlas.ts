// The atlas of Lahti: every town on Jared's map, the roads between them, and the places worth
// finding. Coordinates are fractions of the map image (0..1), so the map can be any size.
export type LocKind = 'capital' | 'city' | 'town' | 'village' | 'site';
export interface Loc {
  id: string;
  name: string;
  kind: LocKind;
  x: number;
  y: number;
  hub: string; // room you arrive in
  blurb: string;
  lore: string[]; // what locals say about their own town
  known?: boolean; // on the traveller's map from the start
}

const P = (x: number, y: number) => ({ x: x / 2000, y: y / 1500 });

export const TOWNS: Loc[] = [
  { id: 'breda', name: 'Breda', kind: 'village', ...P(1330, 680), hub: 'breda_square', known: true, blurb: 'Your home base: a palisade village at the crossroads, and the Smoking Barrel.', lore: ['Breda grew up fast after the war, around a well and a tavern.'] },
  { id: 'suomi', name: 'Suomi', kind: 'capital', ...P(1145, 615), hub: 'town:suomi:square', known: true, blurb: 'The capital: white spires, elven courts, fencing halls, and Queen Elisiah.', lore: ['The fencing halls of Suomi never closed, not even in the war.', 'Queen Elisiah has ruled since the treaty. Before that, nobody talks about.', 'There are cellars under the palace older than the palace.'] },
  { id: 'borschardt', name: 'Borschardt', kind: 'city', ...P(1025, 470), hub: 'town:borschardt:square', known: true, blurb: 'A city of bridges and counting-houses. Everything here has a price, and a ledger.', lore: ['Borschardt has more bankers than bakers.', 'The counting chapel on Guild Street rings its bell for the close of trading. Lately it rings at midnight too.', 'They say you can sell a bridge in Borschardt twice.'] },
  { id: 'tokarev', name: 'Tokarev', kind: 'city', ...P(970, 845), hub: 'town:tokarev:square', known: true, blurb: 'The crown arms works. Every cartridge in Lahti is pressed here.', lore: ['The Tokarev works press every legal cartridge in Lahti. The Article of Iron says so.', 'The factory shifts run on March Powder. Nobody sleeps in Tokarev.', 'Silvering a blade at the works costs a hundred gold.'] },
  { id: 'largo', name: 'Largo', kind: 'town', ...P(1150, 905), hub: 'town:largo:square', known: true, blurb: 'A river port on the Aimo. Crates marked FISH that never smell of fish.', lore: ['Everything unstamped in Lahti comes through Largo.', 'There\'s a bell hung over the water on the old derrick. It rings at midnight now.', 'Don\'t buy grey mercy. Don\'t ask what\'s in the FISH crates.'] },
  { id: 'coltale', name: 'Coltale', kind: 'town', ...P(1145, 370), hub: 'town:coltale:square', known: true, blurb: 'A harbour fortress at the foot of the bay, and the largest war cemetery in Lahti.', lore: ['The Memorial of Greymarch is here: names of the dead, carved in rows.', 'The crown orphanage at Coltale took in two hundred children of the war.', 'The memorial bell used to ring once a year. Now it rings every night.'] },
  { id: 'brumandell', name: 'Brumandell', kind: 'town', ...P(1320, 395), hub: 'town:brumandell:square', known: true, blurb: 'A walled town under the foothills, with a market bigger than the town.', lore: ['Brumandell apples make the best cider in Lahti.', 'The foothill families came down here when the bell started. They don\'t talk about it.', 'Grog\'s Tavern and Alehouse does a clam chowder that will change your life.'] },
  { id: 'herstal', name: 'Herstal', kind: 'village', ...P(1340, 175), hub: 'town:herstal:square', known: true, blurb: 'A cold harbour on the north-east peninsula, under the Weeping Glacier.', lore: ['The glacier above Herstal is melting from the inside.', 'There are people in the ice. Soldiers. Closer to the surface every month.', 'Herstal fishermen don\'t sail on the night of the new moon.'] },
  { id: 'tantal', name: 'Tantal', kind: 'village', ...P(1525, 375), hub: 'town:tantal:square', known: true, blurb: 'A mining village in the eastern woods. The new shaft hit something old.', lore: ['The miners broke into a hall nobody built. They sealed the adit.', 'There\'s a sealed tower in the woods east of Tantal, owner missing.', 'Tantal sends half its sons to the army and gets a third of them back.'] },
  { id: 'galilin', name: 'Galilin', kind: 'town', ...P(1555, 750), hub: 'town:galilin:square', known: true, blurb: 'Every caravan crosses at Galilin. So does every card game.', lore: ['Galilin red is rough and generous.', 'The card game is named after the town. The town would like it back.', 'Caravans from the east coast come through here twice a month.'] },
  { id: 'rastbrook', name: 'Rastbrook', kind: 'village', ...P(1345, 880), hub: 'town:rastbrook:square', known: true, blurb: 'A hamlet on the south road, two days from Breda.', lore: ['Rastbrook is where carts stop for the night on the way to the Mire.', 'Master Fenwick Tealeaf comes through here. Hide your valuables and your opinions.'] },
  { id: 'shpagin', name: 'Shpagin', kind: 'village', ...P(1410, 1010), hub: 'town:shpagin:square', known: true, blurb: 'Stilt-houses at the edge of the Southern Mire. Pole-barges and Widow\'s Cap.', lore: ['The Mire drinks two rivers and never fills. Nobody knows where the water goes.', 'Barge folk won\'t pole past the Drowned Shrine after dark.', 'Swamp folk eat Widow\'s Cap as a sacrament. Don\'t try it.'] },
  { id: 'madsen', name: 'Madsen', kind: 'village', ...P(1700, 1165), hub: 'town:madsen:square', known: true, blurb: 'A fishing port where the Mire meets the sea. Guns arrive here from across the ocean.', lore: ['The nets are coming up heavy lately, and not with fish.', 'Everything from across the Northern Ocean lands at Madsen first, including the guns.'] },
  { id: 'nagant', name: 'Nagant', kind: 'village', ...P(600, 235), hub: 'town:nagant:square', known: true, blurb: 'A cliff hamlet of lighthouse keepers and hermits on the north-west coast.', lore: ['The keeper swears a second light answers hers from the sea on some nights.', 'Hermits come down from the Peaks to Nagant for salt and silence.'] },
  { id: 'radom', name: 'Radom', kind: 'town', ...P(715, 450), hub: 'town:radom:square', known: true, blurb: 'The arsenal town where every gun in Lahti is logged, and the cells that hold those who forget to.', lore: ['Radom logs every stamped weapon in Lahti.', 'A month in the cells at Radom will teach you to mostly not do things.'] },
  { id: 'samopal', name: 'Samopal', kind: 'town', ...P(705, 640), hub: 'town:samopal:square', known: true, blurb: 'The western road town, where orcs from Makrovin come to trade.', lore: ['The Treaty Stone stands west of Samopal, where the peace was signed.', 'Half the faces in the Samopal market are orcish, and that\'s fine now.'] },
  { id: 'lebel', name: 'Lebel', kind: 'town', ...P(730, 990), hub: 'town:lebel:square', known: true, blurb: 'A farm town on the great southern fields.', lore: ['Lebel girls are said to marry for love, which old men find very upsetting.', 'The harvest fairs at Lebel are the best in Lahti.'] },
  { id: 'carcano', name: 'Carcano', kind: 'village', ...P(770, 1140), hub: 'town:carcano:square', known: true, blurb: 'A cavalry post near the southern border with Sakosta.', lore: ['The Carcano cavalry carbine is named for this town. The town is very proud of that.'] },
  { id: 'maxim', name: 'Maxim', kind: 'village', ...P(1140, 1085), hub: 'town:maxim:square', known: true, blurb: 'Farmland behind the levees, where the ditches give things back.', lore: ['Dig deep enough behind the Maxim levees and you find the war.'] },
];

/** Named places from the campaign: hidden until discovered. */
export interface Poi { id: string; name: string; x: number; y: number; level: number; blurb: string; near: string; story?: boolean }
export const POIS: Poi[] = [
  { id: 'old_chapel', name: 'The Old Chapel', ...P(1385, 470), level: 1, near: 'breda', blurb: 'The abandoned chapel in the northern foothills where the bell rang every midnight.', story: true },
  { id: 'coltale_memorial', name: 'The Coltale War Memorial', ...P(1195, 290), level: 4, near: 'coltale', blurb: 'Lahti\'s largest war cemetery. Its bell rings for the fallen every night now.', story: true },
  { id: 'largo_bell', name: 'The Hanging Bell of Largo', ...P(1130, 825), level: 4, near: 'largo', blurb: 'A river warehouse on rotting pilings, and a bell hung over the open water.', story: true },
  { id: 'borschardt_chapel', name: 'The Counting Chapel', ...P(985, 400), level: 5, near: 'borschardt', blurb: 'A guild chapel between two counting-houses on Guild Street. Its bell rings at midnight.', story: true },
  { id: 'old_vaults', name: 'The Old Vaults', ...P(1160, 650), level: 9, near: 'suomi', blurb: 'Crypts beneath Suomi older than the city. Something is waking at the bottom.', story: true },
  { id: 'greymarch', name: 'Greymarch Field', ...P(1060, 330), level: 6, near: 'coltale', blurb: 'The last battlefield of the war: a fenced mass grave the size of a farm.' },
  { id: 'weeping_glacier', name: 'The Weeping Glacier', ...P(1420, 110), level: 13, near: 'herstal', blurb: 'A glacier melting from the inside, with a lost expedition in the ice and a chapel underneath.' },
  { id: 'charmwright_grove', name: 'The Charmwright\'s Grove', ...P(1275, 545), level: 3, near: 'breda', blurb: 'A hollow oak in the Thornwood where the first warding charms were carved.' },
  { id: 'forgotten_workshop', name: 'The Forgotten Workshop', ...P(1660, 290), level: 7, near: 'tantal', blurb: 'A vine-swallowed hall in the eastern woods. The Tantal miners\' new shaft runs into its lower levels.' },
  { id: 'sunken_ferry', name: 'The Sunken Ferry', ...P(1250, 780), level: 5, near: 'largo', blurb: 'A war-time refugee ferry scuttled in the Aimo. On the wrong night its lanterns glow beneath the water.' },
  { id: 'erased_face', name: 'The Erased Face', ...P(1890, 650), level: 11, near: 'galilin', blurb: 'A sea-cliff carved into a giant profile, every feature chiselled away.' },
  { id: 'drowned_shrine', name: 'The Drowned Shrine', ...P(1470, 1170), level: 8, near: 'shpagin', blurb: 'A half-sunk stone shrine deep in the Mire, where water pours down through a grate nobody built.' },
  { id: 'greenspire', name: 'The Greenspire', ...P(870, 500), level: 12, near: 'borschardt', blurb: 'A green-glass tower on an island in the lake. Letters signed "Z" come from here.' },
  { id: 'treaty_stone', name: 'The Treaty Stone', ...P(500, 650), level: 6, near: 'samopal', blurb: 'The standing stone on the western border where the peace was signed.' },
  { id: 'peaks_lair', name: 'The Wyrm\'s Throat', ...P(930, 230), level: 17, near: 'nagant', blurb: 'A cave high in the Northern Peaks where the snow never settles. Something old breathes in there.' },
  { id: 'mire_depths', name: 'The Mire\'s Throat', ...P(1330, 1210), level: 19, near: 'shpagin', blurb: 'Where the Mire drinks. The water goes down, and down, and something drinks it.' },
];

/** Roads, in days of travel. */
export const ROADS: [string, string, number][] = [
  ['nagant', 'radom', 2], ['radom', 'samopal', 1], ['samopal', 'lebel', 2], ['lebel', 'carcano', 1], ['lebel', 'tokarev', 2],
  ['samopal', 'suomi', 2], ['borschardt', 'suomi', 1], ['borschardt', 'tokarev', 2], ['tokarev', 'largo', 1], ['largo', 'maxim', 1],
  ['suomi', 'breda', 1], ['breda', 'brumandell', 2], ['brumandell', 'coltale', 1], ['brumandell', 'tantal', 1], ['brumandell', 'herstal', 2],
  ['breda', 'galilin', 1], ['galilin', 'tantal', 2], ['galilin', 'madsen', 3], ['breda', 'rastbrook', 2], ['rastbrook', 'shpagin', 1],
  ['shpagin', 'madsen', 2], ['coltale', 'borschardt', 2], ['largo', 'suomi', 2], ['radom', 'borschardt', 2], ['breda', 'old_chapel', 1],
];

export const ALL_LOCS = (): Loc[] => TOWNS;
export const townById = (id: string) => TOWNS.find((t) => t.id === id);
export const poiById = (id: string) => POIS.find((p) => p.id === id);

/** Region (for encounters) from a map point. */
export function regionAt(x: number, y: number): 'peaks' | 'mire' | 'fields' | 'coast' | 'forest' {
  if (y < 0.2) return 'peaks';
  if (y > 0.72 && x > 0.6) return 'mire';
  if ((x > 0.38 && x < 0.58 && y > 0.6 && y < 0.75) || (x > 0.78 && y > 0.45 && y < 0.68)) return 'fields';
  if (x < 0.32 || x > 0.9) return 'coast';
  return 'forest';
}

export const daysBetween = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * 2000, (a.y - b.y) * 1500) / 190;
