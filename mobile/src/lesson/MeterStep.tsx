import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { CircuitDiagram } from '../components/circuits/CircuitDiagram';
import { fracFromPageX, thumbLeft, valueFor } from '../components/sim/knobGeometry';
import { colors, curve, font, radius, space, tabular, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { stepText } from './stepText';
import {
  fmtPlain, fmtReading, meterFraction, meterStep, withinTolerance, type MeterSpec,
} from './meterScale';
import type { StepPredictReading, StepProps } from './types';

/**
 * predict_reading with a `meter`: dial the needle to the reading.
 *
 * 155 of these were falling through to the choice renderer, which mapped over an
 * `options` array holding exactly one entry: the answer. "Two equal resistors
 * split 5V. Dial the voltage at the midpoint." followed by a single button
 * reading "2.5 V". The question asks for a dial, so this is the dial.
 *
 * Two parts: a gauge that shows the reading the way an instrument would, and a
 * slider that sets it. The gauge is not the control. A needle dragged directly
 * would be a fourth bespoke gesture surface repeating the arithmetic that
 * sim/knobGeometry.ts already proves, so the control is that same geometry: the
 * thumb's travel is the track less one thumb, the touch is read through pageX so
 * it does not re-base when the finger crosses the thumb, and the shell's
 * scroller stands down for the duration of the drag.
 */

/** The knob's diameter. The track reserves exactly this much so it cannot escape. */
const THUMB = 32;
/** The groove the fill runs in. */
const GROOVE = 14;

// Gauge geometry, in its own viewBox. Matches the web's proportions.
const CX = 120;
const CY = 120;
const R = 92;
const VIEW_W = 240;
const VIEW_H = 138;

const angleFor = (frac: number) => Math.PI * (1 - Math.min(1, Math.max(0, frac)));
const polar = (angle: number, r: number) => ({
  x: CX + r * Math.cos(angle),
  y: CY - r * Math.sin(angle),
});

/** An arc of the scale, from one fraction along it to another. */
function arcPath(r: number, fromFrac: number, toFrac: number): string {
  const a0 = angleFor(fromFrac);
  const a1 = angleFor(toFrac);
  const p0 = polar(a0, r);
  const p1 = polar(a1, r);
  const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

const Gauge: React.FC<{ m: MeterSpec; value: number; checked: boolean; correct: boolean | null }> = ({
  m, value, checked, correct,
}) => {
  const frac = meterFraction(value, m);
  const needleColor = checked ? (correct ? colors.greenDeep : colors.red) : colors.ink;
  const tip = polar(angleFor(frac), R - 8);

  // The band that counts as right, revealed once the answer is in. Showing it
  // before would hand over the answer; showing it after is the explanation.
  const lo = meterFraction(m.target - m.tolerance, m);
  const hi = meterFraction(m.target + m.tolerance, m);
  const targetTip = polar(angleFor(meterFraction(m.target, m)), R);

  return (
    <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Path d={arcPath(R, 0, 1)} fill="none" stroke={colors.inkFaint} strokeWidth={10} strokeLinecap="round" />
      {checked && hi > lo && (
        <Path d={arcPath(R, lo, hi)} fill="none" stroke={colors.green} strokeWidth={10} strokeLinecap="round" />
      )}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const a = angleFor(t);
        const inner = polar(a, R - 9);
        const outer = polar(a, R);
        return (
          <Line key={t} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={colors.inkMute} strokeWidth={2} />
        );
      })}
      {checked && (
        <Line
          x1={CX} y1={CY} x2={targetTip.x} y2={targetTip.y}
          stroke={colors.greenDeep} strokeWidth={2} strokeDasharray="4 3"
        />
      )}
      <Line
        x1={CX} y1={CY} x2={tip.x} y2={tip.y}
        stroke={needleColor} strokeWidth={4} strokeLinecap="round"
      />
      <Circle cx={CX} cy={CY} r={7} fill={needleColor} />
    </Svg>
  );
};

/**
 * The slider. Geometry from sim/knobGeometry.ts, gesture handling from the same
 * hard-won rules as the simulator's knob.
 */
const Dial: React.FC<{
  m: MeterSpec;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
  /** Raised for the length of the drag so the shell can hold its scroller still. */
  onGesture: (active: boolean) => void;
}> = ({ m, value, disabled, onChange, onGesture }) => {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  // pageX, not locationX: locationX re-bases onto whichever view took the touch,
  // and the thumb is a child of the track, so grabbing the thumb reported a
  // position between 0 and 32 and the value snapped to the minimum.
  const originX = useRef(0);
  const trackRef = useRef<View>(null);
  const latest = useRef(value);
  const lastTick = useRef(0);

  const step = meterStep(m);
  // Everything the responder reads goes through one ref. The responder is built
  // once, so reading these from its closure would freeze them at first render.
  // Written in an effect rather than during render, because a render React
  // discards must not leave a mutated ref behind.
  const live = useRef({ m, step, disabled, onChange, onGesture });
  useEffect(() => {
    live.current = { m, step, disabled, onChange, onGesture };
    latest.current = value;
  }, [m, step, disabled, onChange, onGesture, value]);

  const setFromX = useCallback((pageX: number) => {
    const w = widthRef.current;
    const { m: spec, step: tick, disabled: off, onChange: emit } = live.current;
    if (w <= 0 || off) return;
    const next = valueFor(fracFromPageX(pageX, originX.current, w, THUMB), spec.min, spec.max, tick);
    if (next === latest.current) return;
    latest.current = next;
    emit(next);
    // A detent under the finger, throttled so a fast sweep does not queue a
    // hundred of them and lag behind the gesture.
    const now = Date.now();
    if (now - lastTick.current > 45) {
      lastTick.current = now;
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  // Measure first, then apply the touch, because the page scrolls: an origin
  // captured at layout is wrong by the scroll distance by the time a finger
  // lands, and every reading would be offset by it.
  const measureThen = useCallback((then?: () => void) => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      originX.current = x;
      if (w > 0) {
        widthRef.current = w;
        setWidth(w);
      }
      then?.();
    });
  }, []);

  // Built once. Both callbacks it closes over are stable, and everything else it
  // needs it reads through `live`.
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.disabled,
      onMoveShouldSetPanResponder: () => !live.current.disabled,
      onStartShouldSetPanResponderCapture: () => !live.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !live.current.disabled,
      // Refusing termination is not enough on its own, but without it a vertical
      // drift mid-drag hands the touch away and the value sticks.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        live.current.onGesture(true);
        const { pageX } = e.nativeEvent;
        measureThen(() => setFromX(pageX));
      },
      onPanResponderMove: (e) => setFromX(e.nativeEvent.pageX),
      onPanResponderRelease: () => live.current.onGesture(false),
      onPanResponderTerminate: () => live.current.onGesture(false),
    }),
  ).current;

  const frac = meterFraction(value, m);
  const left = thumbLeft(frac, width, THUMB);

  return (
    <View
      ref={trackRef}
      style={d.track}
      onLayout={() => measureThen()}
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={`Reading in ${m.unit}`}
      accessibilityState={{ disabled }}
      accessibilityValue={{ min: m.min, max: m.max, now: value, text: `${fmtReading(value, m)} ${m.unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (disabled) return;
        const delta = e.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(valueFor(meterFraction(value + delta, m), m.min, m.max, step));
      }}
    >
      <View pointerEvents="none" style={d.groove} />
      {width > 0 && (
        <>
          <View pointerEvents="none" style={[d.fill, { width: left + THUMB / 2 }]} />
          <View pointerEvents="none" style={[d.thumb, { left }, disabled && d.thumbOff]}>
            <View style={d.thumbCore} />
          </View>
        </>
      )}
    </View>
  );
};

export const MeterStep: React.FC<StepProps & { step: StepPredictReading }> = ({
  step, checked, correct, onSubmit, onCanCheck, registerGrader, onDrawingChange,
}) => {
  const m = step.meter;
  const [value, setValue] = useState<number>(() => m.min);
  // The dial rests at the bottom of its scale until a finger moves it. Grading
  // an untouched dial would mark a learner wrong for a reading they never gave,
  // so Check stays off until they set one. Same gate as the web.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setValue(m.min);
    setTouched(false);
  }, [step, m.min]);

  const set = useCallback((v: number) => {
    setValue(v);
    setTouched(true);
  }, []);

  useEffect(() => {
    onCanCheck(touched);
    registerGrader(touched ? () => onSubmit(withinTolerance(value, m)) : null);
    return () => registerGrader(null);
  }, [touched, value, m, onCanCheck, registerGrader, onSubmit]);

  // The shell disables its ScrollView while this is true, so a drag with any
  // vertical component moves the needle instead of scrolling the page.
  const onGesture = useCallback((active: boolean) => onDrawingChange?.(active), [onDrawingChange]);
  useEffect(() => () => onDrawingChange?.(false), [onDrawingChange]);

  return (
    <View>
      <Text style={stepText.kicker}>DIAL IN THE READING</Text>
      <Text style={stepText.question}>{step.question}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      <View style={s.instrument}>
        <Gauge m={m} value={value} checked={checked} correct={correct} />

        <View style={s.readout}>
          <Text
            style={[
              s.reading,
              !touched && s.readingIdle,
              checked && (correct ? s.readingRight : s.readingWrong),
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {fmtReading(value, m)}
          </Text>
          <Text style={[s.unit, !touched && s.readingIdle]}>{m.unit}</Text>
        </View>

        <Dial m={m} value={value} disabled={checked} onChange={set} onGesture={onGesture} />

        <View style={s.scale}>
          <Text style={s.scaleEnd}>{fmtPlain(m.min)} {m.unit}</Text>
          <Text style={s.scaleEnd}>{fmtPlain(m.max)} {m.unit}</Text>
        </View>
      </View>

      {!checked && !touched && <Text style={stepText.hint}>Slide the dial to set your reading.</Text>}
      {checked && (
        <Text style={stepText.hint}>
          Target: {fmtReading(m.target, m)} {m.unit}. Anything within {fmtPlain(m.tolerance)} {m.unit} of it counts.
        </Text>
      )}
    </View>
  );
};

const d = StyleSheet.create({
  track: { height: 44, justifyContent: 'center', marginTop: space.sm },
  groove: {
    position: 'absolute', left: 0, right: 0, height: GROOVE, borderRadius: GROOVE / 2, ...curve,
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink,
  },
  fill: {
    position: 'absolute', left: 0, height: GROOVE, borderRadius: GROOVE / 2, ...curve,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink,
  },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', ...elevation.card,
  },
  thumbOff: { borderColor: colors.inkMute },
  thumbCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.goldDeep },
});

const s = StyleSheet.create({
  instrument: {
    marginTop: space.md, backgroundColor: colors.white, borderWidth: 2.5,
    borderColor: colors.line, borderRadius: radius.lg, ...curve,
    paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm,
    ...elevation.card,
  },
  readout: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  reading: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -1, ...tabular,
  },
  readingIdle: { color: colors.inkMute },
  readingRight: { color: colors.greenDeep },
  readingWrong: { color: colors.red },
  unit: { fontFamily: font.black, fontSize: type.heading, color: colors.inkSoft },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  scaleEnd: { fontFamily: font.bold, fontSize: type.meta, color: colors.inkMute, ...tabular },
});
