import { COPY } from "@shared/copy";
import { SAMPLE_PAGES, type SamplePageId } from "@shared/samplePages";
import type { AppConfig } from "@shared/types";
import { ChangeEvent, useRef } from "react";

type Props = {
  config: AppConfig;
  reducedMotion: boolean;
  onToggleMotion: (value: boolean) => void;
  onPickImage: (file: File) => void;
  onUseSample: (id: SamplePageId) => void;
  onPlayDemo: () => void;
};

export function Home({ config, reducedMotion, onToggleMotion, onPickImage, onUseSample, onPlayDemo }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onPickImage(file);
    event.target.value = "";
  }

  return (
    <main className="sheet home">
      <p className="eyebrow">For early readers</p>
      <h1>{COPY.appName}</h1>
      <p className="lede">{COPY.tagline}</p>
      {config.mockMode ? (
        <p className="banner">
          Demo mode is on. Live Vision, speech, and Gemini use {config.project} in {config.location} when ADC is set.
        </p>
      ) : (
        <p className="banner banner--live">
          Connected to {config.project} ({config.location}).
        </p>
      )}

      <input
        ref={cameraRef}
        className="file-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={uploadRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={onFile}
        aria-hidden="true"
        tabIndex={-1}
      />

      <button type="button" className="btn btn--primary" onClick={() => cameraRef.current?.click()}>
        {COPY.takePicture}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => uploadRef.current?.click()}>
        {COPY.uploadPhoto}
      </button>
      <section className="practice" aria-label="Practice pages">
        {SAMPLE_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            className="btn btn--ghost practice__btn"
            onClick={() => onUseSample(page.id)}
          >
            <span className="practice__title">{page.buttonLabel}</span>
            <span className="practice__blurb">{page.blurb}</span>
          </button>
        ))}
      </section>
      <button type="button" className="btn btn--text" onClick={onPlayDemo}>
        {COPY.playDemo}
      </button>

      <label className="check">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(event) => onToggleMotion(event.target.checked)}
        />
        {COPY.reducedMotion}
      </label>
    </main>
  );
}
