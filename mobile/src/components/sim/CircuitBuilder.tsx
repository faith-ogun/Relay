import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import {
  PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useScrollLock } from '../ScrollLock';
import { curve, font, radius, space, tabular, tracking, type, type Colors } from '../../theme/tokens';
import { motion, stagger } from '../../theme/motion';
import { PartGlyph } from './builderGlyphs';
import {
  EMPTY, PIN_HIT, SPECS,
  addPart, analyse, connect, disconnect, exampleCircuit, clampToCanvas,
  fmtAmps, fmtVolts, fmtWatts, formatValue,
  isReactive, movePart, netlistKey, pinCurrent, pinIndexOf, pinOwner, pinPoint, pinRef,
  readouts, removePart, rotatePart, setValue, startLive, advanceLive, toggleSwitch, valueLabel, wirePath, wiresAtPart,
  type Analysis, type CircuitSnapshot, type Part, type PartKind, type PartReadout, type Severity,
} from './circuitModel';
import type { SolveResult } from '../../sim/engine';
import { makeStyles, useColors } from '../../theme/theme';

// ── The free-form circuit builder ──
//
// A bench you build on with a thumb. Parts come from a palette, pins are joined
// by tapping one then the other, and every number on screen came out of the
// modified nodal analysis in src/sim/engine.ts. Nothing here is animated to look
// like physics: the LED's brightness IS its solved current, the dots crawling
// along a wire go the direction the current goes and at a speed set by how much
// of it there is.
//
// Why tapping and not dragging wires.
//
// Dragging a wire out of a pin is the obvious port of the mouse gesture and it
// is the wrong one. It asks a finger to acquire a small target, stay on a path
// it cannot see under its own hand, and release on a second small target, all
// while an ancestor scroll view is trying to take the gesture away. Tapping
// splits that into two independent, forgiving acts, each with a 44pt target and
// each undoable on its own. Drag is reserved for the one thing it is good at:
// moving a part that already exists, where precision does not matter because
// the whole footprint is the handle.
//
// The layout rule that makes it work: no two touch targets of one part overlap,
// which is asserted for every part and both orientations in
// scripts/check-circuit-builder.mjs.

const HISTORY_LIMIT = 40;
const DASH = 7;
const GAP = 11;
const PERIOD = DASH + GAP;
/** Below 20 uA nothing is meaningfully flowing, and a crawling wire would be a lie. */
const FLOW_FLOOR = 2e-5;

// ── Chrome icons, drawn rather than borrowed ──

const Undo: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M4 9.5h9.5a5.5 5.5 0 0 1 0 11H9" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    <Path d="M8 4.5 3.4 9.5 8 14.2" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Bin: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" />
    <Path d="M6.5 7.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-11.5" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Turn: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    <Path d="M17.6 2.6v4.2h-4.2" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Cross: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
  </Svg>
);

const severityTint = (colors: Colors): Record<Severity, string> => ({
  danger: colors.red, warn: colors.gold, note: colors.blue, ok: colors.green,
});

/** The verdict badge. Four shapes, so severity is legible without relying on colour alone. */
const VerdictMark: React.FC<{ severity: Severity }> = ({ severity }) => {
  const tint = severityTint(useColors())[severity];
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {severity === 'ok' && (
        <Path d="M5 12.6 10 17.5 19.2 7" fill="none" stroke={tint} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {severity === 'danger' && (
        <Path d="M13.5 2.5 5 13.4h5.2L9.4 21.5 18.6 9.8h-5.4z" fill={tint} stroke={tint} strokeWidth={1.6} strokeLinejoin="round" />
      )}
      {severity === 'warn' && (
        <>
          <Path d="M12 4.5v9.2" fill="none" stroke={tint} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={12} cy={18.6} r={1.9} fill={tint} />
        </>
      )}
      {severity === 'note' && (
        <>
          <Circle cx={12} cy={5.6} r={1.9} fill={tint} />
          <Path d="M12 10.2v9.3" fill="none" stroke={tint} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
};

// ── Wire ──

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * A wire with the current drawn on it.
 *
 * The gold dashes crawl from the pin the current leaves toward the pin it
 * enters, at a speed taken from the solved magnitude. It is the only animation
 * on the canvas that runs continuously, and it earns that by carrying two facts
 * a static line cannot: which way round the loop goes, and roughly how hard.
 */
const FlowWire: React.FC<{ d: string; amps: number; dim: boolean }> = ({ d, amps, dim }) => {
  const colors = useColors();
  const phase = useSharedValue(0);
  const mag = Math.abs(amps);
  const moving = mag > FLOW_FLOOR && !dim;

  useEffect(() => {
    if (!moving) { cancelAnimation(phase); phase.value = 0; return; }
    // Log scale. A learner lives between about 1 and 100 mA, and a linear speed
    // makes everything under 20 mA look identically slow.
    const secs = Math.min(1.9, Math.max(0.3, 1.15 - 0.32 * Math.log10(mag * 1000)));
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(amps > 0 ? -PERIOD : PERIOD, { duration: secs * 1000, easing: Easing.linear }),
      -1, false,
    );
    return () => { cancelAnimation(phase); };
  }, [moving, amps, phase]);

  const flow = useAnimatedProps(() => ({ strokeDashoffset: phase.value }));

  return (
    <G>
      <Path
        d={d} fill="none" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"
        stroke={dim ? colors.inkFaint : colors.ink}
      />
      {moving && (
        <AnimatedPath
          d={d} fill="none" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"
          stroke={colors.gold} strokeDasharray={`${DASH} ${GAP}`} animatedProps={flow}
        />
      )}
    </G>
  );
};

// ── Pin ──

const PinPad: React.FC<{
  cx: number; cy: number;
  armed: boolean; wired: boolean;
  label: string; hint: string;
  onPress: () => void;
}> = ({ cx, cy, armed, wired, label, hint, onPress }) => {
  const p = useP();
  const press = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!armed) { cancelAnimation(pulse); pulse.value = 0; return; }
    // A single expanding ring, once a second. The armed pin is the only thing on
    // screen waiting for an answer, so it is the only thing allowed to move.
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) }), -1, false);
    return () => { cancelAnimation(pulse); };
  }, [armed, pulse]);

  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.18 }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.9,
    transform: [{ scale: 0.55 + pulse.value * 1.5 }],
  }));

  return (
    <Pressable
      style={[p.target, { left: cx - PIN_HIT / 2, top: cy - PIN_HIT / 2 }]}
      onPressIn={() => { press.value = withSpring(1, motion.press); }}
      onPressOut={() => { press.value = withSpring(0, motion.release); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: armed }}
    >
      {armed && <Animated.View pointerEvents="none" style={[p.pulse, ring]} />}
      <Animated.View style={[p.dot, wired && p.dotWired, armed && p.dotArmed, dot]} />
    </Pressable>
  );
};

const useP = makeStyles((colors) => ({
  unwired: {
    position: 'absolute', top: -9, alignSelf: 'center',
    backgroundColor: colors.red, borderRadius: 999, ...curve,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  unwiredText: { fontFamily: font.black, fontSize: 8, letterSpacing: 1, color: colors.white },
  target: { position: 'absolute', width: PIN_HIT, height: PIN_HIT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 19, height: 19, borderRadius: 10,
    borderWidth: 2.6, borderColor: colors.ink, backgroundColor: colors.surface,
  },
  dotWired: { backgroundColor: colors.ink },
  dotArmed: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, borderColor: colors.ink },
  pulse: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: colors.goldDeep },
}));

// ── Part touch layer ──

interface PartLayerProps {
  part: Part;
  index: number;
  selected: boolean;
  armedPin: string | null;
  isWired: (ref: string) => boolean;
  voltageAt: (ref: string) => string;
  onPin: (ref: string) => void;
  onSelect: () => void;
  onDragStart: () => void;
  onDrag: (x: number, y: number) => void;
  onDragEnd: () => void;
}

/**
 * One part's touch surface: a container over the part's whole footprint that
 * handles drag, with a pin target per pin sitting inside it.
 *
 * The nesting is the trick. Pins are children, so a TAP anywhere on a pin
 * belongs to the pin. The container claims the gesture back in the capture
 * phase once the finger has actually travelled, so a DRAG that began on a pin
 * still moves the part. Without that, only the narrow strip between the pins
 * would be draggable and the part would feel nailed down.
 */
const PartLayer: React.FC<PartLayerProps> = ({
  part, index, selected, armedPin, isWired, voltageAt,
  onPin, onSelect, onDragStart, onDrag, onDragEnd,
}) => {
  const p = useP();
  const live = useRef({ part, onSelect, onDrag, onDragStart, onDragEnd });
  live.current = { part, onSelect, onDrag, onDragStart, onDragEnd };
  const origin = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const captured = useRef(false);

  const enter = useSharedValue(0);
  // Captured on the first render and never read again. `index` comes from an
  // array that is re-sorted whenever the selection changes, so depending on it
  // would replay the arrival animation every time the part was tapped.
  const delay = useRef(stagger(index, 55, 5)).current;
  useEffect(() => {
    // Parts arrive rather than appear. Staggered on first mount so the example
    // circuit assembles itself, then immediate for anything placed by hand.
    enter.value = withDelay(delay, withSpring(1, motion.enter));
  }, [enter, delay]);
  const arrival = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.82 + enter.value * 0.18 }],
  }));

  const pan = useRef(
    PanResponder.create({
      // A tap on the bare body selects. Pins are children and win the start
      // phase for themselves.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        const far = Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4;
        if (far) captured.current = true;
        return far;
      },
      // The surrounding scroll view asks for the responder the moment a drag
      // turns vertical. Refusing keeps the part under the finger, the same
      // negotiation the drawing canvas has to make.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        origin.current = { x: live.current.part.x, y: live.current.part.y };
        dragging.current = captured.current;
        captured.current = false;
        if (dragging.current) live.current.onDragStart();
      },
      onPanResponderMove: (_e, g) => {
        if (!dragging.current && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4)) {
          dragging.current = true;
          live.current.onDragStart();
        }
        if (dragging.current) live.current.onDrag(origin.current.x + g.dx, origin.current.y + g.dy);
      },
      onPanResponderRelease: () => {
        if (dragging.current) live.current.onDragEnd(); else live.current.onSelect();
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        if (dragging.current) live.current.onDragEnd();
        dragging.current = false;
      },
    }),
  ).current;

  const spec = SPECS[part.kind];
  const half = PIN_HIT / 2;
  const pins = spec.pins.map((_, i) => pinPoint(part, i));
  const minX = Math.min(part.x, ...pins.map((q) => q.x)) - half;
  const minY = Math.min(part.y, ...pins.map((q) => q.y)) - half;
  const maxX = Math.max(part.x, ...pins.map((q) => q.x)) + half;
  const maxY = Math.max(part.y, ...pins.map((q) => q.y)) + half;

  return (
    <Animated.View
      style={[{ position: 'absolute', left: minX, top: minY, width: maxX - minX, height: maxY - minY }, arrival]}
      {...pan.panHandlers}
      accessibilityLabel={`${part.id}, ${spec.label}`}
      accessibilityHint="Drag to move it. Tap to open its settings."
      accessibilityState={{ selected }}
    >
      {/* Nothing wired to it yet. A new part arrives unconnected, which is
          correct and completely invisible: the learner adds a second LED, it
          does not light, and nothing on the canvas says why. The ring is the
          missing sentence. */}
      {spec.pins.every((_, i) => !isWired(pinRef(part.id, i))) && (
        <View style={p.unwired} pointerEvents="none">
          <Text style={p.unwiredText}>NOT WIRED</Text>
        </View>
      )}
      {spec.pins.map((name, i) => {
        const ref = pinRef(part.id, i);
        return (
          <PinPad
            key={ref}
            cx={pins[i].x - minX}
            cy={pins[i].y - minY}
            armed={armedPin === ref}
            wired={isWired(ref)}
            label={`${part.id} ${name}, ${voltageAt(ref)}`}
            hint={armedPin && armedPin !== ref
              ? `Joins ${pinOwner(armedPin)} to ${part.id}`
              : 'Tap, then tap another pin to wire them together'}
            onPress={() => onPin(ref)}
          />
        );
      })}
    </Animated.View>
  );
};

// ── Small chrome pieces ──

const ToolButton: React.FC<{
  label: string; onPress: () => void; disabled?: boolean; tone?: 'ink' | 'red';
  icon: (color: string) => React.ReactNode;
}> = ({ label, onPress, disabled, tone = 'ink', icon }) => {
  const colors = useColors();
  const t = useT();
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 2 }] }));
  const color = disabled ? colors.inkMute : tone === 'red' ? colors.red : colors.inkSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { press.value = withSpring(1, motion.press); }}
      onPressOut={() => { press.value = withSpring(0, motion.release); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
    >
      <Animated.View style={[t.tool, disabled && t.toolOff, style]}>
        {icon(color)}
        <Text style={[t.toolLabel, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

const PaletteTile: React.FC<{ kind: PartKind; onPress: () => void }> = ({ kind, onPress }) => {
  const colors = useColors();
  const t = useT();
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.05 }, { translateY: press.value * 3 }],
  }));
  const spec = SPECS[kind];
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { press.value = withSpring(1, motion.press); }}
      onPressOut={() => { press.value = withSpring(0, motion.release); }}
      accessibilityRole="button"
      accessibilityLabel={`Add a ${spec.label}`}
      accessibilityHint={spec.blurb}
    >
      <Animated.View style={[t.tile, style]}>
        <Svg width={56} height={56} viewBox="-46 -46 92 92">
          <PartGlyph kind={kind} stroke={colors.ink} brightness={0.55} closed />
        </Svg>
        <Text style={t.tileLabel} numberOfLines={1}>{spec.label}</Text>
      </Animated.View>
    </Pressable>
  );
};

const ValuePill: React.FC<{ text: string; on: boolean; onPress: () => void; label: string }> = ({ text, on, onPress, label }) => {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [t.pill, on && t.pillOn, pressed && !on && t.pillPressed]}
    >
      <Text style={[t.pillText, on && t.pillTextOn]}>{text}</Text>
    </Pressable>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const t = useT();
  return (
    <View style={t.stat}>
      <Text style={t.statLabel}>{label}</Text>
      <Text style={t.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
};

const ReadingRow: React.FC<{ read: PartReadout; selected: boolean; onPress: () => void }> = ({ read, selected, onPress }) => {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${read.label}, ${SPECS[read.kind].label}${read.valueText ? `, ${read.valueText}` : ''}, ${read.amps === null ? 'no reading' : fmtAmps(read.amps)}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [t.row, selected && t.rowOn, pressed && t.rowPressed]}
    >
      <View style={[t.refdes, selected && t.refdesOn]}>
        <Text style={[t.refdesText, selected && t.refdesTextOn]} numberOfLines={1}>{read.label}</Text>
      </View>
      <View style={t.rowBody}>
        <Text style={t.rowTitle} numberOfLines={1}>
          {SPECS[read.kind].label}{read.valueText ? `  ${read.valueText}` : ''}
        </Text>
        {!!read.state && <Text style={t.rowState} numberOfLines={1}>{read.state}</Text>}
      </View>
      <Text style={[t.rowAmps, read.amps === null && t.rowAmpsUnknown]} numberOfLines={1}>
        {read.amps === null ? 'no reading' : fmtAmps(read.amps)}
      </Text>
    </Pressable>
  );
};

// ── The builder ──

export interface CircuitBuilderHandle {
  /** Step back one edit. */
  undo(): void;
  /** Take everything off the board. */
  clear(): void;
  /** Replace the board with a given circuit. */
  load(snapshot: CircuitSnapshot): void;
  getSnapshot(): CircuitSnapshot;
}

export interface CircuitBuilderProps {
  /** The circuit to open on. Defaults to a working 5 V, 220 ohm, LED loop. */
  initial?: CircuitSnapshot;
  /** Height of the drawing surface in points. Default 420, which fits nine parts. */
  canvasHeight?: number;
  /** Which parts the palette offers, in order. Defaults to all eight. */
  palette?: PartKind[];
  /** Fires on every edit with the circuit and its solved analysis. */
  onChange?: (snapshot: CircuitSnapshot, analysis: Analysis) => void;
  style?: StyleProp<ViewStyle>;
}

export const CircuitBuilder = forwardRef<CircuitBuilderHandle, CircuitBuilderProps>(function CircuitBuilder(
  { initial, canvasHeight = 420, palette, onChange, style },
  ref,
) {
  const colors = useColors();
  const t = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [snap, setSnap] = useState<CircuitSnapshot>(initial ?? EMPTY);
  const [past, setPast] = useState<CircuitSnapshot[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [live, setLive] = useState<SolveResult | null>(null);

  const snapRef = useRef(snap); snapRef.current = snap;
  const pastRef = useRef(past); pastRef.current = past;
  const sizeRef = useRef(size); sizeRef.current = size;
  const seeded = useRef(false);

  const analysis = useMemo(() => analyse(snap), [snap]);
  const analysisRef = useRef(analysis); analysisRef.current = analysis;
  const netRef = useRef(analysis.netlist); netRef.current = analysis.netlist;

  // ── size, seeding, clamping ──

  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  useEffect(() => {
    if (!size) return;
    if (!seeded.current) {
      seeded.current = true;
      if (!initial) { setSnap(exampleCircuit(size.w, size.h)); return; }
    }
    // A rotation changes the canvas under a circuit that is already on it.
    // Pulling every part back inside beats letting half of them become
    // untappable off the edge.
    setSnap((s) => {
      const parts = s.parts.map((q) => {
        const c = clampToCanvas(q, size.w, size.h);
        return c.x === q.x && c.y === q.y ? q : c;
      });
      return parts.some((q, i) => q !== s.parts[i]) ? { parts, connections: s.connections } : s;
    });
  }, [size, initial]);

  // ── live transient ──
  //
  // Only runs when there is a capacitor, because only then does DC leave
  // something unsaid. Each tick advances the engine by the wall clock that
  // actually elapsed, so an RC charges in real seconds.

  const netKey = useMemo(() => netlistKey(analysis.netlist), [analysis.netlist]);
  useEffect(() => {
    if (!isReactive(netRef.current) || !analysisRef.current.solved) { setLive(null); return; }
    const state = startLive(netRef.current);
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;
      setLive(advanceLive(netRef.current, state, elapsed));
    }, 50);
    return () => { clearInterval(timer); setLive(null); };
  }, [netKey]);

  // ── edits ──

  const push = useCallback(() => {
    setPast((h) => [...h.slice(-(HISTORY_LIMIT - 1)), snapRef.current]);
  }, []);

  const commit = useCallback((next: CircuitSnapshot | null) => {
    if (!next) return;
    push();
    setSnap(next);
  }, [push]);

  const undo = useCallback(() => {
    const h = pastRef.current;
    if (!h.length) return;
    setSnap(h[h.length - 1]);
    setPast(h.slice(0, -1));
    setArmed(null);
    setSelected(null);
    setFlash(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const clearAll = useCallback(() => {
    commit(EMPTY);
    setArmed(null);
    setSelected(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [commit]);

  const loadExample = useCallback(() => {
    const s = sizeRef.current;
    if (!s) return;
    commit(exampleCircuit(s.w, s.h));
    setSelected(null);
    setArmed(null);
  }, [commit]);

  const add = useCallback((kind: PartKind) => {
    const s = sizeRef.current;
    if (!s) return;
    const next = addPart(snapRef.current, kind, s.w, s.h);
    commit(next.snap);
    setSelected(next.id);
    setArmed(null);
    setFlash(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [commit]);

  const onPin = useCallback((refId: string) => {
    setSelected(pinOwner(refId));
    setFlash(null);
    if (!armed) {
      setArmed(refId);
      void Haptics.selectionAsync();
      return;
    }
    if (armed === refId) { setArmed(null); return; }
    const next = connect(snapRef.current, armed, refId);
    setArmed(null);
    if (!next) {
      setFlash('Those two pins are already on the same wire.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    commit(next);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [armed, commit]);

  const unwire = useCallback((connectionId: string) => {
    commit(disconnect(snapRef.current, connectionId));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [commit]);

  const remove = useCallback((id: string) => {
    commit(removePart(snapRef.current, id));
    setSelected(null);
    setArmed(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [commit]);

  // Refusing the responder is not enough on iOS: UIScrollView's pan recogniser
  // competes below the JS responder system, so dragging a part scrolled the
  // page AND moved the part at the same time. The scroller stands down for the
  // duration of a drag instead.
  const { setLocked } = useScrollLock();

  const onDragStart = useCallback((id: string) => {
    setLocked(true);
    push();
    setSelected(id);
    setArmed(null);
  }, [push, setLocked]);

  const onDrag = useCallback((id: string, x: number, y: number) => {
    const s = sizeRef.current;
    if (!s) return;
    // Free while the finger is down, snapped when it lifts. Snapping live makes
    // the part stutter under the thumb; snapping on release still guarantees
    // two parts can share an axis exactly.
    setSnap((cur) => movePart(cur, id, x, y, s.w, s.h, false));
  }, []);

  const onDragEnd = useCallback((id: string) => {
    setLocked(false);
    const s = sizeRef.current;
    if (!s) return;
    setSnap((cur) => {
      const part = cur.parts.find((q) => q.id === id);
      return part ? movePart(cur, id, part.x, part.y, s.w, s.h, true) : cur;
    });
  }, [setLocked]);

  useImperativeHandle(ref, () => ({
    undo,
    clear: clearAll,
    load: (next: CircuitSnapshot) => {
      const s = sizeRef.current;
      commit(s ? { parts: next.parts.map((q) => clampToCanvas(q, s.w, s.h)), connections: next.connections } : next);
      setSelected(null);
      setArmed(null);
    },
    getSnapshot: () => snapRef.current,
  }), [undo, clearAll, commit]);

  const changeRef = useRef(onChange); changeRef.current = onChange;
  useEffect(() => { changeRef.current?.(snap, analysis); }, [snap, analysis]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2800);
    return () => clearTimeout(timer);
  }, [flash]);

  // ── derived view state ──

  const frame = live ?? analysis.dc;
  const shown = useMemo(
    () => (live ? readouts(snap, analysis.build, live) : analysis.readouts),
    [live, snap, analysis],
  );
  const readById = useMemo(() => new Map(shown.map((r) => [r.id, r])), [shown]);
  const partById = useMemo(() => new Map(snap.parts.map((q) => [q.id, q])), [snap.parts]);
  const wiredPins = useMemo(() => {
    const set = new Set<string>();
    for (const c of snap.connections) { set.add(c.a); set.add(c.b); }
    return set;
  }, [snap.connections]);

  const hasSource = snap.parts.some((q) => q.kind === 'battery');
  const selectedPart = selected ? partById.get(selected) : undefined;
  const selectedRead = selected ? readById.get(selected) : undefined;

  const voltageAt = useCallback((refId: string) => {
    const node = analysis.build.nodeOf[refId];
    if (node === undefined || !frame.ok) return 'no reading';
    return fmtVolts(frame.V[node] ?? 0);
  }, [analysis.build.nodeOf, frame]);

  const armedPinName = armed
    ? SPECS[partById.get(pinOwner(armed))?.kind ?? 'resistor'].pins[pinIndexOf(armed)] ?? 'pin'
    : '';

  // The coach line is the verdict most of the time, but a connection in
  // progress outranks it: whatever is wrong with the circuit can wait until the
  // learner has finished the act they are halfway through.
  const coach: { severity: Severity; title: string; detail: string } = armed
    ? {
      severity: 'note',
      title: 'Now tap the pin you want to join it to.',
      detail: `${pinOwner(armed)} ${armedPinName} is armed. Tap it again to let go.`,
    }
    : flash
      ? { severity: 'warn', title: flash, detail: '' }
      : analysis.verdict;

  const paletteKinds = palette ?? (['battery', 'resistor', 'led', 'capacitor', 'switch', 'npn', 'diode', 'ground'] as PartKind[]);

  // Ghost of the circuit the empty board is offering to build. Better than a
  // dashed rectangle: it shows what the thing is for.
  const ghost = useMemo(
    () => (size && snap.parts.length === 0 ? exampleCircuit(size.w, size.h) : null),
    [size, snap.parts.length],
  );

  const grid = useMemo(() => {
    if (!size) return null;
    const dots: React.ReactElement[] = [];
    for (let row = 0; row * 44 + 22 < size.h; row++) {
      for (let col = 0; col * 44 + 22 < size.w; col++) {
        dots.push(<Circle key={`g${row}-${col}`} cx={col * 44 + 22} cy={row * 44 + 22} r={1.2} fill={colors.line} />);
      }
    }
    return dots;
  }, [size]);

  const renderWires = (source: CircuitSnapshot, ghosted: boolean) =>
    source.connections.map((c) => {
      const a = source.parts.find((q) => q.id === pinOwner(c.a));
      const b = source.parts.find((q) => q.id === pinOwner(c.b));
      if (!a || !b) return null;
      const ai = pinIndexOf(c.a);
      const bi = pinIndexOf(c.b);
      const d = wirePath(a, ai, b, bi)
        .map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x} ${q.y}`)
        .join(' ');
      if (ghosted) {
        return <Path key={c.id} d={d} fill="none" stroke={colors.ink} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />;
      }
      // Current out of the first pin and into the wire. A ground symbol carries
      // no current of its own, so read the other end instead.
      const amps = a.kind === 'ground'
        ? pinCurrent(b, bi, frame.I)
        : -pinCurrent(a, ai, frame.I);
      return <FlowWire key={c.id} d={d} amps={amps} dim={!frame.ok} />;
    });

  const renderGlyphs = (source: CircuitSnapshot, ghosted: boolean) =>
    source.parts.map((q) => {
      const read = ghosted ? undefined : readById.get(q.id);
      const spec = SPECS[q.kind];
      const turned = q.vertical && spec.rotatable;
      const ma = (read?.amps ?? 0) * 1000;
      const labelRight = size ? q.x < size.w - 78 : true;
      const labelAbove = q.y > 62;
      const value = q.kind === 'switch' ? (q.closed ? 'closed' : 'open') : read?.valueText ?? '';
      return (
        <G key={q.id} x={q.x} y={q.y}>
          <G rotation={turned ? 90 : 0}>
            <PartGlyph
              kind={q.kind}
              stroke={!ghosted && selected === q.id ? colors.blue : colors.ink}
              brightness={read?.brightness ?? 0}
              over={q.kind === 'led' && ma > 25}
              closed={q.closed}
            />
          </G>
          {!ghosted && (
            <>
              <SvgText
                x={turned ? (labelRight ? 24 : -24) : 0}
                y={turned ? -2 : labelAbove ? -32 : 32}
                fontSize={11} fontWeight="800"
                fill={selected === q.id ? colors.blueDeep : colors.inkSoft}
                textAnchor={turned ? (labelRight ? 'start' : 'end') : 'middle'}
              >
                {q.id}
              </SvgText>
              {!!value && (
                <SvgText
                  x={turned ? (labelRight ? 24 : -24) : 0}
                  y={turned ? 11 : labelAbove ? -21 : 43}
                  fontSize={10} fontWeight="700" fill={colors.inkMute}
                  textAnchor={turned ? (labelRight ? 'start' : 'end') : 'middle'}
                >
                  {value}
                </SvgText>
              )}
            </>
          )}
        </G>
      );
    });

  return (
    <View style={style}>
      {/* toolbar */}
      <View style={t.bar}>
        <ToolButton label="Undo" onPress={undo} disabled={past.length === 0} icon={(c) => <Undo color={c} />} />
        <ToolButton label="Clear" onPress={clearAll} disabled={snap.parts.length === 0} tone="red" icon={(c) => <Bin color={c} />} />
        <View style={t.spacer} />
        <Text style={t.tally}>
          {snap.parts.length} {snap.parts.length === 1 ? 'part' : 'parts'} · {snap.connections.length} {snap.connections.length === 1 ? 'wire' : 'wires'}
        </Text>
      </View>

      {/* canvas */}
      <View
        style={[t.canvas, { height: canvasHeight }]}
        onLayout={onCanvasLayout}
      >
        {size && (
          <>
            <Svg width={size.w} height={size.h} pointerEvents="none">
              {/* A faint dot grid, so the board reads as a workspace and the
                  snapping has something visible to snap to. */}
              {grid}

              {ghost ? (
                <G opacity={0.15}>
                  {renderWires(ghost, true)}
                  {renderGlyphs(ghost, true)}
                </G>
              ) : (
                <>
                  {renderWires(snap, false)}
                  {renderGlyphs(snap, false)}

                  {/* Node voltages, at real junctions only. A chip on every
                      isolated pin would be noise, and with no source they would
                      all read zero, which teaches nothing. */}
                  {hasSource && frame.ok && analysis.build.nodes
                    .filter((n) => n.pins.length >= 2 || n.id === 0)
                    .map((n) => {
                      const pts = n.pins
                        .map((r) => { const q = partById.get(pinOwner(r)); return q ? pinPoint(q, pinIndexOf(r)) : null; })
                        .filter((q): q is { x: number; y: number } => q !== null);
                      if (!pts.length) return null;
                      const cx = Math.min(size.w - 30, Math.max(30, pts.reduce((s2, q) => s2 + q.x, 0) / pts.length));
                      const cy = Math.min(size.h - 8, Math.max(20, pts.reduce((s2, q) => s2 + q.y, 0) / pts.length - 24));
                      const volts = frame.V[n.id] ?? 0;
                      return (
                        <G key={`n${n.id}`}>
                          <Rect
                            x={cx - 27} y={cy - 10} width={54} height={19} rx={9}
                            fill={colors.surface} stroke={n.id === 0 ? colors.inkFaint : colors.gold} strokeWidth={1.6}
                          />
                          <SvgText
                            x={cx} y={cy + 4} fontSize={10.5} fontWeight="800" textAnchor="middle"
                            fill={n.id === 0 ? colors.inkMute : colors.goldText}
                          >
                            {n.id === 0 ? '0 V GND' : fmtVolts(volts)}
                          </SvgText>
                        </G>
                      );
                    })}
                </>
              )}
            </Svg>

            {/* Touch layer. Tapping bare board lets go of whatever was armed. */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => { setArmed(null); setSelected(null); }}
              accessible={false}
              importantForAccessibility="no"
            />
            {[...snap.parts]
              // The selected part renders last so it is on top, which is what
              // makes two overlapping parts separable at all.
              .sort((a, b) => (a.id === selected ? 1 : 0) - (b.id === selected ? 1 : 0))
              .map((q, i) => (
                <PartLayer
                  key={q.id}
                  part={q}
                  index={i}
                  selected={selected === q.id}
                  armedPin={armed}
                  isWired={(r) => wiredPins.has(r)}
                  voltageAt={voltageAt}
                  onPin={onPin}
                  onSelect={() => { setSelected(q.id); setArmed(null); }}
                  onDragStart={() => onDragStart(q.id)}
                  onDrag={(x, y) => onDrag(q.id, x, y)}
                  onDragEnd={() => onDragEnd(q.id)}
                />
              ))}

            {ghost && (
              <View style={t.empty} pointerEvents="box-none">
                <Text style={t.emptyTitle}>An empty board.</Text>
                <Text style={t.emptyBody}>
                  Tap a part below to drop it here, then tap one pin and another to wire them together.
                </Text>
                <Pressable
                  onPress={loadExample}
                  accessibilityRole="button"
                  accessibilityLabel="Start with the example circuit"
                  style={({ pressed }) => [t.emptyCta, pressed && t.emptyCtaPressed]}
                >
                  <Text style={t.emptyCtaText}>Start with this one</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>

      {/* the one true thing about this circuit */}
      <View
        style={t.coach}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${coach.title} ${coach.detail}`}
      >
        <View style={[t.coachMark, { borderColor: severityTint(colors)[coach.severity] }]}>
          <VerdictMark severity={coach.severity} />
        </View>
        <View style={t.coachBody}>
          <Text style={t.coachTitle}>{coach.title}</Text>
          {!!coach.detail && <Text style={t.coachDetail}>{coach.detail}</Text>}
        </View>
      </View>

      {/* palette */}
      <Text style={t.section}>PARTS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={t.palette}
        accessibilityLabel="Parts you can add"
      >
        {paletteKinds.map((kind) => <PaletteTile key={kind} kind={kind} onPress={() => add(kind)} />)}
      </ScrollView>

      {/* inspector */}
      {selectedPart && selectedRead && (
        <View style={t.inspector}>
          <View style={t.inspectorHead}>
            <View style={t.refdesLarge}>
              <Text style={t.refdesLargeText}>{selectedPart.id}</Text>
            </View>
            <Text style={t.inspectorTitle} numberOfLines={1}>{SPECS[selectedPart.kind].label}</Text>
            <View style={t.spacer} />
            <ToolButton label="Delete" tone="red" onPress={() => remove(selectedPart.id)} icon={(c) => <Bin color={c} />} />
          </View>

          {SPECS[selectedPart.kind].values.length > 0 && (
            <>
              <Text style={t.fieldLabel}>{valueLabel(selectedPart.kind).toUpperCase()}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.pills}>
                {SPECS[selectedPart.kind].values.map((v) => (
                  <ValuePill
                    key={v}
                    text={formatValue(selectedPart.kind, v)}
                    on={selectedPart.value === v}
                    label={`Set ${selectedPart.id} to ${formatValue(selectedPart.kind, v)}`}
                    onPress={() => { commit(setValue(snapRef.current, selectedPart.id, v)); void Haptics.selectionAsync(); }}
                  />
                ))}
              </ScrollView>
            </>
          )}

          <View style={t.actions}>
            {selectedPart.kind === 'switch' && (
              <Pressable
                onPress={() => { commit(toggleSwitch(snapRef.current, selectedPart.id)); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                accessibilityRole="switch"
                accessibilityLabel={`${selectedPart.id} is ${selectedPart.closed ? 'closed' : 'open'}`}
                accessibilityState={{ checked: !!selectedPart.closed }}
                style={({ pressed }) => [t.toggle, selectedPart.closed && t.toggleOn, pressed && t.togglePressed]}
              >
                <Text style={[t.toggleText, selectedPart.closed && t.toggleTextOn]}>
                  {selectedPart.closed ? 'Closed' : 'Open'}
                </Text>
                <View style={[t.toggleTrack, selectedPart.closed && t.toggleTrackOn]}>
                  <View style={[t.toggleKnob, selectedPart.closed && t.toggleKnobOn]} />
                </View>
              </Pressable>
            )}
            {SPECS[selectedPart.kind].rotatable && (
              <ToolButton
                label={selectedPart.vertical ? 'Lay flat' : 'Stand up'}
                onPress={() => {
                  const s = sizeRef.current;
                  if (s) commit(rotatePart(snapRef.current, selectedPart.id, s.w, s.h));
                }}
                icon={(c) => <Turn color={c} />}
              />
            )}
          </View>

          <View style={t.stats}>
            <Stat label="ACROSS" value={selectedRead.volts === null ? 'no reading' : fmtVolts(selectedRead.volts)} />
            <Stat label="THROUGH" value={selectedRead.amps === null ? 'no reading' : fmtAmps(selectedRead.amps)} />
            <Stat label="POWER" value={selectedRead.watts === null ? 'no reading' : fmtWatts(selectedRead.watts)} />
          </View>

          {!!selectedRead.state && <Text style={t.inspectorState}>{selectedRead.state}.</Text>}
          {selectedRead.pinsWired < selectedRead.pinCount && (
            <Text style={t.inspectorWarn}>
              {selectedRead.pinsWired === 0
                ? 'No pin is wired yet. Tap one, then tap the pin you want it joined to.'
                : `Wired at ${selectedRead.pinsWired} of ${selectedRead.pinCount} pins.`}
            </Text>
          )}

          {/* Wiring the wrong two pins is the most common slip there is, and
              undo only reaches it while it is still the last thing you did.
              Every wire on the selected part gets its own way off the board. */}
          {(() => {
            const wires = wiresAtPart(snap, selectedPart.id);
            if (!wires.length) return null;
            return (
              <>
                <Text style={t.fieldLabel}>WIRES</Text>
                <View style={t.wires}>
                  {wires.map((c) => {
                    const mine = pinOwner(c.a) === selectedPart.id ? c.a : c.b;
                    const other = mine === c.a ? c.b : c.a;
                    const otherPart = partById.get(pinOwner(other));
                    const myPin = SPECS[selectedPart.kind].pins[pinIndexOf(mine)] ?? 'pin';
                    const theirPin = otherPart ? SPECS[otherPart.kind].pins[pinIndexOf(other)] ?? 'pin' : 'pin';
                    const text = `${myPin} to ${pinOwner(other)} ${theirPin}`;
                    return (
                      <View key={c.id} style={t.wireRow}>
                        <Text style={t.wireText} numberOfLines={1}>{text}</Text>
                        <Pressable
                          onPress={() => unwire(c.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove the wire from ${selectedPart.id} ${myPin} to ${pinOwner(other)} ${theirPin}`}
                          style={({ pressed }) => [t.unwire, pressed && t.unwirePressed]}
                        >
                          <Cross color={colors.red} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            );
          })()}
        </View>
      )}

      {/* readings */}
      {shown.length > 0 && (
        <>
          <Text style={t.section}>
            {live ? 'LIVE READINGS' : 'READINGS'}
          </Text>
          <View style={t.readings}>
            {shown.map((read) => (
              <ReadingRow
                key={read.id}
                read={read}
                selected={selected === read.id}
                onPress={() => { setSelected(read.id); setArmed(null); }}
              />
            ))}
          </View>
          {!!live && (
            <Text style={t.liveNote}>
              A capacitor cannot be solved standing still, so the engine is stepping this circuit
              through real time. The numbers move because the charge does.
            </Text>
          )}
        </>
      )}
    </View>
  );
});

const useT = makeStyles((colors, th) => ({
  spacer: { flex: 1 },

  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 44, paddingHorizontal: 14,
    borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface,
  },
  toolOff: { backgroundColor: colors.cream, borderColor: colors.inkFaint },
  toolLabel: { fontFamily: font.extrabold, fontSize: type.small, letterSpacing: tracking.small },
  tally: {
    fontFamily: font.bold, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute, ...tabular,
  },

  canvas: {
    backgroundColor: colors.surface,
    borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve,
    overflow: 'hidden',
    ...th.elevation.card,
  },

  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl,
  },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, letterSpacing: tracking.heading },
  emptyBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 19, marginTop: 6, maxWidth: 250,
  },
  emptyCta: {
    marginTop: space.md, height: 44, paddingHorizontal: 20, justifyContent: 'center',
    borderRadius: radius.sm, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.gold,
    ...th.innerLight,
  },
  emptyCtaPressed: { backgroundColor: colors.goldDeep },
  emptyCtaText: { fontFamily: font.extrabold, fontSize: type.body, color: colors.onGold },

  coach: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    marginTop: space.sm, padding: 14,
    borderRadius: radius.md, ...curve,
    backgroundColor: colors.slab,
  },
  coachMark: {
    width: 36, height: 36, borderRadius: 12, ...curve,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  coachBody: { flex: 1, paddingTop: 1 },
  coachTitle: { fontFamily: font.extrabold, fontSize: type.body, color: colors.white, lineHeight: 21 },
  coachDetail: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute, lineHeight: 18, marginTop: 3 },

  section: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta + 1.2,
    color: colors.inkMute, marginTop: space.lg, marginBottom: space.sm,
  },

  palette: { gap: space.sm, paddingRight: space.md, paddingBottom: 4 },
  tile: {
    width: 82, alignItems: 'center', paddingTop: 8, paddingBottom: 10, gap: 2,
    borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface,
  },
  tileLabel: { fontFamily: font.extrabold, fontSize: type.meta, color: colors.inkSoft, letterSpacing: tracking.meta },

  inspector: {
    marginTop: space.lg, padding: space.md,
    borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.surface,
    ...th.elevation.lifted,
  },
  inspectorHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inspectorTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, letterSpacing: tracking.heading },
  inspectorState: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, marginTop: space.sm },
  inspectorWarn: { fontFamily: font.bold, fontSize: type.small, color: colors.red, marginTop: 4, lineHeight: 18 },

  refdesLarge: {
    minWidth: 46, height: 30, paddingHorizontal: 8, borderRadius: 9, ...curve,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.goldPlate,
  },
  refdesLargeText: { fontFamily: font.black, fontSize: type.small, color: colors.onGold },

  fieldLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute, marginTop: space.md, marginBottom: 6,
  },
  pills: { gap: 6, paddingRight: space.md },
  pill: {
    minWidth: 62, height: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.cream,
  },
  pillPressed: { borderColor: colors.inkMute },
  pillOn: { borderColor: colors.ink, backgroundColor: colors.goldSoft },
  pillText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, ...tabular },
  pillTextOn: { fontFamily: font.black, color: colors.ink },

  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 44, paddingHorizontal: 14,
    borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.cream,
  },
  togglePressed: { borderColor: colors.inkMute },
  toggleOn: { borderColor: colors.ink, backgroundColor: colors.goldSoft },
  toggleText: { fontFamily: font.extrabold, fontSize: type.small, color: colors.inkSoft },
  toggleTextOn: { color: colors.ink },
  toggleTrack: { width: 34, height: 20, borderRadius: 10, backgroundColor: colors.inkFaint, padding: 3 },
  toggleTrackOn: { backgroundColor: colors.ink },
  toggleKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.surface },
  toggleKnobOn: { transform: [{ translateX: 14 }] },

  wires: { marginTop: 2 },
  wireRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  wireText: { flex: 1, fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft },
  unwire: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, ...curve,
  },
  unwirePressed: { backgroundColor: colors.inkFaint },

  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  stat: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.sm, ...curve, backgroundColor: colors.cream,
  },
  statLabel: { fontFamily: font.black, fontSize: 9.5, letterSpacing: 1.3, color: colors.inkMute },
  statValue: { fontFamily: font.black, fontSize: type.body, color: colors.ink, marginTop: 3, ...tabular },

  readings: {
    borderRadius: radius.md, ...curve, overflow: 'hidden',
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 54, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.cream },
  rowOn: { backgroundColor: colors.goldSoft },
  refdes: {
    minWidth: 42, height: 26, paddingHorizontal: 7, borderRadius: 8, ...curve,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.inkFaint,
  },
  refdesOn: { backgroundColor: colors.ink },
  refdesText: { fontFamily: font.black, fontSize: type.meta, color: colors.inkSoft },
  refdesTextOn: { color: colors.onInk },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: font.bold, fontSize: type.label, color: colors.ink },
  rowState: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkMute, marginTop: 1 },
  rowAmps: { fontFamily: font.black, fontSize: type.body, color: colors.ink, ...tabular },
  rowAmpsUnknown: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkMute },

  liveNote: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkMute,
    lineHeight: 16, marginTop: space.sm,
  },
}));
