import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, Gltf, OrbitControls } from '@react-three/drei';

// ── 3D twin viewer (#31) ──
//
// Renders a generated GLB mesh (the digital twin of a completed build) with the
// existing Three.js stack. Auto-frames the model, orbit + auto-rotate, simple
// three-point lighting so the build reads clearly without an external HDR fetch.
// Lazy-loaded by callers (default export) so Three.js stays out of the main bundle.

interface TwinViewerProps {
  /** Object URL of the GLB (from reporter.fetchTwinModelUrl). */
  src: string;
  className?: string;
}

const TwinViewer: React.FC<TwinViewerProps> = ({ src, className }) => (
  <div className={className}>
    <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 9, 6]} intensity={1.15} />
      <directionalLight position={[-6, 3, -4]} intensity={0.4} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.2}>
          <Center>
            {/* Stable Fast 3D returns uncompressed GLB, so skip the Draco CDN. */}
            <Gltf src={src} useDraco={false} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enablePan={false} autoRotate autoRotateSpeed={0.7} minDistance={1.2} maxDistance={8} />
    </Canvas>
  </div>
);

export default TwinViewer;
