import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCleanupMap, markSkippableWords } from "../../shared/cleanup.ts";
import { normalizeToken } from "../../shared/normalize.ts";
import type { BoundingBox, OcrResult, OcrWord } from "../../shared/types.ts";
import { env } from "../env.ts";
import { getClients } from "./clients.ts";
import { cleanupOcrWithGemini } from "./gemini.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

function fixtureDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "public/fixtures"),
    path.resolve(here, "../../../public/fixtures"),
    path.resolve(here, "../../public/fixtures"),
  ];
  return candidates[0] ?? path.resolve(process.cwd(), "public/fixtures");
}

export async function loadFixtureOcr(): Promise<OcrResult> {
  const jsonPath = path.join(fixtureDir(), "workbook.ocr.json");
  const raw = await readFile(jsonPath, "utf8");
  return JSON.parse(raw) as OcrResult;
}

function verticesToBox(
  vertices: Array<{ x?: number | null; y?: number | null }> | null | undefined,
  width: number,
  height: number,
): BoundingBox {
  const xs = (vertices ?? []).map((v) => v.x ?? 0);
  const ys = (vertices ?? []).map((v) => v.y ?? 0);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  const maxX = Math.max(...xs, 0);
  const maxY = Math.max(...ys, 0);
  return {
    x: minX / width,
    y: minY / height,
    width: Math.max(maxX - minX, 1) / width,
    height: Math.max(maxY - minY, 1) / height,
  };
}

function visionToResult(
  fullText: string,
  pages: Array<{
    width?: number | null;
    height?: number | null;
    blocks?: Array<{
      paragraphs?: Array<{
        words?: Array<{
          symbols?: Array<{ text?: string | null; property?: { detectedBreak?: { type?: string | number | null } } | null }>;
          boundingBox?: { vertices?: Array<{ x?: number | null; y?: number | null }> | null };
        }>;
      }>;
    }>;
  }>,
): OcrResult {
  const page = pages[0];
  const width = page?.width ?? 1;
  const height = page?.height ?? 1;
  const words: OcrWord[] = [];
  const lineTexts: string[] = [];
  let lineIndex = 0;
  let lineWords: string[] = [];
  let id = 0;

  for (const block of page?.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const word of paragraph.words ?? []) {
        const text = (word.symbols ?? []).map((symbol) => symbol.text ?? "").join("");
        if (!text.trim()) continue;
        const breakType = word.symbols?.at(-1)?.property?.detectedBreak?.type;
        const isLineBreak = String(breakType).includes("LINE_BREAK") || breakType === 3 || breakType === 5;
        words.push({
          id: `ocr-${id}`,
          text: text.replace(/[.,!?;:]+$/g, "") || text,
          display: text,
          normalized: normalizeToken(text),
          lineIndex,
          box: verticesToBox(word.boundingBox?.vertices, width, height),
        });
        lineWords.push(text);
        id += 1;
        if (isLineBreak) {
          lineTexts.push(lineWords.join(" "));
          lineWords = [];
          lineIndex += 1;
        }
      }
    }
  }
  if (lineWords.length) lineTexts.push(lineWords.join(" "));

  if (!words.length && fullText.trim()) {
    fullText.split(/\s+/).forEach((token, index) => {
      words.push({
        id: `ocr-${index}`,
        text: token.replace(/[.,!?;:]+$/g, "") || token,
        display: token,
        normalized: normalizeToken(token),
        lineIndex: 0,
        box: { x: 0.08 + index * 0.08, y: 0.4, width: 0.07, height: 0.05 },
      });
    });
    lineTexts.push(fullText);
  }

  return {
    source: "vision",
    imageWidth: width,
    imageHeight: height,
    lines: lineTexts.map((text, index) => ({ index, text })),
    words,
  };
}

export async function ocrImage(buffer: Buffer): Promise<OcrResult> {
  const clients = getClients();
  if (!clients.vision) {
    const fixture = await loadFixtureOcr();
    return {
      ...fixture,
      source: "mock",
      warning: "GCP credentials were not available, so the sample page text is shown.",
    };
  }

  try {
    const [response] = await clients.vision.documentTextDetection({
      image: { content: buffer },
    });
    const annotation = response.fullTextAnnotation;
    if (!annotation?.pages?.length) {
      return {
        source: "vision",
        lines: [],
        words: [],
        warning: "I couldn't find words in that photo. Let's try a flatter, brighter picture.",
      };
    }
    let result = markSkippableWords(
      visionToResult(annotation.text ?? "", annotation.pages as Parameters<typeof visionToResult>[1]),
    );
    const cleaned = await cleanupOcrWithGemini(result);
    if (cleaned) result = applyCleanupMap(result, cleaned);
    return result;
  } catch (error) {
    console.warn("Vision OCR failed; falling back to fixture.", error);
    const fixture = await loadFixtureOcr();
    return {
      ...fixture,
      source: "mock",
      warning: "Vision could not read that photo, so the sample page is ready instead.",
    };
  }
}

export function documentAiNote(): string {
  return env.documentAiProcessor
    ? `Document AI processor ${env.documentAiProcessor} can be wired when layout is messy.`
    : "Vision DOCUMENT_TEXT_DETECTION is the default. Set DOCUMENT_AI_PROCESSOR to prefer Document AI.";
}
