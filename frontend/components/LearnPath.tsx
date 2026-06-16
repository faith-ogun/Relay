import React from 'react';
import { Check, Gauge, Lock, Play, Wrench, Zap } from 'lucide-react';
import {
  CURRICULUM,
  allLessons,
  nextLesson,
  type CurriculumAccent,
  type CurriculumLesson,
} from './ohmlet/data/curriculum';

type IconType = React.ComponentType<{ className?: string }>;

interface LearnPathProps {
  /** Ids of lessons the learner has completed. */
  completedLessonIds?: ReadonlySet<string>;
  onStartLesson?: (lessonId: string) => void;
}

const SKILL_ICONS: Record<string, IconType> = {
  Zap,
  Wrench,
  Gauge,
};

const ACCENT: Record<CurriculumAccent, { chip: string; ring: string; done: string }> = {
  gold: { chip: 'bg-ohmlet-gold-soft text-ohmlet-ink', ring: 'ring-ohmlet-gold', done: 'bg-ohmlet-gold' },
  blue: { chip: 'bg-ohmlet-blue-soft text-ohmlet-blue-deep', ring: 'ring-ohmlet-blue', done: 'bg-ohmlet-blue' },
  green: { chip: 'bg-[#eef7e0] text-ohmlet-green-deep', ring: 'ring-ohmlet-green', done: 'bg-ohmlet-green' },
  red: { chip: 'bg-[#fdece8] text-ohmlet-red', ring: 'ring-ohmlet-red', done: 'bg-ohmlet-red' },
};

// Winding path: nudge each node left/center/right so it reads as a trail, not a list.
const OFFSETS = ['translate-x-0', 'translate-x-16', 'translate-x-0', '-translate-x-16'];

type NodeState = 'done' | 'active' | 'locked';

const LessonNode: React.FC<{
  lesson: CurriculumLesson;
  state: NodeState;
  accent: CurriculumAccent;
  offset: string;
  onStart?: (id: string) => void;
}> = ({ lesson, state, accent, offset, onStart }) => {
  const a = ACCENT[accent];
  const base =
    'relative flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ohmlet-ink transition-all';
  const look =
    state === 'done'
      ? `${a.done} text-ohmlet-ink shadow-press-sm`
      : state === 'active'
      ? `bg-white text-ohmlet-ink shadow-press ring-4 ring-offset-2 ${a.ring} ohmlet-pulse-glow`
      : 'bg-ohmlet-line/60 text-ohmlet-ink/30 border-ohmlet-ink/20';

  return (
    <div className={`flex flex-col items-center ${offset}`}>
      <button
        type="button"
        disabled={state === 'locked'}
        onClick={() => state !== 'locked' && onStart?.(lesson.id)}
        className={`${base} ${look} ${state !== 'locked' ? 'hover:-translate-y-0.5' : 'cursor-not-allowed'}`}
        aria-label={lesson.title}
      >
        {state === 'done' ? (
          <Check className="h-8 w-8" strokeWidth={3} />
        ) : state === 'active' ? (
          <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
        ) : (
          <Lock className="h-6 w-6" />
        )}
      </button>
      <span
        className={`mt-2 max-w-[8rem] text-center text-xs font-extrabold ${
          state === 'locked' ? 'text-ohmlet-ink/40' : 'text-ohmlet-ink'
        }`}
      >
        {lesson.title}
      </span>
      {state === 'active' && (
        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-ohmlet-ink-soft">
          {lesson.estMinutes} min
        </span>
      )}
    </div>
  );
};

export const LearnPath: React.FC<LearnPathProps> = ({ completedLessonIds = new Set(), onStartLesson }) => {
  const next = nextLesson(completedLessonIds);
  const done = allLessons().filter((l) => completedLessonIds.has(l.id)).length;
  const total = allLessons().length;
  let nodeIndex = 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      {/* Progress header */}
      <div className="sticky top-2 z-10 mb-8 flex items-center gap-3 rounded-2xl border-2 border-ohmlet-ink bg-white/90 px-5 py-3 shadow-soft backdrop-blur">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-ohmlet-line">
          <div
            className="h-full rounded-full bg-ohmlet-gold transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm font-black text-ohmlet-ink">
          {done}/{total}
        </span>
      </div>

      {CURRICULUM.map((unit) => {
        const a = ACCENT[unit.accent];
        return (
          <section key={unit.id} className="mb-12">
            <div className="mb-8 text-center">
              <span className={`inline-block rounded-full px-4 py-1 text-xs font-black uppercase tracking-[0.16em] ${a.chip}`}>
                {unit.level}
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.02em] text-ohmlet-ink">{unit.title}</h2>
              <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">{unit.subtitle}</p>
            </div>

            {unit.skills.map((skill) => {
              const SkillIcon = SKILL_ICONS[skill.icon] ?? Zap;
              return (
                <div key={skill.id} className="mb-10">
                  <div className="mx-auto mb-6 flex max-w-md items-center gap-3 rounded-2xl border-2 border-ohmlet-ink bg-white px-4 py-3 shadow-press-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ohmlet-ink text-ohmlet-gold">
                      <SkillIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-black leading-tight text-ohmlet-ink">{skill.title}</h3>
                      <p className="text-xs font-semibold text-ohmlet-ink-soft">{skill.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-7">
                    {skill.lessons.map((lesson) => {
                      const state: NodeState = completedLessonIds.has(lesson.id)
                        ? 'done'
                        : next && lesson.id === next.id
                        ? 'active'
                        : 'locked';
                      const offset = OFFSETS[nodeIndex % OFFSETS.length];
                      nodeIndex += 1;
                      return (
                        <LessonNode
                          key={lesson.id}
                          lesson={lesson}
                          state={state}
                          accent={unit.accent}
                          offset={offset}
                          onStart={onStartLesson}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
};
