// Who knows what: a knowledge profile for every kind of person you can talk to.
import type { Knower, Trade } from './types';

/** Hand-made profiles for the named people. */
const NAMED: Record<string, Omit<Knower, 'id'> & { entity?: string; avoids?: string[]; deflect?: string }> = {
  squib: { home: 'breda', trades: ['innkeeper', 'veteran', 'healer'], factions: ['veterans'], worldly: 2, entity: 'squib', avoids: ['war', 'greymarch', 'scorched_barrel', 'coltale_memorial'], deflect: 'Squib\'s cloth stops on the mug. He looks at it for a while. "Not tonight." He goes back to polishing.' },
  dwarves: { home: 'breda', trades: ['miner', 'courier'], factions: [], worldly: 3, entity: 'dwarves' },
  whisperers: { home: 'breda', trades: ['priest', 'hunter'], factions: [], worldly: 1, entity: 'window_table' },
  sereza: { home: 'suomi', trades: ['scholar', 'noble'], factions: ['crown'], worldly: 3, entity: 'sereza' },
  garrick: { home: 'breda', trades: ['merchant'], factions: [], worldly: 1, entity: 'garrick' },
  smith: { home: 'breda', trades: ['smith'], factions: [], worldly: 1, entity: 'smith' },
  hetch: { home: 'breda', trades: ['tailor', 'merchant', 'hunter'], factions: [], worldly: 2, entity: 'hetch' },
  doss: { home: 'breda', trades: ['farmer', 'veteran'], factions: ['militia', 'veterans'], worldly: 1, entity: 'doss' },
  merah: { home: 'breda', trades: ['priest'], factions: ['cult'], worldly: 1, entity: 'merah' },
  alistair: { home: 'suomi', trades: ['scholar', 'noble', 'entertainer'], factions: ['loremasters'], worldly: 3, entity: 'alistair' },
  brumandell_keeper: { home: 'brumandell', trades: ['innkeeper', 'merchant'], factions: [], worldly: 2, entity: 'grog' },
  coltale_keeper: { home: 'coltale', trades: ['innkeeper', 'veteran'], factions: ['veterans'], worldly: 2 },
  largo_keeper: { home: 'largo', trades: ['innkeeper', 'sailor', 'thief'], factions: [], worldly: 2 },
  suomi_keeper: { home: 'suomi', trades: ['innkeeper', 'noble'], factions: [], worldly: 2 },
};

const ROLE_TRADES: Record<string, Trade[]> = {
  barmaid: ['innkeeper'], 'pot-boy': ['innkeeper', 'child'], guard: ['watch', 'soldier'], soldier: ['soldier', 'veteran'], dockhand: ['sailor'], sailor: ['sailor'],
  gambler: ['thief'], courier: ['courier'], farmer: ['farmer'], 'old man': ['veteran', 'farmer'], 'old woman': ['farmer', 'healer'], merchant: ['merchant'],
  drunk: ['drunk'], patron: [], priest: ['priest'], pilgrim: ['priest'], minstrel: ['entertainer'], trader: ['merchant'], child: ['child'], traveller: ['courier'], stranger: ['thief'],
};

export type KnowerProfile = Knower & { entity?: string; avoids?: string[]; deflect?: string };

/** The knowledge profile for any NPC id, or null for animals and things that don't talk shop. */
export function knowerFor(id: string, townOf: (roomId: string) => string | null): KnowerProfile | null {
  if (id === 'kettle') return null;
  const n = NAMED[id];
  if (n) return { id, ...n };
  let m = id.match(/^([a-z_]+)_(keeper|merchant|watch)$/);
  if (m) {
    const [, town, kind] = m;
    return kind === 'keeper' ? { id, home: town, trades: ['innkeeper'], factions: [], worldly: 2 }
      : kind === 'merchant' ? { id, home: town, trades: ['merchant'], factions: [], worldly: 2 }
        : { id, home: town, trades: ['watch', 'soldier'], factions: ['militia'], worldly: 1 };
  }
  m = id.match(/^x:(.+):([a-z_-]+):\d+$/);
  if (m) {
    const role = m[2].replace(/_/g, ' ');
    const trades = ROLE_TRADES[role] ?? [];
    return { id, home: townOf(m[1]) ?? 'breda', trades, factions: trades.includes('veteran') ? ['veterans'] : [], worldly: role === 'courier' || role === 'traveller' || role === 'sailor' ? 3 : role === 'pot-boy' ? 0 : 1 };
  }
  if (id.startsWith('hire_')) return { id, home: 'breda', trades: ['soldier', 'veteran'], factions: ['veterans'], worldly: 2 };
  // anyone else we haven't profiled: a local with common knowledge
  return { id, home: 'breda', trades: [], factions: [], worldly: 1 };
}
