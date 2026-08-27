import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canRender, isTeach, type Lesson, type LessonStep } from './types';
import { buildLeveledSteps, xpForLevel, type AuthoredStep } from './levels';

/**
 * The run loop, mirroring the web LessonRunner.
 *
 * The run is a QUEUE of step indices, not a straight walk. A wrong graded answer
 * is pushed to the BACK of the queue so it returns later in the same run and the
 * learner has to clear it — that requeue is what makes a run teach rather than
 * merely test. Progress is measured in mastered steps, not position, so a
 * requeued step holds the bar rather than letting it march on.
 */

export interface RunState {
  step: LessonStep | null;
  position: number;          // 1-based, for display
  total: number;             // distinct steps to master
  progress: number;          // 0..1, mastered / total
  checked: boolean;
  correct: boolean | null;
  done: boolean;
  earnedXp: number;          // what this level pays, before the record decides
  level: number;             // 1 Bronze, 2 Silver, 3 Gold
  anyWrong: boolean;         // drives the "perfect" achievement metric
  /**
   * A step the grader could not be reached for, so it was neither passed nor
   * failed. Suppresses "perfect": a run holding an unchecked step is not a
   * proven-flawless run. The browser and the phone used to disagree about this
   * case, and both were wrong. See markUnassessed.
   */
  anyUnassessed: boolean;
}

/**
 * Hearts are NOT owned here.
 *
 * They used to be: five per run, reset on every retry, which made them a
 * decoration rather than a constraint. They are now an account-level resource
 * the server owns (services/hearts.ts), so the run reports a miss and the
 * caller decides what it costs. `onWrong` is handed the miss's ordinal within
 * this run, which is what makes the charge idempotent across a retried request.
 */
export function useRun(
  lesson: Lesson | null,
  level = 1,
  onWrong?: (missOrdinal: number) => void,
) {
  // The run is built FOR a level: Bronze plays the lesson as authored, Silver
  // and Gold drop the teaching and shuffle what is left into a recall round.
  // The phone used to ignore levels entirely and always play Bronze, so nobody
  // learning here could get past it.
  //
  // Only steps this client can actually render take part. An unsupported type is
  // dropped rather than shown broken, and it is dropped BEFORE the level is
  // built, or the sampler could fill a round with steps this client then removes
  // and hand the learner a short one.
  const steps = useMemo(() => {
    const renderable = (lesson?.steps ?? []).filter(canRender) as AuthoredStep[];
    return buildLeveledSteps(renderable, level);
  }, [lesson, level]);

  const [queue, setQueue] = useState<number[]>(() => steps.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const anyWrong = useRef(false);
  const anyUnassessed = useRef(false);
  // Counts misses within the run, so each one gets a distinct idempotency key
  // while a retry of the SAME miss reuses it. A requeued step missed twice is
  // two charges, which is correct: it was wrong twice.
  const misses = useRef(0);
  // Kept in a ref so `submit` does not need it as a dependency and go stale.
  // Written in an effect, not during render: a render React discards must
  // not leave a mutated ref behind.
  const onWrongRef = useRef(onWrong);
  useEffect(() => { onWrongRef.current = onWrong; }, [onWrong]);

  // Re-seed when the lesson changes. In an effect, never during render:
  // setState while rendering is a React error and made this hook order-dependent.
  useEffect(() => {
    setQueue(steps.map((_, i) => i));
    setPos(0);
    setMastered(new Set());
    setChecked(false);
    setCorrect(null);
    setDone(false);
    anyWrong.current = false;
    anyUnassessed.current = false;
    misses.current = 0;
  }, [steps]);

  const currentIndex = queue[pos] ?? -1;
  const step = currentIndex >= 0 ? steps[currentIndex] ?? null : null;

  /** Grade the current step. Teach steps are acknowledged, never graded. */
  const submit = useCallback((isCorrect: boolean) => {
    setChecked(true);
    setCorrect(isCorrect);
    if (!isCorrect) {
      anyWrong.current = true;
      misses.current += 1;
      onWrongRef.current?.(misses.current);
    }
  }, []);

  /**
   * The grader was unreachable, so this step goes by without a verdict.
   *
   * Not `submit(true)`, which is what the phone used to do: that told the
   * learner they were right about a drawing nobody looked at, and paid a
   * flawless run for a network blip. Not an error that blocks them either,
   * which is what the browser used to do: a quiz-engine outage then made every
   * drawing lesson unfinishable. No heart, because they were not wrong. No
   * `drawings` credit, because nothing was assessed. No `perfect` for the run.
   */
  const markUnassessed = useCallback(() => {
    anyUnassessed.current = true;
    setChecked(true);
    setCorrect(true);
  }, []);

  const advance = useCallback(() => {
    const idx = currentIndex;
    const wasWrong = checked && correct === false && step != null && !isTeach(step);

    // Pure computation first, then plain setState calls. Nothing that mutates
    // state runs inside an updater function.
    const nextQueue = wasWrong ? [...queue, idx] : queue;
    const finished = pos + 1 >= nextQueue.length;

    if (wasWrong) setQueue(nextQueue);
    else setMastered((m) => new Set(m).add(idx));

    if (finished) setDone(true);
    else setPos(pos + 1);

    setChecked(false);
    setCorrect(null);
  }, [currentIndex, checked, correct, step, pos, queue]);

  const retry = useCallback(() => {
    setQueue(steps.map((_, i) => i));
    setPos(0);
    setMastered(new Set());
    setChecked(false);
    setCorrect(null);
    setDone(false);
    anyWrong.current = false;
    anyUnassessed.current = false;
    misses.current = 0;
  }, [steps]);

  const total = steps.length;
  const state: RunState = {
    step,
    position: Math.min(mastered.size + 1, Math.max(total, 1)),
    total,
    progress: total ? mastered.size / total : 0,
    checked,
    correct,
    done,
    // Full price at Bronze, half at Silver and Gold, exactly as the web pays.
    earnedXp: lesson ? xpForLevel(lesson.xpReward, level) : 0,
    level,
    anyWrong: anyWrong.current,
    anyUnassessed: anyUnassessed.current,
  };

  return { ...state, submit, advance, retry, markUnassessed };
}
