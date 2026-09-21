import { describe, expect, it } from "vitest";
import { applySpokenTokens, applyTranscript, toReadingWords } from "./aligner.ts";
import { fuzzyMatch } from "./fuzzy.ts";
import { tokenizeTranscript } from "./normalize.ts";
import { failedAttemptsToLevel, nextStallLevel, stallLevelForElapsed } from "./stall.ts";
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

const page = toReadingWords([
  word("The", 0, "w0"),
  word("puppy", 0, "w1"),
  word("ran", 0, "w2"),
  word("down", 0, "w3"),
  word("the", 0, "w4"),
  word("hill", 0, "w5"),
  word("Then", 1, "w6"),
]);

describe("fuzzyMatch", () => {
  it("matches exact and kid folds", () => {
    expect(fuzzyMatch("Puppy", "puppy")).toBe(true);
    expect(fuzzyMatch("da", "the")).toBe(true);
    expect(fuzzyMatch("puppi", "puppy")).toBe(true);
  });

  it("rejects a clearly different word", () => {
    expect(fuzzyMatch("cat", "puppy")).toBe(false);
  });
});

describe("aligner", () => {
  it("advances currentIndex on each match", () => {
    const first = applySpokenTokens(page, 0, ["the"]);
    expect(first.currentIndex).toBe(1);
    const second = applySpokenTokens(page, first.currentIndex, ["puppy"]);
    expect(second.currentIndex).toBe(2);
  });

  it("skips a tiny function word when the child jumps one ahead", () => {
    const result = applySpokenTokens(page, 0, ["puppy"]);
    expect(result.currentIndex).toBe(2);
    expect(result.events.some((event) => event.type === "advance" && event.via === "skip-function")).toBe(
      true,
    );
  });

  it("does not snap across the rest of the line when a later word is spoken", () => {
    const result = applySpokenTokens(page, 2, ["hill"]);
    expect(result.currentIndex).toBe(2);
    expect(result.failed).toBe(true);
    expect(result.events.some((event) => event.type === "advance")).toBe(false);
  });

  it("treats parent/child doubled words as echo instead of a mismatch", () => {
    const result = applySpokenTokens(page, 2, ["the", "puppy"]);
    expect(result.currentIndex).toBe(2);
    expect(result.failed).toBe(false);
    expect(result.events.some((event) => event.type === "echo" || event.type === "repeat-previous")).toBe(
      true,
    );
  });

  it("does not snap backward when the previous word is repeated", () => {
    const result = applySpokenTokens(page, 2, ["puppy"]);
    expect(result.currentIndex).toBe(2);
    expect(result.events.some((event) => event.type === "repeat-previous")).toBe(true);
  });

  it("records a mismatch without moving backward", () => {
    const result = applySpokenTokens(page, 2, ["banana"]);
    expect(result.currentIndex).toBe(2);
    expect(result.failed).toBe(true);
  });

  it("tokenizes a transcript into words", () => {
    expect(tokenizeTranscript("The puppy!")).toEqual(["the", "puppy"]);
    const result = applyTranscript(page, 0, "the puppy");
    expect(result.currentIndex).toBe(2);
  });
});

describe("stall ladder", () => {
  it("uses gentle timings by default", () => {
    expect(stallLevelForElapsed(3999, "gentle")).toBe(0);
    expect(stallLevelForElapsed(4000, "gentle")).toBe(1);
    expect(stallLevelForElapsed(8000, "gentle")).toBe(2);
    expect(stallLevelForElapsed(12000, "gentle")).toBe(3);
    expect(stallLevelForElapsed(16000, "gentle")).toBe(4);
  });

  it("uses shorter keep-us-moving timings", () => {
    expect(stallLevelForElapsed(2000, "keep-moving")).toBe(1);
    expect(stallLevelForElapsed(8000, "keep-moving")).toBe(4);
  });

  it("escalates Help and failed attempts", () => {
    expect(nextStallLevel(0)).toBe(1);
    expect(nextStallLevel(3)).toBe(4);
    expect(failedAttemptsToLevel(3)).toBe(4);
  });
});
