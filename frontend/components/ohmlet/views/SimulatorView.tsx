import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Cpu, Flame, Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { solve, initTransient, stepTransient, toMA, type Comp, type SolveResult, type TransientState } from '../sim/engine';

/**
 * SimulatorView (#67) — Ohmlet's own circuit simulator (Option C).
 *
 * Not a mockup: a real nodal-analysis engine (sim/engine.ts) solves every node
 * voltage and branch current live — including diodes, a transient capacitor model
 * (real RC time), and NPN transistors (off / saturated / active). Circuits are
 * data (the CIRCUITS registry), grouped by the same families the curriculum
 * teaches, so the library grows by adding data, not bespoke SVG.
 */

const LED_MAX_MA = 25;

// ── Component value models ──
const LDR_DARK = 50000, LDR_BRIGHT = 150;
const ldrR = (lightPct: number) => LDR_DARK * Math.pow(LDR_BRIGHT / LDR_DARK, clamp01(lightPct / 100));
const NTC_COLD = 100000, NTC_HOT = 1000;
const ntcR = (tempPct: number) => NTC_COLD * Math.pow(NTC_HOT / NTC_COLD, clamp01(tempPct / 100));
const POT_MAX = 2000;
const potR = (knobPct: number) => Math.max(1, clamp01(knobPct / 100) * POT_MAX);
const SW_OPEN = 1e7, SW_CLOSED = 0.01;

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// ── Types ──
type ParamDef = { key: string; label: string; min: number; max: number; step: number; unit: string; def: number; type?: 'slider' | 'toggle'; onLabel?: string; offLabel?: string; fmt?: (v: number) => string };
type Row = { label: string; current?: number; power?: number; value?: string; led?: boolean; over?: boolean; hot?: boolean };

type Part =
  | { t: 'bat'; x: number; y: number; v: number; rot?: number }
  | { t: 'res'; x: number; y: number; label: string; rot?: number; heat?: number }
  | { t: 'led'; x: number; y: number; bright: number; over?: boolean; small?: boolean; heat?: number }
  | { t: 'diode'; x: number; y: number; rot?: number; on?: boolean; heat?: number; label?: string }
  | { t: 'cap'; x: number; y: number; rot?: number; label: string; charge?: number; heat?: number }
  | { t: 'npn'; x: number; y: number; on?: boolean; label?: string }
  | { t: 'ldr'; x: number; y: number; label: string; lit: number; heat?: number }
  | { t: 'ntc'; x: number; y: number; label: string; warm: number; rot?: number; heat?: number }
  | { t: 'pot'; x: number; y: number; label: string; frac: number; heat?: number }
  | { t: 'sw'; x: number; y: number; closed: boolean }
  | { t: 'buzz'; x: number; y: number; on: boolean; label?: string }
  | { t: 'motor'; x: number; y: number; spin: number; label?: string }
  | { t: 'dot'; x: number; y: number }
  | { t: 'gnd'; x: number; y: number };

type Chip = { x: number; y: number; v: number; kind: 'hi' | 'mid' | 'gnd' };
type WireSpec = { d: string; i?: string };
type Scene = { wires: WireSpec[]; parts: Part[]; chips: Chip[] };

interface Circuit {
  id: string;
  cat: string;
  name: string;
  blurb: string;
  level: 1 | 2 | 3;
  params: ParamDef[];
  build: (p: Record<string, number>) => Comp[];
  scene: (p: Record<string, number>, res: SolveResult) => Scene;
  rows: (p: Record<string, number>, res: SolveResult) => Row[];
  tutor: (p: Record<string, number>, res: SolveResult) => React.ReactNode;
  warn?: (p: Record<string, number>, res: SolveResult) => string | undefined;
  transient?: { dt: number; sub: number; duration: number; probe: (r: SolveResult) => number; vmax: number; init?: (p: Record<string, number>) => Record<string, number>; probeLabel: string };
}

// ── Geometry helpers ──
const LOOP = 'M110 80 H520 V300 H110 Z';
const power = (res: SolveResult, id: string, vacross: number) => Math.abs(vacross) * Math.abs(res.I[id] ?? 0);

// ────────────────────────────────────────────────────────────────────────────
//  CIRCUIT REGISTRY
// ────────────────────────────────────────────────────────────────────────────

const CIRCUITS: Circuit[] = [
  // ── Basics ──
  {
    id: 'ohm-led', cat: 'Basics', name: 'LED + resistor', level: 1,
    blurb: 'The classic. A resistor limits the current so the LED survives.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R', label: 'Resistor', min: 33, max: 1000, step: 1, unit: 'Ω', def: 220 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'r', a: 1, b: 2, value: p.R }, { kind: 'LED', id: 'led', anode: 2, cathode: 0 }],
    scene: (p, res) => {
      const mA = toMA(res.I.led ?? 0);
      return {
        wires: [{ d: LOOP, i: 'led' }],
        parts: [
          { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'res', x: 310, y: 80, label: `${fmt(p.R)} Ω`, heat: power(res, 'r', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
          { t: 'led', x: 520, y: 190, bright: Math.min(1, mA / 20), over: mA > LED_MAX_MA, heat: power(res, 'led', res.V[2] ?? 0) },
        ],
        chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 520, y: 62, v: res.V[2] ?? 0, kind: 'mid' }, { x: 315, y: 322, v: 0, kind: 'gnd' }],
      };
    },
    rows: (p, res) => {
      const iLed = res.I.led ?? 0;
      return [
        { label: 'Resistor', current: res.I.r ?? 0, power: power(res, 'r', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
        { label: 'LED', current: iLed, power: power(res, 'led', res.V[2] ?? 0), led: true, over: toMA(iLed) > LED_MAX_MA },
      ];
    },
    warn: (p, res) => { const mA = toMA(res.I.led ?? 0); return mA > LED_MAX_MA ? `LED current is ${fmt(mA)} mA, over the ~${LED_MAX_MA} mA limit. Raise the resistor.` : undefined; },
    tutor: (p, res) => {
      const i = toMA(res.I.led ?? 0);
      if (i > LED_MAX_MA) return <>That's <b>{fmt(i)} mA</b> through the LED, too much. Drop the supply or raise the resistor before it cooks.</>;
      if (i < 3) return <>Big resistor, tiny current ({fmt(i)} mA), so the LED is dim. <b>I = (V − 2V) / R.</b></>;
      return <>{fmt(i)} mA is flowing. Lower the resistor and watch the dots speed up: <b>I = (V − V<sub>LED</sub>) / R</b>.</>;
    },
  },
  {
    id: 'divider', cat: 'Basics', name: 'Voltage divider', level: 1,
    blurb: 'Two resistors split the voltage. The heart of every sensor reading.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 12, step: 0.5, unit: 'V', def: 5 },
      { key: 'R1', label: 'R1 (top)', min: 100, max: 10000, step: 10, unit: 'Ω', def: 1000 },
      { key: 'R2', label: 'R2 (bottom)', min: 100, max: 10000, step: 10, unit: 'Ω', def: 2000 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'r1', a: 1, b: 2, value: p.R1 }, { kind: 'R', id: 'r2', a: 2, b: 0, value: p.R2 }],
    scene: (p, res) => ({
      wires: [{ d: 'M150 70 V120 M150 200 V250 M150 300 H470 V70 H150 M470 250 V300', i: 'r1' }],
      parts: [
        { t: 'bat', x: 470, y: 185, v: p.V, rot: 90 },
        { t: 'res', x: 150, y: 160, label: `${fmt(p.R1)} Ω`, rot: 90, heat: power(res, 'r1', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
        { t: 'res', x: 150, y: 275, label: `${fmt(p.R2)} Ω`, rot: 90, heat: power(res, 'r2', res.V[2] ?? 0) },
        { t: 'dot', x: 150, y: 250 },
      ],
      chips: [{ x: 150, y: 52, v: res.V[1] ?? 0, kind: 'hi' }, { x: 232, y: 250, v: res.V[2] ?? 0, kind: 'mid' }, { x: 150, y: 318, v: 0, kind: 'gnd' }],
    }),
    rows: (p, res) => { const i = res.I.r1 ?? 0; return [{ label: 'R1 (top)', current: i, power: power(res, 'r1', (res.V[1] ?? 0) - (res.V[2] ?? 0)) }, { label: 'R2 (bottom)', current: i, power: power(res, 'r2', res.V[2] ?? 0) }]; },
    tutor: (p, res) => <>R1 and R2 share the supply: <b>Vout = V · R2/(R1+R2) = {fmt(res.V[2] ?? 0)} V</b>. Swap R2 for a sensor and Vout reports the world.</>,
  },
  {
    id: 'parallel-led', cat: 'Basics', name: 'Two LEDs in parallel', level: 2,
    blurb: 'Same supply, different resistors. See why the smaller resistor glows brighter.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R1', label: 'R · LED 1', min: 33, max: 1000, step: 1, unit: 'Ω', def: 220 },
      { key: 'R2', label: 'R · LED 2', min: 33, max: 1000, step: 1, unit: 'Ω', def: 470 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'r1', a: 1, b: 2, value: p.R1 }, { kind: 'LED', id: 'l1', anode: 2, cathode: 0 }, { kind: 'R', id: 'r2', a: 1, b: 3, value: p.R2 }, { kind: 'LED', id: 'l2', anode: 3, cathode: 0 }],
    scene: (p, res) => {
      const i1 = toMA(res.I.l1 ?? 0), i2 = toMA(res.I.l2 ?? 0);
      return {
        wires: [{ d: 'M110 80 H300 V300 H110 Z', i: 'l1' }, { d: 'M300 80 H530 V300 H300 Z', i: 'l2' }, { d: 'M110 80 H530 M110 300 H530' }],
        parts: [
          { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'res', x: 210, y: 80, label: `${fmt(p.R1)} Ω`, heat: power(res, 'r1', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
          { t: 'led', x: 300, y: 190, bright: Math.min(1, i1 / 20), over: i1 > LED_MAX_MA, small: true, heat: power(res, 'l1', res.V[2] ?? 0) },
          { t: 'res', x: 420, y: 80, label: `${fmt(p.R2)} Ω`, heat: power(res, 'r2', (res.V[1] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'led', x: 530, y: 190, bright: Math.min(1, i2 / 20), over: i2 > LED_MAX_MA, small: true, heat: power(res, 'l2', res.V[3] ?? 0) },
        ],
        chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }],
      };
    },
    rows: (p, res) => {
      const i1 = res.I.l1 ?? 0, i2 = res.I.l2 ?? 0;
      return [
        { label: 'LED 1', current: i1, power: power(res, 'l1', res.V[2] ?? 0), led: true, over: toMA(i1) > LED_MAX_MA },
        { label: 'LED 2', current: i2, power: power(res, 'l2', res.V[3] ?? 0), led: true, over: toMA(i2) > LED_MAX_MA },
      ];
    },
    warn: (p, res) => (toMA(res.I.l1 ?? 0) > LED_MAX_MA || toMA(res.I.l2 ?? 0) > LED_MAX_MA) ? 'One LED is over its current limit, increase its resistor.' : undefined,
    tutor: () => <>Same supply, different resistors → different current. The smaller resistor lets more through, so that LED is brighter. Each branch sets its own current.</>,
  },
  {
    id: 'parallel-r', cat: 'Basics', name: 'Resistors in parallel', level: 2,
    blurb: 'Two paths to ground. The current splits, and the total is the sum.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R1', label: 'R1', min: 100, max: 2200, step: 10, unit: 'Ω', def: 470 },
      { key: 'R2', label: 'R2', min: 100, max: 2200, step: 10, unit: 'Ω', def: 1000 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'r1', a: 1, b: 0, value: p.R1 }, { kind: 'R', id: 'r2', a: 1, b: 0, value: p.R2 }],
    scene: (p, res) => ({
      wires: [{ d: 'M300 80 V300', i: 'r1' }, { d: 'M430 80 V300', i: 'r2' }, { d: 'M110 80 H430 M110 300 H430 M110 80 V300' }],
      parts: [
        { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'res', x: 300, y: 175, label: `${fmt(p.R1)} Ω`, rot: 90, heat: power(res, 'r1', p.V) }, { t: 'res', x: 430, y: 175, label: `${fmt(p.R2)} Ω`, rot: 90, heat: power(res, 'r2', p.V) },
        { t: 'dot', x: 300, y: 80 }, { t: 'dot', x: 430, y: 80 },
      ],
      chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 270, y: 322, v: 0, kind: 'gnd' }],
    }),
    rows: (p, res) => {
      const i1 = res.I.r1 ?? 0, i2 = res.I.r2 ?? 0;
      return [
        { label: 'R1 branch', current: i1, power: power(res, 'r1', p.V) },
        { label: 'R2 branch', current: i2, power: power(res, 'r2', p.V) },
        { label: 'Total drawn', current: i1 + i2, value: `${fmtOhm((p.R1 * p.R2) / (p.R1 + p.R2))} eq.` },
      ];
    },
    tutor: (p, res) => <>Each resistor sees the full {fmt(p.V)} V, so the smaller one draws more. Total current is the sum, and the pair acts like one smaller resistor: <b>{fmtOhm((p.R1 * p.R2) / (p.R1 + p.R2))}</b>.</>,
  },

  // ── Sensors ──
  {
    id: 'ldr', cat: 'Sensors', name: 'Light sensor (LDR)', level: 2,
    blurb: 'An LDR drops its resistance in light, so brighter light lights the LED.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'light', label: 'Light level', min: 0, max: 100, step: 1, unit: '%', def: 72 },
      { key: 'R', label: 'Series resistor', min: 100, max: 2200, step: 10, unit: 'Ω', def: 220 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'ldr', a: 1, b: 2, value: ldrR(p.light) }, { kind: 'R', id: 'r', a: 2, b: 3, value: p.R }, { kind: 'LED', id: 'led', anode: 3, cathode: 0 }],
    scene: (p, res) => {
      const mA = toMA(res.I.led ?? 0);
      return {
        wires: [{ d: LOOP, i: 'led' }],
        parts: [
          { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'ldr', x: 250, y: 80, label: fmtOhm(ldrR(p.light)), lit: clamp01(p.light / 100), heat: power(res, 'ldr', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
          { t: 'res', x: 410, y: 80, label: `${fmt(p.R)} Ω`, heat: power(res, 'r', (res.V[2] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'led', x: 520, y: 190, bright: Math.min(1, mA / 20), over: mA > LED_MAX_MA, heat: power(res, 'led', res.V[3] ?? 0) },
        ],
        chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 520, y: 62, v: res.V[3] ?? 0, kind: 'mid' }, { x: 315, y: 322, v: 0, kind: 'gnd' }],
      };
    },
    rows: (p, res) => {
      const iLed = res.I.led ?? 0;
      return [
        { label: `LDR (${fmtOhm(ldrR(p.light))})`, current: res.I.ldr ?? 0, power: power(res, 'ldr', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
        { label: 'Resistor', current: res.I.r ?? 0, power: power(res, 'r', (res.V[2] ?? 0) - (res.V[3] ?? 0)) },
        { label: 'LED', current: iLed, power: power(res, 'led', res.V[3] ?? 0), led: true, over: toMA(iLed) > LED_MAX_MA },
      ];
    },
    warn: (p, res) => { const mA = toMA(res.I.led ?? 0); return mA > LED_MAX_MA ? `LED current is ${fmt(mA)} mA, over the limit. Raise the series resistor.` : undefined; },
    tutor: (p, res) => {
      const i = toMA(res.I.led ?? 0), r = ldrR(p.light);
      if (i > LED_MAX_MA) return <>Full sun: the LDR collapsed to <b>{fmtOhm(r)}</b>, flooding the LED with <b>{fmt(i)} mA</b>. Raise the series resistor.</>;
      if (p.light < 20) return <>Near darkness, the LDR is a wall at <b>{fmtOhm(r)}</b>, so almost nothing flows and the LED is dark. The "off" state.</>;
      return <>Light drops the LDR to <b>{fmtOhm(r)}</b>, letting <b>{fmt(i)} mA</b> through. For an alarm that fires in the dark, try the Light-Activated Alarm.</>;
    },
  },
  {
    id: 'thermistor', cat: 'Sensors', name: 'Temperature sensor', level: 2,
    blurb: 'A thermistor changes resistance with heat. Read it as a voltage.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'temp', label: 'Temperature', min: 0, max: 100, step: 1, unit: '%', def: 45 },
      { key: 'R', label: 'Fixed resistor', min: 1000, max: 47000, step: 100, unit: 'Ω', def: 10000 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'rf', a: 1, b: 2, value: p.R }, { kind: 'R', id: 'ntc', a: 2, b: 0, value: ntcR(p.temp) }],
    scene: (p, res) => ({
      wires: [{ d: 'M150 70 V120 M150 200 V250 M150 300 H470 V70 H150 M470 250 V300', i: 'rf' }],
      parts: [
        { t: 'bat', x: 470, y: 185, v: p.V, rot: 90 },
        { t: 'res', x: 150, y: 160, label: `${fmtOhm(p.R)}`, rot: 90, heat: power(res, 'rf', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
        { t: 'ntc', x: 150, y: 275, label: fmtOhm(ntcR(p.temp)), warm: clamp01(p.temp / 100), rot: 90, heat: power(res, 'ntc', res.V[2] ?? 0) },
        { t: 'dot', x: 150, y: 250 },
      ],
      chips: [{ x: 150, y: 52, v: res.V[1] ?? 0, kind: 'hi' }, { x: 232, y: 250, v: res.V[2] ?? 0, kind: 'mid' }, { x: 150, y: 318, v: 0, kind: 'gnd' }],
    }),
    rows: (p, res) => { const i = res.I.rf ?? 0; return [{ label: 'Fixed resistor', current: i, power: power(res, 'rf', (res.V[1] ?? 0) - (res.V[2] ?? 0)) }, { label: `Thermistor (${fmtOhm(ntcR(p.temp))})`, current: i, power: power(res, 'ntc', res.V[2] ?? 0) }]; },
    tutor: (p, res) => <>Hotter means lower resistance for this NTC ({fmtOhm(ntcR(p.temp))} now), so <b>Vout = {fmt(res.V[2] ?? 0)} V</b> falls as it warms. An Arduino reads that voltage as a temperature.</>,
  },
  {
    id: 'alarm', cat: 'Sensors', name: 'Light-activated alarm', level: 3,
    blurb: 'The flagship build. An LDR drives a transistor that sounds a buzzer when it gets dark.',
    params: [
      { key: 'V', label: 'Supply', min: 4, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'light', label: 'Light level', min: 0, max: 100, step: 1, unit: '%', def: 25 },
      { key: 'Rth', label: 'Threshold (top R)', min: 2200, max: 47000, step: 100, unit: 'Ω', def: 10000 },
    ],
    build: (p) => [
      { kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V },
      { kind: 'R', id: 'rth', a: 1, b: 3, value: p.Rth },
      { kind: 'R', id: 'ldr', a: 3, b: 0, value: ldrR(p.light) },
      { kind: 'R', id: 'buzz', a: 1, b: 2, value: 120 },
      { kind: 'Q', id: 'q', base: 3, collector: 2, emitter: 0, beta: 100 },
    ],
    scene: (p, res) => {
      const ic = toMA(res.I.q ?? 0), sounding = ic > 3;
      return {
        wires: [
          { d: 'M110 70 H500' },
          { d: 'M110 70 V300 H500' },
          { d: 'M500 70 V124', i: 'buzz' },
          { d: 'M500 176 V200 H412', i: 'buzz' },
          { d: 'M412 260 V300', i: 'q' },
          { d: 'M250 70 V210 H370', i: 'rth' },
          { d: 'M250 210 V300', i: 'ldr' },
        ],
        parts: [
          { t: 'bat', x: 110, y: 185, v: p.V, rot: 90 },
          { t: 'res', x: 250, y: 140, label: fmtOhm(p.Rth), rot: 90, heat: power(res, 'rth', (res.V[1] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'ldr', x: 250, y: 255, label: fmtOhm(ldrR(p.light)), lit: clamp01(p.light / 100), heat: power(res, 'ldr', res.V[3] ?? 0) },
          { t: 'buzz', x: 500, y: 150, on: sounding },
          { t: 'npn', x: 400, y: 230, on: sounding, label: 'NPN' },
          { t: 'dot', x: 250, y: 70 }, { t: 'dot', x: 250, y: 210 }, { t: 'dot', x: 500, y: 70 },
        ],
        chips: [{ x: 110, y: 52, v: res.V[1] ?? 0, kind: 'hi' }, { x: 330, y: 192, v: res.V[3] ?? 0, kind: 'mid' }],
      };
    },
    rows: (p, res) => {
      const ic = res.I.q ?? 0, ib = res.I['q/b'] ?? 0;
      return [
        { label: `LDR (${fmtOhm(ldrR(p.light))})`, current: res.I.ldr ?? 0, value: `base ${fmt(res.V[3] ?? 0)} V` },
        { label: 'Base current', current: ib, value: 'into transistor' },
        { label: 'Buzzer (load)', current: ic, power: power(res, 'buzz', (res.V[1] ?? 0) - (res.V[2] ?? 0)), hot: toMA(ic) > 3 },
      ];
    },
    tutor: (p, res) => {
      const sounding = toMA(res.I.q ?? 0) > 3, vb = res.V[3] ?? 0;
      return sounding
        ? <>Dark enough. The LDR is high-resistance, so the base sits at <b>{fmt(vb)} V</b>, the transistor turns on and the buzzer sounds. <b>ALARM.</b></>
        : <>Lit. The LDR is low-resistance and pulls the base down to <b>{fmt(vb)} V</b>, below ~0.7 V, so the transistor stays off and it's silent. Dim the light to trip it.</>;
    },
  },

  // ── Inputs & switches ──
  {
    id: 'button', cat: 'Inputs', name: 'Pushbutton + LED', level: 1,
    blurb: 'A switch only completes or breaks the loop. Press to light it.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'pressed', label: 'Button', min: 0, max: 1, step: 1, unit: '', def: 1, type: 'toggle', onLabel: 'Pressed', offLabel: 'Released' },
      { key: 'R', label: 'Resistor', min: 100, max: 1000, step: 10, unit: 'Ω', def: 220 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'sw', a: 1, b: 2, value: p.pressed >= 0.5 ? SW_CLOSED : SW_OPEN }, { kind: 'R', id: 'r', a: 2, b: 3, value: p.R }, { kind: 'LED', id: 'led', anode: 3, cathode: 0 }],
    scene: (p, res) => {
      const mA = toMA(res.I.led ?? 0);
      return {
        wires: [{ d: LOOP, i: 'led' }],
        parts: [
          { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'sw', x: 250, y: 80, closed: p.pressed >= 0.5 }, { t: 'res', x: 410, y: 80, label: `${fmt(p.R)} Ω`, heat: power(res, 'r', (res.V[2] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'led', x: 520, y: 190, bright: Math.min(1, mA / 20), over: mA > LED_MAX_MA, heat: power(res, 'led', res.V[3] ?? 0) },
        ],
        chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 520, y: 62, v: res.V[3] ?? 0, kind: 'mid' }, { x: 315, y: 322, v: 0, kind: 'gnd' }],
      };
    },
    rows: (p, res) => { const iLed = res.I.led ?? 0; return [{ label: 'Resistor', current: res.I.r ?? 0, power: power(res, 'r', (res.V[2] ?? 0) - (res.V[3] ?? 0)) }, { label: 'LED', current: iLed, power: power(res, 'led', res.V[3] ?? 0), led: true, over: toMA(iLed) > LED_MAX_MA }]; },
    tutor: (p, res) => p.pressed >= 0.5
      ? <>Circuit closed. The switch is just a bridge, so <b>{fmt(toMA(res.I.led ?? 0))} mA</b> flows and the LED lights. Let go and the path breaks.</>
      : <>Switch open, loop broken. Nowhere for current to go, so the LED is dark. A switch doesn't <i>use</i> power, it just connects or disconnects.</>,
  },
  {
    id: 'pulldown', cat: 'Inputs', name: 'Pull-down input', level: 2,
    blurb: 'How an Arduino reads a button cleanly: a resistor pins the pin LOW until you press.',
    params: [
      { key: 'V', label: 'Logic supply', min: 3, max: 5, step: 0.5, unit: 'V', def: 5 },
      { key: 'pressed', label: 'Button', min: 0, max: 1, step: 1, unit: '', def: 0, type: 'toggle', onLabel: 'Pressed', offLabel: 'Released' },
      { key: 'R', label: 'Pull-down', min: 1000, max: 47000, step: 100, unit: 'Ω', def: 10000 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'sw', a: 1, b: 2, value: p.pressed >= 0.5 ? SW_CLOSED : SW_OPEN }, { kind: 'R', id: 'pd', a: 2, b: 0, value: p.R }],
    scene: (p, res) => ({
      wires: [{ d: 'M110 80 H360 M110 80 V300 H360', i: 'sw' }, { d: 'M360 80 V300', i: 'pd' }, { d: 'M360 80 H440' }],
      parts: [
        { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'sw', x: 235, y: 80, closed: p.pressed >= 0.5 }, { t: 'res', x: 360, y: 175, label: fmtOhm(p.R), rot: 90, heat: power(res, 'pd', res.V[2] ?? 0) }, { t: 'dot', x: 360, y: 80 },
      ],
      chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 462, y: 80, v: res.V[2] ?? 0, kind: (res.V[2] ?? 0) > 2.5 ? 'hi' : 'mid' }, { x: 360, y: 322, v: 0, kind: 'gnd' }],
    }),
    rows: (p, res) => {
      const high = (res.V[2] ?? 0) > 2.5;
      return [{ label: 'Logic pin', value: `${fmt(res.V[2] ?? 0)} V`, hot: high }, { label: 'Reads as', value: high ? 'HIGH (1)' : 'LOW (0)' }, { label: 'Pull-down current', current: res.I.pd ?? 0 }];
    },
    tutor: (p, res) => p.pressed >= 0.5
      ? <>Pressed: the switch ties the pin to {fmt(p.V)} V, so it reads <b>HIGH</b>. The pull-down only wastes a trickle of current.</>
      : <>Released: with no press, the pull-down resistor holds the pin at <b>0 V</b> so it reads a clean <b>LOW</b> instead of floating randomly.</>,
  },
  {
    id: 'pot-dimmer', cat: 'Inputs', name: 'Potentiometer dimmer', level: 2,
    blurb: 'An adjustable resistor throttles the LED. Turn it down and the LED blazes.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'pot', label: 'Knob', min: 0, max: 100, step: 1, unit: '%', def: 35 },
      { key: 'R', label: 'Base resistor', min: 100, max: 470, step: 10, unit: 'Ω', def: 220 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'pot', a: 1, b: 2, value: potR(p.pot) }, { kind: 'R', id: 'r', a: 2, b: 3, value: p.R }, { kind: 'LED', id: 'led', anode: 3, cathode: 0 }],
    scene: (p, res) => {
      const mA = toMA(res.I.led ?? 0);
      return {
        wires: [{ d: LOOP, i: 'led' }],
        parts: [
          { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'pot', x: 250, y: 80, label: fmtOhm(potR(p.pot)), frac: p.pot / 100, heat: power(res, 'pot', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
          { t: 'res', x: 410, y: 80, label: `${fmt(p.R)} Ω`, heat: power(res, 'r', (res.V[2] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'led', x: 520, y: 190, bright: Math.min(1, mA / 20), over: mA > LED_MAX_MA, heat: power(res, 'led', res.V[3] ?? 0) },
        ],
        chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 330, y: 62, v: res.V[2] ?? 0, kind: 'mid' }, { x: 520, y: 62, v: res.V[3] ?? 0, kind: 'mid' }, { x: 315, y: 322, v: 0, kind: 'gnd' }],
      };
    },
    rows: (p, res) => {
      const iLed = res.I.led ?? 0;
      return [
        { label: `Pot (${fmtOhm(potR(p.pot))})`, current: res.I.pot ?? 0, power: power(res, 'pot', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
        { label: 'Base resistor', current: res.I.r ?? 0, power: power(res, 'r', (res.V[2] ?? 0) - (res.V[3] ?? 0)) },
        { label: 'LED', current: iLed, power: power(res, 'led', res.V[3] ?? 0), led: true, over: toMA(iLed) > LED_MAX_MA },
      ];
    },
    warn: (p, res) => { const mA = toMA(res.I.led ?? 0); return mA > LED_MAX_MA ? `Knob near zero leaves only the base resistor: ${fmt(mA)} mA, over the limit. Turn it up.` : undefined; },
    tutor: (p, res) => <>The knob sets the pot to <b>{fmtOhm(potR(p.pot))}</b>, throttling current to <b>{fmt(toMA(res.I.led ?? 0))} mA</b>. More resistance, dimmer LED. That's an analog input you can read.</>,
  },

  // ── Capacitors & timing (transient) ──
  {
    id: 'rc-charge', cat: 'Capacitors', name: 'RC charging', level: 2,
    blurb: 'Watch a capacitor fill through a resistor. The time constant τ = R·C sets the pace.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R', label: 'Resistor', min: 1000, max: 100000, step: 1000, unit: 'Ω', def: 10000 },
      { key: 'C', label: 'Capacitor', min: 10, max: 470, step: 10, unit: 'µF', def: 100 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'r', a: 1, b: 2, value: p.R }, { kind: 'C', id: 'c', a: 2, b: 0, value: p.C * 1e-6 }],
    transient: { dt: 0.002, sub: 6, duration: 0, probe: (r) => r.V[2] ?? 0, vmax: 9, probeLabel: 'Vcap' },
    scene: (p, res) => {
      const vc = res.V[2] ?? 0;
      return {
        wires: [{ d: LOOP, i: 'r' }],
        parts: [
          { t: 'bat', x: 110, y: 190, v: p.V }, { t: 'res', x: 310, y: 80, label: fmtOhm(p.R), heat: power(res, 'r', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
          { t: 'cap', x: 520, y: 190, rot: 90, label: `${fmt(p.C)} µF`, charge: clamp01(vc / Math.max(0.1, p.V)) },
        ],
        chips: [{ x: 110, y: 62, v: res.V[1] ?? 0, kind: 'hi' }, { x: 520, y: 62, v: vc, kind: 'mid' }, { x: 315, y: 322, v: 0, kind: 'gnd' }],
      };
    },
    rows: (p, res) => {
      const tau = p.R * p.C * 1e-6;
      return [
        { label: 'Cap voltage', value: `${fmt(res.V[2] ?? 0)} V` },
        { label: 'Charge current', current: res.I.r ?? 0 },
        { label: 'Time constant τ', value: fmtTime(tau) },
      ];
    },
    tutor: (p, res) => {
      const tau = p.R * p.C * 1e-6, vc = res.V[2] ?? 0, pct = Math.round(clamp01(vc / Math.max(0.1, p.V)) * 100);
      return <>τ = R·C = <b>{fmtTime(tau)}</b>. The cap is <b>{pct}%</b> charged. After one τ it reaches 63%, after five τ it's basically full. Bigger R or C means slower.</>;
    },
  },
  {
    id: 'rc-discharge', cat: 'Capacitors', name: 'RC discharging', level: 2,
    blurb: 'A charged capacitor empties through a resistor, fading on the same τ curve.',
    params: [
      { key: 'V0', label: 'Start charge', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R', label: 'Resistor', min: 1000, max: 100000, step: 1000, unit: 'Ω', def: 10000 },
      { key: 'C', label: 'Capacitor', min: 10, max: 470, step: 10, unit: 'µF', def: 100 },
    ],
    build: (p) => [{ kind: 'R', id: 'r', a: 1, b: 0, value: p.R }, { kind: 'C', id: 'c', a: 1, b: 0, value: p.C * 1e-6 }],
    transient: { dt: 0.002, sub: 6, duration: 0, probe: (r) => r.V[1] ?? 0, vmax: 9, init: (p) => ({ c: p.V0 }), probeLabel: 'Vcap' },
    scene: (p, res) => {
      const vc = res.V[1] ?? 0;
      return {
        wires: [{ d: 'M200 80 V300 M420 80 V300 M200 80 H420 M200 300 H420', i: 'r' }],
        parts: [
          { t: 'cap', x: 200, y: 175, rot: 90, label: `${fmt(p.C)} µF`, charge: clamp01(vc / Math.max(0.1, p.V0)) },
          { t: 'res', x: 420, y: 175, label: fmtOhm(p.R), rot: 90, heat: power(res, 'r', vc) },
          { t: 'dot', x: 200, y: 80 }, { t: 'dot', x: 200, y: 300 },
        ],
        chips: [{ x: 200, y: 62, v: vc, kind: 'hi' }, { x: 310, y: 322, v: 0, kind: 'gnd' }],
      };
    },
    rows: (p, res) => {
      const tau = p.R * p.C * 1e-6;
      return [{ label: 'Cap voltage', value: `${fmt(res.V[1] ?? 0)} V` }, { label: 'Discharge current', current: res.I.r ?? 0 }, { label: 'Time constant τ', value: fmtTime(tau) }];
    },
    tutor: (p, res) => {
      const tau = p.R * p.C * 1e-6, vc = res.V[1] ?? 0, pct = Math.round(clamp01(vc / Math.max(0.1, p.V0)) * 100);
      return <>The cap started at {fmt(p.V0)} V and is now at <b>{fmt(vc)} V</b> ({pct}%). It loses 63% of its charge every τ = <b>{fmtTime(tau)}</b>, the mirror image of charging.</>;
    },
  },

  // ── Transistors & power ──
  {
    id: 'npn-switch', cat: 'Transistors', name: 'Transistor switch', level: 3,
    blurb: 'A tiny base current lets a transistor switch a much bigger load. Size the base resistor right.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 12, step: 0.5, unit: 'V', def: 5 },
      { key: 'Rb', label: 'Base resistor', min: 1000, max: 220000, step: 1000, unit: 'Ω', def: 10000 },
      { key: 'Rl', label: 'Load resistor', min: 100, max: 1000, step: 10, unit: 'Ω', def: 220 },
    ],
    build: (p) => [{ kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V }, { kind: 'R', id: 'rl', a: 1, b: 2, value: p.Rl }, { kind: 'R', id: 'rb', a: 1, b: 3, value: p.Rb }, { kind: 'Q', id: 'q', base: 3, collector: 2, emitter: 0, beta: 100 }],
    scene: (p, res) => {
      const ic = toMA(res.I.q ?? 0);
      return {
        wires: [
          { d: 'M110 70 H500' },
          { d: 'M500 70 V200 H412', i: 'q' },
          { d: 'M412 260 V300 H110 V70', i: 'q' },
          { d: 'M250 70 V230 H370', i: 'q/b' },
        ],
        parts: [
          { t: 'bat', x: 110, y: 185, v: p.V, rot: 90 },
          { t: 'res', x: 500, y: 130, label: fmtOhm(p.Rl), rot: 90, heat: power(res, 'rl', (res.V[1] ?? 0) - (res.V[2] ?? 0)) },
          { t: 'res', x: 310, y: 230, label: fmtOhm(p.Rb), heat: power(res, 'rb', (res.V[1] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'npn', x: 400, y: 230, on: ic > 1, label: 'NPN' },
          { t: 'dot', x: 250, y: 70 }, { t: 'dot', x: 500, y: 70 },
        ],
        chips: [{ x: 110, y: 52, v: res.V[1] ?? 0, kind: 'hi' }, { x: 470, y: 185, v: res.V[2] ?? 0, kind: 'mid' }],
      };
    },
    rows: (p, res) => {
      const ic = res.I.q ?? 0, ib = res.I['q/b'] ?? 0, vce = (res.V[2] ?? 0) - 0;
      return [
        { label: 'Base current', current: ib },
        { label: 'Load (collector)', current: ic, power: power(res, 'rl', (res.V[1] ?? 0) - (res.V[2] ?? 0)), hot: true },
        { label: 'Vce', value: `${fmt(vce)} V`, hot: vce < 0.4 },
      ];
    },
    tutor: (p, res) => {
      const ic = res.I.q ?? 0, ib = res.I['q/b'] ?? 0, vce = res.V[2] ?? 0;
      if (toMA(ib) < 0.001) return <>The base resistor is starving the transistor: barely any base current, so it stays off. Lower Rb.</>;
      if (vce < 0.4) return <>Saturated: Vce is just <b>{fmt(vce)} V</b>, so the transistor is fully on like a closed switch. β·Ib far exceeds the load, which is what you want for switching.</>;
      return <>Active region: with only <b>{fmt(toMA(ib))} mA</b> of base current the transistor can supply β·Ib ≈ <b>{fmt(toMA(ic))} mA</b>, not enough to fully turn on, so Vce floats at {fmt(vce)} V. Lower Rb to saturate it.</>;
    },
  },
  {
    id: 'motor-driver', cat: 'Transistors', name: 'Motor driver + flyback', level: 3,
    blurb: 'Switch a motor with a transistor, and tame its back-EMF with a flyback diode.',
    params: [
      { key: 'V', label: 'Motor supply', min: 5, max: 12, step: 0.5, unit: 'V', def: 9 },
      { key: 'drive', label: 'Drive signal', min: 0, max: 1, step: 1, unit: '', def: 1, type: 'toggle', onLabel: 'On', offLabel: 'Off' },
      { key: 'Rb', label: 'Base resistor', min: 1000, max: 22000, step: 500, unit: 'Ω', def: 4700 },
    ],
    build: (p) => {
      const parts: Comp[] = [
        { kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V },
        { kind: 'R', id: 'motor', a: 1, b: 2, value: 100 },
        { kind: 'D', id: 'fb', anode: 2, cathode: 1 },
        { kind: 'R', id: 'pd', a: 3, b: 0, value: 10000 },
        { kind: 'Q', id: 'q', base: 3, collector: 2, emitter: 0, beta: 100 },
      ];
      if (p.drive >= 0.5) parts.push({ kind: 'R', id: 'rb', a: 1, b: 3, value: p.Rb });
      return parts;
    },
    scene: (p, res) => {
      const ic = toMA(res.I.q ?? 0), on = ic > 1;
      return {
        wires: [
          { d: 'M110 70 H560' },
          { d: 'M470 70 V124', i: 'motor' },
          { d: 'M470 176 V200 H412', i: 'motor' },
          { d: 'M560 70 V114', i: 'fb' },
          { d: 'M560 166 V200 H470', i: 'fb' },
          { d: 'M412 260 V300 H110 V70', i: 'q' },
          { d: 'M250 70 V230 H370', i: p.drive >= 0.5 ? 'rb' : undefined },
        ],
        parts: [
          { t: 'bat', x: 110, y: 185, v: p.V, rot: 90 },
          { t: 'motor', x: 470, y: 150, spin: on ? clamp01(ic / 60) : 0 },
          { t: 'diode', x: 560, y: 140, rot: 90, on: (res.I.fb ?? 0) > 1e-4, label: 'flyback' },
          { t: 'res', x: 310, y: 230, label: fmtOhm(p.Rb), heat: power(res, 'rb', (res.V[1] ?? 0) - (res.V[3] ?? 0)) },
          { t: 'npn', x: 400, y: 230, on, label: 'NPN' },
          { t: 'dot', x: 250, y: 70 }, { t: 'dot', x: 470, y: 70 }, { t: 'dot', x: 560, y: 70 },
        ],
        chips: [{ x: 110, y: 52, v: res.V[1] ?? 0, kind: 'hi' }, { x: 430, y: 185, v: res.V[2] ?? 0, kind: 'mid' }],
      };
    },
    rows: (p, res) => {
      const ic = res.I.q ?? 0;
      return [
        { label: 'Base current', current: res.I['q/b'] ?? 0 },
        { label: 'Motor current', current: ic, power: power(res, 'motor', (res.V[1] ?? 0) - (res.V[2] ?? 0)), hot: toMA(ic) > 1 },
        { label: 'Flyback diode', value: (res.I.fb ?? 0) > 1e-4 ? 'conducting' : 'idle (ready)' },
      ];
    },
    tutor: (p, res) => p.drive >= 0.5
      ? <>Drive on: the transistor saturates and the motor pulls <b>{fmt(toMA(res.I.q ?? 0))} mA</b>. The flyback diode sits idle now, but the instant you switch off it catches the coil's back-EMF spike so it doesn't destroy the transistor.</>
      : <>Drive off: no base current, the transistor is open and the motor is stopped. That flyback diode across the motor is the only thing that will absorb the voltage kick when a spinning motor is suddenly cut.</>,
  },
];

const CATEGORIES = ['Basics', 'Sensors', 'Inputs', 'Capacitors', 'Transistors'];

// ────────────────────────────────────────────────────────────────────────────
//  VIEW
// ────────────────────────────────────────────────────────────────────────────

export const SimulatorView: React.FC = () => {
  const [cat, setCat] = useState('Basics');
  const [circuitId, setCircuitId] = useState('ohm-led');
  const circuit = CIRCUITS.find((c) => c.id === circuitId)!;
  const [params, setParams] = useState<Record<string, number>>(() => defaults(circuit));
  const [heatOn, setHeatOn] = useState(false);

  const selectCircuit = (c: Circuit) => { setCircuitId(c.id); setParams(defaults(c)); };
  const resetParams = () => setParams(defaults(circuit));

  const sim = useSim(circuit, params);
  const res = sim.frame;

  const inCat = CIRCUITS.filter((c) => c.cat === cat);

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Simulator</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">See the electricity move.</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-press-sm">
          <Zap className="h-3.5 w-3.5" /> Real physics engine
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-ohmlet-ink-soft">
        {CIRCUITS.length} live circuits across the curriculum. Every current, voltage, time constant and transistor region is solved as you tweak, never canned.
      </p>

      {/* category tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const on = c === cat;
          return (
            <button key={c} onClick={() => setCat(c)}
              className={`rounded-2xl border-2 px-4 py-2 text-sm font-black transition-all ${on ? 'border-ohmlet-ink bg-ohmlet-gold shadow-press-sm' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink hover:text-ohmlet-ink'}`}>
              {c}
            </button>
          );
        })}
      </div>

      {/* circuit cards in this category */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {inCat.map((c) => {
          const on = c.id === circuitId;
          return (
            <button key={c.id} onClick={() => selectCircuit(c)}
              className={`group flex flex-col items-start rounded-2xl border-2 p-3.5 text-left transition-all ${on ? 'border-ohmlet-ink bg-ohmlet-gold-soft shadow-press-sm' : 'border-ohmlet-line bg-white hover:border-ohmlet-ink hover:-translate-y-0.5'}`}>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-black text-ohmlet-ink">{c.name}</span>
                <LevelDots level={c.level} />
              </div>
              <span className="mt-1 text-[11px] font-semibold leading-snug text-ohmlet-ink-soft">{c.blurb}</span>
              {c.transient && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ohmlet-ink px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white"><Play className="h-2.5 w-2.5" /> Time</span>}
            </button>
          );
        })}
      </div>

      {/* bench */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink bg-white shadow-press">
          <div className="relative">
            <Schematic scene={circuit.scene(params, res)} res={res} running={sim.playing} heat={heatOn} />
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <button onClick={() => setHeatOn((h) => !h)} aria-pressed={heatOn}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-ohmlet-ink px-3 text-xs font-black shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none ${heatOn ? 'bg-ohmlet-ink text-white' : 'bg-white text-ohmlet-ink'}`}>
                <Flame className="h-4 w-4" /> Heat map
              </button>
              <button onClick={() => sim.setPlaying((r) => !r)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-white px-3 text-xs font-black shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none">
                {sim.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {sim.playing ? 'Pause' : 'Run'}
              </button>
            </div>
            {heatOn && <HeatLegend />}
            {circuit.transient && <Scope trace={sim.trace} duration={Math.max(0.5, sim.t)} vmax={circuit.transient.vmax} label={circuit.transient.probeLabel} />}
          </div>
          <Tutor>{circuit.tutor(params, res)}</Tutor>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Components</h3>
              <div className="flex items-center gap-3">
                {circuit.transient && <button onClick={sim.reset} className="inline-flex items-center gap-1 text-xs font-black text-ohmlet-ink-soft hover:text-ohmlet-ink"><RotateCcw className="h-3.5 w-3.5" /> Restart</button>}
                <button onClick={resetParams} className="inline-flex items-center gap-1 text-xs font-black text-ohmlet-ink-soft hover:text-ohmlet-ink"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
              </div>
            </div>
            <p className="mt-1 text-xs font-semibold text-ohmlet-ink-soft">{circuit.blurb}</p>
            <div className="mt-4 space-y-4">
              {circuit.params.map((d) => <Control key={d.key} def={d} value={params[d.key]} onChange={(v) => setParams((p) => ({ ...p, [d.key]: v }))} />)}
            </div>
          </div>
          <Readouts rows={circuit.rows(params, res)} warning={circuit.warn?.(params, res)} />
        </div>
      </div>
    </div>
  );
};

function defaults(c: Circuit): Record<string, number> { return Object.fromEntries(c.params.map((d) => [d.key, d.def])); }

// ── Transient / DC simulation hook ──
interface SimHook { frame: SolveResult; playing: boolean; setPlaying: React.Dispatch<React.SetStateAction<boolean>>; trace: [number, number][]; reset: () => void; t: number }
function useSim(circuit: Circuit, params: Record<string, number>): SimHook {
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState<SolveResult>(() => (circuit.transient ? firstFrame(circuit, params) : solve(circuit.build(params))));
  const stRef = useRef<TransientState | null>(null);
  const traceRef = useRef<[number, number][]>([]);
  const [, force] = useState(0);
  const key = JSON.stringify(params);
  const [resetTick, setResetTick] = useState(0);

  // DC: recompute on param change
  useEffect(() => { if (!circuit.transient) setFrame(solve(circuit.build(params))); /* eslint-disable-next-line */ }, [circuit.id, key]);

  // Transient: (re)initialise on circuit/param/reset change
  useEffect(() => {
    if (!circuit.transient) return;
    const net = circuit.build(params);
    stRef.current = initTransient(net, circuit.transient.init?.(params));
    traceRef.current = [];
    setFrame(stepTransient(net, stRef.current, 1e-6));
    /* eslint-disable-next-line */
  }, [circuit.id, key, resetTick]);

  // Transient: step in real time
  useEffect(() => {
    if (!circuit.transient || !playing) return;
    const tr = circuit.transient;
    const net = circuit.build(params);
    const autoLoop = tr.duration === 0 ? autoDuration(circuit, params) : tr.duration;
    let raf = 0;
    const tick = () => {
      let f: SolveResult = frame;
      for (let k = 0; k < tr.sub; k++) {
        if (!stRef.current) break;
        if (stRef.current.t >= autoLoop) { stRef.current = initTransient(net, tr.init?.(params)); traceRef.current = []; }
        f = stepTransient(net, stRef.current, tr.dt);
        traceRef.current.push([stRef.current.t, tr.probe(f)]);
        if (traceRef.current.length > 900) traceRef.current.shift();
      }
      setFrame(f); force((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    /* eslint-disable-next-line */
  }, [circuit.id, key, playing, resetTick]);

  return { frame, playing, setPlaying, trace: traceRef.current, reset: () => setResetTick((n) => n + 1), t: stRef.current?.t ?? 0 };
}
function firstFrame(c: Circuit, p: Record<string, number>): SolveResult { const net = c.build(p); const st = initTransient(net, c.transient!.init?.(p)); return stepTransient(net, st, 1e-6); }
function autoDuration(c: Circuit, p: Record<string, number>): number {
  // ~6 time-constants for RC circuits so the curve fully settles, then loops
  const C = c.build(p).find((x) => x.kind === 'C') as Extract<Comp, { kind: 'C' }> | undefined;
  const R = c.build(p).find((x) => x.kind === 'R') as Extract<Comp, { kind: 'R' }> | undefined;
  if (C && R) return Math.max(0.3, 6 * R.value * C.value);
  return 2;
}

// ── Param controls ──
const Control: React.FC<{ def: ParamDef; value: number; onChange: (v: number) => void }> = ({ def: d, value, onChange }) => {
  if (d.type === 'toggle') {
    const on = value >= 0.5;
    return (
      <div>
        <label className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">{d.label}</label>
        <button onClick={() => onChange(on ? 0 : 1)} aria-pressed={on}
          className={`mt-1.5 flex w-full items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-sm font-black transition-all ${on ? 'border-ohmlet-ink bg-ohmlet-gold shadow-press-sm' : 'border-ohmlet-line bg-ohmlet-cream text-ohmlet-ink-soft hover:border-ohmlet-ink'}`}>
          <span>{on ? (d.onLabel ?? 'On') : (d.offLabel ?? 'Off')}</span>
          <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-all ${on ? 'bg-ohmlet-ink' : 'bg-ohmlet-line'}`}><span className={`h-4 w-4 rounded-full bg-white transition-all ${on ? 'translate-x-4' : ''}`} /></span>
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">
        <span>{d.label}</span>
        <span className="text-sm font-black tabular-nums text-ohmlet-ink">{d.fmt ? d.fmt(value) : `${fmt(value)} ${d.unit}`}</span>
      </label>
      <input type="range" min={d.min} max={d.max} step={d.step} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1.5 w-full accent-ohmlet-gold-deep" />
    </div>
  );
};

// ── Readouts ──
const Readouts: React.FC<{ rows: Row[]; warning?: string }> = ({ rows, warning }) => {
  const powered = rows.filter((r) => typeof r.power === 'number');
  const totalPower = powered.reduce((s, r) => s + (r.power ?? 0), 0);
  const hottest = powered.length ? powered.reduce((a, b) => ((b.power ?? 0) > (a.power ?? 0) ? b : a)).label : undefined;
  return (
    <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live readings</h3>
      {warning && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border-2 border-ohmlet-red bg-[#fff1ee] px-3 py-2 text-xs font-bold text-ohmlet-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {warning}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${r.over ? 'border-ohmlet-red/40 bg-[#fff1ee]' : 'border-ohmlet-line bg-ohmlet-cream'}`}>
            <span className="flex items-center gap-1.5 text-sm font-bold text-ohmlet-ink">
              {r.label}
              {r.label === hottest && totalPower > 0.02 && <Flame className="h-3.5 w-3.5 text-ohmlet-red" />}
            </span>
            <span className="text-sm font-black tabular-nums text-ohmlet-ink">
              {r.value ?? <>{typeof r.current === 'number' ? `${fmt(toMA(r.current))} mA` : ''}{typeof r.power === 'number' ? ` · ${fmtP(r.power)}` : ''}</>}
            </span>
          </div>
        ))}
      </div>
      {totalPower > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-ohmlet-ink bg-ohmlet-ink px-3 py-2.5 text-white">
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide"><Flame className="h-4 w-4 text-ohmlet-gold" /> Total power (heat)</span>
          <span className="text-base font-black tabular-nums">{fmtP(totalPower)}</span>
        </div>
      )}
    </div>
  );
};

const Tutor: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-3 border-t-2 border-ohmlet-line bg-ohmlet-ink px-5 py-4 text-white">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ohmlet-gold"><Cpu className="h-5 w-5 text-ohmlet-ink" /></span>
    <p className="text-sm font-semibold leading-snug [&_b]:text-ohmlet-gold">{children}</p>
  </div>
);

const LevelDots: React.FC<{ level: number }> = ({ level }) => (
  <span className="flex items-center gap-0.5" title={['', 'Beginner', 'Intermediate', 'Advanced'][level]}>
    {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= level ? 'bg-ohmlet-ink' : 'bg-ohmlet-line'}`} />)}
  </span>
);

const HeatLegend: React.FC = () => (
  <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border-2 border-ohmlet-ink bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-press-sm backdrop-blur">
    <span className="text-ohmlet-ink-soft">Cool</span>
    <span className="h-2.5 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${heatRGB(0)}, ${heatRGB(0.5)}, ${heatRGB(1)})` }} />
    <span className="text-ohmlet-red">Hot</span>
  </div>
);

// ── Oscilloscope (transient probe trace) ──
const Scope: React.FC<{ trace: [number, number][]; duration: number; vmax: number; label: string }> = ({ trace, duration, vmax, label }) => {
  const W = 180, H = 72;
  const pts = trace.length > 1
    ? trace.map(([t, v]) => `${(8 + (t / duration) * (W - 16)).toFixed(1)},${(H - 8 - clamp01(v / vmax) * (H - 16)).toFixed(1)}`).join(' ')
    : '';
  const last = trace.length ? trace[trace.length - 1][1] : 0;
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 rounded-2xl border-2 border-ohmlet-ink bg-white/95 p-2 shadow-press-sm backdrop-blur">
      <svg width={W} height={H} className="block">
        <line x1={8} y1={H - 8} x2={W - 8} y2={H - 8} stroke="#ece7db" strokeWidth={1.5} />
        <line x1={8} y1={8} x2={8} y2={H - 8} stroke="#ece7db" strokeWidth={1.5} />
        {pts && <polyline points={pts} fill="none" stroke="#f5b800" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <p className="px-1 pb-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-ink-soft">{label} <span className="tabular-nums text-ohmlet-ink">{fmt(last)} V</span></p>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
//  GENERIC SCHEMATIC RENDERER
// ────────────────────────────────────────────────────────────────────────────

const Schematic: React.FC<{ scene: Scene; res: SolveResult; running: boolean; heat: boolean }> = ({ scene, res, running, heat }) => {
  const maxHeat = heat ? Math.max(1e-9, ...scene.parts.map((p) => ('heat' in p && typeof (p as any).heat === 'number' ? (p as any).heat : 0))) : 0;
  const hf = (p: Part) => (heat && 'heat' in p && typeof (p as any).heat === 'number' ? (p as any).heat / maxHeat : undefined);
  return (
    <svg viewBox="0 0 640 360" className="block w-full"
      style={{ background: 'linear-gradient(0deg,rgba(20,32,30,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(20,32,30,.03) 1px,transparent 1px)', backgroundSize: '22px 22px' }}>
      {scene.wires.map((w, k) => <path key={`w${k}`} d={w.d} fill="none" stroke="#14201e" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />)}
      {scene.wires.map((w, k) => w.i != null ? <Flow key={`f${k}`} d={w.d} mA={toMA(res.I[w.i] ?? 0)} running={running} id={`f${k}`} /> : null)}
      {scene.parts.map((p, k) => <PartView key={`p${k}`} p={p} heat={hf(p)} />)}
      {scene.chips.map((c, k) => <Vchip key={`c${k}`} x={c.x} y={c.y} v={c.v} kind={c.kind} />)}
    </svg>
  );
};

const PartView: React.FC<{ p: Part; heat?: number }> = ({ p, heat }) => {
  switch (p.t) {
    case 'bat': return <Battery x={p.x} y={p.y} v={p.v} rot={p.rot} />;
    case 'res': return <Resistor x={p.x} y={p.y} label={p.label} rot={p.rot} heat={heat} />;
    case 'led': return <Led x={p.x} y={p.y} bright={p.bright} over={p.over} small={p.small} heat={heat} />;
    case 'diode': return <Diode x={p.x} y={p.y} rot={p.rot} on={p.on} label={p.label} heat={heat} />;
    case 'cap': return <Capacitor x={p.x} y={p.y} rot={p.rot} label={p.label} charge={p.charge} heat={heat} />;
    case 'npn': return <Npn x={p.x} y={p.y} on={p.on} label={p.label} />;
    case 'ldr': return <Ldr x={p.x} y={p.y} label={p.label} lit={p.lit} heat={heat} />;
    case 'ntc': return <Ntc x={p.x} y={p.y} label={p.label} warm={p.warm} rot={p.rot} heat={heat} />;
    case 'pot': return <Pot x={p.x} y={p.y} label={p.label} frac={p.frac} heat={heat} />;
    case 'sw': return <Switch x={p.x} y={p.y} closed={p.closed} />;
    case 'buzz': return <Buzzer x={p.x} y={p.y} on={p.on} />;
    case 'motor': return <Motor x={p.x} y={p.y} spin={p.spin} />;
    case 'dot': return <circle cx={p.x} cy={p.y} r={6} fill="#14201e" />;
    case 'gnd': return <Ground x={p.x} y={p.y} />;
  }
};

// ── Symbol primitives ──
const heatAura = (heat: number | undefined) => (0.12 + 0.5 * (heat ?? 0)).toFixed(2);
const wrap = (x: number, y: number, rot: number | undefined, children: React.ReactNode) => <g transform={`translate(${x},${y}) ${rot ? `rotate(${rot})` : ''}`}>{children}</g>;

const Battery: React.FC<{ x: number; y: number; v: number; rot?: number }> = ({ x, y, v, rot }) => wrap(x, y, rot,
  <>
    <rect x={-26} y={-26} width={52} height={52} rx={9} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-9 -12V12M0 -7V7M9 -12V12" stroke="#14201e" strokeWidth={3} />
    <text x={0} y={42} textAnchor="middle" fontSize={12} fontWeight={800} fill="#46514e" transform={rot ? `rotate(${-rot})` : ''}>{fmt(v)}V</text>
  </>);

const Resistor: React.FC<{ x: number; y: number; label: string; rot?: number; heat?: number }> = ({ x, y, label, rot, heat }) => wrap(x, y, rot,
  <>
    {heat !== undefined && <ellipse cx={0} cy={0} rx={60} ry={28} fill={heatRGB(heat)} opacity={heatAura(heat)} />}
    <rect x={-46} y={-16} width={92} height={32} rx={8} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-34 0h7l4-9 7 18 7-18 7 18 7-18 4 9h7" stroke="#14201e" strokeWidth={2.5} fill="none" />
    <text x={0} y={-24} textAnchor="middle" fontSize={12} fontWeight={800} fill="#46514e" transform={rot ? `rotate(${-rot}) translate(0 ${rot === 90 ? -8 : 0})` : ''}>{label}</text>
  </>);

const Led: React.FC<{ x: number; y: number; bright: number; over?: boolean; small?: boolean; heat?: number }> = ({ x, y, bright, over, small, heat }) => (
  <g transform={`translate(${x},${y})`}>
    {heat !== undefined && <circle cx={0} cy={0} r={small ? 34 : 40} fill={heatRGB(heat)} opacity={heatAura(heat)} />}
    <circle cx={0} cy={0} r={small ? 26 : 32} fill={over ? '#ff6f5e' : '#facc2e'} opacity={(over ? 0.5 : bright * 0.85).toFixed(2)} />
    <rect x={-22} y={-22} width={44} height={44} rx={9} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-11 -12v24l18 -12 -18 -12z" fill={over ? '#ff6f5e' : bright > 0.6 ? '#ffe08a' : bright > 0.25 ? '#facc2e' : '#e0c878'} stroke="#14201e" strokeWidth={1.5} />
    <path d="M7 -12v24" stroke="#14201e" strokeWidth={3} />
  </g>
);

const Diode: React.FC<{ x: number; y: number; rot?: number; on?: boolean; label?: string; heat?: number }> = ({ x, y, rot, on, label, heat }) => wrap(x, y, rot,
  <>
    {heat !== undefined && <circle cx={0} cy={0} r={30} fill={heatRGB(heat)} opacity={heatAura(heat)} />}
    <rect x={-26} y={-20} width={52} height={40} rx={8} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-12 -12v24l18 -12z" fill={on ? '#84cc30' : '#14201e'} />
    <path d="M6 -12v24" stroke="#14201e" strokeWidth={3} />
    {label && <text x={0} y={-26} textAnchor="middle" fontSize={11} fontWeight={800} fill="#46514e" transform={rot ? `rotate(${-rot})` : ''}>{label}</text>}
  </>);

const Capacitor: React.FC<{ x: number; y: number; rot?: number; label: string; charge?: number; heat?: number }> = ({ x, y, rot, label, charge = 0 }) => wrap(x, y, rot,
  <>
    <rect x={-30} y={-26} width={60} height={52} rx={8} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-9 -16V16" stroke="#14201e" strokeWidth={4} />
    <path d="M9 -16V16" stroke={charge > 0.02 ? '#549cf0' : '#14201e'} strokeWidth={4} opacity={(0.4 + 0.6 * clamp01(charge)).toFixed(2)} />
    {charge > 0.02 && <rect x={-7} y={-15} width={14} height={30} fill="#549cf0" opacity={(0.18 * clamp01(charge)).toFixed(2)} />}
    <text x={0} y={-32} textAnchor="middle" fontSize={11} fontWeight={800} fill="#46514e" transform={rot ? `rotate(${-rot})` : ''}>{label}</text>
  </>);

const Npn: React.FC<{ x: number; y: number; on?: boolean; label?: string }> = ({ x, y, on, label }) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={26} fill={on ? '#f3fae9' : '#fff'} stroke={on ? '#6fb519' : '#14201e'} strokeWidth={2.5} />
    <path d="M-12 -16V16" stroke="#14201e" strokeWidth={3.5} />
    <path d="M-12 -8L12 -20" stroke="#14201e" strokeWidth={3} />
    <path d="M-12 8L12 20" stroke="#14201e" strokeWidth={3} />
    <path d="M12 20l-9 -1 4 -7z" fill="#14201e" />
    <line x1={12} y1={-20} x2={12} y2={-30} stroke="#14201e" strokeWidth={3} />
    <line x1={12} y1={20} x2={12} y2={30} stroke="#14201e" strokeWidth={3} />
    <line x1={-12} y1={0} x2={-30} y2={0} stroke="#14201e" strokeWidth={3} />
    {label && <text x={0} y={42} textAnchor="middle" fontSize={11} fontWeight={800} fill={on ? '#6fb519' : '#46514e'}>{on ? 'ON' : label}</text>}
  </g>
);

const Ldr: React.FC<{ x: number; y: number; label: string; lit: number; heat?: number }> = ({ x, y, label, lit, heat }) => (
  <g transform={`translate(${x},${y})`}>
    {heat !== undefined && <circle cx={0} cy={0} r={38} fill={heatRGB(heat)} opacity={heatAura(heat)} />}
    {heat === undefined && <circle cx={0} cy={0} r={30} fill="#ffe08a" opacity={(lit * 0.55).toFixed(2)} />}
    <circle cx={0} cy={0} r={26} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-17 0h5l3-8 6 16 6-16 3 8h5" stroke="#14201e" strokeWidth={2.5} fill="none" />
    <g stroke="#f5b800" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M-44 -40 L-22 -18 M-22 -18 l-9 0 M-22 -18 l0 -9" />
      <path d="M-30 -46 L-10 -26 M-10 -26 l-9 0 M-10 -26 l0 -9" />
    </g>
    <text x={0} y={42} textAnchor="middle" fontSize={12} fontWeight={800} fill="#46514e">LDR · {label}</text>
  </g>
);

const Ntc: React.FC<{ x: number; y: number; label: string; warm: number; rot?: number; heat?: number }> = ({ x, y, label, warm, rot, heat }) => wrap(x, y, rot,
  <>
    {heat !== undefined && <ellipse cx={0} cy={0} rx={58} ry={26} fill={heatRGB(heat)} opacity={heatAura(heat)} />}
    {heat === undefined && <ellipse cx={0} cy={0} rx={52} ry={22} fill="#ff6f5e" opacity={(warm * 0.4).toFixed(2)} />}
    <rect x={-46} y={-16} width={92} height={32} rx={8} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-34 0h7l4-9 7 18 7-18 7 18 7-18 4 9h7" stroke="#14201e" strokeWidth={2.5} fill="none" />
    <path d="M-30 16 L30 -16" stroke="#14201e" strokeWidth={2} />
    <path d="M30 -16 l-9 1 M30 -16 l-1 9" stroke="#14201e" strokeWidth={2} fill="none" />
    <text x={0} y={-24} textAnchor="middle" fontSize={11} fontWeight={800} fill="#46514e" transform={rot ? `rotate(${-rot}) translate(0 ${rot === 90 ? -8 : 0})` : ''}>{label}</text>
  </>);

const Pot: React.FC<{ x: number; y: number; label: string; frac: number; heat?: number }> = ({ x, y, label, frac, heat }) => (
  <g transform={`translate(${x},${y})`}>
    {heat !== undefined && <ellipse cx={0} cy={0} rx={60} ry={28} fill={heatRGB(heat)} opacity={heatAura(heat)} />}
    <rect x={-46} y={-16} width={92} height={32} rx={8} fill="#fff" stroke="#14201e" strokeWidth={2} />
    <path d="M-34 0h7l4-9 7 18 7-18 7 18 7-18 4 9h7" stroke="#14201e" strokeWidth={2.5} fill="none" />
    <g transform={`translate(${(-34 + clamp01(frac) * 68).toFixed(1)},0)`}>
      <path d="M0 -24 L0 -3 M-5 -10 L0 -3 L5 -10" stroke="#f5b800" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <text x={0} y={-30} textAnchor="middle" fontSize={12} fontWeight={800} fill="#46514e">{label}</text>
  </g>
);

const Switch: React.FC<{ x: number; y: number; closed: boolean }> = ({ x, y, closed }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-30} y={-8} width={60} height={16} fill="#fff" />
    <circle cx={-26} cy={0} r={4.5} fill="#14201e" />
    <circle cx={26} cy={0} r={4.5} fill="#14201e" />
    <line x1={-26} y1={0} x2={closed ? 26 : 17} y2={closed ? 0 : -19} stroke="#14201e" strokeWidth={4.5} strokeLinecap="round" />
    <text x={0} y={-26} textAnchor="middle" fontSize={12} fontWeight={800} fill={closed ? '#6fb519' : '#9aa3a0'}>{closed ? 'CLOSED' : 'OPEN'}</text>
  </g>
);

const Buzzer: React.FC<{ x: number; y: number; on: boolean }> = ({ x, y, on }) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={26} fill={on ? '#fff6d6' : '#fff'} stroke={on ? '#f5b800' : '#14201e'} strokeWidth={2.5} />
    <path d="M-9 -8h6l6 -6v28l-6 -6h-6z" fill="#14201e" />
    {on && <g stroke="#f5b800" strokeWidth={2.5} fill="none" strokeLinecap="round"><path d="M11 -10a10 10 0 010 20" /><path d="M16 -16a18 18 0 010 32" /></g>}
    <text x={0} y={42} textAnchor="middle" fontSize={11} fontWeight={800} fill={on ? '#f5b800' : '#46514e'}>{on ? 'SOUND' : 'buzzer'}</text>
  </g>
);

const Motor: React.FC<{ x: number; y: number; spin: number }> = ({ x, y, spin }) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={26} fill={spin > 0 ? '#eef6ff' : '#fff'} stroke={spin > 0 ? '#3e86e8' : '#14201e'} strokeWidth={2.5} />
    <text x={0} y={6} textAnchor="middle" fontSize={20} fontWeight={900} fill="#14201e">M</text>
    {spin > 0 && (
      <g stroke="#3e86e8" strokeWidth={2.5} fill="none" strokeLinecap="round">
        <path d="M0 -34a34 34 0 0110 3" /><path d="M0 34a34 34 0 01-10 -3" />
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur={`${(1.4 - spin).toFixed(2)}s`} repeatCount="indefinite" />
      </g>
    )}
    <text x={0} y={42} textAnchor="middle" fontSize={11} fontWeight={800} fill={spin > 0 ? '#3e86e8' : '#46514e'}>{spin > 0 ? 'SPIN' : 'motor'}</text>
  </g>
);

const Ground: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y})`} stroke="#14201e" strokeWidth={2.5}>
    <line x1={0} y1={-8} x2={0} y2={0} /><line x1={-10} y1={0} x2={10} y2={0} /><line x1={-6} y1={5} x2={6} y2={5} /><line x1={-2} y1={10} x2={2} y2={10} />
  </g>
);

const Vchip: React.FC<{ x: number; y: number; v: number; kind: 'hi' | 'mid' | 'gnd' }> = ({ x, y, v, kind }) => {
  const c = kind === 'hi' ? ['#eafaf0', '#16a34a'] : kind === 'mid' ? ['#fff6d6', '#b06f00'] : ['#f1f5f9', '#64748b'];
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-22} y={-13} width={44} height={22} rx={7} fill={c[0]} stroke={c[1]} strokeWidth={2} />
      <text x={0} y={2} textAnchor="middle" fontSize={11} fontWeight={800} fill={c[1]}>{fmt(v)}V</text>
    </g>
  );
};

/** Animated current dots along a path, density + speed ∝ real current (SMIL). */
const Flow: React.FC<{ d: string; mA: number; running: boolean; id: string }> = ({ d, mA, running, id }) => {
  const a = Math.abs(mA);
  const n = a < 0.3 ? 0 : Math.min(40, Math.round(a / 1.5) + 4);
  const dur = Math.max(1.1, Math.min(9, 130 / Math.max(a, 1)));
  const pid = `flow-${id}`;
  if (n === 0) return <path d={d} fill="none" />;
  return (
    <g>
      <path id={pid} d={d} fill="none" />
      {Array.from({ length: n }).map((_, i) => (
        <circle key={`${pid}-${dur.toFixed(2)}-${n}-${i}`} r={4.2} fill="#facc2e" stroke="#b06f00" strokeWidth={1}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`-${(i * dur) / n}s`} keyPoints={running ? undefined : '0;0'} keyTimes={running ? undefined : '0;1'}>
            <mpath href={`#${pid}`} />
          </animateMotion>
        </circle>
      ))}
    </g>
  );
};

// ── format helpers ──
function fmt(x: number): string {
  if (!isFinite(x)) return '—';
  const a = Math.abs(x);
  return a >= 100 ? x.toFixed(0) : a >= 10 ? x.toFixed(1) : x.toFixed(2);
}
function fmtP(w: number): string {
  if (!isFinite(w)) return '—';
  return w >= 1 ? `${w.toFixed(2)} W` : `${(w * 1000).toFixed(0)} mW`;
}
function fmtOhm(r: number): string {
  if (!isFinite(r)) return '—';
  return r >= 1000 ? `${(r / 1000).toFixed(r >= 10000 ? 0 : 1)} kΩ` : `${r.toFixed(0)} Ω`;
}
function fmtTime(s: number): string {
  if (!isFinite(s)) return '—';
  return s >= 1 ? `${s.toFixed(2)} s` : `${(s * 1000).toFixed(0)} ms`;
}

// Heat-map colour ramp: cool slate → amber → red as a component runs hotter.
function heatRGB(t: number): string {
  const c = clamp01(t);
  const stops: [number, number, number][] = [[148, 163, 184], [245, 158, 11], [255, 111, 94]];
  const seg = c <= 0.5 ? 0 : 1;
  const f = c <= 0.5 ? c / 0.5 : (c - 0.5) / 0.5;
  const a = stops[seg], b = stops[seg + 1];
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * f);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
