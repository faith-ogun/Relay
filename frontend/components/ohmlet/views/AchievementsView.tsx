import React, { useMemo, useState } from 'react';
import { Flame, Sparkles, Trophy, Zap } from 'lucide-react';
import { ACHIEVEMENTS, isEarned, metricValue, progressLabel } from '../data/achievements';
import type { Achievement, AchievementStats } from '../types';
import { AchievementCard, CardInspectModal } from '../achievements/HoloCard';

/**
 * AchievementsView — the trophy case. Holographic, tilt-on-hover collectible
 * cards (painted art + foil gloss) that pop out to inspect and flip to reveal the
 * story. "Earned" is computed from real stats, so locked cards show genuine
 * progress (e.g. "12 / 25 builds").
 */

interface AchievementsViewProps {
  stats?: AchievementStats;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({ stats = {} }) => {
  const [inspect, setInspect] = useState<Achievement | null>(null);

  const xp = stats.xp ?? 0;
  const streak = stats.streak ?? 0;

  // Earned-first, then locked sorted by how close they are (most motivating up top).
  const ordered = useMemo(() => {
    return [...ACHIEVEMENTS]
      .map((a) => ({ a, earned: isEarned(a, stats), progress: Math.min(1, metricValue(a, stats) / a.threshold) }))
      .sort((x, y) => (x.earned === y.earned ? y.progress - x.progress : x.earned ? -1 : 1));
  }, [stats]);

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

      {/* Grid */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map(({ a, earned: isE }) => (
          <AchievementCard
            key={a.id}
            a={a}
            earned={isE}
            label={isE ? 'Earned' : progressLabel(a, stats)}
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
