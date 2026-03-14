/**
 * SandboxScene — Interactive 3D electronics sandbox/playground.
 * Inspired by withdiode.com and wokwi.com.
 *
 * Features:
 * - 3D breadboard with clickable pin grid
 * - Camera presets for fit, top, side, and front views
 * - Placeable parts and wire routing
 * - Lightweight simulation feedback for LEDs and buzzers
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

export type ComponentType =
  | 'led_red'
  | 'led_green'
  | 'led_blue'
  | 'resistor_220'
  | 'resistor_10k'
  | 'ldr'
  | 'buzzer'
  | 'button'
  | 'wire'
  | 'breadboard'
  | 'arduino';

export type PlacedComponent = {
  id: string;
  type: ComponentType;
  row: number;
  col: number;
  rotation: number;
  endRow?: number;
  endCol?: number;
};

export type SimState = {
  running: boolean;
  ledStates: Record<string, { on: boolean; brightness: number }>;
  buzzerOn: boolean;
  serialOutput: string[];
  analogValues: Record<string, number>;
};

export type CameraPreset = 'fit' | 'top' | 'left' | 'front';

export type SelectedEntity =
  | { kind: 'component'; id: string }
  | { kind: 'wire-start'; id: string }
  | { kind: 'wire-end'; id: string };

type SandboxSceneProps = {
  components: PlacedComponent[];
  selectedTool: ComponentType | 'select' | 'delete' | 'wire';
  onPlaceComponent: (row: number, col: number) => void;
  onRemoveComponent: (id: string) => void;
  onStartWire: (row: number, col: number) => void;
  onEndWire: (row: number, col: number) => void;
  onSelectEntity: (entity: SelectedEntity | null) => void;
  onMoveEntity: (entity: SelectedEntity, row: number, col: number) => void;
  onMoveSelectedEntity: (row: number, col: number) => void;
  wireStart: { row: number; col: number } | null;
  selectedEntity: SelectedEntity | null;
  simState: SimState;
  cameraPreset: CameraPreset;
  cameraTick: number;
  className?: string;
};

type PinTarget = { row: number; col: number };
type DragState = { entity: SelectedEntity; hoveredPin: PinTarget | null };

const BOARD_ROWS = 60;
const BOARD_COLS = 10;
const PIN_SPACING = 0.084;
const BOARD_WIDTH = (BOARD_ROWS - 1) * PIN_SPACING + 0.56;
const BOARD_DEPTH = 1.72;
const BOARD_HEIGHT = 0.18;
const BOARD_Y = 0;
const BOARD_TOP = BOARD_Y + BOARD_HEIGHT / 2;
const MAIN_HOLE_Z = [-0.43, -0.34, -0.25, -0.16, -0.07, 0.07, 0.16, 0.25, 0.34, 0.43] as const;
const RAIL_HOLE_Z = [-0.72, -0.58, 0.58, 0.72] as const;
const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  fit: { position: [0, 4.5, 6.5], target: [0, 0.1, -0.6] },
  top: { position: [0, 9, -0.5], target: [0, 0, -0.5] },
  left: { position: [-8.5, 3, -0.5], target: [0, 0.1, -0.5] },
  front: { position: [0, 2.5, 8], target: [0, 0.1, -0.5] },
};

function gridToWorld(row: number, col: number): [number, number, number] {
  const x = -BOARD_WIDTH / 2 + 0.28 + row * PIN_SPACING;
  return [x, BOARD_TOP + 0.01, MAIN_HOLE_Z[col]];
}

function BreadboardMesh({
  onPinClick,
  onHoverDragTarget,
  wireStart,
  selectedTool,
  selectedEntity,
  selectedPins,
  dragState,
}: {
  onPinClick: (row: number, col: number) => void;
  onHoverDragTarget: (pin: PinTarget | null) => void;
  wireStart: { row: number; col: number } | null;
  selectedTool: string;
  selectedEntity: SelectedEntity | null;
  selectedPins: Set<string>;
  dragState: DragState | null;
}) {
  const [hoverPin, setHoverPin] = useState<string | null>(null);
  const COL_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const rowX = useMemo(
    () => Array.from({ length: BOARD_ROWS }, (_, row) => -BOARD_WIDTH / 2 + 0.28 + row * PIN_SPACING),
    []
  );
  const cursor =
    dragState
      ? 'grabbing'
      : selectedTool === 'wire'
        ? 'crosshair'
        : selectedTool === 'delete'
          ? 'pointer'
          : selectedEntity
            ? 'grab'
            : 'pointer';

  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.15, -0.09, 0]} receiveShadow>
        <planeGeometry args={[BOARD_WIDTH + 1.2, BOARD_DEPTH + 0.72]} />
        <meshStandardMaterial color="#d6dfe9" transparent opacity={0.68} />
      </mesh>

      <RoundedBox args={[BOARD_WIDTH, BOARD_HEIGHT, BOARD_DEPTH]} radius={0.045} smoothness={6} position={[0, BOARD_Y, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f8f8f5" roughness={0.93} />
      </RoundedBox>

      {[
        { z: -0.645, depth: 0.24 },
        { z: -0.255, depth: 0.54 },
        { z: 0.255, depth: 0.54 },
        { z: 0.645, depth: 0.24 },
      ].map((section, index) => (
        <mesh key={index} position={[0, BOARD_TOP + 0.003, section.z]}>
          <boxGeometry args={[BOARD_WIDTH - 0.08, 0.012, section.depth]} />
          <meshStandardMaterial color="#fefefb" roughness={0.95} />
        </mesh>
      ))}

      <mesh position={[0, BOARD_TOP + 0.001, 0]}>
        <boxGeometry args={[BOARD_WIDTH - 0.22, 0.006, 0.1]} />
        <meshStandardMaterial color="#ecece7" />
      </mesh>

      {[-0.75, -0.56, 0.56, 0.75].map((railZ, railIndex) => (
        <mesh key={railIndex} position={[0, BOARD_TOP + 0.008, railZ]}>
          <boxGeometry args={[BOARD_WIDTH - 0.2, 0.004, 0.02]} />
          <meshStandardMaterial
            color={railIndex % 2 === 0 ? '#fb6a3b' : '#8dbbe4'}
            transparent
            opacity={railIndex % 2 === 0 ? 0.9 : 0.85}
          />
        </mesh>
      ))}

      {[-1, 1].map((side) =>
        [-0.74, -0.56, 0.56, 0.74].map((z, index) => (
          <Text
            key={`${side}-${z}`}
            position={[side * (BOARD_WIDTH / 2 - 0.06), BOARD_TOP + 0.016, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.07}
            color={index % 2 === 0 ? '#dc2626' : '#2563eb'}
            anchorX="center"
            fontWeight="bold"
          >
            {index % 2 === 0 ? '+' : '\u2013'}
          </Text>
        ))
      )}

      {RAIL_HOLE_Z.flatMap((z) =>
        rowX.map((x, row) => (
          <group key={`rail-hole-${z}-${row}`}>
            <mesh position={[x, BOARD_TOP + 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.016, 0.026, 14]} />
              <meshStandardMaterial color="#c0c8d0" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[x, BOARD_TOP + 0.011, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.016, 14]} />
              <meshStandardMaterial color="#1a1e24" roughness={0.6} />
            </mesh>
          </group>
        ))
      )}

      {Array.from({ length: BOARD_ROWS }).map((_, row) =>
        Array.from({ length: BOARD_COLS }).map((__, col) => {
          const [px, , pz] = gridToWorld(row, col);
          const key = `${row}-${col}`;
          const isHovered = hoverPin === key;
          const isWireStart = wireStart?.row === row && wireStart?.col === col;
          const isSelectedPin = selectedPins.has(key);

          return (
            <group key={key}>
              {/* metallic contact rim — sits above board surface */}
              <mesh position={[px, BOARD_TOP + 0.012, pz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.016, 0.026, 14]} />
                <meshStandardMaterial color="#b0bac4" metalness={0.5} roughness={0.35} />
              </mesh>
              {/* dark hole center */}
              <mesh position={[px, BOARD_TOP + 0.011, pz]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.016, 14]} />
                <meshStandardMaterial color="#111418" roughness={0.6} />
              </mesh>
              {(isWireStart || isSelectedPin || isHovered) && (
                <>
                  <mesh position={[px, BOARD_TOP + 0.0015, pz]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.022, 0.036, 20]} />
                    <meshBasicMaterial
                      color={isWireStart ? '#f3e515' : isSelectedPin ? '#f59e0b' : '#60a5fa'}
                      transparent
                      opacity={0.96}
                    />
                  </mesh>
                  {isHovered && (
                    <Text
                      position={[px, BOARD_TOP + 0.12, pz]}
                      fontSize={0.06}
                      color="#0f172a"
                      anchorX="center"
                      anchorY="bottom"
                      fontWeight="bold"
                      outlineWidth={0.006}
                      outlineColor="#ffffff"
                    >
                      {`${COL_LETTERS[col]}${row + 1}`}
                    </Text>
                  )}
                </>
              )}
              <mesh
                position={[px, BOARD_TOP + 0.012, pz]}
                onClick={(event) => {
                  event.stopPropagation();
                  onPinClick(row, col);
                }}
                onPointerOver={() => {
                  setHoverPin(key);
                  if (dragState) onHoverDragTarget({ row, col });
                  document.body.style.cursor = cursor;
                }}
                onPointerOut={() => {
                  setHoverPin(null);
                  if (dragState) onHoverDragTarget(null);
                  document.body.style.cursor = dragState ? 'grabbing' : 'default';
                }}
              >
                <boxGeometry args={[0.065, 0.03, 0.065]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            </group>
          );
        })
      )}

      {/* row numbers — every row for clarity */}
      {Array.from({ length: BOARD_ROWS }).map((_, row) => {
        const [px] = gridToWorld(row, 0);
        const show = row % 5 === 0;
        if (!show) return null;
        return (
          <React.Fragment key={`row-${row}`}>
            <Text
              position={[px, BOARD_TOP + 0.016, -0.51]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.04}
              color="#475569"
              anchorX="center"
              fontWeight="bold"
            >
              {row + 1}
            </Text>
            <Text
              position={[px, BOARD_TOP + 0.016, 0.51]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.04}
              color="#475569"
              anchorX="center"
              fontWeight="bold"
            >
              {row + 1}
            </Text>
          </React.Fragment>
        );
      })}

      {/* column letters — large and bold on both sides */}
      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((letter, col) => {
        const [, , pz] = gridToWorld(0, col);
        return (
          <React.Fragment key={letter}>
            <Text
              position={[-BOARD_WIDTH / 2 + 0.04, BOARD_TOP + 0.016, pz]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.045}
              color="#334155"
              anchorX="center"
              fontWeight="bold"
            >
              {letter}
            </Text>
            <Text
              position={[BOARD_WIDTH / 2 - 0.04, BOARD_TOP + 0.016, pz]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.045}
              color="#334155"
              anchorX="center"
              fontWeight="bold"
            >
              {letter}
            </Text>
          </React.Fragment>
        );
      })}

      {/* side clips */}
      {[-1.66, 0, 1.66].map((x, index) => (
        <mesh key={`clip-${index}`} position={[x, -0.005, BOARD_DEPTH / 2 - 0.03]} castShadow>
          <boxGeometry args={[0.07, 0.08, 0.05]} />
          <meshStandardMaterial color="#efefeb" />
        </mesh>
      ))}
      {/* corner markers (red dots like real breadboards) */}
      {[
        [-BOARD_WIDTH / 2 + 0.14, -BOARD_DEPTH / 2 + 0.1],
        [BOARD_WIDTH / 2 - 0.14, -BOARD_DEPTH / 2 + 0.1],
        [-BOARD_WIDTH / 2 + 0.14, BOARD_DEPTH / 2 - 0.1],
        [BOARD_WIDTH / 2 - 0.14, BOARD_DEPTH / 2 - 0.1],
      ].map(([x, z], i) => (
        <mesh key={`corner-${i}`} position={[x, BOARD_TOP + 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 12]} />
          <meshStandardMaterial color="#e05050" />
        </mesh>
      ))}
    </group>
  );
}

function PlacedLED({
  position,
  color,
  simState,
}: {
  position: [number, number, number];
  color: string;
  simState?: { on: boolean; brightness: number };
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const material = ref.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = simState?.on ? simState.brightness * (0.8 + Math.sin(clock.elapsedTime * 5) * 0.3) : 0.04;
  });

  return (
    <group position={position}>
      {/* LED dome */}
      <mesh ref={ref} castShadow>
        <sphereGeometry args={[0.055, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.05} transparent opacity={0.88} />
      </mesh>
      {/* glow halo when on */}
      {simState?.on && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.055, 0.12, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
      )}
      {/* base */}
      <mesh position={[0, -0.03, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.055, 0.04, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.45} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.02, -0.075, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.07, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
      <mesh position={[0.02, -0.07, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
    </group>
  );
}

function PlacedResistor({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* body */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.14, 12]} />
        <meshStandardMaterial color="#d9b78c" roughness={0.86} />
      </mesh>
      {/* color bands */}
      {[-0.035, -0.012, 0.012, 0.035].map((offset, index) => (
        <mesh key={index} position={[offset, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.01, 10]} />
          <meshStandardMaterial color={['#8b4513', '#111827', '#f59e0b', '#facc15'][index]} />
        </mesh>
      ))}
      {/* legs */}
      <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
      <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
    </group>
  );
}

function PlacedLDR({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* disc body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.025, 20]} />
        <meshStandardMaterial color="#8d5a2f" />
      </mesh>
      {/* photosensitive window */}
      <mesh position={[0, 0.014, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.006, 20]} />
        <meshStandardMaterial color="#d3a15f" transparent opacity={0.7} />
      </mesh>
      {/* zigzag pattern on top */}
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.035, 6]} />
        <meshStandardMaterial color="#a07030" transparent opacity={0.5} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.018, -0.04, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
      <mesh position={[0.018, -0.04, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
    </group>
  );
}

function PlacedBuzzer({ position, active }: { position: [number, number, number]; active?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const scale = active ? 1 + Math.sin(clock.elapsedTime * 24) * 0.03 : 1;
    ref.current.scale.setScalar(scale);
  });

  return (
    <group position={position}>
      {/* main cylinder */}
      <mesh ref={ref} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.04, 22]} />
        <meshStandardMaterial color="#20242d" roughness={0.5} />
      </mesh>
      {/* sound hole */}
      <mesh position={[0, 0.022, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.004, 18]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* + marking */}
      <mesh position={[0.04, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.02, 0.006]} />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0.04, 0.022, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[0.02, 0.006]} />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>
      {/* active glow ring */}
      {active && (
        <mesh position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.065, 0.1, 24]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.35} />
        </mesh>
      )}
      {/* legs */}
      <mesh position={[-0.02, -0.04, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.05, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
      <mesh position={[0.02, -0.04, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.05, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
      </mesh>
    </group>
  );
}

function PlacedButton({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.1, 0.03, 0.1]} radius={0.008} smoothness={4} castShadow>
        <meshStandardMaterial color="#2d333d" />
      </RoundedBox>
      <mesh position={[0, 0.025, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* 4 legs */}
      {[[-0.035, -0.035], [0.035, -0.035], [-0.035, 0.035], [0.035, 0.035]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.03, z]} castShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.88} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function WireMesh({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const curve = useMemo(() => {
    const lift = 0.12 + Math.abs(start[0] - end[0]) * 0.05;
    return new THREE.CubicBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(start[0], start[1] + lift, start[2]),
      new THREE.Vector3(end[0], end[1] + lift, end[2]),
      new THREE.Vector3(...end)
    );
  }, [end, start]);

  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 28, 0.006, 8, false), [curve]);
  const startCapRotation = useMemo(() => {
    const tangent = curve.getTangent(0).clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    return new THREE.Euler().setFromQuaternion(quaternion);
  }, [curve]);
  const endCapRotation = useMemo(() => {
    const tangent = curve.getTangent(1).clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    return new THREE.Euler().setFromQuaternion(quaternion);
  }, [curve]);

  return (
    <group>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh position={start} rotation={startCapRotation} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={end} rotation={endCapRotation} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
}

function ArduinoUnoBoard({ position }: { position: [number, number, number] }) {
  const digitalX = Array.from({ length: 14 }, (_, i) => -1.05 + i * 0.155);
  const analogX = Array.from({ length: 6 }, (_, i) => 0.18 + i * 0.155);
  const powerX = Array.from({ length: 8 }, (_, i) => -0.98 + i * 0.127);
  const PCB = '#008184';
  const PCB_EDGE = '#006466';
  const SILK = '#c8e8e8';
  const HEADER_BLACK = '#1a1a1a';
  const PIN_GOLD = '#c9a600';

  return (
    <group position={position}>
      {/* shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.05, -0.06, 0]} receiveShadow>
        <planeGeometry args={[3.1, 2.3]} />
        <meshStandardMaterial color="#b8c5d3" transparent opacity={0.22} />
      </mesh>

      {/* PCB substrate (dark edge visible underneath) */}
      <RoundedBox args={[2.72, 0.06, 1.86]} radius={0.04} smoothness={5} position={[0, -0.018, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PCB_EDGE} roughness={0.85} />
      </RoundedBox>
      {/* main PCB */}
      <RoundedBox args={[2.68, 0.035, 1.82]} radius={0.03} smoothness={6} position={[0, 0.015, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PCB} roughness={0.55} metalness={0.05} />
      </RoundedBox>

      {/* solder mask pattern — subtle lighter zones */}
      <mesh position={[0, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 1.6]} />
        <meshStandardMaterial color="#009a9c" transparent opacity={0.12} roughness={0.4} />
      </mesh>

      {/* mounting holes (4 corners) */}
      {[[-1.18, -0.76], [-1.18, 0.68], [1.12, -0.76], [1.12, 0.68]].map(([x, z], i) => (
        <group key={`mount-${i}`}>
          <mesh position={[x, 0.036, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.04, 0.07, 20]} />
            <meshStandardMaterial color="#c4a000" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[x, 0.02, z]}>
            <cylinderGeometry args={[0.035, 0.035, 0.07, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}

      {/* digital pin header housing */}
      <mesh position={[-0.1, 0.065, 0.73]} castShadow>
        <boxGeometry args={[2.2, 0.1, 0.16]} />
        <meshStandardMaterial color={HEADER_BLACK} roughness={0.55} />
      </mesh>
      {/* digital pin holes */}
      {digitalX.map((x, i) => (
        <group key={`dpin-${i}`}>
          <mesh position={[x, 0.12, 0.73]}>
            <boxGeometry args={[0.06, 0.02, 0.06]} />
            <meshStandardMaterial color={PIN_GOLD} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[x, 0.04, 0.73]}>
            <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />
            <meshStandardMaterial color={PIN_GOLD} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* analog pin header housing */}
      <mesh position={[0.57, 0.065, -0.69]} castShadow>
        <boxGeometry args={[1.0, 0.1, 0.16]} />
        <meshStandardMaterial color={HEADER_BLACK} roughness={0.55} />
      </mesh>
      {analogX.map((x, i) => (
        <group key={`apin-${i}`}>
          <mesh position={[x, 0.12, -0.69]}>
            <boxGeometry args={[0.06, 0.02, 0.06]} />
            <meshStandardMaterial color={PIN_GOLD} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[x, 0.04, -0.69]}>
            <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />
            <meshStandardMaterial color={PIN_GOLD} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* power pin header housing */}
      <mesh position={[-0.5, 0.065, -0.48]} castShadow>
        <boxGeometry args={[1.1, 0.1, 0.16]} />
        <meshStandardMaterial color={HEADER_BLACK} roughness={0.55} />
      </mesh>
      {powerX.map((x, i) => (
        <group key={`ppin-${i}`}>
          <mesh position={[x, 0.12, -0.48]}>
            <boxGeometry args={[0.06, 0.02, 0.06]} />
            <meshStandardMaterial color={PIN_GOLD} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* USB-B port — metallic housing with inner cavity */}
      <group position={[-1.22, 0.09, 0]}>
        <RoundedBox args={[0.42, 0.2, 0.48]} radius={0.02} smoothness={4} castShadow>
          <meshStandardMaterial color="#a8aeb3" metalness={0.88} roughness={0.12} />
        </RoundedBox>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.35, 0.12, 0.36]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        {/* USB inner pins */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[0.22, 0.03, 0.32]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>

      {/* barrel jack */}
      <group position={[1.1, 0.09, -0.64]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.35, 20]} />
          <meshStandardMaterial color="#111111" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.36, 16]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.37, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* ATmega328P (large DIP-28 IC) */}
      <group position={[0.1, 0.055, -0.06]}>
        <RoundedBox args={[0.58, 0.07, 0.24]} radius={0.01} smoothness={3} castShadow>
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
        </RoundedBox>
        {/* pin 1 dot */}
        <mesh position={[-0.24, 0.038, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.015, 12]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        {/* IC pins (both sides) */}
        {Array.from({ length: 14 }, (_, i) => (
          <React.Fragment key={`ic-${i}`}>
            <mesh position={[-0.25 + i * 0.038, 0.03, -0.14]}>
              <boxGeometry args={[0.02, 0.01, 0.04]} />
              <meshStandardMaterial color={PIN_GOLD} metalness={0.75} roughness={0.25} />
            </mesh>
            <mesh position={[-0.25 + i * 0.038, 0.03, 0.14]}>
              <boxGeometry args={[0.02, 0.01, 0.04]} />
              <meshStandardMaterial color={PIN_GOLD} metalness={0.75} roughness={0.25} />
            </mesh>
          </React.Fragment>
        ))}
      </group>

      {/* crystal oscillator */}
      <mesh position={[-0.22, 0.055, -0.08]} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.06]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.65} roughness={0.2} />
      </mesh>

      {/* voltage regulator */}
      <mesh position={[-0.4, 0.06, -0.05]} castShadow>
        <boxGeometry args={[0.04, 0.12, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.45} />
      </mesh>
      <mesh position={[-0.42, 0.06, -0.05]} castShadow>
        <boxGeometry args={[0.01, 0.1, 0.12]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* electrolytic capacitors */}
      {[[-0.65, -0.15], [-0.52, -0.15]].map(([x, z], i) => (
        <group key={`cap-${i}`} position={[x, 0.08, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.14, 18]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.45} />
          </mesh>
          {/* cap top scoring */}
          <mesh position={[0, 0.072, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.075, 18]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          {/* stripe */}
          <mesh position={[0.075, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[0.08, 0.02]} />
            <meshStandardMaterial color="#e0e0e0" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

      {/* SMD components (small chip packages) */}
      {[
        { x: -0.88, z: 0.22, w: 0.12, d: 0.08 },
        { x: -0.72, z: 0.22, w: 0.12, d: 0.08 },
        { x: -0.56, z: 0.22, w: 0.12, d: 0.08 },
        { x: 0.4, z: -0.06, w: 0.1, d: 0.08 },
        { x: 0.62, z: -0.06, w: 0.08, d: 0.06 },
      ].map((chip, i) => (
        <mesh key={`smd-${i}`} position={[chip.x, 0.043, chip.z]} castShadow>
          <boxGeometry args={[chip.w, 0.025, chip.d]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.42} />
        </mesh>
      ))}

      {/* power LED (green) */}
      <group position={[0.78, 0.042, 0.35]}>
        <mesh>
          <boxGeometry args={[0.05, 0.02, 0.03]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} transparent opacity={0.85} />
        </mesh>
        <Text position={[0.06, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.025} color={SILK}>ON</Text>
      </group>

      {/* pin 13 LED (orange) */}
      <group position={[0.62, 0.042, 0.35]}>
        <mesh>
          <boxGeometry args={[0.05, 0.02, 0.03]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.15} transparent opacity={0.85} />
        </mesh>
        <Text position={[0.06, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.025} color={SILK}>L</Text>
      </group>

      {/* reset button */}
      <group position={[-0.9, 0.05, -0.42]}>
        <mesh castShadow>
          <boxGeometry args={[0.1, 0.04, 0.08]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.015, 12]} />
          <meshStandardMaterial color="#f5f5f5" metalness={0.3} roughness={0.4} />
        </mesh>
      </group>

      {/* copper traces (silkscreen lines on PCB) */}
      {[
        { x1: -0.95, z1: -0.22, x2: -0.2, z2: -0.02 },
        { x1: -0.88, z1: 0.12, x2: -0.1, z2: -0.01 },
        { x1: 0.38, z1: -0.65, x2: 0.38, z2: -0.16 },
        { x1: 0.7, z1: -0.65, x2: 0.72, z2: -0.16 },
        { x1: -0.14, z1: 0.64, x2: -0.18, z2: 0.14 },
        { x1: 0.5, z1: 0.64, x2: 0.18, z2: 0.18 },
      ].map((trace, i) => {
        const dx = trace.x2 - trace.x1;
        const dz = trace.z2 - trace.z1;
        const length = Math.sqrt(dx * dx + dz * dz);
        return (
          <mesh key={`trace-${i}`} position={[(trace.x1 + trace.x2) / 2, 0.034, (trace.z1 + trace.z2) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(dz, dx)]}>
            <planeGeometry args={[length, 0.014]} />
            <meshBasicMaterial color="#006e70" transparent opacity={0.7} />
          </mesh>
        );
      })}

      {/* silkscreen text */}
      <Text position={[-0.14, 0.036, 0.1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color={SILK} fontWeight="bold">
        UNO
      </Text>
      <Text position={[-0.5, 0.036, -0.22]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.1} color={SILK}>
        ARDUINO
      </Text>
      <Text position={[0.1, 0.036, 0.48]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.06} color={SILK} fontWeight="bold">
        DIGITAL (PWM~)
      </Text>
      <Text position={[0.62, 0.036, -0.52]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.06} color={SILK} fontWeight="bold">
        ANALOG IN
      </Text>
      <Text position={[-0.5, 0.036, -0.34]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.06} color={SILK} fontWeight="bold">
        POWER
      </Text>
      <Text position={[-0.9, 0.036, -0.54]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.05} color={SILK} fontWeight="bold">
        RESET
      </Text>

      {/* digital pin number labels — large enough to read */}
      {digitalX.slice(0, 14).map((x, i) => (
        <Text key={`dlbl-${i}`} position={[x, 0.036, 0.58]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.055} color={SILK} fontWeight="bold" anchorX="center">
          {`${i}`}
        </Text>
      ))}
      {/* analog pin labels */}
      {analogX.map((x, i) => (
        <Text key={`albl-${i}`} position={[x, 0.036, -0.58]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.055} color={SILK} fontWeight="bold" anchorX="center">
          {`A${i}`}
        </Text>
      ))}
      {/* power header labels — individual pin names */}
      {['RST', 'REF', '3.3V', '5V', 'GND', 'GND', 'VIN', ''].map((label, i) => {
        if (!label) return null;
        return (
          <Text key={`plbl-${i}`} position={[powerX[i], 0.036, -0.37]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color={SILK} fontWeight="bold" anchorX="center">
            {label}
          </Text>
        );
      })}

      {/* Arduino logo circles */}
      <group position={[-0.7, 0.036, 0.08]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.06, 0.075, 20]} />
          <meshBasicMaterial color={SILK} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.18, 0, 0]}>
          <ringGeometry args={[0.06, 0.075, 20]} />
          <meshBasicMaterial color={SILK} />
        </mesh>
        {/* plus sign in right circle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.18, 0, 0]}>
          <planeGeometry args={[0.06, 0.015]} />
          <meshBasicMaterial color={SILK} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0.18, 0, 0]}>
          <planeGeometry args={[0.06, 0.015]} />
          <meshBasicMaterial color={SILK} />
        </mesh>
        {/* minus in left circle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 0.015]} />
          <meshBasicMaterial color={SILK} />
        </mesh>
      </group>
    </group>
  );
}

function CameraRig({
  controlsRef,
  cameraPreset,
  cameraTick,
}: {
  controlsRef: React.MutableRefObject<any>;
  cameraPreset: CameraPreset;
  cameraTick: number;
}) {
  const { camera } = useThree();
  const animationRef = useRef<{
    progress: number;
    fromPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPosition: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPreset];
    animationRef.current = {
      progress: 0,
      fromPosition: camera.position.clone(),
      fromTarget: controlsRef.current
        ? controlsRef.current.target.clone()
        : new THREE.Vector3(...CAMERA_PRESETS.fit.target),
      toPosition: new THREE.Vector3(...preset.position),
      toTarget: new THREE.Vector3(...preset.target),
    };
  }, [camera, cameraPreset, cameraTick, controlsRef]);

  useFrame((_, delta) => {
    const animation = animationRef.current;
    if (!animation) {
      if (controlsRef.current) controlsRef.current.update();
      return;
    }

    animation.progress = Math.min(1, animation.progress + delta * 2.4);
    const eased = 1 - Math.pow(1 - animation.progress, 3);
    const nextTarget = new THREE.Vector3().lerpVectors(animation.fromTarget, animation.toTarget, eased);

    camera.position.lerpVectors(animation.fromPosition, animation.toPosition, eased);

    if (controlsRef.current) {
      controlsRef.current.target.copy(nextTarget);
      controlsRef.current.update();
    } else {
      camera.lookAt(nextTarget);
    }

    if (animation.progress >= 1) {
      animationRef.current = null;
    }
  });

  return null;
}

function RenderPlacedComponent({
  comp,
  simState,
  selectedTool,
  selectedEntity,
  onSelectEntity,
  onRemoveComponent,
  onBeginDrag,
}: {
  comp: PlacedComponent;
  simState: SimState;
  selectedTool: SandboxSceneProps['selectedTool'];
  selectedEntity: SelectedEntity | null;
  onSelectEntity: (entity: SelectedEntity | null) => void;
  onRemoveComponent: (id: string) => void;
  onBeginDrag: (entity: SelectedEntity) => void;
}) {
  const pos = gridToWorld(comp.row, comp.col);
  const raised: [number, number, number] = [pos[0], pos[1] + 0.02, pos[2]];
  const interactive = selectedTool === 'select' || selectedTool === 'delete';
  const setPointer = () => {
    if (interactive) document.body.style.cursor = selectedTool === 'select' ? 'grab' : 'pointer';
  };
  const clearPointer = () => {
    document.body.style.cursor = 'default';
  };

  const handlePartClick = (event: any) => {
    if (selectedTool !== 'delete') return;
    event.stopPropagation();
    onRemoveComponent(comp.id);
  };

  const handlePartPointerDown = (event: any) => {
    if (selectedTool !== 'select') return;
    event.stopPropagation();
    onBeginDrag({ kind: 'component', id: comp.id });
  };

  const handleWireClick = (event: any) => {
    if (selectedTool !== 'delete') return;
    event.stopPropagation();
    onRemoveComponent(comp.id);
  };

  const handleWirePointerDown = (event: any) => {
    if (selectedTool !== 'select') return;
    event.stopPropagation();
    if (comp.endRow === undefined || comp.endCol === undefined) return;
    const startPos = new THREE.Vector3(...gridToWorld(comp.row, comp.col));
    const endPos = new THREE.Vector3(...gridToWorld(comp.endRow, comp.endCol));
    const point = event.point as THREE.Vector3;
    const nextKind =
      point.distanceTo(startPos) <= point.distanceTo(endPos) ? 'wire-start' : 'wire-end';

    onBeginDrag({ kind: nextKind, id: comp.id });
  };

  const selectedWireStart = selectedEntity?.id === comp.id && selectedEntity.kind === 'wire-start';
  const selectedWireEnd = selectedEntity?.id === comp.id && selectedEntity.kind === 'wire-end';
  const selectedPart = selectedEntity?.id === comp.id && selectedEntity.kind === 'component';

  switch (comp.type) {
    case 'led_red':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.045, 0.07, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedLED position={raised} color="#ef4444" simState={simState.ledStates[comp.id]} />
        </group>
      );
    case 'led_green':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.045, 0.07, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedLED position={raised} color="#22c55e" simState={simState.ledStates[comp.id]} />
        </group>
      );
    case 'led_blue':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.045, 0.07, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedLED position={raised} color="#3b82f6" simState={simState.ledStates[comp.id]} />
        </group>
      );
    case 'resistor_220':
    case 'resistor_10k':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.05, 0.075, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedResistor position={raised} />
        </group>
      );
    case 'ldr':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.05, 0.075, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedLDR position={raised} />
        </group>
      );
    case 'buzzer':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.05, 0.078, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedBuzzer position={raised} active={simState.buzzerOn} />
        </group>
      );
    case 'button':
      return (
        <group onPointerDown={handlePartPointerDown} onClick={handlePartClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          {selectedPart && (
            <mesh position={[raised[0], raised[1] - 0.018, raised[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.05, 0.078, 28]} />
              <meshBasicMaterial color="#f3e515" transparent opacity={0.95} />
            </mesh>
          )}
          <PlacedButton position={raised} />
        </group>
      );
    case 'wire': {
      if (comp.endRow === undefined || comp.endCol === undefined) return null;
      const startPos = gridToWorld(comp.row, comp.col);
      const endPos = gridToWorld(comp.endRow, comp.endCol);
      const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
      const colorIndex = parseInt(comp.id.replace(/\D/g, ''), 10) % colors.length;
      return (
        <group onPointerDown={handleWirePointerDown} onClick={handleWireClick} onPointerOver={setPointer} onPointerOut={clearPointer}>
          <WireMesh
            start={[startPos[0], startPos[1] + 0.02, startPos[2]]}
            end={[endPos[0], endPos[1] + 0.02, endPos[2]]}
            color={colors[colorIndex]}
          />
          {selectedWireStart && (
            <mesh position={[startPos[0], startPos[1] + 0.02, startPos[2]]}>
              <sphereGeometry args={[0.022, 12, 12]} />
              <meshBasicMaterial color="#f3e515" />
            </mesh>
          )}
          {selectedWireEnd && (
            <mesh position={[endPos[0], endPos[1] + 0.02, endPos[2]]}>
              <sphereGeometry args={[0.022, 12, 12]} />
              <meshBasicMaterial color="#f3e515" />
            </mesh>
          )}
        </group>
      );
    }
    default:
      return null;
  }
}

function SceneBackdrop() {
  return (
    <>
      <color attach="background" args={['#eef2f7']} />

      <hemisphereLight intensity={0.92} color="#ffffff" groundColor="#dce5ef" />
      <ambientLight intensity={0.58} />
      <directionalLight position={[4, 7, 5]} intensity={1.45} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-3, 4, -2]} intensity={0.45} />

      <mesh position={[0, 2.35, -5.2]}>
        <planeGeometry args={[14, 7]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[2.3, 2, -5.18]}>
        <circleGeometry args={[1.3, 48]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.34} />
      </mesh>
      <mesh position={[-2.5, 1.5, -5.16]}>
        <circleGeometry args={[1.1, 48]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.16} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#e7edf4" />
      </mesh>
      <gridHelper args={[14, 36, '#d1dae6', '#e7edf4']} position={[0, -0.048, 0]} />
    </>
  );
}

function SceneContent({
  components,
  selectedTool,
  onPlaceComponent,
  onRemoveComponent,
  onStartWire,
  onEndWire,
  onSelectEntity,
  onMoveEntity,
  onMoveSelectedEntity,
  wireStart,
  selectedEntity,
  simState,
  cameraPreset,
  cameraTick,
}: SandboxSceneProps) {
  const controlsRef = useRef<any>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const renderedComponents = useMemo(() => {
    if (!dragState?.hoveredPin) return components;

    return components.map((component) => {
      if (component.id !== dragState.entity.id) return component;

      if (dragState.entity.kind === 'component') {
        return { ...component, row: dragState.hoveredPin!.row, col: dragState.hoveredPin!.col };
      }

      if (dragState.entity.kind === 'wire-start' && component.type === 'wire') {
        return { ...component, row: dragState.hoveredPin!.row, col: dragState.hoveredPin!.col };
      }

      if (dragState.entity.kind === 'wire-end' && component.type === 'wire') {
        return { ...component, endRow: dragState.hoveredPin!.row, endCol: dragState.hoveredPin!.col };
      }

      return component;
    });
  }, [components, dragState]);

  const handleBeginDrag = useCallback((entity: SelectedEntity) => {
    if (selectedTool !== 'select') return;
    onSelectEntity(entity);
    setDragState({ entity, hoveredPin: null });
    document.body.style.cursor = 'grabbing';
  }, [onSelectEntity, selectedTool]);

  const handleHoverDragTarget = useCallback((pin: PinTarget | null) => {
    setDragState((prev) => (prev ? { ...prev, hoveredPin: pin } : prev));
  }, []);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !dragState;
    }
  }, [dragState]);

  useEffect(() => {
    if (selectedTool !== 'select' && dragState) {
      setDragState(null);
      document.body.style.cursor = 'default';
    }
  }, [dragState, selectedTool]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerUp = () => {
      if (dragState.hoveredPin) {
        onMoveEntity(dragState.entity, dragState.hoveredPin.row, dragState.hoveredPin.col);
      } else {
        onSelectEntity(dragState.entity);
      }

      setDragState(null);
      document.body.style.cursor = 'default';
    };

    const handlePointerCancel = () => {
      setDragState(null);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [dragState, onMoveEntity, onSelectEntity]);

  const selectedPins = useMemo(() => {
    const pins = new Set<string>();
    const activeEntity = dragState?.entity ?? selectedEntity;
    if (!activeEntity) return pins;

    if (dragState?.hoveredPin) {
      pins.add(`${dragState.hoveredPin.row}-${dragState.hoveredPin.col}`);
      return pins;
    }

    const entity = components.find((item) => item.id === activeEntity.id);
    if (!entity) return pins;

    if (activeEntity.kind === 'component' || activeEntity.kind === 'wire-start') {
      pins.add(`${entity.row}-${entity.col}`);
    }

    if (activeEntity.kind === 'wire-end' && entity.endRow !== undefined && entity.endCol !== undefined) {
      pins.add(`${entity.endRow}-${entity.endCol}`);
    }

    return pins;
  }, [components, dragState, selectedEntity]);

  const handlePinClick = useCallback((row: number, col: number) => {
    if (selectedTool === 'breadboard' || selectedTool === 'arduino') return;
    if (selectedTool === 'select') {
      if (selectedEntity) {
        onMoveSelectedEntity(row, col);
        return;
      }

      const placed = components.find((item) => item.type !== 'wire' && item.row === row && item.col === col);
      if (placed) {
        onSelectEntity({ kind: 'component', id: placed.id });
        return;
      }

      const connectedWire = components.find((item) => {
        if (item.type !== 'wire') return false;
        const matchesStart = item.row === row && item.col === col;
        const matchesEnd = item.endRow === row && item.endCol === col;
        return matchesStart || matchesEnd;
      });

      if (connectedWire) {
        const kind =
          connectedWire.row === row && connectedWire.col === col
            ? 'wire-start'
            : 'wire-end';
        onSelectEntity({ kind, id: connectedWire.id });
        return;
      }

      onSelectEntity(null);
      return;
    }

    if (selectedTool === 'wire') {
      if (!wireStart) {
        onStartWire(row, col);
      } else {
        onEndWire(row, col);
      }
      return;
    }

    if (selectedTool === 'delete') {
      const placed = components.find((item) => item.type !== 'wire' && item.row === row && item.col === col);
      if (placed) {
        onRemoveComponent(placed.id);
        return;
      }

      const connectedWire = components.find((item) => {
        if (item.type !== 'wire') return false;
        const matchesStart = item.row === row && item.col === col;
        const matchesEnd = item.endRow === row && item.endCol === col;
        return matchesStart || matchesEnd;
      });

      if (connectedWire) onRemoveComponent(connectedWire.id);
      return;
    }

    onPlaceComponent(row, col);
  }, [
    components,
    onEndWire,
    onMoveSelectedEntity,
    onPlaceComponent,
    onRemoveComponent,
    onSelectEntity,
    onStartWire,
    selectedEntity,
    selectedTool,
    wireStart,
  ]);

  return (
    <>
      <SceneBackdrop />

      <CameraRig controlsRef={controlsRef} cameraPreset={cameraPreset} cameraTick={cameraTick} />

      {(() => {
        const boardArduino = components.find(c => c.type === 'arduino');
        if (!boardArduino) return null;
        const isSelected = selectedEntity?.id === boardArduino.id && selectedEntity?.kind === 'component';
        return (
          <group
            onClick={(e) => {
              e.stopPropagation();
              if (selectedTool === 'delete') onRemoveComponent(boardArduino.id);
              else if (selectedTool === 'select') onSelectEntity(isSelected ? null : { kind: 'component', id: boardArduino.id });
            }}
            onPointerOver={() => { if (selectedTool === 'delete' || selectedTool === 'select') document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'default'; }}
          >
            <ArduinoUnoBoard position={[0, 0.12, -1.95]} />
            {isSelected && (
              <mesh position={[0, 0.06, -1.95]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.55, 1.7, 40]} />
                <meshBasicMaterial color="#f3e515" transparent opacity={0.7} />
              </mesh>
            )}
          </group>
        );
      })()}

      {(() => {
        const boardBreadboard = components.find(c => c.type === 'breadboard');
        if (!boardBreadboard) return null;
        const isSelected = selectedEntity?.id === boardBreadboard.id && selectedEntity?.kind === 'component';
        return (
          <group
            onClick={(e) => {
              if (selectedTool === 'delete') { e.stopPropagation(); onRemoveComponent(boardBreadboard.id); }
              else if (selectedTool === 'select' && e.object.userData?.isBoardBody) {
                e.stopPropagation();
                onSelectEntity(isSelected ? null : { kind: 'component', id: boardBreadboard.id });
              }
            }}
            onPointerOver={() => { if (selectedTool === 'delete') document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { if (selectedTool === 'delete') document.body.style.cursor = 'default'; }}
          >
            <BreadboardMesh
              onPinClick={handlePinClick}
              onHoverDragTarget={handleHoverDragTarget}
              wireStart={wireStart}
              selectedTool={selectedTool}
              selectedEntity={selectedEntity}
              selectedPins={selectedPins}
              dragState={dragState}
            />
            {isSelected && (
              <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.8, 2.95, 4]} />
                <meshBasicMaterial color="#f3e515" transparent opacity={0.5} />
              </mesh>
            )}
          </group>
        );
      })()}

      {renderedComponents.map((comp) => (
        <RenderPlacedComponent
          key={comp.id}
          comp={comp}
          simState={simState}
          selectedTool={selectedTool}
          selectedEntity={selectedEntity}
          onSelectEntity={onSelectEntity}
          onRemoveComponent={onRemoveComponent}
          onBeginDrag={handleBeginDrag}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enabled={!dragState}
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={0.45}
        maxDistance={48}
        minPolarAngle={0}
        maxPolarAngle={Math.PI - 0.08}
        target={CAMERA_PRESETS.fit.target}
        screenSpacePanning
      />
    </>
  );
}

export default function SandboxScene(props: SandboxSceneProps) {
  return (
    <div className={props.className} style={{ minHeight: 420 }}>
      <Canvas
        camera={{ position: CAMERA_PRESETS.fit.position, fov: 34 }}
        gl={{ antialias: true }}
        dpr={[1, 1.75]}
        shadows
        onPointerMissed={() => {
          if (props.selectedTool === 'select') props.onSelectEntity(null);
        }}
      >
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}
