import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import type { Achievement, AchievementMetric } from '../types';
import { AchievementCard, CardInspectModal } from '../achievements/HoloCard';

/**
 * AchievementsPreview — an admin-only gallery of every achievement card, all
 * shown as EARNED so the painted art + foil gloss can be reviewed before any of
 * it is gated behind real unlock conditions. Grouped by family, click any card to
 * pop it out and flip it. Mirror of the /author preview, for the trophy art.
 */

const SECTION_LABEL: Partial<Record<AchievementMetric, string>> = {
  builds: 'Builds',
  streak: 'Streaks',
  xp: 'XP',
  units: 'Units',
  perfect: 'Precision',
  drawings: 'Drawing Assessment',
  liveSessions: 'Live Tutor Sessions',
  twins: '3D Digital Twins',
  likes: 'Community · Likes',
  posts: 'Community · Posts',
  comments: 'Community · Comments',
  challenges: 'Challenges',
  leagueWins: 'League',
};

interface PreviewProps {
  onBack: () => void;
}

export const AchievementsPreview: React.FC<PreviewProps> = ({ onBack }) => {
  const [inspect, setInspect] = useState<Achievement | null>(null);

  // Preserve data order within each family; list families in first-seen order.
  const groups = useMemo(() => {
    const order: AchievementMetric[] = [];
    const by: Partial<Record<AchievementMetric, Achievement[]>> = {};
    for (const a of ACHIEVEMENTS) {
      if (!by[a.metric]) {
        by[a.metric] = [];
        order.push(a.metric);
      }
      by[a.metric]!.push(a);
    }
    return order.map((m) => ({ metric: m, label: SECTION_LABEL[m] ?? m, items: by[m]! }));
  }, []);

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border-2 border-ohmlet-ink bg-white px-3.5 py-1.5 text-sm font-extrabold text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
        </button>

        <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Preview · Admin</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Achievement card gallery</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-ohmlet-ink-soft">
          Every card, shown unlocked, so you can review the art and the foil gloss before it ships. Move your mouse over a
          card for the sheen; click to pop it out and flip for the story. {ACHIEVEMENTS.length} cards.
        </p>

        {groups.map((g) => (
          <section key={g.metric} className="mt-10">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-black tracking-[-0.01em] text-ohmlet-ink">{g.label}</h2>
              <span className="text-xs font-bold text-ohmlet-ink-soft">{g.items.length}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {g.items.map((a) => (
                <AchievementCard key={a.id} a={a} earned label="Earned" onClick={() => setInspect(a)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {inspect && <CardInspectModal a={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
};
