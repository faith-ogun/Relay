import React, { useMemo, useState } from 'react';
import { Flame, Sparkles, Trophy, X, Zap } from 'lucide-react';
import { ACHIEVEMENTS, CardShape, RARITY_LABELS, isEarned, metricValue, progressLabel } from '../data/achievements';
import type { Achievement, AchievementStats } from '../types';

/**
 * AchievementsView — the trophy case. Holographic, tilt-on-hover cards that
 * pop out to inspect (flip to reveal the story on the back). "Earned" is computed
 * from real stats, so locked cards show genuine progress (e.g. "12 / 25 builds").
 */

interface AchievementsViewProps {
  stats?: AchievementStats;
}

const tilt = (e: React.MouseEvent<HTMLDivElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', `${px * 100}%`);
  el.style.setProperty('--my', `${py * 100}%`);
  el.style.setProperty('--bg-x', `${px * 100}%`);
  el.style.setProperty('--bg-y', `${py * 100}%`);
  el.style.transform = `perspective(700px) rotateY(${(px - 0.5) * 14}deg) rotateX(${(0.5 - py) * 14}deg)`;
};
const resetTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.transform = '';
};

export const AchievementsView: React.FC<AchievementsViewProps> = ({ stats = {} }) => {
  const [inspect, setInspect] = useState<Achievement | null>(null);
  const [flipped, setFlipped] = useState(false);

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
    setFlipped(false);
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
        {ordered.map(({ a, earned: isE }) => {
          const rarityMeta = RARITY_LABELS[a.tier];
          return (
            <div
              key={a.id}
              onClick={() => openCard(a, isE)}
              onMouseMove={isE ? tilt : undefined}
              onMouseLeave={isE ? resetTilt : undefined}
              className={`ohmlet-holo-card ${isE ? 'earned cursor-pointer' : 'locked'} aspect-[3/4]`}
              style={{ ['--card-bg' as string]: a.bg, ['--holo-glow' as string]: a.glowColor }}
            >
              <div className="relative z-[3] flex h-full flex-col items-center justify-between p-4 text-white">
                <span
                  className="self-start rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                  style={{ background: 'rgba(255,255,255,0.15)', color: rarityMeta.color }}
                >
                  {rarityMeta.label}
                </span>
                <CardShape shape={a.shape} className="h-16 w-16 drop-shadow-lg" />
                <div className="w-full text-center">
                  <p className="text-sm font-black leading-tight">{a.title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white/70">
                    {isE ? 'Earned' : progressLabel(a, stats)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspect modal */}
      {inspect && (
        <div className="ohmlet-card-inspect-overlay" onClick={() => setInspect(null)}>
          <div className="ohmlet-card-inspect-wrapper" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setInspect(null)}
              className="mb-4 ml-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/30 text-white transition-colors hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              className={`ohmlet-card-inspect-flip ${flipped ? 'flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              style={{ width: 280, height: 373, cursor: 'pointer' }}
            >
              {/* Front */}
              <div
                className="ohmlet-card-inspect-face ohmlet-holo-card earned inspecting"
                style={{ ['--card-bg' as string]: inspect.bg, ['--holo-glow' as string]: inspect.glowColor }}
              >
                <div className="relative z-[3] flex h-full flex-col items-center justify-between p-6 text-white">
                  <span className="self-start rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide" style={{ background: 'rgba(255,255,255,0.15)', color: RARITY_LABELS[inspect.tier].color }}>
                    {RARITY_LABELS[inspect.tier].label}
                  </span>
                  <CardShape shape={inspect.shape} className="h-24 w-24 drop-shadow-xl" />
                  <div className="text-center">
                    <p className="text-xl font-black">{inspect.title}</p>
                    <p className="mt-1 text-sm font-semibold text-white/70">{inspect.desc}</p>
                  </div>
                </div>
              </div>
              {/* Back */}
              <div
                className="ohmlet-card-inspect-face ohmlet-card-inspect-back ohmlet-holo-card earned"
                style={{ ['--card-bg' as string]: inspect.bg, ['--holo-glow' as string]: inspect.glowColor }}
              >
                <div className="relative z-[3] flex h-full flex-col items-center justify-center gap-4 p-7 text-center text-white">
                  <CardShape shape={inspect.shape} className="h-12 w-12 opacity-80" />
                  <p className="text-base font-bold leading-relaxed">{inspect.backText}</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs font-bold uppercase tracking-wide text-white/50">Tap the card to flip</p>
          </div>
        </div>
      )}
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
