import { rmsFromFloat32 } from "./micLevel.ts";

export const VOLUME_QUIET = 0.02;
export const VOLUME_NORMAL = 0.32;
export const VOLUME_LOUD = 0.92;

export function toneSamples(options: {
  seconds: number;
  sampleRate: number;
  frequency?: number;
  amplitude?: number;
  startOffset?: number;
}): Float32Array {
  const frequency = options.frequency ?? 220;
  const amplitude = options.amplitude ?? VOLUME_NORMAL;
  const startOffset = options.startOffset ?? 0;
  const length = Math.round(options.seconds * options.sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * frequency * (i + startOffset)) / options.sampleRate) * amplitude;
  }
  return samples;
}

export function whiteNoise(options: { seconds: number; sampleRate: number; amplitude?: number }): Float32Array {
  const amplitude = options.amplitude ?? 0.05;
  const length = Math.round(options.seconds * options.sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return samples;
}

export function mixSignals(...signals: Float32Array[]): Float32Array {
  const length = Math.max(0, ...signals.map((signal) => signal.length));
  const mixed = new Float32Array(length);
  for (const signal of signals) {
    for (let i = 0; i < signal.length; i += 1) {
      mixed[i] = Math.max(-1, Math.min(1, (mixed[i] ?? 0) + (signal[i] ?? 0)));
    }
  }
  return mixed;
}

export function withSilenceGaps(
  speech: Float32Array,
  options: { sampleRate: number; gapMs: number; gaps?: number },
): Float32Array {
  const gap = Math.round((options.gapMs / 1000) * options.sampleRate);
  const parts = options.gaps ?? 2;
  const chunk = Math.floor(speech.length / (parts + 1));
  const out: number[] = [];
  let offset = 0;
  for (let i = 0; i <= parts; i += 1) {
    const end = i === parts ? speech.length : offset + chunk;
    for (let j = offset; j < end; j += 1) out.push(speech[j] ?? 0);
    if (i < parts) {
      for (let j = 0; j < gap; j += 1) out.push(0);
    }
    offset = end;
  }
  return Float32Array.from(out);
}

export function classifyRmsBand(rms: number): "quiet" | "normal" | "loud" {
  if (rms < 0.06) return "quiet";
  if (rms > 0.55) return "loud";
  return "normal";
}

export function fixtureRms(samples: Float32Array): number {
  return rmsFromFloat32(samples);
}
