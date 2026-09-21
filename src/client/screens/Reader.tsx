import { COPY } from "@shared/copy";
import type { HintResponse, PaceMode, ReadingWord } from "@shared/types";
import { MicBadge } from "../components/MicBadge.tsx";
import { PaceToggle } from "../components/PaceToggle.tsx";
import { PhotoOverlay } from "../components/PhotoOverlay.tsx";
import { TypeDemo } from "../components/TypeDemo.tsx";
import { WordTrack } from "../components/WordTrack.tsx";
import type { MicState } from "../hooks/useMicStream.ts";

type Props = {
  imageUrl: string;
  words: ReadingWord[];
  currentIndex: number;
  pace: PaceMode;
  onPace: (value: PaceMode) => void;
  micState: MicState;
  micRms?: number;
  hint: HintResponse | null;
  coachNote: string;
  reducedMotion: boolean;
  onHelp: () => void;
  onPause: () => void;
  onResume: () => void;
  onStartOver: () => void;
  onNextPage: () => void;
  onTypedWord: (word: string) => void;
};

export function Reader({
  imageUrl,
  words,
  currentIndex,
  pace,
  onPace,
  micState,
  micRms = 0,
  hint,
  coachNote,
  reducedMotion,
  onHelp,
  onPause,
  onResume,
  onStartOver,
  onNextPage,
  onTypedWord,
}: Props) {
  const paused = micState === "paused";

  return (
    <main className="reader">
      <PhotoOverlay
        imageUrl={imageUrl}
        words={words}
        currentIndex={currentIndex}
        reducedMotion={reducedMotion}
      />
      <section className="reader__panel">
        <div className="reader__top">
          <MicBadge state={micState} rms={micRms} reducedMotion={reducedMotion} />
          <PaceToggle value={pace} onChange={onPace} />
        </div>
        <WordTrack
          words={words}
          currentIndex={currentIndex}
          underline={hint?.underline ?? ""}
          reveal={Boolean(hint?.revealWord)}
        />
        <p className="coach" aria-live="polite">
          {coachNote}
        </p>
        <div className="reader__actions">
          <button type="button" className="btn btn--primary" onClick={onHelp}>
            {COPY.help}
          </button>
          <button type="button" className="btn btn--ghost" onClick={paused ? onResume : onPause}>
            {paused ? COPY.resume : COPY.pause}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onStartOver}>
            {COPY.startOver}
          </button>
          <button type="button" className="btn btn--text" onClick={onNextPage}>
            {COPY.nextPage}
          </button>
        </div>
        <TypeDemo onSay={onTypedWord} />
      </section>
    </main>
  );
}
