import { GCP_LOCATION, GCP_PROJECT_ID } from "@shared/gcp";
import type { AppConfig, HintRequest, HintResponse, OcrResult } from "@shared/types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return (await response.json()) as T;
}

export async function fetchConfig(): Promise<AppConfig> {
  try {
    return await readJson<AppConfig>(await fetch("/api/config"));
  } catch {
    return {
      gcpReady: false,
      mockMode: true,
      project: GCP_PROJECT_ID,
      location: GCP_LOCATION,
      saveSession: false,
    };
  }
}

export async function fetchFixture(id = "puppy"): Promise<OcrResult> {
  const query = new URLSearchParams({ id });
  return readJson<OcrResult>(await fetch(`/api/ocr/fixture?${query}`));
}

export async function ocrPhoto(blob: Blob): Promise<OcrResult> {
  const body = new FormData();
  body.append("image", blob, "page.jpg");
  return readJson<OcrResult>(
    await fetch("/api/ocr", {
      method: "POST",
      body,
    }),
  );
}

export async function requestHint(payload: HintRequest): Promise<HintResponse> {
  return readJson<HintResponse>(
    await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function speakOnServer(text: string): Promise<Blob | null> {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (response.status === 204 || !response.ok) return null;
  return response.blob();
}

export function sttSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/stt-stream`;
}
