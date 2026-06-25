import React, { useMemo, useState } from 'react';
import { Battery, Cpu, Lightbulb, Minus, MousePointer2, Cable, Trash2, RotateCw, Sparkles, Zap } from 'lucide-react';
import { solve, toMA, type Comp } from '../sim/engine';

/**
 * FreeFormEditor (#71) — build your own circuit on a grid.
 *
 * Place real components from a palette, wire nodes together, and our engine
 * (sim/engine.ts) solves the whole thing live: node voltages, branch currents,
 * LED brightness, overcurrent warnings. Nothing about the result is scripted.
 */

const GRID = 44, OX = 36, OY = 34, COLS = 12, ROWS = 7;
const W = OX * 2 + (COLS - 1) * GRID, H = OY * 2 + (ROWS - 1) * GRID;
const px = (c: number) => OX + c * GRID;
const py = (r: number) => OY + r * GRID;

type Pt = [number, number];
type Kind = 'bat' | 'res' | 'led' | 'sw' | 'gnd';
interface Part { id: string; kind: Kind; a: Pt; b: Pt; value: number; closed?: boolean }
interface Wire { id: string; a: Pt; b: Pt }

const key = (p: Pt) => `${p[0]},${p[1]}`;
const eqPt = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
const LED_MAX_MA = 25;

const KINDS: { kind: Kind; label: string; icon: React.FC<{ className?: string }>; defVal: number; twoPin: boolean }[] = [
  { kind: 'bat', label: 'Battery', icon: Battery, defVal: 5, twoPin: true },
  { kind: 'res', label: 'Resistor', icon: Minus, defVal: 220, twoPin: true },
  { kind: 'led', label: 'LED', icon: Lightbulb, defVal: 0, twoPin: true },
  { kind: 'sw', label: 'Switch', icon: Cable, defVal: 0, twoPin: true },
  { kind: 'gnd', label: 'Ground', icon: Minus, defVal: 0, twoPin: false },
];

// ── union-find for electrical nodes ──
class UF {
  p = new Map<string, string>();
  find(x: string): string { if (!this.p.has(x)) this.p.set(x, x); let r = x; while (this.p.get(r) !== r) r = this.p.get(r)!; let c = x; while (this.p.get(c) !== r) { const n = this.p.get(c)!; this.p.set(c, r); c = n; } return r; }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

interface Netlist { netlist: Comp[]; nodeForKey: (k: string) => number }
function buildNetlist(parts: Part[], wires: Wire[]): Netlist {
  const uf = new UF();
  for (const p of parts) { uf.find(key(p.a)); if (p.kind !== 'gnd') uf.find(key(p.b)); }
  for (const w of wires) uf.union(key(w.a), key(w.b));
  const grounds = new Set<string>();
  for (const p of parts) if (p.kind === 'gnd') grounds.add(uf.find(key(p.a)));
  if (grounds.size === 0) { const b = parts.find((p) => p.kind === 'bat'); if (b) grounds.add(uf.find(key(b.b))); }
  const ids = new Map<string, number>(); let next = 1;
  const idOf = (root: string) => { if (grounds.has(root)) return 0; if (!ids.has(root)) ids.set(root, next++); return ids.get(root)!; };
  const netlist: Comp[] = [];
  for (const p of parts) {
    if (p.kind === 'gnd') continue;
    const n1 = idOf(uf.find(key(p.a))), n2 = idOf(uf.find(key(p.b)));
    if (p.kind === 'bat') netlist.push({ kind: 'V', id: p.id, pos: n1, neg: n2, value: p.value });
    else if (p.kind === 'res') netlist.push({ kind: 'R', id: p.id, a: n1, b: n2, value: Math.max(0.001, p.value) });
    else if (p.kind === 'led') netlist.push({ kind: 'LED', id: p.id, anode: n1, cathode: n2 });
    else if (p.kind === 'sw') netlist.push({ kind: 'R', id: p.id, a: n1, b: n2, value: p.closed ? 0.01 : 1e7 });
  }
  return { netlist, nodeForKey: (k: string) => idOf(uf.find(k)) };
}

const EXAMPLE: { parts: Part[]; wires: Wire[] } = {
  parts: [
    { id: 'bat1', kind: 'bat', a: [1, 1], b: [1, 5], value: 5 },
    { id: 'res1', kind: 'res', a: [1, 1], b: [6, 1], value: 220 },
    { id: 'led1', kind: 'led', a: [6, 1], b: [6, 5], value: 0 },
    { id: 'gnd1', kind: 'gnd', a: [1, 5], b: [1, 5], value: 0 },
  ],
  wires: [{ id: 'w1', a: [1, 5], b: [6, 5] }],
};

let uid = 0;
const nid = (k: string) => `${k}${++uid}`;

export const FreeFormEditor: React.FC = () => {
  const [parts, setParts] = useState<Part[]>(EXAMPLE.parts);
  const [wires, setWires] = useState<Wire[]>(EXAMPLE.wires);
  const [tool, setTool] = useState<'place' | 'wire' | 'select'>('select');
  const [kind, setKind] = useState<Kind>('res');
  const [vertical, setVertical] = useState(false);
  const [pending, setPending] = useState<Pt | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const { netlist, nodeForKey } = useMemo(() => buildNetlist(parts, wires), [parts, wires]);
  const res = useMemo(() => solve(netlist), [netlist]);

  const reset = (ps: Part[], ws: Wire[]) => { setParts(ps); setWires(ws); setPending(null); setSel(null); };

  const onNode = (c: number, r: number) => {
    const p: Pt = [c, r];
    if (tool === 'place') {
      if (kind === 'gnd') { setParts((x) => [...x, { id: nid('gnd'), kind, a: p, b: p, value: 0 }]); return; }
      const b: Pt = vertical ? [c, r + 1] : [c + 1, r];
      if (b[0] > COLS - 1 || b[1] > ROWS - 1) return;
      const def = KINDS.find((k) => k.kind === kind)!.defVal;
      setParts((x) => [...x, { id: nid(kind), kind, a: p, b, value: def, closed: kind === 'sw' ? true : undefined }]);
    } else if (tool === 'wire') {
      if (!pending) setPending(p);
      else if (!eqPt(pending, p)) { setWires((x) => [...x, { id: nid('w'), a: pending, b: p }]); setPending(null); }
      else setPending(null);
    }
  };

  const selPart = parts.find((p) => p.id === sel);
  const delSel = () => { if (!sel) return; setParts((x) => x.filter((p) => p.id !== sel)); setWires((x) => x.filter((w) => w.id !== sel)); setSel(null); };

  // analysis for readouts
  const rows = parts.filter((p) => p.kind !== 'gnd').map((p) => {
    const i = res.I[p.id] ?? 0;
    const over = p.kind === 'led' && toMA(i) > LED_MAX_MA;
    return { p, i, over };
  });
  const overcurrent = rows.some((r) => r.over);
  const hasBattery = parts.some((p) => p.kind === 'bat');

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Simulator · Build your own</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Wire up anything.</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-press-sm">
          <Zap className="h-3.5 w-3.5" /> Solved live
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-ohmlet-ink-soft">
        Drop components on the grid, wire the dots together, and watch the real currents and voltages appear. Place a battery and a ground to give it a reference.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* canvas */}
        <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink bg-white shadow-press">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-ohmlet-line bg-ohmlet-cream px-3 py-2.5">
            <ToolBtn on={tool === 'select'} onClick={() => { setTool('select'); setPending(null); }} icon={MousePointer2} label="Select" />
            <ToolBtn on={tool === 'place'} onClick={() => { setTool('place'); setPending(null); }} icon={Sparkles} label="Place" />
            <ToolBtn on={tool === 'wire'} onClick={() => { setTool('wire'); setSel(null); }} icon={Cable} label="Wire" />
            <div className="mx-1 h-6 w-px bg-ohmlet-line" />
            <button onClick={() => setVertical((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border-2 border-ohmlet-line bg-white px-2.5 text-xs font-black text-ohmlet-ink-soft transition-all hover:border-ohmlet-ink hover:text-ohmlet-ink">
              <RotateCw className="h-3.5 w-3.5" /> {vertical ? 'Vertical' : 'Horizontal'}
            </button>
            <div className="flex-1" />
            <button onClick={() => reset([], [])} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black text-ohmlet-ink-soft hover:text-ohmlet-red">Clear</button>
            <button onClick={() => reset(EXAMPLE.parts.map((p) => ({ ...p, id: nid(p.kind) })), EXAMPLE.wires.map((w) => ({ ...w, id: nid('w') })))} className="inline-flex h-8 items-center gap-1 rounded-lg border-2 border-ohmlet-ink bg-white px-2.5 text-xs font-black shadow-press-sm hover:translate-y-[2px] hover:shadow-none">Example</button>
          </div>

          {/* svg */}
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none"
            style={{ background: 'linear-gradient(0deg,rgba(20,32,30,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(20,32,30,.02) 1px,transparent 1px)', backgroundSize: `${GRID}px ${GRID}px`, backgroundPosition: `${OX}px ${OY}px` }}>
            {/* wires */}
            {wires.map((w) => (
              <line key={w.id} x1={px(w.a[0])} y1={py(w.a[1])} x2={px(w.b[0])} y2={py(w.b[1])} stroke={sel === w.id ? '#549cf0' : '#14201e'} strokeWidth={5} strokeLinecap="round"
                className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel(w.id); setTool('select'); }} />
            ))}
            {/* parts */}
            {parts.map((p) => <PartGlyph key={p.id} part={p} selected={sel === p.id} current={res.I[p.id] ?? 0} onClick={() => { setSel(p.id); setTool('select'); }} />)}
            {/* node voltage chips */}
            {nodePoints(parts, wires).map((p) => {
              const node = nodeForKey(key(p));
              if (!hasBattery) return null;
              return <g key={`v${key(p)}`} transform={`translate(${px(p[0])},${py(p[1]) - 14})`} pointerEvents="none">
                <rect x={-16} y={-9} width={32} height={15} rx={5} fill="#fff" stroke="#ece7db" strokeWidth={1.5} />
                <text x={0} y={2} textAnchor="middle" fontSize={9} fontWeight={800} fill={node === 0 ? '#64748b' : '#b06f00'}>{fmt(res.V[node] ?? 0)}V</text>
              </g>;
            })}
            {/* clickable grid dots (place/wire) */}
            {tool !== 'select' && Array.from({ length: COLS * ROWS }).map((_, k) => {
              const c = k % COLS, r = Math.floor(k / COLS);
              const isPending = pending && pending[0] === c && pending[1] === r;
              return <circle key={k} cx={px(c)} cy={py(r)} r={isPending ? 7 : 9} fill={isPending ? '#f3e515' : 'transparent'} stroke={isPending ? '#14201e' : 'transparent'} strokeWidth={2}
                className="cursor-pointer hover:fill-[#ece7db]" onClick={() => onNode(c, r)} />;
            })}
          </svg>

          {/* tutor hint */}
          <div className="flex items-start gap-3 border-t-2 border-ohmlet-line bg-ohmlet-ink px-5 py-3.5 text-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ohmlet-gold"><Cpu className="h-4.5 w-4.5 text-ohmlet-ink" /></span>
            <p className="text-sm font-semibold leading-snug [&_b]:text-ohmlet-gold">
              {!hasBattery ? <>Add a <b>battery</b> and a <b>ground</b> so the circuit has a power source and a 0&nbsp;V reference.</>
                : overcurrent ? <>An LED is over <b>{LED_MAX_MA}&nbsp;mA</b>. Add a series resistor or raise its value before it burns out.</>
                  : tool === 'wire' ? <>Click one grid dot, then another, to lay a wire between them.</>
                    : tool === 'place' ? <>Pick a part on the right, then click a grid dot to drop it ({vertical ? 'pointing down' : 'pointing right'}).</>
                      : <>It's live. Tap any component to change its value, or switch to <b>Place</b> and <b>Wire</b> to keep building.</>}
            </p>
          </div>
        </div>

        {/* side panel */}
        <div className="flex flex-col gap-4">
          {tool === 'place' && (
            <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Parts</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {KINDS.map((k) => {
                  const on = k.kind === kind, Icon = k.icon;
                  return <button key={k.kind} onClick={() => setKind(k.kind)} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-black transition-all ${on ? 'border-ohmlet-ink bg-ohmlet-gold-soft shadow-press-sm' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink'}`}>
                    <Icon className="h-4 w-4" /> {k.label}
                  </button>;
                })}
              </div>
            </div>
          )}

          {selPart && (
            <div className="rounded-[1.4rem] border-2 border-ohmlet-ink bg-white p-4 shadow-press-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black capitalize">{labelOf(selPart.kind)}</h3>
                <button onClick={delSel} className="inline-flex items-center gap-1 text-xs font-black text-ohmlet-red hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
              {selPart.kind === 'bat' && <ValueSlider label="Voltage" unit="V" min={1} max={12} step={0.5} value={selPart.value} onChange={(v) => setPartVal(setParts, selPart.id, { value: v })} />}
              {selPart.kind === 'res' && <ValueSlider label="Resistance" unit="Ω" min={10} max={2200} step={10} value={selPart.value} onChange={(v) => setPartVal(setParts, selPart.id, { value: v })} />}
              {selPart.kind === 'sw' && (
                <button onClick={() => setPartVal(setParts, selPart.id, { closed: !selPart.closed })} className={`mt-3 flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-black ${selPart.closed ? 'border-ohmlet-ink bg-ohmlet-gold' : 'border-ohmlet-line bg-ohmlet-cream text-ohmlet-ink-soft'}`}>
                  {selPart.closed ? 'Closed' : 'Open'} <span className={`h-4 w-7 rounded-full p-0.5 ${selPart.closed ? 'bg-ohmlet-ink' : 'bg-ohmlet-line'}`}><span className={`block h-3 w-3 rounded-full bg-white transition-all ${selPart.closed ? 'translate-x-3' : ''}`} /></span>
                </button>
              )}
              {selPart.kind === 'led' && <p className="mt-2 text-xs font-semibold text-ohmlet-ink-soft">{fmt(toMA(res.I[selPart.id] ?? 0))} mA flowing{toMA(res.I[selPart.id] ?? 0) > LED_MAX_MA ? ' — over the limit!' : ''}.</p>}
            </div>
          )}

          <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live readings</h3>
            {rows.length === 0 && <p className="mt-3 text-xs font-semibold text-ohmlet-ink-soft">Nothing placed yet. Hit <b>Example</b> for a starter circuit, or <b>Place</b> a battery.</p>}
            <div className="mt-3 space-y-2">
              {rows.map(({ p, i, over }) => (
                <button key={p.id} onClick={() => { setSel(p.id); setTool('select'); }} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${over ? 'border-ohmlet-red/40 bg-[#fff1ee]' : sel === p.id ? 'border-ohmlet-ink bg-ohmlet-gold-soft' : 'border-ohmlet-line bg-ohmlet-cream'}`}>
                  <span className="text-sm font-bold text-ohmlet-ink">{labelOf(p.kind)}{p.kind === 'res' ? ` ${fmtOhm(p.value)}` : p.kind === 'bat' ? ` ${fmt(p.value)}V` : ''}</span>
                  <span className="text-sm font-black tabular-nums text-ohmlet-ink">{fmt(toMA(i))} mA</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function setPartVal(setParts: React.Dispatch<React.SetStateAction<Part[]>>, id: string, patch: Partial<Part>) {
  setParts((x) => x.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}
function labelOf(k: Kind) { return k === 'bat' ? 'Battery' : k === 'res' ? 'Resistor' : k === 'led' ? 'LED' : k === 'sw' ? 'Switch' : 'Ground'; }

function nodePoints(parts: Part[], wires: Wire[]): Pt[] {
  const seen = new Set<string>(); const out: Pt[] = [];
  const add = (p: Pt) => { if (!seen.has(key(p))) { seen.add(key(p)); out.push(p); } };
  for (const p of parts) { add(p.a); if (p.kind !== 'gnd') add(p.b); }
  for (const w of wires) { add(w.a); add(w.b); }
  return out;
}

const ToolBtn: React.FC<{ on: boolean; onClick: () => void; icon: React.FC<{ className?: string }>; label: string }> = ({ on, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border-2 px-2.5 text-xs font-black transition-all ${on ? 'border-ohmlet-ink bg-ohmlet-gold shadow-press-sm' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink hover:text-ohmlet-ink'}`}>
    <Icon className="h-3.5 w-3.5" /> {label}
  </button>
);

const ValueSlider: React.FC<{ label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }> = ({ label, unit, min, max, step, value, onChange }) => (
  <div className="mt-3">
    <label className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">
      <span>{label}</span><span className="text-sm font-black tabular-nums text-ohmlet-ink">{fmt(value)} {unit}</span>
    </label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1.5 w-full accent-ohmlet-gold-deep" />
  </div>
);

// ── part glyph drawn between two grid points (axis-aligned) ──
const PartGlyph: React.FC<{ part: Part; selected: boolean; current: number; onClick: () => void }> = ({ part, selected, current, onClick }) => {
  const x1 = px(part.a[0]), y1 = py(part.a[1]), x2 = px(part.b[0]), y2 = py(part.b[1]);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const horiz = y1 === y2;
  const stroke = selected ? '#549cf0' : '#14201e';
  const click = (e: React.MouseEvent) => { e.stopPropagation(); onClick(); };

  if (part.kind === 'gnd') return (
    <g transform={`translate(${x1},${y1})`} className="cursor-pointer" onClick={click} stroke={stroke} strokeWidth={2.5}>
      <line x1={0} y1={0} x2={0} y2={10} /><line x1={-11} y1={10} x2={11} y2={10} /><line x1={-6} y1={15} x2={6} y2={15} /><line x1={-2} y1={20} x2={2} y2={20} />
    </g>
  );

  const body = (() => {
    const rot = horiz ? 0 : 90;
    if (part.kind === 'res') return <g transform={`translate(${mx},${my}) rotate(${rot})`}><rect x={-20} y={-9} width={40} height={18} rx={4} fill="#fff" stroke={stroke} strokeWidth={2} /><path d="M-15 0h3l2-6 4 12 4-12 4 12 2-6h3" stroke={stroke} strokeWidth={2} fill="none" /></g>;
    if (part.kind === 'bat') return <g transform={`translate(${mx},${my}) rotate(${rot})`}><path d="M-7 -11V11M0 -6V6M7 -11V11" stroke={stroke} strokeWidth={3} /></g>;
    if (part.kind === 'led') { const b = Math.min(1, toMA(current) / 20), over = toMA(current) > LED_MAX_MA; return <g transform={`translate(${mx},${my}) rotate(${rot})`}><circle cx={0} cy={0} r={16} fill={over ? '#ff6f5e' : '#facc2e'} opacity={(over ? 0.5 : b * 0.85).toFixed(2)} /><path d="M-8 -9v18l13 -9z" fill={over ? '#ff6f5e' : b > 0.4 ? '#ffe08a' : '#e0c878'} stroke={stroke} strokeWidth={1.5} /><path d="M5 -9v18" stroke={stroke} strokeWidth={2.5} /></g>; }
    // switch
    return <g transform={`translate(${mx},${my}) rotate(${rot})`}><circle cx={-14} cy={0} r={3} fill={stroke} /><circle cx={14} cy={0} r={3} fill={stroke} /><line x1={-14} y1={0} x2={part.closed ? 14 : 9} y2={part.closed ? 0 : -11} stroke={stroke} strokeWidth={3} strokeLinecap="round" /></g>;
  })();

  return (
    <g className="cursor-pointer" onClick={click}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={4} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={18} />
      {part.kind !== 'led' && <rect x={mx - (horiz ? 22 : 12)} y={my - (horiz ? 12 : 22)} width={horiz ? 44 : 24} height={horiz ? 24 : 44} fill="#fff" stroke="none" />}
      {body}
      <circle cx={x1} cy={y1} r={3.5} fill={stroke} /><circle cx={x2} cy={y2} r={3.5} fill={stroke} />
    </g>
  );
};

function fmt(x: number): string { if (!isFinite(x)) return '—'; const a = Math.abs(x); return a >= 100 ? x.toFixed(0) : a >= 10 ? x.toFixed(1) : x.toFixed(2); }
function fmtOhm(r: number): string { return r >= 1000 ? `${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}kΩ` : `${r.toFixed(0)}Ω`; }
