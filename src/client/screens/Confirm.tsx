import { COPY } from "@shared/copy";

type Props = {
  imageUrl: string;
  busy: boolean;
  warning?: string;
  onConfirm: () => void;
  onRetake: () => void;
};

export function Confirm({ imageUrl, busy, warning, onConfirm, onRetake }: Props) {
  return (
    <main className="sheet confirm">
      <h1>Does this look like the page?</h1>
      <div className="photo-frame">
        <img src={imageUrl} alt="Captured workbook page" />
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
