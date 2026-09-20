/** Existing family project — do not create a new one. */
export const GCP_PROJECT_ID = "montano-349204";

/** Vertex, Cloud Run, Vision, TTS. Speech-to-Text v2 recognizers use `us`. */
export const GCP_LOCATION = "us-central1";

export const GCP_REGION = "us-central1";

export const GCP_SPEECH_LOCATION = "us";

export const CLOUD_RUN_SERVICE = "read-with-me";

export const CLOUD_RUN_SERVICE_ACCOUNT = "read-with-me@montano-349204.iam.gserviceaccount.com";

export const GCS_BUCKET = "montano-349204-read-with-me";

export const GCS_BUCKET_URI = "gs://montano-349204-read-with-me";

export function normalizeBucketName(value: string): string {
  return value.replace(/^gs:\/\//, "").replace(/\/+$/, "");
}
