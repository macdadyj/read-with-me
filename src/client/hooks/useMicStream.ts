import { useCallback, useEffect, useRef, useState } from "react";
import { createCapturePipeline, PCM_WORKLET_NAME, PCM_WORKLET_SOURCE } from "../lib/micCapture.ts";
import { classifyMicVisualState, rmsFromByteTimeDomain, type MicVisualState } from "../lib/micLevel.ts";
import { logMic } from "../lib/micLog.ts";
import { sttSocketUrl } from "../lib/api.ts";

export type MicState = MicVisualState;

type TransportState = "idle" | "listening" | "paused" | "error" | "permission-denied";

type Options = {
  onTokens: (tokens: string[], isFinal: boolean) => void;
  enabled: boolean;
  phrases?: string[];
};

type Session = {
  socket: WebSocket;
  context: AudioContext;
  stream: MediaStream;
  worklet: AudioWorkletNode;
  analyser: AnalyserNode;
  raf: number;
  pipeline: ReturnType<typeof createCapturePipeline>;
};

function permissionDenied(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
  }
  return false;
}

async function addPcmWorklet(context: AudioContext): Promise<void> {
  try {
    await context.audioWorklet.addModule("/pcm-processor.js");
  } catch (error) {
    logMic("worklet-module-fallback", { message: error instanceof Error ? error.name : "addModule" });
    const blob = new Blob([PCM_WORKLET_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      await context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function openSttSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(sttSocketUrl());
    socket.binaryType = "arraybuffer";
    const timer = window.setTimeout(() => {
      socket.close();
      reject(new Error("stt-timeout"));
    }, 8000);
    socket.addEventListener("open", () => {
      window.clearTimeout(timer);
      resolve(socket);
    });
    socket.addEventListener("error", () => {
      window.clearTimeout(timer);
      reject(new Error("stt-ws"));
    });
  });
}

export function useMicStream({ onTokens, enabled, phrases = [] }: Options): {
  micState: MicState;
  rms: number;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  mockOnly: boolean;
} {
  const [micState, setMicState] = useState<MicState>("idle");
  const [rms, setRms] = useState(0);
  const [mockOnly, setMockOnly] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const transportRef = useRef<TransportState>("idle");
  const startIdRef = useRef(0);
  const onTokensRef = useRef(onTokens);
  onTokensRef.current = onTokens;
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  const setTransport = useCallback((transport: TransportState, nextRms = 0) => {
    transportRef.current = transport;
    setRms(nextRms);
    setMicState(classifyMicVisualState({ transport, rms: nextRms }));
  }, []);

  const teardown = useCallback(() => {
    startIdRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    window.cancelAnimationFrame(session.raf);
    try {
      if (session.socket.readyState === WebSocket.OPEN) {
        session.pipeline.flush();
        session.socket.send(JSON.stringify({ type: "end" }));
      }
      session.socket.close();
    } catch {
      // ignore
    }
    session.worklet.port.onmessage = null;
    session.worklet.disconnect();
    session.analyser.disconnect();
    session.context.close().catch(() => undefined);
    session.stream.getTracks().forEach((track) => track.stop());
    const stats = session.pipeline.stats();
    logMic("stop", {
      framesIn: stats.framesIn,
      framesSent: stats.framesSent,
      bytesSent: stats.bytesSent,
    });
  }, []);

  const attachAnalyserLoop = useCallback(
    (session: Session) => {
      const bytes = new Uint8Array(session.analyser.fftSize);
      let lastLog = 0;
      const tick = (now: number) => {
        session.analyser.getByteTimeDomainData(bytes);
        const nextRms = rmsFromByteTimeDomain(bytes);
        setRms(nextRms);
        const transport = transportRef.current;
        if (transport === "listening") {
          setMicState(classifyMicVisualState({ transport, rms: nextRms }));
        }
        if (now - lastLog > 2000) {
          lastLog = now;
          const stats = session.pipeline.stats();
          logMic("level", {
            rms: Number(nextRms.toFixed(4)),
            state: transportRef.current,
            context: session.context.state,
            ws: session.socket.readyState,
            framesSent: stats.framesSent,
            bytesSent: stats.bytesSent,
          });
        }
        session.raf = window.requestAnimationFrame(tick);
      };
      session.raf = window.requestAnimationFrame(tick);
    },
    [],
  );

  const start = useCallback(async () => {
    teardown();
    const startId = startIdRef.current;
    const abandoned = () => startIdRef.current !== startId;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      if (abandoned()) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContext();
      if (context.state === "suspended") {
        await context.resume();
      }
      if (abandoned()) {
        media.getTracks().forEach((track) => track.stop());
        await context.close().catch(() => undefined);
        return;
      }
      context.addEventListener("statechange", () => {
        logMic("audio-context", { state: context.state, sampleRate: context.sampleRate });
        if (context.state === "suspended") {
          void context.resume();
        }
      });
      await addPcmWorklet(context);
      if (abandoned()) {
        media.getTracks().forEach((track) => track.stop());
        await context.close().catch(() => undefined);
        return;
      }

      let socket: WebSocket;
      try {
        socket = await openSttSocket();
      } catch (error) {
        media.getTracks().forEach((track) => track.stop());
        await context.close().catch(() => undefined);
        throw error;
      }
      if (abandoned()) {
        socket.close();
        media.getTracks().forEach((track) => track.stop());
        await context.close().catch(() => undefined);
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "start", phrases: phrasesRef.current }));
      }

      const source = context.createMediaStreamSource(media);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      const worklet = new AudioWorkletNode(context, PCM_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
      });
      const silent = context.createGain();
      silent.gain.value = 0;

      const pipeline = createCapturePipeline({
        inputSampleRate: context.sampleRate,
        sink: {
          send(chunk) {
            if (socket.readyState !== WebSocket.OPEN) return false;
            socket.send(chunk);
            return true;
          },
        },
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const payload = JSON.parse(event.data) as {
          type?: string;
          transcript?: string;
          isFinal?: boolean;
        };
        if (payload.type === "mock") {
          setMockOnly(true);
          logMic("stt-mock", { ws: socket.readyState });
          return;
        }
        if (payload.type === "ready") {
          logMic("stt-ready", { ws: socket.readyState });
          return;
        }
        if (payload.type === "error") {
          logMic("stt-error", { ws: socket.readyState });
          return;
        }
        if (payload.type === "transcript" && payload.transcript) {
          logMic("transcript", {
            chars: payload.transcript.length,
            isFinal: Boolean(payload.isFinal),
          });
          onTokensRef.current(payload.transcript.split(/\s+/), Boolean(payload.isFinal));
        }
      });

      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (transportRef.current === "paused") return;
        pipeline.push(event.data);
      };

      // Chrome will not run the worklet unless the graph reaches the destination.
      source.connect(analyser);
      source.connect(worklet);
      worklet.connect(silent);
      silent.connect(context.destination);

      const session: Session = {
        socket,
        context,
        stream: media,
        worklet,
        analyser,
        raf: 0,
        pipeline,
      };
      sessionRef.current = session;
      setTransport("listening");
      attachAnalyserLoop(session);
      logMic("start", {
        sampleRate: context.sampleRate,
        context: context.state,
        tracks: media.getAudioTracks().length,
        ws: socket.readyState,
      });
    } catch (error) {
      if (abandoned()) return;
      teardown();
      if (permissionDenied(error)) {
        setTransport("permission-denied");
        logMic("permission-denied", { name: error instanceof Error ? error.name : "unknown" });
      } else {
        setTransport("error");
        setMockOnly(true);
        logMic("start-error", { name: error instanceof Error ? error.name : "unknown" });
      }
    }
  }, [attachAnalyserLoop, setTransport, teardown]);

  const pause = useCallback(() => {
    const session = sessionRef.current;
    session?.stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setTransport("paused");
    logMic("pause", {});
  }, [setTransport]);

  const resume = useCallback(async () => {
    if (!sessionRef.current) {
      await start();
      return;
    }
    const session = sessionRef.current;
    session.stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    if (session.context.state === "suspended") {
      await session.context.resume();
    }
    setTransport("listening", 0);
    logMic("resume", { context: session.context.state });
  }, [setTransport, start]);

  const stop = useCallback(() => {
    teardown();
    setTransport("idle");
  }, [setTransport, teardown]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    void start();
    return () => {
      teardown();
    };
  }, [enabled, start, stop, teardown]);

  return { micState, rms, start, pause, resume, stop, mockOnly };
}
