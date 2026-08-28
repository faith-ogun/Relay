import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Close } from '../components/icons';
import { Button } from '../components/Button';
import { InterviewReport } from '../components/InterviewReport';
import { usePlan } from '../hooks/usePlan';
import {
  generateReport, getReport, listReports, relTime,
  type InterviewContext, type InterviewReport as Report, type ReportListItem,
} from '../services/interview';
import { beginInterview, clearInterview, takeFinishedInterview, MIN_TURNS_TO_SCORE } from '../services/interviewSession';
import { track } from '../services/analytics';
import { goBack } from '../services/nav';
import { colors, curve, font, radius, space, tabular, type } from '../theme/tokens';

/**
 * Interview Mode.
 *
 * Three phases on one screen: set it up, go and do it in the live session, come
 * back and read what it found. The interview itself runs on `/live` because it
 * is the same camera, microphone and socket a tutoring session uses, on a
 * different persona. Duplicating that here to own the flow would mean two
 * copies of the hardest code in the app.
 *
 * What separates this from every other AI mock interview is the last phase. The
 * others can tell you that you were weak on CAN arbitration. None of them owns a
 * lesson about CAN arbitration. Every weakness here comes back matched against
 * the real curriculum, and where nothing matches, the report says so plainly
 * rather than leaving the learner to search for a lesson that is not written.
 */

const SENIORITY = [
  { id: 'intern', label: 'Intern' },
  { id: 'new grad', label: 'New grad' },
  { id: 'mid', label: 'Mid' },
  { id: 'senior', label: 'Senior' },
] as const;

type Phase = 'setup' | 'scoring' | 'report' | 'failed';

export default function Interview() {
  const plan = usePlan();
  const [phase, setPhase] = useState<Phase>('setup');
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState<string>('mid');
  const [jd, setJd] = useState('');
  const [cv, setCv] = useState('');
  const [warmup, setWarmup] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [failure, setFailure] = useState('');
  const [history, setHistory] = useState<ReportListItem[]>([]);
  const [openingPast, setOpeningPast] = useState(false);

  const isMax = plan.plan === 'max';

  // Past interviews live on the server, so they survive a reinstall and a new
  // phone. Failure here is silent on purpose: an empty history section is a
  // reasonable thing to see, and an error banner about it would be noise on top
  // of a screen whose actual job is to start an interview.
  useEffect(() => {
    if (!isMax) return;
    let alive = true;
    void listReports().then((r) => {
      if (alive && r.ok) setHistory(r.data);
    });
    return () => { alive = false; };
  }, [isMax]);

  // Coming back from the live session with a finished conversation. Taken once:
  // the same transcript must not be scored twice because someone navigated back.
  useFocusEffect(
    useCallback(() => {
      const done = takeFinishedInterview();
      if (!done) return;
      if (done.transcript.length < MIN_TURNS_TO_SCORE) {
        // Ended immediately. Nothing was said, so there is nothing to score, and
        // a report generated from silence would be a fabricated assessment.
        setPhase('setup');
        return;
      }
      setPhase('scoring');
      void generateReport(done.transcript, done.ctx).then((r) => {
        if (r.ok) {
          setReport(r.data.report);
          setPhase('report');
          track('interview_complete', { overall: r.data.report.overall, warmup: !!done.ctx.warmup });
          void listReports().then((h) => { if (h.ok) setHistory(h.data); });
        } else {
          setFailure(
            r.reason === 'offline' || r.reason === 'timeout'
              ? 'Your interview finished, but the report needs a connection. Try again in a moment and nothing is lost.'
              : r.reason === 'upgrade_required'
                ? 'Interview Mode is part of Max.'
                : 'The report could not be written just now. Your interview was not wasted, so try again.',
          );
          setPhase('failed');
        }
      });
    }, []),
  );

  const start = useCallback(() => {
    const ctx: InterviewContext = {
      role: role.trim() || undefined,
      seniority,
      jobDescription: jd.trim() || undefined,
      resume: cv.trim() || undefined,
      warmup,
    };
    beginInterview(ctx);
    track('interview_start', { seniority, warmup, hasJd: !!ctx.jobDescription, hasCv: !!ctx.resume });
    router.push({ pathname: '/live', params: { mode: 'interview' } });
  }, [role, seniority, jd, cv, warmup]);

  const openPast = useCallback((id: string) => {
    setOpeningPast(true);
    void getReport(id).then((r) => {
      setOpeningPast(false);
      if (r.ok) { setReport(r.data.report); setPhase('report'); }
    });
  }, []);

  const retry = useCallback(() => {
    clearInterview();
    setReport(null);
    setPhase('setup');
  }, []);

  // ── Max gate. The server refuses the session regardless, so this exists to
  //    explain rather than to enforce. ──
  if (plan.loading) {
    return <Shell><View style={s.centre}><ActivityIndicator color={colors.ink} /></View></Shell>;
  }

  if (!isMax) {
    return (
      <Shell>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.gate}>
            <Text style={s.gateTitle}>Interview Mode is part of Max</Text>
            <Text style={s.gateBody}>
              A live mock interview tuned to the job you are actually applying
              for. It reads the advert, drills your real projects, and plants the
              kind of fault a real interviewer would, then scores you answer by
              answer and sends every weakness to the lesson that closes it.
            </Text>
            <Button label="See Max" onPress={() => router.push('/plans')} style={{ marginTop: space.md }} />
          </View>
        </ScrollView>
      </Shell>
    );
  }

  if (phase === 'scoring') {
    return (
      <Shell>
        <View style={s.centre}>
          <ActivityIndicator color={colors.ink} />
          <Text style={s.scoringTitle}>Reading the whole conversation</Text>
          <Text style={s.body}>
            Every answer is scored against the role, not against a rubric, so this
            takes a moment longer than you might expect.
          </Text>
        </View>
      </Shell>
    );
  }

  if (phase === 'failed') {
    return (
      <Shell>
        <View style={s.centre}>
          <Text style={s.failTitle}>Not right now</Text>
          <Text style={s.body}>{failure}</Text>
          <Button label="Back to setup" onPress={retry} style={{ marginTop: space.lg }} />
        </View>
      </Shell>
    );
  }

  if (phase === 'report' && report) {
    return (
      <Shell title="Your feedback report">
        <InterviewReport report={report} onRetry={retry} onOpenPath={() => router.replace('/home')} />
      </Shell>
    );
  }

  return (
    <Shell>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.lead}>
            A real interview, out loud, for the job you are actually applying for.
            The more you give it, the harder and more specific it gets.
          </Text>

          <Text style={s.label}>THE ROLE</Text>
          <TextInput
            style={s.input}
            value={role}
            onChangeText={setRole}
            placeholder="Embedded Firmware Engineer"
            placeholderTextColor={colors.inkMute}
            accessibilityLabel="The role you are interviewing for"
            returnKeyType="done"
          />

          <Text style={s.label}>SENIORITY</Text>
          <View style={s.chips}>
            {SENIORITY.map((o) => {
              const on = seniority === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setSeniority(o.id)}
                  style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.chipDown]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={o.label}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.hint}>
            This decides how hard the planted faults are, not just the wording.
          </Text>

          <Text style={s.label}>THE JOB DESCRIPTION</Text>
          <TextInput
            style={[s.input, s.area]}
            value={jd}
            onChangeText={setJd}
            placeholder="Paste the advert so the questions come from what the role actually needs."
            placeholderTextColor={colors.inkMute}
            multiline
            textAlignVertical="top"
            accessibilityLabel="The job description"
          />

          <Text style={s.label}>YOUR CV</Text>
          <TextInput
            style={[s.input, s.area]}
            value={cv}
            onChangeText={setCv}
            placeholder="Paste your CV, and it will drill into your actual projects rather than asking generic questions."
            placeholderTextColor={colors.inkMute}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Your CV"
          />

          {/* A first round with the pressure off. Named honestly: it is a real
              interview with a gentler interviewer, not a different feature. */}
          <Pressable
            onPress={() => setWarmup(!warmup)}
            style={({ pressed }) => [s.toggle, warmup && s.toggleOn, pressed && s.chipDown]}
            accessibilityRole="switch"
            accessibilityState={{ checked: warmup }}
            accessibilityLabel="Warmup round"
          >
            <View style={[s.box, warmup && s.boxOn]}>
              {warmup && <View style={s.tick} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>Warmup round</Text>
              <Text style={s.toggleSub}>Same questions, gentler pressure. Still scored.</Text>
            </View>
          </Pressable>

          <Button label="Start the interview" onPress={start} style={{ marginTop: space.md }} />
          <Text style={s.hint}>
            Speak your answers. The interviewer will interrupt, follow up, and
            change tack if you are struggling, exactly as a person would.
          </Text>

          {history.length > 0 && (
            <>
              <Text style={s.section}>YOUR PAST INTERVIEWS</Text>
              {history.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => openPast(h.id)}
                  disabled={openingPast}
                  style={({ pressed }) => [s.past, pressed && s.chipDown]}
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

const Shell: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <View style={s.screen}>
    <View style={s.head}>
      <Pressable onPress={() => goBack('/profile')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
        <Close size={22} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>MAX</Text>
        <Text style={s.title}>{title ?? 'Interview Mode'}</Text>
      </View>
    </View>
    {children}
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
  scroll: { padding: space.lg, paddingBottom: space.xxl, gap: space.sm },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },

  lead: { fontFamily: font.bold, fontSize: type.label, color: colors.inkSoft, lineHeight: 22 },
  body: { fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  hint: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute, lineHeight: 18 },
  label: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.8, color: colors.inkMute, marginTop: space.md },
  section: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.8, color: colors.inkMute, marginTop: space.xl },

  input: {
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.md,
    fontFamily: font.semibold, fontSize: type.label, color: colors.ink,
  },
  area: { minHeight: 108, lineHeight: 21 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDown: { transform: [{ translateY: 1 }] },
  chipText: { fontFamily: font.extrabold, fontSize: type.small, color: colors.inkSoft },
  chipTextOn: { color: colors.white },

  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md,
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.md,
  },
  toggleOn: { borderColor: colors.ink },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2.5, borderColor: colors.inkMute,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tick: { width: 9, height: 9, borderRadius: 2, backgroundColor: colors.gold },
  toggleTitle: { fontFamily: font.extrabold, fontSize: type.label, color: colors.ink },
  toggleSub: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 1 },

  gate: {
    backgroundColor: colors.white, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.lg, gap: space.sm,
  },
  gateTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, letterSpacing: -0.5 },
  gateBody: { fontFamily: font.semibold, fontSize: type.label, color: colors.inkSoft, lineHeight: 22 },

  scoringTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: space.sm },
  failTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },

  past: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.md,
  },
  pastRole: { fontFamily: font.extrabold, fontSize: type.label, color: colors.ink },
  pastMeta: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute, marginTop: 1 },
  pastScore: { fontFamily: font.black, fontSize: type.heading, color: colors.goldText },
});
