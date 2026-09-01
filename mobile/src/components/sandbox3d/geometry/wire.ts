// ── Jumper wires ──
//
// A jumper is the only thing on the board with two free ends, so it is the one
// object whose geometry has to be built per instance. It is also the object a
// learner spends the most time looking at, because tracing a wire is how you
// debug a circuit, so the arc matters: a straight line between two holes reads
// as a schematic, and a wire that lifts off the board and lands vertically
// reads as a wire.
//
// One mesh per jumper, one draw call each, shared insulation material per
// colour. A build with forty wires on it is forty draw calls, which is inside
// the budget and is worth it for being able to move one wire without touching
// the other thirty nine.

import * as THREE from 'three';
import { mergeSingle } from './builder';
import type { MaterialLibrary } from '../materials';
import type { WireColor } from '../types';

/** Insulation radius. Real 22 AWG hookup wire is about 0.05 inch over the jacket. */
const RADIUS = 0.024;
/** The bare tinned end that goes into the hole. */
const FERRULE = 0.055;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();

/**
 * The arc a jumper takes between two holes.
 *
 * Both ends leave vertically, because that is the only way a wire can leave a
 * hole, and the lift in the middle scales with the run so a short hop stays
 * flat and a wire across the board bows the way a real one does under its own
 * stiffness.
 */
export function jumperCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.CubicBezierCurve3 {
  const run = Math.hypot(to.x - from.x, to.z - from.z);
  const lift = Math.min(0.9, 0.16 + run * 0.24);
  _a.copy(from);
  _b.copy(to);
  _c1.set(from.x, from.y + lift, from.z);
  _c2.set(to.x, to.y + lift, to.z);
  return new THREE.CubicBezierCurve3(_a.clone(), _c1.clone(), _c2.clone(), _b.clone());
}

export interface WireObject {
  readonly root: THREE.Mesh;
  setEnds(from: THREE.Vector3, to: THREE.Vector3): void;
  setColor(color: WireColor, materials: MaterialLibrary): void;
  setSelected(on: boolean, materials: MaterialLibrary): void;
  dispose(): void;
}

/** Build a jumper between two holes. */
export function createWire(
  id: string,
  color: WireColor,
  materials: MaterialLibrary,
): WireObject {
  let current = color;
  let selected = false;
  // Typed loosely on purpose: a selected jumper swaps to the highlight
  // material, which is a basic one, and inferring the constructor's type would
  // pin this to a standard material forever.
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
    new THREE.BufferGeometry(), materials.wire[color],
  );
  mesh.name = `wire:${id}`;
  mesh.castShadow = true;
  mesh.userData.wireId = id;

  const rebuild = (from: THREE.Vector3, to: THREE.Vector3) => {
    const curve = jumperCurve(from, to);
    // Segment count follows the length rather than being fixed: a hop between
    // neighbouring columns does not need 28 rings and a run down the board
    // looks faceted with fewer.
    const run = curve.getLength();
    const segments = Math.max(8, Math.min(28, Math.round(run * 9)));
    const tube = new THREE.TubeGeometry(curve, segments, RADIUS, 6, false);
    // Tinned ends, so the wire visibly enters the hole instead of stopping
    // above it.
    const capA = new THREE.CylinderGeometry(RADIUS * 0.55, RADIUS * 0.45, FERRULE, 6);
    capA.translate(from.x, from.y - FERRULE * 0.3, from.z);
    const capB = new THREE.CylinderGeometry(RADIUS * 0.55, RADIUS * 0.45, FERRULE, 6);
    capB.translate(to.x, to.y - FERRULE * 0.3, to.z);
    mesh.geometry.dispose();
    mesh.geometry = mergeSingle([tube, capA, capB]);
  };

  return {
    root: mesh,
    setEnds: rebuild,
    setColor(next, lib) {
      if (next === current && !selected) return;
      current = next;
      if (!selected) mesh.material = lib.wire[next];
    },
    setSelected(on, lib) {
      selected = on;
      mesh.material = on ? lib.highlight : lib.wire[current];
    },
    dispose() { mesh.geometry.dispose(); },
  };
}

/**
 * The colour a new jumper should be, from the hole it starts at.
 *
 * Colour convention is a real discipline, not decoration: red is always the
 * supply and black is always ground, and a learner who picks that up here will
 * pick it up at the bench. Everything else cycles so no two adjacent wires
 * look the same.
 */
export function suggestWireColor(fromHole: string, index: number): WireColor {
  if (/rail:(0|3)/.test(fromHole) || fromHole === 'uno:5V' || fromHole === 'uno:VIN') return 'red';
  if (/rail:(1|2)/.test(fromHole) || fromHole === 'uno:GND') return 'black';
  const cycle: WireColor[] = ['blue', 'green', 'yellow', 'orange', 'white'];
  return cycle[index % cycle.length];
}
