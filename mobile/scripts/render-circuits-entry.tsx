import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CIRCUITS } from '../src/components/circuits/CircuitDiagram';

export function sheet() {
  const keys = Object.keys(CIRCUITS);
  const COLS = 3, W = 320, H = 170, PAD = 30, LABEL = 24;
  const rows = Math.ceil(keys.length / COLS);
  const parts = keys.map((k, i) => {
    const x = PAD + (i % COLS) * (W + PAD);
    const y = PAD + Math.floor(i / COLS) * (H + PAD + LABEL);
    const D = CIRCUITS[k];
    const inner = renderToStaticMarkup(React.createElement(D)).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    return `<text x="${x}" y="${y - 8}" font-family="monospace" font-size="13" font-weight="bold">${k}</text>
            <g transform="translate(${x},${y})">${inner}</g>`;
  });
  const w = PAD + COLS * (W + PAD), h = PAD + rows * (H + PAD + LABEL);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>${parts.join('')}</svg>`;
}
