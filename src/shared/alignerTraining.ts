import { applySpokenTokens, toReadingWords } from "./aligner.ts";
import { ocrFromSample, SAMPLE_PAGES, samplePageById, type SamplePageId } from "./samplePages.ts";
import { applyStreamingTranscripts, emptyTranscriptCursor } from "./transcriptStream.ts";
import type { ReadingWord } from "./types.ts";

export type TrainingCase = {
  id: string;
  sample: SamplePageId;
  startIndex: number;
  stream: Array<{ transcript: string; isFinal: boolean }>;
  expectedIndex: number;
  note: string;
};

export function readingWordsForSample(id: SamplePageId): ReadingWord[] {
  return toReadingWords(ocrFromSample(samplePageById(id)).words);
}

export function runTrainingCase(testCase: TrainingCase): { currentIndex: number } {
  const words = readingWordsForSample(testCase.sample);
  let index = testCase.startIndex;
  applyStreamingTranscripts((tokens) => {
    index = applySpokenTokens(words, index, tokens).currentIndex;
  }, testCase.stream, emptyTranscriptCursor());
  return { currentIndex: index };
}

/**
 * Hand-written audio→text sessions from real kid reading + Chirp-style dumps.
 * Vertex/Gemini can add more variants later; these stay in-repo so CI does not need GCP.
 */
export const ALIGNER_TRAINING_CASES: TrainingCase[] = [
  {
    id: "puppy-only-does-not-finish-line",
    sample: "puppy",
    startIndex: 0,
    stream: [{ transcript: "puppy", isFinal: true }],
    expectedIndex: 2,
    note: "Say puppy at the start: skip The, stop on ran.",
  },
  {
    id: "puppy-chirp-dumps-whole-first-line",
    sample: "puppy",
    startIndex: 0,
    stream: [{ transcript: "the puppy ran down the hill", isFinal: true }],
    expectedIndex: 2,
    note: "Chirp completing the sentence after one spoken word must not finish the line.",
  },
  {
    id: "puppy-growing-interims-are-deltas",
    sample: "puppy",
    startIndex: 0,
    stream: [
      { transcript: "the", isFinal: false },
      { transcript: "the puppy", isFinal: false },
      { transcript: "the puppy ran down the hill", isFinal: true },
    ],
    expectedIndex: 3,
    note: "Re-playing a growing transcript must not snap through later the/hill.",
  },
  {
    id: "puppy-fluent-one-word-at-a-time",
    sample: "puppy",
    startIndex: 0,
    stream: [
      { transcript: "the", isFinal: true },
      { transcript: "puppy", isFinal: true },
      { transcript: "ran", isFinal: true },
    ],
    expectedIndex: 3,
    note: "Word-by-word reading still advances.",
  },
  {
    id: "puppy-kid-da-for-the",
    sample: "puppy",
    startIndex: 0,
    stream: [{ transcript: "da", isFinal: true }],
    expectedIndex: 1,
    note: "Kid fold da → the.",
  },
  {
    id: "puppy-repeat-does-not-go-back",
    sample: "puppy",
    startIndex: 2,
    stream: [{ transcript: "puppy", isFinal: true }],
    expectedIndex: 2,
    note: "Repeating the previous word stays put.",
  },
  {
    id: "puppy-cannot-jump-to-hill",
    sample: "puppy",
    startIndex: 2,
    stream: [{ transcript: "hill", isFinal: true }],
    expectedIndex: 2,
    note: "Saying a later word on the line is not a snap-forward.",
  },
  {
    id: "cat-sat-only",
    sample: "cat",
    startIndex: 0,
    stream: [{ transcript: "sat", isFinal: true }],
    expectedIndex: 0,
    note: "Cat page: sat is not the first word and must not skip the line.",
  },
  {
    id: "cat-the-cat",
    sample: "cat",
    startIndex: 0,
    stream: [
      { transcript: "the", isFinal: false },
      { transcript: "the cat", isFinal: true },
    ],
    expectedIndex: 2,
    note: "Cat page tracks The cat, then waits on sat.",
  },
  {
    id: "cat-chirp-dumps-first-line",
    sample: "cat",
    startIndex: 0,
    stream: [{ transcript: "the cat sat on a mat", isFinal: true }],
    expectedIndex: 2,
    note: "Dump of the cat line stops after the first content word.",
  },
  {
    id: "frog-a-frog",
    sample: "frog",
    startIndex: 0,
    stream: [{ transcript: "frog", isFinal: true }],
    expectedIndex: 2,
    note: "Skip A, match frog, wait on can.",
  },
  {
    id: "frog-dump-second-line-from-start",
    sample: "frog",
    startIndex: 0,
    stream: [{ transcript: "the frog sat on a log", isFinal: true }],
    expectedIndex: 2,
    note: "A later line dump still only consumes the first burst.",
  },
];
