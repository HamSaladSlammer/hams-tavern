// Mythic-style yes/no oracle with a chaos factor. Used for player "?" questions and for
// the engine's own uncertainty ("does anyone hear the shot?").
import { die, pick, type Rng } from './dice';

export type Odds = 'impossible' | 'very unlikely' | 'unlikely' | '50/50' | 'likely' | 'very likely' | 'certain';
const ODDS_BASE: Record<Odds, number> = { impossible: 5, 'very unlikely': 15, unlikely: 30, '50/50': 50, likely: 70, 'very likely': 85, certain: 95 };

export interface OracleAnswer {
  answer: 'Exceptional yes' | 'Yes' | 'No' | 'Exceptional no';
  roll: number;
  chance: number;
  event?: string;
}

export function askOracle(rng: Rng, odds: Odds, chaos: number): OracleAnswer {
  const chance = Math.max(1, Math.min(99, ODDS_BASE[odds] + (chaos - 5) * 5));
  const r = die(rng, 100);
  let answer: OracleAnswer['answer'];
  if (r <= Math.ceil(chance / 5)) answer = 'Exceptional yes';
  else if (r <= chance) answer = 'Yes';
  else if (r > 100 - Math.ceil((100 - chance) / 5)) answer = 'Exceptional no';
  else answer = 'No';
  // Random event on doubles at or under chaos x 11
  const tens = Math.floor(r / 10) % 10;
  const ones = r % 10;
  const out: OracleAnswer = { answer, roll: r, chance };
  if (tens === ones && r <= chaos * 11) out.event = randomEvent(rng);
  return out;
}

const FOCUS = ['A remote event', 'An NPC acts', 'A new NPC appears', 'A thread moves forward', 'A thread is set back', 'The party is helped', 'The party is hindered', 'Something ambiguous happens', 'The dead stir', 'A bell is heard'];
const ACTION = ['betray', 'guide', 'warn', 'remember', 'forget', 'bury', 'dig up', 'ring', 'silence', 'grieve', 'bargain', 'flee', 'watch', 'hide', 'reveal', 'burn', 'mend', 'steal'];
const SUBJECT = ['a candle', 'a letter', 'the dead', 'an old soldier', 'the bell', 'a child', 'a debt', 'the road', 'a song', 'a grave', 'the Queen', 'a stranger', 'a promise', 'the treaty', 'a coin', 'the river'];

export function randomEvent(rng: Rng): string {
  return `${pick(rng, FOCUS)}: ${pick(rng, ACTION)} ${pick(rng, SUBJECT)}.`;
}

/** Guess odds from how the question is phrased. */
export function guessOdds(q: string): Odds {
  const t = q.toLowerCase();
  if (/\b(definitely|surely|obviously|of course)\b/.test(t)) return 'very likely';
  if (/\b(any chance|possibly|might|maybe|could)\b/.test(t)) return 'unlikely';
  return '50/50';
}
