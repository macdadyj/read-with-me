import { COPY } from "@shared/copy";

type Props = {
  imageUrl: string;
  busy: boolean;
  warning?: string;
  cropInset: number;
  onCropInset: (value: number) => void;
  onConfirm: () => void;
  onRetake: () => void;
};

export function Confirm({
  imageUrl,
  busy,
  warning,
  cropInset,
  onCropInset,
  onConfirm,
  onRetake,
}: Props) {
  const frameStyle = {
    inset: `${cropInset * 100}%`,
  };

  return (
    <main className="sheet confirm">
      <h1>Does this look like the page?</h1>
      <div className="photo-frame">
        <img src={imageUrl} alt="Captured workbook page" />
        <div className="crop-frame" style={frameStyle} aria-hidden="true" />
      </div>
      <p className="crop-label">Simple crop — keep the words inside the frame.</p>
      <div className="pace-toggle crop-toggle" role="radiogroup" aria-label="Crop tightness">
        <button
          type="button"
          role="radio"
          aria-checked={cropInset === 0}
          className={cropInset === 0 ? "is-on" : undefined}
          onClick={() => onCropInset(0)}
        >
          Full photo
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cropInset === 0.06}
          className={cropInset === 0.06 ? "is-on" : undefined}
          onClick={() => onCropInset(0.06)}
        >
          Tighten
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cropInset === 0.12}
          className={cropInset === 0.12 ? "is-on" : undefined}
          onClick={() => onCropInset(0.12)}
        >
          Text only
        </button>
      </div>
      {warning ? <p className="banner">{warning}</p> : null}
      <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy}>
        {busy ? "Looking for words…" : COPY.thisIsTheText}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onRetake} disabled={busy}>
        {COPY.retake}
      </button>
    </main>
  );
}
