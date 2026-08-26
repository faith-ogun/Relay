// ── The 3D breadboard, as a React component ──
//
// A thin shell on purpose. Everything expensive lives in SandboxScene, and the
// only job here is to own the GL surface, translate touches into camera and
// tool intent, and hand structural changes down.
//
// WHY NOT react-three-fiber. It would have made this file shorter and every
// frame more expensive. r3f puts a React reconciler between the finger and the
// camera: a drag becomes state, state becomes a render, and a render becomes
// reconciliation, sixty times a second. Worse, the declarative style is what
// produced the web scene's 1,700 draw calls, because a hole is a <mesh> and
// there are 830 of them; instancing and merging, which is the whole reason
// this runs on a phone, are exactly the things that are awkward to express in
// it. Driving three.js directly through an expo-gl surface is also the pattern
// already proven in this app by TwinViewer.
//
// WHY NOT react-native-gesture-handler. It is a dependency already, but its
// Gesture API needs a GestureHandlerRootView at the app root, which this app
// does not have and this component must not add. Its one real advantage,
// running callbacks on the UI thread, is void here anyway: the render loop is
// on the JS thread, so a gesture would have to hop back with runOnJS. So
// PanResponder, which needs no provider and no assumptions about the shell.

import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, PanResponder, StyleSheet, Text, View,
  type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as Haptics from 'expo-haptics';
import { colors, curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { describeHole, SandboxScene, type PickResult } from './scene';
import type {
  CameraView, HoleId, HoleTap, PartKind, PerfSample, PlacedPart, Quality,
  SandboxSolution, SandboxTool, Wire,
} from './types';

export interface Sandbox3DHandle {
  /** Fly the camera to a named view. */
  focus(view: CameraView): void;
  /** Ask for one more frame, after something outside the props changed. */
  invalidate(): void;
  /** The last solve, for a shell that wants a reading without subscribing. */
  readonly solution: SandboxSolution | null;
}

export interface Sandbox3DProps {
  /** Everything on the board. Fully controlled: the shell owns this array. */
  parts: PlacedPart[];
  /** Jumper wires, separate from parts because they have two free ends. */
  wires: Wire[];

  /** What a tap does. Defaults to selecting. */
  tool?: SandboxTool;
  /** With tool 'place', the part a tap would drop. Drives the ghost preview. */
  pendingKind?: PartKind | null;
  /** The highlighted part or wire. */
  selectedId?: string | null;

  /** Run the solver and animate the result. */
  running?: boolean;
  /** Light falling on any photocell, 0 dark to 1 direct sun. */
  ambientLight?: number;
  /** Degrees Celsius at any thermistor. */
  temperature?: number;
  /**
   * Uno pin drive levels, 0 to 1, keyed by pin name: { D9: 0.25, D13: 1 }.
   * A pin present at 0 is driven LOW; a pin absent is an input and floats.
   * Use `pinDriveFromDuty` to convert the AVR runner's duty array.
   */
  pinDrive?: Record<string, number>;
  supplyVolts?: number;
  /** False models the USB lead being unplugged. Defaults to true. */
  powered?: boolean;

  /** Camera framing. Bump `viewNonce` to replay the same view. */
  view?: CameraView;
  viewNonce?: number;
  /** Rendering budget. 'auto' measures the device and steps itself down. */
  quality?: Quality;

  style?: StyleProp<ViewStyle>;
  height?: number;
  /** Show the small chip naming the hole that was last touched. */
  showHoleReadout?: boolean;

  onHoleTap?: (tap: HoleTap) => void;
  /** A tap on an empty hole while tool is 'place'. */
  onPlacePart?: (hole: HoleId, kind: PartKind) => void;
  /** A part was long pressed and dragged to a new hole. */
  onMovePart?: (id: string, hole: HoleId) => void;
  /** Two holes were joined while tool is 'wire'. */
  onConnect?: (from: HoleId, to: HoleId) => void;
  onSelect?: (id: string | null) => void;
  onErase?: (id: string) => void;
  onSolve?: (solution: SandboxSolution) => void;
  onPerf?: (sample: PerfSample) => void;
  onReady?: () => void;
}

/** Movement in points beyond which a touch is a drag, not a tap. */
const TAP_SLOP = 9;
/** How long a finger has to rest on a part before it can be dragged. */
const HOLD_MS = 330;

/**
 * Convert the AVR runner's per pin duty array into the `pinDrive` shape.
 *
 * The simulator screen already keeps `duty[0..13]`, and the two representations
 * disagreeing would be a bug nobody sees until an LED is lit by the wrong pin.
 */
export function pinDriveFromDuty(duty: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  duty.forEach((value, pin) => { out[`D${pin}`] = value; });
  return out;
}

export const Sandbox3D = forwardRef<Sandbox3DHandle, Sandbox3DProps>(function Sandbox3D(props, ref) {
  const {
    parts, wires, tool = 'select', pendingKind = null, selectedId = null,
    running = false, ambientLight = 0.5, temperature = 22, pinDrive,
    supplyVolts = 5, powered = true, view = 'fit', viewNonce = 0, quality = 'auto',
    style, height = 340, showHoleReadout = true,
  } = props;

  const scene = useRef<SandboxScene | null>(null);
  const gl = useRef<ExpoWebGLRenderingContext | null>(null);
  const size = useRef({ width: 1, height: 1 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [readout, setReadout] = useState<HoleTap | null>(null);

  // Callbacks are read through a ref so the gesture responder is built once
  // and never has to be rebuilt when the shell re-renders with new closures.
  const handlers = useRef(props);
  handlers.current = props;

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const pendingRef = useRef(pendingKind);
  pendingRef.current = pendingKind;

  // ── Gesture state, all in refs so nothing here re-renders ──
  const touch = useRef({
    count: 0,
    x: 0, y: 0,
    startX: 0, startY: 0,
    startedAt: 0,
    spread: 0,
    moved: 0,
    dragging: null as { id: string; hole: HoleId | null } | null,
    holdTimer: null as ReturnType<typeof setTimeout> | null,
    hovered: null as HoleId | null,
  });
  const wireStart = useRef<HoleId | null>(null);

  const clearHold = () => {
    if (touch.current.holdTimer) { clearTimeout(touch.current.holdTimer); touch.current.holdTimer = null; }
  };

  const pickAt = useCallback((x: number, y: number): PickResult => {
    const s = scene.current;
    if (!s) return null;
    return s.pick(x, y, size.current.width, size.current.height);
  }, []);

  const hoverHole = useCallback((x: number, y: number): HoleId | null => {
    const hit = pickAt(x, y);
    if (!hit) return null;
    if (hit.kind === 'hole') return hit.hole;
    if (hit.kind === 'part') return hit.hole;
    return null;
  }, [pickAt]);

  const commitTap = useCallback((x: number, y: number) => {
    const s = scene.current;
    if (!s) return;
    const hit = pickAt(x, y);
    const p = handlers.current;
    const t = toolRef.current;

    if (t === 'erase') {
      if (hit && (hit.kind === 'part' || hit.kind === 'wire')) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        p.onErase?.(hit.id);
      }
      return;
    }

    if (t === 'wire') {
      const hole = hit && hit.kind === 'hole' ? hit.hole : hit && hit.kind === 'part' ? hit.hole : null;
      if (!hole) { wireStart.current = null; s.setTargetHole(null); s.setWirePreview(null, null); return; }
      if (!wireStart.current) {
        wireStart.current = hole;
        s.setTargetHole(hole);
        Haptics.selectionAsync().catch(() => {});
        return;
      }
      const from = wireStart.current;
      wireStart.current = null;
      s.setTargetHole(null);
      s.setWirePreview(null, null);
      if (from !== hole) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        p.onConnect?.(from, hole);
      }
      return;
    }

    if (t === 'place' && pendingRef.current) {
      if (hit && hit.kind === 'hole') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        p.onPlacePart?.(hit.hole, pendingRef.current);
      }
      return;
    }

    if (hit && (hit.kind === 'part' || hit.kind === 'wire')) {
      Haptics.selectionAsync().catch(() => {});
      p.onSelect?.(hit.id);
      return;
    }
    if (hit && hit.kind === 'hole') {
      const described = describeHole(hit.hole, s.lastSolution);
      if (described) { setReadout(described); p.onHoleTap?.(described); }
      if (t === 'select') p.onSelect?.(null);
      return;
    }
    p.onSelect?.(null);
    setReadout(null);
  }, [pickAt]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: (e: GestureResponderEvent) => {
      const s = scene.current;
      if (!s) return;
      s.rig.arrest();
      const { locationX, locationY } = e.nativeEvent;
      const t = touch.current;
      t.count = e.nativeEvent.touches.length;
      t.x = locationX; t.y = locationY;
      t.startX = locationX; t.startY = locationY;
      t.startedAt = Date.now();
      t.moved = 0;
      t.dragging = null;
      t.hovered = null;

      // A rest on a part arms a drag. A phone has no right button and no
      // modifier key, so hold is the only gesture left that does not steal
      // the one finger the camera needs.
      clearHold();
      if (toolRef.current === 'select' || toolRef.current === 'place') {
        t.holdTimer = setTimeout(() => {
          t.holdTimer = null;
          if (touch.current.moved > TAP_SLOP || touch.current.count !== 1) return;
          const hit = pickAt(touch.current.x, touch.current.y);
          if (hit && hit.kind === 'part') {
            touch.current.dragging = { id: hit.id, hole: hit.hole };
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            scene.current?.setSelection(hit.id);
          }
        }, HOLD_MS);
      }
    },

    onPanResponderMove: (e: GestureResponderEvent) => {
      const s = scene.current;
      if (!s) return;
      const touches = e.nativeEvent.touches;
      const t = touch.current;
      const view = size.current;

      if (touches.length >= 2) {
        const [a, b] = touches;
        const cx = (a.pageX + b.pageX) / 2;
        const cy = (a.pageY + b.pageY) / 2;
        const spread = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        // A finger landing or lifting changes the centroid and the spread
        // discontinuously. Re-baselining on any change of count is what stops
        // the board jumping when the second finger arrives.
        if (t.count !== touches.length) {
          t.count = touches.length;
          t.x = cx; t.y = cy; t.spread = spread;
          return;
        }
        s.rig.pan(cx - t.x, cy - t.y, view.height);
        if (t.spread > 0) s.rig.dolly(spread / t.spread);
        t.x = cx; t.y = cy; t.spread = spread;
        t.moved += 999;   // a two finger gesture is never a tap
        clearHold();
        s.invalidate();
        return;
      }

      const { locationX, locationY } = e.nativeEvent;
      if (t.count !== 1) { t.count = 1; t.x = locationX; t.y = locationY; return; }
      const dx = locationX - t.x;
      const dy = locationY - t.y;
      t.x = locationX; t.y = locationY;
      t.moved += Math.abs(dx) + Math.abs(dy);
      if (t.moved > TAP_SLOP) clearHold();

      if (t.dragging) {
        // Dragging a part: the camera is locked and the destination is shown
        // as a ghost, because the finger is covering the part itself.
        const hole = hoverHole(locationX, locationY);
        if (hole !== t.hovered) {
          t.hovered = hole;
          s.setTargetHole(hole);
          const kind = handlers.current.parts.find((p) => p.id === t.dragging?.id)?.kind ?? null;
          s.setGhost(kind, hole);
        }
        return;
      }

      if (toolRef.current === 'wire' && wireStart.current && t.moved > TAP_SLOP) {
        const hole = hoverHole(locationX, locationY);
        if (hole !== t.hovered) {
          t.hovered = hole;
          s.setWirePreview(wireStart.current, hole);
        }
        return;
      }

      if (toolRef.current === 'place' && pendingRef.current && t.moved > TAP_SLOP) {
        const hole = hoverHole(locationX, locationY);
        if (hole !== t.hovered) {
          t.hovered = hole;
          s.setTargetHole(hole);
          s.setGhost(pendingRef.current, hole);
        }
        return;
      }

      s.rig.orbit(dx, dy, view.height);
      s.invalidate();
    },

    onPanResponderRelease: (e: GestureResponderEvent) => {
      const s = scene.current;
      clearHold();
      if (!s) return;
      const t = touch.current;
      const quick = Date.now() - t.startedAt < 420;

      if (t.dragging) {
        const target = t.hovered;
        s.setGhost(null, null);
        s.setTargetHole(null);
        if (target && target !== t.dragging.hole) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          handlers.current.onMovePart?.(t.dragging.id, target);
        }
        t.dragging = null;
        t.count = 0;
        return;
      }

      if (toolRef.current === 'place' || toolRef.current === 'wire') {
        s.setGhost(null, null);
        if (t.moved > TAP_SLOP) {
          // A drag that ends over a hole commits there, so a learner can aim
          // by sliding rather than having to hit a 1.2 mm target blind.
          const hole = t.hovered;
          t.count = 0;
          if (hole) { commitTap(t.x, t.y); return; }
          if (toolRef.current === 'wire') s.setWirePreview(wireStart.current, null);
          return;
        }
      }

      t.count = 0;
      if (t.moved <= TAP_SLOP && quick) commitTap(e.nativeEvent.locationX, e.nativeEvent.locationY);
    },

    onPanResponderTerminate: () => {
      clearHold();
      const t = touch.current;
      t.dragging = null;
      t.count = 0;
      scene.current?.setGhost(null, null);
      scene.current?.setTargetHole(null);
    },
  }), [commitTap, hoverHole, pickAt]);

  // ── GL lifecycle ──

  const onContextCreate = useCallback((context: ExpoWebGLRenderingContext) => {
    try {
      gl.current = context;
      const s = new SandboxScene(context, {
        width: size.current.width,
        height: size.current.height,
        quality,
        onPerf: (sample) => handlers.current.onPerf?.(sample),
        onSolve: (solution) => handlers.current.onSolve?.(solution),
      });
      scene.current = s;
      s.setBoard(handlers.current.parts, handlers.current.wires);
      s.setSelection(handlers.current.selectedId ?? null);
      s.setSimulation(simulationInput(handlers.current), handlers.current.running ?? false);
      s.setView(handlers.current.view ?? 'fit', false);
      s.start();
      setReady(true);
      handlers.current.onReady?.();
    } catch {
      setFailed(true);
    }
    // The scene is created once for the life of the GL surface. Quality and
    // everything else is pushed in through effects below, never by rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    scene.current?.dispose();
    scene.current = null;
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    size.current = { width, height: h };
    const context = gl.current;
    if (context && scene.current) {
      scene.current.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
    }
  }, []);

  // ── Prop to scene ──

  useEffect(() => { scene.current?.setBoard(parts, wires); }, [parts, wires]);
  useEffect(() => { scene.current?.setSelection(selectedId); }, [selectedId]);
  useEffect(() => { scene.current?.setQuality(quality); }, [quality]);
  useEffect(() => {
    scene.current?.setSimulation(
      { parts, wires, light: ambientLight, temperature, pinDrive, powered, supplyVolts },
      running,
    );
  }, [parts, wires, ambientLight, temperature, pinDrive, powered, supplyVolts, running]);
  useEffect(() => { scene.current?.setView(view); }, [view, viewNonce]);
  useEffect(() => {
    // Clearing the pending part has to clear its ghost, or a preview is left
    // hanging over the board with nothing behind it.
    if (!pendingKind) scene.current?.setGhost(null, null);
    if (tool !== 'wire') {
      wireStart.current = null;
      scene.current?.setWirePreview(null, null);
    }
  }, [pendingKind, tool]);

  useImperativeHandle(ref, () => ({
    focus: (next: CameraView) => scene.current?.setView(next),
    invalidate: () => scene.current?.invalidate(),
    get solution() { return scene.current?.lastSolution ?? null; },
  }), []);

  if (failed) {
    return (
      <View style={[s.frame, { height }, style]}>
        <View style={s.centre}>
          <Text style={s.failTitle}>The 3D view could not start</Text>
          <Text style={s.failBody}>
            This device could not open a graphics surface. The circuit still runs, and the
            schematic view shows the same board.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.frame, { height }, style]} onLayout={onLayout} {...responder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />

      {!ready && (
        <View style={[StyleSheet.absoluteFill, s.centre, s.veil]}>
          <ActivityIndicator color={colors.goldDeep} />
          <Text style={s.loading}>Setting up the bench</Text>
        </View>
      )}

      {ready && showHoleReadout && readout && (
        <View style={s.chip} pointerEvents="none">
          <Text style={s.chipLabel}>{readout.label.toUpperCase()}</Text>
          {readout.volts !== null && (
            <Text style={s.chipValue}>{formatVolts(readout.volts)}</Text>
          )}
        </View>
      )}
    </View>
  );
});

/** Volts, at the precision a meter would actually show. */
function formatVolts(v: number): string {
  const abs = Math.abs(v);
  if (abs < 0.9995) return `${(v * 1000).toFixed(0)} mV`;
  return `${v.toFixed(2)} V`;
}

function simulationInput(p: Sandbox3DProps) {
  return {
    parts: p.parts,
    wires: p.wires,
    light: p.ambientLight ?? 0.5,
    temperature: p.temperature ?? 22,
    pinDrive: p.pinDrive,
    powered: p.powered ?? true,
    supplyVolts: p.supplyVolts ?? 5,
  };
}

const s = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    ...curve,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
  centre: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  veil: { backgroundColor: colors.cream },
  loading: {
    fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft,
    letterSpacing: 0.1,
  },
  failTitle: {
    fontFamily: font.black, fontSize: type.body, color: colors.ink, textAlign: 'center',
  },
  failBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 18, paddingHorizontal: space.xl,
  },
  // A readout, not a card: it floats over the bench and has to be legible on
  // whatever is behind it without becoming another box in a stack of boxes.
  chip: {
    position: 'absolute', left: space.sm, bottom: space.sm,
    flexDirection: 'row', alignItems: 'baseline', gap: space.sm,
    backgroundColor: 'rgba(20,24,31,0.86)',
    borderRadius: 999, ...curve,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipLabel: {
    fontFamily: font.black, fontSize: type.meta, color: colors.white, letterSpacing: 0.9,
  },
  chipValue: {
    fontFamily: font.black, fontSize: type.small, color: colors.gold, ...tabular,
  },
});
