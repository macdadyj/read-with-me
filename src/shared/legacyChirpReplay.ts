import { fuzzyMatch } from "./fuzzy.ts";
import { isFunctionWord, tokenizeTranscript } from "./normalize.ts";
import type { ReadingWord } from "./types.ts";

/**
 * Exact listen-path behavior from `main` before this suite:
 * App.tsx applied every Chirp transcript in full, and the aligner snapped
 * forward to any later word on the same line.
 */
export function legacyApplySpokenTokens(
  words: ReadingWord[],
  currentIndex: number,
  spokenTokens: string[],
): { currentIndex: number; matched: boolean; failed: boolean } {
  let index = Math.max(0, Math.min(currentIndex, words.length));
  let matched = false;
  let failed = false;

  for (const token of spokenTokens) {
    if (index >= words.length) break;
    const current = words[index];
    if (!current) break;

    if (fuzzyMatch(token, current.text)) {
      index += 1;
      matched = true;
      continue;
    }

    const next = words[index + 1];
    if (next && isFunctionWord(current.text) && fuzzyMatch(token, next.text)) {
      index += 2;
      matched = true;
      continue;
    }

    const line = current.lineIndex;
    let snapTo = -1;
    for (let i = index + 1; i < words.length; i += 1) {
      const candidate = words[i];
      if (!candidate || candidate.lineIndex !== line) break;
      if (fuzzyMatch(token, candidate.text)) {
        snapTo = i;
        break;
      }
    }
    if (snapTo >= 0) {
      index = snapTo + 1;
      matched = true;
      continue;
    }

    const previous = index > 0 ? words[index - 1] : undefined;
    if (previous && fuzzyMatch(token, previous.text)) continue;

    failed = true;
  }

  return { currentIndex: index, matched, failed };
}

export function legacyReplayChirpStream(
  words: ReadingWord[],
  frames: Array<{ transcript: string; isFinal: boolean }>,
  startIndex = 0,
): { currentIndex: number; failedBursts: number } {
  let index = startIndex;
  let seenFinals = "";
  let failedBursts = 0;
  for (const frame of frames) {
    const tokens = tokenizeTranscript(frame.transcript);
    const joined = tokens.join(" ").toLowerCase();
    if (!frame.isFinal && joined === seenFinals) continue;
    if (frame.isFinal) seenFinals = joined;
    const result = legacyApplySpokenTokens(words, index, tokens);
    index = result.currentIndex;
    if (result.failed) failedBursts += 1;
  }
  return { currentIndex: index, failedBursts };
}
