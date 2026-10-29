// Speech-act classification for profanity. The point is not to censor: it's to tell an
// exclamation ("oh shit!") from an insult aimed at someone ("fuck you, Squib") so NPCs react
// the way a person would.

export type SpeechAct = 'none' | 'exclamation' | 'emphatic' | 'insult' | 'threat' | 'self' | 'cheer';

export interface ProfanityResult {
  present: boolean;
  words: string[];
  severity: 0 | 1 | 2 | 3;
  act: SpeechAct;
  /** a name or noun the speech seems aimed at, if any ("squib", "skeleton") */
  addressee?: string;
}

// root -> severity (1 mild, 2 strong, 3 severe/slur-adjacent)
const ROOTS: [RegExp, 1 | 2 | 3][] = [
  [/^(damn|dammit|damnit|darn|hell|heck|crap|crappy|bloody|bugger|arse|ass|piss|pissed|frick|frigging|freaking|sod)$/, 1],
  [/^(shit|shitty|bullshit|shite|bastard|bitch|bitches|dick|dickhead|prick|asshole|arsehole|jackass|dumbass|douche|douchebag|goddamn|goddamnit|wanker|tosser|bollocks|screw|scumbag|pissant)$/, 2],
  [/^(fuck|fucking|fucked|fucker|fuckers|fuckin|fck|fuk|fuq|motherfucker|motherfucking|mf|cunt|twat|cock|cocksucker|shithead|shitbag|fuckface|dipshit)$/, 3],
];

const INSULT_NOUNS = /^(bastard|bitch|dick|dickhead|prick|asshole|arsehole|jackass|dumbass|douche|douchebag|wanker|tosser|scumbag|fucker|motherfucker|cunt|twat|cocksucker|shithead|shitbag|fuckface|dipshit|idiot|moron|fool|imbecile|cretin|pig|rat|coward|loser|creep|freak|hag|whore|slut|clown|bonehead|meathead|knob|git|pissant)$/;
const POSITIVE = /\b(yeah|yes|awesome|amazing|great|good|nice|beautiful|love|perfect|cool|sick|legend|brilliant|rad|delicious|best|hell yeah|lets go|let's go)\b/;
const NEGATIVE_ADJ = /\b(stupid|ugly|dumb|useless|worthless|pathetic|disgusting|gross|smelly|fat|weak|slow|idiot)\b/;
const THREAT = /\b(kill|murder|gut|end|destroy|stab|cut|hurt|break|smash|burn|choke|strangle|beat|wreck|bury|skin|shoot)\s+(you|ya|u|your|him|her|them)\b|\b(you'?re|you are|your)\s+(dead|done|finished|next)\b|\bi'?ll\s+(kill|end|gut|murder|get)\b/;
const DISMISS = /\b(fuck|screw|sod|piss)\s+(you|off|yourself|u|ya|this|that|him|her|them)\b|\b(go to hell|eat shit|kiss my ass|bite me|shut up|shut it|stuff it|get bent|get lost|drop dead|up yours)\b/;
const SECOND = /\b(you|your|you're|youre|ya|u|yourself|thou|thee)\b/;
const FIRST_SELF = /\b(i'?m|i am|i was|me|myself|i feel)\b/;
const INTERJECTION = /^(oh|ah|aw|ugh|well|holy|what the|wtf|omg|god|jesus|son of a|for|bloody)\b/;

/** Undo leetspeak and starred-out spellings so "f*ck" and "sh1t" are recognised. */
export function deobfuscate(word: string): string {
  let w = word.toLowerCase();
  if (/[a-z]/.test(w) && /[*@$!0-9#%]/.test(w)) {
    w = w.replace(/0/g, 'o').replace(/1|!/g, 'i').replace(/3/g, 'e').replace(/4|@/g, 'a').replace(/\$|5/g, 's').replace(/7/g, 't');
    // starred vowels: f*ck, f**k, sh*t
    if (/\*/.test(w)) {
      const guesses: Record<string, string> = { 'f*ck': 'fuck', 'f**k': 'fuck', 'f***': 'fuck', 'sh*t': 'shit', 's**t': 'shit', 'b*tch': 'bitch', 'a**': 'ass', 'a**hole': 'asshole', 'd*mn': 'damn', 'c*nt': 'cunt', 'f*cking': 'fucking', 'f**king': 'fucking' };
      w = guesses[w] ?? w.replace(/\*/g, 'u');
    }
  }
  return w;
}

function severityOf(word: string): 0 | 1 | 2 | 3 {
  for (const [re, s] of ROOTS) if (re.test(word)) return s;
  if (/fuck/.test(word)) return 3;
  if (/shit/.test(word)) return 2;
  return 0;
}

export function classifySpeech(raw: string, knownNames: string[] = []): ProfanityResult {
  const text = raw.toLowerCase().replace(/[“”"]/g, '').trim();
  const tokens = text.split(/[^a-z0-9*@$!#%']+/).filter(Boolean).map(deobfuscate);
  const norm = tokens.join(' ');
  const words: string[] = [];
  let severity: 0 | 1 | 2 | 3 = 0;
  for (const t of tokens) {
    const s = severityOf(t);
    if (s) {
      words.push(t);
      if (s > severity) severity = s;
    }
  }
  // addressee: a known name anywhere, or "you <noun>" target
  const addressee = knownNames.find((n) => new RegExp(`\\b${n.toLowerCase()}\\b`).test(norm));
  const hasSecond = SECOND.test(norm);
  const insultNoun = tokens.some((t) => INSULT_NOUNS.test(t));
  const dismiss = DISMISS.test(norm);
  const threat = THREAT.test(norm);

  if (!words.length && !insultNoun && !dismiss && !threat) return { present: false, words, severity: 0, act: 'none', addressee };

  let act: SpeechAct;
  if (threat && (hasSecond || addressee)) act = 'threat';
  else if (dismiss) act = 'insult';
  else if ((hasSecond || addressee) && (insultNoun || words.length || NEGATIVE_ADJ.test(norm))) act = 'insult';
  else if (insultNoun && tokens.length <= 3) act = 'insult'; // "asshole!" said to someone
  else if (FIRST_SELF.test(norm) && !hasSecond) act = 'self';
  else if (POSITIVE.test(norm)) act = 'cheer';
  else if (tokens.length <= 4 || INTERJECTION.test(norm)) act = 'exclamation';
  else act = 'emphatic';
  // Strong words alone in a short burst are exclamations, not insults ("fuck!", "oh shit")
  if (act === 'insult' && !hasSecond && !addressee && !dismiss && tokens.length <= 2 && !insultNoun) act = 'exclamation';
  return { present: true, words, severity: (severity || (insultNoun ? 1 : 0)) as 0 | 1 | 2 | 3, act, addressee };
}
