import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Svg, { Path } from 'react-native-svg';
import { colors, font, type } from '../theme/tokens';

interface Props {
  /** Raw GLB bytes. Fetched with auth by the caller. */
  model: ArrayBuffer | null;
  height?: number;
}

/**
 * The 3D twin viewer, running real three.js on the device GPU through expo-gl.
 *
 * The GLB arrives as bytes rather than a URL because the reporter serves it
 * behind auth, so GLTFLoader.parse() is used instead of .load(). Drag to orbit;
 * it also auto-rotates so a still screenshot still reads as 3D.
 */
export const TwinViewer: React.FC<Props> = ({ model, height = 320 }) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const spin = useRef({ x: 0.4, y: 0 });
  const drag = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const disposed = useRef(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { drag.current = { x: 0, y: 0 }; },
      onPanResponderMove: (_e, g) => {
        spin.current.y += (g.dx - drag.current.x) * 0.01;
        spin.current.x += (g.dy - drag.current.y) * 0.01;
        // Clamp pitch so the model can never flip upside down.
        spin.current.x = Math.max(-1.2, Math.min(1.2, spin.current.x));
        drag.current = { x: g.dx, y: g.dy };
      },
    }),
  ).current;

  // Stop the render loop on unmount: an orphaned rAF keeps the GPU busy and
  // holds every texture in the scene alive.
  useEffect(() => () => {
    disposed.current = true;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x14181f, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000,
      );

      // Three-point lighting so the mesh reads without an HDR fetch.
      scene.add(new THREE.AmbientLight(0xffffff, 1.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.0);
      key.position.set(6, 9, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.7);
      fill.position.set(-6, 3, -4);
      scene.add(fill);

      const pivot = new THREE.Group();
      scene.add(pivot);

      if (model) {
        const loader = new GLTFLoader();
        await new Promise<void>((resolve, reject) => {
          loader.parse(
            model,
            '',
            (gltf) => {
              const obj = gltf.scene;
              // Auto-frame: centre the model and scale it to a known size, so
              // any mesh the generator returns fills the view the same way.
              const box = new THREE.Box3().setFromObject(obj);
              const size = box.getSize(new THREE.Vector3());
              const centre = box.getCenter(new THREE.Vector3());
              const largest = Math.max(size.x, size.y, size.z) || 1;
              obj.position.sub(centre);
              obj.scale.setScalar(2.2 / largest);
              pivot.add(obj);
              resolve();
            },
            reject,
          );
        });
      }

      camera.position.set(0, 0.6, 4.2);
      camera.lookAt(0, 0, 0);
      setReady(true);

      const render = () => {
        if (disposed.current) return;
        frame.current = requestAnimationFrame(render);
        spin.current.y += 0.004;                 // gentle idle rotation
        pivot.rotation.y = spin.current.y;
        pivot.rotation.x = spin.current.x;
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      render();
    } catch {
      setFailed(true);
    }
  }, [model]);

  // No bytes means there is no twin to show. Rendering a stand-in solid here
  // would put a yellow cube on screen that a learner reads as their build, so
  // the surface says plainly that nothing has been generated yet.
  if (!model) {
    return (
      <View style={[s.fallback, { height }]}>
        <View style={s.emptyMark}>
          <Svg width={38} height={38} viewBox="0 0 38 38">
            <Path d="M19 3 L34 11.5 L34 26.5 L19 35 L4 26.5 L4 11.5 Z"
                  fill="none" stroke={colors.gold} strokeWidth={2.2} strokeLinejoin="round" />
            <Path d="M4 11.5 L19 20 L34 11.5 M19 20 L19 35"
                  fill="none" stroke="rgba(250,204,46,0.45)" strokeWidth={2.2} strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={s.emptyTitle}>No twin yet</Text>
        <Text style={s.fallbackText}>Finish a build with the live tutor and a 3D twin is generated for it.</Text>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={[s.fallback, { height }]}>
        <Text style={s.fallbackText}>This model could not be displayed.</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, { height }]} {...responder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {!ready && (
        <View style={[StyleSheet.absoluteFill, s.loading]}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}
      {ready && (
        <View style={s.hint} pointerEvents="none">
          <Text style={s.hintText}>DRAG TO SPIN</Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.ink, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: colors.ink },
  loading: { alignItems: 'center', justifyContent: 'center' },
  fallback: {
    backgroundColor: colors.ink, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 6,
  },
  emptyMark: { marginBottom: 4, opacity: 0.9 },
  emptyTitle: { fontFamily: font.black, fontSize: type.body, color: colors.white },
  fallbackText: {
    fontFamily: font.semibold, fontSize: type.small, color: 'rgba(255,255,255,0.62)',
    textAlign: 'center', lineHeight: 19,
  },
  hint: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  hintText: { fontFamily: font.black, fontSize: 9, color: colors.white, letterSpacing: 1 },
});
