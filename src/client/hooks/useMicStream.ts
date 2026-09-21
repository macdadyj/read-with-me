import { useCallback, useEffect, useRef, useState } from "react";
import { sttSocketUrl } from "../lib/api.ts";
import { downsampleTo16k, floatTo16BitPcm } from "../lib/pcm.ts";

export type MicState = "idle" | "listening" | "paused" | "error";

type Options = {
  onTokens: (tokens: string[], isFinal: boolean) => void;
  enabled: boolean;
};

export function useMicStream({ onTokens, enabled }: Options): {
  micState: MicState;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  mockOnly: boolean;
} {
  const [micState, setMicState] = useState<MicState>("idle");
  const [mockOnly, setMockOnly] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onTokensRef = useRef(onTokens);
  onTokensRef.current = onTokens;

  const stop = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: "end" }));
    socketRef.current?.close();
    socketRef.current = null;
    contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicState("idle");
  }, []);

  const start = useCallback(async () => {
    stop();
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = media;
      const context = new AudioContext();
      contextRef.current = context;
      await context.audioWorklet.addModule("/pcm-processor.js");
      const source = context.createMediaStreamSource(media);
      const node = new AudioWorkletNode(context, "pcm-processor");
      const socket = new WebSocket(sttSocketUrl());
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const payload = JSON.parse(event.data) as {
          type?: string;
          transcript?: string;
          isFinal?: boolean;
        };
        if (payload.type === "mock") {
          setMockOnly(true);
          return;
        }
        if (payload.type === "transcript" && payload.transcript) {
          onTokensRef.current(payload.transcript.split(/\s+/), Boolean(payload.isFinal));
        }
      });

      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const pcm = floatTo16BitPcm(downsampleTo16k(event.data, context.sampleRate));
        socket.send(pcm);
      };
      source.connect(node);
      setMicState("listening");
    } catch {
      setMicState("error");
      setMockOnly(true);
    }
  }, [stop]);

  const pause = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setMicState("paused");
  }, []);

  const resume = useCallback(async () => {
    if (!streamRef.current) {
      await start();
      return;
    }
    streamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    setMicState("listening");
  }, [start]);

  useEffect(() => {
    if (!enabled) stop();
    return () => stop();
  }, [enabled, stop]);

  return { micState, start, pause, resume, stop, mockOnly };
}
