import React from 'react';
import { Calculator, Check, Cpu, Gauge, Lightbulb, Lock, Play, Trophy, Wrench, Zap } from 'lucide-react';
import {
  CURRICULUM,
  lessonRigor,
  nextLesson,
  type CurriculumAccent,
  type CurriculumLesson,
} from './ohmlet/data/curriculum';
import { LEVEL_META } from './ohmlet/data/levels';

type IconType = React.ComponentType<{ className?: string }>;

interface LearnPathProps {
  /** Ids of lessons the learner has completed (level >= 1). */
  completedLessonIds?: ReadonlySet<string>;
  /** Per-lesson level: 1 Bronze, 2 Silver, 3 Gold. */
  lessonLevels?: Record<string, number>;
  onStartLesson?: (lessonId: string) => void;
}

const SKILL_ICONS: Record<string, IconType> = {
  Zap,
  Wrench,
  Gauge,
  Cpu,
  Lightbulb,
  Trophy,
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
  level: number; // 0 not started, 1-3 medal
  onStart?: (id: string) => void;
}> = ({ lesson, state, accent, offset, level, onStart }) => {
  const a = ACCENT[accent];
  const medal = level >= 1 ? LEVEL_META[Math.min(3, level) as 1 | 2 | 3] : null;
  const rigor = lessonRigor(lesson.id);
  const base =
    'relative flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ohmlet-ink transition-all';
  const look =
    state === 'done'
      ? 'text-white shadow-press-sm'
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
        style={medal ? { background: medal.color } : undefined}
        aria-label={lesson.title}
        title={medal ? (level < 3 ? `${medal.name} — replay to level up` : 'Gold — mastered') : undefined}
      >
        {state === 'done' ? (
          <Check className="h-8 w-8" strokeWidth={3} />
        ) : state === 'active' ? (
          <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
        ) : (
          <Lock className="h-6 w-6" />
        )}
        {/* level pips */}
        {medal && (
          <span className="absolute -bottom-1 flex gap-0.5">
            {[1, 2, 3].map((p) => (
              <span key={p} className={`h-1.5 w-1.5 rounded-full border border-ohmlet-ink ${p <= level ? 'bg-white' : 'bg-ohmlet-ink/20'}`} />
            ))}
          </span>
        )}
        {/* rigor badge: this lesson involves real calculation (#42 difficulty signal) */}
        {rigor === 'calc' && state !== 'locked' && (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-white text-ohmlet-ink shadow-press-sm"
            title="This lesson includes calculation"
          >
            <Calculator className="h-3 w-3" strokeWidth={2.5} />
          </span>
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
      {medal && (
        <span className="mt-0.5 text-[11px] font-black uppercase tracking-wide" style={{ color: medal.color }}>
          {level < 3 ? `${medal.name} · level up` : 'Gold'}
        </span>
      )}
    </div>
  );
};

export const LearnPath: React.FC<LearnPathProps> = ({ completedLessonIds = new Set(), lessonLevels = {}, onStartLesson }) => {
  const next = nextLesson(completedLessonIds);
  let nodeIndex = 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-2">
      {/* Leveling legend */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold text-ohmlet-ink-soft">
        {([1, 2, 3] as const).map((lvl) => (
          <span key={lvl} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ohmlet-ink" style={{ background: LEVEL_META[lvl].color }} />
            {LEVEL_META[lvl].name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Calculator className="h-3 w-3" strokeWidth={2.5} />
          involves calculation
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
                          level={lessonLevels[lesson.id] ?? 0}
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
