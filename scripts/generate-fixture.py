#!/usr/bin/env python3
"""Render a first-grade workbook page and emit matching OCR JSON."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1440
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "fixtures"
FONT_REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"

# Reading lines only — title / name / date are decorations the aligner skips.
READING_LINES = [
    "The puppy ran down the hill.",
    "Then he sat in the sun.",
    "He was a happy little dog.",
]

EXTRA_PAGES = [
    {
        "stem": "cat",
        "title": "The Cat Page",
        "footer": "Read With Me  ·  cat practice page",
        "lines": [
            "The cat sat on a mat.",
            "She had a red hat.",
        ],
    },
    {
        "stem": "frog",
        "title": "The Frog Page",
        "footer": "Read With Me  ·  frog practice page",
        "lines": [
            "A frog can hop.",
            "The frog sat on a log.",
        ],
    },
    {
        "stem": "bus",
        "title": "The Bus Page",
        "footer": "Read With Me  ·  bus practice page",
        "lines": [
            "The bus is big.",
            "We ride the bus.",
        ],
    },
]


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def word_box(draw: ImageDraw.ImageDraw, font: ImageFont.FreeTypeFont, text: str, xy: tuple[int, int]) -> dict:
    x, y = xy
    bbox = draw.textbbox((x, y), text, font=font)
    left, top, right, bottom = bbox
    pad = 12
    return {
        "x": max(0, left - pad) / WIDTH,
        "y": max(0, top - pad) / HEIGHT,
        "width": (right - left + pad * 2) / WIDTH,
        "height": (bottom - top + pad * 2) / HEIGHT,
    }


def render_page(stem: str, title: str, footer: str, lines: list[str]) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), "#f4ecd8")
    draw = ImageDraw.Draw(img)

    # Lined paper
    for y in range(210, HEIGHT - 80, 70):
        draw.line([(80, y), (WIDTH - 80, y)], fill="#d7c9a8", width=2)

    # Margin rule
    draw.line([(150, 180), (150, HEIGHT - 70)], fill="#e8b4b4", width=3)

    # Header band
    draw.rounded_rectangle([60, 48, WIDTH - 60, 250], radius=18, fill="#fffaf0", outline="#cbb892", width=2)

    title_font = load_font(FONT_BOLD, 42)
    label_font = load_font(FONT_REG, 28)
    body_font = load_font(FONT_REG, 52)
    small_font = load_font(FONT_REG, 22)

    draw.text((90, 68), title, font=title_font, fill="#5c4a32")
    draw.text((90, 140), "Name:", font=label_font, fill="#7a6a52")
    draw.line([(190, 172), (520, 172)], fill="#7a6a52", width=2)
    draw.text((560, 140), "Date:", font=label_font, fill="#7a6a52")
    draw.line([(640, 172), (980, 172)], fill="#7a6a52", width=2)

    words: list[dict] = []
    word_id = 0

    def add_skip(text: str, box: dict, line_index: int = -1) -> None:
        nonlocal word_id
        words.append(
            {
                "id": f"skip-{word_id}",
                "text": text,
                "normalized": text.lower().strip(".:"),
                "lineIndex": line_index,
                "box": box,
                "skip": True,
            }
        )
        word_id += 1

    title_x = 90
    for part in title.split(" "):
        add_skip(part, word_box(draw, title_font, part, (title_x, 68)), -1)
        title_x += int(draw.textlength(part + " ", font=title_font))
    add_skip("Name:", word_box(draw, label_font, "Name:", (90, 140)), -1)
    add_skip("Date:", word_box(draw, label_font, "Date:", (560, 140)), -1)

    line_y = [420, 560, 700, 840][: len(lines)]
    for line_index, (line, y) in enumerate(zip(lines, line_y, strict=True)):
        x = 180
        parts = line.split(" ")
        for part in parts:
            draw.text((x, y), part, font=body_font, fill="#2a241c")
            box = word_box(draw, body_font, part, (x, y))
            bare = part.strip(".,!?")
            words.append(
                {
                    "id": f"w-{word_id}",
                    "text": bare,
                    "display": part,
                    "normalized": bare.lower(),
                    "lineIndex": line_index,
                    "box": box,
                    "skip": False,
                }
            )
            word_id += 1
            gap = draw.textlength(" ", font=body_font)
            x += draw.textlength(part, font=body_font) + gap

    draw.text((80, HEIGHT - 56), footer, font=small_font, fill="#9a8b70")

    png_name = "workbook.png" if stem == "puppy" else f"{stem}.png"
    json_name = "workbook.ocr.json" if stem == "puppy" else f"{stem}.ocr.json"
    png_path = OUT_DIR / png_name
    img.save(png_path, "PNG")

    payload = {
        "source": "fixture",
        "imageWidth": WIDTH,
        "imageHeight": HEIGHT,
        "imageUrl": f"/fixtures/{png_name}",
        "lines": [{"index": i, "text": line} for i, line in enumerate(lines)],
        "words": words,
    }
    json_path = OUT_DIR / json_name
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {png_path}")
    print(f"wrote {json_path}")
    print("reading words:", [w["text"] for w in words if not w["skip"]])


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    render_page("puppy", "My Reading Page", "Read With Me  ·  sample workbook page", READING_LINES)
    for page in EXTRA_PAGES:
        render_page(page["stem"], page["title"], page["footer"], page["lines"])


if __name__ == "__main__":
    main()
