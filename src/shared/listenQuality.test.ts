import { describe, expect, it } from "vitest";
import { applySpokenTokens, toReadingWords } from "./aligner.ts";
import { fuzzyMatch } from "./fuzzy.ts";
import { legacyReplayChirpStream } from "./legacyChirpReplay.ts";
import { createListenSession, trackLiveSpeech } from "./listenTracker.ts";
import { kidSpeechVariants } from "./normalize.ts";
import { consumeTranscript, emptyTranscriptCursor, firstSpokenBurst } from "./transcriptStream.ts";
import type { OcrWord } from "./types.ts";

function word(text: string, lineIndex: number, id = text): OcrWord {
  return {
    id,
    text,
    normalized: text.toLowerCase(),
    lineIndex,
    box: { x: 0, y: 0, width: 0.1, height: 0.05 },
  };
}

const puppyPage = toReadingWords([
  word("The", 0, "w0"),
  word("puppy", 0, "w1"),
  word("ran", 0, "w2"),
  word("down", 0, "w3"),
  word("the", 0, "w4"),
  word("hill", 0, "w5"),
  word("Then", 1, "w6"),
  word("he", 1, "w7"),
  word("sat", 1, "w8"),
  word("in", 1, "w9"),
  word("the", 1, "w10"),
  word("sun", 1, "w11"),
]);

const growingFirstLine = [
  { transcript: "the", isFinal: false },
  { transcript: "the puppy", isFinal: false },
  { transcript: "the puppy ran down the hill", isFinal: true },
];

describe("baseline failures on main (documented, still true of the old path)", () => {
  it("growing Chirp transcript + snap-forward finishes the first line", () => {
    const legacy = legacyReplayChirpStream(puppyPage, growingFirstLine);
    expect(legacy.currentIndex).toBeGreaterThanOrEqual(5);
    expect(legacy.failedBursts).toBeGreaterThan(0);
  });

  it("one later word on the line jumps the highlight to the end", () => {
    const legacy = legacyReplayChirpStream(puppyPage, [{ transcript: "hill", isFinal: true }], 2);
    expect(legacy.currentIndex).toBe(6);
  });

  it("parent doubling the last words counts as a failed burst", () => {
    const legacy = legacyReplayChirpStream(puppyPage, [
      { transcript: "the", isFinal: true },
      { transcript: "the puppy", isFinal: true },
      { transcript: "the puppy", isFinal: true },
    ]);
    expect(legacy.failedBursts).toBeGreaterThan(0);
  });
});

describe("transcript streaming cursor", () => {
  it("applies only new tokens from a growing Chirp transcript", () => {
    const first = consumeTranscript(emptyTranscriptCursor(), "the", false);
    expect(first.spoken).toEqual(["the"]);
    const second = consumeTranscript(first.nextCursor, "the puppy", false);
    expect(second.spoken).toEqual(["puppy"]);
    const dumped = consumeTranscript(second.nextCursor, "the puppy ran down the hill", true);
    expect(dumped.spoken).toEqual(["ran"]);
    expect(dumped.nextCursor.tokens).toEqual([]);
  });

  it("holds a short unstable interim tail (partial word)", () => {
    const held = consumeTranscript(emptyTranscriptCursor(), "pup", false);
    expect(held.spoken).toEqual([]);
    const completed = consumeTranscript(held.nextCursor, "puppy", false);
    expect(completed.spoken).toEqual(["puppy"]);
  });

  it("treats a sudden full-line dump as one spoken burst", () => {
    const dumped = consumeTranscript(emptyTranscriptCursor(), "the puppy ran down the hill", true);
    expect(dumped.spoken).toEqual(firstSpokenBurst(["the", "puppy", "ran", "down", "the", "hill"]));
    expect(dumped.spoken).toEqual(["the", "puppy"]);
  });
});

describe("live mic → Chirp frames → word tracker", () => {
  it("does not finish the line when Chirp replays a growing transcript", () => {
    const live = trackLiveSpeech(puppyPage, growingFirstLine);
    expect(live.currentIndex).toBe(3);
    expect(puppyPage[live.currentIndex]?.text).toBe("down");
  });

  it("still walks the page word by word", () => {
    const live = trackLiveSpeech(puppyPage, [
      { transcript: "the", isFinal: true },
      { transcript: "puppy", isFinal: true },
      { transcript: "ran", isFinal: true },
    ]);
    expect(live.currentIndex).toBe(3);
  });

  it("accepts kid pronunciation folds and phoneme-near matches", () => {
    expect(trackLiveSpeech(puppyPage, [{ transcript: "da", isFinal: true }]).currentIndex).toBe(1);
    expect(trackLiveSpeech(puppyPage, [{ transcript: "puppi", isFinal: true }]).currentIndex).toBe(2);
    expect(fuzzyMatch("wittle", "little")).toBe(true);
    expect(fuzzyMatch("run", "ran")).toBe(true);
    expect(fuzzyMatch("happi", "happy")).toBe(true);
    expect(fuzzyMatch("dat", "that")).toBe(true);
    expect(fuzzyMatch("the", "then")).toBe(false);
    expect(fuzzyMatch("cat", "puppy")).toBe(false);
  });

  it("advances on a partial longer word once Chirp stabilizes it", () => {
    const live = trackLiveSpeech(puppyPage, [
      { transcript: "the", isFinal: false },
      { transcript: "the pup", isFinal: false },
      { transcript: "the puppy", isFinal: true },
    ]);
    expect(live.currentIndex).toBe(2);
  });

  it("skips a function word and then waits (no snap to hill)", () => {
    const skipped = trackLiveSpeech(puppyPage, [{ transcript: "puppy", isFinal: true }]);
    expect(skipped.currentIndex).toBe(2);
    const jumped = trackLiveSpeech(puppyPage, [{ transcript: "hill", isFinal: true }], 2);
    expect(jumped.currentIndex).toBe(2);
    expect(jumped.failed).toBe(true);
  });

  it("ignores overlapping / doubled speech instead of stalling", () => {
    const live = trackLiveSpeech(puppyPage, [
      { transcript: "the", isFinal: true },
      { transcript: "the puppy", isFinal: true },
      { transcript: "the puppy", isFinal: true },
    ]);
    expect(live.currentIndex).toBe(2);
    expect(live.failed).toBe(false);
    expect(live.failedAttempts).toBe(0);
  });

  it("keeps going after a long pause (new Chirp utterance)", () => {
    const live = trackLiveSpeech(puppyPage, [
      { transcript: "the", isFinal: true },
      { transcript: "puppy", isFinal: true },
      { transcript: "ran", isFinal: true },
    ]);
    expect(live.currentIndex).toBe(3);
  });

  it("accepts local kid-speech variants for the current word only", () => {
    for (const spoken of kidSpeechVariants("puppy")) {
      expect(applySpokenTokens(puppyPage, 1, [spoken]).currentIndex, spoken).toBe(2);
    }
    for (const spoken of kidSpeechVariants("the")) {
      expect(applySpokenTokens(puppyPage, 0, [spoken]).currentIndex, spoken).toBe(1);
    }
  });
});

describe("stall ladder vs live matches", () => {
  it("does not escalate while matches keep arriving", () => {
    let clock = 0;
    const session = createListenSession({
      words: puppyPage,
      pace: "gentle",
      now: () => clock,
    });
    session.setArmed(true);
    session.setPaused(false);
    session.ingest("the", true);
    clock = 3_500;
    expect(session.tick(clock).stallLevel).toBe(0);
    session.ingest("puppy", true);
    clock = 7_000;
    expect(session.tick(clock).stallLevel).toBe(0);
  });

  it("climbs the gentle ladder when no match arrives", () => {
    let clock = 0;
    const session = createListenSession({
      words: puppyPage,
      pace: "gentle",
      now: () => clock,
    });
    session.setArmed(true);
    session.setPaused(false);
    expect(session.tick(3_999).stallLevel).toBe(0);
    expect(session.tick(4_000).stallLevel).toBe(1);
    expect(session.tick(8_000).stallLevel).toBe(2);
    expect(session.tick(12_000).stallLevel).toBe(3);
    expect(session.tick(16_000).stallLevel).toBe(4);
  });

  it("does not count echo / doubled speech as a failed attempt that jumps the ladder", () => {
    const session = createListenSession({ words: puppyPage, now: () => 0 });
    session.ingest("the", true);
    session.ingest("puppy", true);
    const echo = session.ingest("the puppy", true);
    expect(echo.currentIndex).toBe(2);
    expect(echo.failedAttempts).toBe(0);
    expect(echo.stallLevel).toBe(0);
  });

  it("clears the ladder after a real match", () => {
    let clock = 0;
    const session = createListenSession({
      words: puppyPage,
      pace: "keep-moving",
      now: () => clock,
    });
    session.setArmed(true);
    session.setPaused(false);
    clock = 2_000;
    expect(session.tick(clock).stallLevel).toBe(1);
    const matched = session.ingest("the", true);
    expect(matched.stallLevel).toBe(0);
    expect(matched.matched).toBe(true);
  });
});
