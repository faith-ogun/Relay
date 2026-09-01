import React, { useEffect, useState } from 'react';
import { Award, Camera, Check, Copy, Radio, Video } from 'lucide-react';
import { fetchCareer, reasonToSentence, type CareerEvidence } from '../../../services/careerLabs';

/**
 * The verified build record.
 *
 * Every hardware CV claims bench experience and every interviewer discounts it,
 * because there is no way to check. This is the screen that changes that: it
 * shows what Ohmlet actually WATCHED happen, and the number that matters most is
 * the one nobody else can produce, which is minutes with the camera genuinely
 * open on a real bench.
 *
 * Two rules, and they are the coach's rules too:
 *
 *   It never flatters. Ten minutes reads as ten minutes. There is no adjective
 *   anywhere on this screen, because "solid hands-on experience" is a claim the
 *   learner would have to defend in an interview and could not.
 *
 *   The caveat is shown, not buried. Every figure is a FLOOR, and someone about
 *   to put it in front of an employer needs that as prominently as the number.
 *
 * The phone has had this since it shipped. The web sold it on the pricing page
 * and never showed it, which is the worse half of that pair.
 */

interface Props {
  /** Absent when the workspace has no upgrade route wired (child-safe shells). */
  onUpgrade?: () => void;
  onOpenLive: (mode?: 'coach') => void;
  onOpenPath: () => void;
}

export const CareerView: React.FC<Props> = ({ onUpgrade, onOpenLive, onOpenPath }) => {
  const [ev, setEv] = useState<CareerEvidence | null>(null);
  const [failure, setFailure] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchCareer().then((r) => {
      if (!alive) return;
      if (r.ok) setEv(r.data);
      else setFailure(reasonToSentence(r.reason, 'Your build record'));
    });
    return () => { alive = false; };
  }, []);

  const copy = async () => {
    if (!ev) return;
    try {
      await navigator.clipboard.writeText(ev.summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission refused. The text is on screen and selectable, so
      // there is nothing to recover from and nothing worth interrupting for.
    }
  };

  if (failure) {
    return (
      <div className="ohmlet-rise mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-black tracking-[-0.02em]">Not right now</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{failure}</p>
        {failure.includes('Max') && onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-6 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-3 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
          >
            See Max
          </button>
        )}
      </div>
    );
  }

  if (!ev) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        <div className="h-40 animate-pulse rounded-[1.75rem] bg-ohmlet-line/60" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ohmlet-line/50" />)}
        </div>
      </div>
    );
  }

  const nothingYet = ev.bench.cameraMinutes === 0 && ev.assessed.unitsCleared === 0 && ev.artifacts.twins === 0;

  return (
    <div className="ohmlet-rise mx-auto max-w-3xl">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Verified by Ohmlet</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Your build record.</h1>
      <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
        What Ohmlet watched you do. Not what you say you did, which is the part an
        interviewer has no way to check.
      </p>

      {nothingYet ? (
        <div className="mt-8 rounded-[1.75rem] border-2 border-ohmlet-ink bg-ohmlet-surface p-8 text-center shadow-press">
          <Camera className="mx-auto h-9 w-9 text-ohmlet-gold-deep" strokeWidth={2.5} />
          <h2 className="mt-4 text-xl font-black tracking-tight">Nothing verified yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
            One live session with the camera on is the whole first step. That is
            the number nobody can produce for you.
          </p>
          <button
            type="button"
            onClick={() => onOpenLive()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-3 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
          >
            <Radio className="h-4 w-4" strokeWidth={2.5} /> Start a session
          </button>
        </div>
      ) : (
        <>
          {/* The headline, and the only figure a competitor cannot produce. */}
          <div className="mt-8 overflow-hidden rounded-[1.75rem] border-2 border-ohmlet-ink bg-ohmlet-ink text-ohmlet-on-ink shadow-press">
            <div className="px-7 py-8">
              <p className="text-6xl font-black leading-none tabular-nums tracking-[-0.04em] text-ohmlet-gold md:text-7xl">
                {ev.bench.cameraMinutes}
              </p>
              <p className="mt-2 text-lg font-black tracking-tight">minutes at a real bench</p>
              <p className="mt-1 text-sm font-semibold text-white/60">
                camera open, across {ev.bench.cameraSessions} session{ev.bench.cameraSessions === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cell value={`${ev.assessed.unitsCleared}/${ev.assessed.unitsTotal}`} label="unit exams passed" />
            <Cell value={ev.assessed.meanScore ? `${ev.assessed.meanScore}%` : '-'} label="mean exam score" />
            <Cell value={`${ev.artifacts.twins}`} label="builds captured in 3D" />
            <Cell value={`${ev.learning.gold}`} label="lessons drilled to Gold" />
          </div>

          {ev.assessed.strongest.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Strongest, by exam</h2>
              <div className="mt-3 divide-y divide-ohmlet-line overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-ohmlet-surface shadow-soft">
                {ev.assessed.strongest.map((u) => (
                  <div key={u.unitId} className="flex items-center gap-3 px-4 py-3">
                    <Award className="h-4 w-4 shrink-0 text-ohmlet-gold-deep" strokeWidth={2.5} />
                    <span className="flex-1 truncate text-sm font-extrabold">{u.title}</span>
                    <span className="text-sm font-black tabular-nums text-ohmlet-green-deep">{u.score}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {ev.assessed.attemptedNotCleared.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Met, not yet cleared</h2>
              <p className="mt-1 text-xs font-semibold text-ohmlet-ink-soft">
                The most useful thing on this page. You already know where these are.
              </p>
              <div className="mt-3 space-y-2">
                {ev.assessed.attemptedNotCleared.map((u) => (
                  <button
                    key={u.unitId}
                    type="button"
                    onClick={onOpenPath}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-surface px-4 py-3 text-left shadow-press-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
                  >
                    <span className="flex-1 truncate text-sm font-extrabold">{u.title}</span>
                    <span className="text-sm font-black tabular-nums text-ohmlet-red">{u.score}%</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">The line you can defend</h2>
            <blockquote className="mt-3 rounded-2xl border-l-4 border-ohmlet-gold bg-ohmlet-gold-soft px-5 py-4 text-[15px] font-semibold leading-relaxed text-ohmlet-ink">
              {ev.summary}
            </blockquote>
            <button
              type="button"
              onClick={copy}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-surface px-4 py-2.5 text-sm font-black text-ohmlet-ink transition-all hover:-translate-y-0.5"
            >
              {copied ? <Check className="h-4 w-4 text-ohmlet-green-deep" strokeWidth={2.5} /> : <Copy className="h-4 w-4" strokeWidth={2.5} />}
              {copied ? 'Copied' : 'Copy for a CV'}
            </button>
          </section>

          {/* The record is the input to the conversation, not the end of it. Ash
              reads it back honestly, names the gap, and decides what to build
              next. */}
          <section className="mt-8 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-surface p-5 shadow-press-sm">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Talk it through</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
              A coaching session opens on this record rather than on a blank page,
              so the conversation starts from what actually happened.
            </p>
            <button
              type="button"
              onClick={() => onOpenLive('coach')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-3 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
            >
              <Video className="h-4 w-4" strokeWidth={2.5} /> Start a coaching session
            </button>
          </section>
        </>
      )}

      {/* Shown, never buried: every figure above is a floor. */}
      <div className="mt-8 rounded-2xl border-2 border-dashed border-ohmlet-line px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">
          Read this before you quote it
        </p>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{ev.caveat}</p>
      </div>
    </div>
  );
};

const Cell: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="rounded-2xl border-2 border-ohmlet-line bg-ohmlet-surface px-4 py-4 shadow-soft">
    <p className="text-2xl font-black tabular-nums tracking-tight">{value}</p>
    <p className="mt-0.5 text-[11px] font-bold leading-snug text-ohmlet-ink-soft">{label}</p>
  </div>
);
