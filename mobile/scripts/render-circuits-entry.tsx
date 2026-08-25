import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CIRCUITS, regionsFor } from '../src/components/circuits/CircuitDiagram';

export function sheet() {
  const keys = Object.keys(CIRCUITS);
  const COLS = 3, W = 320, H = 170, PAD = 30, LABEL = 24;
  const rows = Math.ceil(keys.length / COLS);
  const parts = keys.map((k, i) => {
    const x = PAD + (i % COLS) * (W + PAD);
    const y = PAD + Math.floor(i / COLS) * (H + PAD + LABEL);
    const D = CIRCUITS[k];
    const inner = renderToStaticMarkup(React.createElement(D)).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    // Tap targets drawn over the diagram. A hit area is invisible in the app, so
    // the only way to know a rectangle actually covers its component is to look
    // at it — coordinates that read fine in source can sit 40px off the symbol.
    const hits = regionsFor(k).map((r) =>
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#549cf0" fill-opacity="0.16"`
      + ` stroke="#3e86e8" stroke-width="1.4" stroke-dasharray="4 3"/>`
      + `<text x="${r.x + 3}" y="${r.y + 11}" font-family="monospace" font-size="9" fill="#1d4f9c">${r.id}</text>`,
    ).join('');
    return `<text x="${x}" y="${y - 8}" font-family="monospace" font-size="13" font-weight="bold">${k}</text>
            <g transform="translate(${x},${y})">${inner}${hits}</g>`;
  });
  const w = PAD + COLS * (W + PAD), h = PAD + rows * (H + PAD + LABEL);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>${parts.join('')}</svg>`;
}
