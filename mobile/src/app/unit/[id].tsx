import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { goBack } from '../../services/nav';
import { getManifest, type CurriculumUnit } from '../../services/curriculum';
import { UnitPath } from '../../components/path/UnitPath';
import { loadProgress } from '../../services/progress';
import { useAuth } from '../../hooks/useAuth';
import { track } from '../../services/analytics';
import { colors, font, space, type, curve, tabular } from '../../theme/tokens';

export default function UnitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [unit, setUnit] = useState<CurriculumUnit | null>(null);
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getManifest()
      .then((m) => {
        if (!alive) return;
        setUnit(m?.units.find((u) => u.id === id) ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    let alive = true;
    if (!user?.uid) return;
    void loadProgress(user.uid).then((p) => {
      if (alive) setCompleted(new Set(Object.keys(p.lessonLevels)));
    });
    return () => { alive = false; };
  }, [user?.uid]);

  const lessonTotal = useMemo(
    () => unit?.skills.reduce((n, s) => n + s.lessons.length, 0) ?? 0,
    [unit],
  );

  const doneCount = useMemo(
    () => unit?.skills.reduce(
      (n, sk) => n + sk.lessons.filter((l) => completed.has(l.id)).length, 0) ?? 0,
    [unit, completed],
  );
  const donePct = lessonTotal ? doneCount / lessonTotal : 0;

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  if (!unit) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Unit not found</Text>
        <Pressable onPress={() => goBack('/path')} style={s.back} accessibilityRole="button">
          <Text style={s.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => goBack('/path')} style={s.backLink} accessibilityRole="button">
        <Text style={s.backLinkText}>‹ Learning path</Text>
      </Pressable>

      <Text style={s.eyebrow}>{unit.level.toUpperCase()}</Text>
      <Text style={s.title}>{unit.title}</Text>
      <Text style={s.sub}>{unit.subtitle}</Text>

      {/* Progress as a bar, not a sentence. "6 of 12" is a fact; a filled bar is
          a position, and position is what someone opening a unit is looking for. */}
      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(donePct * 100)}%` }]} />
        </View>
        <Text style={s.progressText}>{doneCount} / {lessonTotal}</Text>
      </View>

      <UnitPath
        unit={unit}
        completed={completed}
        onStart={(lessonId) => {
          track('lesson_start', { lessonId, unitId: unit.id });
          router.push({ pathname: '/lesson/[id]', params: { id: lessonId } });
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: space.xl },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, marginBottom: space.xs },
  backLinkText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -0.6, marginTop: 4 },
  sub: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: 6, lineHeight: 22 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.md, marginBottom: space.xl,
  },
  progressTrack: {
    flex: 1, height: 14, borderRadius: 7, ...curve, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.ink, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.gold },
  progressText: { fontFamily: font.black, fontSize: type.small, color: colors.ink, ...tabular },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  back: { marginTop: space.md, paddingVertical: space.sm },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
});
