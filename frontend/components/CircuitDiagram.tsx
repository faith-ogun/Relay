/**
 * CircuitDiagram — Interactive SVG circuit diagrams for lesson exercises.
 * Renders series/parallel circuits, breadboard layouts, and component diagrams.
 * Supports clickable regions for "identify the component" and "spot the error" exercises.
 */

import React, { useState } from 'react';

// ── SVG component primitives ──

function Battery({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string; highlight?: boolean; onClick?: (id: string) => void; id?: string }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => onClick?.(id || 'battery')}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      className={highlight ? 'circuit-highlight' : ''}
    >
      <line x1={-15} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <line x1={-6} y1={-14} x2={-6} y2={14} stroke="currentColor" strokeWidth={3} />
      <line x1={6} y1={-8} x2={6} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={6} y1={0} x2={15} y2={0} stroke="currentColor" strokeWidth={2} />
      <text x={0} y={-20} textAnchor="middle" fontSize={10} fill="currentColor" fontWeight={600}>{label || '5V'}</text>
      {/* + and - */}
      <text x={-12} y={-16} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>+</text>
      <text x={12} y={-16} textAnchor="middle" fontSize={9} fill="#3b82f6" fontWeight={700}>−</text>
      {highlight && <rect x={-18} y={-18} width={36} height={36} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

function Resistor({ x, y, rotation = 0, label, highlight, onClick, id, error }: { x: number; y: number; rotation?: number; label?: string; highlight?: boolean; onClick?: (id: string) => void; id?: string; error?: boolean }) {
  return (
    <g
      transform={`translate(${x},${y}) rotate(${rotation})`}
      onClick={() => onClick?.(id || 'resistor')}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <line x1={-25} y1={0} x2={-15} y2={0} stroke="currentColor" strokeWidth={2} />
      <polyline points="-15,-6 -10,6 -5,-6 0,6 5,-6 10,6 15,-6" fill="none" stroke={error ? '#ef4444' : 'currentColor'} strokeWidth={2} strokeLinejoin="round" />
      <line x1={15} y1={0} x2={25} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={rotation === 90 ? 18 : -12} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-18} y={-10} width={36} height={20} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

function LED({ x, y, rotation = 0, color = '#ef4444', label, highlight, onClick, id, error }: { x: number; y: number; rotation?: number; color?: string; label?: string; highlight?: boolean; onClick?: (id: string) => void; id?: string; error?: boolean }) {
  return (
    <g
      transform={`translate(${x},${y}) rotate(${rotation})`}
      onClick={() => onClick?.(id || 'led')}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <line x1={-20} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <polygon points="-6,-8 -6,8 8,0" fill={error ? '#ef4444' : color} opacity={0.7} stroke={error ? '#ef4444' : color} strokeWidth={1.5} />
      <line x1={8} y1={-8} x2={8} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={8} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {/* Light rays */}
      <line x1={4} y1={-12} x2={8} y2={-16} stroke={color} strokeWidth={1} opacity={0.5} />
      <line x1={8} y1={-14} x2={12} y2={-18} stroke={color} strokeWidth={1} opacity={0.5} />
      {label && <text x={0} y={16} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-10} y={-12} width={22} height={24} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

function LDRSymbol({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string; highlight?: boolean; onClick?: (id: string) => void; id?: string }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => onClick?.(id || 'ldr')}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <line x1={-20} y1={0} x2={-8} y2={0} stroke="currentColor" strokeWidth={2} />
      <circle cx={0} cy={0} r={10} fill="none" stroke="currentColor" strokeWidth={2} />
      {/* Zigzag inside */}
      <polyline points="-5,-3 -2,3 2,-3 5,3" fill="none" stroke="currentColor" strokeWidth={1.5} />
      {/* Arrows (light sensitivity) */}
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

function Wire({ x1, y1, x2, y2, color = 'currentColor', error }: { x1: number; y1: number; x2: number; y2: number; color?: string; error?: boolean }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={error ? '#ef4444' : color} strokeWidth={2} strokeDasharray={error ? '4 3' : 'none'} />;
}

function Junction({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} fill="currentColor" />;
}

function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1={0} y1={0} x2={0} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={-10} y1={8} x2={10} y2={8} stroke="currentColor" strokeWidth={2} />
      <line x1={-6} y1={12} x2={6} y2={12} stroke="currentColor" strokeWidth={1.5} />
      <line x1={-3} y1={16} x2={3} y2={16} stroke="currentColor" strokeWidth={1} />
    </g>
  );
}

function ArduinoPin({ x, y, pin, highlight, onClick, id }: { x: number; y: number; pin: string; highlight?: boolean; onClick?: (id: string) => void; id?: string }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => onClick?.(id || `pin-${pin}`)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <rect x={-14} y={-8} width={28} height={16} rx={3} fill={highlight ? '#f3e515' : '#006B8F'} stroke="#004d66" strokeWidth={1} />
      <text x={0} y={4} textAnchor="middle" fontSize={8} fill="white" fontWeight={700}>{pin}</text>
    </g>
  );
}

function Buzzer({ x, y, label, highlight, onClick, id }: { x: number; y: number; label?: string; highlight?: boolean; onClick?: (id: string) => void; id?: string }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => onClick?.(id || 'buzzer')}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <line x1={-20} y1={0} x2={-10} y2={0} stroke="currentColor" strokeWidth={2} />
      <rect x={-10} y={-10} width={20} height={20} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
      <text x={0} y={4} textAnchor="middle" fontSize={10} fill="currentColor" fontWeight={700}>♪</text>
      <line x1={10} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={22} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-14} y={-14} width={28} height={28} rx={6} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

function Switch({ x, y, open = true, label, highlight, onClick, id }: { x: number; y: number; open?: boolean; label?: string; highlight?: boolean; onClick?: (id: string) => void; id?: string }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => onClick?.(id || 'switch')}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <line x1={-20} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
      <circle cx={-6} cy={0} r={3} fill="currentColor" />
      {open
        ? <line x1={-6} y1={0} x2={10} y2={-10} stroke="currentColor" strokeWidth={2} />
        : <line x1={-6} y1={0} x2={10} y2={0} stroke="currentColor" strokeWidth={2} />
      }
      <circle cx={10} cy={0} r={3} fill="currentColor" />
      <line x1={10} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
      {label && <text x={0} y={16} textAnchor="middle" fontSize={9} fill="currentColor" fontWeight={500}>{label}</text>}
      {highlight && <rect x={-10} y={-14} width={24} height={22} rx={4} fill="none" stroke="#f3e515" strokeWidth={2.5} strokeDasharray="4 2" className="circuit-pulse" />}
    </g>
  );
}

function CurrentArrow({ x, y, rotation = 0, label }: { x: number; y: number; rotation?: number; label?: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`}>
      <line x1={-10} y1={0} x2={6} y2={0} stroke="#3b82f6" strokeWidth={1.5} />
      <polygon points="6,0 0,-3 0,3" fill="#3b82f6" />
      {label && <text x={0} y={-8} textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight={600}>{label}</text>}
    </g>
  );
}

// ── Pre-built circuit diagrams ──

export type CircuitId =
  | 'series_circuit'
  | 'parallel_circuit'
  | 'voltage_divider'
  | 'ldr_alarm'
  | 'led_no_resistor'
  | 'reversed_led'
  | 'short_circuit'
  | 'breadboard_layout';

export type ClickableRegion = {
  id: string;
  label: string;
  isCorrect?: boolean; // for spot-error / identify exercises
};

type CircuitDiagramProps = {
  circuit: CircuitId;
  dark?: boolean;
  width?: number;
  height?: number;
  clickable?: boolean;
  onRegionClick?: (regionId: string) => void;
  highlightRegion?: string | null;
  errorRegion?: string | null;
  correctRegion?: string | null;
  showLabels?: boolean;
  showCurrentFlow?: boolean;
  className?: string;
};

export default function CircuitDiagram({
  circuit,
  dark = false,
  width = 400,
  height = 250,
  clickable = false,
  onRegionClick,
  highlightRegion,
  errorRegion,
  correctRegion,
  showLabels = true,
  showCurrentFlow = false,
  className,
}: CircuitDiagramProps) {
  const handleClick = clickable ? (id: string) => onRegionClick?.(id) : undefined;
  const fg = dark ? '#e2e8f0' : '#334155';

  return (
    <div className={`relative ${className || ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        style={{ color: fg, maxHeight: height }}
        className="select-none"
      >
        {/* Subtle grid background */}
        <defs>
          <pattern id="circuit-grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={10} cy={10} r={0.5} fill={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={dark ? '#1a1a2e' : '#f8fafc'} rx={12} />
        <rect width={width} height={height} fill="url(#circuit-grid)" rx={12} />

        {circuit === 'series_circuit' && (
          <g>
            {/* Title */}
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={fg}>Series Circuit</text>
            {/* Battery */}
            <Battery x={80} y={80} label="5V" highlight={highlightRegion === 'battery'} onClick={handleClick} id="battery" />
            {/* Top wire */}
            <Wire x1={95} y1={80} x2={155} y2={80} />
            {/* Resistor */}
            <Resistor x={180} y={80} label={showLabels ? '220Ω' : undefined} highlight={highlightRegion === 'resistor'} onClick={handleClick} id="resistor" />
            {/* Wire to LED */}
            <Wire x1={205} y1={80} x2={265} y2={80} />
            {/* LED */}
            <LED x={290} y={80} color="#ef4444" label={showLabels ? 'LED' : undefined} highlight={highlightRegion === 'led'} onClick={handleClick} id="led" />
            {/* Right wire down */}
            <Wire x1={310} y1={80} x2={340} y2={80} />
            <Wire x1={340} y1={80} x2={340} y2={170} />
            {/* Bottom wire */}
            <Wire x1={340} y1={170} x2={60} y2={170} />
            {/* Left wire up */}
            <Wire x1={60} y1={170} x2={60} y2={80} />
            <Wire x1={60} y1={80} x2={65} y2={80} />
            {/* Current flow arrows */}
            {showCurrentFlow && (
              <>
                <CurrentArrow x={130} y={80} label="I" />
                <CurrentArrow x={250} y={80} label="I" />
                <CurrentArrow x={340} y={130} rotation={90} />
                <CurrentArrow x={200} y={170} rotation={180} />
              </>
            )}
            {/* Annotation */}
            <text x={width / 2} y={210} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Same current flows through every component
            </text>
          </g>
        )}

        {circuit === 'parallel_circuit' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={fg}>Parallel Circuit</text>
            {/* Battery */}
            <Battery x={60} y={125} label="5V" highlight={highlightRegion === 'battery'} onClick={handleClick} id="battery" />
            {/* Left wire up and down from battery */}
            <Wire x1={75} y1={125} x2={100} y2={125} />
            <Wire x1={100} y1={125} x2={100} y2={65} />
            <Wire x1={100} y1={125} x2={100} y2={185} />
            <Junction x={100} y={125} />
            {/* Top branch: R1 + LED1 */}
            <Wire x1={100} y1={65} x2={155} y2={65} />
            <Resistor x={180} y={65} label={showLabels ? 'R1' : undefined} highlight={highlightRegion === 'r1'} onClick={handleClick} id="r1" />
            <Wire x1={205} y1={65} x2={245} y2={65} />
            <LED x={270} y={65} color="#ef4444" label={showLabels ? 'LED 1' : undefined} highlight={highlightRegion === 'led1'} onClick={handleClick} id="led1" />
            <Wire x1={290} y1={65} x2={330} y2={65} />
            {/* Bottom branch: R2 + LED2 */}
            <Wire x1={100} y1={185} x2={155} y2={185} />
            <Resistor x={180} y={185} label={showLabels ? 'R2' : undefined} highlight={highlightRegion === 'r2'} onClick={handleClick} id="r2" />
            <Wire x1={205} y1={185} x2={245} y2={185} />
            <LED x={270} y={185} color="#22c55e" label={showLabels ? 'LED 2' : undefined} highlight={highlightRegion === 'led2'} onClick={handleClick} id="led2" />
            <Wire x1={290} y1={185} x2={330} y2={185} />
            {/* Right junction */}
            <Wire x1={330} y1={65} x2={330} y2={185} />
            <Junction x={330} y={125} />
            {/* Back to battery */}
            <Wire x1={330} y1={125} x2={350} y2={125} />
            <Wire x1={350} y1={125} x2={350} y2={220} />
            <Wire x1={350} y1={220} x2={40} y2={220} />
            <Wire x1={40} y1={220} x2={40} y2={125} />
            <Wire x1={40} y1={125} x2={45} y2={125} />
            {/* Current arrows */}
            {showCurrentFlow && (
              <>
                <CurrentArrow x={130} y={65} label="I₁" />
                <CurrentArrow x={130} y={185} label="I₂" />
                <CurrentArrow x={85} y={125} label="I" />
              </>
            )}
            <text x={width / 2} y={245} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Current splits between branches: I = I₁ + I₂
            </text>
          </g>
        )}

        {circuit === 'voltage_divider' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={fg}>Voltage Divider</text>
            {/* 5V source */}
            <text x={60} y={56} textAnchor="middle" fontSize={10} fill="#ef4444" fontWeight={700}>5V</text>
            <Wire x1={60} y1={60} x2={60} y2={80} color="#ef4444" />
            {/* R1 */}
            <Resistor x={60} y={100} rotation={90} label={showLabels ? 'R1 (LDR)' : undefined} highlight={highlightRegion === 'r1'} onClick={handleClick} id="r1" />
            {/* Midpoint */}
            <Wire x1={60} y1={120} x2={60} y2={140} />
            <Junction x={60} y={140} />
            {/* Vout label */}
            <Wire x1={60} y1={140} x2={140} y2={140} />
            <ArduinoPin x={160} y={140} pin="A0" highlight={highlightRegion === 'a0'} onClick={handleClick} id="a0" />
            <text x={110} y={132} textAnchor="middle" fontSize={10} fill="#22c55e" fontWeight={700}>Vout</text>
            {/* R2 */}
            <Resistor x={60} y={165} rotation={90} label={showLabels ? 'R2 (10kΩ)' : undefined} highlight={highlightRegion === 'r2'} onClick={handleClick} id="r2" />
            {/* Ground */}
            <Wire x1={60} y1={185} x2={60} y2={200} />
            <Ground x={60} y={200} />
            {/* Formula */}
            <text x={260} y={100} textAnchor="middle" fontSize={11} fill={fg} fontWeight={600}>Vout = Vin × R2/(R1+R2)</text>
            <text x={260} y={120} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Light → LDR low Ω → Vout high
            </text>
            <text x={260} y={136} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Dark → LDR high Ω → Vout low
            </text>
          </g>
        )}

        {circuit === 'ldr_alarm' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={fg}>Light-Activated Alarm Circuit</text>
            {/* Arduino box */}
            <rect x={20} y={50} width={70} height={140} rx={6} fill={dark ? '#0d3b54' : '#006B8F'} stroke="#004d66" strokeWidth={1.5} />
            <text x={55} y={70} textAnchor="middle" fontSize={10} fill="white" fontWeight={700}>Arduino</text>
            <text x={55} y={82} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.6)">Uno</text>
            {/* Pin labels */}
            <ArduinoPin x={90} y={100} pin="5V" highlight={highlightRegion === '5v'} onClick={handleClick} id="5v" />
            <ArduinoPin x={90} y={130} pin="A0" highlight={highlightRegion === 'a0'} onClick={handleClick} id="a0" />
            <ArduinoPin x={90} y={160} pin="D9" highlight={highlightRegion === 'd9'} onClick={handleClick} id="d9" />
            <ArduinoPin x={90} y={190} pin="GND" highlight={highlightRegion === 'gnd'} onClick={handleClick} id="gnd" />
            {/* 5V → LDR */}
            <Wire x1={104} y1={100} x2={180} y2={100} color="#ef4444" />
            <LDRSymbol x={200} y={100} label={showLabels ? 'LDR' : undefined} highlight={highlightRegion === 'ldr'} onClick={handleClick} id="ldr" />
            {/* LDR → junction → A0 */}
            <Wire x1={220} y1={100} x2={260} y2={100} />
            <Wire x1={260} y1={100} x2={260} y2={130} />
            <Wire x1={260} y1={130} x2={104} y2={130} />
            <Junction x={260} y={100} />
            {/* Junction → 10k → GND */}
            <Resistor x={260} y={145} rotation={90} label={showLabels ? '10kΩ' : undefined} highlight={highlightRegion === 'resistor'} onClick={handleClick} id="resistor" />
            <Wire x1={260} y1={165} x2={260} y2={190} />
            <Wire x1={260} y1={190} x2={104} y2={190} />
            {/* D9 → resistor → LED → GND */}
            <Wire x1={104} y1={160} x2={180} y2={160} />
            <Resistor x={200} y={160} label={showLabels ? '220Ω' : undefined} highlight={highlightRegion === 'led_resistor'} onClick={handleClick} id="led_resistor" />
            <Wire x1={225} y1={160} x2={280} y2={160} />
            <LED x={300} y={160} color="#ef4444" label={showLabels ? 'LED' : undefined} highlight={highlightRegion === 'led'} onClick={handleClick} id="led" />
            <Wire x1={320} y1={160} x2={350} y2={160} />
            <Wire x1={350} y1={160} x2={350} y2={190} />
            <Wire x1={350} y1={190} x2={260} y2={190} />
          </g>
        )}

        {circuit === 'led_no_resistor' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill="#ef4444">{`What's Wrong?`}</text>
            {/* Battery */}
            <Battery x={80} y={100} label="5V" onClick={handleClick} id="battery" />
            {/* Direct to LED - no resistor! */}
            <Wire x1={95} y1={100} x2={220} y2={100} />
            <LED x={250} y={100} color="#ef4444" label="LED" highlight={highlightRegion === 'led'} onClick={handleClick} id="led" error={errorRegion === 'missing_resistor'} />
            <Wire x1={270} y1={100} x2={330} y2={100} />
            <Wire x1={330} y1={100} x2={330} y2={170} />
            <Wire x1={330} y1={170} x2={60} y2={170} />
            <Wire x1={60} y1={170} x2={60} y2={100} />
            <Wire x1={60} y1={100} x2={65} y2={100} />
            {/* Error indicator zone */}
            {errorRegion === 'missing_resistor' && (
              <g>
                <rect x={120} y={85} width={80} height={30} rx={6} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" />
                <text x={160} y={78} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>Missing resistor!</text>
              </g>
            )}
            {/* Clickable "no resistor" zone */}
            <rect
              x={120} y={85} width={80} height={30} rx={6}
              fill="transparent"
              onClick={() => handleClick?.('missing_resistor')}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            />
            {/* Warning text */}
            <text x={width / 2} y={210} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Click on the problem area in the circuit
            </text>
          </g>
        )}

        {circuit === 'reversed_led' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill="#ef4444">{`What's Wrong?`}</text>
            {/* Battery */}
            <Battery x={60} y={100} label="5V" onClick={handleClick} id="battery" />
            <Wire x1={75} y1={100} x2={130} y2={100} />
            {/* Resistor */}
            <Resistor x={155} y={100} label="220Ω" onClick={handleClick} id="resistor" />
            <Wire x1={180} y1={100} x2={220} y2={100} />
            {/* Reversed LED */}
            <g
              transform={`translate(${250},${100}) rotate(180)`}
              onClick={() => handleClick?.('reversed_led')}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            >
              <line x1={-20} y1={0} x2={-6} y2={0} stroke="currentColor" strokeWidth={2} />
              <polygon points="-6,-8 -6,8 8,0" fill={errorRegion === 'reversed_led' ? '#ef4444' : '#ef4444'} opacity={0.7} stroke="#ef4444" strokeWidth={1.5} />
              <line x1={8} y1={-8} x2={8} y2={8} stroke="currentColor" strokeWidth={2} />
              <line x1={8} y1={0} x2={20} y2={0} stroke="currentColor" strokeWidth={2} />
              {errorRegion === 'reversed_led' && (
                <rect x={-22} y={-12} width={44} height={24} rx={6} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="4 2" />
              )}
            </g>
            <Wire x1={270} y1={100} x2={340} y2={100} />
            <Wire x1={340} y1={100} x2={340} y2={170} />
            <Wire x1={340} y1={170} x2={40} y2={170} />
            <Wire x1={40} y1={170} x2={40} y2={100} />
            <Wire x1={40} y1={100} x2={45} y2={100} />
            {errorRegion === 'reversed_led' && (
              <text x={250} y={78} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>LED is reversed!</text>
            )}
            <text x={width / 2} y={210} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Click on the component that's wrong
            </text>
          </g>
        )}

        {circuit === 'short_circuit' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill="#ef4444">{`What's Wrong?`}</text>
            <Battery x={60} y={100} label="5V" onClick={handleClick} id="battery" />
            <Wire x1={75} y1={100} x2={130} y2={100} />
            <Resistor x={155} y={100} label="220Ω" onClick={handleClick} id="resistor" />
            <Wire x1={180} y1={100} x2={240} y2={100} />
            <LED x={265} y={100} color="#ef4444" label="LED" onClick={handleClick} id="led" />
            <Wire x1={285} y1={100} x2={330} y2={100} />
            {/* Short circuit wire bypassing components */}
            <Wire x1={100} y1={100} x2={100} y2={60} color={errorRegion === 'short_wire' ? '#ef4444' : 'currentColor'} error={errorRegion === 'short_wire'} />
            <Wire x1={100} y1={60} x2={330} y2={60} color={errorRegion === 'short_wire' ? '#ef4444' : 'currentColor'} error={errorRegion === 'short_wire'} />
            <Wire x1={330} y1={60} x2={330} y2={100} color={errorRegion === 'short_wire' ? '#ef4444' : 'currentColor'} error={errorRegion === 'short_wire'} />
            {/* Clickable zone for short wire */}
            <rect
              x={95} y={50} width={240} height={25} rx={4}
              fill="transparent"
              onClick={() => handleClick?.('short_wire')}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            />
            <Wire x1={330} y1={100} x2={330} y2={170} />
            <Wire x1={330} y1={170} x2={40} y2={170} />
            <Wire x1={40} y1={170} x2={40} y2={100} />
            <Wire x1={40} y1={100} x2={45} y2={100} />
            {errorRegion === 'short_wire' && (
              <text x={215} y={48} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>Short circuit! Wire bypasses components</text>
            )}
            <text x={width / 2} y={210} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
              Click on the problem in this circuit
            </text>
          </g>
        )}

        {circuit === 'breadboard_layout' && (
          <g>
            <text x={width / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={fg}>Breadboard Connection Layout</text>
            {/* Breadboard body */}
            <rect x={40} y={40} width={320} height={170} rx={6} fill={dark ? '#2a2a3a' : '#f5f5f0'} stroke={dark ? '#444' : '#ccc'} strokeWidth={1} />
            {/* Power rails */}
            <rect x={45} y={45} width={310} height={14} rx={2} fill="#ef4444" opacity={0.15} />
            <text x={55} y={55} fontSize={8} fill="#ef4444" fontWeight={700}>+ 5V</text>
            <rect x={45} y={191} width={310} height={14} rx={2} fill="#3b82f6" opacity={0.15} />
            <text x={55} y={201} fontSize={8} fill="#3b82f6" fontWeight={700}>− GND</text>
            {/* Center gap */}
            <rect x={45} y={115} width={310} height={10} rx={2} fill={dark ? '#1a1a2e' : '#e5e5e0'} />
            <text x={200} y={123} textAnchor="middle" fontSize={7} fill={dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}>center gap</text>
            {/* Row labels */}
            {['a', 'b', 'c', 'd', 'e'].map((letter, i) => (
              <text key={letter} x={38} y={72 + i * 9} textAnchor="end" fontSize={7} fill={dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}>{letter}</text>
            ))}
            {['f', 'g', 'h', 'i', 'j'].map((letter, i) => (
              <text key={letter} x={38} y={132 + i * 9} textAnchor="end" fontSize={7} fill={dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}>{letter}</text>
            ))}
            {/* Hole grid - top half */}
            {Array.from({ length: 30 }).map((_, col) =>
              Array.from({ length: 5 }).map((_, row) => (
                <circle key={`t-${col}-${row}`} cx={55 + col * 10} cy={68 + row * 9} r={2} fill={dark ? '#555' : '#aaa'} />
              ))
            )}
            {/* Hole grid - bottom half */}
            {Array.from({ length: 30 }).map((_, col) =>
              Array.from({ length: 5 }).map((_, row) => (
                <circle key={`b-${col}-${row}`} cx={55 + col * 10} cy={130 + row * 9} r={2} fill={dark ? '#555' : '#aaa'} />
              ))
            )}
            {/* Connected group highlight */}
            <rect
              x={53} y={63} width={52} height={50} rx={3}
              fill={highlightRegion === 'row_group' ? 'rgba(243,229,21,0.15)' : 'transparent'}
              stroke={highlightRegion === 'row_group' ? '#f3e515' : 'transparent'}
              strokeWidth={1.5}
              onClick={() => handleClick?.('row_group')}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Interactive Drawing Canvas ──

type DrawPoint = { x: number; y: number };

type CircuitDrawingProps = {
  width?: number;
  height?: number;
  dark?: boolean;
  terminals: Array<{ x: number; y: number; label: string; id: string }>;
  expectedConnections: Array<[string, string]>;
  onComplete?: (correct: boolean) => void;
  className?: string;
};

export function CircuitDrawingCanvas({
  width = 400,
  height = 300,
  dark = false,
  terminals,
  expectedConnections,
  onComplete,
  className,
}: CircuitDrawingProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<DrawPoint[]>([]);
  const [lines, setLines] = useState<Array<{ points: DrawPoint[]; from: string; to: string }>>([]);
  const [startTerminal, setStartTerminal] = useState<string | null>(null);
  const [completedConnections, setCompletedConnections] = useState<Set<string>>(new Set());

  const TERMINAL_RADIUS = 14;

  const findTerminal = (x: number, y: number) => {
    return terminals.find(t => {
      const dx = t.x - x;
      const dy = t.y - y;
      return Math.sqrt(dx * dx + dy * dy) < TERMINAL_RADIUS * 1.5;
    });
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    const terminal = findTerminal(pos.x, pos.y);
    if (terminal) {
      setDrawing(true);
      setStartTerminal(terminal.id);
      setCurrentLine([{ x: terminal.x, y: terminal.y }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const pos = getCanvasPos(e);
    setCurrentLine(prev => [...prev, pos]);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startTerminal) {
      setDrawing(false);
      setCurrentLine([]);
      return;
    }
    const pos = getCanvasPos(e);
    const endTerminal = findTerminal(pos.x, pos.y);

    if (endTerminal && endTerminal.id !== startTerminal) {
      const connKey = [startTerminal, endTerminal.id].sort().join('-');
      const isExpected = expectedConnections.some(
        ([a, b]) => [a, b].sort().join('-') === connKey
      );
      setLines(prev => [...prev, { points: currentLine, from: startTerminal!, to: endTerminal.id }]);
      if (isExpected) {
        const newCompleted = new Set(completedConnections);
        newCompleted.add(connKey);
        setCompletedConnections(newCompleted);
        if (newCompleted.size === expectedConnections.length) {
          onComplete?.(true);
        }
      }
    }
    setDrawing(false);
    setCurrentLine([]);
    setStartTerminal(null);
  };

  // Render canvas
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = dark ? '#1a1a2e' : '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 12);
    ctx.fill();

    // Grid dots
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
    for (let x = 20; x < width; x += 20) {
      for (let y = 20; y < height; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw completed lines
    lines.forEach(line => {
      const connKey = [line.from, line.to].sort().join('-');
      const isCorrect = expectedConnections.some(([a, b]) => [a, b].sort().join('-') === connKey);
      ctx.strokeStyle = isCorrect ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      line.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });

    // Current drawing line
    if (currentLine.length > 0) {
      ctx.strokeStyle = '#f3e515';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      currentLine.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw terminals
    terminals.forEach(t => {
      const isActive = startTerminal === t.id;
      const isConnected = completedConnections.has(
        [...completedConnections].find(c => c.includes(t.id)) || ''
      );

      // Outer glow
      if (isActive) {
        ctx.fillStyle = 'rgba(243, 229, 21, 0.2)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, TERMINAL_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Circle
      ctx.fillStyle = isConnected ? '#22c55e' : isActive ? '#f3e515' : dark ? '#3a3a5a' : '#e2e8f0';
      ctx.strokeStyle = isConnected ? '#16a34a' : dark ? '#555' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, TERMINAL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = isConnected ? 'white' : dark ? '#e2e8f0' : '#334155';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, t.x, t.y);
    });

    // Instructions
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(
      completedConnections.size === expectedConnections.length
        ? 'All connections made!'
        : `Draw wires between terminals (${completedConnections.size}/${expectedConnections.length})`,
      width / 2,
      height - 12
    );
  }, [lines, currentLine, terminals, startTerminal, completedConnections, dark, width, height, expectedConnections]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDrawing(false); setCurrentLine([]); setStartTerminal(null); }}
        style={{ width: '100%', height: 'auto', borderRadius: 12, cursor: drawing ? 'crosshair' : 'pointer' }}
      />
      {lines.length > 0 && (
        <button
          type="button"
          onClick={() => { setLines([]); setCompletedConnections(new Set()); }}
          className={`mt-2 text-xs font-semibold ${dark ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
        >
          Clear all wires
        </button>
      )}
    </div>
  );
}

// ── Click-to-identify component on diagram ──

export type IdentifyTarget = {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
};

type SpotComponentProps = {
  dark?: boolean;
  width?: number;
  height?: number;
  svgContent: React.ReactNode;
  targets: IdentifyTarget[];
  correctId: string;
  question: string;
  onAnswer: (correct: boolean) => void;
  answered?: boolean;
  className?: string;
};

export function SpotComponentExercise({
  dark = false,
  width = 400,
  height = 250,
  svgContent,
  targets,
  correctId,
  question,
  onAnswer,
  answered = false,
  className,
}: SpotComponentProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const fg = dark ? '#e2e8f0' : '#334155';

  const handleClick = (id: string) => {
    if (answered) return;
    setSelected(id);
    onAnswer(id === correctId);
  };

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        style={{ color: fg, maxHeight: height }}
        className="select-none"
      >
        <defs>
          <pattern id="spot-grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={10} cy={10} r={0.5} fill={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={dark ? '#1a1a2e' : '#f8fafc'} rx={12} />
        <rect width={width} height={height} fill="url(#spot-grid)" rx={12} />

        {svgContent}

        {/* Clickable target zones */}
        {targets.map(target => {
          const isSelected = selected === target.id;
          const isCorrect = target.id === correctId;
          return (
            <g key={target.id}>
              <circle
                cx={target.x}
                cy={target.y}
                r={target.radius}
                fill={
                  answered && isCorrect ? 'rgba(34,197,94,0.15)'
                  : answered && isSelected && !isCorrect ? 'rgba(239,68,68,0.15)'
                  : isSelected ? 'rgba(243,229,21,0.15)'
                  : 'transparent'
                }
                stroke={
                  answered && isCorrect ? '#22c55e'
                  : answered && isSelected && !isCorrect ? '#ef4444'
                  : isSelected ? '#f3e515'
                  : 'transparent'
                }
                strokeWidth={2.5}
                strokeDasharray={answered ? 'none' : '4 3'}
                onClick={() => handleClick(target.id)}
                style={{ cursor: answered ? 'default' : 'pointer' }}
                className={!answered ? 'hover:stroke-yellow-400 hover:stroke-opacity-50' : ''}
              />
            </g>
          );
        })}

        {/* Question overlay */}
        <text x={width / 2} y={height - 12} textAnchor="middle" fontSize={10} fill={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}>
          {question}
        </text>
      </svg>
    </div>
  );
}
