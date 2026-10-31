import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import { isSamplePageId } from "../shared/samplePages.ts";
import type { HintRequest } from "../shared/types.ts";
import { env } from "./env.ts";
import { getClients } from "./gcp/clients.ts";
import { generateHint } from "./gcp/gemini.ts";
import { loadFixtureOcr, ocrImage } from "./gcp/ocr.ts";
import { synthesizeSpeech } from "./gcp/tts.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "read-with-me" });
  });

  app.get("/api/config", (_req, res) => {
    const clients = getClients();
    res.json({
      gcpReady: clients.ready,
      mockMode: clients.mockMode,
      project: env.project,
      location: env.location,
      saveSession: env.saveSession,
      bucket: env.gcsBucket,
    });
  });

  app.get("/api/ocr/fixture", async (req, res) => {
    const id = typeof req.query.id === "string" && req.query.id ? req.query.id : "puppy";
    if (!isSamplePageId(id)) {
      res.status(400).json({ error: "Unknown practice page." });
      return;
    }
    try {
      const result = await loadFixtureOcr(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Fixture missing", detail: String(error) });
    }
  });

  app.post("/api/ocr", upload.single("image"), async (req, res) => {
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Please send a photo as the image field." });
      return;
    }
    const result = await ocrImage(req.file.buffer);
    res.json(result);
  });

  app.post("/api/hint", async (req, res) => {
    const body = req.body as Partial<HintRequest>;
    if (!body.word || !body.stallLevel) {
      res.status(400).json({ error: "word and stallLevel are required" });
      return;
    }
    const hint = await generateHint({
      word: body.word,
      lineText: body.lineText ?? "",
      lastAttempt: body.lastAttempt ?? null,
      stallLevel: body.stallLevel,
      previousHints: body.previousHints ?? [],
    });
    res.json(hint);
  });

  app.post("/api/speak", async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (!text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const audio = await synthesizeSpeech(text);
    if (!audio) {
      res.status(204).end();
      return;
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(here, "../client");
  const publicDir = path.resolve(process.cwd(), "public");
  app.use(express.static(clientDir));
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    res.sendFile(path.join(clientDir, "index.html"), (error) => {
      if (error) next();
    });
  });

  return app;
}
