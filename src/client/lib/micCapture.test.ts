import { describe, expect, it } from "vitest";
import { STT_FLUSH_BYTES, STT_SAMPLE_RATE, audioChunkToRequest } from "@shared/sttProtocol";
import { createCapturePipeline, encodeCaptureFrame, feedCaptureToRecognizer, sineWave } from "./micCapture.ts";
import { downsampleTo16k, floatTo16BitPcm } from "./pcm.ts";

describe("PCM encode", () => {
  it("downsamples 48 kHz to 16 kHz and writes PCM16 frames", () => {
    const input = sineWave({ seconds: 0.1, sampleRate: 48000, amplitude: 0.5 });
    const encoded = encodeCaptureFrame(input, 48000);
    expect(encoded.sampleCount).toBe(1600);
    expect(encoded.pcm.byteLength).toBe(3200);
    expect(encoded.rms).toBeGreaterThan(0.2);

    const view = new Int16Array(encoded.pcm);
    const peak = Math.max(...view.map((sample) => Math.abs(sample)));
    expect(peak).toBeGreaterThan(1000);
  });

  it("keeps 16 kHz buffers at the same length", () => {
    const input = sineWave({ seconds: 0.05, sampleRate: STT_SAMPLE_RATE });
    expect(downsampleTo16k(input, STT_SAMPLE_RATE)).toBe(input);
    expect(floatTo16BitPcm(input).byteLength).toBe(input.length * 2);
  });
});

describe("capture → encode → STT client", () => {
  it("feeds a synthetic 48 kHz buffer through the listen path and the STT client receives LINEAR16 chunks", () => {
    const samples = sineWave({ seconds: 0.25, sampleRate: 48000, frequency: 220, amplitude: 0.4 });
    const writes: Array<{ audio: Uint8Array }> = [];

    const stats = feedCaptureToRecognizer(samples, 48000, (request) => {
      writes.push(request);
    });

    expect(stats.framesIn).toBeGreaterThan(0);
    expect(stats.framesSent).toBeGreaterThan(0);
    expect(stats.bytesSent).toBeGreaterThanOrEqual(STT_FLUSH_BYTES);
    expect(stats.outputSampleRate).toBe(16000);
    expect(writes.length).toBe(stats.framesSent);

    for (const request of writes) {
      expect(request.audio.byteLength).toBeGreaterThan(0);
      expect(request.audio.byteLength % 2).toBe(0);
      expect(request.audio.byteLength).toBeLessThanOrEqual(25 * 1024);
    }

    const totalAudio = writes.reduce((sum, request) => sum + request.audio.byteLength, 0);
    expect(totalAudio).toBe(stats.bytesSent);

    const first = new Int16Array(
      writes[0]!.audio.buffer,
      writes[0]!.audio.byteOffset,
      writes[0]!.audio.byteLength / 2,
    );
    expect(Math.max(...first.map((sample) => Math.abs(sample)))).toBeGreaterThan(500);
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
    const flushed = pipeline.flush();
    expect(flushed.sent).toBe(true);
    expect(pipeline.stats().framesSent).toBe(1);
    expect(incoming[0]!.byteLength).toBe(8);
    expect(audioChunkToRequest(incoming[0]!).audio.byteLength).toBe(8);
  });
});
