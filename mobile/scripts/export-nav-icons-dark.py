#!/usr/bin/env python3
"""Dark-theme variants of the UNSELECTED nav icons.

The problem, found when dark mode landed on 2026-09-01: `assets/nav/*-off.png`
are ink outlines over light fills, drawn to sit on a white tab bar. On the dark
bar (#171b24) the ink outline is nearly the same value as the ground, so `learn`
reads as a smudge and `plans` all but disappears. `practice`, `live` and
`profile` survive only because they are mostly filled shapes, which is luck
rather than design.

`tintColor` was tried and reverted: it recolours EVERY opaque pixel, so the icons
that survive do so precisely because they are filled, and tinting turns exactly
those into solid blobs.

What works instead is a luminance inversion that keeps hue and alpha:

    ink outline (dark)  ->  light stroke
    light fill          ->  dark fill, close to the bar
    alpha               ->  untouched, so the silhouette is identical

That is the same relationship the theme applies everywhere else: ink and surface
swap, the accent does not move. Saturated pixels keep their hue by construction,
because only the value channel is flipped.

The SELECTED (-on) icons need nothing. They carry their own cream plate, which
is the point of a selected state, and it reads on either bar.

    python3 scripts/export-nav-icons-dark.py
"""
from pathlib import Path
import colorsys
import numpy as np
from PIL import Image

NAV = Path(__file__).resolve().parent.parent / "assets" / "nav"
# Keep the darkest ink from becoming pure white: a stroke at full white on a
# near-black bar glares, where the light bar's ink never did.
CEILING = 0.92
# And keep the lightest fills from becoming pure black, so the shape still has
# interior structure against the bar rather than punching a hole in it.
FLOOR = 0.10


def invert_value(img: Image.Image) -> Image.Image:
    """Flip HSV value, keep hue, saturation and alpha."""
    a = np.array(img.convert("RGBA")).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]

    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    v2 = FLOOR + (1.0 - v) * (CEILING - FLOOR)

    # Hue is preserved by scaling the original channels, except where the pixel
    # is essentially grey, where a scale would amplify rounding noise into a
    # colour cast. Those are rebuilt flat.
    scale = np.where(v > 1e-6, v2 / np.maximum(v, 1e-6), 0.0)[..., None]
    out = np.clip(rgb * scale, 0, 1)
    grey = (s < 0.06)[..., None]
    out = np.where(grey, v2[..., None], out)

    return Image.fromarray((np.concatenate([out, alpha], axis=-1) * 255).astype(np.uint8), "RGBA")


def report(tag: str, img: Image.Image) -> None:
    a = np.array(img).astype(float)
    vis = a[..., 3] > 24
    lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[vis]
    print(f"  {tag:22} mean luminance {lum.mean():>5.0f}   "
          f"dark<80 {(lum < 80).mean() * 100:>3.0f}%   light>200 {(lum > 200).mean() * 100:>3.0f}%")


def main() -> None:
    names = sorted({p.name.split("-off")[0] for p in NAV.glob("*-off*.png")})
    print(f"Dark variants for {len(names)} unselected icons: {', '.join(names)}\n")
    for name in names:
        for suffix in ("", "@2x", "@3x"):
            src = NAV / f"{name}-off{suffix}.png"
            if not src.exists():
                continue
            out = invert_value(Image.open(src))
            out.save(NAV / f"{name}-offdark{suffix}.png")
            if suffix == "@3x":
                report(f"{name}-off  (light bar)", Image.open(src).convert("RGBA"))
                report(f"{name}-offdark", out)
    print("\n  Written as *-offdark*.png beside the originals.")


if __name__ == "__main__":
    main()
