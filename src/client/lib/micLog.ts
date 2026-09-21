/** Diagnostics only — never pass samples, transcripts, or other child content. */
export function logMic(event: string, details: Record<string, number | string | boolean | undefined> = {}): void {
  console.info("[read-with-me:mic]", { event, ...details });
}
