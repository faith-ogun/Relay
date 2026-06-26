# ADR-0003: Build our own circuit simulation engine

- **Status:** Accepted
- **Date:** 2026-06-26 (decision made during #67)

## Context

The simulator needed to feel like a first-class part of the product (#67), at the
scale of the 400+ lesson curriculum: a library of circuits across categories,
plus a free-form build-your-own editor, live electrical results, transient
behaviour (caps, 555), nonlinear parts (diodes, transistors, op-amps), and
real-time tutor narration tied to the actual node voltages.

Options considered:
- **A — embed Falstad / an existing JS simulator.** Fast to start, but a
  foreign data model, licensing/branding friction, and little control over the
  pedagogy or the look. Hard to wire our tutor into its internals.
- **B — wrap SPICE (WASM).** Accurate, but heavyweight, awkward for live
  per-keystroke solving, and overkill for our component set.
- **C — write our own DC + transient solver.** More upfront work; total control.

## Decision

Option C. We built a Modified Nodal Analysis (MNA) solver with nonlinear region
iteration (`frontend/components/ohmlet/sim/engine.ts`): resistors, sources, LEDs,
diodes, capacitors (backward-Euler companion), NPN transistors, op-amps/
comparators (finite-gain VCVS that rails), and a behavioural 555. Robustness via
GMIN on every node and bidirectional diode iteration. The simulator is a
data-driven registry of circuits rendered by a generic schematic renderer.

For running *real* Arduino code we use **AVR8js** (MIT) in the browser, fed by HEX
from our sandboxed compile service (a separate decision, ADR-0002 covers the
service split).

## Consequences

- Full control over physics, pedagogy, branding, and tutor integration; every
  result is ours to explain. Physics is verified against hand calculations.
- We own the maintenance and the edge cases (singular matrices, convergence).
  Accepted — debugging the solver is the job, and the payoff is a simulator that
  feels native rather than bolted on.
- New parts (inductor, MOSFET, AC source) are incremental additions to the
  engine + registry, not a dependency upgrade.
