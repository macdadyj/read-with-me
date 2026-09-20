import type { PaceMode, StallLevel } from "./types.ts";
import { assertNever } from "./types.ts";

/** Hint 1 / 2 / 3 / say-the-word, in milliseconds of silence on the current word. */
export const STALL_MS: Record<PaceMode, readonly [number, number, number, number]> = {
  gentle: [4_000, 8_000, 12_000, 16_000],
  "keep-moving": [2_000, 4_000, 6_000, 8_000],
};

export function stallLevelForElapsed(elapsedMs: number, pace: PaceMode): StallLevel {
  const [h1, h2, h3, h4] = STALL_MS[pace];
  if (elapsedMs >= h4) return 4;
  if (elapsedMs >= h3) return 3;
  if (elapsedMs >= h2) return 2;
  if (elapsedMs >= h1) return 1;
  return 0;
}

export function isHintLevel(level: StallLevel): level is Exclude<StallLevel, 0> {
  return level !== 0;
}

export function nextStallLevel(level: StallLevel): Exclude<StallLevel, 0> {
  switch (level) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
    case 4:
      return 4;
    default:
      return assertNever(level);
  }
}

export function failedAttemptsToLevel(failedAttempts: number): StallLevel {
  if (failedAttempts >= 3) return 4;
  if (failedAttempts >= 2) return 3;
  if (failedAttempts >= 1) return 2;
  return 0;
}

export function escalateStall(current: StallLevel, failedAttempts: number): StallLevel {
  const fromFails = failedAttemptsToLevel(failedAttempts);
  return (Math.max(current, fromFails) as StallLevel);
}
