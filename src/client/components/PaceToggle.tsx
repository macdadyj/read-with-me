import { COPY } from "@shared/copy";
import type { PaceMode } from "@shared/types";

type Props = {
  value: PaceMode;
  onChange: (value: PaceMode) => void;
};

export function PaceToggle({ value, onChange }: Props) {
  return (
    <div className="pace-toggle" role="radiogroup" aria-label="How quickly should we help?">
      <button
        type="button"
        role="radio"
        aria-checked={value === "gentle"}
        className={value === "gentle" ? "is-on" : undefined}
        onClick={() => onChange("gentle")}
      >
        {COPY.gentle}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "keep-moving"}
        className={value === "keep-moving" ? "is-on" : undefined}
        onClick={() => onChange("keep-moving")}
      >
        {COPY.keepMoving}
      </button>
    </div>
  );
}
