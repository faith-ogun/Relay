// ── The 3D breadboard sandbox ──
//
// Mount `Sandbox3D`. Everything else in here exists so the shell can build the
// board it hands in, read the circuit back, and describe a hole to a learner
// without reaching inside the scene.

export { Sandbox3D, pinDriveFromDuty } from './Sandbox3D';
export type { Sandbox3DProps, Sandbox3DHandle } from './Sandbox3D';

export type {
  CameraView, HoleId, HoleInfo, HoleTap, LedColor, NetKey, PartKind, PartReading,
  PerfSample, PlacedPart, Quality, Rotation, SandboxSolution, SandboxTool, Wire, WireColor,
} from './types';

// Board addressing. `holeId.bb(11, 4)` is e12; the printed labels are one
// based and the ids are zero based, which is the one place that has to be
// crossed carefully and is done for you by `holeInfo`.
export {
  holeId, holeInfo, holeWorld, holesInNet, netOfHole, offsetHole, sameNet, allHoles,
} from './topology';

export {
  PART_SPECS, isPlaceable, ldrOhms, newPartId, partHoles, partValue,
  starterBuild, thermistorOhms, LED_VF,
} from './parts';
export type { PartSpec, PinSpec } from './parts';

export { bandColors } from './materials';

// The circuit engine seam. `solveBoard` takes the same board the component
// takes and returns real node voltages and branch currents, so a shell can
// show a reading without waiting for a frame.
export { buildNetlist, readSolution, solveBoard, voltageAtHole, BoardTransient } from './netlist';
export type { NetlistInput, NetlistResult } from './netlist';

// Board geometry, for a shell that wants to label the view or size a control
// against the real board.
export { BOARD, COLS, PITCH, RAILS, RAIL_HOLES, ROWS, ROW_LETTERS, TIE_POINTS, UNO_PINS } from './boardSpec';
