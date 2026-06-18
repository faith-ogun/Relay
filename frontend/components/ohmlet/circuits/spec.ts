// ── Circuit DSL: types ──
//
// A circuit diagram authored as DATA instead of hand-coded SVG. The renderer
// (SpecCircuit.tsx) draws a spec from the shared component palette, and the
// region registry derives each spec's clickable regions from its node ids
// automatically, so the lesson linter validates data-authored circuits for free.
//
// This is the scalable path for the dozens of new diagrams Units 6+ need
// (RC, transistors, op-amps, …). The original 8 hand-coded circuits remain as
// curated SVGs in CircuitDiagram.tsx; both share the same primitives.

export type ComponentKind =
  | 'battery'
  | 'resistor'
  | 'led'
  | 'ldr'
  | 'capacitor'
  | 'diode'
  | 'transistor_npn'
  | 'opamp'
  | 'ground'
  | 'junction'
  | 'arduino_pin'
  | 'buzzer'
  | 'switch';

export type Rotation = 0 | 90 | 180 | 270;

export interface SpecNode {
  /** Unique id; doubles as the clickable region id for spot_error / identify. */
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation?: Rotation;
  label?: string;
  /** arduino_pin label, e.g. "A0". */
  pin?: string;
  /** led colour. */
  color?: string;
  /** capacitor: electrolytic (curved plate + polarity). */
  polarized?: boolean;
  /** switch: drawn open. */
  open?: boolean;
  /** Set false for decorative nodes (junctions) that should not be selectable. */
  clickable?: boolean;
}

export interface SpecWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  error?: boolean;
}

export interface SpecAnnotation {
  x: number;
  y: number;
  text: string;
  color?: string;
  size?: number;
  align?: 'start' | 'middle' | 'end';
}

export interface SpecArrow {
  x: number;
  y: number;
  rotation?: number;
  label?: string;
}

export interface CircuitSpec {
  id: string;
  title?: string;
  width?: number;
  height?: number;
  nodes: SpecNode[];
  wires?: SpecWire[];
  annotations?: SpecAnnotation[];
  /** Drawn only when showCurrentFlow is on. */
  currentFlow?: SpecArrow[];
}

/** A node is a selectable region unless it is a junction or explicitly clickable:false. */
export const nodeIsRegion = (n: SpecNode): boolean => n.kind !== 'junction' && n.clickable !== false;

/** The clickable region ids a spec exposes (used by the registry + linter). */
export const specRegions = (spec: CircuitSpec): string[] => spec.nodes.filter(nodeIsRegion).map((n) => n.id);
