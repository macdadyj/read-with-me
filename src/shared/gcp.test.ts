import { describe, expect, it } from "vitest";
import {
  CLOUD_RUN_SERVICE,
  CLOUD_RUN_SERVICE_ACCOUNT,
  GCS_BUCKET,
  GCS_BUCKET_URI,
  GCP_LOCATION,
  GCP_PROJECT_ID,
  GCP_REGION,
  GCP_SPEECH_LOCATION,
  normalizeBucketName,
} from "./gcp.ts";

describe("GCP defaults", () => {
  it("targets montano-349204 with the prepared SA and bucket", () => {
    expect(GCP_PROJECT_ID).toBe("montano-349204");
    expect(GCP_LOCATION).toBe("us-central1");
    expect(GCP_REGION).toBe("us-central1");
    expect(CLOUD_RUN_SERVICE).toBe("read-with-me");
    expect(CLOUD_RUN_SERVICE_ACCOUNT).toBe("read-with-me@montano-349204.iam.gserviceaccount.com");
    expect(GCS_BUCKET).toBe("montano-349204-read-with-me");
    expect(GCS_BUCKET_URI).toBe("gs://montano-349204-read-with-me");
    expect(GCP_SPEECH_LOCATION).toBe("us");
    expect(normalizeBucketName("gs://montano-349204-read-with-me")).toBe("montano-349204-read-with-me");
  });
});
