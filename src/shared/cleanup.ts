import { normalizeToken } from "./normalize.ts";
import type { OcrResult, OcrWord } from "./types.ts";

const HEADER_WORDS = new Set([
  "name",
  "date",
  "title",
  "my",
  "reading",
  "page",
  "workbook",
  "score",
  "week",
]);

function isPageNumber(word: OcrWord): boolean {
  return /^\d{1,3}$/.test(word.text.trim());
}

function isDecorationLetter(word: OcrWord): boolean {
  const text = word.text.trim();
  if (text.length !== 1) return false;
  const letter = text.toUpperCase();
  return letter !== "A" && letter !== "I";
}

function isHeaderLike(word: OcrWord, all: OcrWord[]): boolean {
  const norm = normalizeToken(word.text);
  if (HEADER_WORDS.has(norm) && word.lineIndex <= 0) return true;
  if (norm === "name" || norm === "date") return true;
  // Isolated header line near the top of the photo.
  const onLine = all.filter((item) => item.lineIndex === word.lineIndex);
  if (word.box.y < 0.18 && onLine.length <= 4 && HEADER_WORDS.has(norm)) return true;
  return false;
}

export function markSkippableWords(result: OcrResult): OcrResult {
  const words = result.words.map((word) => {
    if (word.skip) return word;
    const skip = isPageNumber(word) || isDecorationLetter(word) || isHeaderLike(word, result.words);
    return skip ? { ...word, skip: true } : word;
  });
  return { ...result, words };
}

export function applyCleanupMap(result: OcrResult, replacements: Record<string, string>): OcrResult {
  const words = result.words.map((word) => {
    const next = replacements[word.text] ?? replacements[word.normalized];
    if (!next || next === word.text) return word;
    return {
      ...word,
      text: next,
      display: next,
      normalized: normalizeToken(next),
    };
  });
  const lines = result.lines.map((line) => ({
    ...line,
    text: line.text
      .split(/\s+/)
      .map((token) => replacements[token.replace(/[^\p{L}\p{N}']+/gu, "")] ?? token)
      .join(" "),
  }));
  return { ...result, words, lines, cleaned: true };
}
