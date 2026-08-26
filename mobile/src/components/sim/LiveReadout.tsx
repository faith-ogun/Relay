import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';
import type { SolveResult } from '../../sim/engine';
import type { LiveCircuitDef } from '../../sim/circuits';

/**
 * What the solver actually found, shown as instrument readings.
 *
 * Deliberately reads like a bench, not a debug dump: volts to two decimals and
 * milliamps to one, because that is the resolution a multimeter gives and the
 * resolution the numbers are trustworthy to. Printing eight decimal places would
 * imply a precision the model does not have.
 */

/** Volts, at the resolution a meter would show. */
const volts = (v: number) => `${v.toFixed(2)} V`;

/** Amps come out of the solver; nobody thinks in amps at this scale. */
const milliamps = (a: number) => {
  const mA = a * 1000;
  if (Math.abs(mA) < 1) return `${(mA * 1000).toFixed(0)} µA`;
  return `${mA.toFixed(1)} mA`;
};

/**
 * An LED lit by real current.
 *
 * Brightness is the solved current against a nominal 20mA, which is where a
 * standard 5mm LED is designed to sit. Below about 1mA the eye sees nothing, so
 * the glow is clamped rather than fading to an invisible smear that suggests the
 * circuit is doing something it is not.
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

export const LiveReadout: React.FC<{
  circuit: LiveCircuitDef;
  result: SolveResult | null;
  /** Set when the circuit could not be solved, with the reason in plain words. */
  fault: string | null;
}> = ({ circuit, result, fault }) => {
  const ledCurrent = circuit.ledId && result ? Math.abs(result.I[circuit.ledId] ?? 0) : 0;

  return (
    <View style={s.card}>
      {circuit.ledId && (
        <View style={s.ledRow}>
          <LiveLed current={ledCurrent} />
          <View style={s.ledText}>
            <Text style={s.ledLabel}>
              {ledCurrent * 1000 < 1
                ? 'The LED is dark'
                : ledCurrent * 1000 > 30
                  ? 'Brighter than the LED is rated for'
                  : 'The LED is lit'}
            </Text>
            <Text style={s.ledValue}>{milliamps(ledCurrent)}</Text>
          </View>
        </View>
      )}

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
  ledRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingBottom: space.md, marginBottom: space.sm,
    borderBottomWidth: 2, borderBottomColor: colors.line,
  },
  ledText: { flex: 1, minWidth: 0 },
  ledLabel: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  ledValue: { fontFamily: font.black, fontSize: type.title, color: colors.ink, ...tabular, letterSpacing: -0.6 },
  section: {
    fontFamily: font.black, fontSize: 10, letterSpacing: 2, color: colors.inkMute,
    marginTop: space.sm, marginBottom: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.inkFaint,
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
