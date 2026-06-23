import type { QuizQuestion } from '../../services/quizEngineClient';

export type Stage = 'inventory' | 'wiring' | 'code' | 'run' | 'report';
export type AppTab = 'build' | 'learn' | 'community' | 'library' | 'sandbox';
export type ConnectionState = 'checking' | 'online' | 'offline';

export type SessionCreateResponse = {
  session_id: string;
  user_id: string;
  stage: Stage;
  created_at: string;
};

export type MessageResponse = {
  session_id: string;
  stage: Stage;
  decision_source: 'live';
  reply: string;
  created_at: string;
};

export type OhmletLabProps = {
  onBackToLanding: () => void;
};

export type Turn = {
  role: 'you' | 'ohmlet' | 'system';
  text: string;
  timestamp: string;
};

export type TwinPreferences = {
  twin3d: boolean;
  shareToCommunity: boolean;
};

export type TourStep = {
  target: string; // data-tour attribute value
  tab?: AppTab;   // switch to this tab (undefined = stay on current / sidebar)
  title: string;
  body: string;
  position: 'bottom' | 'top' | 'left' | 'right';
};

export type SkillNode = {
  id: string;
  label: string;
  mastery: number;
  x: number;
  y: number;
  color: string;
};

export type CommunityPost = {
  id: string;
  author: string;
  title: string;
  body: string;
  likes: number;
  comments: number;
  liked: boolean;
  badge?: string;
  timeAgo: string;
  avatar: string;
  replyPreview?: { author: string; text: string; avatar: string };
  buildName?: string;
};

export type AdaptiveQueueItem = QuizQuestion & { id: string };

export type AdaptiveHistoryEntry = {
  id: string;
  question: string;
  topic: string;
  type: string;
  correct: boolean;
  answerGiven: string;
  explanation: string;
  answeredAt: string;
};

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

export type XpEvent = {
  id: string;
  type: 'lesson_completed' | 'quiz_correct' | 'quiz_incorrect' | 'session_started' | 'build_shared';
  xp: number;
  timestamp: string;
  detail?: string;
};

export type OhmletPersistedState = {
  posts: CommunityPost[];
  commentReplies: Record<string, Array<{ author: string; text: string; avatar: string; timeAgo: string }>>;
  lessonProgress: Record<string, number>;
  adaptiveHistory: AdaptiveHistoryEntry[];
  joinedChallenges: Record<string, boolean>;
  skillNodes: SkillNode[];
  weekProgress: boolean[];
  xpEvents: XpEvent[];
  lastActiveDate: string; // ISO date string (YYYY-MM-DD) for streak tracking
};
