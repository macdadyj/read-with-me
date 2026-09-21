export type SamplePageId = "puppy" | "cat" | "frog" | "bus";

export type SamplePage = {
  id: SamplePageId;
  title: string;
  buttonLabel: string;
  blurb: string;
  imageUrl: string;
  ocrFile: string;
};

export const SAMPLE_PAGES: readonly SamplePage[] = [
  {
    id: "puppy",
    title: "The puppy",
    buttonLabel: "Use the sample page",
    blurb: "The puppy ran down the hill.",
    imageUrl: "/fixtures/workbook.png",
    ocrFile: "workbook.ocr.json",
  },
  {
    id: "cat",
    title: "The cat",
    buttonLabel: "Try the cat page",
    blurb: "The cat sat on a mat.",
    imageUrl: "/fixtures/cat.png",
    ocrFile: "cat.ocr.json",
  },
  {
    id: "frog",
    title: "The frog",
    buttonLabel: "Try the frog page",
    blurb: "A frog can hop.",
    imageUrl: "/fixtures/frog.png",
    ocrFile: "frog.ocr.json",
  },
  {
    id: "bus",
    title: "The bus",
    buttonLabel: "Try the bus page",
    blurb: "The bus is big.",
    imageUrl: "/fixtures/bus.png",
    ocrFile: "bus.ocr.json",
  },
];

export function isSamplePageId(id: string): id is SamplePageId {
  return SAMPLE_PAGES.some((page) => page.id === id);
}

export function samplePageById(id: string): SamplePage {
  const page = SAMPLE_PAGES.find((item) => item.id === id);
  if (!page) {
    throw new Error(`Unknown practice page: ${id}`);
  }
  return page;
}
