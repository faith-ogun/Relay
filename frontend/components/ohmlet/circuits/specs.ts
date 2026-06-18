// ── Circuit specs (data-authored diagrams) ──
//
// Pure data: each entry is a CircuitSpec the SpecCircuit renderer draws from the
// shared primitives. New diagrams for Units 6+ live here as data, not hand-coded
// SVG. Region ids = node ids, derived into the registry so the linter validates
// them automatically.
//
// No React import here on purpose — the lesson linter (run via Node) imports this
// to derive regions, and must not pull in the browser renderer.

import type { CircuitSpec } from './spec';

export const SPEC_CIRCUITS: Record<string, CircuitSpec> = {
  // ── Unit 6: RC low-pass filter (R in series, C to ground, output at midpoint) ──
  rc_low_pass: {
    id: 'rc_low_pass',
    title: 'RC Low-Pass Filter',
    width: 400,
    height: 230,
    nodes: [
      { id: 'in', kind: 'arduino_pin', x: 55, y: 90, pin: 'IN' },
      { id: 'resistor', kind: 'resistor', x: 150, y: 90, label: 'R' },
      { id: 'mid', kind: 'junction', x: 245, y: 90, clickable: false },
      { id: 'out', kind: 'arduino_pin', x: 332, y: 90, pin: 'OUT' },
      { id: 'capacitor', kind: 'capacitor', x: 245, y: 155, rotation: 90, label: 'C' },
      { id: 'gnd', kind: 'ground', x: 245, y: 195, clickable: false },
    ],
    wires: [
      { x1: 69, y1: 90, x2: 125, y2: 90 },
      { x1: 175, y1: 90, x2: 316, y2: 90 },
      { x1: 245, y1: 90, x2: 245, y2: 135 },
      { x1: 245, y1: 175, x2: 245, y2: 195 },
    ],
    annotations: [
      { x: 245, y: 78, text: 'Vout', color: '#22c55e', size: 10 },
      { x: 200, y: 218, text: 'fc = 1 / (2π·R·C)', size: 11 },
    ],
  },

  // ── Unit 7: NPN low-side switch driving a relay coil, with flyback diode ──
  transistor_switch: {
    id: 'transistor_switch',
    title: 'NPN Low-Side Switch',
    width: 400,
    height: 250,
    nodes: [
      { id: 'd9', kind: 'arduino_pin', x: 48, y: 175, pin: 'D9' },
      { id: 'base_resistor', kind: 'resistor', x: 95, y: 175, label: 'Rb' },
      { id: 'transistor', kind: 'transistor_npn', x: 160, y: 175, label: 'NPN' },
      { id: 'relay', kind: 'resistor', x: 170, y: 90, rotation: 90, label: 'Relay' },
      { id: 'diode', kind: 'diode', x: 250, y: 90, rotation: 270, label: 'flyback' },
      { id: 'collector', kind: 'junction', x: 170, y: 130, clickable: false },
      { id: 'emitter_gnd', kind: 'ground', x: 170, y: 225, clickable: false },
    ],
    wires: [
      // top +12V rail joining relay top and diode top (cathode)
      { x1: 170, y1: 50, x2: 250, y2: 50, color: '#ef4444' },
      { x1: 170, y1: 50, x2: 170, y2: 65, color: '#ef4444' },
      { x1: 250, y1: 50, x2: 250, y2: 70, color: '#ef4444' },
      // relay bottom -> collector node -> transistor collector (top lead at x=170)
      { x1: 170, y1: 115, x2: 170, y2: 145 },
      // diode bottom (anode) joins the collector node
      { x1: 250, y1: 110, x2: 250, y2: 130 },
      { x1: 250, y1: 130, x2: 170, y2: 130 },
      // emitter -> ground
      { x1: 170, y1: 205, x2: 170, y2: 225 },
      // base drive: D9 -> Rb -> base (base lead lands at x=136)
      { x1: 62, y1: 175, x2: 70, y2: 175 },
      { x1: 120, y1: 175, x2: 136, y2: 175 },
    ],
    annotations: [
      { x: 150, y: 44, text: '+12V', color: '#ef4444', size: 10, align: 'end' },
    ],
  },
};

export const SPEC_CIRCUIT_IDS = Object.keys(SPEC_CIRCUITS);
export const isSpecCircuit = (id: string): boolean => id in SPEC_CIRCUITS;
