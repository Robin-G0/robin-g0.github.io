"""Original 1990s-web-inspired GIFs and deterministic canvas frame strips.

Requires Pillow. No copied sprites: all shapes are drawn here on a 48px grid.
Run: python scripts/create-juggler-art.py
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / "assets/art"
SIZE, FRAMES, DURATION = 96, 12, 120
INK, CYAN, GOLD, WHITE = "#100d35", "#65ffff", "#fff16b", "#fff9e8"


def sparkle(d, x, y, color=WHITE):
    d.line((x - 2, y, x + 2, y), fill=color)
    d.line((x, y - 2, x, y + 2), fill=color)


def floppy(d, frame):
    tilt = round(math.sin(frame * math.tau / FRAMES) * 2)
    d.line((17, 35, 13 + tilt, 41), fill=CYAN, width=3)
    d.line((30, 35, 35 + tilt, 41), fill=CYAN, width=3)
    d.line((12, 21, 5, 15 + tilt), fill=CYAN, width=3)
    d.line((35, 21, 42, 15 - tilt), fill=CYAN, width=3)
    d.polygon([(12, 6), (32, 6), (36, 10), (36, 35), (12, 35)], fill=INK)
    d.polygon([(14, 8), (31, 8), (34, 11), (34, 33), (14, 33)], fill="#ae7dff")
    d.rectangle((18, 8, 29, 17), fill="#e1d7ff")
    d.rectangle((25, 9, 27, 15), fill=INK)
    d.rectangle((17, 22, 31, 31), fill=WHITE)
    d.rectangle((20, 24, 21, 25), fill=INK)
    d.rectangle((27, 24, 28, 25), fill=INK)
    d.arc((21, 24, 28, 29), 0, 180, fill=INK)
    sparkle(d, 7, 31 - frame % 3, GOLD)


def globe(d, frame):
    d.ellipse((6, 5, 41, 40), fill=INK)
    d.ellipse((8, 7, 39, 38), fill="#2046c8")
    d.arc((9, 8, 38, 37), 140, 300, fill=CYAN, width=2)
    # Clip the scrolling continents to the sphere, with a stepped shadow edge.
    shapes = [(-7, -7, 3, -1), (0, -2, 7, 5), (4, 4, 9, 12), (15, -11, 23, -3)]
    for y in range(9, 37):
        for x in range(9, 39):
            if (x - 24) ** 2 + (y - 23) ** 2 > 14 ** 2:
                continue
            longitude = ((x - 24 + frame * 3 + 16) % 40) - 16
            if any(a <= longitude <= c and b <= y - 23 <= e for a, b, c, e in shapes):
                d.point((x, y), fill="#8de67b" if x < 31 else "#45a873")
    d.ellipse((13, 8, 20, 12), fill="#a8f8ff")
    sparkle(d, 42, 8 + frame % 2, GOLD)
    sparkle(d, 5, 38, WHITE)


def mail(d, frame):
    flap = round(math.sin(frame * math.tau / FRAMES) * 5)
    for sign in (-1, 1):
        cx = 24 + sign * 15
        d.polygon([(cx, 22), (cx + sign * 8, 9 + flap),
                   (cx + sign * 7, 24), (cx + sign * 2, 30)], fill=WHITE, outline=INK)
        d.line((cx, 23, cx + sign * 6, 17 + flap), fill="#a7ceeb")
    d.rectangle((11, 15, 36, 33), fill=INK)
    d.rectangle((13, 17, 34, 31), fill=GOLD)
    d.line([(13, 17), (24, 25), (34, 17)], fill="#c37a34", width=2)
    d.line((13, 31, 21, 24), fill="#e5b348")
    d.line((34, 31, 27, 24), fill="#e5b348")
    d.rectangle((29, 19, 32, 22), fill="#f28bb5")


def ball(d, frame):
    d.ellipse((6, 5, 41, 40), fill=INK)
    d.ellipse((8, 7, 39, 38), fill="#ff7aaa")
    cx = 24 + round(math.sin(frame * math.tau / FRAMES) * 9)
    d.pieslice((8, 7, 39, 38), frame * 30, frame * 30 + 100, fill=GOLD)
    d.pieslice((8, 7, 39, 38), frame * 30 + 180, frame * 30 + 260, fill=CYAN)
    d.arc((cx - 10, 7, cx + 10, 38), 100, 260, fill=WHITE, width=2)
    d.ellipse((13, 10, 20, 15), fill=WHITE)
    sparkle(d, 41, 7 + frame % 3)


def slow(d, frame):
    d.polygon([(14, 10), (34, 10), (29, 18), (25, 24), (31, 31),
               (34, 37), (14, 37), (17, 31), (23, 24), (18, 18)], fill=INK)
    d.polygon([(17, 12), (31, 12), (27, 19), (24, 22), (20, 18)], fill="#356099")
    d.polygon([(24, 26), (30, 35), (18, 35)], fill="#356099")
    level = frame // 3
    d.rectangle((19, 13 + level, 28, 16 + level), fill=CYAN)
    d.line((24, 21, 24, 32), fill=WHITE)
    d.polygon([(24, 31 - level), (30, 35), (18, 35)], fill=CYAN)
    d.rectangle((12, 6, 36, 10), fill=CYAN, outline=INK)
    d.rectangle((12, 37, 36, 41), fill=CYAN, outline=INK)
    sparkle(d, 7, 17 + frame % 3)


def net(d, frame):
    d.polygon([(7, 7), (24, 3), (40, 7), (39, 24), (34, 34),
               (24, 43), (14, 35), (8, 25)], fill=INK)
    d.polygon([(10, 10), (24, 6), (37, 10), (36, 24), (31, 32),
               (24, 39), (17, 32), (11, 24)], fill="#244c6f", outline=CYAN)
    for y, width in [(15, 22), (22, 20), (29, 12)]:
        d.line((24 - width // 2, y, 24 + width // 2, y), fill="#588e9c")
    for x in (18, 24, 30):
        d.line((x, 12, x, 32), fill="#588e9c")
    d.line([(17, 22), (22, 27), (31, 17)], fill=GOLD, width=3)
    sparkle(d, 40, 10 + frame % 3, GOLD)


def export(name, draw_sprite):
    frames = []
    for number in range(FRAMES):
        image = Image.new("RGBA", (48, 48))
        draw_sprite(ImageDraw.Draw(image), number)
        # A common opaque foot makes the visible sprite edge touch the catch line.
        aligned = Image.new("RGBA", image.size)
        aligned.paste(image, (0, 48 - image.getbbox()[3]))
        image = aligned
        frames.append(image.resize((SIZE, SIZE), Image.Resampling.NEAREST))
    strip = Image.new("RGBA", (SIZE * FRAMES, SIZE))
    for number, frame in enumerate(frames):
        strip.paste(frame, (number * SIZE, 0))
    strip.save(OUTPUT / f"juggler-{name}-strip.png", optimize=True)
    colors = sorted({pixel[:3] for frame in frames for pixel in pixels(frame) if pixel[3]})
    assert len(colors) < 256
    palette = [0, 0, 0] + [component for color in colors for component in color]
    palette += [0] * (768 - len(palette))
    lookup = {color: index + 1 for index, color in enumerate(colors)}
    indexed = []
    for frame in frames:
        image = Image.new("P", frame.size)
        image.putpalette(palette)
        image.putdata([lookup[pixel[:3]] if pixel[3] else 0 for pixel in pixels(frame)])
        indexed.append(image)
    indexed[0].save(OUTPUT / f"juggler-{name}.gif", save_all=True,
                    append_images=indexed[1:], duration=DURATION, loop=0,
                    transparency=0, disposal=2, optimize=False)


def pixels(image):
    return (image.getpixel((x, y)) for y in range(image.height) for x in range(image.width))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sprites = {"floppy": floppy, "globe": globe, "mail": mail, "ball": ball, "slow": slow, "net": net}
    for name, drawing in sprites.items():
        export(name, drawing)
        print(f"Created {name}: animated GIF + {FRAMES}-frame strip")
    (OUTPUT / "juggler-assets.json").write_text(json.dumps({
        "description": "Original pixel art inspired by 1996-2001 web GIF motifs; not historical downloads.",
        "license": "CC0-1.0", "generator": "scripts/create-juggler-art.py",
        "era_reference": "https://www.lib.ncsu.edu/projects/hall-gifs",
        "frames": FRAMES, "frame_ms": DURATION, "sprites": list(sprites)
    }, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
