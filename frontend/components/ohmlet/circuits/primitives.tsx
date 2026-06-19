/**
 * Circuit SVG primitives — the shared component palette.
 *
 * These are the reusable building blocks for every circuit diagram, used both by
 * the legacy hand-coded circuits in CircuitDiagram.tsx and by the data-driven
 * SpecCircuit renderer. Each is a stateless SVG <g> positioned at (x, y).
 *
 * Clickable primitives take an `onClick(id)` and render a transparent hit rect so
 * the whole component is tappable (not just its thin strokes), plus a dashed
 * highlight when `highlight` is set.
 */

import React from 'react';

type ClickProps = { highlight?: boolean; onClick?: (id: string) => void; id?: string };

export function Battery({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'battery')} style={{ cursor: onClick ? 'pointer' : 'default' }} className={highlight ? 'circuit-highlight' : ''}>
      {onClick && <rect x={-20} y={-24} width={40} height={48} fill="transparent" />}
      <line x1={-15} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={-6} y1={-14} x2={-6} y2={14} stroke="currentColor" strokeWidth={3} />
      <line x1={6} y1={-8} x2={6} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={6} y1={0} x2={15} y2={0} stroke="currentColor" strokeWidth={2} />
      <text x={0} y={-20} textAnchor="middle" fontSize={10} fill="currentColor" fontWeight={600}>{label || '5V'}</text>
      <text x={-12} y={-16} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>+</text>
      <text x={12} y={-16} textAnchor="middle" fontSize={9} fill="#3b82f6" fontWeight={700}>−</text>
      {highlight && <rect x={-18} y={-18} width={36} height={36} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function Resistor({ x, y, rotation = 0, label, highlight, onClick, id, error }: { x: number; y: number; rotation?: number; label?: string; error?: boolean } & ClickProps) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`} onClick={() => onClick?.(id || 'resistor')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-28} y={-16} width={56} height={32} fill="transparent" />}
      <line x1={-25} y1={0} x2={-15} y2={0} stroke="currentColor" strokeWidth={2} />
      <polyline points="-15,-6 -10,6 -5,-6 0,6 5,-6 10,6 15,-6" fill="none" stroke={error ? '#ef4444' : 'currentColor'} strokeWidth={2} strokeLinejoin="round" />
      <line x1={15} y1={0} x2={25} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={rotation === 90 ? 18 : -12} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-18} y={-10} width={36} height={20} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function LED({ x, y, rotation = 0, color = '#ef4444', label, highlight, onClick, id, error }: { x: number; y: number; rotation?: number; color?: string; label?: string; error?: boolean } & ClickProps) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`} onClick={() => onClick?.(id || 'led')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-22} y={-18} width={44} height={36} fill="transparent" />}
      <line x1={-20} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <polygon points="-6,-8 -6,8 8,0" fill={error ? '#ef4444' : color} opacity={0.7} stroke={error ? '#ef4444' : color} strokeWidth={1.5} />
      <line x1={8} y1={-8} x2={8} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={8} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={4} y1={-12} x2={8} y2={-16} stroke={color} strokeWidth={1} opacity={0.5} />
      <line x1={8} y1={-14} x2={12} y2={-18} stroke={color} strokeWidth={1} opacity={0.5} />
      {label && <text x={0} y={16} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-10} y={-12} width={22} height={24} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function LDRSymbol({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'ldr')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-22} y={-20} width={44} height={44} fill="transparent" />}
      <line x1={-20} y1={0} x2={-8} y2={0} stroke="currentColor" strokeWidth={2} />
      <circle cx={0} cy={0} r={10} fill="none" stroke="currentColor" strokeWidth={2} />
      <polyline points="-5,-3 -2,3 2,-3 5,3" fill="none" stroke="currentColor" strokeWidth={1.5} />
      <line x1={-14} y1={-14} x2={-6} y2={-6} stroke="#eab308" strokeWidth={1.5} />
      <polygon points="-6,-6 -10,-5 -7,-9" fill="#eab308" />
      <line x1={-10} y1={-16} x2={-2} y2={-8} stroke="#eab308" strokeWidth={1.5} />
      <polygon points="-2,-8 -6,-7 -3,-11" fill="#eab308" />
      <line x1={8} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={22} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-14} y={-14} width={28} height={28} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function Wire({ x1, y1, x2, y2, color = 'currentColor', error }: { x1: number; y1: number; x2: number; y2: number; color?: string; error?: boolean }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={error ? '#ef4444' : color} strokeWidth={2} strokeDasharray={error ? '4 3' : 'none'} />;
}

export function Junction({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} fill="currentColor" />;
}

export function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1={0} y1={0} x2={0} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={-10} y1={8} x2={10} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={-6} y1={12} x2={6} y2={12} stroke="currentColor" strokeWidth={1.5} />
      <line x1={-3} y1={16} x2={3} y2={16} stroke="currentColor" strokeWidth={1} />
    </g>
  );
}

export function ArduinoPin({ x, y, pin, highlight, onClick, id }: { x: number; y: number; pin: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || `pin-${pin}`)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <rect x={-14} y={-8} width={28} height={16} rx={3} fill={highlight ? '#f3e515' : '#006B8F'} stroke="#004d66" strokeWidth={1} />
      <text x={0} y={4} textAnchor="middle" fontSize={8} fill="white" fontWeight={700}>{pin}</text>
    </g>
  );
}

export function Buzzer({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'buzzer')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-22} y={-16} width={44} height={38} fill="transparent" />}
      <line x1={-20} y1={0} x2={-10} y2={0} stroke="currentColor" strokeWidth={2} />
      <rect x={-10} y={-10} width={20} height={20} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
      <text x={0} y={4} textAnchor="middle" fontSize={10} fill="currentColor" fontWeight={700}>♪</text>
      <line x1={10} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={22} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-14} y={-14} width={28} height={28} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function Switch({ x, y, open = true, label, highlight, onClick, id }: { x: number; y: number; open?: boolean; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'switch')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-22} y={-16} width={44} height={34} fill="transparent" />}
      <line x1={-20} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <circle cx={-6} cy={0} r={3} fill="currentColor" />
      {open ? <line x1={-6} y1={0} x2={10} y2={-10} stroke="currentColor" strokeWidth={2} /> : <line x1={-6} y1={0} x2={10} y2={0} stroke="currentColor" strokeWidth={2} />}
      <circle cx={10} cy={0} r={3} fill="currentColor" />
      <line x1={10} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={16} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-10} y={-14} width={24} height={22} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function CurrentArrow({ x, y, rotation = 0, label }: { x: number; y: number; rotation?: number; label?: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`}>
      <line x1={-10} y1={0} x2={6} y2={0} stroke="#3b82f6" strokeWidth={1.5} />
      <polygon points="6,0 0,-3 0,3" fill="#3b82f6" />
      {label && <text x={0} y={-8} textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight={600}>{label}</text>}
    </g>
  );
}

// ── Advanced primitives (for Units 6+: RC, transistors, op-amps, diodes) ──

export function Capacitor({ x, y, rotation = 0, label, polarized, highlight, onClick, id }: { x: number; y: number; rotation?: number; label?: string; polarized?: boolean } & ClickProps) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`} onClick={() => onClick?.(id || 'capacitor')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-22} y={-16} width={44} height={32} fill="transparent" />}
      <line x1={-20} y1={0} x2={-4} y2={0} stroke="currentColor" strokeWidth={2} />
      {/* left plate (flat) */}
      <line x1={-4} y1={-10} x2={-4} y2={10} stroke="currentColor" strokeWidth={2.5} />
      {/* right plate: flat (non-polar) or curved (electrolytic) */}
      {polarized
        ? <path d="M 4 -10 Q 9 0 4 10" fill="none" stroke="currentColor" strokeWidth={2.5} />
        : <line x1={4} y1={-10} x2={4} y2={10} stroke="currentColor" strokeWidth={2.5} />}
      <line x1={4} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {polarized && <text x={-12} y={-12} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>+</text>}
      {label && <text x={0} y={rotation === 90 ? 20 : -14} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-16} y={-14} width={32} height={28} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

export function Diode({ x, y, rotation = 0, label, highlight, onClick, id, error }: { x: number; y: number; rotation?: number; label?: string; error?: boolean } & ClickProps) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`} onClick={() => onClick?.(id || 'diode')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-22} y={-14} width={44} height={28} fill="transparent" />}
      <line x1={-20} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <polygon points="-6,-8 -6,8 8,0" fill={error ? '#ef4444' : 'currentColor'} opacity={0.85} />
      <line x1={8} y1={-8} x2={8} y2={8} stroke={error ? '#ef4444' : 'currentColor'} strokeWidth={2.5} />
      <line x1={8} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={16} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-12} y={-12} width={26} height={24} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

/** NPN transistor. Base on the left, collector top, emitter bottom (emitter arrow points out). */
export function TransistorNPN({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'transistor')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-26} y={-24} width={52} height={48} fill="transparent" />}
      <circle cx={2} cy={0} r={18} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {/* base lead + bar */}
      <line x1={-24} y1={0} x2={-8} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={-8} y1={-12} x2={-8} y2={12} stroke="currentColor" strokeWidth={2.5} />
      {/* collector (top) */}
      <line x1={-8} y1={-7} x2={10} y2={-16} stroke="currentColor" strokeWidth={2} />
      <line x1={10} y1={-16} x2={10} y2={-30} stroke="currentColor" strokeWidth={2} />
      {/* emitter (bottom) with arrow pointing out */}
      <line x1={-8} y1={7} x2={10} y2={16} stroke="currentColor" strokeWidth={2} />
      <line x1={10} y1={16} x2={10} y2={30} stroke="currentColor" strokeWidth={2} />
      <polygon points="10,16 3,13 8,9" fill="currentColor" />
      <text x={-18} y={-6} textAnchor="middle" fontSize={8} fill="currentColor" fontWeight={600}>B</text>
      <text x={18} y={-20} textAnchor="middle" fontSize={8} fill="currentColor" fontWeight={600}>C</text>
      <text x={18} y={26} textAnchor="middle" fontSize={8} fill="currentColor" fontWeight={600}>E</text>
      {label && <text x={2} y={42} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-24} y={-22} width={50} height={44} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

/** 3-pin linear regulator (e.g. 7805): IN lead on the left, OUT on the right, GND at the bottom. */
export function Regulator({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'regulator')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-37} y={-24} width={74} height={58} fill="transparent" />}
      {/* leads: IN (left), OUT (right), GND (bottom) */}
      <line x1={-37} y1={0} x2={-25} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={25} y1={0} x2={37} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={0} y1={20} x2={0} y2={32} stroke="currentColor" strokeWidth={2} />
      {/* body */}
      <rect x={-25} y={-20} width={50} height={40} rx={4} fill="none" stroke="currentColor" strokeWidth={2} />
      <text x={0} y={-7} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={700}>{label || '7805'}</text>
      <text x={-15} y={9} textAnchor="middle" fontSize={7} fill="currentColor" fontWeight={600}>IN</text>
      <text x={16} y={9} textAnchor="middle" fontSize={7} fill="currentColor" fontWeight={600}>OUT</text>
      <text x={0} y={16} textAnchor="middle" fontSize={6.5} fill="currentColor" fontWeight={600}>GND</text>
      {highlight && <rect x={-29} y={-24} width={58} height={48} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

/** DC motor: circle with an M, leads on the left and right. */
export function Motor({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'motor')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-30} y={-18} width={60} height={36} fill="transparent" />}
      <line x1={-30} y1={0} x2={-16} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={16} y1={0} x2={30} y2={0} stroke="currentColor" strokeWidth={2} />
      <circle cx={0} cy={0} r={16} fill="none" stroke="currentColor" strokeWidth={2} />
      <text x={0} y={5} textAnchor="middle" fontSize={14} fill="currentColor" fontWeight={700}>M</text>
      {label && <text x={0} y={30} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <circle cx={0} cy={0} r={20} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

/** Op-amp triangle. Inputs on the left (− top, + bottom), output on the right tip. */
export function OpAmp({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string } & ClickProps) {
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onClick?.(id || 'opamp')} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {onClick && <rect x={-26} y={-22} width={64} height={44} fill="transparent" />}
      <polygon points="-22,-18 -22,18 24,0" fill="none" stroke="currentColor" strokeWidth={2} />
      <line x1={-34} y1={-10} x2={-22} y2={-10} stroke="currentColor" strokeWidth={2} />
      <line x1={-34} y1={10} x2={-22} y2={10} stroke="currentColor" strokeWidth={2} />
      <line x1={24} y1={0} x2={36} y2={0} stroke="currentColor" strokeWidth={2} />
      <text x={-17} y={-7} textAnchor="middle" fontSize={10} fill="currentColor" fontWeight={700}>−</text>
      <text x={-17} y={14} textAnchor="middle" fontSize={10} fill="currentColor" fontWeight={700}>+</text>
      {label && <text x={-2} y={34} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-24} y={-20} width={50} height={40} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}
