import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas';
import { CircuitDiagram, regionLabel } from '../components/circuits/CircuitDiagram';
import { drawingGraderConfigured, gradeDrawing } from '../services/drawingGrader';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, space, type } from '../theme/tokens';
import type {
  LessonStep, StepBuildToSpec, StepChoice, StepConnect, StepDraw, StepDragOrder,
  StepFill, StepFixCircuit, StepMatch, StepSpotError, StepTeach, StepTraceCurrent,
  StepTrueFalse,
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
    case 'draw_connection':
      return <ConnectStep {...props} step={step as StepConnect} />;
    case 'draw_circuit':
    case 'draw_fix':
      return <DrawStep {...props} step={step as StepDraw} />;
    case 'spot_error':
      return <SpotErrorStep {...props} step={step as StepSpotError} />;
    case 'fix_the_circuit':
      return <FixCircuitStep {...props} step={step as StepFixCircuit} />;
    case 'trace_current':
      return <TraceCurrentStep {...props} step={step as StepTraceCurrent} />;
    case 'build_to_spec':
      return <BuildToSpecStep {...props} step={step as StepBuildToSpec} />;
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
      <CircuitDiagram circuit={step.circuitDiagram} />
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
      <CircuitDiagram circuit={step.circuitDiagram} />
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
      <CircuitDiagram circuit={step.circuitDiagram} />
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
      <CircuitDiagram circuit={step.circuitDiagram} />

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


// ── Spot the error ─────────────────────────────────────────────────────────
// The learner taps the faulty part on the schematic itself. Reading a circuit
// and locating a fault is the skill; a multiple-choice list would test recall
// of the answer text instead.
const SpotErrorStep: React.FC<Props & { step: StepSpotError }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { setPicked(null); }, [step]);
  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correctRegion));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  const right = picked === step.correctRegion;
  return (
    <View>
      <Text style={s.kicker}>SPOT THE ERROR</Text>
      <Text style={s.question}>{step.question}</Text>
      <CircuitDiagram
        circuit={step.circuitDiagram}
        onRegionPress={checked ? undefined : setPicked}
        selected={picked ? [picked] : []}
        correct={checked ? [step.correctRegion] : []}
        wrong={checked && !right && picked ? [picked] : []}
      />
      <Text style={s.hint}>
        {checked
          ? right
            ? `Right: ${regionLabel(step.circuitDiagram, step.correctRegion)}.`
            : `The fault is at ${regionLabel(step.circuitDiagram, step.correctRegion)}.`
          : picked
            ? `You picked ${regionLabel(step.circuitDiagram, picked)}.`
            : 'Tap the part that is wrong.'}
      </Text>
      {!!step.hint && !checked && !picked && <Text style={s.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

// ── Fix the circuit ────────────────────────────────────────────────────────
// Two moves: locate the fault, then choose the repair. Both must be right, so
// a learner cannot guess the fix without understanding where the problem is.
const FixCircuitStep: React.FC<Props & { step: StepFixCircuit }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [region, setRegion] = useState<string | null>(null);
  const [fix, setFix] = useState<number | null>(null);

  useEffect(() => { setRegion(null); setFix(null); }, [step]);
  const ready = region !== null && fix !== null;
  useEffect(() => {
    onCanCheck(ready);
    registerGrader(!ready ? null : () => onSubmit(region === step.faultRegion && fix === step.correctFix));
    return () => registerGrader(null);
  }, [ready, region, fix, step, onCanCheck, registerGrader, onSubmit]);

  const regionRight = region === step.faultRegion;
  return (
    <View>
      <Text style={s.kicker}>FIND IT, THEN FIX IT</Text>
      <Text style={s.question}>{step.question}</Text>
      <CircuitDiagram
        circuit={step.circuitDiagram}
        onRegionPress={checked ? undefined : setRegion}
        selected={region ? [region] : []}
        correct={checked ? [step.faultRegion] : []}
        wrong={checked && !regionRight && region ? [region] : []}
      />
      <Text style={s.stepLabel}>
        {region ? `2. Now choose the fix for ${regionLabel(step.circuitDiagram, region)}` : '1. Tap the faulty part'}
      </Text>
      <View style={{ gap: space.sm, marginTop: space.sm, opacity: region ? 1 : 0.4 }} pointerEvents={region ? 'auto' : 'none'}>
        {step.fixes.map((opt, i) => {
          const isPicked = fix === i;
          const reveal = checked && (i === step.correctFix || isPicked);
          const good = checked && i === step.correctFix;
          return (
            <Pressable
              key={`${opt}-${i}`}
              disabled={checked}
              onPress={() => setFix(i)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPicked, disabled: !region }}
              style={[s.option, isPicked && !checked && s.optionPicked, reveal && (good ? s.optionRight : s.optionWrong)]}
            >
              <Text style={s.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!step.hint && !checked && <Text style={s.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

// ── Trace the current ──────────────────────────────────────────────────────
// Order matters: the learner taps each part in the order current reaches it,
// which is what distinguishes understanding a loop from naming its parts.
const TraceCurrentStep: React.FC<Props & { step: StepTraceCurrent }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [path, setPath] = useState<string[]>([]);

  useEffect(() => { setPath([]); }, [step]);
  const complete = path.length === step.correctPath.length;
  useEffect(() => {
    onCanCheck(complete);
    registerGrader(!complete ? null : () => onSubmit(path.every((id, i) => id === step.correctPath[i])));
    return () => registerGrader(null);
  }, [complete, path, step, onCanCheck, registerGrader, onSubmit]);

  const tap = (id: string) => setPath((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const wrongAt = path.filter((id, i) => id !== step.correctPath[i]);

  return (
    <View>
      <Text style={s.kicker}>TRACE THE CURRENT</Text>
      <Text style={s.question}>{step.question}</Text>
      <CircuitDiagram
        circuit={step.circuitDiagram}
        onRegionPress={checked ? undefined : tap}
        selected={path}
        correct={checked ? path.filter((id, i) => id === step.correctPath[i]) : []}
        wrong={checked ? wrongAt : []}
      />
      <View style={s.pathRow}>
        {step.correctPath.map((_, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text style={s.pathArrow}>→</Text>}
            <View style={[s.pathSlot, !!path[i] && s.pathSlotFilled]}>
              <Text style={[s.pathSlotText, !!path[i] && s.pathSlotTextFilled]} numberOfLines={1}>
                {path[i] ? regionLabel(step.circuitDiagram, path[i]) : i + 1}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      {!checked && <Text style={s.hint}>Tap each part in order. Tap one again to take it back.</Text>}
      {checked && (
        <Text style={s.hint}>
          The loop runs {step.correctPath.map((id) => regionLabel(step.circuitDiagram, id)).join(' → ')}.
        </Text>
      )}
    </View>
  );
};

// ── Build to spec ──────────────────────────────────────────────────────────
// A palette with more parts than slots, so the learner both selects and orders.
const BuildToSpecStep: React.FC<Props & { step: StepBuildToSpec }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [placed, setPlaced] = useState<number[]>([]);

  useEffect(() => { setPlaced([]); }, [step]);
  const full = placed.length === step.slots;
  useEffect(() => {
    onCanCheck(full);
    registerGrader(!full ? null : () => onSubmit(placed.every((p, i) => p === step.correct[i])));
    return () => registerGrader(null);
  }, [full, placed, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={s.kicker}>BUILD IT</Text>
      <Text style={s.question}>{step.instruction}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      <View style={s.pathRow}>
        {Array.from({ length: step.slots }).map((_, i) => {
          const partIdx = placed[i];
          const good = checked && partIdx === step.correct[i];
          const bad = checked && partIdx !== undefined && partIdx !== step.correct[i];
          return (
            <React.Fragment key={i}>
              {i > 0 && <Text style={s.pathArrow}>→</Text>}
              <Pressable
                disabled={checked || partIdx === undefined}
                onPress={() => setPlaced((prev) => prev.filter((_, j) => j !== i))}
                style={[
                  s.pathSlot, partIdx !== undefined && s.pathSlotFilled,
                  good && s.optionRight, bad && s.optionWrong,
                ]}
              >
                <Text style={[s.pathSlotText, partIdx !== undefined && s.pathSlotTextFilled]} numberOfLines={1}>
                  {partIdx === undefined ? i + 1 : step.palette[partIdx]}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      <View style={s.tileWrap}>
        {step.palette.map((part, i) => {
          const used = placed.includes(i);
          return (
            <Pressable
              key={`${part}-${i}`}
              disabled={checked || used || full}
              onPress={() => setPlaced((prev) => [...prev, i])}
              style={[s.tile, (used || (full && !used)) && s.tileUsed]}
            >
              <Text style={[s.tileText, used && s.tileTextUsed]}>{part}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!step.hint && !checked && <Text style={s.hint}>Hint: {step.hint}</Text>}
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
  stepLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.6,
    color: colors.inkSoft, marginTop: space.md, textTransform: 'uppercase',
  },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  pathArrow: { fontFamily: font.black, fontSize: type.body, color: colors.inkSoft },
  pathSlot: {
    flex: 1, minHeight: 46, borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md,
    borderStyle: 'dashed', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pathSlotFilled: { borderStyle: 'solid', borderColor: colors.ink, backgroundColor: colors.goldSoft },
  pathSlotText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  pathSlotTextFilled: { color: colors.ink },
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
  board: {
    marginTop: space.md, backgroundColor: colors.white, borderWidth: 2.5,
    borderColor: colors.ink, borderRadius: radius.md, padding: space.sm,
  },
  undo: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginTop: space.sm,
  },
  undoText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  drawTools: { flexDirection: 'row', gap: space.sm },
  grading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  orderNum: {
    fontFamily: font.black, fontSize: type.small, color: colors.ink,
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold,
    textAlign: 'center', lineHeight: 22, overflow: 'hidden',
  },
});


// ── Draw a connection (tap two terminals) ──────────────────────────────────
const ConnectStep: React.FC<Props & { step: StepConnect }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const [active, setActive] = useState<string | null>(null);
  const [wires, setWires] = useState<Array<[string, string]>>([]);

  useEffect(() => { setWires([]); setActive(null); }, [step]);

  const expected = step.expectedConnections ?? [];
  useEffect(() => {
    const ready = wires.length === expected.length;
    onCanCheck(ready);
    registerGrader(!ready ? null : () => {
      // Order within a wire does not matter: a connection is undirected.
      const key = (a: string, b: string) => [a, b].sort().join('|');
      const drawn = new Set(wires.map(([a, b]) => key(a, b)));
      onSubmit(expected.every(([a, b]) => drawn.has(key(a, b))));
    });
    return () => registerGrader(null);
  }, [wires, expected, onCanCheck, registerGrader, onSubmit]);

  const tap = (id: string) => {
    if (checked) return;
    if (active === null) { setActive(id); return; }
    if (active === id) { setActive(null); return; }
    setWires((w) => [...w, [active, id]]);
    setActive(null);
  };

  const pos = (id: string) => step.terminals.find((t) => t.id === id);
  // The authored coordinates assume a 320x140 board; scale to the device width.
  const W = 320, H = 140;

  return (
    <View>
      <Text style={s.kicker}>WIRE IT UP</Text>
      <Text style={s.question}>{step.instruction}</Text>
      <Text style={s.hint}>Tap one terminal, then the one it connects to.</Text>

      <View style={s.board}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          {wires.map(([a, b], i) => {
            const p1 = pos(a), p2 = pos(b);
            if (!p1 || !p2) return null;
            return (
              <Line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={colors.red} strokeWidth={3} strokeLinecap="round" />
            );
          })}
          {step.terminals.map((t) => (
            <React.Fragment key={t.id}>
              <Circle
                cx={t.x} cy={t.y} r={14}
                fill={active === t.id ? colors.gold : colors.white}
                stroke={colors.ink} strokeWidth={2.5}
                onPress={() => tap(t.id)}
              />
              <SvgText
                x={t.x} y={t.y + 4} fontSize={10} fontWeight="bold"
                fill={colors.ink} textAnchor="middle" onPress={() => tap(t.id)}
              >
                {t.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </View>

      {wires.length > 0 && !checked && (
        <Pressable onPress={() => setWires((w) => w.slice(0, -1))} style={s.undo}>
          <Text style={s.undoText}>Undo last wire</Text>
        </Pressable>
      )}
    </View>
  );
};

// ── Draw the circuit (freeform, graded by vision) ──────────────────────────
const DrawStep: React.FC<Props & { step: StepDraw }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const canvasRef = useRef<DrawCanvasHandle>(null);
  const shotRef = useRef<View>(null);
  const [hasInk, setHasInk] = useState(false);
  const [grading, setGrading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { setHasInk(false); setNote(null); canvasRef.current?.clear(); }, [step]);

  useEffect(() => {
    onCanCheck(hasInk && !grading);
    registerGrader(!hasInk || grading ? null : async () => {
      setGrading(true);
      setNote(null);
      try {
        const uri = await captureRef(shotRef, { format: 'jpg', quality: 0.7, result: 'base64' });
        const verdict = await gradeDrawing(uri, step.expected ?? [], step.type);
        if (!verdict) {
          // The grader is unreachable. Accept the attempt rather than marking a
          // learner wrong for a network failure, and say so honestly.
          setNote('Could not reach the grader, so this one is counted as complete.');
          onSubmit(true);
          return;
        }
        setNote(verdict.feedback || null);
        onSubmit(verdict.correct);
      } catch {
        setNote('Could not read the drawing, so this one is counted as complete.');
        onSubmit(true);
      } finally {
        setGrading(false);
      }
    });
    return () => registerGrader(null);
  }, [hasInk, grading, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={s.kicker}>DRAW IT</Text>
      <Text style={s.question}>{step.instruction}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      <View ref={shotRef} collapsable={false} style={{ marginTop: space.md }}>
        <DrawCanvas ref={canvasRef} onInkChange={setHasInk} height={280} />
      </View>

      <View style={s.drawTools}>
        <Pressable onPress={() => canvasRef.current?.undo()} disabled={checked || !hasInk} style={s.undo}>
          <Text style={s.undoText}>Undo</Text>
        </Pressable>
        <Pressable
          onPress={() => { canvasRef.current?.clear(); setHasInk(false); }}
          disabled={checked || !hasInk}
          style={s.undo}
        >
          <Text style={s.undoText}>Clear</Text>
        </Pressable>
      </View>

      {grading && (
        <View style={s.grading}>
          <ActivityIndicator color={colors.goldDeep} />
          <Text style={s.hint}>Looking at your drawing…</Text>
        </View>
      )}

      {!!note && <Text style={s.hint}>{note}</Text>}
      {!!step.hint && !checked && !grading && <Text style={s.hint}>Hint: {step.hint}</Text>}
      {!drawingGraderConfigured() && (
        <Text style={s.hint}>Drawing feedback is unavailable right now; your attempt still counts.</Text>
      )}
    </View>
  );
};
