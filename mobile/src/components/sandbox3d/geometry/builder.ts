// ── Building a part as one mesh ──
//
// A through hole LED authored the obvious way is seven meshes: dome, die,
// flange, cathode flat, two legs, halo. Seven meshes is seven draw calls, and
// a board with twenty parts on it is a hundred and fifty draw calls of parts
// alone before the boards, the wires and the highlights are counted.
//
// The builder collects primitives, bakes their transforms into the vertices,
// and merges everything sharing a material into one buffer with one group per
// material. An LED comes out as two draw calls instead of seven, and every LED
// of the same colour shares the same vertex buffer on the GPU.
//
// The pieces that have to animate independently, the emissive die and its
// halo, stay separate on purpose. That is the one case where a draw call buys
// something.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Placement {
  pos?: [number, number, number];
  /** Euler angles in radians, applied XYZ. */
  rot?: [number, number, number];
  scale?: [number, number, number];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class MeshBuilder {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private order: THREE.Material[] = [];

  /** Add a primitive. The geometry is consumed: it is baked and disposed. */
  add(geometry: THREE.BufferGeometry, material: THREE.Material, at: Placement = {}): this {
    _p.set(...(at.pos ?? [0, 0, 0]));
    _e.set(...(at.rot ?? [0, 0, 0]));
    _q.setFromEuler(_e);
    _s.set(...(at.scale ?? [1, 1, 1]));
    _m.compose(_p, _q, _s);
    geometry.applyMatrix4(_m);

    let bucket = this.buckets.get(material);
    if (!bucket) { bucket = []; this.buckets.set(material, bucket); this.order.push(material); }
    bucket.push(geometry);
    return this;
  }

  get isEmpty(): boolean { return this.order.length === 0; }

  /**
   * Merge into one geometry with one group per material.
   *
   * Groups are what the renderer turns into draw calls, so the group count is
   * the honest cost of the part, and it is what check-breadboard.mjs counts.
   */
  build(): { geometry: THREE.BufferGeometry; materials: THREE.Material[] } {
    const materials = [...this.order];
    const perMaterial = materials.map((m) => mergeBucket(this.buckets.get(m)!));
    const geometry = materials.length === 1
      ? perMaterial[0]
      : mergeGeometries(sameIndexing(perMaterial), true)!;
    if (materials.length > 1) perMaterial.forEach((g) => g.dispose());
    this.buckets.clear();
    this.order.length = 0;
    return { geometry, materials };
  }
}

/**
 * Merge one material's primitives.
 *
 * three.js refuses to merge an indexed geometry with a non indexed one, and
 * RoundedBoxGeometry is the only non indexed primitive in the whole scene. So
 * a bucket that contains one drops the index on the rest rather than failing
 * at runtime, which is the kind of thing that only shows up on the device.
 */
function mergeBucket(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geoms.length === 1) return geoms[0];
  const merged = mergeGeometries(sameIndexing(geoms), false);
  if (!merged) throw new Error('geometry merge failed: attributes do not match');
  geoms.forEach((g) => g.dispose());
  return merged;
}

/**
 * Make a set of geometries mergeable.
 *
 * three refuses to merge an indexed geometry with a non indexed one, and it
 * refuses by returning null and logging, not by throwing, so the symptom is a
 * part that is silently missing from the board. RoundedBoxGeometry is the only
 * non indexed primitive in the scene, and one of them in a set is enough to
 * poison it, so the whole set drops its index.
 */
function sameIndexing(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  if (!geoms.some((g) => g.getIndex() === null)) return geoms;
  return geoms.map((g) => (g.getIndex() === null ? g : g.toNonIndexed()));
}

/**
 * What to hand THREE.Mesh.
 *
 * A one element material ARRAY on a geometry with no groups renders nothing at
 * all: the renderer walks geometry.groups when the material is an array, and an
 * empty groups list means an empty draw list. Silent, and only visible on the
 * device. This is the guard.
 */
export function materialFor(materials: THREE.Material[]): THREE.Material | THREE.Material[] {
  return materials.length === 1 ? materials[0] : materials;
}

/**
 * Pin every vertex of a geometry to one point in its material's texture.
 *
 * Used for the domed ends of a resistor: they share the body's colour code
 * texture, and their own spherical UVs would wrap the whole code around each
 * end cap. Pointing them at a plain part of the stripe costs nothing and keeps
 * the whole resistor at one draw call.
 */
export function flattenUV(geometry: THREE.BufferGeometry, u: number, v: number): THREE.BufferGeometry {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  uv.needsUpdate = true;
  return geometry;
}

/** Merge a set of geometries that all share one material. */
export function mergeSingle(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeBucket(geoms);
}

/**
 * A flat quad in the xz plane with explicit UVs.
 *
 * PlaneGeometry's UVs assume the plane is upright, and getting the board's
 * silkscreen the right way up by rotating one is the sort of thing that is
 * wrong for a week. Writing the four corners out means the mapping is stated
 * rather than inferred.
 */
export function quadXZ(
  x0: number, z0: number, x1: number, z1: number, y: number,
  uv: (x: number, z: number) => [number, number],
  normal: [number, number, number] = [0, 1, 0],
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const corners: Array<[number, number]> = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const pos = new Float32Array(12);
  const nor = new Float32Array(12);
  const uvs = new Float32Array(8);
  corners.forEach(([cx, cz], i) => {
    pos[i * 3] = cx; pos[i * 3 + 1] = y; pos[i * 3 + 2] = cz;
    nor[i * 3] = normal[0]; nor[i * 3 + 1] = normal[1]; nor[i * 3 + 2] = normal[2];
    const [u, v] = uv(cx, cz);
    uvs[i * 2] = u; uvs[i * 2 + 1] = v;
  });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** A vertical strip running along x, used for the walls of the ravine. */
export function wallXY(
  x0: number, x1: number, z: number, yTop: number, yBottom: number,
  uv: (x: number, y: number) => [number, number],
  facing: 1 | -1,
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const corners: Array<[number, number]> = facing === 1
    ? [[x0, yBottom], [x1, yBottom], [x1, yTop], [x0, yTop]]
    : [[x1, yBottom], [x0, yBottom], [x0, yTop], [x1, yTop]];
  const pos = new Float32Array(12);
  const nor = new Float32Array(12);
  const uvs = new Float32Array(8);
  corners.forEach(([cx, cy], i) => {
    pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = z;
    nor[i * 3] = 0; nor[i * 3 + 1] = 0.35; nor[i * 3 + 2] = facing * 0.94;
    const [u, v] = uv(cx, cy);
    uvs[i * 2] = u; uvs[i * 2 + 1] = v;
  });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
