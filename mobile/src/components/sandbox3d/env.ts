// ── A studio, in 64 by 32 pixels ──
//
// Without an environment map, a physically based material with any metalness
// at all renders nearly black, because metal has no diffuse response and there
// is nothing for it to reflect. That is why the legs, the gold header pins and
// the LED domes need one: they are the surfaces that carry the "real object"
// read, and they carry it through reflection.
//
// Loading an HDR would mean a network fetch, a decoder and a megabyte. This
// builds one instead: a soft sky to ground gradient with a warm key above and
// slightly forward, run through three's own PMREM prefilter. It is a few
// milliseconds once, at startup, and it is the single biggest jump in how
// finished the scene looks.

import * as THREE from 'three';

const W = 64;
const H = 32;

/** Linear space colours: an environment map is radiance, not an image. */
const SKY: [number, number, number] = [0.86, 0.9, 0.98];
const HORIZON: [number, number, number] = [0.78, 0.79, 0.8];
const GROUND: [number, number, number] = [0.3, 0.29, 0.27];
const KEY: [number, number, number] = [2.6, 2.5, 2.3];
/** Unit direction of the key. The scene's directional light matches it. */
export const KEY_DIR: [number, number, number] = [-0.42, 0.82, 0.39];

function equirect(): THREE.DataTexture {
  // three samples an equirectangular map as u = atan2(z, x) / 2pi + 0.5 and
  // v = asin(y) / pi + 0.5, and a DataTexture is not flipped, so row 0 is
  // v = 0 is straight DOWN. Deriving the direction from that formula rather
  // than assuming a layout is the difference between a sky overhead and a sky
  // under the table.
  const data = new Uint16Array(W * H * 4);
  const half = THREE.DataUtils.toHalfFloat;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const up = Math.sin((v - 0.5) * Math.PI);
    const ring = Math.sqrt(Math.max(0, 1 - up * up));
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const phi = (u - 0.5) * Math.PI * 2;
      const dx = Math.cos(phi) * ring;
      const dz = Math.sin(phi) * ring;

      let r: number;
      let g: number;
      let b: number;
      if (up >= 0) {
        const t = Math.pow(up, 0.55);
        r = HORIZON[0] + (SKY[0] - HORIZON[0]) * t;
        g = HORIZON[1] + (SKY[1] - HORIZON[1]) * t;
        b = HORIZON[2] + (SKY[2] - HORIZON[2]) * t;
      } else {
        const t = Math.pow(-up, 0.7);
        r = HORIZON[0] + (GROUND[0] - HORIZON[0]) * t;
        g = HORIZON[1] + (GROUND[1] - HORIZON[1]) * t;
        b = HORIZON[2] + (GROUND[2] - HORIZON[2]) * t;
      }

      // A soft key, high and a little to the front left, aimed exactly where
      // the scene's own directional light is. A highlight that disagrees with
      // the shading is worse than no highlight.
      const dot = dx * KEY_DIR[0] + up * KEY_DIR[1] + dz * KEY_DIR[2];
      const key = Math.pow(Math.max(0, dot), 22);
      r += KEY[0] * key; g += KEY[1] * key; b += KEY[2] * key;

      const i = (y * W + x) * 4;
      data[i] = half(r); data[i + 1] = half(g); data[i + 2] = half(b); data[i + 3] = half(1);
    }
  }
  // Half float rather than full: it is enough range for a key at 3.6 and it is
  // supported on far more contexts, including a WebGL 1 one from expo-gl.
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Prefilter the little sky into an environment three.js can sample.
 *
 * Wrapped, because PMREM needs float render targets and expo-gl does not
 * always hand back a context that supports them. Losing the reflections is a
 * worse looking scene; throwing here would be no scene at all, so the caller
 * gets null and turns the fill light up instead.
 */
export function createEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  let source: THREE.DataTexture | null = null;
  try {
    source = equirect();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(source);
    pmrem.dispose();
    source.dispose();
    return target.texture;
  } catch {
    source?.dispose();
    return null;
  }
}
