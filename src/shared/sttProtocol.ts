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

/** Chirp 3 default endpointing waits for a full sentence — too slow for one-word reading. */
export const CHIRP_ENDPOINTING = "ENDPOINTING_SENSITIVITY_SUPERSHORT" as const;

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
    enableVoiceActivityEvents: true;
    endpointingSensitivity: typeof CHIRP_ENDPOINTING;
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
      enableVoiceActivityEvents: true,
      // Finalize after each spoken word ("The", "Puppy") instead of waiting for a sentence.
      endpointingSensitivity: CHIRP_ENDPOINTING,
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

export function toNodeBuffer(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw);
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  if (ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  return Buffer.from(String(raw));
}

function looksLikeJsonObject(chunk: Buffer): boolean {
  let index = 0;
  while (index < chunk.length && (chunk[index] === 0x20 || chunk[index] === 0x0a || chunk[index] === 0x0d)) {
    index += 1;
  }
  return chunk[index] === 0x7b;
}

/**
 * Cloud Run / some browsers occasionally mark binary PCM as text.
 * Treat even-length non-JSON frames as LINEAR16 so audio cannot be dropped as "bad-control".
 */
export function classifySttSocketPayload(
  raw: unknown,
  isBinary: boolean,
): { kind: "audio"; chunk: Buffer } | { kind: "control"; message: SttControlMessage } | { kind: "ignore" } {
  const chunk = toNodeBuffer(raw);
  if (isBinary || (chunk.length >= 8 && chunk.length % 2 === 0 && !looksLikeJsonObject(chunk))) {
    return { kind: "audio", chunk };
  }
  const control = parseSttControlMessage(chunk.toString("utf8"));
  if (control) return { kind: "control", message: control };
  return { kind: "ignore" };
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
