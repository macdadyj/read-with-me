import type { ReadingWord } from "@shared/types";

type Props = {
  imageUrl: string;
  words: ReadingWord[];
  currentIndex: number;
  reducedMotion: boolean;
};

export function PhotoOverlay({ imageUrl, words, currentIndex, reducedMotion }: Props) {
  const current = words[currentIndex];
  const done = new Set(words.slice(0, currentIndex).map((word) => word.id));

  return (
    <div className="photo-stage">
      <img src={imageUrl} alt="Workbook page" className="photo-stage__image" />
      <svg className="photo-stage__boxes" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {words.map((word) => {
          const isCurrent = word.id === current?.id;
          const isDone = done.has(word.id);
          const className = isCurrent
            ? "word-box word-box--current"
            : isDone
              ? "word-box word-box--done"
              : "word-box";
          return (
            <rect
              key={word.id}
              className={`${className}${reducedMotion ? " word-box--still" : ""}`}
              x={word.box.x}
              y={word.box.y}
              width={word.box.width}
              height={word.box.height}
              rx={0.008}
            />
          );
        })}
      </svg>
    </div>
  );
}
