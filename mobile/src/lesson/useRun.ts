import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUPPORTED, isTeach, type Lesson, type LessonStep } from './types';

/**
 * The run loop, mirroring the web LessonRunner.
 *
 * The run is a QUEUE of step indices, not a straight walk. A wrong graded answer
 * is pushed to the BACK of the queue so it returns later in the same run and the
 * learner has to clear it — that requeue is what makes a run teach rather than
 * merely test. Progress is measured in mastered steps, not position, so a
 * requeued step holds the bar rather than letting it march on.
 */

const MAX_HEARTS = 5;

export interface RunState {
  step: LessonStep | null;
  position: number;          // 1-based, for display
  total: number;             // distinct steps to master
  progress: number;          // 0..1, mastered / total
  hearts: number;
  checked: boolean;
  correct: boolean | null;
  done: boolean;
  failed: boolean;           // ran out of hearts
  earnedXp: number;
  anyWrong: boolean;         // drives the "perfect" achievement metric
}

export function useRun(lesson: Lesson | null) {
  // Only present steps this client can actually render. An unsupported type is
  // dropped rather than shown broken; the count reflects what the learner sees.
  const steps = useMemo(
    () => (lesson?.steps ?? []).filter((s) => SUPPORTED.has(s.type)),
    [lesson],
  );

  const [queue, setQueue] = useState<number[]>(() => steps.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const anyWrong = useRef(false);

  // Re-seed when the lesson changes. In an effect, never during render:
  // setState while rendering is a React error and made this hook order-dependent.
  useEffect(() => {
    setQueue(steps.map((_, i) => i));
    setPos(0);
    setMastered(new Set());
    setHearts(MAX_HEARTS);
    setChecked(false);
    setCorrect(null);
    setDone(false);
    anyWrong.current = false;
  }, [steps]);

  const currentIndex = queue[pos] ?? -1;
  const step = currentIndex >= 0 ? steps[currentIndex] ?? null : null;
  const failed = hearts <= 0;

  /** Grade the current step. Teach steps are acknowledged, never graded. */
  const submit = useCallback((isCorrect: boolean) => {
    setChecked(true);
    setCorrect(isCorrect);
    if (!isCorrect) {
      anyWrong.current = true;
      setHearts((h) => Math.max(0, h - 1));
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
    setHearts(MAX_HEARTS);
    setChecked(false);
    setCorrect(null);
    setDone(false);
    anyWrong.current = false;
  }, [steps]);

  const total = steps.length;
  const state: RunState = {
    step,
    position: Math.min(mastered.size + 1, Math.max(total, 1)),
    total,
    progress: total ? mastered.size / total : 0,
    hearts,
    checked,
    correct,
    done,
    failed,
    earnedXp: lesson?.xpReward ?? 0,
    anyWrong: anyWrong.current,
  };

  return { ...state, submit, advance, retry, MAX_HEARTS };
}
