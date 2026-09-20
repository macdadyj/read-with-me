import type { Duplex } from "node:stream";
import type { v2 } from "@google-cloud/speech";
import { env } from "../env.ts";
import { getClients } from "./clients.ts";

export type TranscriptFrame = {
  transcript: string;
  isFinal: boolean;
  stability?: number;
};

type StreamingRecognize = v2.SpeechClient["streamingRecognize"];

export function openStreamingRecognize(
  onTranscript: (frame: TranscriptFrame) => void,
  onError: (error: Error) => void,
): Duplex | null {
  const clients = getClients();
  if (!clients.speech) return null;

  const project = env.project;
  const location = env.speechLocation;
  const recognizer = `projects/${project}/locations/${location}/recognizers/_`;

  try {
    const stream = (clients.speech as unknown as { streamingRecognize: StreamingRecognize }).streamingRecognize();

    stream.on("data", (response: {
      results?: Array<{
        isFinal?: boolean | null;
        stability?: number | null;
        alternatives?: Array<{ transcript?: string | null }>;
      }>;
    }) => {
      for (const result of response.results ?? []) {
        const transcript = result.alternatives?.[0]?.transcript?.trim();
        if (!transcript) continue;
        onTranscript({
          transcript,
          isFinal: Boolean(result.isFinal),
          stability: result.stability ?? undefined,
        });
      }
    });
    stream.on("error", (error: Error) => onError(error));

    stream.write({
      recognizer,
      streamingConfig: {
        config: {
          explicitDecodingConfig: {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            audioChannelCount: 1,
          },
          languageCodes: ["en-US"],
          model: "chirp_3",
          features: {
            enableAutomaticPunctuation: false,
          },
        },
        streamingFeatures: {
          interimResults: true,
        },
      },
    });

    return stream as unknown as Duplex;
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

export function audioToRecognizeRequest(chunk: Buffer): { audio: string } {
  return { audio: chunk.toString("base64") };
}
