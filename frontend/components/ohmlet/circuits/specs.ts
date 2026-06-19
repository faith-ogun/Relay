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

  // ── Unit 8: op-amp inverting amplifier (Vout = −(Rf/Rin)·Vin) ──
  // DRAFT diagram (pending visual review). Geometry computed from the primitive
  // ports: op-amp −in at (cx-34, cy-10), +in at (cx-34, cy+10), out at (cx+36, cy);
  // resistor leads at ±25; arduino_pin edges at ±14.
  opamp_inverting: {
    id: 'opamp_inverting',
    title: 'Inverting Amplifier',
    width: 400,
    height: 210,
    nodes: [
      { id: 'in', kind: 'arduino_pin', x: 55, y: 105, pin: 'Vin' },
      { id: 'rin', kind: 'resistor', x: 115, y: 105, label: 'Rin' },
      { id: 'vminus', kind: 'junction', x: 160, y: 105, clickable: false },
      { id: 'rf', kind: 'resistor', x: 185, y: 55, label: 'Rf' },
      { id: 'opamp', kind: 'opamp', x: 235, y: 115, label: 'op-amp' },
      { id: 'out', kind: 'arduino_pin', x: 335, y: 115, pin: 'Vout' },
      { id: 'gnd', kind: 'ground', x: 201, y: 168, clickable: false },
    ],
    wires: [
      { x1: 69, y1: 105, x2: 90, y2: 105 },    // Vin -> Rin
      { x1: 140, y1: 105, x2: 160, y2: 105 },  // Rin -> summing node
      { x1: 160, y1: 105, x2: 201, y2: 105 },  // summing node -> inverting input
      { x1: 160, y1: 105, x2: 160, y2: 55 },   // summing node up to Rf
      { x1: 210, y1: 55, x2: 271, y2: 55 },    // Rf -> output rail
      { x1: 271, y1: 55, x2: 271, y2: 115 },   // rail down to output
      { x1: 271, y1: 115, x2: 321, y2: 115 },  // output -> Vout
      { x1: 201, y1: 125, x2: 201, y2: 168 },  // non-inverting input -> ground
    ],
    annotations: [
      { x: 150, y: 99, text: '0V', color: '#3b82f6', size: 9 },
      { x: 200, y: 198, text: 'Vout = −(Rf / Rin) · Vin', size: 11 },
    ],
  },

  // ── Unit 8: op-amp non-inverting amplifier (Vout = (1 + Rf/Rg)·Vin) ──
  // DRAFT diagram (pending visual review).
  opamp_noninverting: {
    id: 'opamp_noninverting',
    title: 'Non-Inverting Amplifier',
    width: 400,
    height: 215,
    nodes: [
      { id: 'in', kind: 'arduino_pin', x: 55, y: 125, pin: 'Vin' },
      { id: 'vminus', kind: 'junction', x: 160, y: 105, clickable: false },
      { id: 'rf', kind: 'resistor', x: 185, y: 55, label: 'Rf' },
      { id: 'rg', kind: 'resistor', x: 160, y: 150, rotation: 90, label: 'Rg' },
      { id: 'opamp', kind: 'opamp', x: 235, y: 115, label: 'op-amp' },
      { id: 'out', kind: 'arduino_pin', x: 335, y: 115, pin: 'Vout' },
      { id: 'gnd', kind: 'ground', x: 160, y: 178, clickable: false },
    ],
    wires: [
      { x1: 69, y1: 125, x2: 201, y2: 125 },   // Vin -> non-inverting input
      { x1: 201, y1: 105, x2: 160, y2: 105 },  // inverting input -> feedback node
      { x1: 160, y1: 105, x2: 160, y2: 55 },   // feedback node up to Rf
      { x1: 210, y1: 55, x2: 271, y2: 55 },    // Rf -> output rail
      { x1: 271, y1: 55, x2: 271, y2: 115 },   // rail down to output
      { x1: 271, y1: 115, x2: 321, y2: 115 },  // output -> Vout
      { x1: 160, y1: 105, x2: 160, y2: 125 },  // feedback node down to Rg
      { x1: 160, y1: 175, x2: 160, y2: 178 },  // Rg -> ground
    ],
    annotations: [
      { x: 200, y: 203, text: 'Vout = (1 + Rf / Rg) · Vin', size: 11 },
    ],
  },

  // ── Unit 11: linear voltage regulator (7805): Vin -> REG -> fixed 5V out ──
  // DRAFT diagram (pending visual review). Regulator ports: IN at (cx-37, cy),
  // OUT at (cx+37, cy), GND at (cx, cy+32). Caps are rotated 90 (leads vertical).
  voltage_regulator: {
    id: 'voltage_regulator',
    title: 'Linear Voltage Regulator',
    width: 420,
    height: 220,
    nodes: [
      { id: 'in', kind: 'arduino_pin', x: 50, y: 90, pin: 'Vin' },
      { id: 'node_in', kind: 'junction', x: 110, y: 90, clickable: false },
      { id: 'cin', kind: 'capacitor', x: 110, y: 150, rotation: 90, polarized: true, label: 'Cin' },
      { id: 'gnd_in', kind: 'ground', x: 110, y: 185, clickable: false },
      { id: 'reg', kind: 'regulator', x: 210, y: 90, label: '7805' },
      { id: 'gnd_reg', kind: 'ground', x: 210, y: 122, clickable: false },
      { id: 'node_out', kind: 'junction', x: 310, y: 90, clickable: false },
      { id: 'cout', kind: 'capacitor', x: 310, y: 150, rotation: 90, polarized: true, label: 'Cout' },
      { id: 'gnd_out', kind: 'ground', x: 310, y: 185, clickable: false },
      { id: 'out', kind: 'arduino_pin', x: 370, y: 90, pin: 'Vout' },
    ],
    wires: [
      { x1: 64, y1: 90, x2: 110, y2: 90 },     // Vin -> input node
      { x1: 110, y1: 90, x2: 173, y2: 90 },    // input node -> regulator IN
      { x1: 110, y1: 90, x2: 110, y2: 130 },   // input node down to Cin
      { x1: 110, y1: 170, x2: 110, y2: 185 },  // Cin -> ground
      { x1: 247, y1: 90, x2: 310, y2: 90 },    // regulator OUT -> output node
      { x1: 310, y1: 90, x2: 356, y2: 90 },    // output node -> Vout
      { x1: 310, y1: 90, x2: 310, y2: 130 },   // output node down to Cout
      { x1: 310, y1: 170, x2: 310, y2: 185 },  // Cout -> ground
    ],
    annotations: [
      { x: 50, y: 74, text: '9V in', size: 9 },
      { x: 370, y: 74, text: '5V out', color: '#22c55e', size: 9 },
      { x: 210, y: 208, text: 'Regulator drops Vin to a fixed 5V; caps tame ripple', size: 10 },
    ],
  },

  // ── Unit 12: H-bridge (4 NPN transistors + motor): diagonal pairs set direction ──
  // DRAFT diagram (pending visual review). Transistor ports (fixed orientation):
  // collector (top) at (x+10, y-30), emitter (bottom) at (x+10, y+30), base at (x-24, y).
  h_bridge: {
    id: 'h_bridge',
    title: 'H-Bridge Motor Driver',
    width: 420,
    height: 320,
    nodes: [
      { id: 'q1', kind: 'transistor_npn', x: 130, y: 90 },
      { id: 'q2', kind: 'transistor_npn', x: 290, y: 90 },
      { id: 'q3', kind: 'transistor_npn', x: 130, y: 230 },
      { id: 'q4', kind: 'transistor_npn', x: 290, y: 230 },
      { id: 'motor', kind: 'motor', x: 210, y: 160, label: 'motor' },
      { id: 'left_node', kind: 'junction', x: 140, y: 160, clickable: false },
      { id: 'right_node', kind: 'junction', x: 300, y: 160, clickable: false },
      { id: 'gnd', kind: 'ground', x: 210, y: 270, clickable: false },
    ],
    wires: [
      // +V rail across the top, joining both high-side collectors
      { x1: 140, y1: 50, x2: 300, y2: 50, color: '#ef4444' },
      { x1: 140, y1: 50, x2: 140, y2: 60, color: '#ef4444' },
      { x1: 300, y1: 50, x2: 300, y2: 60, color: '#ef4444' },
      // left motor terminal: Q1 emitter -> node -> Q3 collector, motor left lead joins
      { x1: 140, y1: 120, x2: 140, y2: 200 },
      { x1: 140, y1: 160, x2: 180, y2: 160 },
      // right motor terminal: Q2 emitter -> node -> Q4 collector, motor right lead joins
      { x1: 300, y1: 120, x2: 300, y2: 200 },
      { x1: 240, y1: 160, x2: 300, y2: 160 },
      // ground rail across the bottom, joining both low-side emitters
      { x1: 140, y1: 270, x2: 300, y2: 270 },
      { x1: 140, y1: 260, x2: 140, y2: 270 },
      { x1: 300, y1: 260, x2: 300, y2: 270 },
    ],
    annotations: [
      { x: 210, y: 42, text: '+V', color: '#ef4444', size: 10 },
      { x: 96, y: 86, text: 'Q1', size: 10, align: 'end' },
      { x: 324, y: 86, text: 'Q2', size: 10, align: 'start' },
      { x: 96, y: 226, text: 'Q3', size: 10, align: 'end' },
      { x: 324, y: 226, text: 'Q4', size: 10, align: 'start' },
      { x: 210, y: 305, text: 'Q1+Q4 on: spin one way · Q2+Q3 on: reverse · never both on one side', size: 10 },
    ],
  },
};

export const SPEC_CIRCUIT_IDS = Object.keys(SPEC_CIRCUITS);
export const isSpecCircuit = (id: string): boolean => id in SPEC_CIRCUITS;
