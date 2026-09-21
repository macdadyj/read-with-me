import { foldKidPronunciation, kidSpeechVariants, normalizeToken } from "./normalize.ts";

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = next[j] ?? 0;
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function matchThreshold(word: string): number {
  if (word.length <= 2) return 1;
  if (word.length <= 3) return 0.84;
  if (word.length <= 4) return 0.8;
  return 0.68;
}

/** Kid-speech phonetic near-forms of a page word (not a second recognizer). */
export function kidPhoneticForms(word: string): string[] {
  const lower = foldKidPronunciation(word);
  const forms = new Set<string>(kidSpeechVariants(lower));
  if (lower.startsWith("th") && lower.length > 2) {
    forms.add(`d${lower.slice(2)}`);
    forms.add(`t${lower.slice(2)}`);
    forms.add(`f${lower.slice(2)}`);
  }
  if (lower.includes("r")) forms.add(lower.replace(/r/g, "w"));
  if (lower.startsWith("l") && lower.length > 3) forms.add(`w${lower.slice(1)}`);
  if (lower.endsWith("ing") && lower.length > 5) forms.add(`${lower.slice(0, -3)}in`);
  if (lower.length >= 5) forms.add(lower.slice(0, -1));
  return [...forms];
}

function vowelSwap3(spoken: string, expected: string): boolean {
  return (
    spoken.length === 3 &&
    expected.length === 3 &&
    spoken[0] === expected[0] &&
    spoken[2] === expected[2] &&
    spoken[1] !== expected[1]
  );
}

export function fuzzyMatch(spoken: string, expected: string): boolean {
  const spokenFolded = foldKidPronunciation(spoken);
  const expectedFolded = foldKidPronunciation(expected);
  if (!spokenFolded || !expectedFolded) return false;
  if (spokenFolded === expectedFolded) return true;

  const spokenNorm = normalizeToken(spoken);
  const expectedNorm = normalizeToken(expected);
  if (spokenNorm === expectedNorm) return true;

  if (similarity(spokenFolded, expectedFolded) >= matchThreshold(expectedFolded)) {
    return true;
  }

  if (vowelSwap3(spokenFolded, expectedFolded)) {
    return true;
  }

  // Partial / trailing-cut interims: "pupp" / "happ" while Chirp is still catching up.
  if (
    expectedFolded.length >= 5 &&
    spokenFolded.length >= 3 &&
    expectedFolded.startsWith(spokenFolded)
  ) {
    return true;
  }

  if (
    expectedFolded.length >= 5 &&
    spokenFolded[0] === expectedFolded[0] &&
    Math.abs(spokenFolded.length - expectedFolded.length) <= 2 &&
    similarity(spokenFolded, expectedFolded) >= 0.6
  ) {
    return true;
  }

  for (const form of kidPhoneticForms(expectedFolded)) {
    if (spokenFolded === form) return true;
    if (form.length >= 4 && similarity(spokenFolded, form) >= matchThreshold(expectedFolded)) {
      return true;
    }
  }

  return false;
}
