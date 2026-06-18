import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Heart, Lightbulb, RotateCcw, X, Zap } from 'lucide-react';
import CircuitDiagram, { type CircuitId } from '../../CircuitDiagram';
import { LESSON_CONTENT, type LessonStep } from '../data/lessons';
import { findLesson } from '../data/curriculum';

/**
 * LessonRunner — the interactive lesson engine for the new workspace.
 *
 * Renders the authored steps in LESSON_CONTENT for a given lesson id, one at a
 * time, Duolingo-style: a progress bar, hearts, an exercise, then a check /
 * continue rhythm. Supports every authored step type. On completion it reports
 * the earned XP and the lesson id back so the workspace can persist progress.
 */

interface LessonRunnerProps {
  lessonId: string;
  /** Accent hex for the lesson's unit (progress + correct states). */
  accent: string;
  onExit: () => void;
  onComplete: (lessonId: string, xp: number) => void;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Steps that just teach (no answer to check) advance straight to "Continue".
const isTeach = (s: LessonStep) => s.type === 'teach';

export const LessonRunner: React.FC<LessonRunnerProps> = ({ lessonId, accent, onExit, onComplete }) => {
  const lesson = findLesson(lessonId);
  const content = LESSON_CONTENT[lessonId];
  const steps = content?.steps ?? [];

  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  // Per-step answer state (reset on step change).
  const [choice, setChoice] = useState<number | null>(null);
  const [tf, setTf] = useState<boolean | null>(null);
  const [fill, setFill] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [matchSel, setMatchSel] = useState<{ side: 'l' | 'r'; idx: number } | null>(null);
  const [rightOrder, setRightOrder] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<Array<[string, string]>>([]);
  const [drawSel, setDrawSel] = useState<string | null>(null);

  const step = steps[stepIndex];

  // Initialise interactive layouts when the step changes.
  useEffect(() => {
    setChecked(false);
    setCorrect(null);
    setChoice(null);
    setTf(null);
    setFill('');
    setRegion(null);
    setMatched(new Set());
    setMatchSel(null);
    setDrawn([]);
    setDrawSel(null);
    if (step?.type === 'drag_order') setOrder(shuffle(step.items.map((_, i) => i)));
    if (step?.type === 'match') setRightOrder(shuffle(step.pairs.map((_, i) => i)));
  }, [stepIndex, step]);

  const progress = steps.length ? Math.round((stepIndex / steps.length) * 100) : 0;

  if (!lesson || !content) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ohmlet-cream px-6 text-center">
        <p className="text-lg font-black text-ohmlet-ink">That lesson is not ready yet.</p>
        <button onClick={onExit} className="rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 font-black shadow-press-sm">
          Back to the path
        </button>
      </div>
    );
  }

  // ── Answer validation ──
  const evaluate = (): boolean => {
    switch (step.type) {
      case 'multiple_choice':
      case 'predict_reading':
      case 'predict_behavior':
      case 'choose_resistor':
        return choice === step.correct;
      case 'true_false':
        return tf === step.correct;
      case 'fill_blank':
        return fill.trim().toLowerCase() === step.answer.trim().toLowerCase();
      case 'spot_error':
        return region === step.correctRegion;
      case 'identify_component':
        return region === step.correctComponent;
      case 'drag_order':
        return order.every((v, i) => v === step.correctOrder[i]);
      case 'match':
        return matched.size === step.pairs.length;
      case 'draw_connection': {
        const norm = (c: [string, string]) => [...c].sort().join('|');
        const want = new Set(step.expectedConnections.map(norm));
        const have = new Set(drawn.map(norm));
        return want.size === have.size && [...want].every((c) => have.has(c));
      }
      default:
        return true;
    }
  };

  const canCheck = (): boolean => {
    switch (step.type) {
      case 'multiple_choice':
      case 'predict_reading':
      case 'predict_behavior':
      case 'choose_resistor':
        return choice !== null;
      case 'true_false':
        return tf !== null;
      case 'fill_blank':
        return fill.trim().length > 0;
      case 'spot_error':
      case 'identify_component':
        return region !== null;
      case 'draw_connection':
        return drawn.length > 0;
      default:
        return true;
    }
  };

  const handleCheck = () => {
    const ok = evaluate();
    setCorrect(ok);
    setChecked(true);
    if (!ok) setHearts((h) => Math.max(0, h - 1));
  };

  const handleContinue = () => {
    if (stepIndex + 1 >= steps.length) {
      setDone(true);
      onComplete(lessonId, content.xpReward);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const retry = () => {
    setStepIndex(0);
    setHearts(3);
    setDone(false);
    setChecked(false);
    setCorrect(null);
  };

  // ── Completion screen ──
  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ohmlet-cream px-6">
        <div className="ohmlet-rise w-full max-w-md rounded-[2rem] border-[3px] border-ohmlet-ink bg-white p-10 text-center shadow-press">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-ohmlet-ink bg-ohmlet-gold shadow-press-sm">
            <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="h-16 w-auto" draggable={false} />
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight">Lesson complete!</h2>
          <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">{lesson.title}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft px-5 py-3">
            <Zap className="h-5 w-5 text-ohmlet-gold-deep" fill="currentColor" />
            <span className="text-lg font-black">+{content.xpReward} XP</span>
          </div>
          <button
            onClick={onExit}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 text-base font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            Back to the path
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Out of hearts ──
  if (hearts === 0 && checked && correct === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ohmlet-cream px-6">
        <div className="w-full max-w-md rounded-[2rem] border-[3px] border-ohmlet-ink bg-white p-10 text-center shadow-press">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ohmlet-ink bg-[#fdece8]">
            <Heart className="h-9 w-9 text-ohmlet-red" fill="currentColor" />
          </div>
          <h2 className="mt-6 text-2xl font-black tracking-tight">Out of hearts</h2>
          <p className="mt-2 text-sm font-semibold text-ohmlet-ink-soft">
            Take a breath and run it again. Repetition is how the concepts stick.
          </p>
          <button onClick={retry} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none">
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <button onClick={onExit} className="mt-3 text-sm font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
            Leave lesson
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ohmlet-cream">
      {/* Top bar: exit · progress · hearts */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-ohmlet-line bg-ohmlet-cream/90 px-5 py-4 backdrop-blur md:px-8">
        <button onClick={onExit} className="shrink-0 rounded-full p-1.5 text-ohmlet-ink-soft transition-colors hover:bg-ohmlet-line hover:text-ohmlet-ink" aria-label="Exit lesson">
          <X className="h-6 w-6" />
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-ohmlet-line">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: accent }} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Heart className="h-5 w-5 text-ohmlet-red" fill="currentColor" />
          <span className="text-base font-black tabular-nums">{hearts}</span>
        </div>
      </div>

      {/* Step body */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 md:px-0">
        <StepView
          step={step}
          accent={accent}
          checked={checked}
          choice={choice}
          setChoice={setChoice}
          tf={tf}
          setTf={setTf}
          fill={fill}
          setFill={setFill}
          region={region}
          setRegion={setRegion}
          order={order}
          setOrder={setOrder}
          matched={matched}
          setMatched={setMatched}
          matchSel={matchSel}
          setMatchSel={setMatchSel}
          rightOrder={rightOrder}
          drawn={drawn}
          setDrawn={setDrawn}
          drawSel={drawSel}
          setDrawSel={setDrawSel}
        />
      </div>

      {/* Footer: feedback + action */}
      <div
        className={`border-t-2 px-5 py-5 transition-colors md:px-8 ${
          checked ? (correct ? 'border-ohmlet-green bg-[#f1f9e6]' : 'border-ohmlet-red bg-[#fdece8]') : 'border-ohmlet-line bg-white'
        }`}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
          {checked ? (
            <Feedback step={step} correct={correct} />
          ) : (
            <span className="text-sm font-semibold text-ohmlet-ink-soft">
              {isTeach(step) ? 'Read, then continue.' : 'Pick your answer.'}
            </span>
          )}
          {isTeach(step) || checked ? (
            <button
              onClick={handleContinue}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3 text-base font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
            >
              {stepIndex + 1 >= steps.length ? 'Finish' : 'Continue'}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleCheck}
              disabled={!canCheck()}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3 text-base font-black shadow-press transition-all enabled:hover:translate-y-[3px] enabled:hover:shadow-none disabled:cursor-not-allowed disabled:border-ohmlet-line disabled:bg-ohmlet-line disabled:text-ohmlet-ink/40 disabled:shadow-none"
            >
              Check
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Feedback line ──
const Feedback: React.FC<{ step: LessonStep; correct: boolean | null }> = ({ step, correct }) => {
  const explanation =
    'explanation' in step ? step.explanation : correct ? 'Nice work.' : 'Not quite. Review it and keep going.';
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${correct ? 'bg-ohmlet-green' : 'bg-ohmlet-red'} text-white`}>
        {correct ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
      </span>
      <div>
        <p className={`text-sm font-black ${correct ? 'text-ohmlet-green-deep' : 'text-ohmlet-red'}`}>
          {correct ? 'Correct!' : 'Not quite'}
        </p>
        <p className="text-sm font-semibold leading-snug text-ohmlet-ink">{explanation}</p>
      </div>
    </div>
  );
};

// ── Step renderer ──
interface StepViewProps {
  step: LessonStep;
  accent: string;
  checked: boolean;
  choice: number | null;
  setChoice: (n: number) => void;
  tf: boolean | null;
  setTf: (b: boolean) => void;
  fill: string;
  setFill: (s: string) => void;
  region: string | null;
  setRegion: (s: string) => void;
  order: number[];
  setOrder: (o: number[]) => void;
  matched: Set<number>;
  setMatched: (s: Set<number>) => void;
  matchSel: { side: 'l' | 'r'; idx: number } | null;
  setMatchSel: (s: { side: 'l' | 'r'; idx: number } | null) => void;
  rightOrder: number[];
  drawn: Array<[string, string]>;
  setDrawn: (d: Array<[string, string]>) => void;
  drawSel: string | null;
  setDrawSel: (s: string | null) => void;
}

const StepView: React.FC<StepViewProps> = (p) => {
  const { step, accent, checked } = p;

  switch (step.type) {
    case 'teach':
      return (
        <div className="ohmlet-rise">
          <h2 className="text-3xl font-black tracking-[-0.02em]">{step.title}</h2>
          <p className="mt-4 whitespace-pre-line text-lg font-medium leading-relaxed text-ohmlet-ink-soft">{step.body}</p>
          {step.circuitDiagram && (
            <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
              <CircuitDiagram circuit={step.circuitDiagram as CircuitId} showCurrentFlow={step.showCurrentFlow} className="mx-auto w-full max-w-xl" />
            </div>
          )}
        </div>
      );

    case 'multiple_choice':
      return <ChoiceStep {...p} step={step} />;

    // Prediction family: commit a prediction, then the circuit reveals the truth.
    case 'predict_reading':
      return <ChoiceStep {...p} step={step} eyebrow="Predict the reading" />;
    case 'predict_behavior':
      return <ChoiceStep {...p} step={step} eyebrow="Predict what happens" />;
    case 'choose_resistor':
      return <ChoiceStep {...p} step={step} eyebrow="Choose the component" />;

    case 'true_false':
      return (
        <div className="ohmlet-rise">
          <Prompt>{step.statement}</Prompt>
          {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} />}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[true, false].map((val) => {
              const sel = p.tf === val;
              const reveal = checked && val === step.correct;
              const wrong = checked && sel && val !== step.correct;
              return (
                <Option key={String(val)} selected={sel} reveal={reveal} wrong={wrong} disabled={checked} onClick={() => p.setTf(val)} center>
                  {val ? 'True' : 'False'}
                </Option>
              );
            })}
          </div>
        </div>
      );

    case 'fill_blank':
      return (
        <div className="ohmlet-rise">
          <Prompt>{step.prompt}</Prompt>
          {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} />}
          <input
            value={p.fill}
            onChange={(e) => p.setFill(e.target.value)}
            disabled={checked}
            placeholder="Type your answer"
            className="mt-6 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-white px-5 py-4 text-lg font-black text-ohmlet-ink shadow-press-sm outline-none focus:border-ohmlet-gold-deep disabled:opacity-70"
          />
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ohmlet-ink-soft">
            <Lightbulb className="h-4 w-4 text-ohmlet-gold-deep" /> {step.hint}
          </p>
        </div>
      );

    case 'match':
      return <MatchStep {...p} step={step} />;

    case 'drag_order':
      return <OrderStep {...p} step={step} />;

    case 'spot_error':
    case 'identify_component':
      return (
        <div className="ohmlet-rise">
          <Prompt>{'question' in step ? step.question : ''}</Prompt>
          <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
            <CircuitDiagram
              circuit={step.circuitDiagram as CircuitId}
              clickable={!checked}
              onRegionClick={(id) => p.setRegion(id)}
              highlightRegion={p.region}
              correctRegion={checked ? (step.type === 'spot_error' ? step.correctRegion : step.correctComponent) : null}
              className="mx-auto w-full max-w-xl"
            />
          </div>
          {!p.region && <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">Tap a part of the circuit.</p>}
        </div>
      );

    case 'draw_connection':
      return <DrawStep {...p} step={step} />;

    default:
      return null;
  }
};

// ── Shared primitives ──
const Prompt: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-2xl font-black leading-snug tracking-tight md:text-3xl">{children}</h2>
);

const Diagram: React.FC<{ circuit: string }> = ({ circuit }) => (
  <div className="mt-5 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
    <CircuitDiagram circuit={circuit as CircuitId} className="mx-auto w-full max-w-xl" />
  </div>
);

const Option: React.FC<{
  children: React.ReactNode;
  selected: boolean;
  reveal?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  center?: boolean;
  onClick: () => void;
}> = ({ children, selected, reveal, wrong, disabled, center, onClick }) => {
  let look = 'border-ohmlet-line bg-white hover:border-ohmlet-ink';
  if (reveal) look = 'border-ohmlet-green bg-[#f1f9e6]';
  else if (wrong) look = 'border-ohmlet-red bg-[#fdece8]';
  else if (selected) look = 'border-ohmlet-ink bg-ohmlet-gold-soft';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left text-base font-bold text-ohmlet-ink shadow-soft transition-all ${look} ${
        center ? 'justify-center' : ''
      } ${disabled ? '' : 'hover:-translate-y-0.5'}`}
    >
      {(reveal || wrong) && (
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${reveal ? 'bg-ohmlet-green' : 'bg-ohmlet-red'} text-white`}>
          {reveal ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
        </span>
      )}
      {children}
    </button>
  );
};

// ── Choice step (multiple_choice + the prediction family) ──
// All share question + options + correct + optional circuit. The eyebrow reframes
// it as a prediction ("Predict the reading"), which is what makes predict_* feel
// distinct from a plain quiz: you commit, then the answer + explanation reveal.
const ChoiceStep: React.FC<
  { step: { question: string; options: string[]; correct: number; circuitDiagram?: string }; eyebrow?: string } & StepViewProps
> = ({ step, eyebrow, choice, setChoice, checked }) => (
  <div className="ohmlet-rise">
    {eyebrow && <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">{eyebrow}</p>}
    <Prompt>{step.question}</Prompt>
    {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} />}
    <div className="mt-6 grid gap-3">
      {step.options.map((opt, i) => {
        const sel = choice === i;
        const reveal = checked && i === step.correct;
        const wrong = checked && sel && i !== step.correct;
        return (
          <Option key={opt} selected={sel} reveal={reveal} wrong={wrong} disabled={checked} onClick={() => setChoice(i)}>
            {opt}
          </Option>
        );
      })}
    </div>
  </div>
);

// ── Match step ──
const MatchStep: React.FC<{ step: Extract<LessonStep, { type: 'match' }> } & StepViewProps> = ({
  step,
  matched,
  setMatched,
  matchSel,
  setMatchSel,
  rightOrder,
}) => {
  const select = (side: 'l' | 'r', idx: number) => {
    if (matched.has(idx)) return;
    if (!matchSel) {
      setMatchSel({ side, idx });
      return;
    }
    if (matchSel.side === side) {
      setMatchSel({ side, idx });
      return;
    }
    // Pair: a left index always corresponds to the same pair index.
    const leftIdx = side === 'l' ? idx : matchSel.idx;
    const rightIdx = side === 'r' ? idx : matchSel.idx;
    if (leftIdx === rightIdx) {
      setMatched(new Set([...matched, leftIdx]));
    }
    setMatchSel(null);
  };

  return (
    <div className="ohmlet-rise">
      <Prompt>{step.instruction}</Prompt>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          {step.pairs.map(([left], i) => {
            const on = matched.has(i);
            const sel = matchSel?.side === 'l' && matchSel.idx === i;
            return (
              <button
                key={left}
                disabled={on}
                onClick={() => select('l', i)}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all ${
                  on ? 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-green-deep' : sel ? 'border-ohmlet-ink bg-ohmlet-gold-soft' : 'border-ohmlet-line bg-white hover:border-ohmlet-ink'
                }`}
              >
                {left}
              </button>
            );
          })}
        </div>
        <div className="space-y-3">
          {rightOrder.map((pairIdx) => {
            const right = step.pairs[pairIdx][1];
            const on = matched.has(pairIdx);
            const sel = matchSel?.side === 'r' && matchSel.idx === pairIdx;
            return (
              <button
                key={right}
                disabled={on}
                onClick={() => select('r', pairIdx)}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all ${
                  on ? 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-green-deep' : sel ? 'border-ohmlet-ink bg-ohmlet-gold-soft' : 'border-ohmlet-line bg-white hover:border-ohmlet-ink'
                }`}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-sm font-semibold text-ohmlet-ink-soft">
        {matched.size}/{step.pairs.length} matched. Tap a term, then its definition.
      </p>
    </div>
  );
};

// ── Drag-order step (click to move, no native DnD for reliability) ──
const OrderStep: React.FC<{ step: Extract<LessonStep, { type: 'drag_order' }> } & StepViewProps> = ({
  step,
  order,
  setOrder,
  checked,
}) => {
  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };
  return (
    <div className="ohmlet-rise">
      <Prompt>{step.instruction}</Prompt>
      <ol className="mt-6 space-y-3">
        {order.map((itemIdx, pos) => {
          const correctHere = checked && step.correctOrder[pos] === itemIdx;
          const wrongHere = checked && step.correctOrder[pos] !== itemIdx;
          return (
            <li
              key={itemIdx}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-soft transition-colors ${
                correctHere ? 'border-ohmlet-green bg-[#f1f9e6]' : wrongHere ? 'border-ohmlet-red bg-[#fdece8]' : 'border-ohmlet-line bg-white'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ohmlet-ink text-xs font-black text-white">{pos + 1}</span>
              <span className="flex-1 text-sm font-bold text-ohmlet-ink">{step.items[itemIdx]}</span>
              {!checked && (
                <span className="flex flex-col">
                  <button onClick={() => move(pos, -1)} disabled={pos === 0} className="px-1.5 text-ohmlet-ink-soft hover:text-ohmlet-ink disabled:opacity-20" aria-label="Move up">▲</button>
                  <button onClick={() => move(pos, 1)} disabled={pos === order.length - 1} className="px-1.5 text-ohmlet-ink-soft hover:text-ohmlet-ink disabled:opacity-20" aria-label="Move down">▼</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

// ── Draw-connection step ──
const DrawStep: React.FC<{ step: Extract<LessonStep, { type: 'draw_connection' }> } & StepViewProps> = ({
  step,
  drawn,
  setDrawn,
  drawSel,
  setDrawSel,
  checked,
}) => {
  const W = 380;
  const H = 290;
  const term = (id: string) => step.terminals.find((t) => t.id === id)!;

  const tap = (id: string) => {
    if (checked) return;
    if (!drawSel) {
      setDrawSel(id);
      return;
    }
    if (drawSel === id) {
      setDrawSel(null);
      return;
    }
    const pair: [string, string] = [drawSel, id];
    const exists = drawn.some((c) => [...c].sort().join('|') === [...pair].sort().join('|'));
    setDrawn(exists ? drawn.filter((c) => [...c].sort().join('|') !== [...pair].sort().join('|')) : [...drawn, pair]);
    setDrawSel(null);
  };

  return (
    <div className="ohmlet-rise">
      <Prompt>{step.instruction}</Prompt>
      <div className="mt-6 flex justify-center rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md">
          {drawn.map(([a, b], i) => {
            const ta = term(a);
            const tb = term(b);
            return <line key={i} x1={ta.x} y1={ta.y} x2={tb.x} y2={tb.y} stroke="#facc2e" strokeWidth={4} strokeLinecap="round" />;
          })}
          {step.terminals.map((t) => {
            const sel = drawSel === t.id;
            const connected = drawn.some((c) => c.includes(t.id));
            return (
              <g key={t.id} onClick={() => tap(t.id)} className={checked ? '' : 'cursor-pointer'}>
                <circle cx={t.x} cy={t.y} r={16} fill={sel ? '#facc2e' : connected ? '#14201e' : '#fff'} stroke="#14201e" strokeWidth={3} />
                <text x={t.x} y={t.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={sel || connected ? (sel ? '#14201e' : '#fff') : '#14201e'}>
                  {t.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">
        Tap two terminals to wire them. {drawn.length} connection{drawn.length === 1 ? '' : 's'} drawn.
      </p>
    </div>
  );
};
