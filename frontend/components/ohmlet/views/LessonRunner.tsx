import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Eraser, Heart, Pencil, RotateCcw, Trash2, X, Zap } from 'lucide-react';
import CircuitDiagram from '../../CircuitDiagram';
import { LESSON_CONTENT, type LessonStep } from '../data/lessons';
import { findLesson } from '../data/curriculum';
import { LEVEL_META, buildLeveledSteps, heartsForLevel, xpForLevel } from '../data/levels';
import { assessDrawing } from '../../../services/quizEngineClient';

const QUIZ_API_ROOT = (import.meta.env.VITE_OHMLET_QUIZ_API_BASE_URL as string) || 'http://localhost:8083';

/**
 * LessonRunner — the interactive lesson engine for the new workspace.
 *
 * Renders the authored steps in LESSON_CONTENT for a given lesson id, one at a
 * time, Duolingo-style: a progress bar, hearts, an exercise, then a check /
 * continue rhythm. Supports every authored step type. On completion it reports
 * the earned XP, the level reached, and the lesson id back so the workspace can
 * persist progress. The `level` prop (Bronze/Silver/Gold) controls difficulty:
 * higher levels strip teach steps and shuffle for a harder pure-recall run.
 */

interface LessonRunnerProps {
  lessonId: string;
  /** Accent hex for the lesson's unit (progress + correct states). */
  accent: string;
  /** The level being attempted: 1 Bronze, 2 Silver, 3 Gold. Defaults to 1. */
  level?: number;
  /** Review mode (the /author preview): adds a Skip control so a reviewer can step
   *  through every question without answering. Never set in the learner flow. */
  preview?: boolean;
  onExit: () => void;
  onComplete: (lessonId: string, xp: number, level: number) => void;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// A shuffled [0..n-1] that is NOT the original order, so a match column never
// renders in its authored sequence (which would line the answers up diagonally).
const shuffledOrder = (n: number): number[] => {
  const ident = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return ident;
  let out = shuffle(ident);
  for (let t = 0; t < 12 && out.every((v, i) => v === i); t++) out = shuffle(ident);
  return out;
};

// Steps that just teach (no answer to check) advance straight to "Continue".
const isTeach = (s: LessonStep) => s.type === 'teach';

export const LessonRunner: React.FC<LessonRunnerProps> = ({ lessonId, accent, level = 1, preview = false, onExit, onComplete }) => {
  const lesson = findLesson(lessonId);
  const content = LESSON_CONTENT[lessonId];
  // Steps are transformed for the attempted level (Bronze = as authored;
  // Silver/Gold = teach dropped + shuffled). Rebuilt only when lesson/level change.
  const steps = useMemo(() => buildLeveledSteps(content?.steps ?? [], level), [content, level]);
  const levelMeta = LEVEL_META[Math.min(3, Math.max(1, level)) as 1 | 2 | 3];

  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(() => heartsForLevel(level));
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  // Per-step answer state (reset on step change).
  const [choice, setChoice] = useState<number | null>(null);
  const [tf, setTf] = useState<boolean | null>(null);
  const [fill, setFill] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set()); // completed LEFT pair indices
  const [matchedRights, setMatchedRights] = useState<Set<number>>(new Set()); // consumed RIGHT chip indices
  const [matchSel, setMatchSel] = useState<{ side: 'l' | 'r'; idx: number } | null>(null);
  const [leftOrder, setLeftOrder] = useState<number[]>([]);
  const [rightOrder, setRightOrder] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<Array<[string, string]>>([]);
  const [drawSel, setDrawSel] = useState<string | null>(null);
  const [traced, setTraced] = useState<string[]>([]); // trace_current: tapped regions in order
  const [placed, setPlaced] = useState<number[]>([]); // build_to_spec: palette index in each filled slot
  const [revealed, setRevealed] = useState<Set<string>>(new Set()); // teach hotspots explored
  const [asyncMsg, setAsyncMsg] = useState<string | null>(null); // dynamic feedback from a graded draw_circuit
  const [tileSeq, setTileSeq] = useState<number[]>([]); // fill_blank tile-assembly: tile indices in placed order
  const [meterVal, setMeterVal] = useState<number | null>(null); // predict_reading meter: dialed-in reading
  const [bands, setBands] = useState<number[]>([0, 0, 0]); // choose_resistor: [digit1, digit2, multiplier] colour indices

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
    setMatchedRights(new Set());
    setMatchSel(null);
    setDrawn([]);
    setDrawSel(null);
    setTraced([]);
    setPlaced([]);
    setRevealed(new Set());
    setAsyncMsg(null);
    setTileSeq([]);
    setMeterVal(null);
    setBands([0, 0, 0]);
    if (step?.type === 'drag_order') setOrder(shuffle(step.items.map((_, i) => i)));
    if (step?.type === 'match') {
      // Shuffle BOTH columns (each off its original order) so answers never line
      // up as a straight diagonal.
      setLeftOrder(shuffledOrder(step.pairs.length));
      setRightOrder(shuffledOrder(step.pairs.length));
    }
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
      case 'predict_behavior':
        return choice === step.correct;
      case 'predict_reading':
        if (step.meter) return meterVal !== null && Math.abs(meterVal - step.meter.target) <= step.meter.tolerance;
        return choice === step.correct;
      case 'choose_resistor':
        if (step.bands) return (bands[0] * 10 + bands[1]) * 10 ** bands[2] === step.bands.targetOhms;
        return choice === step.correct;
      case 'true_false':
        return tf === step.correct;
      case 'fill_blank': {
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        if (step.tiles && step.tiles.length) return norm(tileSeq.map((i) => step.tiles![i]).join(' ')) === norm(step.answer);
        return norm(fill) === norm(step.answer);
      }
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
      case 'trace_current':
        return traced.length === step.correctPath.length && traced.every((r, i) => r === step.correctPath[i]);
      case 'fix_the_circuit':
        return region === step.faultRegion && choice === step.correctFix;
      case 'build_to_spec':
        return placed.length === step.slots && placed.every((p, i) => p === step.correct[i]);
      default:
        return true;
    }
  };

  const canCheck = (): boolean => {
    switch (step.type) {
      case 'multiple_choice':
      case 'predict_behavior':
        return choice !== null;
      case 'predict_reading':
        return step.meter ? meterVal !== null : choice !== null;
      case 'choose_resistor':
        return step.bands ? true : choice !== null;
      case 'true_false':
        return tf !== null;
      case 'fill_blank':
        return step.tiles && step.tiles.length ? tileSeq.length > 0 : fill.trim().length > 0;
      case 'spot_error':
      case 'identify_component':
        return region !== null;
      case 'draw_connection':
        return drawn.length > 0;
      case 'trace_current':
        return traced.length === step.correctPath.length;
      case 'fix_the_circuit':
        return region !== null && choice !== null;
      case 'build_to_spec':
        return placed.length === step.slots;
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

  // draw_circuit grades asynchronously (Vision call inside the step). The step reports
  // its result here so hearts + the Continue rhythm behave exactly like any other step.
  const handleAsyncResult = (ok: boolean, message: string) => {
    setAsyncMsg(message);
    setCorrect(ok);
    setChecked(true);
    if (!ok) setHearts((h) => Math.max(0, h - 1));
  };

  // An interactive teach step (with hotspots) gates Continue until every part is explored.
  const teachHotspots = step?.type === 'teach' ? step.hotspots : undefined;
  const teachGated = !!teachHotspots && teachHotspots.length > 0 && revealed.size < teachHotspots.length;

  const earnedXp = content ? xpForLevel(content.xpReward, level) : 0;

  const handleContinue = () => {
    if (stepIndex + 1 >= steps.length) {
      setDone(true);
      onComplete(lessonId, earnedXp, level);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const retry = () => {
    setStepIndex(0);
    setHearts(heartsForLevel(level));
    setDone(false);
    setChecked(false);
    setCorrect(null);
  };

  // ── Completion screen ──
  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ohmlet-cream px-6">
        <div className="ohmlet-rise w-full max-w-md rounded-[2rem] border-[3px] border-ohmlet-ink bg-white p-10 text-center shadow-press">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-ohmlet-ink shadow-press-sm" style={{ background: levelMeta.color }}>
            <img src="/mascot/celebrate.png" alt="" aria-hidden className="h-16 w-auto" draggable={false} />
          </div>
          <p className="mt-5 inline-block rounded-full border-2 border-ohmlet-ink px-3 py-1 text-xs font-black uppercase tracking-wide" style={{ background: levelMeta.soft }}>
            {levelMeta.name} earned
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">{level >= 3 ? 'Mastered!' : 'Lesson complete!'}</h2>
          <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">{lesson.title}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft px-5 py-3">
            <Zap className="h-5 w-5 text-ohmlet-gold-deep" fill="currentColor" />
            <span className="text-lg font-black">+{earnedXp} XP</span>
          </div>
          {level < 3 && (
            <p className="mt-4 text-xs font-semibold text-ohmlet-ink-soft">
              Replay this lesson to reach {LEVEL_META[(level + 1) as 1 | 2 | 3].name}.
            </p>
          )}
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
          <img src="/mascot/encourage.png" alt="" aria-hidden className="mx-auto h-24 w-auto" draggable={false} />
          <h2 className="mt-4 text-2xl font-black tracking-tight">Out of hearts</h2>
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
        {level > 1 && (
          <span className="hidden shrink-0 rounded-full border-2 border-ohmlet-ink px-2.5 py-0.5 text-xs font-black uppercase tracking-wide sm:inline" style={{ background: levelMeta.soft }}>
            {levelMeta.name} round
          </span>
        )}
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
          matchedRights={matchedRights}
          setMatchedRights={setMatchedRights}
          matchSel={matchSel}
          setMatchSel={setMatchSel}
          leftOrder={leftOrder}
          rightOrder={rightOrder}
          drawn={drawn}
          setDrawn={setDrawn}
          drawSel={drawSel}
          setDrawSel={setDrawSel}
          traced={traced}
          setTraced={setTraced}
          placed={placed}
          setPlaced={setPlaced}
          revealed={revealed}
          setRevealed={setRevealed}
          correct={correct}
          onAsyncResult={handleAsyncResult}
          tileSeq={tileSeq}
          setTileSeq={setTileSeq}
          meterVal={meterVal}
          setMeterVal={setMeterVal}
          bands={bands}
          setBands={setBands}
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
            <Feedback step={step} correct={correct} message={asyncMsg} />
          ) : (
            <span className="text-sm font-semibold text-ohmlet-ink-soft">
              {teachGated
                ? `Tap each part to continue · ${revealed.size}/${teachHotspots!.length}`
                : isTeach(step)
                ? 'Read, then continue.'
                : step.type === 'draw_circuit'
                ? 'Draw your circuit, then submit below.'
                : step.type === 'draw_fix'
                ? 'Draw the fix onto the circuit, then submit below.'
                : 'Pick your answer.'}
            </span>
          )}
          {isTeach(step) || checked ? (
            <button
              onClick={handleContinue}
              disabled={teachGated}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3 text-base font-black shadow-press transition-all enabled:hover:translate-y-[3px] enabled:hover:shadow-none disabled:cursor-not-allowed disabled:border-ohmlet-line disabled:bg-ohmlet-line disabled:text-ohmlet-ink/40 disabled:shadow-none"
            >
              {stepIndex + 1 >= steps.length ? 'Finish' : 'Continue'}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-3">
              {preview && (
                <button
                  onClick={handleContinue}
                  className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-dashed border-ohmlet-ink/40 px-4 py-3 text-sm font-black text-ohmlet-ink-soft transition-all hover:border-ohmlet-ink hover:text-ohmlet-ink"
                  title="Review only: jump to the next step without answering"
                >
                  Skip <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {/* draw_circuit / draw_fix grade via their own Submit button in the step body. */}
              {step.type !== 'draw_circuit' && step.type !== 'draw_fix' && (
                <button
                  onClick={handleCheck}
                  disabled={!canCheck()}
                  className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3 text-base font-black shadow-press transition-all enabled:hover:translate-y-[3px] enabled:hover:shadow-none disabled:cursor-not-allowed disabled:border-ohmlet-line disabled:bg-ohmlet-line disabled:text-ohmlet-ink/40 disabled:shadow-none"
                >
                  Check
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Feedback line ──
const Feedback: React.FC<{ step: LessonStep; correct: boolean | null; message?: string | null }> = ({ step, correct, message }) => {
  const explanation =
    message || ('explanation' in step ? step.explanation : correct ? 'Nice work.' : 'Not quite. Review it and keep going.');
  return (
    <div className="flex items-center gap-3">
      <img
        src={correct ? '/mascot/happy.png' : '/mascot/oops.png'}
        alt=""
        aria-hidden
        className="ohmlet-rise h-14 w-14 shrink-0 object-contain"
        draggable={false}
      />
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
  matchedRights: Set<number>;
  setMatchedRights: (s: Set<number>) => void;
  matchSel: { side: 'l' | 'r'; idx: number } | null;
  setMatchSel: (s: { side: 'l' | 'r'; idx: number } | null) => void;
  leftOrder: number[];
  rightOrder: number[];
  drawn: Array<[string, string]>;
  setDrawn: (d: Array<[string, string]>) => void;
  drawSel: string | null;
  setDrawSel: (s: string | null) => void;
  traced: string[];
  setTraced: (s: string[]) => void;
  placed: number[];
  setPlaced: (p: number[]) => void;
  revealed: Set<string>;
  setRevealed: (s: Set<string>) => void;
  correct: boolean | null;
  onAsyncResult: (ok: boolean, message: string) => void;
  tileSeq: number[];
  setTileSeq: (s: number[]) => void;
  meterVal: number | null;
  setMeterVal: (n: number) => void;
  bands: number[];
  setBands: (b: number[]) => void;
}

const StepView: React.FC<StepViewProps> = (p) => {
  const { step, accent, checked } = p;

  switch (step.type) {
    case 'teach':
      if (step.hotspots && step.hotspots.length > 0 && step.circuitDiagram) return <ExploreStep key={step.title} {...p} step={step} />;
      return (
        <div className="ohmlet-rise">
          <h2 className="text-3xl font-black tracking-[-0.02em]">{step.title}</h2>
          <p className="mt-4 whitespace-pre-line text-lg font-medium leading-relaxed text-ohmlet-ink-soft">{step.body}</p>
          {step.circuitDiagram && (
            <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
              <CircuitDiagram circuit={step.circuitDiagram} showCurrentFlow={step.showCurrentFlow} className="mx-auto w-full max-w-xl" />
            </div>
          )}
        </div>
      );

    case 'multiple_choice':
      return <ChoiceStep {...p} step={step} />;

    // Prediction family: commit a prediction, then the circuit reveals the truth —
    // the diagram animates its current flow once you've answered.
    case 'predict_reading':
      if (step.meter) return <MeterStep {...p} step={step} />;
      return <ChoiceStep {...p} step={step} eyebrow="Predict the reading" revealFlow />;
    case 'predict_behavior':
      return <ChoiceStep {...p} step={step} eyebrow="Predict what happens" revealFlow />;
    case 'choose_resistor':
      if (step.bands) return <ResistorBandStep {...p} step={step} />;
      return <ChoiceStep {...p} step={step} eyebrow="Choose the component" />;

    case 'true_false':
      return <TrueFalseStep {...p} step={step} />;

    case 'fill_blank':
      if (step.tiles && step.tiles.length) return <FillTileStep {...p} step={step} />;
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
          {/* Hints are disabled for now: the authored ones gave the answer away.
              Re-enable here once they're rewritten as method nudges. */}
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
              circuit={step.circuitDiagram}
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

    case 'trace_current':
      return <TraceStep {...p} step={step} />;

    case 'fix_the_circuit':
      return <FixStep {...p} step={step} />;

    case 'build_to_spec':
      return <BuildStep {...p} step={step} />;

    case 'draw_circuit':
      return <DrawCircuitStep {...p} step={step} />;

    case 'draw_fix':
      return <DrawFixStep {...p} step={step} />;

    default:
      return null;
  }
};

// ── Shared primitives ──
const Prompt: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-2xl font-black leading-snug tracking-tight md:text-3xl">{children}</h2>
);

const Diagram: React.FC<{ circuit: string; showCurrentFlow?: boolean }> = ({ circuit, showCurrentFlow }) => (
  <div className="mt-5 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
    <CircuitDiagram circuit={circuit} showCurrentFlow={showCurrentFlow} className="mx-auto w-full max-w-xl" />
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
  { step: { question: string; options: string[]; optionImages?: string[]; correct: number; circuitDiagram?: string }; eyebrow?: string; revealFlow?: boolean } & StepViewProps
> = ({ step, eyebrow, revealFlow, choice, setChoice, checked }) => {
  const useImages = !!step.optionImages && step.optionImages.length === step.options.length;
  return (
    <div className="ohmlet-rise">
      {eyebrow && <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">{eyebrow}</p>}
      <Prompt>{step.question}</Prompt>
      {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} showCurrentFlow={!!revealFlow && checked} />}
      {useImages ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
          {step.options.map((opt, i) => {
            const sel = choice === i;
            const reveal = checked && i === step.correct;
            const wrong = checked && sel && i !== step.correct;
            return (
              <ImageChoice key={opt} src={step.optionImages![i]} label={opt} showLabel={checked} selected={sel} reveal={reveal} wrong={wrong} disabled={checked} onClick={() => setChoice(i)} />
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
};

// Image option card (Duolingo "tap the picture"): picture + label. If the image is
// missing or fails to load, the label alone still answers the question — never broken.
const ImageChoice: React.FC<{
  src: string;
  label: string;
  /** Show the name? Only after answering — otherwise it gives away "tap the X". */
  showLabel: boolean;
  selected: boolean;
  reveal?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ src, label, showLabel, selected, reveal, wrong, disabled, onClick }) => {
  const [broken, setBroken] = useState(false);
  let look = 'border-ohmlet-line bg-white hover:border-ohmlet-ink';
  if (reveal) look = 'border-ohmlet-green bg-[#f1f9e6]';
  else if (wrong) look = 'border-ohmlet-red bg-[#fdece8]';
  else if (selected) look = 'border-ohmlet-ink bg-ohmlet-gold-soft';
  // The label is the answer, so it stays hidden until checked (kept for screen
  // readers via aria-label). If the image is missing, fall back to showing the name.
  const labelVisible = showLabel || broken;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`relative flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 shadow-soft transition-all ${look} ${disabled ? '' : 'hover:-translate-y-0.5'}`}
    >
      {(reveal || wrong) && (
        <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${reveal ? 'bg-ohmlet-green' : 'bg-ohmlet-red'} text-white`}>
          {reveal ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
        </span>
      )}
      {!broken && <img src={src} alt="" draggable={false} onError={() => setBroken(true)} className="h-28 w-auto object-contain" />}
      {labelVisible && <span className="text-center text-sm font-black text-ohmlet-ink">{label}</span>}
    </button>
  );
};

// ── Explore step (interactive teach) ──
// A teach card with hotspots: tap each labelled part of the circuit to reveal what
// it does. Continue is gated (in the footer) until all are explored, so the intro
// "read this" wall becomes active learning.
const ExploreStep: React.FC<{ step: Extract<LessonStep, { type: 'teach' }> } & StepViewProps> = ({ step, revealed, setRevealed }) => {
  const hotspots = step.hotspots ?? [];
  // `selected` is the part currently shown; `revealed` is the set explored (for the
  // Continue gate). Tapping any part — even one already revealed — re-shows it, so a
  // learner can freely re-read parts and revisit in any order.
  const [selected, setSelected] = useState<string | null>(null);
  const show = (region: string) => {
    setSelected(region);
    if (!revealed.has(region)) setRevealed(new Set([...revealed, region]));
  };
  const current = hotspots.find((h) => h.region === selected);
  return (
    <div className="ohmlet-rise">
      <h2 className="text-3xl font-black tracking-[-0.02em]">{step.title}</h2>
      <p className="mt-3 whitespace-pre-line text-base font-medium leading-relaxed text-ohmlet-ink-soft">{step.body}</p>
      <div className="mt-5 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
        <CircuitDiagram circuit={step.circuitDiagram!} clickable onRegionClick={show} highlightRegion={selected} className="mx-auto w-full max-w-xl" />
      </div>
      {current ? (
        <div className="ohmlet-rise mt-4 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft px-5 py-4 shadow-soft">
          <p className="text-sm font-black text-ohmlet-ink">{current.label}</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-ohmlet-ink-soft">{current.detail}</p>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm font-semibold text-ohmlet-ink-soft">Tap each labelled part to learn what it does.</p>
      )}
      {/* Chips double as a legend AND a way to jump back to any part. */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {hotspots.map((h) => {
          const explored = revealed.has(h.region);
          const active = selected === h.region;
          return (
            <button
              key={h.region}
              type="button"
              onClick={() => show(h.region)}
              className={`rounded-full border-2 px-3 py-1 text-xs font-black transition-colors ${
                active
                  ? 'border-ohmlet-ink bg-ohmlet-gold-soft text-ohmlet-ink'
                  : explored
                  ? 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-green-deep'
                  : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink'
              }`}
            >
              {h.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Match-card thumbnail: hides itself if the image is missing, leaving the text label.
const MatchThumb: React.FC<{ src: string }> = ({ src }) => {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return <img src={src} alt="" draggable={false} onError={() => setBroken(true)} className="h-16 w-auto object-contain" />;
};

// ── True/False as a swipe card ──
// Swipe the statement right for TRUE, left for FALSE (or tap the buttons). The card
// tilts and tints as you drag; the buttons stay for accessibility and reveal on check.
const TrueFalseStep: React.FC<{ step: Extract<LessonStep, { type: 'true_false' }> } & StepViewProps> = ({ step, tf, setTf, checked, correct }) => {
  const [dx, setDx] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const THRESH = 64;
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (checked) return;
    dragging.current = true;
    startX.current = e.clientX;
  };
  const moveCard = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setDx(e.clientX - startX.current);
  };
  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dx > THRESH) setTf(true);
    else if (dx < -THRESH) setTf(false);
    setDx(0);
  };
  const tint = checked
    ? correct
      ? 'border-ohmlet-green bg-[#f1f9e6]'
      : 'border-ohmlet-red bg-[#fdece8]'
    : dx > 24 || tf === true
    ? 'border-ohmlet-green bg-[#f1f9e6]'
    : dx < -24 || tf === false
    ? 'border-ohmlet-red bg-[#fdece8]'
    : 'border-ohmlet-ink bg-white';
  return (
    <div className="ohmlet-rise">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Swipe or tap — true or false?</p>
      <div className="relative">
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wide text-ohmlet-red/70">← False</span>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wide text-ohmlet-green-deep/70">True →</span>
        <div
          onPointerDown={down}
          onPointerMove={moveCard}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 26}deg)`, transition: dragging.current ? 'none' : 'transform 0.25s' }}
          className={`mx-7 select-none rounded-[1.4rem] border-[2.5px] p-6 shadow-press ${tint} ${checked ? '' : 'cursor-grab touch-none active:cursor-grabbing'}`}
        >
          {step.circuitDiagram && <CircuitDiagram circuit={step.circuitDiagram} className="mx-auto mb-4 w-full max-w-md" />}
          <p className="text-center text-xl font-black leading-snug text-ohmlet-ink md:text-2xl">{step.statement}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[false, true].map((val) => {
          const sel = tf === val;
          const reveal = checked && val === step.correct;
          const wrong = checked && sel && val !== step.correct;
          return (
            <Option key={String(val)} selected={sel} reveal={reveal} wrong={wrong} disabled={checked} onClick={() => setTf(val)} center>
              {val ? 'True' : 'False'}
            </Option>
          );
        })}
      </div>
    </div>
  );
};

// ── Match step ──
const MatchStep: React.FC<{ step: Extract<LessonStep, { type: 'match' }> } & StepViewProps> = ({
  step,
  matched,
  setMatched,
  matchedRights,
  setMatchedRights,
  matchSel,
  setMatchSel,
  leftOrder,
  rightOrder,
}) => {
  // Brief red flash on a wrong pairing (so a wrong tap gives feedback, not silence).
  const [wrong, setWrong] = useState<{ l: number; r: number } | null>(null);

  const select = (side: 'l' | 'r', idx: number) => {
    // Already consumed? (left and right are tracked independently)
    if (side === 'l' && matched.has(idx)) return;
    if (side === 'r' && matchedRights.has(idx)) return;

    // First pick, or re-pick on the same side.
    if (!matchSel || matchSel.side === side) {
      setMatchSel({ side, idx });
      return;
    }

    const leftIdx = side === 'l' ? idx : matchSel.idx;
    const rightIdx = side === 'r' ? idx : matchSel.idx;

    // Match by VALUE, not position: any right chip with the correct value counts.
    // This makes categorisation work (two materials can both be "Conductor").
    if (step.pairs[leftIdx][1] === step.pairs[rightIdx][1]) {
      setMatched(new Set([...matched, leftIdx]));
      setMatchedRights(new Set([...matchedRights, rightIdx]));
    } else {
      setWrong({ l: leftIdx, r: rightIdx });
      window.setTimeout(() => setWrong(null), 650);
    }
    setMatchSel(null);
  };

  const cls = (on: boolean, sel: boolean, isWrong: boolean) =>
    on
      ? 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-green-deep'
      : isWrong
      ? 'border-ohmlet-red bg-[#fdece8] text-ohmlet-red'
      : sel
      ? 'border-ohmlet-ink bg-ohmlet-gold-soft'
      : 'border-ohmlet-line bg-white hover:border-ohmlet-ink';

  return (
    <div className="ohmlet-rise">
      <Prompt>{step.instruction}</Prompt>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          {leftOrder.map((pairIdx) => {
            const left = step.pairs[pairIdx][0];
            const img = step.images?.[pairIdx];
            const on = matched.has(pairIdx);
            const sel = matchSel?.side === 'l' && matchSel.idx === pairIdx;
            return (
              <button
                key={pairIdx}
                disabled={on}
                onClick={() => select('l', pairIdx)}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${img ? 'flex flex-col items-center gap-2 text-center' : 'text-left'} ${cls(on, sel, wrong?.l === pairIdx)}`}
              >
                {img && <MatchThumb src={img} />}
                {left}
              </button>
            );
          })}
        </div>
        <div className="space-y-3">
          {rightOrder.map((pairIdx) => {
            const right = step.pairs[pairIdx][1];
            const on = matchedRights.has(pairIdx);
            const sel = matchSel?.side === 'r' && matchSel.idx === pairIdx;
            return (
              <button
                key={pairIdx}
                disabled={on}
                onClick={() => select('r', pairIdx)}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all ${cls(on, sel, wrong?.r === pairIdx)}`}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-sm font-semibold text-ohmlet-ink-soft">
        {matched.size}/{step.pairs.length} matched. Tap a term, then its match.
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

// ── Fill-blank tile assembly (word/number bank) ──
// Build the answer by tapping tiles instead of typing — Duolingo's word bank. The
// bank is shuffled and includes distractor tokens; tap a placed tile to send it back.
const FillTileStep: React.FC<{ step: Extract<LessonStep, { type: 'fill_blank' }> } & StepViewProps> = ({ step, tileSeq, setTileSeq, checked }) => {
  const tiles = step.tiles ?? [];
  const bank = useMemo(() => shuffle(tiles.map((_, i) => i)), [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const place = (i: number) => {
    if (checked || tileSeq.includes(i)) return;
    setTileSeq([...tileSeq, i]);
  };
  const removeAt = (pos: number) => {
    if (checked) return;
    setTileSeq(tileSeq.filter((_, k) => k !== pos));
  };
  return (
    <div className="ohmlet-rise">
      <Prompt>{step.prompt}</Prompt>
      {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} />}
      {/* Assembled answer */}
      <div className="mt-6 flex min-h-[60px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-ohmlet-line bg-white px-3 py-3">
        {tileSeq.length === 0 ? (
          <span className="px-1 text-sm font-semibold text-ohmlet-ink-soft">Tap tiles to build your answer</span>
        ) : (
          tileSeq.map((ti, pos) => (
            <button
              key={`${ti}-${pos}`}
              type="button"
              disabled={checked}
              onClick={() => removeAt(pos)}
              className="rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft px-3.5 py-2 text-sm font-black text-ohmlet-ink shadow-soft transition-all enabled:hover:-translate-y-0.5"
            >
              {tiles[ti]}
            </button>
          ))
        )}
      </div>
      {/* Bank */}
      <div className="mt-4 flex flex-wrap gap-2">
        {bank.map((i) => {
          const used = tileSeq.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={checked || used}
              onClick={() => place(i)}
              className={`rounded-xl border-2 px-3.5 py-2 text-sm font-bold shadow-soft transition-all ${
                used ? 'border-ohmlet-line bg-ohmlet-line/30 text-transparent' : 'border-ohmlet-ink bg-white text-ohmlet-ink hover:-translate-y-0.5 hover:bg-ohmlet-gold-soft'
              }`}
            >
              {tiles[i]}
            </button>
          );
        })}
      </div>
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

// ── Trace-current step ──
// Tap the parts the current flows through, in loop order. Kills the "current gets
// used up" misconception by making the learner walk the complete return path.
const TraceStep: React.FC<{ step: Extract<LessonStep, { type: 'trace_current' }> } & StepViewProps> = ({
  step,
  traced,
  setTraced,
  checked,
}) => {
  const tap = (id: string) => {
    if (checked) return;
    // Re-tapping an already-traced part rewinds the path back to just before it,
    // so a learner can correct a wrong turn without starting over.
    if (traced.includes(id)) return setTraced(traced.slice(0, traced.indexOf(id)));
    setTraced([...traced, id]);
  };
  return (
    <div className="ohmlet-rise">
      <Prompt>{step.question}</Prompt>
      <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
        <CircuitDiagram
          circuit={step.circuitDiagram}
          clickable={!checked}
          onRegionClick={tap}
          highlightRegion={traced.length ? traced[traced.length - 1] : null}
          className="mx-auto w-full max-w-xl"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {traced.length === 0 ? (
          <p className="text-sm font-semibold text-ohmlet-ink-soft">Tap the parts the current flows through, in order.</p>
        ) : (
          traced.map((id, i) => (
            <React.Fragment key={`${id}-${i}`}>
              {i > 0 && <span className="text-ohmlet-ink-soft">→</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold-soft px-3 py-1 text-sm font-black text-ohmlet-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ohmlet-ink text-[10px] text-white">{i + 1}</span>
                {id}
              </span>
            </React.Fragment>
          ))
        )}
      </div>
      {checked && <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">The loop: {step.correctPath.join(' → ')}</p>}
    </div>
  );
};

// ── Fix-the-circuit step ──
// Two stages: tap the faulty part, then choose the correct repair. Diagnosis plus
// remedy, a real step beyond spot_error (which only asks "what is wrong?").
const FixStep: React.FC<{ step: Extract<LessonStep, { type: 'fix_the_circuit' }> } & StepViewProps> = ({
  step,
  region,
  setRegion,
  choice,
  setChoice,
  checked,
}) => (
  <div className="ohmlet-rise">
    <Prompt>{step.question}</Prompt>
    <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
      <CircuitDiagram
        circuit={step.circuitDiagram}
        clickable={!checked}
        onRegionClick={(id) => setRegion(id)}
        highlightRegion={region}
        correctRegion={checked ? step.faultRegion : null}
        className="mx-auto w-full max-w-xl"
      />
    </div>
    {!region ? (
      <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">First, tap the part that is wrong.</p>
    ) : (
      <div className="mt-5">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Now choose the fix</p>
        <div className="grid gap-3">
          {step.fixes.map((fix, i) => (
            <Option
              key={fix}
              selected={choice === i}
              reveal={checked && i === step.correctFix}
              wrong={checked && choice === i && i !== step.correctFix}
              disabled={checked}
              onClick={() => setChoice(i)}
            >
              {fix}
            </Option>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Build-to-spec step ──
// Assemble a circuit by tapping the right parts from a palette (which includes
// distractor parts) into ordered slots. A synthesis exercise: the learner must
// recognise which parts are needed AND in what order, not just connect fixed pins.
const BuildStep: React.FC<{ step: Extract<LessonStep, { type: 'build_to_spec' }> } & StepViewProps> = ({
  step,
  placed,
  setPlaced,
  checked,
}) => {
  const addPart = (pi: number) => {
    if (checked || placed.length >= step.slots) return;
    setPlaced([...placed, pi]);
  };
  const clearSlot = (slotIdx: number) => {
    if (checked) return;
    setPlaced(placed.filter((_, i) => i !== slotIdx));
  };
  return (
    <div className="ohmlet-rise">
      <Prompt>{step.instruction}</Prompt>
      {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} />}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {Array.from({ length: step.slots }).map((_, i) => {
          const pi = placed[i];
          const filled = pi !== undefined;
          const correctHere = checked && filled && pi === step.correct[i];
          const wrongHere = checked && filled && pi !== step.correct[i];
          let look = 'border-dashed border-ohmlet-line bg-white text-ohmlet-ink-soft';
          if (correctHere) look = 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-ink';
          else if (wrongHere) look = 'border-ohmlet-red bg-[#fdece8] text-ohmlet-ink';
          else if (filled) look = 'border-ohmlet-ink bg-ohmlet-gold-soft text-ohmlet-ink';
          return (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-ohmlet-ink-soft">→</span>}
              <button
                type="button"
                disabled={checked || !filled}
                onClick={() => clearSlot(i)}
                className={`min-w-[88px] rounded-2xl border-2 px-3 py-3 text-sm font-black shadow-soft transition-all ${look}`}
              >
                {filled ? step.palette[pi] : i + 1}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      {!checked ? (
        <>
          <div className="mt-6">
            <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Parts</p>
            <div className="flex flex-wrap justify-center gap-2">
              {step.palette.map((part, i) => (
                <button
                  key={`${part}-${i}`}
                  type="button"
                  disabled={placed.length >= step.slots}
                  onClick={() => addPart(i)}
                  className="rounded-2xl border-2 border-ohmlet-ink bg-white px-4 py-2.5 text-sm font-bold text-ohmlet-ink shadow-soft transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {part}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">Tap parts to fill the slots in order. Tap a filled slot to clear it.</p>
        </>
      ) : (
        <p className="mt-4 text-center text-sm font-semibold text-ohmlet-ink-soft">Correct build: {step.correct.map((c) => step.palette[c]).join(' → ')}</p>
      )}
    </div>
  );
};

// ── Draw-circuit step (Gemini Vision-graded) ──
// The embodied hero: the learner DRAWS the circuit on a canvas and Gemini Vision
// grades it, naming the components it can see. Grades asynchronously, then reports
// up via onAsyncResult so hearts + the Continue rhythm behave like any other step.
type CanvasPointer = React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>;

const DrawCircuitStep: React.FC<{ step: Extract<LessonStep, { type: 'draw_circuit' }> } & StepViewProps> = ({ step, checked, onAsyncResult }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [eraser, setEraser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let x = 20; x < canvas.offsetWidth; x += 20)
      for (let y = 20; y < canvas.offsetHeight; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(init, 60);
    return () => window.clearTimeout(t);
  }, [init]);

  const pointFrom = (e: CanvasPointer) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const start = (e: CanvasPointer) => {
    if (checked) return;
    drawingRef.current = true;
    lastRef.current = pointFrom(e);
  };
  const move = (e: CanvasPointer) => {
    if (!drawingRef.current || !lastRef.current || checked) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pointFrom(e);
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.strokeStyle = eraser ? '#ffffff' : '#14201e';
    ctx.lineWidth = eraser ? 18 : 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    lastRef.current = p;
    if (!eraser) setHasInk(true);
  };
  const end = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };
  const clear = () => {
    setError(null);
    setHasInk(false);
    init();
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const res = await assessDrawing(QUIZ_API_ROOT, {
        image_base64: base64,
        expected_components: step.expected,
        exercise_type: 'draw_circuit',
      });
      const found = res.identified_components?.length ? ` (spotted: ${res.identified_components.join(', ')})` : '';
      onAsyncResult(res.correct, `${res.feedback}${found}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the drawing grader. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toolBtn = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-black transition-all ${
      on ? 'border-ohmlet-ink bg-ohmlet-gold-soft text-ohmlet-ink' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink'
    }`;

  return (
    <div className="ohmlet-rise">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Draw it yourself</p>
      <Prompt>{step.instruction}</Prompt>
      <p className="mt-2 text-sm font-semibold text-ohmlet-ink-soft">{step.hint}</p>
      <div className="mt-5 overflow-hidden rounded-[1.4rem] border-2 border-ohmlet-line bg-white shadow-soft">
        <canvas
          ref={canvasRef}
          className={`block h-[300px] w-full touch-none ${checked ? 'pointer-events-none opacity-90' : 'cursor-crosshair'}`}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      {!checked && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEraser(false)} className={toolBtn(!eraser)}>
              <Pencil className="h-4 w-4" /> Pen
            </button>
            <button type="button" onClick={() => setEraser(true)} className={toolBtn(eraser)}>
              <Eraser className="h-4 w-4" /> Eraser
            </button>
            <button type="button" onClick={clear} className={toolBtn(false)}>
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !hasInk}
            className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-2.5 text-base font-black shadow-press transition-all enabled:hover:translate-y-[3px] enabled:hover:shadow-none disabled:cursor-not-allowed disabled:border-ohmlet-line disabled:bg-ohmlet-line disabled:text-ohmlet-ink/40 disabled:shadow-none"
          >
            {loading ? 'Checking…' : 'Submit drawing'}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-bold text-ohmlet-red">{error}</p>}
    </div>
  );
};

// ── Draw-fix step (draw the missing component onto the circuit, Vision-graded) ──
// The circuit renders as a crisp SVG; a transparent canvas sits exactly on top for
// the learner to draw the fix. At submit, the SVG is rasterised and composited with
// the drawing into ONE image, so Gemini sees the circuit and the addition together.
const DrawFixStep: React.FC<{ step: Extract<LessonStep, { type: 'draw_fix' }> } & StepViewProps> = ({ step, checked, onAsyncResult }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [eraser, setEraser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Size the transparent drawing canvas to overlay the circuit box exactly.
  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(2, 0, 0, 2, 0, 0);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(sizeCanvas, 80);
    window.addEventListener('resize', sizeCanvas);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', sizeCanvas); };
  }, [sizeCanvas]);

  const pointFrom = (e: CanvasPointer) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };
  const start = (e: CanvasPointer) => { if (checked) return; drawingRef.current = true; lastRef.current = pointFrom(e); };
  const move = (e: CanvasPointer) => {
    if (!drawingRef.current || !lastRef.current || checked) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pointFrom(e);
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = eraser ? 20 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (!eraser) setHasInk(true);
  };
  const end = () => { drawingRef.current = false; lastRef.current = null; };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setError(null);
    setHasInk(false);
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    const svg = boxRef.current?.querySelector('svg');
    if (!canvas || !svg) return;
    setLoading(true);
    setError(null);
    try {
      // Rasterise the circuit SVG, then composite the drawing on top.
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const octx = out.getContext('2d')!;
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, out.width, out.height);
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', String(out.width));
      clone.setAttribute('height', String(out.height));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => { octx.drawImage(img, 0, 0, out.width, out.height); resolve(); };
        img.onerror = () => reject(new Error('Could not render the circuit for grading.'));
        img.src = svgUrl;
      });
      octx.drawImage(canvas, 0, 0);
      const base64 = out.toDataURL('image/png').split(',')[1];
      const res = await assessDrawing(QUIZ_API_ROOT, {
        image_base64: base64,
        expected_components: step.expected,
        exercise_type: 'draw_circuit',
      });
      const found = res.identified_components?.length ? ` (spotted: ${res.identified_components.join(', ')})` : '';
      onAsyncResult(res.correct, `${res.feedback}${found}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the drawing grader. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const toolBtn = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-black transition-all ${
      on ? 'border-ohmlet-ink bg-ohmlet-gold-soft text-ohmlet-ink' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink'
    }`;

  return (
    <div className="ohmlet-rise">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Draw the fix</p>
      <Prompt>{step.instruction}</Prompt>
      <p className="mt-2 text-sm font-semibold text-ohmlet-ink-soft">{step.hint}</p>
      <div className="mt-5 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
        <div ref={boxRef} className="relative mx-auto w-full max-w-xl">
          <CircuitDiagram circuit={step.circuitDiagram} className="w-full" />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full touch-none ${checked ? 'pointer-events-none' : 'cursor-crosshair'}`}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
        </div>
      </div>
      {!checked && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEraser(false)} className={toolBtn(!eraser)}>
              <Pencil className="h-4 w-4" /> Pen
            </button>
            <button type="button" onClick={() => setEraser(true)} className={toolBtn(eraser)}>
              <Eraser className="h-4 w-4" /> Eraser
            </button>
            <button type="button" onClick={clear} className={toolBtn(false)}>
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !hasInk}
            className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-2.5 text-base font-black shadow-press transition-all enabled:hover:translate-y-[3px] enabled:hover:shadow-none disabled:cursor-not-allowed disabled:border-ohmlet-line disabled:bg-ohmlet-line disabled:text-ohmlet-ink/40 disabled:shadow-none"
          >
            {loading ? 'Checking…' : 'Submit drawing'}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-bold text-ohmlet-red">{error}</p>}
    </div>
  );
};

// ── Meter step (needle gauge + slider) ──
// predict_reading with a `meter`: dial the needle to the reading instead of picking
// a number from a list. Correct within tolerance of the target.
const fmtNum = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(2));

const MeterStep: React.FC<{ step: Extract<LessonStep, { type: 'predict_reading' }> } & StepViewProps> = ({ step, meterVal, setMeterVal, checked, correct }) => {
  const m = step.meter!;
  const tick = m.step ?? Math.max((m.max - m.min) / 100, 0.0001);
  const val = meterVal ?? m.min;
  const frac = (val - m.min) / (m.max - m.min);
  const cx = 120;
  const cy = 120;
  const r = 92;
  const ang = Math.PI * (1 - frac);
  const angT = Math.PI * (1 - (m.target - m.min) / (m.max - m.min));
  const needle = checked ? (correct ? '#16a34a' : '#ef4444') : '#14201e';
  return (
    <div className="ohmlet-rise">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Dial in the reading</p>
      <Prompt>{step.question}</Prompt>
      {step.circuitDiagram && <Diagram circuit={step.circuitDiagram} showCurrentFlow={checked} />}
      <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
        <svg viewBox="0 0 240 138" className="mx-auto w-full max-w-sm">
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
          {Array.from({ length: 5 }).map((_, i) => {
            const a = Math.PI * (1 - i / 4);
            return <line key={i} x1={cx + (r - 9) * Math.cos(a)} y1={cy - (r - 9) * Math.sin(a)} x2={cx + r * Math.cos(a)} y2={cy - r * Math.sin(a)} stroke="#94a3b8" strokeWidth={2} />;
          })}
          {checked && <line x1={cx} y1={cy} x2={cx + r * Math.cos(angT)} y2={cy - r * Math.sin(angT)} stroke="#16a34a" strokeWidth={2} strokeDasharray="4 3" />}
          <line x1={cx} y1={cy} x2={cx + r * Math.cos(ang)} y2={cy - r * Math.sin(ang)} stroke={needle} strokeWidth={4} strokeLinecap="round" style={{ transition: 'all 0.12s' }} />
          <circle cx={cx} cy={cy} r={7} fill={needle} />
        </svg>
        <div className="mt-1 text-center">
          <span className="text-3xl font-black tabular-nums text-ohmlet-ink">{meterVal === null ? '—' : fmtNum(val)}</span>
          <span className="ml-1 text-lg font-black text-ohmlet-ink-soft">{m.unit}</span>
        </div>
        <input
          type="range"
          min={m.min}
          max={m.max}
          step={tick}
          value={val}
          disabled={checked}
          onChange={(e) => setMeterVal(parseFloat(e.target.value))}
          className="mt-4 w-full accent-ohmlet-gold-deep"
        />
        <div className="flex justify-between text-xs font-bold text-ohmlet-ink-soft">
          <span>{m.min} {m.unit}</span>
          <span>{m.max} {m.unit}</span>
        </div>
      </div>
      {checked && <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">Target: {fmtNum(m.target)} {m.unit} (±{m.tolerance})</p>}
    </div>
  );
};

// ── Resistor colour-band step ──
// choose_resistor with `bands`: set the 4-band resistor's colours to encode the
// target value. Tap a band to cycle its colour; the live value updates as you go.
const DIGIT_COLORS = [
  { n: 'black', c: '#1a1a1a' },
  { n: 'brown', c: '#7c3f00' },
  { n: 'red', c: '#ef4444' },
  { n: 'orange', c: '#f97316' },
  { n: 'yellow', c: '#facc15' },
  { n: 'green', c: '#22c55e' },
  { n: 'blue', c: '#3b82f6' },
  { n: 'violet', c: '#8b5cf6' },
  { n: 'grey', c: '#9ca3af' },
  { n: 'white', c: '#f8fafc' },
];
const fmtOhms = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(2)} MΩ` : v >= 1e3 ? `${+(v / 1e3).toFixed(2)} kΩ` : `${v} Ω`);

const ResistorBandStep: React.FC<{ step: Extract<LessonStep, { type: 'choose_resistor' }> } & StepViewProps> = ({ step, bands, setBands, checked, correct }) => {
  const cycle = (i: number) => {
    if (checked) return;
    const next = [...bands];
    next[i] = (next[i] + 1) % (i === 2 ? 7 : 10);
    setBands(next);
  };
  const value = (bands[0] * 10 + bands[1]) * 10 ** bands[2];
  const target = step.bands!.targetOhms;
  const bandX = [72, 96, 120];
  return (
    <div className="ohmlet-rise">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-gold-deep">Set the colour bands</p>
      <Prompt>{step.question}</Prompt>
      <p className="mt-2 text-sm font-semibold text-ohmlet-ink-soft">Tap a band to change its colour, until the value matches {fmtOhms(target)}.</p>
      <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-6 shadow-soft">
        <svg viewBox="0 0 220 90" className="mx-auto w-full max-w-sm">
          <line x1={6} y1={45} x2={48} y2={45} stroke="#94a3b8" strokeWidth={3} />
          <line x1={172} y1={45} x2={214} y2={45} stroke="#94a3b8" strokeWidth={3} />
          <rect x={48} y={24} width={124} height={42} rx={14} fill="#d8b98c" stroke="#b08e63" strokeWidth={2} />
          {[0, 1, 2].map((i) => (
            <g key={i} onClick={() => cycle(i)} className={checked ? '' : 'cursor-pointer'}>
              <rect x={bandX[i] - 6} y={20} width={12} height={50} rx={2} fill={DIGIT_COLORS[bands[i]].c} stroke="#0a0a0a" strokeWidth={0.75} />
            </g>
          ))}
          <rect x={158} y={24} width={9} height={42} rx={2} fill="#d4af37" />
        </svg>
        <div className="mt-3 text-center">
          <span className={`text-2xl font-black tabular-nums ${checked ? (correct ? 'text-ohmlet-green-deep' : 'text-ohmlet-red') : 'text-ohmlet-ink'}`}>{fmtOhms(value)}</span>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs font-bold text-ohmlet-ink-soft">
          <span>1st: {DIGIT_COLORS[bands[0]].n} ({bands[0]})</span>
          <span>2nd: {DIGIT_COLORS[bands[1]].n} ({bands[1]})</span>
          <span>×10^{bands[2]}: {DIGIT_COLORS[bands[2]].n}</span>
        </div>
      </div>
      {checked && !correct && <p className="mt-3 text-center text-sm font-semibold text-ohmlet-ink-soft">Target was {fmtOhms(target)}.</p>}
    </div>
  );
};
