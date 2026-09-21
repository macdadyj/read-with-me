import { STT_FLUSH_SAMPLES, STT_SAMPLE_RATE, audioChunkToRequest } from "@shared/sttProtocol";

/** Kid voices are quiet; browser noise suppression often eats "the" / "puppy". */
export const MIC_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: STT_SAMPLE_RATE,
};
import { rmsFromFloat32 } from "./micLevel.ts";
import { downsampleTo16k, floatTo16BitPcm } from "./pcm.ts";

/** Quiet kid speech sits above the noise floor but below a comfortable Chirp level. */
export const QUIET_SPEECH_MIN_RMS = 0.006;
export const QUIET_SPEECH_MAX_RMS = 0.07;
export const QUIET_TARGET_RMS = 0.22;
export const QUIET_BOOST_MAX = 8;

export function boostQuietSpeech(samples: Float32Array, rms = rmsFromFloat32(samples)): Float32Array {
  if (rms < QUIET_SPEECH_MIN_RMS || rms > QUIET_SPEECH_MAX_RMS) return samples;
  const gain = Math.min(QUIET_TARGET_RMS / rms, QUIET_BOOST_MAX);
  const boosted = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    boosted[i] = Math.max(-1, Math.min(1, (samples[i] ?? 0) * gain));
  }
  return boosted;
}

export type FrameSink = {
  send: (chunk: ArrayBuffer) => boolean;
};

export type CaptureStats = {
  framesIn: number;
  framesSent: number;
  bytesSent: number;
  lastRms: number;
  inputSampleRate: number;
  outputSampleRate: number;
};

export type EncodedFrame = {
  pcm: ArrayBuffer;
  rms: number;
  sampleCount: number;
};

export const PCM_WORKLET_NAME = "pcm-processor";

export const PCM_WORKLET_SOURCE = `class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor("${PCM_WORKLET_NAME}", PcmProcessor);
`;

export function encodeCaptureFrame(samples: Float32Array, inputSampleRate: number): EncodedFrame {
  const rms = rmsFromFloat32(samples);
  const pcm = floatTo16BitPcm(downsampleTo16k(boostQuietSpeech(samples, rms), inputSampleRate));
  return { pcm, rms, sampleCount: pcm.byteLength / 2 };
}

export function createCapturePipeline(options: {
  inputSampleRate: number;
  sink: FrameSink;
  flushSamples?: number;
}): {
  push: (samples: Float32Array) => { sent: boolean; bytes: number; rms: number };
  flush: () => { sent: boolean; bytes: number };
  stats: () => CaptureStats;
} {
  const flushSamples = options.flushSamples ?? STT_FLUSH_SAMPLES;
  const stats: CaptureStats = {
    framesIn: 0,
    framesSent: 0,
    bytesSent: 0,
    lastRms: 0,
    inputSampleRate: options.inputSampleRate,
    outputSampleRate: STT_SAMPLE_RATE,
  };
  let pending = new Float32Array(0);

  function sendPcm(pcm: ArrayBuffer): boolean {
    const sent = options.sink.send(pcm);
    if (sent) {
      stats.framesSent += 1;
      stats.bytesSent += pcm.byteLength;
    }
    return sent;
  }

  function drain(force: boolean): { sent: boolean; bytes: number } {
    let sentAny = false;
    let bytes = 0;
    while (pending.length >= flushSamples || (force && pending.length > 0)) {
      const take = force && pending.length < flushSamples ? pending.length : flushSamples;
      if (take <= 0) break;
      const slice = pending.subarray(0, take);
      const pcm = floatTo16BitPcm(slice);
      const sent = sendPcm(pcm);
      if (!sent) break;
      pending = pending.subarray(take).slice();
      sentAny = true;
      bytes += pcm.byteLength;
      if (!force && pending.length < flushSamples) break;
    }
    return { sent: sentAny, bytes };
  }

  return {
    push(samples: Float32Array) {
      stats.framesIn += 1;
      stats.lastRms = rmsFromFloat32(samples);
      const boosted = boostQuietSpeech(samples, stats.lastRms);
      const down = downsampleTo16k(boosted, options.inputSampleRate);
      const merged = new Float32Array(pending.length + down.length);
      merged.set(pending);
      merged.set(down, pending.length);
      pending = merged;
      const drained = drain(false);
      return { sent: drained.sent, bytes: drained.bytes, rms: stats.lastRms };
    },
    flush() {
      return drain(true);
    },
    stats() {
      return { ...stats };
    },
  };
}

/** Client → mock/real STT: encode a fixture buffer and deliver Recognize audio requests. */
export function feedCaptureToRecognizer(
  samples: Float32Array,
  inputSampleRate: number,
  write: (request: { audio: Uint8Array }) => void,
  options?: { quantum?: number; flushSamples?: number },
): CaptureStats {
  const quantum = options?.quantum ?? 128;
  const received: ArrayBuffer[] = [];
  const pipeline = createCapturePipeline({
    inputSampleRate,
    flushSamples: options?.flushSamples,
    sink: {
      send(chunk) {
        received.push(chunk);
        return true;
      },
    },
  });

  for (let offset = 0; offset < samples.length; offset += quantum) {
    pipeline.push(samples.subarray(offset, Math.min(offset + quantum, samples.length)));
  }
  pipeline.flush();

  for (const chunk of received) {
    write(audioChunkToRequest(chunk));
  }
  return pipeline.stats();
}

export function sineWave(options: {
  seconds: number;
  sampleRate: number;
  frequency?: number;
  amplitude?: number;
}): Float32Array {
  const frequency = options.frequency ?? 440;
  const amplitude = options.amplitude ?? 0.35;
  const length = Math.round(options.seconds * options.sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / options.sampleRate) * amplitude;
  }
  return samples;
}
