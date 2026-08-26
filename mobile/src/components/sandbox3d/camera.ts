// ── Orbiting a board with two thumbs ──
//
// OrbitControls is a DOM component: it binds pointer, wheel and key events to
// a canvas element, none of which exist here. So the camera is driven
// directly, which is the right answer anyway, because it means camera movement
// never touches React. A drag mutates three numbers and marks the scene dirty;
// no state, no re-render, no reconciliation between the finger and the frame.
//
// The gesture map is the one every 3D tool uses, so it needs no teaching:
//
//   one finger drag    orbit
//   two finger drag    pan, in the plane of the screen
//   pinch              dolly
//
// Damping is momentum, not smoothing. A flick keeps going and settles, which
// is what makes a touch camera feel like it has weight instead of feeling like
// it is lagging.

import * as THREE from 'three';
import { BOARD, TABLE_Y, UNO } from './boardSpec';
import type { CameraView } from './types';

/** How much of the leftover velocity survives each 60 Hz frame. */
const DAMPING = 0.86;
/** Below this the camera is considered still and the scene can stop drawing. */
const STILL = 1e-4;

const MIN_RADIUS = 1.1;
const MAX_RADIUS = 16;
/** Straight down. Not zero, because a perfectly polar camera has no azimuth. */
const MIN_PHI = 0.06;
/**
 * Just above the table. The underside of a breadboard has nothing on it, and
 * letting the camera pass through the table is the fastest way to make a 3D
 * view feel broken.
 */
const MAX_PHI = 1.47;

export interface CameraPose {
  /** Azimuth, radians. */
  theta: number;
  /** Polar angle from straight up, radians. */
  phi: number;
  radius: number;
  target: THREE.Vector3;
}

const VIEWS: Record<CameraView, Omit<CameraPose, 'target'> & { target: [number, number, number] }> = {
  // The default: both boards in frame, seen from the learner's own side of the
  // bench at the angle a person actually leans in at.
  // Opens closer to overhead than a hero shot would.
  //
  // At phi 0.72 the board is seen at a steep angle and the hole grid vanishes
  // into foreshortening, so there is no way to tell where a part would land.
  // Nearer the top the rows and columns read as a grid, which is the whole
  // point of a breadboard, and closer in because a phone is not a monitor.
  fit: { theta: Math.PI / 2, phi: 0.42, radius: 6.4, target: [0, 0, -0.4] },
  // Straight down, for reading row and column labels and following a wire.
  top: { theta: Math.PI / 2, phi: MIN_PHI, radius: 6.2, target: [0, 0, -0.5] },
  // Along the board, for seeing how tall the parts are and whether a leg is
  // really in its hole.
  front: { theta: Math.PI / 2, phi: 1.32, radius: 4.4, target: [0, 0.15, 0.1] },
  left: { theta: Math.PI, phi: 1.0, radius: 5.6, target: [0, 0.1, -0.3] },
  // Close in on the middle of the board, for placing a part.
  detail: { theta: Math.PI / 2.3, phi: 0.85, radius: 2.4, target: [0, 0.1, 0] },
};

/** How far the target is allowed to wander, so the boards cannot be lost. */
const PAN_LIMIT = {
  x: BOARD.length / 2 + 1.2,
  z: Math.max(BOARD.width, Math.abs(UNO.z) + UNO.width / 2) + 1.2,
  yMin: TABLE_Y,
  yMax: 1.4,
};

const _offset = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class OrbitRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();

  private theta = VIEWS.fit.theta;
  private phi = VIEWS.fit.phi;
  private radius = VIEWS.fit.radius;

  private dTheta = 0;
  private dPhi = 0;
  private dRadius = 1;
  private readonly dPan = new THREE.Vector3();

  /** Set while a preset is playing, so a finger can interrupt it. */
  private flight: {
    t: number;
    duration: number;
    from: CameraPose;
    to: CameraPose;
  } | null = null;

  private readonly fromPose: CameraPose = { theta: 0, phi: 0, radius: 0, target: new THREE.Vector3() };
  private readonly toPose: CameraPose = { theta: 0, phi: 0, radius: 0, target: new THREE.Vector3() };

  constructor(aspect: number) {
    // A long lens. A wide one exaggerates the board's perspective until the far
    // end of it looks like a different size of board, which is exactly the
    // confusion a beginner does not need while counting to column 40.
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.08, 60);
    this.target.set(...VIEWS.fit.target);
    this.apply();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** One finger. Screen pixels in, radians out. */
  orbit(dxPixels: number, dyPixels: number, viewportHeight: number): void {
    this.flight = null;
    const scale = (Math.PI * 1.6) / Math.max(1, viewportHeight);
    this.dTheta -= dxPixels * scale;
    this.dPhi -= dyPixels * scale;
  }

  /** Two fingers. Moves the target in the camera's own screen plane. */
  pan(dxPixels: number, dyPixels: number, viewportHeight: number): void {
    this.flight = null;
    // Scale by the distance so a pan moves the same amount of BOARD per pixel
    // whatever the zoom, which is the only version that feels direct.
    const perPixel = (2 * this.radius * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, viewportHeight);
    this.camera.matrixWorld.extractBasis(_right, _up, _forward);
    this.dPan.addScaledVector(_right, -dxPixels * perPixel);
    this.dPan.addScaledVector(_up, dyPixels * perPixel);
  }

  /** Pinch. `ratio` is the new finger separation over the old one. */
  dolly(ratio: number): void {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    this.flight = null;
    this.dRadius /= ratio;
  }

  /** Fly to a named view. */
  goTo(view: CameraView, seconds = 0.55): void {
    const v = VIEWS[view];
    this.fromPose.theta = this.theta;
    this.fromPose.phi = this.phi;
    this.fromPose.radius = this.radius;
    this.fromPose.target.copy(this.target);
    // Take the short way round the board rather than unwinding through the back.
    let toTheta = v.theta;
    while (toTheta - this.theta > Math.PI) toTheta -= Math.PI * 2;
    while (toTheta - this.theta < -Math.PI) toTheta += Math.PI * 2;
    this.toPose.theta = toTheta;
    this.toPose.phi = v.phi;
    this.toPose.radius = v.radius;
    this.toPose.target.set(...v.target);
    this.flight = { t: 0, duration: Math.max(0.001, seconds), from: this.fromPose, to: this.toPose };
    this.dTheta = 0; this.dPhi = 0; this.dRadius = 1; this.dPan.set(0, 0, 0);
  }

  /** Snap without animating, for the first frame. */
  jumpTo(view: CameraView): void {
    const v = VIEWS[view];
    this.theta = v.theta;
    this.phi = v.phi;
    this.radius = v.radius;
    this.target.set(...v.target);
    this.apply();
  }

  /**
   * Advance one frame.
   *
   * Returns true while the camera is still moving, which is what lets the
   * scene stop rendering when nobody is touching it. A phone that draws sixty
   * frames a second at a still board is a phone that is warm in a pocket.
   */
  update(dt: number): boolean {
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(f.duration, f.t + dt);
      const k = f.t / f.duration;
      // Ease out cubic: fast away, gentle arrival. An eased arrival is the
      // difference between a camera move that informs and one that startles.
      const e = 1 - Math.pow(1 - k, 3);
      this.theta = f.from.theta + (f.to.theta - f.from.theta) * e;
      this.phi = f.from.phi + (f.to.phi - f.from.phi) * e;
      this.radius = f.from.radius + (f.to.radius - f.from.radius) * e;
      this.target.lerpVectors(f.from.target, f.to.target, e);
      if (f.t >= f.duration) this.flight = null;
      this.apply();
      return true;
    }

    const moving =
      Math.abs(this.dTheta) > STILL ||
      Math.abs(this.dPhi) > STILL ||
      Math.abs(this.dRadius - 1) > STILL ||
      this.dPan.lengthSq() > STILL * STILL;

    if (!moving) {
      this.dTheta = 0; this.dPhi = 0; this.dRadius = 1; this.dPan.set(0, 0, 0);
      return false;
    }

    this.theta += this.dTheta;
    this.phi = Math.min(MAX_PHI, Math.max(MIN_PHI, this.phi + this.dPhi));
    this.radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, this.radius * this.dRadius));
    this.target.add(this.dPan);
    this.target.x = Math.min(PAN_LIMIT.x, Math.max(-PAN_LIMIT.x, this.target.x));
    this.target.z = Math.min(PAN_LIMIT.z, Math.max(-PAN_LIMIT.z, this.target.z));
    this.target.y = Math.min(PAN_LIMIT.yMax, Math.max(PAN_LIMIT.yMin, this.target.y));

    // Momentum, applied per frame but scaled to real elapsed time so a dropped
    // frame does not change how far a flick carries.
    const decay = Math.pow(DAMPING, dt * 60);
    this.dTheta *= decay;
    this.dPhi *= decay;
    this.dRadius = 1 + (this.dRadius - 1) * decay;
    this.dPan.multiplyScalar(decay);

    this.apply();
    return true;
  }

  /** Stop dead. Used when a finger lands, so a flick can be caught. */
  arrest(): void {
    this.flight = null;
    this.dTheta = 0; this.dPhi = 0; this.dRadius = 1; this.dPan.set(0, 0, 0);
  }

  get pose(): CameraPose {
    return { theta: this.theta, phi: this.phi, radius: this.radius, target: this.target.clone() };
  }

  /** How far the camera is from its target, for scaling hit radii and lifts. */
  get distance(): number { return this.radius; }

  private apply(): void {
    _offset.setFromSphericalCoords(this.radius, this.phi, this.theta);
    this.camera.position.copy(this.target).add(_offset);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
