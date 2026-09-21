import { describe, expect, it } from "vitest";
import { applySpokenTokens } from "./aligner.ts";
import { ALIGNER_TRAINING_CASES, readingWordsForSample, runTrainingCase } from "./alignerTraining.ts";
import { kidSpeechVariants } from "./normalize.ts";
import { SAMPLE_PAGES } from "./samplePages.ts";
import { consumeTranscript, emptyTranscriptCursor, firstSpokenBurst } from "./transcriptStream.ts";

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

  it("treats a sudden full-line dump as one spoken burst", () => {
    const dumped = consumeTranscript(emptyTranscriptCursor(), "the puppy ran down the hill", true);
    expect(dumped.spoken).toEqual(firstSpokenBurst(["the", "puppy", "ran", "down", "the", "hill"]));
    expect(dumped.spoken).toEqual(["the", "puppy"]);
  });
});

describe("aligner training corpus", () => {
  it("has cases on every sample document", () => {
    const covered = new Set(ALIGNER_TRAINING_CASES.map((testCase) => testCase.sample));
    for (const page of SAMPLE_PAGES) {
      expect(covered.has(page.id)).toBe(true);
    }
  });

  it.each(ALIGNER_TRAINING_CASES)("$id — $note", (testCase) => {
    expect(runTrainingCase(testCase).currentIndex).toBe(testCase.expectedIndex);
  });

  it("walks each sample page word-by-word without skipping the rest of a line", () => {
    for (const page of SAMPLE_PAGES) {
      const words = readingWordsForSample(page.id);
      let index = 0;
      for (const word of words) {
        const before = index;
        const result = applySpokenTokens(words, index, [word.normalized]);
        expect(result.currentIndex, `${page.id} saying ${word.text}`).toBeGreaterThan(before);
        expect(result.currentIndex, `${page.id} saying ${word.text}`).toBeLessThanOrEqual(before + 2);
        index = result.currentIndex;
      }
      expect(index).toBe(words.length);
    }
  });

  it("accepts local kid-speech variants for the current word only", () => {
    const words = readingWordsForSample("puppy");
    for (const spoken of kidSpeechVariants("puppy")) {
      const result = applySpokenTokens(words, 1, [spoken]);
      expect(result.currentIndex, spoken).toBe(2);
    }
    for (const spoken of kidSpeechVariants("the")) {
      const fromStart = applySpokenTokens(words, 0, [spoken]);
      expect(fromStart.currentIndex, spoken).toBe(1);
    }
  });
});
