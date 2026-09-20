import "dotenv/config";

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  project: process.env.GCP_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? "",
  location: process.env.GCP_LOCATION ?? "us-central1",
  speechLocation: process.env.SPEECH_LOCATION ?? "us",
  documentAiProcessor: process.env.DOCUMENT_AI_PROCESSOR ?? "",
  gcsBucket: process.env.GCS_BUCKET ?? "",
  saveSession: bool(process.env.SAVE_SESSION),
  forceMock: bool(process.env.USE_MOCK_GCP),
  ttsVoice: process.env.TTS_VOICE ?? "en-US-Neural2-F",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
};

export function gcpConfigured(): boolean {
  if (env.forceMock) return false;
  // Cloud Run injects K_SERVICE; local ADC works when GCP_PROJECT is set.
  return Boolean(env.project);
}
