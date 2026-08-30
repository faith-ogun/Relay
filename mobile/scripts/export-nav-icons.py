#!/usr/bin/env python3
"""Re-export the tab bar artwork from the 512px sources.

WHY THIS EXISTS. The shipped nav icons were 30x30, 60x60 and 90x90, which meant
they were authored for a 30pt tab. When the captions came off on 2026-08-29 and
the icons grew to 34pt, that was already a 13% upscale on a 3x screen: asking for
102 physical pixels and getting 90. It was absorbed by the soft edges, but it was
the ceiling, and going further would have blurred the linework.

The sources are 512x512 and live in frontend/assets-source/nav/, so nothing had
to be redrawn. This just cuts them again at a size that leaves headroom.

WHAT IT PRESERVES, DELIBERATELY. Not the source's own framing: the ink fraction
of each currently shipped file. Measured before writing this, the ten shipped
icons sit at between 58% and 100% of their canvas, and those numbers are not a
formula, they are the result of somebody normalising the set on its LINEWORK so
that an `off` state and its `on` state are the same visual weight. Scaling the
512 canvas straight down would have thrown that away and made every selected icon
about 6% smaller than it is today.

So each icon is trimmed to its ink, rescaled so the ink occupies the same
fraction of the new canvas as it does of the old one, and re-centred where it
already sat. The set looks identical. It is simply no longer the limit.

Run:  python3 mobile/scripts/export-nav-icons.py [size]
      size defaults to 40 (points), producing 40/80/120px.
"""
import sys
from pathlib import Path

from PIL import Image

MOBILE = Path(__file__).resolve().parent.parent
REPO = MOBILE.parent
SOURCE = REPO / "frontend" / "assets-source" / "nav"
OUT = MOBILE / "assets" / "nav"

# `plans` is Faith's mascot and came in at 1254px rather than 512, so it is
# framed by the rule that produced it rather than by a previous export.
PAINTED = ["learn", "practice", "live", "community", "profile"]
MASCOT_TILE_FRACTION = 0.86

# Measured off community-on@3x rather than guessed: 9px inset and a corner curve
# running y=9 to 25 on a 90px canvas, over a flat fill with NO outline. A gold
# border was the first attempt and it stood out against the other five the moment
# the row was rendered side by side.
PLATE_INSET, PLATE_RADIUS, PLATE_FILL = 0.10, 0.18, (255, 246, 210, 255)


def ink_box(img: Image.Image):
    box = img.split()[3].getbbox()
    if box is None:
        raise SystemExit(f"an icon has no visible pixels at all")
    return box


def reframe(source: Image.Image, reference: Image.Image, size: int) -> Image.Image:
    """Cut `source` to `size`, keeping the ink fraction `reference` already has."""
    ref_w, ref_h = reference.size
    rb = ink_box(reference)
    frac_w, frac_h = (rb[2] - rb[0]) / ref_w, (rb[3] - rb[1]) / ref_h
    # Where the ink sits, as a fraction, so an icon that is deliberately low or
    # left in its tile stays there.
    cx = ((rb[0] + rb[2]) / 2) / ref_w
    cy = ((rb[1] + rb[3]) / 2) / ref_h

    ink = source.crop(ink_box(source))
    w = max(1, round(size * frac_w))
    h = max(1, round(size * frac_h))
    ink = ink.resize((w, h), Image.LANCZOS)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(ink, (round(size * cx - w / 2), round(size * cy - h / 2)), ink)
    return out


def plate(size: int) -> Image.Image:
    from PIL import ImageDraw

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    i = round(size * PLATE_INSET)
    ImageDraw.Draw(img).rounded_rectangle(
        [i, i, size - 1 - i, size - 1 - i], radius=round(size * PLATE_RADIUS), fill=PLATE_FILL
    )
    return img


def main() -> None:
    size = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    print(f"  exporting the nav set at {size}pt ({size}/{size*2}/{size*3}px)")

    for name in PAINTED:
        for state in ("off", "on"):
            src = Image.open(SOURCE / f"{name}-{state}.png").convert("RGBA")
            ref = Image.open(OUT / f"{name}-{state}@3x.png").convert("RGBA")
            for suffix, px in (("", size), ("@2x", size * 2), ("@3x", size * 3)):
                reframe(src, ref, px).save(OUT / f"{name}-{state}{suffix}.png")
        print(f"    {name}")

    mascot = Image.open(SOURCE / "plans-source.png").convert("RGBA")
    ink = mascot.crop(ink_box(mascot))
    side = max(ink.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(ink, ((side - ink.width) // 2, (side - ink.height) // 2))
    for suffix, px in (("", size), ("@2x", size * 2), ("@3x", size * 3)):
        art = square.resize((round(px * MASCOT_TILE_FRACTION),) * 2, Image.LANCZOS)
        at = ((px - art.width) // 2, (px - art.height) // 2)
        off = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        off.paste(art, at, art)
        off.save(OUT / f"plans-off{suffix}.png")
        on = plate(px)
        on.paste(art, at, art)
        on.save(OUT / f"plans-on{suffix}.png")
    print("    plans")

    print(f"\n  Set ICON in mobile/src/components/TabBar.tsx to {size}.")


if __name__ == "__main__":
    main()
