// The open world: travel across Jared's map of Lahti, discovery, rumours, notice-board jobs,
// threats that advance on their own, the story beyond the bells, and property you can own.
import type { Ctx, Room } from '../content/types';
import type { GameState, Job, Property, SiteState, WorldState, Front, Hire, DamageType } from '../engine/types';
import { ROOMS } from '../content/world';
import { NPCS } from '../content/npcs';
import { MAPS } from '../content/maps';
import { MONSTERS, ITEMS } from '../engine/srd';
import { die, next, pick } from '../engine/dice';
import { fmtMoney, hasItem } from '../engine/character';
import { maybeLevel } from '../content/npcs';
import { COMPANIONS } from '../engine/combat';
import { TOWNS, POIS, ROADS, townById, poiById, regionAt, daysBetween, type Loc, type Poi } from './atlas';
import { ensureTown, bindTownHooks, townHub, townOfRoom } from './towns';
import { ensureSiteRooms, siteName, siteHub, registerStory, buildFoes, THEMES, type StorySite } from './sites';

// ---------- state ----------
/** A different world is loading: forget the rooms that belonged to the last one. */
export function resetProcedural() {
  for (const k of Object.keys(ROOMS)) if (k.startsWith('site:') || k.startsWith('prop:')) delete ROOMS[k];
  for (const k of Object.keys(MAPS)) if (k.startsWith('site:') || k.startsWith('prop:')) delete MAPS[k];
  for (const k of Object.keys(NPCS)) if (k.startsWith('hire_')) delete NPCS[k];
  for (const k of Object.keys(ROOMS)) { const r = ROOMS[k]; if (r && /^(town:[a-z_]+:square|breda_square)$/.test(k)) r.exits = r.exits.filter((e) => !e.to.startsWith('prop:')); }
}

export function newWorld(seed: number, at = 'breda'): WorldState {
  resetProcedural();
  return { at, visited: [at], found: [], sites: {}, journey: null, jobs: [], fronts: initialFronts(), properties: [], nextId: 1, seed, renown: 0 };
}
function initialFronts(): Record<string, Front> {
  return {
    bells: { id: 'bells', name: 'The Bells of Lahti', clock: 2, max: 12, active: true, lastTick: 0, omens: [] },
    treaty: { id: 'treaty', name: 'The Breaking of the Treaty', clock: 0, max: 10, active: false, lastTick: 0, omens: [] },
    drinker: { id: 'drinker', name: 'The Drinker Below', clock: 0, max: 12, active: false, lastTick: 0, omens: [] },
  };
}
const W = (c: Ctx): WorldState => c.s.world;
const dayOf = (s: GameState) => Math.floor((s.minutes + 480) / 1440);
const S = (seed: number) => ({ state: seed >>> 0 });

// ---------- where things are ----------
export function locPoint(s: GameState, id: string): { x: number; y: number } | null {
  const t = townById(id); if (t) return t;
  const p = poiById(id); if (p) return p;
  const site = s.world.sites[id]; if (site) return site;
  return null;
}
export function locName(s: GameState, id: string): string { return townById(id)?.name ?? poiById(id)?.name ?? s.world.sites[id]?.name ?? id; }

/** Make sure procedural rooms for this id exist (after a reload, or before moving in). */
export function ensureRoom(s: GameState, roomId: string) {
  if (ROOMS[roomId]) return;
  const t = roomId.match(/^town:([a-z_]+):/); if (t) { ensureTown(t[1]); return; }
  const m = roomId.match(/^site:([^:]+):/);
  if (m) { const site = s.world.sites[m[1]]; if (site) ensureSiteRooms(site, siteCleared); return; }
  const p = roomId.match(/^prop:(.+)$/);
  if (p) { const pr = s.world.properties.find((x) => x.id === p[1]); if (pr) ensureProperty(pr); }
}

function siteForPoi(s: GameState, poi: Poi): SiteState {
  let site = s.world.sites[poi.id];
  if (!site) {
    const story = STORY_SITES[poi.id];
    site = { id: poi.id, name: poi.name, kind: story?.theme ?? 'ruin', x: poi.x, y: poi.y, level: poi.level, seed: (s.world.seed ^ hashStr(poi.id)) >>> 0, rooms: story?.rooms.length ?? 4, near: poi.near, poi: poi.id };
    s.world.sites[poi.id] = site;
  }
  return site;
}
const hashStr = (x: string) => { let h = 2166136261; for (const ch of x) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function rebuildSite(site: SiteState) {
  for (const k of Object.keys(ROOMS)) if (k.startsWith(`site:${site.id}:`)) delete ROOMS[k];
  ensureSiteRooms(site, siteCleared);
}

export const townHubOf = (id: string) => (townById(id) ? townHub(id) : null);

export function hubOf(s: GameState, id: string): string {
  if (townById(id)) return townHub(id);
  if (id === 'old_chapel') return 'kessels_rest';
  const poi = poiById(id);
  const site = poi ? siteForPoi(s, poi) : s.world.sites[id];
  if (site) { ensureSiteRooms(site, siteCleared); return siteHub(site); }
  return 'breda_square';
}

/** Which map location the player is at, from the room they're in. */
export function syncAt(s: GameState) {
  const t = townOfRoom(s.loc);
  if (t) { s.world.at = t; if (townById(t) && !s.world.visited.includes(t)) s.world.visited.push(t); if (t === 'old_chapel' && !s.world.found.includes('old_chapel')) s.world.found.push('old_chapel'); return; }
  const m = s.loc.match(/^site:([^:]+):/); if (m) { s.world.at = m[1]; return; }
  const p = s.loc.match(/^prop:(.+)$/); if (p) { const pr = s.world.properties.find((x) => x.id === p[1]); if (pr) s.world.at = pr.town; }
}

// ---------- discovery ----------
export function discover(c: Ctx, id: string, how?: string) {
  const w = W(c);
  if (w.found.includes(id)) return false;
  w.found.push(id);
  const name = locName(c.s, id);
  c.out('good', `📍 ${name} is now marked on your map.${how ? ` (${how})` : ''}`);
  const poi = poiById(id);
  c.journal(`${name}: ${poi?.blurb ?? `${THEMES[w.sites[id]?.kind ?? 'ruin']?.label ?? 'a place'} near ${townById(w.sites[id]?.near ?? '')?.name ?? 'the road'}`}.`);
  return true;
}

export function newSite(c: Ctx, near: string, opts: { kind?: string; level?: number; around?: { x: number; y: number }; name?: string; boss?: string; rooms?: number; descs?: string[]; dist?: number } = {}): SiteState {
  const w = W(c);
  const base = opts.around ?? townById(near) ?? { x: 0.6, y: 0.45 };
  const region = regionAt(base.x, base.y);
  const kinds: Record<string, string[]> = { peaks: ['cave', 'barrow', 'ruin', 'mine'], mire: ['mire', 'cult', 'barrow'], fields: ['bandit_camp', 'battlefield', 'ruin', 'barrow'], coast: ['cave', 'ruin', 'bandit_camp', 'cult'], forest: ['ruin', 'cave', 'bandit_camp', 'barrow', 'mine', 'cult', 'battlefield'] };
  const kind = opts.kind ?? pick(c.rng, kinds[region]);
  const ang = next(c.rng) * Math.PI * 2, d = (opts.dist ?? 0.025) + next(c.rng) * 0.045;
  const x = Math.min(0.93, Math.max(0.27, base.x + Math.cos(ang) * d));
  const y = Math.min(0.88, Math.max(0.1, base.y + Math.sin(ang) * d * 1.33));
  const lvl = Math.max(1, Math.min(20, opts.level ?? (c.pc.level + die(c.rng, 3) - 2)));
  const seed = (w.seed + w.nextId * 7919) >>> 0;
  const id = `s${w.nextId++}`;
  const site: SiteState = { id, name: opts.name ?? siteName(seed, kind), kind, x, y, level: lvl, seed, rooms: opts.rooms ?? Math.min(7, 2 + Math.ceil(lvl / 4) + die(c.rng, 2)), near, boss: opts.boss, descs: opts.descs };
  w.sites[id] = site;
  return site;
}

function nearestTown(p: { x: number; y: number }): Loc {
  return TOWNS.slice().sort((a, b) => daysBetween(a, p) - daysBetween(b, p))[0];
}

/** A rumour: usually points somewhere new. */
export function rumour(c: Ctx, town: string) {
  const w = W(c);
  const t = townById(town);
  const speaker = NPCS[`${town}_keeper`] ? `${town}_keeper` : town === 'breda' ? 'squib' : null;
  const say = (txt: string) => (speaker ? c.say(speaker, txt) : c.narr(txt));
  const key = `rumour_${town}_${dayOf(c.s)}`;
  const n = (c.flag(key) as number) || 0;
  c.set(key, n + 1);
  if (n >= 2) { say(pick(c.rng, ['"That\'s all I\'ve got today. Come back tomorrow; news travels slow."', '"I\'ve told you everything I know, and some things I don\'t."'])); return; }
  // front omens
  const live = Object.values(w.fronts).filter((f) => f.active && !f.ended && f.clock >= 3);
  if (live.length && next(c.rng) < 0.3) { say(`"${frontRumour(c, pick(c.rng, live))}"`); return; }
  // a named place nearby?
  const here = t ?? townById('breda')!;
  const pois = POIS.filter((p) => !w.found.includes(p.id) && !p.story && p.level <= c.pc.level + 4).sort((a, b) => daysBetween(a, here) - daysBetween(b, here));
  if (pois.length && next(c.rng) < 0.5) {
    const p = pois[Math.min(pois.length - 1, die(c.rng, 2) - 1)];
    say(`"${poiRumour(p)}"`);
    discover(c, p.id, 'heard in a tavern');
    return;
  }
  // otherwise a fresh place to explore
  const site = newSite(c, here.id);
  say(`"${pick(c.rng, [`Folk out past ${here.name} have seen lights at ${site.name}. Nobody's gone to look.`, `There's ${site.name} a short way from ${here.name}. ${THEMES[site.kind].label === 'camp' ? 'Bandits. They took a cart last week.' : 'People who go in come out quieter, if they come out.'}`, `A trapper swore there's something worth finding at ${site.name}. Then he left town in a hurry.`])}"`);
  discover(c, site.id, 'heard in a tavern');
}

function poiRumour(p: Poi): string {
  const R: Record<string, string> = {
    greymarch: 'Greymarch Field. They mow it once a year, in silence. This year the grass came back the wrong colour.',
    weeping_glacier: 'The Weeping Glacier above Herstal is melting from the inside. There are soldiers in the ice. Closer every month.',
    charmwright_grove: 'There\'s a hollow oak in the Thornwood where the first charms were carved. The pattern\'s still inside it, they say.',
    forgotten_workshop: 'The Tantal miners broke into a hall in the eastern woods nobody built. They sealed it again. Fast.',
    sunken_ferry: 'On the wrong night the old refugee ferry runs again on the Aimo, lanterns lit, under the water.',
    erased_face: 'The cliffs on the east coast are a face, if you sail past right. Somebody chiselled the face off.',
    drowned_shrine: 'Deep in the Mire there\'s a shrine where the water pours down a grate and never fills. Green candles there, lately.',
    greenspire: 'The green tower on the lake. Letters come out of it. Nobody goes in.',
    treaty_stone: 'Someone\'s been at the Treaty Stone with a chisel. The orcs are not happy.',
    peaks_lair: 'Up in the Peaks there\'s a cave where the snow never settles. The hermits won\'t say what lives there.',
    mire_depths: 'The Mire drinks two rivers. Ask yourself where it all goes.',
  };
  return R[p.id] ?? `${p.name}. ${p.blurb}`;
}

// ---------- travel ----------
function graph(s: GameState): Record<string, [string, number][]> {
  const g: Record<string, [string, number][]> = {};
  const addE = (a: string, b: string, d: number) => { (g[a] ??= []).push([b, d]); (g[b] ??= []).push([a, d]); };
  for (const [a, b, d] of ROADS) addE(a, b, d);
  for (const id of s.world.found) {
    if (id === 'old_chapel') continue;
    const p = locPoint(s, id); if (!p) continue;
    const near = nearestTown(p);
    addE(id, near.id, Math.max(0.5, Math.round(daysBetween(near, p) * 1.5 * 2) / 2));
  }
  return g;
}

export function route(s: GameState, from: string, to: string): { path: string[]; legs: number[]; days: number } | null {
  const g = graph(s);
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const q = [from];
  const seen = new Set<string>();
  while (q.length) {
    q.sort((a, b) => dist[a] - dist[b]);
    const u = q.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    if (u === to) break;
    for (const [v, d] of g[u] ?? []) { const nd = dist[u] + d; if (nd < (dist[v] ?? Infinity)) { dist[v] = nd; prev[v] = u; q.push(v); } }
  }
  if (dist[to] === undefined) return null;
  const path = [to]; let k = to; while (prev[k]) { k = prev[k]; path.unshift(k); }
  const legs: number[] = [];
  for (let i = 1; i < path.length; i++) legs.push((g[path[i - 1]] ?? []).find(([v]) => v === path[i])?.[1] ?? 1);
  return { path, legs, days: dist[to] };
}

/** Names the player can travel to. */
export function knownDestinations(s: GameState): { id: string; name: string }[] {
  return [...TOWNS.map((t) => ({ id: t.id, name: t.name })), ...s.world.found.map((id) => ({ id, name: locName(s, id) }))];
}
export function matchDestination(s: GameState, text: string): string | null {
  const n = text.toLowerCase().replace(/^(the|to)\s+/, '').replace(/[?.!]+$/, '').trim();
  if (n.length < 3) return null;
  const strip = (x: string) => x.toLowerCase().replace(/^the\s+/, '');
  const all = knownDestinations(s).map((d) => ({ ...d, k: strip(d.name) }));
  const score = (d: { id: string; k: string }) => (d.k === n || d.id === n || d.id.replace(/_/g, ' ') === n ? 1000 : d.k.startsWith(n) ? 500 + n.length : n.includes(d.k) ? 300 + d.k.length : d.k.includes(n) ? 100 + n.length : n.split(/\s+/).filter((w) => w.length > 3 && d.k.includes(w)).length * 50);
  const best = all.map((d) => ({ d, sc: score(d) })).sort((a, b) => b.sc - a.sc)[0];
  return best && best.sc >= 100 ? best.d.id : null;
}

export function travel(c: Ctx, dest: string) {
  const s = c.s;
  syncAt(s);
  if (s.combat) { c.sys('Not in the middle of a fight.'); return; }
  if (dest === s.world.at) { c.sys(`You're already at ${locName(s, dest)}.`); return; }
  const r = route(s, s.world.at, dest);
  if (!r) { c.sys(`You don't know a way to ${locName(s, dest)} from here.`); return; }
  s.world.journey = { route: r.path, legs: r.legs, leg: 0, day: 0, dest };
  c.out('title', `The road to ${locName(s, dest)}`);
  c.narr(`${r.days <= 1 ? 'A day\'s' : `${r.days} days'`} travel${r.path.length > 2 ? `, by way of ${r.path.slice(1, -1).map((x) => locName(s, x)).join(', ')}` : ''}. You set out${c.timeOfDay() === 'night' || c.timeOfDay() === 'midnight' ? ' in the dark, which is a choice' : ''}.`);
  continueJourney(c);
}

export function continueJourney(c: Ctx) {
  const s = c.s;
  const j = s.world.journey;
  if (!j) { c.sys('You\'re not on a journey. ("travel to <place>", or tap a place on the World map.)'); return; }
  if (s.combat) return;
  while (s.world.journey && !s.combat) {
    const a = j.route[j.leg], b = j.route[j.leg + 1];
    const legDays = j.legs[j.leg];
    const pa = locPoint(s, a)!, pb = locPoint(s, b)!;
    if (j.day >= legDays) {
      // reached a waypoint
      j.leg += 1; j.day = 0;
      if (j.leg >= j.route.length - 1) { arrive(c, j.dest); return; }
      const mid = j.route[j.leg];
      if (townById(mid)) c.narr(`You pass through ${locName(s, mid)}${townById(mid) && !s.world.visited.includes(mid) ? ', a place you\'ve never been' : ''}.`);
      if (townById(mid) && !s.world.visited.includes(mid)) s.world.visited.push(mid);
      continue;
    }
    // one day (or half) on the road
    const step = Math.min(1, legDays - j.day);
    j.day += step;
    const f = Math.min(1, j.day / legDays);
    const here = { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
    c.advance(Math.round(step * 24 * 60));
    const pc = c.pc;
    pc.hp = Math.min(pc.maxHp, pc.hp + Math.ceil(pc.maxHp / 2)); pc.slots.used = 0;
    for (const k of Object.keys(pc.resources)) pc.resources[k].used = 0;
    maybeLevel(c);
    roadDay(c, here);
    if (s.combat) { c.sys('(When the fight is over, say "continue" to go on.)'); return; }
  }
}

function arrive(c: Ctx, dest: string) {
  const s = c.s;
  s.world.journey = null;
  s.world.at = dest;
  if (townById(dest) && !s.world.visited.includes(dest)) s.world.visited.push(dest);
  const hub = hubOf(s, dest);
  ensureRoom(s, hub);
  c.out('title', `Arrived: ${locName(s, dest)}`);
  c.move(hub);
}

function roadDay(c: Ctx, here: { x: number; y: number }) {
  const s = c.s;
  const region = regionAt(here.x, here.y);
  const roll = die(c.rng, 100);
  const lvl = c.pc.level;
  // undiscovered named places nearby can be spotted
  const near = POIS.filter((p) => !s.world.found.includes(p.id) && !p.story && daysBetween(p, here) < 1.2);
  if (near.length && roll <= 15) { const p = pick(c.rng, near); c.narr(pick(c.rng, ['Off the road, through the trees, you see something you didn\'t expect.', 'A shepherd points it out to you, then crosses himself.', 'You take a wrong turn and find something.'])); discover(c, p.id, 'seen from the road'); return; }
  if (roll <= 30) {
    const fr = Object.values(s.world.fronts).find((f) => f.active && f.clock >= 5 && next(c.rng) < 0.4);
    const pool: Record<string, string[]> = { peaks: ['wolf', 'dire_wolf', 'ogre', 'brown_bear', 'troll', 'owlbear', 'revenant', 'wyrm_young'], mire: ['drowned', 'bog_light', 'giant_spider', 'mire_hag', 'zombie', 'troll'], fields: ['bandit', 'thug', 'rifleman', 'wolf', 'ghoul', 'bandit_captain', 'hired_gun'], coast: ['bandit', 'smuggler', 'drowned', 'giant_spider', 'thug', 'ghoul'], forest: ['wolf', 'bandit', 'boar', 'giant_spider', 'zombie', 'ghoul', 'dire_wolf', 'owlbear', 'brown_bear', 'rifleman', 'troll'] };
    const p = fr?.id === 'bells' ? ['zombie', 'skeleton', 'ghoul', 'ghast', 'wight', 'revenant', 'vampire'] : fr?.id === 'treaty' ? ['bandit', 'rifleman', 'hired_gun', 'thug', 'bandit_captain'] : fr?.id === 'drinker' ? ['drowned', 'bog_light', 'mire_hag', 'troll'] : pool[region];
    const foes = buildFoes(S(s.world.seed + dayOf(s) * 31 + s.world.nextId), p, lvl, 0.75);
    const first = MONSTERS[foes[0][0]];
    c.out('title', 'On the road');
    const peaceful = first?.tags.includes('humanoid') && next(c.rng) < 0.35;
    if (peaceful) { c.narr(`${foes.reduce((n, [, k]) => n + k, 0) > 1 ? 'A group of' : 'A'} ${first.name.toLowerCase()}${foes.reduce((n, [, k]) => n + k, 0) > 1 ? 's' : ''} step${foes.reduce((n, [, k]) => n + k, 0) > 1 ? '' : 's'} onto the road. "Road toll," one says. "${fmtMoney(lvl * 200)}. Or not, and we see how it goes."`); c.set('toll_pending', lvl * 200); c.set('toll_foes', JSON.stringify(foes)); c.sys('Pay the toll, talk your way past, or fight. (Anything else and they decide for you.)'); return; }
    c.set('road_map', region === 'mire' ? 'south_road' : region === 'fields' ? 'east_farms' : 'thornwood');
    c.fight({ id: `road_${dayOf(s)}_${die(c.rng, 9999)}`, foes, intro: pick(c.rng, ['Something comes out of the trees at you.', 'An ambush, and not a subtle one.', 'You hear them before you see them, and then it\'s too late to avoid it.']), ambush: next(c.rng) < 0.2 });
    c.set('road_map', '');
    return;
  }
  if (roll <= 42) { const site = newSite(c, nearestTown(here).id, { around: here }); c.narr(pick(c.rng, [`At dusk you notice a path off the road, and at the end of it, ${site.name}.`, `A farmer warns you away from ${site.name}. Naturally, you mark it.`])); discover(c, site.id, 'found on the road'); return; }
  if (roll <= 55) { c.narr(pick(c.rng, ROAD_PEOPLE)); return; }
  c.narr(pick(c.rng, ROAD_QUIET));
}

const ROAD_PEOPLE = [
  'Four elderly pilgrims of the old faith are re-carving a defaced sigil on a milestone. They remember rites nobody has performed in a century, and teach you a blessing for the road.',
  'A crown courier in Elisiah\'s colours gallops past without slowing.',
  'Master Fenwick Tealeaf\'s cart overtakes you. He offers to buy your boots for an insultingly low price.',
  'A goblin in a trenchcoat sidles up and asks if you\'re cops. He sells Bellwax, apparently.',
  'Veterans round a fire wave you over. You share a drink and nobody mentions the war, which is how you know they were all in it.',
  'A woman is digging at a roadside grave with her hands. "He knocked," she says, "and I couldn\'t let him go on knocking."',
  'An ordinary-looking cat stares at you from a fence post until you nod to it. Later you find a cedar-scented thread in your pocket.',
];
const ROAD_QUIET = ['A long, quiet day of road. Rain, then sun, then rain.', 'Nothing happens, beautifully. You camp under the stars.', 'Wind in the canopy, mud on your boots, and a long night\'s sleep.', 'Carts, cows and crows. You make good time.'];

export function respondToll(c: Ctx, raw: string): boolean {
  const toll = c.flag('toll_pending') as number;
  if (!toll || c.s.combat) return false;
  const low = raw.toLowerCase();
  const foes = JSON.parse((c.flag('toll_foes') as string) || '[]');
  const done = () => { c.set('toll_pending', 0); };
  if (/^(pay|pay the toll|pay them|fine|ok|okay|here)/.test(low)) { if (c.pay(toll)) { done(); c.narr('They take the coin and step aside, almost polite about it.'); continueIf(c); return true; } c.narr('You can\'t afford it.'); return true; }
  if (/persuade|talk|convince|bluff|lie|intimidate|threaten|scare/.test(low)) {
    done();
    const sk = /intimidate|threaten|scare/.test(low) ? 'intimidation' : /bluff|lie/.test(low) ? 'deception' : 'persuasion';
    if (c.check(sk as 'persuasion', 10 + c.pc.level)) { c.narr(sk === 'intimidation' ? 'They look at you, then at each other, and decide they had somewhere else to be.' : 'They laugh, and wave you through. "Fair enough."'); continueIf(c); return true; }
    c.narr('That doesn\'t go well.');
  } else done();
  c.set('road_map', 'thornwood');
  c.fight({ id: `toll_${dayOf(c.s)}`, foes, intro: 'Weapons come out.' });
  c.set('road_map', '');
  return true;
}
function continueIf(c: Ctx) { if (c.s.world.journey) continueJourney(c); }

/** "explore": spend a day searching the wilds around where you are. */
export function explore(c: Ctx) {
  const s = c.s;
  syncAt(s);
  if (s.combat) return;
  const here = locPoint(s, s.world.at) ?? townById('breda')!;
  c.out('title', 'Exploring');
  c.advance(8 * 60);
  const near = POIS.filter((p) => !s.world.found.includes(p.id) && !p.story && daysBetween(p, here) < 2).sort((a, b) => daysBetween(a, here) - daysBetween(b, here));
  const r = die(c.rng, 100) + (c.pc.skills.includes('survival') ? 10 : 0);
  if (near.length && r > 55) { c.narr(`You spend a day in the wilds around ${locName(s, s.world.at)}. Following an old track, you find something.`); discover(c, near[0].id, 'explored'); return; }
  if (r > 25) { const site = newSite(c, nearestTown(here).id, { around: here }); c.narr(`You spend a day in the wilds around ${locName(s, s.world.at)} and come across ${site.name}.`); discover(c, site.id, 'explored'); return; }
  if (r > 12) { c.narr('A day of brambles and wrong turns. You find nothing but a good spot for a picnic.'); return; }
  c.narr('Something finds you first.');
  roadDay(c, here);
}

// ---------- sites: clearing ----------
export function siteCleared(c: Ctx, site: SiteState) {
  if (site.cleared) return;
  site.cleared = true;
  const xp = Math.round(50 * site.level * site.level / 2 + 50);
  c.out('title', `${site.name}: cleared`);
  c.xp(xp);
  W(c).renown += site.level;
  for (const j of W(c).jobs.filter((x) => x.site === site.id && x.taken && !x.done)) { j.done = true; c.good(`Job done: ${j.title}. Collect your ${fmtMoney(j.reward)} in ${locName(c.s, j.town)}.`); }
  const story = site.poi ? STORY_SITES[site.poi] : undefined;
  story?.onClear(c);
  CAMPAIGN_HOOK?.(c, site);
}
let CAMPAIGN_HOOK: ((c: Ctx, site: SiteState) => void) | null = null;
export function bindCampaignHook(fn: (c: Ctx, site: SiteState) => void) { CAMPAIGN_HOOK = fn; }

// ---------- the notice boards ----------
export function board(c: Ctx, town: string) {
  const w = W(c);
  const day = dayOf(c.s);
  let open = w.jobs.filter((j) => j.town === town && !j.taken && day - j.posted < 14);
  if (open.length < 3) { for (let i = open.length; i < 3; i++) w.jobs.push(makeJob(c, town)); open = w.jobs.filter((j) => j.town === town && !j.taken && day - j.posted < 14); }
  c.out('title', `${locName(c.s, town)} — notices`);
  open.slice(0, 4).forEach((j, i) => c.narr(`${i + 1}. ${j.title} — ${j.text} Reward: ${fmtMoney(j.reward)}.`));
  const mine = w.jobs.filter((j) => j.taken && !j.paid);
  if (mine.length) c.sys(`Your jobs: ${mine.map((j) => `${j.title}${j.done ? ' (done)' : ''}`).join('; ')}.`);
  c.sys('Say "take job 1" (or 2, 3) to accept one.');
  c.set('board_town', town);
}

function makeJob(c: Ctx, town: string): Job {
  const w = W(c);
  const lvl = c.pc.level;
  const kinds: Job['kind'][] = ['clear', 'bounty', 'deliver', 'fetch', 'clear'];
  const kind = pick(c.rng, kinds);
  const id = `j${w.nextId++}`;
  const posted = dayOf(c.s);
  if (kind === 'deliver') {
    const dests = TOWNS.filter((t) => t.id !== town);
    const dest = pick(c.rng, dests);
    const r = route(c.s, town, dest.id);
    const days = r?.days ?? 2;
    return { id, town, kind, title: `Parcel for ${dest.name}`, text: `A sealed parcel to the notary in ${dest.name}. Don't open it.`, reward: Math.round((days * 400 + lvl * 100) / 10) * 10, dest: dest.id, posted };
  }
  const site = newSite(c, town);
  const boss = THEMES[site.kind];
  const rew = Math.round((site.level * site.level * 300 + 1500) / 10) * 10;
  if (kind === 'bounty') return { id, town, kind, title: `Bounty: ${site.name}`, text: `Whatever is behind the trouble at ${site.name}, put it down. Proof required.`, reward: Math.round(rew * 1.3), site: site.id, posted };
  if (kind === 'fetch') return { id, town, kind, title: `Recover what was lost`, text: `A family heirloom was taken to ${site.name}. Bring back what you find there.`, reward: rew, site: site.id, posted };
  return { id, town, kind: 'clear', title: `Clear ${site.name}`, text: `${boss.label === 'camp' ? 'Bandits are using it to raid the roads.' : 'Things come out of it at night.'} ${site.name}, near ${locName(c.s, town)}.`, reward: rew, site: site.id, posted };
}

export function takeJob(c: Ctx, n: number) {
  const w = W(c);
  const town = (c.flag('board_town') as string) || W(c).at;
  const open = w.jobs.filter((j) => j.town === town && !j.taken && dayOf(c.s) - j.posted < 14).slice(0, 4);
  const j = open[n - 1];
  if (!j) { c.sys('There\'s no such posting. ("read the notice board" first.)'); return; }
  j.taken = true;
  c.good(`Job taken: ${j.title}.`);
  c.journal(`Job (${locName(c.s, j.town)}): ${j.title}. ${j.text} Reward ${fmtMoney(j.reward)}.`);
  if (j.site) discover(c, j.site, 'from the notice board');
  if (j.kind === 'deliver') { c.give('parcel'); c.sys(`Take the parcel to ${locName(c.s, j.dest!)}: "travel to ${locName(c.s, j.dest!)}".`); }
}

/** Arrival in a town: deliveries and paydays. */
export function townArrive(c: Ctx, town: string) {
  const w = W(c);
  syncAt(c.s);
  for (const j of w.jobs.filter((x) => x.kind === 'deliver' && x.taken && !x.paid && x.dest === town)) {
    if (!hasItem(c.pc, 'parcel')) continue;
    c.pc.inventory = c.pc.inventory.filter((x) => x.id !== 'parcel' || (x.qty -= 1) > 0);
    j.done = true; j.paid = true; c.money(j.reward); c.xp(25 * c.pc.level);
    c.good(`The notary signs for the parcel without looking at you. ${fmtMoney(j.reward)}.`);
  }
  for (const j of w.jobs.filter((x) => x.town === town && x.done && !x.paid)) {
    j.paid = true; c.money(j.reward); w.renown += 2;
    c.good(`The town clerk pays out on "${j.title}": ${fmtMoney(j.reward)}.${j.kind === 'fetch' ? ' The family weeps over what you brought back.' : ''}`);
  }
  if (c.s.world.properties.some((p) => p.town === town) && c.flag(`prop_hint_${town}`) !== dayOf(c.s)) { c.set(`prop_hint_${town}`, dayOf(c.s)); c.sys('Your property here is just off the square. ("go to my property")'); }
}

// ---------- fronts: threats that move without you ----------
export function onNewDay(c: Ctx) {
  const w = W(c);
  const day = dayOf(c.s);
  for (const f of Object.values(w.fronts)) {
    if (!f.active || f.ended) continue;
    const every = f.id === 'bells' ? 3 : f.id === 'treaty' ? 4 : 5;
    if (day - f.lastTick < every) continue;
    f.lastTick = day;
    if (f.id === 'bells' && c.flag('bell_silenced') && !c.flag('act1_finale')) continue;
    f.clock = Math.min(f.max, f.clock + 1);
    omen(c, f);
  }
  propertyTick(c);
  payHires(c);
  // Act Two begins the morning after Act One ends
  if (c.flag('act1_finale') && !c.flag('act2_letter') && day > ((c.flag('act1_day') as number) ?? day)) act2Letter(c);
  if (c.flag('act1_finale') && !c.flag('act1_day')) c.set('act1_day', day);
}

function omen(c: Ctx, f: Front) {
  if (f.omens.includes(f.clock)) return;
  f.omens.push(f.clock);
  const O: Record<string, Record<number, string>> = {
    bells: { 4: 'Word comes down every road: the dead are walking on the highways now, not just near the chapels.', 6: 'Brumandell has closed its gates at night. Something knocks on them until dawn.', 8: 'The bells ring at noon now, too. In every town, people stop and listen.', 10: 'Pale riders have been seen on the Suomi road, in old court dress, two hundred years out of date.', 12: 'Every bell in Lahti rings at once. In the vaults beneath Suomi, someone sits up.' },
    treaty: { 3: 'Someone has defaced the Treaty Stone. Orc traders stop coming to Samopal.', 5: 'A Makrovin patrol and a Lahti patrol fired on each other near the border. Both sides blame the other.', 7: 'Recruiting sergeants are in every town square. The old uniforms are coming out of the trunks.', 10: 'The Treaty of Fifteen Years is broken. Lahti and Makrovin are at war again.' },
    drinker: { 3: 'The Aimo is running backwards for an hour each night. Bargemen refuse to work.', 6: 'Madsen\'s nets come up full of drowned men in uniforms from wars nobody remembers.', 9: 'The Mire is spreading north. Shpagin is up to its stilts in black water.', 12: 'Something under the Mire has finished drinking, and is hungry for the rest.' },
  };
  const txt = O[f.id]?.[f.clock];
  if (txt) { c.out('bad', `⚑ ${txt}`); c.journal(`${f.name}: ${txt}`); }
  if (f.id === 'treaty' && f.clock >= f.max) { f.ended = true; c.set('war', true); c.journal('WAR. Lahti and Makrovin are at war. The western roads are full of soldiers.'); }
  if (f.id === 'bells' && f.clock >= f.max) { c.set('queen_woke', true); discover(c, 'old_vaults', 'the bells have woken her'); }
}

function frontRumour(c: Ctx, f: Front): string {
  const R: Record<string, string[]> = {
    bells: ['The bells are ringing in more towns than Squib\'s chapel. Coltale. Largo. Borschardt.', 'They say the dead are walking toward Suomi. All of them, from everywhere.'],
    treaty: ['Orcs and elves are glaring at each other across the Samopal market again. It\'s like the war never ended.', 'Somebody\'s paying people to deface the Treaty Stone. Paying in crown gold.'],
    drinker: ['The Mire is getting bigger. Ask anyone in Shpagin.', 'Bargemen say the Drowned Shrine is pulling water down faster than ever.'],
  };
  return pick(c.rng, R[f.id] ?? ['Strange times.']);
}

function act2Letter(c: Ctx) {
  c.set('act2_letter', true);
  const cult = !!c.flag('cult_joined');
  c.out('title', cult ? 'A letter signed Z' : 'A letter from the capital');
  if (cult) {
    c.narr('A letter is waiting on your pillow, sealed with green-black wax. The hand is small and precise: "Merah speaks well of you. The towers at Coltale, Largo and Borschardt must keep ringing; the crown means to silence them. Guard them, or don\'t. Her Majesty remembers who helped. — Z"');
  } else {
    c.narr('The paper Sereza left behind has writing on it now: ink surfacing letter by letter, in a small, precise hand that never hurries. "Sereza speaks well of your effectiveness. The bells at Coltale, Largo and Borschardt are still ringing. Coltale first. Do not open the vaults. — E."');
  }
  for (const id of ['coltale_memorial', 'largo_bell', 'borschardt_chapel']) discover(c, id, cult ? 'from Z\'s letter' : 'from the queen\'s letter');
  W(c).fronts.treaty.active = true;
  c.journal(cult ? 'Act Two: Z asks you to protect the bell towers at Coltale, Largo and Borschardt.' : 'Act Two: three more bells ring, at Coltale, Largo and Borschardt. The queen herself asks you to silence them. "Do not open the vaults."');
  c.sys('Open the World map to see them. Or don\'t: the world will keep turning either way.');
}

// ---------- story sites ----------
const STORY_SITES: Record<string, StorySite> = {
  coltale_memorial: { theme: 'battlefield', rooms: [
    { name: 'The Gate and the Long Rows', outdoor: true, desc: 'The memorial gate stands open. Beyond it, rows and rows of grave markers, and between them, things rising in ones and twos.', foes: [['zombie', 3], ['skeleton', 1]] },
    { name: 'Mausoleum Row', outdoor: true, desc: 'Three officers\' family tombs. One forced open from outside. Two from within.', foes: [['ghoul', 2]], loot: { cp: 6000, items: ['sabre_plus1', 'signet_ring'], note: 'A crested officer\'s sabre, silvered. Coltale veterans will recognise the crest.' } },
    { name: 'The Memorial Hall', desc: 'A squat bunker of a hall. Every wall is covered in names, carved in rows, floor to ceiling.', foes: [['shadow', 2]] },
    { name: 'The West Hall — Roll of the Dead', desc: 'Fresh green wax at the foot of a column whose names have been scratched out: one whole company, the one at Greymarch the night the bell rang wrong. The memorial bell hangs above, still swinging.', foes: [['roll_keeper', 1], ['ghoul', 1]], loot: { cp: 4000, items: ['potion_greater'], note: 'Among the scratched-out names, one is still legible: a stretcher-bearer\'s company. Squib\'s.' } },
  ], onClear: (c) => bellTowerDone(c, 'coltale') },
  largo_bell: { theme: 'mire', rooms: [
    { name: 'The Quay and Main Pier', outdoor: true, desc: 'Rotting pilings, wet rope, and a lookout who has just noticed you.', foes: [['smuggler', 2]] },
    { name: 'The Warehouse Floor', desc: 'Canyons of crates marked FISH. On the far wall, a manifest board covered in green candle stubs, burned down to a shrine.', foes: [['smuggler', 2], ['thug', 1]] },
    { name: 'The Counting Office', desc: 'A desk, a safe, and a shipping ledger left open.', foes: [], loot: { cp: 12000, items: ['webley_revolver', 'pistol_cartridge'], note: 'The ledger: Bellwax by the crate, shipped upriver from a Borschardt counting-house, paid in crown-minted gold.' } },
    { name: 'The Tide Hatch', desc: 'A trapdoor to the river. Wet hands are coming up the ladder.', foes: [['drowned', 3]] },
    { name: 'The Tide Platform', outdoor: true, desc: 'A platform over the black water, and the bell on its derrick forty feet above the current. Lashed to the derrick, the drowned captain turns his head.', foes: [['drowned_captain', 1], ['drowned', 2]], loot: { cp: 8000, items: ['potion_greater', 'arisaka_carbine'] } },
  ], onClear: (c) => bellTowerDone(c, 'largo') },
  borschardt_chapel: { theme: 'cult', rooms: [
    { name: 'Guild Street and the Bronze Doors', outdoor: true, desc: 'Polished stone between two counting-houses. The bronze doors are locked; the clerk\'s side door isn\'t, quite. Two guards in good coats.', foes: [['hired_gun', 2]] },
    { name: 'The Counting Nave', desc: 'Benches face a raised desk. Stained glass of merchants weighing coin. On the desk: the Great Ledger, four years of payments to "memorial charities" in Coltale and shipping in Largo.', foes: [['hired_gun', 2], ['thug', 1]] },
    { name: 'The Vault', desc: 'The founding partner was interred in his own vault a century ago. He is still auditing.', foes: [['founding_partner', 1]], loot: { cp: 40000, items: ['toggle_pistol', 'crown_bond', 'old_vaults_key'], note: 'In the partner\'s dead hand: a key of bone, not iron. A tag in two-hundred-year-old ink: THE OLD VAULTS — SUOMI.' } },
    { name: 'The Gallery and the Bell', desc: 'Up a stair to the gallery, where the bell hangs over the trading floor and two fanatics are ringing it.', foes: [['cult_fanatic', 2]] },
  ], onClear: (c) => bellTowerDone(c, 'borschardt') },
  old_vaults: { theme: 'barrow', rooms: [
    { name: 'The Forgotten Stair', desc: 'A stair under the palace, cut before the palace was built. Every carving of a face on the walls has been chiselled away.', foes: [['shadow', 3], ['specter', 1]] },
    { name: 'The Ossuary of the Erased', desc: 'Bones stacked to the ceiling, all labelled, all labels scraped blank.', foes: [['mummy', 2], ['wight', 1]] },
    { name: 'The Mural Gallery', desc: 'A gallery of murals of a beloved queen. Her face is gone from every one. In wax at the foot of the last, someone has written a name.', foes: [['gargoyle', 2], ['wight', 1]], loot: { cp: 20000, items: ['true_name'] } },
    { name: 'The Bell Chamber Below the City', desc: 'A bell, upside down, hung from the floor of Suomi above. The pattern for ringing it is carved round the rim.', foes: [['vampire', 1]], loot: { cp: 30000, items: ['bell_pattern', 'potion_superior'] } },
    { name: 'Her Majesty\'s Rest', desc: 'A tomb like a bedroom. A woman in a crown of grave-frost sits up, and smiles at you as if you were expected. "Little candle," she says. "You came."', foes: [['vessariel', 1], ['revenant', 2]] },
  ], onClear: (c) => queenFalls(c) },
  greymarch: { theme: 'battlefield', rooms: [
    { name: 'The Fence Line', outdoor: true, desc: 'A fence around a field the size of a farm. The grass is the wrong colour.', foes: [['zombie', 4], ['ghoul', 1]] },
    { name: 'The Mass Grave', outdoor: true, desc: 'The ground here is soft. It moves.', foes: [['revenant', 1], ['skeleton', 3]] },
    { name: 'The Field Chapel', desc: 'A field chapel of the old faith, its bell cracked. This is where it was rung wrong.', foes: [['wight', 1], ['revenant', 1]], loot: { cp: 20000, items: ['war_medal', 'potion_greater', 'revolver_plus1'], note: 'A field order in the chaplain\'s hand: "Ring the bell backwards and they will rise to fight for us. — by order." The signature has been scraped away.' } },
  ], onClear: (c) => { c.journal('Greymarch Field: someone ordered the bell rung backwards at the end of the war, to raise the dead to fight. That was the atrocity.'); W(c).fronts.bells.clock = Math.max(0, W(c).fronts.bells.clock - 1); } },
  charmwright_grove: { theme: 'cave', rooms: [
    { name: 'The Thornwood Deep', outdoor: true, desc: 'Old growth, very quiet. Bone charms on every tree.', foes: [['thornling', 3]] },
    { name: 'The Hollow Oak', outdoor: true, desc: 'A vast oak, hollow, with a carver\'s grave at its roots. Carved inside the trunk: the true warding pattern, the one the village charms only half remember.', foes: [['giant_spider', 1], ['thornling', 2]], loot: { cp: 1500, items: ['potion_healing'], note: 'You copy the pattern. Hung on a door, it would keep the dead out. Hung on a bell rope, it might do more.' } },
  ], onClear: (c) => { c.set('true_pattern', true); c.journal('The Charmwright\'s Grove: you copied the true warding pattern. The dead respect it.'); W(c).fronts.bells.clock = Math.max(0, W(c).fronts.bells.clock - 1); } },
  forgotten_workshop: { theme: 'ruin', rooms: [
    { name: 'The Vine-Hall', desc: 'A hall swallowed by vines, with a traveller\'s map symbol carved over the door.', foes: [['gargoyle', 2]] },
    { name: 'The Miners\' Breach', desc: 'Where the Tantal shaft broke through: tools dropped mid-swing.', foes: [['ghoul', 2], ['shadow', 2]] },
    { name: 'The Loremasters\' Workshop', desc: 'Benches, bells, half-finished charms, and notes in a cipher of sloppy somatic shortcuts.', foes: [['gargoyle', 2], ['wight', 1]], loot: { cp: 15000, items: ['bell_pattern', 'ring_protection'], note: 'The loremasters built a rite to make the world forget a queen. Three parts: her true name, the old bell pattern rung forwards on a consecrated bell, and a ruler\'s renunciation.' } },
  ], onClear: (c) => { c.set('knows_rite', true); c.journal('The Forgotten Workshop: the Rite of Holy Forgetting needs her true name, the old bell pattern, and a ruler\'s renunciation.'); } },
  sunken_ferry: { theme: 'mire', rooms: [
    { name: 'The Riverbank', outdoor: true, desc: 'The Aimo at night. Under the water, lanterns.', foes: [['drowned', 2]] },
    { name: 'The Ferry Deck (underwater, somehow)', desc: 'You are standing on the deck of a ferry that sank fifteen years ago, and you can breathe, and you wish you couldn\'t.', foes: [['specter', 2], ['drowned', 2]], loot: { cp: 6000, items: ['silver_locket', 'gold_ring', 'potion_greater'], note: 'The refugees\' belongings, in a neat pile. They\'d want someone to have them.' } },
  ], onClear: (c) => { c.journal('The Sunken Ferry: the refugees are at rest. The ferry doesn\'t run any more.'); W(c).renown += 3; } },
  drowned_shrine: { theme: 'mire', rooms: [
    { name: 'The Pole-Barge Channel', outdoor: true, desc: 'Grey lilies, black water, and bog-lights leading the wrong way.', foes: [['bog_light', 2], ['drowned', 2]] },
    { name: 'The Half-Sunk Steps', outdoor: true, desc: 'Stone steps into the water, every one with a green candle on it.', foes: [['cult_fanatic', 2], ['cultist', 2]] },
    { name: 'The Grate', desc: 'Water pours endlessly DOWN through a grate no one built. The sound underneath it is like breathing.', foes: [['mire_hag', 1], ['cult_fanatic', 1]], loot: { cp: 25000, items: ['potion_superior'], note: 'Orders on the hag\'s altar: "Every candle to Suomi by the new moon. Hold the shrine. What drinks below is not our concern. — Z, the Greenspire."' } },
  ], onClear: (c) => { discover(c, 'greenspire', 'from Z\'s orders'); const d = W(c).fronts.drinker; if (!d.active) { d.active = true; d.clock = 2; } c.journal('The Drowned Shrine: Z is at the Greenspire. And something under the Mire is drinking.'); } },
  greenspire: { theme: 'cult', rooms: [
    { name: 'The Lake Shore', outdoor: true, desc: 'A green-glass tower on an island. The boat is waiting, as if someone knew.', foes: [['cult_fanatic', 2], ['wight', 1]] },
    { name: 'The Glass Stair', desc: 'A stair of green glass, and under the glass, faces.', foes: [['vampire', 1]] },
    { name: 'Z\'s Study', desc: 'Letters, thousands of them, in a small precise hand. And Z, who has been expecting you. "Zenu," he says. "Since you came all this way."', foes: [['zenu', 1], ['gargoyle', 2]], loot: { cp: 60000, items: ['potion_superior', 'cloak_protection'], note: 'Zenu\'s last letter, unfinished: "When she wakes, she will end death. When death ends, the Mire will have nothing left to drink but us."' } },
  ], onClear: (c) => { c.set('zenu_dead', true); c.journal('Zenu of the Greenspire, "Z", is dead. The cult has no head. But he was afraid of something under the Mire.'); W(c).fronts.treaty.clock = Math.max(0, W(c).fronts.treaty.clock - 3); } },
  treaty_stone: { theme: 'bandit_camp', rooms: [
    { name: 'The Border Road', outdoor: true, desc: 'The western border road. Hired men are watching it.', foes: [['rifleman', 2], ['bandit', 2]] },
    { name: 'The Treaty Stone', outdoor: true, desc: 'The standing stone where the peace was signed, offerings of both races at its foot. A cult cell is chiselling at the names.', foes: [['cult_fanatic', 1], ['hired_gun', 2]], loot: { cp: 15000, items: ['crown_bond'], note: 'The cell was paid in crown-minted gold, through a Borschardt counting-house.' } },
  ], onClear: (c) => { const t = W(c).fronts.treaty; t.clock = Math.max(0, t.clock - 5); if (t.clock === 0) { t.ended = true; c.journal('You saved the Treaty Stone. The peace holds, for now.'); } } },
  erased_face: { theme: 'cave', rooms: [
    { name: 'The Cliff Path', outdoor: true, desc: 'A goat path down the cheek of a giant stone face. The sea booms below.', foes: [['gargoyle', 2], ['bog_light', 1]] },
    { name: 'Inside the Nose', desc: 'A cave in the profile\'s nose, where the loremasters worked. Chisel marks everywhere.', foes: [['revenant', 2]] },
    { name: 'The Chisel-Room', desc: 'A plinth. On it, a dagger that is also a chisel.', foes: [['wight', 2], ['specter', 2]], loot: { cp: 30000, items: ['chisel_of_unmaking'], note: 'The Chisel of Unmaking: the tool that struck her face from every mural and sea-cliff. It can wound what regathers.' } },
  ], onClear: (c) => c.journal('The Erased Face: you have the Chisel of Unmaking.') },
  weeping_glacier: { theme: 'cave', rooms: [
    { name: 'The Ice Face', outdoor: true, desc: 'Soldiers in the ice, frozen mid-march, faces turned toward you.', foes: [['revenant', 3]] },
    { name: 'The Anchor-Chapel', desc: 'A chapel under the ice, its bell of bronze half-thawed.', foes: [['wight', 2], ['revenant', 2]], loot: { cp: 40000, items: ['bellbronze_wraps', 'potion_superior'] } },
    { name: 'The Glacier\'s Heart', desc: 'Something huge and white is waking in the meltwater.', foes: [['wyrm_young', 2]] },
  ], onClear: (c) => { c.journal('The Weeping Glacier is quiet. The anchor-chapel bell is yours.'); W(c).fronts.bells.clock = Math.max(0, W(c).fronts.bells.clock - 2); } },
  peaks_lair: { theme: 'cave', rooms: [
    { name: 'The Snowless Path', outdoor: true, desc: 'A path where the snow melts as it lands. Bones of goats, and men.', foes: [['troll', 2], ['ogre', 2]] },
    { name: 'The Wyrm\'s Throat', desc: 'A cave mouth breathing frost. Inside, a hoard of two centuries.', foes: [['wyrm_adult', 1]], loot: { cp: 300000, items: ['greatsword_plus3', 'potion_supreme', 'jade_idol'] } },
  ], onClear: (c) => { c.journal('You killed the Old Wyrm of the Peaks. Songs will be written. Some of them will even be accurate.'); W(c).renown += 20; } },
  mire_depths: { theme: 'mire', rooms: [
    { name: 'Where the Water Goes Down', outdoor: true, desc: 'A whirlpool the size of a village, turning slowly in the black water. You go down with it.', foes: [['drowned', 4], ['bog_light', 2]] },
    { name: 'The Drowned Halls', desc: 'Halls under the Mire, older than Lahti, older than elves. The water stands up in walls.', foes: [['death_knight', 1], ['revenant', 2]] },
    { name: 'The Throat', desc: 'Something vast, at the bottom of everything, drinking. It notices you.', foes: [['drinker', 1]], loot: { cp: 500000, items: ['potion_supreme', 'potion_supreme'] } },
  ], onClear: (c) => { const d = W(c).fronts.drinker; d.ended = true; c.out('title', 'The End of the Drinker'); c.narr('The water stops. For the first time in ten thousand years, the Mire begins to fill. In Shpagin, the stilt-houses float. Nobody minds.'); c.journal('You killed the Drinker Below. Lahti is yours to live in. There will be other troubles; there always are.'); W(c).renown += 50; } },
};
registerStory(STORY_SITES);

function bellTowerDone(c: Ctx, which: string) {
  c.set(`tower_${which}`, true);
  c.out('good', `The ${locName(c.s, which)} bell is silent.`);
  const f = W(c).fronts.bells;
  f.clock = Math.max(0, f.clock - 3);
  const done = ['coltale', 'largo', 'borschardt'].filter((x) => c.flag(`tower_${x}`)).length;
  c.journal(`The bell at ${locName(c.s, which)} is silenced (${done} of 3).`);
  if (done === 3) {
    c.out('title', 'Three bells silent');
    c.narr('That night every candle you can see gutters green at once, and the ground under your feet shivers, once, like something turning over in its sleep. It came from the west. From Suomi.');
    discover(c, 'old_vaults', 'all three bells are silent');
    c.journal('All three bells are silent, and she felt it. The Old Vaults beneath Suomi: that\'s where she sleeps. Elisiah said not to open them.');
  }
}

function queenFalls(c: Ctx) {
  const f = W(c).fronts.bells;
  const rite = (hasItem(c.pc, 'true_name') && hasItem(c.pc, 'bell_pattern')) || !!c.flag('rite_attempted') || hasItem(c.pc, 'chisel_of_unmaking');
  f.ended = true; f.clock = 0;
  c.set('queen_fallen', true);
  c.out('title', 'The Pale Queen');
  if (rite) {
    c.narr('Her body falls to ash, and the ash begins to gather itself, patiently, the way it has before. You say her name, all of it. You ring the old pattern forwards on the inverted bell. The ash stops.');
    c.narr('"Oh," says Vessariel, from nowhere in particular. "Oh, little candle. You remembered me. That\'s all I wanted." And then there is nobody there to remember, and you find you can\'t quite recall what she looked like.');
    c.set('queen_forgotten', true);
    c.journal('Vessariel, the Pale Queen, is gone: not dead but forgotten, properly, forever. You\'re the only one who remembers that there was anything to forget.');
  } else {
    c.narr('Her body falls to ash. As you leave, the ash is already stirring, gathering, patient. You have bought Lahti a generation, maybe two. Somebody will have to finish this one day.');
    c.journal('Vessariel is down, but not ended. The ash will gather again, slowly. The Rite of Holy Forgetting would finish her: her true name, the bell pattern, a ruler\'s renunciation.');
  }
  c.xp(5000);
  W(c).renown += 30;
  const d = W(c).fronts.drinker; if (!d.active) { d.active = true; d.clock = 3; }
  discover(c, 'drowned_shrine', 'the cult scatters south');
  c.out('title', 'Lahti, after');
  c.sys('The bells are over. Lahti is not. The world keeps going: there are threats bigger than a queen, a property to buy, roads you haven\'t walked. Do what you like.');
}

// ---------- property ----------
const PROPERTY_TYPES: Record<Property['type'], { price: number; base: number; label: string }> = {
  house: { price: 30000, base: 0, label: 'a narrow townhouse' },
  farm: { price: 50000, base: 40, label: 'a smallholding with a barn' },
  shop: { price: 80000, base: 90, label: 'a shopfront with rooms above' },
  smithy: { price: 100000, base: 120, label: 'a forge with a yard' },
  tavern: { price: 150000, base: 200, label: 'an empty tavern, bar still standing' },
};
const UPGRADES: Record<string, { cost: number; income: number; rep: number; for: Property['type'][]; desc: string }> = {
  kitchen: { cost: 15000, income: 60, rep: 1, for: ['tavern'], desc: 'a proper kitchen: hot food brings people in' },
  rooms: { cost: 25000, income: 90, rep: 1, for: ['tavern'], desc: 'guest rooms upstairs' },
  cellar: { cost: 10000, income: 40, rep: 0, for: ['tavern', 'shop'], desc: 'a stocked cellar' },
  stage: { cost: 12000, income: 50, rep: 2, for: ['tavern'], desc: 'a stage for bards and brawls' },
  still: { cost: 20000, income: 70, rep: 1, for: ['tavern', 'farm'], desc: 'a still for your own house spirit' },
  sign: { cost: 2000, income: 10, rep: 1, for: ['tavern', 'shop', 'smithy', 'farm'], desc: 'a painted sign with your name on it' },
  strongroom: { cost: 15000, income: 0, rep: 0, for: ['tavern', 'shop', 'smithy', 'house'], desc: 'a strongroom: thieves stop being a problem' },
  orchard: { cost: 10000, income: 40, rep: 0, for: ['farm'], desc: 'an orchard of Brumandell apples' },
  livestock: { cost: 15000, income: 60, rep: 0, for: ['farm'], desc: 'pigs, goats and a very angry goose' },
  forge2: { cost: 30000, income: 100, rep: 1, for: ['smithy'], desc: 'a second forge and an apprentice' },
  stock: { cost: 20000, income: 80, rep: 0, for: ['shop'], desc: 'better stock, imported through Madsen' },
};
const STAFF: Record<string, { wage: number; income: number; desc: string }> = {
  barkeep: { wage: 20, income: 60, desc: 'keeps the bar when you\'re away' },
  cook: { wage: 25, income: 50, desc: 'makes the food worth the walk' },
  bouncer: { wage: 20, income: 0, desc: 'keeps trouble outside' },
  bard: { wage: 15, income: 40, desc: 'plays most nights' },
  clerk: { wage: 15, income: 40, desc: 'keeps the books honest' },
  farmhand: { wage: 10, income: 30, desc: 'does the actual work' },
};

export function forSale(c: Ctx, town: string) {
  c.out('title', `Property for sale in ${locName(c.s, town)}`);
  for (const [k, v] of Object.entries(PROPERTY_TYPES)) c.narr(`• ${k}: ${v.label}, ${fmtMoney(v.price)}${v.base ? ` (earns about ${fmtMoney(v.base)} a day once it\'s running)` : ' (a safe place to sleep and stash things)'}`);
  c.sys('Say "buy the tavern" (or shop, farm, house, smithy).');
}

export function buyProperty(c: Ctx, type: Property['type']) {
  syncAt(c.s);
  const town = c.s.world.at;
  if (!townById(town)) { c.sys('You can only buy property in a town.'); return; }
  const t = PROPERTY_TYPES[type];
  if (!c.pay(t.price)) { c.bad(`That costs ${fmtMoney(t.price)}. You have ${fmtMoney(c.pc.copper)}.`); return; }
  const w = W(c);
  const id = `p${w.nextId++}`;
  const pr: Property = { id, town, type, name: `${c.pc.name}'s ${type === 'house' ? 'House' : type === 'farm' ? 'Farm' : type === 'shop' ? 'Shop' : type === 'smithy' ? 'Forge' : 'Tavern'}`, upgrades: [], staff: [], cash: 0, rep: 0, lastDay: dayOf(c.s), events: 0 };
  w.properties.push(pr);
  ensureProperty(pr);
  c.good(`It's yours: ${t.label} in ${locName(c.s, town)}. The notary hands you a deed and a very large key.`);
  c.journal(`You own ${t.label} in ${locName(c.s, town)}: ${pr.name}.`);
  c.sys(`"name it <something>", "upgrade", "hire a barkeep", "collect". It's just off the square ("go to my property").`);
  c.move(`prop:${id}`);
}

export function ensureProperty(pr: Property) {
  const id = `prop:${pr.id}`;
  const hub = townHub(pr.town);
  ensureTown(pr.town);
  ROOMS[id] = {
    id, name: pr.name, region: locName({ world: { sites: {} } } as unknown as GameState, pr.town), rest: 'long',
    desc: () => `${pr.name}, in ${townById(pr.town)?.name}. ${pr.type === 'tavern' ? (pr.upgrades.length ? `A working tavern: ${pr.upgrades.map((u) => UPGRADES[u]?.desc).join(', ')}.` : 'An empty bar, dust on the shelves, and a lot of potential.') : PROPERTY_TYPES[pr.type].label + '.'} ${pr.staff.length ? `Your staff: ${pr.staff.join(', ')}.` : 'No staff yet.'} The strongbox holds ${fmtMoney(pr.cash)}. Reputation: ${pr.rep >= 8 ? 'famous' : pr.rep >= 4 ? 'well liked' : pr.rep >= 1 ? 'known' : 'nobody\'s heard of it'}.`,
    exits: [{ to: hub, names: ['out', 'outside', 'square', 'leave', 'exit', 'street', 'door'], label: 'Out to the square', minutes: 1 }],
    features: [{ id: 'strongbox', names: ['strongbox', 'books', 'ledger', 'takings', 'till', 'money'], look: () => `${fmtMoney(pr.cash)} in the strongbox.`, open: (c) => collect(c, pr), search: (c) => collect(c, pr), read: (c) => collect(c, pr) }],
    chips: () => ['collect', 'upgrade', 'hire staff', 'work the bar', 'name it'],
  };
  MAPS[id] = { rows: ['################', '#H.............#', '#H..sTTs..sTTs.#', '#..............#', '#..sTTs..sTTs..#', '#..............#', '#BBBBBB...@.k..#', '#.....B......b.#', '#######0########'] };
  // the hub square gets a door to it
  const sq = ROOMS[hub];
  const ex = { to: id, names: ['my property', 'my place', pr.name.toLowerCase(), `my ${pr.type}`, 'home', 'property'], label: pr.name, minutes: 2 };
  if (sq) { const i = sq.exits.findIndex((e) => e.to === id); if (i >= 0) sq.exits[i] = ex; else sq.exits.push(ex); }
}

function income(pr: Property): number {
  const t = PROPERTY_TYPES[pr.type];
  let inc = t.base;
  for (const u of pr.upgrades) inc += UPGRADES[u]?.income ?? 0;
  for (const st of pr.staff) inc += (STAFF[st]?.income ?? 0) - (STAFF[st]?.wage ?? 0);
  return Math.max(0, Math.round(inc * (1 + pr.rep * 0.1)));
}

function propertyTick(c: Ctx) {
  const day = dayOf(c.s);
  for (const pr of W(c).properties) {
    const days = day - pr.lastDay;
    if (days <= 0) continue;
    pr.lastDay = day;
    const run = pr.type === 'house' ? 0 : pr.staff.length || pr.type === 'farm' ? days : Math.min(days, 1);
    pr.cash += income(pr) * run;
  }
}

export function collect(c: Ctx, pr?: Property) {
  const p = pr ?? W(c).properties.find((x) => c.s.loc === `prop:${x.id}`);
  if (!p) { c.sys('You\'re not at one of your properties.'); return; }
  propertyTick(c);
  if (p.cash > 0) { c.money(p.cash); c.good(`You empty the strongbox: ${fmtMoney(p.cash)}.`); p.cash = 0; }
  else c.narr('The strongbox is empty. Business needs time, or staff.');
  if (dayOf(c.s) - (p.events ?? 0) >= 5 && p.type !== 'house') { p.events = dayOf(c.s); propertyEvent(c, p); }
}

function propertyEvent(c: Ctx, p: Property) {
  const r = die(c.rng, 8);
  c.out('title', `${p.name}: this week`);
  const guarded = p.staff.includes('bouncer') || p.upgrades.includes('strongroom');
  if (r === 1) { if (guarded) c.narr('Somebody tried to rob the place. Your bouncer threw them through the window, which you\'ll pay for.'); else { const lost = Math.min(c.pc.copper, 2000); c.pc.copper -= lost; c.bad(`Thieves broke in while you were away: ${fmtMoney(lost)} gone. (A bouncer or a strongroom would help.)`); } return; }
  if (r === 2) { c.narr('A famous bard passed through and played all night. People are still talking about it.'); p.rep += 1; return; }
  if (r === 3) { c.narr('A brawl broke out over a card game. Nobody died. The furniture did.'); c.pay(Math.min(c.pc.copper, 500)); return; }
  if (r === 4) { c.narr(`A rival owner offers to buy you out for ${fmtMoney(Math.round(PROPERTY_TYPES[p.type].price * 1.5))}. You can say "sell my property" if you want to.`); c.set(`buyout_${p.id}`, Math.round(PROPERTY_TYPES[p.type].price * 1.5)); return; }
  if (r === 5) { c.narr('Two quiet people in grey asked to rent the cellar "for meetings". There were green candles in their bags. You said no. Probably.'); return; }
  if (r === 6) { c.narr('A crown tax assessor came by. He was very thorough.'); c.pay(Math.min(c.pc.copper, income(p) * 3)); return; }
  if (r === 7) { c.narr('Word gets around: travellers ask for your place by name now.'); p.rep += 1; return; }
  c.narr('A quiet week. Good.');
}

export function upgrade(c: Ctx, what: string) {
  const p = W(c).properties.find((x) => c.s.loc === `prop:${x.id}`);
  if (!p) { c.sys('Upgrade what? Go to your property first.'); return; }
  const avail = Object.entries(UPGRADES).filter(([k, u]) => u.for.includes(p.type) && !p.upgrades.includes(k));
  const w = what.toLowerCase();
  const pickU = avail.find(([k, u]) => w && (w.includes(k) || u.desc.includes(w)));
  if (!pickU) { c.out('title', 'Upgrades'); for (const [k, u] of avail) c.narr(`• ${k}: ${u.desc}, ${fmtMoney(u.cost)}`); if (!avail.length) c.narr('Nothing left to build.'); c.sys('Say "upgrade kitchen" (or any of the above).'); return; }
  const [k, u] = pickU;
  if (!c.pay(u.cost)) { c.bad(`That costs ${fmtMoney(u.cost)}.`); return; }
  p.upgrades.push(k); p.rep += u.rep;
  c.good(`Built: ${u.desc}.`);
}

export function hire(c: Ctx, who: string) {
  const p = W(c).properties.find((x) => c.s.loc === `prop:${x.id}`);
  if (!p) { c.sys('Hire them where? Go to your property first.'); return; }
  const w = who.toLowerCase();
  const role = Object.keys(STAFF).find((k) => w.includes(k) || (k === 'barkeep' && /bartender|barman|barmaid/.test(w)) || (k === 'bouncer' && /guard|muscle/.test(w)) || (k === 'bard' && /musician|singer|fiddler/.test(w)));
  if (!role) { c.out('title', 'Staff'); for (const [k, v] of Object.entries(STAFF)) c.narr(`• ${k}: ${v.desc}, ${fmtMoney(v.wage)} a day`); c.sys('Say "hire a cook" (or any of the above).'); return; }
  if (p.staff.includes(role)) { c.sys(`You already have a ${role}.`); return; }
  p.staff.push(role);
  c.good(`You hire a ${role}: ${STAFF[role].desc}. They start tomorrow.`);
}

export function nameProperty(c: Ctx, name: string) {
  const p = W(c).properties.find((x) => c.s.loc === `prop:${x.id}`) ?? W(c).properties[W(c).properties.length - 1];
  if (!p) { c.sys('You don\'t own anywhere to name.'); return; }
  const n = name.replace(/["“”]/g, '').trim().slice(0, 40);
  if (!n) { c.sys('Name it what?'); return; }
  const old = `prop:${p.id}`;
  p.name = n.replace(/\b\w/g, (m) => m.toUpperCase());
  delete ROOMS[old];
  ensureProperty(p);
  c.good(`It's called ${p.name} now. Someone will paint the sign.`);
}

export function workBar(c: Ctx) {
  const p = W(c).properties.find((x) => c.s.loc === `prop:${x.id}`);
  if (!p) return false;
  c.advance(6 * 60);
  const ok = c.check(p.type === 'tavern' ? 'performance' : p.type === 'farm' ? 'athletics' : 'persuasion', 12);
  const earn = Math.round(income(p) * (ok ? 1.5 : 0.7)) + 20;
  c.money(earn);
  if (ok) p.rep += 0.5;
  c.narr(p.type === 'tavern' ? (ok ? 'You work the bar all evening: pouring, listening, throwing out one man twice. It\'s a good night.' : 'A slow night. You polish the same mug for an hour, and finally understand Squib.') : 'A long day\'s work at your own place.');
  c.good(`You take ${fmtMoney(earn)}.`);
  return true;
}

export function sellProperty(c: Ctx) {
  const p = W(c).properties.find((x) => c.s.loc === `prop:${x.id}`);
  if (!p) { c.sys('Go to the property you want to sell.'); return; }
  const price = (c.flag(`buyout_${p.id}`) as number) || Math.round(PROPERTY_TYPES[p.type].price * 0.7);
  c.money(price + p.cash);
  W(c).properties = W(c).properties.filter((x) => x !== p);
  const sq = ROOMS[townHub(p.town)]; if (sq) sq.exits = sq.exits.filter((e) => e.to !== `prop:${p.id}`);
  c.good(`Sold, for ${fmtMoney(price)}${p.cash ? ` plus ${fmtMoney(p.cash)} in the strongbox` : ''}.`);
  c.move(townHub(p.town));
}

// ---------- hirelings ----------
const HIRE_ROLES: Record<string, { label: string; ac: number; hpPer: number; dmg: (l: number) => string; dtype: DamageType; dex: number; verb: string; look: string; lines: string[] }> = {
  sellsword: { label: 'sellsword', ac: 16, hpPer: 9, dmg: (l) => `${1 + Math.floor(l / 5)}d8+3`, dtype: 'slashing', dex: 1, verb: 'hacks at', look: 'A veteran in a patched army coat, with a sword that has been sharpened so often it is thinner than it should be.', lines: ['"I fought at Greymarch. I don\'t talk about Greymarch."', '"Pay on time and point me at things. That\'s the whole arrangement."', '"Did you hear that? No? Good."'] },
  rifleman: { label: 'rifleman', ac: 14, hpPer: 7, dmg: (l) => `${1 + Math.floor(l / 5)}d10+2`, dtype: 'piercing', dex: 3, verb: 'shoots', look: 'A lean ex-sniper with a Mosin across their back and a habit of choosing the high ground.', lines: ['"I don\'t miss. I mean, I do, but not twice."', '"Keep them off me and I\'ll keep them off you."', '"Smells like rain. Rain\'s good. Hides the shot."'] },
  hedge_mage: { label: 'hedge-mage', ac: 12, hpPer: 6, dmg: (l) => `${1 + Math.floor(l / 4)}d10`, dtype: 'fire', dex: 2, verb: 'throws fire at', look: 'A charmwright with singed eyebrows, bone charms clicking at the wrists, and a firm opinion about everything.', lines: ['"Don\'t touch the charms. That one bites."', '"The dead hate fire. Everyone hates fire. That\'s why it works."', '"My mother carved wards for the whole Thornwood. I set things alight. We\'re both proud."'] },
  brawler: { label: 'brawler', ac: 13, hpPer: 11, dmg: (l) => `${1 + Math.floor(l / 5)}d6+4`, dtype: 'bludgeoning', dex: 1, verb: 'clobbers', look: 'An orc dockhand with knuckles like walnuts and a laugh you can hear across a harbour.', lines: ['"Hit first. Ask later. Ask what? Doesn\'t matter."', '"I like you. You don\'t talk much. Wait, you talk a lot."', '"Buy me a drink after and we\'re square."'] },
};
const HIRE_FIRST = ['Bram', 'Ilka', 'Dov', 'Senna', 'Kasimir', 'Rook', 'Jana', 'Otto', 'Mira', 'Tobiah', 'Wren', 'Grisha'];

function registerHire(h: Hire) {
  const r = HIRE_ROLES[h.kind] ?? HIRE_ROLES.sellsword;
  COMPANIONS[h.id] = { id: h.id, name: h.name, ac: r.ac + Math.floor(h.level / 6), maxHp: 8 + r.hpPer * h.level, toHit: 3 + Math.ceil(h.level / 2), damage: r.dmg(h.level), dtype: r.dtype, dex: r.dex, verb: r.verb };
  NPCS[h.id] = { id: h.id, name: h.name, names: [h.name.toLowerCase(), r.label, h.kind.replace('_', ' '), 'hireling', 'merc', 'mercenary'], short: `your hired ${r.label}`, look: () => r.look,
    greet: (c: Ctx) => c.say(h.id, pick(c.rng, r.lines)),
    topics: [
      { id: 'story', keys: ['story', 'past', 'yourself', 'background', 'war', 'who are you'], say: (c: Ctx) => c.say(h.id, pick(c.rng, r.lines)) },
      { id: 'pay', keys: ['pay', 'wage', 'money', 'contract', 'coin'], say: (c: Ctx) => c.say(h.id, `"${fmtMoney(h.wage)} a day, paid at dawn. Miss a day and I walk."`) },
    ],
    unknown: ['"Not my department."', 'They shrug and check their weapon.'] } as unknown as typeof NPCS[string];
}

export function hireMerc(c: Ctx, what: string) {
  const w = W(c);
  w.hires ??= [];
  const kind = /rifle|sniper|shoot|gun/.test(what) ? 'rifleman' : /mage|wizard|charm|caster|witch/.test(what) ? 'hedge_mage' : /brawl|orc|muscle|fist/.test(what) ? 'brawler' : /sell|sword|merc|fighter|guard|blade|soldier|warrior|help|companion/.test(what) ? 'sellsword' : '';
  if (!kind) { c.out('title', 'Hirelings for hire'); for (const r of Object.values(HIRE_ROLES)) c.narr(`• ${r.label}: ${r.look} (${fmtMoney(60 * c.pc.level)} a day, plus ${fmtMoney(300 * c.pc.level)} to sign)`); c.sys('Say "hire a sellsword" (or rifleman, hedge-mage, brawler). You can keep two.'); return; }
  if (w.hires.length >= 2) { c.sys('You already have two hirelings. ("dismiss <name>" first.)'); return; }
  const sign = 300 * c.pc.level;
  if (!c.pay(sign)) { c.bad(`They want ${fmtMoney(sign)} to sign on. You're short.`); return; }
  const id = `hire_${w.nextId++}`;
  const used = new Set(w.hires.map((h) => h.name.split(' ')[0]));
  const first = pick(c.rng, HIRE_FIRST.filter((n) => !used.has(n)));
  const h: Hire = { id, name: first, role: HIRE_ROLES[kind].label, kind, level: c.pc.level, wage: 60 * c.pc.level, since: dayOf(c.s) };
  w.hires.push(h);
  registerHire(h);
  c.addCompanion(id);
  c.s.companionHp[id] = COMPANIONS[id].maxHp;
  c.good(`${first} the ${h.role} signs on for ${fmtMoney(h.wage)} a day.`);
  c.say(id, pick(c.rng, HIRE_ROLES[kind].lines));
}

export function dismiss(c: Ctx, who: string) {
  const w = W(c);
  const h = (w.hires ?? []).find((x) => who.toLowerCase().includes(x.name.toLowerCase()) || who.toLowerCase().includes(x.role));
  if (!h) return false;
  w.hires = w.hires!.filter((x) => x !== h);
  c.s.companions = c.s.companions.filter((x) => x !== h.id);
  c.narr(`${h.name} shakes your hand, counts their pay twice, and goes.`);
  return true;
}

function payHires(c: Ctx) {
  const w = W(c);
  for (const h of [...(w.hires ?? [])]) {
    if (!c.s.companions.includes(h.id)) { w.hires = w.hires!.filter((x) => x !== h); continue; }
    if (c.pc.level > h.level) { h.level = c.pc.level; registerHire(h); }
    if (!c.pay(h.wage)) { w.hires = w.hires!.filter((x) => x !== h); c.s.companions = c.s.companions.filter((x) => x !== h.id); c.bad(`You couldn't pay ${h.name}. They leave before breakfast.`); }
  }
}

// ---------- view for the UI ----------
export interface WorldPin { id: string; name: string; x: number; y: number; kind: 'town' | 'site' | 'story' | 'here' | 'property'; visited?: boolean; cleared?: boolean; level?: number; blurb?: string; days?: number }
export interface WorldViewData { pins: WorldPin[]; here: { x: number; y: number } | null; fronts: Front[]; jobs: Job[]; journey: string | null; atName: string; renown: number }
export function worldView(s: GameState): WorldViewData {
  syncAt(s);
  const pins: WorldPin[] = [];
  const here = locPoint(s, s.world.at);
  for (const t of TOWNS) pins.push({ id: t.id, name: t.name, x: t.x, y: t.y, kind: 'town', visited: s.world.visited.includes(t.id), blurb: t.blurb, days: route(s, s.world.at, t.id)?.days });
  for (const id of s.world.found) {
    const p = locPoint(s, id); if (!p) continue;
    const poi = poiById(id);
    const site = s.world.sites[id];
    pins.push({ id, name: locName(s, id), x: p.x, y: p.y, kind: poi?.story ? 'story' : 'site', cleared: site?.cleared, level: poi?.level ?? site?.level, blurb: poi?.blurb ?? (site ? `A ${THEMES[site.kind]?.label ?? 'place'} (suggested level ${site.level}).` : ''), days: route(s, s.world.at, id)?.days });
  }
  for (const pr of s.world.properties) { const t = townById(pr.town); if (t) pins.push({ id: `prop:${pr.id}`, name: pr.name, x: t.x + 0.012, y: t.y - 0.012, kind: 'property' }); }
  const j = s.world.journey;
  let at = here;
  if (j) { const a = locPoint(s, j.route[j.leg]), b = locPoint(s, j.route[Math.min(j.leg + 1, j.route.length - 1)]); const f = Math.min(1, j.day / (j.legs[j.leg] || 1)); if (a && b) at = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
  return { pins, here: at, fronts: Object.values(s.world.fronts).filter((f) => f.active), jobs: s.world.jobs.filter((x) => x.taken && !x.paid), journey: j ? locName(s, j.dest) : null, atName: locName(s, s.world.at), renown: s.world.renown };
}

export function migrateWorld(s: GameState) {
  resetProcedural();
  s.world ??= newWorld(s.rng.state ^ 0x5eed);
  s.world.fronts ??= initialFronts();
  for (const [k, v] of Object.entries(initialFronts())) s.world.fronts[k] ??= v;
  s.world.properties ??= []; s.world.jobs ??= []; s.world.found ??= []; s.world.visited ??= ['breda']; s.world.sites ??= {}; s.world.renown ??= 0;
  if (s.flags.quest_chapel && !s.world.found.includes('old_chapel')) s.world.found.push('old_chapel');
  for (const pr of s.world.properties) ensureProperty(pr);
  for (const h of s.world.hires ?? []) registerHire(h);
}

// ---------- wiring ----------
bindTownHooks({ rumour, board, forSale, arrive: townArrive });
export { ensureTown, townHub, STORY_SITES, ITEMS };
export type { Room };
