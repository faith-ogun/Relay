import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LIVE_CIRCUITS, type LiveCircuitDef } from '../../sim/circuits';
import { initTransient, solve, stepTransient, type SolveResult, type TransientState } from '../../sim/engine';
import { LiveReadout, type ChargeCycle } from './LiveReadout';
import { fracFromPageX, thumbLeft, tickCentre, valueFor } from './knobGeometry';
import { useScrollLock, LockableScrollView } from '../ScrollLock';
import { curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { makeStyles } from '../../theme/theme';

/**
 * The Circuit tab: a real solver behind a single knob.
 *
 * The simulator used to run a sketch and animate an LED from its PWM duty cycle,
 * which is a plausible-looking guess rather than physics. Here the netlist goes
 * through modified nodal analysis and the numbers on screen are what the solver
 * found. Turn the resistor and the current changes because Ohm's law says so.
 */

/** The knob's diameter. The track reserves exactly this much so it cannot escape. */
const THUMB = 32;
/** The groove the fill runs in. */
const GROOVE = 14;

/**
 * A slider built on PanResponder rather than a component library.
 *
 * Two things it has to get right, both of which it got wrong before.
 *
 * It has to refuse termination the way the drawing canvas does, or a vertical
 * drift mid-gesture hands the touch to the surrounding ScrollView and the value
 * sticks. Same negotiation, same fix.
 *
 * And the thumb's TRAVEL is not the track's width. Positioning a 32pt knob at
 * `left: frac%` puts its centre on the track's edge at both ends, so half of it
 * hangs outside the control at 0 and again at 1, which is what "it goes behind
 * the box and then after the box" was describing. The travel is the width less
 * one thumb, the thumb is positioned by its LEFT edge inside that travel, and
 * the touch is mapped through the same inset so the point under the finger and
 * the point the knob is drawn at are the same point.
 */
const Knob: React.FC<{
  min: number; max: number; step: number; value: number;
  ticks?: { at: number; label: string; key?: boolean }[];
  onChange: (v: number) => void;
}> = ({ min, max, step, value, ticks, onChange }) => {
  const k = useK();
  // Refusing the responder is not enough: UIScrollView competes below the JS
  // responder system, so the page scrolled while the knob also moved.
  const { setLocked } = useScrollLock();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  // The track's absolute left edge on screen.
  //
  // locationX is relative to WHICHEVER VIEW received the touch, and the thumb is
  // a child of the track. Grabbing the thumb therefore reported 0 to 32 instead
  // of a position along the track, so the value snapped to the minimum: exactly
  // the "lift my finger and it jumps back to the start" symptom, and why the far
  // end was unreachable, since that is where the thumb sits under the finger.
  // pageX is absolute and does not care which view was hit.
  const originX = useRef(0);
  const trackRef = useRef<View>(null);
  const latest = useRef(value);
  latest.current = value;
  const lastTick = useRef(0);

  const measure = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      originX.current = x;
      if (w > 0) { widthRef.current = w; setWidth(w); }
    });
  }, []);

  const setFromX = useCallback((pageX: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    // Read through the same inset the thumb is drawn with, so the value under
    // the finger and the value on screen are the same value.
    const clamped = valueFor(fracFromPageX(pageX, originX.current, w, THUMB), min, max, step);
    if (clamped !== latest.current) {
      latest.current = clamped;
      onChange(clamped);
      // A detent under the finger, throttled so a fast sweep does not queue a
      // hundred of them and lag behind the gesture.
      const now = Date.now();
      if (now - lastTick.current > 45) {
        lastTick.current = now;
        Haptics.selectionAsync().catch(() => {});
      }
    }
  }, [min, max, step, onChange]);

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

  const frac = max > min ? (value - min) / (max - min) : 0;
  const left = thumbLeft(frac, width, THUMB);

  return (
    <View style={k.wrap}>
      <View
        ref={trackRef}
        style={k.track}
        onLayout={measure}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const d = e.nativeEvent.actionName === 'increment' ? step : -step;
          onChange(Math.min(max, Math.max(min, value + d)));
        }}
      >
        {/* Neither child may take the touch: the responder belongs to the track,
            so the finger position always means the same thing. */}
        <View pointerEvents="none" style={k.groove} />
        {width > 0 && (
          <>
            <View pointerEvents="none" style={[k.fill, { width: left + THUMB / 2 }]} />
            <View pointerEvents="none" style={[k.thumb, { left }]}>
              <View style={k.thumbCore} />
            </View>
          </>
        )}
      </View>
      {!!ticks?.length && width > 0 && (
        <View pointerEvents="none" style={k.ticks}>
          {ticks.map((t) => {
            return (
              <View key={t.at} style={[k.tick, { left: tickCentre(t.at, min, max, width, THUMB) }]}>
                <View style={[k.tickMark, t.key && k.tickMarkKey]} />
                <Text style={[k.tickLabel, t.key && k.tickLabelKey]} numberOfLines={1}>{t.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export const CircuitTab: React.FC = () => {
  const s = useS();
  const [picked, setPicked] = useState<LiveCircuitDef>(LIVE_CIRCUITS[0]);
  const [value, setValue] = useState<number>(LIVE_CIRCUITS[0].control.initial);

  // Reset the knob when the circuit changes: 10k means something different on a
  // divider than it does on a base resistor.
  useEffect(() => { setValue(picked.control.initial); }, [picked]);

  const netlist = useMemo(() => picked.build(value), [picked, value]);

  const [result, setResult] = useState<SolveResult | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [charge, setCharge] = useState<ChargeCycle | null>(null);

  // Steady state for everything without a capacitor. Solving in an effect rather
  // than during render keeps a slow solve off the gesture's critical path.
  useEffect(() => {
    if (picked.transient) return;
    setCharge(null);
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
  //
  // And it REFILLS. A capacitor that charges once and sits at 5V makes the
  // resistor look inert, because the settled voltage is 5V at every position on
  // the slider; only the time taken to get there answers to the knob. Cycling
  // means the thing the control changes is the thing on screen, continuously.
  const transient = useRef<TransientState | null>(null);
  useEffect(() => {
    if (!picked.transient) { transient.current = null; return; }
    const supply = netlist.find((c) => c.kind === 'V')?.value ?? 5;
    let elapsed = 0;
    let holdUntil = 0;
    let lastFull: number | null = null;
    transient.current = initTransient(netlist);
    setFault(null);
    setCharge({ fraction: 0, elapsed: 0, lastFullSeconds: null, holding: false });

    const STEP = 0.005;   // seconds of circuit time per sub-step
    const SUBS = 4;       // sub-steps per frame, so 20ms of circuit time
    const FRAME = 20;     // milliseconds of wall clock per frame

    const id = setInterval(() => {
      const st = transient.current;
      if (!st) return;
      try {
        if (holdUntil > 0) {
          // Hold the full reading briefly so the time it took is readable
          // before the next fill starts.
          holdUntil -= FRAME;
          if (holdUntil <= 0) {
            holdUntil = 0;
            elapsed = 0;
            transient.current = initTransient(netlist);
            setCharge({ fraction: 0, elapsed: 0, lastFullSeconds: lastFull, holding: false });
          }
          return;
        }
        let r: SolveResult | null = null;
        for (let i = 0; i < SUBS; i += 1) r = stepTransient(netlist, st, STEP);
        elapsed += STEP * SUBS;
        if (r) {
          setResult(r);
          const v = r.V[2] ?? 0;
          const fraction = supply > 0 ? Math.min(1, Math.max(0, v / supply)) : 0;
          if (fraction >= 0.99) {
            lastFull = elapsed;
            holdUntil = 700;
            setCharge({ fraction: 1, elapsed, lastFullSeconds: elapsed, holding: true });
          } else {
            setCharge({ fraction, elapsed, lastFullSeconds: lastFull, holding: false });
          }
        }
      } catch (err) {
        setFault(describe(err));
      }
    }, FRAME);
    return () => clearInterval(id);
  }, [netlist, picked.transient]);

  const fmt = picked.control.format ?? ((v: number) => String(v));
  const derived = picked.derive?.(value, result) ?? [];
  const state = picked.state?.(value, result) ?? null;

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
          <Text style={s.controlValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {fmt(value)}{picked.control.unit}
          </Text>
        </View>
        {/* Keyed by circuit so the knob remeasures rather than carrying the
            previous circuit's width through the switch. */}
        <Knob
          key={picked.id}
          min={picked.control.min}
          max={picked.control.max}
          step={picked.control.step}
          ticks={picked.control.ticks}
          value={value}
          onChange={setValue}
        />
      </View>

      <LiveReadout
        circuit={picked}
        result={result}
        fault={fault}
        derived={derived}
        state={state}
        charge={charge}
      />

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

const useK = makeStyles((colors, th) => ({
  wrap: { marginTop: space.sm },
  track: { height: 44, justifyContent: 'center' },
  groove: {
    position: 'absolute', left: 0, right: 0, height: GROOVE, borderRadius: GROOVE / 2, ...curve,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink,
  },
  fill: {
    position: 'absolute', left: 0, height: GROOVE, borderRadius: GROOVE / 2, ...curve,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink,
  },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', ...th.elevation.card,
  },
  thumbCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.goldDeep },
  ticks: { height: 26, marginTop: 2 },
  tick: { position: 'absolute', alignItems: 'center', width: 44, marginLeft: -22 },
  tickMark: { width: 2, height: 5, borderRadius: 1, backgroundColor: colors.inkMute },
  tickMarkKey: { width: 3, height: 8, backgroundColor: colors.ink },
  tickLabel: { fontFamily: font.bold, fontSize: 10, color: colors.inkMute, marginTop: 2, ...tabular },
  tickLabelKey: { fontFamily: font.black, color: colors.ink },
}));

const useS = makeStyles((colors) => ({
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
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  chipTextOn: { color: colors.onInk },
  blurb: { fontFamily: font.bold, fontSize: type.body, color: colors.ink, marginBottom: space.md, lineHeight: 22 },
  controlCard: {
    backgroundColor: colors.goldSoft, borderWidth: 2.5, borderColor: colors.goldPlate,
    borderRadius: radius.lg, ...curve, padding: space.md, marginBottom: space.md,
  },
  controlHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  controlLabel: { fontFamily: font.black, fontSize: type.small, color: colors.goldText, letterSpacing: 0.4, flexShrink: 1 },
  controlValue: { fontFamily: font.black, fontSize: type.title, color: colors.ink, ...tabular, letterSpacing: -0.6 },
  prompt: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.md, lineHeight: 20,
  },
}));
