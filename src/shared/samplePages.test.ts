import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toReadingWords } from "./aligner.ts";
import { trackLiveSpeech } from "./listenTracker.ts";
import { isSamplePageId, SAMPLE_PAGES, samplePageById } from "./samplePages.ts";
import type { OcrResult } from "./types.ts";

function loadPage(id: string): OcrResult {
  const page = samplePageById(id);
  const file = path.resolve("public/fixtures", page.ocrFile);
  return JSON.parse(readFileSync(file, "utf8")) as OcrResult;
}

describe("practice pages", () => {
  it("lists a few pages a parent can open on the site", () => {
    expect(SAMPLE_PAGES.map((page) => page.id)).toEqual(["puppy", "cat", "frog", "bus"]);
    expect(isSamplePageId("cat")).toBe(true);
    expect(isSamplePageId("../workbook")).toBe(false);
  });

  it.each(SAMPLE_PAGES)("$id advances one spoken word at a time", (page) => {
    const words = toReadingWords(loadPage(page.id).words);
    expect(words.length).toBeGreaterThan(4);
    const frames = words.map((word) => ({ transcript: word.text, isFinal: true }));
    const live = trackLiveSpeech(words, frames);
    expect(live.currentIndex).toBe(words.length);
  });

  it.each(SAMPLE_PAGES)("$id finishes the first line from one continuous phrase and does not skip ahead", (page) => {
    const words = toReadingWords(loadPage(page.id).words);
    const firstLine = words.filter((word) => word.lineIndex === words[0]?.lineIndex);
    const live = trackLiveSpeech(words, [{ transcript: firstLine.map((word) => word.normalized).join(" "), isFinal: true }]);
    expect(live.currentIndex).toBe(firstLine.length);
    const later = words[firstLine.length + 1];
    if (later) {
      const skipped = trackLiveSpeech(words, [{ transcript: later.normalized, isFinal: true }]);
      expect(skipped.currentIndex).toBeLessThan(firstLine.length);
    }
  });
});
