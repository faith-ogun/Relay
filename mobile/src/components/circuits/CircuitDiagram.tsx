import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import {
  Battery, Capacitor, Coil, Diode, Ground, Label, Ldr, Led, Node, OpAmp,
  Resistor, Spark, Transistor, Wire,
} from './primitives';
import { font, radius, type, curve, type Colors } from '../../theme/tokens';
import { makeStyles, useColors } from '../../theme/theme';

// The 14 circuits the authored lessons reference by key. 274 steps (11.6% of
// all steps) carry a `circuitDiagram`, and until now mobile silently dropped
// every one of them, so those lessons were taught without their picture.
//
// Drawn as SVG rather than shipped as images: they stay crisp at any size, cost
// nothing in bundle weight, and can later be animated (current flow, a lit LED)
// without a second asset pipeline.
//
// ── The two surfaces draw the SAME circuit for a given id ──
//
// A lesson names a circuit id and a region id on it. Web and mobile each draw
// their own art, so for a while they drifted: mobile's `ldr_alarm` was an NPN
// driving a buzzer while the web's (and the lesson text's) was D9 → 220 Ω → LED,
// and six authored steps that asked the learner to tap the LED or the divider
// resistor had nothing to tap on a phone. `mobile/scripts/check-circuit-regions.mjs`
// now holds the two hit maps to the same shape, so that cannot come back.

const W = 320;
const H = 170;

// Two diagrams need a taller canvas than the rest, because a tap target has a
// floor (see REGIONS) and their parts do not fit above it in 170 units:
// `ldr_alarm` carries eight regions, `breadboard_layout` three full-width bands.
// The SVG height is set to exactly the viewBox height, so a taller canvas costs
// vertical space on screen and changes nothing about the scale (1 unit stays
// 1 pt on any phone at least 368 pt wide).
//
// The art and the tap overlay are two SEPARATE SVGs sharing one viewBox, so a
// height written down twice is a height that can drift, and drift here is
// invisible: draw at 200 against a 230 overlay and both still render, but the
// overlay scales to 200/230 while the art scales to 1, and every hit area on
// that diagram lands several points off the part it names. There is therefore
// one number, and a drawing that needs it names it (`HEIGHTS.ldr_alarm`).
// `as const` is what makes a typo a compile error rather than a silent 170.
const HEIGHTS = {
  ldr_alarm: 230,
  breadboard_layout: 210,
} as const;

/** Viewport height, in viewBox units, of `circuit`'s drawing. */
export const heightFor = (circuit?: string): number =>
  (circuit && (HEIGHTS as Record<string, number>)[circuit]) || H;

const Frame: React.FC<{ children: React.ReactNode; h?: number }> = ({ children, h = H }) => {
  const colors = useColors();
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`}>
      <Rect x={1} y={1} width={W - 2} height={h - 2} rx={12} fill={colors.surface} stroke={colors.line} strokeWidth={2} />
      <G>{children}</G>
    </Svg>
  );
};

/**
 * A named terminal: an Arduino pin, or the labelled input/output of a block.
 *
 * The web draws these as pin pads and the lessons speak of them as parts
 * ("click the analog pin that reads the sensor"), so a bare text label is not
 * enough: a learner has to be able to see the thing before they can tap it.
 */
const Pin: React.FC<{ x: number; y: number; label: string; w?: number }> = ({ x, y, label, w = 40 }) => {
  const colors = useColors();
  return (
    <G>
      <Rect x={x - w / 2} y={y - 10} width={w} height={20} rx={5}
            fill={colors.surface} stroke={colors.ink} strokeWidth={2.4} />
      <SvgText x={x} y={y + 4} fontSize={10} fontWeight="800" fill={colors.ink} textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
};

/** Hole columns on the breadboard, at the pitch the row_group hit area assumes. */
const COLUMNS = [40, 70, 100, 130, 160, 190, 220, 250, 280];

/**
 * Every diagram in the set, keyed by the id the curriculum authors write.
 *
 * The palette arrives as a PROP rather than being read from a hook inside each
 * one. The keys are authored ids, so these functions are named `ldr_alarm` and
 * `h_bridge`, and a lowercase function holding a hook is something neither the
 * lint rule nor the React Compiler can tell apart from a plain helper that got
 * a hook by mistake. One prop, resolved once by the component that renders them.
 */
export const CIRCUITS: Record<string, React.FC<{ colors: Colors }>> = {
  // A single loop: battery, resistor, LED.
  series_circuit: () => (
    <Frame>
      <Battery x={40} y={85} label="9V" />
      <Wire x1={40} y1={68} x2={40} y2={40} /><Wire x1={40} y1={40} x2={110} y2={40} />
      <Resistor x={110} y={40} w={50} label="220Ω" />
      <Wire x1={160} y1={40} x2={231} y2={40} />
      <Led x={240} y={40} label="LED" />
      <Wire x1={249} y1={40} x2={280} y2={40} /><Wire x1={280} y1={40} x2={280} y2={130} />
      <Wire x1={280} y1={130} x2={40} y2={130} /><Wire x1={40} y1={130} x2={40} y2={100} />
      <Label x={160} y={152} text="One path, same current everywhere" />
    </Frame>
  ),

  // Two branches across one source. Each branch carries its own resistor AND its
  // own LED, matching the web: the lessons ask which LED is brighter, so a
  // branch drawn as a bare resistor has nothing to answer with.
  parallel_circuit: () => (
    <Frame>
      <Battery x={36} y={85} label="9V" />
      <Wire x1={36} y1={68} x2={36} y2={32} /><Wire x1={36} y1={32} x2={100} y2={32} />
      <Node x={100} y={32} />
      {/* upper branch */}
      <Wire x1={100} y1={32} x2={100} y2={58} /><Wire x1={100} y1={58} x2={116} y2={58} />
      <Resistor x={116} y={58} w={44} label="R1" />
      <Wire x1={160} y1={58} x2={191} y2={58} />
      <Led x={200} y={58} label="LED 1" />
      <Wire x1={209} y1={58} x2={268} y2={58} />
      {/* lower branch */}
      <Wire x1={100} y1={32} x2={100} y2={118} /><Wire x1={100} y1={118} x2={116} y2={118} />
      <Resistor x={116} y={118} w={44} label="R2" />
      <Wire x1={160} y1={118} x2={191} y2={118} />
      <Led x={200} y={118} label="LED 2" />
      <Wire x1={209} y1={118} x2={268} y2={118} />
      <Node x={268} y={58} /><Node x={268} y={118} />
      <Wire x1={268} y1={58} x2={268} y2={148} /><Wire x1={268} y1={148} x2={36} y2={148} />
      <Wire x1={36} y1={148} x2={36} y2={102} />
      <Label x={160} y={164} text="Same voltage across both branches" />
    </Frame>
  ),

  // Two resistors splitting a rail, tapped in the middle and read by A0.
  voltage_divider: () => (
    <Frame>
      <Label x={150} y={22} text="Vin = 5V" />
      <Wire x1={150} y1={28} x2={150} y2={40} />
      <Resistor x={150} y={40} w={44} vertical label="R1" />
      <Node x={150} y={84} />
      <Wire x1={150} y1={84} x2={206} y2={84} />
      <Label x={178} y={76} text="Vout" />
      <Pin x={228} y={84} label="A0" w={44} />
      <Resistor x={150} y={92} w={44} vertical label="R2" />
      <Wire x1={150} y1={136} x2={150} y2={142} />
      <Ground x={150} y={142} />
      <Label x={160} y={162} text="Vout = Vin × R2/(R1+R2)" />
    </Frame>
  ),

  // The classic mistake: LED straight across the battery.
  led_no_resistor: () => (
    <Frame>
      <Battery x={45} y={85} label="9V" />
      <Wire x1={45} y1={68} x2={45} y2={45} /><Wire x1={45} y1={45} x2={206} y2={45} />
      <Spark x={130} y={45} />
      <Led x={215} y={45} label="LED" />
      <Wire x1={224} y1={45} x2={272} y2={45} /><Wire x1={272} y1={45} x2={272} y2={132} />
      <Wire x1={272} y1={132} x2={45} y2={132} /><Wire x1={45} y1={132} x2={45} y2={100} />
      <Label x={160} y={158} text="No current limiting, the LED will not survive" />
    </Frame>
  ),

  reversed_led: () => (
    <Frame>
      <Battery x={45} y={85} label="9V" />
      <Wire x1={45} y1={68} x2={45} y2={45} /><Wire x1={45} y1={45} x2={120} y2={45} />
      <Resistor x={120} y={45} w={50} label="220Ω" />
      <Wire x1={170} y1={45} x2={221} y2={45} />
      <Led x={230} y={45} reversed label="LED (backwards)" />
      <Wire x1={239} y1={45} x2={272} y2={45} /><Wire x1={272} y1={45} x2={272} y2={132} />
      <Wire x1={272} y1={132} x2={45} y2={132} /><Wire x1={45} y1={132} x2={45} y2={100} />
      <Label x={160} y={158} text="Reversed: a diode blocks current this way" />
    </Frame>
  ),

  short_circuit: () => (
    <Frame>
      <Battery x={45} y={85} label="9V" />
      <Wire x1={45} y1={68} x2={45} y2={45} /><Wire x1={45} y1={45} x2={184} y2={45} />
      <Resistor x={184} y={45} w={44} label="220Ω" />
      <Wire x1={228} y1={45} x2={237} y2={45} />
      <Led x={246} y={45} label="LED" />
      <Wire x1={255} y1={45} x2={266} y2={45} />
      <Wire x1={266} y1={45} x2={266} y2={132} /><Wire x1={266} y1={132} x2={45} y2={132} />
      <Wire x1={45} y1={132} x2={45} y2={100} />
      <Wire x1={150} y1={45} x2={150} y2={132} />
      <Node x={150} y={45} /><Node x={150} y={132} />
      <Spark x={150} y={94} />
      <Label x={160} y={158} text="This wire lets current skip the load entirely" />
    </Frame>
  ),

  // ── The flagship build ──
  //
  // Sense: 5 V → LDR → divider midpoint → 10 kΩ → GND, midpoint read by A0.
  // Act:   D9 → 220 Ω → LED → GND.
  //
  // This is the circuit the authored lessons describe in words ("the 10k sits
  // under the LDR", "digitalWrite puts D9 at 5 V, so current runs through the
  // 220 ohm resistor and lights the LED"), and the one the web draws. Mobile
  // used to draw an NPN driving a buzzer instead, which contradicted the lesson
  // text and left six identify_component steps with nothing to tap.
  ldr_alarm: ({ colors }) => (
      <Frame h={HEIGHTS.ldr_alarm}>
        <Rect x={18} y={24} width={54} height={184} rx={8}
              fill={colors.blueDeep} stroke={colors.ink} strokeWidth={2.4} />
        <SvgText x={45} y={42} fontSize={9} fontWeight="800" fill={colors.white} textAnchor="middle">
          ARDUINO
        </SvgText>
        <Pin x={92} y={52} label="5V" />
        <Pin x={92} y={100} label="A0" />
        <Pin x={92} y={148} label="D9" />
        <Pin x={92} y={196} label="GND" />
        {/* sense: 5V → LDR → midpoint → 10k → GND */}
        <Wire x1={112} y1={52} x2={140} y2={52} />
        <Ldr x={140} y={52} />
        <Label x={160} y={72} text="LDR" />
        <Wire x1={180} y1={52} x2={250} y2={52} />
        <Wire x1={250} y1={52} x2={250} y2={118} />
        <Node x={250} y={100} />
        <Wire x1={250} y1={100} x2={112} y2={100} />
        <Resistor x={250} y={118} w={40} vertical label="10kΩ" />
        <Wire x1={250} y1={158} x2={250} y2={196} />
        <Wire x1={250} y1={196} x2={112} y2={196} />
        {/* act: D9 → 220Ω → LED → GND */}
        <Wire x1={112} y1={148} x2={132} y2={148} />
        <Resistor x={132} y={148} w={44} label="220Ω" />
        <Wire x1={176} y1={148} x2={191} y2={148} />
        <Led x={200} y={148} label="LED" />
        <Wire x1={209} y1={148} x2={218} y2={148} />
        <Wire x1={218} y1={148} x2={218} y2={196} />
        <Node x={218} y={196} />
        <Label x={160} y={224} text="Cover the LDR, the reading falls, the LED lights" />
      </Frame>
  ),

  transistor_switch: () => (
    <Frame>
      <Label x={92} y={30} text="+12V" anchor="end" />
      <Wire x1={100} y1={26} x2={230} y2={26} />
      <Wire x1={140} y1={26} x2={140} y2={34} />
      <Coil x={140} y={34} label="relay" />
      <Wire x1={140} y1={90} x2={140} y2={104} />
      <Wire x1={230} y1={26} x2={230} y2={40} />
      <Diode x={230} y={58} vertical flip label="flyback" />
      <Wire x1={230} y1={76} x2={230} y2={104} />
      <Wire x1={230} y1={104} x2={140} y2={104} />
      <Node x={140} y={104} />
      <Transistor x={130} y={124} label="NPN" />
      <Wire x1={140} y1={104} x2={140} y2={108} />
      <Wire x1={140} y1={140} x2={140} y2={150} />
      <Ground x={140} y={152} />
      <Pin x={30} y={124} label="D9" />
      <Wire x1={50} y1={124} x2={60} y2={124} />
      <Resistor x={60} y={124} w={40} label="Rb" />
      <Wire x1={100} y1={124} x2={110} y2={124} />
    </Frame>
  ),

  rc_low_pass: () => (
    <Frame>
      <Pin x={44} y={55} label="Vin" />
      <Wire x1={64} y1={55} x2={90} y2={55} />
      <Resistor x={90} y={55} w={54} label="R" />
      <Node x={144} y={55} />
      <Wire x1={144} y1={55} x2={248} y2={55} />
      <Pin x={270} y={55} label="Vout" w={44} />
      <Wire x1={144} y1={55} x2={144} y2={88} />
      <Capacitor x={140} y={100} label="C" />
      <Wire x1={144} y1={112} x2={144} y2={134} /><Ground x={144} y={138} />
      <Label x={160} y={162} text="Passes slow signals, smooths fast ones" />
    </Frame>
  ),

  opamp_inverting: () => (
    <Frame>
      <Pin x={28} y={57} label="Vin" w={36} />
      <Wire x1={46} y1={57} x2={62} y2={57} />
      <Resistor x={62} y={57} w={44} label="Rin" />
      <Node x={106} y={57} /><Wire x1={106} y1={57} x2={140} y2={57} />
      <OpAmp x={140} y={80} invertTop />
      <Wire x1={106} y1={57} x2={106} y2={24} /><Wire x1={106} y1={24} x2={150} y2={24} />
      <Resistor x={150} y={24} w={44} label="Rf" />
      <Wire x1={194} y1={24} x2={228} y2={24} /><Wire x1={228} y1={24} x2={228} y2={80} />
      <Node x={228} y={80} /><Wire x1={182} y1={80} x2={254} y2={80} />
      <Pin x={276} y={80} label="Vout" w={44} />
      <Wire x1={112} y1={100} x2={140} y2={100} /><Ground x={112} y={104} />
      <Label x={160} y={162} text="Gain = −Rf / Rin" />
    </Frame>
  ),

  opamp_noninverting: () => (
    <Frame>
      <Pin x={26} y={100} label="Vin" w={36} />
      <Wire x1={44} y1={100} x2={140} y2={100} />
      <OpAmp x={140} y={80} invertTop />
      <Wire x1={182} y1={80} x2={254} y2={80} />
      <Pin x={276} y={80} label="Vout" w={44} />
      <Node x={228} y={80} /><Wire x1={228} y1={80} x2={228} y2={26} />
      <Resistor x={150} y={26} w={44} label="Rf" /><Wire x1={194} y1={26} x2={228} y2={26} />
      <Wire x1={106} y1={26} x2={150} y2={26} /><Wire x1={106} y1={26} x2={106} y2={57} />
      <Node x={106} y={57} /><Wire x1={106} y1={57} x2={140} y2={57} />
      <Resistor x={62} y={57} w={44} label="Rg" />
      {/* Rg returns to ground ABOVE the Vin run, so the two never cross. */}
      <Wire x1={62} y1={57} x2={62} y2={78} />
      <Ground x={62} y={82} />
      <Label x={160} y={162} text="Gain = 1 + Rf / Rg" />
    </Frame>
  ),

  voltage_regulator: ({ colors }) => (
      <Frame>
        <Pin x={38} y={50} label="9V in" w={44} />
        <Wire x1={60} y1={50} x2={100} y2={50} />
        <Rect x={100} y={32} width={70} height={38} rx={5} fill={colors.surface} stroke={colors.ink} strokeWidth={2.4} />
        <Label x={135} y={55} text="7805" />
        <Wire x1={170} y1={50} x2={254} y2={50} />
        <Pin x={276} y={50} label="5V out" w={48} />
        <Wire x1={135} y1={70} x2={135} y2={110} /><Ground x={135} y={114} />
        <Capacitor x={76} y={90} label="Cin" />
        <Wire x1={80} y1={78} x2={80} y2={50} /><Wire x1={80} y1={102} x2={80} y2={126} /><Ground x={80} y={130} />
        <Capacitor x={210} y={90} label="Cout" />
        <Wire x1={214} y1={78} x2={214} y2={50} /><Wire x1={214} y1={102} x2={214} y2={126} /><Ground x={214} y={130} />
        <Label x={160} y={162} text="Turns a messy input into a steady rail" />
      </Frame>
  ),

  h_bridge: ({ colors }) => (
      <Frame>
        <Label x={160} y={22} text="V+" /><Wire x1={70} y1={28} x2={250} y2={28} />
        <Transistor x={80} y={54} /><Transistor x={240} y={54} />
        <Transistor x={80} y={110} /><Transistor x={240} y={110} />
        <Label x={50} y={50} text="Q1" anchor="end" /><Label x={272} y={50} text="Q2" anchor="start" />
        <Label x={50} y={106} text="Q3" anchor="end" /><Label x={272} y={106} text="Q4" anchor="start" />
        <Wire x1={90} y1={38} x2={90} y2={28} /><Wire x1={250} y1={38} x2={250} y2={28} />
        <Wire x1={90} y1={70} x2={90} y2={94} /><Wire x1={250} y1={70} x2={250} y2={94} />
        <Node x={90} y={82} /><Node x={250} y={82} />
        <Wire x1={90} y1={82} x2={148} y2={82} /><Wire x1={192} y1={82} x2={250} y2={82} />
        <Circle cx={170} cy={82} r={21} fill={colors.surface} stroke={colors.ink} strokeWidth={2.4} />
        <Label x={170} y={86} text="M" />
        <Wire x1={90} y1={126} x2={90} y2={138} /><Wire x1={250} y1={126} x2={250} y2={138} />
        <Wire x1={90} y1={138} x2={250} y2={138} /><Ground x={170} y={138} />
        <Label x={160} y={164} text="Four switches reverse the motor" />
      </Frame>
  ),

  // Rails along the top and bottom, terminal strips either side of the channel.
  // The pale capsule behind each column of holes IS the connection: five holes
  // in one capsule are one node, and the capsule stops at the channel because
  // the two halves are not joined. That is the whole lesson, drawn.
  breadboard_layout: ({ colors }) => (
      <Frame h={HEIGHTS.breadboard_layout}>
        <Rect x={22} y={12} width={276} height={178} rx={8} fill={colors.cream} stroke={colors.ink} strokeWidth={2.4} />
        <Rect x={28} y={22} width={264} height={18} rx={4} fill={colors.red} opacity={0.16} />
        <SvgText x={38} y={35} fontSize={10} fontWeight="800" fill={colors.red} textAnchor="start">+ 5V</SvgText>
        {COLUMNS.map((cx) => (
          <G key={`u${cx}`}>
            <Rect x={cx - 7} y={53} width={14} height={37} rx={7} fill={colors.ink} opacity={0.07} />
            {[58, 67, 76, 85].map((cy) => (
              <Circle key={cy} cx={cx} cy={cy} r={2.4} fill={colors.ink} opacity={0.32} />
            ))}
          </G>
        ))}
        <Rect x={28} y={96} width={264} height={12} fill={colors.line} />
        <SvgText x={160} y={105} fontSize={8} fontWeight="700" fill={colors.inkMute} textAnchor="middle">
          channel
        </SvgText>
        {COLUMNS.map((cx) => (
          <G key={`l${cx}`}>
            <Rect x={cx - 7} y={114} width={14} height={37} rx={7} fill={colors.ink} opacity={0.07} />
            {[119, 128, 137, 146].map((cy) => (
              <Circle key={cy} cx={cx} cy={cy} r={2.4} fill={colors.ink} opacity={0.32} />
            ))}
          </G>
        ))}
        <Rect x={28} y={164} width={264} height={18} rx={4} fill={colors.blueDeep} opacity={0.16} />
        <SvgText x={38} y={177} fontSize={10} fontWeight="800" fill={colors.blueDeep} textAnchor="start">− GND</SvgText>
        <Label x={160} y={203} text="Rails run along, rows run across the channel" />
      </Frame>
  ),
};


// ── Clickable regions ──
//
// `identify_component`, `spot_error`, `fix_the_circuit` and `trace_current`
// steps name a region on a diagram and ask the learner to tap it, and a `teach`
// step with hotspots does the same to explore. These rects are mobile's half of
// a contract with the web registry (frontend/components/ohmlet/circuits/registry.ts):
// the same circuit id must expose the SAME region ids on both surfaces, because
// a lesson is authored once and graded on either. `scripts/check-circuit-regions.mjs`
// fails the build if the two sets diverge, so `canRender`'s drop rule (which
// still guards the runner) can no longer fire silently in production.
//
// ── Sizing ──
//
// The SVG's height is fixed at the viewBox height, so it never scales up: one
// viewBox unit is 1 pt on any phone with at least 368 pt of content width, and
// 0.975 pt on the narrowest common Android (360 dp screen, 24 pt of lesson
// padding either side). Every rect below is therefore at least 46 units on its
// shorter side, which clears the 44 pt finger minimum with a hair to spare. Hit
// areas are deliberately larger than the symbols they cover; what they must not
// do is overlap each other or swallow a neighbouring part, and the checker
// verifies both.
export interface Region { id: string; label: string; x: number; y: number; w: number; h: number }

const REGIONS: Record<string, Region[]> = {
  series_circuit: [
    { id: 'battery', label: 'the battery', x: 18, y: 60, w: 48, h: 52 },
    { id: 'resistor', label: 'the resistor', x: 104, y: 16, w: 62, h: 48 },
    { id: 'led', label: 'the LED', x: 218, y: 16, w: 50, h: 48 },
  ],
  parallel_circuit: [
    { id: 'battery', label: 'the battery', x: 12, y: 60, w: 48, h: 52 },
    { id: 'r1', label: 'R1', x: 110, y: 34, w: 56, h: 48 },
    { id: 'led1', label: 'LED 1', x: 180, y: 34, w: 50, h: 48 },
    { id: 'r2', label: 'R2', x: 110, y: 94, w: 56, h: 48 },
    { id: 'led2', label: 'LED 2', x: 180, y: 94, w: 50, h: 48 },
  ],
  voltage_divider: [
    { id: 'r1', label: 'R1', x: 126, y: 34, w: 48, h: 50 },
    { id: 'r2', label: 'R2', x: 126, y: 88, w: 48, h: 50 },
    { id: 'a0', label: 'the A0 pin', x: 200, y: 60, w: 56, h: 48 },
  ],
  led_no_resistor: [
    { id: 'battery', label: 'the battery', x: 22, y: 60, w: 48, h: 52 },
    { id: 'missing_resistor', label: 'this stretch of wire', x: 100, y: 22, w: 76, h: 46 },
    { id: 'led', label: 'the LED', x: 194, y: 20, w: 50, h: 48 },
  ],
  reversed_led: [
    { id: 'battery', label: 'the battery', x: 22, y: 60, w: 48, h: 52 },
    { id: 'resistor', label: 'the resistor', x: 114, y: 20, w: 62, h: 48 },
    { id: 'reversed_led', label: 'the LED', x: 208, y: 20, w: 52, h: 48 },
  ],
  short_circuit: [
    { id: 'battery', label: 'the battery', x: 22, y: 60, w: 48, h: 52 },
    { id: 'short_wire', label: 'this wire', x: 127, y: 40, w: 46, h: 96 },
    { id: 'resistor', label: 'the resistor', x: 176, y: 20, w: 54, h: 48 },
    { id: 'led', label: 'the LED', x: 234, y: 20, w: 48, h: 48 },
  ],
  transistor_switch: [
    { id: 'd9', label: 'the D9 pin', x: 6, y: 101, w: 46, h: 46 },
    { id: 'base_resistor', label: 'the base resistor', x: 56, y: 101, w: 48, h: 46 },
    { id: 'transistor', label: 'the transistor', x: 106, y: 100, w: 54, h: 50 },
    { id: 'relay', label: 'the relay coil', x: 116, y: 30, w: 56, h: 66 },
    { id: 'diode', label: 'the flyback diode', x: 204, y: 34, w: 54, h: 50 },
  ],
  // Eight regions on one canvas, which is why this diagram is 230 units tall
  // rather than 170: at 170 the four pins could not each hold a finger.
  ldr_alarm: [
    { id: '5v', label: 'the 5V pin', x: 68, y: 29, w: 46, h: 46 },
    { id: 'a0', label: 'the A0 pin', x: 68, y: 77, w: 46, h: 46 },
    { id: 'd9', label: 'the D9 pin', x: 68, y: 125, w: 46, h: 46 },
    { id: 'gnd', label: 'the GND pin', x: 68, y: 173, w: 46, h: 46 },
    { id: 'ldr', label: 'the LDR', x: 134, y: 26, w: 56, h: 46 },
    { id: 'led_resistor', label: 'the 220Ω resistor', x: 126, y: 126, w: 52, h: 46 },
    { id: 'led', label: 'the LED', x: 179, y: 124, w: 48, h: 48 },
    { id: 'resistor', label: 'the 10kΩ resistor', x: 227, y: 114, w: 46, h: 48 },
  ],
  rc_low_pass: [
    { id: 'in', label: 'the input', x: 21, y: 32, w: 46, h: 46 },
    { id: 'resistor', label: 'the resistor', x: 84, y: 34, w: 64, h: 46 },
    { id: 'capacitor', label: 'the capacitor', x: 114, y: 82, w: 60, h: 46 },
    { id: 'out', label: 'the output', x: 246, y: 32, w: 48, h: 46 },
  ],
  opamp_inverting: [
    { id: 'in', label: 'the input', x: 6, y: 34, w: 46, h: 46 },
    { id: 'rin', label: 'Rin', x: 56, y: 34, w: 56, h: 46 },
    { id: 'rf', label: 'Rf', x: 144, y: 2, w: 56, h: 46 },
    { id: 'opamp', label: 'the op-amp', x: 134, y: 54, w: 54, h: 52 },
    { id: 'out', label: 'the output', x: 252, y: 57, w: 46, h: 46 },
  ],
  opamp_noninverting: [
    { id: 'in', label: 'the input', x: 4, y: 82, w: 46, h: 46 },
    { id: 'rg', label: 'Rg', x: 56, y: 34, w: 56, h: 46 },
    { id: 'rf', label: 'Rf', x: 144, y: 4, w: 56, h: 46 },
    { id: 'opamp', label: 'the op-amp', x: 134, y: 54, w: 54, h: 52 },
    { id: 'out', label: 'the output', x: 252, y: 57, w: 46, h: 46 },
  ],
  voltage_regulator: [
    { id: 'in', label: 'the input', x: 14, y: 27, w: 46, h: 46 },
    { id: 'cin', label: 'the input capacitor', x: 52, y: 78, w: 56, h: 46 },
    { id: 'reg', label: 'the 7805 regulator', x: 96, y: 28, w: 78, h: 46 },
    { id: 'cout', label: 'the output capacitor', x: 186, y: 78, w: 60, h: 46 },
    { id: 'out', label: 'the output', x: 250, y: 27, w: 50, h: 46 },
  ],
  h_bridge: [
    { id: 'q1', label: 'Q1', x: 57, y: 31, w: 46, h: 46 },
    { id: 'q2', label: 'Q2', x: 217, y: 31, w: 46, h: 46 },
    { id: 'motor', label: 'the motor', x: 146, y: 58, w: 50, h: 50 },
    { id: 'q3', label: 'Q3', x: 57, y: 87, w: 46, h: 46 },
    { id: 'q4', label: 'Q4', x: 217, y: 87, w: 46, h: 46 },
  ],
  breadboard_layout: [
    { id: 'power_rail', label: 'the positive rail', x: 24, y: 4, w: 272, h: 46 },
    // One column of holes: the capsule under this rect is the connected group.
    // 46 wide against a 30-unit column pitch, so it wraps its own column and
    // stops short of both neighbours.
    { id: 'row_group', label: 'one connected row', x: 77, y: 50, w: 46, h: 46 },
    { id: 'ground_rail', label: 'the ground rail', x: 24, y: 154, w: 272, h: 46 },
  ],
};

/** Region ids a learner can tap on `circuit`, or [] if it has none. */
export const regionsFor = (circuit?: string): Region[] => (circuit && REGIONS[circuit]) || [];

/** True when every id in `ids` is tappable on `circuit`. */
export const hasRegions = (circuit: string | undefined, ids: string[]): boolean => {
  const known = new Set(regionsFor(circuit).map((r) => r.id));
  return ids.length > 0 && ids.every((id) => known.has(id));
};

/** Human label for a region id, for feedback copy. */
export const regionLabel = (circuit: string | undefined, id: string): string =>
  regionsFor(circuit).find((r) => r.id === id)?.label ?? id.replace(/_/g, ' ');

export const hasCircuit = (key?: string): boolean => !!key && key in CIRCUITS;

export interface CircuitDiagramProps {
  circuit?: string;
  /** When set, regions become tappable and this fires with the region id. */
  onRegionPress?: (id: string) => void;
  /** Region ids drawn as picked. */
  selected?: string[];
  /** Region ids drawn as confirmed right, overriding `selected`. */
  correct?: string[];
  /** Region ids drawn as confirmed wrong, overriding `selected`. */
  wrong?: string[];
}

export const CircuitDiagram: React.FC<CircuitDiagramProps> = ({
  circuit, onRegionPress, selected, correct, wrong,
}) => {
  const colors = useColors();
  const s = useS();
  if (!circuit) return null;
  const Drawing = CIRCUITS[circuit];
  // An unknown key is stated rather than silently dropped, so a new authored
  // diagram is visible as missing instead of quietly absent.
  if (!Drawing) {
    return (
      <View style={s.unknown}>
        <Text style={s.unknownText}>Diagram: {circuit.replace(/_/g, ' ')}</Text>
      </View>
    );
  }
  const press = onRegionPress;
  const regions = press ? regionsFor(circuit) : [];
  return (
    <View style={s.wrap}>
      <Drawing colors={colors} />
      {!!press && regions.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Same viewBox as the drawing underneath, so a rect lands on the part
              it names however tall that particular diagram is. */}
          <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${heightFor(circuit)}`}>
            {regions.map((r) => {
              const isRight = correct?.includes(r.id);
              const isWrong = wrong?.includes(r.id);
              const isPicked = selected?.includes(r.id);
              const stroke = isRight ? colors.green : isWrong ? colors.red : isPicked ? colors.goldDeep : 'transparent';
              const fill = isRight ? colors.green : isWrong ? colors.red : isPicked ? colors.gold : colors.ink;
              return (
                <Rect
                  key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={8}
                  fill={fill} fillOpacity={stroke === 'transparent' ? 0.001 : 0.16}
                  stroke={stroke} strokeWidth={2.5}
                  onPress={() => press(r.id)}
                />
              );
            })}
          </Svg>
        </View>
      )}
    </View>
  );
};

const useS = makeStyles((colors) => ({
  wrap: { marginTop: 14 },
  unknown: {
    marginTop: 14, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.surface, paddingVertical: 22, alignItems: 'center',
  },
  unknownText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
}));
