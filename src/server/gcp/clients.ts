import { v2 } from "@google-cloud/speech";
import { Storage } from "@google-cloud/storage";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { VertexAI } from "@google-cloud/vertexai";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { env, gcpConfigured } from "../env.ts";

export type GcpClients = {
  ready: boolean;
  mockMode: boolean;
  vision: ImageAnnotatorClient | null;
  speech: v2.SpeechClient | null;
  tts: TextToSpeechClient | null;
  vertex: VertexAI | null;
  storage: Storage | null;
};

let cached: GcpClients | null = null;

export function getClients(): GcpClients {
  if (cached) return cached;
  const ready = gcpConfigured();
  if (!ready) {
    cached = {
      ready: false,
      mockMode: true,
      vision: null,
      speech: null,
      tts: null,
      vertex: null,
      storage: null,
    };
    return cached;
  }

  try {
    cached = {
      ready: true,
      mockMode: false,
      vision: new ImageAnnotatorClient({ projectId: env.project }),
      speech: new v2.SpeechClient({ projectId: env.project }),
      tts: new TextToSpeechClient({ projectId: env.project }),
      vertex: new VertexAI({ project: env.project, location: env.location }),
      storage: new Storage({ projectId: env.project }),
    };
    return cached;
  } catch (error) {
    console.warn("GCP clients failed to initialize; using mocks.", error);
    cached = {
      ready: false,
      mockMode: true,
      vision: null,
      speech: null,
      tts: null,
      vertex: null,
      storage: null,
    };
    return cached;
  }
}
