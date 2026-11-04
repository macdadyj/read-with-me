import type { RequestHandler } from "express";

const BROTLI_CODING = "br";

/**
 * True when Content-Encoding lists the `br` content-coding.
 *
 * Header values are matched as a comma-separated list of tokens (RFC 9110),
 * case-insensitively. `brotli` and `brr` are different tokens.
 */
export function contentEncodingIncludesBrotli(
  header: string | readonly string[] | undefined,
): boolean {
  if (header == null || header === "") return false;
  const values = typeof header === "string" ? [header] : header;
  for (const value of values) {
    for (const token of value.split(",")) {
      if (token.trim().toLowerCase() === BROTLI_CODING) return true;
    }
  }
  return false;
}

/**
 * Reject request bodies the client marked as Brotli before any parser reads them.
 *
 * express.json() is body-parser 2.x. After the Content-Type matches JSON,
 * body-parser's read.js lowercases Content-Encoding and, for the exact value
 * `br`, pipes the body through zlib.createBrotliDecompress. That is the
 * CVE-2026-111497 sink on Node 22.x before 22.23.4. inflate defaults to on;
 * only `inflate: false` would skip it, and that option is not set here.
 *
 * multer 2.4.0 does not inflate Content-Encoding. It pipes the raw request
 * into busboy (make-middleware.js defaultStreamHandler). This middleware still
 * runs first so an upload cannot reach a decoder if one is added later.
 * gzip and deflate are unchanged: body-parser still inflates those itself.
 */
export const rejectBrotliContentEncoding: RequestHandler = (req, res, next) => {
  if (!contentEncodingIncludesBrotli(req.headers["content-encoding"])) {
    next();
    return;
  }
  res.status(415).json({ error: "Content-Encoding br is not supported." });
};
