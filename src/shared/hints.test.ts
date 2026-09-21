import { describe, expect, it } from "vitest";
import { localHint } from "./hints.ts";
import { firstSoundHint } from "./phoneme.ts";

describe("local pedagogue", () => {
  it("does not reveal the word on early stall levels", () => {
    const first = localHint({
      word: "ran",
      lineText: "The puppy ran down the hill.",
      lastAttempt: null,
      stallLevel: 1,
      previousHints: [],
    });
    expect(first.revealWord).toBe(false);
    expect(first.spoken.toLowerCase()).not.toContain("the word is ran");

    const sound = localHint({
      word: "ran",
      lineText: "The puppy ran down the hill.",
      lastAttempt: null,
      stallLevel: 2,
      previousHints: [],
    });
    expect(sound.spoken).toContain("/r/");
    expect(firstSoundHint("because")).toMatch(/\/b\//);
  });

  it("says the word only at level 4", () => {
    const hint = localHint({
      word: "ran",
      lineText: "The puppy ran down the hill.",
      lastAttempt: "run",
      stallLevel: 4,
      previousHints: [],
    });
    expect(hint.revealWord).toBe(true);
    expect(hint.spoken.toLowerCase()).toContain("ran");
  });
});
