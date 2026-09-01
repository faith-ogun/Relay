// ── Painting a board's printing, in pixels ──
//
// The breadboard's silkscreen and the Uno's are drawn into a texture here
// rather than modelled as geometry. That single decision is most of why this
// scene runs at sixty frames on a phone: the web version spends about 1,700
// draw calls putting a ring and a hole under every tie point and a Text mesh
// under every label, and all of it collapses into one quad and one instanced
// mesh once the detail lives in a texture instead.
//
// React Native has no canvas, so the pixels are written by hand into a typed
// array and handed to three.js as a DataTexture. That is not a workaround, it
// is the cheaper path: no canvas allocation, no readback, and the whole thing
// is pure arithmetic that a Node script can run and check.
//
// Coordinates are BOARD INCHES with the origin at the board's centre, so a
// call reads as the dimension it is drawing. v = 0 is the far edge (negative
// z), matching the UVs written in geometry/quad.ts.

import * as THREE from 'three';
import { GLYPH_GAP, GLYPH_H, GLYPH_W, glyph, textWidth } from './glyphs';

/** Red, green, blue, alpha, each 0 to 255. */
export type Rgba = readonly [number, number, number, number];

export function rgb(hex: number, alpha = 255): Rgba {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, alpha];
}

export type TextAlign = 'left' | 'center' | 'right';

export class Painter {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    /** Board size in inches that the texture covers. */
    readonly spanX: number,
    readonly spanZ: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
  }

  private get pxPerInchX(): number { return this.width / this.spanX; }
  private get pxPerInchZ(): number { return this.height / this.spanZ; }

  private colOf(x: number): number { return (x / this.spanX + 0.5) * this.width; }
  private rowOf(z: number): number { return (z / this.spanZ + 0.5) * this.height; }

  /** Alpha composite one pixel. Coverage 0 to 1 scales the source alpha. */
  private blend(col: number, row: number, c: Rgba, coverage: number): void {
    if (col < 0 || row < 0 || col >= this.width || row >= this.height) return;
    const a = (c[3] / 255) * coverage;
    if (a <= 0) return;
    const i = (row * this.width + col) * 4;
    const d = this.data;
    const inv = 1 - a;
    // Straight alpha over an opaque background. The board is filled first, so
    // the destination alpha is always 255 by the time anything is layered.
    d[i] = c[0] * a + d[i] * inv;
    d[i + 1] = c[1] * a + d[i + 1] * inv;
    d[i + 2] = c[2] * a + d[i + 2] * inv;
    d[i + 3] = Math.max(d[i + 3], c[3] * coverage);
  }

  fill(c: Rgba): void {
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3];
    }
  }

  /** An axis aligned rectangle, centred on (x, z), sized in inches. */
  rect(x: number, z: number, w: number, h: number, c: Rgba): void {
    const c0 = Math.round(this.colOf(x - w / 2));
    const c1 = Math.round(this.colOf(x + w / 2));
    const r0 = Math.round(this.rowOf(z - h / 2));
    const r1 = Math.round(this.rowOf(z + h / 2));
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) this.blend(col, row, c, 1);
    }
  }

  /**
   * A filled circle with a one pixel feather.
   *
   * The feather matters at this scale: a hole ring is about seventeen pixels
   * across, and a hard edged circle that small reads as a polygon once the
   * mipmap chain gets involved.
   */
  disc(x: number, z: number, radius: number, c: Rgba): void {
    this.annulus(x, z, 0, radius, c);
  }

  /** A ring between two radii, in inches. */
  ring(x: number, z: number, inner: number, outer: number, c: Rgba): void {
    this.annulus(x, z, inner, outer, c);
  }

  private annulus(x: number, z: number, inner: number, outer: number, c: Rgba): void {
    const cx = this.colOf(x);
    const cz = this.rowOf(z);
    const rx = outer * this.pxPerInchX;
    const rz = outer * this.pxPerInchZ;
    const ix = inner * this.pxPerInchX;
    const iz = inner * this.pxPerInchZ;
    const c0 = Math.floor(cx - rx - 1);
    const c1 = Math.ceil(cx + rx + 1);
    const r0 = Math.floor(cz - rz - 1);
    const r1 = Math.ceil(cz + rz + 1);

    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        // Normalised radius in an ellipse, because the texture's pixels are not
        // square: the board is three times as long as it is wide and the
        // texture is four times as wide as it is tall.
        const dx = (col + 0.5 - cx) / rx;
        const dz = (row + 0.5 - cz) / rz;
        const d = Math.sqrt(dx * dx + dz * dz);
        const featherOut = 1 / Math.max(rx, rz);
        let cover = Math.min(1, Math.max(0, (1 - d) / featherOut + 0.5));
        if (inner > 0) {
          const di = Math.sqrt(
            ((col + 0.5 - cx) / ix) ** 2 + ((row + 0.5 - cz) / iz) ** 2,
          );
          const featherIn = 1 / Math.max(ix, iz);
          cover = Math.min(cover, Math.min(1, Math.max(0, (di - 1) / featherIn + 0.5)));
        }
        if (cover > 0) this.blend(col, row, c, cover);
      }
    }
  }

  /**
   * Text, in the 5 by 7 silkscreen font.
   *
   * `size` is the cap height in inches. Real breadboard printing is about
   * 0.055 inch tall, which is what makes it readable when the camera is over
   * the board and an unreadable smudge when it is not, exactly like the object
   * on the desk.
   */
  text(
    s: string,
    x: number,
    z: number,
    size: number,
    c: Rgba,
    align: TextAlign = 'center',
    /** Quarter turns clockwise, for labels printed along the board's length. */
    turns = 0,
  ): void {
    const unit = size / GLYPH_H;                       // inches per glyph pixel
    const w = textWidth(s) * unit;
    const startAlong = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;

    for (let i = 0; i < s.length; i++) {
      const cols = glyph(s[i]);
      const glyphAlong = startAlong + i * (GLYPH_W + GLYPH_GAP) * unit;
      for (let gx = 0; gx < GLYPH_W; gx++) {
        const bits = cols[gx];
        if (!bits) continue;
        for (let gy = 0; gy < GLYPH_H; gy++) {
          if (!(bits & (1 << gy))) continue;
          const along = glyphAlong + gx * unit;
          const across = (gy - GLYPH_H / 2) * unit;
          // Rotate the glyph pixel about the anchor, then place it.
          let px: number;
          let pz: number;
          switch (turns & 3) {
            case 1: px = x - across; pz = z + along; break;
            case 2: px = x - along; pz = z - across; break;
            case 3: px = x + across; pz = z - along; break;
            default: px = x + along; pz = z + across;
          }
          this.rect(px + unit / 2, pz + unit / 2, unit, unit, c);
        }
      }
    }
  }

  /**
   * A soft linear shade across a band, for the moulded look of a plastic edge.
   *
   * Flat colour is the tell of a rendered object. A real breadboard has a
   * gradient down into the ravine and a slight darkening under the rail
   * printing, and that shading is free here because it is already a texture.
   */
  shade(x: number, z: number, w: number, h: number, from: Rgba, to: Rgba): void {
    const c0 = Math.round(this.colOf(x - w / 2));
    const c1 = Math.round(this.colOf(x + w / 2));
    const r0 = Math.round(this.rowOf(z - h / 2));
    const r1 = Math.round(this.rowOf(z + h / 2));
    const span = Math.max(1, r1 - r0);
    for (let row = r0; row < r1; row++) {
      const t = (row - r0) / span;
      const c: Rgba = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
        from[3] + (to[3] - from[3]) * t,
      ];
      for (let col = c0; col < c1; col++) this.blend(col, row, c, 1);
    }
  }

  /**
   * Hand the pixels to three.js.
   *
   * Anisotropy is left to the caller because it needs the renderer's real
   * limit, and mipmaps are on: the board is viewed at a grazing angle most of
   * the time, which is precisely the case that aliases without them.
   */
  texture(): THREE.DataTexture {
    const tex = new THREE.DataTexture(this.data, this.width, this.height, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }
}
