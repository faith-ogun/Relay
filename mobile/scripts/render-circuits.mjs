// Renders every mobile circuit diagram to one static SVG contact sheet, so a
// schematic can be checked by eye before it reaches a learner. Symbols that
// overlap their own labels, wires that lead nowhere, and a fault diagram with
// nothing to bypass all look fine in code and wrong on screen; four such
// defects were caught this way on the first pass.
//
// It renders the REAL component tree: react-native-svg's elements map 1:1 onto
// SVG host elements, so shimming that module (plus the two react-native
// primitives the Frame uses) needs no second copy of the drawings.
//
//   node scripts/render-circuits.mjs && open scripts/circuits-sheet.svg
//
// The sheet is generated output and is gitignored; regenerate it after any
// change to a diagram and look at it before shipping.
//
// esbuild is resolved from ../frontend, which already depends on it for the
// curriculum export; it is a dev-only tool and not worth a second copy.
import { build } from '/Users/faith/Desktop/Ohmlet/frontend/node_modules/esbuild/lib/main.js';
import { writeFileSync } from 'node:fs';

const shim = {
  name: 'shim',
  setup(b) {
    b.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: 'rnsvg', namespace: 'shim' }));
    b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'rn', namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => ({
      contents: a.path === 'rnsvg'
        ? `import React from 'react';
           const h = (t) => (p) => React.createElement(t, p);
           export const Svg = (p) => React.createElement('svg', {...p, xmlns:'http://www.w3.org/2000/svg'});
           export const Circle = h('circle'); export const Line = h('line');
           export const Path = h('path'); export const Rect = h('rect');
           export const G = h('g'); export const Text = h('text');
           export default Svg;`
        : `export const View = 'div'; export const Text = 'span';
           export const StyleSheet = { create: (o) => o, absoluteFill: {} };`,
      loader: 'js', resolveDir: process.cwd(),
    }));
  },
};

await build({
  entryPoints: ['./scripts/render-circuits-entry.tsx'],
  bundle: true, format: 'esm', outfile: './scripts/.render-out.mjs',
  jsx: 'automatic', plugins: [shim], external: ['react', 'react-dom'],
  absWorkingDir: process.cwd(),
});
const { sheet } = await import(new URL('.render-out.mjs', import.meta.url).href);
writeFileSync('./scripts/circuits-sheet.svg', sheet());
console.log('wrote sheet.svg');
