// ── Lesson linter ──
//
// A pure, dependency-free validator for the authored curriculum. It catches the
// errors a human reviewer would otherwise only find by playing every lesson:
// out-of-range answers, broken circuit/region references, malformed exercises,
// orphaned or missing lessons.
//
// Used in two places (so the same rules apply everywhere):
//   • `npm run lint:lessons` (frontend/scripts/lint-lessons.mjs) — CI / pre-commit
//   • the /author preview route — shows per-lesson status while reviewing
//
// No React, no Node APIs: just data in, problems out.

import type { LessonStep } from './lessons';
import type { CurriculumUnit } from './curriculum';
import { CIRCUIT_REGIONS, isKnownCircuit, regionsFor } from '../circuits/registry';

export type LintSeverity = 'error' | 'warn';

export interface LintProblem {
  lessonId: string;
  stepIndex: number | null; // null = lesson-level problem
  stepType?: string;
  severity: LintSeverity;
  message: string;
}

export type LessonContent = Record<string, { steps: LessonStep[]; xpReward: number }>;

const CHOICE_TYPES = new Set(['multiple_choice', 'predict_reading', 'predict_behavior', 'choose_resistor']);

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isPermutationOf = (arr: number[], n: number): boolean => {
  if (arr.length !== n) return false;
  const seen = new Set(arr);
  if (seen.size !== n) return false;
  for (let i = 0; i < n; i++) if (!seen.has(i)) return false;
  return true;
};

/** Validate one step. Pushes problems for the given lesson/step index. */
function lintStep(lessonId: string, i: number, step: LessonStep, push: (p: Omit<LintProblem, 'lessonId' | 'stepIndex' | 'stepType'>) => void) {
  const err = (message: string) => push({ severity: 'error', message });
  const warn = (message: string) => push({ severity: 'warn', message });

  // Any step may reference a circuit; if it does, it must exist.
  const circuit = (step as { circuitDiagram?: string }).circuitDiagram;
  if (circuit !== undefined && !isKnownCircuit(circuit)) {
    err(`references unknown circuit "${circuit}" (known: ${Object.keys(CIRCUIT_REGIONS).join(', ')})`);
  }

  switch (step.type) {
    case 'teach': {
      if (!isNonEmpty(step.title)) err('teach: empty title');
      if (!isNonEmpty(step.body)) err('teach: empty body');
      break;
    }
    case 'multiple_choice':
    case 'predict_reading':
    case 'predict_behavior':
    case 'choose_resistor': {
      const s = step as { question: string; options: string[]; correct: number; explanation: string };
      if (!isNonEmpty(s.question)) err(`${step.type}: empty question`);
      if (!Array.isArray(s.options) || s.options.length < 2) err(`${step.type}: needs at least 2 options`);
      else {
        if (s.options.some((o) => !isNonEmpty(o))) err(`${step.type}: has an empty option`);
        if (new Set(s.options).size !== s.options.length) warn(`${step.type}: duplicate options`);
        if (!Number.isInteger(s.correct) || s.correct < 0 || s.correct >= s.options.length)
          err(`${step.type}: correct index ${s.correct} is out of range (0..${s.options.length - 1})`);
        else if (s.options.length >= 3) {
          // The "longest answer is correct" tell: distractors should match the
          // correct answer in length (item-writing best practice). Flag when the
          // correct option is clearly the longest by a wide margin.
          const lens = s.options.map((o) => o.trim().length);
          const correctLen = lens[s.correct];
          const others = lens.filter((_, i) => i !== s.correct);
          const avgOther = others.reduce((a, b) => a + b, 0) / others.length;
          if (correctLen === Math.max(...lens) && correctLen >= avgOther * 1.6 && correctLen - avgOther >= 12)
            warn(`${step.type}: correct option is much longer than the distractors (the "longest answer" tell — pad the distractors to match)`);
        }
      }
      if (!isNonEmpty(s.explanation)) warn(`${step.type}: empty explanation`);
      break;
    }
    case 'true_false': {
      if (!isNonEmpty(step.statement)) err('true_false: empty statement');
      if (typeof step.correct !== 'boolean') err('true_false: correct must be true/false');
      if (!isNonEmpty(step.explanation)) warn('true_false: empty explanation');
      break;
    }
    case 'fill_blank': {
      if (!isNonEmpty(step.prompt)) err('fill_blank: empty prompt');
      if (!isNonEmpty(step.answer)) err('fill_blank: empty answer');
      if (!isNonEmpty(step.hint)) warn('fill_blank: empty hint');
      else if (isNonEmpty(step.answer) && step.answer.trim().length >= 2 && step.hint.toLowerCase().includes(step.answer.trim().toLowerCase()))
        warn('fill_blank: the hint contains the answer (hints should nudge toward the method, not give it away)');
      break;
    }
    case 'match': {
      if (!isNonEmpty(step.instruction)) err('match: empty instruction');
      if (!Array.isArray(step.pairs) || step.pairs.length < 2) err('match: needs at least 2 pairs');
      else {
        step.pairs.forEach((pair, p) => {
          if (!Array.isArray(pair) || pair.length !== 2 || !isNonEmpty(pair[0]) || !isNonEmpty(pair[1]))
            err(`match: pair ${p} must be [left, right] and both non-empty`);
        });
        const lefts = step.pairs.map((p) => p[0]);
        if (new Set(lefts).size !== lefts.length) warn('match: duplicate left labels (confusing even though right-side duplicates are fine)');
      }
      break;
    }
    case 'drag_order': {
      if (!isNonEmpty(step.instruction)) err('drag_order: empty instruction');
      if (!Array.isArray(step.items) || step.items.length < 2) err('drag_order: needs at least 2 items');
      else if (!isPermutationOf(step.correctOrder, step.items.length))
        err(`drag_order: correctOrder must be a permutation of 0..${step.items.length - 1}`);
      break;
    }
    case 'spot_error':
    case 'identify_component': {
      const s = step as { question: string; circuitDiagram: string; explanation: string } & {
        correctRegion?: string;
        correctComponent?: string;
      };
      const region = step.type === 'spot_error' ? s.correctRegion : s.correctComponent;
      const field = step.type === 'spot_error' ? 'correctRegion' : 'correctComponent';
      if (!isNonEmpty(s.question)) err(`${step.type}: empty question`);
      if (!isNonEmpty(s.circuitDiagram)) err(`${step.type}: missing circuitDiagram`);
      else if (isKnownCircuit(s.circuitDiagram)) {
        const valid = regionsFor(s.circuitDiagram);
        if (!isNonEmpty(region)) err(`${step.type}: missing ${field}`);
        else if (!valid.includes(region!))
          err(`${step.type}: ${field} "${region}" is not a clickable region of "${s.circuitDiagram}" (valid: ${valid.join(', ')})`);
      }
      if (!isNonEmpty(s.explanation)) warn(`${step.type}: empty explanation`);
      break;
    }
    case 'draw_connection': {
      if (!isNonEmpty(step.instruction)) err('draw_connection: empty instruction');
      const ids = new Set<string>();
      if (!Array.isArray(step.terminals) || step.terminals.length < 2) err('draw_connection: needs at least 2 terminals');
      else
        step.terminals.forEach((t, ti) => {
          if (!isNonEmpty(t.id)) err(`draw_connection: terminal ${ti} missing id`);
          else if (ids.has(t.id)) err(`draw_connection: duplicate terminal id "${t.id}"`);
          else ids.add(t.id);
          if (!isNonEmpty(t.label)) err(`draw_connection: terminal ${ti} missing label`);
          if (typeof t.x !== 'number' || typeof t.y !== 'number') err(`draw_connection: terminal ${ti} missing x/y`);
        });
      if (!Array.isArray(step.expectedConnections) || step.expectedConnections.length < 1) err('draw_connection: needs at least 1 expected connection');
      else
        step.expectedConnections.forEach(([a, b], ci) => {
          if (!ids.has(a)) err(`draw_connection: connection ${ci} references unknown terminal "${a}"`);
          if (!ids.has(b)) err(`draw_connection: connection ${ci} references unknown terminal "${b}"`);
        });
      break;
    }
    case 'trace_current': {
      const s = step as { question: string; circuitDiagram: string; correctPath: string[]; explanation: string };
      if (!isNonEmpty(s.question)) err('trace_current: empty question');
      if (!isNonEmpty(s.circuitDiagram)) err('trace_current: missing circuitDiagram');
      if (!Array.isArray(s.correctPath) || s.correctPath.length < 2) err('trace_current: correctPath needs at least 2 steps');
      else if (isKnownCircuit(s.circuitDiagram)) {
        const valid = regionsFor(s.circuitDiagram);
        s.correctPath.forEach((r, ri) => {
          if (!valid.includes(r)) err(`trace_current: correctPath[${ri}] "${r}" is not a clickable region of "${s.circuitDiagram}" (valid: ${valid.join(', ')})`);
        });
        if (new Set(s.correctPath).size !== s.correctPath.length) warn('trace_current: correctPath repeats a region (a simple loop visits each part once)');
      }
      if (!isNonEmpty(s.explanation)) warn('trace_current: empty explanation');
      break;
    }
    case 'fix_the_circuit': {
      const s = step as { question: string; circuitDiagram: string; faultRegion: string; fixes: string[]; correctFix: number; explanation: string };
      if (!isNonEmpty(s.question)) err('fix_the_circuit: empty question');
      if (!isNonEmpty(s.circuitDiagram)) err('fix_the_circuit: missing circuitDiagram');
      else if (isKnownCircuit(s.circuitDiagram)) {
        const valid = regionsFor(s.circuitDiagram);
        if (!isNonEmpty(s.faultRegion)) err('fix_the_circuit: missing faultRegion');
        else if (!valid.includes(s.faultRegion)) err(`fix_the_circuit: faultRegion "${s.faultRegion}" is not a clickable region of "${s.circuitDiagram}" (valid: ${valid.join(', ')})`);
      }
      if (!Array.isArray(s.fixes) || s.fixes.length < 2) err('fix_the_circuit: needs at least 2 fixes');
      else {
        if (s.fixes.some((f) => !isNonEmpty(f))) err('fix_the_circuit: has an empty fix option');
        if (!Number.isInteger(s.correctFix) || s.correctFix < 0 || s.correctFix >= s.fixes.length)
          err(`fix_the_circuit: correctFix index ${s.correctFix} is out of range (0..${s.fixes.length - 1})`);
        else if (s.fixes.length >= 3) {
          const lens = s.fixes.map((o) => o.trim().length);
          const correctLen = lens[s.correctFix];
          const others = lens.filter((_, i) => i !== s.correctFix);
          const avgOther = others.reduce((a, b) => a + b, 0) / others.length;
          if (correctLen === Math.max(...lens) && correctLen >= avgOther * 1.6 && correctLen - avgOther >= 12)
            warn('fix_the_circuit: correct fix is much longer than the distractors (the "longest answer" tell)');
        }
      }
      if (!isNonEmpty(s.explanation)) warn('fix_the_circuit: empty explanation');
      break;
    }
    case 'build_to_spec': {
      const s = step as { instruction: string; palette: string[]; slots: number; correct: number[]; explanation: string };
      if (!isNonEmpty(s.instruction)) err('build_to_spec: empty instruction');
      if (!Array.isArray(s.palette) || s.palette.length < 2) err('build_to_spec: palette needs at least 2 parts');
      else if (s.palette.some((p) => !isNonEmpty(p))) err('build_to_spec: has an empty palette part');
      if (!Number.isInteger(s.slots) || s.slots < 1) err('build_to_spec: slots must be a positive integer');
      else if (Array.isArray(s.palette) && s.palette.length <= s.slots) warn('build_to_spec: palette should include distractor parts (more parts than slots) so it tests recognition');
      if (!Array.isArray(s.correct) || s.correct.length !== s.slots) err(`build_to_spec: correct must list one palette index per slot (expected ${s.slots})`);
      else if (Array.isArray(s.palette) && s.correct.some((c) => !Number.isInteger(c) || c < 0 || c >= s.palette.length))
        err(`build_to_spec: a correct index is out of range (0..${s.palette.length - 1})`);
      if (!isNonEmpty(s.explanation)) warn('build_to_spec: empty explanation');
      break;
    }
    default: {
      err(`unknown step type "${(step as { type: string }).type}"`);
    }
  }
}

/** Lint a single lesson's content. */
function lintLesson(lessonId: string, lesson: { steps: LessonStep[]; xpReward: number }, problems: LintProblem[]) {
  const pushLesson = (severity: LintSeverity, message: string) => problems.push({ lessonId, stepIndex: null, severity, message });

  if (typeof lesson.xpReward !== 'number' || lesson.xpReward <= 0) pushLesson('warn', `xpReward should be a positive number (got ${lesson.xpReward})`);
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
    pushLesson('error', 'lesson has no steps');
    return;
  }

  const nonTeach = lesson.steps.filter((s) => s.type !== 'teach').length;
  if (nonTeach === 0) pushLesson('warn', 'lesson has no interactive steps (all teach)');
  else if (nonTeach < 6) pushLesson('warn', `only ${nonTeach} graded questions; aim for 8+ (12+ for a tiered pool that levels well)`);

  let consecutiveTeach = 0;
  lesson.steps.forEach((step, i) => {
    consecutiveTeach = step.type === 'teach' ? consecutiveTeach + 1 : 0;
    if (consecutiveTeach === 3) pushLesson('warn', `3+ consecutive teach steps starting near step ${i - 2} (break them up)`);
    lintStep(lessonId, i, step, ({ severity, message }) =>
      problems.push({ lessonId, stepIndex: i, stepType: step.type, severity, message }),
    );
  });
}

/**
 * Lint the whole curriculum. Pass CURRICULUM to also check that every referenced
 * lesson has content (and flag orphans). Returns all problems, errors and warns.
 */
export function lintLessons(content: LessonContent, curriculum?: CurriculumUnit[]): LintProblem[] {
  const problems: LintProblem[] = [];

  for (const [lessonId, lesson] of Object.entries(content)) {
    lintLesson(lessonId, lesson, problems);
  }

  if (curriculum) {
    const referenced = new Map<string, number>();
    for (const unit of curriculum)
      for (const skill of unit.skills)
        for (const l of skill.lessons) referenced.set(l.id, (referenced.get(l.id) ?? 0) + 1);

    for (const [id, count] of referenced) {
      if (!(id in content)) problems.push({ lessonId: id, stepIndex: null, severity: 'error', message: 'referenced in curriculum but has no authored content' });
      if (count > 1) problems.push({ lessonId: id, stepIndex: null, severity: 'error', message: `referenced ${count} times in the curriculum (should be once)` });
    }
    for (const id of Object.keys(content)) {
      if (!referenced.has(id)) problems.push({ lessonId: id, stepIndex: null, severity: 'warn', message: 'has content but is not referenced anywhere in the curriculum (orphan)' });
    }
  }

  return problems;
}

export interface LintSummary {
  problems: LintProblem[];
  errorCount: number;
  warnCount: number;
  lessonsWithErrors: number;
  ok: boolean;
}

/** Convenience wrapper that also computes counts. */
export function summarizeLint(content: LessonContent, curriculum?: CurriculumUnit[]): LintSummary {
  const problems = lintLessons(content, curriculum);
  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warnCount = problems.filter((p) => p.severity === 'warn').length;
  const lessonsWithErrors = new Set(problems.filter((p) => p.severity === 'error').map((p) => p.lessonId)).size;
  return { problems, errorCount, warnCount, lessonsWithErrors, ok: errorCount === 0 };
}
