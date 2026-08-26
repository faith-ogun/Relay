// ── The scene driver ──
//
// Everything that happens per frame lives here, and nothing that happens per
// frame touches React. The component above owns props; this owns the scene
// graph, the render loop and the solver, and the two meet only when the board
// actually changes.
//
// The three decisions that make this run at sixty on a phone:
//
//   RENDER ON DEMAND. A still board draws nothing. The loop ticks, sees that
//   the camera has settled and no LED is fading, and returns without calling
//   render. A simulator that redraws an unchanged image sixty times a second
//   is a simulator that empties a battery and warms a hand for no reason.
//
//   THE SHADOW MAP IS STATIC. Parts cast real shadows, but the shadow map is
//   only re-rendered when a part moves. Camera movement, which is most of what
//   happens, costs nothing extra. autoUpdate off, needsUpdate on a change.
//
//   NOTHING IS ALLOCATED IN THE LOOP. Every vector the frame needs is hoisted
//   to module scope. Hermes has a generational collector and sixty small
//   allocations a second per call site is a pause the learner sees as a stutter
//   exactly while they are dragging.

import * as THREE from 'three';
import { Renderer } from 'expo-three';
import { BOARD, BOARD_TOP, TABLE_Y, UNO, UNO_TOP } from './boardSpec';
import { OrbitRig } from './camera';
import { createEnvironment, KEY_DIR } from './env';
import { applyBreadboardTexture, buildBreadboard, type BreadboardMesh } from './geometry/breadboard';
import { createPart, partBodyGeometry, partVariant, type PartObject } from './geometry/parts';
import { applyUnoTexture, buildUno, buildUnoIndicators } from './geometry/uno';
import { createWire, type WireObject } from './geometry/wire';
import { createMaterials, type MaterialLibrary } from './materials';
import {
  BoardTransient, buildNetlist, readSolution, type NetlistInput, type NetlistResult,
} from './netlist';
import { partHoles } from './parts';
import { solve } from '../../sim/engine';
import { holeAtPoint, holeInfo, unoPinAtPoint, type HoleId } from './topology';
import type {
  CameraView, HoleTap, PartKind, PerfSample, PlacedPart, Quality, SandboxSolution, Wire,
} from './types';

export type PickResult =
  | { kind: 'part'; id: string; hole: HoleId | null }
  | { kind: 'wire'; id: string }
  | { kind: 'hole'; hole: HoleId }
  | null;

export interface SceneOptions {
  width: number;
  height: number;
  quality: Quality;
  onPerf?: (sample: PerfSample) => void;
  onSolve?: (solution: SandboxSolution) => void;
}

type Tier = Exclude<Quality, 'auto'>;

const TIERS: Record<Tier, { shadows: boolean; shadowSize: number; anisotropy: number }> = {
  high: { shadows: true, shadowSize: 1024, anisotropy: 8 },
  balanced: { shadows: true, shadowSize: 512, anisotropy: 4 },
  low: { shadows: false, shadowSize: 0, anisotropy: 2 },
};

/** Frame time above which the scene is not keeping up with a 60 Hz display. */
const SLOW_MS = 21;
/** Consecutive slow frames before stepping down a tier. */
const SLOW_RUN = 45;

// Scratch. Reused by the frame loop and the picker; never allocated per frame.
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);
const _unoPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -UNO_TOP);
const _hit = new THREE.Vector3();
const _pins: Array<THREE.Vector3 | null> = [];
const _pool = [
  new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
];

export class SandboxScene {
  readonly scene = new THREE.Scene();
  readonly rig: OrbitRig;
  readonly materials: MaterialLibrary;

  private renderer: THREE.WebGLRenderer;
  private gl: WebGLRenderingContext & { endFrameEXP?: () => void };
  private board: BreadboardMesh;
  private uno: THREE.Group;
  private key: THREE.DirectionalLight;
  private indicators: { power: THREE.Mesh; pin13: THREE.Mesh; materials: THREE.MeshStandardMaterial[] };

  private partLayer = new THREE.Group();
  private wireLayer = new THREE.Group();
  private overlay = new THREE.Group();

  private parts = new Map<string, PartObject>();
  private wires = new Map<string, WireObject>();
  private partData = new Map<string, PlacedPart>();

  private targetRing: THREE.Mesh;
  private ghost: THREE.Mesh | null = null;
  private preview: WireObject | null = null;

  private tier: Tier;
  private requested: Quality;
  private dirty = true;
  private running = false;
  private raf: number | null = null;
  private last = 0;
  private elapsed = 0;
  private frameMs = 16.6;
  private slowRun = 0;
  private disposed = false;

  private input: NetlistInput = { parts: [], wires: [] };
  private built: NetlistResult | null = null;
  private transient: BoardTransient | null = null;
  private solution: SandboxSolution | null = null;
  private simulating = false;

  private readonly opts: SceneOptions;

  constructor(
    gl: WebGLRenderingContext & { drawingBufferWidth: number; drawingBufferHeight: number; endFrameEXP?: () => void },
    opts: SceneOptions,
  ) {
    this.gl = gl;
    this.opts = opts;
    this.requested = opts.quality;
    this.tier = opts.quality === 'auto' ? 'high' : opts.quality;

    this.renderer = new Renderer({ gl });
    this.renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
    this.renderer.setPixelRatio(1);
    // The workspace is calm and light, per the design rules. The 3D view sits
    // on the same cream as the rest of the app so it reads as part of the
    // page rather than a video embedded in it.
    this.renderer.setClearColor(0xf6f3ea, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The one that matters: the shadow map is not redrawn every frame, only
    // when the board changes.
    this.renderer.shadowMap.autoUpdate = false;

    this.rig = new OrbitRig(opts.width / Math.max(1, opts.height));
    this.rig.jumpTo('fit');

    this.materials = createMaterials();

    // ── Lighting ──
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d2c2, 1.05);
    this.scene.add(hemi);
    this.key = new THREE.DirectionalLight(0xfff6e6, 1.55);
    this.key.position.set(KEY_DIR[0] * 8, KEY_DIR[1] * 8, KEY_DIR[2] * 8);
    // Framed tightly on the two boards. A shadow camera any larger throws
    // resolution away on empty table.
    const half = Math.max(BOARD.length, UNO.width + Math.abs(UNO.z)) * 0.62;
    const cam = this.key.shadow.camera as THREE.OrthographicCamera;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.near = 0.5; cam.far = 22;
    this.key.shadow.bias = -0.0016;
    this.key.shadow.normalBias = 0.012;
    this.scene.add(this.key);
    const fill = new THREE.DirectionalLight(0xdfe8f5, 0.36);
    fill.position.set(3.5, 2.6, -4);
    this.scene.add(fill);

    // ── Table ──
    const table = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), this.materials.table);
    table.rotation.x = -Math.PI / 2;
    table.position.y = TABLE_Y - 0.002;
    table.receiveShadow = true;
    this.scene.add(table);

    // ── Boards ──
    this.board = buildBreadboard(this.materials);
    this.scene.add(this.board);
    this.uno = buildUno(this.materials);
    this.scene.add(this.uno);
    this.indicators = buildUnoIndicators();
    this.uno.add(this.indicators.power, this.indicators.pin13);

    // Baked contact shadows under both boards: soft, free, and closer to what
    // a diffuse room actually does under a flat object than a shadow map is.
    this.scene.add(this.contactShadow(BOARD.length * 1.2, BOARD.width * 1.9, 0, 0));
    this.scene.add(this.contactShadow(UNO.length * 1.35, UNO.width * 1.45, UNO.x, UNO.z));

    this.scene.add(this.partLayer, this.wireLayer, this.overlay);

    // The ring under the hole a tap would land on.
    this.targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.078, 24).rotateX(-Math.PI / 2),
      this.materials.highlight,
    );
    this.targetRing.visible = false;
    this.overlay.add(this.targetRing);

    this.applyTier();

    // The environment and the two silkscreens are the expensive part of
    // startup. They run after the renderer exists so the very first frame can
    // be presented immediately, and the board fills in a frame later.
    const env = createEnvironment(this.renderer);
    if (env) {
      this.scene.environment = env;
    } else {
      // No reflections available: the metals would go flat, so the sky picks
      // up the difference instead of the scene looking unlit.
      hemi.intensity = 1.5;
      fill.intensity = 0.55;
    }
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    applyBreadboardTexture(this.board, this.materials, Math.min(TIERS[this.tier].anisotropy, maxAniso));
    applyUnoTexture(this.materials, Math.min(TIERS[this.tier].anisotropy, maxAniso));
  }

  private contactShadow(w: number, d: number, x: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.materials.contactShadow);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, TABLE_Y + 0.004, z);
    return mesh;
  }

  // ── Sizing ────────────────────────────────────────────────────────────────

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.rig.setAspect(width / Math.max(1, height));
    this.dirty = true;
  }

  // ── Board contents ────────────────────────────────────────────────────────

  /**
   * Reconcile the scene against the props.
   *
   * Diffed by id rather than rebuilt, because the parent is fully controlled
   * and re-renders on every keystroke in the shell. Rebuilding twenty parts
   * because a label changed would be the churn the whole design avoids.
   */
  setBoard(parts: PlacedPart[], wires: Wire[]): void {
    const seen = new Set<string>();
    let structural = false;

    for (const part of parts) {
      seen.add(part.id);
      let obj = this.parts.get(part.id);
      const previous = this.partData.get(part.id);
      if (!obj) {
        obj = createPart(part, this.materials);
        this.parts.set(part.id, obj);
        this.partLayer.add(obj.root);
        structural = true;
      }
      const moved = !previous
        || previous.anchor !== part.anchor
        || (previous.rotation ?? 0) !== (part.rotation ?? 0);
      const changed = !previous
        || previous.value !== part.value
        || previous.color !== part.color
        || previous.pressed !== part.pressed
        || previous.wiper !== part.wiper;

      if (changed) obj.refresh(part, this.materials);
      if (moved) {
        this.placePart(part, obj);
        structural = true;
      }
      this.partData.set(part.id, part);
    }

    for (const [id, obj] of this.parts) {
      if (seen.has(id)) continue;
      this.partLayer.remove(obj.root);
      obj.dispose();
      this.parts.delete(id);
      this.partData.delete(id);
      structural = true;
    }

    const wireSeen = new Set<string>();
    for (const wire of wires) {
      wireSeen.add(wire.id);
      let obj = this.wires.get(wire.id);
      if (!obj) {
        obj = createWire(wire.id, wire.color ?? 'blue', this.materials);
        this.wires.set(wire.id, obj);
        this.wireLayer.add(obj.root);
        structural = true;
      }
      obj.setColor(wire.color ?? 'blue', this.materials);
      const from = holeInfo(wire.from);
      const to = holeInfo(wire.to);
      if (from && to) {
        _pool[0].set(from.world[0], from.world[1] + 0.012, from.world[2]);
        _pool[1].set(to.world[0], to.world[1] + 0.012, to.world[2]);
        obj.setEnds(_pool[0], _pool[1]);
      }
    }
    for (const [id, obj] of this.wires) {
      if (wireSeen.has(id)) continue;
      this.wireLayer.remove(obj.root);
      obj.dispose();
      this.wires.delete(id);
      structural = true;
    }

    if (structural) this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  private placePart(part: PlacedPart, obj: PartObject): void {
    const holes = partHoles(part);
    _pins.length = 0;
    holes.forEach((hole, i) => {
      if (!hole) { _pins.push(null); return; }
      const info = holeInfo(hole);
      if (!info) { _pins.push(null); return; }
      const v = _pool[Math.min(i, _pool.length - 1)];
      v.set(info.world[0], info.world[1], info.world[2]);
      _pins.push(v);
    });
    obj.place(_pins);
  }

  setSelection(id: string | null): void {
    for (const [partId, obj] of this.parts) obj.setSelected(partId === id);
    for (const [wireId, obj] of this.wires) obj.setSelected(wireId === id, this.materials);
    this.dirty = true;
  }

  /**
   * Show a translucent preview of the part a tap would drop, at the hole it
   * would land in.
   *
   * On a phone the finger covers the target, so without this a learner is
   * placing blind and finds out where the part went only after it is there.
   * The preview reuses the part's own cached geometry, so it costs one extra
   * draw call and no build.
   */
  setGhost(kind: PartKind | null, hole: HoleId | null): void {
    if (!kind || !hole) {
      if (this.ghost) { this.ghost.visible = false; this.dirty = true; }
      return;
    }
    const info = holeInfo(hole);
    if (!info) return;
    const body = partBodyGeometry(kind, this.materials, partVariant({ id: 'ghost', kind, anchor: hole }));
    if (!this.ghost) {
      this.ghost = new THREE.Mesh(body.geometry, this.materials.ghost);
      this.ghost.renderOrder = 2;
      this.overlay.add(this.ghost);
    } else {
      this.ghost.geometry = body.geometry;
    }
    this.ghost.position.set(info.world[0], info.world[1], info.world[2]);
    this.ghost.visible = true;
    this.dirty = true;
  }

  /**
   * A live jumper following the finger, while a wire is being drawn.
   *
   * Rebuilt when the hovered HOLE changes, not per frame, so dragging a wire
   * across the board is a handful of geometry builds rather than sixty a
   * second. Without it, drawing a wire on a phone is done blind.
   */
  setWirePreview(from: HoleId | null, to: HoleId | null): void {
    if (!from || !to || from === to) {
      if (this.preview) { this.preview.root.visible = false; this.dirty = true; }
      return;
    }
    const a = holeInfo(from);
    const b = holeInfo(to);
    if (!a || !b) return;
    if (!this.preview) {
      this.preview = createWire('preview', 'yellow', this.materials);
      this.preview.root.renderOrder = 2;
      this.overlay.add(this.preview.root);
    }
    _pool[0].set(a.world[0], a.world[1] + 0.012, a.world[2]);
    _pool[1].set(b.world[0], b.world[1] + 0.012, b.world[2]);
    this.preview.setEnds(_pool[0], _pool[1]);
    this.preview.root.visible = true;
    this.dirty = true;
  }

  /** Ring the hole a tap would land on. Null clears it. */
  setTargetHole(hole: HoleId | null): void {
    const info = hole ? holeInfo(hole) : null;
    if (!info) {
      if (this.targetRing.visible) this.dirty = true;
      this.targetRing.visible = false;
      return;
    }
    this.targetRing.position.set(info.world[0], info.world[1] + 0.01, info.world[2]);
    this.targetRing.visible = true;
    this.dirty = true;
  }

  // ── Simulation ────────────────────────────────────────────────────────────

  /**
   * Hand the solver a new picture of the world.
   *
   * `running` false leaves the board built but unsolved, which is the state a
   * learner is in while they are wiring: nothing is lit, nothing is wrong.
   */
  setSimulation(input: NetlistInput, running: boolean): void {
    this.input = input;
    this.simulating = running;
    this.built = buildNetlist(input);
    this.transient = running && BoardTransient.needed(this.built)
      ? new BoardTransient(this.built, input)
      : null;
    if (running && !this.transient) {
      this.solution = readSolution(input, this.built, solve(this.built.netlist));
      this.opts.onSolve?.(this.solution);
    } else if (!running) {
      this.solution = null;
    }
    this.dirty = true;
  }

  get lastSolution(): SandboxSolution | null { return this.solution; }

  // ── Camera ────────────────────────────────────────────────────────────────

  setView(view: CameraView, animate = true): void {
    if (animate) this.rig.goTo(view);
    else this.rig.jumpTo(view);
    this.dirty = true;
  }

  // ── Picking ───────────────────────────────────────────────────────────────

  /**
   * What is under a touch, in view pixels.
   *
   * Parts and wires are raycast because they stand above the board and a
   * fingertip on an LED means the LED. If nothing solid is hit, the ray is
   * intersected with the board plane and snapped to the nearest hole, which is
   * both cheaper than raycasting 830 sockets and far more forgiving than
   * requiring a hit inside a 1.2 mm circle.
   */
  pick(x: number, y: number, width: number, height: number): PickResult {
    _ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.rig.camera);

    const solid = _ray.intersectObjects([this.partLayer, this.wireLayer], true);
    if (solid.length) {
      const obj = solid[0].object;
      const partId = obj.userData.partId as string | undefined;
      if (partId) return { kind: 'part', id: partId, hole: this.partData.get(partId)?.anchor ?? null };
      const wireId = obj.userData.wireId as string | undefined;
      if (wireId) return { kind: 'wire', id: wireId };
    }

    if (_ray.ray.intersectPlane(_plane, _hit)) {
      const hole = holeAtPoint(_hit.x, _hit.z);
      if (hole) return { kind: 'hole', hole };
    }
    if (_ray.ray.intersectPlane(_unoPlane, _hit)) {
      const pin = unoPinAtPoint(_hit.x, _hit.z);
      if (pin) return { kind: 'hole', hole: pin };
    }
    return null;
  }

  // ── Quality ───────────────────────────────────────────────────────────────

  setQuality(quality: Quality): void {
    this.requested = quality;
    const next: Tier = quality === 'auto' ? this.tier : quality;
    if (next !== this.tier) { this.tier = next; this.applyTier(); }
  }

  private applyTier(): void {
    const t = TIERS[this.tier];
    this.renderer.shadowMap.enabled = t.shadows;
    this.key.castShadow = t.shadows;
    if (t.shadows) {
      this.key.shadow.mapSize.set(t.shadowSize, t.shadowSize);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
      this.renderer.shadowMap.needsUpdate = true;
    }
    // Parts cast; the boards receive. Nothing on the table casts onto itself,
    // which halves what the shadow pass has to walk.
    this.partLayer.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = t.shadows; });
    this.wireLayer.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = t.shadows; });
    this.dirty = true;
  }

  // ── The loop ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = Date.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf !== null) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  /** Ask for one more frame. Cheap, and the only way anything gets drawn. */
  invalidate(): void { this.dirty = true; }

  // ── frame loop ──
  private frame = (): void => {
    if (!this.running || this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);

    const now = Date.now();
    // Clamped, so a backgrounded app that comes back does not advance the
    // transient solver by four seconds in one step and blow up the matrix.
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.elapsed += dt;

    let busy = this.rig.update(dt);

    if (this.simulating && this.transient && this.built) {
      // Real time, stepped in small slices so an RC curve is the curve and not
      // a straight line between two frames.
      const slices = Math.min(8, Math.max(1, Math.round(dt / 0.002)));
      const step = dt / slices;
      for (let i = 0; i < slices; i++) this.solution = this.transient.step(step);
      if (this.solution) this.opts.onSolve?.(this.solution);
      busy = true;
    }

    for (const [id, obj] of this.parts) {
      if (obj.animate(this.solution?.parts[id], this.elapsed, dt)) busy = true;
    }

    {
      const drive = this.input.pinDrive ?? {};
      const on = this.simulating ? (drive.D13 ?? 0) : 0;
      const mat = this.indicators.materials[1];
      const want = 0.25 + on * 2.6;
      if (Math.abs(mat.emissiveIntensity - want) > 0.005) {
        mat.emissiveIntensity += (want - mat.emissiveIntensity) * Math.min(1, dt * 16);
        busy = true;
      }
      this.indicators.materials[0].emissiveIntensity = this.simulating ? 1.5 : 0.35;
    }

    if (!busy && !this.dirty) return;
    this.dirty = false;

    this.renderer.render(this.scene, this.rig.camera);
    this.gl.endFrameEXP?.();

    const cost = Date.now() - now;
    // An exponential moving average, because one slow frame is noise and a run
    // of them is a device that cannot keep up.
    this.frameMs += (cost - this.frameMs) * 0.1;
    if (this.requested === 'auto') this.governor(cost);
    this.report();
  };
  // ── end frame loop

  /**
   * Step the quality down when the device cannot hold the frame.
   *
   * Down only, never back up. Stepping up again on a good run makes the tier
   * oscillate around the threshold, and a scene that visibly changes quality
   * every few seconds is worse than one that settled slightly too low.
   */
  private governor(cost: number): void {
    if (cost > SLOW_MS) this.slowRun += 1; else this.slowRun = 0;
    if (this.slowRun < SLOW_RUN) return;
    this.slowRun = 0;
    const next: Tier | null = this.tier === 'high' ? 'balanced' : this.tier === 'balanced' ? 'low' : null;
    if (!next) return;
    this.tier = next;
    this.applyTier();
  }

  private reportAt = 0;

  private report(): void {
    if (!this.opts.onPerf) return;
    // Once a second. Reporting every frame would be sixty React updates a
    // second from a component built not to have any.
    if (this.elapsed - this.reportAt < 1) return;
    this.reportAt = this.elapsed;
    const info = this.renderer.info.render;
    this.opts.onPerf({
      frameMs: Math.round(this.frameMs * 100) / 100,
      drawCalls: info.calls,
      triangles: info.triangles,
      quality: this.tier,
    });
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  dispose(): void {
    this.stop();
    this.disposed = true;
    for (const obj of this.parts.values()) obj.dispose();
    for (const obj of this.wires.values()) obj.dispose();
    this.parts.clear();
    this.wires.clear();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) mesh.geometry?.dispose();
    });
    // The ghost borrows a cached part geometry and must not dispose it.
    this.ghost = null;
    this.preview?.dispose();
    this.preview = null;
    this.scene.environment?.dispose();
    this.materials.dispose();
    this.renderer.dispose();
  }
}

/** Everything the picker needs to describe a hole to the shell. */
export function describeHole(hole: HoleId, solution: SandboxSolution | null): HoleTap | null {
  const info = holeInfo(hole);
  if (!info) return null;
  const node = solution?.node[info.net];
  return {
    hole,
    label: info.label,
    net: info.net,
    volts: solution && node !== undefined ? (solution.volts[node] ?? 0) : null,
  };
}
