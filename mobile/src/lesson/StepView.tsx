import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas';
import { CircuitDiagram, hasRegions, regionLabel } from '../components/circuits/CircuitDiagram';
import { drawingGraderConfigured, gradeDrawing } from '../services/drawingGrader';
import {
  buildSlotCorrect, clearSlot, gradeBuild, gradeFillTiles, gradeFillTyped, gradeMatch,
  gradeOrder, isChipTaken, isTilePlaced, matchChips, orderRowCorrect, placePart,
  tileAnswer, toggleTile, unlinkRow, type MatchLinks,
} from './grading';
import { Pressable, Text, TextInput, View } from 'react-native';
import { font, radius, space, type, curve } from '../theme/tokens';
import { ComponentPhoto, isComponentImagePath } from './componentArt';
import { ImageChoiceStep, hasOptionImages, type StepImageChoice } from './ImageChoiceStep';
import { MeterStep } from './MeterStep';
import { OptionList, useOptionStyles } from './optionList';
import { shuffledOrder } from './optionOrder';
import { ResistorBandStep } from './ResistorBandStep';
import { useStepText } from './stepText';
import type {
  StepBuildToSpec, StepChoice, StepChooseResistor, StepConnect, StepDraw,
  StepDragOrder, StepFill, StepFixCircuit, StepIdentify, StepMatch, StepPredictReading,
  StepProps as Props, StepSpotError, StepTeach, StepTraceCurrent, StepTrueFalse,
} from './types';
import { makeStyles, useColors } from '../theme/theme';

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
    case 'identify_component':
      // Tap a part on the diagram, NOT a list of options. This used to fall
      // through to ChoiceStep, which does step.options.map(...) — and an
      // identify_component step has no `options` at all, it has a circuit and a
      // correctComponent. Every one of the 48 in the corpus threw, taking down
      // 42 of the 142 lessons the moment the step came up.
      return <IdentifyStep {...props} step={step as StepIdentify} />;
    case 'fix_the_circuit':
      return <FixCircuitStep {...props} step={step as StepFixCircuit} />;
    case 'trace_current':
      return <TraceCurrentStep {...props} step={step as StepTraceCurrent} />;
    case 'build_to_spec':
      return <BuildToSpecStep {...props} step={step as StepBuildToSpec} />;
    case 'multiple_choice': {
      // 26 of the 420 carry `optionImages`: four published photographs of real
      // parts, one per option. Without them the step is "Tap the LED" over a
      // button that says LED, so the question hands over its own answer, and
      // the picture was the whole exercise. ImageChoiceStep is the renderer
      // that keeps it a question; the other 394 are ordinary word choices.
      const choice = step as StepChoice;
      if (hasOptionImages(choice)) return <ImageChoiceStep {...props} step={choice as StepImageChoice} />;
      return <ChoiceStep {...props} step={choice} />;
    }
    case 'predict_reading': {
      // 155 of the 208 carry a `meter`: a range, a granularity, a target and a
      // tolerance. Their `options` array holds ONE entry, the answer in words,
      // so the choice renderer put "2.5 V" on a single button under a question
      // that says "dial the voltage at the midpoint". The other 53 are ordinary
      // four-option predictions and stay on the choice renderer.
      const choice = step as StepChoice;
      if (choice.meter) return <MeterStep {...props} step={step as StepPredictReading} />;
      return <ChoiceStep {...props} step={choice} />;
    }
    case 'choose_resistor': {
      // Same shape of failure: 45 of the 49 carry `bands` with a target value to
      // encode, and 44 of those had a single option printing that value.
      const choice = step as StepChoice;
      if (choice.bands) return <ResistorBandStep {...props} step={step as StepChooseResistor} />;
      return <ChoiceStep {...props} step={choice} />;
    }
    default:
      // multiple_choice and predict_behavior present as a choice list, and so do
      // the predict_reading and choose_resistor steps with no spec attached.
      return <ChoiceStep {...props} step={step as StepChoice} />;
  }
};

// ── Teach ──────────────────────────────────────────────────────────────────
// Ordinarily a card to read. When the author attached `hotspots` it stops being
// one: the body ends with "tap each part of this loop to see the job it does",
// and mobile used to render that sentence over a diagram that ignored every
// tap. So a step carrying hotspots becomes an exploration, with Continue held
// back until every part has been opened, which is what the web does with the
// same field.
const TeachStep: React.FC<Props & { step: StepTeach }> = ({ step, onCanCheck, registerGrader, onSubmit }) => {
  const o = useOptionStyles();
  const t = useStepText();
  const s = useS();
  const hotspots = useMemo(() => step.hotspots ?? [], [step]);
  // Only an exploration if every part it names is actually tappable on the
  // diagram. Otherwise it reads as a card, rather than as a card with a
  // Continue button that can never be pressed.
  const explorable = hotspots.length > 0
    && hasRegions(step.circuitDiagram, hotspots.map((h) => h.region));

  const [open, setOpen] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => { setOpen(null); setSeen([]); }, [step]);

  const done = !explorable || seen.length === hotspots.length;
  useEffect(() => {
    onCanCheck(done);
    registerGrader(done ? () => onSubmit(true) : null);   // acknowledged, never graded
    return () => registerGrader(null);
  }, [done, step, onCanCheck, registerGrader, onSubmit]);

  const show = (region: string) => {
    setOpen(region);
    setSeen((cur) => (cur.includes(region) ? cur : [...cur, region]));
  };
  const current = hotspots.find((h) => h.region === open);

  return (
    <View>
      <Text style={t.kicker}>LEARN</Text>
      <Text style={s.title}>{step.title}</Text>
      <Text style={s.body}>{step.body}</Text>
      <CircuitDiagram
        circuit={step.circuitDiagram}
        onRegionPress={explorable ? show : undefined}
        selected={open ? [open] : []}
      />

      {explorable && (
        <>
          {current ? (
            <View style={s.spotCard}>
              <Text style={s.spotLabel}>{current.label}</Text>
              <Text style={s.spotDetail}>{current.detail}</Text>
            </View>
          ) : (
            <Text style={t.hint}>Tap each labelled part to see what it does.</Text>
          )}
          {/* A legend and a way back to any part, so exploring is not one pass.
              The chip carries the short region name and the card carries the
              author's full label, so the accessible name matches the words on
              screen rather than a longer version of them. */}
          <View style={s.tileWrap}>
            {hotspots.map((h) => {
              const name = regionLabel(step.circuitDiagram, h.region);
              const isOpen = open === h.region;
              const isSeen = seen.includes(h.region);
              return (
                <Pressable
                  key={h.region}
                  onPress={() => show(h.region)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOpen }}
                  accessibilityLabel={`${name}${isSeen ? ', explored' : ''}`}
                  style={[s.tile, isSeen && s.tileUsed, isOpen && o.optionPicked]}
                >
                  <Text style={[s.tileText, isSeen && !isOpen && s.tileTextUsed]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
};

// ── Choice ─────────────────────────────────────────────────────────────────
const ChoiceStep: React.FC<Props & { step: StepChoice }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
  const [picked, setPicked] = useState<number | null>(null);

  const options = step.options ?? [];
  // Re-rolled whenever the step changes, which includes a requeued step coming
  // back round: the same question never appears in the same arrangement twice.
  // `picked` and `step.correct` both stay in AUTHORED indices, so only the
  // render order changes and grading never has to know about the shuffle.
  const order = useMemo(() => shuffledOrder(options.length), [step, options.length]);

  useEffect(() => { setPicked(null); }, [step]);
  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correct));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  const predict = step.type === 'predict_reading' || step.type === 'predict_behavior';

  return (
    <View>
      <Text style={t.kicker}>{predict ? 'PREDICT' : 'QUESTION'}</Text>
      <Text style={t.question}>{step.question}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />
      <OptionList
        options={options}
        order={order}
        picked={picked}
        correct={step.correct}
        checked={checked}
        onPick={setPicked}
      />
    </View>
  );
};

// ── True / False ───────────────────────────────────────────────────────────
const TrueFalseStep: React.FC<Props & { step: StepTrueFalse }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const o = useOptionStyles();
  const t = useStepText();
  const [picked, setPicked] = useState<boolean | null>(null);

  useEffect(() => { setPicked(null); }, [step]);
  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correct));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={t.kicker}>TRUE OR FALSE</Text>
      <Text style={t.question}>{step.statement}</Text>
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
                o.option, { flex: 1, alignItems: 'center' },
                isPicked && !checked && o.optionPicked,
                reveal && (good ? o.optionRight : o.optionWrong),
              ]}
            >
              <Text style={[o.optionText, reveal && good && o.optionTextRight]}>
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
//
// The word bank is held by BANK SLOT, never by the word printed on it. A bank
// carrying the same token twice offers two independent tiles, so an answer that
// needs it twice can be built: 14 authored steps need one, among them the
// multiplication sign in "The RC Low-Pass Filter" and "Boolean Rules and De
// Morgan". Keying by value made the second copy a no-op and left those steps
// impossible on the phone while they stayed answerable on the web, which
// requeues a wrong step forever and burns a heart every lap.
//
// The answer assembles into the gap in the sentence, so the sentence reads as
// the learner builds it, and the bank tile IS the placed tile: tapping a placed
// one takes back that copy and leaves the rest of the answer in order. The web
// (LessonRunner.tsx, FillTileStep) assembles into a tray beside the prompt and
// takes back by tapping there. Different affordance, same rule, and the same
// grading either way.
const FillStep: React.FC<Props & { step: StepFill }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
  const colors = useColors();
  const s = useS();
  const [value, setValue] = useState('');
  const [placed, setPlaced] = useState<number[]>([]);
  const tiles = useMemo(() => step.tiles ?? [], [step]);
  const hasTiles = tiles.length > 0;
  const answer = hasTiles ? tileAnswer(tiles, placed) : value;

  // The bank is DRAWN in a shuffled order, and every one of the 199 authored
  // banks is the reason: each puts the answer's tokens first, in order, with the
  // distractors after them. Drawn as authored, every tiled fill_blank on the
  // phone is answered by tapping left to right without reading the question, and
  // "Vout = Vin × R2 / ( R1 + R2 )" is the first eleven tiles in a row. The web
  // shuffles it (LessonRunner.tsx, FillTileStep: `shuffle(tiles.map((_, i) => i))`).
  // Presentation only: `placed` holds authored tile indices either way, so
  // grading never learns that a shuffle happened.
  const bank = useMemo(() => shuffledOrder(tiles.length), [step, tiles.length]);

  useEffect(() => { setValue(''); setPlaced([]); }, [step]);
  useEffect(() => {
    const ready = hasTiles ? placed.length > 0 : value.trim().length > 0;
    onCanCheck(ready);
    registerGrader(!ready ? null : () => onSubmit(hasTiles
      ? gradeFillTiles(tiles, step.answer, placed)
      : gradeFillTyped(step.answer, value)));
    return () => registerGrader(null);
  }, [hasTiles, tiles, placed, value, step, onCanCheck, registerGrader, onSubmit]);

  const [before, after] = useMemo(() => {
    const parts = step.prompt.split(step.blank);
    return [parts[0] ?? step.prompt, parts.slice(1).join(step.blank)];
  }, [step]);

  return (
    <View>
      <Text style={t.kicker}>FILL THE BLANK</Text>
      <Text style={t.question}>
        {before}
        <Text style={s.blank}>{answer || '_____'}</Text>
        {after}
      </Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      {hasTiles ? (
        <>
          <View style={s.tileWrap}>
            {bank.map((i) => {
              const tile = tiles[i];
              const used = isTilePlaced(placed, i);
              return (
                <Pressable
                  key={`${tile}-${i}`}
                  disabled={checked}
                  onPress={() => setPlaced((cur) => toggleTile(cur, i))}
                  style={[s.tile, used && s.tileUsed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: used, disabled: checked }}
                  accessibilityLabel={used
                    ? `${tile}, in your answer. Tap to take it back.`
                    : `${tile}, tap to add it to your answer.`}
                >
                  <Text style={[s.tileText, used && s.tileTextUsed]}>{tile}</Text>
                </Pressable>
              );
            })}
          </View>
          {/* Two tiles reading the same word look the same, so tapping "the one
              I just used" is a guess. This is the sure way back by one. */}
          {placed.length > 0 && !checked && (
            <Pressable
              onPress={() => setPlaced((cur) => cur.slice(0, -1))}
              style={s.undo}
              accessibilityRole="button"
              accessibilityLabel={`Take back ${tiles[placed[placed.length - 1]] ?? 'the last tile'}`}
            >
              <Text style={s.undoText}>Take back last tile</Text>
            </Pressable>
          )}
        </>
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

      {!!step.hint && !checked && <Text style={t.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

// ── Match ──────────────────────────────────────────────────────────────────
const MatchStep: React.FC<Props & { step: StepMatch }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const o = useOptionStyles();
  const t = useStepText();
  const s = useS();
  const lefts = useMemo(() => step.pairs.map((p) => p[0]), [step]);
  // Rotate rather than shuffle: deterministic, so the same question never
  // renders in an order that accidentally matches the answer key. The rotation
  // lives in grading.ts because the chips ARE the bank: a checker that built its
  // own copy of them would be proving something about its own array.
  const rights = useMemo(() => matchChips(step.pairs), [step]);

  // 54 of the 186 match steps carry `images`: one published photograph per
  // left-hand item, aligned to `pairs` by index. It is what makes "match each
  // real component to its job" a question about parts a learner will hold,
  // rather than a vocabulary drill on their names. A photograph that will not
  // load simply leaves its slot empty: the row still carries the name, which is
  // the thing being matched, so the exercise is intact without it.
  const photos = (step as StepMatch & { images?: string[] }).images ?? [];

  // Links hold the CHIP INDEX a row is answered with, not the word on the chip.
  // 11 steps in the corpus are categorisations whose answers repeat ("Series,
  // Parallel, Series, Parallel, Series"), and each pair contributes its own
  // chip. Marking a chip spent by its word retired every other chip reading the
  // same word, so the second row asking for "Series" could never be answered and
  // Check never enabled: the step could not be finished at all on the phone,
  // while the web (LessonRunner.tsx, MatchStep.select) consumes chips by index
  // and pairs by value. Grading stays by value, which is what lets one answer
  // serve several rows.
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [links, setLinks] = useState<MatchLinks>({});

  useEffect(() => { setLinks({}); setActiveLeft(null); }, [step]);
  useEffect(() => {
    const complete = Object.keys(links).length === lefts.length;
    onCanCheck(complete);
    registerGrader(!complete ? null : () => onSubmit(gradeMatch(step.pairs, rights, links)));
    return () => registerGrader(null);
  }, [links, rights, lefts.length, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={t.kicker}>MATCH</Text>
      <Text style={t.question}>{step.instruction}</Text>
      {!checked && (
        <Text style={t.hint}>
          {`${Object.keys(links).length}/${lefts.length} matched. Tap a term, then its answer. Tap a matched term to change it.`}
        </Text>
      )}
      <View style={{ marginTop: space.md, gap: space.sm }}>
        {lefts.map((left, i) => {
          const answered = links[i] === undefined ? null : rights[links[i]];
          return (
            <Pressable
              key={`${left}-${i}`}
              disabled={checked}
              // An answered row gives its chip back and stays selected, so the
              // next tap on the bank re-answers it. There is one chip per row,
              // so by the time the last row is answered every chip is spent: a
              // row that could not be un-answered would leave a learner looking
              // at a mistake with every chip disabled and nothing to do but
              // press Check and lose a heart.
              onPress={() => {
                if (links[i] !== undefined) {
                  setLinks((cur) => unlinkRow(cur, i));
                  setActiveLeft(i);
                  return;
                }
                setActiveLeft(activeLeft === i ? null : i);
              }}
              style={[s.matchRow, activeLeft === i && o.optionPicked, answered !== null && s.matchDone]}
              accessibilityRole="button"
              accessibilityLabel={`${left}${answered !== null ? `, matched to ${answered}. Tap to change it.` : ', not matched'}`}
            >
              {isComponentImagePath(photos[i]) && (
                <ComponentPhoto path={photos[i]} height={THUMB} width={THUMB} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.matchLeft}>{left}</Text>
                <Text style={s.matchRight} numberOfLines={2}>{answered ?? 'tap, then pick'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={s.tileWrap}>
        {rights.map((r, chip) => {
          const taken = isChipTaken(links, chip);
          return (
            <Pressable
              key={`${r}-${chip}`}
              disabled={checked || activeLeft === null || taken}
              onPress={() => {
                if (activeLeft === null) return;
                setLinks((cur) => ({ ...cur, [activeLeft]: chip }));
                setActiveLeft(null);
              }}
              style={[s.tile, taken && s.tileUsed]}
              accessibilityRole="button"
              accessibilityState={{ disabled: checked || activeLeft === null || taken }}
              accessibilityLabel={taken ? `${r}, already used` : `${r}, tap to answer the chosen term`}
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
//
// Graded on the arrangement the learner can SEE, by what each row SAYS, which is
// the web runner's rule (LessonRunner.tsx, drag_order). Blink's loop() holds two
// `delay(1000);` lines and three lessons ask for it, so comparing item indices
// marked a visually perfect answer wrong about half the time depending on which
// of the two identical rows was tapped first. The learner was then shown the
// same rows again with nothing on screen to change, every lap of the requeue.
const OrderStep: React.FC<Props & { step: StepDragOrder }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const o = useOptionStyles();
  const t = useStepText();
  const s = useS();
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => { setOrder([]); }, [step]);
  useEffect(() => {
    const complete = order.length === step.items.length;
    onCanCheck(complete);
    registerGrader(!complete ? null : () =>
      onSubmit(gradeOrder(step.items, step.correctOrder, order)));
    return () => registerGrader(null);
  }, [order, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={t.kicker}>PUT IN ORDER</Text>
      <Text style={t.question}>{step.instruction}</Text>
      <Text style={t.hint}>Tap them in order. Tap a chosen one to take it back.</Text>

      <View style={{ marginTop: space.md, gap: 6 }}>
        {order.map((itemIdx, slot) => {
          // Painted by the same rule that grades it, so a row can never be shown
          // red under a "Correct" banner or green under a wrong one.
          const rowRight = orderRowCorrect(step.items, step.correctOrder, itemIdx, slot);
          return (
            <Pressable
              key={`slot-${slot}`}
              disabled={checked}
              onPress={() => setOrder((cur) => cur.filter((_, i) => i !== slot))}
              style={[
                o.option, o.optionPicked, { flexDirection: 'row', alignItems: 'center', gap: 10 },
                checked && (rowRight ? o.optionRight : o.optionWrong),
              ]}
              accessibilityRole="button"
              accessibilityLabel={checked
                ? `Position ${slot + 1}, ${step.items[itemIdx]}, ${rowRight ? 'right place' : 'wrong place'}`
                : `Position ${slot + 1}, ${step.items[itemIdx]}. Tap to take it back.`}
            >
              <Text style={s.orderNum}>{slot + 1}</Text>
              <Text style={[o.optionText, checked && rowRight && o.optionTextRight]}>{step.items[itemIdx]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.tileWrap}>
        {step.items.map((item, i) =>
          order.includes(i) ? null : (
            // Keyed by position, not by text: two rows can read the same, and
            // duplicate keys leave React reconciling the wrong one.
            <Pressable
              key={`item-${i}`}
              disabled={checked}
              onPress={() => setOrder((cur) => [...cur, i])}
              style={s.tile}
              accessibilityRole="button"
              accessibilityLabel={`${item}, tap to place it next`}
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
const IdentifyStep: React.FC<Props & { step: StepIdentify }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { setPicked(null); }, [step]);
  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correctComponent));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  const right = picked === step.correctComponent;
  return (
    <View>
      <Text style={t.kicker}>IDENTIFY</Text>
      <Text style={t.question}>{step.question}</Text>
      <CircuitDiagram
        circuit={step.circuitDiagram}
        onRegionPress={checked ? undefined : setPicked}
        selected={picked ? [picked] : []}
        correct={checked ? [step.correctComponent] : []}
        wrong={checked && !right && picked ? [picked] : []}
      />
      <Text style={t.hint}>
        {checked
          ? right
            ? `Right: ${regionLabel(step.circuitDiagram, step.correctComponent)}.`
            : `That one is ${regionLabel(step.circuitDiagram, step.correctComponent)}.`
          : picked
            ? `You picked ${regionLabel(step.circuitDiagram, picked)}.`
            : 'Tap the part on the diagram.'}
      </Text>
    </View>
  );
};

const SpotErrorStep: React.FC<Props & { step: StepSpotError }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
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
      <Text style={t.kicker}>SPOT THE ERROR</Text>
      <Text style={t.question}>{step.question}</Text>
      <CircuitDiagram
        circuit={step.circuitDiagram}
        onRegionPress={checked ? undefined : setPicked}
        selected={picked ? [picked] : []}
        correct={checked ? [step.correctRegion] : []}
        wrong={checked && !right && picked ? [picked] : []}
      />
      <Text style={t.hint}>
        {checked
          ? right
            ? `Right: ${regionLabel(step.circuitDiagram, step.correctRegion)}.`
            : `The fault is at ${regionLabel(step.circuitDiagram, step.correctRegion)}.`
          : picked
            ? `You picked ${regionLabel(step.circuitDiagram, picked)}.`
            : 'Tap the part that is wrong.'}
      </Text>
      {!!step.hint && !checked && !picked && <Text style={t.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

// ── Fix the circuit ────────────────────────────────────────────────────────
// Two moves: locate the fault, then choose the repair. Both must be right, so
// a learner cannot guess the fix without understanding where the problem is.
const FixCircuitStep: React.FC<Props & { step: StepFixCircuit }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const o = useOptionStyles();
  const t = useStepText();
  const s = useS();
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
      <Text style={t.kicker}>FIND IT, THEN FIX IT</Text>
      <Text style={t.question}>{step.question}</Text>
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
              style={[o.option, isPicked && !checked && o.optionPicked, reveal && (good ? o.optionRight : o.optionWrong)]}
            >
              <Text style={o.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!step.hint && !checked && <Text style={t.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

// ── Trace the current ──────────────────────────────────────────────────────
// Order matters: the learner taps each part in the order current reaches it,
// which is what distinguishes understanding a loop from naming its parts.
const TraceCurrentStep: React.FC<Props & { step: StepTraceCurrent }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
  const s = useS();
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
      <Text style={t.kicker}>TRACE THE CURRENT</Text>
      <Text style={t.question}>{step.question}</Text>
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
      {!checked && <Text style={t.hint}>Tap each part in order. Tap one again to take it back.</Text>}
      {checked && (
        <Text style={t.hint}>
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
  const o = useOptionStyles();
  const t = useStepText();
  const s = useS();
  const [placed, setPlaced] = useState<number[]>([]);

  useEffect(() => { setPlaced([]); }, [step]);
  const full = placed.length === step.slots;
  useEffect(() => {
    onCanCheck(full);
    registerGrader(!full ? null : () => onSubmit(gradeBuild(step.correct, step.slots, placed)));
    return () => registerGrader(null);
  }, [full, placed, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={t.kicker}>BUILD IT</Text>
      <Text style={t.question}>{step.instruction}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      <View style={s.pathRow}>
        {Array.from({ length: step.slots }).map((_, i) => {
          const partIdx = placed[i];
          const good = checked && buildSlotCorrect(step.correct, placed, i);
          const bad = checked && partIdx !== undefined && !good;
          return (
            <React.Fragment key={i}>
              {i > 0 && <Text style={s.pathArrow}>→</Text>}
              <Pressable
                disabled={checked || partIdx === undefined}
                onPress={() => setPlaced((prev) => clearSlot(prev, i))}
                style={[
                  s.pathSlot, partIdx !== undefined && s.pathSlotFilled,
                  good && o.optionRight, bad && o.optionWrong,
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

      {/* A part is not spent by being used: the same one may fill several slots,
          which is the web's rule and the only way an answer that needs two of a
          part can be given. The slots above show what has been placed, so
          nothing is lost by leaving every part available. */}
      <View style={s.tileWrap}>
        {step.palette.map((part, i) => (
          <Pressable
            key={`${part}-${i}`}
            disabled={checked || full}
            onPress={() => setPlaced((prev) => placePart(prev, step.slots, i))}
            style={[s.tile, full && s.tileUsed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: checked || full }}
            accessibilityLabel={full
              ? `${part}, every slot is filled`
              : `${part}, tap to put it in slot ${placed.length + 1}`}
          >
            <Text style={[s.tileText, full && s.tileTextUsed]}>{part}</Text>
          </Pressable>
        ))}
      </View>
      {!!step.hint && !checked && <Text style={t.hint}>Hint: {step.hint}</Text>}
    </View>
  );
};

/** A match row's photograph. Square, so rows of mixed parts stay aligned. */
const THUMB = 52;

const useS = makeStyles((colors) => ({
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, marginTop: 6, letterSpacing: -0.5 },
  spotCard: {
    marginTop: space.md, borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.md, ...curve,
    backgroundColor: colors.goldSoft, paddingHorizontal: space.md, paddingVertical: 12,
  },
  spotLabel: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  spotDetail: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 3, lineHeight: 19 },
  body: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: space.md, lineHeight: 24 },
  blank: { color: colors.blueDeep, fontFamily: font.black },
  stepLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.6,
    color: colors.inkSoft, marginTop: space.md, textTransform: 'uppercase',
  },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  pathArrow: { fontFamily: font.black, fontSize: type.body, color: colors.inkSoft },
  pathSlot: {
    flex: 1, minHeight: 46, borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md, ...curve,
    borderStyle: 'dashed', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pathSlotFilled: { borderStyle: 'solid', borderColor: colors.ink, backgroundColor: colors.goldSoft },
  pathSlotText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  pathSlotTextFilled: { color: colors.ink },
  input: {
    marginTop: space.md, borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 14,
    fontFamily: font.bold, fontSize: type.body, color: colors.ink,
  },
  tileWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md },
  tile: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999, ...curve,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%',
  },
  tileUsed: { backgroundColor: colors.line, borderColor: colors.line },
  tileText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  tileTextUsed: { color: colors.inkSoft },
  matchRow: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.surface, padding: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.md,
  },
  matchDone: { borderColor: colors.ink },
  matchLeft: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  matchRight: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 3 },
  board: {
    marginTop: space.md, backgroundColor: colors.surface, borderWidth: 2.5,
    borderColor: colors.ink, borderRadius: radius.md, ...curve, padding: space.sm,
  },
  undo: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, ...curve,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginTop: space.sm,
  },
  undoText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  drawTools: { flexDirection: 'row', gap: space.sm },
  grading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  orderNum: {
    fontFamily: font.black, fontSize: type.small, color: colors.onGold,
    width: 22, height: 22, borderRadius: 11, ...curve, backgroundColor: colors.gold,
    textAlign: 'center', lineHeight: 22, overflow: 'hidden',
  },
}));


// ── Draw a connection (tap two terminals) ──────────────────────────────────
const ConnectStep: React.FC<Props & { step: StepConnect }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
  const colors = useColors();
  const s = useS();
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
      <Text style={t.kicker}>WIRE IT UP</Text>
      <Text style={t.question}>{step.instruction}</Text>
      <Text style={t.hint}>Tap one terminal, then the one it connects to.</Text>

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
  step, checked, onSubmit, onUnassessed, onCanCheck, registerGrader, onDrawingChange,
}) => {
  const t = useStepText();
  const colors = useColors();
  const s = useS();
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
          // Unreachable grader. NOT onSubmit(true): telling a learner they were
          // right about a drawing nobody looked at is a lie, and it paid a
          // flawless run for a network blip. NOT an error that blocks them
          // either, which is what the browser did, because a quiz-engine outage
          // then made every drawing lesson unfinishable. Neither wrong nor
          // right: it simply was not checked, and the run stops being eligible
          // for "perfect".
          setNote('Could not reach the grader, so this drawing was not checked. It will not count against you.');
          onUnassessed();
          return;
        }
        setNote(verdict.feedback || null);
        onSubmit(verdict.correct);
      } catch {
        setNote('Could not read the drawing, so this one was not checked. It will not count against you.');
        onUnassessed();
      } finally {
        setGrading(false);
      }
    });
    return () => registerGrader(null);
  }, [hasInk, grading, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={t.kicker}>DRAW IT</Text>
      <Text style={t.question}>{step.instruction}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      <View ref={shotRef} collapsable={false} style={{ marginTop: space.md }}>
        <DrawCanvas ref={canvasRef} onInkChange={setHasInk} onDrawingChange={onDrawingChange} height={280} />
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
          <Text style={t.hint}>Looking at your drawing…</Text>
        </View>
      )}

      {!!note && <Text style={t.hint}>{note}</Text>}
      {!!step.hint && !checked && !grading && <Text style={t.hint}>Hint: {step.hint}</Text>}
      {!drawingGraderConfigured() && (
        <Text style={t.hint}>Drawing feedback is unavailable right now; your attempt still counts.</Text>
      )}
    </View>
  );
};
