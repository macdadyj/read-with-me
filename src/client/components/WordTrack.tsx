import type { ReadingWord } from "@shared/types";

type Props = {
  words: ReadingWord[];
  currentIndex: number;
  underline: string;
  reveal: boolean;
};

export function WordTrack({ words, currentIndex, underline, reveal }: Props) {
  const current = words[currentIndex];
  const lineIndex = current?.lineIndex ?? 0;
  const lineWords = words.filter((word) => word.lineIndex === lineIndex);

  return (
    <p className="word-track" aria-live="polite">
      {lineWords.map((word) => {
        const active = word.readingIndex === currentIndex;
        const passed = word.readingIndex < currentIndex;
        return (
          <span
            key={word.id}
            aria-current={active ? "true" : undefined}
            className={
              active ? "word-track__word is-active" : passed ? "word-track__word is-passed" : "word-track__word"
            }
          >
            {active ? <CoachedWord text={word.display ?? word.text} underline={underline} reveal={reveal} /> : (word.display ?? word.text)}
          </span>
        );
      })}
    </p>
  );
}

function CoachedWord({ text, underline, reveal }: { text: string; underline: string; reveal: boolean }) {
  if (!underline) {
    return <span className={reveal ? "is-revealed" : undefined}>{text}</span>;
  }
  const lower = text.toLowerCase();
  const needle = underline.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) return <span className="is-underlined">{text}</span>;
  return (
    <span className={reveal ? "is-revealed" : undefined}>
      {text.slice(0, at)}
      <span className="is-underlined">{text.slice(at, at + underline.length)}</span>
      {text.slice(at + underline.length)}
    </span>
  );
}
