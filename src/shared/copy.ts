export const COPY = {
  appName: "Read With Me",
  tagline: "Point the camera at a page. We follow along and help if you get stuck.",
  takePicture: "Take a picture of the page",
  uploadPhoto: "Upload a photo",
  useSample: "Use the sample page",
  playDemo: "Play the demo",
  thisIsTheText: "This is the text",
  retake: "Try another photo",
  startAtTop: "Let's start at the top.",
  tryThisWord: "Try this word.",
  almost: "Almost. Try the first sound.",
  nowYouSay: "Now you say it.",
  niceReading: "Nice reading.",
  nextLine: "Next line",
  anotherPicture: "Take another picture",
  startOver: "Start over",
  nextPage: "Next page",
  help: "Help",
  pause: "Pause",
  resume: "Listen again",
  listening: "Listening",
  paused: "Paused",
  micIdle: "Mic ready",
  micQuiet: "Listening",
  micHearing: "I hear you",
  micPaused: "Paused",
  micError: "Type a word",
  micDenied: "Mic blocked",
  typeWord: "Type a word to pretend you said it",
  gentle: "Gentle",
  keepMoving: "Keep us moving",
  reducedMotion: "Reduce motion",
  noText: "I couldn't find words in that photo. Let's try a flatter, brighter picture.",
  almostThere: "Almost — keep going.",
  sayWithMe: "Say it with me, then you try.",
} as const;

export function celebrateLine(lineNumber: number, totalLines: number): string {
  if (lineNumber >= totalLines) return COPY.niceReading;
  if (lineNumber === 1) return "Nice line. Ready for the next one?";
  return "You did that line. Let's keep going.";
}
