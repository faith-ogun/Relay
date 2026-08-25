import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { goBack } from '../../services/nav';
import { getManifest, type CurriculumUnit } from '../../services/curriculum';
import { colors, font, radius, space, type, curve } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';

export default function UnitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [unit, setUnit] = useState<CurriculumUnit | null>(null);
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

  const lessonTotal = useMemo(
    () => unit?.skills.reduce((n, s) => n + s.lessons.length, 0) ?? 0,
    [unit],
  );

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
      <Text style={s.meta}>{unit.skills.length} skills · {lessonTotal} lessons</Text>

      {unit.skills.map((skill, si) => (
        <View key={skill.id} style={s.skill}>
          <Text style={s.skillTitle}>{si + 1}. {skill.title}</Text>
          {skill.lessons.map((lesson) => (
            <Pressable
              key={lesson.id}
              style={s.lesson}
              onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Lesson: ${lesson.title}`}
            >
              <View style={s.dot} />
              <View style={{ flex: 1 }}>
                <Text style={s.lessonTitle}>{lesson.title}</Text>
                {!!lesson.summary && <Text style={s.lessonSummary}>{lesson.summary}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      ))}
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
  meta: { fontFamily: font.extrabold, fontSize: type.meta, letterSpacing: 1, color: colors.inkSoft, marginTop: space.sm, marginBottom: space.lg },
  skill: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, padding: space.md, marginBottom: space.md, ...elevation.card,
  },
  skillTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink, marginBottom: space.sm },
  lesson: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line,
  },
  dot: {
    width: 10, height: 10, borderRadius: 3, ...curve, backgroundColor: colors.gold,
    borderWidth: 1.5, borderColor: colors.ink, marginTop: 5,
    transform: [{ rotate: '45deg' }],
  },
  lessonTitle: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  lessonSummary: { fontFamily: font.regular, fontSize: type.meta, color: colors.inkSoft, marginTop: 2, lineHeight: 16 },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  back: { marginTop: space.md, paddingVertical: space.sm },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
});
