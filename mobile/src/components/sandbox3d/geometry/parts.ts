// ── The parts, at their real sizes ──
//
// Every dimension below is the datasheet one, in inches, on a board whose
// pitch is 0.1. That is what makes the scene read as a bench rather than a
// diagram: a 5 mm LED really is more than three pitches tall, a quarter watt
// resistor really is a quarter inch of body between two long leads, and a
// TO-92 transistor really is smaller than either. Scaling parts to look tidy
// is how a 3D scene starts looking like clip art.
//
// Each body is merged into ONE geometry with one group per material and cached
// by kind, so every red LED on the board shares a vertex buffer and every
// 220 ohm resistor shares its band texture. Only the pieces that have to move
// on their own (the emissive die, a motor rotor, a servo horn, a knob, a
// button cap) stay as separate meshes.
//
// The legs are built per instance, because a leg has to reach the hole the
// learner actually chose, and on a real board that is exactly what a leg does:
// it gets bent.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MeshBuilder, flattenUV, materialFor, mergeSingle } from './builder';
import type { MaterialLibrary } from '../materials';
import { partValue } from '../parts';
import type { LedColor, PartKind, PartReading, PlacedPart } from '../types';

/** Where a lead leaves the body, in the part's own frame. */
export interface PartBody {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
  legAnchors: Array<[number, number, number]>;
  /** Radius of the lead wire, so a fat part gets fat legs. */
  legRadius: number;
}

const bodyCache = new Map<string, PartBody>();

/**
 * A part's merged body, cached.
 *
 * `variant` distinguishes a red LED from a blue one and a 220 ohm resistor
 * from a 10k: both change a material, and the cache key has to see it or every
 * resistor on the board would wear the first one's colour code.
 */
export function partBodyGeometry(
  kind: PartKind,
  materials?: MaterialLibrary,
  variant = '',
): PartBody {
  const key = `${kind}:${variant}`;
  const hit = bodyCache.get(key);
  if (hit) return hit;
  if (!materials) throw new Error(`part body ${key} is not built yet and no materials were given`);
  const built = BUILDERS[kind](materials, variant);
  bodyCache.set(key, built);
  return built;
}

/**
 * Drop every cached body.
 *
 * Must be called when the material library it was built against is disposed. A
 * cached body holds direct references to that library's materials, so a second
 * mount reusing the cache would be drawing with materials whose GPU programs
 * have already been freed.
 */
export function clearPartCache(): void {
  for (const body of bodyCache.values()) body.geometry.dispose();
  bodyCache.clear();
}

// ── Primitive helpers ──────────────────────────────────────────────────────

const cyl = (rTop: number, rBottom: number, h: number, seg = 16, open = false) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const sph = (r: number, seg = 14) => new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1));
const dome = (r: number, seg = 20) =>
  new THREE.SphereGeometry(r, seg, seg >> 1, 0, Math.PI * 2, 0, Math.PI / 2);
const rounded = (w: number, h: number, d: number, r: number) =>
  new RoundedBoxGeometry(w, h, d, 2, r);

type BodyBuilder = (m: MaterialLibrary, variant: string) => PartBody;

// ── LED ────────────────────────────────────────────────────────────────────

const buildLed: BodyBuilder = (m, variant) => {
  const colour = (variant || 'red') as LedColor;
  const b = new MeshBuilder();
  const R = 0.098;              // 5 mm across the dome
  const material = m.dome[colour];

  // Flange, the little collar at the base with the cathode flat cut into it.
  b.add(cyl(R * 1.16, R * 1.2, 0.03, 20), material, { pos: [0, 0.015, 0] });
  // Barrel.
  b.add(cyl(R, R, 0.19, 20, true), material, { pos: [0, 0.125, 0] });
  // Dome.
  b.add(dome(R, 20), material, { pos: [0, 0.22, 0] });
  // The cathode flat. Electronics people look for this before anything else,
  // so it is on the cathode side and nowhere near the anode.
  b.add(box(0.01, 0.03, 0.13), material, { pos: [R * 1.1, 0.015, 0] });
  // The reflector cup the die sits in, visible through the epoxy.
  b.add(cyl(0.035, 0.05, 0.045, 12), m.legMetal, { pos: [-0.012, 0.175, 0] });
  b.add(box(0.012, 0.11, 0.012), m.legMetal, { pos: [0.03, 0.13, 0] });

  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.05, 0.0, 0], [0.05, 0.0, 0]],
    legRadius: 0.009,
  };
};

// ── Resistor ───────────────────────────────────────────────────────────────

const buildResistor: BodyBuilder = (m, variant) => {
  const ohms = Number(variant) || 220;
  const material = m.resistor(ohms);
  const b = new MeshBuilder();
  const R = 0.047;              // 2.4 mm body
  // Bent leads hold the body about 1.5 mm clear of the board. Sitting it at
  // y = 0 would bury half the colour code in the plastic, which is both wrong
  // and unreadable, and reading the bands is a lesson.
  const LIFT = 0.06;
  // Body lies along x. The colour code is a stripe texture running down the
  // cylinder's own axis, which is one draw call instead of four little bands.
  b.add(cyl(R, R, 0.25, 20, true), material, { pos: [0, LIFT, 0], rot: [0, 0, Math.PI / 2] });
  b.add(flattenUV(sph(R, 14), 0.5, 0.06), material, { pos: [-0.125, LIFT, 0] });
  b.add(flattenUV(sph(R, 14), 0.5, 0.06), material, { pos: [0.125, LIFT, 0] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.128, LIFT, 0], [0.128, LIFT, 0]],
    legRadius: 0.008,
  };
};

// ── Photocell ──────────────────────────────────────────────────────────────

const buildLdr: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  const R = 0.1;                // 5.1 mm disc
  // Its legs hold it a little clear of the board, the same as the resistor.
  const LIFT = 0.03;
  b.add(cyl(R, R * 0.96, 0.055, 20), m.epoxyBrown, { pos: [0, 0.03 + LIFT, 0] });
  b.add(cyl(R * 0.88, R * 0.88, 0.014, 20), m.ceramic, { pos: [0, 0.063 + LIFT, 0] });
  // The serpentine track. It is the thing that makes a photocell recognisable
  // at a glance, and four straight bars with three returns is exactly its
  // shape from above.
  const track = m.plasticDark;
  for (let i = 0; i < 4; i++) {
    const z = -0.048 + i * 0.032;
    b.add(box(0.13, 0.008, 0.011), track, { pos: [0, 0.071 + LIFT, z] });
  }
  for (let i = 0; i < 3; i++) {
    const z = -0.032 + i * 0.032;
    const x = i % 2 === 0 ? 0.06 : -0.06;
    b.add(box(0.011, 0.008, 0.032), track, { pos: [x, 0.071 + LIFT, z] });
  }
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.045, 0.005 + LIFT, 0], [0.045, 0.005 + LIFT, 0]],
    legRadius: 0.008,
  };
};

// ── Thermistor ─────────────────────────────────────────────────────────────

const buildThermistor: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  // A glass or epoxy bead, flattened: it is a disc, not a ball.
  b.add(sph(0.07, 16), m.plasticBlue, { pos: [0, 0.085, 0], scale: [1, 1, 0.55] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.03, 0.03, 0], [0.03, 0.03, 0]],
    legRadius: 0.007,
  };
};

// ── Electrolytic capacitor ─────────────────────────────────────────────────

const buildCapacitor: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  const R = 0.124;              // 6.3 mm can
  const H = 0.4;
  b.add(cyl(R, R, H, 22, true), m.plasticDark, { pos: [0, H / 2 + 0.02, 0] });
  b.add(cyl(R, R * 0.97, 0.02, 22), m.plasticDark, { pos: [0, 0.03, 0] });
  b.add(cyl(R * 0.96, R, 0.02, 22), m.icBlack, { pos: [0, H + 0.02, 0] });
  // The score lines on the top, the vent that lets it fail politely.
  b.add(box(0.2, 0.006, 0.014), m.icBlack, { pos: [0, H + 0.031, 0] });
  b.add(box(0.014, 0.006, 0.2), m.icBlack, { pos: [0, H + 0.031, 0] });
  // The negative stripe, an open partial shell hugging the can. Which side it
  // is on is the whole of the polarity lesson, so it faces the second pin.
  const stripe = new THREE.CylinderGeometry(R * 1.01, R * 1.01, H * 0.86, 12, 1, true, -0.55, 1.1);
  b.add(stripe, m.plasticWhite, { pos: [0, H / 2 + 0.02, 0], rot: [0, -Math.PI / 2, 0] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.05, 0.02, 0], [0.05, 0.02, 0]],
    legRadius: 0.008,
  };
};

// ── Tactile switch ─────────────────────────────────────────────────────────

const buildButton: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  const S = 0.236;              // 6 mm square
  b.add(rounded(S, 0.1, S, 0.012), m.plasticDark, { pos: [0, 0.05, 0] });
  // The stainless cover plate with its four crimped corners.
  b.add(box(S * 0.92, 0.012, S * 0.92), m.legMetal, { pos: [0, 0.104, 0] });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(box(0.026, 0.05, 0.026), m.legMetal, { pos: [sx * S * 0.46, 0.075, sz * S * 0.46] });
    }
  }
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    // Four legs at the corners of a 0.2 by 0.3 inch footprint.
    legAnchors: [
      [-0.1, 0.03, -0.11], [0.1, 0.03, -0.11],
      [-0.1, 0.03, 0.11], [0.1, 0.03, 0.11],
    ],
    legRadius: 0.007,
  };
};

// ── Potentiometer ──────────────────────────────────────────────────────────

const buildPot: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  b.add(rounded(0.34, 0.12, 0.3, 0.016), m.plasticBlue, { pos: [0, 0.06, 0] });
  // The bushing the shaft comes through.
  b.add(cyl(0.075, 0.085, 0.05, 16), m.plasticDark, { pos: [0, 0.14, 0] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.1, 0.02, 0], [0, 0.02, 0.02], [0.1, 0.02, 0]],
    legRadius: 0.008,
  };
};

// ── Piezo buzzer ───────────────────────────────────────────────────────────

const buildBuzzer: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  const R = 0.236;              // 12 mm can
  const H = 0.33;
  b.add(cyl(R, R, H, 26, true), m.plasticDark, { pos: [0, H / 2, 0] });
  b.add(cyl(R, R, 0.016, 26), m.plasticDark, { pos: [0, H, 0] });
  b.add(cyl(0.055, 0.055, 0.02, 14), m.icBlack, { pos: [0, H + 0.004, 0] });
  // The moulded plus, telling you which leg is which.
  b.add(box(0.07, 0.006, 0.016), m.plasticWhite, { pos: [-0.12, H + 0.012, 0] });
  b.add(box(0.016, 0.006, 0.07), m.plasticWhite, { pos: [-0.12, H + 0.012, 0] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.1, 0.01, 0], [0.1, 0.01, 0]],
    legRadius: 0.008,
  };
};

// ── TO-92 transistor ───────────────────────────────────────────────────────

const buildTransistor: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  const R = 0.09;               // 4.5 mm across
  const H = 0.2;
  // Half a cylinder with a flat front: the shape you orient the part by.
  b.add(
    new THREE.CylinderGeometry(R, R, H, 18, 1, false, 0, Math.PI),
    m.icBlack,
    { pos: [0, H / 2 + 0.02, 0], rot: [0, -Math.PI / 2, 0] },
  );
  b.add(box(2 * R, H, 0.008), m.icBlack, { pos: [0, H / 2 + 0.02, 0] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.05, 0.02, 0], [0, 0.02, -0.02], [0.05, 0.02, 0]],
    legRadius: 0.008,
  };
};

// ── DC motor ───────────────────────────────────────────────────────────────

const buildMotor: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  const R = 0.24;
  b.add(cyl(R, R, 0.55, 24, true), m.canMetal, { pos: [0, 0.32, 0] });
  b.add(cyl(R * 1.02, R * 1.02, 0.03, 24), m.canMetal, { pos: [0, 0.6, 0] });
  b.add(cyl(R, R, 0.03, 24), m.canMetal, { pos: [0, 0.06, 0] });
  b.add(box(0.09, 0.05, 0.02), m.plasticDark, { pos: [-0.1, 0.045, 0.12] });
  b.add(box(0.09, 0.05, 0.02), m.plasticDark, { pos: [0.1, 0.045, 0.12] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.1, 0.03, 0.12], [0.1, 0.03, 0.12]],
    legRadius: 0.009,
  };
};

// ── Hobby servo ────────────────────────────────────────────────────────────

const buildServo: BodyBuilder = (m) => {
  const b = new MeshBuilder();
  b.add(rounded(0.87, 0.62, 0.46, 0.02), m.plasticBlue, { pos: [0, 0.31, 0] });
  // The mounting flanges, which is how you know it is a servo and not a box.
  b.add(box(1.26, 0.05, 0.42), m.plasticBlue, { pos: [0, 0.48, 0] });
  b.add(cyl(0.115, 0.115, 0.1, 18), m.plasticBlue, { pos: [0.2, 0.66, 0] });
  b.add(cyl(0.075, 0.075, 0.09, 14), m.plasticDark, { pos: [-0.24, 0.64, 0] });
  b.add(box(0.09, 0.06, 0.16), m.plasticDark, { pos: [-0.47, 0.14, 0] });
  const built = b.build();
  return {
    geometry: built.geometry,
    materials: built.materials,
    legAnchors: [[-0.1, 0.1, 0.16], [0, 0.1, 0.16], [0.1, 0.1, 0.16]],
    legRadius: 0.012,
  };
};

const BUILDERS: Record<PartKind, BodyBuilder> = {
  led: buildLed,
  resistor: buildResistor,
  ldr: buildLdr,
  thermistor: buildThermistor,
  capacitor: buildCapacitor,
  pushbutton: buildButton,
  potentiometer: buildPot,
  buzzer: buildBuzzer,
  transistor: buildTransistor,
  motor: buildMotor,
  servo: buildServo,
};

/** The cache key for a placed part: what makes two of them interchangeable. */
export function partVariant(part: PlacedPart): string {
  if (part.kind === 'led') return part.color ?? 'red';
  if (part.kind === 'resistor') return String(Number(partValue(part).toPrecision(3)));
  return '';
}

// ── Leads ──────────────────────────────────────────────────────────────────

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _mid = new THREE.Vector3();

/**
 * A bent lead from the body to the hole.
 *
 * A straight line between the two would be a strut, not a wire. The control
 * point pulls the curve down and outward so it reads as a leg that was bent by
 * hand, which is what every leg on a breadboard is.
 */
function leadGeometry(
  anchor: [number, number, number],
  target: THREE.Vector3,
  radius: number,
): THREE.BufferGeometry {
  _from.set(anchor[0], anchor[1], anchor[2]);
  _to.copy(target);
  _mid.copy(_from).lerp(_to, 0.55);
  _mid.y = Math.min(_from.y, _to.y) - 0.012;
  const curve = new THREE.QuadraticBezierCurve3(_from.clone(), _mid.clone(), _to.clone());
  return new THREE.TubeGeometry(curve, 5, radius, 5, false);
}

// ── The runtime object ─────────────────────────────────────────────────────

export interface PartObject {
  readonly id: string;
  readonly root: THREE.Group;
  /** Move the part so its legs reach these hole positions, in world space. */
  place(pins: Array<THREE.Vector3 | null>): void;
  /** React to a value, colour, wiper or pressed change. */
  refresh(part: PlacedPart, materials: MaterialLibrary): void;
  /** Drive the animated pieces. Returns true when another frame is wanted. */
  animate(reading: PartReading | undefined, elapsed: number, dt: number): boolean;
  setSelected(on: boolean): void;
  dispose(): void;
}

const SELECT_RING = new THREE.RingGeometry(0.13, 0.185, 28).rotateX(-Math.PI / 2);

/**
 * Build everything for one placed part.
 *
 * The body is shared. The legs, the animated children and the selection ring
 * belong to this instance, which is the smallest set of things that genuinely
 * cannot be shared.
 */
export function createPart(part: PlacedPart, materials: MaterialLibrary): PartObject {
  const root = new THREE.Group();
  root.name = `part:${part.id}`;

  let variant = partVariant(part);
  let body = partBodyGeometry(part.kind, materials, variant);
  const bodyMesh = new THREE.Mesh(body.geometry, materialFor(body.materials));
  bodyMesh.castShadow = true;
  bodyMesh.userData.partId = part.id;
  root.add(bodyMesh);

  let legs: THREE.Mesh | null = null;
  const owned: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];

  // Selection is a ring on the board under the part, not an outline on it: an
  // outline on a merged mesh needs a second pass, and a ring reads better at a
  // shallow phone camera angle anyway.
  const ring = new THREE.Mesh(SELECT_RING, materials.highlight);
  ring.position.y = 0.007;
  ring.visible = false;
  root.add(ring);

  // Pieces that move.
  let die: THREE.Mesh | null = null;
  let glow: THREE.Mesh | null = null;
  let spinner: THREE.Object3D | null = null;
  let horn: THREE.Object3D | null = null;
  let knob: THREE.Object3D | null = null;
  let cap: THREE.Object3D | null = null;

  if (part.kind === 'led') {
    const colour = (part.color ?? 'red') as LedColor;
    const dieMaterial = materials.die(colour);
    ownedMaterials.push(dieMaterial);
    const dieGeom = mergeSingle([
      new THREE.BoxGeometry(0.05, 0.02, 0.05).translate(0, 0.185, -0.012),
      new THREE.SphereGeometry(0.026, 10, 8).translate(0, 0.2, -0.012),
    ]);
    owned.push(dieGeom);
    die = new THREE.Mesh(dieGeom, dieMaterial);
    root.add(die);

    const glowMaterial = materials.glow(colour);
    ownedMaterials.push(glowMaterial);
    const glowGeom = new THREE.SphereGeometry(0.19, 12, 10);
    owned.push(glowGeom);
    glow = new THREE.Mesh(glowGeom, glowMaterial);
    glow.position.y = 0.2;
    glow.visible = false;
    root.add(glow);
  }

  if (part.kind === 'motor') {
    spinner = new THREE.Group();
    const shaft = cyl(0.03, 0.03, 0.16, 10);
    const blade = box(0.36, 0.016, 0.05);
    owned.push(shaft, blade);
    const shaftMesh = new THREE.Mesh(shaft, materials.legMetal);
    shaftMesh.position.y = 0.7;
    const bladeMesh = new THREE.Mesh(blade, materials.plasticWhite);
    bladeMesh.position.y = 0.78;
    spinner.add(shaftMesh, bladeMesh);
    root.add(spinner);
  }

  if (part.kind === 'servo') {
    horn = new THREE.Group();
    const hub = cyl(0.05, 0.05, 0.06, 12);
    const arm = box(0.34, 0.02, 0.045);
    owned.push(hub, arm);
    const hubMesh = new THREE.Mesh(hub, materials.plasticWhite);
    const armMesh = new THREE.Mesh(arm, materials.plasticWhite);
    armMesh.position.set(0.12, 0.03, 0);
    horn.add(hubMesh, armMesh);
    horn.position.set(0.2, 0.73, 0);
    root.add(horn);
  }

  if (part.kind === 'potentiometer') {
    knob = new THREE.Group();
    const body2 = cyl(0.115, 0.125, 0.15, 20);
    const notch = box(0.016, 0.02, 0.09);
    owned.push(body2, notch);
    const knobMesh = new THREE.Mesh(body2, materials.plasticWhite);
    const notchMesh = new THREE.Mesh(notch, materials.plasticDark);
    notchMesh.position.set(0, 0.08, 0.06);
    knob.add(knobMesh, notchMesh);
    knob.position.y = 0.23;
    root.add(knob);
  }

  if (part.kind === 'pushbutton') {
    const capGeom = cyl(0.055, 0.055, 0.075, 14);
    owned.push(capGeom);
    cap = new THREE.Mesh(capGeom, materials.accent);
    cap.position.y = 0.14;
    root.add(cap);
  }

  const rebuildLegs = (pins: Array<THREE.Vector3 | null>) => {
    if (legs) { legs.geometry.dispose(); root.remove(legs); legs = null; }
    const pieces: THREE.BufferGeometry[] = [];
    body.legAnchors.forEach((anchor, i) => {
      const target = pins[i];
      if (!target) return;
      root.worldToLocal(_to.copy(target));
      pieces.push(leadGeometry(anchor, _to, body.legRadius));
    });
    if (!pieces.length) return;
    legs = new THREE.Mesh(mergeSingle(pieces), materials.legMetal);
    legs.castShadow = true;
    legs.userData.partId = part.id;
    root.add(legs);
  };

  let pressed = part.pressed ?? false;
  let wiper = part.wiper ?? 0.5;

  return {
    id: part.id,
    root,

    place(pins) {
      const real = pins.filter((p): p is THREE.Vector3 => p !== null);
      if (!real.length) return;
      _mid.set(0, 0, 0);
      for (const p of real) _mid.add(p);
      _mid.divideScalar(real.length);
      root.position.set(_mid.x, 0, _mid.z);

      const first = pins[0];
      const last = pins[pins.length - 1];
      if (first && last && first !== last) {
        const dx = last.x - first.x;
        const dz = last.z - first.z;
        if (dx * dx + dz * dz > 1e-9) root.rotation.y = Math.atan2(-dz, dx);
      }
      // Longer than nominal means the legs were bent to reach, which is a real
      // thing to do, so the body simply stays where it is and the leads stretch.
      root.updateMatrixWorld(true);
      rebuildLegs(pins);
    },

    refresh(next, lib) {
      pressed = next.pressed ?? false;
      wiper = next.wiper ?? 0.5;
      const nextVariant = partVariant(next);
      if (nextVariant !== variant) {
        variant = nextVariant;
        body = partBodyGeometry(next.kind, lib, variant);
        bodyMesh.geometry = body.geometry;
        bodyMesh.material = materialFor(body.materials);
      }
      if (cap) cap.position.y = pressed ? 0.115 : 0.14;
      if (knob) knob.rotation.y = (0.5 - wiper) * 4.9; // about 280 degrees of sweep
    },

    animate(reading, elapsed, dt) {
      let busy = false;

      if (die) {
        const target = reading?.brightness ?? 0;
        const mat = die.material as THREE.MeshStandardMaterial;
        // A real LED does not shimmer. The only motion here is a fast approach
        // to the solved brightness, so a PWM fade looks like a fade and a
        // digitalWrite looks instant.
        const eased = mat.emissiveIntensity + (target * 3.2 + 0.05 - mat.emissiveIntensity) * Math.min(1, dt * 18);
        if (Math.abs(eased - mat.emissiveIntensity) > 0.001) busy = true;
        mat.emissiveIntensity = eased;
        if (glow) {
          const gm = glow.material as THREE.MeshBasicMaterial;
          gm.opacity = Math.max(0, (eased - 0.4) * 0.16);
          glow.visible = gm.opacity > 0.005;
          glow.scale.setScalar(1 + target * 0.35);
        }
      }

      if (spinner && reading?.on) {
        spinner.rotation.y += dt * 26 * Math.max(0.2, reading.brightness);
        busy = true;
      }

      if (horn) {
        // A servo with a signal sweeps; a servo with none holds position.
        const target = reading?.on ? Math.sin(elapsed * 2.1) * 1.35 : 0;
        horn.rotation.y += (target - horn.rotation.y) * Math.min(1, dt * 6);
        if (reading?.on) busy = true;
      }

      if (part.kind === 'buzzer' && reading?.on) {
        // The can visibly buzzes. Small, fast, and only while it is sounding.
        const s = 1 + Math.sin(elapsed * 42) * 0.012;
        bodyMesh.scale.set(s, 1, s);
        busy = true;
      } else if (part.kind === 'buzzer') {
        bodyMesh.scale.set(1, 1, 1);
      }

      return busy;
    },

    setSelected(on) { ring.visible = on; },

    dispose() {
      if (legs) legs.geometry.dispose();
      owned.forEach((g) => g.dispose());
      ownedMaterials.forEach((m) => m.dispose());
      root.clear();
    },
  };
}
