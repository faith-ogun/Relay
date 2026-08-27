// ── One material library, shared by everything ──
//
// Every distinct material three.js has never compiled before costs a shader
// compile, and a compile happens on the frame the object first becomes
// visible. On a phone that is a visible hitch at exactly the wrong moment: the
// one where the learner drops their first part on the board.
//
// So there is one library, built once, and every board, part and wire draws
// from it. Reuse also collapses draw calls, because the renderer can only
// batch by material.
//
// Two deliberate choices in here:
//
//   NO TRANSMISSION. The web LED uses meshPhysicalMaterial with transmission,
//   which makes three.js render the whole scene a second time into a
//   transmission buffer. That is a doubling of cost for a 5 mm dome. A glossy
//   translucent standard material with the environment reflecting in it reads
//   the same at this size and costs one pass.
//
//   LAMBERT WHERE IT DOES NOT SHOW. The board body and the sockets have no
//   metal and no gloss, so they are lit with the cheap shader. The parts, the
//   pins and the legs are the hero surfaces and get the physically based one.

import * as THREE from 'three';
import type { LedColor, WireColor } from './types';
import { LED_EMIT, LED_TINT } from './parts';

/** The brand gold, matching src/theme/tokens.ts. Used for every affordance. */
export const GOLD = 0xfacc2e;
export const GOLD_DEEP = 0xf5b800;
export const INK = 0x14181f;

export interface MaterialLibrary {
  boardPlastic: THREE.MeshLambertMaterial;
  boardTop: THREE.MeshLambertMaterial;
  socket: THREE.MeshLambertMaterial;
  legMetal: THREE.MeshStandardMaterial;
  pinGold: THREE.MeshStandardMaterial;
  headerPlastic: THREE.MeshLambertMaterial;
  pcb: THREE.MeshStandardMaterial;
  pcbEdge: THREE.MeshLambertMaterial;
  icBlack: THREE.MeshStandardMaterial;
  canMetal: THREE.MeshStandardMaterial;
  plasticBlue: THREE.MeshStandardMaterial;
  plasticWhite: THREE.MeshStandardMaterial;
  plasticDark: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  epoxyBrown: THREE.MeshStandardMaterial;
  table: THREE.MeshLambertMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  highlight: THREE.MeshBasicMaterial;
  ghost: THREE.MeshBasicMaterial;
  /** The brand gold as a solid surface: a button cap, a probe tip. */
  accent: THREE.MeshStandardMaterial;
  /** LED domes, by body colour. */
  dome: Record<LedColor, THREE.MeshStandardMaterial>;
  /** Jumper insulation, by colour. */
  wire: Record<WireColor, THREE.MeshStandardMaterial>;
  /** Resistor bodies, keyed by resistance so the colour code is the real one. */
  resistor(ohms: number): THREE.MeshStandardMaterial;
  /** A fresh emissive die. Cloned per LED so each one has its own brightness. */
  die(color: LedColor): THREE.MeshStandardMaterial;
  /** The additive halo under a lit LED. */
  glow(color: LedColor): THREE.MeshBasicMaterial;
  dispose(): void;
}

const WIRE_HEX: Record<WireColor, number> = {
  red: 0xd63b32, black: 0x23262b, blue: 0x2f6fd0, green: 0x3f9e4d,
  yellow: 0xe0b526, orange: 0xdd7a2a, white: 0xe6e8ea,
};

/** The resistor colour code, 0 to 9, then the tolerance gold. */
const BAND_HEX = [
  0x1a1a1a, 0x7a4a1e, 0xc22a22, 0xe07a26, 0xe3c33a,
  0x2f9e4a, 0x2f5fc9, 0x8a4fbf, 0x9aa0a6, 0xf0f0f0,
];
const TOLERANCE_GOLD = 0xc9a227;

/**
 * The four bands a resistor of this value really carries.
 *
 * Reading the bands is a lesson in the curriculum, so the bands on screen have
 * to be the ones on the part. A resistor with invented stripes is a prop.
 */
export function bandColors(ohms: number): number[] {
  const value = Math.max(1, Math.round(ohms));
  let mantissa = value;
  let exponent = 0;
  while (mantissa >= 100) { mantissa = Math.round(mantissa / 10); exponent += 1; }
  while (mantissa < 10) { mantissa *= 10; exponent -= 1; }
  const d1 = Math.floor(mantissa / 10);
  const d2 = mantissa % 10;
  const mult = Math.min(9, Math.max(0, exponent));
  return [BAND_HEX[d1], BAND_HEX[d2], BAND_HEX[mult], TOLERANCE_GOLD];
}

/**
 * A stripe texture holding a resistor's colour code.
 *
 * The obvious build is four little cylinders, one per band, which is four
 * extra draw calls on every resistor. A stripe is one, and it is sharper.
 *
 * One pixel wide and 64 tall, because a cylinder's v runs along its AXIS and
 * its u runs around the circumference. A texture laid out the other way would
 * wrap the colour code around the body like a barber's pole.
 */
function resistorTexture(ohms: number): THREE.DataTexture {
  const H = 64;
  const data = new Uint8Array(H * 4);
  const body = [0xd6, 0xc0, 0x9c];
  for (let i = 0; i < H; i++) {
    data[i * 4] = body[0]; data[i * 4 + 1] = body[1]; data[i * 4 + 2] = body[2]; data[i * 4 + 3] = 255;
  }
  // Three bands grouped at one end and the tolerance band set apart at the
  // other, which is how you know which way round to read it.
  const bands = bandColors(ohms);
  const at = [0.24, 0.36, 0.48, 0.76];
  bands.forEach((hex, i) => {
    const centre = Math.round(at[i] * H);
    for (let d = -2; d <= 2; d++) {
      const y = centre + d;
      if (y < 0 || y >= H) continue;
      data[y * 4] = (hex >> 16) & 255;
      data[y * 4 + 1] = (hex >> 8) & 255;
      data[y * 4 + 2] = hex & 255;
    }
  });
  const tex = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A radial falloff used as the contact shadow under every board and part.
 *
 * A real shadow map for the whole scene is a second render of everything in
 * it, per frame. The parts get one, tightly framed and only redrawn when the
 * board changes; the boards themselves get this instead, which is free and,
 * at a soft edge like the underside of a breadboard, actually more convincing.
 */
function shadowTexture(): THREE.DataTexture {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5) / S - 0.5;
      const dy = (y + 0.5) / S - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      // Squared falloff, which is what an area light under an object gives.
      const a = Math.pow(1 - d, 2.2);
      const i = (y * S + x) * 4;
      data[i] = 8; data[i + 1] = 10; data[i + 2] = 14; data[i + 3] = Math.round(a * 150);
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createMaterials(): MaterialLibrary {
  const owned: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(m: T): T => { owned.push(m); return m; };

  const lambert = (name: string, color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
    keep(Object.assign(new THREE.MeshLambertMaterial({ color, ...extra }), { name }));

  const standard = (name: string, params: THREE.MeshStandardMaterialParameters) =>
    keep(Object.assign(new THREE.MeshStandardMaterial(params), { name }));

  const domeFor = (c: LedColor) => standard(`dome:${c}`, {
    color: LED_TINT[c],
    roughness: 0.14,
    metalness: 0,
    transparent: true,
    opacity: 0.78,
    envMapIntensity: 1.4,
  });

  const wireFor = (c: WireColor) => standard(`wire:${c}`, {
    color: WIRE_HEX[c], roughness: 0.44, metalness: 0.02,
  });

  const resistorCache = new Map<number, THREE.MeshStandardMaterial>();
  const shadowMap = keep(shadowTexture());

  const library: MaterialLibrary = {
    // The moulding of a breadboard is an off white with a warm cast, never a
    // pure white. Pure white on a cream background reads as a hole in the page.
    boardPlastic: lambert('boardPlastic', 0xeceae3),
    boardTop: lambert('boardTop', 0xffffff),
    // The 830 socket faces. White, because the lip and the mouth are two
    // different colours carried on the geometry's own vertices so that both
    // draw in one instanced call, and a tinted base would multiply them both.
    // The polygon offset is what keeps a face that sits five hundredths of a
    // millimetre above the printed top from flickering against it on a device
    // whose depth buffer is only 16 bits.
    socket: lambert('socket', 0xffffff, {
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),

    legMetal: standard('legMetal', { color: 0xc4c9d0, metalness: 0.62, roughness: 0.3, envMapIntensity: 1.1 }),
    pinGold: standard('pinGold', { color: 0xc9a227, metalness: 0.7, roughness: 0.32, envMapIntensity: 1.2 }),
    headerPlastic: lambert('headerPlastic', 0x16171a),

    pcb: standard('pcb', { color: 0xffffff, roughness: 0.58, metalness: 0.04 }),
    pcbEdge: lambert('pcbEdge', 0x055a5c),
    icBlack: standard('icBlack', { color: 0x17181b, roughness: 0.44, metalness: 0.08 }),
    canMetal: standard('canMetal', { color: 0xc6cace, metalness: 0.72, roughness: 0.28, envMapIntensity: 1.15 }),
    plasticBlue: standard('plasticBlue', { color: 0x1f6fd0, roughness: 0.36, metalness: 0 }),
    plasticWhite: standard('plasticWhite', { color: 0xe7eaee, roughness: 0.4, metalness: 0 }),
    plasticDark: standard('plasticDark', { color: 0x14161a, roughness: 0.42, metalness: 0.04 }),
    ceramic: standard('ceramic', { color: 0x9c7a3e, roughness: 0.7, metalness: 0 }),
    epoxyBrown: standard('epoxyBrown', { color: 0x8d5a2f, roughness: 0.55, metalness: 0 }),

    table: lambert('table', 0xf3f0e6),
    contactShadow: keep(Object.assign(new THREE.MeshBasicMaterial({
      map: shadowMap, transparent: true, depthWrite: false, toneMapped: false,
    }), { name: 'contactShadow' })),

    highlight: keep(Object.assign(new THREE.MeshBasicMaterial({
      color: GOLD, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false,
    }), { name: 'highlight' })),
    ghost: keep(Object.assign(new THREE.MeshBasicMaterial({
      color: GOLD_DEEP, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false,
    }), { name: 'ghost' })),
    accent: standard('accent', { color: GOLD, roughness: 0.34, metalness: 0.05 }),

    dome: {
      red: domeFor('red'), green: domeFor('green'), blue: domeFor('blue'),
      yellow: domeFor('yellow'), white: domeFor('white'),
    },
    wire: {
      red: wireFor('red'), black: wireFor('black'), blue: wireFor('blue'),
      green: wireFor('green'), yellow: wireFor('yellow'),
      orange: wireFor('orange'), white: wireFor('white'),
    },

    resistor(ohms: number) {
      // Rounded to three significant figures, because that is all the colour
      // code can express anyway, and it keeps the cache from growing per pixel
      // of a value slider.
      const key = Number(ohms.toPrecision(3));
      let m = resistorCache.get(key);
      if (!m) {
        const tex = keep(resistorTexture(key));
        m = standard(`resistor:${key}`, { map: tex, roughness: 0.52, metalness: 0 });
        resistorCache.set(key, m);
      }
      return m;
    },

    die(color: LedColor) {
      // Not cached and NOT owned by the library: each LED needs its own
      // emissiveIntensity, sharing one would make every LED light together,
      // and the part that asked for it is the thing that knows when it dies.
      return Object.assign(new THREE.MeshStandardMaterial({
        color: LED_EMIT[color],
        emissive: LED_EMIT[color],
        emissiveIntensity: 0.05,
        roughness: 0.35,
        toneMapped: false,
      }), { name: `die:${color}` });
    },

    glow(color: LedColor) {
      // Per LED for the same reason as the die: the halo fades with that one
      // LED's current, not with the board's.
      return Object.assign(new THREE.MeshBasicMaterial({
        color: LED_EMIT[color],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }), { name: `glow:${color}` });
    },

    dispose() {
      for (const m of owned) m.dispose();
      owned.length = 0;
      resistorCache.clear();
    },
  };

  return library;
}
