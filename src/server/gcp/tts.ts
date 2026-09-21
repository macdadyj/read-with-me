import { env } from "../env.ts";
import { getClients } from "./clients.ts";

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  const clients = getClients();
  if (!clients.tts || !text.trim()) return null;
  try {
    const [response] = await clients.tts.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "en-US",
        name: env.ttsVoice,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.92,
        pitch: -1,
      },
    });
    const audio = response.audioContent;
    if (!audio) return null;
    return Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
  } catch (error) {
    console.warn("Cloud TTS failed; client may use browser speech.", error);
    return null;
  }
}
