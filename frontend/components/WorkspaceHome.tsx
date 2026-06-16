import React, { useState } from 'react';
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
  Sparkles,
  Trophy,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { allLessons, nextLesson } from './ohmlet/data/curriculum';
import { LearnPath } from './LearnPath';

/**
 * Workspace Home (concept).
 *
 * A "Today" hub instead of a flat tab bar: one screen that leads with the next
 * action and Ohmlet's live-tutor differentiator, with a left rail to the deeper
 * surfaces. Sample stats for the concept; real wiring comes after sign-off.
 */

interface WorkspaceHomeProps {
  onBack?: () => void;
}

// Concept data (replaced by real persisted state on integration).
const STREAK = 3;
const XP = 1240;
const LEAGUE = 'Copper';
const LEAGUE_RANK = 4;
const GOAL_DONE = 2;
const GOAL_TARGET = 3;
const WEEK = [
  { d: 'M', on: true },
  { d: 'T', on: true },
  { d: 'W', on: true },
  { d: 'T', on: false },
  { d: 'F', on: false },
  { d: 'S', on: false },
  { d: 'S', on: false },
];
const ACHIEVEMENTS = [
  { name: 'First Light', desc: 'Completed your first build', icon: Zap, tint: 'bg-ohmlet-gold' },
  { name: 'On a Roll', desc: '3-day streak', icon: Flame, tint: 'bg-ohmlet-red' },
];

const NAV = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'path', label: 'Learning path', icon: MapIcon },
  { id: 'live', label: 'Live tutor', icon: Video },
  { id: 'sandbox', label: 'Sandbox', icon: Boxes, beta: true },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'achievements', label: 'Achievements', icon: Award },
];

const WAYS = [
  { id: 'path', title: 'Continue the path', sub: 'Guided lessons', icon: MapIcon, accent: 'bg-ohmlet-gold-soft' },
  { id: 'live', title: 'Live bench session', sub: 'Voice + camera tutor', icon: Radio, accent: 'bg-ohmlet-blue-soft' },
  { id: 'sandbox', title: 'Open the sandbox', sub: '3D breadboard', icon: Boxes, accent: 'bg-[#eef7e0]', beta: true },
  { id: 'draw', title: 'Drawing practice', sub: 'Sketch a circuit', icon: PenTool, accent: 'bg-[#fdece8]', beta: true },
];

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ onBack }) => {
  const [active, setActive] = useState('today');
  const next = nextLesson(new Set()) ?? allLessons()[0];
  const pathPreview = allLessons().slice(0, 4);
  const goalPct = Math.round((GOAL_DONE / GOAL_TARGET) * 100);

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display text-ohmlet-ink">
      <div className="mx-auto flex max-w-[1280px]">
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
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold-soft text-sm font-black">F</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ohmlet-ink">faith</p>
              <p className="text-xs font-bold text-ohmlet-ink-soft">{LEAGUE} League</p>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
          {active === 'path' ? (
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Learning path</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Build by build.</h1>
              <div className="mt-4">
                <LearnPath completedLessonIds={new Set()} onStartLesson={() => {}} />
              </div>
            </div>
          ) : (
          <>
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Today</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Welcome back, faith.</h1>
            </div>
            <div className="flex items-center gap-2">
              <Stat icon={Flame} value={`${STREAK}`} label="streak" tint="text-ohmlet-red" />
              <Stat icon={Zap} value={XP.toLocaleString()} label="XP" tint="text-ohmlet-gold-deep" />
              <div className="flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-3 py-2 shadow-press-sm">
                <Ring pct={goalPct} />
                <div className="leading-tight">
                  <p className="text-sm font-black">{GOAL_DONE}/{GOAL_TARGET}</p>
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
                  <div className="h-full rounded-full bg-ohmlet-gold" style={{ width: '35%' }} />
                </div>
              </div>
              <button className="mt-5 inline-flex w-fit items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none">
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
              <button className="mt-5 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none">
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
                {pathPreview.map((l, i) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-xl border border-ohmlet-line p-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink text-xs font-black ${i === 0 ? 'bg-ohmlet-gold' : 'bg-white text-ohmlet-ink-soft'}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{l.title}</p>
                      <p className="truncate text-xs font-semibold text-ohmlet-ink-soft">{l.estMinutes} min</p>
                    </div>
                    {i === 0 && <span className="ml-auto rounded-full bg-ohmlet-gold-soft px-2 py-0.5 text-[10px] font-black uppercase text-ohmlet-ink-soft">Next</span>}
                  </li>
                ))}
              </ol>
            </section>

            <div className="space-y-5">
              {/* Streak week */}
              <section className="rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-ohmlet-red" />
                  <h3 className="text-base font-black tracking-tight">{STREAK}-day streak</h3>
                </div>
                <div className="mt-4 flex justify-between">
                  {WEEK.map((d, i) => (
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
                <button className="ml-auto inline-flex items-center gap-1 text-sm font-black text-ohmlet-blue-deep">
                  View <ArrowRight className="h-4 w-4" />
                </button>
              </section>

              {/* Achievements */}
              <section className="rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-ohmlet-gold-deep" />
                  <h3 className="text-base font-black tracking-tight">Recent achievements</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {ACHIEVEMENTS.map((a) => {
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
