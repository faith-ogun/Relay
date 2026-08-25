import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Localization from 'expo-localization';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import {
  assessAge, CHILD_MODE_ENABLED, EARLIEST_BIRTH_YEAR, LATEST_BIRTH_YEAR, consentAgeFor,
} from '../services/ageModel';
import { submitAge } from '../services/gates';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';

/**
 * Age assurance.
 *
 * Neutral by construction: it asks for a birth year and nothing else, with no
 * copy anywhere hinting which answer unlocks the app. A screen that says "you
 * must be 16" teaches the number to type, which is worse than not asking.
 *
 * A birth YEAR rather than a full date of birth, because the year answers the
 * question and a full date is more personal data than the question needs.
 *
 * The consent age is per country: 16 in Ireland and Germany, 13 in the UK and
 * US, and so on. Those are legal thresholds, so the model is shared with the web
 * app rather than restated here.
 *
 * The real gate on the live tutor is a server-side custom claim. Nothing on this
 * screen can be edited to unlock it.
 */
export default function AgeGate() {
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();
  const country = (Localization.getLocales()[0]?.regionCode ?? 'IE').toUpperCase();

  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
      return () => undefined;
    }, [fade]),
  );

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = LATEST_BIRTH_YEAR(thisYear); y >= EARLIEST_BIRTH_YEAR(thisYear); y -= 1) out.push(y);
    return out;
  }, [thisYear]);

  const submit = async () => {
    if (year === null || !user?.uid) return;
    setBusy(true);
    const assessment = assessAge(year, country, thisYear);
    await submitAge(user.uid, year, country, assessment);
    setBusy(false);

    if (!assessment.isMinor) {
      router.replace('/home');
      return;
    }
    // A minor, and child mode is not open yet. Saying so plainly is the only
    // honest option: the alternative is letting them in without the protections
    // the law requires, which is the thing the gate exists to prevent.
    setBlocked(true);
  };

  if (blocked) {
    return (
      <View style={s.screen}>
        <View style={s.blockedBody}>
          <Image
            source={require('../../assets/brand/mascot-point.png')}
            style={s.mascot}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel=""
          />
          <Text style={s.blockedTitle}>Not quite yet</Text>
          <Text style={s.blockedBodyText}>
            Ohmlet is not open to under-{consentAgeFor(country)}s in your country yet. We are
            building it properly, with a parent or guardian involved, and we would rather wait than
            get that part wrong.
          </Text>
          <Text style={s.blockedBodyText}>
            Ask a parent or guardian to email hello@ohmlet.org and we will let you know the moment
            it opens.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Animated.View style={[s.head, { opacity: fade }]}>
        <Text style={s.kicker}>ONE QUESTION</Text>
        <Text style={s.title}>What year were you born?</Text>
        <Text style={s.sub}>
          We ask so we apply the right privacy rules for where you are. Just the year, and we do not
          share it.
        </Text>
      </Animated.View>

      <ScrollView style={s.list} contentContainerStyle={s.listInner} showsVerticalScrollIndicator={false}>
        {years.map((y) => {
          const on = y === year;
          return (
            <Pressable
              key={y}
              onPress={() => setYear(y)}
              style={[s.year, on && s.yearOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={String(y)}
            >
              <Text style={[s.yearText, on && s.yearTextOn]}>{y}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <Button label={busy ? 'Just a moment' : 'Continue'} onPress={submit} disabled={year === null || busy} />
        {!CHILD_MODE_ENABLED && (
          <Text style={s.note}>
            Ohmlet is currently for ages {consentAgeFor(country)} and over.
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: space.sm },
  head: { paddingHorizontal: space.lg },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep },
  title: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -0.6, marginTop: 6, lineHeight: type.title * 1.15,
  },
  sub: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.sm, lineHeight: 20,
  },
  list: { flex: 1, marginTop: space.lg },
  listInner: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: 8 },
  year: {
    borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, paddingVertical: 14, alignItems: 'center',
  },
  yearOn: { borderColor: colors.ink, backgroundColor: colors.goldSoft, ...pressSmall },
  yearText: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  yearTextOn: { fontFamily: font.black },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm, gap: space.sm },
  note: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, textAlign: 'center',
  },

  blockedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, gap: space.md },
  mascot: { width: 140, height: 140 },
  blockedTitle: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -0.5 },
  blockedBodyText: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 23,
  },
});
