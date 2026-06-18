/**
 * SpecCircuit — renders a data-authored CircuitSpec from the shared primitives.
 *
 * Drop-in companion to the legacy hand-coded circuits: same visual shell (grid
 * background, title, clickable regions, highlight/correct/error states,
 * current-flow arrows), but driven entirely by data. Region ids are node ids.
 */

import React from 'react';
import type { CircuitSpec, SpecNode } from './spec';
import {
  ArduinoPin,
  Battery,
  Buzzer,
  Capacitor,
  CurrentArrow,
  Diode,
  Ground,
  Junction,
  LDRSymbol,
  LED,
  OpAmp,
  Resistor,
  Switch,
  TransistorNPN,
  Wire,
} from './primitives';

interface SpecCircuitProps {
  spec: CircuitSpec;
  dark?: boolean;
  clickable?: boolean;
  onRegionClick?: (regionId: string) => void;
  highlightRegion?: string | null;
  errorRegion?: string | null;
  correctRegion?: string | null;
  showLabels?: boolean;
  showCurrentFlow?: boolean;
  className?: string;
}

// Approx half-extents per kind, for drawing the green "correct" / red "error" ring.
const RING_BOX: Record<string, { w: number; h: number }> = {
  battery: { w: 22, h: 26 },
  resistor: { w: 30, h: 16 },
  led: { w: 24, h: 20 },
  ldr: { w: 24, h: 24 },
  capacitor: { w: 22, h: 16 },
  diode: { w: 24, h: 16 },
  transistor_npn: { w: 28, h: 26 },
  opamp: { w: 32, h: 22 },
  arduino_pin: { w: 16, h: 10 },
  buzzer: { w: 22, h: 18 },
  switch: { w: 22, h: 16 },
  ground: { w: 12, h: 12 },
  junction: { w: 6, h: 6 },
};

function renderNode(node: SpecNode, props: SpecCircuitProps) {
  const { clickable, onRegionClick, highlightRegion, errorRegion, showLabels } = props;
  const region = node.kind !== 'junction' && node.clickable !== false;
  const onClick = clickable && region ? onRegionClick : undefined;
  const highlight = highlightRegion === node.id;
  const error = errorRegion === node.id;
  const label = showLabels === false ? undefined : node.label;
  const common = { x: node.x, y: node.y, highlight, onClick, id: node.id } as const;

  switch (node.kind) {
    case 'battery':
      return <Battery {...common} label={label} />;
    case 'resistor':
      return <Resistor {...common} rotation={node.rotation} label={label} error={error} />;
    case 'led':
      return <LED {...common} rotation={node.rotation} color={node.color} label={label} error={error} />;
    case 'ldr':
      return <LDRSymbol {...common} label={label} />;
    case 'capacitor':
      return <Capacitor {...common} rotation={node.rotation} label={label} polarized={node.polarized} />;
    case 'diode':
      return <Diode {...common} rotation={node.rotation} label={label} error={error} />;
    case 'transistor_npn':
      return <TransistorNPN {...common} label={label} />;
    case 'opamp':
      return <OpAmp {...common} label={label} />;
    case 'arduino_pin':
      return <ArduinoPin {...common} pin={node.pin ?? '?'} />;
    case 'buzzer':
      return <Buzzer {...common} label={label} />;
    case 'switch':
      return <Switch {...common} open={node.open} label={label} />;
    case 'ground':
      return <Ground x={node.x} y={node.y} />;
    case 'junction':
      return <Junction x={node.x} y={node.y} />;
    default:
      return null;
  }
}

export function SpecCircuit(props: SpecCircuitProps) {
  const { spec, dark = false, correctRegion, showCurrentFlow, className } = props;
  const width = spec.width ?? 400;
  const height = spec.height ?? 250;
  const fg = dark ? '#e2e8f0' : '#334155';

  return (
    <div className={`relative ${className || ''}`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ color: fg }} className="select-none w-full h-auto">
        <defs>
          <pattern id="spec-grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={10} cy={10} r={0.5} fill={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={dark ? '#1a1a2e' : '#f8fafc'} rx={12} />
        <rect width={width} height={height} fill="url(#spec-grid)" rx={12} />

        {spec.title && (
          <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={fg}>
            {spec.title}
          </text>
        )}

        {/* Wires first (under components) */}
        {(spec.wires ?? []).map((w, i) => (
          <Wire key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} color={w.color} error={w.error} />
        ))}

        {/* Current-flow arrows */}
        {showCurrentFlow && (spec.currentFlow ?? []).map((a, i) => <CurrentArrow key={`a${i}`} x={a.x} y={a.y} rotation={a.rotation} label={a.label} />)}

        {/* Correct / error rings behind the nodes */}
        {spec.nodes.map((n) => {
          const box = RING_BOX[n.kind] ?? { w: 18, h: 18 };
          if (correctRegion === n.id)
            return <rect key={`c${n.id}`} x={n.x - box.w} y={n.y - box.h} width={box.w * 2} height={box.h * 2} rx={6} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="4 2" />;
          return null;
        })}

        {/* Nodes */}
        {spec.nodes.map((n) => (
          <g key={n.id}>{renderNode(n, props)}</g>
        ))}

        {/* Annotations */}
        {(spec.annotations ?? []).map((an, i) => (
          <text key={`an${i}`} x={an.x} y={an.y} textAnchor={an.align ?? 'middle'} fontSize={an.size ?? 10} fontWeight={600} fill={an.color ?? (dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)')}>
            {an.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
