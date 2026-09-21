/** Diagnostics only — never log audio bytes or transcript text. */
export function logStt(event: string, details: Record<string, number | string | boolean | undefined> = {}): void {
  console.info("[read-with-me:stt]", { event, ...details });
}
