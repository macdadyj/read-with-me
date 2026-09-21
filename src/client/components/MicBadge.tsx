import { COPY } from "@shared/copy";
import { meterFill, type MicVisualState } from "../lib/micLevel.ts";

const LABEL: Record<MicVisualState, string> = {
  idle: COPY.micIdle,
  quiet: COPY.micQuiet,
  hearing: COPY.micHearing,
  paused: COPY.micPaused,
  error: COPY.micError,
  "permission-denied": COPY.micDenied,
};

const ARIA: Record<MicVisualState, string> = {
  idle: "Microphone is idle",
  quiet: "Listening, but it is quiet",
  hearing: "Hearing sound from the microphone",
  paused: "Microphone is paused",
  error: "Microphone error. You can type a word instead.",
  "permission-denied": "Microphone permission denied. You can type a word instead.",
};

const BAR_WEIGHTS = [0.35, 0.55, 0.95, 0.7, 0.45];

type Props = {
  state: MicVisualState;
  rms?: number;
  reducedMotion?: boolean;
};

export function MicBadge({ state, rms = 0, reducedMotion = false }: Props) {
  const fill = state === "hearing" || state === "quiet" ? meterFill(rms) : state === "paused" ? 0.08 : 0;
  const listening = state === "quiet" || state === "hearing";

  return (
    <div
      className={`mic-badge mic-badge--${state}`}
      role="status"
      aria-live="polite"
      aria-label={ARIA[state]}
    >
      <span className="mic-dot" aria-hidden="true" />
      <span className="mic-badge__label">{LABEL[state]}</span>
      <div
        className={`mic-meter${reducedMotion ? " mic-meter--still" : ""}`}
        role="meter"
        aria-label="Microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        aria-valuetext={ARIA[state]}
      >
        {BAR_WEIGHTS.map((weight, index) => {
          const height = listening ? Math.max(0.18, fill * weight) : 0.16;
          return (
            <span
              key={index}
              className="mic-meter__bar"
              style={{ height: `${Math.round(height * 100)}%` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}
