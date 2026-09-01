import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Lock } from '../icons';
import { Button } from '../Button';
import { track } from '../../services/analytics';
import { listReports, relTime, type ReportListItem } from '../../services/interview';
import { curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { makeStyles, useColors } from '../../theme/theme';

/**
 * What the Interview and Coaching segments show before a session exists.
 *
 * The locked panel is the reason both modes are visible to everyone rather than
 * hidden behind the plan. A hidden feature sells nothing: someone deciding
 * whether Max is worth twice the price has to be able to see what the money
 * buys, in the place they would use it. So the segment selects, and what it
 * selects is a sentence saying exactly what the mode is and a way to buy it.
 *
 * Neither panel is a "coming soon" card. Both modes are finished and running;
 * the only thing between the learner and them is the plan.
 */

const LOCKED = {
  interview: {
    title: 'Interview Mode',
    line: 'A live mock interview tuned to the job advert you paste in, scored answer by answer against the role.',
    foot: 'Other mock interviewers can tell you that you were weak on CAN arbitration. This one owns the lesson that fixes it, and sends you there.',
  },
  coaching: {
    title: 'Career coaching',
    line: 'A live coaching session built on what Ohmlet actually watched you build, not on what you say about yourself.',
    foot: 'It reads your bench minutes, your exam scores and your finished builds back to you, names the gap, and decides what to make next.',
  },
} as const;

/** The paid mode, explained and priced, for a learner who does not have it. */
export const ModeLocked: React.FC<{ mode: 'interview' | 'coaching' }> = ({ mode }) => {
  const colors = useColors();
  const s = useS();
  const copy = LOCKED[mode];

  // The segment IS the paywall impression. Firing it here rather than on the
  // plans screen is the only way to know which mode did the selling.
  useEffect(() => { track('paywall_view', { surface: 'live_modes', mode }); }, [mode]);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <View style={s.lockCard}>
        <View style={s.lockBadge}>
          <Lock size={22} color={colors.goldText} />
        </View>
        <Text style={s.kicker}>MAX</Text>
        <Text style={s.lockTitle}>{copy.title}</Text>
        <Text style={s.lockLine}>{copy.line}</Text>
        {/* A tab switch, not a push: plans is a tab root, and the learner should
            land on it with the bar under them rather than stacked on top of a
            live screen they cannot see. */}
        <Button label="See Max" onPress={() => router.replace('/plans')} style={{ marginTop: space.md }} />
      </View>
      <Text style={s.lockFoot}>{copy.foot}</Text>
    </ScrollView>
  );
};

/**
 * The Interview segment for someone who has Max.
 *
 * It hands off to `/interview` rather than hosting the setup form here, because
 * an interview is a three phase machine (set it up, run it, read the report) and
 * exactly one screen has to own the transcript, or the same conversation gets
 * scored twice. What this panel owns is the doorway and the history.
 */
export const InterviewIntro: React.FC = () => {
  const colors = useColors();
  const s = useS();
  const [history, setHistory] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Reports live on the server, so they survive a reinstall. Failure is silent:
  // an interview with no past reports looks exactly like this, and an error
  // banner about the history would sit above a working "start" button.
  useEffect(() => {
    let alive = true;
    void listReports().then((r) => {
      if (!alive) return;
      if (r.ok) setHistory(r.data);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Text style={s.kicker}>INTERVIEW MODE</Text>
      <Text style={s.title}>A real interview, out loud.</Text>
      <Text style={s.body}>
        It reads the advert and your CV, drills the projects you actually built, plants the kind of
        fault a real interviewer would, then scores you answer by answer and sends every weakness to
        the lesson that closes it.
      </Text>

      <Button
        label="Set up an interview"
        onPress={() => router.push('/interview')}
        style={{ marginTop: space.lg }}
      />
      <Text style={s.hint}>
        Have the job advert to hand. The more you give it, the harder and more specific it gets.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.inkMute} style={{ marginTop: space.xl }} />
      ) : history.length > 0 ? (
        <>
          <Text style={s.section}>YOUR PAST INTERVIEWS</Text>
          {history.slice(0, 4).map((h) => (
            <Pressable
              key={h.id}
              onPress={() => router.push({ pathname: '/interview', params: { report: h.id } })}
              style={({ pressed }) => [s.past, pressed && s.pastDown]}
              accessibilityRole="button"
              accessibilityLabel={`Open the report for ${h.role || 'a mock interview'}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.pastRole} numberOfLines={1}>{h.role || 'Mock interview'}</Text>
                <Text style={s.pastMeta}>
                  {[h.seniority, relTime(h.createdAt)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {typeof h.overall === 'number' && (
                <Text style={[s.pastScore, tabular]}>{h.overall}/5</Text>
              )}
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
};

const useS = makeStyles((colors, th) => ({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xxl },

  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -0.8, marginTop: 4,
  },
  body: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    marginTop: space.md, lineHeight: 22,
  },
  hint: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute,
    marginTop: space.sm, lineHeight: 19,
  },

  // The sales card is the one raised object on its screen, so it gets the plate
  // treatment the rest of the panel does not: heavy outline, gold badge, lift.
  lockCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.lg, ...th.elevation.lifted,
  },
  lockBadge: {
    width: 44, height: 44, borderRadius: 14, ...curve,
    backgroundColor: colors.goldSoft, borderWidth: 2, borderColor: colors.goldPlate,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.md,
  },
  lockTitle: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -0.6, marginTop: 2,
  },
  lockLine: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    marginTop: space.sm, lineHeight: 22,
  },
  lockFoot: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.lg, lineHeight: 20,
  },

  section: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5,
    color: colors.inkMute, marginTop: space.xl, marginBottom: space.sm,
  },
  past: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.md, marginBottom: space.sm,
  },
  pastDown: { transform: [{ translateY: 2 }], borderColor: colors.inkMute },
  pastRole: { fontFamily: font.extrabold, fontSize: type.label, color: colors.ink },
  pastMeta: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute, marginTop: 1 },
  pastScore: { fontFamily: font.black, fontSize: type.heading, color: colors.goldText },
}));
