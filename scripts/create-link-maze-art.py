"""Original pixel art for Link Maze. Requires Pillow; no downloaded source images.

Generate shareable GIF loops and matching PNG frame strips. The canvas game uses
the strips so animation advances on its own simulation clock and can freeze for
reduced motion. Run from any directory: python scripts/create-link-maze-art.py.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "art"
SIZE, FRAMES, DURATION = 96, 8, 120
INK, GOLD, CYAN, GREEN, PINK = "#100927", "#fff15a", "#63ffff", "#8affba", "#ff8aa9"


def sparkle(draw, x, y, color):
    draw.line((x - 2, y, x + 2, y), fill=color)
    draw.line((x, y - 2, x, y + 2), fill=color)


def coin(draw, frame):
    width = [16, 13, 8, 4, 3, 5, 10, 14][frame]
    left, right = 16 - width // 2, 16 + width // 2
    draw.ellipse((left + 1, 6, right + 1, 27), fill=INK)
    draw.ellipse((left, 4, right, 25), fill=GOLD, outline=INK, width=1)
    if width >= 6:
        draw.arc((left + 2, 6, right - 2, 23), 80, 260, fill="#c77a20", width=2)
    if width >= 10:
        draw.line((16, 9, 16, 19), fill=INK, width=2)
        draw.line((12, 14, 20, 14), fill=INK, width=2)
    sparkle(draw, 5 + frame % 2, 6, GREEN)
    sparkle(draw, 27, 22 - frame % 3, "#ffffff")


def hourglass(draw, frame, negative=False):
    color = PINK if negative else GREEN
    draw.polygon([(8, 5), (24, 5), (21, 11), (17, 15), (21, 19), (24, 26),
                  (8, 26), (11, 19), (15, 15), (11, 11)], fill=INK)
    draw.polygon([(10, 7), (22, 7), (20, 11), (16, 14), (12, 11)], fill="#285b70")
    draw.polygon([(12, 19), (16, 16), (20, 19), (22, 24), (10, 24)], fill="#285b70")
    level = frame if negative else 7 - frame
    draw.rectangle((12, 8, 20, 8 + level // 2), fill=GOLD)
    draw.polygon([(16, 21 - level // 2), (21, 24), (11, 24)], fill=GOLD)
    draw.line((16, 14, 16, 20), fill="#ffffff" if frame % 2 else GOLD)
    draw.rectangle((6, 3, 26, 6), fill=color, outline=INK)
    draw.rectangle((6, 25, 26, 28), fill=color, outline=INK)
    draw.line((23, 11, 28, 11), fill=color, width=2)
    if not negative:
        draw.line((26, 8, 26, 14), fill=color, width=2)


def reveal(draw, frame):
    draw.line((20, 21, 28, 29), fill=INK, width=7)
    draw.line((20, 21, 27, 28), fill="#ffbe70", width=4)
    draw.ellipse((3, 3, 25, 25), fill=INK)
    draw.ellipse((5, 5, 23, 23), fill="#184361", outline=CYAN, width=2)
    draw.polygon([(7, 14), (11, 10), (17, 10), (21, 14), (17, 18), (11, 18)], fill="#ffffff")
    pupil = 13 + [0, 1, 2, 1, 0, -1, -2, -1][frame]
    draw.rectangle((pupil, 12, pupil + 2, 16), fill=INK)
    draw.line((7, 7 + frame * 2, 21, 7 + frame * 2), fill=CYAN)


def broken_disk(draw, frame):
    offset = [0, 0, 1, 0, -1, 0, 0, 0][frame]
    draw.polygon([(6 + offset, 4), (23 + offset, 4), (27 + offset, 8),
                  (27 + offset, 28), (6 + offset, 28)], fill=INK)
    draw.polygon([(8 + offset, 6), (22 + offset, 6), (25 + offset, 9),
                  (25 + offset, 26), (8 + offset, 26)], fill=PINK)
    draw.rectangle((11 + offset, 6, 21 + offset, 13), fill="#e9e5ff")
    draw.rectangle((18 + offset, 7, 20 + offset, 11), fill=INK)
    draw.rectangle((10 + offset, 18, 23 + offset, 24), fill=INK)
    draw.line((13 + offset, 21, 20 + offset, 21), fill=PINK, width=2)
    draw.line([(15 + offset, 13), (12 + offset, 16), (18 + offset, 17),
               (16 + offset, 22), (19 + offset, 27)], fill="#ffffff", width=1)
    if frame in (2, 3, 4):
        sparkle(draw, 4, 12, GOLD)


def swap_sign(draw, frame):
    draw.polygon([(16, 1), (31, 29), (1, 29)], fill=INK)
    draw.polygon([(16, 4), (28, 27), (4, 27)], fill=GOLD)
    for x in range(-12 + frame % 4, 35, 8):
        draw.polygon([(x, 28), (x + 3, 28), (x + 6, 31), (x + 3, 31)], fill="#ff9a35")
    draw.line((10, 16, 22, 16), fill=INK, width=2)
    draw.line([(14, 12), (10, 16), (14, 19)], fill=INK, width=2)
    draw.line((10, 22, 22, 22), fill=INK, width=2)
    draw.line([(18, 19), (22, 22), (18, 25)], fill=INK, width=2)


def make_frames(effect):
    frames = []
    for frame in range(FRAMES):
        image = Image.new("RGBA", (32, 32))
        draw = ImageDraw.Draw(image)
        if effect == "points":
            coin(draw, frame)
        elif effect in ("seconds", "delay"):
            hourglass(draw, frame, effect == "delay")
        elif effect == "reveal":
            reveal(draw, frame)
        elif effect == "tax":
            broken_disk(draw, frame)
        else:
            swap_sign(draw, frame)
        frames.append(image.resize((SIZE, SIZE), Image.Resampling.NEAREST))
    return frames


def rgba_pixels(image):
    return (image.getpixel((x, y)) for y in range(image.height) for x in range(image.width))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for effect in ("points", "seconds", "reveal", "tax", "delay", "flip"):
        frames = make_frames(effect)
        strip = Image.new("RGBA", (SIZE * FRAMES, SIZE))
        for index, image in enumerate(frames):
            strip.paste(image, (index * SIZE, 0))
        strip.save(OUTPUT / f"maze-{effect}-strip.png", optimize=True)
        # A shared indexed palette keeps GIF transparency stable across frames.
        palette = [16, 9, 39] + [0, 0, 0] * 255
        colors = sorted({p[:3] for image in frames for p in rgba_pixels(image) if p[3]})
        for index, color in enumerate(colors, 1):
            palette[index * 3:index * 3 + 3] = color
        lookup = {color: index for index, color in enumerate(colors, 1)}
        indexed = []
        for image in frames:
            result = Image.new("P", image.size)
            result.putpalette(palette)
            result.putdata([lookup[p[:3]] if p[3] else 0 for p in rgba_pixels(image)])
            indexed.append(result)
        indexed[0].save(OUTPUT / f"maze-{effect}.gif", save_all=True,
                        append_images=indexed[1:], duration=DURATION, loop=0,
                        transparency=0, disposal=2, optimize=False)
        print(f"Created {effect}: GIF + {FRAMES}-frame PNG strip")


if __name__ == "__main__":
    main()
