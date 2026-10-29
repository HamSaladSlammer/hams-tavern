// Dungeons, ruins, camps and lairs: generated from a seed (so a reload rebuilds the same place),
// or built from the campaign's own designs for the story sites.
import type { Ctx, EncounterDef, Feature, Room } from '../content/types';
import type { SiteState } from '../engine/types';
import type { MapDef } from '../content/maps';
import { MAPS } from '../content/maps';
import { ROOMS } from '../content/world';
import { MONSTERS, ITEMS } from '../engine/srd';
import { next, type Rng } from '../engine/dice';
import { fmtMoney } from '../engine/character';
import { townById, poiById } from './atlas';

// ---------- themes ----------
interface Theme { label: string; outdoor: boolean; dark: boolean; pool: string[]; boss: string[]; props: string; names: [string[], string[]]; descs: Record<'entry' | 'hall' | 'side' | 'boss', string[]> }
export const THEMES: Record<string, Theme> = {
  barrow: { label: 'barrow', outdoor: false, dark: true, pool: ['skeleton', 'zombie', 'ghoul', 'shadow', 'specter', 'wight', 'mummy', 'revenant'], boss: ['ghast', 'wight', 'mummy', 'revenant', 'vampire'], props: 'SS::cP',
    names: [['The Weeping', 'The Hollow', 'The Old Kings\'', 'The Sunken', 'Grey', 'The Unnamed', 'Mosin\'s', 'Berdan\'s'], ['Barrow', 'Tomb', 'Crypt', 'Ossuary', 'Mound', 'Catacomb']],
    descs: { entry: ['A low stone passage. Roots hang through the ceiling like hair.', 'Steps down into cold air that smells of old earth.'], hall: ['Burial niches line the walls, and not all of them are full.', 'A long hall of coffins, lids pushed aside from inside.', 'Painted walls: a crowned woman, her face scraped away.'], side: ['A small chamber with a stone shelf of offerings.', 'A collapsed alcove. Something glints under the rubble.'], boss: ['The burial chamber. A great sarcophagus, open, and its occupant standing beside it.', 'The deepest room, where the cold comes from.'] } },
  ruin: { label: 'ruin', outdoor: false, dark: false, pool: ['bandit', 'giant_rat', 'giant_spider', 'wolf', 'ghoul', 'gargoyle', 'owlbear', 'ogre', 'troll'], boss: ['owlbear', 'ogre', 'troll', 'wyrm_young'], props: '::##Tb',
    names: [['The Broken', 'Old', 'The Burned', 'Krag\'s', 'Steyr', 'The Last', 'The Treaty'], ['Manor', 'Redoubt', 'Keep', 'Abbey', 'Fort', 'Watchtower', 'Hall']],
    descs: { entry: ['Fallen gates and a courtyard full of nettles.', 'A broken archway. The war came through here and kept going.'], hall: ['A roofless hall. Bullet holes in the plaster, old and new.', 'A collapsed floor and the cellar beneath it.', 'Long tables, overturned, and a smell of animal.'], side: ['A pantry with one shelf still standing.', 'A chapel no bigger than a cupboard.'], boss: ['The great hall. Bones on the floor, and something big sleeping on them.', 'The old commander\'s room. Something has made a lair of it.'] } },
  cave: { label: 'cave', outdoor: false, dark: true, pool: ['giant_rat', 'wolf', 'dire_wolf', 'giant_spider', 'brown_bear', 'owlbear', 'ogre', 'troll'], boss: ['brown_bear', 'owlbear', 'ogre', 'troll', 'wyrm_young', 'wyrm_adult'], props: 'rr::~',
    names: [['The Dripping', 'Bear', 'The Black', 'Wolfmouth', 'The Echoing', 'Mannlicher\'s'], ['Cave', 'Hollow', 'Grotto', 'Den', 'Hole']],
    descs: { entry: ['A cave mouth under a fallen oak. Fresh tracks lead in.', 'A crack in the hillside, wide enough to walk into.'], hall: ['A wide cavern. Water drips somewhere in the dark.', 'A tunnel of wet stone. Bones crunch underfoot.', 'A chamber hung with webs as thick as rope.'], side: ['A dead end with an old campfire and a dead man\'s pack.', 'A narrow pool, very cold.'], boss: ['The den. It stinks. It is occupied.', 'The deepest cavern, warm with breath.'] } },
  mine: { label: 'mine', outdoor: false, dark: true, pool: ['giant_rat', 'giant_spider', 'zombie', 'ghoul', 'shadow', 'gargoyle', 'wight'], boss: ['ghast', 'wight', 'troll', 'revenant'], props: 'bb::#',
    names: [['The Old', 'The Flooded', 'Number Nine', 'The Deep', 'Krag', 'Berdan'], ['Mine', 'Shaft', 'Diggings', 'Workings', 'Adit']],
    descs: { entry: ['A timbered adit with a rusted rail running into the dark.', 'A pithead, the winding gear fallen. Someone has cleared the entrance recently.'], hall: ['A gallery held up by old timbers that groan when you breathe.', 'A flooded working. The water is black and very still.', 'Ore carts, abandoned mid-shift. Lunch tins still in them.'], side: ['A foreman\'s cubby with a ledger and a strongbox.', 'A side tunnel, collapsed halfway.'], boss: ['The deepest working, where the miners broke into something that wasn\'t theirs.', 'A natural cavern the shaft broke into. Something lives here.'] } },
  bandit_camp: { label: 'camp', outdoor: true, dark: false, pool: ['bandit', 'thug', 'rifleman', 'smuggler', 'hired_gun'], boss: ['bandit_captain', 'hired_gun'], props: 'tbC"',
    names: [['Gasser\'s', 'The Red', 'Deserters\'', 'Lebel\'s', 'Mosin\'s', 'The Last Company\'s'], ['Camp', 'Hideout', 'Roost', 'Stockade', 'Den']],
    descs: { entry: ['A sentry post: a tarp, a rifle rest, and a fire someone just kicked out.', 'Trees cleared for a field of fire. Somebody here was a soldier.'], hall: ['Tents, cookfires, a line of stolen washing.', 'A palisade of sharpened stakes around a muddy yard.', 'Crates of stolen goods under oilcloth.'], side: ['A supply tent. Ammunition, salt pork, and a strongbox.', 'A latrine trench. You don\'t look too closely.'], boss: ['The captain\'s tent, with a real bed and a map table.', 'The command post: a dugout from the war, still in use.'] } },
  cult: { label: 'hideout', outdoor: false, dark: true, pool: ['cultist', 'cult_fanatic', 'ghoul', 'zombie', 'shadow', 'ghast', 'thornling'], boss: ['cult_fanatic', 'ghast', 'mire_hag', 'vampire'], props: 'cc::P',
    names: [['The Green', 'The Candle', 'The Bell-Ringers\'', 'The Quiet', 'The Pale'], ['Cellar', 'Chapel', 'House', 'Hollow', 'Lodge']],
    descs: { entry: ['A cellar door with a crowned skull scratched into the frame.', 'Stairs down. Green-black wax on every step.'], hall: ['A hall of candles burning the wrong colour.', 'Bunks for twenty. Most have been slept in.', 'A shrine: a crowned skull, a bell, a list of names.'], side: ['A storeroom of candles, thousands of them.', 'A cell. The door is open. Whoever was in it is gone.'], boss: ['The ritual chamber. A bell hangs over a grave that\'s been opened from below.', 'An altar of black wax, and a congregation that turns to look at you.'] } },
  mire: { label: 'mire', outdoor: true, dark: false, pool: ['drowned', 'bog_light', 'giant_spider', 'zombie', 'mire_hag', 'wyrm_young'], boss: ['mire_hag', 'wyrm_young'], props: '~~tr"',
    names: [['The Drowned', 'Hag\'s', 'The Sinking', 'The Grey-Lily', 'The Bog-Light'], ['Hollow', 'Island', 'Hut', 'Pool', 'Village']],
    descs: { entry: ['Black water, grey lilies, and a path of sunken planks.', 'A pole-barge mooring, the barge long gone.'], hall: ['Stilt-houses half under water. Nothing living moves.', 'A causeway through reeds taller than you.', 'A ring of standing stones up to their waists in water.'], side: ['A hut on stilts with a cooking pot still warm.', 'A little island with a cairn on it.'], boss: ['The heart of the hollow, where the water pours down and doesn\'t come back.', 'A hut built from boat timbers and bones. Someone is home.'] } },
  battlefield: { label: 'battlefield', outdoor: true, dark: false, pool: ['zombie', 'skeleton', 'ghoul', 'revenant', 'wight', 'specter'], boss: ['revenant', 'wight', 'death_knight'], props: 'gg::C',
    names: [['The Second', 'Hill', 'The Long', 'The Red', 'Krag'], ['Trench', 'Line', 'Field', 'Redoubt', 'Crater']],
    descs: { entry: ['A trench line, half filled with fifteen years of leaves.', 'A cratered field. The craters have their own small graves.'], hall: ['Barbed wire rusted into the earth, and shapes caught on it.', 'A communication trench. Helmets on stakes mark the dead.', 'A field gun on its side, its crew still at their posts.'], side: ['A dugout with letters nobody sent.', 'A shell hole full of rainwater and medals.'], boss: ['The command redoubt, where the last stand happened. Somebody is still standing.'] } },
};

const MODERATE = [0, 75, 150, 225, 375, 750, 1000, 1300, 1700, 2000, 2300, 2900, 3700, 4200, 4900, 5400, 6100, 7800, 8600, 9600, 11200];
const LOOT_TIERS: string[][] = [
  ['potion_healing', 'silver_locket', 'war_medal', 'silvered_dagger', 'webley_revolver', 'carcano_carbine', 'studded_leather', 'potion_healing'],
  ['potion_greater', 'gold_ring', 'jade_idol', 'longsword_plus1', 'rapier_plus1', 'greataxe_plus1', 'sabre_plus1', 'revolver_plus1', 'breastplate', 'half_plate', 'mosin_rifle', 'lee_rifle', 'ring_protection', 'cloak_protection', 'suomi_smg', 'amulet_drunkard'],
  ['potion_superior', 'warhammer_plus2', 'dagger_plus2', 'rifle_plus2', 'plate', 'elven_chain', 'madsen_gun', 'crown_bond'],
  ['potion_supreme', 'greatsword_plus3', 'potion_supreme'],
];

// ---------- seeded rng helpers ----------
const R = (seed: number): Rng => ({ state: seed >>> 0 });
const ri = (r: Rng, n: number) => Math.floor(next(r) * n);
const rp = <T>(r: Rng, a: T[]) => a[ri(r, a.length)];

export function siteName(seed: number, kind: string): string {
  const r = R(seed * 7 + 3);
  const t = THEMES[kind] ?? THEMES.ruin;
  return `${rp(r, t.names[0])} ${rp(r, t.names[1])}`;
}

/** Build monsters for an XP budget. */
export function buildFoes(r: Rng, pool: string[], level: number, mult: number): [string, number][] {
  const budget = MODERATE[Math.max(1, Math.min(20, level))] * mult;
  const maxCr = Math.max(0.25, level / 2 + 0.5);
  const fits = pool.filter((id) => MONSTERS[id] && (MONSTERS[id].cr ?? 1) <= maxCr).sort((a, b) => MONSTERS[b].xp - MONSTERS[a].xp);
  const usable = fits.length ? fits : [pool.slice().sort((a, b) => MONSTERS[a].xp - MONSTERS[b].xp)[0]];
  const out: Record<string, number> = {};
  let left = budget; let count = 0;
  while (count < 6) {
    const cands = usable.filter((id) => MONSTERS[id].xp <= left * (count ? 1 : 1.3));
    if (!cands.length) break;
    const id = count === 0 ? cands[ri(r, Math.min(2, cands.length))] : rp(r, cands);
    out[id] = (out[id] ?? 0) + 1;
    left -= MONSTERS[id].xp * (count ? 1.2 : 1);
    count += 1;
  }
  if (!count) out[usable[usable.length - 1]] = 1;
  return Object.entries(out);
}

function bossFor(r: Rng, t: Theme, level: number): string {
  const sorted = t.boss.filter((id) => MONSTERS[id]).sort((a, b) => (MONSTERS[a].cr ?? 0) - (MONSTERS[b].cr ?? 0));
  const fit = sorted.filter((id) => (MONSTERS[id].cr ?? 0) <= level + 1);
  return fit.length ? fit[fit.length - 1] : sorted[0];
}

export function lootFor(r: Rng, level: number, big: boolean): { cp: number; items: string[] } {
  const tier = level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;
  const cp = Math.round((level * (big ? 2500 : 600) + ri(r, level * (big ? 3000 : 800))) / 10) * 10;
  const items: string[] = [];
  if (next(r) < (big ? 0.9 : 0.35)) items.push(rp(r, LOOT_TIERS[tier]));
  if (big && next(r) < 0.4 && tier > 0) items.push(rp(r, LOOT_TIERS[tier - 1]));
  if (next(r) < 0.3) items.push(tier >= 2 ? 'potion_greater' : 'potion_healing');
  return { cp, items: items.filter((i) => ITEMS[i]) };
}

// ---------- map generation ----------
function makeMap(r: Rng, t: Theme, role: 'entry' | 'hall' | 'side' | 'boss', doors: { back: boolean; fwd: boolean; side: boolean }): MapDef {
  const w = 13 + ri(r, 5), h = 8 + ri(r, 3);
  const wall = t.outdoor ? 't' : '#';
  const floor = t.outdoor ? (t.label === 'mire' ? '"' : ',') : '.';
  const g: string[][] = [];
  for (let y = 0; y < h; y++) { g.push([]); for (let x = 0; x < w; x++) g[y].push(y === 0 || x === 0 || y === h - 1 || x === w - 1 ? wall : floor); }
  // irregular edges
  for (let i = 0; i < w; i++) if (next(r) < 0.3) g[1][i] = i > 0 && i < w - 1 ? wall : g[1][i];
  for (let i = 0; i < w; i++) if (next(r) < 0.25 && i > 0 && i < w - 1) g[h - 2][i] = wall;
  const midX = Math.floor(w / 2);
  // doors: back (0) at bottom, forward (1) at top, side (2) on the left
  if (doors.back) { g[h - 1][midX] = '0'; g[h - 2][midX] = floor; g[h - 2][midX - 1] = floor; g[h - 2][midX + 1] = floor; }
  if (doors.fwd) { const fx = 2 + ri(r, w - 4); g[0][fx] = '1'; g[1][fx] = floor; }
  if (doors.side) { const sy = 2 + ri(r, h - 4); g[sy][0] = '2'; g[sy][1] = floor; }
  // props
  const n = 4 + ri(r, 6);
  for (let i = 0; i < n; i++) {
    const x = 2 + ri(r, w - 4), y = 2 + ri(r, h - 4);
    if (Math.abs(x - midX) <= 1 && y >= h - 3) continue;
    g[y][x] = rp(r, t.props.split(''));
    if (g[y][x] === '#' && x + 1 < w - 1) g[y][x + 1] = '#';
  }
  // spawns
  g[h - 2][midX] = '@'; if (g[h - 2][midX + 1] === floor) g[h - 2][midX + 1] = 'k';
  const foes = role === 'side' ? 1 : role === 'boss' ? 4 : 3;
  for (let i = 0; i < foes; i++) {
    for (let tries = 0; tries < 20; tries++) { const x = 1 + ri(r, w - 2), y = 1 + ri(r, Math.max(1, Math.floor(h / 2))); if (g[y][x] === floor) { g[y][x] = 'x'; break; } }
  }
  if (role !== 'entry') for (let tries = 0; tries < 20; tries++) { const x = 1 + ri(r, w - 2), y = 1 + ri(r, h - 3); if (g[y][x] === floor) { g[y][x] = 'b'; break; } }
  // make sure every door and spawn can reach the start: carve a corridor from @ to each
  const start = { x: midX, y: h - 2 };
  const carve = (tx: number, ty: number) => { let x = start.x, y = start.y; while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); if (g[y][x] === wall || /[TbSPArgcC#~;:]/.test(g[y][x])) if (x > 0 && y > 0 && x < w - 1 && y < h - 1) g[y][x] = floor; } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (/[0-9x]/.test(g[y][x])) { const ty = y === 0 ? 1 : y === h - 1 ? h - 2 : y; const tx = x === 0 ? 1 : x === w - 1 ? w - 2 : x; carve(tx, ty); }
  return { rows: g.map((row) => row.join('')), dark: t.dark, props: { b: 'chest', S: 'sarcophagi', ':': 'rubble', c: 'candles', t: 'trees', r: 'rocks', '~': 'water', g: 'graves', P: 'pews', T: 'table' } };
}

// ---------- story sites: the campaign's own designs ----------
export interface StoryRoom { name: string; desc: string; foes: [string, number][]; loot?: { cp: number; items: string[]; note?: string }; outdoor?: boolean }
export interface StorySite { theme: string; rooms: StoryRoom[]; onClear: (c: Ctx) => void; minLevel?: number }

let STORY: Record<string, StorySite> = {};
export function registerStory(s: Record<string, StorySite>) { STORY = s; }

// ---------- building rooms ----------
const roomId = (site: SiteState, i: number) => `site:${site.id}:${i}`;

export function ensureSiteRooms(site: SiteState, onCleared: (c: Ctx, site: SiteState) => void) {
  if (ROOMS[roomId(site, 0)]) return;
  const story = site.poi ? STORY[site.poi] : undefined;
  const t = THEMES[story?.theme ?? site.kind] ?? THEMES.ruin;
  const r = R(site.seed);
  const n = story ? story.rooms.length : site.rooms;
  const exitBack = (i: number) => (i === 0 ? `travel:${site.near}` : roomId(site, i - 1));
  const backLabel = (i: number) => (i === 0 ? `Leave (toward ${townById(site.near)?.name ?? 'the road'})` : 'Back the way you came');
  const sideAt = !story && n >= 4 ? 1 + ri(r, n - 2) : -1;
  for (let i = 0; i < n; i++) {
    const isBoss = i === n - 1;
    const role: 'entry' | 'hall' | 'boss' = i === 0 ? 'entry' : isBoss ? 'boss' : 'hall';
    const sr = story?.rooms[i];
    const map = makeMap(r, sr?.outdoor ? THEMES.battlefield : t, role, { back: true, fwd: !isBoss, side: i === sideAt });
    const id = roomId(site, i);
    MAPS[id] = map;
    const lvl = Math.max(site.level, 1);
    const foes = sr ? sr.foes : isBoss ? [[bossFor(r, t, lvl), 1] as [string, number], ...buildFoes(r, t.pool, lvl, 0.5)] : (i === 0 && next(r) < 0.3 ? [] : buildFoes(r, t.pool, lvl, 0.8));
    const loot = sr?.loot ?? (isBoss ? lootFor(r, lvl, true) : next(r) < 0.45 ? lootFor(r, lvl, false) : null);
    const desc = sr?.desc ?? rp(r, t.descs[role]);
    const name = sr?.name ?? `${site.name}${i === 0 ? '' : ` — ${isBoss ? 'the depths' : ['the passage', 'the hall', 'the lower rooms', 'the far chambers', 'the old rooms'][i % 5]}`}`;
    const exits: Room['exits'] = [{ to: exitBack(i), names: ['back', 'out', 'leave', 'exit', 'down', 'south', 'return'], label: backLabel(i), minutes: 1 }];
    if (!isBoss) exits.push({ to: roomId(site, i + 1), names: ['on', 'forward', 'onward', 'deeper', 'in', 'inside', 'next', 'north', 'up', 'further'], label: 'Deeper in', minutes: 1, blocked: (c) => (foes.length && !c.flag(`${id}_cleared`) && !c.flag(`${id}_snuck`) ? 'You\'d have to get past them first. (Fight, sneak past, or talk.)' : null) });
    const feats: Feature[] = [];
    if (loot) {
      const lootKey = `${id}_looted`;
      const takeLoot = (c: Ctx) => {
        if (c.flag(lootKey)) { c.narr('Empty. You already cleaned it out.'); return; }
        if (foes.length && !c.flag(`${id}_cleared`)) { c.narr('Not with them watching.'); return; }
        c.set(lootKey, true);
        c.money(loot.cp);
        for (const it of loot.items) c.give(it);
        c.good(`You find ${fmtMoney(loot.cp)}${loot.items.length ? `, and ${loot.items.map((x) => ITEMS[x]?.name ?? x).join(', ')}` : ''}.`);
        if ((loot as { note?: string }).note) c.narr((loot as { note?: string }).note!);
      };
      feats.push({ id: 'chest', names: ['chest', 'strongbox', 'coffer', 'box', 'loot', 'treasure', 'cache', 'crate', 'barrel'], look: (c) => (c.flag(lootKey) ? 'An empty strongbox.' : 'An iron-bound strongbox, or what passes for one here.'), open: (c) => takeLoot(c), search: (c) => takeLoot(c), take: (c) => takeLoot(c) });
    }
    if (i === sideAt) {
      const sid = `${id}_side`;
      exits.push({ to: sid, names: ['side', 'left', 'side passage', 'alcove', 'west'], label: 'Side passage', minutes: 1 });
      const sl = lootFor(r, lvl, false);
      MAPS[sid] = makeMap(r, t, 'side', { back: true, fwd: false, side: false });
      ROOMS[sid] = { id: sid, name: `${site.name} — a side chamber`, region: site.name, desc: () => rp(R(site.seed + i), t.descs.side), exits: [{ to: id, names: ['back', 'out', 'leave', 'return'], label: 'Back', minutes: 1 }], features: [{ id: 'cache', names: ['cache', 'chest', 'rubble', 'shelf', 'pack', 'loot', 'treasure'], look: () => 'Something worth taking, maybe.', search: (c) => { if (c.flag(`${sid}_looted`)) { c.narr('Nothing left.'); return; } c.set(`${sid}_looted`, true); c.money(sl.cp); for (const it of sl.items) c.give(it); c.good(`You find ${fmtMoney(sl.cp)}${sl.items.length ? ` and ${sl.items.map((x) => ITEMS[x]?.name).join(', ')}` : ''}.`); } }], rest: 'short' };
    }
    ROOMS[id] = {
      id, name, region: site.name, outdoors: t.outdoor || !!sr?.outdoor, rest: 'short',
      desc: (c) => `${desc}${foes.length && !c.flag(`${id}_cleared`) ? '' : c.flag(`${id}_cleared`) && foes.length ? ' It\'s quiet now.' : ''}`,
      exits, features: feats,
      onEnter: (c) => {
        if (!foes.length || c.flag(`${id}_cleared`) || c.s.combat) { if (!foes.length && isBoss && !site.cleared) onCleared(c, site); return; }
        const enc: EncounterDef = {
          id: `enc_${id}`, foes, fleeTo: exitBack(i).startsWith('travel:') ? (townById(site.near)?.hub ?? 'breda_square') : exitBack(i), ambush: next(R(site.seed + i * 13)) < 0.15,
          intro: isBoss ? `${MONSTERS[foes[0][0]]?.name ?? 'Something'} is waiting for you.` : rp(R(site.seed + i), ['They\'ve heard you coming.', 'Movement in the dark ahead.', 'You aren\'t alone in here.', 'Something turns toward you.']),
          onWin: (cc) => { cc.set(`${id}_cleared`, true); if (isBoss) onCleared(cc, site); },
        };
        c.fight(enc);
      },
      chips: (c) => [...(loot && !c.flag(`${id}_looted`) && (!foes.length || c.flag(`${id}_cleared`)) ? ['search the chest'] : []), ...(isBoss ? [] : ['go deeper']), 'go back'],
    };
  }
}

export function siteHub(site: SiteState) { return roomId(site, 0); }
export { STORY };
export const poiName = (id: string) => poiById(id)?.name ?? id;
