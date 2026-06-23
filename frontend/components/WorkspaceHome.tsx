import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Boxes,
  Flame,
  Home,
  Map as MapIcon,
  PenTool,
  Play,
  Radio,
  Settings,
  Sparkles,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { CURRICULUM, allLessons, nextLesson, type CurriculumAccent } from './ohmlet/data/curriculum';
import { LearnPath } from './LearnPath';
import { LessonRunner } from './ohmlet/views/LessonRunner';
import { LiveTutorView } from './ohmlet/views/LiveTutorView';
import { SandboxView } from './ohmlet/views/SandboxView';
import { CommunityView } from './ohmlet/views/CommunityView';
import { reportXp } from '../services/community';
import { AchievementsView } from './ohmlet/views/AchievementsView';
import { usePlan } from '../hooks/usePlan';
import { useIdentity } from '../hooks/useIdentity';
import { useAuth } from '../hooks/useAuth';
import { useOhmletUserState } from '../hooks/useOhmletUserState';
import { PLAN_META, type Plan } from './ohmlet/entitlements';
import { LEVEL_META, nextAttemptLevel } from './ohmlet/data/levels';

interface ProgressState {
  /** Per-lesson level: 1 Bronze, 2 Silver, 3 Gold. Present at >=1 means completed. */
  lessonLevels: Record<string, number>;
  xp: number;
  streak: number;
  completedToday: number;
  lastActiveDate: string;
  /** Legacy field (pre-leveling); migrated into lessonLevels on load. */
  completedLessonIds?: string[];
  [k: string]: unknown; // satisfies useOhmletUserState's Record<string, unknown> constraint
}

const PROGRESS_DEFAULTS: ProgressState = {
  lessonLevels: {},
  xp: 0,
  streak: 0,
  completedToday: 0,
  lastActiveDate: '',
};

const dayStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

/**
 * WorkspaceHome — the Ohmlet app workspace.
 *
 * A "Today" hub leads with the next action and the live-tutor differentiator,
 * with a left rail to the deeper surfaces (path, live tutor, sandbox, community,
 * achievements). Lesson launches mount the LessonRunner over the workspace.
 *
 * Progress/XP live here in component state for now; persistence (firestore-
 * mediated) wires into these same setters when the backing store lands.
 */

interface WorkspaceHomeProps {
  onBack?: () => void;
  onUpgrade?: () => void;
  onAccount?: () => void;
}

type ViewId = 'today' | 'path' | 'live' | 'sandbox' | 'community' | 'achievements' | 'draw';

const ACCENT_HEX: Record<CurriculumAccent, string> = {
  gold: '#facc2e',
  blue: '#549cf0',
  green: '#84cc30',
  red: '#ff6f5e',
};

/** Accent hex for the unit that owns a lesson (defaults to gold). */
const lessonAccentHex = (lessonId: string): string => {
  for (const unit of CURRICULUM) {
    for (const skill of unit.skills) {
      if (skill.lessons.some((l) => l.id === lessonId)) return ACCENT_HEX[unit.accent];
    }
  }
  return ACCENT_HEX.gold;
};

const LEAGUE = 'Copper';
const LEAGUE_RANK = 4;
const GOAL_TARGET = 3;

const NAV: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; beta?: boolean }> = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'path', label: 'Learning path', icon: MapIcon },
  { id: 'live', label: 'Live tutor', icon: Video },
  { id: 'sandbox', label: 'Sandbox', icon: Boxes, beta: true },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'achievements', label: 'Achievements', icon: Award },
];

const WAYS: Array<{ id: ViewId; title: string; sub: string; icon: React.ComponentType<{ className?: string }>; accent: string; beta?: boolean }> = [
  { id: 'path', title: 'Continue the path', sub: 'Guided lessons', icon: MapIcon, accent: 'bg-ohmlet-gold-soft' },
  { id: 'live', title: 'Live bench session', sub: 'Voice + camera tutor', icon: Radio, accent: 'bg-ohmlet-blue-soft' },
  { id: 'sandbox', title: 'Open the sandbox', sub: '3D breadboard', icon: Boxes, accent: 'bg-[#eef7e0]', beta: true },
  { id: 'community', title: 'See the community', sub: 'Builds + challenges', icon: Users, accent: 'bg-[#fdece8]' },
];

const ACHIEVEMENT_PREVIEW = [
  { name: 'First Spark', desc: 'Completed your first build', icon: Zap, tint: 'bg-ohmlet-gold' },
  { name: 'Consistent Builder', desc: '3-day streak', icon: Flame, tint: 'bg-ohmlet-red' },
];

/**
 * Gentle note shown when the learner returns from the Stripe Customer Portal
 * (return_url carries ?from=portal). If they downgraded to Free we reassure them
 * their work is saved; if still on a paid plan we just confirm. Dismissible, and
 * the query param is stripped so a refresh won't show it again.
 */
const PortalReturnNote: React.FC<{ plan: Plan; onSeePlans?: () => void }> = ({ plan, onSeePlans }) => {
  const [show, setShow] = useState(() => new URLSearchParams(window.location.search).get('from') === 'portal');

  useEffect(() => {
    if (!show) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('from');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [show]);

  if (!show) return null;
  const onFree = plan === 'free';

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="ohmlet-rise flex items-start gap-3 rounded-2xl border-[2.5px] border-ohmlet-ink bg-white p-4 shadow-press">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ohmlet-gold">
          <Sparkles className="h-4 w-4 text-ohmlet-ink" />
        </span>
        <div className="min-w-0 flex-1">
          {onFree ? (
            <>
              <p className="text-sm font-black text-ohmlet-ink">You're back on Free</p>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-ohmlet-ink-soft">
                Your builds, XP and streak are all saved. Pick up right where you left off, or upgrade again anytime.
              </p>
              {onSeePlans && (
                <button
                  type="button"
                  onClick={onSeePlans}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-black text-ohmlet-gold-deep transition-colors hover:text-ohmlet-ink"
                >
                  See plans <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-black text-ohmlet-ink">Billing updated</p>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-ohmlet-ink-soft">
                You're all set on the {PLAN_META[plan].label} plan.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-ohmlet-ink-soft transition-colors hover:bg-ohmlet-cream hover:text-ohmlet-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ onBack, onUpgrade, onAccount }) => {
  const [active, setActive] = useState<ViewId>('today');
  const { userId, isAdmin } = useIdentity();
  const { user } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Learner';
  const { plan, setPlan } = usePlan(userId);

  // Progress persists per-user: instantly to localStorage (refresh-safe) and,
  // when the backend is reachable, to the Firestore state store (cross-device).
  const { state: progress, setState: setProgress } = useOhmletUserState<ProgressState>({
    userId,
    key: 'progress',
    defaults: PROGRESS_DEFAULTS,
  });

  // Per-lesson levels, with one-time migration from the legacy completedLessonIds.
  const lessonLevels = useMemo<Record<string, number>>(() => {
    if (progress.lessonLevels && Object.keys(progress.lessonLevels).length > 0) return progress.lessonLevels;
    if (progress.completedLessonIds?.length) return Object.fromEntries(progress.completedLessonIds.map((id) => [id, 1]));
    return progress.lessonLevels ?? {};
  }, [progress.lessonLevels, progress.completedLessonIds]);

  const completed = useMemo(
    () => new Set(Object.entries(lessonLevels).filter(([, lvl]) => lvl >= 1).map(([id]) => id)),
    [lessonLevels],
  );
  const xp = progress.xp;
  const streak = progress.streak;
  // Units fully completed (every lesson in every skill done) — drives the
  // unit-tier achievements.
  const unitsCompleted = useMemo(
    () => CURRICULUM.filter((u) => u.skills.every((s) => s.lessons.every((l) => completed.has(l.id)))).length,
    [completed],
  );
  const [running, setRunning] = useState<{ id: string; accent: string; level: number } | null>(null);

  const next = nextLesson(completed) ?? allLessons()[0];
  const pathPreview = allLessons().slice(0, 4);
  const goalDone = Math.min(GOAL_TARGET, progress.lastActiveDate === dayStr(0) ? progress.completedToday : 0);
  const goalPct = Math.round((goalDone / GOAL_TARGET) * 100);
  const week = useMemo(() => {
    const lit = Math.min(streak, 7);
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => ({ d, on: i < lit }));
  }, [streak]);

  // Launch at the next level the learner is working toward (Bronze first, then up).
  const launchLesson = useCallback(
    (id: string) => {
      const level = nextAttemptLevel(lessonLevels[id] ?? 0);
      setRunning({ id, accent: lessonAccentHex(id), level });
    },
    [lessonLevels],
  );

  const handleComplete = useCallback(
    (id: string, gained: number, level: number) => {
      void reportXp(gained); // feed the weekly league (best-effort)
      setProgress((prev) => {
        const levels = { ...(prev.lessonLevels ?? {}) };
        const prevLevel = levels[id] ?? 0;
        if (level <= prevLevel) return prev; // replay at or below current level: no new XP/level
        levels[id] = level;
        const firstEver = prevLevel === 0;
        const today = dayStr(0);
        const sameDay = prev.lastActiveDate === today;
        const streak = sameDay ? prev.streak || 1 : prev.lastActiveDate === dayStr(1) ? prev.streak + 1 : 1;
        return {
          ...prev,
          lessonLevels: levels,
          xp: prev.xp + gained,
          streak,
          completedToday: sameDay ? prev.completedToday + (firstEver ? 1 : 0) : 1,
          lastActiveDate: today,
        };
      });
    },
    [setProgress],
  );

  // ── Lesson runner takes over the whole screen ──
  if (running) {
    return (
      <LessonRunner
        key={`${running.id}-${running.level}`}
        lessonId={running.id}
        accent={running.accent}
        level={running.level}
        onExit={() => setRunning(null)}
        onComplete={handleComplete}
      />
    );
  }

  const continueAccent = lessonAccentHex(next.id);

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display text-ohmlet-ink">
      <PortalReturnNote plan={plan} onSeePlans={onUpgrade} />
      <div className="mx-auto flex max-w-[1320px]">
        {/* ── Left rail ── */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ohmlet-line bg-white px-4 py-6 lg:flex">
          <button type="button" onClick={onBack} className="mb-8 flex w-full items-center justify-center px-2">
            <img src="/brand/ohmlet-logo.png" alt="Ohmlet" className="h-11 w-auto" draggable={false} />
          </button>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const on = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-extrabold transition-colors ${
                    on ? 'bg-ohmlet-gold text-ohmlet-ink' : 'text-ohmlet-ink-soft hover:bg-ohmlet-gold-soft hover:text-ohmlet-ink'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                  {item.beta && (
                    <span className="ml-auto rounded-full bg-ohmlet-blue-soft px-1.5 py-0.5 text-[9px] font-black uppercase text-ohmlet-blue-deep">
                      Beta
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-2xl border-2 border-ohmlet-ink bg-white p-3 shadow-press-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold-soft text-sm font-black uppercase">
              {(displayName || 'O').trim().charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-ohmlet-ink">{displayName}</p>
              <p className="text-xs font-bold text-ohmlet-ink-soft">{PLAN_META[plan].label} plan · {LEAGUE} League</p>
            </div>
            {onAccount && (
              <button
                onClick={onAccount}
                className="shrink-0 rounded-lg p-1.5 text-ohmlet-ink-soft transition-colors hover:bg-ohmlet-cream hover:text-ohmlet-ink"
                aria-label="Account and privacy"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Admin-only plan switcher: stands in for billing while we wire Stripe.
              Gated to admins so normal users never see it (and default to Free).
              With real auth (#29) this becomes an admin custom claim. */}
          {isAdmin && (
            <>
              <p className="mt-3 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Admin · view as plan</p>
              <div className="mt-1 flex items-center gap-1 rounded-xl border border-ohmlet-line bg-ohmlet-cream p-1">
                {(['free', 'pro', 'max'] as Plan[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide transition-colors ${
                      plan === p ? 'bg-ohmlet-ink text-white' : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
                    }`}
                  >
                    {PLAN_META[p].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
          {active === 'path' && (
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Learning path</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Build by build.</h1>
              <div className="mt-4">
                <LearnPath completedLessonIds={completed} lessonLevels={lessonLevels} onStartLesson={launchLesson} />
              </div>
            </div>
          )}

          {active === 'live' && <LiveTutorView onUpgrade={onUpgrade} />}
          {active === 'sandbox' && <SandboxView />}
          {active === 'community' && <CommunityView currentUser={displayName} />}
          {active === 'achievements' && (
            <AchievementsView stats={{ xp, streak, builds: completed.size, units: unitsCompleted }} />
          )}
          {active === 'draw' && <SandboxView />}

          {active === 'today' && (
            <>
              {/* Top bar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Today</p>
                  <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Welcome back, faith.</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Stat icon={Flame} value={`${streak}`} label="streak" tint="text-ohmlet-red" />
                  <Stat icon={Zap} value={xp.toLocaleString()} label="XP" tint="text-ohmlet-gold-deep" />
                  <div className="flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-3 py-2 shadow-press-sm">
                    <Ring pct={goalPct} />
                    <div className="leading-tight">
                      <p className="text-sm font-black">{goalDone}/{GOAL_TARGET}</p>
                      <p className="text-[10px] font-bold uppercase text-ohmlet-ink-soft">goal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hero row: continue + live session */}
              <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                <div className="flex flex-col justify-between rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-white p-6 shadow-press">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">Pick up where you left off</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight">{next.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">{next.summary}</p>
                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-ohmlet-line">
                      <div className="h-full rounded-full" style={{ width: `${completed.size ? 45 : 15}%`, background: continueAccent }} />
                    </div>
                  </div>
                  <button
                    onClick={() => launchLesson(next.id)}
                    className="mt-5 inline-flex w-fit items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
                  >
                    <Play className="h-4 w-4" fill="currentColor" />
                    Continue lesson
                  </button>
                </div>

                <div className="relative overflow-hidden rounded-[1.6rem] border-[2.5px] border-ohmlet-gold bg-ohmlet-ink p-6 text-white shadow-[0_0_34px_rgba(250,204,46,0.22)]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-ohmlet-gold/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-ohmlet-gold">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ohmlet-gold" /> Live
                  </span>
                  <h2 className="mt-3 text-2xl font-black tracking-tight">Start a bench session</h2>
                  <p className="mt-1 text-sm font-semibold text-white/65">Point your camera and build with a tutor that sees your bench.</p>
                  <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="ohmlet-float pointer-events-none absolute -bottom-3 right-2 h-28 w-auto opacity-90" draggable={false} />
                  <button
                    onClick={() => setActive('live')}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
                  >
                    <Video className="h-4 w-4" />
                    Go live
                  </button>
                </div>
              </div>

              {/* Ways to learn */}
              <h3 className="mt-9 text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Ways to learn today</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {WAYS.map((w) => {
                  const Icon = w.icon;
                  return (
                    <button key={w.id} onClick={() => setActive(w.id)} className={`${w.accent} group rounded-2xl border-2 border-ohmlet-ink p-4 text-left shadow-press-sm transition-transform hover:-translate-y-1`}>
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-white text-ohmlet-ink">
                          <Icon className="h-5 w-5" />
                        </span>
                        {w.beta && <span className="rounded-full border border-ohmlet-ink/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-ohmlet-ink-soft">Beta</span>}
                      </div>
                      <p className="mt-3 text-sm font-black leading-tight">{w.title}</p>
                      <p className="text-xs font-semibold text-ohmlet-ink-soft">{w.sub}</p>
                    </button>
                  );
                })}
              </div>

              {/* Path preview + right rail */}
              <div className="mt-9 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                <section className="rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-6 shadow-soft">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black tracking-tight">Your path</h3>
                    <button onClick={() => setActive('path')} className="inline-flex items-center gap-1 text-sm font-black text-ohmlet-blue-deep">
                      Full path <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                  <ol className="mt-4 space-y-2">
                    {pathPreview.map((l) => {
                      const lvl = lessonLevels[l.id] ?? 0;
                      const isDone = lvl >= 1;
                      const isNext = l.id === next.id;
                      const medal = lvl >= 1 ? LEVEL_META[Math.min(3, lvl) as 1 | 2 | 3] : null;
                      return (
                        <li key={l.id}>
                          <button
                            onClick={() => launchLesson(l.id)}
                            className="flex w-full items-center gap-3 rounded-xl border border-ohmlet-line p-3 text-left transition-colors hover:border-ohmlet-ink hover:bg-ohmlet-gold-soft/40"
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink text-xs font-black"
                              style={medal ? { background: medal.color, color: '#fff' } : undefined}
                            >
                              {isDone ? '✓' : isNext ? <Play className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 text-ohmlet-ink-soft" fill="currentColor" />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">{l.title}</p>
                              <p className="truncate text-xs font-semibold text-ohmlet-ink-soft">
                                {medal ? `${medal.name} · ${l.estMinutes} min` : `${l.estMinutes} min`}
                              </p>
                            </div>
                            {isDone && lvl < 3 && <span className="ml-auto rounded-full bg-ohmlet-gold-soft px-2 py-0.5 text-[10px] font-black uppercase text-ohmlet-ink-soft">Level up</span>}
                            {isNext && lvl === 0 && <span className="ml-auto rounded-full bg-ohmlet-gold-soft px-2 py-0.5 text-[10px] font-black uppercase text-ohmlet-ink-soft">Next</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                <div className="space-y-5">
                  {/* Streak week */}
                  <section className="rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-ohmlet-red" />
                      <h3 className="text-base font-black tracking-tight">{streak}-day streak</h3>
                    </div>
                    <div className="mt-4 flex justify-between">
                      {week.map((d, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${d.on ? 'bg-ohmlet-red text-white' : 'bg-ohmlet-line text-ohmlet-ink/40'}`}>
                            {d.on ? <Flame className="h-4 w-4" /> : d.d}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* League */}
                  <section className="flex items-center gap-3 rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-ohmlet-gold to-ohmlet-gold-deep text-ohmlet-ink">
                      <Trophy className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-base font-black">{LEAGUE} League</p>
                      <p className="text-xs font-bold text-ohmlet-ink-soft">Rank #{LEAGUE_RANK} this week</p>
                    </div>
                    <button onClick={() => setActive('community')} className="ml-auto inline-flex items-center gap-1 text-sm font-black text-ohmlet-blue-deep">
                      View <ArrowRight className="h-4 w-4" />
                    </button>
                  </section>

                  {/* Achievements */}
                  <section className="rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-ohmlet-gold-deep" />
                        <h3 className="text-base font-black tracking-tight">Recent achievements</h3>
                      </div>
                      <button onClick={() => setActive('achievements')} className="text-sm font-black text-ohmlet-blue-deep">All</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {ACHIEVEMENT_PREVIEW.map((a) => {
                        const Icon = a.icon;
                        return (
                          <div key={a.name} className="flex items-center gap-3 rounded-xl border border-ohmlet-line p-2.5">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ohmlet-ink text-ohmlet-ink ${a.tint}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-black leading-tight">{a.name}</p>
                              <p className="text-xs font-semibold text-ohmlet-ink-soft">{a.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}

          {onBack && (
            <button onClick={onBack} className="mt-10 inline-flex items-center gap-2 text-sm font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
              <ArrowLeft className="h-4 w-4" /> Back to site
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ComponentType<{ className?: string }>; value: string; label: string; tint: string }> = ({ icon: Icon, value, label, tint }) => (
  <div className="flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-3 py-2 shadow-press-sm">
    <Icon className={`h-5 w-5 ${tint}`} />
    <div className="leading-tight">
      <p className="text-sm font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase text-ohmlet-ink-soft">{label}</p>
    </div>
  </div>
);

const Ring: React.FC<{ pct: number }> = ({ pct }) => (
  <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
    <circle cx="18" cy="18" r="15" fill="none" stroke="#ece7db" strokeWidth="4" />
    <circle cx="18" cy="18" r="15" fill="none" stroke="#facc2e" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} />
  </svg>
);
