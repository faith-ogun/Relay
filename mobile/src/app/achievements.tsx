import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Lock } from '../components/icons';
import { goBack } from '../services/nav';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { useAuth } from '../hooks/useAuth';
import {
  getAchievements, isEarned, progressOf, TIER_COLOR, TIER_LABEL, UNTRACKED,
  type Achievement, type Tier,
} from '../services/achievements';
import { achievementStats, EMPTY, loadProgress, type Progress, type ServerStats } from '../services/progress';
import { fetchCommunityStats } from '../services/community';
import { getManifest } from '../services/curriculum';
import { colors, font, radius, space, type, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';

export default function Achievements() {
  const { user } = useAuth();
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [units, setUnits] = useState(0);
  const [open, setOpen] = useState<Achievement | null>(null);
  const [server, setServer] = useState<ServerStats | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [list, prog, manifest, stats] = await Promise.all([
        getAchievements(),
        user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
        getManifest(),
        // Community stats are a bonus, not a gate: the screen renders from
        // local progress if the call fails, rather than blocking on the network.
        user?.uid ? fetchCommunityStats() : Promise.resolve(null),
      ]);
      if (!alive) return;
      setItems(list);
      setProgress(prog);
      if (stats && stats.ok) setServer(stats.data);
      // A unit counts as complete when every lesson under it is done.
      if (manifest) {
        const done = new Set(Object.keys(prog.lessonLevels));
        setUnits(manifest.units.filter((u) =>
          u.skills.every((sk) => sk.lessons.every((l) => done.has(l.id)))).length);
      }
    })();
    return () => { alive = false; };
  }, [user?.uid]);

  const stats = useMemo(() => achievementStats(progress, units, server), [progress, units, server]);

  const ordered = useMemo(() => {
    if (!items) return [];
    return [...items]
      .map((a) => ({ a, earned: isEarned(a, stats), pct: progressOf(a, stats) }))
      .sort((x, y) => (x.earned === y.earned ? y.pct - x.pct : x.earned ? -1 : 1));
  }, [items, stats]);

  const earnedCount = ordered.filter((o) => o.earned).length;

  if (!items) {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => goBack('/home')} style={s.backLink} accessibilityRole="button">
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <Text style={s.eyebrow}>TROPHY CASE</Text>
      <Text style={s.title}>Achievements</Text>
      <Text style={s.sub}>{earnedCount} of {items.length} unlocked</Text>

      <View style={s.grid}>
        {ordered.map(({ a, earned, pct }) => (
          <Card key={a.id} a={a} earned={earned} pct={pct} onPress={() => setOpen(a)} />
        ))}
      </View>

      {/* Detail sheet: the back-text is the reward for earning it, so it stays
          hidden until the card is unlocked. */}
      {open && (
        <Pressable style={s.sheetBackdrop} onPress={() => setOpen(null)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={[s.sheetTier, { backgroundColor: TIER_COLOR[open.tier as Tier] }]}>
              <Text style={s.sheetTierText}>{TIER_LABEL[open.tier as Tier]?.toUpperCase()}</Text>
            </View>
            <Text style={s.sheetTitle}>{open.title}</Text>
            <Text style={s.sheetDesc}>{open.desc}</Text>
            {isEarned(open, stats) ? (
              <Text style={s.sheetBack}>{open.backText}</Text>
            ) : (
              <Text style={s.sheetLocked}>
                {UNTRACKED.has(open.metric)
                  ? 'Progress on this one is tracked on the community side and is not shown here yet.'
                  : `${stats[open.metric] ?? 0} of ${open.threshold}`}
              </Text>
            )}
            <Text style={s.sheetRarity}>About {open.rarity}% of learners hold this.</Text>
            <Pressable onPress={() => setOpen(null)} style={s.sheetClose}>
              <Text style={s.sheetCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </ScrollView>
  );
}

const RING = 30;

const Card: React.FC<{ a: Achievement; earned: boolean; pct: number; onPress: () => void }> = ({
  a, earned, pct, onPress,
}) => {
  const tint = TIER_COLOR[a.tier as Tier] ?? colors.line;
  const circumference = 2 * Math.PI * (RING - 4);
  // The artwork is the reward. It was declared on the type and never rendered,
  // so every medal was a flat coloured disc. If a file is missing or the network
  // is down the disc is still there underneath, so the grid degrades to what it
  // used to be rather than to a hole.
  const [artOk, setArtOk] = useState(true);
  const showArt = !!a.art && artOk;
  return (
    <Pressable
      onPress={onPress}
      style={[s.card, earned && { borderColor: colors.ink, ...elevation.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${a.title}. ${earned ? 'Unlocked' : `Locked, ${Math.round(pct * 100)} percent`}`}
    >
      <View style={s.medalWrap}>
        <Svg width={RING * 2} height={RING * 2}>
          <Circle cx={RING} cy={RING} r={RING - 4} stroke={colors.line} strokeWidth={4} fill="none" />
          {!earned && pct > 0 && (
            <Circle
              cx={RING} cy={RING} r={RING - 4} stroke={colors.gold} strokeWidth={4} fill="none"
              strokeDasharray={`${circumference * pct} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING} ${RING})`}
            />
          )}
          <Circle cx={RING} cy={RING} r={RING - 11} fill={earned ? tint : colors.cream} />
        </Svg>
        {showArt && (
          <Image
            source={{ uri: a.art }}
            style={[s.art, !earned && s.artLocked]}
            contentFit="contain"
            transition={180}
            cachePolicy="disk"
            onError={() => setArtOk(false)}
            accessible={false}
          />
        )}
        {!earned && <View style={s.lock}><Lock size={16} /></View>}
      </View>
      <Text style={[s.cardTitle, !earned && s.cardTitleLocked]} numberOfLines={2}>{a.title}</Text>
      <Text style={s.cardTier}>{TIER_LABEL[a.tier as Tier]}</Text>
    </Pressable>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: 4, marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    width: '31%', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line,
    borderRadius: radius.md, ...curve, padding: space.sm, alignItems: 'center',
  },
  medalWrap: { alignItems: 'center', justifyContent: 'center' },
  art: { position: 'absolute', width: RING * 1.5, height: RING * 1.5 },
  // Locked art is present but drained, so the grid reads as a case with gaps
  // to fill rather than a wall of identical grey discs.
  artLocked: { opacity: 0.28 },
  lock: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  cardTitle: {
    fontFamily: font.black, fontSize: type.meta, color: colors.ink,
    textAlign: 'center', marginTop: 6, lineHeight: 14,
  },
  cardTitleLocked: { color: colors.inkSoft },
  cardTier: { fontFamily: font.bold, fontSize: 9, color: colors.inkSoft, marginTop: 2, letterSpacing: 0.5 },
  sheetBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(20,24,31,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, padding: space.lg, width: '100%', ...elevation.card,
  },
  sheetTier: { alignSelf: 'flex-start', borderRadius: 999, ...curve, paddingHorizontal: 10, paddingVertical: 3 },
  sheetTierText: { fontFamily: font.black, fontSize: 9, color: colors.ink, letterSpacing: 1 },
  sheetTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: space.sm },
  sheetDesc: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4 },
  sheetBack: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.ink,
    marginTop: space.md, lineHeight: 20, fontStyle: 'italic',
  },
  sheetLocked: { fontFamily: font.black, fontSize: type.body, color: colors.goldDeep, marginTop: space.md },
  sheetRarity: { fontFamily: font.regular, fontSize: type.meta, color: colors.inkSoft, marginTop: space.sm },
  sheetClose: { marginTop: space.md, alignSelf: 'center', paddingVertical: space.sm },
  sheetCloseText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
});
