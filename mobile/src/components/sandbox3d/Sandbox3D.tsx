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
import { curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { useScrollLock } from '../ScrollLock';
import { ROW_LETTERS } from './boardSpec';
import { RULER, type RulerLayout } from './ruler';
import { describeHole, SandboxScene, type PickResult } from './scene';
import type {
  CameraView, HoleId, HoleTap, PartKind, PerfSample, PlacedPart, Quality,
  SandboxSolution, SandboxTool, Wire,
} from './types';
import { makeStyles, useColors } from '../../theme/theme';

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
   *
   * A pin present at 0 is driven LOW; a pin absent is an input and floats.
   * Use `pinDriveFromDuty` to convert the AVR runner's duty array.
   *
   * The board is re-solved whenever this object's identity changes, so build
   * it from the runner's real output rather than inline in render if the
   * shell re-renders for unrelated reasons.
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
  /**
   * Name every row, rail and column visible in the frame, at its edge.
   *
   * On by default. Off is for a screenshot or a hero shot: the board's own
   * printing is six and a half inches apart end to end, so with this off there
   * is no way to tell a3 from a4 without pressing on it.
   */
  showRuler?: boolean;

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
  const colors = useColors();
  const s = useS();
  const {
    parts, wires, tool = 'select', pendingKind = null, selectedId = null,
    running = false, ambientLight = 0.5, temperature = 22, pinDrive,
    supplyVolts = 5, powered = true, view = 'fit', viewNonce = 0, quality = 'auto',
    style, height = 340, showHoleReadout = true, showRuler = true,
  } = props;

  // Read once: changing it later would mean tearing down the GL surface.
  const [msaa] = useState(() => (quality === 'low' ? 0 : quality === 'balanced' ? 2 : 4));

  const scene = useRef<SandboxScene | null>(null);
  const gl = useRef<ExpoWebGLRenderingContext | null>(null);
  const size = useRef({ width: 1, height: 1 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [readout, setReadout] = useState<HoleTap | null>(null);
  /** The hole under a finger that is still down, and where it is on screen. */
  const [aim, setAim] = useState<{ label: string; x: number; y: number } | null>(null);
  /** Row, rail and column names at the frame edge, for the camera as it is. */
  const [ruler, setRuler] = useState<RulerLayout | null>(null);

  // Callbacks are read through a ref so the gesture responder is built once
  // and never has to be rebuilt when the shell re-renders with new closures.
  const handlers = useRef(props);
  handlers.current = props;

  const rulerOn = useRef(showRuler);
  rulerOn.current = showRuler;

  /**
   * Rebuild the ruler for wherever the camera is now.
   *
   * Driven by the scene's own loop rather than by a React subscription to the
   * camera, and skipped entirely when the layout has not actually changed: a
   * momentum flick settles over about a second, and most of those frames move
   * the camera by less than the half point this rounds to.
   */
  const remeasure = useCallback(() => {
    const s = scene.current;
    if (!s || !rulerOn.current) { setRuler((prev) => (prev === null ? prev : null)); return; }
    const next = s.measureRuler(size.current.width, size.current.height);
    setRuler((prev) => (sameRuler(prev, next) ? prev : next));
  }, []);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const pendingRef = useRef(pendingKind);
  pendingRef.current = pendingKind;

  // ── Gesture state, all in refs so nothing here re-renders ──
  const touch = useRef({
    count: 0,
    x: 0, y: 0,
    // Camera deltas come from PAGE coordinates and hit tests from LOCATION
    // ones, so both are carried. Committing a drag at the page coordinate was
    // a real bug: it placed the part wherever that point happened to fall
    // inside the GL view, which on a scrolled page is nowhere near the finger.
    lx: 0, ly: 0,
    startX: 0, startY: 0,
    startedAt: 0,
    spread: 0,
    moved: 0,
    dragging: null as { id: string; hole: HoleId | null } | null,
    holdTimer: null as ReturnType<typeof setTimeout> | null,
    hovered: null as HoleId | null,
    /** The hole the aim label is currently naming, so it is set once per hole. */
    aimed: null as HoleId | null,
    /**
     * Set once the finger has actually TRAVELLED, which is what separates a
     * press from an orbit.
     *
     * Not the same question as `moved`. That one accumulates the length of the
     * path the finger has wandered, and a fingertip resting on glass wanders a
     * pixel or two every frame it is down: a finger that has not gone anywhere
     * still runs `moved` past the slop in a second or so of holding still. Read
     * the two interchangeably and a learner who rests a finger on a hole to
     * READ it watches the label vanish, the camera creep, and the tap fail to
     * commit. This one is the distance from where the finger landed, so it
     * ignores jitter and latches the moment the gesture becomes a real drag.
     */
    panning: false,
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

  /**
   * Name the hole under the finger, while the finger is still down.
   *
   * A tie point is 1.2 mm across and a fingertip is about 8 mm, so aiming at
   * one blind is guesswork: the report that started this was "I'm trying to
   * touch G29, now I'm on G30 because my finger doesn't have a clue where it's
   * pressing". Ringing the hole and naming it before the finger lifts turns a
   * miss into something the learner can correct by sliding, which is the only
   * correction a touch screen offers.
   */
  const showAim = useCallback((x: number, y: number) => {
    const s = scene.current;
    if (!s) return;
    const hole = hoverHole(x, y);
    const t = touch.current;
    if (hole === t.aimed) return;
    t.aimed = hole;
    s.setTargetHole(hole);
    if (!hole) { setAim(null); return; }
    const described = describeHole(hole, null);
    const at = s.projectHole(hole, size.current.width, size.current.height);
    if (!described || !at) { setAim(null); return; }
    setAim({ label: described.label.toUpperCase(), x: at.x, y: at.y });
  }, [hoverHole]);

  const clearAim = useCallback(() => {
    touch.current.aimed = null;
    setAim(null);
    scene.current?.setTargetHole(null);
  }, []);

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

  // Orbiting is a vertical drag, which is exactly what a ScrollView claims.
  // Refusing the responder does not stop it: UIScrollView competes below the
  // JS responder system, so the page scrolled while the camera also moved.
  const { setLocked } = useScrollLock();

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,

    onPanResponderGrant: (e: GestureResponderEvent) => {
      setLocked(true);
      const s = scene.current;
      if (!s) return;
      s.rig.arrest();
      const { locationX, locationY, pageX, pageY } = e.nativeEvent;
      const t = touch.current;
      t.count = e.nativeEvent.touches.length;
      // Seeded in page space to match the deltas taken in onPanResponderMove.
      // Seeding in one frame and differencing in another is a jump on the very
      // first move of every gesture.
      t.x = pageX; t.y = pageY;
      t.lx = locationX; t.ly = locationY;
      t.startX = locationX; t.startY = locationY;
      t.startedAt = Date.now();
      t.moved = 0;
      t.dragging = null;
      t.hovered = null;
      t.aimed = null;
      t.panning = false;

      // Immediately, on touch down, before anything moves. The learner sees
      // which hole they are on while there is still time to slide off it.
      if (e.nativeEvent.touches.length === 1) showAim(locationX, locationY);

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
        t.panning = true; // nor a press
        clearHold();
        // Two fingers is a camera move, and an aim label pinned to a hole the
        // camera is dragging out from under it is worse than none.
        if (t.aimed) clearAim();
        s.invalidate();
        return;
      }

      const { locationX, locationY, pageX, pageY } = e.nativeEvent;
      // Camera deltas come from PAGE coordinates, hit tests from LOCATION.
      //
      // locationX is relative to whichever view received the event, so it
      // changes reference frame when the finger crosses a child and on every
      // multi-touch transition. Differencing it across that boundary produces a
      // delta of hundreds of pixels in one frame, which is the camera jumping to
      // a completely new position. pageX is absolute and never re-bases.
      if (t.count !== 1) { t.count = 1; t.x = pageX; t.y = pageY; t.lx = locationX; t.ly = locationY; return; }
      const dx = pageX - t.x;
      const dy = pageY - t.y;
      t.x = pageX; t.y = pageY;
      t.lx = locationX; t.ly = locationY;
      t.moved += Math.abs(dx) + Math.abs(dy);
      // Measured from where the finger LANDED, not summed along its path, so a
      // fingertip trembling on one hole is still a press however long it rests.
      if (Math.abs(locationX - t.startX) + Math.abs(locationY - t.startY) > TAP_SLOP) t.panning = true;
      if (t.moved > TAP_SLOP) clearHold();

      if (t.dragging) {
        // Dragging a part: the camera is locked and the destination is shown
        // as a ghost, because the finger is covering the part itself.
        showAim(locationX, locationY);
        const hole = t.aimed;
        if (hole !== t.hovered) {
          t.hovered = hole;
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
          // The ring stays on the wire's FIRST hole, so only the label follows
          // the finger to the second one. Set on change, never per frame: a
          // setState on every touch move would reconcile the shell sixty times
          // a second while the learner is drawing.
          const to = hole ? describeHole(hole, null) : null;
          const at = hole ? s.projectHole(hole, size.current.width, size.current.height) : null;
          setAim(to && at ? { label: to.label.toUpperCase(), x: at.x, y: at.y } : null);
        }
        return;
      }

      if (toolRef.current === 'place' && pendingRef.current && t.moved > TAP_SLOP) {
        showAim(locationX, locationY);
        const hole = t.aimed;
        if (hole !== t.hovered) {
          t.hovered = hole;
          s.setGhost(pendingRef.current, hole);
        }
        return;
      }

      // A finger that has not travelled is still a press, and a press is how a
      // learner READS the hole they are on. Keep naming it, and keep following
      // it, so a small correcting slide lands where the label says. Clearing
      // the label on the first pixel of movement is the same as not having it:
      // the default tool is 'select', where a real slide orbits rather than
      // aims, so this branch is the only place the affordance lives at all.
      if (!t.panning) {
        // A wire in progress keeps its ring on its FIRST hole, so it is left
        // alone until the finger commits to dragging out the second one.
        if (!(toolRef.current === 'wire' && wireStart.current)) showAim(locationX, locationY);
        return;
      }

      // Past that, one finger is an orbit. The board is moving under the
      // finger, so a label pinned to a hole would lie within a frame.
      if (t.aimed) clearAim();
      s.rig.orbit(dx, dy, view.height);
      s.invalidate();
    },

    onPanResponderRelease: (e: GestureResponderEvent) => {
      setLocked(false);
      const s = scene.current;
      clearHold();
      const t = touch.current;
      // The label lives exactly as long as the finger does, whatever else the
      // release turns out to mean.
      t.aimed = null;
      setAim(null);
      if (!s) return;

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
          // In LOCATION coordinates: the page ones this used to pass are
          // measured from the top of the screen, so on a scrolled page they
          // committed the part somewhere else entirely.
          const hole = t.hovered;
          t.count = 0;
          if (hole) { commitTap(t.lx, t.ly); return; }
          if (toolRef.current === 'wire') s.setWirePreview(wireStart.current, null);
          return;
        }
      }

      t.count = 0;
      // No time limit, and no path length either. Resting a finger on the board
      // is now how a learner READS which hole they are on, so a press held long
      // enough to check the label has to still commit where the label said,
      // however far the fingertip trembled while it sat there.
      if (!t.panning) commitTap(e.nativeEvent.locationX, e.nativeEvent.locationY);
    },

    onPanResponderTerminate: () => {
      // Released AND terminated, or a cancelled gesture leaves the page frozen.
      setLocked(false);
      clearHold();
      const t = touch.current;
      t.dragging = null;
      t.count = 0;
      t.aimed = null;
      t.panning = false;
      setAim(null);
      scene.current?.setGhost(null, null);
      scene.current?.setTargetHole(null);
    },
  }), [clearAim, commitTap, hoverHole, pickAt, setLocked, showAim]);

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
        onCamera: remeasure,
      });
      scene.current = s;
      s.setBoard(handlers.current.parts, handlers.current.wires);
      s.setSelection(handlers.current.selectedId ?? null);
      s.setSimulation(simulationInput(handlers.current), handlers.current.running ?? false);
      s.setView(handlers.current.view ?? 'fit', false);
      s.start();
      setReady(true);
      remeasure();
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
      // The frame changed shape, so where every row and column leaves it did
      // too, and the camera has not moved to say so.
      remeasure();
    }
  }, [remeasure]);

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
  useEffect(() => { remeasure(); }, [remeasure, showRuler]);
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
      {/* Multisampling is a property of the GL surface, so it is fixed when the
          surface is created and the automatic governor cannot touch it. Four
          samples is the right default: the board is full of thin printed lines
          and long metal legs, which is exactly what aliases without it. */}
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={msaa} />

      {!ready && (
        <View style={[StyleSheet.absoluteFill, s.centre, s.veil]}>
          <ActivityIndicator color={colors.goldDeep} />
          <Text style={s.loading}>Setting up the bench</Text>
        </View>
      )}

      {/* The board's own row letters and column numbers are printed at its two
          ends, and a phone camera never has both ends of a 6.5 inch board in
          frame at a size anyone can read, so at four of the five presets not
          one of them was ever on screen. These are the same names, laid out
          from the live camera against the frame edge instead, so they are
          always there and always on the axis of the row or column they name.
          Drawn here rather than in the scene: native text is sharp at the
          device's own resolution, costs the renderer nothing, and can be read
          by a screen reader, none of which is true of another texture. */}
      {ready && ruler && (ruler.bands.length > 0 || ruler.columns.length > 0) && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessible
          accessibilityRole="text"
          accessibilityLabel={describeRuler(ruler)}
        >
          {ruler.bands.map((band) => (
            <View
              key={band.key}
              style={[s.rulerChip, { left: band.x - band.w / 2, top: band.y - band.h / 2, width: band.w, height: band.h }]}
            >
              <Text
                numberOfLines={1}
                style={[
                  s.rulerText,
                  band.kind === 'rail' && (band.polarity === '+' ? s.rulerPlus : s.rulerMinus),
                ]}
              >
                {band.text}
              </Text>
            </View>
          ))}
          {ruler.columns.map((col) => (
            <View
              key={col.key}
              style={[s.rulerChip, { left: col.x - col.w / 2, top: col.y - col.h / 2, width: col.w, height: col.h }]}
            >
              <Text numberOfLines={1} style={s.rulerText}>{col.text}</Text>
            </View>
          ))}
        </View>
      )}

      {ready && aim && (
        <View
          style={[
            s.aimAnchor,
            { left: Math.min(Math.max(aim.x - AIM_WIDTH / 2, 0), Math.max(0, size.current.width - AIM_WIDTH)) },
            // Anchored on the HOLE, not on a guess at how tall the pill is:
            // laid out from the bottom edge up, the stem ends exactly on the
            // socket whatever the text metrics turn out to be. Near the top of
            // the view there is no room above, so it flips below instead of
            // being clipped by the frame.
            aim.y < AIM_LIFT
              ? { top: aim.y }
              : { bottom: Math.max(0, size.current.height - aim.y) },
          ]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Aiming at ${aim.label}`}
        >
          {aim.y < AIM_LIFT && <View style={s.aimStem} />}
          <View style={s.aimPill}>
            <Text style={s.aimText}>{aim.label}</Text>
          </View>
          {aim.y >= AIM_LIFT && <View style={s.aimStem} />}
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

/**
 * True when two layouts would draw the same thing.
 *
 * Compared at half a point, because that is finer than the display can show
 * and because the alternative is a React render for every frame of a momentum
 * flick. Keys are compared as well as positions: a stride change swaps which
 * numbers are on screen without necessarily moving any of them.
 */
function sameRuler(a: RulerLayout | null, b: RulerLayout | null): boolean {
  if (!a || !b) return a === b;
  if (a.bands.length !== b.bands.length || a.columns.length !== b.columns.length) return false;
  for (let i = 0; i < a.bands.length; i++) if (!sameLabel(a.bands[i], b.bands[i])) return false;
  for (let i = 0; i < a.columns.length; i++) if (!sameLabel(a.columns[i], b.columns[i])) return false;
  return true;
}

function sameLabel(
  a: { key: string; x: number; y: number; w: number },
  b: { key: string; x: number; y: number; w: number },
): boolean {
  return a.key === b.key && a.w === b.w
    && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/** What the ruler says, for a learner who is not looking at it. */
function describeRuler(layout: RulerLayout): string {
  const rows = layout.visibleRows;
  const cols = layout.visibleCols;
  if (!rows.length || !cols.length) return 'Board ruler';
  const first = ROW_LETTERS[rows[0]].toUpperCase();
  const last = ROW_LETTERS[rows[rows.length - 1]].toUpperCase();
  const span = rows.length === 1 ? `Row ${first}` : `Rows ${first} to ${last}`;
  return `Board ruler. ${span} and columns ${cols[0] + 1} to ${cols[cols.length - 1] + 1} are in view.`;
}

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

/**
 * The aim label's box.
 *
 * Fixed width and centred inside it, so the pill sits over the hole without
 * having to measure the text first. Lifted clear of the fingertip, because a
 * label under a finger is a label nobody reads.
 */
const AIM_WIDTH = 108;
/** How far the pill stands off the hole, so a fingertip cannot cover it. */
const AIM_LIFT = 52;

const useS = makeStyles((colors) => ({
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
  // The aim label is deliberately NOT built like the readout chip below it.
  // One is a meter reading parked in a corner; this one is a pointer, so it is
  // gold on the board's own accent, it has a stem down to the hole it names,
  // and it moves. Two things that mean different things should not share a
  // shape.
  aimAnchor: { position: 'absolute', width: AIM_WIDTH, alignItems: 'center' },
  aimPill: {
    backgroundColor: colors.gold,
    borderWidth: 2, borderColor: colors.goldPlate,
    borderRadius: 999, ...curve,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  aimText: {
    fontFamily: font.black, fontSize: type.small, color: colors.onGold,
    letterSpacing: 1.2, ...tabular,
  },
  aimStem: { width: 2.5, height: 22, backgroundColor: colors.goldPlate, opacity: 0.9 },
  // A third shape again, and deliberately the quietest of the three. The aim
  // pill is gold because it is answering a question the learner just asked;
  // the readout chip is a meter parked in a corner. This is neither: it is the
  // scale printed down the side of an instrument, so it is small, dark, exactly
  // the size the layout measured it at, and it never moves unless the camera
  // does. The size comes from the layout rather than from the text, so what is
  // drawn is the same box the collision arithmetic in ruler.ts cleared.
  rulerChip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    ...curve,
    backgroundColor: 'rgba(20,24,31,0.86)',
  },
  rulerText: {
    fontFamily: font.black,
    fontSize: RULER.fontSize,
    lineHeight: RULER.fontSize + 3,
    // onSlab, not cream. The chip above is a FIXED dark wash that does not move
    // between themes, so its text must not either: `cream` inverts, and in dark
    // mode the row numbers and the F1 / A2 / GND names went dark on dark and
    // vanished off a breadboard that is white in both themes.
    color: colors.onSlab,
    letterSpacing: RULER.tracking,
    ...tabular,
  },
  // The rails carry the board's own colours, because "+" and "-" in the same
  // ink as a row letter is exactly the ambiguity the report was about.
  rulerPlus: { color: colors.red },
  rulerMinus: { color: colors.blue },
}));
