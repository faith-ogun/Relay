import type { Achievement, AchievementMetric, AchievementStats, AchievementRarity } from '../types';

export const RARITY_LABELS: Record<AchievementRarity, { label: string; color: string }> = {
  common: { label: 'Common', color: 'rgba(148,163,184,0.7)' },
  rare: { label: 'Rare', color: 'rgba(96,165,250,0.9)' },
  epic: { label: 'Epic', color: 'rgba(192,132,252,0.9)' },
  legendary: { label: 'Legendary', color: 'rgba(251,191,36,1)' },
};

// Card-art gradients + matching glows. The card IS the art (anti-slop): families
// share a palette so the trophy case reads as a coherent set, not random boxes.
const G: Record<string, string> = {
  blue: 'linear-gradient(135deg, #1e3a5f 0%, #0f2027 40%, #203a43 100%)',
  amber: 'linear-gradient(135deg, #3d2b1f 0%, #1a1a2e 40%, #4a3728 100%)',
  indigo: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)',
  green: 'linear-gradient(135deg, #064e3b 0%, #0f2027 40%, #065f46 100%)',
  teal: 'linear-gradient(135deg, #042f2e 0%, #0f2027 40%, #134e4a 100%)',
  rose: 'linear-gradient(135deg, #4c0519 0%, #1a1a2e 45%, #831843 100%)',
  violet: 'linear-gradient(145deg, #4c1d95 0%, #7c3aed 30%, #c026d3 60%, #ec4899 100%)',
  purple: 'linear-gradient(145deg, #3b0764 0%, #7c3aed 25%, #a78bfa 50%, #c084fc 75%, #3b0764 100%)',
  gold: 'linear-gradient(145deg, #78350f 0%, #f59e0b 30%, #fbbf24 50%, #f59e0b 70%, #78350f 100%)',
  crown: 'linear-gradient(145deg, #451a03 0%, #b45309 25%, #f59e0b 50%, #fbbf24 60%, #b45309 80%, #451a03 100%)',
};
const GLOW: Record<string, string> = {
  blue: 'rgba(56,189,248,0.4)', amber: 'rgba(245,158,11,0.4)', indigo: 'rgba(129,140,248,0.5)',
  green: 'rgba(52,211,153,0.4)', teal: 'rgba(45,212,191,0.45)', rose: 'rgba(244,114,182,0.45)',
  violet: 'rgba(192,132,252,0.5)', purple: 'rgba(167,139,250,0.5)', gold: 'rgba(251,191,36,0.6)', crown: 'rgba(251,191,36,0.6)',
};

type Shape = Achievement['shape'];
const mk = (
  id: string, title: string, desc: string, backText: string, rarity: number,
  tier: AchievementRarity, shape: Shape, theme: keyof typeof G, metric: AchievementMetric, threshold: number,
): Achievement => ({ id, title, desc, backText, rarity, tier, bg: G[theme], glowColor: GLOW[theme], metric, threshold, shape });

export const ACHIEVEMENTS: Achievement[] = [
  // ── Builds (the core loop) ──
  mk('build-1', 'First Spark', 'Complete your first build', 'Every expert was once a beginner. You placed your first component and started your journey.', 89, 'common', 'bolt', 'blue', 'builds', 1),
  mk('build-5', 'Getting the Hang', 'Complete 5 builds', 'Five builds in. The breadboard is starting to feel like home.', 62, 'common', 'hexagon', 'blue', 'builds', 5),
  mk('build-10', 'Bench Regular', 'Complete 10 builds', 'Ten builds down. You show up, you build, you learn.', 40, 'rare', 'hexagon', 'indigo', 'builds', 10),
  mk('build-25', 'Prolific Builder', 'Complete 25 builds', 'Twenty-five circuits brought to life. That is real momentum.', 22, 'rare', 'hexagon', 'indigo', 'builds', 25),
  mk('build-50', 'Master Maker', 'Complete 50 builds', 'Fifty builds. You have wired more circuits than most hobbyists do in a year.', 10, 'epic', 'hexagon', 'violet', 'builds', 50),
  mk('build-100', 'Centurion', 'Complete 100 builds', 'One hundred builds. The soldering iron fears you now.', 4, 'legendary', 'hexagon', 'gold', 'builds', 100),
  mk('build-250', 'Workshop Legend', 'Complete 250 builds', 'Two hundred and fifty builds. You are the person friends call when their project won\'t work.', 1, 'legendary', 'crown', 'crown', 'builds', 250),
  mk('build-500', 'Hall of Famer', 'Complete 500 builds', 'Five hundred builds. This is a body of work.', 1, 'legendary', 'crown', 'crown', 'builds', 500),

  // ── Streaks (loss aversion) ──
  mk('streak-3', 'Consistent Builder', '3-day build streak', 'Three days in a row. Consistency beats intensity every time.', 52, 'common', 'flame', 'amber', 'streak', 3),
  mk('streak-7', 'Week Warrior', '7-day build streak', 'A full week of daily building. Your muscle memory is forming.', 28, 'rare', 'flame', 'amber', 'streak', 7),
  mk('streak-14', 'Fortnight Fire', '14-day build streak', 'Two weeks unbroken. This is officially a habit.', 16, 'rare', 'flame', 'rose', 'streak', 14),
  mk('streak-30', 'Monthly Maker', '30-day build streak', 'A month straight. Most people quit by day three. Not you.', 8, 'epic', 'flame', 'rose', 'streak', 30),
  mk('streak-60', 'Unstoppable', '60-day build streak', 'Sixty days. The streak owns part of your daily routine now.', 4, 'epic', 'flame', 'violet', 'streak', 60),
  mk('streak-100', 'Century Streak', '100-day build streak', 'One hundred days without missing. Extraordinary discipline.', 2, 'legendary', 'flame', 'gold', 'streak', 100),
  mk('streak-365', 'Year of Volts', '365-day build streak', 'A full year, every single day. You are in rare company.', 1, 'legendary', 'flame', 'crown', 'streak', 365),

  // ── XP (progression) ──
  mk('xp-500', 'Warmed Up', 'Earn 500 XP', 'Five hundred XP. The fundamentals are settling in.', 70, 'common', 'bolt', 'green', 'xp', 500),
  mk('xp-1k', 'Charged Up', 'Earn 1,000 XP', 'A thousand XP. You are building real understanding, point by point.', 48, 'common', 'bolt', 'green', 'xp', 1000),
  mk('xp-2_5k', 'High Voltage', 'Earn 2,500 XP', 'Twenty-five hundred XP. The concepts are clicking.', 26, 'rare', 'bolt', 'teal', 'xp', 2500),
  mk('xp-5k', 'Power User', 'Earn 5,000 XP', 'Five thousand XP. You are well past dabbling.', 14, 'rare', 'bolt', 'teal', 'xp', 5000),
  mk('xp-10k', 'Ohm Hero', 'Earn 10,000 XP', 'Ten thousand XP. Serious dedication, measured in volts and patience.', 6, 'epic', 'bolt', 'violet', 'xp', 10000),
  mk('xp-25k', 'Resistance is Futile', 'Earn 25,000 XP', 'Twenty-five thousand XP. Few learners ever reach this.', 2, 'legendary', 'bolt', 'gold', 'xp', 25000),
  mk('xp-50k', 'Grid Master', 'Earn 50,000 XP', 'Fifty thousand XP. You have built an education one point at a time.', 1, 'legendary', 'bolt', 'crown', 'xp', 50000),

  // ── Units (curriculum depth) ──
  mk('unit-1', 'Unit Cleared', 'Finish a full unit', 'A whole unit, start to finish. You see how the pieces connect.', 58, 'common', 'diamond', 'blue', 'units', 1),
  mk('unit-3', 'Quarter Master', 'Finish 3 units', 'Three units complete. The curriculum is opening up.', 24, 'rare', 'diamond', 'indigo', 'units', 3),
  mk('unit-6', 'Halfway Home', 'Finish 6 units', 'Six units down, the second half awaits. Momentum is on your side.', 11, 'epic', 'diamond', 'violet', 'units', 6),
  mk('unit-12', 'Scholar', 'Finish all 12 units', 'Every concept in the path, mastered. You have done the whole journey.', 5, 'legendary', 'crown', 'gold', 'units', 12),

  // ── Precision ──
  mk('perfect-1', 'Clean Circuit', 'Finish a build with zero wiring corrections', 'Not a single wrong wire. Your spatial awareness is exceptional.', 24, 'rare', 'diamond', 'teal', 'perfect', 1),
  mk('perfect-5', 'Steady Hands', '5 flawless builds', 'Five builds, no corrections. Precision is becoming second nature.', 9, 'epic', 'diamond', 'violet', 'perfect', 5),
  mk('perfect-25', 'Flawless', '25 flawless builds', 'Twenty-five perfect builds. You measure twice and wire once.', 2, 'legendary', 'diamond', 'gold', 'perfect', 25),

  // ── Drawing assessment ──
  mk('draw-1', 'First Sketch', 'Get a drawing graded correct', 'Your first schematic checked out. Drawing is thinking on paper.', 46, 'common', 'diamond', 'blue', 'drawings', 1),
  mk('draw-10', 'Draughtsman', '10 correct drawings', 'Ten clean schematics. You can show your thinking, not just build it.', 18, 'rare', 'diamond', 'indigo', 'drawings', 10),
  mk('draw-50', 'Schematic Savant', '50 correct drawings', 'Fifty schematics graded correct. You read and draw circuits fluently.', 6, 'epic', 'diamond', 'violet', 'drawings', 50),

  // ── Live tutor ──
  mk('live-1', 'Tutor, Engaged', 'Run your first live tutor session', 'You went hands-on with the live tutor watching your bench. This is the magic.', 44, 'common', 'bolt', 'blue', 'liveSessions', 1),
  mk('live-10', 'Bench Buddy', '10 live sessions', 'Ten sessions with the tutor. It is starting to feel like a real lab partner.', 17, 'rare', 'bolt', 'indigo', 'liveSessions', 10),
  mk('live-50', 'Live Wire', '50 live sessions', 'Fifty live sessions. The bench tutor knows your style by now.', 5, 'epic', 'bolt', 'violet', 'liveSessions', 50),

  // ── 3D twins ──
  mk('twin-1', 'Digital Twin', 'Generate your first 3D twin', 'Your build, immortalised in 3D. A trophy you can spin.', 20, 'rare', 'star', 'teal', 'twins', 1),
  mk('twin-5', 'Twin Collector', 'Generate 5 twins', 'Five 3D twins in your gallery. A growing portfolio of real work.', 7, 'epic', 'star', 'purple', 'twins', 5),
  mk('twin-25', 'Mirror Maker', 'Generate 25 twins', 'Twenty-five digital twins. A museum of everything you have built.', 2, 'legendary', 'star', 'gold', 'twins', 25),

  // ── Community: likes received ──
  mk('likes-10', 'Crowd Pleaser', 'Earn 10 likes', 'Ten likes across your posts. People are watching what you build.', 38, 'common', 'star', 'rose', 'likes', 10),
  mk('likes-50', 'Community Star', 'Earn 50 likes', 'Your builds inspire others. The community has spoken.', 15, 'epic', 'star', 'purple', 'likes', 50),
  mk('likes-250', 'Local Hero', 'Earn 250 likes', 'Two hundred and fifty likes. You are a name people recognise.', 3, 'legendary', 'star', 'gold', 'likes', 250),

  // ── Community: posts ──
  mk('post-1', 'Show & Tell', 'Share your first build', 'You put your work out there. That takes courage and it builds community.', 50, 'common', 'star', 'blue', 'posts', 1),
  mk('post-10', 'Storyteller', 'Share 10 builds', 'Ten builds shared. Your feed is a journal of real progress.', 20, 'rare', 'star', 'indigo', 'posts', 10),
  mk('post-50', 'Prolific Poster', 'Share 50 builds', 'Fifty posts. You give the community something to learn from.', 6, 'epic', 'star', 'violet', 'posts', 50),

  // ── Community: comments ──
  mk('comment-5', 'Helping Hand', 'Write 5 comments', 'Five helpful replies. Builders helping builders, exactly the point.', 42, 'common', 'star', 'green', 'comments', 5),
  mk('comment-50', 'Mentor', 'Write 50 comments', 'Fifty comments of guidance. You lift the people coming up behind you.', 8, 'epic', 'star', 'purple', 'comments', 50),

  // ── Challenges + league ──
  mk('chal-1', 'Challenger', 'Join a challenge', 'You signed up for the arena. Shared goals make the work stick.', 40, 'common', 'crown', 'amber', 'challenges', 1),
  mk('chal-5', 'Challenge Seeker', 'Join 5 challenges', 'Five challenges in. You thrive on a target and a deadline.', 15, 'rare', 'crown', 'indigo', 'challenges', 5),
  mk('league-1', 'Podium Finish', 'Finish top 3 in a weekly league', 'Tested against the field, you placed on the podium when it counted.', 18, 'rare', 'crown', 'purple', 'leagueWins', 1),
  mk('league-5', 'League Champion', 'Reach the podium 5 times', 'Five podium weeks. Consistency at the top is the hardest kind.', 3, 'legendary', 'crown', 'crown', 'leagueWins', 5),
];

// ── Earn logic (computed from real stats, never a hardcoded flag) ──
export const isEarned = (a: Achievement, stats: AchievementStats): boolean => (stats[a.metric] ?? 0) >= a.threshold;
export const metricValue = (a: Achievement, stats: AchievementStats): number => stats[a.metric] ?? 0;

export const METRIC_NOUN: Record<AchievementMetric, string> = {
  builds: 'builds', streak: 'day streak', xp: 'XP', units: 'units', liveSessions: 'sessions',
  drawings: 'drawings', perfect: 'flawless builds', twins: '3D twins', likes: 'likes',
  posts: 'posts', comments: 'comments', challenges: 'challenges', leagueWins: 'podiums',
};

/** Progress text for a locked card, e.g. "12 / 25 builds". */
export const progressLabel = (a: Achievement, stats: AchievementStats): string =>
  `${Math.min(metricValue(a, stats), a.threshold).toLocaleString()} / ${a.threshold.toLocaleString()} ${METRIC_NOUN[a.metric]}`;

// SVG centerpiece shapes for cards — each is a distinct geometric form
export function CardShape({ shape, className }: { shape: Achievement['shape']; className?: string }) {
  const cls = className || 'h-16 w-16';
  switch (shape) {
    case 'bolt':
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none">
          <path d="M36 4L12 36h16L24 60l28-32H36L44 4H36z" fill="url(#boltGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <defs><linearGradient id="boltGrad" x1="12" y1="4" x2="40" y2="60"><stop offset="0%" stopColor="rgba(255,255,255,0.9)" /><stop offset="100%" stopColor="rgba(255,255,255,0.3)" /></linearGradient></defs>
        </svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none">
          <path d="M32 4C32 4 18 20 18 36c0 7.7 6.3 14 14 14s14-6.3 14-14C46 20 32 4 32 4z" fill="url(#flameGrad)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <path d="M32 28c0 0-6 8-6 14 0 3.3 2.7 6 6 6s6-2.7 6-6c0-6-6-14-6-14z" fill="rgba(255,255,255,0.25)" />
          <defs><linearGradient id="flameGrad" x1="18" y1="4" x2="46" y2="50"><stop offset="0%" stopColor="rgba(255,255,255,0.85)" /><stop offset="100%" stopColor="rgba(255,200,100,0.4)" /></linearGradient></defs>
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none">
          <path d="M32 4L4 32l28 28 28-28L32 4z" fill="url(#diaGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <path d="M32 12L12 32l20 20 20-20L32 12z" fill="rgba(255,255,255,0.08)" />
          <defs><linearGradient id="diaGrad" x1="4" y1="4" x2="60" y2="60"><stop offset="0%" stopColor="rgba(255,255,255,0.8)" /><stop offset="100%" stopColor="rgba(255,255,255,0.2)" /></linearGradient></defs>
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none">
          <path d="M32 4l7.6 18.4L60 24l-14.8 12.4L49.2 58 32 47.6 14.8 58l4-21.6L4 24l20.4-1.6L32 4z" fill="url(#starGrad)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <defs><linearGradient id="starGrad" x1="4" y1="4" x2="60" y2="58"><stop offset="0%" stopColor="rgba(255,255,255,0.9)" /><stop offset="50%" stopColor="rgba(255,255,255,0.5)" /><stop offset="100%" stopColor="rgba(255,255,255,0.2)" /></linearGradient></defs>
        </svg>
      );
    case 'hexagon':
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none">
          <path d="M32 4L56 18v28L32 60 8 46V18L32 4z" fill="url(#hexGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <defs><linearGradient id="hexGrad" x1="8" y1="4" x2="56" y2="60"><stop offset="0%" stopColor="rgba(255,255,255,0.85)" /><stop offset="100%" stopColor="rgba(255,255,255,0.25)" /></linearGradient></defs>
        </svg>
      );
    case 'crown':
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none">
          <path d="M8 48V20l12 12 12-16 12 16 12-12v28H8z" fill="url(#crownGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <circle cx="8" cy="18" r="3" fill="rgba(255,255,255,0.6)" />
          <circle cx="56" cy="18" r="3" fill="rgba(255,255,255,0.6)" />
          <circle cx="32" cy="14" r="3" fill="rgba(255,255,255,0.8)" />
          <defs><linearGradient id="crownGrad" x1="8" y1="14" x2="56" y2="48"><stop offset="0%" stopColor="rgba(255,255,255,0.9)" /><stop offset="100%" stopColor="rgba(255,200,50,0.4)" /></linearGradient></defs>
        </svg>
      );
  }
}
