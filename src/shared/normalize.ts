const PUNCT_RE = /[^\p{L}\p{N}']+/gu;

/** Kid-speech folds: spoken variant → canonical (lowercase, no punct). */
const VARIANT_TO_CANONICAL: Record<string, string> = {
  da: "the",
  duh: "the",
  tuh: "the",
  teh: "the",
  dah: "the",
  cuz: "because",
  becuz: "because",
  becas: "because",
  cause: "because",
  wanna: "want",
  gonna: "going",
  gotta: "got",
  kinda: "kind",
  n: "and",
  nd: "and",
  an: "and",
  ta: "to",
  too: "to",
  uv: "of",
  wuz: "was",
  waz: "was",
  iz: "is",
  dat: "that",
  dis: "this",
  wit: "with",
  wif: "with",
  fer: "for",
  yer: "your",
  ya: "you",
  wittle: "little",
  liddle: "little",
  happi: "happy",
  doggie: "dog",
  doggy: "dog",
  dawg: "dog",
  puppi: "puppy",
  runned: "ran",
  sitted: "sat",
  sittin: "sitting",
  goin: "going",
  frow: "throw",
  wabbit: "rabbit",
};

export const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "and",
  "or",
]);

export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(PUNCT_RE, "").replace(/'/g, "");
}

export function foldKidPronunciation(token: string): string {
  const normalized = normalizeToken(token);
  return VARIANT_TO_CANONICAL[normalized] ?? normalized;
}

/** Local training variants a 5–8 year old might say for a page word. */
export function kidSpeechVariants(word: string): string[] {
  const canonical = foldKidPronunciation(word);
  const variants = new Set<string>([canonical, normalizeToken(word)]);
  for (const [spoken, target] of Object.entries(VARIANT_TO_CANONICAL)) {
    if (target === canonical) variants.add(spoken);
  }
  if (canonical.length > 3 && canonical.endsWith("y")) {
    variants.add(`${canonical.slice(0, -1)}ie`);
    variants.add(`${canonical.slice(0, -1)}i`);
  }
  if (canonical.length > 4 && canonical.endsWith("e")) {
    variants.add(canonical.slice(0, -1));
  }
  return [...variants].filter(Boolean);
}

export function tokenizeTranscript(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => foldKidPronunciation(part))
    .filter((part) => part.length > 0);
}

export function isFunctionWord(word: string): boolean {
  return FUNCTION_WORDS.has(normalizeToken(word));
}

export function kidPronunciationEntries(): ReadonlyArray<readonly [string, string]> {
  return Object.entries(VARIANT_TO_CANONICAL);
}
