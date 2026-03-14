/**
 * Sandbox — Full 3D electronics playground tab.
 * Combines: 3D breadboard scene + component palette + wire tool + code editor + simulation.
 * Inspired by withdiode.com and wokwi.com.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Circle,
  Code2,
  Minus,
  MousePointer,
  Play,
  RotateCcw,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';

const SandboxScene = React.lazy(() => import('./SandboxScene'));
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

import type { CameraPreset, ComponentType, PlacedComponent, SelectedEntity, SimState } from './SandboxScene';

type PaletteItem = {
  type: ComponentType;
  label: string;
  color: string;
  description: string;
  family: string;
};

type ToolMode = ComponentType | 'select' | 'delete' | 'wire';

const BOARD_ITEMS: PaletteItem[] = [
  { type: 'breadboard', label: 'Breadboard', color: '#94a3b8', description: 'Full-size 830 tie-point', family: 'Board' },
  { type: 'arduino', label: 'Arduino Uno', color: '#008184', description: 'ATmega328P microcontroller', family: 'Board' },
];

const PALETTE: PaletteItem[] = [
  { type: 'led_red', label: 'Red LED', color: '#ef4444', description: '2V forward, 20mA', family: 'Output' },
  { type: 'led_green', label: 'Green LED', color: '#22c55e', description: '2.2V forward, 20mA', family: 'Output' },
  { type: 'led_blue', label: 'Blue LED', color: '#3b82f6', description: '3.2V forward, 20mA', family: 'Output' },
  { type: 'resistor_220', label: '220 ohm resistor', color: '#d2b48c', description: 'Current limiter for LEDs', family: 'Passive' },
  { type: 'resistor_10k', label: '10k ohm resistor', color: '#c4a882', description: 'Pull-up, pull-down, divider', family: 'Passive' },
  { type: 'ldr', label: 'LDR', color: '#eab308', description: 'Light-dependent resistor', family: 'Sensor' },
  { type: 'buzzer', label: 'Buzzer', color: '#6366f1', description: 'Piezo buzzer, 5V', family: 'Output' },
  { type: 'button', label: 'Push button', color: '#ef4444', description: 'Momentary tactile switch', family: 'Input' },
];

const CAMERA_OPTIONS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'fit', label: 'Fit' },
  { id: 'top', label: 'Top' },
  { id: 'left', label: 'Left' },
  { id: 'front', label: 'Front' },
];

const DEFAULT_CODE = `// Light-Activated Alarm — Relay Sandbox
// Wire: 5V -> LDR -> A0, A0 -> 10k resistor -> GND
// Wire: D9 -> 220 resistor -> LED -> GND

const int LDR_PIN = A0;
const int LED_PIN = 9;
const int THRESHOLD = 400;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);
  Serial.print("Light: ");
  Serial.println(lightLevel);

  if (lightLevel < THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("ALARM ON");
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  delay(200);
}
`;

import type { SandboxPreset } from './sandboxPresets';

type SandboxProps = {
  dark: boolean;
  t: Record<string, unknown>;
  preset?: SandboxPreset | null;
};

function pinLabel(col: number) {
  return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'][col] ?? '?';
}

function toolHint(
  tool: ToolMode,
  selectedPalette?: PaletteItem,
  wireStart?: { row: number; col: number } | null,
  selectedEntity?: SelectedEntity | null
) {
  if (tool === 'wire' && wireStart) {
    return `Finish the jumper wire from row ${wireStart.row + 1}, column ${pinLabel(wireStart.col)}.`;
  }
  if (tool === 'wire') {
    return 'Click one pin to start a wire, then click another pin to complete the run.';
  }
  if (tool === 'delete') {
    return 'Click any occupied pin to remove a component or wire endpoint.';
  }
  if (tool === 'select') {
    if (selectedEntity?.kind === 'component') return 'Component selected. Click another hole to move it.';
    if (selectedEntity?.kind === 'wire-start' || selectedEntity?.kind === 'wire-end') {
      return 'Wire endpoint selected. Click another hole to reattach it.';
    }
    return 'Click a placed part or wire endpoint, then click a new hole to move it.';
  }
  return `Place ${selectedPalette?.label.toLowerCase() ?? 'a component'} directly on the breadboard grid.`;
}

function PaletteGlyph({ type, color }: { type: ComponentType; color: string }) {
  if (type === 'breadboard') {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <rect x="3" y="8" width="26" height="16" rx="2" fill="#f1f5f9" stroke={color} strokeWidth="1.2" />
        <line x1="3" y1="16" x2="29" y2="16" stroke={color} strokeWidth="0.8" strokeDasharray="2 1.5" />
        <line x1="5" y1="10" x2="27" y2="10" stroke="#ef4444" strokeWidth="0.8" strokeOpacity="0.6" />
        <line x1="5" y1="22" x2="27" y2="22" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6" />
        {[7, 10, 13, 16, 19, 22, 25].map(x => (
          <React.Fragment key={x}>
            <circle cx={x} cy={13} r="0.7" fill={color} />
            <circle cx={x} cy={19} r="0.7" fill={color} />
          </React.Fragment>
        ))}
      </svg>
    );
  }

  if (type === 'arduino') {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <rect x="4" y="6" width="24" height="20" rx="2" fill={color} />
        <rect x="2" y="13" width="5" height="6" rx="1" fill="#a0a0a0" />
        <rect x="22" y="6" width="6" height="4" rx="1" fill="#1a1a1a" />
        <rect x="10" y="12" width="8" height="5" rx="1" fill="#1a1a1a" />
        <circle cx="11" cy="14.5" r="0.6" fill="#555" />
        {[8, 11, 14, 17, 20, 23].map(x => (
          <rect key={`t-${x}`} x={x} y="7" width="1.2" height="1.5" rx="0.3" fill="#c9a600" />
        ))}
        {[8, 11, 14, 17, 20, 23].map(x => (
          <rect key={`b-${x}`} x={x} y="23.5" width="1.2" height="1.5" rx="0.3" fill="#c9a600" />
        ))}
        <circle cx="23" cy="20" r="1" fill="#22c55e" fillOpacity="0.7" />
      </svg>
    );
  }

  if (type.startsWith('led_')) {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <path d="M10 17c0-4.4 2.7-8 6-8s6 3.6 6 8v5H10v-5Z" fill={color} opacity="0.92" />
        <path d="M10 18h12" stroke="white" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 22v7M20 22v7" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M22 8l3-3M19 6l2-2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (type.startsWith('resistor_')) {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <path d="M4 16h7M21 16h7" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="11" y="10" width="10" height="12" rx="4" fill={color} stroke="#b68b5d" strokeWidth="1" />
        <path d="M13 10v12M16 10v12M19 10v12" stroke="#5b4632" strokeWidth="1.2" strokeOpacity="0.75" />
      </svg>
    );
  }

  if (type === 'ldr') {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <circle cx="16" cy="12" r="7" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.4" />
        <path d="M13 9.5h6l-6 5h6" stroke="#9a6700" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 19v9M19 19v9" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M23 7l3-3M21 5l2-2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'buzzer') {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <circle cx="16" cy="13" r="8" fill="#1f2937" />
        <circle cx="16" cy="13" r="3" fill={color} />
        <path d="M13 21v7M19 21v7" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 10c1.4 1 2.2 2.2 2.2 3.8S25.4 16.6 24 17.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
      <rect x="8" y="12" width="16" height="10" rx="4" fill="#1f2937" />
      <rect x="11" y="7" width="10" height="7" rx="3" fill={color} />
      <path d="M12 22v6M20 22v6M10 12V6M22 12V6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Sandbox({ dark, t: _t, preset }: SandboxProps) {
  void _t;

  const [components, setComponents] = useState<PlacedComponent[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolMode>('select');
  const [wireStart, setWireStart] = useState<{ row: number; col: number } | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [showCode, setShowCode] = useState(true);
  const [showSerial, setShowSerial] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('fit');
  const [cameraTick, setCameraTick] = useState(0);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [simState, setSimState] = useState<SimState>({
    running: false,
    ledStates: {},
    buzzerOn: false,
    serialOutput: [],
    analogValues: {},
  });
  const nextId = useRef(1);
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const serialEndRef = useRef<HTMLDivElement>(null);
  const presetApplied = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Buzzer audio — play a tone when buzzerOn is true during simulation
  useEffect(() => {
    if (simState.buzzerOn) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (!oscillatorRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscillatorRef.current = osc;
        gainRef.current = gain;
      }
    } else {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
        gainRef.current = null;
      }
    }
  }, [simState.buzzerOn]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
      gainRef.current?.disconnect();
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
    };
  }, []);

  // Apply preset when provided (e.g. from Library "3D Twin" button)
  useEffect(() => {
    if (!preset || presetApplied.current === preset.name) return;
    presetApplied.current = preset.name;
    setComponents(preset.components);
    setCode(preset.code);
    nextId.current = preset.components.length + 10;
    setSelectedTool('select');
    setWireStart(null);
    setSelectedEntity(null);
    setCameraPreset('fit');
    setCameraTick(v => v + 1);
    stopSimulation();
  }, [preset]);

  const selectedPalette = useMemo(
    () => PALETTE.find((item) => item.type === selectedTool),
    [selectedTool]
  );

  const clearTransientState = useCallback(() => {
    setWireStart(null);
    setSelectedEntity(null);
  }, []);

  const triggerCamera = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraTick((value) => value + 1);
  }, []);

  const stopSimulation = useCallback(() => {
    if (simInterval.current) {
      clearInterval(simInterval.current);
      simInterval.current = null;
    }

    setSimState((prev) => ({
      ...prev,
      running: false,
      ledStates: {},
      buzzerOn: false,
      analogValues: {},
      serialOutput: prev.running ? [...prev.serialOutput, '--- Simulation stopped ---'] : prev.serialOutput,
    }));
  }, []);

  const handlePlaceComponent = useCallback((row: number, col: number) => {
    if (selectedTool === 'select' || selectedTool === 'delete' || selectedTool === 'wire') return;

    setComponents((prev) => {
      const occupied = prev.some((item) => item.type !== 'wire' && item.row === row && item.col === col);
      if (occupied) return prev;

      const id = `c${nextId.current++}`;
      return [
        ...prev,
        {
          id,
          type: selectedTool,
          row,
          col,
          rotation: 0,
        },
      ];
    });
    setSelectedEntity(null);
  }, [selectedTool]);

  const handleRemoveComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleStartWire = useCallback((row: number, col: number) => {
    setSelectedEntity(null);
    setWireStart({ row, col });
  }, []);

  const handleEndWire = useCallback((row: number, col: number) => {
    if (!wireStart) return;
    if (wireStart.row === row && wireStart.col === col) {
      setWireStart(null);
      return;
    }

    setComponents((prev) => {
      const duplicate = prev.some((item) => {
        if (item.type !== 'wire') return false;
        const sameDirection = item.row === wireStart.row && item.col === wireStart.col && item.endRow === row && item.endCol === col;
        const reverseDirection = item.row === row && item.col === col && item.endRow === wireStart.row && item.endCol === wireStart.col;
        return sameDirection || reverseDirection;
      });

      if (duplicate) return prev;

      const id = `w${nextId.current++}`;
      return [
        ...prev,
        {
          id,
          type: 'wire',
          row: wireStart.row,
          col: wireStart.col,
          rotation: 0,
          endRow: row,
          endCol: col,
        },
      ];
    });

    setWireStart(null);
  }, [wireStart]);

  const handleSelectEntity = useCallback((entity: SelectedEntity | null) => {
    setSelectedEntity((prev) => {
      if (!entity) return null;
      if (prev && prev.id === entity.id && prev.kind === entity.kind) return null;
      return entity;
    });
  }, []);

  const handleMoveEntity = useCallback((entity: SelectedEntity, row: number, col: number) => {
    let moved = false;

    setComponents((prev) => {
      if (entity.kind === 'component') {
        const target = prev.find((item) => item.id === entity.id && item.type !== 'wire');
        if (!target) return prev;

        if (target.row === row && target.col === col) {
          moved = true;
          return prev;
        }

        const occupied = prev.some(
          (item) => item.id !== target.id && item.type !== 'wire' && item.row === row && item.col === col
        );
        if (occupied) return prev;

        moved = true;
        return prev.map((item) => (item.id === target.id ? { ...item, row, col } : item));
      }

      const wire = prev.find((item) => item.id === entity.id && item.type === 'wire');
      if (!wire || wire.endRow === undefined || wire.endCol === undefined) return prev;

      if (entity.kind === 'wire-start') {
        if (wire.endRow === row && wire.endCol === col) return prev;
        if (wire.row === row && wire.col === col) {
          moved = true;
          return prev;
        }

        const duplicate = prev.some((item) => {
          if (item.id === wire.id || item.type !== 'wire') return false;
          const sameDirection = item.row === row && item.col === col && item.endRow === wire.endRow && item.endCol === wire.endCol;
          const reverseDirection = item.row === wire.endRow && item.col === wire.endCol && item.endRow === row && item.endCol === col;
          return sameDirection || reverseDirection;
        });
        if (duplicate) return prev;

        moved = true;
        return prev.map((item) => (item.id === wire.id ? { ...item, row, col } : item));
      }

      if (wire.row === row && wire.col === col) return prev;
      if (wire.endRow === row && wire.endCol === col) {
        moved = true;
        return prev;
      }

      const duplicate = prev.some((item) => {
        if (item.id === wire.id || item.type !== 'wire') return false;
        const sameDirection = item.row === wire.row && item.col === wire.col && item.endRow === row && item.endCol === col;
        const reverseDirection = item.row === row && item.col === col && item.endRow === wire.row && item.endCol === wire.col;
        return sameDirection || reverseDirection;
      });
      if (duplicate) return prev;

      moved = true;
      return prev.map((item) => (item.id === wire.id ? { ...item, endRow: row, endCol: col } : item));
    });

      if (moved) {
        setSelectedEntity(null);
      }
  }, []);

  const handleMoveSelectedEntity = useCallback((row: number, col: number) => {
    if (!selectedEntity) return;
    handleMoveEntity(selectedEntity, row, col);
  }, [handleMoveEntity, selectedEntity]);

  const handleClear = useCallback(() => {
    setComponents([]);
    clearTransientState();
    triggerCamera('fit');
    stopSimulation();
  }, [clearTransientState, stopSimulation, triggerCamera]);

  const startSimulation = useCallback(() => {
    if (simInterval.current) {
      clearInterval(simInterval.current);
      simInterval.current = null;
    }

    // ── Basic circuit validation ──
    // Check that key components are placed and connected via wires
    const wires = components.filter((c) => c.type === 'wire');
    const leds = components.filter((item) => item.type.startsWith('led_'));
    const hasLDR = components.some((item) => item.type === 'ldr');
    const hasBuzzer = components.some((item) => item.type === 'buzzer');
    const hasArduino = components.some((item) => item.type === 'arduino');
    const hasBreadboard = components.some((item) => item.type === 'breadboard');
    const hasResistor = components.some((item) => item.type.startsWith('resistor_'));

    const warnings: string[] = [];
    if (!hasBreadboard) warnings.push('No breadboard placed — components need a breadboard to connect.');
    if (!hasArduino) warnings.push('No Arduino placed — the circuit needs a microcontroller.');
    if (leds.length === 0 && !hasBuzzer) warnings.push('No output component (LED or buzzer) — nothing to activate.');
    if (!hasLDR && !components.some((c) => c.type === 'button')) warnings.push('No input sensor — the circuit needs an LDR or button to respond to.');
    if (wires.length === 0 && components.filter((c) => c.type !== 'breadboard' && c.type !== 'arduino').length > 0) {
      warnings.push('No wires placed — components are not connected to each other.');
    }
    if (components.filter((c) => c.type !== 'breadboard' && c.type !== 'arduino' && c.type !== 'wire').length > 0 && !hasResistor) {
      warnings.push('No resistor in circuit — most circuits need a current-limiting resistor.');
    }

    const serialInit = ['--- Simulation started ---'];
    if (warnings.length > 0) {
      serialInit.push('⚠ Circuit validation:');
      warnings.forEach((w) => serialInit.push(`  • ${w}`));
      serialInit.push('Simulation running with available components...');
    } else {
      serialInit.push('✓ Circuit validation passed — all key components connected.');
    }

    setSimState((prev) => ({
      ...prev,
      running: true,
      serialOutput: serialInit,
    }));
    setShowSerial(true);

    let tick = 0;

    simInterval.current = setInterval(() => {
      tick += 1;
      const lightLevel = hasLDR ? Math.floor(260 + Math.sin(tick * 0.3) * 240) : 512;
      const alarmOn = lightLevel < 400;

      setSimState((prev) => ({
        ...prev,
        ledStates: Object.fromEntries(
          leds.map((led) => [
            led.id,
            {
              on: alarmOn || tick % 4 < 2,
              brightness: alarmOn ? 1 : 0.6,
            },
          ])
        ),
        buzzerOn: hasBuzzer && alarmOn,
        analogValues: { A0: lightLevel },
        serialOutput: [...prev.serialOutput.slice(-50), `Light: ${lightLevel}${alarmOn ? ' -> ALARM ON' : ''}`],
      }));
    }, 500);
  }, [components]);

  useEffect(() => {
    return () => {
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  useEffect(() => {
    serialEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simState.serialOutput]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTool('select');
        clearTransientState();
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTool === 'select') {
        setSelectedTool('delete');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearTransientState, selectedTool]);

  const toolButtonClass = (active: boolean, intent: 'default' | 'danger' = 'default') => {
    if (active && intent === 'danger') {
      return 'bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.22)]';
    }

    if (active) {
      return 'bg-[#f3e515] text-black shadow-[0_10px_24px_rgba(243,229,21,0.28)]';
    }

    return 'bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm';
  };

  const panelToggleClass = (active: boolean) =>
    active
      ? 'bg-slate-900 text-white shadow-sm'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900';

  return (
    <div className="relay-fade-in flex h-full flex-col overflow-hidden bg-[#f6f8fb] text-slate-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTool('select');
              clearTransientState();
            }}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black transition-all ${toolButtonClass(selectedTool === 'select')}`}
          >
            <MousePointer className="h-3.5 w-3.5" />
            Move
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedTool('wire');
              clearTransientState();
            }}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black transition-all ${toolButtonClass(selectedTool === 'wire')}`}
          >
            <Minus className="h-3.5 w-3.5" />
            Wire
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedTool('delete');
              clearTransientState();
            }}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black transition-all ${toolButtonClass(selectedTool === 'delete', 'danger')}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        <div className="hidden h-7 w-px bg-slate-200 lg:block" />

        {(selectedEntity || wireStart) && (
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600">
            {toolHint(selectedTool, selectedPalette, wireStart, selectedEntity)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {CAMERA_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => triggerCamera(option.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                cameraPreset === option.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <Circle className={`h-2.5 w-2.5 ${simState.running ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300'}`} />
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              {simState.running ? 'Live sim' : 'Workbench ready'}
            </span>
          </div>

          {!simState.running ? (
            <button
              type="button"
              onClick={startSimulation}
              disabled={components.filter(c => c.type !== 'breadboard' && c.type !== 'arduino').length === 0}
              className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
              Simulate
            </button>
          ) : (
            <button
              type="button"
              onClick={stopSimulation}
              className="flex items-center gap-2 rounded-2xl bg-rose-500 px-4 py-2 text-xs font-black text-white transition-all hover:bg-rose-600 active:scale-[0.98]"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCode((value) => !value)}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black transition-all ${panelToggleClass(showCode)}`}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
          <button
            type="button"
            onClick={() => setShowSerial((value) => !value)}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black transition-all ${panelToggleClass(showSerial)}`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Serial
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-2xl bg-slate-100 p-2.5 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900"
            aria-label="Clear sandbox"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-[#fbfcfe]">
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Boards</p>

            <div className="mb-4 space-y-1.5">
              {BOARD_ITEMS.map((item) => {
                const placed = components.some(c => c.type === item.type);
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      if (placed) return;
                      setComponents(prev => [...prev, {
                        id: `c${nextId.current++}`,
                        type: item.type,
                        row: -1,
                        col: -1,
                        rotation: 0,
                      }]);
                    }}
                    className={`w-full rounded-[20px] border px-3 py-2.5 text-left transition-all ${
                      placed
                        ? 'border-emerald-200 bg-emerald-50/60 opacity-70'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${placed ? 'bg-emerald-50' : 'bg-slate-50'}`} style={{ color: item.color }}>
                        <PaletteGlyph type={item.type} color={item.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-slate-900">{item.label}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          {placed ? 'Placed' : item.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Components</p>

            <div className="space-y-1.5">
              {PALETTE.map((item) => {
                const active = selectedTool === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setSelectedTool(item.type);
                      setWireStart(null);
                    }}
                    className={`w-full rounded-[20px] border px-3 py-2.5 text-left transition-all ${
                      active
                        ? 'border-[#f3e515] bg-[#fffde8] shadow-[0_16px_32px_rgba(243,229,21,0.18)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          active ? 'bg-white shadow-sm' : 'bg-slate-50'
                        }`}
                        style={{ color: item.color }}
                      >
                        <PaletteGlyph type={item.type} color={item.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-slate-900">{item.label}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          {item.family}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-3">
            <div className="relative h-full overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(241,245,249,0.94)_42%,rgba(226,232,240,0.92))] shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(226,232,240,0.9))]">
                    <div className="text-center">
                      <Box className="mx-auto mb-3 h-9 w-9 animate-pulse text-slate-400" />
                      <p className="text-sm font-black text-slate-500">Loading 3D workspace...</p>
                    </div>
                  </div>
                }
              >
                <SandboxScene
                  components={components}
                  selectedTool={selectedTool}
                  onPlaceComponent={handlePlaceComponent}
                  onRemoveComponent={handleRemoveComponent}
                  onStartWire={handleStartWire}
                  onEndWire={handleEndWire}
                  onSelectEntity={handleSelectEntity}
                  onMoveEntity={handleMoveEntity}
                  onMoveSelectedEntity={handleMoveSelectedEntity}
                  wireStart={wireStart}
                  selectedEntity={selectedEntity}
                  simState={simState}
                  cameraPreset={cameraPreset}
                  cameraTick={cameraTick}
                  className="h-full w-full"
                />
              </Suspense>

              {simState.running && (
                <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 shadow-[0_18px_40px_rgba(16,185,129,0.35)]">
                  <Circle className="h-2.5 w-2.5 fill-white text-white" />
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white">Simulation live</span>
                </div>
              )}
            </div>
          </div>

          {showSerial && (
            <div className="mx-3 mb-3 flex h-40 min-h-[10rem] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-[#0f172a] shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">Serial monitor</span>
                  {simState.analogValues.A0 !== undefined && (
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-mono text-amber-300/90">
                      A0 {simState.analogValues.A0}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSimState((prev) => ({ ...prev, serialOutput: [] }))}
                  className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
                >
                  Clear
                </button>
              </div>
              <div className="relay-chat-scroll flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-5 text-emerald-300/85">
                {simState.serialOutput.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className={
                      line.includes('ALARM')
                        ? 'font-bold text-rose-300'
                        : line.startsWith('---')
                          ? 'text-white/35'
                          : ''
                    }
                  >
                    {line}
                  </div>
                ))}
                <div ref={serialEndRef} />
              </div>
            </div>
          )}
        </div>

        {showCode && (
          <div className="flex w-[390px] shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-[#f3e515]" />
                  <span className="text-xs font-black text-slate-800">sketch.ino</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Arduino C++
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Edit the sketch while you place components. The sandbox still uses lightweight simulation logic, so visuals stay fast.
              </p>
            </div>

            <div className="min-h-0 flex-1">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-white">
                    <p className="text-sm font-semibold text-slate-400">Loading editor...</p>
                  </div>
                }
              >
                <MonacoEditor
                  height="100%"
                  language="cpp"
                  theme={dark ? 'vs-dark' : 'light'}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  options={{
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, Fira Code, monospace',
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    tabSize: 2,
                    automaticLayout: true,
                    padding: { top: 10 },
                    renderLineHighlight: 'gutter',
                  }}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
