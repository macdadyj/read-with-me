import type { Duplex } from "node:stream";
import type { v2 } from "@google-cloud/speech";
import {
  audioChunkToRequest,
  chirpStreamingConfig,
  openSpeechStream,
  speechApiEndpoint,
} from "../../shared/sttProtocol.ts";
import { env } from "../env.ts";
import { logStt } from "../log.ts";
import { getClients } from "./clients.ts";

export type TranscriptFrame = {
  transcript: string;
  isFinal: boolean;
  stability?: number;
};

export function openStreamingRecognize(
  onTranscript: (frame: TranscriptFrame) => void,
  onError: (error: Error) => void,
): Duplex | null {
  const clients = getClients();
  if (!clients.speech) return null;

  const project = env.project;
  const location = env.speechLocation;
  const recognizer = `projects/${project}/locations/${location}/recognizers/_`;
  const endpoint = speechApiEndpoint(location);

  try {
    const stream = openSpeechStream(clients.speech as v2.SpeechClient) as Duplex;

    stream.on("data", (response: {
      speechEventType?: string | number | null;
      results?: Array<{
        isFinal?: boolean | null;
        stability?: number | null;
        alternatives?: Array<{ transcript?: string | null }>;
      }>;
    }) => {
      if (response.speechEventType != null && response.speechEventType !== 0) {
        logStt("speech-event", { event: String(response.speechEventType) });
      }
      const results = response.results ?? [];
      if (!results.length) return;
      for (const result of results) {
        const transcript = result.alternatives?.[0]?.transcript?.trim();
        if (!transcript) continue;
        logStt("transcript", {
          chars: transcript.length,
          isFinal: Boolean(result.isFinal),
        });
        onTranscript({
          transcript,
          isFinal: Boolean(result.isFinal),
          stability: result.stability ?? undefined,
        });
      }
    });
    stream.on("error", (error: Error) => {
      logStt("error", { name: error.name, message: error.message.slice(0, 180) });
      onError(error);
    });

    stream.write({
      recognizer,
      streamingConfig: chirpStreamingConfig(),
    });

    logStt("open", { project, location, endpoint });
    return stream;
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

export function audioToRecognizeRequest(chunk: Buffer): { audio: Buffer } {
  const { audio } = audioChunkToRequest(chunk);
  return { audio: Buffer.from(audio) };
}
