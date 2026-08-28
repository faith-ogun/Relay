import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Close } from '../components/icons';
import { Button } from '../components/Button';
import { fetchCareer, type CareerEvidence } from '../services/labs';
import { goBack } from '../services/nav';
import { colors, curve, font, radius, space, tabular, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';

/**
 * The verified build record.
 *
 * Every hardware CV claims bench experience and every interviewer discounts it,
 * because there is no way to check. This is the screen that changes that: it
 * shows what Ohmlet actually WATCHED happen, and the number that matters most is
 * the one nobody else can produce, which is minutes with the camera genuinely
 * open on a real bench.
 *
 * Two rules this screen obeys, and they are the same rules the coach obeys:
 *
 *   It never flatters. Ten minutes reads as ten minutes. There is no adjective
 *   anywhere on this screen, because "solid hands-on experience" is a claim the
 *   learner would have to defend in an interview and could not.
 *
 *   The caveat is shown, not buried. Every figure is a FLOOR, and someone about
 *   to put it in front of an employer needs to know that as prominently as they
 *   know the number.
 */
export default function Career() {
  const [ev, setEv] = useState<CareerEvidence | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchCareer().then((r) => {
      if (!alive) return;
      if (r.ok) setEv(r.data);
      else setFailure(
        r.reason === 'upgrade_required'
          ? 'Career coaching is part of Max.'
          : r.reason === 'offline' || r.reason === 'timeout'
            ? 'Your record lives on the server, so this needs a connection.'
            : 'Your record could not be loaded just now.',
      );
    });
    return () => { alive = false; };
  }, []);

  if (failure) {
    return (
      <View style={s.screen}>
        <Head />
        <View style={s.centre}>
          <Text style={s.failTitle}>Not right now</Text>
          <Text style={s.body}>{failure}</Text>
          {failure.includes('Max') && (
            <Button label="See Max" onPress={() => router.push('/plans')} style={{ marginTop: space.lg }} />
          )}
        </View>
      </View>
    );
  }

  if (!ev) {
    return (
      <View style={s.screen}>
        <Head />
        <View style={s.centre}><ActivityIndicator color={colors.ink} /></View>
      </View>
    );
  }

  const nothingYet = ev.bench.cameraMinutes === 0 && ev.assessed.unitsCleared === 0 && ev.artifacts.twins === 0;

  return (
    <View style={s.screen}>
      <Head />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.lead}>
          What Ohmlet watched you do. Not what you say you did, which is the part
          an interviewer has no way to check.
        </Text>

        {nothingYet ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Nothing verified yet</Text>
            <Text style={s.body}>
              One live session with the camera on is the whole first step. That is
              the number nobody can produce for you.
            </Text>
            <Button label="Start a session" onPress={() => router.replace('/live')} style={{ marginTop: space.md }} />
          </View>
        ) : (
          <>
            {/* The headline, and the only figure a competitor cannot produce. */}
            <View style={s.hero}>
              <Text style={s.heroValue}>{ev.bench.cameraMinutes}</Text>
              <Text style={s.heroUnit}>minutes at a real bench</Text>
              <Text style={s.heroSub}>
                camera open, across {ev.bench.cameraSessions} session{ev.bench.cameraSessions === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={s.grid}>
              <Cell value={`${ev.assessed.unitsCleared}/${ev.assessed.unitsTotal}`} label="unit exams passed" />
              <Cell value={ev.assessed.meanScore ? `${ev.assessed.meanScore}%` : '-'} label="mean exam score" />
              <Cell value={`${ev.artifacts.twins}`} label="builds captured in 3D" />
              <Cell value={`${ev.learning.gold}`} label="lessons drilled to Gold" />
            </View>

            {ev.assessed.strongest.length > 0 && (
              <>
                <Text style={s.section}>STRONGEST, BY EXAM</Text>
                {ev.assessed.strongest.map((u) => (
                  <View key={u.unitId} style={s.row}>
                    <Text style={s.rowTitle} numberOfLines={1}>{u.title}</Text>
                    <Text style={[s.rowScore, tabular]}>{u.score}%</Text>
                  </View>
                ))}
              </>
            )}

            {ev.assessed.attemptedNotCleared.length > 0 && (
              <>
                <Text style={s.section}>MET, NOT YET CLEARED</Text>
                <Text style={s.sectionNote}>
                  The most useful thing on this page. You already know where these are.
                </Text>
                {ev.assessed.attemptedNotCleared.map((u) => (
                  <Pressable
                    key={u.unitId}
                    onPress={() => router.replace('/home')}
                    style={({ pressed }) => [s.row, s.rowOpen, pressed && s.rowDown]}
                    accessibilityRole="button"
                    accessibilityLabel={`Go back to ${u.title}`}
                  >
                    <Text style={s.rowTitle} numberOfLines={1}>{u.title}</Text>
                    <Text style={[s.rowScore, { color: colors.red }, tabular]}>{u.score}%</Text>
                  </Pressable>
                ))}
              </>
            )}

            <Text style={s.section}>THE LINE YOU CAN DEFEND</Text>
            <View style={s.quote}>
              <Text style={s.quoteText}>{ev.summary}</Text>
            </View>
            <Button
              label="Copy for a CV"
              variant="secondary"
              onPress={() => void Share.share({ message: ev.summary })}
            />

            {/* The record is the input to the conversation, not the end of it.
                Ash reads this back honestly, names the gap, and decides what to
                build next. */}
            <Text style={s.section}>TALK IT THROUGH</Text>
            <Button
              label="Start a coaching session"
              onPress={() => router.push({ pathname: '/live', params: { mode: 'coach' } })}
            />
          </>
        )}

        {/* Shown, never buried: every figure above is a floor. */}
        <View style={s.caveat}>
          <Text style={s.caveatLabel}>READ THIS BEFORE YOU QUOTE IT</Text>
          <Text style={s.caveatText}>{ev.caveat}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const Head: React.FC = () => (
  <View style={s.head}>
    <Pressable onPress={() => goBack('/profile')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
      <Close size={22} />
    </Pressable>
    <View style={{ flex: 1 }}>
      <Text style={s.kicker}>VERIFIED BY OHMLET</Text>
      <Text style={s.title}>Your build record</Text>
    </View>
  </View>
);

const Cell: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={s.cell}>
    <Text style={[s.cellValue, tabular]}>{value}</Text>
    <Text style={s.cellLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm,
  },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.inkMute },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -1 },
  scroll: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },

  lead: { fontFamily: font.bold, fontSize: type.label, color: colors.inkSoft, lineHeight: 22 },
  body: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  failTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },

  empty: {
    backgroundColor: colors.white, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.lg, alignItems: 'center', gap: space.sm,
  },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },

  hero: {
    backgroundColor: colors.ink, borderRadius: radius.lg, ...curve,
    borderWidth: 3, borderColor: colors.gold, padding: space.lg, alignItems: 'center', ...elevation.card,
  },
  heroValue: { fontFamily: font.black, fontSize: 64, color: colors.gold, letterSpacing: -2, ...tabular },
  heroUnit: { fontFamily: font.black, fontSize: type.body, color: colors.white, marginTop: -6 },
  heroSub: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute, marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: colors.white,
    borderRadius: radius.md, ...curve, borderWidth: 2, borderColor: colors.line,
    padding: space.md, gap: 2,
  },
  cellValue: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -1 },
  cellLabel: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft },

  section: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.inkMute, marginTop: space.md },
  sectionNote: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: -6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: 12,
  },
  rowOpen: { borderColor: colors.ink },
  rowDown: { transform: [{ translateY: 2 }] },
  rowTitle: { flex: 1, fontFamily: font.bold, fontSize: type.label, color: colors.ink },
  rowScore: { fontFamily: font.black, fontSize: type.label, color: colors.greenDeep },

  quote: {
    backgroundColor: colors.goldSoft, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.goldPlate, padding: space.md,
  },
  quoteText: { fontFamily: font.bold, fontSize: type.label, color: colors.ink, lineHeight: 22 },

  caveat: {
    marginTop: space.lg, borderTopWidth: 2, borderTopColor: colors.line, paddingTop: space.md, gap: 4,
  },
  caveatLabel: { fontFamily: font.black, fontSize: 9, letterSpacing: 1.4, color: colors.red },
  caveatText: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, lineHeight: 19 },
});
