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

`plans` is the exception, because it has no previous export to preserve: it is
framed against the MEASURED average of the other five instead.

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

PAINTED = ["learn", "practice", "live", "community", "profile"]

# `plans` arrives as one image holding BOTH states side by side: ink linework on
# the left, full colour on its own plate on the right. That is the same shape as
# the painted set, so it needs splitting rather than compositing. An earlier
# version of this script drew the plate itself, because the first mascot Faith
# sent had only one state; it does not have to any more.
PLANS_STATES = "plans-states.png"

# Measured across the five painted icons at 120px rather than assumed: their off
# states run 62% to 75% of the tile and their on states 92% to 100%. Cutting the
# plans plate at the 80% I had read off the OLD 90px files made it visibly the
# small one in a rendered row.
OFF_FRACTION, ON_FRACTION = 0.69, 0.95


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


def solid_box(img: Image.Image, threshold: int = 120):
    """The ink, ignoring the faint halo a generated PNG carries around its edge."""
    box = img.split()[3].point(lambda v: 255 if v >= threshold else 0).getbbox()
    if box is None:
        raise SystemExit("an icon state has no visible pixels at all")
    return box


def fit(ink: Image.Image, size: int, fraction: float) -> Image.Image:
    """Centre `ink` on a square tile, at `fraction` of its longest side."""
    box = round(size * fraction)
    scale = min(box / ink.width, box / ink.height)
    art = ink.resize((max(1, round(ink.width * scale)), max(1, round(ink.height * scale))), Image.LANCZOS)
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    return tile


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

    sheet = Image.open(SOURCE / PLANS_STATES).convert("RGBA")
    half = sheet.width // 2
    states = {
        "off": sheet.crop((0, 0, half, sheet.height)),
        "on": sheet.crop((half, 0, sheet.width, sheet.height)),
    }
    for state, fraction in (("off", OFF_FRACTION), ("on", ON_FRACTION)):
        ink = states[state].crop(solid_box(states[state]))
        for suffix, px in (("", size), ("@2x", size * 2), ("@3x", size * 3)):
            fit(ink, px, fraction).save(OUT / f"plans-{state}{suffix}.png")
    print("    plans")

    print(f"\n  Set ICON in mobile/src/components/TabBar.tsx to {size}.")


if __name__ == "__main__":
    main()
