// ── Ohmlet circuit engine (#67, Option C: our own simulator) ──
//
// A small, CORRECT solver — not a placeholder. It runs Modified Nodal Analysis
// (MNA) on a netlist and returns real node voltages and branch currents. It
// handles:
//   • ideal voltage sources, resistors
//   • LEDs and generic diodes (piecewise-linear model, on/off iteration)
//   • capacitors (backward-Euler companion model → real transient time-stepping)
//   • NPN bipolar transistors (off / saturated / active region iteration)
//
// DC operating point: `solve(netlist)` (capacitors treated as open).
// Transient: `initTransient` + `stepTransient` advance real time in dt steps,
// so RC charging, blink timing, and smoothing are physically real, not scripted.
//
// Node 0 is always ground (0 V). Nodes are integers.

export type Comp =
  | { kind: 'V'; id: string; pos: number; neg: number; value: number }            // ideal source, pos=+ neg=-
  | { kind: 'R'; id: string; a: number; b: number; value: number }                // resistor (ohms)
  | { kind: 'LED'; id: string; anode: number; cathode: number; vf?: number; ron?: number }
  | { kind: 'D'; id: string; anode: number; cathode: number; vf?: number; ron?: number }   // generic diode
  | { kind: 'C'; id: string; a: number; b: number; value: number }                // capacitor (farads)
  | { kind: 'Q'; id: string; base: number; collector: number; emitter: number; beta?: number } // NPN
  | { kind: 'OP'; id: string; vp: number; vn: number; out: number; gain?: number; vhi: number; vlo: number }; // op-amp / comparator

export interface SolveResult {
  /** node id -> volts (node 0 = 0V) */
  V: Record<number, number>;
  /** component id -> amps (R a→b; LED/D anode→cathode; C a→b; Q collector current; "id/b" = base current) */
  I: Record<string, number>;
  ok: boolean;
}

const LED_VF = 2.0;   // red LED forward drop (V)
const LED_RON = 15;   // LED on-resistance (ohms)
const D_VF = 0.6;     // silicon diode forward drop (V)
const D_RON = 8;      // diode on-resistance (ohms)

// NPN model constants
const Q_VBE = 0.7;    // base-emitter turn-on (V)
const Q_RBE = 40;     // base-emitter on-resistance (ohms)
const Q_RSAT = 10;    // collector-emitter resistance when saturated (→ ~0.2V at 20mA)
const Q_BETA = 100;   // default current gain

type DiodeLike = Extract<Comp, { kind: 'LED' | 'D' }>;
const diodeVf = (c: DiodeLike) => (c.kind === 'LED' ? (c.vf ?? LED_VF) : (c.vf ?? D_VF));
const diodeRon = (c: DiodeLike) => (c.kind === 'LED' ? (c.ron ?? LED_RON) : (c.ron ?? D_RON));

interface SolveOpts {
  caps: 'open' | 'companion';
  dt?: number;
  capV?: Record<string, number>; // previous-step capacitor voltages (a - b)
}

/** Core MNA solve with nonlinear (diode/LED/BJT) region iteration. */
function solveAt(netlist: Comp[], opts: SolveOpts): SolveResult {
  let maxNode = 0;
  for (const c of netlist) {
    if (c.kind === 'V') maxNode = Math.max(maxNode, c.pos, c.neg);
    else if (c.kind === 'R' || c.kind === 'C') maxNode = Math.max(maxNode, c.a, c.b);
    else if (c.kind === 'LED' || c.kind === 'D') maxNode = Math.max(maxNode, c.anode, c.cathode);
    else if (c.kind === 'Q') maxNode = Math.max(maxNode, c.base, c.collector, c.emitter);
    else maxNode = Math.max(maxNode, c.vp, c.vn, c.out);
  }
  const n = maxNode;
  const sources = netlist.filter((c): c is Extract<Comp, { kind: 'V' }> => c.kind === 'V');
  const m = sources.length;
  const ops = netlist.filter((c): c is Extract<Comp, { kind: 'OP' }> => c.kind === 'OP');
  const opRegion: Record<string, 'lin' | 'hi' | 'lo'> = {};
  for (const o of ops) opRegion[o.id] = 'lin';

  // nonlinear state
  const diodes = netlist.filter((c): c is DiodeLike => c.kind === 'LED' || c.kind === 'D');
  const dOn: Record<string, boolean> = {};
  for (const d of diodes) dOn[d.id] = true;

  const qs = netlist.filter((c): c is Extract<Comp, { kind: 'Q' }> => c.kind === 'Q');
  const qBaseOn: Record<string, boolean> = {};
  const qRegion: Record<string, 'off' | 'sat' | 'active'> = {};
  const qIb: Record<string, number> = {};
  for (const q of qs) { qBaseOn[q.id] = true; qRegion[q.id] = 'sat'; qIb[q.id] = 0; }

  let V: Record<number, number> = { 0: 0 };
  let I: Record<string, number> = {};
  let ok = true;

  for (let iter = 0; iter < 60; iter++) {
    const size = n + m + ops.length;
    const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const z: number[] = new Array(size).fill(0);

    const gStamp = (a: number, b: number, g: number) => {
      if (a > 0) A[a - 1][a - 1] += g;
      if (b > 0) A[b - 1][b - 1] += g;
      if (a > 0 && b > 0) { A[a - 1][b - 1] -= g; A[b - 1][a - 1] -= g; }
    };
    const jStamp = (node: number, amps: number) => { if (node > 0) z[node - 1] += amps; };
    const diodeStamp = (anode: number, cathode: number, vf: number, ron: number) => {
      gStamp(anode, cathode, 1 / ron);
      jStamp(anode, vf / ron);
      jStamp(cathode, -vf / ron);
    };

    // resistors
    for (const c of netlist) if (c.kind === 'R' && c.value > 0) gStamp(c.a, c.b, 1 / c.value);

    // capacitors
    for (const c of netlist) if (c.kind === 'C') {
      if (opts.caps === 'companion' && opts.dt && opts.dt > 0) {
        const gc = c.value / opts.dt;
        const vprev = opts.capV?.[c.id] ?? 0;
        gStamp(c.a, c.b, gc);
        jStamp(c.a, gc * vprev);
        jStamp(c.b, -gc * vprev);
      }
      // 'open': a capacitor blocks DC → contribute nothing
    }

    // diodes + LEDs
    for (const d of diodes) if (dOn[d.id]) diodeStamp(d.anode, d.cathode, diodeVf(d), diodeRon(d));

    // transistors
    for (const q of qs) {
      if (qBaseOn[q.id]) diodeStamp(q.base, q.emitter, Q_VBE, Q_RBE);
      const region = qRegion[q.id];
      if (region === 'sat') gStamp(q.collector, q.emitter, 1 / Q_RSAT);
      else if (region === 'active') {
        const ic = (q.beta ?? Q_BETA) * qIb[q.id];
        jStamp(q.collector, -ic);
        jStamp(q.emitter, ic);
      }
    }

    // ideal voltage sources (augmented rows)
    sources.forEach((s, k) => {
      const row = n + k;
      if (s.pos > 0) { A[row][s.pos - 1] += 1; A[s.pos - 1][row] += 1; }
      if (s.neg > 0) { A[row][s.neg - 1] -= 1; A[s.neg - 1][row] -= 1; }
      z[row] = s.value;
    });

    // op-amps (augmented branch per amp): output supplies current; the row sets V(out)
    ops.forEach((o, k) => {
      const row = n + m + k;
      if (o.out > 0) { A[row][o.out - 1] += 1; A[o.out - 1][row] += 1; }
      const reg = opRegion[o.id];
      if (reg === 'lin') {
        const A0 = o.gain ?? 1e5;
        if (o.vp > 0) A[row][o.vp - 1] -= A0;
        if (o.vn > 0) A[row][o.vn - 1] += A0;
        z[row] = 0;
      } else {
        z[row] = reg === 'hi' ? o.vhi : o.vlo; // railed: V(out) = rail
      }
    });

    const x = gaussSolve(A, z);
    if (!x) { ok = false; break; }

    V = { 0: 0 };
    for (let i = 1; i <= n; i++) V[i] = x[i - 1];

    // update nonlinear states
    let changed = false;

    // diode currents → switch off reverse-biased
    for (const d of diodes) {
      if (dOn[d.id]) {
        const i = (V[d.anode] - V[d.cathode] - diodeVf(d)) / diodeRon(d);
        if (i < 0) { dOn[d.id] = false; changed = true; }
      }
    }

    // transistor regions
    for (const q of qs) {
      const vbe = V[q.base] - V[q.emitter];
      const beta = q.beta ?? Q_BETA;
      // base diode on/off
      if (qBaseOn[q.id] && vbe < Q_VBE * 0.5) { qBaseOn[q.id] = false; changed = true; }
      else if (!qBaseOn[q.id] && vbe > Q_VBE) { qBaseOn[q.id] = true; changed = true; }
      const ib = qBaseOn[q.id] ? Math.max(0, (vbe - Q_VBE) / Q_RBE) : 0;
      qIb[q.id] = ib;
      const icmax = beta * ib;
      const vce = V[q.collector] - V[q.emitter];
      let next: 'off' | 'sat' | 'active';
      if (ib <= 0) next = 'off';
      else if (qRegion[q.id] === 'active') {
        // active forces Ic=icmax; if that pushes Vce into saturation, switch
        next = vce < icmax * Q_RSAT ? 'sat' : 'active';
      } else {
        // saturated resistor model; if it would draw more than the base allows, go active
        const icSat = vce / Q_RSAT;
        next = icSat > icmax ? 'active' : 'sat';
      }
      if (next !== qRegion[q.id]) { qRegion[q.id] = next; changed = true; }
    }

    // op-amp output rails
    for (const o of ops) {
      const A0 = o.gain ?? 1e5;
      const demand = A0 * ((V[o.vp] ?? 0) - (V[o.vn] ?? 0));
      let next: 'lin' | 'hi' | 'lo' = 'lin';
      if (demand >= o.vhi) next = 'hi';
      else if (demand <= o.vlo) next = 'lo';
      if (next !== opRegion[o.id]) { opRegion[o.id] = next; changed = true; }
    }

    if (!changed || iter === 59) {
      // final currents
      I = {};
      sources.forEach((s, k) => { I[s.id] = x[n + k]; });
      for (const c of netlist) {
        if (c.kind === 'R') I[c.id] = c.value > 0 ? (V[c.a] - V[c.b]) / c.value : 0;
        else if (c.kind === 'LED' || c.kind === 'D') I[c.id] = dOn[c.id] ? (V[c.anode] - V[c.cathode] - diodeVf(c)) / diodeRon(c) : 0;
        else if (c.kind === 'C') {
          if (opts.caps === 'companion' && opts.dt && opts.dt > 0) {
            const gc = c.value / opts.dt; const vprev = opts.capV?.[c.id] ?? 0;
            I[c.id] = gc * ((V[c.a] - V[c.b]) - vprev);
          } else I[c.id] = 0;
        } else if (c.kind === 'Q') {
          const region = qRegion[c.id];
          I[c.id] = region === 'sat' ? (V[c.collector] - V[c.emitter]) / Q_RSAT
            : region === 'active' ? (c.beta ?? Q_BETA) * qIb[c.id] : 0;
          I[`${c.id}/b`] = qIb[c.id];
        }
      }
      ops.forEach((o, k) => { I[o.id] = x[n + m + k]; });
      break;
    }
  }

  return { V, I, ok };
}

/** DC operating point. Capacitors are open (block DC). */
export function solve(netlist: Comp[]): SolveResult {
  return solveAt(netlist, { caps: 'open' });
}

export interface TransientState { capV: Record<string, number>; t: number }

/** Initialise a transient run. Capacitors start uncharged unless `init` says otherwise. */
export function initTransient(netlist: Comp[], init?: Record<string, number>): TransientState {
  const capV: Record<string, number> = {};
  for (const c of netlist) if (c.kind === 'C') capV[c.id] = init?.[c.id] ?? 0;
  return { capV, t: 0 };
}

/** Advance one timestep of dt seconds; mutates state, returns the solved frame. */
export function stepTransient(netlist: Comp[], st: TransientState, dt: number): SolveResult {
  const res = solveAt(netlist, { caps: 'companion', dt, capV: st.capV });
  for (const c of netlist) if (c.kind === 'C') st.capV[c.id] = (res.V[c.a] ?? 0) - (res.V[c.b] ?? 0);
  st.t += dt;
  return res;
}

/** Gaussian elimination with partial pivoting. Returns null if singular. */
function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

/** mA helper. */
export const toMA = (amps: number) => amps * 1000;
