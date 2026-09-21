import { liveSpeechPath, MOCK_STT_MESSAGE } from "../shared/sttProtocol.ts";

export type SttGreeting =
  | { type: "ready"; sessionId: string }
  | { type: "mock"; sessionId: string; message: string };

export function initialSttMessage(sessionId: string, path: "recognize" | "mock"): SttGreeting {
  if (path === "recognize") return { type: "ready", sessionId };
  return { type: "mock", sessionId, message: MOCK_STT_MESSAGE };
}

export function greetingForClients(sessionId: string, gcpReady: boolean, speechClientPresent: boolean): SttGreeting {
  return initialSttMessage(sessionId, liveSpeechPath(gcpReady, speechClientPresent));
}

export type RecognizeWriter = {
  write: (request: { audio: Buffer }) => boolean;
  end: () => void;
};

/**
 * Routes binary PCM to Chirp when the live path is open.
 * When mocked, audio is discarded on purpose — the client already received `{ type: "mock" }`.
 * There is no third "gcpReady but silent" path.
 */
export function createSttAudioRouter(options: {
  path: "recognize" | "mock";
  writer: RecognizeWriter | null;
}): {
  writeAudio: (chunk: Buffer) => "recognize" | "mock" | "dropped-live";
  frames: () => number;
  bytes: () => number;
  close: () => void;
} {
  let frames = 0;
  let bytes = 0;
  return {
    writeAudio(chunk: Buffer) {
      frames += 1;
      bytes += chunk.byteLength;
      if (options.path === "recognize") {
        if (!options.writer) return "dropped-live";
        options.writer.write({ audio: chunk });
        return "recognize";
      }
      return "mock";
    },
    frames: () => frames,
    bytes: () => bytes,
    close() {
      options.writer?.end();
    },
  };
}
