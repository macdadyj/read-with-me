const LETTER_SOUND: Record<string, string> = {
  a: "a",
  b: "b",
  c: "k",
  d: "d",
  e: "e",
  f: "f",
  g: "g",
  h: "h",
  i: "i",
  j: "j",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  o: "o",
  p: "p",
  q: "kw",
  r: "r",
  s: "s",
  t: "t",
  u: "u",
  v: "v",
  w: "w",
  x: "ks",
  y: "y",
  z: "z",
};

const DIGRAPHS = [
  "thr",
  "sch",
  "scr",
  "spr",
  "str",
  "spl",
  "shr",
  "ch",
  "sh",
  "th",
  "wh",
  "ph",
  "qu",
  "ck",
  "kn",
  "wr",
  "bl",
  "br",
  "cl",
  "cr",
  "dr",
  "fl",
  "fr",
  "gl",
  "gr",
  "pl",
  "pr",
  "sc",
  "sk",
  "sl",
  "sm",
  "sn",
  "sp",
  "st",
  "sw",
  "tr",
  "tw",
] as const;

const DIGRAPH_SOUND: Record<string, string> = {
  ch: "ch",
  sh: "sh",
  th: "th",
  wh: "w",
  ph: "f",
  qu: "kw",
  kn: "n",
  wr: "r",
  ck: "k",
};

export type WordParts = {
  onset: string;
  rime: string;
  firstSound: string;
  blend: string;
};

export function splitOnsetRime(word: string): WordParts {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  const cluster = DIGRAPHS.find((item) => lower.startsWith(item));
  const onset = cluster ?? lower.slice(0, 1);
  const rime = lower.slice(onset.length);
  const firstSound = DIGRAPH_SOUND[onset] ?? LETTER_SOUND[onset[0] ?? ""] ?? onset;
  const vowel = rime.match(/^[aeiou]+/)?.[0] ?? rime.slice(0, 1);
  const blend = `${firstSound}${vowel}`;
  return { onset, rime, firstSound, blend };
}

export function firstSoundHint(word: string): string {
  const { firstSound } = splitOnsetRime(word);
  return `It starts with /${firstSound}/.`;
}

export function blendHint(word: string): string {
  const { blend, rime, firstSound } = splitOnsetRime(word);
  const rest = rime.replace(/^[aeiou]+/, "") || rime;
  if (rest && rest !== rime) {
    return `/${blend}/ … /${rest}/.`;
  }
  return `/${firstSound}/ … /${rime || word}/.`;
}

export function underlineForLevel(word: string, level: 1 | 2 | 3 | 4): string {
  if (level === 1) return "";
  if (level === 2) return splitOnsetRime(word).onset;
  return word;
}
