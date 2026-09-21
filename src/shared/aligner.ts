import { fuzzyMatch } from "./fuzzy.ts";
import { isFunctionWord, tokenizeTranscript } from "./normalize.ts";
import type { AlignerEvent, AlignerResult, OcrWord, ReadingWord } from "./types.ts";

const ECHO_WINDOW = 3;

export function toReadingWords(words: OcrWord[]): ReadingWord[] {
  return words
    .filter((word) => !word.skip)
    .map((word, readingIndex) => ({ ...word, readingIndex }));
}

function isEchoOfRecent(token: string, words: ReadingWord[], index: number): boolean {
  const start = Math.max(0, index - ECHO_WINDOW);
  for (let i = start; i < index; i += 1) {
    const previous = words[i];
    if (previous && fuzzyMatch(token, previous.text)) return true;
  }
  return false;
}

export function applySpokenTokens(
  words: ReadingWord[],
  currentIndex: number,
  spokenTokens: string[],
): AlignerResult {
  let index = Math.max(0, Math.min(currentIndex, words.length));
  const events: AlignerEvent[] = [];
  let matched = false;
  let failed = false;

  for (const token of spokenTokens) {
    if (index >= words.length) break;
    const current = words[index];
    if (!current) break;

    if (fuzzyMatch(token, current.text)) {
      index += 1;
      matched = true;
      events.push({ type: "advance", toIndex: index, via: "match" });
      continue;
    }

    const next = words[index + 1];
    if (next && isFunctionWord(current.text) && fuzzyMatch(token, next.text)) {
      index += 2;
      matched = true;
      events.push({ type: "advance", toIndex: index, via: "skip-function" });
      continue;
    }

    const previous = index > 0 ? words[index - 1] : undefined;
    if (previous && fuzzyMatch(token, previous.text)) {
      events.push({ type: "repeat-previous" });
      continue;
    }

    if (isEchoOfRecent(token, words, index)) {
      events.push({ type: "echo" });
      continue;
    }

    failed = true;
    events.push({ type: "mismatch", spoken: token, expected: current.text });
  }

  return { currentIndex: index, events, matched, failed };
}

export function applyTranscript(words: ReadingWord[], currentIndex: number, transcript: string): AlignerResult {
  return applySpokenTokens(words, currentIndex, tokenizeTranscript(transcript));
}

export function releaseAfterCoach(currentIndex: number): AlignerResult {
  return {
    currentIndex: currentIndex + 1,
    events: [{ type: "advance", toIndex: currentIndex + 1, via: "coach-release" }],
    matched: true,
    failed: false,
  };
}
