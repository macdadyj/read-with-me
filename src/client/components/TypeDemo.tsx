import { FormEvent, useState } from "react";
import { COPY } from "@shared/copy";

export function TypeDemo({ onSay }: { onSay: (word: string) => void }) {
  const [value, setValue] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const word = value.trim();
    if (!word) return;
    onSay(word);
    setValue("");
  }

  return (
    <form className="type-demo" onSubmit={submit}>
      <label htmlFor="typed-word">{COPY.typeWord}</label>
      <div className="type-demo__row">
        <input
          id="typed-word"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit">Say it</button>
      </div>
    </form>
  );
}
