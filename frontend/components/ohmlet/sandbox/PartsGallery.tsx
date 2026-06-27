import React, { Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { ArrowLeft } from 'lucide-react';

// A procedural studio environment (no CDN HDR fetch): soft-box rectangles that
// show up in reflections, so metals and plastics read as photographed, not flat.
// Baked once (frames={1}). Shared by every tile.
const StudioEnv: React.FC = () => (
  <Environment resolution={256} frames={1}>
    <color attach="background" args={['#202020']} />
    <Lightformer form="rect" intensity={3} position={[2, 3, 4]} scale={[6, 6, 1]} target={[0, 0, 0]} color="#ffffff" />
    <Lightformer form="rect" intensity={1} position={[-4, 1, 2]} scale={[8, 4, 1]} color="#dfe8ff" />
    <Lightformer form="rect" intensity={2} position={[0, 2, -5]} scale={[10, 2, 1]} color="#ffffff" />
    <Lightformer form="circle" intensity={1.5} position={[0, 6, 0]} scale={6} target={[0, 0, 0]} color="#ffffff" />
  </Environment>
);
import {
  PlacedLED, PlacedResistor, PlacedLDR, PlacedThermistor, PlacedBuzzer, PlacedButton,
  PlacedPot, PlacedTransistor, PlacedMotor, PlacedServo,
} from '../../SandboxScene';

// ── Sandbox parts gallery (admin preview) ──
//
// A studio view of every 3D component in the breadboard sandbox, so the meshes
// can be reviewed and judged side by side (the bar: an expert should be happy
// with the parts on offer). Each tile is its own orbitable, lit scene that uses
// the exact same mesh the sandbox renders, so this stays in sync as the meshes
// improve. Route: /parts (admin-gated, lazy-loaded).

interface Part {
  label: string;
  family: string;
  spec: string;
  node: React.ReactNode;
}

const ORIGIN: [number, number, number] = [0, 0, 0];

const PARTS: Part[] = [
  { label: 'Red LED', family: 'Output', spec: '2V · 20mA', node: <PlacedLED position={ORIGIN} color="#ef4444" simState={{ on: true, brightness: 1 }} /> },
  { label: 'Green LED', family: 'Output', spec: '2.2V · 20mA', node: <PlacedLED position={ORIGIN} color="#22c55e" simState={{ on: true, brightness: 1 }} /> },
  { label: 'Blue LED', family: 'Output', spec: '3.2V · 20mA', node: <PlacedLED position={ORIGIN} color="#3b82f6" simState={{ on: true, brightness: 1 }} /> },
  { label: '220Ω resistor', family: 'Passive', spec: 'Current limiter', node: <PlacedResistor position={ORIGIN} /> },
  { label: 'LDR', family: 'Sensor', spec: 'Light-dependent', node: <PlacedLDR position={ORIGIN} /> },
  { label: 'Thermistor', family: 'Sensor', spec: 'NTC temperature', node: <PlacedThermistor position={ORIGIN} /> },
  { label: 'Push button', family: 'Input', spec: 'Momentary', node: <PlacedButton position={ORIGIN} /> },
  { label: 'Potentiometer', family: 'Input', spec: '10k rotary', node: <PlacedPot position={ORIGIN} value={0.7} /> },
  { label: 'NPN transistor', family: 'Active', spec: 'TO-92 / 2N2222', node: <PlacedTransistor position={ORIGIN} /> },
  { label: 'Piezo buzzer', family: 'Output', spec: '5V active', node: <PlacedBuzzer position={ORIGIN} active /> },
  { label: 'DC motor', family: 'Output', spec: '3-6V hobby', node: <PlacedMotor position={ORIGIN} active /> },
  { label: 'Servo', family: 'Output', spec: '9g micro', node: <PlacedServo position={ORIGIN} active /> },
];

const PartTile: React.FC<{ part: Part }> = ({ part }) => (
  <div className="overflow-hidden rounded-2xl border-2 border-ohmlet-ink bg-white shadow-press-sm">
    <div className="h-56 w-full bg-gradient-to-b from-[#f8fafc] to-[#e9eef5]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.24, 0.17, 0.24], fov: 34 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 5, 3]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <StudioEnv />
        </Suspense>
        <group position={[0, 0.01, 0]}>{part.node}</group>
        <ContactShadows position={[0, -0.05, 0]} opacity={0.45} scale={0.6} blur={2.4} far={0.25} resolution={512} color="#1a1a2e" />
        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate
          autoRotateSpeed={1.1}
          minDistance={0.18}
          maxDistance={0.7}
          target={[0, 0.03, 0]}
        />
      </Canvas>
    </div>
    <div className="flex items-center justify-between gap-2 border-t-2 border-ohmlet-ink px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-ohmlet-ink">{part.label}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ohmlet-ink-soft">{part.spec}</p>
      </div>
      <span className="shrink-0 rounded-full border-2 border-ohmlet-line bg-ohmlet-cream px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-ink-soft">
        {part.family}
      </span>
    </div>
  </div>
);

export const PartsGallery: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="min-h-screen bg-ohmlet-cream font-display">
    <div className="mx-auto max-w-6xl px-5 py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border-2 border-ohmlet-ink bg-white px-3.5 py-1.5 text-sm font-extrabold text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
      </button>

      <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Preview · Admin</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Sandbox parts gallery</h1>
      <p className="mt-2 max-w-2xl text-sm font-semibold text-ohmlet-ink-soft">
        Every 3D component in the breadboard sandbox, lit and orbitable. Drag to rotate. These are the exact meshes the
        sandbox renders, so this view tracks any quality improvements. {PARTS.length} parts.
      </p>

      <Suspense fallback={null}>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARTS.map((p) => (
            <PartTile key={p.label} part={p} />
          ))}
        </div>
      </Suspense>
    </div>
  </div>
);

export default PartsGallery;
