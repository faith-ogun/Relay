import type { Achievement, AchievementRarity } from '../types';

export const RARITY_LABELS: Record<AchievementRarity, { label: string; color: string }> = {
  common: { label: 'Common', color: 'rgba(148,163,184,0.7)' },
  rare: { label: 'Rare', color: 'rgba(96,165,250,0.9)' },
  epic: { label: 'Epic', color: 'rgba(192,132,252,0.9)' },
  legendary: { label: 'Legendary', color: 'rgba(251,191,36,1)' },
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-build', title: 'First Spark', desc: 'Complete your first build', backText: 'Every expert was once a beginner. You placed your first component and started your journey.', rarity: 89, tier: 'common', bg: 'linear-gradient(135deg, #1e3a5f 0%, #0f2027 40%, #203a43 100%)', glowColor: 'rgba(56,189,248,0.4)', earned: true, earnedDate: 'Mar 5', shape: 'bolt' },
  { id: 'streak-3', title: 'Consistent Builder', desc: '3-day build streak', backText: 'Three days in a row. Consistency beats intensity every time.', rarity: 52, tier: 'common', bg: 'linear-gradient(135deg, #3d2b1f 0%, #1a1a2e 40%, #4a3728 100%)', glowColor: 'rgba(245,158,11,0.4)', earned: true, earnedDate: 'Mar 7', shape: 'flame' },
  { id: 'streak-7', title: 'Week Warrior', desc: '7-day build streak', backText: 'A full week of daily building. Your muscle memory is forming.', rarity: 18, tier: 'rare', bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)', glowColor: 'rgba(129,140,248,0.5)', earned: false, shape: 'flame' },
  { id: 'no-errors', title: 'Clean Circuit', desc: 'Zero wiring corrections', backText: 'Not a single wrong wire. Your spatial awareness is exceptional.', rarity: 24, tier: 'rare', bg: 'linear-gradient(135deg, #064e3b 0%, #0f2027 40%, #065f46 100%)', glowColor: 'rgba(52,211,153,0.4)', earned: false, shape: 'diamond' },
  { id: 'speed-run', title: 'Speed Builder', desc: 'Build in under 10 min', backText: 'Lightning hands. You completed a full build before most people finish reading the instructions.', rarity: 11, tier: 'epic', bg: 'linear-gradient(145deg, #4c1d95 0%, #7c3aed 30%, #c026d3 60%, #ec4899 100%)', glowColor: 'rgba(192,132,252,0.5)', earned: false, shape: 'bolt' },
  { id: 'all-lessons', title: 'Scholar', desc: 'Complete all lessons', backText: 'Knowledge is power. You\'ve mastered every concept in the learning path.', rarity: 7, tier: 'legendary', bg: 'linear-gradient(145deg, #78350f 0%, #f59e0b 30%, #fbbf24 50%, #f59e0b 70%, #78350f 100%)', glowColor: 'rgba(251,191,36,0.6)', earned: false, shape: 'crown' },
  { id: 'community-star', title: 'Community Star', desc: '50+ likes on a post', backText: 'Your builds inspire others. The community has spoken.', rarity: 15, tier: 'epic', bg: 'linear-gradient(145deg, #3b0764 0%, #7c3aed 25%, #a78bfa 50%, #c084fc 75%, #3b0764 100%)', glowColor: 'rgba(167,139,250,0.5)', earned: true, earnedDate: 'Mar 6', shape: 'star' },
  { id: 'challenge-win', title: 'Champion', desc: 'Win a challenge', backText: 'Tested under pressure, you rose to the top when it mattered.', rarity: 9, tier: 'legendary', bg: 'linear-gradient(145deg, #451a03 0%, #b45309 25%, #f59e0b 50%, #fbbf24 60%, #b45309 80%, #451a03 100%)', glowColor: 'rgba(251,191,36,0.6)', earned: true, earnedDate: 'Mar 4', shape: 'crown' },
];

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
