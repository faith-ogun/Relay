// ── Ohmlet circuit engine (#67, Option C: our own simulator) ──
//
// A small, CORRECT DC solver — not a placeholder. It runs Modified Nodal
// Analysis (MNA) on a netlist of ideal voltage sources, resistors, and LEDs
// (piecewise-linear diode model), returning real node voltages and per-branch
// currents. This is the foundation we grow toward the full teaching simulator
// (more components, transient/AC, AVR8js for Arduino sketches) — see
// metadata/falstad-simulator-research.md.
//
// Node 0 is always ground (0 V). Nodes are integers.

export type Comp =
  | { kind: 'V'; id: string; pos: number; neg: number; value: number }            // ideal source, pos=+ neg=-
  | { kind: 'R'; id: string; a: number; b: number; value: number }                // resistor (ohms)
  | { kind: 'LED'; id: string; anode: number; cathode: number; vf?: number; ron?: number };

export interface SolveResult {
  /** node id -> volts (node 0 = 0V) */
  V: Record<number, number>;
  /** component id -> amps (sign: V pos→neg internally; R a→b; LED anode→cathode) */
  I: Record<string, number>;
  ok: boolean;
}

const LED_VF = 2.0;   // red LED forward drop (V)
const LED_RON = 15;   // LED on-resistance (ohms) — keeps "no resistor" current finite (and large → flagged)

/** Solve a netlist. Iterates LED on/off states (piecewise-linear diode). */
export function solve(netlist: Comp[]): SolveResult {
  // Collect node count (max node id).
  let maxNode = 0;
  for (const c of netlist) {
    if (c.kind === 'V') maxNode = Math.max(maxNode, c.pos, c.neg);
    else if (c.kind === 'R') maxNode = Math.max(maxNode, c.a, c.b);
    else maxNode = Math.max(maxNode, c.anode, c.cathode);
  }
  const n = maxNode; // unknown node voltages are 1..n (node 0 = ground)
  const sources = netlist.filter((c): c is Extract<Comp, { kind: 'V' }> => c.kind === 'V');
  const m = sources.length;

  // LED conduction state — start all ON, then turn off any that come out reverse.
  const ledOn: Record<string, boolean> = {};
  for (const c of netlist) if (c.kind === 'LED') ledOn[c.id] = true;

  let V: Record<number, number> = {};
  let I: Record<string, number> = {};
  let ok = true;

  for (let iter = 0; iter < 8; iter++) {
    const size = n + m;
    const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const z: number[] = new Array(size).fill(0);

    const gStamp = (a: number, b: number, g: number) => {
      // stamp a conductance between nodes a,b (skip ground rows/cols)
      if (a > 0) A[a - 1][a - 1] += g;
      if (b > 0) A[b - 1][b - 1] += g;
      if (a > 0 && b > 0) { A[a - 1][b - 1] -= g; A[b - 1][a - 1] -= g; }
    };
    const jStamp = (node: number, amps: number) => { if (node > 0) z[node - 1] += amps; };

    // resistors + conducting LEDs (LED = R_on + a current source for the Vf drop)
    for (const c of netlist) {
      if (c.kind === 'R' && c.value > 0) gStamp(c.a, c.b, 1 / c.value);
      else if (c.kind === 'LED' && ledOn[c.id]) {
        const ron = c.ron ?? LED_RON, vf = c.vf ?? LED_VF;
        gStamp(c.anode, c.cathode, 1 / ron);
        // Norton equiv of the Vf drop (Thevenin Vf in series with R_on)
        jStamp(c.anode, vf / ron);
        jStamp(c.cathode, -vf / ron);
      }
    }
    // ideal voltage sources (augmented rows)
    sources.forEach((s, k) => {
      const row = n + k;
      if (s.pos > 0) { A[row][s.pos - 1] += 1; A[s.pos - 1][row] += 1; }
      if (s.neg > 0) { A[row][s.neg - 1] -= 1; A[s.neg - 1][row] -= 1; }
      z[row] = s.value;
    });

    const x = gaussSolve(A, z);
    if (!x) { ok = false; break; }

    V = { 0: 0 };
    for (let i = 1; i <= n; i++) V[i] = x[i - 1];
    I = {};
    sources.forEach((s, k) => { I[s.id] = x[n + k]; });
    for (const c of netlist) {
      if (c.kind === 'R') I[c.id] = c.value > 0 ? (V[c.a] - V[c.b]) / c.value : 0;
      else if (c.kind === 'LED') {
        const ron = c.ron ?? LED_RON, vf = c.vf ?? LED_VF;
        I[c.id] = ledOn[c.id] ? (V[c.anode] - V[c.cathode] - vf) / ron : 0;
      }
    }

    // Reverse-biased LEDs (negative forward current) switch off; re-solve.
    let changed = false;
    for (const c of netlist) {
      if (c.kind === 'LED' && ledOn[c.id] && I[c.id] < 0) { ledOn[c.id] = false; changed = true; }
    }
    if (!changed) break;
  }

  return { V, I, ok };
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
