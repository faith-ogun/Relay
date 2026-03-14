/**
 * ArduinoScene — Interactive 3D preview of the Light-Activated Alarm build.
 * Uses React Three Fiber to render Arduino Uno + breadboard + LDR + LED + wires.
 * User can rotate/zoom with OrbitControls.
 */

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

// Arduino Uno board (simplified)
function ArduinoBoard() {
  return (
    <group position={[-1.2, 0.1, 0]}>
      {/* PCB */}
      <RoundedBox args={[2.4, 0.12, 3]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color="#006B8F" metalness={0.3} roughness={0.6} />
      </RoundedBox>
      {/* USB port */}
      <mesh position={[0, 0.12, -1.35]}>
        <boxGeometry args={[0.5, 0.2, 0.3]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Power jack */}
      <mesh position={[-0.9, 0.12, -1.35]}>
        <cylinderGeometry args={[0.15, 0.15, 0.25, 12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* MCU chip */}
      <mesh position={[0.1, 0.12, 0.3]}>
        <boxGeometry args={[0.4, 0.08, 0.9]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Header pins (top row) */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={`dt-${i}`} position={[-0.85 + i * 0.13, 0.12, 1.35]}>
          <boxGeometry args={[0.06, 0.15, 0.06]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Header pins (bottom row) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`an-${i}`} position={[-0.85 + i * 0.13, 0.12, -1.0]}>
          <boxGeometry args={[0.06, 0.15, 0.06]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Label */}
      <Text position={[0.5, 0.13, -0.3]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.15} color="#fff" anchorX="center" anchorY="middle">
        Arduino Uno
      </Text>
    </group>
  );
}

// Breadboard
function Breadboard() {
  return (
    <group position={[1.8, 0.1, 0]}>
      {/* Base */}
      <RoundedBox args={[2.2, 0.1, 3]} radius={0.03} smoothness={4}>
        <meshStandardMaterial color="#f5f5f0" roughness={0.8} />
      </RoundedBox>
      {/* Center channel */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[2.0, 0.02, 0.15]} />
        <meshStandardMaterial color="#ddd" />
      </mesh>
      {/* Hole rows */}
      {Array.from({ length: 30 }).map((_, row) =>
        Array.from({ length: 10 }).map((_, col) => {
          const y = col < 5 ? -0.25 - col * 0.18 : 0.25 + (col - 5) * 0.18;
          return (
            <mesh key={`h-${row}-${col}`} position={[-0.9 + row * 0.065, 0.07, y]}>
              <cylinderGeometry args={[0.015, 0.015, 0.03, 6]} />
              <meshStandardMaterial color="#999" />
            </mesh>
          );
        })
      )}
      {/* Power rails */}
      <mesh position={[0, 0.06, -1.35]}>
        <boxGeometry args={[2.0, 0.02, 0.08]} />
        <meshStandardMaterial color="#ef4444" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 1.35]}>
        <boxGeometry args={[2.0, 0.02, 0.08]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// LDR (Light Dependent Resistor)
function LDR() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.material = ref.current.material as THREE.MeshStandardMaterial;
      (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 2) * 0.15;
    }
  });
  return (
    <group position={[1.6, 0.3, -0.4]}>
      {/* Body */}
      <mesh ref={ref}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
        <meshStandardMaterial color="#8B4513" emissive="#8B4513" emissiveIntensity={0.3} />
      </mesh>
      {/* Squiggly top pattern */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
        <meshStandardMaterial color="#CD853F" transparent opacity={0.7} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.05, -0.12, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
      <mesh position={[0.05, -0.12, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
    </group>
  );
}

// LED
function LED() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.4;
    }
  });
  return (
    <group position={[2.0, 0.3, 0.4]}>
      {/* LED dome */}
      <mesh ref={ref}>
        <sphereGeometry args={[0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
      {/* Base */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.04, 16]} />
        <meshStandardMaterial color="#ef4444" transparent opacity={0.6} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.03, -0.12, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
      <mesh position={[0.03, -0.12, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.15, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
    </group>
  );
}

// Resistor (10kΩ)
function Resistor() {
  return (
    <group position={[1.4, 0.25, 0]}>
      {/* Body */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
        <meshStandardMaterial color="#D2B48C" />
      </mesh>
      {/* Color bands */}
      {[
        { pos: -0.06, color: '#8B4513' },
        { pos: -0.02, color: '#000' },
        { pos: 0.02, color: '#FF8C00' },
        { pos: 0.06, color: '#FFD700' },
      ].map((band) => (
        <mesh key={band.pos} position={[band.pos, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.042, 0.042, 0.02, 8]} />
          <meshStandardMaterial color={band.color} />
        </mesh>
      ))}
      {/* Leads */}
      <mesh position={[-0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.15, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
      <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.15, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
    </group>
  );
}

// Jumper wire (simple curved line)
function JumperWire({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    Math.max(start[1], end[1]) + 0.3,
    (start[2] + end[2]) / 2,
  ];
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...start),
    new THREE.Vector3(...mid),
    new THREE.Vector3(...end),
  );
  const points = curve.getPoints(20);
  const geometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    20,
    0.015,
    8,
    false,
  );
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

export default function ArduinoScene({ className }: { className?: string }) {
  return (
    <div className={className} style={{ minHeight: 280 }}>
      <Canvas
        camera={{ position: [0, 4, 5], fov: 40 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#0a0a0a']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1} />
        <directionalLight position={[-3, 4, -3]} intensity={0.3} />
        <pointLight position={[2, 2, 0.4]} intensity={0.5} color="#ef4444" />

        <ArduinoBoard />
        <Breadboard />
        <LDR />
        <LED />
        <Resistor />

        {/* Jumper wires connecting components */}
        <JumperWire start={[-0.3, 0.2, 1.35]} end={[1.6, 0.2, -0.4]} color="#ef4444" />
        <JumperWire start={[-0.3, 0.2, -1.0]} end={[1.4, 0.2, 0]} color="#3b82f6" />
        <JumperWire start={[1.4, 0.2, 0]} end={[2.0, 0.2, 0.4]} color="#22c55e" />

        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={10}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate={false}
          enableDamping
          dampingFactor={0.08}
        />

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </Canvas>
    </div>
  );
}
