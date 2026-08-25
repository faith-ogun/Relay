import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, curve } from '../theme/tokens';

/**
 * A placeholder that occupies the FINAL layout.
 *
 * A spinner tells you nothing and then the page jumps when it resolves. Layout
 * shift on load is the strongest "prototype" signal there is, and there were 31
 * spinners across 14 screens.
 *
 * No packaged skeleton library is used: the maintained-looking ones are not.
 * `react-native-skeleton-placeholder` last shipped in 2022, and `moti` declares
 * a peer range of `*` so it installs cleanly here and then misbehaves, because
 * it is Reanimated 3 only and this app is on 4.
 *
 * No mask library either. A mask is only needed for arbitrary silhouettes;
 * every skeleton in a real design system is a rounded rectangle, and
 * `overflow: hidden` plus a radius clips a moving gradient identically.
 */

const BASE = '#ece7db';
const SHEEN = 'rgba(255,255,255,0.65)';

export const SkeletonBlock: React.FC<{
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: object;
}> = ({ width = '100%', height = 16, radius = 8, style }) => {
  const reduced = useReducedMotion();
  const { width: screen } = useWindowDimensions();

  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: BASE, overflow: 'hidden' },
        curve,
        style,
      ]}
    >
      {/* An infinite sweep is exactly what Reduce Motion exists to suppress. */}
      {!reduced && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              // CSS-style animation: no shared value and no effect lifecycle, so
              // forty of these is forty fewer hook trees.
              animationName: {
                from: { transform: [{ translateX: -screen * 0.6 }] },
                to: { transform: [{ translateX: screen * 0.6 }] },
              },
              animationDuration: '1200ms',
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            } as never,
          ]}
        >
          <LinearGradient
            colors={['transparent', SHEEN, 'transparent'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

/**
 * The learning path, before it loads.
 *
 * Widths are varied on purpose: uniform 100% bars are the tell that a skeleton
 * was generated rather than designed. Real titles rag.
 */
export const PathSkeleton: React.FC = () => (
  <View style={s.path}>
    {[0, 1].map((u) => (
      <View key={u} style={s.unit}>
        <SkeletonBlock height={68} radius={22} />
        <View style={s.trail}>
          {[0, 1, 2, 3].map((n) => (
            <SkeletonBlock
              key={n}
              width={64}
              height={64}
              radius={32}
              style={{ marginLeft: [0, 44, 74, 44][n] }}
            />
          ))}
        </View>
      </View>
    ))}
  </View>
);

/** A list of cards, for the community feed and the twin shelf. */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <View style={s.list}>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={s.card}>
        <SkeletonBlock width="62%" height={18} radius={6} />
        <SkeletonBlock width="88%" height={13} radius={6} style={{ marginTop: 10 }} />
        <SkeletonBlock width="40%" height={13} radius={6} style={{ marginTop: 6 }} />
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  path: { paddingHorizontal: 24, paddingTop: 8, gap: 32 },
  unit: { gap: 24 },
  trail: { alignItems: 'center', gap: 14 },
  list: { padding: 24, gap: 16 },
  card: {
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.white,
    padding: 16,
    ...curve,
  },
});
