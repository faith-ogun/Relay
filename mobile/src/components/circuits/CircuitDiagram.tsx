import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import {
  Battery, Buzzer, Capacitor, Coil, Diode, Ground, Label, Ldr, Led, Node, OpAmp,
  Resistor, Spark, Transistor, Wire,
} from './primitives';
import { colors, font, radius, type, curve } from '../../theme/tokens';

// The 14 circuits the authored lessons reference by key. 274 steps (11.6% of
// all steps) carry a `circuitDiagram`, and until now mobile silently dropped
// every one of them — those lessons were being taught without their picture.
//
// Drawn as SVG rather than shipped as images: they stay crisp at any size, cost
// nothing in bundle weight, and can later be animated (current flow, a lit LED)
// without a second asset pipeline.

const W = 320;
const H = 170;

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
    <Rect x={1} y={1} width={W - 2} height={H - 2} rx={12} fill={colors.white} stroke={colors.line} strokeWidth={2} />
    <G>{children}</G>
  </Svg>
);

export const CIRCUITS: Record<string, React.FC> = {
  // A single loop: battery, resistor, LED.
  series_circuit: () => (
    <Frame>
      <Battery x={40} y={85} label="9V" />
      <Wire x1={40} y1={68} x2={40} y2={40} /><Wire x1={40} y1={40} x2={110} y2={40} />
      <Resistor x={110} y={40} w={50} label="220Ω" />
      <Wire x1={160} y1={40} x2={230} y2={40} />
      <Led x={240} y={40} label="LED" />
      <Wire x1={258} y1={40} x2={280} y2={40} /><Wire x1={280} y1={40} x2={280} y2={130} />
      <Wire x1={280} y1={130} x2={40} y2={130} /><Wire x1={40} y1={130} x2={40} y2={100} />
      <Label x={160} y={152} text="One path, same current everywhere" />
    </Frame>
  ),

  // Two branches across one source.
  parallel_circuit: () => (
    <Frame>
      <Battery x={40} y={85} label="9V" />
      <Wire x1={40} y1={68} x2={40} y2={35} /><Wire x1={40} y1={35} x2={120} y2={35} />
      <Node x={120} y={35} />
      <Wire x1={120} y1={35} x2={120} y2={60} />
      <Resistor x={140} y={60} w={50} label="R1" /><Wire x1={120} y1={60} x2={140} y2={60} />
      <Wire x1={190} y1={60} x2={250} y2={60} />
      <Wire x1={120} y1={35} x2={120} y2={110} />
      <Resistor x={140} y={110} w={50} label="R2" /><Wire x1={120} y1={110} x2={140} y2={110} />
      <Wire x1={190} y1={110} x2={250} y2={110} />
      <Node x={250} y={60} /><Node x={250} y={110} />
      <Wire x1={250} y1={60} x2={250} y2={140} /><Wire x1={250} y1={140} x2={40} y2={140} />
      <Wire x1={40} y1={140} x2={40} y2={100} />
      <Label x={160} y={158} text="Same voltage across both branches" />
    </Frame>
  ),

  // Two resistors splitting a rail, tapped in the middle.
  voltage_divider: () => (
    <Frame>
      <Label x={150} y={22} text="Vin = 5V" />
      <Wire x1={150} y1={28} x2={150} y2={40} />
      <Resistor x={150} y={40} w={44} vertical label="R1" />
      <Node x={150} y={84} />
      <Wire x1={150} y1={84} x2={235} y2={84} />
      <Label x={262} y={82} text="Vout" />
      <Resistor x={150} y={92} w={44} vertical label="R2" />
      <Wire x1={150} y1={136} x2={150} y2={142} />
      <Ground x={150} y={142} />
      <Label x={70} y={158} text="Vout = Vin × R2/(R1+R2)" />
    </Frame>
  ),

  // The classic mistake: LED straight across the battery.
  led_no_resistor: () => (
    <Frame>
      <Battery x={45} y={85} label="9V" />
      <Wire x1={45} y1={68} x2={45} y2={45} /><Wire x1={45} y1={45} x2={200} y2={45} />
      <Spark x={130} y={45} />
      <Led x={215} y={45} label="LED" />
      <Wire x1={233} y1={45} x2={272} y2={45} /><Wire x1={272} y1={45} x2={272} y2={132} />
      <Wire x1={272} y1={132} x2={45} y2={132} /><Wire x1={45} y1={132} x2={45} y2={100} />
      <Label x={160} y={158} text="No current limiting — the LED will not survive" />
    </Frame>
  ),

  reversed_led: () => (
    <Frame>
      <Battery x={45} y={85} label="9V" />
      <Wire x1={45} y1={68} x2={45} y2={45} /><Wire x1={45} y1={45} x2={120} y2={45} />
      <Resistor x={120} y={45} w={50} label="220Ω" />
      <Wire x1={170} y1={45} x2={215} y2={45} />
      <Led x={230} y={45} reversed label="LED (backwards)" />
      <Wire x1={248} y1={45} x2={272} y2={45} /><Wire x1={272} y1={45} x2={272} y2={132} />
      <Wire x1={272} y1={132} x2={45} y2={132} /><Wire x1={45} y1={132} x2={45} y2={100} />
      <Label x={160} y={158} text="Reversed: a diode blocks current this way" />
    </Frame>
  ),

  short_circuit: () => (
    <Frame>
      <Battery x={45} y={85} label="9V" />
      <Wire x1={45} y1={68} x2={45} y2={45} /><Wire x1={45} y1={45} x2={266} y2={45} />
      <Resistor x={184} y={45} w={44} label="220Ω" />
      <Led x={246} y={45} label="LED" />
      <Wire x1={266} y1={45} x2={266} y2={132} /><Wire x1={266} y1={132} x2={45} y2={132} />
      <Wire x1={45} y1={132} x2={45} y2={100} />
      <Wire x1={150} y1={45} x2={150} y2={132} />
      <Node x={150} y={45} /><Node x={150} y={132} />
      <Spark x={150} y={94} />
      <Label x={160} y={158} text="This wire lets current skip the load entirely" />
    </Frame>
  ),

  ldr_alarm: () => (
    <Frame>
      <Label x={60} y={22} text="5V" /><Wire x1={60} y1={28} x2={60} y2={40} />
      <Ldr x={40} y={52} label="LDR" />
      <Wire x1={60} y1={61} x2={60} y2={82} />
      <Node x={60} y={82} /><Wire x1={60} y1={82} x2={135} y2={82} />
      <Resistor x={60} y={90} w={40} vertical label="10kΩ" />
      <Wire x1={60} y1={130} x2={60} y2={138} /><Ground x={60} y={138} />
      <Transistor x={155} y={82} label="NPN" />
      <Label x={222} y={26} text="5V" anchor="end" />
      <Wire x1={230} y1={22} x2={276} y2={22} /><Wire x1={253} y1={22} x2={253} y2={34} />
      <Buzzer x={253} y={48} />
      <Label x={272} y={52} text="buzzer" anchor="start" />
      <Wire x1={253} y1={62} x2={253} y2={72} /><Wire x1={253} y1={72} x2={165} y2={72} />
      <Wire x1={165} y1={72} x2={165} y2={66} />
      <Wire x1={165} y1={98} x2={165} y2={128} /><Ground x={165} y={132} />
      <Label x={160} y={158} text="Light drops, base goes high, the buzzer sounds" />
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
      <Label x={16} y={120} text="D9" anchor="start" />
      <Wire x1={30} y1={124} x2={46} y2={124} />
      <Resistor x={46} y={124} w={44} label="Rb" />
      <Wire x1={90} y1={124} x2={110} y2={124} />
    </Frame>
  ),

  rc_low_pass: () => (
    <Frame>
      <Label x={30} y={50} text="Vin" />
      <Wire x1={44} y1={55} x2={90} y2={55} />
      <Resistor x={90} y={55} w={54} label="R" />
      <Node x={144} y={55} />
      <Wire x1={144} y1={55} x2={240} y2={55} /><Label x={266} y={52} text="Vout" />
      <Wire x1={144} y1={55} x2={144} y2={88} />
      <Capacitor x={140} y={100} label="C" />
      <Wire x1={144} y1={112} x2={144} y2={134} /><Ground x={144} y={138} />
      <Label x={160} y={160} text="Passes slow signals, smooths fast ones" />
    </Frame>
  ),

  opamp_inverting: () => (
    <Frame>
      <Label x={24} y={52} text="Vin" />
      <Wire x1={38} y1={57} x2={62} y2={57} />
      <Resistor x={62} y={57} w={44} label="Rin" />
      <Node x={106} y={57} /><Wire x1={106} y1={57} x2={140} y2={57} />
      <OpAmp x={140} y={80} invertTop />
      <Wire x1={106} y1={57} x2={106} y2={24} /><Wire x1={106} y1={24} x2={150} y2={24} />
      <Resistor x={150} y={24} w={44} label="Rf" />
      <Wire x1={194} y1={24} x2={228} y2={24} /><Wire x1={228} y1={24} x2={228} y2={80} />
      <Node x={228} y={80} /><Wire x1={182} y1={80} x2={262} y2={80} />
      <Label x={286} y={78} text="Vout" anchor="end" />
      <Wire x1={112} y1={100} x2={140} y2={100} /><Ground x={112} y={104} />
      <Label x={160} y={160} text="Gain = −Rf / Rin" />
    </Frame>
  ),

  opamp_noninverting: () => (
    <Frame>
      <Label x={24} y={102} text="Vin" />
      <Wire x1={38} y1={100} x2={140} y2={100} />
      <OpAmp x={140} y={80} invertTop />
      <Wire x1={182} y1={80} x2={262} y2={80} /><Label x={286} y={78} text="Vout" anchor="end" />
      <Node x={228} y={80} /><Wire x1={228} y1={80} x2={228} y2={26} />
      <Resistor x={150} y={26} w={44} label="Rf" /><Wire x1={194} y1={26} x2={228} y2={26} />
      <Wire x1={106} y1={26} x2={150} y2={26} /><Wire x1={106} y1={26} x2={106} y2={57} />
      <Node x={106} y={57} /><Wire x1={106} y1={57} x2={140} y2={57} />
      <Resistor x={62} y={57} w={44} label="Rg" /><Wire x1={62} y1={57} x2={62} y2={130} />
      <Ground x={62} y={134} />
      <Label x={160} y={160} text="Gain = 1 + Rf / Rg" />
    </Frame>
  ),

  voltage_regulator: () => (
    <Frame>
      <Label x={30} y={44} text="9V in" />
      <Wire x1={46} y1={50} x2={100} y2={50} />
      <Rect x={100} y={32} width={70} height={38} rx={5} fill={colors.white} stroke={colors.ink} strokeWidth={2.4} />
      <Label x={135} y={55} text="7805" />
      <Wire x1={170} y1={50} x2={250} y2={50} /><Label x={280} y={48} text="5V out" anchor="end" />
      <Wire x1={135} y1={70} x2={135} y2={110} /><Ground x={135} y={114} />
      <Capacitor x={76} y={90} label="Cin" />
      <Wire x1={80} y1={78} x2={80} y2={50} /><Wire x1={80} y1={102} x2={80} y2={126} /><Ground x={80} y={130} />
      <Capacitor x={210} y={90} label="Cout" />
      <Wire x1={214} y1={78} x2={214} y2={50} /><Wire x1={214} y1={102} x2={214} y2={126} /><Ground x={214} y={130} />
      <Label x={160} y={160} text="Turns a messy input into a steady rail" />
    </Frame>
  ),

  h_bridge: () => (
    <Frame>
      <Label x={160} y={22} text="V+" /><Wire x1={70} y1={28} x2={250} y2={28} />
      <Transistor x={80} y={54} /><Transistor x={240} y={54} />
      <Transistor x={80} y={110} /><Transistor x={240} y={110} />
      <Wire x1={90} y1={38} x2={90} y2={28} /><Wire x1={250} y1={38} x2={250} y2={28} />
      <Wire x1={90} y1={70} x2={90} y2={94} /><Wire x1={250} y1={70} x2={250} y2={94} />
      <Node x={90} y={82} /><Node x={250} y={82} />
      <Wire x1={90} y1={82} x2={148} y2={82} /><Wire x1={192} y1={82} x2={250} y2={82} />
      <Circle cx={170} cy={82} r={21} fill={colors.white} stroke={colors.ink} strokeWidth={2.4} />
      <Label x={170} y={86} text="M" />
      <Wire x1={90} y1={126} x2={90} y2={138} /><Wire x1={250} y1={126} x2={250} y2={138} />
      <Wire x1={90} y1={138} x2={250} y2={138} /><Ground x={170} y={138} />
      <Label x={160} y={162} text="Four switches reverse the motor" />
    </Frame>
  ),

  breadboard_layout: () => (
    <Frame>
      <Rect x={24} y={26} width={272} height={110} rx={8} fill={colors.cream} stroke={colors.ink} strokeWidth={2.4} />
      <Line x1={24} y1={81} x2={296} y2={81} stroke={colors.ink} strokeWidth={1.6} opacity={0.35} />
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 16 }).map((__, col) => (
          <Circle key={`${row}-${col}`} cx={40 + col * 16} cy={44 + row * 18} r={2.6}
                  fill={colors.ink} opacity={0.2} />
        )),
      )}
      <Line x1={24} y1={34} x2={296} y2={34} stroke={colors.red} strokeWidth={2} opacity={0.5} />
      <Line x1={24} y1={128} x2={296} y2={128} stroke={colors.blueDeep} strokeWidth={2} opacity={0.5} />
      <Label x={160} y={160} text="Rails run along, rows run across the channel" />
    </Frame>
  ),
};


// ── Clickable regions ──
//
// `spot_error`, `fix_the_circuit` and `trace_current` steps name a region on a
// diagram and ask the learner to tap it. These rects mirror the region ids the
// web registry exposes, so a lesson authored once works on both surfaces. Only
// the regions the curriculum actually references are defined; a step naming an
// unknown region falls back to a non-interactive diagram rather than rendering
// an unsolvable exercise.
export interface Region { id: string; label: string; x: number; y: number; w: number; h: number }

const REGIONS: Record<string, Region[]> = {
  series_circuit: [
    { id: 'battery', label: 'battery', x: 18, y: 60, w: 48, h: 52 },
    { id: 'resistor', label: 'resistor', x: 104, y: 18, w: 62, h: 44 },
    { id: 'led', label: 'LED', x: 218, y: 18, w: 50, h: 46 },
  ],
  reversed_led: [
    { id: 'battery', label: 'battery', x: 22, y: 60, w: 48, h: 52 },
    { id: 'resistor', label: 'resistor', x: 114, y: 22, w: 62, h: 44 },
    { id: 'reversed_led', label: 'the LED', x: 208, y: 22, w: 52, h: 46 },
  ],
  led_no_resistor: [
    { id: 'battery', label: 'battery', x: 22, y: 60, w: 48, h: 52 },
    { id: 'missing_resistor', label: 'this stretch of wire', x: 100, y: 24, w: 76, h: 44 },
    { id: 'led', label: 'LED', x: 194, y: 22, w: 50, h: 46 },
  ],
  short_circuit: [
    { id: 'battery', label: 'battery', x: 22, y: 60, w: 48, h: 52 },
    { id: 'short_wire', label: 'this wire', x: 128, y: 40, w: 44, h: 96 },
    { id: 'load', label: 'the load side', x: 200, y: 32, w: 70, h: 108 },
  ],
  transistor_switch: [
    { id: 'relay', label: 'relay coil', x: 116, y: 30, w: 56, h: 66 },
    { id: 'diode', label: 'flyback diode', x: 204, y: 34, w: 54, h: 50 },
    { id: 'transistor', label: 'transistor', x: 104, y: 100, w: 54, h: 50 },
    { id: 'base_resistor', label: 'base resistor', x: 40, y: 104, w: 58, h: 42 },
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
      <Drawing />
      {!!press && regions.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
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

const s = StyleSheet.create({
  wrap: { marginTop: 14 },
  unknown: {
    marginTop: 14, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, paddingVertical: 22, alignItems: 'center',
  },
  unknownText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
