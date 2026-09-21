import { fuzzyMatch } from "./fuzzy.ts";
import { isFunctionWord, tokenizeTranscript } from "./normalize.ts";
import type { AlignerEvent, AlignerResult, OcrWord, ReadingWord } from "./types.ts";

export function toReadingWords(words: OcrWord[]): ReadingWord[] {
  return words
    .filter((word) => !word.skip)
    .map((word, readingIndex) => ({ ...word, readingIndex }));
}

function isEchoOfRead(token: string, words: ReadingWord[], index: number): boolean {
  for (let i = 0; i < index; i += 1) {
    const previous = words[i];
    if (previous && fuzzyMatch(token, previous.text)) return true;
  }
  return false;
}

/**
 * Chirp often replays words the child already read, then continues.
 * A leading run that matches the tail of the read words is echo.
 * "the" while the highlight is on the second "the" does not match that tail, so it still counts.
 */
function leadingReplayLength(spoken: string[], words: ReadingWord[], index: number): number {
  const readCount = Math.max(0, Math.min(index, words.length));
  let best = 0;
  const limit = Math.min(spoken.length, readCount);
  for (let len = 1; len <= limit; len += 1) {
    const start = readCount - len;
    let matches = true;
    for (let i = 0; i < len; i += 1) {
      const pageWord = words[start + i];
      const token = spoken[i];
      if (!pageWord || !token || !fuzzyMatch(token, pageWord.text)) {
        matches = false;
        break;
      }
    }
    if (matches) best = len;
  }
  return best;
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

  const replay = leadingReplayLength(spokenTokens, words, index);
  for (let i = 0; i < replay; i += 1) {
    const token = spokenTokens[i] ?? "";
    const previous = index > 0 ? words[index - 1] : undefined;
    if (replay === 1 && previous && fuzzyMatch(token, previous.text)) {
      events.push({ type: "repeat-previous" });
    } else {
      events.push({ type: "echo" });
    }
  }

  for (const token of spokenTokens.slice(replay)) {
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

    if (isEchoOfRead(token, words, index)) {
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
