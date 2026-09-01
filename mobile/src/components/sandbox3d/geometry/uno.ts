// ── The Arduino Uno ──
//
// It is here because the sandbox needs a source. A breadboard on its own has
// no volts in it, and the first wire in every build in the curriculum runs
// from this board's 5V pin to the positive rail. Modelling the supply as an
// abstract "power" block would teach a learner something that is not true of
// the thing on their desk.
//
// Same technique as the breadboard: the whole silkscreen (the pin numbers,
// DIGITAL PWM, ANALOG IN, POWER, the logo, the trace hints) is painted into
// one texture, and only the parts with real height are geometry.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PITCH, UNO, UNO_PINS, UNO_TOP } from '../boardSpec';
import { GLYPH_H, textWidth } from '../glyphs';
import { Painter, rgb, type Rgba } from '../painter';
import { materialFor, mergeSingle, MeshBuilder } from './builder';
import type { MaterialLibrary } from '../materials';

const TEX = 1024;

const TEAL: Rgba = rgb(0x0b7f82);
const TEAL_LIGHT: Rgba = rgb(0x0d9295);
const TEAL_DARK: Rgba = rgb(0x086063);
const SILK: Rgba = rgb(0xcfe9e9);
const SILK_SOFT: Rgba = rgb(0x8fc4c5, 190);
const PAD: Rgba = rgb(0xc9a227);

/** Paint the Uno's solder mask and silkscreen. */
export function paintUno(): THREE.DataTexture {
  const p = new Painter(TEX, TEX, UNO.length, UNO.width);
  p.fill(TEAL);

  // Copper pour shows through the mask as a slightly lighter field, and the
  // board is darker at its edges where the mask thins. Flat teal is the tell.
  p.shade(0, -UNO.width / 4, UNO.length, UNO.width / 2, TEAL_DARK, TEAL_LIGHT);
  p.shade(0, UNO.width / 4, UNO.length, UNO.width / 2, TEAL_LIGHT, TEAL_DARK);

  // Trace hints: not a routing, but the direction and density of the fan out
  // from the headers, which is what the eye actually reads on a PCB. Faint on
  // purpose. Legible stripes read as a barcode, not as copper under mask.
  const TRACE: Rgba = [6, 70, 72, 90];
  for (let i = 0; i < 16; i++) {
    p.rect(-0.62 + i * 0.1, -0.56, 0.012, 0.24, TRACE);
  }
  for (let i = 0; i < 12; i++) {
    p.rect(-0.55 + i * 0.1, 0.58, 0.01, 0.2, TRACE);
  }

  // Header pads.
  for (const pin of UNO_PINS) p.ring(pin.x, pin.z, 0.018, 0.032, PAD);

  // Pin labels, on the inboard side of each header so a jumper does not cover
  // them. This is the difference between a wiring instruction a learner can
  // follow and one they have to guess at.
  //
  // The size is fitted to the 0.1 inch pitch rather than fixed, because "3V3"
  // and "AREF" are three and four characters in the space "9" gets, and a
  // fixed size runs them into their neighbours until the whole header reads as
  // one long word. A real Arduino solves it the same way: the multi character
  // labels are printed noticeably smaller.
  for (const pin of UNO_PINS) {
    const inward = pin.z < 0 ? 0.07 : -0.07;
    const size = Math.min(0.05, (0.088 / textWidth(pin.label)) * GLYPH_H);
    p.text(pin.label, pin.x, pin.z + inward, size, SILK);
  }

  p.text('DIGITAL (PWM~)', 0.25, -0.92, 0.06, SILK);
  p.text('ANALOG IN', 0.57, 0.92, 0.06, SILK);
  p.text('POWER', -0.35, 0.92, 0.06, SILK);
  p.text('ARDUINO', -0.18, 0.14, 0.11, SILK);
  p.text('UNO', -0.18, 0.33, 0.16, SILK);
  p.text('ON', 0.66, 0.5, 0.05, SILK);
  p.text('L', 0.66, 0.62, 0.05, SILK);
  p.text('RESET', -1.02, -0.62, 0.05, SILK_SOFT);
  p.text('ICSP', 1.06, 0.06, 0.05, SILK_SOFT, 'center', 1);

  // The infinity logo, two rings with a plus and a minus.
  p.ring(-0.86, 0.14, 0.055, 0.075, SILK);
  p.ring(-0.72, 0.14, 0.055, 0.075, SILK);
  p.rect(-0.86, 0.14, 0.07, 0.016, SILK);
  p.rect(-0.72, 0.14, 0.07, 0.016, SILK);
  p.rect(-0.72, 0.14, 0.016, 0.07, SILK);

  return p.texture();
}

/**
 * Build the Uno.
 *
 * Authored with the top of the PCB at local y = 0, so the scene only has to
 * lift the whole group to the table's board height.
 */
export function buildUno(materials: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'uno';

  // Substrate: a darker box just below the masked top, so the FR-4 edge is
  // visible the way it is on a real board.
  const substrate = new RoundedBoxGeometry(UNO.length, UNO.pcb, UNO.width, 2, 0.03);
  substrate.translate(0, -UNO.pcb / 2, 0);
  const edge = new THREE.Mesh(substrate, materials.pcbEdge);
  edge.receiveShadow = true;
  group.add(edge);

  // The masked top face, carrying the silkscreen.
  const top = new THREE.PlaneGeometry(UNO.length - 0.06, UNO.width - 0.06);
  top.rotateX(-Math.PI / 2);
  top.translate(0, 0.002, 0);
  const topMesh = new THREE.Mesh(top, materials.pcb);
  topMesh.receiveShadow = true;
  group.add(topMesh);

  // Headers: one black housing per run, and the gold pins inside them.
  const housings = new MeshBuilder();
  // Centre x, centre z and length of each header run, matching the pin
  // positions in boardSpec. They are stated rather than derived so a housing
  // can never end up shorter than the pins it is meant to hold.
  const runs: Array<[number, number, number]> = [
    [-0.27, -0.78, 0.8],   // AREF, GND, 13 down to 8
    [0.59, -0.78, 0.8],    // 7 down to 0
    [-0.32, 0.78, 0.7],    // power
    [0.57, 0.78, 0.6],     // analog
  ];
  for (const [x, z, len] of runs) {
    housings.add(new THREE.BoxGeometry(len, 0.09, 0.1), materials.headerPlastic, { pos: [x, 0.045, z] });
  }
  const housing = housings.build();
  const housingMesh = new THREE.Mesh(housing.geometry, materialFor(housing.materials));
  housingMesh.castShadow = true;
  group.add(housingMesh);

  const pins: THREE.BufferGeometry[] = [];
  for (const pin of UNO_PINS) {
    const socket = new THREE.BoxGeometry(0.05, 0.012, 0.05);
    socket.translate(pin.x, 0.092, pin.z);
    pins.push(socket);
    const barrel = new THREE.CylinderGeometry(0.02, 0.02, 0.07, 6);
    barrel.translate(pin.x, 0.055, pin.z);
    pins.push(barrel);
  }
  const pinMesh = new THREE.Mesh(mergeSingle(pins), materials.pinGold);
  group.add(pinMesh);

  // Everything with real height. All merged into one object, so the whole of
  // the Uno's furniture is a handful of draw calls.
  const b = new MeshBuilder();

  // USB-B socket: the tallest thing on the board and the one that fixes its
  // orientation at a glance.
  b.add(new RoundedBoxGeometry(0.44, 0.22, 0.5, 2, 0.02), materials.canMetal, { pos: [-1.16, 0.11, 0.1] });
  b.add(new THREE.BoxGeometry(0.36, 0.13, 0.38), materials.icBlack, { pos: [-1.2, 0.11, 0.1] });

  // Barrel jack.
  b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 16), materials.icBlack, {
    pos: [-1.05, 0.16, -0.6], rot: [Math.PI / 2, 0, 0],
  });
  b.add(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 10), materials.canMetal, {
    pos: [-1.05, 0.16, -0.6], rot: [Math.PI / 2, 0, 0],
  });

  // ATmega328P in a DIP-28, with its pin 1 notch.
  b.add(new RoundedBoxGeometry(0.6, 0.08, 0.28, 2, 0.012), materials.icBlack, { pos: [0.12, 0.04, 0.1] });
  for (let i = 0; i < 14; i++) {
    const x = 0.12 - 0.247 + i * 0.038;
    b.add(new THREE.BoxGeometry(0.022, 0.012, 0.05), materials.pinGold, { pos: [x, 0.012, 0.1 - 0.16] });
    b.add(new THREE.BoxGeometry(0.022, 0.012, 0.05), materials.pinGold, { pos: [x, 0.012, 0.1 + 0.16] });
  }

  // Crystal, regulator and its heatsink tab.
  b.add(new THREE.BoxGeometry(0.18, 0.06, 0.07), materials.canMetal, { pos: [-0.2, 0.03, -0.1] });
  b.add(new THREE.BoxGeometry(0.05, 0.15, 0.16), materials.icBlack, { pos: [-0.5, 0.075, -0.36] });
  b.add(new THREE.BoxGeometry(0.012, 0.13, 0.15), materials.canMetal, { pos: [-0.53, 0.075, -0.36] });

  // Electrolytics.
  for (const x of [-0.72, -0.58]) {
    b.add(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 14), materials.icBlack, { pos: [x, 0.08, -0.2] });
    b.add(new THREE.CylinderGeometry(0.082, 0.082, 0.008, 14), materials.plasticDark, { pos: [x, 0.161, -0.2] });
  }

  // Reset button.
  b.add(new THREE.BoxGeometry(0.11, 0.05, 0.09), materials.plasticWhite, { pos: [-1.0, 0.025, -0.5] });
  b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), materials.plasticWhite, { pos: [-1.0, 0.06, -0.5] });

  // ICSP headers.
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      b.add(new THREE.BoxGeometry(0.05, 0.06, 0.05), materials.pinGold, {
        pos: [1.14 + j * PITCH, 0.03, -0.1 + i * PITCH],
      });
    }
  }

  // Surface mount furniture: a few dark chips so the board is not empty.
  for (const [x, z, w, d] of [
    [-0.9, 0.4, 0.11, 0.07], [-0.74, 0.4, 0.11, 0.07], [-0.58, 0.4, 0.11, 0.07],
    [0.42, -0.1, 0.09, 0.07], [0.66, -0.12, 0.07, 0.055], [0.9, 0.3, 0.09, 0.06],
  ] as Array<[number, number, number, number]>) {
    b.add(new THREE.BoxGeometry(w, 0.025, d), materials.icBlack, { pos: [x, 0.014, z] });
  }

  // The power and pin 13 indicator LEDs.
  b.add(new THREE.BoxGeometry(0.055, 0.022, 0.035), materials.plasticWhite, { pos: [0.78, 0.013, 0.5] });
  b.add(new THREE.BoxGeometry(0.055, 0.022, 0.035), materials.plasticWhite, { pos: [0.78, 0.013, 0.62] });

  const furniture = b.build();
  const furnitureMesh = new THREE.Mesh(furniture.geometry, materialFor(furniture.materials));
  furnitureMesh.castShadow = true;
  group.add(furnitureMesh);

  group.position.set(UNO.x, UNO_TOP, UNO.z);
  return group;
}

/** Attach the painted silkscreen to the shared PCB material. */
export function applyUnoTexture(materials: MaterialLibrary, anisotropy: number): void {
  const tex = paintUno();
  tex.anisotropy = Math.min(8, anisotropy);
  materials.pcb.map = tex;
  materials.pcb.needsUpdate = true;
}

/**
 * The two indicator LEDs, which the scene lights from the running sketch.
 *
 * They are their own meshes rather than part of the merged furniture because
 * pin 13 blinking is the first thing a learner ever gets an Arduino to do, and
 * it has to actually blink.
 */
export function buildUnoIndicators(): {
  power: THREE.Mesh;
  pin13: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
} {
  // Local to the Uno's own group, so moving the board moves its LEDs with it.
  const make = (colour: number, x: number, z: number) => {
    const m = new THREE.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: 0.4, toneMapped: false, roughness: 0.3,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.032), m);
    mesh.position.set(x, 0.016, z);
    return { mesh, m };
  };
  const power = make(0x3fd15f, 0.78, 0.5);
  const pin13 = make(0xf5a524, 0.78, 0.62);
  return { power: power.mesh, pin13: pin13.mesh, materials: [power.m, pin13.m] };
}
