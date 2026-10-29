import { parse } from '../src/nlp/parse';
import { classifySpeech } from '../src/nlp/profanity';

describe('unarmed verbs all become unarmed strikes', () => {
  const cases: [string, string][] = [
    ['punch the zombie', 'zombie'], ['kick it', 'it'], ['poke the skeleton in the eye', 'skeleton'], ['bite the wolf', 'wolf'],
    ['headbutt zombie 2', 'zombie 2'], ['elbow the cultist', 'cultist'], ['knee him in the groin', 'him'], ['slap merah', 'merah'],
    ['mule kick the zombie', 'zombie'], ['karate chop the skeleton', 'skeleton'], ['I uppercut the zombie', 'zombie'], ['roundhouse kick the wolf', 'wolf'],
  ];
  for (const [input, target] of cases) {
    it(input, () => {
      const i = parse(input);
      expect(i.type).toBe('attack');
      if (i.type === 'attack') { expect(i.style).toBe('unarmed'); expect(i.target).toBe(target); }
    });
  }
  it('keeps the limb for narration', () => {
    const i = parse('kick the zombie in the face');
    expect(i.type === 'attack' && i.limb).toBe('face');
  });
  it('"hit X with my sword" is a weapon attack', () => {
    const i = parse('hit the skeleton with my longsword');
    expect(i.type === 'attack' && i.style).toBe('default');
    expect(i.type === 'attack' && i.weapon).toBe('longsword');
  });
});

describe('other intents', () => {
  it('shoot', () => { const i = parse('shoot the wolf'); expect(i.type === 'attack' && i.style).toBe('ranged'); });
  it('stab', () => { const i = parse('stab zombie 1'); expect(i.type === 'attack' && i.style).toBe('melee'); });
  it('cast with target', () => { const i = parse('cast fire bolt at the zombie', ['fire bolt']); expect(i).toEqual({ type: 'cast', spell: 'fire bolt', target: 'zombie' }); });
  it('bare spell name', () => { const i = parse('magic missile the skeleton', ['magic missile']); expect(i.type).toBe('cast'); });
  it('ask about', () => { expect(parse('ask squib about the barrel')).toEqual({ type: 'talk', npc: 'squib', topic: 'barrel' }); });
  it('kick the door is opening, not attacking', () => { const i = parse('kick the vestry door'); expect(i.type).toBe('open'); });
  it('high five is an emote', () => { expect(parse('high five alistair')).toEqual({ type: 'emote', act: 'high five', target: 'alistair' }); });
  it('go', () => { expect(parse('go north')).toEqual({ type: 'go', dest: 'north' }); });
  it('quoted speech', () => { expect(parse('"what\'s with the barrel?"').type).toBe('say'); });
  it('drink potion', () => { expect(parse('drink a potion').type).toBe('use'); });
  it('grab the ewe is take, grab the cultist is grapple', () => { expect(parse('grab the ewe').type).toBe('grapple'); expect(parse('grab the candle').type).toBe('take'); });
});

describe('profanity is judged by use', () => {
  it('exclamation', () => { expect(classifySpeech('oh shit').act).toBe('exclamation'); expect(classifySpeech('fuck!').act).toBe('exclamation'); });
  it('directed insult', () => { expect(classifySpeech('fuck you squib', ['squib']).act).toBe('insult'); expect(classifySpeech('you bastard').act).toBe('insult'); });
  it('dismissal', () => { expect(classifySpeech('screw off').act).toBe('insult'); });
  it('emphatic, not aimed at anyone', () => { expect(classifySpeech('this fucking door will not open no matter what').act).toBe('emphatic'); });
  it('cheer', () => { expect(classifySpeech('hell yeah').act).toBe('cheer'); expect(classifySpeech('that was fucking awesome').act).toBe('cheer'); });
  it('self-directed', () => { expect(classifySpeech("i'm such a fucking idiot").act).toBe('self'); });
  it('threat', () => { expect(classifySpeech("I'll kill you, Merah", ['merah']).act).toBe('threat'); });
  it('obfuscated', () => { expect(classifySpeech('f*ck you').act).toBe('insult'); expect(classifySpeech('sh1t').present).toBe(true); });
  it('clean speech', () => { expect(classifySpeech('what is with the barrel').present).toBe(false); });
});
