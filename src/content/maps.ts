// Battle and exploration maps, one per room. Each square is 5 feet.
//
//   #  wall          =  window (wall you can see through)   0-9  exit (index into the room's exits)
//   .  floor         ,  ground      "  grass      ~  shallow water (costs double)
//   @  your start    x  foe spawn   k  companion spawn
//   T  table   B  bar / counter   s  stool / chair   b  barrel / crate   H  hearth / fire
//   P  pew     A  altar / font    c  candle stand    S  sarcophagus      g  gravestone
//   t  tree    r  boulder         w  well            C  cart             K  shelves
//   N  anvil   F  forge           L  bell rope       ^  stairs           :  bones, rubble or scrap
//   lowercase letters in `npcs` mark where people stand.

export interface MapDef {
  rows: string[];
  npcs?: Record<string, string>; // letter -> npc id
  props?: Record<string, string>; // tile -> prop id (ROOM_PROPS); overrides the defaults
  dark?: boolean; // only lit squares are visible
  floor?: string; // what npc letters and spawns stand on
}

export const MAPS: Record<string, MapDef> = {
  tavern: {
    rows: [
      '##=####=####=####',
      '#H..............#',
      '#H..sTTs..sTTs..#',
      '#.....d....i..e.#',
      '#..sTTs..sTTs...#',
      '#.............x.#',
      '#.x.....@.k.....#',
      '#BBBBBB.........#',
      '#.q...B.........#',
      '#bb.............#',
      '###########0#####',
    ],
    npcs: { q: 'squib', d: 'dwarves', i: 'whisperers', e: 'sereza' },
    props: { b: 'bottles', s: 'stool', T: 'table', B: 'bar', H: 'hearth_fire', '=': 'window' },
  },
  breda_square: {
    rows: [
      '########4#########',
      '#,,,,,,,,,,,,,,,,#',
      '#,####,,,,,,####,#',
      '#,##1#,,,,,,#2##,#',
      '#,,,,,,,,,,,,,,,,#',
      '5,,,,,,,ww,,,,,,,6',
      '#,,C,,x,ww,,,,x,,#',
      '#,,C,,,,,,,,,,,,,#',
      '#,####,,,,,,####,#',
      '#,##3#,,@,k,#0##,#',
      '#,,,,,,,,,,,,,,,,#',
      '########7#########',
    ],
    props: { w: 'well_water', C: 'cart', '#': 'palisade' },
  },
  goods: {
    rows: [
      '############',
      '#KKKKKKKK.b#',
      '#.........b#',
      '#.BBBBB....#',
      '#.B.m.B..x.#',
      '#..........#',
      '#bb..@.k...#',
      '#####0######',
    ],
    npcs: { m: 'garrick' },
    props: { K: 'shelves', b: 'barrels', B: 'counter' },
  },
  smithy: {
    rows: [
      '############',
      '#FFF....:::#',
      '#FFF.......#',
      '#...N.m....#',
      '#...N....x.#',
      '#b.........#',
      '#b...@.k...#',
      '#####0######',
    ],
    npcs: { m: 'smith' },
    props: { F: 'forge_fire', N: 'anvil', b: 'quench', ':': 'scrap' },
  },
  tailor: {
    rows: [
      '##########',
      '#KKK..KKK#',
      '#........#',
      '#..BiB.c.#',
      '#.....x..#',
      '#...@.k..#',
      '####0#####',
    ],
    npcs: { i: 'hetch' },
    props: { K: 'bolts', c: 'mannequin', B: 'pins' },
  },
  thornwood: {
    rows: [
      'tttttttt,1,ttttttt',
      'ttt""tt,,,,"tttttt',
      't"x"r"",,,,""t"x"t',
      'tt"""",,,,,,"""ttt',
      '~~~~~~~,,~~~~~~~~~',
      't"""r""",,""""r""t',
      'tt""""",,,,"""r"tt',
      't"x""""",,""""""xt',
      'ttt"""",,@,"""tttt',
      'tttt"""",k,"""tttt',
      'ttttttt,,0,,tttttt',
    ],
    props: { t: 'trees', r: 'rocks', '~': 'stream', ':': 'mushrooms' },
  },
  kessels_rest: {
    rows: [
      'tt1tttttttttttt',
      't,,,"""ttt""""t',
      't,,""":::"""""2',
      't,"""AAA""""",,',
      't,""AAAAA""x,,t',
      't,""AAAAA"""",t',
      't,,"""H""""",,t',
      'tt,,""""""",,tt',
      'ttt,,,@,k,,tttt',
      'ttttttt0ttttttt',
    ],
    props: { A: 'dome', H: 'campfire', ':': 'stones', t: 'trees' },
  },
  foothills: {
    rows: [
      'rrrrr""""""rrrrr',
      'r"""""";;;"""""r',
      'r""r""";;;;""r"r',
      'r""""d""""""""""',
      '""""""""""r"""""',
      '"""r""""x"""""""',
      '""""""""""""""r"',
      'r"""""@"k"""""""',
      'rr""""""""""""rr',
      'rrrrrrr0rrrrrrrr',
    ],
    npcs: { d: 'doss' },
    props: { r: 'rocks', ';': 'sheep', '"': 'grass' },
  },
  chapel_yard: {
    rows: [
      '######0#########',
      '#,,g,,,,,g,,g,,#',
      '#,g,,g,,,,,g,,g#',
      '#,,,,x,,,,x,,,,#',
      '#g,,g,,,,,,,g,,#',
      '#,,,,,,:,,,,,,g#',
      '#,g,,,,,,,,g,,,#',
      '#,,,g,,,,,,,,g,#',
      '#,,,,,,@,k,,,,,#',
      '#######1########',
    ],
    props: { g: 'graves', ':': 'bones', '#': 'wall' },
  },
  nave: {
    rows: [
      '######^#######',
      '#c...A.A....c#',
      '#............#',
      '1.PPPP..PPPP.2',
      '#.....x......#',
      '#.PPPP..PPPP.#',
      '#.......x....#',
      '#.PPPP..PPPP.#',
      '#............#',
      '#c....@.k...c#',
      '######0#######',
    ],
    props: { P: 'pews', c: 'candles', A: 'altar', '=': 'window' },
    // the crypt stairs (exit 3) open up behind the altar: drawn at the ^ when revealed
  },
  vestry: {
    rows: [
      '########',
      '#KK..b.#',
      '#......#',
      '#.B..x.#',
      '#..@k..#',
      '###0####',
    ],
    props: { K: 'wardrobe', B: 'desk', b: 'chest' },
    dark: true,
  },
  tower: {
    rows: [
      '########',
      '#..L...#',
      '#.m..x.#',
      '#......#',
      '#^^....#',
      '#^^.@k.#',
      '###0####',
    ],
    npcs: { m: 'merah' },
    props: { L: 'rope', '^': 'stairs' },
  },
  crypt: {
    rows: [
      '######0#######',
      '#c....@.k...c#',
      '#.SS......SS.#',
      '#....x.......#',
      '#.SS..::..SS.#',
      '#.....l......#',
      '#.SS....x.SS.#',
      '#c..........c#',
      '##############',
    ],
    npcs: { l: 'alistair' },
    props: { S: 'sarcophagi', ':': 'bones', c: 'torches' },
    dark: true,
  },
  east_farms: {
    rows: [
      '""""""""""""""""""',
      '"####""""""""####"',
      '"#..#"",,,,""#..#"',
      '"#..#,,,,m,,,1..#"',
      '"####""""""""####"',
      '0,,,,,,,,,,,,,,,,"',
      '"""@k"""""""""""""',
      '":::::::::::::::""',
      '""""""""""""""""""',
    ],
    npcs: { m: 'merla' },
  },
  thatch_barn: {
    rows: [
      '##########',
      '#bb....bb#',
      '#........#',
      '#...ra...#',
      '#........#',
      '#b..@k..b#',
      '####0#####',
    ],
    npcs: { a: 'aldwin' },
    dark: true,
  },
  south_road: {
    rows: [
      'ttttttt,0,ttttttt',
      't"""""",,,"""""xt',
      't"x"""",,"""""""t',
      '"""r"",,,,"""r"""',
      't"""",,@k,""""""t',
      't"""x",,,,""""x"t',
      '~~~~~~~~1~~~~~~~~',
    ],
  },
};

/** Exits hidden behind special tiles: nave exit 3 (crypt stairs) appears at the ^ behind the altar. */
export const HIDDEN_EXIT_TILES: Record<string, Record<number, string>> = { nave: { 3: '^' } };
