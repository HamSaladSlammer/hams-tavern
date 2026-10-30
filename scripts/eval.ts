// npm run eval [-- --baseline]   Scores the game master against tests/eval/cases.ts.
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { handle, newState, beginGame } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import { randomSpec } from '../src/world/campaigns';
import { CASES, type EvalCase } from '../tests/eval/cases';
import type { GameState, LogLine } from '../src/engine/types';

const GENERIC = /Is that right\.|Huh\. Go on|Can't say I'd thought|Takes all sorts|You don't say|And what do you want me to do|Couldn't tell you|Not my business|Couldn'?t say|I could not say|Never heard of it|Nobody answers|The words hang|I'm not sure what you mean|The game master squints|There's nobody called|You look around for|There isn't one|outside my knowledge|Information costs|I don't want to know|Please don't ask|Not much, if I'm honest|I try not to think about|It's complicated|Who's asking|You've got me there|Now there's a question|I wouldn't know|That is outside|Ask at an inn|Couldn't tell you where/i;

function setup(c: EvalCase): GameState {
  const s = newState(4242 + c.id.length * 7);
  if (c.where === 'bells') beginGame(s, defaultSpec('fighter', 'human', 'soldier', 'Vera'));
  else { beginGame(s, defaultSpec('fighter', 'human', 'soldier', 'Vera'), { id: 'open_road', spec: { ...randomSpec({ state: 7 }, 1), start: c.where } }); handle(s, 'go inn'); }
  if (c.talk) handle(s, `talk to ${c.talk}`);
  for (const p of c.pre ?? []) handle(s, p);
  return s;
}

export interface Score { id: string; cat: string; input: string; out: string; error: boolean; echo: boolean; generic: boolean; relevant: boolean | null; words: number }
export function score(c: EvalCase): Score {
  const s = setup(c);
  let lines: LogLine[] = [];
  try { lines = handle(s, c.input).filter((l) => l.k !== 'you'); } catch (e) { return { id: c.id, cat: c.cat, input: c.input, out: String(e), error: true, echo: false, generic: false, relevant: false, words: 0 }; }
  const text = lines.map((l) => (l.who ? `${l.who}: ` : '') + l.t).join(' | ');
  const stripped = c.input.toLowerCase().replace(/^i\s+/, '').replace(/[?.!]/g, '');
  const head = stripped.split(/\s+/).slice(0, 2).join(' ');
  const echo = lines.some((l) => (l.k === 'narr' || l.k === 'sys') && l.t.toLowerCase().startsWith(`you ${head}`) && l.t.length <= c.input.length + 40 && lines.filter((x) => x.k === 'narr' || x.k === 'say').length <= 1);
  const body = lines.filter((l) => l.k !== 'roll').map((l) => l.t).join(' ');
  const generic = GENERIC.test(body) && body.split(/\s+/).length < 30;
  const inp = c.input.toLowerCase();
  const relevant = c.expect ? c.expect.some((w) => !inp.includes(w.toLowerCase()) && body.toLowerCase().includes(w.toLowerCase())) : null;
  return { id: c.id, cat: c.cat, input: c.input, out: text.slice(0, 400), error: /a bug|undefined|NaN|\[object/.test(text), echo, generic, relevant, words: body.split(/\s+/).filter(Boolean).length };
}

export function runEval() {
  const scores = CASES.map(score);
  const by = (f: (s: Score) => boolean, list = scores) => (list.length ? Math.round((100 * list.filter(f).length) / list.length) : 0);
  const cats = Array.from(new Set(scores.map((s) => s.cat)));
  const rel = scores.filter((s) => s.relevant !== null);
  const summary = {
    cases: scores.length,
    errors: scores.filter((s) => s.error).length,
    echoPct: by((s) => s.echo),
    genericPct: by((s) => s.generic),
    relevantPct: rel.length ? by((s) => !!s.relevant, rel) : null,
    avgWords: Math.round(scores.reduce((n, s) => n + s.words, 0) / scores.length),
    byCat: Object.fromEntries(cats.map((k) => { const l = scores.filter((s) => s.cat === k); const r = l.filter((s) => s.relevant !== null); return [k, { n: l.length, echo: by((s) => s.echo, l), generic: by((s) => s.generic, l), relevant: r.length ? by((s) => !!s.relevant, r) : null, words: Math.round(l.reduce((n, s) => n + s.words, 0) / l.length) }]; })),
  };
  return { summary, scores };
}

if (process.argv[1]?.endsWith('eval.ts')) {
  const { summary, scores } = runEval();
  const base = existsSync('tests/eval/baseline.json') ? JSON.parse(readFileSync('tests/eval/baseline.json', 'utf8')) : null;
  const d = (k: string, v: number | null, better: 'up' | 'down') => (base && v !== null && base.summary[k] !== null ? ` (baseline ${base.summary[k]}${better === 'up' ? (v > base.summary[k] ? ' ▲' : v < base.summary[k] ? ' ▼' : '') : v < base.summary[k] ? ' ▲' : v > base.summary[k] ? ' ▼' : ''})` : '');
  console.log(`Cases ${summary.cases} · errors ${summary.errors}`);
  console.log(`Echo ${summary.echoPct}%${d('echoPct', summary.echoPct, 'down')} · Generic ${summary.genericPct}%${d('genericPct', summary.genericPct, 'down')} · Relevant ${summary.relevantPct}%${d('relevantPct', summary.relevantPct, 'up')} · Avg words ${summary.avgWords}${d('avgWords', summary.avgWords, 'up')}`);
  for (const [k, v] of Object.entries(summary.byCat)) console.log(`  ${k.padEnd(10)} n=${String(v.n).padStart(3)} echo ${String(v.echo).padStart(3)}% generic ${String(v.generic).padStart(3)}% relevant ${v.relevant === null ? '  -' : String(v.relevant).padStart(3) + '%'} words ${v.words}`);
  if (process.argv.includes('--show')) for (const s of scores.filter((x) => x.generic || x.echo || x.relevant === false).slice(0, 60)) console.log(`\n[${s.id}] ${s.input}\n  → ${s.out}`);
  writeFileSync('tests/eval/last.json', JSON.stringify({ summary, scores }, null, 1));
  if (process.argv.includes('--baseline')) writeFileSync('tests/eval/baseline.json', JSON.stringify({ summary }, null, 1));
}
