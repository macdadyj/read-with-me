import { describe, expect, it } from "vitest";
import { STT_FLUSH_BYTES, STT_SAMPLE_RATE, audioChunkToRequest } from "@shared/sttProtocol";
import {
  fixtureRms,
  mixSignals,
  toneSamples,
  VOLUME_LOUD,
  VOLUME_NORMAL,
  VOLUME_QUIET,
  whiteNoise,
  withSilenceGaps,
  classifyRmsBand,
} from "./audioFixtures.ts";
import {
  boostQuietSpeech,
  createCapturePipeline,
  encodeCaptureFrame,
  feedCaptureToRecognizer,
  PCM_WORKLET_SOURCE,
  QUIET_SPEECH_MAX_RMS,
} from "./micCapture.ts";

function peakPcm(buffer: ArrayBuffer | Uint8Array): number {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  return Math.max(...view.map((sample) => Math.abs(sample)));
}

describe("volume → encode → STT writes", () => {
  it.each([
    ["quiet", VOLUME_QUIET, "quiet"],
    ["normal", VOLUME_NORMAL, "normal"],
    ["loud", VOLUME_LOUD, "loud"],
  ] as const)("%s RMS still produces LINEAR16 frames for Chirp", (_name, amplitude, band) => {
    const samples = toneSamples({ seconds: 0.25, sampleRate: 48000, amplitude });
    expect(classifyRmsBand(fixtureRms(samples))).toBe(band);

    const writes: Array<{ audio: Uint8Array }> = [];
    const stats = feedCaptureToRecognizer(samples, 48000, (request) => writes.push(request));

    expect(stats.framesIn).toBeGreaterThan(0);
    expect(stats.framesSent).toBeGreaterThan(0);
    expect(stats.bytesSent).toBeGreaterThanOrEqual(STT_FLUSH_BYTES);
    expect(writes.length).toBe(stats.framesSent);
    expect(peakPcm(writes[0]!.audio)).toBeGreaterThan(amplitude < 0.05 ? 800 : 2000);
  });

  it("boosts quiet speech into a Chirp-friendly band without clipping loud speech", () => {
    const quiet = toneSamples({ seconds: 0.05, sampleRate: STT_SAMPLE_RATE, amplitude: VOLUME_QUIET });
    const boosted = boostQuietSpeech(quiet);
    expect(fixtureRms(boosted)).toBeGreaterThan(QUIET_SPEECH_MAX_RMS);
    expect(fixtureRms(boosted)).toBeLessThan(0.4);

    const loud = toneSamples({ seconds: 0.05, sampleRate: STT_SAMPLE_RATE, amplitude: VOLUME_LOUD });
    expect(boostQuietSpeech(loud)).toBe(loud);
    const encoded = encodeCaptureFrame(loud, STT_SAMPLE_RATE);
    expect(peakPcm(encoded.pcm)).toBeGreaterThan(20000);
    expect(peakPcm(encoded.pcm)).toBeLessThanOrEqual(0x7fff);
  });
});

describe("noise, pauses, and overlapping speech on the wire", () => {
  it("sends speech sitting on a noise floor (does not drop the frame)", () => {
    const speech = toneSamples({ seconds: 0.2, sampleRate: 48000, amplitude: VOLUME_NORMAL, frequency: 180 });
    const noise = whiteNoise({ seconds: 0.2, sampleRate: 48000, amplitude: 0.06 });
    const mixed = mixSignals(speech, noise);
    expect(fixtureRms(mixed)).toBeGreaterThan(fixtureRms(noise));

    const writes: Array<{ audio: Uint8Array }> = [];
    const stats = feedCaptureToRecognizer(mixed, 48000, (request) => writes.push(request));
    expect(stats.framesSent).toBeGreaterThan(0);
    expect(writes.reduce((sum, request) => sum + request.audio.byteLength, 0)).toBe(stats.bytesSent);
  });

  it("keeps sending through long mid-utterance gaps so Chirp can endpoint", () => {
    const speech = toneSamples({ seconds: 0.3, sampleRate: STT_SAMPLE_RATE, amplitude: VOLUME_NORMAL });
    const paused = withSilenceGaps(speech, { sampleRate: STT_SAMPLE_RATE, gapMs: 450, gaps: 2 });
    expect(paused.length).toBeGreaterThan(speech.length);

    const writes: Array<{ audio: Uint8Array }> = [];
    feedCaptureToRecognizer(paused, STT_SAMPLE_RATE, (request) => writes.push(request));
    const totalSamples = writes.reduce((sum, request) => sum + request.audio.byteLength / 2, 0);
    expect(totalSamples).toBeGreaterThan(paused.length * 0.9);
  });

  it("encodes overlapping / doubled speech as a single mixed PCM stream", () => {
    const child = toneSamples({ seconds: 0.2, sampleRate: STT_SAMPLE_RATE, frequency: 220, amplitude: 0.28 });
    const parent = toneSamples({ seconds: 0.2, sampleRate: STT_SAMPLE_RATE, frequency: 330, amplitude: 0.28 });
    const overlapped = mixSignals(child, parent);
    const writes: Array<{ audio: Uint8Array }> = [];
    const stats = feedCaptureToRecognizer(overlapped, STT_SAMPLE_RATE, (request) => writes.push(request));
    expect(stats.framesSent).toBeGreaterThan(0);
    expect(peakPcm(writes[0]!.audio)).toBeGreaterThan(1000);
  });
});

describe("AudioWorklet frames reach STT (no silent path)", () => {
  it("posts worklet-sized 128-sample quanta all the way to the recognize writer", () => {
    expect(PCM_WORKLET_SOURCE).toContain("AudioWorkletProcessor");
    expect(PCM_WORKLET_SOURCE).toContain("postMessage");
    expect(PCM_WORKLET_SOURCE).toContain("registerProcessor");

    const samples = toneSamples({ seconds: 0.2, sampleRate: 48000, amplitude: VOLUME_NORMAL });
    const writes: Array<{ audio: Uint8Array }> = [];
    const stats = feedCaptureToRecognizer(samples, 48000, (request) => writes.push(request), {
      quantum: 128,
    });

    expect(stats.framesIn).toBe(Math.ceil(samples.length / 128));
    expect(writes.length).toBeGreaterThan(0);
    for (const request of writes) {
      const wrapped = audioChunkToRequest(request.audio);
      expect(wrapped.audio.byteLength % 2).toBe(0);
      expect(wrapped.audio.byteLength).toBeLessThanOrEqual(25 * 1024);
    }
  });

  it("does not send until the sink is ready, then delivers queued PCM after flush", () => {
    const incoming: ArrayBuffer[] = [];
    let open = false;
    const pipeline = createCapturePipeline({
      inputSampleRate: 16000,
      flushSamples: 4,
      sink: {
        send(chunk) {
          if (!open) return false;
          incoming.push(chunk);
          return true;
        },
      },
    });

    pipeline.push(new Float32Array([0.2, -0.2, 0.2, -0.2]));
    expect(pipeline.stats().framesSent).toBe(0);

    open = true;
    expect(pipeline.flush().sent).toBe(true);
    expect(incoming[0]!.byteLength).toBe(8);
  });
});
