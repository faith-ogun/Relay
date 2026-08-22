import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, space, type } from '../theme/tokens';
import type {
  LessonStep, StepChoice, StepDragOrder, StepFill, StepMatch, StepTeach, StepTrueFalse,
} from './types';

interface Props {
  step: LessonStep;
  checked: boolean;
  correct: boolean | null;
  /** Report whether the learner's current answer is correct. */
  onSubmit: (isCorrect: boolean) => void;
  /** Lets the shell enable/disable its Check button. */
  onCanCheck: (can: boolean) => void;
  /** Set by the shell: pressing Check calls this step's grader. */
  registerGrader: (grade: (() => void) | null) => void;
}

export const StepView: React.FC<Props> = (props) => {
  const { step } = props;
  switch (step.type) {
    case 'teach':
      return <TeachStep {...props} step={step as StepTeach} />;
    case 'true_false':
      return <TrueFalseStep {...props} step={step as StepTrueFalse} />;
    case 'fill_blank':
      return <FillStep {...props} step={step as StepFill} />;
    case 'match':
      return <MatchStep {...props} step={step as StepMatch} />;
    case 'drag_order':
      return <OrderStep {...props} step={step as StepDragOrder} />;
    default:
      // multiple_choice, predict_reading, predict_behavior, choose_resistor,
      // identify_component all present as a choice list.
      return <ChoiceStep {...props} step={step as StepChoice} />;
  }
};

// ── Teach ──────────────────────────────────────────────────────────────────
const TeachStep: React.FC<Props & { step: StepTeach }> = ({ step, onCanCheck, registerGrader, onSubmit }) => {
  useEffect(() => {
    onCanCheck(true);
    registerGrader(() => onSubmit(true));   // acknowledged, never graded
    return () => registerGrader(null);
  }, [step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={s.kicker}>LEARN</Text>
      <Text style={s.title}>{step.title}</Text>
      <Text style={s.body}>{step.body}</Text>
    </View>
  );
};

// ── Choice ─────────────────────────────────────────────────────────────────
const ChoiceStep: React.FC<Props & { step: StepChoice }> = ({
  step, checked, correct, onSubmit, onCanCheck, registerGrader,
}) => {
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => { setPicked(null); }, [step]);
  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correct));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  const predict = step.type === 'predict_reading' || step.type === 'predict_behavior';

  return (
    <View>
      <Text style={s.kicker}>{predict ? 'PREDICT' : 'QUESTION'}</Text>
      <Text style={s.question}>{step.question}</Text>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {step.options.map((opt, i) => {
          const isPicked = picked === i;
          const reveal = checked && (i === step.correct || isPicked);
          const good = checked && i === step.correct;
          return (
            <Pressable
              key={`${opt}-${i}`}
              disabled={checked}
              onPress={() => setPicked(i)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPicked }}
              style={[
                s.option,
                isPicked && !checked && s.optionPicked,
                reveal && (good ? s.optionRight : s.optionWrong),
              ]}
            >
              <Text style={[s.optionText, reveal && good && s.optionTextRight]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ── True / False ───────────────────────────────────────────────────────────
const TrueFalseStep: React.FC<Props & { step: StepTrueFalse }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [picked, setPicked] = useState<boolean | null>(null);

  useEffect(() => { setPicked(null); }, [step]);
  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correct));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={s.kicker}>TRUE OR FALSE</Text>
      <Text style={s.question}>{step.statement}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        {[true, false].map((val) => {
          const isPicked = picked === val;
          const reveal = checked && (val === step.correct || isPicked);
          const good = checked && val === step.correct;
          return (
            <Pressable
              key={String(val)}
              disabled={checked}
              onPress={() => setPicked(val)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPicked }}
              style={[
                s.option, { flex: 1, alignItems: 'center' },
                isPicked && !checked && s.optionPicked,
                reveal && (good ? s.optionRight : s.optionWrong),
              ]}
            >
              <Text style={[s.optionText, reveal && good && s.optionTextRight]}>
                {val ? 'True' : 'False'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ── Fill in the blank ──────────────────────────────────────────────────────
const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

const FillStep: React.FC<Props & { step: StepFill }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [value, setValue] = useState('');
  const [tiles, setTiles] = useState<string[]>([]);
  const hasTiles = Array.isArray(step.tiles) && step.tiles.length > 0;
  const answer = hasTiles ? tiles.join(' ') : value;

  useEffect(() => { setValue(''); setTiles([]); }, [step]);
  useEffect(() => {
    const ready = answer.trim().length > 0;
    onCanCheck(ready);
    registerGrader(!ready ? null : () => onSubmit(normalise(answer) === normalise(step.answer)));
    return () => registerGrader(null);
  }, [answer, step, onCanCheck, registerGrader, onSubmit]);

  const [before, after] = useMemo(() => {
    const parts = step.prompt.split(step.blank);
    return [parts[0] ?? step.prompt, parts.slice(1).join(step.blank)];
  }, [step]);

  return (
    <View>
      <Text style={s.kicker}>FILL THE BLANK</Text>
      <Text style={s.question}>
        {before}
        <Text style={s.blank}>{answer || '_____'}</Text>
        {after}
      </Text>

      {hasTiles ? (
        <View style={s.tileWrap}>
          {step.tiles!.map((t, i) => {
            const used = tiles.includes(t);
            return (
              <Pressable
                key={`${t}-${i}`}
                disabled={checked}
                onPress={() => setTiles((cur) => (used ? cur.filter((x) => x !== t) : [...cur, t]))}
                style={[s.tile, used && s.tileUsed]}
                accessibilityRole="button"
                accessibilityState={{ selected: used }}
              >
                <Text style={[s.tileText, used && s.tileTextUsed]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={setValue}
          editable={!checked}
          style={s.input}
          placeholder="Your answer"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Your answer"
          autoCapitalize="none"
        />
      )}

      {!!step.hint && !checked && <Text style={s.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

// ── Match ──────────────────────────────────────────────────────────────────
const MatchStep: React.FC<Props & { step: StepMatch }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const lefts = useMemo(() => step.pairs.map((p) => p[0]), [step]);
  // Rotate rather than shuffle: deterministic, so the same question never
  // renders in an order that accidentally matches the answer key.
  const rights = useMemo(() => {
    const r = step.pairs.map((p) => p[1]);
    return r.length > 1 ? [...r.slice(1), r[0]] : r;
  }, [step]);

  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<number, string>>({});

  useEffect(() => { setLinks({}); setActiveLeft(null); }, [step]);
  useEffect(() => {
    const complete = Object.keys(links).length === lefts.length;
    onCanCheck(complete);
    registerGrader(!complete ? null : () =>
      onSubmit(step.pairs.every((pair, i) => links[i] === pair[1])));
    return () => registerGrader(null);
  }, [links, lefts.length, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={s.kicker}>MATCH</Text>
      <Text style={s.question}>{step.instruction}</Text>
      <View style={{ marginTop: space.md, gap: space.sm }}>
        {lefts.map((left, i) => (
          <Pressable
            key={left}
            disabled={checked}
            onPress={() => setActiveLeft(activeLeft === i ? null : i)}
            style={[s.matchRow, activeLeft === i && s.optionPicked, !!links[i] && s.matchDone]}
            accessibilityRole="button"
            accessibilityLabel={`${left}${links[i] ? `, matched to ${links[i]}` : ', not matched'}`}
          >
            <Text style={s.matchLeft}>{left}</Text>
            <Text style={s.matchRight} numberOfLines={2}>{links[i] ?? 'tap, then pick'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.tileWrap}>
        {rights.map((r) => {
          const taken = Object.values(links).includes(r);
          return (
            <Pressable
              key={r}
              disabled={checked || activeLeft === null || taken}
              onPress={() => {
                if (activeLeft === null) return;
                setLinks((cur) => ({ ...cur, [activeLeft]: r }));
                setActiveLeft(null);
              }}
              style={[s.tile, taken && s.tileUsed]}
            >
              <Text style={[s.tileText, taken && s.tileTextUsed]} numberOfLines={2}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ── Order ──────────────────────────────────────────────────────────────────
const OrderStep: React.FC<Props & { step: StepDragOrder }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => { setOrder([]); }, [step]);
  useEffect(() => {
    const complete = order.length === step.items.length;
    onCanCheck(complete);
    registerGrader(!complete ? null : () =>
      onSubmit(order.every((v, i) => v === step.correctOrder[i])));
    return () => registerGrader(null);
  }, [order, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={s.kicker}>PUT IN ORDER</Text>
      <Text style={s.question}>{step.instruction}</Text>
      <Text style={s.hint}>Tap them in order. Tap a chosen one to take it back.</Text>

      <View style={{ marginTop: space.md, gap: 6 }}>
        {order.map((itemIdx, slot) => (
          <Pressable
            key={`slot-${slot}`}
            disabled={checked}
            onPress={() => setOrder((cur) => cur.filter((_, i) => i !== slot))}
            style={[s.option, s.optionPicked, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
          >
            <Text style={s.orderNum}>{slot + 1}</Text>
            <Text style={s.optionText}>{step.items[itemIdx]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.tileWrap}>
        {step.items.map((item, i) =>
          order.includes(i) ? null : (
            <Pressable
              key={item}
              disabled={checked}
              onPress={() => setOrder((cur) => [...cur, i])}
              style={s.tile}
            >
              <Text style={s.tileText}>{item}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, marginTop: 6, letterSpacing: -0.5 },
  question: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: 6, lineHeight: type.heading * 1.3 },
  body: { fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft, marginTop: space.md, lineHeight: 24 },
  option: {
    borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, paddingVertical: 14, paddingHorizontal: space.md,
  },
  optionPicked: { borderColor: colors.ink, backgroundColor: colors.goldSoft },
  optionRight: { borderColor: colors.greenDeep, backgroundColor: '#eef7e0' },
  optionWrong: { borderColor: colors.red, backgroundColor: '#fdece8' },
  optionText: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  optionTextRight: { color: colors.ink },
  blank: { color: colors.blueDeep, fontFamily: font.black },
  input: {
    marginTop: space.md, borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 14,
    fontFamily: font.bold, fontSize: type.body, color: colors.ink,
  },
  hint: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: space.sm },
  tileWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md },
  tile: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%',
  },
  tileUsed: { backgroundColor: colors.line, borderColor: colors.line },
  tileText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  tileTextUsed: { color: colors.inkSoft },
  matchRow: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, padding: space.md,
  },
  matchDone: { borderColor: colors.ink },
  matchLeft: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  matchRight: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 3 },
  orderNum: {
    fontFamily: font.black, fontSize: type.small, color: colors.ink,
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold,
    textAlign: 'center', lineHeight: 22, overflow: 'hidden',
  },
});
