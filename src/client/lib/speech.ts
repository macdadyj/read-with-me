import { speakOnServer } from "./api.ts";

let currentAudio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

export function stopSpeech(): void {
  currentAudio?.pause();
  currentAudio = null;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakInBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakCoach(text: string): Promise<void> {
  stopSpeech();
  try {
    const blob = await speakOnServer(text);
    if (blob && blob.size > 0) {
      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      currentAudio = audio;
      await audio.play();
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
      return;
    }
  } catch {
    // browser fallback
  }
  await speakInBrowser(text);
}
