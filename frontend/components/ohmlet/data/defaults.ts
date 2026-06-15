import type React from 'react';
import { Compass, Layers3, Cpu, BrainCircuit, Users, CheckCircle2, Zap, GraduationCap, Flame } from 'lucide-react';
import type { AppTab, OhmletPersistedState } from '../types';

export const APP_TABS: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'build', label: 'Build', icon: Compass },
  { id: 'library', label: 'Library', icon: Layers3 },
  { id: 'sandbox', label: 'Sandbox', icon: Cpu },
  { id: 'learn', label: 'Learn', icon: BrainCircuit },
  { id: 'community', label: 'Community', icon: Users },
];

export const XP_ACTIONS: Array<{
  action: string;
  xp: number;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { action: 'Complete a build session', xp: 50, icon: CheckCircle2 },
  { action: 'Finish all wiring steps', xp: 30, icon: Zap },
  { action: 'Upload working sketch', xp: 25, icon: Cpu },
  { action: 'Complete a lesson', xp: 20, icon: GraduationCap },
  { action: 'Daily streak bonus', xp: 15, icon: Flame },
  { action: 'Share build to community', xp: 10, icon: Users },
];

export const DEFAULT_COMMENT_REPLIES: OhmletPersistedState['commentReplies'] = {
  p1: [{ author: 'breadboard_blaze', text: 'Nice catch on the sensor drift. I had the same issue last week. Did you use a decoupling cap?', avatar: 'B', timeAgo: '1h ago' }],
  p2: [{ author: 'ohm_runner', text: 'Same here! The confidence boost from real-time validation is underrated.', avatar: 'O', timeAgo: '3h ago' }],
  p3: [
    { author: 'faith', text: 'How did you know it was 1kΩ vs 10kΩ just from looking?', avatar: 'F', timeAgo: '20h ago' },
    { author: 'ohm_runner', text: 'Ohmlet read the colour bands through the camera and flagged it instantly.', avatar: 'O', timeAgo: '18h ago' },
  ],
};

export const DEFAULT_LESSON_PROGRESS: OhmletPersistedState['lessonProgress'] = {
  'Voltage Basics': 100,
  'Current Flow Intuition': 65,
  'Breadboard Confidence Drill': 20,
  'Sensor Signal Sanity Checks': 0,
};

export const DEFAULT_ADAPTIVE_HISTORY: OhmletPersistedState['adaptiveHistory'] = [];

export const DEFAULT_POSTS: OhmletPersistedState['posts'] = [
  {
    id: 'p1',
    author: 'circuit_aurora',
    title: 'No-kit temperature monitor, done in 22 min',
    body: 'Used only a generic breadboard and discrete parts from an old kit. Ohmlet caught that my TMP36 was backwards before I even powered it on. The live correction mid-wiring is genuinely useful, not gimmicky.',
    likes: 42,
    comments: 8,
    liked: false,
    badge: 'Challenge Win',
    timeAgo: '2h ago',
    avatar: 'C',
    buildName: 'Temperature Comfort Monitor',
    replyPreview: { author: 'breadboard_blaze', text: 'Nice catch on the sensor drift. I had the same issue last week. Did you use a decoupling cap?', avatar: 'B' },
  },
  {
    id: 'p2',
    author: 'faith',
    title: 'First time wiring without double-checking a diagram',
    body: 'I used to stare at fritzing diagrams for ages before placing each wire. With Ohmlet watching the board and confirming each step, I just... built it. Resistor placement still makes me nervous but the instant feedback helps a lot.',
    likes: 17,
    comments: 4,
    liked: true,
    badge: '3-day streak',
    timeAgo: '5h ago',
    avatar: 'F',
    buildName: 'Light-Activated Alarm',
    replyPreview: { author: 'ohm_runner', text: 'Same here! The confidence boost from real-time validation is underrated.', avatar: 'O' },
  },
  {
    id: 'p3',
    author: 'ohm_runner',
    title: 'Light alarm build: Ohmlet caught my resistor mix-up',
    body: 'Was using a 1kΩ instead of 10kΩ for the voltage divider. Ohmlet saw it through the camera and told me the reading would be off before I even uploaded the sketch. Saved me 15 minutes of debugging.',
    likes: 31,
    comments: 12,
    liked: false,
    timeAgo: '1d ago',
    avatar: 'O',
    buildName: 'Light-Activated Alarm',
  },
];

export const DEFAULT_JOINED_CHALLENGES: OhmletPersistedState['joinedChallenges'] = {
  streak7: true,
  genericOnly: false,
  teachBack: false,
};

export const DEFAULT_SKILL_NODES: OhmletPersistedState['skillNodes'] = [
  { id: 'resistance', label: 'Resistance', mastery: 82, x: 18, y: 26, color: '#f3e515' },
  { id: 'current', label: 'Current', mastery: 58, x: 43, y: 18, color: '#f59e0b' },
  { id: 'voltage', label: 'Voltage', mastery: 36, x: 67, y: 27, color: '#38bdf8' },
  { id: 'breadboard', label: 'Breadboard', mastery: 64, x: 28, y: 66, color: '#a78bfa' },
  { id: 'sensors', label: 'Sensors', mastery: 49, x: 54, y: 62, color: '#34d399' },
  { id: 'logic', label: 'Circuit Logic', mastery: 41, x: 79, y: 68, color: '#fb7185' },
];

export const DEFAULT_WEEK_PROGRESS: OhmletPersistedState['weekProgress'] = [false, false, false, false, false, false, false];

export const DEFAULT_XP_EVENTS: OhmletPersistedState['xpEvents'] = [];
