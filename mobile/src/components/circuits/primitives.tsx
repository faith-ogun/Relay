import React from 'react';
import { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/tokens';

// Schematic primitives, drawn to conventional symbols rather than approximated,
// because a learner is being taught to read real schematics. Every component
// takes a start point and a length so diagrams compose on a shared grid.

const STROKE = 2.4;

export const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; dim?: boolean }> = ({
  x1, y1, x2, y2, dim,
}) => (
  <Line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={dim ? colors.line : colors.ink} strokeWidth={STROKE} strokeLinecap="round" />
);

export const Node: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <Circle cx={x} cy={y} r={3.2} fill={colors.ink} />
);

export const Label: React.FC<{ x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }> = ({
  x, y, text, anchor = 'middle',
}) => (
  <SvgText x={x} y={y} fontSize={10} fontWeight="700" fill={colors.inkSoft} textAnchor={anchor}>
    {text}
  </SvgText>
);

/** Zig-zag resistor, the IEC-style box is avoided so it reads at small sizes. */
export const Resistor: React.FC<{ x: number; y: number; w?: number; vertical?: boolean; label?: string }> = ({
  x, y, w = 44, vertical, label,
}) => {
  const seg = w / 6;
  const amp = 7;
  const zig = vertical
    ? `M ${x} ${y} l ${amp} ${seg} l ${-amp * 2} ${seg} l ${amp * 2} ${seg} l ${-amp * 2} ${seg} l ${amp * 2} ${seg} l ${-amp} ${seg}`
    : `M ${x} ${y} l ${seg} ${-amp} l ${seg} ${amp * 2} l ${seg} ${-amp * 2} l ${seg} ${amp * 2} l ${seg} ${-amp * 2} l ${seg} ${amp}`;
  return (
    <G>
      <Path d={zig} stroke={colors.ink} strokeWidth={STROKE} fill="none" strokeLinejoin="round" />
      {!!label && <Label x={vertical ? x + 20 : x + w / 2} y={vertical ? y + w / 2 : y - 14} text={label} />}
    </G>
  );
};

/** Battery / DC source: long plate is +, short is −. */
export const Battery: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <G>
    <Line x1={x} y1={y - 13} x2={x} y2={y + 13} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x + 8} y1={y - 7} x2={x + 8} y2={y + 7} stroke={colors.ink} strokeWidth={STROKE * 1.6} />
    <Label x={x - 8} y={y - 16} text="+" />
    <Label x={x + 16} y={y - 16} text="−" />
    {!!label && <Label x={x + 22} y={y + 22} text={label} anchor="start" />}
  </G>
);

/** LED: a diode triangle with emission arrows, so polarity is visible. */
export const Led: React.FC<{ x: number; y: number; reversed?: boolean; lit?: boolean; label?: string }> = ({
  x, y, reversed, lit, label,
}) => {
  const dir = reversed ? -1 : 1;
  return (
    <G>
      <Path
        d={`M ${x - 9 * dir} ${y - 10} L ${x + 9 * dir} ${y} L ${x - 9 * dir} ${y + 10} Z`}
        fill={lit ? colors.gold : colors.white} stroke={colors.ink} strokeWidth={STROKE} strokeLinejoin="round"
      />
      <Line x1={x + 9 * dir} y1={y - 11} x2={x + 9 * dir} y2={y + 11} stroke={colors.ink} strokeWidth={STROKE} />
      <Line x1={x + 4} y1={y - 15} x2={x + 12} y2={y - 23} stroke={lit ? colors.goldDeep : colors.inkSoft} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={x + 11} y1={y - 14} x2={x + 19} y2={y - 22} stroke={lit ? colors.goldDeep : colors.inkSoft} strokeWidth={1.8} strokeLinecap="round" />
      {!!label && <Label x={x} y={y + 26} text={label} />}
    </G>
  );
};

export const Capacitor: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <G>
    <Line x1={x} y1={y - 12} x2={x} y2={y + 12} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x + 9} y1={y - 12} x2={x + 9} y2={y + 12} stroke={colors.ink} strokeWidth={STROKE} />
    {!!label && <Label x={x + 20} y={y + 4} text={label} anchor="start" />}
  </G>
);

export const Ground: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <G>
    <Line x1={x - 12} y1={y} x2={x + 12} y2={y} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x - 7} y1={y + 5} x2={x + 7} y2={y + 5} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x - 3} y1={y + 10} x2={x + 3} y2={y + 10} stroke={colors.ink} strokeWidth={STROKE} />
  </G>
);

/** NPN transistor in a circle: base left, collector top, emitter bottom. */
export const Transistor: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <G>
    <Circle cx={x} cy={y} r={20} fill={colors.white} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x - 7} y1={y - 12} x2={x - 7} y2={y + 12} stroke={colors.ink} strokeWidth={STROKE * 1.3} />
    <Line x1={x - 20} y1={y} x2={x - 7} y2={y} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x - 7} y1={y - 6} x2={x + 10} y2={y - 16} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x - 7} y1={y + 6} x2={x + 10} y2={y + 16} stroke={colors.ink} strokeWidth={STROKE} />
    <Path d={`M ${x + 3} ${y + 9} l 7 5 l -8 2 z`} fill={colors.ink} />
    {!!label && <Label x={x + 26} y={y + 6} text={label} anchor="start" />}
  </G>
);

/** Op-amp triangle with inverting / non-inverting inputs marked. */
export const OpAmp: React.FC<{ x: number; y: number; invertTop?: boolean }> = ({ x, y, invertTop = true }) => (
  <G>
    <Path d={`M ${x} ${y - 24} L ${x + 42} ${y} L ${x} ${y + 24} Z`}
          fill={colors.white} stroke={colors.ink} strokeWidth={STROKE} strokeLinejoin="round" />
    <Label x={x + 10} y={y - 6} text={invertTop ? '−' : '+'} anchor="start" />
    <Label x={x + 10} y={y + 12} text={invertTop ? '+' : '−'} anchor="start" />
  </G>
);

/** LDR: a resistor with the two incident-light arrows. */
export const Ldr: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <G>
    <Rect x={x} y={y - 9} width={40} height={18} rx={3} fill={colors.white} stroke={colors.ink} strokeWidth={STROKE} />
    <Line x1={x + 6} y1={y - 24} x2={x + 14} y2={y - 13} stroke={colors.goldDeep} strokeWidth={1.8} strokeLinecap="round" />
    <Line x1={x + 18} y1={y - 24} x2={x + 26} y2={y - 13} stroke={colors.goldDeep} strokeWidth={1.8} strokeLinecap="round" />
    <Path d={`M ${x + 12} ${y - 14} l 3 3 l -4 1 z`} fill={colors.goldDeep} />
    <Path d={`M ${x + 24} ${y - 14} l 3 3 l -4 1 z`} fill={colors.goldDeep} />
    {!!label && <Label x={x + 46} y={y + 4} text={label} anchor="start" />}
  </G>
);

export const Buzzer: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <G>
    <Circle cx={x} cy={y} r={14} fill={colors.white} stroke={colors.ink} strokeWidth={STROKE} />
    <Path d={`M ${x - 6} ${y - 5} l 7 -4 l 0 18 l -7 -4 z`} fill={colors.ink} />
    {!!label && <Label x={x} y={y + 28} text={label} />}
  </G>
);

/** A break in the wire, for the short-circuit and missing-component diagrams. */
export const Spark: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <Path d={`M ${x} ${y - 12} l 6 9 l -4 1 l 6 10 l -12 -11 l 5 -1 z`}
        fill={colors.red} stroke={colors.red} strokeWidth={1} strokeLinejoin="round" />
);

/** Diode: triangle into a bar. `flip` points it the other way. */
export const Diode: React.FC<{ x: number; y: number; vertical?: boolean; flip?: boolean; label?: string }> = ({
  x, y, vertical, flip, label,
}) => {
  const d = flip ? -1 : 1;
  const body = vertical
    ? `M ${x - 10} ${y - 9 * d} L ${x + 10} ${y - 9 * d} L ${x} ${y + 9 * d} Z`
    : `M ${x - 9 * d} ${y - 10} L ${x - 9 * d} ${y + 10} L ${x + 9 * d} ${y} Z`;
  const bar = vertical
    ? { x1: x - 11, y1: y + 9 * d, x2: x + 11, y2: y + 9 * d }
    : { x1: x + 9 * d, y1: y - 11, x2: x + 9 * d, y2: y + 11 };
  return (
    <G>
      <Path d={body} fill={colors.ink} />
      <Line {...bar} stroke={colors.ink} strokeWidth={STROKE * 1.3} strokeLinecap="round" />
      {!!label && <Label x={vertical ? x + 26 : x} y={vertical ? y + 4 : y + 26} text={label} anchor={vertical ? 'start' : 'middle'} />}
    </G>
  );
};

/** Relay / inductor coil: four humps, the conventional coil symbol. */
export const Coil: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <G>
    <Path d={`M ${x} ${y} ${[0, 1, 2, 3].map((i) => `A 7 7 0 0 1 ${x} ${y + (i + 1) * 14}`).join(' ')}`}
          fill="none" stroke={colors.ink} strokeWidth={STROKE} />
    {!!label && <Label x={x + 26} y={y + 32} text={label} anchor="start" />}
  </G>
);

export const STROKE_WIDTH = STROKE;
