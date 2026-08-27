// ── The board: a painted top, a moulded body, and 830 real sockets ──
//
// Most of a breadboard's detail (the moulding shading, the four rail stripes,
// the polarity marks, the column numbers, the row letters) is painted into one
// texture and shown on one quad. That is what keeps this scene at a handful of
// draw calls where the web version submits about 1,700.
//
// The sockets are the exception, and they are the exception for a measured
// reason. Painted into the texture they are only ever as sharp as the texel
// under them, and the moment the learner pinches in past the fitted camera the
// hole they are aiming at turns to mush. As geometry they are one instanced
// mesh, one draw call, and they stay razor sharp at any zoom. The web scene
// does the same thing with a ring and a disc per hole; this does it with one
// instanced pair for all 830.
//
// WHAT WENT WRONG BEFORE, so it is not repeated:
//
//   1. The painted hole ring was 0.091 inch across on a 0.1 inch pitch. Two
//      neighbouring rings left about two device pixels of plastic between them
//      at the fitted camera, and the ring itself was a mid dark grey, so the
//      whole tie point field averaged into one flat grey slab. The board was
//      reported three times as "one solid colour" and it genuinely was.
//   2. The 830 socket tubes were built below y = 0 and the painted top quad
//      sits at y = 0.003, opaque, with no aperture in it. Every socket was
//      occluded. The board had been paying for geometry that drew no pixels.
//
// Both are fixed here: the lip is 0.064 inch across, which leaves better than a
// third of the pitch as clear plastic between neighbours, and the sockets are
// flat faces lifted just clear of the printing so they are actually seen.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  BOARD, BOARD_TOP, COLS, HOLE_RADIUS, PITCH, RAILS, RAIL_HOLES, RAVINE,
  RAVINE_ROW, ROWS, ROW_LETTERS, SOCKET_LIP_RADIUS, STRIPE_WIDTH,
  columnX, railHoleX, railStripeZ, rowZ,
} from '../boardSpec';
import { Painter, rgb, type Rgba } from '../painter';
import { mergeSingle, quadXZ, wallXY } from './builder';
import type { MaterialLibrary } from '../materials';

/**
 * Texture resolution.
 *
 * Both dimensions are powers of two so the mipmap chain is valid on a WebGL 1
 * context, which is what expo-gl gives on some devices.
 *
 * The number is not a guess. At the fitted camera on a 350 by 340 point view
 * at device pixel ratio 3, one 0.1 inch pitch measures 25.5 device pixels
 * along the board's length and 27.8 across it, so the screen is asking for
 * about 255 and 278 pixels per inch. 4096 by 1024 supplies 637 and 492, which
 * leaves headroom for the detail camera (radius 2.4, about 740 pixels per inch)
 * instead of magnifying the printing into a smear the moment anyone zooms.
 *
 * The previous 2048 by 512 supplied 319 and 246: under the fitted camera's own
 * requirement across the rows, before any zoom at all, which is why the row
 * letters and column numbers read as smudges.
 */
const TEX_W = 4096;
const TEX_H = 1024;

// ── The palette ──
//
// Three levels, and the gaps between them are the whole design: bright
// plastic, a mid grey moulded lip, a near black socket mouth. Measured against
// each other rather than picked by eye, because "it looked fine on the laptop"
// is how this ended up unreadable on a phone.
//
//   mouth to plastic   15.5 : 1
//   mouth to lip        7.9 : 1
//   lip to plastic      2.0 : 1
//
// scripts/check-breadboard.mjs asserts all three from the painted pixels.
const PLASTIC: Rgba = rgb(0xf1efe8);
const PLASTIC_SHADE: Rgba = rgb(0xe2dfd6);
const GROOVE_DARK: Rgba = rgb(0xc7c4ba);
/** The moulded lip standing proud around each socket. */
const SOCKET_RIM: Rgba = rgb(0xa7adb6);
/** The socket itself. Near black, so it reads as an opening and not a mark. */
const SOCKET_MOUTH: Rgba = rgb(0x15181d);
/** Silkscreen ink. */
const PRINT: Rgba = rgb(0x1f242b);
const RED_LINE: Rgba = rgb(0xd23a2a);
const BLUE_LINE: Rgba = rgb(0x2a63c8);

/** The textured area: the flat top of the moulding, inside the bevel. */
const TOP_W = BOARD.length - BOARD.bevel * 2;
const TOP_D = BOARD.width - BOARD.bevel * 2;

// ── Where the printing goes ──
//
// Every one of these is a clearance, not a taste. The bands on a breadboard are
// a tenth of an inch and the printing has to live between a rail stripe on one
// side and a row of sockets on the other, so each number below is checked
// against both neighbours in check-breadboard.mjs rather than nudged until a
// screenshot looked right.

/** Cap height of the column numbers, and how far they sit outside row a / j. */
const NUMBER_CAP = 0.078;
const NUMBER_OFFSET = 0.081;
/** Cap height of the row letters, and their inset from the board's end. */
const LETTER_CAP = 0.075;
const LETTER_INSET = 0.048;
/** Cap height of the + and - marks printed along each rail. */
const POLARITY_CAP = 0.085;
/** Inset of the polarity mark printed at each end of a rail. */
const POLARITY_INSET = 0.09;
/**
 * Columns where a polarity mark is printed mid rail.
 *
 * A rail's holes run in groups of five with a one pitch gap after each group,
 * and these are gaps: nothing is displaced to make room. A real board prints
 * + and - only at the two ends, which is fine on a desk and useless on a
 * phone, where the fitted camera never has an end of a 6.5 inch board on
 * screen. "I cannot see which one is ground" was the exact report.
 */
const POLARITY_COLUMNS = [7, 19, 31, 43, 55];

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

  // Rail stripes, and the polarity marks along each one.
  for (const rail of RAILS) {
    const colour = rail.polarity === '+' ? RED_LINE : BLUE_LINE;
    p.rect(0, railStripeZ(rail.id), TOP_W - 0.34, STRIPE_WIDTH, colour);
    for (const end of [-1, 1]) {
      p.text(rail.polarity, end * (TOP_W / 2 - POLARITY_INSET), rail.z, POLARITY_CAP, colour);
    }
    for (const col of POLARITY_COLUMNS) {
      p.text(rail.polarity, columnX(col), rail.z, POLARITY_CAP, colour);
    }
  }

  // The socket lip and mouth. The instanced faces below sit exactly on top of
  // these, so this layer only has to hold the board together at grazing angles
  // where a flat face is edge on, and to keep the grid legible if the geometry
  // is ever culled. Same radii, same colours: nothing doubles up visually.
  const socket = (x: number, z: number) => {
    p.ring(x, z, HOLE_RADIUS, SOCKET_LIP_RADIUS, SOCKET_RIM);
    p.disc(x, z, HOLE_RADIUS, SOCKET_MOUTH);
  };
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) socket(columnX(col), rowZ(row));
  }
  for (const rail of RAILS) {
    for (let i = 0; i < RAIL_HOLES; i++) socket(railHoleX(i), rail.z);
  }

  // Column numbers, printed every five columns like the real thing, on both
  // sides of the ravine so they are readable whichever way the board is turned.
  // They sit in the band between the rail's printed line and row a, which is
  // where a real board puts them and which only became wide enough to hold
  // them once the stripe stopped being parked in the middle of it.
  for (let col = 0; col < COLS; col++) {
    const printed = col + 1;
    if (printed !== 1 && printed % 5 !== 0 && printed !== COLS) continue;
    const label = String(printed);
    p.text(label, columnX(col), rowZ(0) - NUMBER_OFFSET, NUMBER_CAP, PRINT);
    p.text(label, columnX(col), rowZ(ROWS - 1) + NUMBER_OFFSET, NUMBER_CAP, PRINT);
  }

  // Row letters at both ends, in the margin the 63 columns leave.
  for (let row = 0; row < ROWS; row++) {
    const letter = ROW_LETTERS[row];
    p.text(letter, -TOP_W / 2 + LETTER_INSET, rowZ(row), LETTER_CAP, PRINT);
    p.text(letter, TOP_W / 2 - LETTER_INSET, rowZ(row), LETTER_CAP, PRINT);
  }

  return p.texture();
}

/** The printed surface, a tenth of a millimetre above the moulding. */
const PRINT_LIFT = 0.003;
/**
 * The socket faces, a further twentieth of a millimetre above the printing.
 *
 * Small enough to be invisible even from the front camera, where the board is
 * seen nearly edge on, and paired with a polygon offset on the material
 * because expo-gl does not promise a 24 bit depth buffer and a coplanar decal
 * on a 16 bit one flickers as the camera moves.
 */
const SOCKET_LIFT = PRINT_LIFT + 0.002;
/**
 * Sides per socket.
 *
 * Fourteen. At the closest the camera is allowed (radius 1.1) a socket is
 * about 77 device pixels across, and a coarser polygon shows its corners at
 * that size. Fourteen sides is 42 triangles, and 830 of them is 35,000
 * triangles in ONE instanced draw call, which a phone GPU does not notice.
 */
const SOCKET_SIDES = 14;

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
 * Write a flat colour into a geometry's vertex colour attribute.
 *
 * The socket's lip and its mouth are two different colours on one geometry, so
 * that both can be drawn by one material in one instanced call. Vertex colours
 * are read in the renderer's WORKING space, not sRGB, so the hex is converted
 * rather than divided by 255: skip that and every socket comes out washed out.
 */
function tint(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * One socket face, as geometry to be instanced 830 times.
 *
 * A ring for the moulded lip and a disc for the mouth, merged and tinted so
 * the pair is one buffer and one draw. This is the same construction the web
 * scene uses per hole; the only difference is that all 830 share one submission
 * here instead of costing 1,660.
 */
function socketGeometry(): THREE.BufferGeometry {
  const rim = new THREE.RingGeometry(HOLE_RADIUS, SOCKET_LIP_RADIUS, SOCKET_SIDES);
  rim.rotateX(-Math.PI / 2);
  tint(rim, 0xa7adb6);

  const mouth = new THREE.CircleGeometry(HOLE_RADIUS, SOCKET_SIDES);
  mouth.rotateX(-Math.PI / 2);
  tint(mouth, 0x15181d);

  return mergeSingle([rim, mouth]);
}

export interface BreadboardMesh extends THREE.Group {
  /** The instanced socket faces, kept so the scene can reach them. */
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
  top.position.y = PRINT_LIFT;
  top.receiveShadow = true;
  group.add(top);

  const sockets = new THREE.InstancedMesh(socketGeometry(), materials.socket, COLS * ROWS + RAILS.length * RAIL_HOLES);
  sockets.name = 'breadboard.sockets';
  sockets.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      m.makeTranslation(columnX(col), SOCKET_LIFT, rowZ(row));
      sockets.setMatrixAt(i++, m);
    }
  }
  for (const rail of RAILS) {
    for (let h = 0; h < RAIL_HOLES; h++) {
      m.makeTranslation(railHoleX(h), SOCKET_LIFT, rail.z);
      sockets.setMatrixAt(i++, m);
    }
  }
  sockets.instanceMatrix.needsUpdate = true;
  // They take shadow like the surface they sit two hundredths of a millimetre
  // above. Without this the 830 faces stay fully lit inside every shadow a part
  // throws, and a resistor's shadow comes out full of bright rings floating on
  // dark plastic: exactly the "these holes are painted on" read the whole
  // change was made to kill.
  sockets.receiveShadow = true;
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
  // board turns to mush. The caller passes the renderer's real limit rather
  // than a number picked here, because the limit is a device fact.
  tex.anisotropy = Math.max(1, Math.floor(anisotropy));
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

/**
 * Everything the board's look is measured against.
 *
 * Exported so the headless check can assert the numbers instead of a person
 * squinting at a screenshot, which is how three rounds of "you still cannot
 * see the pins" happened.
 */
export const BREADBOARD_PRINT = {
  texture: { width: TEX_W, height: TEX_H, spanX: TOP_W, spanZ: TOP_D },
  socket: { mouth: HOLE_RADIUS, lip: SOCKET_LIP_RADIUS, sides: SOCKET_SIDES, lift: SOCKET_LIFT },
  printLift: PRINT_LIFT,
  glyph: {
    number: { cap: NUMBER_CAP, offset: NUMBER_OFFSET },
    letter: { cap: LETTER_CAP, inset: LETTER_INSET },
    polarity: { cap: POLARITY_CAP, inset: POLARITY_INSET, columns: POLARITY_COLUMNS },
  },
  colors: {
    plastic: PLASTIC, plasticShade: PLASTIC_SHADE,
    rim: SOCKET_RIM, mouth: SOCKET_MOUTH, print: PRINT,
    red: RED_LINE, blue: BLUE_LINE,
  },
} as const;
