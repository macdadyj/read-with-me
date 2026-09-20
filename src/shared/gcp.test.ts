import { describe, expect, it } from "vitest";
import { CLOUD_RUN_SERVICE, GCP_LOCATION, GCP_PROJECT_ID, GCP_SPEECH_LOCATION } from "./gcp.ts";

describe("GCP defaults", () => {
  it("targets the existing montano project in us-central1", () => {
    expect(GCP_PROJECT_ID).toBe("montano-349204");
    expect(GCP_LOCATION).toBe("us-central1");
    expect(CLOUD_RUN_SERVICE).toBe("read-with-me");
    expect(GCP_SPEECH_LOCATION).toBe("us");
  });
});
