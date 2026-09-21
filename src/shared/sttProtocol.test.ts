import { describe, expect, it } from "vitest";
import {
  audioChunkToRequest,
  chirpStreamingConfig,
  liveSpeechPath,
  openSpeechStream,
  speechApiEndpoint,
} from "./sttProtocol.ts";

describe("STT protocol", () => {
  it("points Chirp 3 at the regional Speech-to-Text v2 endpoint", () => {
    expect(speechApiEndpoint("us")).toBe("us-speech.googleapis.com");
  });

  it("wraps PCM bytes for StreamingRecognizeRequest (not base64 text)", () => {
    const pcm = new Uint8Array([0, 1, 2, 3]);
    const request = audioChunkToRequest(pcm.buffer);
    expect(request.audio).toBeInstanceOf(Uint8Array);
    expect(Array.from(request.audio)).toEqual([0, 1, 2, 3]);
    expect(JSON.stringify(request).includes("AAECAw")).toBe(false);
  });

  it("keeps the live path on Chirp 3 and never chooses a silent mock when ready", () => {
    const config = chirpStreamingConfig();
    expect(config.config.model).toBe("chirp_3");
    expect(config.streamingFeatures.interimResults).toBe(true);
    expect(liveSpeechPath(true, true)).toBe("recognize");
    expect(liveSpeechPath(true, false)).toBe("mock");
  });

  it("opens the v2 stream via _streamingRecognize (the public method on SpeechClient)", () => {
    const calls: unknown[] = [];
    const stream = { kind: "stream" };
    const client = {
      _streamingRecognize: () => {
        calls.push("underscore");
        return stream;
      },
      streamingRecognize: () => {
        calls.push("public");
        return { kind: "wrong" };
      },
    };
    expect(openSpeechStream(client)).toBe(stream);
    expect(calls).toEqual(["underscore"]);
  });
});
