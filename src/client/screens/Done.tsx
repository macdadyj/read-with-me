import { COPY } from "@shared/copy";

type Props = {
  onAgain: () => void;
  onHome: () => void;
};

export function Done({ onAgain, onHome }: Props) {
  return (
    <main className="sheet done">
      <div className="stars" aria-hidden="true">
        <span>★</span>
        <span>★</span>
        <span>★</span>
      </div>
      <h1>{COPY.niceReading}</h1>
      <p className="lede">You finished the page. That was careful, steady reading.</p>
      <button type="button" className="btn btn--primary" onClick={onAgain}>
        {COPY.anotherPicture}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onHome}>
        {COPY.startOver}
      </button>
    </main>
  );
}
