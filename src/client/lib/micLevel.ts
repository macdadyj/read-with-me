export type MicVisualState = "idle" | "quiet" | "hearing" | "paused" | "error" | "permission-denied";

/** Time-domain RMS on [-1, 1] above this counts as "hearing sound". */
export const HEARING_RMS_THRESHOLD = 0.03;

export function rmsFromFloat32(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

/** AnalyserNode `getByteTimeDomainData` — 128 is silence. */
export function rmsFromByteTimeDomain(bytes: ArrayLike<number>): number {
  if (bytes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const centered = ((bytes[i] ?? 128) - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / bytes.length);
}

export function classifyListeningLevel(rms: number): "quiet" | "hearing" {
  return rms >= HEARING_RMS_THRESHOLD ? "hearing" : "quiet";
}

export function classifyMicVisualState(options: {
  transport: "idle" | "listening" | "paused" | "error" | "permission-denied";
  rms: number;
}): MicVisualState {
  switch (options.transport) {
    case "idle":
      return "idle";
    case "paused":
      return "paused";
    case "error":
      return "error";
    case "permission-denied":
      return "permission-denied";
    case "listening":
      return classifyListeningLevel(options.rms);
    default: {
      const _never: never = options.transport;
      return _never;
    }
  }
}

export function meterFill(rms: number): number {
  return Math.max(0, Math.min(1, rms * 8));
}
