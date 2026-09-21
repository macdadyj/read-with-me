export type DemoStep =
  | { kind: "speak"; text: string }
  | { kind: "say"; word: string }
  | { kind: "wait"; ms: number }
  | { kind: "note"; text: string };

/** Photo → start → stall on the third word (ran) → hint ladder → advance. */
export const DEMO_STEPS: DemoStep[] = [
  { kind: "speak", text: "Let's start at the top." },
  { kind: "wait", ms: 700 },
  { kind: "say", word: "the" },
  { kind: "wait", ms: 650 },
  { kind: "say", word: "puppy" },
  { kind: "note", text: "Now we wait on “ran” so the stall ladder can help." },
  { kind: "wait", ms: 18500 },
  { kind: "say", word: "ran" },
];

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
