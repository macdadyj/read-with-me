export type PaceMode = "gentle" | "keep-moving";

export type StallLevel = 0 | 1 | 2 | 3 | 4;

export type OcrSource = "vision" | "documentai" | "fixture" | "mock";

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrWord = {
  id: string;
  text: string;
  display?: string;
  normalized: string;
  lineIndex: number;
  box: BoundingBox;
  skip?: boolean;
};

export type OcrLine = {
  index: number;
  text: string;
};

export type OcrResult = {
  source: OcrSource;
  imageWidth?: number;
  imageHeight?: number;
  imageUrl?: string;
  lines: OcrLine[];
  words: OcrWord[];
  warning?: string;
  cleaned?: boolean;
};

export type ReadingWord = OcrWord & { readingIndex: number };

export type AlignerEvent =
  | { type: "advance"; toIndex: number; via: "match" | "skip-function" | "snap-forward" | "coach-release" }
  | { type: "repeat-previous" }
  | { type: "mismatch"; spoken: string; expected: string };

export type AlignerResult = {
  currentIndex: number;
  events: AlignerEvent[];
  matched: boolean;
  failed: boolean;
};

export type HintRequest = {
  word: string;
  lineText: string;
  lastAttempt: string | null;
  stallLevel: Exclude<StallLevel, 0>;
  previousHints: string[];
};

export type HintResponse = {
  level: Exclude<StallLevel, 0>;
  spoken: string;
  caption: string;
  underline: string;
  revealWord: boolean;
  source: "gemini" | "local";
};

export type AppConfig = {
  gcpReady: boolean;
  mockMode: boolean;
  project: string;
  location: string;
  saveSession: boolean;
  bucket?: string;
};

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}
