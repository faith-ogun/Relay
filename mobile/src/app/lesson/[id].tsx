import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getLesson, type LessonContent } from '../../services/curriculum';
import { colors, font, pressSmall, radius, space, type } from '../../theme/tokens';

/**
 * Lesson shell. The full Duolingo-style run loop (15-question runs, hearts,
 * wrong-answer requeue, the drawing rail) is the next increment; this proves the
 * content path end to end — backend to cache to screen — and shows what a
 * learner will actually be stepping through.
 */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getLesson(String(id))
      .then((c) => alive && setContent(c))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;

  if (!content) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Couldn't load this lesson</Text>
        <Text style={s.emptyBody}>It may need a connection the first time you open it.</Text>
        <Pressable onPress={() => router.back()} style={s.back}><Text style={s.backText}>Go back</Text></Pressable>
      </View>
    );
  }

  const steps = (content.lesson.steps ?? []) as Array<{ type: string; title?: string; question?: string; statement?: string; instruction?: string; prompt?: string }>;

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => router.back()} style={s.backLink}>
        <Text style={s.backLinkText}>‹ Back</Text>
      </Pressable>

      <Text style={s.eyebrow}>LESSON</Text>
      <Text style={s.title}>{content.id}</Text>
      <Text style={s.meta}>{steps.length} steps · {content.lesson.xpReward} XP</Text>

      {steps.map((step, i) => (
        <View key={i} style={s.step}>
          <Text style={s.stepType}>{step.type.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={s.stepText}>
            {step.title ?? step.question ?? step.statement ?? step.instruction ?? step.prompt ?? '—'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: space.xl },
  scroll: { padding: space.lg, paddingTop: space.xxl * 1.2, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm },
  backLinkText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -0.6, marginTop: 4 },
  meta: { fontFamily: font.extrabold, fontSize: type.meta, letterSpacing: 1, color: colors.inkSoft, marginTop: 6, marginBottom: space.lg },
  step: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line,
    borderRadius: radius.md, padding: space.md, marginBottom: space.sm,
  },
  stepType: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.5, color: colors.blueDeep },
  stepText: { fontFamily: font.semibold, fontSize: type.small, color: colors.ink, marginTop: 4, lineHeight: 20 },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, textAlign: 'center', marginTop: space.sm },
  back: { marginTop: space.md, paddingVertical: space.sm },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
});
