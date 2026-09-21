import { applySpokenTokens, releaseAfterCoach, toReadingWords } from "@shared/aligner";
import { COPY, celebrateLine } from "@shared/copy";
import { hintFromLevel } from "@shared/hints";
import { tokenizeTranscript } from "@shared/normalize";
import { samplePageById } from "@shared/samplePages";
import { escalateStall, isHintLevel, nextStallLevel, stallLevelForElapsed } from "@shared/stall";
import { consumeTranscript, emptyTranscriptCursor } from "@shared/transcriptStream";
import { GCP_LOCATION, GCP_PROJECT_ID } from "@shared/gcp";
import type { AppConfig, HintResponse, OcrResult, PaceMode, ReadingWord, StallLevel } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMicStream } from "./hooks/useMicStream.ts";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion.ts";
import { fetchConfig, fetchFixture, ocrPhoto, requestHint } from "./lib/api.ts";
import { cropInset } from "./lib/crop.ts";
import { DEMO_STEPS, delay } from "./lib/demoScript.ts";
import { speakCoach, stopSpeech } from "./lib/speech.ts";
import { Confirm } from "./screens/Confirm.tsx";
import { Done } from "./screens/Done.tsx";
import { Home } from "./screens/Home.tsx";
import { Reader } from "./screens/Reader.tsx";

type Screen = "home" | "confirm" | "reader" | "done";

const FIXTURE_IMAGE = "/fixtures/workbook.png";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [config, setConfig] = useState<AppConfig>({
    gcpReady: false,
    mockMode: true,
    project: GCP_PROJECT_ID,
    location: GCP_LOCATION,
    saveSession: false,
  });
  const [forceReduced, setForceReduced] = useState(false);
  const reducedMotion = usePrefersReducedMotion(forceReduced);
  const [imageUrl, setImageUrl] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropInsetAmount, setCropInsetAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | undefined>();
  const [words, setWords] = useState<ReadingWord[]>([]);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pace, setPace] = useState<PaceMode>("gentle");
  const [stallLevel, setStallLevel] = useState<StallLevel>(0);
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [coachNote, setCoachNote] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);
  const [readerLive, setReaderLive] = useState(false);
  const [scriptedDemo, setScriptedDemo] = useState(false);

  const currentIndexRef = useRef(0);
  const wordsRef = useRef<ReadingWord[]>([]);
  const stallLevelRef = useRef<StallLevel>(0);
  const failedRef = useRef(0);
  const lastAttemptRef = useRef<string | null>(null);
  const previousHintsRef = useRef<string[]>([]);
  const stallStartedRef = useRef<number>(Date.now());
  const pauseStallRef = useRef(false);
  const stallArmedRef = useRef(false);
  const demoAbortRef = useRef(false);
  const spokenLevelRef = useRef<StallLevel>(0);
  const transcriptCursorRef = useRef(emptyTranscriptCursor());
  const releaseTimerRef = useRef<number | null>(null);

  function clearReleaseTimer() {
    if (releaseTimerRef.current != null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }

  useEffect(() => {
    void fetchConfig().then(setConfig);
  }, []);

  const resetTrack = useCallback(() => {
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setStallLevel(0);
    stallLevelRef.current = 0;
    setHint(null);
    setFailedAttempts(0);
    failedRef.current = 0;
    setLastAttempt(null);
    lastAttemptRef.current = null;
    previousHintsRef.current = [];
    stallStartedRef.current = Date.now();
    spokenLevelRef.current = 0;
    transcriptCursorRef.current = emptyTranscriptCursor();
    stallArmedRef.current = false;
    pauseStallRef.current = true;
    clearReleaseTimer();
  }, []);

  const goHome = useCallback(() => {
    demoAbortRef.current = true;
    stopSpeech();
    setReaderLive(false);
    setScriptedDemo(false);
    setScreen("home");
    setPendingFile(null);
    setCropInsetAmount(0);
    setWarning(undefined);
    setOcr(null);
    setWords([]);
    wordsRef.current = [];
    resetTrack();
    setCoachNote("");
  }, [resetTrack]);

  const finishPage = useCallback(async () => {
    setReaderLive(false);
    setCoachNote(COPY.niceReading);
    await speakCoach(COPY.niceReading);
    setScreen("done");
  }, []);

  const applyHint = useCallback(async (level: Exclude<StallLevel, 0>, speak = true) => {
    const word = wordsRef.current[currentIndexRef.current];
    if (!word) return;
    const lineText =
      ocr?.lines.find((line) => line.index === word.lineIndex)?.text ??
      wordsRef.current
        .filter((item) => item.lineIndex === word.lineIndex)
        .map((item) => item.text)
        .join(" ");
    let nextHint: HintResponse;
    try {
      nextHint = await requestHint({
        word: word.text,
        lineText,
        lastAttempt: lastAttemptRef.current,
        stallLevel: level,
        previousHints: previousHintsRef.current,
      });
    } catch {
      nextHint = hintFromLevel(word.text, lineText, level, lastAttemptRef.current, previousHintsRef.current);
    }
    previousHintsRef.current = [...previousHintsRef.current, nextHint.spoken];
    setHint(nextHint);
    setCoachNote(nextHint.caption);
    setStallLevel(level);
    stallLevelRef.current = level;
    spokenLevelRef.current = level;
    if (speak) {
      pauseStallRef.current = true;
      await speakCoach(nextHint.spoken);
      pauseStallRef.current = false;
    }
    if (level === 4) {
      clearReleaseTimer();
      const heldIndex = currentIndexRef.current;
      releaseTimerRef.current = window.setTimeout(() => {
        if (currentIndexRef.current !== heldIndex) return;
        if (currentIndexRef.current >= wordsRef.current.length) return;
        const released = releaseAfterCoach(currentIndexRef.current);
        currentIndexRef.current = released.currentIndex;
        setCurrentIndex(released.currentIndex);
        previousHintsRef.current = [];
        setHint(null);
        setStallLevel(0);
        stallLevelRef.current = 0;
        spokenLevelRef.current = 0;
        failedRef.current = 0;
        setFailedAttempts(0);
        stallStartedRef.current = Date.now();
        if (released.currentIndex >= wordsRef.current.length) {
          void finishPage();
        } else {
          setCoachNote("Your turn — keep going.");
        }
      }, 4000);
    }
  }, [finishPage, ocr]);

  const onAligned = useCallback(
    (tokens: string[]) => {
      if (!tokens.length) return;
      const before = currentIndexRef.current;
      const beforeWord = wordsRef.current[before];
      const result = applySpokenTokens(wordsRef.current, before, tokens);
      currentIndexRef.current = result.currentIndex;
      setCurrentIndex(result.currentIndex);
      if (result.failed) {
        const spoken = tokens[tokens.length - 1] ?? "";
        setLastAttempt(spoken);
        lastAttemptRef.current = spoken;
        failedRef.current += 1;
        setFailedAttempts(failedRef.current);
        const escalated = escalateStall(stallLevelRef.current, failedRef.current);
        if (escalated > stallLevelRef.current && isHintLevel(escalated)) {
          void applyHint(escalated);
        } else {
          setCoachNote(COPY.almost);
        }
      }
      if (result.matched) {
        clearReleaseTimer();
        stopSpeech();
        previousHintsRef.current = [];
        setHint(null);
        setStallLevel(0);
        stallLevelRef.current = 0;
        spokenLevelRef.current = 0;
        failedRef.current = 0;
        setFailedAttempts(0);
        stallStartedRef.current = Date.now();
        if (result.currentIndex >= wordsRef.current.length) {
          void finishPage();
          return;
        }
        const afterWord = wordsRef.current[result.currentIndex];
        if (beforeWord && afterWord && beforeWord.lineIndex !== afterWord.lineIndex) {
          const totalLines = new Set(wordsRef.current.map((word) => word.lineIndex)).size;
          setCoachNote(celebrateLine(afterWord.lineIndex, totalLines));
        } else {
          setCoachNote("");
        }
      }
    },
    [applyHint, finishPage],
  );

  const { micState, rms, pause, resume } = useMicStream({
    enabled: readerLive && !scriptedDemo,
    onTokens: (tokens, isFinal) => {
      const consumed = consumeTranscript(transcriptCursorRef.current, tokens.join(" "), isFinal);
      transcriptCursorRef.current = consumed.nextCursor;
      if (consumed.spoken.length) onAligned(consumed.spoken);
    },
  });

  useEffect(() => {
    if (!readerLive || micState === "paused") return;
    const timer = window.setInterval(() => {
      if (!stallArmedRef.current || pauseStallRef.current) return;
      const elapsed = Date.now() - stallStartedRef.current;
      const next = stallLevelForElapsed(elapsed, pace);
      if (next > spokenLevelRef.current && isHintLevel(next)) {
        spokenLevelRef.current = next;
        void applyHint(next);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [applyHint, micState, pace, readerLive]);

  const beginReading = useCallback(
    async (result: OcrResult, url: string, demo = false) => {
      const reading = toReadingWords(result.words);
      if (!reading.length) {
        setWarning(result.warning ?? COPY.noText);
        setScreen("confirm");
        return;
      }
      setOcr(result);
      setWords(reading);
      wordsRef.current = reading;
      setImageUrl(url);
      resetTrack();
      pauseStallRef.current = true;
      setScreen("reader");
      setScriptedDemo(demo);
      setReaderLive(true);
      setCoachNote(COPY.startAtTop);
      const arm = () => {
        stallStartedRef.current = Date.now();
        spokenLevelRef.current = 0;
        stallArmedRef.current = true;
        pauseStallRef.current = false;
      };
      if (!demo) {
        void speakCoach(COPY.startAtTop).then(arm);
      }
    },
    [resetTrack],
  );

  async function onPickImage(file: File) {
    if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPendingFile(file);
    setCropInsetAmount(0);
    setWarning(undefined);
    setScreen("confirm");
  }

  async function onUseSample(id = "puppy") {
    setBusy(true);
    try {
      const sample = samplePageById(id);
      const result = await fetchFixture(sample.id);
      setPendingFile(null);
      setImageUrl(sample.imageUrl);
      setOcr(result);
      setWarning(undefined);
      setScreen("confirm");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    setBusy(true);
    try {
      if (pendingFile) {
        const photo = await cropInset(pendingFile, cropInsetAmount);
        let preview = imageUrl;
        if (photo !== pendingFile) {
          if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
          preview = URL.createObjectURL(photo);
          setImageUrl(preview);
        }
        const result = await ocrPhoto(photo);
        if (!toReadingWords(result.words).length) {
          setWarning(result.warning ?? COPY.noText);
          return;
        }
        await beginReading(result, preview);
        return;
      }
      const result = ocr ?? (await fetchFixture());
      await beginReading(result, imageUrl || FIXTURE_IMAGE);
    } finally {
      setBusy(false);
    }
  }

  async function onPlayDemo() {
    demoAbortRef.current = false;
    const result = await fetchFixture();
    await beginReading(result, FIXTURE_IMAGE, true);
    setPace("gentle");
    void speakCoach(COPY.startAtTop).then(() => {
      stallStartedRef.current = Date.now();
      spokenLevelRef.current = 0;
      stallArmedRef.current = true;
      pauseStallRef.current = false;
    });
    for (const step of DEMO_STEPS) {
      if (demoAbortRef.current) return;
      switch (step.kind) {
        case "speak":
          setCoachNote(step.text);
          break;
        case "say":
          onAligned([step.word]);
          break;
        case "wait":
          await delay(step.ms);
          break;
        case "note":
          setCoachNote(step.text);
          break;
        default: {
          const _never: never = step;
          return _never;
        }
      }
    }
  }

  function onHelp() {
    const next = nextStallLevel(stallLevelRef.current);
    void applyHint(next);
  }

  if (screen === "home") {
    return (
      <Home
        config={config}
        reducedMotion={forceReduced}
        onToggleMotion={setForceReduced}
        onPickImage={(file) => void onPickImage(file)}
        onUseSample={(id) => void onUseSample(id)}
        onPlayDemo={() => void onPlayDemo()}
      />
    );
  }
  if (screen === "confirm") {
    return (
      <Confirm
        imageUrl={imageUrl || FIXTURE_IMAGE}
        busy={busy}
        warning={warning}
        cropInset={cropInsetAmount}
        onCropInset={setCropInsetAmount}
        onConfirm={() => void onConfirm()}
        onRetake={goHome}
      />
    );
  }
  if (screen === "done") {
    return <Done onAgain={goHome} onHome={goHome} />;
  }
  return (
    <Reader
      imageUrl={imageUrl}
      words={words}
      currentIndex={currentIndex}
      pace={pace}
      onPace={setPace}
      micState={micState}
      micRms={rms}
      hint={hint}
      coachNote={coachNote}
      reducedMotion={reducedMotion}
      onHelp={onHelp}
      onPause={() => {
        pauseStallRef.current = true;
        pause();
      }}
      onResume={() => {
        pauseStallRef.current = false;
        stallStartedRef.current = Date.now();
        void resume();
      }}
      onStartOver={goHome}
      onNextPage={goHome}
      onTypedWord={(word) => onAligned(tokenizeTranscript(word))}
    />
  );
}
