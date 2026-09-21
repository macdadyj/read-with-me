/** 16 kHz mono PCM16 — what Cloud Speech-to-Text v2 Chirp expects. */
export const STT_SAMPLE_RATE = 16000;

/** Flush about 100 ms of audio per WebSocket / Recognize write. */
export const STT_FLUSH_SAMPLES = 1600;

export const STT_FLUSH_BYTES = STT_FLUSH_SAMPLES * 2;

export function speechApiEndpoint(location: string): string {
  return `${location}-speech.googleapis.com`;
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
