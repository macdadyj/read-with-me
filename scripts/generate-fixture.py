#!/usr/bin/env python3
"""Render first-grade workbook pages and emit matching OCR JSON."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1440
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "fixtures"
FONT_REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"

PAGES = [
    {
        "stem": "workbook",
        "title": "My Reading Page",
        "caption": "Read With Me  ·  sample workbook page",
        "lines": [
            "The puppy ran down the hill.",
            "Then he sat in the sun.",
            "He was a happy little dog.",
        ],
    },
    {
        "stem": "cat",
        "title": "My Reading Page",
        "caption": "Read With Me  ·  the cat page",
        "lines": [
            "The cat sat on a mat.",
            "Then the cat had a nap.",
        ],
    },
    {
        "stem": "frog",
        "title": "My Reading Page",
        "caption": "Read With Me  ·  the frog page",
        "lines": [
            "A frog can jump high.",
            "The frog sat on a log.",
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


def render_page(page: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (WIDTH, HEIGHT), "#f4ecd8")
    draw = ImageDraw.Draw(img)

    for y in range(210, HEIGHT - 80, 70):
        draw.line([(80, y), (WIDTH - 80, y)], fill="#d7c9a8", width=2)

    draw.line([(150, 180), (150, HEIGHT - 70)], fill="#e8b4b4", width=3)
    draw.rounded_rectangle([60, 48, WIDTH - 60, 250], radius=18, fill="#fffaf0", outline="#cbb892", width=2)

    title_font = load_font(FONT_BOLD, 42)
    label_font = load_font(FONT_REG, 28)
    body_font = load_font(FONT_REG, 52)
    small_font = load_font(FONT_REG, 22)

    draw.text((90, 68), page["title"], font=title_font, fill="#5c4a32")
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

    add_skip("My", word_box(draw, title_font, "My", (90, 68)), -1)
    add_skip("Reading", word_box(draw, title_font, "Reading", (170, 68)), -1)
    add_skip("Page", word_box(draw, title_font, "Page", (390, 68)), -1)
    add_skip("Name:", word_box(draw, label_font, "Name:", (90, 140)), -1)
    add_skip("Date:", word_box(draw, label_font, "Date:", (560, 140)), -1)

    line_y = [420, 560, 700]
    reading_lines: list[str] = page["lines"]
    for line_index, (line, y) in enumerate(zip(reading_lines, line_y, strict=False)):
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

    draw.text((80, HEIGHT - 56), page["caption"], font=small_font, fill="#9a8b70")

    stem = page["stem"]
    png_path = OUT_DIR / f"{stem}.png"
    img.save(png_path, "PNG")

    payload = {
        "source": "fixture",
        "imageWidth": WIDTH,
        "imageHeight": HEIGHT,
        "imageUrl": f"/fixtures/{stem}.png",
        "lines": [{"index": i, "text": line} for i, line in enumerate(reading_lines)],
        "words": words,
    }
    json_path = OUT_DIR / f"{stem}.ocr.json"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {png_path}")
    print(f"wrote {json_path}")
    print("reading words:", [item["text"] for item in words if not item["skip"]])


def main() -> None:
    for page in PAGES:
        render_page(page)


if __name__ == "__main__":
    main()
