import * as U from '../src/understand';
import { handle, newState, beginGame } from '../src/engine/game';
import { defaultSpec } from '../src/engine/character';
import type { GameState } from '../src/engine/types';

const run = (s: GameState, cmd: string) => handle(s, cmd).filter((l) => l.k !== 'you');
const text = (l: { t: string }[]) => l.map((x) => x.t).join(' ');
function hero(seed = 3) { const s = newState(seed); beginGame(s, defaultSpec('fighter', 'human', 'soldier', 'Vera')); run(s, 'talk to squib'); return s; }

describe('reading how people type', () => {
  it('expands shorthand', () => {
    expect(U.normalise('whats ur name')).toBe("what's your name");
    expect(U.normalise('wat do u think abt the cult')).toBe('what do you think about the cult');
    expect(U.normalise('im looking 4 work')).toMatch(/^i'm looking/);
  });
  it('fixes misspelt names but leaves ordinary words alone', () => {
    expect(U.fixTypos('tell me about greymarsh')).toBe('tell me about greymarch');
    expect(U.fixTypos('who is thimbelton')).toBe('who is thimbleton');
    expect(U.fixTypos('ask squibb')).toBe('ask squib');
    expect(U.fixTypos('what about coltail')).toBe('what about coltale');
    expect(U.fixTypos('the bread was good and the beer was cold')).toBe('the bread was good and the beer was cold');
  });
  it('splits several sentences', () => {
    expect(U.clauses("Hi Squib. I'm Vera. What do you know about the bell?")).toEqual(['Hi Squib.', "I'm Vera.", 'What do you know about the bell?']);
  });
  it('knows a name from a word', () => {
    expect(U.looksLikeName('vera')).toBe(true);
    expect(U.looksLikeName('tired')).toBe(false);
    expect(U.looksLikeName('looking')).toBe(false);
  });
});

describe('following the conversation', () => {
  const talk = (...ids: string[]) => { const t = U.newTalk(); for (const id of ids.reverse()) U.noteFocus(t, id, 'them'); return t; };
  it('fills in pronouns from what is being talked about', () => {
    expect(U.resolve('what do you think of her?', talk('elisiah')).text).toBe('what do you think of Queen Elisiah?');
    expect(U.resolve('where does he live?', talk('thimbleton')).text).toMatch(/Lord Thimbleton/);
    expect(U.resolve('how do I get there?', talk('treaty_stone')).text).toMatch(/get to the Treaty Stone/i);
  });
  it('picks the right person for he and she', () => {
    expect(U.resolve('where is she?', talk('thimbleton', 'elisiah')).about).toBe('elisiah');
    expect(U.resolve('where is he?', talk('elisiah', 'thimbleton')).about).toBe('thimbleton');
  });
  it('leaves "it" alone when it points at nothing', () => {
    expect(U.resolve('is it safe on the roads?', talk('coltale')).kind).toBe('as-is');
    expect(U.resolve('they say the dead walk', talk('cult')).kind).toBe('as-is');
  });
  it('turns "and X?" into a question', () => {
    expect(U.resolve('and Largo?', talk()).text).toBe('tell me about Largo');
    expect(U.resolve('what about the dwarves?', talk()).text).toBe('tell me about the dwarves');
  });
  it('recognises pushing back and memory questions', () => {
    expect(U.probe('how do you know?')).toBe('how-know');
    expect(U.probe('really?')).toBe('really');
    expect(U.probe('since when?')).toBe('when');
    expect(U.memoryQuestion("what's my name?")).toBe('name');
    expect(U.memoryQuestion('do you remember me?')).toBe('remember');
  });
});

describe('in play', () => {
  it('answers each sentence of a long message', () => {
    const s = hero();
    const out = text(run(s, "Hi Squib. I'm Vera. Who runs this town?"));
    expect(out).toMatch(/Vera/);
    expect(out).toMatch(/Nobody, officially/);
  });
  it('follows up with pronouns', () => {
    const s = hero();
    run(s, 'who is Lord Thimbleton?');
    expect(text(run(s, 'where does he live?'))).toMatch(/Brumandell/);
  });
  it('remembers your name when asked', () => {
    const s = hero();
    run(s, 'my name is Vera');
    expect(text(run(s, "what's my name?"))).toMatch(/Vera/);
  });
  it('explains where it heard things', () => {
    const s = hero();
    run(s, 'tell me about Bellwax');
    expect(text(run(s, 'how do you know?'))).toMatch(/inn|talk|say|drink|bar|listen/i);
  });
  it('notices a repeated question', () => {
    const s = hero();
    run(s, 'who runs this town?');
    expect(text(run(s, 'who runs this town?'))).toMatch(/already|Again|Like I said/);
  });
  it('copes with typos and shorthand', () => {
    const s = hero();
    expect(text(run(s, 'tell me abt coltail'))).toMatch(/Coltale/);
  });
});
