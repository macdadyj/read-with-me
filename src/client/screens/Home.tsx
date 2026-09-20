import { COPY } from "@shared/copy";
import type { AppConfig } from "@shared/types";
import { ChangeEvent, useRef } from "react";

type Props = {
  config: AppConfig;
  reducedMotion: boolean;
  onToggleMotion: (value: boolean) => void;
  onPickImage: (file: File) => void;
  onUseSample: () => void;
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
        <p className="banner">Demo mode is on. Camera and live speech work when GCP credentials are set.</p>
      ) : null}

      <input
        ref={cameraRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
      />
      <input ref={uploadRef} className="sr-only" type="file" accept="image/*" onChange={onFile} />

      <button type="button" className="btn btn--primary" onClick={() => cameraRef.current?.click()}>
        {COPY.takePicture}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => uploadRef.current?.click()}>
        {COPY.uploadPhoto}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onUseSample}>
        {COPY.useSample}
      </button>
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
