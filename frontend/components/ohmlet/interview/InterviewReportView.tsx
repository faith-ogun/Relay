import React from 'react';
import { ArrowRight, CheckCircle2, Lightbulb, RotateCcw, Target, TrendingUp } from 'lucide-react';
import type { InterviewReport } from '../../../services/interview';

// Renders the post-interview feedback report (#21). The value of the whole
// feature lands here: a readiness headline, per-competency scores vs the JD,
// per-answer reasoning + a modeled stronger answer, and the next steps that route
// back into Ohmlet's lessons. Never a cold verdict; always the why.

const scoreColor = (s: number) =>
  s >= 4 ? 'var(--ohmlet-green-deep, #6fb519)' : s >= 3 ? 'var(--ohmlet-gold-deep, #f5b800)' : 'var(--ohmlet-red, #ff6f5e)';

const Bar: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div>
    <div className="flex items-baseline justify-between">
      <span className="text-xs font-bold text-ohmlet-ink-soft">{label}</span>
      <span className="text-xs font-black tabular-nums text-ohmlet-ink">{score}/5</span>
    </div>
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ohmlet-line">
      <div className="h-full rounded-full transition-all" style={{ width: `${(score / 5) * 100}%`, background: scoreColor(score) }} />
    </div>
  </div>
);

interface Props {
  report: InterviewReport;
  onRetry: () => void;
  onOpenLessons?: () => void;
}

export const InterviewReportView: React.FC<Props> = ({ report, onRetry, onOpenLessons }) => {
  const r = report;
  return (
    <div className="ohmlet-rise mx-auto max-w-3xl">
      {/* Readiness headline */}
      <div className="overflow-hidden rounded-[1.75rem] border-2 border-ohmlet-ink bg-ohmlet-ink text-white shadow-press">
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-3">
          <Target className="h-4 w-4 text-ohmlet-gold" />
          <span className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Interview readiness</span>
          <span className="ml-auto rounded-full bg-ohmlet-gold px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-ohmlet-ink">
            {r.readiness?.level}
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-wide text-ohmlet-gold">What would most hold you back</p>
          <p className="mt-1 text-xl font-black leading-snug">{r.readiness?.headline}</p>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/75">{r.readiness?.summary}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-black">
            Overall <span className="text-ohmlet-gold">{r.overall}/5</span>
          </div>
        </div>
      </div>

      {/* Top action items */}
      {r.actions?.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-ohmlet-gold-deep" />
            <h3 className="text-sm font-black uppercase tracking-wide text-ohmlet-ink">Focus on these next</h3>
          </div>
          <ol className="mt-3 space-y-2">
            {r.actions.slice(0, 3).map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] font-semibold leading-relaxed text-ohmlet-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ohmlet-ink text-[11px] font-black text-white">
                  {i + 1}
                </span>
                {a}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Competencies vs the JD */}
      {r.competencies?.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-ohmlet-line bg-white p-5 shadow-soft">
          <h3 className="text-sm font-black uppercase tracking-wide text-ohmlet-ink-soft">Skills vs the role</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {r.competencies.map((c, i) => (
              <div key={i}>
                <div className="flex items-center gap-1.5">
                  {c.covered ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-ohmlet-green-deep" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-ohmlet-line" />
                  )}
                  <span className="truncate text-sm font-extrabold text-ohmlet-ink">{c.name}</span>
                </div>
                <Bar label={c.covered ? 'Tested' : 'Not covered'} score={c.score} />
                {c.note && <p className="mt-1 text-xs font-semibold leading-snug text-ohmlet-ink-soft">{c.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-answer breakdown */}
      {r.answers?.length > 0 && (
        <section className="mt-6">
          <h3 className="px-1 text-sm font-black uppercase tracking-wide text-ohmlet-ink-soft">Answer by answer</h3>
          <div className="mt-3 space-y-4">
            {r.answers.map((a, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-white shadow-soft">
                <div className="border-b border-ohmlet-line bg-ohmlet-cream px-4 py-3">
                  <p className="text-sm font-extrabold text-ohmlet-ink">{a.question}</p>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    {a.excerpt && (
                      <p className="border-l-2 border-ohmlet-line pl-3 text-sm font-semibold italic leading-relaxed text-ohmlet-ink-soft">
                        “{a.excerpt}”
                      </p>
                    )}
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-ohmlet-ink">{a.why}</p>
                    <div className="mt-3 rounded-xl border-2 border-ohmlet-green/40 bg-[#f2fae4] p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-ohmlet-green-deep">
                        <TrendingUp className="h-3.5 w-3.5" /> A stronger answer
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-ohmlet-ink">{a.stronger}</p>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:w-44 sm:grid-cols-1">
                    <Bar label="Technical" score={a.technical} />
                    <Bar label="Structure" score={a.structure} />
                    <Bar label="Communication" score={a.communication} />
                    <Bar label="Signal" score={a.signal} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delivery + study next */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {r.delivery?.notes && (
          <section className="rounded-2xl border-2 border-ohmlet-line bg-white p-5 shadow-soft">
            <h3 className="text-sm font-black uppercase tracking-wide text-ohmlet-ink-soft">How you came across</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink">{r.delivery.notes}</p>
          </section>
        )}
        {r.recommendedTopics?.length > 0 && (
          <section className="rounded-2xl border-2 border-ohmlet-ink bg-white p-5 shadow-press-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-ohmlet-ink">Study these in Ohmlet</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.recommendedTopics.map((t, i) => (
                <span key={i} className="rounded-full border-2 border-ohmlet-line bg-ohmlet-cream px-3 py-1 text-xs font-bold text-ohmlet-ink">
                  {t}
                </span>
              ))}
            </div>
            {onOpenLessons && (
              <button
                type="button"
                onClick={onOpenLessons}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-ohmlet-ink underline decoration-ohmlet-gold-deep decoration-2 underline-offset-2"
              >
                Open the learning path <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </section>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-3 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.5} /> Practice another round
        </button>
      </div>
    </div>
  );
};
