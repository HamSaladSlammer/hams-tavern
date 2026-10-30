// Campaigns: a story laid over the open world, chapter by chapter. Hand-written campaigns, a
// custom campaign the player designs, and a generator that never runs out. Every campaign uses
// the same map, towns and systems, so whatever you do between chapters still counts.
import type { Ctx } from '../content/types';
import type { CampaignSpec, CampaignState, MonsterDef, SiteState } from '../engine/types';
import { MONSTERS } from '../engine/srd';
import { die, pick, type Rng } from '../engine/dice';
import { fmtMoney } from '../engine/character';
import { TOWNS, townById } from './atlas';
import { newSite, discover, hubOf, locName, bindCampaignHook, rebuildSite } from './index';

export interface Vars { villain: string; title: string; town: string; target: string; hero: string }
export interface ChapterDef {
  title: string;
  hook: (v: Vars) => string;
  near: string;
  kind: string;
  level: number; // added to the campaign's base level
  name?: string;
  boss?: string; // monster id, or 'villain' / 'lieutenant'
  rooms?: number;
  descs?: string[];
  poi?: string; // use a named place on the map instead of a new site
  clear: (v: Vars) => string;
}
export interface CampaignDef {
  id: string;
  title: string;
  tagline: string;
  blurb: string;
  start: string;
  levels: string;
  villain: { name: string; title: string; base: string };
  lieutenant?: { name: string; base: string };
  target?: string;
  setup?: (c: Ctx) => void;
  intro: (v: Vars) => string[];
  chapters: ChapterDef[];
  epilogue: (v: Vars) => string[];
}

// ---------- hand-written campaigns ----------
export const CAMPAIGNS: CampaignDef[] = [
  {
    id: 'drowned_crown', title: 'The Drowned Crown', tagline: 'Smugglers, a sunken treasure, and a captain who refuses to stay dead.', start: 'largo', levels: '1–6',
    blurb: 'Largo is a fishing town that does not fish. When a smuggling crew pulls a crown out of the Aimo, the whole river goes mad for it, and the drowned start walking up the quays.',
    villain: { name: 'Captain Ysolde Marrow', title: 'the Drowned Queen of Largo', base: 'drowned_captain' }, lieutenant: { name: 'Bosun Grieg', base: 'thug' }, target: 'the Crown of the Aimo',
    intro: (v) => [`Largo, at dawn. The river smells of tar and rot. A dockhand is shouting that the drowned came up the quay last night and took the night-watchman, and that it was ${v.villain}'s crew, and that ${v.villain} has been dead for nine years.`, `The harbourmaster presses ten silver into your hand. "Find out what's going on before the whole town floats away."`],
    chapters: [
      { title: 'The Fish Warehouse', near: 'largo', kind: 'bandit_camp', level: 0, name: 'The Fish Warehouse on Pier Nine', boss: 'smuggler', rooms: 3,
        hook: () => 'The watchman was last seen at the fish warehouse on Pier Nine. Nobody has sold fish out of it in years.', clear: (v) => `In the warehouse office: a manifest for one crate, marked "for the Captain", signed with a wet thumbprint. And a name scratched into the desk: ${v.villain}.` },
      { title: 'The Sunken Ferry', near: 'largo', kind: 'mire', level: 1, poi: 'sunken_ferry',
        hook: () => 'The manifest says the crate went down with the old refugee ferry. On the wrong night, they say, the ferry still runs under the water.', clear: () => 'The refugees are at rest. The crate is empty, and the lid has been opened from the inside.' },
      { title: 'The Smugglers\' Cave', near: 'maxim', kind: 'cave', level: 2, name: 'Gull Cave', boss: 'lieutenant', rooms: 4,
        hook: (v) => `A drunk sailor in Maxim swears ${v.villain}'s bosun is hiding in Gull Cave with what's left of the crew, and that they've got something gold that hums.`, clear: (v) => `The bosun dies cursing. In his coat: a chart of the Aimo with an X where the river meets the Mire, and the words "she wears it there". ${v.target} is with ${v.villain}.` },
      { title: 'The Drowned Shrine', near: 'shpagin', kind: 'mire', level: 3, poi: 'drowned_shrine',
        hook: () => 'The X on the chart is the Drowned Shrine. Green candles burn on its steps. Somebody is helping the dead.', clear: (v) => `The cult was keeping ${v.villain} fed. Beneath the grate, the river runs downward, toward something. A wet trail leads east, back toward Largo.` },
      { title: 'The Captain\'s Wreck', near: 'largo', kind: 'mire', level: 4, name: 'The Wreck of the Marrow', boss: 'villain', rooms: 4,
        descs: ['The wreck of the Marrow lies half-sunk in the reeds south of Largo, her masts like ribs.', 'Below decks, water to the knee, and lanterns that nobody lit.', 'The hold: crates of Bellwax, rotting rope, and things that were sailors.', `The captain's cabin. A woman in a waterlogged coat sits in a chair of coral, a crown on her head. "Took you long enough," she says.`],
        hook: (v) => `${v.villain} has gone back to her own ship to wait for the tide. ${v.target} is with her.`, clear: (v) => `${v.villain} breaks like a wave on rocks. ${v.target} rolls across the deck and stops at your feet, perfectly dry.` },
    ],
    epilogue: (v) => ['Largo throws you a party you will not remember. The drowned stay down. The harbourmaster tries to buy the crown from you; three other people try to steal it.', `Whatever you do with ${v.target}, the river will remember who took it back.`],
  },
  {
    id: 'iron_and_ash', title: 'Iron and Ash', tagline: 'A war nobody wants, and the man who is selling it.', start: 'tokarev', levels: '2–8',
    blurb: 'The treaty that ended the civil war is fifteen years old and fraying. Someone in Tokarev is shipping crown rifles to both sides of the border, and you have just seen something you shouldn\'t have.',
    villain: { name: 'Colonel Anselm Varga', title: 'the Merchant of Ash', base: 'bandit_captain' }, lieutenant: { name: 'Sergeant Kell', base: 'hired_gun' }, target: 'the Treaty of Fifteen Years',
    setup: (c) => { const t = c.s.world.fronts.treaty; t.active = true; t.clock = 4; },
    intro: (v) => [`Tokarev, the works town, all soot and steam whistles. You took a job hauling crates from the arms works. Tonight you opened one by accident: crown rifles, stencilled for Makrovin.`, `A clerk saw you see it. By morning there will be a warrant with your face on it. The man who signs the shipping orders is ${v.villain}.`],
    chapters: [
      { title: 'The Deserters\' Camp', near: 'tokarev', kind: 'bandit_camp', level: 0, name: 'Varga\'s Pickets', boss: 'bandit_captain', rooms: 3,
        hook: (v) => `The rifles go out by road to a camp of deserters who work for ${v.villain}. Take the camp and you take the proof.`, clear: () => 'Crates, ledgers, and a captain who talks before he dies: the guns cross the border at the Treaty Stone, under the noses of both patrols.' },
      { title: 'The Treaty Stone', near: 'samopal', kind: 'bandit_camp', level: 1, poi: 'treaty_stone',
        hook: () => 'Someone is chiselling the names off the Treaty Stone, to start the war the guns are for.', clear: (v) => `The cell at the stone was paid through a Borschardt counting-house. ${v.villain} isn't selling to one side. He's selling the war.` },
      { title: 'The Radom Depot', near: 'radom', kind: 'ruin', level: 2, name: 'The Old Radom Arms Depot', boss: 'lieutenant', rooms: 4,
        hook: (v) => `${v.villain}'s quartermaster runs the guns out of a depot outside Radom that was supposed to be demolished after the war.`, clear: (v) => `The quartermaster's orders: ${v.villain} will be at Borschardt to collect the last payment, then disappear across the sea.` },
      { title: 'The Counting House', near: 'borschardt', kind: 'cult', level: 3, name: 'Hollis & Vane, Counting-House', boss: 'hired_gun', rooms: 4,
        hook: () => 'The money goes through a counting-house on Guild Street. Bankers don\'t fight. Their guards do.', clear: (v) => `In the strongroom: payment receipts from both crowns, and the time and place of ${v.villain}'s ship: Madsen harbour, the old customs fort.` },
      { title: 'The Customs Fort', near: 'madsen', kind: 'battlefield', level: 4, name: 'The Old Customs Fort', boss: 'villain', rooms: 4,
        descs: ['A squat fort on the Madsen breakwater, built to stop smugglers and now full of them.', 'The gun deck: crates of rifles, half-loaded onto a lighter.', 'The barracks. Men who were soldiers once, and are now just armed.', `The colonel's office, maps on every wall. ${'Varga'} buttons his coat. "Every war pays somebody. Why not me?"`],
        hook: (v) => `${v.villain} sails tonight from the old customs fort in Madsen. After that, the war happens without him.`, clear: (v) => `${v.villain} falls among his maps. The ledgers you carry out of the fort will hang half the men in Borschardt.` },
    ],
    epilogue: (v) => [`You hand the ledgers to a crown courier and a Makrovin envoy at the same table. Nobody thanks you, but the patrols stand down. ${v.target} holds, for now.`, 'There will be other wars. There always are. This one, at least, you took off the market.'],
  },
  {
    id: 'frost_wyrm', title: 'The Frost Wyrm of Herstal', tagline: 'A white dragon is waking in the Northern Peaks.', start: 'herstal', levels: '3–12',
    blurb: 'Herstal sits at the foot of the Peaks, where the winters bite. This year the glacier above the town is weeping, the wolves have come down to the gates, and the hermits say something under the snow has opened one eye.',
    villain: { name: 'Hrimvald', title: 'the Old Wyrm of the Peaks', base: 'wyrm_young' }, lieutenant: { name: 'The Pale Hunter', base: 'troll' }, target: 'Herstal',
    intro: (v) => ['Herstal, under snow. Every roof has a lantern on it, and every lantern is lit at noon.', `The reeve meets you at the gate with a frozen goat on a cart. "That's the third flock this month. Not wolves. Wolves don't freeze things." She looks up at the Peaks. "Something called ${v.villain}. My grandmother's stories. I want them to stay stories."`],
    chapters: [
      { title: 'The Wolf Den', near: 'herstal', kind: 'cave', level: 0, name: 'The Wolf Den under Black Pine', boss: 'dire_wolf', rooms: 3,
        hook: () => 'Start with the wolves. They\'re fleeing something, and fleeing things go where they shouldn\'t.', clear: () => 'The pack leader has frost-burns across her back, in the shape of claws far larger than any wolf.' },
      { title: 'The Abandoned Mine', near: 'herstal', kind: 'mine', level: 1, name: 'The Old Silver Shaft', boss: 'ogre', rooms: 4,
        hook: () => 'The silver miners abandoned their shaft in one night, leaving their dinners on the table. Something came up through the rock.', clear: (v) => `At the bottom of the shaft, a tunnel of melted, refrozen ice, wide as a road, climbing toward the Peaks. ${v.villain} has been digging.` },
      { title: 'The Weeping Glacier', near: 'herstal', kind: 'cave', level: 2, poi: 'weeping_glacier',
        hook: () => 'The tunnel opens in the Weeping Glacier, where soldiers stand frozen in the ice. They are closer every month.', clear: (v) => `The anchor-chapel bell rings once and the soldiers in the ice go still. Beyond them, a great cave mouth, and fresh tracks: ${v.villain} has a hunter.` },
      { title: 'The Hunter\'s Lodge', near: 'herstal', kind: 'cave', level: 3, name: 'The Lodge of Bones', boss: 'lieutenant', rooms: 4,
        hook: (v) => `A thing the hermits call the Pale Hunter brings ${v.villain} its meals. It lives in a lodge built from the bones of them.`, clear: (v) => `The Pale Hunter dies hard. Its lodge looks out over the Peaks to a cave where the snow never settles. That is where ${v.villain} sleeps.` },
      { title: 'The Wyrm\'s Throat', near: 'herstal', kind: 'cave', level: 5, poi: 'peaks_lair', boss: 'villain',
        hook: (v) => `${v.villain} is awake. You can hear it breathing from the lodge, like a storm in a bottle.`, clear: (v) => `${v.villain} falls, and the Peaks shudder, and for the first time in two hundred years the glacier stops weeping.` },
    ],
    epilogue: (v) => [`${v.target} rings every bell it has. The reeve gives you the freedom of the town, which mostly means free drinks, which is the best kind of freedom.`, 'The hoard in the Wyrm\'s Throat is yours, and so is a story the bards will ruin within a week.'],
  },
  {
    id: 'mire_below', title: 'The Mire Below', tagline: 'The swamp is drinking the rivers. Something is drinking the swamp.', start: 'shpagin', levels: '4–14',
    blurb: 'Shpagin is a town on stilts at the edge of the Mire. This year the stilts are going under. The witches are frightened, the cult has gone quiet, and every night the water pulls a little harder.',
    villain: { name: 'The Drinker Below', title: 'the thing at the bottom of everything', base: 'drinker' }, lieutenant: { name: 'Mother Sallow', base: 'mire_hag' }, target: 'the Mire',
    setup: (c) => { const d = c.s.world.fronts.drinker; d.active = true; d.clock = 4; },
    intro: () => ['Shpagin, knee-deep. The boardwalks are slick, and every house has a rope tied to the next one, in case.', 'The stilt-mayor is a tired orc who looks like he hasn\'t slept since spring. "The Mire\'s eating the town, and the Mire\'s being eaten. Witches say there\'s a mouth at the bottom. I say find it and shut it."'],
    chapters: [
      { title: 'The Bog-Lights', near: 'shpagin', kind: 'mire', level: 0, name: 'The Will-o\'-Wisp Fen', boss: 'bog_light', rooms: 3,
        hook: () => 'Pole-bargemen are vanishing in the fen where the bog-lights dance. Follow the lights, carefully.', clear: () => 'The lights were herding people somewhere: toward a hut on chicken-bone stilts, deep in the reeds.' },
      { title: 'Mother Sallow\'s Hut', near: 'shpagin', kind: 'mire', level: 1, name: 'Mother Sallow\'s Hut', boss: 'lieutenant', rooms: 4,
        hook: () => 'The witch they call Mother Sallow is feeding people to the water. She thinks it will spare her.', clear: (v) => `Sallow's last words, through black water: "It was here before us. ${v.villain}. It will be here after."` },
      { title: 'The Drowned Shrine', near: 'shpagin', kind: 'mire', level: 2, poi: 'drowned_shrine',
        hook: () => 'The cult keeps a shrine where the water goes down a grate that never fills. That is the mouth\'s throat.', clear: () => 'The grate sings. Somebody built it to keep something down, not to feed it. The cult has been prying it open.' },
      { title: 'The Greenspire', near: 'samopal', kind: 'cult', level: 4, poi: 'greenspire',
        hook: () => 'The cult takes its orders from the Greenspire on the lake. Its master knows how to close what he opened.', clear: () => 'Zenu\'s letters explain it: the Mire drinks death. End death, and it drinks the living. The only way to stop it is to go down.' },
      { title: 'Where the Water Goes', near: 'shpagin', kind: 'mire', level: 6, poi: 'mire_depths', boss: 'villain',
        hook: (v) => `There is a whirlpool the size of a village in the heart of the Mire. ${v.villain} is at the bottom of it.`, clear: (v) => `${v.villain} stops. The water stops. For the first time in ten thousand years, the Mire begins to fill.` },
    ],
    epilogue: () => ['In Shpagin the stilt-houses float on the new water. Nobody minds. The witches leave you a jar of something on your pillow that you decide never to open.'],
  },
  {
    id: 'velvet_knife', title: 'The Velvet Knife', tagline: 'A murder at court, and a capital full of liars.', start: 'suomi', levels: '2–9',
    blurb: 'A minister of the crown is found dead in a locked library in Suomi, and the queen\'s people want it solved quietly. Every courtier has a secret. One of them has a crypt.',
    villain: { name: 'Lord Chancellor Aurel Vane', title: 'the Velvet Knife', base: 'vampire' }, lieutenant: { name: 'Mistress Ilse Corran', base: 'cult_fanatic' }, target: 'the queen',
    intro: (v) => ['Suomi, white spires and green copper. A palace clerk finds you in a fencing hall and hands you a sealed note: "Minister Haldane is dead. Come quietly. — E."', `The body is in a locked library. Two pinpricks on the neck, and a velvet ribbon in the hand. Everyone at court is helpful. ${v.villain} is especially helpful.`],
    chapters: [
      { title: 'The Thieves\' Market', near: 'suomi', kind: 'bandit_camp', level: 0, name: 'The Undermarket', boss: 'bandit_captain', rooms: 3,
        hook: () => 'Velvet like that is sold in only one place: the Undermarket, the thieves\' bazaar under the old aqueduct.', clear: () => 'The velvet-seller sold a bolt of it to a lady\'s maid in grey, who paid in coins so old they still had the erased queen on them.' },
      { title: 'The Crypt of the Erased', near: 'suomi', kind: 'barrow', level: 1, name: 'The Crypt Under the Chapel Royal', boss: 'wight', rooms: 4,
        hook: () => 'Coins like that come from one place: the old royal crypt, sealed since before the war.', clear: (v) => `Someone has been sleeping in the crypt. A coffin with a velvet lining, and a monogram: A.V. The court calls ${v.villain} "Aurel".` },
      { title: 'The Grey Lady', near: 'borschardt', kind: 'cult', level: 2, name: 'The House of the Grey Lady', boss: 'lieutenant', rooms: 4,
        hook: (v) => `The maid in grey is ${v.villain}'s housekeeper, and she has fled to his townhouse in Borschardt.`, clear: (v) => `Her journal: ${v.villain} was the minister's old friend, before he died during the war and didn't stay dead. The minister found out. Next, ${v.villain} means to take ${v.target}.` },
      { title: 'The Old Vaults', near: 'suomi', kind: 'barrow', level: 4, name: 'The Chancellor\'s Vault', boss: 'villain', rooms: 5,
        descs: ['A stair under the palace, cut before the palace was built. Velvet ribbons tied to the banisters, like a trail.', 'A gallery of portraits. In every one, the Chancellor stands a little closer to the throne.', 'A dining room laid for twelve. The guests have been dead a while.', 'A chapel where the bell has been stuffed with velvet so it cannot ring.', `The Chancellor waits by a cold fireplace, pouring two glasses. "Sit," says Aurel Vane. "Let's not be dramatic."`],
        hook: (v) => `${v.villain} has gone to ground under the palace, and ${v.target} dines with him tomorrow night.`, clear: (v) => `${v.villain} turns to ash in his good coat. The court will say he retired to the country. You'll know better.` },
    ],
    epilogue: (v) => [`${v.target} receives you privately and thanks you in a voice that never hurries. You are given a medal you are not allowed to wear in public.`, 'Suomi goes back to its fencing and its whispers. One of the whispers is about you now.'],
  },
];

// ---------- the generator ----------
interface KindDef { label: string; themes: string[]; bases: string[]; lieut: string[]; titles: string[]; incidents: string[]; clues: string[]; finals: string[]; plans: string[] }
const KINDS: Record<string, KindDef> = {
  undead: { label: 'an undead lord', themes: ['barrow', 'battlefield', 'cult', 'barrow', 'ruin'], bases: ['wight', 'revenant', 'vampire', 'death_knight'], lieut: ['ghast', 'mummy', 'wight'], titles: ['the Grave-King', 'the Unburied', 'Lord of the Last Bell', 'the Hollow Saint', 'the Bone Regent'],
    incidents: ['the graves at {town} have been opened from the inside', 'the dead walked through {town} last night and took three of the living with them', 'every candle in {town} burns green at midnight'], clues: ['a burial shroud embroidered with {villain}\'s sigil', 'a map of graveyards, with {site} circled', 'a prayer to {villain}, written in a child\'s hand'], finals: ['a barrow older than Lahti', 'a cathedral of bones'], plans: ['raise an army from Greymarch Field', 'end death in Lahti, and rule what is left'] },
  bandit: { label: 'a bandit king', themes: ['bandit_camp', 'ruin', 'cave', 'bandit_camp'], bases: ['bandit_captain', 'hired_gun', 'bandit_captain'], lieut: ['thug', 'rifleman', 'hired_gun'], titles: ['the Road-Wolf', 'King of the Crossroads', 'the Tollman', 'the Laughing Knife'],
    incidents: ['three caravans out of {town} have vanished on the same road', 'bandits rode into {town} at noon and took the payroll and the mayor\'s daughter', 'every farm around {town} now pays "road tax" to {villain}'], clues: ['a tally of stolen wagons, all going to {site}', 'a wanted poster with {villain}\'s face, used as a dartboard', 'a brand on a stolen horse: {villain}\'s mark'], finals: ['a hilltop fort', 'a robbers\' hall in the old quarry'], plans: ['seize the crossroads and tax the whole province', 'buy a title with stolen gold'] },
  cult: { label: 'a cult prophet', themes: ['cult', 'ruin', 'mire', 'cult'], bases: ['cult_fanatic', 'mummy', 'zenu'], lieut: ['cult_fanatic', 'gargoyle', 'specter'], titles: ['the Green Prophet', 'Voice of the Candle', 'the Wax Saint', 'the Choirmaster'],
    incidents: ['young people in {town} are burning Bellwax and walking off into the night', 'green candles appeared on every doorstep in {town} overnight', 'the {town} chapel bell was stolen, rope and all'], clues: ['a hymn book with {site} written in the margin', 'a ledger of "offerings", most of them people', 'a candle that burns green and smells of {villain}\'s perfume'], finals: ['a hidden temple', 'a chapel beneath a chapel'], plans: ['ring a bell that should never be rung', 'drown the province in Bellwax dreams'] },
  dragon: { label: 'a dragon', themes: ['cave', 'mine', 'ruin', 'cave'], bases: ['wyrm_young', 'wyrm_young', 'wyrm_adult'], lieut: ['owlbear', 'troll', 'ogre'], titles: ['the Frost-Tongue', 'the Old Hunger', 'Winter\'s Teeth', 'the Ice Crown'],
    incidents: ['whole herds around {town} have been found frozen solid', 'a shadow crossed the moon over {town} and the river iced over in summer', 'the hunters of {town} went into the hills and came back as ice statues'], clues: ['a scale as big as a shield', 'claw marks in stone, leading to {site}', 'a melted path through the forest, still steaming with cold'], finals: ['a cave where the snow never settles', 'a frozen cathedral of ice'], plans: ['bury the province in endless winter', 'gather a hoard worthy of an emperor'] },
  hag: { label: 'a hag', themes: ['mire', 'cave', 'ruin', 'mire'], bases: ['mire_hag', 'mire_hag', 'vampire'], lieut: ['bog_light', 'giant_spider', 'ghoul'], titles: ['Mother Rot', 'the Fen Grandmother', 'the Lantern Witch', 'Old Mother Thorn'],
    incidents: ['babies in {town} have been swapped for bundles of twigs that cry', 'a fog rolled into {town} and everyone it touched forgot their names', 'the wells of {town} run with black water'], clues: ['a doll made of reeds wearing a {town} child\'s ribbon', 'a recipe in a witch\'s hand, ingredients including "one hero"', 'a trail of sweets leading to {site}'], finals: ['a hut on chicken-bone stilts', 'a sunken orchard'], plans: ['trade every child in the province for eternal youth', 'drown the land in fog and forgetting'] },
  warlord: { label: 'a warlord', themes: ['battlefield', 'bandit_camp', 'ruin', 'battlefield'], bases: ['bandit_captain', 'revenant', 'death_knight'], lieut: ['hired_gun', 'rifleman', 'thug'], titles: ['the Iron Marshal', 'the Last General', 'the Drum of Greymarch', 'the Conqueror'],
    incidents: ['soldiers in old uniforms are conscripting the men of {town} at gunpoint', 'a war-drum beats every night outside {town} and nobody can find it', '{villain} has declared {town} a garrison of a country that no longer exists'], clues: ['marching orders signed by {villain}', 'a field map with {site} marked as headquarters', 'a medal from the last war, taken from a dead man who wasn\'t dead last week'], finals: ['a fortress on the old front line', 'a field headquarters in a ruined manor'], plans: ['restart the civil war and finish it his way', 'crown himself over the ashes of Lahti'] },
  beast: { label: 'a monster', themes: ['cave', 'ruin', 'mine', 'cave'], bases: ['owlbear', 'troll', 'wyrm_young'], lieut: ['dire_wolf', 'brown_bear', 'giant_spider'], titles: ['the Beast of the Thornwood', 'Old Gnasher', 'the Thing in the Woods', 'the Night-Mauler'],
    incidents: ['the hunters of {town} keep disappearing in the woods, one a week', 'something big broke down the {town} palisade and dragged off an ox', 'the children of {town} won\'t sleep: they say something watches through the window'], clues: ['tracks the size of a cart wheel, heading for {site}', 'a half-eaten hunter\'s satchel', 'tufts of fur caught on a broken fence, stinking of blood'], finals: ['a lair under a fallen oak', 'a cave of bones'], plans: ['make the whole forest its hunting ground', 'feed until nothing is left'] },
};
const GOALS: Record<CampaignSpec['goal'], { line: string; end: string }> = {
  stop: { line: 'Stop {villain} before they {plan}.', end: 'It\'s over. {villain} will never {plan}.' },
  rescue: { line: '{target} has been taken. Bring them home.', end: 'In the last room you find {target}, alive, furious and very glad to see you.' },
  recover: { line: '{villain} has stolen {target}. Take it back.', end: '{target} lies among {villain}\'s things. It\'s yours to return, or to keep.' },
  avenge: { line: '{villain} destroyed {target}. Make them answer for it.', end: '{target} is avenged. It doesn\'t bring anything back. It helps a little anyway.' },
};
const TONE: Record<CampaignSpec['tone'], { open: string[]; mid: string[]; close: string[] }> = {
  heroic: { open: ['This is the kind of thing songs get written about.', 'Somebody has to. It might as well be you.'], mid: ['The road ahead is clear, and so is your purpose.', 'Word of what you did is already spreading.'], close: ['They will tell this one for years.', 'Bells ring for you in {town}, the good kind.'] },
  grim: { open: ['Nobody else is coming. Nobody else ever comes.', 'You have a bad feeling about this. You\'re right.'], mid: ['It gets worse before it gets better. If it gets better.', 'You count the dead, and stop counting.'], close: ['You won. It doesn\'t feel like it.', 'The graves are dug. You helped fill them.'] },
  comic: { open: ['Honestly, how hard can it be?', 'The pay is terrible. You say yes anyway.'], mid: ['Somehow, against all odds and most common sense, it\'s working.', 'You\'re fairly sure this is not how professionals do it.'], close: ['The town throws you a parade. Someone falls off the float. Perfect.', 'You won! Mostly by accident! Don\'t tell anyone.'] },
};
const SYL1 = ['Var', 'Mor', 'Kass', 'Brann', 'Ys', 'Hal', 'Ost', 'Vel', 'Grim', 'Sar', 'Teo', 'Rud', 'Ilm', 'Dra', 'Zor', 'Mal', 'Kor', 'Lis'];
const SYL2 = ['ek', 'ina', 'ald', 'ova', 'ric', 'ane', 'oth', 'iel', 'usk', 'ara', 'en', 'ix', 'mar', 'oda'];
const LAST = ['Marrow', 'Vane', 'Krag', 'Ashgrove', 'Vaszary', 'Holloway', 'Dunmere', 'Kessel', 'Blackwater', 'Coldridge', 'Harrow', 'Wrenfield'];
const TARGETS: Record<CampaignSpec['goal'], string[]> = {
  stop: ['the province'], rescue: ['the mayor\'s daughter', 'a famous bard', 'the last charmwright', 'your old sergeant', 'a goblin child who sold you apples', 'the town priest'],
  recover: ['the Bell of Saint Oda', 'the Treaty Charter', 'the Silver Book of Galilin', 'a crown that belongs to no one', 'the Charmwright\'s Chisel'], avenge: ['the village of Hollow Ash', 'your old company', 'the Galilin caravan', 'a friend who trusted you'],
};
const NOUN = (k: string) => ({ barrow: 'barrow', battlefield: 'battlefield', cult: 'hideout', ruin: 'ruin', cave: 'cave', mine: 'mine', bandit_camp: 'camp', mire: 'fen' } as Record<string, string>)[k] ?? 'place';

export function randomSpec(r: Rng, level = 1, start?: string): CampaignSpec {
  const kind = pick(r, Object.keys(KINDS));
  const goal = pick(r, ['stop', 'rescue', 'recover', 'avenge'] as const);
  const name = `${pick(r, SYL1)}${pick(r, SYL2)} ${pick(r, LAST)}`;
  return {
    title: '', start: start ?? pick(r, TOWNS).id, villain: kind === 'dragon' || kind === 'beast' ? `${pick(r, SYL1)}${pick(r, SYL2)}` : name, villainTitle: pick(r, KINDS[kind].titles), kind, goal,
    target: pick(r, TARGETS[goal]), chapters: 4 + die(r, 3) - 1, tone: pick(r, ['heroic', 'grim', 'comic'] as const), level, seed: Math.floor(r.state * 7 + 13) >>> 0,
  };
}

function nearTowns(start: string, n: number, r: Rng): string[] {
  const s = townById(start) ?? TOWNS[0];
  const sorted = TOWNS.slice().sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
  const out = [start];
  for (let i = 1; out.length < n; i++) out.push(i < 5 && r.state % 3 === 0 ? start : sorted[Math.min(sorted.length - 1, i)].id);
  return out;
}

export function generate(spec: CampaignSpec): CampaignDef {
  const r: Rng = { state: spec.seed >>> 0 };
  const K = KINDS[spec.kind] ?? KINDS.undead;
  const T = TONE[spec.tone];
  const n = Math.max(3, Math.min(8, spec.chapters));
  const towns = nearTowns(spec.start, n, r);
  const plan = pick(r, K.plans);
  const fill = (t: string, v: Vars, site = '') => t.replace(/\{villain\}/g, v.villain).replace(/\{town\}/g, v.town).replace(/\{target\}/g, v.target).replace(/\{site\}/g, site).replace(/\{plan\}/g, plan);
  const incident = pick(r, K.incidents);
  const chapters: ChapterDef[] = [];
  const lieutName = `${pick(r, SYL1)}${pick(r, SYL2)} the ${pick(r, ['Knife', 'Hound', 'Black', 'Pale', 'Red', 'Quiet', 'Hollow'])}`;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1, lieut = i === n - 2 && n >= 4;
    const kind = last ? K.themes[0] : pick(r, K.themes);
    const town = towns[i];
    const clue = pick(r, K.clues);
    chapters.push({
      title: last ? `${spec.villain}'s Lair` : lieut ? `${lieutName}` : i === 0 ? 'The First Sign' : pick(r, ['The Trail', 'Deeper In', 'Old Debts', 'Into the Dark', 'The Witness', 'A Name in Blood', 'Crossroads']),
      near: town, kind, level: Math.round((i * 4) / Math.max(1, n - 1)),
      name: last ? `${spec.villain.split(' ')[0]}'s ${cap(NOUN(kind))}` : undefined,
      boss: last ? 'villain' : lieut ? 'lieutenant' : undefined, rooms: last ? 5 : 3 + (i % 2),
      descs: last ? [`${cap(pick(r, K.finals))}, and the end of the road.`] : undefined,
      hook: (v) => (i === 0 ? fill(`In ${townById(town)?.name ?? v.town}, ${incident}. ${GOALS[spec.goal].line} ${pick(r, T.open)}`, v) : last ? fill(`Everything points one way now: ${v.villain}, ${v.title}, waiting in ${pick(r, K.finals)}.`, v) : lieut ? fill(`${lieutName}, ${v.villain}'s right hand, stands between you and the end of this. ${pick(r, T.mid)}`, v) : fill(`The trail leads near ${townById(town)?.name ?? 'the next town'}. ${pick(r, T.mid)}`, v)),
      clear: (v) => (last ? fill(`${GOALS[spec.goal].end} ${pick(r, T.close)}`, v) : fill(`Among what's left you find ${clue}.`, v, 'the next place on your map')),
    });
  }
  const kindBase = K.bases;
  return {
    id: `gen_${spec.seed}`, title: spec.title.trim() || `${spec.villain}, ${spec.villainTitle}`, tagline: `${cap(K.label)} threatens ${townById(spec.start)?.name ?? 'Lahti'}.`, blurb: '', start: spec.start, levels: `${spec.level}+`,
    villain: { name: spec.villain, title: spec.villainTitle, base: kindBase[Math.min(kindBase.length - 1, Math.floor((spec.level + 4) / 6))] },
    lieutenant: { name: lieutName, base: pick(r, K.lieut) }, target: spec.target,
    intro: (v) => [fill(`${townById(spec.start)?.name ?? 'The town'} has a problem, and its name is ${v.villain}, ${v.title}.`, v), fill(GOALS[spec.goal].line, v)],
    chapters,
    epilogue: (v) => [fill(pick(r, T.close), v), 'Lahti is still out there, and so are you. There will be other stories.'],
  };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- villains ----------
function scaled(base: MonsterDef, id: string, name: string, target: number): MonsterDef {
  const cr = Math.max(0.5, base.cr ?? 1);
  const f = Math.max(0.3, Math.min(8, target / cr));
  const step = Math.round(Math.log2(f) * 2);
  const hp = base.hp.replace(/^(\d+)d(\d+)/, (_, n, d) => `${Math.max(2, Math.round(Number(n) * Math.sqrt(f) * (f >= 1 ? 1.3 : 1)))}d${d}`).replace(/\+(\d+)$/, (_, b) => `+${Math.round(Number(b) * Math.min(1.5, f))}`);
  return {
    ...base, id, name, hp, ac: Math.max(10, base.ac + Math.max(-4, Math.min(4, Math.round(step / 2)))), xp: Math.round(base.xp * f * 1.5), cr: target,
    multiattack: Math.max(1, Math.min(4, (base.multiattack ?? 1) + (f >= 3 ? 1 : f < 0.5 ? -1 : 0))),
    attacks: base.attacks.map((a) => ({ ...a, toHit: Math.max(2, a.toHit + Math.max(-4, step)), damage: a.damage.replace(/^(\d+)d/, (_, n2) => `${Math.max(1, Math.round(Number(n2) * Math.sqrt(f)))}d`) })),
    aliases: [...(base.aliases ?? []), ...name.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3)], desc: base.desc, surrenderAt: undefined,
  };
}
function registerBoss(c: Ctx, which: 'villain' | 'lieutenant', def: CampaignDef, level: number): string {
  const who = which === 'villain' ? def.villain : def.lieutenant ?? { name: 'The Lieutenant', base: 'thug' };
  const id = `${which}_${def.id}`;
  const base = MONSTERS[who.base] ?? MONSTERS.bandit_captain;
  const target = which === 'villain' ? Math.max(2, level * 0.9) : Math.max(1, level * 0.6);
  MONSTERS[id] = scaled(base, id, who.name, target);
  c.set(`boss_level_${id}`, level);
  return id;
}

// ---------- running a campaign ----------
export function campaignDef(st: CampaignState | undefined): CampaignDef | null {
  if (!st) return null;
  if (st.spec) return generate(st.spec);
  return CAMPAIGNS.find((x) => x.id === st.id) ?? null;
}
const varsOf = (c: Ctx, def: CampaignDef): Vars => ({ villain: def.villain.name, title: def.villain.title, town: townById(def.start)?.name ?? 'Lahti', target: def.target ?? 'the province', hero: c.pc.name });
let BASE_LEVEL = 1;

/** Start a campaign: intro, setup, and the first chapter. */
export function startCampaign(c: Ctx, id: string, spec?: CampaignSpec) {
  const def = spec ? generate(spec) : CAMPAIGNS.find((x) => x.id === id);
  if (!def) return;
  const day = Math.floor((c.s.minutes + 480) / 1440);
  c.s.world.campaign = { id: def.id, title: def.title, chapter: -1, sites: [], spec, started: day };
  c.set('campaign_base', Math.max(1, c.pc.level));
  def.setup?.(c);
  c.out('title', def.title);
  for (const t of def.intro(varsOf(c, def))) c.narr(t);
  beginChapter(c, 0);
}

function beginChapter(c: Ctx, i: number) {
  const st = c.s.world.campaign!;
  const def = campaignDef(st)!;
  const ch = def.chapters[i];
  st.chapter = i;
  const v = varsOf(c, def);
  const base = (c.flag('campaign_base') as number) || 1;
  const level = Math.max(1, Math.min(20, Math.max(c.pc.level, base + ch.level)));
  let site: SiteState;
  if (ch.poi) {
    hubOf(c.s, ch.poi);
    site = c.s.world.sites[ch.poi];
    if (ch.boss === 'villain' || ch.boss === 'lieutenant') {
      // the campaign's villain takes the last room of the named place
      site.boss = registerBoss(c, ch.boss, def, Math.max(level, site.level));
      rebuildSite(site);
    }
  } else {
    const boss = ch.boss === 'villain' || ch.boss === 'lieutenant' ? registerBoss(c, ch.boss, def, level) : ch.boss;
    site = newSite(c, ch.near, { kind: ch.kind, level, name: ch.name, boss, rooms: ch.rooms, descs: ch.descs, dist: 0.02 });
  }
  site.campaign = i;
  st.sites[i] = site.id;
  c.out('title', `Chapter ${i + 1}: ${ch.title}`);
  c.narr(ch.hook(v));
  discover(c, site.id, def.title);
  c.journal(`${def.title}, chapter ${i + 1}: ${ch.title}. ${ch.hook(v)} (${locName(c.s, site.id)}, near ${locName(c.s, ch.near)}.)`);
  c.sys(`("travel to ${locName(c.s, site.id)}", or tap it on the World map. "campaign" shows where you are in the story.)`);
  if (site.cleared) { c.narr('You\'ve been there already, as it happens. You know what you found.'); completeChapter(c, site); }
}

function onSiteCleared(c: Ctx, site: SiteState) {
  const st = c.s.world.campaign;
  if (!st || st.done || st.sites[st.chapter] !== site.id) return;
  completeChapter(c, site);
}
function completeChapter(c: Ctx, site: SiteState) {
  const st = c.s.world.campaign!;
  const def = campaignDef(st);
  if (!def) return;
  const ch = def.chapters[st.chapter];
  const v = varsOf(c, def);
  c.out('title', `${def.title}: ${ch.title} complete`);
  c.narr(ch.clear(v));
  const reward = Math.round((site.level * site.level * 150 + 1000) / 10) * 10;
  c.money(reward);
  c.good(`${fmtMoney(reward)} in reward and spoils.`);
  c.xp(site.level * 100);
  c.s.world.renown += 3;
  if (st.chapter + 1 < def.chapters.length) { beginChapter(c, st.chapter + 1); return; }
  st.done = true;
  c.out('title', `${def.title}: the end`);
  for (const t of def.epilogue(v)) c.narr(t);
  c.journal(`${def.title} is finished. ${def.epilogue(v)[0]}`);
  c.sys('Your story goes on. Say "seek a new adventure" for another campaign, or just live in Lahti: buy a tavern, explore, take jobs, start trouble.');
}
bindCampaignHook(onSiteCleared);

export function campaignStatus(c: Ctx) {
  const st = c.s.world.campaign;
  const def = campaignDef(st);
  if (!st || !def) { c.sys(c.flag('act1_finale') || c.s.world.campaign?.id === 'bells' || !c.s.world.campaign ? 'You\'re on the Bells of Lahti. Your journal has the story so far.' : 'You\'re on the open road. Say "seek a new adventure" when you want a story.'); return; }
  c.out('title', def.title);
  def.chapters.forEach((ch, i) => c.narr(`${i < st.chapter || st.done ? '✓' : i === st.chapter ? '➤' : '·'} Chapter ${i + 1}: ${i <= st.chapter || st.done ? ch.title : '???'}${i === st.chapter && !st.done && st.sites[i] ? ` — ${locName(c.s, st.sites[i])}` : ''}`));
  if (st.done) c.sys('Finished. Say "seek a new adventure" for another.');
}

/** A brand-new campaign in the same world, sized to the hero. */
export function newAdventure(c: Ctx) {
  const st = c.s.world.campaign;
  if (st && !st.done && st.id !== 'bells' && st.id !== 'open_road') { c.sys(`You're still in the middle of ${st.title}. ("campaign" to see where; "abandon the campaign" to drop it.)`); return; }
  const spec = randomSpec(c.rng, c.pc.level, c.s.world.at && townById(c.s.world.at) ? c.s.world.at : undefined);
  spec.seed = (c.s.world.seed ^ (c.s.world.nextId * 2654435761)) >>> 0;
  startCampaign(c, 'random', spec);
}

/** After loading a save: rebuild campaign bosses. */
export function migrateCampaign(c: Ctx) {
  const st = c.s.world.campaign;
  const def = campaignDef(st);
  if (!st || !def) return;
  for (const which of ['villain', 'lieutenant'] as const) {
    const id = `${which}_${def.id}`;
    const lvl = c.flag(`boss_level_${id}`) as number;
    if (lvl && !MONSTERS[id]) registerBoss(c, which, def, lvl);
  }
}
