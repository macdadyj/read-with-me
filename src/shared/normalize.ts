const PUNCT_RE = /[^\p{L}\p{N}']+/gu;

/** Kid-speech folds: spoken variant → canonical (lowercase, no punct). */
const VARIANT_TO_CANONICAL: Record<string, string> = {
  da: "the",
  duh: "the",
  tuh: "the",
  teh: "the",
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
  ta: "to",
  too: "to",
  uv: "of",
  wuz: "was",
  waz: "was",
  iz: "is",
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

export function tokenizeTranscript(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => foldKidPronunciation(part))
    .filter((part) => part.length > 0);
}

export function isFunctionWord(word: string): boolean {
  return FUNCTION_WORDS.has(normalizeToken(word));
}
