import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CircleAlert, Eye, Play } from 'lucide-react';
import { CURRICULUM, type CurriculumAccent } from '../data/curriculum';
import { LESSON_CONTENT } from '../data/lessons';
import { summarizeLint, type LintProblem } from '../data/lessonSchema';
import { LessonRunner } from './LessonRunner';

/**
 * AuthorPreview — the lesson review console (/author, admin-only).
 *
 * The human-approval surface of the authoring pipeline: every lesson listed with
 * its live lint status, previewable through the REAL LessonRunner (so "preview"
 * is exactly what ships). This is where a reviewer approves or sends back a
 * lesson in a few minutes instead of re-deriving it from JSON.
 */

const ACCENT_HEX: Record<CurriculumAccent, string> = {
  gold: '#facc2e',
  blue: '#549cf0',
  green: '#84cc30',
  red: '#ff6f5e',
};

interface AuthorPreviewProps {
  onBack?: () => void;
}

export const AuthorPreview: React.FC<AuthorPreviewProps> = ({ onBack }) => {
  const [preview, setPreview] = useState<{ id: string; accent: string } | null>(null);

  const { summary, byLesson } = useMemo(() => {
    const summary = summarizeLint(LESSON_CONTENT, CURRICULUM);
    const byLesson = new Map<string, LintProblem[]>();
    for (const p of summary.problems) {
      if (!byLesson.has(p.lessonId)) byLesson.set(p.lessonId, []);
      byLesson.get(p.lessonId)!.push(p);
    }
    return { summary, byLesson };
  }, []);

  const totalLessons = Object.keys(LESSON_CONTENT).length;

  if (preview) {
    return (
      <div className="min-h-screen bg-ohmlet-cream">
        <div className="flex items-center justify-between border-b border-ohmlet-line bg-white px-5 py-2.5">
          <span className="text-sm font-black text-ohmlet-ink">Previewing: {preview.id}</span>
          <button onClick={() => setPreview(null)} className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ohmlet-ink bg-white px-3 py-1.5 text-xs font-black shadow-press-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to list
          </button>
        </div>
        <LessonRunner
          key={preview.id}
          lessonId={preview.id}
          accent={preview.accent}
          preview
          onExit={() => setPreview(null)}
          onComplete={() => setPreview(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display text-ohmlet-ink">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-ohmlet-line bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Author · lesson QA</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight">Review console</h1>
          </div>
          <div className="flex items-center gap-2">
            <Stat label="lessons" value={`${totalLessons}`} tone="ink" />
            <Stat label="errors" value={`${summary.errorCount}`} tone={summary.errorCount ? 'red' : 'green'} />
            <Stat label="warnings" value={`${summary.warnCount}`} tone={summary.warnCount ? 'amber' : 'green'} />
            {onBack && (
              <button onClick={onBack} className="ml-2 inline-flex items-center gap-1.5 rounded-xl border-2 border-ohmlet-ink bg-white px-3 py-2 text-sm font-black shadow-press-sm">
                <ArrowLeft className="h-4 w-4" /> App
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {summary.ok ? (
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-ohmlet-green bg-[#f1f9e6] px-4 py-1.5 text-sm font-black text-ohmlet-green-deep">
            <Check className="h-4 w-4" /> All lessons pass the linter
          </p>
        ) : (
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-ohmlet-red bg-[#fdece8] px-4 py-1.5 text-sm font-black text-ohmlet-red">
            <CircleAlert className="h-4 w-4" /> {summary.lessonsWithErrors} lesson(s) need fixing before they ship
          </p>
        )}

        {CURRICULUM.map((unit) => (
          <section key={unit.id} className="mb-9">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-black tracking-tight">{unit.title}</h2>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${ACCENT_HEX[unit.accent]}33`, color: '#46514e' }}>
                {unit.level}
              </span>
            </div>
            <div className="space-y-4">
              {unit.skills.map((skill) => (
                <div key={skill.id}>
                  <p className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-ohmlet-ink-soft">{skill.title}</p>
                  <div className="overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-white">
                    {skill.lessons.map((lesson, li) => {
                      const problems = byLesson.get(lesson.id) ?? [];
                      const hasContent = lesson.id in LESSON_CONTENT;
                      const errors = problems.filter((p) => p.severity === 'error');
                      const warns = problems.filter((p) => p.severity === 'warn');
                      const stepCount = hasContent ? LESSON_CONTENT[lesson.id].steps.length : 0;
                      return (
                        <div key={lesson.id} className={`px-4 py-3 ${li > 0 ? 'border-t border-ohmlet-line' : ''}`}>
                          <div className="flex items-center gap-3">
                            <StatusDot errors={errors.length} warns={warns.length} hasContent={hasContent} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black">{lesson.title}</p>
                              <p className="truncate text-xs font-semibold text-ohmlet-ink-soft">
                                {hasContent ? `${stepCount} steps · ${LESSON_CONTENT[lesson.id].xpReward} XP` : 'no authored content'}
                                <span className="ml-1 text-ohmlet-ink-soft/60">· {lesson.id}</span>
                              </p>
                            </div>
                            <button
                              onClick={() => setPreview({ id: lesson.id, accent: ACCENT_HEX[unit.accent] })}
                              disabled={!hasContent}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-3 py-1.5 text-xs font-black shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-40"
                            >
                              {hasContent ? <><Eye className="h-3.5 w-3.5" /> Preview</> : <><Play className="h-3.5 w-3.5" /> Missing</>}
                            </button>
                          </div>
                          {problems.length > 0 && (
                            <ul className="mt-2 space-y-1 pl-7">
                              {problems.map((p, pi) => (
                                <li key={pi} className="flex items-start gap-1.5 text-xs font-semibold">
                                  {p.severity === 'error' ? (
                                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ohmlet-red" />
                                  ) : (
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ohmlet-gold-deep" />
                                  )}
                                  <span className={p.severity === 'error' ? 'text-ohmlet-red' : 'text-ohmlet-ink-soft'}>
                                    {p.stepIndex !== null ? `step ${p.stepIndex}: ` : ''}{p.message}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const StatusDot: React.FC<{ errors: number; warns: number; hasContent: boolean }> = ({ errors, warns, hasContent }) => {
  if (!hasContent || errors > 0)
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ohmlet-red text-white"><CircleAlert className="h-3.5 w-3.5" /></span>;
  if (warns > 0)
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ohmlet-gold text-ohmlet-ink"><AlertTriangle className="h-3.5 w-3.5" /></span>;
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ohmlet-green text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>;
};

const Stat: React.FC<{ label: string; value: string; tone: 'ink' | 'red' | 'amber' | 'green' }> = ({ label, value, tone }) => {
  const color = tone === 'red' ? 'text-ohmlet-red' : tone === 'amber' ? 'text-ohmlet-gold-deep' : tone === 'green' ? 'text-ohmlet-green-deep' : 'text-ohmlet-ink';
  return (
    <div className="rounded-xl border-2 border-ohmlet-line bg-white px-3 py-1.5 text-center">
      <p className={`text-base font-black tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ohmlet-ink-soft">{label}</p>
    </div>
  );
};
