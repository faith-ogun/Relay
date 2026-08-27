import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';
import type { SolveResult } from '../../sim/engine';
import type { CircuitState, DerivedRow, LiveCircuitDef } from '../../sim/circuits';
import { LED_MAX_MA } from '../../sim/circuits';

/**
 * What the solver actually found, shown as instrument readings.
 *
 * Deliberately reads like a bench, not a debug dump: volts to two decimals and
 * milliamps to one, because that is the resolution a multimeter gives and the
 * resolution the numbers are trustworthy to. Printing eight decimal places would
 * imply a precision the model does not have.
 *
 * The rows are not the same for every circuit. Each one supplies its own lead
 * reading and its own verdict, because the quantity the knob actually moves is
 * different in each: a current here, a ratio there, a length of time in the RC
 * circuit, and in the transistor a state rather than a number at all.
 */

/** Volts, at the resolution a meter would show. */
const volts = (v: number) => `${v.toFixed(2)} V`;

/** Amps come out of the solver; nobody thinks in amps at this scale. */
const milliamps = (a: number) => {
  const mA = a * 1000;
  if (Math.abs(mA) < 1) return `${(mA * 1000).toFixed(0)} µA`;
  return `${mA.toFixed(1)} mA`;
};

/** Where a charging capacitor has got to, and how long the last fill took. */
export interface ChargeCycle {
  /** 0 to 1 of the supply voltage. */
  fraction: number;
  /** Seconds of circuit time since this fill started. */
  elapsed: number;
  /** How long the previous complete fill took, once there has been one. */
  lastFullSeconds: number | null;
  /** Sitting at full, briefly, so the number is readable before the next fill. */
  holding: boolean;
}

/**
 * An LED lit by real current.
 *
 * Brightness is the solved current against a nominal 20mA, which is where a
 * standard 5mm LED is designed to sit. Below about 1mA the eye sees nothing, so
 * the glow is clamped rather than fading to an invisible smear that suggests the
 * circuit is doing something it is not.
 *
 * The warning threshold is 25mA, the absolute maximum for a standard red LED,
 * not a round 30. 9V through 220 ohms is 29.8mA, so the difference decides
 * whether the most common beginner circuit in the world is reported as fine.
 */
export const LiveLed: React.FC<{ current: number; size?: number }> = ({ current, size = 56 }) => {
  const mA = Math.max(0, current * 1000);
  const lit = mA >= 1;
  const glow = Math.min(1, mA / 20);
  const r = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="led" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.gold} stopOpacity={lit ? 0.55 * glow : 0} />
            <Stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {lit && <Circle cx={r} cy={r} r={r} fill="url(#led)" />}
        <Circle
          cx={r}
          cy={r}
          r={r * 0.42}
          fill={lit ? colors.gold : colors.inkFaint}
          fillOpacity={lit ? 0.35 + 0.65 * glow : 1}
          stroke={colors.ink}
          strokeWidth={2.2}
        />
      </Svg>
    </View>
  );
};

const TONE = {
  good: { bg: '#f2fae7', border: colors.greenDeep, text: '#3f6b0d' },
  warn: { bg: colors.goldSoft, border: colors.goldPlate, text: colors.goldText },
  bad: { bg: '#fdece8', border: colors.red, text: '#a33122' },
} as const;

/** The capacitor filling, drawn as the thing it is. */
const ChargeMeter: React.FC<{ charge: ChargeCycle }> = ({ charge }) => (
  <View style={s.charge}>
    <View style={s.chargeHead}>
      <Text style={s.chargeLabel}>{charge.holding ? 'CHARGED' : 'CHARGING'}</Text>
      <Text style={s.chargePct}>{Math.round(charge.fraction * 100)}%</Text>
    </View>
    <View style={s.chargeTrack}>
      <View style={[s.chargeFill, { width: `${Math.max(2, charge.fraction * 100)}%` }]} />
    </View>
    <Text style={s.chargeFoot}>
      {charge.lastFullSeconds != null
        ? `Last fill took ${charge.lastFullSeconds.toFixed(2)} s. Move the resistor and this number moves with it.`
        : 'Filling for the first time.'}
    </Text>
  </View>
);

export const LiveReadout: React.FC<{
  circuit: LiveCircuitDef;
  result: SolveResult | null;
  /** Set when the circuit could not be solved, with the reason in plain words. */
  fault: string | null;
  /** Rows this circuit alone reports. */
  derived?: DerivedRow[];
  /** This circuit's verdict on where the knob currently sits. */
  state?: CircuitState | null;
  /** Only the RC circuit supplies this. */
  charge?: ChargeCycle | null;
}> = ({ circuit, result, fault, derived = [], state = null, charge = null }) => {
  const ledCurrent = circuit.ledId && result ? Math.abs(result.I[circuit.ledId] ?? 0) : 0;
  const lead = derived.filter((d) => d.lead);
  const rest = derived.filter((d) => !d.lead);
  const tone = state ? TONE[state.tone] : null;

  return (
    <View style={s.card}>
      {state && tone && !fault && (
        <View style={[s.state, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[s.stateTitle, { color: tone.text }]}>{state.title}</Text>
          <Text style={s.stateBody}>{state.body}</Text>
        </View>
      )}

      {circuit.ledId && (
        <View style={s.ledRow}>
          <LiveLed current={ledCurrent} />
          <View style={s.ledText}>
            <Text style={s.ledLabel}>
              {ledCurrent * 1000 < 1
                ? 'The LED is dark'
                : ledCurrent * 1000 > LED_MAX_MA
                  ? 'Past what the LED is rated for'
                  : 'The LED is lit'}
            </Text>
            <Text style={s.ledValue}>{milliamps(ledCurrent)}</Text>
          </View>
        </View>
      )}

      {charge && !fault && <ChargeMeter charge={charge} />}

      {lead.map((d) => (
        <View key={d.label} style={s.lead}>
          <Text style={s.leadLabel}>{d.label}</Text>
          <Text style={s.leadValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{d.value}</Text>
        </View>
      ))}

      {fault ? (
        // A circuit that cannot be solved is a lesson, not an error to swallow.
        <View style={s.fault}>
          <Text style={s.faultTitle}>Nothing is flowing</Text>
          <Text style={s.faultBody}>{fault}</Text>
        </View>
      ) : (
        <>
          <Text style={s.section}>VOLTAGE</Text>
          {circuit.probes.map((p) => (
            <View key={p.node} style={s.row}>
              <Text style={s.rowLabel}>{p.label}</Text>
              <Text style={s.rowValue}>{result ? volts(result.V[p.node] ?? 0) : '--'}</Text>
            </View>
          ))}

          <Text style={s.section}>CURRENT</Text>
          {circuit.currents.map((c) => (
            <View key={c.id} style={s.row}>
              <Text style={s.rowLabel}>{c.label}</Text>
              <Text style={s.rowValue}>{result ? milliamps(Math.abs(result.I[c.id] ?? 0)) : '--'}</Text>
            </View>
          ))}

          {rest.length > 0 && (
            <>
              <Text style={s.section}>WHAT THAT MEANS</Text>
              {rest.map((d) => (
                <View key={d.label} style={s.row}>
                  <Text style={s.rowLabel}>{d.label}</Text>
                  <Text style={s.rowValue}>{d.value}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, padding: space.md, ...elevation.card,
  },
  state: {
    borderWidth: 2, borderRadius: radius.md, ...curve,
    paddingVertical: 10, paddingHorizontal: space.md, marginBottom: space.md,
  },
  stateTitle: { fontFamily: font.black, fontSize: type.body, letterSpacing: -0.2 },
  stateBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2, lineHeight: 19 },
  ledRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingBottom: space.md, marginBottom: space.sm,
    borderBottomWidth: 2, borderBottomColor: colors.line,
  },
  ledText: { flex: 1, minWidth: 0 },
  ledLabel: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  ledValue: { fontFamily: font.black, fontSize: type.title, color: colors.ink, ...tabular, letterSpacing: -0.6 },
  charge: {
    backgroundColor: colors.blueSoft, borderWidth: 2, borderColor: colors.blueDeep,
    borderRadius: radius.md, ...curve, padding: space.md, marginBottom: space.md,
  },
  chargeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chargeLabel: { fontFamily: font.black, fontSize: 10, letterSpacing: 2, color: colors.blueDeep },
  chargePct: { fontFamily: font.black, fontSize: type.title, color: colors.ink, ...tabular, letterSpacing: -0.6 },
  chargeTrack: {
    height: 12, borderRadius: 6, ...curve, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.ink, marginTop: 6, overflow: 'hidden',
  },
  chargeFill: { height: '100%', backgroundColor: colors.blue },
  chargeFoot: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, marginTop: 6, lineHeight: 17 },
  lead: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md, ...curve,
    backgroundColor: colors.cream, paddingVertical: 10, paddingHorizontal: space.md, marginBottom: space.sm,
  },
  leadLabel: { fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft, letterSpacing: 0.3 },
  leadValue: { fontFamily: font.black, fontSize: type.display, color: colors.ink, ...tabular, letterSpacing: -1, marginTop: 1 },
  section: {
    fontFamily: font.black, fontSize: 10, letterSpacing: 2, color: colors.inkMute,
    marginTop: space.sm, marginBottom: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.inkFaint, gap: space.sm,
  },
  rowLabel: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, flex: 1 },
  rowValue: { fontFamily: font.black, fontSize: type.bodyLg, color: colors.ink, ...tabular },
  fault: {
    backgroundColor: '#fdece8', borderWidth: 2, borderColor: colors.red,
    borderRadius: radius.md, ...curve, padding: space.md, marginTop: space.sm,
  },
  faultTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  faultBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 3, lineHeight: 19 },
});
