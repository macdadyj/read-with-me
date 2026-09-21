import type { OcrResult } from "./types.ts";

export type SamplePageId = "puppy" | "cat" | "frog";

export type SamplePageMeta = {
  id: SamplePageId;
  title: string;
  button: string;
  imageUrl: string;
  ocrUrl: string;
  lines: string[];
};

export const SAMPLE_PAGES: SamplePageMeta[] = [
  {
    id: "puppy",
    title: "The puppy page",
    button: "The puppy page",
    imageUrl: "/fixtures/workbook.png",
    ocrUrl: "/fixtures/workbook.ocr.json",
    lines: ["The puppy ran down the hill.", "Then he sat in the sun.", "He was a happy little dog."],
  },
  {
    id: "cat",
    title: "The cat page",
    button: "The cat page",
    imageUrl: "/fixtures/cat.png",
    ocrUrl: "/fixtures/cat.ocr.json",
    lines: ["The cat sat on a mat.", "Then the cat had a nap."],
  },
  {
    id: "frog",
    title: "The frog page",
    button: "The frog page",
    imageUrl: "/fixtures/frog.png",
    ocrUrl: "/fixtures/frog.ocr.json",
    lines: ["A frog can jump high.", "The frog sat on a log."],
  },
];

export function samplePageById(id: string | undefined): SamplePageMeta {
  return SAMPLE_PAGES.find((page) => page.id === id) ?? SAMPLE_PAGES[0]!;
}

export function readingWordsFromLines(lines: string[]): string[] {
  return lines.flatMap((line) =>
    line
      .split(/\s+/)
      .map((part) => part.replace(/[.,!?]+$/g, ""))
      .filter(Boolean),
  );
}

export function ocrFromSample(meta: SamplePageMeta): OcrResult {
  const words = [];
  let id = 0;
  for (const [lineIndex, line] of meta.lines.entries()) {
    for (const part of line.split(/\s+/)) {
      const bare = part.replace(/[.,!?]+$/g, "") || part;
      words.push({
        id: `${meta.id}-${id}`,
        text: bare,
        display: part,
        normalized: bare.toLowerCase(),
        lineIndex,
        box: { x: 0.1 + (id % 6) * 0.12, y: 0.3 + lineIndex * 0.12, width: 0.1, height: 0.06 },
      });
      id += 1;
    }
  }
  return {
    source: "fixture",
    imageUrl: meta.imageUrl,
    lines: meta.lines.map((text, index) => ({ index, text })),
    words,
  };
}
