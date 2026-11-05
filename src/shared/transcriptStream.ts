import { fuzzyMatch } from "./fuzzy.ts";
import { foldKidPronunciation, isFunctionWord, tokenizeTranscript } from "./normalize.ts";

export type TranscriptCursor = {
  tokens: string[];
};

export type TranscriptFrame = {
  transcript: string;
  isFinal: boolean;
  stability?: number;
};

export function emptyTranscriptCursor(): TranscriptCursor {
  return { tokens: [] };
}

export function commonTokenPrefixLength(previous: string[], next: string[]): number {
  const limit = Math.min(previous.length, next.length);
  let index = 0;
  while (index < limit && previous[index] === next[index]) {
    index += 1;
  }
  return index;
}

export function newTokensSince(previous: string[], next: string[]): string[] {
  return next.slice(commonTokenPrefixLength(previous, next));
}

/** "pup" / "ra" is still being said. "ran" and "puppy" are finished words. */
export function isIncompletePrefix(token: string, word: string): boolean {
  const spoken = foldKidPronunciation(token);
  const expected = foldKidPronunciation(word);
  return spoken.length > 0 && spoken.length < expected.length && expected.startsWith(spoken);
}

/**
 * Hold only a cut-off interim tail ("pu", "hil").
 * A short word that already matches an upcoming page word ("the", "ran") is committed
 * so a phrase can move the highlight as the child reads.
 */
export function shouldHoldInterimTail(token: string, upcoming: string[] = []): boolean {
  if (!token || isFunctionWord(token)) return false;
  if (token.length > 3) return false;
  const finishesUpcoming = upcoming.some((word) => fuzzyMatch(token, word) && !isIncompletePrefix(token, word));
  return !finishesUpcoming;
}

/**
 * Turn a cumulative STT transcript into the newly spoken tokens.
 * Growing interims apply only the delta, including every later word in the same phrase.
 * The aligner still walks those words in order and will not skip ahead to an unmatched word.
 */
export function consumeTranscript(
  cursor: TranscriptCursor,
  transcript: string,
  isFinal: boolean,
  upcoming: string[] = [],
): { nextCursor: TranscriptCursor; spoken: string[] } {
  const nextTokens = tokenizeTranscript(transcript);
  let stableTokens = nextTokens;
  if (!isFinal && nextTokens.length > 0) {
    const tail = nextTokens[nextTokens.length - 1] ?? "";
    if (shouldHoldInterimTail(tail, upcoming)) {
      stableTokens = nextTokens.slice(0, -1);
    }
  }

  return {
    nextCursor: isFinal ? emptyTranscriptCursor() : { tokens: stableTokens },
    spoken: newTokensSince(cursor.tokens, stableTokens),
  };
}

export function applyStreamingTranscripts(
  apply: (tokens: string[]) => void,
  frames: TranscriptFrame[],
  cursor: TranscriptCursor = emptyTranscriptCursor(),
): TranscriptCursor {
  let current = cursor;
  for (const frame of frames) {
    const consumed = consumeTranscript(current, frame.transcript, frame.isFinal);
    current = consumed.nextCursor;
    if (consumed.spoken.length) apply(consumed.spoken);
  }
  return current;
}
