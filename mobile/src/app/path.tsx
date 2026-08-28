import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Animated, {
  Easing, FadeInDown, useAnimatedProps, useDerivedValue, useReducedMotion,
  useSharedValue, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../hooks/useAuth';
import { getManifest, type CurriculumUnit, type Manifest } from '../services/curriculum';
import { EMPTY, loadProgress, saveProgress, type Progress } from '../services/progress';
import {
  claimCheckpoints, fetchCheckpoints, foldCheckpointXp, foldClaim,
  type CheckpointGrant, type CheckpointStatus, type FailReason,
} from '../services/checkpoints';
import { colors, font, radius, space, type, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { duration, stagger } from '../theme/motion';

const TINT: Record<CurriculumUnit['accent'], string> = {
  gold: colors.goldSoft,
  blue: colors.blueSoft,
  green: '#eef7e0',
  red: '#fdece8',
};

const CHEST = require('../../assets/brand/checkpoint-chest.png');
const CHEST_OPEN = require('../../assets/brand/checkpoint-chest-open.png');

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Why the checkpoint state lives on THIS screen.
 *
 * A checkpoint is drawn at every skill boundary on the path, with a chest and an
 * XP figure, and until now nothing ever collected one: the server's
 * POST /v1/me/checkpoints/claim had no caller on either surface, so the
 * ceremony played and the XP was never granted. The claim endpoint pays out
 * EVERYTHING earned in a single call, which is why one place to collect is
 * enough and is the design the server was built for: it survives a client that
 * missed a claim while offline, and it costs one round trip rather than one per
 * skill.
 *
 * The XP a learner sees has one source: the server's record of what it has
 * granted. Nothing here adds XP optimistically.
 */

type CheckpointsView =
  | { phase: 'loading' }
  | { phase: 'ready'; status: CheckpointStatus }
  | { phase: 'error'; reason: FailReason };

const FAIL_COPY: Record<FailReason, string> = {
  offline: "Can't reach your checkpoints. Check your connection.",
  timeout: 'That took too long. Your checkpoints are safe, try again.',
  unauthenticated: 'Sign in again to collect your checkpoints.',
  rate_limited: 'Slow down a moment, then collect them.',
  server: 'Something went wrong on our side. Your checkpoints are safe, try again.',
  // Neither can happen for checkpoints, which are earned rather than unlocked
  // and always exist. Present because the map is exhaustive over FailReason,
  // and an exhaustive map is what makes adding a reason a compile error
  // everywhere it is handled rather than a silent blank.
  upgrade_required: 'Your checkpoints are safe. Something on our side is confused, try again.',
  not_found: 'Your checkpoints are safe. Something on our side is confused, try again.',
};

export default function LearningPath() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [checkpoints, setCheckpoints] = useState<CheckpointsView>({ phase: 'loading' });
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<FailReason | null>(null);
  const [ceremony, setCeremony] = useState<CheckpointGrant | null>(null);

  // The progress record is read and written here but never rendered, so it is a
  // ref rather than state: putting it in state would re-render the whole path
  // for a number this screen does not show.
  const progressRef = useRef<Progress>(EMPTY);

  const load = useCallback(async () => {
    const [fresh, progress, status] = await Promise.all([
      getManifest((m) => setManifest(m)),
      uid ? loadProgress(uid) : Promise.resolve(EMPTY),
      fetchCheckpoints(),
    ]);
    setManifest(fresh);
    setFailed(!fresh);
    setCheckpoints(status.ok ? { phase: 'ready', status: status.data } : { phase: 'error', reason: status.reason });

    // Reconcile the ledger against the server's total. Idempotent: it adds the
    // DIFFERENCE, so running it on every visit, on two devices, or after the app
    // was killed between a claim and its save all land on the same number.
    progressRef.current = progress;
    if (!status.ok || !uid) return;
    const patch = foldCheckpointXp(progress, status.data.totalClaimedXp);
    if (!patch) return;
    const next = { ...progress, ...patch };
    progressRef.current = next;
    await saveProgress(uid, next);
  }, [uid]);

  useEffect(() => { void load().finally(() => setLoading(false)); }, [load]);
  // A checkpoint collected in the browser must show as collected here, not as
  // still waiting, so this re-reads whenever the screen comes forward.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const collect = useCallback(async () => {
    // Read synchronously, BEFORE the await. The fold below has to name an
    // absolute total rather than a delta, and this is that total's anchor: what
    // the server had already paid at the moment this button was pressed. Taken
    // afterwards it could include this very grant, folded by a `load()` that
    // ran while the POST was in flight — and `load()` runs on every focus, so a
    // glance at another tab mid-claim is enough. The learner would be paid twice.
    const totalBefore = checkpoints.phase === 'ready' ? checkpoints.status.totalClaimedXp : null;
    setClaiming(true);
    setClaimError(null);
    const res = await claimCheckpoints();
    setClaiming(false);

    if (!res.ok) {
      // No ceremony for a claim that did not happen. The panel stays put with
      // the reason on it so the learner can try again.
      setClaimError(res.reason);
      return;
    }

    // Fold what this call granted without waiting on another round trip. Naming
    // the total makes this safe to run more than once for one grant: a second
    // fold finds the ledger already there and does nothing. With no anchor to
    // name it from, skip it — the refresh below is absolute and pays it instead.
    if (res.data.xp > 0 && uid && totalBefore !== null) {
      const patch = foldClaim(progressRef.current, totalBefore, res.data.xp);
      if (patch) {
        const next = { ...progressRef.current, ...patch };
        progressRef.current = next;
        void saveProgress(uid, next);
      }
    }

    if (res.data.granted.length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCeremony(res.data);
    }

    // Refresh the lists so the panel reflects what is left, and reconcile
    // against the total that comes back. The web app gets this from an effect on
    // its status state; this screen has no such effect, so without it a grant
    // this device could not anchor, or a remainder another device left behind,
    // would sit unpaid until the next focus.
    const after = await fetchCheckpoints();
    if (!after.ok) return;
    setCheckpoints({ phase: 'ready', status: after.data });
    if (!uid) return;
    const settle = foldCheckpointXp(progressRef.current, after.data.totalClaimedXp);
    if (settle) {
      const next = { ...progressRef.current, ...settle };
      progressRef.current = next;
      void saveProgress(uid, next);
    }
  }, [uid, checkpoints]);

  const retry = useCallback(() => {
    setCheckpoints({ phase: 'loading' });
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.goldDeep} />
      </View>
    );
  }

  // Honest failure state: an empty path and an unreachable backend must not
  // look the same, which is a mistake the web app made with its community feed.
  if (failed || !manifest) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Can't reach the lessons</Text>
        <Text style={s.emptyBody}>
          Check your connection and pull to try again. Lessons you've already opened still work offline.
        </Text>
      </View>
    );
  }

  const totalLessons = manifest.units.reduce(
    (n, u) => n + u.skills.reduce((m, sk) => m + sk.lessons.length, 0), 0,
  );

  return (
    <>
      <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>LEARNING PATH</Text>
        <Text style={s.title}>Everything you'll learn.</Text>
        <Text style={s.sub}>
          {manifest.units.length} units, {totalLessons} lessons, in the order they unlock.
        </Text>

        <CheckpointBand
          view={checkpoints}
          claiming={claiming}
          claimError={claimError}
          onCollect={collect}
          onRetry={retry}
        />

        {manifest.units.map((unit, i) => {
          const lessonCount = unit.skills.reduce((n, sk) => n + sk.lessons.length, 0);
          return (
            <Pressable
              key={unit.id}
              style={[s.unit, { backgroundColor: TINT[unit.accent] ?? colors.white }]}
              onPress={() => router.push({ pathname: '/unit/[id]', params: { id: unit.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Unit ${i + 1}: ${unit.title}, ${lessonCount} lessons`}
            >
              <View style={s.unitTop}>
                <View style={s.number}>
                  <Text style={s.numberText}>{i + 1}</Text>
                </View>
                <View style={s.levelPill}>
                  <Text style={s.levelText}>{unit.level.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={s.unitTitle}>{unit.title}</Text>
              <Text style={s.unitSub}>{unit.subtitle}</Text>
              <Text style={s.unitMeta}>{lessonCount} lessons</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {ceremony && <CheckpointCeremony grant={ceremony} onClose={() => setCeremony(null)} />}
    </>
  );
}

/**
 * What is waiting to be collected, or what already has been.
 *
 * The two are deliberately different objects rather than one card with a changed
 * colour: something collectable is a full gold panel with an action, a history
 * of cleared checkpoints is a single quiet line, because it is a fact.
 */
const CheckpointBand: React.FC<{
  view: CheckpointsView;
  claiming: boolean;
  claimError: FailReason | null;
  onCollect: () => void;
  onRetry: () => void;
}> = ({ view, claiming, claimError, onCollect, onRetry }) => {
  if (view.phase === 'loading') {
    return (
      <View style={b.quiet}>
        <ActivityIndicator size="small" color={colors.inkMute} />
        <Text style={b.quietText}>Checking your checkpoints</Text>
      </View>
    );
  }

  if (view.phase === 'error') {
    return (
      <View style={b.quiet}>
        <Text style={b.quietText} accessibilityLiveRegion="polite">{FAIL_COPY[view.reason]}</Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          hitSlop={8}
          style={({ pressed }) => [b.retry, pressed && b.retryPressed]}
        >
          <Text style={b.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { available, claimed, totalClaimedXp } = view.status;

  if (available.length > 0) {
    const total = available.reduce((sum, c) => sum + c.xp, 0);
    return (
      <Animated.View entering={FadeInDown.duration(320)} style={b.panel}>
        <View style={b.panelTop}>
          <View style={b.chestWrap}>
            <Image source={CHEST} style={b.chestArt} contentFit="contain" accessible={false} />
          </View>
          <View style={b.panelCopy}>
            <Text style={b.kicker}>
              {available.length === 1 ? 'CHECKPOINT REACHED' : 'CHECKPOINTS REACHED'}
            </Text>
            <Text style={b.panelTitle} numberOfLines={2}>
              {available.length === 1 ? available[0].title : `${available.length} skills cleared`}
            </Text>
            {available.length > 1 && (
              <Text style={b.panelSub} numberOfLines={2}>
                {available.map((c) => c.title).join(' · ')}
              </Text>
            )}
          </View>
        </View>

        {claimError && (
          <Text style={b.panelError} accessibilityLiveRegion="polite">{FAIL_COPY[claimError]}</Text>
        )}

        <Pressable
          onPress={onCollect}
          disabled={claiming}
          accessibilityRole="button"
          accessibilityState={{ disabled: claiming, busy: claiming }}
          accessibilityLabel={`Collect ${total} XP from ${available.length} checkpoint${available.length === 1 ? '' : 's'}`}
          style={({ pressed }) => [b.collect, pressed && !claiming && b.collectPressed, claiming && b.collectBusy]}
        >
          <Text style={b.collectText}>{claiming ? 'Collecting…' : `Collect ${total} XP`}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  const clearedCount = Object.keys(claimed).length;
  if (clearedCount > 0) {
    return (
      <View style={b.quiet}>
        <Image source={CHEST_OPEN} style={b.quietChest} contentFit="contain" accessible={false} />
        <Text style={b.quietText}>
          {clearedCount} checkpoint{clearedCount === 1 ? '' : 's'} cleared
        </Text>
        <Text style={b.quietXp}>{totalClaimedXp} XP collected</Text>
      </View>
    );
  }

  return (
    <View style={b.quiet}>
      <Image source={CHEST} style={[b.quietChest, b.quietChestLocked]} contentFit="contain" accessible={false} />
      <Text style={b.quietText}>Finish every lesson in a skill to open its checkpoint.</Text>
    </View>
  );
};

/**
 * The payout, shown only for XP the server actually granted.
 *
 * Mounted from the claim response, never from local state, which is what keeps
 * a second device honest: there the checkpoints come back already claimed, the
 * grant is empty, and this never appears.
 *
 * The counter is an animated TextInput for the same reason LessonComplete's is:
 * Reanimated has no animated Text with animated CONTENT, and driving a number
 * through runOnJS costs a full render per frame.
 */
const CheckpointCeremony: React.FC<{ grant: CheckpointGrant; onClose: () => void }> = ({ grant, onClose }) => {
  const reduced = useReducedMotion();
  const xp = useSharedValue(0);

  useEffect(() => {
    if (reduced) { xp.value = grant.xp; return; }
    xp.value = withTiming(grant.xp, { duration: duration.count, easing: Easing.out(Easing.cubic) });
  }, [grant.xp, reduced, xp]);

  const shown = useDerivedValue(() => `${Math.round(xp.value)}`);
  const counter = useAnimatedProps(() => ({ text: shown.value, defaultValue: shown.value }) as never);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={c.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        {/* Stops a tap on the card itself from dismissing. */}
        <Pressable style={c.card} onPress={() => {}}>
          <Image source={CHEST_OPEN} style={c.chest} contentFit="contain" accessible={false} />

          <Text style={c.kicker}>
            {grant.granted.length === 1 ? 'CHECKPOINT CLEARED' : `${grant.granted.length} CHECKPOINTS CLEARED`}
          </Text>

          <View style={c.xpRow}>
            <Text style={c.plus}>+</Text>
            <AnimatedTextInput
              animatedProps={counter}
              editable={false}
              caretHidden
              style={c.xp}
              maxFontSizeMultiplier={1.15}
              accessibilityElementsHidden
            />
            <Text style={c.xpUnit}>XP</Text>
          </View>
          {/* The figure above animates, so it is hidden from the reader and the
              final total announced once here instead. */}
          <Text style={c.srOnly} accessibilityLiveRegion="polite">
            {`${grant.xp} XP collected`}
          </Text>

          <View style={c.list}>
            {grant.granted.map((reward, i) => (
              <Animated.View
                key={reward.skillId}
                entering={reduced ? undefined : FadeInDown.delay(stagger(i, 60, 5)).duration(300)}
                style={c.row}
              >
                <Text style={c.rowTitle} numberOfLines={1}>{reward.title}</Text>
                <Text style={c.rowXp}>+{reward.xp}</Text>
              </Animated.View>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [c.done, pressed && c.donePressed]}
          >
            <Text style={c.doneText}>Keep going</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cream, padding: space.xl,
  },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -0.8, marginTop: 4,
  },
  sub: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    marginTop: 6, marginBottom: space.md,
  },
  unit: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.lg, marginBottom: space.md, ...elevation.card,
  },
  unitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: {
    width: 44, height: 44, borderRadius: 22, ...curve, borderWidth: 2, borderColor: colors.ink,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  numberText: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  levelPill: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999, ...curve,
    backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 3,
  },
  levelText: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1, color: colors.ink },
  unitTitle: {
    fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: space.md,
  },
  unitSub: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: 4, lineHeight: 20,
  },
  unitMeta: {
    fontFamily: font.extrabold, fontSize: type.meta, letterSpacing: 1,
    color: colors.inkSoft, marginTop: space.sm,
  },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, textAlign: 'center' },
  emptyBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.sm, lineHeight: 20,
  },
});

const b = StyleSheet.create({
  // The collectable state: a full gold object with a plate under it, the only
  // thing on this screen that outranks a unit banner.
  panel: {
    backgroundColor: colors.gold,
    borderWidth: 3, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.md, marginBottom: space.lg,
    ...elevation.lifted,
  },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chestWrap: {
    width: 64, height: 64, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  chestArt: { width: 48, height: 48 },
  panelCopy: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: font.black, fontSize: 10, letterSpacing: 2.2, color: colors.goldText },
  panelTitle: {
    fontFamily: font.black, fontSize: type.heading, color: colors.ink,
    letterSpacing: -0.4, marginTop: 2,
  },
  panelSub: { fontFamily: font.bold, fontSize: type.meta, color: colors.goldText, marginTop: 3 },
  panelError: {
    fontFamily: font.black, fontSize: type.small, color: colors.ink,
    marginTop: space.sm,
  },
  collect: {
    marginTop: space.md,
    backgroundColor: colors.ink, borderRadius: radius.md, ...curve,
    paddingVertical: 14, alignItems: 'center',
  },
  collectPressed: { transform: [{ translateY: 2 }], opacity: 0.92 },
  collectBusy: { opacity: 0.6 },
  collectText: { fontFamily: font.black, fontSize: type.bodyLg, color: colors.gold, letterSpacing: -0.2 },

  // Everything that is a fact rather than an action: one line, no card.
  quiet: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: space.sm, marginBottom: space.lg,
  },
  quietChest: { width: 24, height: 24 },
  quietChestLocked: { opacity: 0.38 },
  quietText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, flexShrink: 1 },
  quietXp: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  retry: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999, ...curve,
    backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 4,
  },
  retryPressed: { transform: [{ translateY: 1 }], backgroundColor: colors.goldSoft },
  retryText: { fontFamily: font.black, fontSize: type.meta, color: colors.ink, letterSpacing: 0.6 },
});

const c = StyleSheet.create({
  scrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,24,31,0.62)', padding: space.lg,
  },
  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: colors.white,
    borderWidth: 3, borderColor: colors.ink, borderRadius: radius.xl, ...curve,
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md,
    alignItems: 'center',
    ...elevation.overlay,
  },
  chest: { width: 112, height: 112 },
  kicker: {
    fontFamily: font.black, fontSize: 10, letterSpacing: 2.4,
    color: colors.goldText, marginTop: space.sm,
  },
  xpRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  plus: { fontFamily: font.black, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  xp: {
    fontFamily: font.black, fontSize: 48, color: colors.ink,
    letterSpacing: -2, padding: 0,
  },
  xpUnit: { fontFamily: font.black, fontSize: 22, color: colors.goldText, marginLeft: 6 },
  // Present for the screen reader, absent to the eye: the animated figure above
  // cannot be announced sensibly while it is counting.
  srOnly: { height: 0, opacity: 0 },
  list: { alignSelf: 'stretch', marginTop: space.md, gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.sm, backgroundColor: colors.goldSoft,
    borderRadius: radius.sm, ...curve, paddingHorizontal: 12, paddingVertical: 9,
  },
  rowTitle: { fontFamily: font.black, fontSize: type.small, color: colors.ink, flexShrink: 1 },
  rowXp: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  done: {
    alignSelf: 'stretch', marginTop: space.lg,
    backgroundColor: colors.gold, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.md, ...curve, paddingVertical: 13, alignItems: 'center',
  },
  donePressed: { transform: [{ translateY: 2 }], backgroundColor: colors.goldDeep },
  doneText: { fontFamily: font.black, fontSize: type.bodyLg, color: colors.ink },
});
