// ── The board, in three meshes ──
//
// The whole of a breadboard's detail (830 hole rings, 63 column numbers, 20
// row letters, four rail stripes, the polarity marks, the moulding shading) is
// painted into one texture and shown on one quad. The only geometry that has
// to be real is the depth: the groove down the middle, which a learner uses to
// straddle a chip, and the sockets, which is where a leg goes.
//
// Cost: one merged textured mesh for the top, one rounded box for the body,
// one instanced mesh holding all 830 sockets. Three objects. The web version
// of this scene submits about 1,700.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  BOARD, BOARD_TOP, COLS, HOLE_DEPTH, HOLE_RADIUS, PITCH, RAILS, RAIL_HOLES,
  RAVINE, RAVINE_ROW, ROWS, ROW_LETTERS, columnX, railHoleX, railStripeZ, rowZ,
} from '../boardSpec';
import { Painter, rgb, type Rgba } from '../painter';
import { mergeSingle, quadXZ, wallXY } from './builder';
import type { MaterialLibrary } from '../materials';

/**
 * Texture resolution.
 *
 * Both dimensions are powers of two so the mipmap chain is valid on a WebGL 1
 * context, which is what expo-gl gives on some devices. 2048 across the 6.5
 * inch length is 315 pixels per inch, so a 1.2 mm hole ring lands on about
 * seventeen pixels: enough to read as a ring rather than a dot. The pixels are
 * not square, and the painter knows that.
 */
const TEX_W = 2048;
const TEX_H = 512;

const PLASTIC: Rgba = rgb(0xf0eee7);
const PLASTIC_SHADE: Rgba = rgb(0xdedbd2);
const GROOVE_DARK: Rgba = rgb(0xc9c6bd);
// Darker and thicker than a real board's moulding, on purpose. A physical
// breadboard is read at arm's length with both eyes and a shadow to help; this
// one is read on a phone at a fitted camera distance, where 0xb9b6ac on white
// left the grid almost invisible and there was no way to see where a part
// would land.
const HOLE_RING: Rgba = rgb(0x8b8880);
const HOLE_DARK: Rgba = rgb(0x25272b);
const PRINT: Rgba = rgb(0x5c6068);
const RED_LINE: Rgba = rgb(0xd6402f);
const BLUE_LINE: Rgba = rgb(0x2f6fd0);

/** The textured area: the flat top of the moulding, inside the bevel. */
const TOP_W = BOARD.length - BOARD.bevel * 2;
const TOP_D = BOARD.width - BOARD.bevel * 2;

/**
 * Paint the silkscreen.
 *
 * Exported so scripts/check-breadboard.mjs can run it headless and so the
 * scene can rebuild it if the board size ever becomes a prop.
 */
export function paintBreadboard(): THREE.DataTexture {
  const p = new Painter(TEX_W, TEX_H, TOP_W, TOP_D);
  p.fill(PLASTIC);

  // Moulding shading: a real board is lighter along its middle and falls off
  // towards the rails, because the plastic is thicker there. Flat colour is
  // the single loudest tell of a rendered object.
  p.shade(0, -TOP_D / 4, TOP_W, TOP_D / 2, PLASTIC_SHADE, PLASTIC);
  p.shade(0, TOP_D / 4, TOP_W, TOP_D / 2, PLASTIC, PLASTIC_SHADE);

  // The groove: painted as well as modelled, so the shadow inside it reads
  // even in the top down view where the geometry is edge on.
  p.shade(0, -RAVINE.halfWidth / 2, TOP_W, RAVINE.halfWidth, PLASTIC_SHADE, GROOVE_DARK);
  p.shade(0, RAVINE.halfWidth / 2, TOP_W, RAVINE.halfWidth, GROOVE_DARK, PLASTIC_SHADE);

  // Rail stripes, and the polarity marks at both ends of each one.
  for (const rail of RAILS) {
    const colour = rail.polarity === '+' ? RED_LINE : BLUE_LINE;
    const z = railStripeZ(rail.id);
    p.rect(0, z, TOP_W - 0.34, 0.012, colour);
    for (const end of [-1, 1]) {
      p.text(rail.polarity, end * (TOP_W / 2 - 0.09), rail.z, 0.075, colour);
    }
  }

  // Hole rings. Every tie point on the board gets one, which is 830 of them,
  // and it is a few hundred thousand pixel writes at load rather than 1,660
  // meshes for the rest of the session.
  const ring = (x: number, z: number) => {
    p.ring(x, z, HOLE_RADIUS * 0.70, HOLE_RADIUS * 1.62, HOLE_RING);
    p.disc(x, z, HOLE_RADIUS * 0.78, HOLE_DARK);
  };
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) ring(columnX(col), rowZ(row));
  }
  for (const rail of RAILS) {
    for (let i = 0; i < RAIL_HOLES; i++) ring(railHoleX(i), rail.z);
  }

  // Column numbers, printed every five columns like the real thing, on both
  // sides of the ravine so they are readable whichever way the board is turned.
  for (let col = 0; col < COLS; col++) {
    const printed = col + 1;
    if (printed !== 1 && printed % 5 !== 0 && printed !== COLS) continue;
    const label = String(printed);
    // Between row a and the rail's printed line, which is where a real board
    // puts them. Any further out and they collide with the rail stripe.
    p.text(label, columnX(col), rowZ(0) - 0.062, 0.055, PRINT);
    p.text(label, columnX(col), rowZ(ROWS - 1) + 0.062, 0.055, PRINT);
  }

  // Row letters at both ends.
  for (let row = 0; row < ROWS; row++) {
    const letter = ROW_LETTERS[row];
    // Hard against the edge, because the 63 columns leave only 0.15 inch of
    // margin and that is exactly how tight it is on the real board too.
    p.text(letter, -TOP_W / 2 + 0.045, rowZ(row), 0.046, PRINT);
    p.text(letter, TOP_W / 2 - 0.045, rowZ(row), 0.046, PRINT);
  }

  return p.texture();
}

/**
 * The board's top surface: two plateaus, two groove walls and the groove
 * floor, merged into one geometry so the whole printed surface is one draw
 * call with real depth in the middle.
 */
function topSurface(): THREE.BufferGeometry {
  const u = (x: number) => x / TOP_W + 0.5;
  const v = (z: number) => z / TOP_D + 0.5;
  const halfX = TOP_W / 2;
  const halfZ = TOP_D / 2;
  const g = RAVINE.halfWidth;
  const floorY = BOARD_TOP - RAVINE.depth;

  const pieces = [
    quadXZ(-halfX, -halfZ, halfX, -g, BOARD_TOP, (x, z) => [u(x), v(z)]),
    quadXZ(-halfX, g, halfX, halfZ, BOARD_TOP, (x, z) => [u(x), v(z)]),
    quadXZ(-halfX, -g, halfX, g, floorY, (x, z) => [u(x), v(z)]),
    // The walls sample the band right at the groove edge, so the painted
    // gradient continues down into the geometry instead of stopping at a seam.
    wallXY(-halfX, halfX, -g, BOARD_TOP, floorY, (x) => [u(x), v(-g)], 1),
    wallXY(-halfX, halfX, g, BOARD_TOP, floorY, (x) => [u(x), v(g)], -1),
  ];
  return mergeSingle(pieces);
}

/**
 * One socket, as geometry to be instanced 830 times.
 *
 * A tube down into the board plus a floor. Eight sides, because at the size
 * this is ever seen the silhouette is carried by the painted ring above it and
 * the geometry only has to supply darkness and depth.
 */
function socketGeometry(): THREE.BufferGeometry {
  const wall = new THREE.CylinderGeometry(HOLE_RADIUS, HOLE_RADIUS * 0.8, HOLE_DEPTH, 8, 1, true);
  wall.translate(0, -HOLE_DEPTH / 2, 0);
  const floor = new THREE.CircleGeometry(HOLE_RADIUS * 0.8, 8);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, -HOLE_DEPTH, 0);
  return mergeSingle([wall, floor]);
}

export interface BreadboardMesh extends THREE.Group {
  /** The instanced sockets, kept so the scene can pick against them. */
  sockets: THREE.InstancedMesh;
}

/**
 * Build the board.
 *
 * The returned group is positioned in table coordinates: its top surface is
 * the y = 0 plane, which is the plane every tap is projected onto.
 */
export function buildBreadboard(materials: MaterialLibrary): BreadboardMesh {
  const group = new THREE.Group() as BreadboardMesh;
  group.name = 'breadboard';

  const body = new RoundedBoxGeometry(BOARD.length, BOARD.height, BOARD.width, 3, BOARD.bevel);
  body.translate(0, BOARD_TOP - BOARD.height / 2, 0);
  const bodyMesh = new THREE.Mesh(body, materials.boardPlastic);
  bodyMesh.name = 'breadboard.body';
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const top = new THREE.Mesh(topSurface(), materials.boardTop);
  top.name = 'breadboard.top';
  // A tenth of a millimetre above the moulding. Coplanar surfaces fight for
  // depth and make the board flicker as the camera moves, and expo-gl does not
  // promise a 24 bit depth buffer, so the gap has to be real rather than
  // nominal.
  top.position.y = 0.003;
  top.receiveShadow = true;
  group.add(top);

  const sockets = new THREE.InstancedMesh(socketGeometry(), materials.socket, COLS * ROWS + RAILS.length * RAIL_HOLES);
  sockets.name = 'breadboard.sockets';
  sockets.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      m.makeTranslation(columnX(col), BOARD_TOP, rowZ(row));
      sockets.setMatrixAt(i++, m);
    }
  }
  for (const rail of RAILS) {
    for (let h = 0; h < RAIL_HOLES; h++) {
      m.makeTranslation(railHoleX(h), BOARD_TOP, rail.z);
      sockets.setMatrixAt(i++, m);
    }
  }
  sockets.instanceMatrix.needsUpdate = true;
  // The sockets never move and are inside the board's own bounds, so frustum
  // culling per instance would only cost time.
  sockets.frustumCulled = false;
  group.add(sockets);
  group.sockets = sockets;

  return group;
}

/** Attach the painted silkscreen. Split out so it can be deferred a frame. */
export function applyBreadboardTexture(
  board: BreadboardMesh,
  materials: MaterialLibrary,
  anisotropy: number,
): void {
  const tex = paintBreadboard();
  // A breadboard is nearly always seen at a grazing angle, which is the exact
  // case anisotropic filtering exists for. Without it the far half of the
  // board turns to mush.
  tex.anisotropy = Math.min(8, anisotropy);
  materials.boardTop.map = tex;
  materials.boardTop.needsUpdate = true;
  void board;
}

/** The corner of the board's grid, for framing the camera on it. */
export const BOARD_BOUNDS = {
  minX: -BOARD.length / 2, maxX: BOARD.length / 2,
  minZ: -BOARD.width / 2, maxZ: BOARD.width / 2,
  pitch: PITCH, ravineRow: RAVINE_ROW,
};
