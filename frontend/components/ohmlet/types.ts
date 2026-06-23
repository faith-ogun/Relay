export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

// The progress signals an achievement can unlock against. "earned" is computed
// (stat >= threshold), never a hardcoded flag, so the trophy case reflects real
// progress. Metrics we do not yet track read as 0 (a genuine future unlock).
export type AchievementMetric =
  | 'builds'        // completed builds/lessons
  | 'streak'        // current day streak
  | 'xp'            // total XP
  | 'units'         // curriculum units fully completed
  | 'liveSessions'  // live tutor sessions run
  | 'drawings'      // drawings graded correct
  | 'perfect'       // builds finished with zero wrong answers
  | 'twins'         // 3D digital twins generated
  | 'likes'         // likes received across posts
  | 'posts'         // community posts created
  | 'comments'      // comments written
  | 'challenges'    // challenges joined
  | 'leagueWins';   // top-3 weekly league finishes

export type AchievementStats = Partial<Record<AchievementMetric, number>>;

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  backText: string;
  rarity: number; // approx % of users who have it (flavour on locked cards)
  tier: AchievementRarity;
  // gradient for the card body — the card IS the art
  bg: string;
  glowColor: string;
  // unlock condition: stats[metric] >= threshold
  metric: AchievementMetric;
  threshold: number;
  // SVG shape type for the centerpiece
  shape: 'bolt' | 'flame' | 'diamond' | 'star' | 'hexagon' | 'crown';
};
