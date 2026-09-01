import React from 'react';
import { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { PartKind } from './circuitModel';
import { useColors } from '../../theme/theme';

// ── Symbols for the free-form builder ──
//
// Conventional schematic symbols, not approximations of them, because the point
// of the builder is that a learner leaves able to read a real circuit diagram.
// The same drawing language as components/circuits/primitives.tsx, redrawn here
// around a common origin: every glyph is centred on (0, 0) with its pins on the
// x axis at ±LEAD, so the parent can place and rotate it with one transform
// instead of every symbol carrying its own idea of where it starts.
//
// Bodies are filled white deliberately. A wire routed behind a resistor has to
// disappear under it, or the canvas turns into a plate of spaghetti the moment
// there are four parts on it.

const STROKE = 2.6;
const LEAD = 34;

export interface GlyphProps {
  kind: PartKind;
  /** Ink normally, blue while selected. Everything in the symbol follows it. */
  stroke: string;
  /** 0 to 1, straight off the solved current. LEDs only. */
  brightness?: number;
  /** LED past its rated current: the glow turns to a warning rather than getting brighter. */
  over?: boolean;
  closed?: boolean;
}

const lead = (x1: number, y1: number, x2: number, y2: number, stroke: string) => (
  <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
);

/** Polarity and pin letters, small enough to read as an annotation rather than a label. */
const Mark: React.FC<{ x: number; y: number; text: string; fill: string }> = ({ x, y, text, fill }) => (
  <SvgText x={x} y={y} fontSize={11} fontWeight="800" fill={fill} textAnchor="middle">{text}</SvgText>
);

const Battery: React.FC<GlyphProps> = ({ stroke }) => {
  const colors = useColors();
  return (
    <G>
      {lead(-LEAD, 0, -7, 0, stroke)}
      {lead(7, 0, LEAD, 0, stroke)}
      {/* Long thin plate is positive, short thick plate is negative. That pairing
          is the only thing that tells you which way round a cell goes, so it is
          drawn to the convention and never mirrored. */}
      <Line x1={-7} y1={-15} x2={-7} y2={15} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={7} y1={-8} x2={7} y2={8} stroke={stroke} strokeWidth={STROKE * 1.8} strokeLinecap="round" />
      <Mark x={-17} y={-8} text="+" fill={colors.inkSoft} />
    </G>
  );
};

const Resistor: React.FC<GlyphProps> = ({ stroke }) => (
  <G>
    {lead(-LEAD, 0, -21, 0, stroke)}
    {lead(21, 0, LEAD, 0, stroke)}
    <Path
      d="M-21 0 l3.5 -8 l7 16 l7 -16 l7 16 l7 -16 l3.5 8"
      fill="none" stroke={stroke} strokeWidth={STROKE} strokeLinejoin="round" strokeLinecap="round"
    />
  </G>
);

const Led: React.FC<GlyphProps> = ({ stroke, brightness = 0, over }) => {
  const colors = useColors();
  const b = Math.max(0, Math.min(1, brightness));
  const glow = over ? colors.red : colors.gold;
  return (
    <G>
      {/* Two glow layers rather than one disc. A single flat circle reads as a
          highlight; a tight core inside a wide halo reads as light. */}
      {(b > 0.02 || over) && (
        <>
          <Circle cx={0} cy={0} r={16 + 12 * b} fill={glow} opacity={over ? 0.28 : 0.1 + 0.22 * b} />
          <Circle cx={0} cy={0} r={9 + 5 * b} fill={glow} opacity={over ? 0.55 : 0.15 + 0.45 * b} />
        </>
      )}
      {lead(-LEAD, 0, -10, 0, stroke)}
      {lead(10, 0, LEAD, 0, stroke)}
      <Path
        d="M-10 -12 L-10 12 L10 0 Z"
        fill={over ? colors.red : b > 0.05 ? colors.gold : colors.white}
        stroke={stroke} strokeWidth={STROKE} strokeLinejoin="round"
      />
      <Line x1={10} y1={-13} x2={10} y2={13} stroke={stroke} strokeWidth={STROKE * 1.4} strokeLinecap="round" />
      {/* The two emission arrows are what separates an LED from a plain diode. */}
      <Line x1={-2} y1={-15} x2={4} y2={-22} stroke={over ? colors.red : b > 0.05 ? colors.goldPlate : colors.inkMute} strokeWidth={2} strokeLinecap="round" />
      <Line x1={5} y1={-15} x2={11} y2={-22} stroke={over ? colors.red : b > 0.05 ? colors.goldPlate : colors.inkMute} strokeWidth={2} strokeLinecap="round" />
      <Path d="M2 -22 l4 -1 l-1 4 z" fill={over ? colors.red : b > 0.05 ? colors.goldPlate : colors.inkMute} />
      <Path d="M9 -22 l4 -1 l-1 4 z" fill={over ? colors.red : b > 0.05 ? colors.goldPlate : colors.inkMute} />
    </G>
  );
};

const Diode: React.FC<GlyphProps> = ({ stroke }) => (
  <G>
    {lead(-LEAD, 0, -10, 0, stroke)}
    {lead(10, 0, LEAD, 0, stroke)}
    <Path d="M-10 -12 L-10 12 L10 0 Z" fill={stroke} stroke={stroke} strokeWidth={STROKE} strokeLinejoin="round" />
    <Line x1={10} y1={-13} x2={10} y2={13} stroke={stroke} strokeWidth={STROKE * 1.4} strokeLinecap="round" />
  </G>
);

const Capacitor: React.FC<GlyphProps> = ({ stroke }) => (
  <G>
    {lead(-LEAD, 0, -6, 0, stroke)}
    {lead(6, 0, LEAD, 0, stroke)}
    <Line x1={-6} y1={-15} x2={-6} y2={15} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    <Line x1={6} y1={-15} x2={6} y2={15} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
  </G>
);

const Switch: React.FC<GlyphProps> = ({ stroke, closed }) => (
  <G>
    {lead(-LEAD, 0, -14, 0, stroke)}
    {lead(14, 0, LEAD, 0, stroke)}
    <Circle cx={-14} cy={0} r={3.4} fill={stroke} />
    <Circle cx={14} cy={0} r={3.4} fill={stroke} />
    {/* The lever swings up when open. The gap IS the information. */}
    <Line
      x1={-14} y1={0}
      x2={closed ? 14 : 9} y2={closed ? 0 : -16}
      stroke={stroke} strokeWidth={STROKE * 1.5} strokeLinecap="round"
    />
  </G>
);

const Npn: React.FC<GlyphProps> = ({ stroke }) => {
  const colors = useColors();
  return (
    <G>
      <Circle cx={0} cy={0} r={21} fill={colors.surface} stroke={stroke} strokeWidth={STROKE} />
      {lead(-LEAD, 0, -7, 0, stroke)}
      <Line x1={-7} y1={-13} x2={-7} y2={13} stroke={stroke} strokeWidth={STROKE * 1.5} strokeLinecap="round" />
      {/* Collector up, emitter down, and the arrow on the emitter pointing out:
          that arrow is the whole difference between an NPN and a PNP. */}
      {lead(-7, -6, 14, -27, stroke)}
      {lead(14, -27, 14, -38, stroke)}
      {lead(-7, 6, 14, 27, stroke)}
      {lead(14, 27, 14, 38, stroke)}
      <Path d="M5 15 l9 4 l-4 8 z" fill={stroke} />
      <Mark x={-1} y={-24} text="C" fill={colors.inkMute} />
      <Mark x={-1} y={32} text="E" fill={colors.inkMute} />
    </G>
  );
};

const Ground: React.FC<GlyphProps> = ({ stroke }) => (
  <G>
    {lead(0, -24, 0, -7, stroke)}
    <Line x1={-15} y1={-7} x2={15} y2={-7} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    <Line x1={-9} y1={0} x2={9} y2={0} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    <Line x1={-4} y1={7} x2={4} y2={7} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
  </G>
);

const GLYPHS: Record<PartKind, React.FC<GlyphProps>> = {
  battery: Battery,
  resistor: Resistor,
  led: Led,
  diode: Diode,
  capacitor: Capacitor,
  switch: Switch,
  npn: Npn,
  ground: Ground,
};

export const PartGlyph: React.FC<GlyphProps> = (props) => {
  const Sym = GLYPHS[props.kind];
  return <Sym {...props} />;
};
