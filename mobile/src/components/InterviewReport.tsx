import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from './Button';
import type { InterviewReport as Report } from '../services/interview';
import { curve, font, radius, space, tabular, type, type Colors } from '../theme/tokens';
import { makeStyles, useColors, withAlpha } from '../theme/theme';

/**
 * The post-interview report.
 *
 * The whole feature lands here. Everything else, the persona, the planted
 * faults, the resume, exists so that this page can say something true and
 * specific about how someone would actually do.
 *
 * Three rules it obeys:
 *
 *   Never a cold verdict. Every score is followed by why, and by the answer that
 *   would have been stronger. A number with no reasoning teaches nothing.
 *
 *   Weaknesses route to a lesson. The server matches each one against the real
 *   curriculum. This is the part no other mock interviewer can do: they can tell
 *   you that you were weak on CAN arbitration, and none of them owns a lesson
 *   about CAN arbitration.
 *
 *   Where nothing routes, it says so. Being told you are weak on something and
 *   quietly given nowhere to go is worse than being told plainly that the lesson
 *   is not written yet.
 */

const bandColor = (n: number, colors: Colors) =>
  (n >= 4 ? colors.greenDeep : n >= 3 ? colors.goldDeep : colors.red);

const Bar: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const colors = useColors();
  const s = useS();
  return (
    <View style={s.bar}>
      <View style={s.barHead}>
        <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
        <Text style={[s.barScore, tabular]}>{score}/5</Text>
      </View>
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            { width: `${Math.max(0, Math.min(5, score)) * 20}%`, backgroundColor: bandColor(score, colors) },
          ]}
        />
      </View>
    </View>
  );
};

interface Props {
  report: Report;
  /** Practise another round. */
  onRetry: () => void;
  onOpenPath: () => void;
}

export const InterviewReport: React.FC<Props> = ({ report: r, onRetry, onOpenPath }) => {
  const s = useS();
  const topics = r.recommendedTopics ?? [];
  const covered = topics.filter((t) => t.covered && t.skillId);
  const uncovered = [
    ...(r.uncoveredTopics ?? []),
    ...topics.filter((t) => !t.covered).map((t) => t.topic),
  ].filter((t, i, all) => !!t && all.indexOf(t) === i);

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {/* Readiness. The headline is the single thing that would most hold them
          back, which is the sentence they came for. */}
      <View style={s.hero}>
        <View style={s.heroHead}>
          <Text style={s.heroKicker}>INTERVIEW READINESS</Text>
          <View style={s.heroPill}>
            <Text style={s.heroPillText}>{r.readiness?.level ?? '-'}</Text>
          </View>
        </View>
        <Text style={s.heroLabel}>WHAT WOULD MOST HOLD YOU BACK</Text>
        <Text style={s.heroHeadline}>{r.readiness?.headline}</Text>
        {!!r.readiness?.summary && <Text style={s.heroSummary}>{r.readiness.summary}</Text>}
        <View style={s.overall}>
          <Text style={s.overallLabel}>Overall</Text>
          <Text style={[s.overallValue, tabular]}>{r.overall}/5</Text>
        </View>
      </View>

      {r.actions?.length > 0 && (
        <View style={s.actions}>
          <Text style={s.actionsTitle}>FOCUS ON THESE NEXT</Text>
          {r.actions.slice(0, 3).map((a, i) => (
            <View key={i} style={s.action}>
              <View style={s.actionNum}><Text style={s.actionNumText}>{i + 1}</Text></View>
              <Text style={s.actionText}>{a}</Text>
            </View>
          ))}
        </View>
      )}

      {r.competencies?.length > 0 && (
        <>
          <Text style={s.section}>SKILLS VS THE ROLE</Text>
          <View style={s.card}>
            {r.competencies.map((c, i) => (
              <View key={i} style={i > 0 ? s.compNext : undefined}>
                <View style={s.compHead}>
                  <View style={[s.dot, c.covered ? s.dotOn : s.dotOff]} />
                  <Text style={s.compName} numberOfLines={1}>{c.name}</Text>
                </View>
                <Bar label={c.covered ? 'Tested' : 'Not covered'} score={c.score} />
                {!!c.note && <Text style={s.compNote}>{c.note}</Text>}
              </View>
            ))}
          </View>
        </>
      )}

      {r.answers?.length > 0 && (
        <>
          <Text style={s.section}>ANSWER BY ANSWER</Text>
          {r.answers.map((a, i) => (
            <View key={i} style={s.answer}>
              <View style={s.answerQ}>
                <Text style={s.answerQText}>{a.question}</Text>
              </View>
              <View style={s.answerBody}>
                {!!a.excerpt && (
                  <View style={s.quote}>
                    <Text style={s.quoteText}>{a.excerpt}</Text>
                  </View>
                )}
                <Text style={s.why}>{a.why}</Text>
                <View style={s.stronger}>
                  <Text style={s.strongerLabel}>A STRONGER ANSWER</Text>
                  <Text style={s.strongerText}>{a.stronger}</Text>
                </View>
                <View style={s.bars}>
                  <Bar label="Technical" score={a.technical} />
                  <Bar label="Structure" score={a.structure} />
                  <Bar label="Communication" score={a.communication} />
                  <Bar label="Signal" score={a.signal} />
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {!!r.delivery?.notes && (
        <>
          <Text style={s.section}>HOW YOU CAME ACROSS</Text>
          <View style={s.card}><Text style={s.body}>{r.delivery.notes}</Text></View>
        </>
      )}

      {(covered.length > 0 || uncovered.length > 0) && (
        <>
          <Text style={s.section}>STUDY THESE IN OHMLET</Text>
          {covered.length > 0 ? (
            covered.map((t, i) => (
              <Pressable
                key={i}
                onPress={onOpenPath}
                style={({ pressed }) => [s.topic, pressed && s.topicDown]}
                accessibilityRole="button"
                accessibilityLabel={`Open the learning path for ${t.skillTitle ?? t.topic}`}
              >
                <Text style={s.topicName}>{t.topic}</Text>
                <Text style={s.topicSkill}>
                  {t.skillTitle}{t.unitTitle ? ` · ${t.unitTitle}` : ''}
                </Text>
                {!!t.why && <Text style={s.topicWhy}>{t.why}</Text>}
              </Pressable>
            ))
          ) : (
            <Text style={s.body}>
              Nothing from this interview maps onto a lesson we have written yet.
            </Text>
          )}

          {uncovered.length > 0 && (
            <View style={s.gap}>
              <Text style={s.gapLabel}>ASKED ABOUT, NOT TAUGHT HERE YET</Text>
              <Text style={s.gapText}>{uncovered.join(' · ')}</Text>
            </View>
          )}
        </>
      )}

      <View style={s.footer}>
        {covered.length > 0 && (
          <Button label="Open the learning path" onPress={onOpenPath} />
        )}
        <Button label="Practise another round" variant="secondary" onPress={onRetry} />
      </View>
    </ScrollView>
  );
};

const useS = makeStyles((colors, th) => ({
  scroll: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },

  hero: {
    backgroundColor: colors.slab, borderRadius: radius.lg, ...curve,
    padding: space.lg, gap: space.xs, ...th.elevation.lifted,
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2, color: 'rgba(255,255,255,0.6)' },
  heroPill: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  heroPillText: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 0.6, color: colors.onGold, textTransform: 'uppercase' },
  heroLabel: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.4, color: colors.gold, marginTop: space.sm },
  heroHeadline: { fontFamily: font.black, fontSize: type.heading, color: colors.white, lineHeight: 26, letterSpacing: -0.4 },
  heroSummary: { fontFamily: font.semibold, fontSize: type.label, color: 'rgba(255,255,255,0.78)', lineHeight: 21, marginTop: space.xs },
  overall: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: space.sm,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  overallLabel: { fontFamily: font.black, fontSize: type.small, color: colors.white },
  overallValue: { fontFamily: font.black, fontSize: type.small, color: colors.gold },

  actions: {
    backgroundColor: colors.goldSoft, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.lg, gap: space.sm,
  },
  actionsTitle: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.6, color: colors.ink },
  action: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionNum: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  actionNumText: { fontFamily: font.black, fontSize: type.meta, color: colors.onInk },
  actionText: { flex: 1, fontFamily: font.semibold, fontSize: type.label, color: colors.ink, lineHeight: 21 },

  section: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.8, color: colors.inkMute, marginTop: space.sm },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, ...curve,
    borderWidth: 2, borderColor: colors.line, padding: space.lg, gap: space.sm,
  },
  body: { fontFamily: font.semibold, fontSize: type.label, color: colors.inkSoft, lineHeight: 21 },

  compNext: { marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md },
  compHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOn: { backgroundColor: colors.greenDeep },
  dotOff: { borderWidth: 2, borderColor: colors.line },
  compName: { flex: 1, fontFamily: font.extrabold, fontSize: type.label, color: colors.ink },
  compNote: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, lineHeight: 18, marginTop: 4 },

  bar: { marginTop: 6 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  barLabel: { fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft },
  barScore: { fontFamily: font.black, fontSize: type.meta, color: colors.ink },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: colors.inkFaint, overflow: 'hidden', marginTop: 3 },
  barFill: { height: '100%', borderRadius: 4 },
  bars: { marginTop: space.sm, gap: 2 },

  answer: {
    backgroundColor: colors.surface, borderRadius: radius.lg, ...curve,
    borderWidth: 2, borderColor: colors.line, overflow: 'hidden',
  },
  answerQ: { backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.line, padding: space.md },
  answerQText: { fontFamily: font.extrabold, fontSize: type.label, color: colors.ink, lineHeight: 20 },
  answerBody: { padding: space.md, gap: space.sm },
  quote: { borderLeftWidth: 2.5, borderLeftColor: colors.line, paddingLeft: space.sm },
  quoteText: { fontFamily: font.semibold, fontSize: type.small, fontStyle: 'italic', color: colors.inkSoft, lineHeight: 19 },
  why: { fontFamily: font.semibold, fontSize: type.label, color: colors.ink, lineHeight: 21 },
  stronger: {
    borderRadius: radius.md, borderWidth: 2, borderColor: withAlpha(colors.green, 0.45),
    backgroundColor: colors.greenSoft, padding: space.sm, gap: 3,
  },
  strongerLabel: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.2, color: colors.greenDeep },
  strongerText: { fontFamily: font.semibold, fontSize: type.small, color: colors.ink, lineHeight: 19 },

  topic: {
    backgroundColor: colors.surface, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.ink, padding: space.md, gap: 2,
  },
  topicDown: { transform: [{ translateY: 1 }] },
  topicName: { fontFamily: font.extrabold, fontSize: type.label, color: colors.ink, lineHeight: 20 },
  topicSkill: { fontFamily: font.bold, fontSize: type.small, color: colors.goldText },
  topicWhy: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, lineHeight: 18, marginTop: 2 },

  gap: {
    borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.inkMute, padding: space.md, gap: 3,
  },
  gapLabel: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.2, color: colors.inkSoft },
  gapText: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, lineHeight: 18 },

  footer: { gap: space.sm, marginTop: space.md },
}));
