import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PanResponder } from 'react-native';
import { LIVE_CIRCUITS, type LiveCircuitDef } from '../../sim/circuits';
import { initTransient, solve, stepTransient, type SolveResult, type TransientState } from '../../sim/engine';
import { LiveReadout } from './LiveReadout';
import { useScrollLock, LockableScrollView } from '../ScrollLock';
import { colors, curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';

/**
 * The Circuit tab: a real solver behind a single knob.
 *
 * The simulator used to run a sketch and animate an LED from its PWM duty cycle,
 * which is a plausible-looking guess rather than physics. Here the netlist goes
 * through modified nodal analysis and the numbers on screen are what the solver
 * found. Turn the resistor and the current changes because Ohm's law says so.
 */

/**
 * A slider built on PanResponder rather than a component library.
 *
 * It has to refuse termination the way the drawing canvas does, or a vertical
 * drift mid-gesture hands the touch to the surrounding ScrollView and the value
 * sticks. Same negotiation, same fix.
 */
const Knob: React.FC<{
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void;
}> = ({ min, max, step, value, onChange }) => {
  // Refusing the responder is not enough: UIScrollView competes below the JS
  // responder system, so the page scrolled while the knob also moved.
  const { setLocked } = useScrollLock();
  const width = useRef(0);
  // The track's absolute left edge on screen.
  //
  // locationX is relative to WHICHEVER VIEW received the touch, and the thumb is
  // a child of the track. Grabbing the thumb therefore reported 0 to 28 instead
  // of a position along the track, so the value snapped to the minimum: exactly
  // the "lift my finger and it jumps back to the start" symptom, and why the far
  // end was unreachable, since that is where the thumb sits under the finger.
  // pageX is absolute and does not care which view was hit.
  const originX = useRef(0);
  const trackRef = useRef<View>(null);
  const latest = useRef(value);
  latest.current = value;

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      originX.current = x;
      if (w > 0) width.current = w;
    });
  };

  const setFromX = (pageX: number) => {
    if (width.current <= 0) return;
    const frac = Math.min(1, Math.max(0, (pageX - originX.current) / width.current));
    const raw = min + frac * (max - min);
    const snapped = Math.round(raw / step) * step;
    const clamped = Math.min(max, Math.max(min, snapped));
    if (clamped !== latest.current) onChange(clamped);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      // Re-measure on every grant: the track moves when the page scrolls, and a
      // stale origin would offset every reading by the scroll distance.
      onPanResponderGrant: (e) => { setLocked(true); measure(); setFromX(e.nativeEvent.pageX); },
      onPanResponderMove: (e) => setFromX(e.nativeEvent.pageX),
      // Released AND terminated, or a cancelled gesture leaves the page stuck.
      onPanResponderRelease: () => setLocked(false),
      onPanResponderTerminate: () => setLocked(false),
    }),
  ).current;

  const frac = (value - min) / (max - min);
  return (
    <View
      ref={trackRef}
      style={k.track}
      onLayout={measure}
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
    >
      {/* Neither child may take the touch: the responder belongs to the track,
          so the finger position always means the same thing. */}
      <View pointerEvents="none" style={[k.fill, { width: `${frac * 100}%` }]} />
      <View pointerEvents="none" style={[k.thumb, { left: `${frac * 100}%` }]} />
    </View>
  );
};

export const CircuitTab: React.FC = () => {
  const [picked, setPicked] = useState<LiveCircuitDef>(LIVE_CIRCUITS[0]);
  const [value, setValue] = useState<number>(LIVE_CIRCUITS[0].control.initial);

  // Reset the knob when the circuit changes: 10k means something different on a
  // divider than it does on a base resistor.
  useEffect(() => { setValue(picked.control.initial); }, [picked]);

  const netlist = useMemo(() => picked.build(value), [picked, value]);

  const [result, setResult] = useState<SolveResult | null>(null);
  const [fault, setFault] = useState<string | null>(null);

  // Steady state for everything without a capacitor. Solving in an effect rather
  // than during render keeps a slow solve off the gesture's critical path.
  useEffect(() => {
    if (picked.transient) return;
    try {
      setResult(solve(netlist));
      setFault(null);
    } catch (err) {
      setResult(null);
      setFault(describe(err));
    }
  }, [netlist, picked.transient]);

  // Transient circuits advance real time, so RC charging is genuinely a curve
  // rather than a scripted animation.
  const transient = useRef<TransientState | null>(null);
  useEffect(() => {
    if (!picked.transient) { transient.current = null; return; }
    transient.current = initTransient(netlist);
    setFault(null);
    const id = setInterval(() => {
      const st = transient.current;
      if (!st) return;
      try {
        // 20ms of circuit time per frame, in four sub-steps, so the curve stays
        // accurate at large RC values without the interval running faster.
        let r: SolveResult | null = null;
        for (let i = 0; i < 4; i += 1) r = stepTransient(netlist, st, 0.005);
        if (r) setResult(r);
      } catch (err) {
        setFault(describe(err));
      }
    }, 20);
    return () => clearInterval(id);
  }, [netlist, picked.transient]);

  const fmt = picked.control.format ?? ((v: number) => String(v));

  return (
    <LockableScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Text style={s.kicker}>CIRCUIT</Text>
      <Text style={s.title}>Turn it and watch.</Text>
      <Text style={s.body}>
        These are solved, not drawn. Every number below comes from the same nodal analysis a
        real simulator runs, so the circuit behaves the way the components would.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {LIVE_CIRCUITS.map((c) => {
          const on = c.id === picked.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setPicked(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.chipPressed]}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{c.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={s.blurb}>{picked.blurb}</Text>

      <View style={s.controlCard}>
        <View style={s.controlHead}>
          <Text style={s.controlLabel}>{picked.control.label}</Text>
          <Text style={s.controlValue}>{fmt(value)}{picked.control.unit}</Text>
        </View>
        <Knob
          min={picked.control.min}
          max={picked.control.max}
          step={picked.control.step}
          value={value}
          onChange={setValue}
        />
      </View>

      <LiveReadout circuit={picked} result={result} fault={fault} />

      <Text style={s.prompt}>{picked.prompt}</Text>
    </LockableScrollView>
  );
};

/** Turns a solver failure into something a learner can act on. */
function describe(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/singular|matrix/i.test(msg)) {
    return 'There is no complete path for current, or the source is shorted straight to ground. Either way the solver has nothing to work with.';
  }
  return 'This circuit could not be solved. That usually means a piece is not connected to anything.';
}

const k = StyleSheet.create({
  track: {
    height: 40, justifyContent: 'center', marginTop: space.sm,
  },
  fill: {
    position: 'absolute', height: 12, borderRadius: 6, ...curve,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink,
  },
  thumb: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14, marginLeft: -14,
    backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink,
    ...elevation.card,
  },
});

const s = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -1, marginTop: 4 },
  body: {
    fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.sm, lineHeight: 20,
  },
  chips: { gap: 8, paddingVertical: space.md, paddingRight: space.lg },
  chip: {
    borderWidth: 2, borderColor: colors.line, borderRadius: 999, ...curve,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  chipTextOn: { color: colors.white },
  blurb: { fontFamily: font.bold, fontSize: type.body, color: colors.ink, marginBottom: space.md, lineHeight: 22 },
  controlCard: {
    backgroundColor: colors.goldSoft, borderWidth: 2.5, borderColor: colors.goldPlate,
    borderRadius: radius.lg, ...curve, padding: space.md, marginBottom: space.md,
  },
  controlHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  controlLabel: { fontFamily: font.black, fontSize: type.small, color: colors.goldText, letterSpacing: 0.4 },
  controlValue: { fontFamily: font.black, fontSize: type.title, color: colors.ink, ...tabular, letterSpacing: -0.6 },
  prompt: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.md, lineHeight: 20,
  },
});
