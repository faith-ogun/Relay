import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { getManifest, type CurriculumUnit, type Manifest } from '../services/curriculum';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';

const TINT: Record<CurriculumUnit['accent'], string> = {
  gold: colors.goldSoft,
  blue: colors.blueSoft,
  green: '#eef7e0',
  red: '#fdece8',
};

export default function LearningPath() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getManifest((fresh) => alive && setManifest(fresh))
      .then((m) => {
        if (!alive) return;
        setManifest(m);
        setFailed(!m);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

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
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Text style={s.eyebrow}>LEARNING PATH</Text>
      <Text style={s.title}>Everything you'll learn.</Text>
      <Text style={s.sub}>
        {manifest.units.length} units, {totalLessons} lessons, in the order they unlock.
      </Text>

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
  );
}

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
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft,
    marginTop: 6, marginBottom: space.lg,
  },
  unit: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg,
    padding: space.lg, marginBottom: space.md, ...pressSmall,
  },
  unitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.ink,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  numberText: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  levelPill: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999,
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
