import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BuildGlyph } from './BuildGlyph';
import { Button } from '../Button';
import { Close } from '../icons';
import { SkeletonBlock } from '../Skeleton';
import type { Build } from '../../services/builds';
import { curve, font, leading, radius, space, tracking, type } from '../../theme/tokens';
import { stagger } from '../../theme/motion';
import { makeStyles } from '../../theme/theme';

/**
 * Step 1 of the learning loop: choosing what to build.
 *
 * This is the first thing a learner does, before the camera is ever asked for,
 * so it gets a screen of its own rather than a control tucked into a toolbar.
 * The same sheet is used mid-session to switch build, which is why the call to
 * action is passed in rather than fixed.
 *
 * The list has two card shapes, not one with a highlight. A build being
 * considered opens into a banded card carrying its description, its parts and
 * its own start button; the rest stay as ruled rows. Nothing else expands, so a
 * learner is always reading exactly one parts list, which is the decision they
 * are actually making.
 */

interface Props {
  visible: boolean;
  builds: Build[];
  /** True while the catalogue is still being fetched for the first time. */
  loading: boolean;
  selectedId?: string | null;
  /** "Start with this build" before a session, "Switch to this build" during one. */
  ctaLabel: string;
  onChoose: (build: Build) => void;
  onRetry: () => void;
  onClose: () => void;
}

export const BuildPicker: React.FC<Props> = ({
  visible, builds, loading, selectedId, ctaLabel, onChoose, onRetry, onClose,
}) => {
  const s = useS();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(selectedId ?? null);

  // Reopening the sheet should show the learner where they are, not where they
  // last scrolled to.
  useEffect(() => {
    if (visible) setOpenId(selectedId ?? null);
  }, [visible, selectedId]);

  const expand = (build: Build) => {
    void Haptics.selectionAsync();
    setOpenId((prev) => (prev === build.id ? null : build.id));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={onClose}
          style={s.close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close the build library"
        >
          <Close size={18} />
        </Pressable>

        <Text style={s.eyebrow}>STEP 1</Text>
        <Text style={s.title}>What are we building?</Text>
        <Text style={s.lede}>
          Pick a build and the tutor checks your parts through the camera before you wire anything.
        </Text>

        <ScrollView
          style={s.list}
          contentContainerStyle={[s.listInner, { paddingBottom: insets.bottom + space.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {loading && builds.length === 0 && <LoadingRows />}

          {!loading && builds.length === 0 && (
            <View style={s.empty}>
              <View style={s.emptyMark}>
                <BuildGlyph name="Zap" size={26} />
              </View>
              <Text style={s.emptyTitle}>The library needs a connection the first time</Text>
              <Text style={s.emptyBody}>
                Once the builds are on your phone they stay there, and the picker opens offline.
              </Text>
              <Button label="Try again" onPress={onRetry} style={{ marginTop: space.md }} />
            </View>
          )}

          {builds.map((build, i) => (
            <BuildRow
              key={build.id}
              build={build}
              index={i}
              open={openId === build.id}
              chosen={selectedId === build.id}
              reduced={reduced}
              ctaLabel={ctaLabel}
              onPress={() => expand(build)}
              onChoose={() => onChoose(build)}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

/** Occupies the shape the real rows will take, so the list does not jump. */
const LoadingRows: React.FC = () => {
  const s = useS();
  return (
    <View style={{ gap: space.sm }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={s.skeletonRow}>
          <SkeletonBlock width={46} height={46} radius={radius.sm} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width="72%" height={15} />
            <SkeletonBlock width="46%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
};

const BuildRow: React.FC<{
  build: Build;
  index: number;
  open: boolean;
  chosen: boolean;
  reduced: boolean;
  ctaLabel: string;
  onPress: () => void;
  onChoose: () => void;
}> = ({ build, index, open, chosen, reduced, ctaLabel, onPress, onChoose }) => {
  const s = useS();
  const meta = `${build.level} · ${build.est} · ${build.parts.length} parts`;

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(stagger(index, 45)).duration(300)}
      layout={reduced ? undefined : LinearTransition.duration(220)}
      style={[
        open ? s.cardOpen : s.cardRow,
        !open && { borderLeftColor: build.color, borderLeftWidth: 5 },
      ]}
    >
      {open && <View style={[s.band, { backgroundColor: build.color }]} />}

      <Pressable
        onPress={onPress}
        style={open ? s.headOpen : s.headRow}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, selected: chosen }}
        accessibilityLabel={`${build.title}. ${meta}.`}
        accessibilityHint={open ? 'Collapses this build' : 'Shows what this build needs'}
      >
        <View
          style={[
            open ? s.markOpen : s.mark,
            { backgroundColor: build.color },
          ]}
        >
          <BuildGlyph name={build.icon} size={open ? 26 : 21} />
        </View>

        <View style={s.headText}>
          <Text style={open ? s.titleOpen : s.titleRow} numberOfLines={open ? 2 : 1}>
            {build.title}
          </Text>
          <Text style={s.meta}>{meta}</Text>
        </View>

        {chosen && !open && (
          <View style={s.currentPip}>
            <Text style={s.currentPipText}>CHOSEN</Text>
          </View>
        )}
      </Pressable>

      {open && (
        <Animated.View
          entering={reduced ? undefined : FadeInDown.duration(240)}
          style={s.body}
        >
          <Text style={s.desc}>{build.desc}</Text>

          <Text style={s.partsLabel}>WHAT YOU NEED</Text>
          <View style={s.parts}>
            {build.parts.map((part) => (
              <View key={part} style={s.part}>
                <View style={[s.partDot, { backgroundColor: build.color }]} />
                <Text style={s.partText}>{part}</Text>
              </View>
            ))}
          </View>

          <Text style={s.board}>{build.mode}</Text>

          <Button label={ctaLabel} onPress={onChoose} style={{ marginTop: space.md }} />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const useS = makeStyles((colors, th) => ({
  screen: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: space.lg },
  close: {
    width: 38, height: 38, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkSoft, marginTop: space.md,
  },
  title: {
    fontFamily: font.black, fontSize: type.title, lineHeight: leading.title,
    letterSpacing: tracking.title, color: colors.ink, marginTop: 2,
  },
  lede: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: 6,
  },

  list: { marginTop: space.md, marginHorizontal: -space.xs },
  listInner: { gap: space.sm, paddingHorizontal: space.xs, paddingTop: 2 },

  // A row being considered and a row waiting are not the same object: one is a
  // banded card that carries its own parts list and start button, the other is
  // a ruled line. Swapping one for the other should be obvious.
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line,
    ...th.elevation.flush,
  },
  cardOpen: {
    backgroundColor: colors.surface, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden',
    ...th.elevation.lifted,
  },
  band: { height: 6 },

  headRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm + 2 },
  headOpen: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingBottom: space.sm },

  mark: {
    width: 44, height: 44, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  markOpen: {
    width: 54, height: 54, borderRadius: radius.md, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  headText: { flex: 1, gap: 2 },
  titleRow: { fontFamily: font.extrabold, fontSize: type.body, color: colors.ink, letterSpacing: tracking.body },
  titleOpen: {
    fontFamily: font.black, fontSize: type.heading, lineHeight: leading.heading,
    letterSpacing: tracking.heading, color: colors.ink,
  },
  meta: {
    fontFamily: font.bold, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute, textTransform: 'uppercase',
  },
  currentPip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, ...curve,
    backgroundColor: colors.goldSoft, borderWidth: 1.5, borderColor: colors.gold,
  },
  currentPipText: {
    fontFamily: font.black, fontSize: 9, letterSpacing: 1, color: colors.goldText,
  },

  body: { paddingHorizontal: space.md, paddingBottom: space.md },
  desc: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small, color: colors.inkSoft,
  },
  partsLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.ink, marginTop: space.md, marginBottom: 8,
  },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  part: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, ...curve,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.line,
  },
  partDot: { width: 6, height: 6, borderRadius: 3 },
  partText: { fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft },
  board: {
    fontFamily: font.bold, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute, textTransform: 'uppercase', marginTop: space.md,
  },

  skeletonRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.sm + 2,
  },

  empty: {
    backgroundColor: colors.surface, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.lg, ...th.elevation.card,
  },
  emptyMark: {
    width: 52, height: 52, borderRadius: radius.md, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: font.black, fontSize: type.heading, lineHeight: leading.heading,
    letterSpacing: tracking.heading, color: colors.ink, marginTop: space.md,
  },
  emptyBody: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: 6,
  },
}));
