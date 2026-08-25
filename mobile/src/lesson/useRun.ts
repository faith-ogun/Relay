import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canRender, isTeach, type Lesson, type LessonStep } from './types';

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
  earnedXp: number;
  anyWrong: boolean;         // drives the "perfect" achievement metric
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
export function useRun(lesson: Lesson | null, onWrong?: (missOrdinal: number) => void) {
  // Only present steps this client can actually render. An unsupported type is
  // dropped rather than shown broken; the count reflects what the learner sees.
  const steps = useMemo(
    () => (lesson?.steps ?? []).filter(canRender),
    [lesson],
  );

  const [queue, setQueue] = useState<number[]>(() => steps.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const anyWrong = useRef(false);
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
    earnedXp: lesson?.xpReward ?? 0,
    anyWrong: anyWrong.current,
  };

  return { ...state, submit, advance, retry };
}
