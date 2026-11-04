import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { assertNever } from "../shared/types.ts";
import { classifySttSocketPayload } from "../shared/sttProtocol.ts";
import { createApp } from "./app.ts";
import { env } from "./env.ts";
import { getClients } from "./gcp/clients.ts";
import { audioToRecognizeRequest, openStreamingRecognize } from "./gcp/stt.ts";
import { logStt } from "./log.ts";
import { createSttAudioRouter, greetingForClients } from "./sttSession.ts";

export const app = createApp();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/stt-stream" });

wss.on("connection", (socket) => {
  const sessionId = randomUUID();
  const clients = getClients();
  let recognize = clients.ready && clients.speech
    ? openStreamingRecognize(
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
      )
    : null;

  const greeting = greetingForClients(sessionId, clients.ready, Boolean(recognize));
  if (greeting.type === "mock") {
    logStt("mock", { sessionId });
  } else {
    logStt("ready", { sessionId });
  }
  socket.send(JSON.stringify(greeting));

  const router = createSttAudioRouter({
    path: greeting.type === "ready" ? "recognize" : "mock",
    writer: recognize
      ? {
          write(request) {
            recognize?.write(audioToRecognizeRequest(request.audio));
            return true;
          },
          end() {
            recognize?.end();
          },
        }
      : null,
  });

  socket.on("message", (raw, isBinary) => {
    const payload = classifySttSocketPayload(raw, isBinary);
    switch (payload.kind) {
      case "control":
        if (payload.message.type === "end") {
          logStt("end", { sessionId, frames: router.frames(), bytes: router.bytes() });
          router.close();
          recognize = null;
          return;
        }
        logStt("start", { sessionId, phrases: payload.message.phrases?.length ?? 0 });
        return;
      case "ignore":
        logStt("bad-control", { sessionId });
        return;
      case "audio": {
        const routed = router.writeAudio(payload.chunk);
        if (router.frames() === 1 || router.frames() % 50 === 0) {
          logStt("audio", { sessionId, frames: router.frames(), bytes: router.bytes(), routed });
        }
        return;
      }
      default:
        return assertNever(payload);
    }
  });

  socket.on("close", () => {
    logStt("close", { sessionId, frames: router.frames(), bytes: router.bytes() });
    router.close();
  });
});

function startedAsEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry);
}

if (startedAsEntrypoint()) {
  server.listen(env.port, () => {
    const clients = getClients();
    console.log(
      `Read With Me listening on :${env.port} (mockMode=${clients.mockMode}, project=${env.project || "unset"})`,
    );
  });
}
