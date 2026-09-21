import { isFunctionWord, tokenizeTranscript } from "./normalize.ts";

/** First streaming packet this long is usually Chirp completing a line, not a child. */
export const SUDDEN_DUMP_TOKEN_THRESHOLD = 4;

export type TranscriptCursor = {
  tokens: string[];
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

/** Keep a leading function word plus the first content word. */
export function firstSpokenBurst(tokens: string[]): string[] {
  const burst: string[] = [];
  for (const token of tokens) {
    burst.push(token);
    if (!isFunctionWord(token)) break;
  }
  return burst;
}

export function newTokensSince(previous: string[], next: string[]): string[] {
  return next.slice(commonTokenPrefixLength(previous, next));
}

/**
 * Turn a cumulative STT transcript into the newly spoken tokens to feed the aligner.
 * Growing interims apply only the delta. A sudden 4+ word dump is treated as one burst
 * so “puppy” cannot complete “The puppy ran down the hill.”
 */
export function consumeTranscript(
  cursor: TranscriptCursor,
  transcript: string,
  isFinal: boolean,
): { nextCursor: TranscriptCursor; spoken: string[] } {
  const nextTokens = tokenizeTranscript(transcript);
  let spoken = newTokensSince(cursor.tokens, nextTokens);
  if (spoken.length >= SUDDEN_DUMP_TOKEN_THRESHOLD) {
    spoken = firstSpokenBurst(spoken);
  }
  return {
    nextCursor: isFinal ? emptyTranscriptCursor() : { tokens: nextTokens },
    spoken,
  };
}

export function applyStreamingTranscripts(
  apply: (tokens: string[]) => void,
  frames: Array<{ transcript: string; isFinal: boolean }>,
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
