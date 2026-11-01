import { once } from "node:events";
import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentEncodingIncludesBrotli } from "./contentEncoding.ts";

process.env.USE_MOCK_GCP = "true";

const BROTLI_REJECTED = { error: "Content-Encoding br is not supported." };

const hintBody = {
  word: "cat",
  stallLevel: 1,
  lineText: "The cat sat.",
  lastAttempt: null,
  previousHints: [] as string[],
};

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type HttpResult = {
  status: number;
  json: unknown;
};

function post(
  port: number,
  path: string,
  headers: Record<string, string>,
  body: Buffer,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method: "POST",
        path,
        headers: {
          ...headers,
          "content-length": String(body.length),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: unknown = raw;
          try {
            json = JSON.parse(raw) as unknown;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

function multipartImage(png: Buffer): { contentType: string; body: Buffer } {
  const boundary = "----readwithmeboundary";
  const head = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="image"; filename="page.png"\r\n' +
      "Content-Type: image/png\r\n\r\n",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat([head, png, tail]),
  };
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

describe("Content-Encoding token matching", () => {
  it("matches only the br content-coding", () => {
    expect(contentEncodingIncludesBrotli(undefined)).toBe(false);
    expect(contentEncodingIncludesBrotli("")).toBe(false);
    expect(contentEncodingIncludesBrotli("identity")).toBe(false);
    expect(contentEncodingIncludesBrotli("gzip")).toBe(false);
    expect(contentEncodingIncludesBrotli("deflate")).toBe(false);
    expect(contentEncodingIncludesBrotli("brotli")).toBe(false);
    expect(contentEncodingIncludesBrotli("brr")).toBe(false);
    expect(contentEncodingIncludesBrotli("x-br")).toBe(false);
    expect(contentEncodingIncludesBrotli("br")).toBe(true);
    expect(contentEncodingIncludesBrotli("BR")).toBe(true);
    expect(contentEncodingIncludesBrotli("  Br  ")).toBe(true);
    expect(contentEncodingIncludesBrotli("gzip, br")).toBe(true);
    expect(contentEncodingIncludesBrotli("br, gzip")).toBe(true);
    expect(contentEncodingIncludesBrotli(["gzip", "br"])).toBe(true);
  });
});

describe("request body encodings", () => {
  let port = 0;
  let server: http.Server;

  beforeAll(async () => {
    const [{ app }, { env }] = await Promise.all([
      import("./index.ts"),
      import("./env.ts"),
    ]);
    expect(env.forceMock).toBe(true);
    expect(await canConnect(env.port)).toBe(false);

    server = http.createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address == null || typeof address === "string") {
      throw new Error("Test server did not bind a TCP port");
    }
    port = (address as AddressInfo).port;
  });

  afterAll(async () => {
    server.close();
    await once(server, "close");
  });

  it.each(["br", "BR", "  Br  ", "gzip, br", "br, gzip"])(
    "rejects Content-Encoding %j on a JSON hint before Brotli inflate",
    async (encoding) => {
      const compressed = brotliCompressSync(Buffer.from(JSON.stringify(hintBody)));
      const result = await post(
        port,
        "/api/hint",
        {
          "content-type": "application/json",
          "content-encoding": encoding,
        },
        compressed,
      );
      expect(result.status).toBe(415);
      expect(result.json).toEqual(BROTLI_REJECTED);
    },
  );

  it("rejects a Brotli-encoded OCR upload before multer reads it", async () => {
    const image = multipartImage(onePixelPng);
    const result = await post(
      port,
      "/api/ocr",
      {
        "content-type": image.contentType,
        "content-encoding": "br",
      },
      brotliCompressSync(image.body),
    );
    expect(result.status).toBe(415);
    expect(result.json).toEqual(BROTLI_REJECTED);
  });

  it("parses an ordinary JSON hint", async () => {
    const result = await post(
      port,
      "/api/hint",
      { "content-type": "application/json" },
      Buffer.from(JSON.stringify(hintBody)),
    );
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      level: 1,
      source: "local",
      revealWord: false,
    });
    expect((result.json as { spoken: string }).spoken.length).toBeGreaterThan(0);
  });

  it("still lets body-parser inflate gzip JSON", async () => {
    const result = await post(
      port,
      "/api/hint",
      {
        "content-type": "application/json",
        "content-encoding": "gzip",
      },
      gzipSync(Buffer.from(JSON.stringify(hintBody))),
    );
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ level: 1, source: "local" });
  });

  it("accepts a multipart OCR upload and returns the mock page", async () => {
    const image = multipartImage(onePixelPng);
    const result = await post(
      port,
      "/api/ocr",
      { "content-type": image.contentType },
      image.body,
    );
    expect(result.status).toBe(200);
    const body = result.json as { source?: string; words?: unknown };
    expect(body.source).toBe("mock");
    expect(Array.isArray(body.words)).toBe(true);
    expect((body.words as unknown[]).length).toBeGreaterThan(0);
  });
});
