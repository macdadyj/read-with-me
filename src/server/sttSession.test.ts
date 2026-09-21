import { describe, expect, it } from "vitest";
import {
  CHIRP_ENDPOINTING,
  CHIRP_MODEL,
  STT_LANGUAGE,
  STT_SAMPLE_RATE,
  chirpStreamingConfig,
  classifySttSocketPayload,
  liveSpeechPath,
  parseSttControlMessage,
} from "../shared/sttProtocol.ts";
import { createSttAudioRouter, greetingForClients, initialSttMessage } from "./sttSession.ts";

describe("STT session routing (no silent mock when gcpReady)", () => {
  it("opens the recognize path only when GCP is ready and the Chirp client exists", () => {
    expect(liveSpeechPath(true, true)).toBe("recognize");
    expect(liveSpeechPath(true, false)).toBe("mock");
    expect(liveSpeechPath(false, true)).toBe("mock");
    expect(liveSpeechPath(false, false)).toBe("mock");
  });

  it("signals ready vs mock — never a third silent greeting", () => {
    expect(greetingForClients("s1", true, true)).toEqual({ type: "ready", sessionId: "s1" });
    expect(greetingForClients("s2", true, false).type).toBe("mock");
    expect(greetingForClients("s3", false, false).type).toBe("mock");
    expect(initialSttMessage("s4", "recognize").type).toBe("ready");
  });

  it("writes every PCM frame to Chirp on the live path", () => {
    const written: Buffer[] = [];
    const router = createSttAudioRouter({
      path: "recognize",
      writer: {
        write(request) {
          written.push(request.audio);
          return true;
        },
        end() {},
      },
    });
    expect(router.writeAudio(Buffer.from([1, 0, 2, 0]))).toBe("recognize");
    expect(router.writeAudio(Buffer.from([3, 0, 4, 0]))).toBe("recognize");
    expect(written).toHaveLength(2);
    expect(router.frames()).toBe(2);
    expect(router.bytes()).toBe(8);
  });

  it("discards audio on the mock path only after the mock greeting was sent", () => {
    const written: Buffer[] = [];
    const greeting = initialSttMessage("s", "mock");
    expect(greeting.type).toBe("mock");
    const router = createSttAudioRouter({
      path: "mock",
      writer: {
        write(request) {
          written.push(request.audio);
          return true;
        },
        end() {},
      },
    });
    expect(router.writeAudio(Buffer.from([1, 0]))).toBe("mock");
    expect(written).toHaveLength(0);
  });

  it("flags a dropped-live write so gcpReady can never fail open silently", () => {
    const router = createSttAudioRouter({ path: "recognize", writer: null });
    expect(router.writeAudio(Buffer.from([0, 0]))).toBe("dropped-live");
  });
});

describe("Chirp streaming config", () => {
  it("stays on Speech-to-Text v2 chirp_3 at 16 kHz LINEAR16 with interims", () => {
    const config = chirpStreamingConfig();
    expect(config.config.model).toBe(CHIRP_MODEL);
    expect(config.config.model).toBe("chirp_3");
    expect(config.config.languageCodes).toEqual([STT_LANGUAGE]);
    expect(config.config.explicitDecodingConfig.encoding).toBe("LINEAR16");
    expect(config.config.explicitDecodingConfig.sampleRateHertz).toBe(STT_SAMPLE_RATE);
    expect(config.config.features.enableAutomaticPunctuation).toBe(false);
    expect(config.streamingFeatures.interimResults).toBe(true);
    expect(config.streamingFeatures.enableVoiceActivityEvents).toBe(true);
    expect(config.streamingFeatures.endpointingSensitivity).toBe(CHIRP_ENDPOINTING);
    expect(config.streamingFeatures.endpointingSensitivity).toBe("ENDPOINTING_SENSITIVITY_SUPERSHORT");
  });

  it("routes even-length PCM as audio even when the socket marks it as text", () => {
    const pcm = Buffer.alloc(32, 1);
    expect(classifySttSocketPayload(pcm, false).kind).toBe("audio");
    expect(classifySttSocketPayload(JSON.stringify({ type: "end" }), false).kind).toBe("control");
    expect(classifySttSocketPayload(pcm, true).kind).toBe("audio");
  });

  it("parses start / end control messages for the listen socket", () => {
    expect(parseSttControlMessage(JSON.stringify({ type: "start", phrases: ["puppy", "ran"] }))).toEqual({
      type: "start",
      phrases: ["puppy", "ran"],
    });
    expect(parseSttControlMessage(JSON.stringify({ type: "end" }))).toEqual({ type: "end" });
    expect(parseSttControlMessage("not-json")).toBeNull();
  });
});
