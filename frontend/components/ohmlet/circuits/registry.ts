// ── Circuit registry ──
//
// The single source of truth for which circuit diagrams exist and which
// clickable regions each one exposes. Lessons that use `spot_error` or
// `identify_component` point at a circuit + a region id; the lesson linter
// checks those references against this registry so a typo (e.g. clicking a
// region that does not exist) is caught before it ships, not by a learner who
// finds the exercise unselectable.
//
// Regions here mirror the clickable `id`/`onClick` targets defined in
// `CircuitDiagram.tsx`. When a circuit gains or renames a region there, update
// it here too. (The circuit DSL, when a diagram is authored as data, derives its
// regions automatically — see `circuits/spec.ts`.)

import { SPEC_CIRCUITS } from './specs';
import { specRegions } from './spec';

export interface CircuitMeta {
  /** Human label for tooling and the /author preview. */
  label: string;
  /** Clickable region ids a learner can select (spot_error / identify_component). */
  regions: string[];
}

// Hand-written regions for the original curated (hand-coded) circuits.
const LEGACY_REGIONS: Record<string, CircuitMeta> = {
  series_circuit: {
    label: 'Series circuit (battery → resistor → LED)',
    regions: ['battery', 'resistor', 'led'],
  },
  parallel_circuit: {
    label: 'Parallel circuit (two LED branches)',
    regions: ['battery', 'r1', 'led1', 'r2', 'led2'],
  },
  voltage_divider: {
    label: 'Voltage divider (R1 / R2 → A0)',
    regions: ['r1', 'r2', 'a0'],
  },
  ldr_alarm: {
    label: 'Light-activated alarm (LDR divider + LED output)',
    regions: ['5v', 'a0', 'd9', 'gnd', 'ldr', 'resistor', 'led_resistor', 'led'],
  },
  led_no_resistor: {
    label: 'LED with no current-limiting resistor (fault)',
    regions: ['battery', 'led', 'missing_resistor'],
  },
  reversed_led: {
    label: 'Reversed LED (fault)',
    regions: ['battery', 'resistor', 'reversed_led'],
  },
  short_circuit: {
    label: 'Short circuit bypassing the load (fault)',
    regions: ['battery', 'resistor', 'led', 'short_wire'],
  },
  breadboard_layout: {
    label: 'Breadboard connection layout',
    regions: ['row_group', 'power_rail', 'ground_rail'],
  },
};

// Regions for data-authored (DSL) circuits are derived from their node ids.
const SPEC_REGION_META: Record<string, CircuitMeta> = Object.fromEntries(
  Object.values(SPEC_CIRCUITS).map((spec) => [spec.id, { label: spec.title ?? spec.id, regions: specRegions(spec) }]),
);

/** Every circuit the app can render: curated (hand-coded) + data-authored (DSL). */
export const CIRCUIT_REGIONS: Record<string, CircuitMeta> = { ...LEGACY_REGIONS, ...SPEC_REGION_META };

/** All circuit ids the app can render today. */
export const KNOWN_CIRCUITS = Object.keys(CIRCUIT_REGIONS);

/** True if `id` is a renderable circuit. */
export const isKnownCircuit = (id: string): boolean => id in CIRCUIT_REGIONS;

/** Valid clickable regions for a circuit, or [] if unknown. */
export const regionsFor = (id: string): string[] => CIRCUIT_REGIONS[id]?.regions ?? [];
