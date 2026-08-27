import React, { useMemo, useState } from 'react';
import { CloudOff, Flame, RotateCw, Sparkles, Trophy, Zap } from 'lucide-react';
import { ACHIEVEMENTS, metricValue, progressLabel } from '../data/achievements';
import type { Achievement, AchievementStats } from '../types';
import { AchievementCard, CardInspectModal } from '../achievements/HoloCard';
import { useEarnedAchievements } from '../../../hooks/useAchievementMetrics';
import { isEarnedWith } from '../../../services/achievementRules';
import type { EarnedEntry } from '../../../services/achievements';

/**
 * AchievementsView — the trophy case. Holographic, tilt-on-hover collectible
 * cards (painted art + foil gloss) that pop out to inspect and flip to reveal the
 * story.
 *
 * Earned-ness comes from the server's durable record, not from today's counters.
 * That distinction is the difference between a trophy case and a dashboard: a
 * medal is a thing that HAPPENED, and no later correction to how a counter is
 * derived may take one back. Locked cards still show live progress ("12 / 25
 * builds") from the best-informed stats available, which is the client's own
 * folded with the server's.
 */

interface AchievementsViewProps {
  stats?: AchievementStats;
}

const EARNED_ON = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "Earned 12 Aug 2026", or plain "Earned" when we only know that it was. */
const earnedLabel = (entry: EarnedEntry | undefined): string => {
  // A backfilled stamp records when we NOTICED, not when it was earned, so
  // printing it as a date would be a precise-looking claim we cannot make.
  if (!entry || entry.backfilled || !entry.at) return 'Earned';
  const when = new Date(entry.at);
  return Number.isNaN(when.getTime()) ? 'Earned' : `Earned ${EARNED_ON.format(when)}`;
};

export const AchievementsView: React.FC<AchievementsViewProps> = ({ stats = {} }) => {
  const [inspect, setInspect] = useState<Achievement | null>(null);
  const { earnedAt, stats: live, error, retry } = useEarnedAchievements(ACHIEVEMENTS, stats);

  const xp = live.xp ?? 0;
  const streak = live.streak ?? 0;

  // Earned-first, then locked sorted by how close they are (most motivating up top).
  const ordered = useMemo(
    () =>
      [...ACHIEVEMENTS]
        .map((a) => ({
          a,
          earned: isEarnedWith(a, live, earnedAt),
          progress: Math.min(1, metricValue(a, live) / a.threshold),
        }))
        .sort((x, y) => (x.earned === y.earned ? y.progress - x.progress : x.earned ? -1 : 1)),
    [live, earnedAt],
  );

  const earned = ordered.filter((o) => o.earned).length;
  const rareEarned = ordered.filter((o) => o.earned && o.a.tier !== 'common').length;

  const openCard = (a: Achievement, isE: boolean) => {
    if (!isE) return;
    setInspect(a);
  };

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Achievements</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Your trophy case.</h1>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat icon={Trophy} tint="text-ohmlet-gold-deep" value={`${earned}/${ACHIEVEMENTS.length}`} label="Unlocked" />
        <SummaryStat icon={Sparkles} tint="text-[#a78bfa]" value={`${rareEarned}`} label="Rare or better" />
        <SummaryStat icon={Zap} tint="text-ohmlet-gold-deep" value={xp.toLocaleString()} label="Total XP" />
        <SummaryStat icon={Flame} tint="text-ohmlet-red" value={`${streak}`} label="Day streak" />
      </div>

      {/* The case still renders from what this device can prove, so this is a
          freshness notice rather than an error screen: what it costs is a medal
          earned on another device, which is worth telling someone about. */}
      {error && (
        <p
          role="status"
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-[3px] border-ohmlet-red pl-3 text-sm font-bold text-ohmlet-ink-soft"
        >
          <CloudOff className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          {error === 'unauthenticated'
            ? 'Sign in again to see medals earned on your other devices.'
            : 'Showing this device. Medals earned elsewhere will appear once we reconnect.'}
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-xs font-black text-ohmlet-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transition-none"
          >
            <RotateCw className="h-3 w-3" strokeWidth={3} />
            Try again
          </button>
        </p>
      )}

      {/* Grid */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map(({ a, earned: isE }) => (
          <AchievementCard
            key={a.id}
            a={a}
            earned={isE}
            label={isE ? earnedLabel(earnedAt[a.id]) : progressLabel(a, live)}
            onClick={() => openCard(a, isE)}
          />
        ))}
      </div>

      {/* Inspect modal */}
      {inspect && <CardInspectModal a={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
};

const SummaryStat: React.FC<{ icon: React.ComponentType<{ className?: string }>; tint: string; value: string; label: string }> = ({
  icon: Icon,
  tint,
  value,
  label,
}) => (
  <div className="rounded-2xl border-2 border-ohmlet-line bg-white p-4 shadow-soft">
    <Icon className={`h-5 w-5 ${tint}`} />
    <p className="mt-2 text-2xl font-black tabular-nums text-ohmlet-ink">{value}</p>
    <p className="text-xs font-bold uppercase tracking-wide text-ohmlet-ink-soft">{label}</p>
  </div>
);
