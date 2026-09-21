import type { MicState } from "../hooks/useMicStream.ts";

const LABEL: Record<MicState, string> = {
  idle: "Mic ready",
  listening: "Listening",
  paused: "Paused",
  error: "Type a word",
};

export function MicBadge({ state }: { state: MicState }) {
  return (
    <div className={`mic-badge mic-badge--${state}`} aria-live="polite">
      <span className="mic-dot" aria-hidden="true" />
      {LABEL[state]}
    </div>
  );
}
