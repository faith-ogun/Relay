import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { usePlan } from '../hooks/usePlan';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import {
  getAchievements, readCachedEarned, TIER_COLOR, type Achievement, type Tier,
} from '../services/achievements';
import {
  authoredCompletions, authoredLessonsCompleted, authoredUnitsCompleted,
  corpusLessonIds, isEarnedWith,
} from '../services/achievementRules';
import { achievementStats } from '../services/progress';
import { getManifest } from '../services/curriculum';
import { AppTabs } from '../components/AppTabs';
import { AppearancePicker } from '../components/AppearancePicker';
import { MedalArt } from '../components/MedalArt';
import { SkeletonBlock } from '../components/Skeleton';
import { shortXp, STAT_ART } from '../components/StatStrip';
import {
  Battery, BuiltGlyph, Certificate, Chevron, Contrast, Cube, Flask, InfinityMark,
  Lock, Medal, MinutesGlyph, Person, Shield,
} from '../components/icons';
import { font, radius, space, type, curve, leading, tabular, tracking } from '../theme/tokens';
import { motion, stagger } from '../theme/motion';
import { currentStreak } from '../services/completion';
import { makeStyles, useColors, withAlpha } from '../theme/theme';

/**
 * Profile: everything about YOU, in one place.
 *
 * Achievements, twins, plan and account all used to be rows on the front page,
 * competing with the thing the app is actually for. They belong behind a face,
 * the way every app with a tab bar arranges them, so Learn can be about
 * learning.
 *
 * ── The 2026-09-01 rebuild ────────────────────────────────────────────────
 *
 * Faith's verdict on what stood here: "a wee bit ugly and a wee bit
 * rudimentary". Four specific things were wrong, and all four were the same
 * mistake, which is drawing information as TEXT IN A BOX when the app already
 * owns a picture of it:
 *
 *   1. Three stat boxes with a coloured number and a caption, while the Learn
 *      tab showed the same numbers as painted artwork two taps away. The stats
 *      are now four, and each one carries its icon: XP and the streak take the
 *      painted set straight from StatStrip, and the two that had no artwork are
 *      drawn to match it (`BuiltGlyph`, `MinutesGlyph` in components/icons).
 *   2. The achievement shelf printed each medal's TITLE in a little white
 *      rectangle, when the catalogue serves painted CARD ART that the trophy
 *      case on /achievements has been showing all along. Both surfaces now go
 *      through `MedalArt`, which is one code path and therefore one failure
 *      path.
 *   3. Every row in YOU was a title, a subtitle and a text chevron, six times,
 *      with nothing to tell one from another until you read it. Each one now
 *      carries the object it leads to.
 *   4. Nothing moved, and nothing had a resting state that was not identical to
 *      every other resting state.
 *
 * Three card shapes do the work now and they are structurally different rather
 * than differently coloured: an ink-bordered stat plate divided into quadrants,
 * a gold shelf with the medals laid on it, and the row list. Swapping any one
 * for another would be immediately obvious, which is the test.
 */

/** One casing, two places. The chip uppercases in CSS rather than in the data,
 *  so the Plan row can say "Free" in a sentence without a second map. */
const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', max: 'Max' };

/** Medals on the shelf, and how big each disc is. Four plus the overflow chip
 *  is the most that fits across a 375pt phone without the discs shrinking to
 *  the point where the card art inside them stops being a picture. */
const SHELF = 4;
const DISC = 48;
const STAT_ICON = 40;

/**
 * The last loaded state, at module scope, keyed by learner.
 *
 * The tab bar navigates with `router.replace`, so leaving Profile UNMOUNTS it:
 * without this, coming back means `progress` is EMPTY for as long as the reads
 * take, and the screen paints a confident "0 XP · 0 day streak · 0 built" at
 * somebody who has been at this for a month. The same pattern, and the same
 * reasoning, as the snapshot in app/home.tsx.
 *
 * Keyed by uid so a second account on a shared phone cannot inherit the first
 * one's numbers for the moment before its own arrive.
 */
type Snapshot = {
  uid: string | undefined;
  progress: Progress;
  earned: Achievement[];
  catalogue: number;
  builds: number;
  buildTotal: number;
};
let snapshot: Snapshot | null = null;

export default function Profile() {
  const colors = useColors();
  const s = useS();
  const { user, displayName } = useAuth();
  const { childSafe } = useChildSafe();
  const plan = usePlan();
  const reduced = useReducedMotion();

  const warm = snapshot && snapshot.uid === user?.uid ? snapshot : null;
  const [progress, setProgress] = useState<Progress>(warm?.progress ?? EMPTY);
  const [earned, setEarned] = useState<Achievement[]>(warm?.earned ?? []);
  const [catalogue, setCatalogue] = useState(warm?.catalogue ?? 0);
  const [builds, setBuilds] = useState(warm?.builds ?? 0);
  const [buildTotal, setBuildTotal] = useState(warm?.buildTotal ?? 0);
  const [loaded, setLoaded] = useState(!!warm);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [p, list, manifest, earnedAt] = await Promise.all([
          user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
          getAchievements(),
          getManifest(),
          // The durable record, from this device's mirror of it. The trophy
          // shelf here has to agree with the trophy case on /achievements, and
          // that one reads the record rather than recomputing from counters.
          readCachedEarned(user?.uid),
        ]);
        if (!alive) return;

        // Units and lessons counted in AUTHORED lessons, not in the sessions
        // they are delivered as. Counting sessions is what stripped the unit
        // medals off a learner who had finished the whole curriculum before it
        // was cut, and this shelf was still doing it after the trophy case
        // stopped. Both surfaces, one rule: services/achievementRules.ts.
        const done = new Set(Object.keys(p.lessonLevels));
        const unitsDone = manifest ? authoredUnitsCompleted(manifest.units, done) : 0;
        const buildsDone = manifest ? authoredLessonsCompleted(manifest.units, done) : done.size;
        // The DENOMINATOR has to be counted the same way as the numerator, or
        // the tile reads "20 of 284" for a learner who has done 20 of 142. The
        // corpus collapsed onto itself is the authored lesson count, computed
        // by the same rule rather than by a second piece of arithmetic here.
        const corpus = manifest ? corpusLessonIds(manifest.units) : new Set<string>();
        const authoredTotal = authoredCompletions(corpus, corpus).size;
        const stats = { ...achievementStats(p, unitsDone), builds: buildsDone };
        // Earned is what the record says, then what today's counters can prove.
        const held = (list ?? []).filter((a) => isEarnedWith(a, stats, earnedAt));

        setProgress(p);
        setEarned(held);
        setCatalogue((list ?? []).length);
        setBuilds(buildsDone);
        setBuildTotal(authoredTotal);
        setLoaded(true);
        snapshot = {
          uid: user?.uid,
          progress: p,
          earned: held,
          catalogue: (list ?? []).length,
          builds: buildsDone,
          buildTotal: authoredTotal,
        };
      })();
      return () => { alive = false; };
    }, [user?.uid]),
  );

  const streak = currentStreak(progress);
  const minutes = plan.minutesRemaining ?? 0;
  const tier = plan.plan === 'max' ? s.chipMax : plan.plan === 'pro' ? s.chipPro : s.chipFree;
  const tierText = plan.plan === 'max' ? s.chipMaxText : plan.plan === 'pro' ? s.chipProText : s.chipFreeText;

  return (
    <AppTabs active="profile">
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          {/* The one atmospheric touch on the screen: a gold wash that bleeds
              past the page padding and fades out under the name, so the head
              sits in light rather than on a flat fill. */}
          <LinearGradient
            colors={[withAlpha(colors.gold, 0.22), withAlpha(colors.gold, 0)]}
            style={s.wash}
            pointerEvents="none"
          />
          <View style={s.medallion}>
            <Image
              source={require('../../assets/brand/mascot-wave.png')}
              style={s.avatar}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel=""
            />
          </View>
          <Text style={s.name} numberOfLines={1}>{displayName || 'Builder'}</Text>
          {!!user?.email && <Text style={s.email} numberOfLines={1}>{user.email}</Text>}
          {/* Hidden for a minor for the same reason the Plan row below is: a
              minor cannot self-purchase (#96), so their tier is not a thing to
              put a badge on. Held back while the entitlement is in flight as
              well, because flashing FREE at somebody who pays is worse than
              showing nothing for a beat. */}
          {!childSafe && !plan.loading && (
            <View style={[s.chipPlan, tier]}>
              <Text style={[s.chipPlanText, tierText]}>{PLAN_LABEL[plan.plan] ?? 'Free'}</Text>
            </View>
          )}
        </View>

        {/* One plate in four quadrants rather than four cards in a row. The
            numbers belong together: they are one answer to "how am I doing",
            and four separate bordered boxes say they are four unrelated facts.
            The divider cross costs two hairlines and does the same job. */}
        <View style={s.plate}>
          <View style={s.plateRow}>
            <StatTile
              icon={<Image source={STAT_ART.xp} style={s.statIcon} resizeMode="contain" accessibilityIgnoresInvertColors />}
              label="XP"
              a11y={`${progress.xp} XP`}
              loading={!loaded}
            >
              {/* Shortened by the same rule the Learn strip uses. 100,000 XP is
                  a number a committed learner reaches, and six black digits at
                  30pt do not fit in a quarter of this plate. */}
              <Text style={s.statValue} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                {shortXp(progress.xp)}
              </Text>
            </StatTile>
            <View style={s.ruleY} />
            <StatTile
              icon={<Image source={STAT_ART.streak} style={[s.statIcon, streak === 0 && s.iconDim]} resizeMode="contain" accessibilityIgnoresInvertColors />}
              label="DAY STREAK"
              a11y={streak === 0 ? 'No streak yet' : `${streak} day streak`}
              loading={!loaded}
            >
              <Text
                style={[s.statValue, streak > 0 ? { color: colors.red } : s.statValueOff]}
                maxFontSizeMultiplier={1.15}
              >
                {streak}
              </Text>
            </StatTile>
          </View>

          <View style={s.ruleX} />

          <View style={s.plateRow}>
            <StatTile
              icon={<BuiltGlyph size={STAT_ICON} dim={builds === 0} />}
              label="BUILT"
              a11y={buildTotal ? `${builds} of ${buildTotal} builds finished` : `${builds} builds finished`}
              loading={!loaded}
            >
              <View style={s.statValueRow}>
                <Text
                  style={[s.statValue, builds === 0 && s.statValueOff]}
                  maxFontSizeMultiplier={1.15}
                >
                  {builds}
                </Text>
                {buildTotal > 0 && <Text style={s.statDenominator}>/{buildTotal}</Text>}
              </View>
            </StatTile>
            <View style={s.ruleY} />
            <StatTile
              icon={<MinutesGlyph size={STAT_ICON} dim={!plan.unlimited && minutes === 0} />}
              label={plan.unlimited ? 'NO LIMIT' : 'MINUTES LEFT'}
              a11y={plan.unlimited ? 'Unlimited live minutes' : `${minutes} live minutes left`}
              loading={plan.loading}
            >
              {plan.unlimited ? (
                <View style={s.statInfinity}><InfinityMark size={28} color={colors.goldText} /></View>
              ) : (
                <Text
                  style={[s.statValue, minutes === 0 && { color: colors.red }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.15}
                >
                  {minutes}
                </Text>
              )}
            </StatTile>
          </View>
        </View>

        <Section label="ACHIEVEMENTS" Glyph={Medal} />
        <Shelf earned={earned} catalogue={catalogue} loaded={loaded} reduced={reduced} />

        <Section label="YOU" Glyph={Person} />
        <Row
          Glyph={Cube}
          title="3D twins"
          sub="Models of everything you've built"
          onPress={() => router.push('/twins')}
        />
        {!childSafe && (
          <Row
            Glyph={Battery}
            gold
            title="Plan"
            sub={plan.unlimited
              ? 'Unlimited live time'
              : `${PLAN_LABEL[plan.plan] ?? 'Free'} · ${plan.minutesRemaining ?? 0} live minutes left`}
            onPress={() => router.push('/plans')}
          />
        )}
        {plan.plan === 'max' && (
          <Row
            Glyph={Certificate}
            title="Your build record"
            sub="What Ohmlet can actually verify about you"
            onPress={() => router.push('/career')}
          />
        )}
        {/* Interview Mode used to sit here, and no longer does. It moved into
            the Live tab's segmented control on 2026-09-01, alongside Bench and
            Coaching, which is where a live session belongs. Two doors into one
            feature is worse than one: the second is the one nobody maintains,
            and the learner who finds it wonders which is the real one.
            The locked panel in that segment still sells Max to a learner who
            does not have it, so nothing about discovery was lost. */}
        {/* Shown on every plan, not just Max. Someone without early access
            should be able to see what Labs is and what it costs to get in;
            hiding the thing you are selling is a strange way to sell it. */}
        <Row
          Glyph={Flask}
          title="Ohmlet Labs"
          sub={plan.plan === 'max' ? 'Early access, yours now' : 'Unfinished features, Max first'}
          onPress={() => router.push('/labs')}
        />
        <Row
          Glyph={Shield}
          title="Account and privacy"
          sub="Your data, legal, sign out"
          onPress={() => router.push('/account')}
        />

        {/* In place rather than behind a row, because the result of the choice
            is the screen it is sitting on. */}
        <Section label="APPEARANCE" Glyph={Contrast} />
        <AppearancePicker />
      </ScrollView>
    </AppTabs>
  );
}

/** A heading, its mark, and a rule running out to the margin. Three of these
 *  carry the page, so they are one component: a heading that is only bold small
 *  caps is indistinguishable from a label, and the rule is what makes it read
 *  as a division of the page rather than a line of text. */
const Section: React.FC<{ label: string; Glyph: React.FC<{ size?: number; color?: string }> }> = ({
  label, Glyph,
}) => {
  const s = useS();
  return (
    <View style={s.section}>
      <Glyph size={15} />
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.sectionRule} />
    </View>
  );
};

/**
 * One quadrant of the stat plate: the picture, the number, the word.
 *
 * `accessible` on the wrapper is what makes the label take effect. A View is not
 * an accessibility element on its own, and without it VoiceOver walks past the
 * label and reads the bare number, and "2070" is not a stat.
 */
const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  a11y: string;
  loading: boolean;
  children: React.ReactNode;
}> = ({ icon, label, a11y, loading, children }) => {
  const s = useS();
  return (
    <View style={s.tile} accessible accessibilityLabel={loading ? `${label}, loading` : a11y}>
      {icon}
      {/* The skeleton occupies the number's box exactly, so nothing on the
          plate moves when the read comes back. A stat that appears at zero and
          then jumps is worse than one that arrives once. */}
      {loading ? <SkeletonBlock width={54} height={30} radius={8} style={s.statSkeleton} /> : children}
      <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
};

/**
 * The trophy shelf: the medals themselves, laid on gold.
 *
 * It used to print each medal's title in a small white box, which is the one
 * thing a trophy shelf must not do. The card art is the reward and the app
 * already has it; `MedalArt` is the same path the trophy case uses, so a medal
 * that fails to load degrades to its tier disc here exactly as it does there.
 */
const Shelf: React.FC<{
  earned: Achievement[];
  catalogue: number;
  loaded: boolean;
  reduced: boolean;
}> = ({ earned, catalogue, loaded, reduced }) => {
  const s = useS();
  const colors = useColors();
  const depth = useSharedValue(0);
  const face = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - depth.value * 0.015 }, { translateY: depth.value * 2 }],
  }));

  return (
    <Pressable
      onPressIn={() => { depth.value = withSpring(1, motion.press); Haptics.selectionAsync().catch(() => {}); }}
      onPressOut={() => { depth.value = withSpring(0, motion.release); }}
      onPress={() => router.push('/achievements')}
      accessibilityRole="button"
      accessibilityLabel={
        catalogue
          ? `Achievements, ${earned.length} of ${catalogue} earned`
          : `Achievements, ${earned.length} earned`
      }
    >
      <Animated.View style={[s.shelf, face]}>
        <View style={s.shelfHead}>
          {loaded
            ? <Text style={s.shelfCount}>{earned.length}</Text>
            : <SkeletonBlock width={30} height={36} radius={10} />}
          <View style={s.shelfHeadText}>
            <Text style={s.shelfEarned}>EARNED</Text>
            {catalogue > 0 && <Text style={s.shelfOf}>of {catalogue}</Text>}
          </View>
          <View style={s.spacer} />
          <Text style={s.shelfCta}>See all</Text>
          <Chevron size={16} color={colors.goldText} />
        </View>

        {!loaded ? (
          <View style={s.shelfRow}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} width={DISC} height={DISC} radius={DISC / 2} />
            ))}
          </View>
        ) : earned.length === 0 ? (
          // A real empty state: the shelf with its places set. Three outlined
          // discs say "this is where they go" in a way a sentence on its own
          // cannot, and neither of them is a dashed grey box.
          <View style={s.shelfEmpty}>
            <View style={s.shelfRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={s.discEmpty}>
                  <Lock size={17} color={colors.goldText} />
                </View>
              ))}
            </View>
            <Text style={s.shelfEmptyText}>
              Finish your first lesson and the case starts filling up.
            </Text>
          </View>
        ) : (
          <View style={s.shelfRow}>
            {earned.slice(0, SHELF).map((a, i) => (
              // The one signature motion on the page, and it is tied to real
              // news: the medals land as the record comes back, staggered, so
              // they arrive rather than appear.
              <Animated.View
                key={a.id}
                entering={reduced ? undefined : FadeInDown.delay(stagger(i, 55, 4)).duration(300)}
                style={[s.disc, { backgroundColor: TIER_COLOR[a.tier as Tier] ?? colors.line }]}
              >
                <MedalArt art={a.art} size={DISC - 9} />
              </Animated.View>
            ))}
            {earned.length > SHELF && (
              <View style={s.discMore}>
                <Text style={s.discMoreText}>+{earned.length - SHELF}</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

/**
 * One destination in YOU.
 *
 * The mark on the left is the object the row leads to, so the list can be
 * scanned rather than read. The press is a spring rather than a colour swap:
 * everything else chunky in this app compresses when you touch it, and a row
 * that only changes shade reads as a link on a web page.
 */
const Row: React.FC<{
  Glyph: React.FC<{ size?: number; color?: string }>;
  title: string;
  sub: string;
  /** The one accented mark in the list. Reserved for Plan, which is the row
   *  about the currency the rest of the app is denominated in. */
  gold?: boolean;
  onPress: () => void;
}> = ({ Glyph, title, sub, gold, onPress }) => {
  const s = useS();
  const colors = useColors();
  const depth = useSharedValue(0);
  const face = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - depth.value * 0.014 }, { translateY: depth.value * 2 }],
  }));

  return (
    <Pressable
      onPressIn={() => { depth.value = withSpring(1, motion.press); Haptics.selectionAsync().catch(() => {}); }}
      onPressOut={() => { depth.value = withSpring(0, motion.release); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
    >
      <Animated.View style={[s.row, face]}>
        <View style={[s.chip, gold && s.chipGold]}>
          <Glyph size={21} color={gold ? colors.goldText : colors.ink} />
        </View>
        <View style={s.rowText}>
          <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.rowSub} numberOfLines={2}>{sub}</Text>
        </View>
        <Chevron size={18} />
      </Animated.View>
    </Pressable>
  );
};

const useS = makeStyles((colors, th) => ({
  scroll: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  spacer: { flex: 1 },

  // ── The face ──
  head: { alignItems: 'center' },
  wash: { position: 'absolute', top: -space.xl, left: -space.lg, right: -space.lg, height: 230 },
  medallion: {
    width: 118, height: 118, borderRadius: 59,
    borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: space.md, ...th.press,
  },
  avatar: { width: 94, height: 94 },
  name: {
    fontFamily: font.black, fontSize: type.title, lineHeight: leading.title,
    color: colors.ink, letterSpacing: tracking.title, textAlign: 'center',
  },
  email: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 1 },
  chipPlan: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999, borderWidth: 2,
  },
  chipFree: { backgroundColor: colors.surface, borderColor: colors.line },
  chipPro: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  chipMax: { backgroundColor: colors.gold, borderColor: colors.goldPlate },
  chipPlanText: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  chipFreeText: { color: colors.inkSoft },
  chipProText: { color: colors.goldText },
  // `onGold`, not `goldText`: the gold fill is the one colour in the palette
  // that does not move between themes, so what sits on it must not either.
  chipMaxText: { color: colors.onGold },

  // ── The stat plate ──
  plate: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    // No `overflow: hidden`. The divider cross meets the border at the middle
    // of each edge, where the radius has not started curving yet, so there is
    // nothing to clip; and clipping here would have taken the plate's own
    // shadow with it on Android.
    ...th.elevation.lifted,
  },
  plateRow: { flexDirection: 'row' },
  ruleY: { width: 2, backgroundColor: colors.line },
  ruleX: { height: 2, backgroundColor: colors.line },
  tile: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, paddingHorizontal: 6, gap: 4,
  },
  statIcon: { width: STAT_ICON, height: STAT_ICON },
  // Not greyscale: the art is the brand. Flattened enough that a stat at zero
  // reads as zero without becoming a different picture.
  iconDim: { opacity: 0.38 },
  statValue: {
    ...tabular, fontFamily: font.black, fontSize: 30,
    color: colors.ink, letterSpacing: -0.9,
  },
  statValueOff: { color: colors.inkMute },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  // The denominator is deliberately a different size AND a different weight
  // from the number it qualifies. Same size would read as "20/142" the string;
  // this reads as 20, of 142.
  statDenominator: {
    ...tabular, fontFamily: font.black, fontSize: type.body,
    color: colors.inkMute, letterSpacing: -0.2,
  },
  // Both of these stand in for a 30pt line of Nunito Black, so they carry its
  // height rather than their own: a stat that changes the plate's height when
  // it resolves is the layout shift the skeleton exists to prevent.
  statInfinity: { height: 40, justifyContent: 'center' },
  statSkeleton: { marginVertical: 5 },
  tileLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute,
  },

  // ── Section headings ──
  section: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: space.xl, marginBottom: space.sm,
  },
  sectionLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2, color: colors.inkMute,
  },
  sectionRule: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.line, marginLeft: 2 },

  // ── The shelf ──
  shelf: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    backgroundColor: colors.goldSoft, padding: space.md, gap: space.md,
    ...th.elevation.card,
  },
  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shelfCount: {
    ...tabular, fontFamily: font.black, fontSize: type.display, lineHeight: leading.display,
    color: colors.goldText, letterSpacing: tracking.display,
  },
  shelfHeadText: { justifyContent: 'center' },
  shelfEarned: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.goldText,
  },
  shelfOf: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  shelfCta: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  shelfRow: { flexDirection: 'row', gap: 8 },
  disc: {
    width: DISC, height: DISC, borderRadius: DISC / 2,
    borderWidth: 2.5, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  discMore: {
    width: DISC, height: DISC, borderRadius: DISC / 2,
    borderWidth: 2.5, borderColor: colors.gold, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  discMoreText: { ...tabular, fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  discEmpty: {
    width: DISC, height: DISC, borderRadius: DISC / 2,
    borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', opacity: 0.75,
  },
  shelfEmpty: { gap: space.sm },
  shelfEmptyText: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft,
  },

  // ── The rows ──
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.surface, paddingVertical: 13, paddingHorizontal: 13,
    marginBottom: 9, ...th.elevation.card,
  },
  chip: {
    width: 40, height: 40, borderRadius: 13, ...curve,
    backgroundColor: colors.inkFaint, alignItems: 'center', justifyContent: 'center',
  },
  chipGold: { backgroundColor: colors.goldSoft },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: font.extrabold, fontSize: type.bodyLg, color: colors.ink,
    letterSpacing: tracking.bodyLg,
  },
  rowSub: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    letterSpacing: tracking.small, marginTop: 1,
  },
}));
