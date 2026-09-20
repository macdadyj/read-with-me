import { localHint } from "../../shared/hints.ts";
import type { HintRequest, HintResponse, OcrResult } from "../../shared/types.ts";
import { env } from "../env.ts";
import { getClients } from "./clients.ts";

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function generateText(prompt: string): Promise<string | null> {
  const clients = getClients();
  if (!clients.vertex) return null;
  try {
    const model = clients.vertex.getGenerativeModel({
      model: env.geminiModel,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 256,
      },
    });
    const response = await model.generateContent(prompt);
    return response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (error) {
    console.warn("Gemini call failed; using local fallback.", error);
    return null;
  }
}

export async function cleanupOcrWithGemini(result: OcrResult): Promise<Record<string, string> | null> {
  const sample = result.words
    .filter((word) => !word.skip)
    .map((word) => word.text)
    .join(" ");
  if (!sample.trim()) return null;
  const text = await generateText(
    `This looks like a first-grade reader. Fix likely OCR errors without changing meaning.
Return JSON only: {"replacements": {"wrong": "right"}}.
If nothing needs fixing, return {"replacements": {}}.
Text: ${sample}`,
  );
  if (!text) return null;
  const parsed = extractJson(text) as { replacements?: Record<string, string> } | null;
  return parsed?.replacements ?? null;
}

export async function generateHint(request: HintRequest): Promise<HintResponse> {
  const fallback = localHint(request);
  const text = await generateText(
    `You are a warm reading coach for a child ages 5-8.
Target word: "${request.word}"
Line: "${request.lineText}"
Last attempt: ${request.lastAttempt ?? "none"}
Stall level: ${request.stallLevel} (1=try this word, 2=first sound then onset+vowel, 3=easy sentence hint without dumping the answer if possible, 4=say the word clearly and ask them to repeat)
Previous hints: ${request.previousHints.join(" | ") || "none"}

Rules: short, spoken-aloud friendly, no sarcasm, no shame, never say "wrong", one idea.
Do not show IPA or scary phonetic spelling.
Return JSON only:
{"spoken":"...","caption":"...","underline":"letters to underline","revealWord":false}`,
  );
  if (!text) return fallback;
  const parsed = extractJson(text) as {
    spoken?: string;
    caption?: string;
    underline?: string;
    revealWord?: boolean;
  } | null;
  if (!parsed?.spoken) return fallback;
  return {
    level: request.stallLevel,
    spoken: parsed.spoken,
    caption: parsed.caption ?? parsed.spoken,
    underline: parsed.underline ?? fallback.underline,
    revealWord: Boolean(parsed.revealWord) || request.stallLevel === 4,
    source: "gemini",
  };
}
