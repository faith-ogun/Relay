import React, { useMemo, useState } from 'react';
import { AlertTriangle, Cpu, Flame, Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { solve, toMA, type Comp } from '../sim/engine';

/**
 * SimulatorView (#67) — Ohmlet's own circuit simulator (Option C).
 *
 * The numbers are REAL: a nodal-analysis solver (engine.ts) computes node
 * voltages and branch currents live as you change values. Current flow is
 * animated proportional to the actual computed current; the LED brightness,
 * the voltage/current readouts, the power ("heat") figures, and the warnings
 * all come from the solver — nothing here is faked. v1 covers DC resistive +
 * LED circuits on curated boards; free-form building, more components, and
 * Arduino sketch execution (AVR8js) are the next phases.
 */

type ParamDef = { key: string; label: string; min: number; max: number; step: number; unit: string; def: number };

interface Preset {
  id: string;
  name: string;
  desc: string;
  params: ParamDef[];
  build: (p: Record<string, number>) => Comp[];
}

const PRESETS: Preset[] = [
  {
    id: 'series',
    name: 'LED + resistor',
    desc: 'The classic. A resistor limits the current so the LED survives.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R', label: 'Resistor', min: 33, max: 1000, step: 1, unit: 'Ω', def: 220 },
    ],
    build: (p) => [
      { kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V },
      { kind: 'R', id: 'r', a: 1, b: 2, value: p.R },
      { kind: 'LED', id: 'led', anode: 2, cathode: 0 },
    ],
  },
  {
    id: 'divider',
    name: 'Voltage divider',
    desc: 'Two resistors split the voltage. Swap R2 for an LDR and it becomes a light sensor.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 12, step: 0.5, unit: 'V', def: 5 },
      { key: 'R1', label: 'R1 (top)', min: 100, max: 10000, step: 10, unit: 'Ω', def: 1000 },
      { key: 'R2', label: 'R2 (bottom)', min: 100, max: 10000, step: 10, unit: 'Ω', def: 2000 },
    ],
    build: (p) => [
      { kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V },
      { kind: 'R', id: 'r1', a: 1, b: 2, value: p.R1 },
      { kind: 'R', id: 'r2', a: 2, b: 0, value: p.R2 },
    ],
  },
  {
    id: 'parallel',
    name: 'Two LEDs in parallel',
    desc: 'Same supply, different resistors — see why the smaller resistor glows brighter.',
    params: [
      { key: 'V', label: 'Supply', min: 3, max: 9, step: 0.5, unit: 'V', def: 5 },
      { key: 'R1', label: 'R · LED 1', min: 33, max: 1000, step: 1, unit: 'Ω', def: 220 },
      { key: 'R2', label: 'R · LED 2', min: 33, max: 1000, step: 1, unit: 'Ω', def: 470 },
    ],
    build: (p) => [
      { kind: 'V', id: 'bat', pos: 1, neg: 0, value: p.V },
      { kind: 'R', id: 'r1', a: 1, b: 2, value: p.R1 },
      { kind: 'LED', id: 'l1', anode: 2, cathode: 0 },
      { kind: 'R', id: 'r2', a: 1, b: 3, value: p.R2 },
      { kind: 'LED', id: 'l2', anode: 3, cathode: 0 },
    ],
  },
];

const LED_MAX_MA = 25; // a real 5mm LED tops out around 20-30mA

export const SimulatorView: React.FC = () => {
  const [presetId, setPresetId] = useState('series');
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const [params, setParams] = useState<Record<string, number>>(() =>
    Object.fromEntries(preset.params.map((d) => [d.key, d.def])),
  );
  const [running, setRunning] = useState(true);

  const switchPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setParams(Object.fromEntries(p.params.map((d) => [d.key, d.def])));
  };
  const resetParams = () => setParams(Object.fromEntries(preset.params.map((d) => [d.key, d.def])));

  const res = useMemo(() => solve(preset.build(params)), [preset, params]);

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Simulator</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">See the electricity move.</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-press-sm">
          <Zap className="h-3.5 w-3.5" /> Real physics engine
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-ohmlet-ink-soft">
        The currents and voltages below are solved live as you change values — nodal analysis, not a canned animation.
      </p>

      {/* preset tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const on = p.id === presetId;
          return (
            <button
              key={p.id}
              onClick={() => switchPreset(p.id)}
              className={`rounded-2xl border-2 px-4 py-2 text-sm font-black transition-all ${
                on ? 'border-ohmlet-ink bg-ohmlet-gold shadow-press-sm' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink hover:text-ohmlet-ink'
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* board */}
        <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink bg-white shadow-press">
          <div className="relative">
            <Board presetId={presetId} params={params} res={res} running={running} />
            <button
              onClick={() => setRunning((r) => !r)}
              className="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-white px-3 text-xs font-black shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {running ? 'Pause' : 'Run'}
            </button>
          </div>
          <Tutor presetId={presetId} params={params} res={res} />
        </div>

        {/* controls + readouts */}
        <div className="flex flex-col gap-4">
          <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Components</h3>
              <button onClick={resetParams} className="inline-flex items-center gap-1 text-xs font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            <p className="mt-1 text-xs font-semibold text-ohmlet-ink-soft">{preset.desc}</p>
            <div className="mt-4 space-y-4">
              {preset.params.map((d) => (
                <div key={d.key}>
                  <label className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">
                    <span>{d.label}</span>
                    <span className="text-sm font-black tabular-nums text-ohmlet-ink">{fmt(params[d.key])} {d.unit}</span>
                  </label>
                  <input
                    type="range"
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    value={params[d.key]}
                    onChange={(e) => setParams((p) => ({ ...p, [d.key]: +e.target.value }))}
                    className="mt-1.5 w-full accent-ohmlet-gold-deep"
                  />
                </div>
              ))}
            </div>
          </div>

          <Readouts presetId={presetId} params={params} res={res} />
        </div>
      </div>
    </div>
  );
};

// ── Derived analysis (real, from the solver) ──

interface Analysis {
  rows: { label: string; current: number; power: number; led?: boolean; over?: boolean }[];
  nodes: { label: string; v: number }[];
  totalPower: number;
  hottest?: string;
  warning?: string;
}

function analyze(presetId: string, params: Record<string, number>, res: ReturnType<typeof solve>): Analysis {
  const V = res.V, I = res.I;
  const power = (id: string, vacross: number) => Math.abs(vacross) * Math.abs(I[id] ?? 0);
  let rows: Analysis['rows'] = [];
  let nodes: Analysis['nodes'] = [];
  let warning: string | undefined;

  if (presetId === 'series') {
    const iLed = I.led ?? 0, over = toMA(iLed) > LED_MAX_MA;
    rows = [
      { label: 'Resistor', current: I.r ?? 0, power: power('r', (V[1] ?? 0) - (V[2] ?? 0)) },
      { label: 'LED', current: iLed, power: power('led', V[2] ?? 0), led: true, over },
    ];
    nodes = [{ label: 'Supply', v: V[1] ?? 0 }, { label: 'LED anode', v: V[2] ?? 0 }];
    if (over) warning = `LED current is ${fmt(toMA(iLed))} mA — over the ~${LED_MAX_MA} mA limit. A real LED would overheat. Raise the resistor.`;
  } else if (presetId === 'divider') {
    const i = I.r1 ?? 0;
    rows = [
      { label: 'R1 (top)', current: i, power: power('r1', (V[1] ?? 0) - (V[2] ?? 0)) },
      { label: 'R2 (bottom)', current: i, power: power('r2', V[2] ?? 0) },
    ];
    nodes = [{ label: 'Supply', v: V[1] ?? 0 }, { label: 'Vout', v: V[2] ?? 0 }];
  } else {
    const i1 = I.l1 ?? 0, i2 = I.l2 ?? 0;
    rows = [
      { label: 'LED 1', current: i1, power: power('l1', V[2] ?? 0), led: true, over: toMA(i1) > LED_MAX_MA },
      { label: 'LED 2', current: i2, power: power('l2', V[3] ?? 0), led: true, over: toMA(i2) > LED_MAX_MA },
    ];
    nodes = [{ label: 'Supply', v: V[1] ?? 0 }];
    if (toMA(i1) > LED_MAX_MA || toMA(i2) > LED_MAX_MA) warning = 'One LED is over its current limit — increase its resistor.';
  }

  const totalPower = rows.reduce((s, r) => s + r.power, 0);
  const hottest = rows.length ? rows.reduce((a, b) => (b.power > a.power ? b : a)).label : undefined;
  return { rows, nodes, totalPower, hottest, warning };
}

// ── Readouts panel ──

const Readouts: React.FC<{ presetId: string; params: Record<string, number>; res: ReturnType<typeof solve> }> = ({ presetId, params, res }) => {
  const a = analyze(presetId, params, res);
  return (
    <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live readings</h3>

      {a.warning && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border-2 border-ohmlet-red bg-[#fdece8] px-3 py-2 text-xs font-bold text-ohmlet-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {a.warning}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {a.rows.map((r) => (
          <div key={r.label} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${r.over ? 'border-ohmlet-red/40 bg-[#fdece8]' : 'border-ohmlet-line bg-ohmlet-cream'}`}>
            <span className="flex items-center gap-1.5 text-sm font-bold text-ohmlet-ink">
              {r.label}
              {r.label === a.hottest && a.totalPower > 0.02 && <Flame className="h-3.5 w-3.5 text-ohmlet-red" />}
            </span>
            <span className="text-sm font-black tabular-nums text-ohmlet-ink">
              {fmt(toMA(r.current))} mA · {fmtP(r.power)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {a.nodes.map((n) => (
          <div key={n.label} className="rounded-xl border border-ohmlet-line bg-white p-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-ohmlet-ink-soft">{n.label}</p>
            <p className="text-lg font-black tabular-nums text-ohmlet-ink">{fmt(n.v)} V</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-ohmlet-ink bg-ohmlet-ink px-3 py-2.5 text-white">
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
          <Flame className="h-4 w-4 text-ohmlet-gold" /> Total power (heat)
        </span>
        <span className="text-base font-black tabular-nums">{fmtP(a.totalPower)}</span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-ohmlet-ink-soft">
        Power = where heat is made. On a bigger build this is how you'd spot the parts that run hottest.
      </p>
    </div>
  );
};

// ── Tutor callout (adaptive, from real values) ──

const Tutor: React.FC<{ presetId: string; params: Record<string, number>; res: ReturnType<typeof solve> }> = ({ presetId, params, res }) => {
  const a = analyze(presetId, params, res);
  let text: React.ReactNode;
  if (presetId === 'series') {
    const i = toMA(res.I.led ?? 0);
    if (a.warning) text = <>No room left — that's <b>{fmt(i)} mA</b> through the LED. Drop the supply or raise the resistor before it cooks.</>;
    else if (i < 3) text = <>Big resistor, tiny current ({fmt(i)} mA) — the LED is dim. <b>I = (V − 2V) / R.</b></>;
    else text = <>{fmt(i)} mA is flowing. Watch the dots speed up as you lower the resistor — that's <b>I = (V − V<sub>LED</sub>) / R</b>.</>;
  } else if (presetId === 'divider') {
    text = <>R1 and R2 share the supply: <b>Vout = V · R2/(R1+R2) = {fmt(res.V[2] ?? 0)} V</b>. Make R2 an LDR and Vout tracks the light.</>;
  } else {
    text = <>Same 5V, different resistors → different current. The smaller resistor lets more through, so that LED glows brighter. Current isn't shared — each branch sets its own.</>;
  }
  return (
    <div className="flex items-start gap-3 border-t-2 border-ohmlet-line bg-ohmlet-ink px-5 py-4 text-white">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ohmlet-gold">
        <Cpu className="h-5 w-5 text-ohmlet-ink" />
      </span>
      <p className="text-sm font-semibold leading-snug [&_b]:text-ohmlet-gold">{text}</p>
    </div>
  );
};

// ── The animated board (SVG, driven by real currents) ──

const Board: React.FC<{ presetId: string; params: Record<string, number>; res: ReturnType<typeof solve>; running: boolean }> = ({ presetId, params, res, running }) => {
  if (presetId === 'series') {
    const i = res.I.led ?? 0, mA = toMA(i), b = Math.min(1, mA / 20), over = mA > LED_MAX_MA;
    return (
      <Svg>
        <Wire d="M120 80 H520 V300 H120 Z" />
        <Battery x={120} y={190} v={params.V} />
        <Resistor x={320} y={80} label={`${fmt(params.R)} Ω`} />
        <Led x={520} y={190} bright={b} over={over} />
        <Vchip x={120} y={62} v={res.V[1] ?? 0} kind="hi" />
        <Vchip x={520} y={62} v={res.V[2] ?? 0} kind="mid" />
        <Vchip x={320} y={322} v={0} kind="gnd" />
        <Flow d="M120 80 H520 V300 H120 Z" mA={mA} running={running} id="s" />
      </Svg>
    );
  }
  if (presetId === 'divider') {
    const i = res.I.r1 ?? 0, mA = toMA(i);
    return (
      <Svg>
        <Wire d="M150 70 V120 M150 200 V250 M150 300 H470 V70 H150 M470 250 V300" />
        <Battery x={470} y={185} v={params.V} vertical />
        <Resistor x={150} y={160} label={`${fmt(params.R1)} Ω`} vertical />
        <Resistor x={150} y={275} label={`${fmt(params.R2)} Ω`} vertical />
        <circle cx={150} cy={250} r={6} fill="#0f172a" />
        <Vchip x={150} y={52} v={res.V[1] ?? 0} kind="hi" />
        <g><rect x={186} y={240} width={92} height={22} rx={7} fill="#fff7ed" stroke="#d97706" strokeWidth={2} /><text x={232} y={255} textAnchor="middle" fontSize={12} fontWeight={800} fill="#d97706">Vout {fmt(res.V[2] ?? 0)}V</text></g>
        <Vchip x={150} y={318} v={0} kind="gnd" />
        <Flow d="M470 70 H150 V300 H470 Z" mA={mA} running={running} id="d" />
      </Svg>
    );
  }
  // parallel
  const i1 = res.I.l1 ?? 0, i2 = res.I.l2 ?? 0;
  const b1 = Math.min(1, toMA(i1) / 20), b2 = Math.min(1, toMA(i2) / 20);
  return (
    <Svg>
      <Wire d="M110 80 H530 M110 80 V300 H530 V80 M300 80 V300" />
      <Battery x={110} y={190} v={params.V} />
      <Resistor x={210} y={80} label={`${fmt(params.R1)} Ω`} />
      <Led x={300} y={190} bright={b1} over={toMA(i1) > LED_MAX_MA} small />
      <Resistor x={420} y={80} label={`${fmt(params.R2)} Ω`} />
      <Led x={530} y={190} bright={b2} over={toMA(i2) > LED_MAX_MA} small />
      <Vchip x={110} y={62} v={res.V[1] ?? 0} kind="hi" />
      <Flow d="M110 80 H300 V300 H110 Z" mA={toMA(i1)} running={running} id="p1" />
      <Flow d="M300 80 H530 V300 H300 Z" mA={toMA(i2)} running={running} id="p2" />
    </Svg>
  );
};

// ── SVG primitives ──

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 640 360" className="block w-full"
    style={{ background: 'linear-gradient(0deg,rgba(15,23,42,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.03) 1px,transparent 1px)', backgroundSize: '22px 22px' }}>
    {children}
  </svg>
);
const Wire: React.FC<{ d: string }> = ({ d }) => <path d={d} fill="none" stroke="#0f172a" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />;

const Battery: React.FC<{ x: number; y: number; v: number; vertical?: boolean }> = ({ x, y, v }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-26} y={-26} width={52} height={52} rx={9} fill="#fff" stroke="#0f172a" strokeWidth={2} />
    <path d="M-9 -12V12M0 -7V7M9 -12V12" stroke="#0f172a" strokeWidth={3} />
    <text x={0} y={42} textAnchor="middle" fontSize={12} fontWeight={800} fill="#475569">{fmt(v)}V</text>
  </g>
);
const Resistor: React.FC<{ x: number; y: number; label: string; vertical?: boolean }> = ({ x, y, label, vertical }) => (
  <g transform={`translate(${x},${y}) ${vertical ? 'rotate(90)' : ''}`}>
    <rect x={-46} y={-16} width={92} height={32} rx={8} fill="#fff" stroke="#0f172a" strokeWidth={2} />
    <path d="M-34 0h7l4-9 7 18 7-18 7 18 7-18 4 9h7" stroke="#0f172a" strokeWidth={2.5} fill="none" />
    <text x={0} y={vertical ? 0 : -24} transform={vertical ? 'rotate(-90)' : ''} textAnchor="middle" fontSize={12} fontWeight={800} fill="#475569" dx={vertical ? 0 : 0} dy={vertical ? -34 : 0}>{label}</text>
  </g>
);
const Led: React.FC<{ x: number; y: number; bright: number; over?: boolean; small?: boolean }> = ({ x, y, bright, over, small }) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={small ? 26 : 32} fill={over ? '#ef4444' : '#f3e515'} opacity={(over ? 0.5 : bright * 0.85).toFixed(2)} />
    <rect x={-22} y={-22} width={44} height={44} rx={9} fill="#fff" stroke="#0f172a" strokeWidth={2} />
    <path d="M-11 -12v24l18 -12 -18 -12z" fill={over ? '#ef4444' : bright > 0.6 ? '#fde047' : bright > 0.25 ? '#facc2e' : '#e5b800'} stroke="#0f172a" strokeWidth={1.5} />
    <path d="M7 -12v24" stroke="#0f172a" strokeWidth={3} />
  </g>
);
const Vchip: React.FC<{ x: number; y: number; v: number; kind: 'hi' | 'mid' | 'gnd' }> = ({ x, y, v, kind }) => {
  const c = kind === 'hi' ? ['#eafaf0', '#16a34a'] : kind === 'mid' ? ['#fff7ed', '#d97706'] : ['#f1f5f9', '#64748b'];
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-22} y={-13} width={44} height={22} rx={7} fill={c[0]} stroke={c[1]} strokeWidth={2} />
      <text x={0} y={2} textAnchor="middle" fontSize={11} fontWeight={800} fill={c[1]}>{fmt(v)}V</text>
    </g>
  );
};

/** Animated current dots along a path, density + speed ∝ real current (SMIL). */
const Flow: React.FC<{ d: string; mA: number; running: boolean; id: string }> = ({ d, mA, running, id }) => {
  const n = mA < 0.3 ? 0 : Math.min(40, Math.round(mA / 1.5) + 4);
  const dur = Math.max(1.1, Math.min(9, 130 / Math.max(mA, 1))); // faster with more current
  const pid = `flow-${id}`;
  if (n === 0) return <path d={d} fill="none" />;
  return (
    <g>
      <path id={pid} d={d} fill="none" />
      {Array.from({ length: n }).map((_, i) => (
        <circle key={`${pid}-${dur.toFixed(2)}-${n}-${i}`} r={4.2} fill="#f3e515" stroke="#b9a800" strokeWidth={1}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`-${(i * dur) / n}s`} keyPoints={running ? undefined : '0;0'} keyTimes={running ? undefined : '0;1'}>
            <mpath href={`#${pid}`} />
          </animateMotion>
        </circle>
      ))}
    </g>
  );
};

// ── format helpers ──
function fmt(x: number): string {
  if (!isFinite(x)) return '—';
  const a = Math.abs(x);
  return a >= 100 ? x.toFixed(0) : a >= 10 ? x.toFixed(1) : x.toFixed(2);
}
function fmtP(w: number): string {
  if (!isFinite(w)) return '—';
  return w >= 1 ? `${w.toFixed(2)} W` : `${(w * 1000).toFixed(0)} mW`;
}
