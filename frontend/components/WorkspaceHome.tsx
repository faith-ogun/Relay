import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Boxes,
  Briefcase,
  CircuitBoard,
  Flame,
  Home,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Play,
  Radio,
  RotateCw,
  Settings,
  Sparkles,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import {
  allLessons, getCurriculumSnapshot, nextLesson, subscribeCurriculum,
  type CurriculumAccent, type CurriculumUnit,
} from './ohmlet/data/curriculum';
import { refreshCurriculum, type SyncState } from '../services/curriculum';
import { LearnPath } from './LearnPath';
import { LessonRunner } from './ohmlet/views/LessonRunner';
import { LiveTutorView } from './ohmlet/views/LiveTutorView';
import { InterviewView } from './ohmlet/views/InterviewView';
import { SandboxView } from './ohmlet/views/SandboxView';
import { SimulatorView } from './ohmlet/views/SimulatorView';
import { CommunityView } from './ohmlet/views/CommunityView';
import {
  reportXp, fetchLeaderboard, fetchCommunityStats,
  type CommunityStats, type Leaderboard,
} from '../services/community';
import { track } from '../services/analytics';
import { AchievementsView } from './ohmlet/views/AchievementsView';
import { ACHIEVEMENTS } from './ohmlet/data/achievements';
import { readCachedEarned } from '../services/achievements';
import {
  authoredLessonsCompleted,
  authoredUnitsCompleted,
  isEarnedWith,
  authoredLessonAlreadyCleared,
  corpusLessonIds,
} from '../services/achievementRules';
import { usePlan } from '../hooks/usePlan';
import { useIdentity } from '../hooks/useIdentity';
import { useAvatar } from '../hooks/useAvatar';
import { OhmletAvatar } from './ohmlet/avatar/OhmletAvatar';
import { useAuth } from '../hooks/useAuth';
import { readAgeProfile } from './ohmlet/childmode/useAgeProfile';
import { CHILD_MODE_ENABLED } from './ohmlet/childmode/ageModel';
import { useOhmletUserState } from '../hooks/useOhmletUserState';
import { useAchievementMetrics } from '../hooks/useAchievementMetrics';
import { PLAN_META, type Plan } from './ohmlet/entitlements';
import { LEVEL_META, nextAttemptLevel } from './ohmlet/data/levels';
import { applyCompletion, isoDay } from '../services/completion';
import {
  claimCheckpoints, fetchCheckpoints, foldCheckpointXp, foldClaim,
  type CheckpointGrant, type CheckpointStatus, type FailReason,
} from '../services/checkpoints';

interface ProgressState {
  /** Per-lesson level: 1 Bronze, 2 Silver, 3 Gold. Present at >=1 means completed. */
  lessonLevels: Record<string, number>;
  xp: number;
  streak: number;
  /** Distinct lessons completed today. Derived from todayLessonIds. */
  completedToday: number;
  /**
   * Which lessons have counted toward today's goal, cleared when the day turns.
   *
   * The goal used to be a tally on both surfaces, and the two counted it
   * differently against ONE record: the phone added one per attempt, so five
   * replays of one easy lesson filled a five-lesson goal, while the browser
   * added one only on a first-ever completion. Distinct lesson ids is what the
   * goal was always claiming to measure, and both surfaces now write them.
   *
   * Optional because records written before this field existed do not carry it.
   * A learner who completed lessons earlier TODAY under an older build has a
   * count with no ids behind it, so their first completion after the upgrade
   * restarts the day's list at one. It costs one day's goal ring, once.
   */
  todayLessonIds?: string[];
  lastActiveDate: string;
  /** Legacy field (pre-leveling); migrated into lessonLevels on load. */
  completedLessonIds?: string[];
  /**
   * How much of `xp` came from claimed checkpoints. The ledger that makes the
   * payout exactly-once: the server records the grant, this records how much of
   * it has been counted here, and reconciliation is the difference between the
   * two. Without it, a learner who claimed on their phone and then opened the
   * web would be paid twice by their own counter.
   */
  checkpointXp?: number;
  [k: string]: unknown; // satisfies useOhmletUserState's Record<string, unknown> constraint
}

const PROGRESS_DEFAULTS: ProgressState = {
  lessonLevels: {},
  xp: 0,
  streak: 0,
  completedToday: 0,
  todayLessonIds: [],
  lastActiveDate: '',
  checkpointXp: 0,
};

/**
 * Per-lesson levels, with the legacy pre-levelling record folded in.
 *
 * Records written before levels existed stored completed ids in a flat array.
 * Reading only `lessonLevels` treats those lessons as never completed, which
 * shows a finished path as empty and pays a lesson's XP a second time when it
 * is replayed, so every reader goes through here.
 */
const migratedLevels = (
  p: Pick<ProgressState, 'lessonLevels' | 'completedLessonIds'>,
): Record<string, number> => {
  const held = p.lessonLevels ?? {};
  if (Object.keys(held).length > 0) return held;
  if (p.completedLessonIds?.length) return Object.fromEntries(p.completedLessonIds.map((id) => [id, 1]));
  return held;
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

type ViewId = 'today' | 'path' | 'live' | 'simulator' | 'sandbox' | 'community' | 'achievements' | 'draw' | 'interview';

const ACCENT_HEX: Record<CurriculumAccent, string> = {
  gold: '#facc2e',
  blue: '#549cf0',
  green: '#84cc30',
  red: '#ff6f5e',
};

/** Accent hex for the unit that owns a lesson (defaults to gold). Takes the
 *  corpus explicitly: which units exist depends on what the backend is serving. */
const lessonAccentHex = (units: CurriculumUnit[], lessonId: string): string => {
  for (const unit of units) {
    for (const skill of unit.skills) {
      if (skill.lessons.some((l) => l.id === lessonId)) return ACCENT_HEX[unit.accent];
    }
  }
  return ACCENT_HEX.gold;
};

const GOAL_TARGET = 3;

const NAV: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; beta?: boolean }> = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'path', label: 'Learning path', icon: MapIcon },
  { id: 'live', label: 'Live tutor', icon: Video },
  { id: 'interview', label: 'Interview mode', icon: Briefcase },
  { id: 'simulator', label: 'Simulator', icon: CircuitBoard },
  { id: 'sandbox', label: 'Sandbox', icon: Boxes, beta: true },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'achievements', label: 'Achievements', icon: Award },
];

/**
 * Visual weight of a way-in tile. `gold` is the guided route, `ink` the live
 * differentiator (it echoes the hero pair above it), `quiet` the open-ended
 * surfaces, which separate from each other by icon tint rather than by card.
 */
type WayTone = 'gold' | 'ink' | 'quiet';

interface Way {
  id: ViewId;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: WayTone;
  /** Icon-chip classes: the colour rhythm across the row. */
  chip: string;
  beta?: boolean;
}

const WAYS: Way[] = [
  { id: 'path', title: 'Continue the path', sub: 'Guided lessons', icon: MapIcon, tone: 'gold', chip: 'border-2 border-ohmlet-ink bg-white text-ohmlet-ink' },
  { id: 'live', title: 'Go live', sub: 'Voice + camera', icon: Radio, tone: 'ink', chip: 'bg-ohmlet-gold text-ohmlet-ink' },
  { id: 'simulator', title: 'Open simulator', sub: 'See current flow', icon: CircuitBoard, tone: 'quiet', chip: 'border-2 border-ohmlet-ink bg-ohmlet-blue-soft text-ohmlet-blue-deep' },
  { id: 'sandbox', title: 'Open sandbox', sub: '3D breadboard', icon: Boxes, tone: 'quiet', chip: 'border-2 border-ohmlet-ink bg-[#eef7e0] text-ohmlet-green-deep', beta: true },
  { id: 'community', title: 'See community', sub: 'Builds + challenges', icon: Users, tone: 'quiet', chip: 'border-2 border-ohmlet-ink bg-[#fdece8] text-ohmlet-red' },
];

/**
 * Surface + resting/hover depth per tone. Three depths, so no two adjacent
 * tiles carry the same shadow: 5px press for the two lead tiles, a soft ambient
 * shadow for the quiet ones, each lifting one level on hover.
 */
const WAY_SURFACE: Record<WayTone, string> = {
  gold: 'border-[2.5px] border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press hover:shadow-[0_8px_0_#14181f]',
  ink: 'border-[2.5px] border-ohmlet-ink bg-ohmlet-ink text-white shadow-press hover:shadow-[0_8px_0_#14181f]',
  quiet: 'border-2 border-ohmlet-line bg-white text-ohmlet-ink shadow-soft hover:border-ohmlet-ink hover:shadow-press-sm',
};

const WAY_SUB: Record<WayTone, string> = {
  gold: 'text-ohmlet-ink/70',
  ink: 'text-white/70',
  quiet: 'text-ohmlet-ink-soft',
};


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

// ── Checkpoints ───────────────────────────────────────────────────────────────
//
// A checkpoint is the reward for clearing a whole skill, and until now it was
// only ever drawn: the chest, the XP figure and the ceremony all rendered, and
// no client called POST /v1/me/checkpoints/claim, so nothing was ever granted.
//
// Everything below takes its numbers from the server. `xp` on the button is the
// server's own figure from GET /v1/me/checkpoints, the ceremony shows only what
// a claim actually granted, and a claim that fails shows the failure rather than
// a celebration.

/** How long the ceremony's XP figure takes to count up, in milliseconds. */
const XP_COUNT_MS = 900;

const CHEST_CLOSED = '/path/checkpoint-chest.png';
const CHEST_OPEN = '/path/checkpoint-chest-open.png';

const FAIL_COPY: Record<FailReason, string> = {
  offline: "Can't reach your checkpoints. Check your connection.",
  timeout: 'That took too long. Your checkpoints are safe, try again.',
  unauthenticated: 'Sign in again to collect your checkpoints.',
  rate_limited: 'Slow down a moment, then collect them.',
  server: "Something went wrong on our side. Your checkpoints are safe, try again.",
};

type CheckpointsView =
  | { phase: 'loading' }
  | { phase: 'ready'; status: CheckpointStatus }
  | { phase: 'error'; reason: FailReason };

/**
 * The strip above the path: what is waiting to be collected, or what has been.
 *
 * The two states are deliberately different objects rather than one card with a
 * changed colour. Something claimable is a full gold panel with a button; a
 * history of cleared checkpoints is a single quiet line, because it is a fact
 * rather than an action.
 */
const CheckpointBand: React.FC<{
  view: CheckpointsView;
  claiming: boolean;
  claimError: FailReason | null;
  onClaim: () => void;
  onRetry: () => void;
}> = ({ view, claiming, claimError, onClaim, onRetry }) => {
  if (view.phase === 'loading') {
    return (
      <div className="flex h-6 items-center gap-2" aria-hidden>
        <span className="h-5 w-5 rounded-md bg-ohmlet-line" />
        <span className="ohmlet-shimmer h-3 w-52 rounded-full bg-ohmlet-line" />
      </div>
    );
  }

  if (view.phase === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" role="status">
        <span className="text-sm font-bold text-ohmlet-ink-soft">{FAIL_COPY[view.reason]}</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-xs font-black text-ohmlet-ink transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <RotateCw className="h-3 w-3" strokeWidth={3} />
          Try again
        </button>
      </div>
    );
  }

  const { available, claimed } = view.status;
  const clearedCount = Object.keys(claimed).length;

  if (available.length > 0) {
    const total = available.reduce((sum, c) => sum + c.xp, 0);
    return (
      <div className="ohmlet-rise flex flex-wrap items-center gap-x-5 gap-y-4 rounded-3xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-5 py-4 shadow-press">
        <img
          src={CHEST_CLOSED}
          alt=""
          className="ohmlet-float h-16 w-16 shrink-0 object-contain drop-shadow-[0_6px_10px_rgba(20,24,31,0.25)]"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-ohmlet-gold-text">
            {available.length === 1 ? 'Checkpoint reached' : 'Checkpoints reached'}
          </p>
          <h2 className="mt-0.5 text-2xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">
            {available.length === 1
              ? available[0].title
              : `${available.length} skills cleared`}
          </h2>
          {available.length > 1 && (
            <p className="mt-1 truncate text-xs font-bold text-ohmlet-ink/70">
              {available.map((c) => c.title).join(' · ')}
            </p>
          )}
          {claimError && (
            <p className="mt-1.5 text-xs font-black text-ohmlet-ink" role="alert">
              {FAIL_COPY[claimError]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="shrink-0 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-ink px-6 py-3 text-base font-black text-ohmlet-gold shadow-[0_5px_0_#8f6d00] transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_2px_0_#8f6d00] disabled:cursor-wait disabled:opacity-70"
        >
          {claiming ? 'Collecting…' : `Collect ${total} XP`}
        </button>
      </div>
    );
  }

  if (clearedCount > 0) {
    return (
      <p className="flex items-center gap-2 text-xs font-bold text-ohmlet-ink-soft">
        <img src={CHEST_OPEN} alt="" className="h-6 w-6 object-contain" draggable={false} />
        {clearedCount} checkpoint{clearedCount === 1 ? '' : 's'} cleared
        <span className="text-ohmlet-ink-mute">·</span>
        <span className="font-black text-ohmlet-gold-text">{view.status.totalClaimedXp} XP collected</span>
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-xs font-bold text-ohmlet-ink-soft">
      <img src={CHEST_CLOSED} alt="" className="h-6 w-6 object-contain opacity-40" draggable={false} />
      Finish every lesson in a skill to open its checkpoint.
    </p>
  );
};

/**
 * The payout, shown only for XP the server actually granted.
 *
 * Mounted from the claim response, never from local state, which is what keeps
 * the promise in point 6 of the brief: on a second device the checkpoints come
 * back as already claimed, the grant is empty, and this never mounts.
 */
const CheckpointCeremony: React.FC<{ grant: CheckpointGrant; onClose: () => void }> = ({ grant, onClose }) => {
  const [shown, setShown] = useState(0);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Counts to the real figure. Reduced motion lands on it immediately rather
  // than animating, which is the point of the setting.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(grant.xp); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / XP_COUNT_MS);
      // Ease out, so it decelerates onto the number instead of stopping dead.
      setShown(Math.round(grant.xp * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [grant.xp]);

  return (
    <div
      className="ohmlet-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ohmlet-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkpoint-ceremony-title"
      onClick={onClose}
    >
      <div
        className="ohmlet-scale-in relative w-full max-w-sm overflow-hidden rounded-[28px] border-[3px] border-ohmlet-ink bg-white p-7 text-center shadow-press"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The glow behind the chest, not a border on it. */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/3 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(250,204,46,0.55) 0%, rgba(250,204,46,0) 70%)' }}
          aria-hidden
        />
        <img
          src={CHEST_OPEN}
          alt=""
          className="ohmlet-float relative mx-auto h-28 w-28 object-contain drop-shadow-[0_10px_16px_rgba(20,24,31,0.22)]"
          draggable={false}
        />
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.24em] text-ohmlet-gold-text">
          {grant.granted.length === 1 ? 'Checkpoint cleared' : `${grant.granted.length} checkpoints cleared`}
        </p>
        <h2 id="checkpoint-ceremony-title" className="mt-1 text-4xl font-black tracking-[-0.03em] text-ohmlet-ink">
          <span aria-live="polite">+{shown}</span> XP
        </h2>

        <ul className="ohmlet-stagger mt-5 flex flex-col gap-1.5">
          {grant.granted.map((c) => (
            <li
              key={c.skillId}
              className="ohmlet-rise flex items-center justify-between gap-3 rounded-xl bg-ohmlet-gold-soft px-3 py-2 text-left"
            >
              <span className="truncate text-sm font-black text-ohmlet-ink">{c.title}</span>
              <span className="shrink-0 text-sm font-black text-ohmlet-gold-text">+{c.xp}</span>
            </li>
          ))}
        </ul>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold py-3 text-base font-black text-ohmlet-ink shadow-press-sm transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none"
        >
          Keep going
        </button>
      </div>
    </div>
  );
};

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({ onBack, onUpgrade, onAccount }) => {
  const [active, setActive] = useState<ViewId>('today');
  // Collapsible left rail — gives space-hungry views (Sandbox/Simulator) room.
  // Persisted so it stays the way the learner left it.
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ohmlet.navCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleNav = useCallback(() => {
    setNavCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('ohmlet.navCollapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const { userId, isAdmin } = useIdentity();
  const { user } = useAuth();

  // ── The curriculum on screen ──
  //
  // The path is the first thing a learner sees, so it must never wait on the
  // network. The corpus starts as the copy bundled with this build (or a newer
  // one this browser already cached) and is REPLACED IN PLACE the moment the
  // backend answers with something different, which is what keeps this surface
  // and the phone showing the same path off the same progress record.
  //
  // `corpus` appears in the dependency list of several memos below that never
  // mention it in their bodies. That is deliberate, not an oversight:
  // allLessons(), nextLesson() and lessonRigor() read the installed corpus out
  // of module state, so this snapshot is what tells React they can change.
  // Dropping it from those lists leaves the path frozen on the bundled copy.
  const corpus = useSyncExternalStore(subscribeCurriculum, getCurriculumSnapshot, getCurriculumSnapshot);
  // Every session id the app is rendering, which is what tells a part two from
  // a lesson whose title merely ends in a numeral.
  const corpusIds = useMemo(() => corpusLessonIds(corpus.units), [corpus]);
  const [sync, setSync] = useState<SyncState>({ phase: 'checking', serverVersion: null });
  const [syncAttempt, setSyncAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setSync((prev) => (prev.phase === 'checking' ? prev : { ...prev, phase: 'checking' }));
    void refreshCurriculum().then((state) => {
      if (alive) setSync(state);
    });
    return () => {
      alive = false;
    };
  }, [syncAttempt]);
  const retrySync = useCallback(() => setSyncAttempt((n) => n + 1), []);
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Learner';
  // Child-safe (#94): a verified minor gets no community/social surfaces (no feed,
  // no posting, and they never appear on the public leaderboard).
  const childSafe = useMemo(() => CHILD_MODE_ENABLED && !!readAgeProfile(userId)?.isMinor, [userId]);
  const { plan, setPlan } = usePlan(userId);
  const { config: avatar } = useAvatar(userId);

  // Progress persists per-user: instantly to localStorage (refresh-safe) and,
  // when the backend is reachable, to the Firestore state store (cross-device).
  const { state: progress, setState: setProgress, ready: progressReady } = useOhmletUserState<ProgressState>({
    userId,
    key: 'progress',
    defaults: PROGRESS_DEFAULTS,
  });

  const lessonLevels = useMemo<Record<string, number>>(
    () => migratedLevels(progress),
    [progress.lessonLevels, progress.completedLessonIds],
  );

  const completed = useMemo(
    () => new Set(Object.entries(lessonLevels).filter(([, lvl]) => lvl >= 1).map(([id]) => id)),
    [lessonLevels],
  );
  const xp = progress.xp;
  const streak = progress.streak;
  // Units and lessons completed, counted in AUTHORED lessons rather than in the
  // sessions they were packaged into. Both drive achievement families, and both
  // used to move when the packaging did: cutting the 142 authored lessons into
  // 284 sessions left a learner who had finished everything with every part one
  // done and every part two untouched, which took up to four unit medals off
  // people who had earned them. See services/achievementRules.ts.
  const unitsCompleted = useMemo(
    () => authoredUnitsCompleted(corpus.units, completed),
    [corpus, completed],
  );
  const buildsCompleted = useMemo(
    () => authoredLessonsCompleted(corpus.units, completed),
    [corpus, completed],
  );
  const [running, setRunning] = useState<{
    id: string; accent: string; level: number; heldLevel: number;
  } | null>(null);

  const next = useMemo(() => nextLesson(completed) ?? allLessons()[0], [corpus, completed]);
  // Real weekly standing (never a hardcoded rank). Null until it loads, and it
  // stays null if the service is unreachable, so the card simply does not show
  // rather than inventing a position.
  // Counters for the achievements that xp/streak/builds/units do not cover.
  const { metrics, creditLeagueWin } = useAchievementMetrics(userId);
  const [league, setLeague] = useState<Leaderboard | null>(null);
  useEffect(() => {
    if (childSafe) return; // minors never appear on the public leaderboard
    let alive = true;
    fetchLeaderboard()
      .then((lb) => {
        if (!alive || !lb) return;
        setLeague(lb);
        creditLeagueWin(lb.week, lb.me.rank);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [childSafe, creditLeagueWin]);

  // Likes received and the authoritative post/comment counts. Fetched once per
  // session and only when the Achievements view is opened, since it is the only
  // surface that reads them. A failure leaves the local tallies in place.
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  useEffect(() => {
    if (childSafe || active !== 'achievements' || communityStats) return;
    let alive = true;
    fetchCommunityStats()
      .then((cs) => {
        if (alive && cs) setCommunityStats(cs);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [childSafe, active, communityStats]);

  // Real progress through the curriculum, not a decorative fraction.
  const pathProgressPct = useMemo(() => {
    const path = allLessons();
    // Only lessons ON the path count toward it. A learner may hold progress
    // recorded against a corpus this client is not rendering (finished on a
    // phone running a newer curriculum), and counting those against this path's
    // length reported more than 100% complete.
    const done = path.reduce((n, lesson) => n + (completed.has(lesson.id) ? 1 : 0), 0);
    return path.length ? Math.round((done / path.length) * 100) : 0;
  }, [corpus, completed]);
  // The two most recent achievements the learner has ACTUALLY earned. Empty for a
  // new account, which is the honest state; never a sample of what they might get.
  //
  // Reads this device's mirror of the server's earned record first, so a medal
  // stays on the shelf even if the counter behind it is later derived
  // differently. The live comparison is the fallback for a threshold crossed
  // since the last sync.
  const earnedRecord = useMemo(() => readCachedEarned(userId), [userId]);
  const earnedPreview = useMemo(
    () =>
      ACHIEVEMENTS.filter((a) =>
        isEarnedWith(a, { xp, streak, builds: buildsCompleted, units: unitsCompleted }, earnedRecord),
      ).slice(0, 2),
    [xp, streak, buildsCompleted, unitsCompleted, earnedRecord],
  );
  const pathPreview = useMemo(() => allLessons().slice(0, 4), [corpus]);
  // The ways-in shelf. Five tiles normally, four for a child-safe account (no
  // community). Widths are picked so a row never ends in a half-width stub:
  // five lay out 1 / 2 / 3 / 3 / 5 across (xs / sm / md / lg / xl), four lay
  // out 1 / 2 / 2 / 2 / 4. Each basis sits a hair under the exact fraction so
  // sub-pixel rounding cannot wrap a tile early, and `grow` hands that slack
  // straight back, so a row that does not divide evenly (five at two or three
  // across) still fills edge to edge. The all-in-one-row layout waits for xl:
  // below 1280px the 256px rail leaves a fifth of the measure too narrow for a
  // chip and a title side by side, and the title collided with the Beta pill.
  // The single column is reserved for phones under 390px, where two-up would
  // cramp the title.
  const ways = useMemo(() => WAYS.filter((w) => !childSafe || w.id !== 'community'), [childSafe]);
  const wayBasis =
    ways.length === 5
      ? 'basis-[calc(50%-0.5rem)] max-[389px]:basis-full md:basis-[calc(33.333%-0.6rem)] xl:basis-[calc(20%-0.75rem)]'
      : 'basis-[calc(50%-0.5rem)] max-[389px]:basis-full xl:basis-[calc(25%-0.7rem)]';
  // Today's goal, from the same UTC day the completion rule stamps the record
  // with. The local-time helper this used to call disagreed with it across a
  // clock change, which showed a goal as unstarted on a day it had been met.
  const goalDone = Math.min(
    GOAL_TARGET,
    progress.lastActiveDate === isoDay(new Date()) ? progress.completedToday : 0,
  );
  const goalPct = Math.round((goalDone / GOAL_TARGET) * 100);
  const week = useMemo(() => {
    const lit = Math.min(streak, 7);
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => ({ d, on: i < lit }));
  }, [streak]);

  // Launch at the next level the learner is working toward (Bronze first, then up).
  const launchLesson = useCallback(
    (id: string) => {
      const level = nextAttemptLevel(lessonLevels[id] ?? 0);
      track('lesson_start', { lesson_id: id, level });
      setRunning({
        id,
        accent: lessonAccentHex(corpus.units, id),
        level,
        // Read BEFORE the run so a replay cannot be mistaken for a first
        // completion. It gates the once-per-lesson achievement counters, and it
        // is what tells the completion card whether this run pays any XP.
        heldLevel: lessonLevels[id] ?? 0,
      });
    },
    [corpus, lessonLevels],
  );

  // What a finished lesson does to the record is defined in ONE place, shared
  // with the phone app: services/completion.ts. This handler used to hold a
  // second, quieter definition that bailed out entirely on a replay at or below
  // the level already held, so a learner who had finished everything could not
  // keep a streak alive in the browser at all while their phone advanced it.
  const handleComplete = useCallback(
    (id: string, gained: number, level: number) => {
      const before = { ...progress, lessonLevels: migratedLevels(progress) };
      const after = applyCompletion(before, id, gained, level);
      const awarded = after.xp - before.xp;
      // The weekly league gets the XP that was actually awarded. A replay at or
      // below the level held awards none, and reporting it anyway put XP on the
      // leaderboard nobody earned. Best effort, and never for minors.
      if (!childSafe && awarded > 0) void reportXp(awarded);
      track('lesson_complete', { lesson_id: id, level, xp: gained, awarded });
      // First completion of a new calendar day extends/refreshes the streak.
      if (before.lastActiveDate !== isoDay(new Date())) {
        track('streak_extended', { day: after.streak });
      }
      // The updater form, not `after`, so a checkpoint fold landing in the same
      // tick is not thrown away.
      setProgress((prev) =>
        applyCompletion({ ...prev, lessonLevels: migratedLevels(prev) }, id, gained, level),
      );
    },
    [progress, setProgress, childSafe],
  );

  // ── Checkpoints ──
  //
  // The XP a learner sees has ONE source: the server's record of what it has
  // granted. Nothing here adds XP optimistically, because the server adds it
  // too, and a learner who taps twice or claims on a second device would then
  // be paid once by the server and twice by their own counter.

  const [checkpoints, setCheckpoints] = useState<CheckpointsView>({ phase: 'loading' });
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<FailReason | null>(null);
  const [ceremony, setCeremony] = useState<CheckpointGrant | null>(null);
  // Bumped when the learner opens the path, so a checkpoint claimed on their
  // phone shows as already collected here rather than as still waiting.
  const [checkpointTick, setCheckpointTick] = useState(0);
  const onPath = active === 'path';
  useEffect(() => {
    if (onPath) setCheckpointTick((n) => n + 1);
  }, [onPath]);

  // Re-read on a finished lesson too: the lesson that completes a skill is
  // exactly the moment a checkpoint becomes claimable.
  const completedCount = completed.size;
  useEffect(() => {
    let alive = true;
    void fetchCheckpoints().then((res) => {
      if (!alive) return;
      setCheckpoints(res.ok ? { phase: 'ready', status: res.data } : { phase: 'error', reason: res.reason });
    });
    return () => { alive = false; };
  }, [userId, completedCount, checkpointTick]);

  // Reconcile the ledger against the server's total. Idempotent by
  // construction: it adds the DIFFERENCE, so running it on every status read,
  // on two devices, or after a crash between the claim and the save all land on
  // the same number. Gated on hydration, because folding into the defaults
  // before the stored envelope arrives would be immediately overwritten.
  useEffect(() => {
    if (!progressReady || checkpoints.phase !== 'ready') return;
    const total = checkpoints.status.totalClaimedXp;
    setProgress((prev) => {
      const patch = foldCheckpointXp(prev, total);
      return patch ? { ...prev, ...patch } : prev;
    });
  }, [progressReady, checkpoints, setProgress]);

  const collectCheckpoints = useCallback(async () => {
    // Read synchronously, BEFORE the await. The fold below has to name an
    // absolute total rather than a delta, and this is that total's anchor: what
    // the server had already paid at the moment this button was pressed. Taken
    // afterwards it could include this very grant, folded by the refresh effect
    // while the POST was in flight, and the learner would be paid twice.
    const totalBefore = checkpoints.phase === 'ready' ? checkpoints.status.totalClaimedXp : null;
    setClaiming(true);
    setClaimError(null);
    const res = await claimCheckpoints();
    setClaiming(false);
    if (!res.ok) {
      // No ceremony for a claim that did not happen. The panel stays, with the
      // reason on it, so the learner can try again.
      setClaimError(res.reason);
      return;
    }

    // Fold what this call granted, without waiting on another round trip. Naming
    // the total makes this safe to run more than once for one grant: a second
    // fold finds the ledger already there and does nothing. With no anchor to
    // name it from, skip it — the refresh below is absolute and pays it instead.
    if (res.data.xp > 0 && totalBefore !== null) {
      setProgress((prev) => {
        const patch = foldClaim(prev, totalBefore, res.data.xp);
        return patch ? { ...prev, ...patch } : prev;
      });
    }

    if (res.data.granted.length > 0) {
      track('checkpoint_claimed', { count: res.data.granted.length, xp: res.data.xp });
      setCeremony(res.data);
    }

    // Refresh the lists so the panel reflects what is left. A failure here is
    // harmless: the grant is already recorded on both sides, and the reconcile
    // effect above pays any remainder off the next status read.
    const after = await fetchCheckpoints();
    if (after.ok) setCheckpoints({ phase: 'ready', status: after.data });
  }, [setProgress, checkpoints]);

  const retryCheckpoints = useCallback(() => {
    setCheckpoints({ phase: 'loading' });
    setCheckpointTick((n) => n + 1);
  }, []);

  // ── Lesson runner takes over the whole screen ──
  if (running) {
    return (
      <LessonRunner
        key={`${running.id}-${running.level}`}
        lessonId={running.id}
        accent={running.accent}
        level={running.level}
        // `level` is frozen at launch (it decides which steps the round is made
        // of, so raising it mid-run would rebuild the round under the learner).
        // The level HELD is not: it is only ever read, and reading a stale copy
        // is how the two things it gates go wrong. On a device with no local
        // cache the record arrives over the network, and a learner who taps
        // Continue before it lands launches against empty defaults. Frozen at
        // that moment, a replay of a lesson they hold at Gold would credit the
        // once-per-lesson `perfect` and `drawings` counters again, and the
        // completion card would promise XP the shared rule then declines to pay.
        // Levels never fall, so taking the higher of the two can only ever
        // correct that, never invent a completion.
        heldLevel={Math.max(running.heldLevel, lessonLevels[running.id] ?? 0)}
        authoredCleared={authoredLessonAlreadyCleared(running.id, lessonLevels, corpusIds)}
        onExit={() => setRunning(null)}
        onComplete={handleComplete}
        onUpgrade={onUpgrade}
      />
    );
  }

  const continueAccent = lessonAccentHex(corpus.units, next.id);

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display text-ohmlet-ink">
      <PortalReturnNote plan={plan} onSeePlans={onUpgrade} />
      {ceremony && <CheckpointCeremony grant={ceremony} onClose={() => setCeremony(null)} />}
      {/* Full-bleed, so the rail sits flush against the viewport edge. Capping
          and centring the whole shell left a band of empty cream to the LEFT of
          the sidebar on any wide screen, which reads as a rendering fault rather
          than a margin. The reading width is capped on the content instead, where
          it belongs. */}
      <div className="flex">
        {/* ── Left rail ── */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ohmlet-line bg-white py-6 transition-[width] duration-200 lg:flex ${
            navCollapsed ? 'w-[76px] px-2' : 'w-64 px-4'
          }`}
        >
          {/* Logo + collapse toggle */}
          <div className={`mb-6 flex items-center ${navCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
            {!navCollapsed && (
              <button type="button" onClick={onBack} className="flex items-center px-1" aria-label="Ohmlet home">
                <img src="/brand/ohmlet-logo.png" alt="Ohmlet" className="h-9 w-auto" draggable={false} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleNav}
              aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!navCollapsed}
              className="rounded-lg p-2 text-ohmlet-ink-soft transition-colors hover:bg-ohmlet-gold-soft hover:text-ohmlet-ink"
            >
              {navCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.filter((item) => !childSafe || item.id !== 'community').map((item) => {
              const Icon = item.icon;
              const on = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  title={navCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`flex items-center rounded-xl py-2.5 text-[15px] font-extrabold transition-colors ${
                    navCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${on ? 'bg-ohmlet-gold text-ohmlet-ink' : 'text-ohmlet-ink-soft hover:bg-ohmlet-gold-soft hover:text-ohmlet-ink'}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!navCollapsed && item.label}
                  {!navCollapsed && item.beta && (
                    <span className="ml-auto rounded-full bg-ohmlet-blue-soft px-1.5 py-0.5 text-[9px] font-black uppercase text-ohmlet-blue-deep">
                      Beta
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {navCollapsed ? (
            <button
              type="button"
              onClick={onAccount}
              title={`${displayName} · ${PLAN_META[plan].label} plan`}
              aria-label="Account and privacy"
              className="mt-auto self-center rounded-full transition-transform hover:-translate-y-0.5"
            >
              <OhmletAvatar config={avatar} size={40} ring />
            </button>
          ) : (
            <>
              <div className="mt-auto flex items-center gap-3 rounded-2xl border-2 border-ohmlet-ink bg-white p-3 shadow-press-sm">
                <OhmletAvatar config={avatar} size={40} ring />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ohmlet-ink">{displayName}</p>
                  <p className="text-xs font-bold text-ohmlet-ink-soft">{PLAN_META[plan].label} plan</p>
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
            </>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
          {/* The measure lives here: long-form content stays readable on a wide
              display without the chrome drifting away from the edge. */}
          <div className="mx-auto w-full max-w-[1180px]">
          {active === 'path' && (
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Learning path</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Build by build.</h1>
              <div className="mt-5">
                <CheckpointBand
                  view={checkpoints}
                  claiming={claiming}
                  claimError={claimError}
                  onClaim={collectCheckpoints}
                  onRetry={retryCheckpoints}
                />
              </div>
              {sync.phase === 'stale' && (
                <p className="ohmlet-rise mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-[3px] border-ohmlet-red pl-3 text-sm font-bold text-ohmlet-ink-soft" role="status">
                  Newer lessons are ready. This is the copy saved on this device.
                  <button
                    type="button"
                    onClick={retrySync}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-xs font-black text-ohmlet-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transition-none"
                  >
                    <RotateCw className="h-3 w-3" strokeWidth={3} />
                    Get them
                  </button>
                </p>
              )}
              <div className="mt-4">
                <LearnPath completedLessonIds={completed} lessonLevels={lessonLevels} onStartLesson={launchLesson} />
              </div>
            </div>
          )}

          {active === 'live' && <LiveTutorView onUpgrade={onUpgrade} />}
          {active === 'interview' && <InterviewView onUpgrade={onUpgrade} onOpenLessons={() => setActive('path')} />}
          {active === 'simulator' && <SimulatorView />}
          {active === 'sandbox' && <SandboxView />}
          {active === 'community' && !childSafe && <CommunityView currentUser={displayName} />}
          {active === 'achievements' && (
            <AchievementsView
              stats={{
                xp,
                streak,
                builds: buildsCompleted,
                units: unitsCompleted,
                liveSessions: metrics.liveSessions,
                drawings: metrics.drawings,
                perfect: metrics.perfect,
                twins: metrics.twins,
                challenges: metrics.challenges,
                leagueWins: metrics.leagueWins,
                // Likes RECEIVED only exist on other people's screens, so they
                // come from the server. Posts and comments take the server's
                // count when it is higher: it survives a cleared cache and a
                // second device, where the local tally does not.
                likes: communityStats?.likesReceived ?? 0,
                posts: Math.max(metrics.posts, communityStats?.posts ?? 0),
                comments: Math.max(metrics.comments, communityStats?.comments ?? 0),
              }}
            />
          )}
          {active === 'draw' && <SandboxView />}

          {active === 'today' && (
            <>
              {/* Top bar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Today</p>
                  <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Welcome back, {displayName}.</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Stat icon={Flame} art="/stats/streak.png" value={`${streak}`} label="streak" tint="text-ohmlet-red" />
                  <Stat icon={Zap} art="/stats/xp.png" value={xp.toLocaleString()} label="XP" tint="text-ohmlet-gold-deep" />
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
              <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                <div className="flex flex-col justify-between rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-white p-6 shadow-press">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">Pick up where you left off</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight">{next.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">{next.summary}</p>
                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-ohmlet-line">
                      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pathProgressPct}%`, background: continueAccent }} />
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

              {/* Ways to learn: at most two rows, and one row from xl up, so the path,
                  the streak and the achievements below it stay inside the first screen. */}
              <div className="mt-7 flex items-center gap-3">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Ways to learn today</h3>
                <span aria-hidden className="h-px flex-1 bg-ohmlet-line" />
              </div>
              <ul className="ohmlet-stagger mt-3 flex flex-wrap gap-3">
                {ways.map((w) => {
                  const Icon = w.icon;
                  return (
                    <li key={w.id} className={`ohmlet-rise flex min-w-0 grow ${wayBasis}`}>
                      <button
                        type="button"
                        onClick={() => setActive(w.id)}
                        className={`group relative flex w-full flex-col rounded-2xl px-3.5 py-3 text-left transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-[3px] active:translate-y-[2px] active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 ${WAY_SURFACE[w.tone]}`}
                      >
                        {w.tone === 'ink' && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-[0.85rem] bg-[radial-gradient(120%_120%_at_100%_0%,rgba(250,204,46,0.24),transparent_62%)]"
                          />
                        )}
                        <span className="relative flex items-start gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 ${w.chip}`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="mt-0.5 min-w-0 text-[13px] font-black leading-[1.15] tracking-tight">{w.title}</span>
                        </span>
                        <span className="relative mt-1.5 flex items-center gap-1.5 pr-7">
                          <span className={`min-w-0 text-[11px] font-bold leading-snug ${WAY_SUB[w.tone]}`}>{w.sub}</span>
                          {w.beta && (
                            <span
                              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                                w.tone === 'ink' ? 'border-white/30 text-white/70' : 'border-ohmlet-ink/25 text-ohmlet-ink-soft'
                              }`}
                            >
                              Beta
                            </span>
                          )}
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="absolute bottom-3 right-3 h-3.5 w-3.5 translate-x-1 opacity-0 transition-[transform,opacity] duration-200 group-hover:translate-x-0 group-hover:opacity-70 motion-reduce:transition-none"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Path preview + right rail */}
              <div className="mt-7 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
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

                  {/* League (hidden for minors: it is public + competitive) */}
                  {!childSafe && league && (
                  <section className="flex items-center gap-3 rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-ohmlet-gold to-ohmlet-gold-deep text-ohmlet-ink">
                      <Trophy className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-base font-black">
                        {league.me.rank ? `Rank #${league.me.rank} this week` : 'This week'}
                      </p>
                      <p className="text-xs font-bold text-ohmlet-ink-soft">
                        {league.me.xp > 0
                          ? `${league.me.xp} XP earned`
                          : 'Earn XP to join this week’s board'}
                      </p>
                    </div>
                    <button onClick={() => setActive('community')} className="ml-auto inline-flex items-center gap-1 text-sm font-black text-ohmlet-blue-deep">
                      View <ArrowRight className="h-4 w-4" />
                    </button>
                  </section>
                  )}

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
                      {earnedPreview.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-ohmlet-line p-3 text-xs font-semibold text-ohmlet-ink-soft">
                          Finish a lesson or a build to unlock your first one.
                        </p>
                      ) : (
                        earnedPreview.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-ohmlet-line p-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink">
                              <Award className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-black leading-tight">{a.title}</p>
                              <p className="text-xs font-semibold text-ohmlet-ink-soft">{a.desc}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}

          {active !== 'today' ? (
            // From any sub-tab (Community, Path, etc.) the natural "up" is the
            // workspace home, not a hard exit to the marketing site.
            <button onClick={() => setActive('today')} className="mt-10 inline-flex items-center gap-2 text-sm font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
              <ArrowLeft className="h-4 w-4" /> Back to Today
            </button>
          ) : (
            onBack && (
              <button onClick={onBack} className="mt-10 inline-flex items-center gap-2 text-sm font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
                <ArrowLeft className="h-4 w-4" /> Back to site
              </button>
            )
          )}
          </div>
        </main>
      </div>
    </div>
  );
};

/**
 * A stat pill.
 *
 * `art` is the painted icon in /public/stats, the same set the phone draws.
 * These were lucide glyphs, which are excellent and completely generic: a flame
 * is a flame in every app that ships one. The painted set carries the
 * electronics idea into each stat (a resistor across the XP coin, a resistor for
 * the flame's mouth, an LED lighting the heart), which is what makes it Ohmlet's
 * rather than an icon pack's. Falls back to the lucide glyph if the image cannot
 * be fetched, so a stat is never a blank square.
 */
const Stat: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  art?: string; value: string; label: string; tint: string;
}> = ({ icon: Icon, art, value, label, tint }) => (
  <div className="flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-3 py-2 shadow-press-sm">
    {art
      ? <img src={art} alt="" aria-hidden className="h-6 w-6 shrink-0 object-contain" />
      : <Icon className={`h-5 w-5 ${tint}`} />}
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
