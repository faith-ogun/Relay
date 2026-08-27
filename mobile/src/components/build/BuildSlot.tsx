import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BuildGlyph } from './BuildGlyph';
import { SkeletonBlock } from '../Skeleton';
import type { Build } from '../../services/builds';
import { colors, curve, font, leading, radius, space, tracking, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';

/**
 * What the learner is building, on the screen before the session starts.
 *
 * The pre-flight used to be one paragraph and a start button, which made the
 * first step of the loop invisible. This is the step: the build is the largest
 * thing on the screen, it names the parts to go and fetch, and changing it is
 * one tap away.
 *
 * A summary, deliberately not the picker's card: one flowing parts line instead
 * of a chip list, mark inline with the title. The two surfaces answer different
 * questions, "which of these?" and "this one, then", so they should not be the
 * same object at different sizes.
 */

interface Props {
  build: Build | null;
  /** True while the catalogue is still being fetched for the first time. */
  loading: boolean;
  /** True when the catalogue could not be reached and nothing is cached yet. */
  unreachable: boolean;
  onOpen: () => void;
}

export const BuildSlot: React.FC<Props> = ({ build, loading, unreachable, onOpen }) => {
  if (loading) {
    return (
      <View style={s.loading} accessibilityLabel="Loading the build library">
        <SkeletonBlock width="38%" height={11} />
        <SkeletonBlock width="76%" height={24} style={{ marginTop: 10 }} />
        <SkeletonBlock width="90%" height={13} style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (!build) {
    return (
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [s.invite, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Choose your build"
        accessibilityHint="Opens the build library"
      >
        <View style={s.inviteMark}>
          <BuildGlyph name="Zap" size={24} />
        </View>
        <View style={s.inviteText}>
          <Text style={s.eyebrow}>STEP 1</Text>
          <Text style={s.inviteTitle}>Choose your build</Text>
          <Text style={s.inviteBody}>
            {unreachable
              ? 'The library needs a connection the first time. Tap to try again.'
              : 'The tutor follows the build you pick, and checks your parts before you start.'}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={s.card}>
      <View style={[s.band, { backgroundColor: build.color }]} />
      <View style={s.cardInner}>
        <View style={s.topRow}>
          <Text style={s.eyebrow}>YOUR BUILD</Text>
          <Pressable
            onPress={onOpen}
            hitSlop={10}
            style={({ pressed }) => [s.change, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Change build. Currently ${build.title}`}
          >
            <Text style={s.changeText}>Change</Text>
          </Pressable>
        </View>

        <View style={s.titleRow}>
          <View style={[s.mark, { backgroundColor: build.color }]}>
            <BuildGlyph name={build.icon} size={22} />
          </View>
          <Text style={s.title} numberOfLines={2}>{build.title}</Text>
        </View>

        <Text style={s.meta}>{`${build.level} · ${build.est} · ${build.mode}`}</Text>

        <Text style={s.parts}>
          <Text style={s.partsCount}>{`${build.parts.length} parts: `}</Text>
          {build.parts.join(', ')}
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  loading: {
    backgroundColor: colors.white, borderRadius: radius.lg, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.md,
  },

  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden', ...elevation.card,
  },
  band: { height: 7 },
  cardInner: { padding: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.inkMute,
  },
  change: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, ...curve,
    borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.cream,
  },
  changeText: { fontFamily: font.black, fontSize: type.meta, color: colors.inkSoft, letterSpacing: 0.4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 8 },
  mark: {
    width: 42, height: 42, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, fontFamily: font.black, fontSize: type.heading, lineHeight: leading.heading,
    letterSpacing: tracking.heading, color: colors.ink,
  },
  meta: {
    fontFamily: font.bold, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute, textTransform: 'uppercase', marginTop: 10,
  },
  parts: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: 6,
  },
  partsCount: { fontFamily: font.black, color: colors.ink },

  invite: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: colors.white, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.md, ...elevation.card,
  },
  inviteMark: {
    width: 46, height: 46, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  inviteText: { flex: 1 },
  inviteTitle: {
    fontFamily: font.black, fontSize: type.heading, lineHeight: leading.heading,
    letterSpacing: tracking.heading, color: colors.ink, marginTop: 2,
  },
  inviteBody: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: 4,
  },
});
