// ── A 5 by 7 silkscreen font ──
//
// The row letters and the column numbers on a breadboard are not decoration.
// "Put the LED in e12" is unfollowable on a board with no printing, and a
// board with no printing is a grid of dots, which is exactly the thing the
// anti slop rules call out.
//
// So the labels have to be real, and there are only three ways to get text
// into a three.js scene: a font atlas (a network fetch and a texture we do not
// control), troika text (a dependency and a mesh per label, which is hundreds
// of draw calls), or drawing the glyphs ourselves into the board's own
// texture. The third costs nothing at runtime and no dependency at all, and a
// 5 by 7 font is what silkscreen actually looks like.
//
// Written as pictures rather than hex so a wrong pixel is visible in review.

const ART: Record<string, string> = {
  ' ': '..... ..... ..... ..... ..... ..... .....',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '##### ...#. ..#.. ...#. ....# #...# .###.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '..##. .#... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ...#. .##..',

  A: '..#.. .#.#. #...# #...# ##### #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '###.. #..#. #...# #...# #...# #..#. ###..',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .###.',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',

  // Only a to j: they are the row letters, and nothing else on either board is
  // set in lower case.
  a: '..... ..... .###. ....# .#### #...# .####',
  b: '#.... #.... ####. #...# #...# #...# ####.',
  c: '..... ..... .#### #.... #.... #.... .####',
  d: '....# ....# .#### #...# #...# #...# .####',
  e: '..... ..... .###. #...# ##### #.... .###.',
  f: '..##. .#..# .#... ####. .#... .#... .#...',
  g: '..... .#### #...# #...# .#### ....# .###.',
  h: '#.... #.... ####. #...# #...# #...# #...#',
  i: '..#.. ..... .##.. ..#.. ..#.. ..#.. .###.',
  j: '...#. ..... ..##. ...#. ...#. #..#. .##..',

  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '-': '..... ..... ..... ##### ..... ..... .....',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  '~': '..... ..... .#... #.#.# ...#. ..... .....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Blank columns between glyphs, in glyph pixels. */
export const GLYPH_GAP = 1;

/**
 * Column major bit masks: one number per glyph column, bit 0 the top row.
 *
 * Packed once at module load rather than parsed per draw, because the board
 * texture writes a few hundred glyphs and string indexing per pixel on Hermes
 * is measurably slower than a shift and a mask.
 */
const PACKED: Record<string, number[]> = {};
for (const [ch, art] of Object.entries(ART)) {
  const rows = art.split(' ');
  const cols: number[] = [];
  for (let x = 0; x < GLYPH_W; x++) {
    let bits = 0;
    for (let y = 0; y < GLYPH_H; y++) {
      if (rows[y] && rows[y][x] === '#') bits |= 1 << y;
    }
    cols.push(bits);
  }
  PACKED[ch] = cols;
}

/** The column masks for a character, or the blank glyph if it is not in the set. */
export function glyph(ch: string): number[] {
  return PACKED[ch] ?? PACKED[' '];
}

/** Width of a string in glyph pixels, gaps included. */
export function textWidth(s: string): number {
  return s.length === 0 ? 0 : s.length * GLYPH_W + (s.length - 1) * GLYPH_GAP;
}
