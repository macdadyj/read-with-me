import { applySpokenTokens, releaseAfterCoach, toReadingWords } from "./aligner.ts";
import { escalateStall, isHintLevel, stallLevelForElapsed } from "./stall.ts";
import {
  applyStreamingTranscripts,
  consumeTranscript,
  emptyTranscriptCursor,
  type TranscriptCursor,
  type TranscriptFrame,
} from "./transcriptStream.ts";
import type { AlignerEvent, OcrWord, PaceMode, ReadingWord, StallLevel } from "./types.ts";

export type ListenSnapshot = {
  currentIndex: number;
  stallLevel: StallLevel;
  failedAttempts: number;
  lastAttempt: string | null;
  matched: boolean;
  failed: boolean;
  advanced: boolean;
  events: AlignerEvent[];
};

export type ListenSession = {
  ingest(transcript: string, isFinal: boolean): ListenSnapshot;
  ingestTokens(tokens: string[]): ListenSnapshot;
  ingestFrames(frames: TranscriptFrame[]): ListenSnapshot;
  tick(nowMs: number): ListenSnapshot;
  setPace(pace: PaceMode): void;
  setArmed(armed: boolean): void;
  setPaused(paused: boolean): void;
  markHintLevel(level: StallLevel): void;
  markAdvanced(nowMs: number): void;
  coachRelease(): ListenSnapshot;
  reset(words?: ReadingWord[]): void;
  snapshot(): ListenSnapshot;
  words(): ReadingWord[];
};

export function readingWordsFrom(words: OcrWord[] | ReadingWord[]): ReadingWord[] {
  if (words.length === 0) return [];
  if ("readingIndex" in words[0]!) return words as ReadingWord[];
  return toReadingWords(words);
}

function emptySnapshot(index: number, extra?: Partial<ListenSnapshot>): ListenSnapshot {
  return {
    currentIndex: index,
    stallLevel: 0,
    failedAttempts: 0,
    lastAttempt: null,
    matched: false,
    failed: false,
    advanced: false,
    events: [],
    ...extra,
  };
}

export function createListenSession(options: {
  words?: OcrWord[] | ReadingWord[];
  pace?: PaceMode;
  now?: () => number;
} = {}): ListenSession {
  let words = readingWordsFrom(options.words ?? []);
  let pace: PaceMode = options.pace ?? "gentle";
  let index = 0;
  let cursor: TranscriptCursor = emptyTranscriptCursor();
  let stallLevel: StallLevel = 0;
  let failedAttempts = 0;
  let lastAttempt: string | null = null;
  let lastAdvanceAt = options.now?.() ?? 0;
  let armed = false;
  let paused = false;

  function now(): number {
    return options.now?.() ?? 0;
  }

  function snapshot(extra?: Partial<ListenSnapshot>): ListenSnapshot {
    return {
      currentIndex: index,
      stallLevel,
      failedAttempts,
      lastAttempt,
      matched: false,
      failed: false,
      advanced: false,
      events: [],
      ...extra,
    };
  }

  function applyResult(
    result: ReturnType<typeof applySpokenTokens>,
    spoken: string[],
  ): ListenSnapshot {
    const before = index;
    index = result.currentIndex;
    const advanced = result.currentIndex > before;

    if (result.matched) {
      stallLevel = 0;
      failedAttempts = 0;
      lastAttempt = null;
      lastAdvanceAt = now();
    }

    if (result.failed && !result.matched) {
      lastAttempt = spoken[spoken.length - 1] ?? lastAttempt;
      failedAttempts += 1;
      stallLevel = escalateStall(stallLevel, failedAttempts);
    } else if (result.failed) {
      lastAttempt = spoken[spoken.length - 1] ?? lastAttempt;
    }

    return snapshot({
      matched: result.matched,
      failed: result.failed && !result.matched,
      advanced,
      events: result.events,
    });
  }

  return {
    ingest(transcript: string, isFinal: boolean) {
      const consumed = consumeTranscript(cursor, transcript, isFinal);
      cursor = consumed.nextCursor;
      if (!consumed.spoken.length) return snapshot();
      return applyResult(applySpokenTokens(words, index, consumed.spoken), consumed.spoken);
    },
    ingestTokens(tokens: string[]) {
      if (!tokens.length) return snapshot();
      cursor = emptyTranscriptCursor();
      return applyResult(applySpokenTokens(words, index, tokens), tokens);
    },
    ingestFrames(frames: TranscriptFrame[]) {
      let last = snapshot();
      cursor = applyStreamingTranscripts((tokens) => {
        last = applyResult(applySpokenTokens(words, index, tokens), tokens);
      }, frames, cursor);
      return last;
    },
    tick(nowMs: number) {
      if (!armed || paused) return snapshot();
      const next = stallLevelForElapsed(nowMs - lastAdvanceAt, pace);
      if (next > stallLevel) stallLevel = next;
      return snapshot();
    },
    setPace(next) {
      pace = next;
    },
    setArmed(next) {
      armed = next;
      if (next) lastAdvanceAt = now();
    },
    setPaused(next) {
      paused = next;
    },
    markHintLevel(level) {
      stallLevel = level;
    },
    markAdvanced(nowMs) {
      lastAdvanceAt = nowMs;
      stallLevel = 0;
      failedAttempts = 0;
    },
    coachRelease() {
      const result = releaseAfterCoach(index);
      return applyResult(result, []);
    },
    reset(nextWords) {
      if (nextWords) words = readingWordsFrom(nextWords);
      index = 0;
      cursor = emptyTranscriptCursor();
      stallLevel = 0;
      failedAttempts = 0;
      lastAttempt = null;
      lastAdvanceAt = now();
      armed = false;
      paused = true;
    },
    snapshot,
    words: () => words,
  };
}

export function trackLiveSpeech(
  words: OcrWord[] | ReadingWord[],
  frames: TranscriptFrame[],
  startIndex = 0,
): ListenSnapshot {
  const session = createListenSession({ words });
  if (startIndex > 0) {
    const head = readingWordsFrom(words).slice(0, startIndex).map((word) => word.normalized);
    if (head.length) session.ingestTokens(head);
  }
  return session.ingestFrames(frames);
}

export function hintWouldSpeak(level: StallLevel): boolean {
  return isHintLevel(level);
}
