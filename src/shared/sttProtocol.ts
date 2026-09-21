/** 16 kHz mono PCM16 — what Cloud Speech-to-Text v2 Chirp expects. */
export const STT_SAMPLE_RATE = 16000;

/** Flush about 100 ms of audio per WebSocket / Recognize write. */
export const STT_FLUSH_SAMPLES = 1600;

export const STT_FLUSH_BYTES = STT_FLUSH_SAMPLES * 2;

export const CHIRP_MODEL = "chirp_3";

export const STT_LANGUAGE = "en-US";

export const MOCK_STT_MESSAGE = "Live speech is in mock mode. Type a word to follow along.";

export function speechApiEndpoint(location: string): string {
  return `${location}-speech.googleapis.com`;
}

export function chirpStreamingConfig(): {
  config: {
    explicitDecodingConfig: {
      encoding: "LINEAR16";
      sampleRateHertz: number;
      audioChannelCount: number;
    };
    languageCodes: string[];
    model: string;
    features: { enableAutomaticPunctuation: false };
  };
  streamingFeatures: {
    interimResults: true;
  };
} {
  return {
    config: {
      explicitDecodingConfig: {
        encoding: "LINEAR16",
        sampleRateHertz: STT_SAMPLE_RATE,
        audioChannelCount: 1,
      },
      languageCodes: [STT_LANGUAGE],
      model: CHIRP_MODEL,
      features: {
        enableAutomaticPunctuation: false,
      },
    },
    streamingFeatures: {
      interimResults: true,
    },
  };
}

export type SttControlMessage = { type: "start"; phrases?: string[] } | { type: "end" };

export function parseSttControlMessage(raw: string): SttControlMessage | null {
  try {
    const parsed = JSON.parse(raw) as { type?: string; phrases?: string[] };
    if (parsed.type === "end") return { type: "end" };
    if (parsed.type === "start") {
      return {
        type: "start",
        phrases: Array.isArray(parsed.phrases) ? parsed.phrases.filter((item) => typeof item === "string") : [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Live Chirp when both flags are set; otherwise the typed-word mock — never a silent third path. */
export function liveSpeechPath(gcpReady: boolean, speechClientPresent: boolean): "recognize" | "mock" {
  return gcpReady && speechClientPresent ? "recognize" : "mock";
}

/**
 * Speech-to-Text v2 `StreamingRecognizeRequest` audio field.
 * The Node client accepts raw bytes (Buffer / Uint8Array), not a base64 string.
 */
export function audioChunkToRequest(chunk: ArrayBuffer | Uint8Array): { audio: Uint8Array } {
  const audio = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  return { audio };
}

export function openSpeechStream(client: {
  _streamingRecognize?: () => unknown;
  streamingRecognize?: () => unknown;
}): unknown {
  if (typeof client._streamingRecognize === "function") {
    return client._streamingRecognize();
  }
  if (typeof client.streamingRecognize === "function") {
    return client.streamingRecognize();
  }
  throw new Error("Speech client has no streaming recognize method");
}
