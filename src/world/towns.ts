// Every town on the map gets a square, an inn and a market, with people in them. Built from
// each town's identity in the campaign, and deterministic: the same innkeeper every visit.
import type { Ctx, Npc, Room, ShopItem } from '../content/types';
import { ROOMS } from '../content/world';
import { NPCS, MENU } from '../content/npcs';
import { MAPS } from '../content/maps';
import { next, pick, type Rng } from '../engine/dice';
import { TOWNS, townById, type Loc } from './atlas';

export interface TownHooks {
  rumour(c: Ctx, town: string): void;
  board(c: Ctx, town: string): void;
  forSale(c: Ctx, town: string): void;
  arrive(c: Ctx, town: string): void;
}
let HOOKS: TownHooks = { rumour: () => {}, board: () => {}, forSale: () => {}, arrive: () => {} };
export function bindTownHooks(h: TownHooks) { HOOKS = h; }

const R = (seed: number): Rng => ({ state: seed >>> 0 });
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const FIRST = ['Anka', 'Bohdan', 'Ilse', 'Mirek', 'Vera', 'Oskar', 'Lida', 'Tomas', 'Hana', 'Pavel', 'Dorota', 'Emil', 'Greta', 'Jarek', 'Kasia', 'Lev', 'Magda', 'Nils', 'Olga', 'Radek', 'Sabina', 'Teodor', 'Una', 'Viktor', 'Zofia', 'Aleks', 'Brana', 'Ctibor', 'Danuta', 'Fenna'];
const LAST = ['Kowal', 'Brenner', 'Mlynar', 'Steyr', 'Haas', 'Vogt', 'Krupa', 'Lisek', 'Novak', 'Ostrow', 'Pekar', 'Rybak', 'Sokol', 'Tesar', 'Urban', 'Wolny', 'Zeman', 'Berdan', 'Krag', 'Mannlich'];
const KINDS = ['human', 'elf', 'dwarf', 'half-orc', 'halfling', 'goblin', 'tiefling', 'gnome', 'orc'];
const QUIRKS = ['polishes the same glass whenever the war comes up', 'laughs too loudly at their own jokes', 'keeps a revolver in oilcloth under the counter, like everybody', 'has a scar they won\'t explain', 'is far too cheerful for this decade', 'speaks very softly, so you lean in', 'counts your coins twice, out loud', 'has a cat on their shoulder that judges you', 'hums an old marching song without noticing', 'calls everyone "love"'];
const INN_A = ['The Rusty', 'The Drowsy', 'The Red', 'The Last', 'The Crooked', 'The Treaty', 'The Lucky', 'The Black', 'The Laughing', 'The Spent'];
const INN_B = ['Cartridge', 'Lantern', 'Mug', 'Bayonet', 'Goose', 'Bell', 'Barrel', 'Kettle', 'Stag', 'Anchor'];

const CANON_INN: Record<string, { name: string; keeper: string; look: string }> = {
  brumandell: { name: 'Grog\'s Tavern and Alehouse', keeper: 'Grog', look: 'Tall, grey-skinned and very accommodating, with a voice like gravel and an apron spotless enough for surgery. Grog\'s clam chowder is famous.' },
};

interface Specialty { shop: string[]; label: string }
const SPECIALTY: Record<string, Specialty> = {
  suomi: { label: 'Silverwright & Apothecary', shop: ['rapier', 'longsword', 'silvered_dagger', 'potion_healing', 'potion_greater', 'fine_clothes', 'breastplate', 'shortbow', 'longbow', 'elven_chain'] },
  borschardt: { label: 'Fine Arms & Sundries', shop: ['toggle_pistol', 'webley_revolver', 'pistol_cartridge', 'rapier', 'fine_clothes', 'potion_healing', 'potion_greater', 'ring_protection', 'half_plate'] },
  tokarev: { label: 'Tokarev Works Outlet', shop: ['service_revolver', 'officers_pistol', 'service_rifle', 'mosin_rifle', 'lee_rifle', 'carcano_carbine', 'pistol_cartridge', 'rifle_cartridge', 'bayonet', 'breastplate', 'plate', 'splint'] },
  largo: { label: 'Dockside "Fish" Merchant', shop: ['webley_revolver', 'arisaka_carbine', 'pistol_cartridge', 'rifle_cartridge', 'dagger', 'rope', 'potion_healing', 'thieves_tools', 'suomi_smg'] },
  coltale: { label: 'Veterans\' Surplus', shop: ['service_rifle', 'service_revolver', 'bayonet', 'chain_mail', 'chain_shirt', 'shield', 'rifle_cartridge', 'pistol_cartridge', 'silvered_shortsword', 'potion_healing'] },
  brumandell: { label: 'Brumandell Market', shop: ['rations', 'rope', 'torch', 'lantern', 'potion_healing', 'leather_armor', 'studded_leather', 'shortbow', 'arrow', 'handaxe', 'spear', 'greataxe'] },
  madsen: { label: 'Harbour Imports', shop: ['madsen_gun', 'lee_rifle', 'arisaka_carbine', 'rifle_cartridge', 'pistol_cartridge', 'jade_idol', 'potion_greater', 'rope'] },
  galilin: { label: 'Caravan Market', shop: ['rations', 'rope', 'scales', 'lantern', 'potion_healing', 'longbow', 'arrow', 'breastplate', 'marked_cards'] },
  radom: { label: 'Licensed Arms Registry', shop: ['service_revolver', 'service_rifle', 'pistol_cartridge', 'rifle_cartridge', 'chain_mail', 'shield', 'longsword'] },
  herstal: { label: 'Cold-Weather Outfitter', shop: ['travel_cloak', 'rations', 'rope', 'lantern', 'potion_healing', 'greataxe', 'spear', 'chain_shirt'] },
};
const GENERAL: string[] = ['rations', 'rope', 'torch', 'lantern', 'potion_healing', 'dagger', 'spear', 'shortbow', 'arrow', 'leather_armor', 'pistol_cartridge', 'rifle_cartridge', 'crowbar'];

function townPeople(t: Loc) {
  const r = R(hash(t.id));
  const name = () => `${pick(r, FIRST)} ${pick(r, LAST)}`;
  const canon = CANON_INN[t.id];
  return {
    inn: canon?.name ?? `${pick(r, INN_A)} ${pick(r, INN_B)}`,
    keeper: canon?.keeper ?? name(),
    keeperKind: pick(r, KINDS),
    keeperQuirk: pick(r, QUIRKS),
    keeperLook: canon?.look,
    merchant: name(),
    merchantKind: pick(r, KINDS),
    merchantQuirk: pick(r, QUIRKS),
    captain: name(),
  };
}

const sizeWord = (t: Loc) => (t.kind === 'capital' ? 'a capital' : t.kind === 'city' ? 'a city' : t.kind === 'town' ? 'a town' : 'a village');

function makeNpc(id: string, name: string, short: string, look: string, greet: string[], topics: Npc['topics'], extra: Partial<Npc> = {}): Npc {
  const names = [name.toLowerCase(), name.split(' ')[0].toLowerCase(), name.split(' ').slice(-1)[0].toLowerCase(), ...(extra.names ?? [])];
  return { id, name, short, look: () => look, greet: (c) => c.say(id, pick(c.rng, greet)), topics, unknown: ['"Couldn\'t tell you."', '"Not my business, friend."', 'They shrug.'], fightAs: 'militia', ...extra, names: Array.from(new Set(names)) } as Npc;
}

export function ensureTown(id: string) {
  const t = townById(id);
  if (!t || id === 'breda' || ROOMS[`town:${id}:square`]) return;
  const p = townPeople(t);
  const sq = `town:${id}:square`, inn = `town:${id}:inn`, mkt = `town:${id}:market`;
  const keeperId = `${id}_keeper`, merchId = `${id}_merchant`, watchId = `${id}_watch`;
  const spec = SPECIALTY[id];
  const shopList: ShopItem[] = (spec?.shop ?? GENERAL).map((x) => ({ id: x }));
  const r = R(hash(id) + 99);
  // ---- people ----
  NPCS[keeperId] = makeNpc(keeperId, p.keeper, `the ${p.keeperKind} who runs ${p.inn}`, p.keeperLook ?? `A ${p.keeperKind} innkeeper who ${p.keeperQuirk}.`,
    [`"Welcome to ${p.inn}. Sit anywhere that isn't on fire."`, '"You look like the road chewed you. Sit."', `"${t.name} doesn't get many visitors. Even fewer that pay."`],
    [
      { id: 'rumor', keys: ['rumor', 'rumour', 'rumors', 'rumours', 'news', 'gossip', 'heard', 'anything new', 'going on', 'trouble', 'work', 'jobs'], chip: 'Ask for rumours', say: (c) => HOOKS.rumour(c, id) },
      { id: 'town', keys: [t.name.toLowerCase(), 'town', 'city', 'village', 'here', 'this place', 'about'], chip: `Ask about ${t.name}`, say: (c) => c.say(keeperId, `"${pick(c.rng, t.lore)}"`) },
      { id: 'room', keys: ['room', 'bed', 'sleep', 'stay', 'lodging'], say: (c) => c.say(keeperId, '"Room\'s twenty copper a night, floor\'s five. Say "sleep" when you\'re ready."') },
      { id: 'menu', keys: ['menu', 'food', 'drink', 'ale', 'eat', 'beer'], say: (c) => c.say(keeperId, `"Ale's five copper. ${id === 'brumandell' ? 'The chowder will change your life.' : 'Stew\'s fine.'} Type "shop" to see it all."`) },
      { id: 'bell', keys: ['bell', 'bells', 'queen', 'pale', 'dead', 'undead', 'cult'], say: (c) => c.say(keeperId, pick(c.rng, ['"We don\'t talk about bells in here."', '"The dead walk the roads more than they used to. Travel by day."', '"Green candles. If you see them, walk the other way."'])) },
    ],
    { shop: [{ id: 'ale', price: 5 }, { id: 'stew', price: 5 }, { id: 'meat_pie', price: 8 }, { id: 'roast_chicken', price: 25 }, { id: 'trenchfire', price: 5 }, { id: 'room_floor', price: 5 }, { id: 'room_private', price: 20 }], buys: [], names: ['innkeeper', 'barkeep', 'bartender', 'keeper', 'landlord'], fightAs: 'thug' });
  NPCS[merchId] = makeNpc(merchId, p.merchant, `${spec?.label ?? 'the general merchant'}`, `A ${p.merchantKind} merchant who ${p.merchantQuirk}.`,
    ['"Buying or browsing? Browsing costs nothing. Buying costs more."', `"Best prices in ${t.name}. Possibly the only prices."`, '"Mind the stock."'],
    [{ id: 'town', keys: [t.name.toLowerCase(), 'town', 'news', 'rumor', 'rumour'], say: (c) => c.say(merchId, `"${pick(c.rng, t.lore)}"`) }],
    { shop: shopList, buys: ['any'], names: ['merchant', 'shopkeeper', 'trader', 'seller', 'vendor'], fightAs: 'bandit' });
  NPCS[watchId] = makeNpc(watchId, `Watch-Captain ${p.captain.split(' ')[1]}`, `captain of the ${t.name} watch`, 'A tired officer with a good coat and a bad knee.',
    ['"Keep your weapons sheathed and we\'ll get on fine."', '"Papers? No? Fine. Behave."'],
    [{ id: 'trouble', keys: ['trouble', 'crime', 'bandits', 'monsters', 'dead', 'work', 'bounty', 'bounties'], say: (c) => HOOKS.rumour(c, id) }, { id: 'town', keys: [t.name.toLowerCase(), 'town', 'about'], say: (c) => c.say(watchId, `"${pick(c.rng, t.lore)}"`) }],
    { names: ['captain', 'watch', 'guard', 'guards', 'watchman'], fightAs: 'sergeant' });
  // ---- rooms ----
  const outdoorsWord = t.kind === 'capital' ? 'white stone and green copper roofs' : t.kind === 'city' ? 'stone, smoke and noise' : 'mud, timber and woodsmoke';
  ROOMS[sq] = {
    id: sq, name: `${t.name} — ${t.kind === 'capital' || t.kind === 'city' ? 'the Market Square' : 'the Square'}`, region: t.name, outdoors: true,
    desc: (c) => `${t.name}: ${sizeWord(t)} of ${outdoorsWord}. ${t.blurb} ${c.timeOfDay() === 'night' || c.timeOfDay() === 'midnight' ? 'At this hour the square is shuttered, lit by one lamp outside ' + p.inn + '.' : 'People going about their business, and a few watching you go about yours.'} A notice board stands by ${p.inn}.`,
    exits: [
      { to: inn, names: ['inn', 'tavern', p.inn.toLowerCase(), 'pub', 'bar', 'in', 'inside'], label: p.inn, minutes: 1 },
      { to: mkt, names: ['market', 'shop', 'store', 'merchant', (spec?.label ?? 'market').toLowerCase()], label: spec?.label ?? 'Market', minutes: 2 },
    ],
    npcs: () => [watchId],
    features: [
      { id: 'board', names: ['notice board', 'board', 'notices', 'jobs', 'postings', 'notice', 'bounties'], look: () => 'A notice board, layered with postings.', read: (c) => HOOKS.board(c, id), search: (c) => HOOKS.board(c, id) },
      { id: 'forsale', names: ['for sale', 'property', 'empty building', 'land', 'deeds', 'notary'], look: () => 'A few buildings around the square have FOR SALE chalked on their shutters.', read: (c) => HOOKS.forSale(c, id), search: (c) => HOOKS.forSale(c, id) },
    ],
    onEnter: (c) => HOOKS.arrive(c, id),
    chips: () => ['read the notice board', `go to ${p.inn}`, 'explore the area', 'open the map'],
  };
  ROOMS[inn] = {
    id: inn, name: p.inn, region: t.name, rest: 'long', shop: keeperId,
    desc: (c) => `${p.inn}: ${pick(R(hash(id) + 5), ['low beams and a long bar', 'a warm room that smells of onions and pipe smoke', 'tables scarred by knives and cards', 'a fire, a fiddle, and too many elbows'])}. ${c.timeOfDay() === 'evening' || c.timeOfDay() === 'night' ? 'It\'s busy tonight.' : 'A few regulars nurse their drinks.'}`,
    exits: [{ to: sq, names: ['out', 'outside', 'square', 'leave', 'exit', 'street', 'door'], label: 'Out to the square', minutes: 1 }],
    npcs: () => [keeperId],
    features: [{ id: 'hearth', names: ['hearth', 'fire', 'fireplace'], look: () => 'A good fire. Someone has carved initials into every stone of the mantel.' }],
    chips: () => [`talk to ${p.keeper.split(' ')[0]}`, 'ask for rumours', 'shop', 'sleep'],
  };
  ROOMS[mkt] = {
    id: mkt, name: `${t.name} — ${spec?.label ?? 'the Market'}`, region: t.name, shop: merchId,
    desc: () => `${spec?.label ?? 'A general store'}: shelves of ${spec ? 'specialist stock' : 'everything a traveller forgets to bring'}. ${p.merchant} watches you from behind the counter.`,
    exits: [{ to: sq, names: ['out', 'outside', 'square', 'leave', 'exit', 'street'], label: 'Out to the square', minutes: 1 }],
    npcs: () => [merchId],
    chips: () => ['shop', 'sell'],
  };
  // ---- maps ----
  const rr = () => next(r);
  MAPS[sq] = { rows: squareMap(t.kind === 'capital' || t.kind === 'city', rr), npcs: { q: watchId } };
  MAPS[inn] = { rows: ['#####=####=#####', '#H.............#', '#H..sTTs..sTTs.#', '#..............#', '#..sTTs..sTTs..#', '#..............#', '#BBBBBB...@.k..#', '#.q...B........#', '#######0########'], npcs: { q: keeperId } };
  MAPS[mkt] = { rows: ['############', '#KKKKKKKK.b#', '#.........b#', '#.BBBBB....#', '#.B.m.B....#', '#..........#', '#bb..@.k...#', '#####0######'], npcs: { m: merchId } };
}

function squareMap(big: boolean, rnd: () => number): string[] {
  // 0 inn, 1 market
  const rows = big
    ? ['##################', '#,,,,,,,,,,,,,,,,#', '#,####,,,,,,####,#', '#,##0#,,,,,,#1##,#', '#,,,,,,,,,,,,,,,,#', '#,,,,,,,ww,,,,,,,#', '#,,C,,,,ww,,,q,,,#', '#,,,,,,,,,,,,,,,,#', '#,,,,,,,@,k,,,,,,#', '##################']
    : ['################', '#,,,,,,,,,,,,,,#', '#,###,,,,,,###,#', '#,#0#,,,,,,#1#,#', '#,,,,,,ww,,,,,,#', '#,,C,,,ww,,,q,,#', '#,,,,,,,,,,,,,,#', '#,,,,,,@,k,,,,,#', '################'];
  void rnd;
  return rows;
}

export const townHub = (id: string) => (id === 'breda' ? 'breda_square' : `town:${id}:square`);
export function townOfRoom(roomId: string): string | null {
  const m = roomId.match(/^town:([a-z_]+):/);
  if (m) return m[1];
  if (['breda_square', 'tavern', 'goods', 'smithy', 'tailor', 'east_farms', 'thatch_barn', 'south_road'].includes(roomId)) return 'breda';
  if (['thornwood', 'kessels_rest', 'foothills', 'chapel_yard', 'nave', 'vestry', 'tower', 'crypt'].includes(roomId)) return 'old_chapel';
  return null;
}
export { TOWNS };
void MENU;
