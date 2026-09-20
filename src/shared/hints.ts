import { COPY } from "./copy.ts";
import { blendHint, firstSoundHint, underlineForLevel } from "./phoneme.ts";
import type { HintRequest, HintResponse, StallLevel } from "./types.ts";
import { assertNever } from "./types.ts";

function sentenceHint(word: string, lineText: string): string {
  const blanked = lineText.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), "_____");
  if (blanked !== lineText) {
    return `In this line it fits like this: ${blanked}`;
  }
  return `Here is a hint sentence: The kids all say ${word} together.`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function localHint(request: HintRequest): HintResponse {
  const level = request.stallLevel;
  const underline = underlineForLevel(request.word, level);
  switch (level) {
    case 1:
      return {
        level,
        spoken: COPY.tryThisWord,
        caption: COPY.tryThisWord,
        underline,
        revealWord: false,
        source: "local",
      };
    case 2: {
      const first = firstSoundHint(request.word);
      const blend = blendHint(request.word);
      const spoken = request.previousHints.some((hint) => hint.includes("/"))
        ? blend
        : first;
      return {
        level,
        spoken,
        caption: spoken,
        underline,
        revealWord: false,
        source: "local",
      };
    }
    case 3:
      return {
        level,
        spoken: sentenceHint(request.word, request.lineText),
        caption: "A little sentence can help.",
        underline,
        revealWord: false,
        source: "local",
      };
    case 4:
      return {
        level,
        spoken: `The word is ${request.word}. ${COPY.nowYouSay}`,
        caption: COPY.sayWithMe,
        underline,
        revealWord: true,
        source: "local",
      };
    default:
      return assertNever(level);
  }
}

export function hintFromLevel(
  word: string,
  lineText: string,
  stallLevel: Exclude<StallLevel, 0>,
  lastAttempt: string | null,
  previousHints: string[],
): HintResponse {
  return localHint({ word, lineText, stallLevel, lastAttempt, previousHints });
}
