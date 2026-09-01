import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CircuitDiagram } from '../components/circuits/CircuitDiagram';
import { ComponentPhoto, isComponentImagePath, useAssetVersion, type PhotoPhase } from './componentArt';
import { OptionList } from './optionList';
import { shuffledOrder } from './optionOrder';
import { useStepText } from './stepText';
import { curve, font, radius, space, type } from '../theme/tokens';
import type { StepChoice, StepProps as Props } from './types';
import { makeStyles, useColors } from '../theme/theme';

/**
 * A multiple_choice step whose options are photographs of real parts.
 *
 * 26 of the 420 in the corpus carry `optionImages`, four published photographs
 * aligned to the four options. Every one of them asks "Tap the LED", "Tap the
 * resistor", "Tap the servo motor", and every one of them lists the answer word
 * for word among its options, with `correct` at index 0. Drawn as a plain list
 * of words, which is what mobile did until now, the step is not a question: it
 * is a prompt naming its own answer, sitting on top of a button carrying that
 * same word. The photograph IS the question, and telling a servo from a DC
 * motor by looking at one is the skill being taught.
 */
export type StepImageChoice = StepChoice & { optionImages: string[] };

/**
 * True when the step really is a picture question. It has to line up exactly:
 * one publishable path per option, and as many paths as options, or the picture
 * under a label is the wrong part. A step that does not line up renders as an
 * ordinary choice list rather than a mismatched grid.
 */
export function hasOptionImages(step: StepChoice): step is StepImageChoice {
  const images = (step as Partial<StepImageChoice>).optionImages;
  return Array.isArray(images)
    && Array.isArray(step.options)
    && images.length === step.options.length
    && images.every(isComponentImagePath);
}

/** How tall a photograph sits in its card. Two cards fit a phone width at this. */
const PHOTO_H = 116;
/** Reserved for the name, so revealing it after the check moves nothing. */
const LABEL_H = 22;
/**
 * A photograph that has not settled by now counts as failed. Without a deadline
 * a half-open connection leaves a learner looking at four pulsing plates with no
 * way forward: every card is untappable until its own photograph is ready, so
 * nothing is picked, so the shell's Check button stays disabled. The deadline is
 * the only thing that unblocks that, which is what sets its length.
 *
 * Long, and deliberately so. The two failures it has to tell apart behave
 * nothing alike. A device with no connectivity does not hang: the request fails
 * in about a second and `onError` degrades the step immediately, without ever
 * reaching this. What is left is a connection that is WORKING and slow, and the
 * published files are 170 KB to 1.1 MB with four of them per step (see
 * componentArt.tsx on why there is no downscaled derivative yet). A short
 * deadline does not protect that learner, it robs them: every one of these 26
 * prompts names its own answer, so degrading to words turns the exercise into a
 * giveaway. Waiting costs a slow learner some seconds; giving up early costs
 * them the question.
 */
const SETTLE_DEADLINE_MS = 20000;

export const ImageChoiceStep: React.FC<Props & { step: StepImageChoice }> = ({
  step, checked, onSubmit, onCanCheck, registerGrader,
}) => {
  const t = useStepText();
  const s = useS();
  const [picked, setPicked] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [phases, setPhases] = useState<PhotoPhase[]>(() => step.optionImages.map(() => 'loading'));

  const options = step.options;
  const order = useMemo(() => shuffledOrder(options.length), [step, options.length]);

  useEffect(() => { setPicked(null); setAttempt(0); }, [step]);
  useEffect(() => { setPhases(step.optionImages.map(() => 'loading')); }, [step, attempt]);

  // One stable reporter per option, so ComponentPhoto never has to be told which
  // index it is and the parent never re-creates callbacks mid-load.
  const reporters = useMemo(
    () => step.optionImages.map((_, i) => (phase: PhotoPhase) => {
      setPhases((cur) => (cur[i] === phase ? cur : cur.map((p, j) => (j === i ? phase : p))));
    }),
    [step],
  );

  const settling = phases.some((p) => p === 'loading');
  const failing = phases.some((p) => p === 'failed');

  // Which of the two the step IS, frozen at the moment it is checked. Without
  // the freeze, a picture that gives up while the answer is being reviewed would
  // rearrange the question the learner is reading the verdict on.
  const [degraded, setDegraded] = useState(false);
  useEffect(() => { if (!checked) setDegraded(failing); }, [failing, checked]);

  // The deadline has to measure the photographs settling, and until the content
  // version resolves there is no URL to fetch and no photograph has started. On
  // a device with no cached manifest that resolution is a network round trip, so
  // a clock started at mount spends its budget on the bootstrap and then blames
  // the pictures for not arriving. `addressed` restarts it the moment they
  // become fetchable. It is a dependency rather than a guard on purpose: while
  // the version is still unknown a timer runs anyway, so a resolution that never
  // returns degrades to words instead of leaving the learner with no way on.
  const addressed = useAssetVersion() !== undefined;
  useEffect(() => {
    if (!settling || checked) return;
    const timer = setTimeout(
      () => setPhases((cur) => cur.map((p) => (p === 'loading' ? 'failed' : p))),
      SETTLE_DEADLINE_MS,
    );
    return () => clearTimeout(timer);
  }, [settling, checked, addressed, attempt, step]);

  useEffect(() => {
    onCanCheck(picked !== null);
    registerGrader(picked === null ? null : () => onSubmit(picked === step.correct));
    return () => registerGrader(null);
  }, [picked, step, onCanCheck, registerGrader, onSubmit]);

  return (
    <View>
      <Text style={t.kicker}>{degraded ? 'QUESTION' : 'PICK THE PART'}</Text>
      <Text style={t.question}>{step.question}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      {degraded ? (
        // The deliberate fallback. Words are an easier question than photographs
        // here, because the prompt names the part it is asking for, and that is
        // accepted knowingly: a learner whose pictures will not arrive gets an
        // answerable step rather than a dead one, exactly as a drawing counts as
        // complete when the grader is unreachable. The selection survives the
        // switch, and so does the way back.
        <>
          <OptionList
            options={options}
            order={order}
            picked={picked}
            correct={step.correct}
            checked={checked}
            onPick={setPicked}
          />
          <View style={s.notice}>
            <Text style={s.noticeText}>The pictures could not be loaded, so this one is in words.</Text>
            {!checked && (
              <Pressable
                onPress={() => setAttempt((n) => n + 1)}
                accessibilityRole="button"
                style={({ pressed }) => [s.retry, pressed && s.retryPressed]}
              >
                <Text style={s.retryText}>Try the pictures again</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={s.grid}>
            {order.map((originalIndex) => {
              const opt = options[originalIndex];
              const phase = phases[originalIndex];
              const isPicked = picked === originalIndex;
              const reveal = checked && (originalIndex === step.correct || isPicked);
              const good = checked && originalIndex === step.correct;
              return (
                <Pressable
                  key={`${opt}-${originalIndex}`}
                  disabled={checked || phase !== 'ready'}
                  onPress={() => setPicked(originalIndex)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isPicked, disabled: checked || phase !== 'ready' }}
                  // The name is the answer, so it is not DRAWN until the learner
                  // has answered. It is the accessible name from the start, and
                  // that is a decision rather than an oversight: a photograph
                  // with no accessible name is a question a screen reader user
                  // cannot answer at all, and an easier question beats an
                  // impossible one. The web card makes the same call.
                  accessibilityLabel={opt}
                  style={({ pressed }) => [
                    s.card,
                    isPicked && !checked && s.cardPicked,
                    reveal && (good ? s.cardRight : s.cardWrong),
                    pressed && !checked && phase === 'ready' && s.cardPressed,
                  ]}
                >
                  <ComponentPhoto
                    path={step.optionImages[originalIndex]}
                    height={PHOTO_H}
                    attempt={attempt}
                    onPhase={reporters[originalIndex]}
                  />
                  <View style={s.labelRow}>
                    {checked && <Text style={s.label} numberOfLines={1}>{opt}</Text>}
                    {reveal && <Mark good={good} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {settling && <Text style={t.hint}>Loading the pictures.</Text>}
        </>
      )}
    </View>
  );
};

/**
 * The verdict on a card. Drawn on the same 24 unit grid at the same 2.2 stroke
 * as components/icons.tsx, so it sits beside the rest of the app's line work
 * rather than arriving from a different drawing.
 */
const Mark: React.FC<{ good: boolean }> = ({ good }) => {
  const colors = useColors();
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d={good ? 'M5 12.5 10 17.5 19 7' : 'M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5'}
        fill="none"
        stroke={good ? colors.greenDeep : colors.red}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const useS = makeStyles((colors, th) => ({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    rowGap: space.sm, marginTop: space.md,
  },
  card: {
    width: '48.5%', borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.lg, ...curve,
    backgroundColor: colors.surface, padding: space.sm, ...th.elevation.card,
  },
  cardPicked: { borderColor: colors.ink, backgroundColor: colors.goldSoft },
  cardRight: { borderColor: colors.greenDeep, backgroundColor: colors.greenSoft },
  cardWrong: { borderColor: colors.red, backgroundColor: colors.redSoft },
  cardPressed: { transform: [{ scale: 0.97 }] },
  labelRow: {
    height: LABEL_H, marginTop: 6, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  label: {
    flexShrink: 1, fontFamily: font.black, fontSize: type.small, color: colors.ink, textAlign: 'center',
  },
  notice: {
    marginTop: space.md, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.cream, paddingHorizontal: space.md, paddingVertical: 12, gap: space.sm,
    alignItems: 'flex-start',
  },
  noticeText: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft },
  retry: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, ...curve,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  retryPressed: { backgroundColor: colors.goldSoft },
  retryText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
}));
