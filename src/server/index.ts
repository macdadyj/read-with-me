import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import { WebSocketServer } from "ws";
import type { HintRequest } from "../shared/types.ts";
import { env } from "./env.ts";
import { getClients } from "./gcp/clients.ts";
import { generateHint } from "./gcp/gemini.ts";
import { loadFixtureOcr, ocrImage } from "./gcp/ocr.ts";
import { audioToRecognizeRequest, openStreamingRecognize } from "./gcp/stt.ts";
import { synthesizeSpeech } from "./gcp/tts.ts";
import { logStt } from "./log.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
  try {
    const id = typeof req.query.id === "string" ? req.query.id : "puppy";
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

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/stt-stream" });

wss.on("connection", (socket) => {
  const sessionId = randomUUID();
  let frames = 0;
  let bytes = 0;
  let recognize = openStreamingRecognize(
    (frame) => {
      socket.send(JSON.stringify({ type: "transcript", sessionId, ...frame }));
    },
    (error) => {
      logStt("stream-error", { sessionId, name: error.name });
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Speech stream paused. You can still type a word.",
        }),
      );
    },
  );

  if (!recognize) {
    logStt("mock", { sessionId });
    socket.send(
      JSON.stringify({
        type: "mock",
        sessionId,
        message: "Live speech is in mock mode. Type a word to follow along.",
      }),
    );
  } else {
    logStt("ready", { sessionId });
    socket.send(JSON.stringify({ type: "ready", sessionId }));
  }

  socket.on("message", (raw, isBinary) => {
    if (!isBinary) {
      try {
        const parsed = JSON.parse(raw.toString()) as { type?: string };
        if (parsed.type === "end") {
          logStt("end", { sessionId, frames, bytes });
          recognize?.end();
          recognize = null;
        }
      } catch {
        logStt("bad-control", { sessionId });
      }
      return;
    }
    const chunk = Buffer.isBuffer(raw)
      ? raw
      : Array.isArray(raw)
        ? Buffer.concat(raw)
        : Buffer.from(raw as ArrayBuffer);
    frames += 1;
    bytes += chunk.byteLength;
    if (frames === 1 || frames % 50 === 0) {
      logStt("audio", { sessionId, frames, bytes });
    }
    if (recognize) {
      recognize.write(audioToRecognizeRequest(chunk));
    }
  });

  socket.on("close", () => {
    logStt("close", { sessionId, frames, bytes });
    recognize?.end();
  });
});

server.listen(env.port, () => {
  const clients = getClients();
  console.log(
    `Read With Me listening on :${env.port} (mockMode=${clients.mockMode}, project=${env.project || "unset"})`,
  );
});
