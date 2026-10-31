import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { OcrResult } from "../shared/types.ts";

process.env.USE_MOCK_GCP = "1";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("POST /api/ocr upload", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { createApp } = await import("./app.ts");
    const app: Express = createApp();
    server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("rejects a request that does not include an image field", async () => {
    const response = await fetch(`${baseUrl}/api/ocr`, { method: "POST" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please send a photo as the image field.",
    });
  });

  it("accepts an image upload and returns the mock page text", async () => {
    const form = new FormData();
    form.append("image", new Blob([PNG], { type: "image/png" }), "page.png");
    const response = await fetch(`${baseUrl}/api/ocr`, { method: "POST", body: form });
    expect(response.status).toBe(200);
    const body = (await response.json()) as OcrResult;
    expect(body.source).toBe("mock");
    expect(body.words.length).toBeGreaterThan(0);
    expect(body.lines.length).toBeGreaterThan(0);
    expect(body.lines[0]?.text).toContain("puppy");
  });
});
