import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import "dotenv/config";
import {
  GCS_BUCKET,
  GCP_LOCATION,
  GCP_PROJECT_ID,
  GCP_SPEECH_LOCATION,
  normalizeBucketName,
} from "../shared/gcp.ts";

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  project: firstEnv("GCP_PROJECT_ID", "GCP_PROJECT", "GOOGLE_CLOUD_PROJECT") ?? GCP_PROJECT_ID,
  location: firstEnv("REGION", "GCP_LOCATION", "LOCATION") ?? GCP_LOCATION,
  speechLocation: firstEnv("SPEECH_LOCATION") ?? GCP_SPEECH_LOCATION,
  documentAiProcessor: process.env.DOCUMENT_AI_PROCESSOR ?? "",
  gcsBucket: normalizeBucketName(firstEnv("GCS_BUCKET") ?? GCS_BUCKET),
  saveSession: bool(process.env.SAVE_SESSION),
  forceMock: bool(process.env.USE_MOCK_GCP),
  ttsVoice: process.env.TTS_VOICE ?? "en-US-Neural2-F",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
};

function hasApplicationDefaultCredentials(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB) return true;
  return existsSync(join(homedir(), ".config/gcloud/application_default_credentials.json"));
}

export function gcpConfigured(): boolean {
  if (env.forceMock) return false;
  // Project defaults to montano-349204; still mock when ADC / Cloud Run identity is missing.
  return hasApplicationDefaultCredentials();
}
