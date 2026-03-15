import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Crown,
  Flame,
  Gamepad2,
  GraduationCap,
  Heart,
  Layers3,
  MessageSquare,
  Mic,
  MicOff,
  Play,
  PlayCircle,
  RefreshCw,
  Send,
  Moon,
  Sun,
  Sparkles,
  Trophy,
  Users,
  Video,
  VideoOff,
  X,
  Zap,
  Cpu,
  Download,
  PenTool,
  Upload,
} from 'lucide-react';
import { useLiveBridge } from '../hooks/useLiveBridge';
import { useRelayIdentity } from '../hooks/useRelayIdentity';
import { useRelayUserState } from '../hooks/useRelayUserState';
import { generateQuizQuestions, assessDrawing, type QuizQuestion, type SkillProfilePayload } from '../services/quizEngineClient';
import CircuitDiagram, { CircuitDrawingCanvas } from './CircuitDiagram';
import type { CircuitId } from './CircuitDiagram';
const SandboxScene = React.lazy(() => import('./SandboxScene'));
const Sandbox = React.lazy(() => import('./Sandbox'));
import type { SandboxPreset } from './sandboxPresets';
import { SANDBOX_PRESETS } from './sandboxPresets';

type Stage = 'inventory' | 'wiring' | 'code' | 'run' | 'report';
type AppTab = 'build' | 'learn' | 'community' | 'library' | 'sandbox';
type ConnectionState = 'checking' | 'online' | 'offline';

type SessionCreateResponse = {
  session_id: string;
  user_id: string;
  stage: Stage;
  created_at: string;
};

type MessageResponse = {
  session_id: string;
  stage: Stage;
  decision_source: 'live';
  reply: string;
  created_at: string;
};

type RelayLabProps = {
  onBackToLanding: () => void;
};

type Turn = {
  role: 'you' | 'relay' | 'system';
  text: string;
  timestamp: string;
};

type TwinPreferences = {
  twin3d: boolean;
  shareToCommunity: boolean;
};

type TourStep = {
  target: string; // data-tour attribute value
  tab?: AppTab;   // switch to this tab (undefined = stay on current / sidebar)
  title: string;
  body: string;
  position: 'bottom' | 'top' | 'left' | 'right';
};

type SkillNode = {
  id: string;
  label: string;
  mastery: number;
  x: number;
  y: number;
  color: string;
};

type CommunityPost = {
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

type AdaptiveQueueItem = QuizQuestion & { id: string };

type AdaptiveHistoryEntry = {
  id: string;
  question: string;
  topic: string;
  type: string;
  correct: boolean;
  answerGiven: string;
  explanation: string;
  answeredAt: string;
};

const APP_TABS: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'build', label: 'Build', icon: Compass },
  { id: 'library', label: 'Library', icon: Layers3 },
  { id: 'sandbox', label: 'Sandbox', icon: Cpu },
  { id: 'learn', label: 'Learn', icon: BrainCircuit },
  { id: 'community', label: 'Community', icon: Users },
];

const FOCUS_STEPS: Array<{ label: string; stage: Stage; unlocked: boolean; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'Find Components', stage: 'inventory', unlocked: true, icon: Camera },
  { label: 'Wire The Board', stage: 'wiring', unlocked: true, icon: Zap },
  { label: 'Generate Sketch', stage: 'code', unlocked: true, icon: Sparkles },
  { label: 'Run + Validate', stage: 'run', unlocked: true, icon: Play },
  { label: 'Wrap & Save Twin', stage: 'report', unlocked: true, icon: CheckCircle2 },
];

const XP_ACTIONS: Array<{
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

type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';
type Achievement = {
  id: string;
  title: string;
  desc: string;
  backText: string;
  rarity: number;
  tier: AchievementRarity;
  // gradient for the card body — the card IS the art
  bg: string;
  glowColor: string;
  earned: boolean;
  earnedDate?: string;
  // SVG shape type for the centerpiece
  shape: 'bolt' | 'flame' | 'diamond' | 'star' | 'hexagon' | 'crown';
};

const RARITY_LABELS: Record<AchievementRarity, { label: string; color: string }> = {
  common: { label: 'Common', color: 'rgba(148,163,184,0.7)' },
  rare: { label: 'Rare', color: 'rgba(96,165,250,0.9)' },
  epic: { label: 'Epic', color: 'rgba(192,132,252,0.9)' },
  legendary: { label: 'Legendary', color: 'rgba(251,191,36,1)' },
};

// Each card has a unique gradient — the card IS the holographic material
const ACHIEVEMENTS: Achievement[] = [
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
function CardShape({ shape, className }: { shape: Achievement['shape']; className?: string }) {
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

const TOUR_STEPS: TourStep[] = [
  // ── Build tab ──
  {
    target: 'tour-sidebar-nav',
    title: 'Navigation',
    body: 'Switch between Build, Learn, Sandbox, Community, and Library. Each tab serves a different part of your electronics learning journey.',
    position: 'right',
  },
  {
    target: 'tour-build-pipeline',
    tab: 'build',
    title: 'Build Pipeline',
    body: 'Every build follows five stages: find components, wire the board, generate code, run and validate, then wrap up. Click any unlocked stage to jump to it.',
    position: 'bottom',
  },
  {
    target: 'tour-camera',
    tab: 'build',
    title: 'Live Camera Feed',
    body: 'Point your webcam at your breadboard and Relay watches in real time via the Gemini Live API — it sees your components, wiring, and corrects mistakes as you go. Sessions last up to 15 min (audio) or 2 min (with video) per Gemini API limits. If it disconnects, it will auto-reconnect.',
    position: 'right',
  },
  {
    target: 'tour-chat',
    tab: 'build',
    title: 'Relay Assistant',
    body: 'Chat with Relay using voice or text. It responds with spoken audio and text transcripts. Multiple AI models work behind the scenes — Flash for real-time voice, Pro for code generation, and 2.5-Pro for deep reasoning.',
    position: 'left',
  },
  {
    target: 'tour-streak',
    title: 'Build Streak',
    body: 'Keep your streak alive by building something every day. Consistency is how you level up in electronics.',
    position: 'right',
  },
  {
    target: 'tour-xp',
    title: 'XP & Leagues',
    body: 'Earn XP for every interaction. Level up to climb through Copper, Silver, Gold, and Diamond leagues.',
    position: 'right',
  },
  // ── Learn tab ──
  {
    target: 'tour-knowledge-graph',
    tab: 'learn',
    title: 'Knowledge Graph',
    body: 'A visual map of electronics concepts you\'re learning. Node size shows mastery. Drag nodes to rearrange. Connections show how concepts relate. Mastery scores update as you complete lessons and adaptive drills.',
    position: 'bottom',
  },
  {
    target: 'tour-learning-path',
    tab: 'learn',
    title: 'Lessons & Adaptive Practice',
    body: 'Structured lessons with interactive circuit diagrams, drag-to-order exercises, and drawing challenges. Below them, "Generate Set" creates AI-powered adaptive questions using Gemini 3.1 Pro — personalized to your skill gaps. Your answers and correctness persist across sessions.',
    position: 'left',
  },
  // ── Sandbox tab ──
  {
    target: 'tour-sandbox',
    tab: 'sandbox',
    title: '3D Sandbox',
    body: 'A full 3D electronics playground. Place breadboards, Arduino boards, LEDs, resistors, and more on a virtual workbench. Wire components together, write Arduino code in the built-in editor, and run simulations with visual LED glow and buzzer audio. Try the pre-built Light-Activated Alarm from the Library\'s "3D Twin" button.',
    position: 'bottom',
  },
  // ── Community tab ──
  {
    target: 'tour-leaderboard',
    tab: 'community',
    title: 'Relay League',
    body: 'Compete with other builders for the top spot. Switch between weekly and all-time rankings. Join challenges to earn bonus XP and badges.',
    position: 'right',
  },
  {
    target: 'tour-community-feed',
    tab: 'community',
    title: 'Community Feed',
    body: 'See what others are building, share your wins, and learn from community experiences. Like posts and join the conversation. Posts and reactions persist across sessions via Firestore.',
    position: 'left',
  },
  // ── Library tab ──
  {
    target: 'tour-library',
    tab: 'library',
    title: 'Project Library',
    body: 'Browse builds by difficulty. The Light-Activated Alarm has a working "3D Twin" button that pre-builds the circuit in the Sandbox with code ready to simulate. Other projects are available for guided builds — 3D twins for them are planned for scale-up.',
    position: 'bottom',
  },
];

// ── Interactive lesson system (Duolingo-style) ──

type LessonStepTeach = { type: 'teach'; title: string; body: string; diagram?: string; circuitDiagram?: string; showCurrentFlow?: boolean };
type LessonStepMC = { type: 'multiple_choice'; question: string; options: string[]; correct: number; explanation: string; circuitDiagram?: string };
type LessonStepTF = { type: 'true_false'; statement: string; correct: boolean; explanation: string; circuitDiagram?: string };
type LessonStepFill = { type: 'fill_blank'; prompt: string; blank: string; answer: string; hint: string; circuitDiagram?: string };
type LessonStepMatch = { type: 'match'; instruction: string; pairs: Array<[string, string]> };
type LessonStepSpotError = { type: 'spot_error'; question: string; circuitDiagram: string; correctRegion: string; explanation: string };
type LessonStepIdentify = { type: 'identify_component'; question: string; circuitDiagram: string; correctComponent: string; explanation: string };
type LessonStepDraw = { type: 'draw_connection'; instruction: string; terminals: Array<{ x: number; y: number; label: string; id: string }>; expectedConnections: Array<[string, string]>; explanation: string };
type LessonStepDragOrder = { type: 'drag_order'; instruction: string; items: string[]; correctOrder: number[] };
type LessonStep = LessonStepTeach | LessonStepMC | LessonStepTF | LessonStepFill | LessonStepMatch | LessonStepSpotError | LessonStepIdentify | LessonStepDraw | LessonStepDragOrder;

const LESSON_CONTENT: Record<string, { steps: LessonStep[]; xpReward: number }> = {
  'Voltage Basics': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'What is Voltage?', body: 'Voltage is the electrical pressure that pushes electrons through a circuit. Think of it like water pressure in a pipe — higher voltage means more push.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'What unit is voltage measured in?', options: ['Amps (A)', 'Volts (V)', 'Ohms (Ω)', 'Watts (W)'], correct: 1, explanation: 'Voltage is measured in Volts (V), named after Alessandro Volta.' },
      { type: 'teach', title: 'DC vs AC', body: 'Arduino uses DC (direct current) — electrons flow in one direction. Your wall outlet uses AC (alternating current). A USB cable converts AC to the 5V DC your Arduino needs.' },
      { type: 'true_false', statement: 'An Arduino Uno operates on AC power directly from the wall.', correct: false, explanation: 'Arduino uses DC power. It receives 5V DC through USB or a voltage regulator.' },
      { type: 'teach', title: 'Voltage Dividers', body: 'Two resistors in series split the input voltage. The LDR circuit uses this: an LDR + fixed resistor divide 5V, and Arduino reads the midpoint.\n\nFormula: Vout = Vin × R2 / (R1 + R2)', circuitDiagram: 'voltage_divider' },
      { type: 'identify_component', question: 'Click on the component that reads the voltage midpoint', circuitDiagram: 'voltage_divider', correctComponent: 'a0', explanation: 'Arduino pin A0 reads the analog voltage at the midpoint of the voltage divider.' },
      { type: 'fill_blank', prompt: 'In a voltage divider with Vin = 5V, R1 = 10kΩ, R2 = 10kΩ, Vout = ___ V', blank: '___', answer: '2.5', hint: 'Equal resistors split the voltage in half.', circuitDiagram: 'voltage_divider' },
      { type: 'multiple_choice', question: 'What happens to Vout in a voltage divider if R2 increases?', options: ['Vout decreases', 'Vout increases', 'Vout stays the same', 'The circuit breaks'], correct: 1, explanation: 'As R2 gets larger relative to R1, it gets a bigger share of the voltage: Vout = Vin × R2/(R1+R2).', circuitDiagram: 'voltage_divider' },
      { type: 'true_false', statement: 'You can measure voltage at a single point in a circuit.', correct: false, explanation: 'Voltage is always a difference between two points. You need a reference (usually ground).' },
      { type: 'match', instruction: 'Match each term to its definition.', pairs: [['Voltage', 'Electrical pressure (measured in V)'], ['Current', 'Flow of electrons (measured in A)'], ['Resistance', 'Opposition to flow (measured in Ω)'], ['Ground', 'Reference point at 0V']] },
    ],
  },
  'Current Flow Intuition': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'What is Current?', body: 'Current is the flow of electrons through a conductor, measured in amps (A). In Arduino projects you\'ll deal with milliamps (mA). A typical LED draws about 20mA.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'How much current can a single Arduino Uno pin safely supply?', options: ['5mA', '20mA', '40mA', '500mA'], correct: 2, explanation: 'Each Arduino digital pin can source up to 40mA. Drawing more risks damage to the microcontroller.' },
      { type: 'teach', title: 'Series vs Parallel', body: 'In a series circuit, current takes one path — the same current flows through every component.\n\nIn a parallel circuit, current splits between branches. More branches = more total current drawn from the supply.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'identify_component', question: 'In this series circuit, click on the component that limits current to protect the LED', circuitDiagram: 'series_circuit', correctComponent: 'resistor', explanation: 'The resistor limits current flow through the LED, preventing it from burning out.' },
      { type: 'teach', title: 'Parallel Circuits', body: 'In parallel, each branch gets the full supply voltage. Current splits: I_total = I₁ + I₂.\n\nMore branches = more total current. This is why adding too many LEDs in parallel can overdraw your power supply.', circuitDiagram: 'parallel_circuit', showCurrentFlow: true },
      { type: 'true_false', statement: 'In a series circuit, the current through each component is different.', correct: false, explanation: 'In series, current is the SAME everywhere. There\'s only one path for electrons to flow.', circuitDiagram: 'series_circuit' },
      { type: 'teach', title: 'Ohm\'s Law', body: 'V = I × R\n\nKnow any two → calculate the third.\nExample: 5V supply, 220Ω resistor, LED (2V drop):\nI = (5 - 2) / 220 = 13.6mA ✓ safe for LEDs' },
      { type: 'fill_blank', prompt: 'Using Ohm\'s Law: a 330Ω resistor with 3.3V across it draws ___ mA', blank: '___', answer: '10', hint: 'I = V/R = 3.3/330 = 0.01A = ?mA' },
      { type: 'spot_error', question: 'This LED circuit is missing something critical. Click on the problem area.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'Without a current-limiting resistor, too much current flows through the LED — it will burn out instantly!' },
      { type: 'multiple_choice', question: 'Why do you need a resistor with an LED?', options: ['To make the LED brighter', 'To limit current and prevent burnout', 'To increase voltage across the LED', 'LEDs don\'t actually need resistors'], correct: 1, explanation: 'Without a current-limiting resistor, too much current flows through the LED, destroying it almost instantly.' },
      { type: 'match', instruction: 'Match the circuit type to its current behavior.', pairs: [['Series circuit', 'Same current everywhere'], ['Parallel circuit', 'Current splits between branches'], ['Short circuit', 'Dangerously high current'], ['Open circuit', 'Zero current flow']] },
    ],
  },
  'Breadboard Confidence Drill': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'How a Breadboard Works', body: 'Internal metal strips connect holes in patterns:\n\n• Each row of 5 holes (a-e) is connected\n• Each row of 5 holes (f-j) is connected\n• The two long edge rails are power (+ and −)\n\nThe center gap keeps the two halves separate.', circuitDiagram: 'breadboard_layout' },
      { type: 'multiple_choice', question: 'On a breadboard, holes a1-e1 are...', options: ['All independent', 'Connected horizontally', 'Connected to f1-j1', 'Connected to the power rail'], correct: 1, explanation: 'Holes a through e in the same row are connected by an internal metal strip. f through j are a separate connected group.', circuitDiagram: 'breadboard_layout' },
      { type: 'true_false', statement: 'Holes e5 and f5 on a standard breadboard are electrically connected.', correct: false, explanation: 'The center gap breaks the connection. e5 connects to a5-d5. f5 connects to g5-j5. They\'re separate.', circuitDiagram: 'breadboard_layout' },
      { type: 'draw_connection', instruction: 'Wire up a simple LED circuit! Connect the power to the resistor, then the resistor to the LED, then the LED to ground.', terminals: [{ x: 60, y: 50, label: '5V', id: 'power' }, { x: 160, y: 50, label: 'R', id: 'resistor_in' }, { x: 240, y: 50, label: 'R', id: 'resistor_out' }, { x: 320, y: 50, label: 'LED', id: 'led' }, { x: 320, y: 200, label: 'GND', id: 'ground' }], expectedConnections: [['power', 'resistor_in'], ['resistor_out', 'led'], ['led', 'ground']], explanation: 'Power → Resistor → LED → Ground. The resistor must come before the LED to limit current.' },
      { type: 'multiple_choice', question: 'What is the #1 breadboard wiring mistake?', options: ['Using wrong wire colors', 'Both component legs in the same row', 'Wires too long', 'Not using the power rails'], correct: 1, explanation: 'Placing both legs of a component in the same row short-circuits it, since all holes in a row are connected.' },
      { type: 'drag_order', instruction: 'Put these steps in the correct order for building a circuit on a breadboard:', items: ['Connect power rail to Arduino 5V', 'Place components spanning different rows', 'Connect ground rail to Arduino GND', 'Add jumper wires between components', 'Test with a multimeter before powering on'], correctOrder: [0, 2, 1, 3, 4] },
      { type: 'match', instruction: 'Match the breadboard zone to its function.', pairs: [['Rows a-e', 'Connected group (top half)'], ['Rows f-j', 'Connected group (bottom half)'], ['Side rail (+)', 'Positive voltage bus'], ['Side rail (−)', 'Ground bus'], ['Center gap', 'Separates the two halves']] },
      { type: 'fill_blank', prompt: 'To connect an LED, place the anode in row 10 and cathode in row ___ (a different row).', blank: '___', answer: '11', hint: 'Any different row number works. The key is they must be different rows.' },
    ],
  },
  'Sensor Signal Sanity Checks': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The LDR Alarm Circuit', body: 'This is the full Light-Activated Alarm circuit. The LDR and 10kΩ resistor form a voltage divider. Arduino reads the midpoint on A0 and triggers the LED on D9 when light drops.', circuitDiagram: 'ldr_alarm' },
      { type: 'identify_component', question: 'Click on the component that changes resistance based on light', circuitDiagram: 'ldr_alarm', correctComponent: 'ldr', explanation: 'The LDR (Light Dependent Resistor) decreases resistance in bright light and increases resistance in darkness.' },
      { type: 'teach', title: 'Analog vs Digital', body: 'Digital = HIGH (5V) or LOW (0V), just two states.\nAnalog = continuous range. An LDR outputs 0V to 5V.\n\nArduino reads analog on pins A0-A5, returning 0 to 1023.' },
      { type: 'fill_blank', prompt: 'Arduino\'s analogRead() returns values from 0 to ___', blank: '___', answer: '1023', hint: 'Arduino has a 10-bit ADC: 2^10 - 1 = ?' },
      { type: 'spot_error', question: 'This LED is connected wrong. Can you spot the error?', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is reversed! The anode (triangle) must point toward the ground side. Current only flows one way through an LED.' },
      { type: 'multiple_choice', question: 'An LDR reading stuck at 1023 most likely means...', options: ['Maximum brightness', 'The sensor is working perfectly', 'A wiring error (pin shorted to 5V)', 'The Arduino is broken'], correct: 2, explanation: 'A reading stuck at the max (1023) usually means the analog pin is directly connected to 5V — likely a short circuit or missing resistor.', circuitDiagram: 'voltage_divider' },
      { type: 'true_false', statement: 'A temperature reading of -40°C from an indoor sensor is probably correct.', correct: false, explanation: 'This is physically implausible indoors. It likely means a wiring error, floating pin, or faulty sensor.' },
      { type: 'spot_error', question: 'There is a dangerous problem in this circuit. Find it!', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'A wire is bypassing the resistor and LED, creating a short circuit. This draws maximum current and could damage the battery or start a fire.' },
      { type: 'draw_connection', instruction: 'Wire up the LDR voltage divider: connect 5V to the LDR, LDR to the junction, junction to the resistor, and resistor to ground. Also connect the junction to A0.', terminals: [{ x: 60, y: 40, label: '5V', id: 'vcc' }, { x: 180, y: 40, label: 'LDR', id: 'ldr' }, { x: 300, y: 40, label: 'A0', id: 'a0' }, { x: 180, y: 140, label: '10kΩ', id: 'res' }, { x: 180, y: 240, label: 'GND', id: 'gnd' }], expectedConnections: [['vcc', 'ldr'], ['ldr', 'a0'], ['ldr', 'res'], ['res', 'gnd']], explanation: '5V → LDR → junction → 10kΩ → GND, with junction also connected to A0. This forms the voltage divider that Arduino reads.' },
      { type: 'multiple_choice', question: 'What baud rate should you use with Serial.begin() for basic debugging?', options: ['1200', '4800', '9600', '115200'], correct: 2, explanation: '9600 is the standard default baud rate for Serial Monitor debugging. It\'s fast enough for most sensor readings.' },
      { type: 'match', instruction: 'Match the sensor issue to its likely cause.', pairs: [['Reading stuck at 0', 'Pin not connected (floating)'], ['Reading stuck at 1023', 'Pin shorted to 5V'], ['Wildly jumping values', 'Loose connection or noise'], ['Slowly drifting values', 'Normal sensor behavior']] },
    ],
  },
};

const QUICK_PROMPTS = [
  'Help me pick resistor values for the LED and buzzer.',
  'Watch my wiring and tell me the safest next move.',
  'Explain voltage vs current while I place this resistor.',
  'I want to finish this build with a 3D twin only.',
];

const BUILD_LIBRARY = [
  {
    title: 'Light-Activated Alarm',
    level: 'Beginner',
    est: '20 min',
    mode: 'Arduino Uno',
    color: '#f3e515',
    icon: Zap,
    desc: 'Build a voltage divider with an LDR and trigger an LED or buzzer when light drops below a threshold.',
    parts: ['Arduino Uno', 'LDR', '10k\u03A9 resistor', 'LED', 'Buzzer', 'Jumper wires'],
    builds: 847,
  },
  {
    title: 'Temperature Comfort Monitor',
    level: 'Beginner',
    est: '25 min',
    mode: 'Arduino + TMP36',
    color: '#38bdf8',
    icon: Sparkles,
    desc: 'Read analog temperature from a TMP36 sensor and display comfort zones on an RGB LED.',
    parts: ['Arduino Uno', 'TMP36 sensor', 'RGB LED', '3x 220\u03A9 resistors', 'Jumper wires'],
    builds: 612,
  },
  {
    title: 'Motion Alert Prototype',
    level: 'Intermediate',
    est: '35 min',
    mode: 'Arduino + PIR',
    color: '#a78bfa',
    icon: Camera,
    desc: 'Wire a passive infrared sensor to detect motion and trigger a piezo alarm with a cooldown timer.',
    parts: ['Arduino Uno', 'HC-SR501 PIR', 'Piezo buzzer', 'LED', '220\u03A9 resistor', 'Jumper wires'],
    builds: 394,
  },
  {
    title: 'Auto-Watering Trigger',
    level: 'Intermediate',
    est: '40 min',
    mode: 'Arduino + Relay Module',
    color: '#34d399',
    icon: Gamepad2,
    desc: 'Read soil moisture with a capacitive sensor and switch a water pump on/off via a relay module.',
    parts: ['Arduino Uno', 'Soil moisture sensor', '5V relay module', 'Water pump', 'Jumper wires'],
    builds: 221,
  },
  {
    title: 'Power-Efficient Logger',
    level: 'Advanced',
    est: '55 min',
    mode: 'Arduino + SD Card',
    color: '#fb7185',
    icon: BrainCircuit,
    desc: 'Log sensor readings to an SD card with timestamps and use sleep modes to extend battery life.',
    parts: ['Arduino Uno', 'SD card module', 'RTC DS3231', 'TMP36', 'Battery pack', 'Jumper wires'],
    builds: 156,
  },
  {
    title: 'Noise Detector',
    level: 'Beginner',
    est: '18 min',
    mode: 'Arduino + KY-037',
    color: '#f59e0b',
    icon: Play,
    desc: 'Sample a sound sensor module and light up LEDs proportionally to ambient noise level.',
    parts: ['Arduino Uno', 'KY-037 sound sensor', '3x LEDs', '3x 220\u03A9 resistors', 'Jumper wires'],
    builds: 503,
  },
];

const LEADERBOARD_WEEKLY = [
  { name: 'faith', points: 1640, streak: 5, avatar: 'F' },
  { name: 'circuit_aurora', points: 1580, streak: 8, avatar: 'C' },
  { name: 'breadboard_blaze', points: 1522, streak: 6, avatar: 'B' },
  { name: 'ohm_runner', points: 1448, streak: 4, avatar: 'O' },
  { name: 'voltage_voyager', points: 1320, streak: 3, avatar: 'V' },
];

const LEADERBOARD_ALL_TIME = [
  { name: 'circuit_aurora', points: 9930, streak: 8, avatar: 'C' },
  { name: 'breadboard_blaze', points: 9050, streak: 6, avatar: 'B' },
  { name: 'faith', points: 8840, streak: 5, avatar: 'F' },
  { name: 'relay_mentor', points: 8122, streak: 12, avatar: 'R' },
  { name: 'ohm_runner', points: 7902, streak: 4, avatar: 'O' },
];

const AVATAR_COLORS = ['#f3e515', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#f59e0b'];

type XpEvent = {
  id: string;
  type: 'lesson_completed' | 'quiz_correct' | 'quiz_incorrect' | 'session_started' | 'build_shared';
  xp: number;
  timestamp: string;
  detail?: string;
};

type RelayPersistedState = {
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

const DEFAULT_COMMENT_REPLIES: RelayPersistedState['commentReplies'] = {
  p1: [{ author: 'breadboard_blaze', text: 'Nice catch on the sensor drift — I had the same issue last week. Did you use a decoupling cap?', avatar: 'B', timeAgo: '1h ago' }],
  p2: [{ author: 'ohm_runner', text: 'Same here! The confidence boost from real-time validation is underrated.', avatar: 'O', timeAgo: '3h ago' }],
  p3: [
    { author: 'faith', text: 'How did you know it was 1kΩ vs 10kΩ just from looking?', avatar: 'F', timeAgo: '20h ago' },
    { author: 'ohm_runner', text: 'Relay read the colour bands through the camera and flagged it instantly.', avatar: 'O', timeAgo: '18h ago' },
  ],
};

const DEFAULT_LESSON_PROGRESS: RelayPersistedState['lessonProgress'] = {
  'Voltage Basics': 100,
  'Current Flow Intuition': 65,
  'Breadboard Confidence Drill': 20,
  'Sensor Signal Sanity Checks': 0,
};

const DEFAULT_ADAPTIVE_HISTORY: RelayPersistedState['adaptiveHistory'] = [];

const DEFAULT_POSTS: RelayPersistedState['posts'] = [
  {
    id: 'p1',
    author: 'circuit_aurora',
    title: 'No-kit temperature monitor — done in 22 min',
    body: 'Used only a generic breadboard and discrete parts from an old kit. Relay caught that my TMP36 was backwards before I even powered it on. The live correction mid-wiring is genuinely useful, not gimmicky.',
    likes: 42,
    comments: 8,
    liked: false,
    badge: 'Challenge Win',
    timeAgo: '2h ago',
    avatar: 'C',
    buildName: 'Temperature Comfort Monitor',
    replyPreview: { author: 'breadboard_blaze', text: 'Nice catch on the sensor drift — I had the same issue last week. Did you use a decoupling cap?', avatar: 'B' },
  },
  {
    id: 'p2',
    author: 'faith',
    title: 'First time wiring without double-checking a diagram',
    body: 'I used to stare at fritzing diagrams for ages before placing each wire. With Relay watching the board and confirming each step, I just... built it. Resistor placement still makes me nervous but the instant feedback helps a lot.',
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
    title: 'Light alarm build — Relay caught my resistor mix-up',
    body: 'Was using a 1kΩ instead of 10kΩ for the voltage divider. Relay saw it through the camera and told me the reading would be off before I even uploaded the sketch. Saved me 15 minutes of debugging.',
    likes: 31,
    comments: 12,
    liked: false,
    timeAgo: '1d ago',
    avatar: 'O',
    buildName: 'Light-Activated Alarm',
  },
];

const DEFAULT_JOINED_CHALLENGES: RelayPersistedState['joinedChallenges'] = {
  streak7: true,
  genericOnly: false,
  teachBack: false,
};

const DEFAULT_SKILL_NODES: RelayPersistedState['skillNodes'] = [
  { id: 'resistance', label: 'Resistance', mastery: 82, x: 18, y: 26, color: '#f3e515' },
  { id: 'current', label: 'Current', mastery: 58, x: 43, y: 18, color: '#f59e0b' },
  { id: 'voltage', label: 'Voltage', mastery: 36, x: 67, y: 27, color: '#38bdf8' },
  { id: 'breadboard', label: 'Breadboard', mastery: 64, x: 28, y: 66, color: '#a78bfa' },
  { id: 'sensors', label: 'Sensors', mastery: 49, x: 54, y: 62, color: '#34d399' },
  { id: 'logic', label: 'Circuit Logic', mastery: 41, x: 79, y: 68, color: '#fb7185' },
];

const DEFAULT_WEEK_PROGRESS: RelayPersistedState['weekProgress'] = [false, false, false, false, false, false, false];

const DEFAULT_XP_EVENTS: RelayPersistedState['xpEvents'] = [];

const todayISO = () => new Date().toISOString().slice(0, 10);

const prettyTime = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit' }).format(date);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const levelName = (lvl: number) => {
  if (lvl >= 10) return 'Diamond';
  if (lvl >= 7) return 'Gold';
  if (lvl >= 4) return 'Silver';
  return 'Copper';
};

const themes = {
  light: {
    // Shell
    pageBg: 'bg-[#f0f1f3]',
    pageText: 'text-slate-900',
    // Sidebar
    sidebarBg: 'bg-white',
    sidebarText: 'text-slate-900',
    sidebarMuted: 'text-slate-400',
    sidebarCardBg: 'bg-slate-50 ring-1 ring-slate-200/80',
    sidebarCardMuted: 'text-slate-400',
    sidebarNavActive: 'bg-[#f3e515] text-[#0a0a0a] shadow-[0_0_0_2px_#0a0a0a,0_4px_12px_rgba(0,0,0,0.1)] scale-[1.02]',
    sidebarNavInactive: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    sidebarStreakOff: 'bg-slate-100 text-slate-300 hover:bg-slate-200',
    sidebarStreakOn: 'bg-[#f3e515] text-black shadow-[0_0_12px_rgba(243,229,21,0.25)]',
    sidebarLeagueBadge: 'bg-slate-100 text-slate-500',
    sidebarXpBar: 'bg-slate-200',
    sidebarXpText: 'text-slate-400',
    sidebarBorder: 'border-slate-200',
    sidebarConnText: 'text-slate-400',
    // Header
    headerBg: 'bg-white border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
    headerTitle: 'text-slate-900',
    headerSub: 'text-slate-400',
    headerBtnBg: 'bg-slate-100 text-slate-500 hover:bg-slate-200',
    headerTourBg: 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]',
    // Content
    contentBg: '',
    cardBg: 'bg-white shadow-sm ring-1 ring-slate-200/80',
    cardHeaderBorder: 'border-b border-slate-100',
    cardTitle: 'text-slate-800',
    cardSub: 'text-slate-400',
    // Build pipeline
    pipelineActive: 'bg-[#0a0a0a] text-[#f3e515] shadow-lg shadow-black/20',
    pipelineCompleted: 'bg-[#f3e515]/20 text-[#0a0a0a] hover:bg-[#f3e515]/30',
    pipelineDefault: 'bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 hover:text-slate-700',
    pipelineLocked: 'bg-slate-100 text-slate-300',
    pipelineLine: 'bg-slate-200',
    pipelineLineDone: 'bg-[#f3e515]',
    // Camera
    cameraBg: 'bg-slate-100',
    cameraText: 'text-slate-400',
    cameraSub: 'text-slate-300',
    cameraIcon: 'text-slate-300',
    cameraIconRing: 'bg-slate-200/60 ring-2 ring-slate-300/50',
    cameraBadge: 'bg-white/80 backdrop-blur-sm ring-1 ring-slate-200',
    cameraBadgeText: 'text-slate-500',
    // Chat
    chatBg: 'bg-slate-50',
    chatEmptyIcon: 'bg-slate-100 text-slate-300',
    chatEmptyText: 'text-slate-400',
    chatEmptySub: 'text-slate-300',
    chatYouBubble: 'bg-[#0a0a0a] text-white',
    chatYouTime: 'text-white/40',
    chatRelayBubble: 'bg-white text-slate-700 ring-1 ring-slate-200/80',
    chatSystemBubble: 'bg-[#f3e515]/15 text-slate-600',
    chatTime: 'text-slate-400',
    chatPromptBg: 'bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-[#f3e515]/10 hover:text-slate-700 hover:ring-[#f3e515]/40',
    chatInputBg: 'bg-white ring-1 ring-slate-200 text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-[#0a0a0a]',
    chatSendBg: 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]',
    chatInputBorder: 'border-t border-slate-100',
    // XP card
    xpBg: 'bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] text-white',
    xpMuted: 'text-white/40',
    xpSub: 'text-white/30',
    xpBarOff: 'bg-white/10',
    // Twin
    twinPreviewBg: 'bg-gradient-to-br from-slate-50 to-slate-100',
    twinBox: 'bg-gradient-to-br from-slate-200 to-slate-300',
    twinOnBg: 'bg-[#0a0a0a] text-[#f3e515]',
    twinOffBg: 'bg-slate-50 text-slate-500 ring-1 ring-slate-200',
    // Learn
    graphBg: 'bg-gradient-to-br from-slate-50 to-white',
    graphEdge: '#e2e8f0',
    graphNodeInner: 'bg-white text-slate-700',
    graphNodeFallback: '#f1f5f9',
    masteryBarBg: 'bg-slate-100',
    masteryLabel: 'text-slate-700',
    lessonCardBg: 'bg-white ring-1 ring-slate-200/80',
    // Community
    leagueTabActive: 'bg-white text-slate-800 shadow-sm',
    leagueTabInactive: 'text-slate-400',
    leagueTabBg: 'bg-slate-100',
    leagueEntryBg: '',
    leagueRankBg: 'bg-slate-100 text-slate-400',
    challengeBg: 'bg-slate-50 ring-1 ring-slate-200/60',
    challengeJoined: 'bg-[#0a0a0a] text-[#f3e515]',
    challengeNotJoined: 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-slate-300',
    postBg: 'bg-slate-50 ring-1 ring-slate-200/60',
    postAuthor: 'text-slate-800',
    postBody: 'text-slate-500',
    postBadge: 'bg-[#f3e515]/30 text-[#0a0a0a]',
    likeBgOn: 'bg-[#0a0a0a] text-[#f3e515]',
    likeBgOff: 'bg-white text-slate-400 ring-1 ring-slate-200 hover:text-rose-400',
    commentBg: 'bg-white text-slate-400 ring-1 ring-slate-200',
    // Library
    libHeaderBg: (color: string) => `${color}18`,
    libBodyBg: 'bg-white',
    libTitle: 'text-slate-800',
    libSub: 'text-slate-400',
    libBtnBg: 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]',
    libCardRing: 'ring-1 ring-slate-200/80',
    // Tour
    tourOverlay: 'bg-black/50',
    tourBg: 'bg-white',
    tourStep: 'text-slate-400',
    tourTitle: 'text-slate-900',
    tourBody: 'text-slate-500',
    tourClose: 'bg-slate-100 text-slate-400 hover:bg-slate-200',
    tourBarOff: 'bg-slate-100',
    tourBack: 'text-slate-400 hover:text-slate-600',
    tourNext: 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]',
    tourBorder: 'border-t border-slate-100',
    // Error
    errorBg: 'border border-rose-200 bg-rose-50 text-rose-700',
    errorClose: 'text-rose-400 hover:text-rose-600',
  },
  dark: {
    pageBg: 'bg-[#0e0e10]',
    pageText: 'text-white',
    sidebarBg: 'bg-[#0a0a0a]',
    sidebarText: 'text-white',
    sidebarMuted: 'text-white/40',
    sidebarCardBg: 'bg-white/[0.04] ring-1 ring-white/10',
    sidebarCardMuted: 'text-white/40',
    sidebarNavActive: 'bg-[#f3e515] text-[#0a0a0a] shadow-[0_0_0_2px_#0a0a0a,0_4px_12px_rgba(0,0,0,0.3)] scale-[1.02]',
    sidebarNavInactive: 'text-white/60 hover:bg-white/5 hover:text-white/90',
    sidebarStreakOff: 'bg-white/5 text-white/30 hover:bg-white/10',
    sidebarStreakOn: 'bg-[#f3e515] text-black shadow-[0_0_12px_rgba(243,229,21,0.3)]',
    sidebarLeagueBadge: 'bg-white/10 text-white/60',
    sidebarXpBar: 'bg-white/10',
    sidebarXpText: 'text-white/30',
    sidebarBorder: 'border-white/10',
    sidebarConnText: 'text-white/40',
    headerBg: 'bg-[#141416] border-b border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.3)]',
    headerTitle: 'text-white',
    headerSub: 'text-white/40',
    headerBtnBg: 'bg-white/5 text-white/50 hover:bg-white/10',
    headerTourBg: 'bg-[#f3e515] text-[#0a0a0a] hover:bg-[#e8db11]',
    contentBg: '',
    cardBg: 'bg-[#1a1a1e] shadow-sm ring-1 ring-white/10',
    cardHeaderBorder: 'border-b border-white/10',
    cardTitle: 'text-white',
    cardSub: 'text-white/40',
    pipelineActive: 'bg-[#f3e515] text-[#0a0a0a] shadow-lg shadow-[#f3e515]/20',
    pipelineCompleted: 'bg-[#f3e515]/15 text-[#f3e515] hover:bg-[#f3e515]/25',
    pipelineDefault: 'bg-[#1a1a1e] text-white/50 shadow-sm ring-1 ring-white/10 hover:ring-white/20 hover:text-white/70',
    pipelineLocked: 'bg-white/5 text-white/20',
    pipelineLine: 'bg-white/10',
    pipelineLineDone: 'bg-[#f3e515]',
    cameraBg: 'bg-[#141416]',
    cameraText: 'text-white/70',
    cameraSub: 'text-white/30',
    cameraIcon: 'text-white/30',
    cameraIconRing: 'bg-white/5 ring-2 ring-white/10',
    cameraBadge: 'bg-black/60 backdrop-blur-sm',
    cameraBadgeText: 'text-white/70',
    chatBg: 'bg-[#111114]',
    chatEmptyIcon: 'bg-white/5 text-white/20',
    chatEmptyText: 'text-white/40',
    chatEmptySub: 'text-white/20',
    chatYouBubble: 'bg-[#f3e515] text-[#0a0a0a]',
    chatYouTime: 'text-[#0a0a0a]/50',
    chatRelayBubble: 'bg-white/10 text-white/80',
    chatSystemBubble: 'bg-[#f3e515]/10 text-white/60',
    chatTime: 'text-white/30',
    chatPromptBg: 'bg-white/5 ring-1 ring-white/10 text-white/40 hover:bg-[#f3e515]/10 hover:text-white/70 hover:ring-[#f3e515]/30',
    chatInputBg: 'bg-white/5 ring-1 ring-white/10 text-white placeholder:text-white/20 focus:ring-2 focus:ring-[#f3e515]/50',
    chatSendBg: 'bg-[#f3e515] text-[#0a0a0a] hover:bg-[#e8db11]',
    chatInputBorder: 'border-t border-white/10',
    xpBg: 'bg-gradient-to-br from-[#f3e515]/10 to-[#f3e515]/5 text-white ring-1 ring-[#f3e515]/20',
    xpMuted: 'text-white/40',
    xpSub: 'text-white/30',
    xpBarOff: 'bg-white/10',
    twinPreviewBg: 'bg-gradient-to-br from-white/5 to-white/[0.02]',
    twinBox: 'bg-gradient-to-br from-white/10 to-white/5',
    twinOnBg: 'bg-[#f3e515] text-[#0a0a0a]',
    twinOffBg: 'bg-white/5 text-white/50 ring-1 ring-white/10',
    graphBg: 'bg-gradient-to-br from-[#141416] to-[#1a1a1e]',
    graphEdge: 'rgba(255,255,255,0.1)',
    graphNodeInner: 'bg-[#1a1a1e] text-white/80',
    graphNodeFallback: '#1a1a1e',
    masteryBarBg: 'bg-white/10',
    masteryLabel: 'text-white/70',
    lessonCardBg: 'bg-[#1a1a1e] ring-1 ring-white/10',
    leagueTabActive: 'bg-white/10 text-white shadow-sm',
    leagueTabInactive: 'text-white/40',
    leagueTabBg: 'bg-white/5',
    leagueEntryBg: '',
    leagueRankBg: 'bg-white/5 text-white/40',
    challengeBg: 'bg-white/[0.03] ring-1 ring-white/10',
    challengeJoined: 'bg-[#f3e515] text-[#0a0a0a]',
    challengeNotJoined: 'bg-white/5 text-white/50 ring-1 ring-white/10 hover:ring-white/20',
    postBg: 'bg-white/[0.03] ring-1 ring-white/10',
    postAuthor: 'text-white',
    postBody: 'text-white/50',
    postBadge: 'bg-[#f3e515]/20 text-[#f3e515]',
    likeBgOn: 'bg-[#f3e515] text-[#0a0a0a]',
    likeBgOff: 'bg-white/5 text-white/40 ring-1 ring-white/10 hover:text-rose-400',
    commentBg: 'bg-white/5 text-white/40 ring-1 ring-white/10',
    libHeaderBg: (color: string) => `${color}12`,
    libBodyBg: 'bg-[#1a1a1e]',
    libTitle: 'text-white',
    libSub: 'text-white/40',
    libBtnBg: 'bg-[#f3e515] text-[#0a0a0a] hover:bg-[#e8db11]',
    libCardRing: 'ring-1 ring-white/10',
    tourOverlay: 'bg-black/70',
    tourBg: 'bg-[#1a1a1e]',
    tourStep: 'text-white/40',
    tourTitle: 'text-white',
    tourBody: 'text-white/50',
    tourClose: 'bg-white/5 text-white/40 hover:bg-white/10',
    tourBarOff: 'bg-white/10',
    tourBack: 'text-white/40 hover:text-white/60',
    tourNext: 'bg-[#f3e515] text-[#0a0a0a] hover:bg-[#e8db11]',
    tourBorder: 'border-t border-white/10',
    errorBg: 'border border-rose-500/30 bg-rose-500/10 text-rose-300',
    errorClose: 'text-rose-400 hover:text-rose-300',
  },
};

// Simulated serial output for demo mode
const SERIAL_LINES = [
  'Light level: 847 → OK',
  'Light level: 823 → OK',
  'Light level: 651 → OK',
  'Light level: 342 → ALARM ON',
  'Light level: 289 → ALARM ON',
  'Light level: 156 → ALARM ON',
  'Light level: 412 → ALARM ON',
  'Light level: 687 → OK',
  'Light level: 812 → OK',
  'Light level: 791 → OK',
];

function SerialOutput() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      setLines((prev) => [...prev.slice(-12), SERIAL_LINES[idx % SERIAL_LINES.length]]);
      idx++;
    }, 800);
    return () => clearInterval(interval);
  }, []);
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={line.includes('ALARM ON') ? 'text-rose-400 font-bold' : ''}>
          {line}
        </p>
      ))}
    </>
  );
}

class SceneErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Suppress noisy stack traces in production while showing graceful fallback.
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export const RelayLab: React.FC<RelayLabProps> = ({ onBackToLanding }) => {
  const apiRoot = useMemo(
    () => (import.meta.env.VITE_RELAY_API_BASE_URL || 'http://localhost:8082').trim().replace(/\/+$/, ''),
    []
  );
  const wsRoot = useMemo(() => {
    // If explicit WS URL set, use it; otherwise derive from API URL
    const explicit = import.meta.env.VITE_RELAY_WS_URL;
    if (explicit) return explicit.trim().replace(/\/+$/, '');
    // https → wss, http → ws
    return apiRoot.replace(/^http/, 'ws');
  }, [apiRoot]);
  const quizApiRoot = useMemo(() => {
    const explicit = (import.meta.env.VITE_RELAY_QUIZ_API_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    if (apiRoot.includes('relay-live-bridge')) return apiRoot.replace('relay-live-bridge', 'relay-quiz-engine');
    if (apiRoot.includes(':8082')) return apiRoot.replace(':8082', ':8083');
    return apiRoot;
  }, [apiRoot]);
  const configuredDefaultUserId = useMemo(() => (import.meta.env.VITE_RELAY_DEFAULT_USER_ID || '').trim(), []);
  const defaultUserId = useRelayIdentity(configuredDefaultUserId);

  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('relay-theme') === 'dark'; } catch { return false; }
  });
  const t = dark ? themes.dark : themes.light;

  useEffect(() => {
    try { localStorage.setItem('relay-theme', dark ? 'dark' : 'light'); } catch { /* noop */ }
  }, [dark]);

  const [liveSessionId] = useState(() => `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const live = useLiveBridge({
    wsUrl: wsRoot,
    userId: defaultUserId,
    sessionId: liveSessionId,
  });

  const [activeTab, setActiveTab] = useState<AppTab>('build');
  const [sandboxPreset, setSandboxPreset] = useState<SandboxPreset | null>(null);
  const [focusStage, setFocusStage] = useState<Stage>('inventory');
  const [kitProfile, setKitProfile] = useState('Generic Breadboard Kit');
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [sessionId, setSessionId] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [simMode, setSimMode] = useState(false);
  const [activeBuild, setActiveBuild] = useState<typeof BUILD_LIBRARY[number] | null>(null);
  const [challengeModal, setChallengeModal] = useState<{ id: string; title: string; reward: string; desc: string; requirements: string[]; color: string } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentReplies, setCommentReplies] = useState<Record<string, Array<{ author: string; text: string; avatar: string; timeAgo: string }>>>(DEFAULT_COMMENT_REPLIES);
  const [activeLesson, setActiveLesson] = useState<{ title: string; desc: string; progress: number; color: string; time: string } | null>(null);
  const [lessonStep, setLessonStep] = useState(0);
  const [lessonAnswer, setLessonAnswer] = useState<string | number | boolean | null>(null);
  const [lessonAnswered, setLessonAnswered] = useState(false);
  const [lessonCorrect, setLessonCorrect] = useState<boolean | null>(null);
  const [lessonHearts, setLessonHearts] = useState(3);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set());
  const [matchSelected, setMatchSelected] = useState<{ side: 'left' | 'right'; idx: number } | null>(null);
  const [matchShuffledRight, setMatchShuffledRight] = useState<number[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, number>>(DEFAULT_LESSON_PROGRESS);
  const [adaptiveHistory, setAdaptiveHistory] = useState<AdaptiveHistoryEntry[]>(DEFAULT_ADAPTIVE_HISTORY);
  const [adaptiveQueue, setAdaptiveQueue] = useState<AdaptiveQueueItem[]>([]);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [adaptiveError, setAdaptiveError] = useState('');
  const [adaptiveSelectedOption, setAdaptiveSelectedOption] = useState<number | null>(null);
  const [adaptiveTypedAnswer, setAdaptiveTypedAnswer] = useState('');
  const [adaptiveFeedback, setAdaptiveFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [adaptiveResult, setAdaptiveResult] = useState<{ correct: boolean; answerGiven: string } | null>(null);
  const [adaptiveMeta, setAdaptiveMeta] = useState<{ recommendedTopic: string; skillGaps: string[] } | null>(null);
  const [dragItems, setDragItems] = useState<number[]>([]);
  const [dragCorrect, setDragCorrect] = useState<boolean | null>(null);
  const [spotErrorRegion, setSpotErrorRegion] = useState<string | null>(null);
  const [drawingComplete, setDrawingComplete] = useState(false);
  const [drawExerciseActive, setDrawExerciseActive] = useState(false);
  const [drawExerciseLoading, setDrawExerciseLoading] = useState(false);
  const [drawExerciseFeedback, setDrawExerciseFeedback] = useState<{ correct: boolean; feedback: string; components: string[]; confidence: number } | null>(null);
  const [drawPenColor, setDrawPenColor] = useState('#000000');
  const [drawIsEraser, setDrawIsEraser] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'stats' | 'achievements'>('stats');
  const [inspectCard, setInspectCard] = useState<Achievement | null>(null);
  const [inspectFlipped, setInspectFlipped] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [twinPrefs, setTwinPrefs] = useState<TwinPreferences>({ twin3d: true, shareToCommunity: false });
  const [weekProgress, setWeekProgress] = useState<boolean[]>(DEFAULT_WEEK_PROGRESS);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>(DEFAULT_XP_EVENTS);
  const [lastActiveDate, setLastActiveDate] = useState('');
  const [leagueView, setLeagueView] = useState<'weekly' | 'alltime'>('weekly');
  const [likeAnimating, setLikeAnimating] = useState<string | null>(null);

  const [posts, setPosts] = useState<CommunityPost[]>(DEFAULT_POSTS);

  const [joinedChallenges, setJoinedChallenges] = useState<Record<string, boolean>>(DEFAULT_JOINED_CHALLENGES);

  const [skillNodes, setSkillNodes] = useState<SkillNode[]>(DEFAULT_SKILL_NODES);
  const persistedDefaults = useMemo<RelayPersistedState>(() => ({
    posts: DEFAULT_POSTS,
    commentReplies: DEFAULT_COMMENT_REPLIES,
    lessonProgress: DEFAULT_LESSON_PROGRESS,
    adaptiveHistory: DEFAULT_ADAPTIVE_HISTORY,
    joinedChallenges: DEFAULT_JOINED_CHALLENGES,
    skillNodes: DEFAULT_SKILL_NODES,
    weekProgress: DEFAULT_WEEK_PROGRESS,
    xpEvents: DEFAULT_XP_EVENTS,
    lastActiveDate: '',
  }), []);
  const {
    state: persistedRelayState,
    updateState: updatePersistedRelayState,
    ready: persistedRelayReady,
    persistError,
  } = useRelayUserState<RelayPersistedState>({
    userId: defaultUserId,
    key: 'workspace-state',
    defaults: persistedDefaults,
  });
  const hasHydratedPersistedState = useRef(false);

  const graphRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!persistedRelayReady || hasHydratedPersistedState.current) return;
    setPosts(persistedRelayState.posts);
    setCommentReplies(persistedRelayState.commentReplies);
    setLessonProgress(persistedRelayState.lessonProgress);
    setAdaptiveHistory(persistedRelayState.adaptiveHistory);
    setJoinedChallenges(persistedRelayState.joinedChallenges);
    setSkillNodes(persistedRelayState.skillNodes);
    setWeekProgress(persistedRelayState.weekProgress);
    setXpEvents(persistedRelayState.xpEvents || []);
    setLastActiveDate(persistedRelayState.lastActiveDate || '');
    hasHydratedPersistedState.current = true;
  }, [persistedRelayReady, persistedRelayState]);

  useEffect(() => {
    if (!hasHydratedPersistedState.current) return;
    updatePersistedRelayState({
      posts,
      commentReplies,
      lessonProgress,
      adaptiveHistory,
      joinedChallenges,
      skillNodes,
      weekProgress,
      xpEvents,
      lastActiveDate,
    });
  }, [posts, commentReplies, lessonProgress, adaptiveHistory, joinedChallenges, skillNodes, weekProgress, xpEvents, lastActiveDate, updatePersistedRelayState]);

  useEffect(() => {
    if (!persistError) return;
    setError((prev) => prev || `Persistence warning: ${persistError}`);
  }, [persistError]);

  // ── XP fully derived from persisted events ──
  const xp = xpEvents.reduce((sum, e) => sum + e.xp, 0);
  const level = Math.max(1, Math.floor(xp / 140));
  const streakCount = weekProgress.filter(Boolean).length;

  const pushXpEvent = useCallback((type: XpEvent['type'], xpValue: number, detail?: string) => {
    const event: XpEvent = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      xp: xpValue,
      timestamp: new Date().toISOString(),
      detail,
    };
    setXpEvents((prev) => [event, ...prev].slice(0, 500)); // cap at 500 events

    // Mark today as active for streak
    const today = todayISO();
    const dayIndex = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
    // weekProgress is [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    const idx = dayIndex === 0 ? 6 : dayIndex - 1;
    setWeekProgress((prev) => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    setLastActiveDate(today);
  }, []);
  const leaderboard = leagueView === 'weekly' ? LEADERBOARD_WEEKLY : LEADERBOARD_ALL_TIME;

  const pushTurn = (role: Turn['role'], text: string) => {
    setTurns((prev) => [...prev, { role, text, timestamp: new Date().toISOString() }]);
  };

  const currentAdaptiveQuestion = adaptiveQueue[0] || null;

  const buildSkillProfile = useCallback((): SkillProfilePayload => {
    const readLesson = (name: string) => lessonProgress[name] ?? 0;
    const readNode = (nodeId: string, fallback = 0) => skillNodes.find((node) => node.id === nodeId)?.mastery ?? fallback;

    return {
      voltage_basics: readLesson('Voltage Basics'),
      current_flow: readLesson('Current Flow Intuition'),
      breadboard: readLesson('Breadboard Confidence Drill'),
      sensors: readLesson('Sensor Signal Sanity Checks'),
      resistors: readNode('resistance', 35),
      leds: readNode('logic', 35),
      arduino_code: readNode('logic', 30),
      circuit_design: readNode('logic', 30),
    };
  }, [lessonProgress, skillNodes]);

  // ── Drawing exercise ──

  const DRAW_EXERCISES = [
    { type: 'draw_circuit' as const, title: 'Draw a voltage divider', expected: ['resistor', 'resistor', 'power_source', 'ground'], hint: 'Two resistors in series between 5V and GND, with the output taken from the middle node.' },
    { type: 'draw_circuit' as const, title: 'Draw an LED circuit', expected: ['led', 'resistor', 'power_source', 'ground'], hint: 'An LED in series with a current-limiting resistor, connected to a power source.' },
    { type: 'circle_component' as const, title: 'Circle the LDR in this circuit', expected: ['ldr'], hint: 'The LDR (light-dependent resistor) looks like a resistor with arrows pointing at it.' },
    { type: 'draw_circuit' as const, title: 'Draw the Light-Activated Alarm circuit', expected: ['ldr', 'resistor', 'led', 'arduino', 'buzzer'], hint: 'Voltage divider (LDR + 10k resistor) feeding Arduino A0. LED/buzzer on a digital pin.' },
  ];

  const [currentDrawExercise, setCurrentDrawExercise] = useState(0);

  const initDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = dark ? '#1a1a2e' : '#ffffff';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    // Grid dots
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    for (let x = 20; x < canvas.offsetWidth; x += 20) {
      for (let y = 20; y < canvas.offsetHeight; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [dark]);

  const startDrawExercise = () => {
    setDrawExerciseActive(true);
    setDrawExerciseFeedback(null);
    setDrawExerciseLoading(false);
    setTimeout(initDrawCanvas, 100);
  };

  const clearDrawCanvas = () => {
    setDrawExerciseFeedback(null);
    initDrawCanvas();
  };

  const submitDrawing = async () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    setDrawExerciseLoading(true);
    setDrawExerciseFeedback(null);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const exercise = DRAW_EXERCISES[currentDrawExercise];
      const result = await assessDrawing(quizApiRoot, {
        image_base64: base64,
        expected_components: exercise.expected,
        exercise_type: exercise.type,
      });
      setDrawExerciseFeedback({
        correct: result.correct,
        feedback: result.feedback,
        components: result.identified_components,
        confidence: result.confidence,
      });
      pushXpEvent(result.correct ? 'quiz_correct' : 'quiz_incorrect', result.correct ? 15 : 3, 'drawing_exercise');
      // Update mastery
      setSkillNodes((prev) =>
        prev.map((node) =>
          node.id === 'logic'
            ? { ...node, mastery: clamp(node.mastery + (result.correct ? 5 : 1), 0, 100) }
            : node
        )
      );
    } catch (err) {
      setDrawExerciseFeedback({
        correct: false,
        feedback: err instanceof Error ? err.message : 'Failed to assess drawing.',
        components: [],
        confidence: 0,
      });
    } finally {
      setDrawExerciseLoading(false);
    }
  };

  // Canvas drawing handlers
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasPos(e);
  };

  const onDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPosRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.strokeStyle = drawIsEraser ? (dark ? '#1a1a2e' : '#ffffff') : drawPenColor;
    ctx.lineWidth = drawIsEraser ? 16 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();
    lastPosRef.current = pos;
  };

  const onDrawEnd = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const startAdaptiveDrill = async () => {
    setAdaptiveLoading(true);
    setAdaptiveError('');
    try {
      const response = await generateQuizQuestions(quizApiRoot, {
        skill_profile: buildSkillProfile(),
        count: 5,
        allowed_types: ['multiple_choice', 'true_false', 'fill_blank'],
      });
      const supportedTypes = new Set(['multiple_choice', 'true_false', 'fill_blank']);
      const queue: AdaptiveQueueItem[] = response.questions
        .filter((q) => supportedTypes.has(q.type))
        .map((question, index) => ({
          ...question,
          id: `adaptive-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        }));
      setAdaptiveMeta({
        recommendedTopic: response.recommended_topic,
        skillGaps: response.skill_gaps,
      });
      setAdaptiveQueue(queue);
      if (!queue.length) {
        setAdaptiveError('No compatible question types were generated. Try again.');
      }
    } catch (err) {
      setAdaptiveError(err instanceof Error ? err.message : 'Could not generate adaptive questions.');
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const evaluateAdaptiveAnswer = (question: AdaptiveQueueItem) => {
    if (question.type === 'multiple_choice') {
      if (adaptiveSelectedOption === null) {
        setAdaptiveError('Select an option first.');
        return;
      }
      const options = question.options || [];
      const correctIndex = options.findIndex((opt) => opt.is_correct);
      const picked = options[adaptiveSelectedOption]?.text || '';
      const correct = adaptiveSelectedOption === correctIndex;
      setAdaptiveResult({ correct, answerGiven: picked });
      setAdaptiveFeedback({ correct, message: question.explanation });
      return;
    }

    if (question.type === 'true_false') {
      if (adaptiveSelectedOption === null) {
        setAdaptiveError('Choose True or False first.');
        return;
      }
      const picked = adaptiveSelectedOption === 0 ? 'true' : 'false';
      const expected = (question.correct_answer || '').trim().toLowerCase();
      const correct = picked === expected;
      setAdaptiveResult({ correct, answerGiven: picked });
      setAdaptiveFeedback({ correct, message: question.explanation });
      return;
    }

    if (question.type === 'fill_blank') {
      const picked = adaptiveTypedAnswer.trim();
      if (!picked) {
        setAdaptiveError('Type your answer first.');
        return;
      }
      const expected = (question.correct_answer || '').trim().toLowerCase();
      const correct = picked.toLowerCase() === expected;
      setAdaptiveResult({ correct, answerGiven: picked });
      setAdaptiveFeedback({ correct, message: question.explanation });
      return;
    }

    setAdaptiveError(`Unsupported adaptive question type: ${question.type}`);
  };

  const continueAdaptiveQuestion = () => {
    if (!currentAdaptiveQuestion || !adaptiveResult) return;
    const topicToLesson: Record<string, string> = {
      voltage_basics: 'Voltage Basics',
      current_flow: 'Current Flow Intuition',
      breadboard: 'Breadboard Confidence Drill',
      sensors: 'Sensor Signal Sanity Checks',
      resistors: 'Current Flow Intuition',
      leds: 'Current Flow Intuition',
      arduino_code: 'Sensor Signal Sanity Checks',
      circuit_design: 'Sensor Signal Sanity Checks',
    };
    const topicToNode: Record<string, string> = {
      voltage_basics: 'voltage',
      current_flow: 'current',
      breadboard: 'breadboard',
      sensors: 'sensors',
      resistors: 'resistance',
      leds: 'logic',
      arduino_code: 'logic',
      circuit_design: 'logic',
    };

    setAdaptiveHistory((prev) => [
      {
        id: `${currentAdaptiveQuestion.id}-history`,
        question: currentAdaptiveQuestion.question,
        topic: currentAdaptiveQuestion.topic,
        type: currentAdaptiveQuestion.type,
        correct: adaptiveResult.correct,
        answerGiven: adaptiveResult.answerGiven,
        explanation: currentAdaptiveQuestion.explanation,
        answeredAt: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 120));

    // Fire XP event for quiz answer
    pushXpEvent(
      adaptiveResult.correct ? 'quiz_correct' : 'quiz_incorrect',
      adaptiveResult.correct ? 10 : 2,
      currentAdaptiveQuestion.topic,
    );

    if (adaptiveResult.correct) {
      const lessonKey = topicToLesson[currentAdaptiveQuestion.topic];
      if (lessonKey) {
        setLessonProgress((prev) => ({
          ...prev,
          [lessonKey]: clamp((prev[lessonKey] || 0) + 4, 0, 100),
        }));
      }
      const nodeKey = topicToNode[currentAdaptiveQuestion.topic];
      if (nodeKey) {
        setSkillNodes((prev) =>
          prev.map((node) => (
            node.id === nodeKey
              ? { ...node, mastery: clamp(node.mastery + 3, 0, 100) }
              : node
          ))
        );
      }
    }

    setAdaptiveQueue((prev) => {
      const [head, ...rest] = prev;
      if (!head) return prev;
      if (adaptiveResult.correct) return rest;
      return [
        ...rest,
        { ...head, id: `${head.id}-retry-${Date.now()}` },
      ];
    });
  };

  useEffect(() => {
    setAdaptiveError('');
    setAdaptiveFeedback(null);
    setAdaptiveResult(null);
    setAdaptiveSelectedOption(null);
    setAdaptiveTypedAnswer('');
  }, [currentAdaptiveQuestion?.id]);

  // ── Lesson helpers ──
  const startLesson = (lesson: { title: string; desc: string; progress: number; color: string; time: string }) => {
    setActiveLesson(lesson);
    setLessonStep(0);
    setLessonAnswer(null);
    setLessonAnswered(false);
    setLessonCorrect(null);
    setLessonHearts(3);
    setLessonComplete(false);
    setMatchedPairs(new Set());
    setMatchSelected(null);
    setDragItems([]);
    setDragCorrect(null);
    setSpotErrorRegion(null);
    setDrawingComplete(false);
    // Shuffle right-side for first match step if needed
    const content = LESSON_CONTENT[lesson.title];
    if (content) {
      const firstMatch = content.steps.find(s => s.type === 'match');
      if (firstMatch && firstMatch.type === 'match') {
        setMatchShuffledRight(firstMatch.pairs.map((_, i) => i).sort(() => Math.random() - 0.5));
      }
      // Shuffle drag items for first drag_order step
      const firstDrag = content.steps.find(s => s.type === 'drag_order');
      if (firstDrag && firstDrag.type === 'drag_order') {
        setDragItems(firstDrag.items.map((_, i) => i).sort(() => Math.random() - 0.5));
      }
    }
  };

  const advanceLessonStep = () => {
    if (!activeLesson) return;
    const content = LESSON_CONTENT[activeLesson.title];
    if (!content) return;
    const nextStep = lessonStep + 1;
    if (nextStep >= content.steps.length) {
      setLessonComplete(true);
      setLessonProgress(prev => ({ ...prev, [activeLesson.title]: 100 }));
      pushXpEvent('lesson_completed', 25, activeLesson.title);
    } else {
      setLessonStep(nextStep);
      setLessonAnswer(null);
      setLessonAnswered(false);
      setLessonCorrect(null);
      setMatchedPairs(new Set());
      setMatchSelected(null);
      setDragCorrect(null);
      setSpotErrorRegion(null);
      setDrawingComplete(false);
      const next = content.steps[nextStep];
      if (next.type === 'match') {
        setMatchShuffledRight(next.pairs.map((_, i) => i).sort(() => Math.random() - 0.5));
      }
      if (next.type === 'drag_order') {
        setDragItems(next.items.map((_, i) => i).sort(() => Math.random() - 0.5));
      }
    }
    const progress = Math.round(((nextStep) / content.steps.length) * 100);
    setLessonProgress(prev => ({ ...prev, [activeLesson.title]: Math.min(progress, prev[activeLesson.title] || 0 > progress ? prev[activeLesson.title] : progress) }));
  };

  const checkLessonAnswer = (step: LessonStep, answer: string | number | boolean) => {
    let correct = false;
    if (step.type === 'multiple_choice') correct = answer === step.correct;
    else if (step.type === 'true_false') correct = answer === step.correct;
    else if (step.type === 'fill_blank') correct = String(answer).trim().toLowerCase() === step.answer.toLowerCase();
    setLessonAnswered(true);
    setLessonCorrect(correct);
    if (!correct) setLessonHearts(h => Math.max(0, h - 1));
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // Sync live bridge transcripts into chat turns
  const lastSyncedCount = useRef(0);
  useEffect(() => {
    if (live.transcripts.length > lastSyncedCount.current) {
      const newItems = live.transcripts.slice(lastSyncedCount.current);
      lastSyncedCount.current = live.transcripts.length;
      setTurns((prev) => [
        ...prev,
        ...newItems.map((t) => ({
          role: (t.role === 'user' ? 'you' : t.role === 'agent' ? 'relay' : 'system') as Turn['role'],
          text: t.text,
          timestamp: t.timestamp,
        })),
      ]);
    }
  }, [live.transcripts]);

  const checkConnection = async () => {
    setConnection('checking');
    try {
      const res = await fetch(`${apiRoot}/health`);
      if (!res.ok) throw new Error('Health check failed');
      setConnection('online');
    } catch {
      setConnection('offline');
    }
  };

  // Sync WS state to connection indicator
  useEffect(() => {
    if (live.state === 'connected') setConnection('online');
    else if (live.state === 'error') setConnection('offline');
  }, [live.state]);

  useEffect(() => { checkConnection(); }, []);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const res = await fetch(`${apiRoot}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: defaultUserId, initial_stage: focusStage }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Could not start session: ${res.status} ${body}`);
    }
    const payload: SessionCreateResponse = await res.json();
    setSessionId(payload.session_id);
    pushTurn('system', `Session started. Relay is ready to guide ${focusStage}.`);
    return payload.session_id;
  };

  const startSession = async () => {
    setError('');
    setBusy(true);
    try {
      // Connect via WebSocket for live streaming
      live.connect();
      setSessionId(liveSessionId);
      setConnection('online');
      pushXpEvent('session_started', 15, 'live');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start session.');
    } finally {
      setBusy(false);
    }
  };

  const startSimulation = async () => {
    setError('');
    setBusy(true);
    setSimMode(true);
    setFocusStage('inventory');
    try {
      live.connect();
      setSessionId(liveSessionId);
      setConnection('online');
      // Wait briefly for WS to connect, then send the demo prompt
      setTimeout(() => {
        live.sendText(
          `[SIMULATION MODE] You are being evaluated by a hackathon judge who does not have Arduino hardware. ` +
          `Run a guided demo of the Light-Activated Alarm build. Walk through each stage (inventory, wiring, code, run, report) conversationally. ` +
          `Since the judge has no components, ask them to hold up everyday objects (pen, phone, hand, etc.) to the camera so you can demonstrate your vision capabilities by identifying what you see. ` +
          `Keep responses short and spoken naturally. Start by greeting the judge, explaining you're in demo mode, and asking them to turn on their camera so you can show what you can do.`,
          'inventory'
        );
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start simulation.');
      setSimMode(false);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) { setError('Type a message first.'); return; }
    const text = message.trim();
    setMessage('');
    setError('');

    // If WebSocket is connected, send via live bridge
    if (live.state === 'connected') {
      live.sendText(text, focusStage);
      return;
    }

    // Fallback: REST text endpoint on live-bridge
    pushTurn('you', text);
    setBusy(true);
    try {
      const res = await fetch(`${apiRoot}/v1/live/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: defaultUserId,
          session_id: liveSessionId,
          stage: focusStage,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Relay request failed: ${res.status} ${body}`);
      }
      const payload = await res.json();
      pushTurn('relay', payload.reply);
      setConnection('online');
    } catch (err) {
      setConnection('offline');
      setError(err instanceof Error ? err.message : 'Relay request failed.');
    } finally {
      setBusy(false);
    }
  };

  const togglePostLike = (postId: string) => {
    setLikeAnimating(postId);
    setTimeout(() => setLikeAnimating(null), 350);
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const nextLiked = !post.liked;
        return { ...post, liked: nextLiked, likes: nextLiked ? post.likes + 1 : post.likes - 1 };
      })
    );
  };

  const toggleChallenge = (id: string) => {
    setJoinedChallenges((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const beginNodeDrag = (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => {
    const root = graphRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const node = skillNodes.find((item) => item.id === nodeId);
    if (!node) return;
    const nodeX = rect.left + (node.x / 100) * rect.width;
    const nodeY = rect.top + (node.y / 100) * rect.height;
    dragRef.current = { id: nodeId, offsetX: event.clientX - nodeX, offsetY: event.clientY - nodeY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    const flushDrag = () => {
      dragFrameRef.current = null;
      const drag = dragRef.current;
      const root = graphRef.current;
      const pending = pendingPointerRef.current;
      if (!drag || !root || !pending) return;
      const rect = root.getBoundingClientRect();
      const x = ((pending.x - rect.left - drag.offsetX) / rect.width) * 100;
      const y = ((pending.y - rect.top - drag.offsetY) / rect.height) * 100;
      setSkillNodes((prev) =>
        prev.map((node) => (node.id === drag.id ? { ...node, x: clamp(x, 8, 92), y: clamp(y, 12, 88) } : node))
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const root = graphRef.current;
      if (!drag || !root) return;
      pendingPointerRef.current = { x: event.clientX, y: event.clientY };
      if (dragFrameRef.current === null) {
        dragFrameRef.current = window.requestAnimationFrame(flushDrag);
      }
    };
    const onPointerUp = () => {
      dragRef.current = null;
      pendingPointerRef.current = null;
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, []);

  const nodeById = useMemo(
    () => Object.fromEntries(skillNodes.map((node) => [node.id, node])) as Record<string, SkillNode>,
    [skillNodes]
  );

  const graphEdges: Array<[string, string]> = [
    ['resistance', 'current'],
    ['current', 'voltage'],
    ['resistance', 'breadboard'],
    ['breadboard', 'sensors'],
    ['sensors', 'logic'],
    ['voltage', 'logic'],
  ];

  // Notify live bridge when stage changes
  useEffect(() => {
    if (live.state === 'connected') {
      live.sendStageUpdate(focusStage);
    }
  }, [focusStage, live.state]);

  // ── Tour spotlight positioning ──
  const measureTarget = useCallback((target: string) => {
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) { setSpotlightRect(null); return; }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    // Cap height so huge elements (like library grid) don't push popover off screen
    const maxH = window.innerHeight * 0.5;
    setSpotlightRect({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: Math.min(rect.height + pad * 2, maxH),
    });
  }, []);

  useEffect(() => {
    if (!tourOpen) { setSpotlightRect(null); return; }
    const step = TOUR_STEPS[tourStep];
    if (!step) return;

    // Switch tab if the step requires it
    if (step.tab && step.tab !== activeTab) {
      setActiveTab(step.tab);
    }

    // Single short delay to let tab render, then measure
    const timer = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        // Measure immediately after scroll
        requestAnimationFrame(() => measureTarget(step.target));
      }, 50);
    });

    return () => cancelAnimationFrame(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, tourStep, activeTab, measureTarget]);

  // Recalculate spotlight on resize
  useEffect(() => {
    if (!tourOpen) return;
    const recalc = () => measureTarget(TOUR_STEPS[tourStep]?.target);
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [tourOpen, tourStep, measureTarget]);

  const advanceTour = useCallback(() => {
    setTourStep((prev) => {
      if (prev < TOUR_STEPS.length - 1) return prev + 1;
      setTourOpen(false);
      return prev;
    });
  }, []);

  const retreatTour = useCallback(() => {
    setTourStep((prev) => Math.max(0, prev - 1));
  }, []);

  // Keyboard navigation for tour
  useEffect(() => {
    if (!tourOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTourOpen(false);
      if (e.key === 'ArrowRight' || e.key === 'Enter') advanceTour();
      if (e.key === 'ArrowLeft') retreatTour();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOpen, advanceTour, retreatTour]);

  // Compute popover position — smart flip if it would go off screen
  const getPopoverStyle = (): React.CSSProperties => {
    if (!spotlightRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const step = TOUR_STEPS[tourStep];
    const gap = 12;
    const popW = 320;
    const popH = 210;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;

    // Try preferred position, flip if it doesn't fit
    let pos = step.position;
    const spaceBottom = vh - (spotlightRect.top + spotlightRect.height);
    const spaceTop = spotlightRect.top;
    const spaceRight = vw - (spotlightRect.left + spotlightRect.width);
    const spaceLeft = spotlightRect.left;

    if (pos === 'bottom' && spaceBottom < popH + gap) pos = spaceTop > popH + gap ? 'top' : 'right';
    if (pos === 'top' && spaceTop < popH + gap) pos = spaceBottom > popH + gap ? 'bottom' : 'right';
    if (pos === 'right' && spaceRight < popW + gap) pos = spaceLeft > popW + gap ? 'left' : 'bottom';
    if (pos === 'left' && spaceLeft < popW + gap) pos = spaceRight > popW + gap ? 'right' : 'bottom';

    const clampX = (x: number) => Math.max(margin, Math.min(vw - popW - margin, x));
    const clampY = (y: number) => Math.max(margin, Math.min(vh - popH - margin, y));

    switch (pos) {
      case 'bottom':
        return { top: clampY(spotlightRect.top + spotlightRect.height + gap), left: clampX(spotlightRect.left + spotlightRect.width / 2 - popW / 2) };
      case 'top':
        return { top: clampY(spotlightRect.top - popH - gap), left: clampX(spotlightRect.left + spotlightRect.width / 2 - popW / 2) };
      case 'right':
        return { top: clampY(spotlightRect.top + spotlightRect.height / 2 - popH / 2), left: clampX(spotlightRect.left + spotlightRect.width + gap) };
      case 'left':
        return { top: clampY(spotlightRect.top + spotlightRect.height / 2 - popH / 2), left: clampX(spotlightRect.left - popW - gap) };
      default:
        return { top: clampY(spotlightRect.top + spotlightRect.height + gap), left: clampX(spotlightRect.left) };
    }
  };

  const currentStepIndex = FOCUS_STEPS.findIndex((s) => s.stage === focusStage);

  /* ─── RENDER ─── */
  return (
    <div className={`h-screen transition-colors duration-300 ${t.pageBg} ${t.pageText}`}>
      <div className="flex h-full">
        {/* ═══ SIDEBAR ═══ */}
        <aside className={`hidden lg:flex w-[272px] shrink-0 flex-col overflow-y-auto transition-colors duration-300 ${t.sidebarBg} ${t.sidebarText} border-r ${t.sidebarBorder}`}>
          {/* Logo + back */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <button type="button" onClick={onBackToLanding} className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e515] text-sm font-black text-black transition-transform group-hover:scale-105">
                R
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${t.sidebarMuted}`}>Relay</p>
                <p className="text-base font-black tracking-tight">Studio</p>
              </div>
            </button>
            <button
              type="button"
              onClick={onBackToLanding}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${dark ? 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Nav tabs */}
          <nav data-tour="tour-sidebar-nav" className="mt-2 space-y-1 px-3">
            {APP_TABS.map((tab) => {
              const active = tab.id === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
                    active ? t.sidebarNavActive : t.sidebarNavInactive
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Streak card */}
          <div data-tour="tour-streak" className={`mx-3 mt-5 rounded-2xl p-4 ${t.sidebarCardBg}`}>
            <div className="flex items-center gap-3">
              <div className="relay-streak-flame">
                <Flame className="h-7 w-7 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{streakCount}</p>
                <p className={`text-[11px] font-semibold ${t.sidebarCardMuted}`}>day streak</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {weekProgress.map((done, idx) => (
                <div
                  key={idx}
                  className={`flex h-9 items-center justify-center rounded-lg text-[11px] font-black ${
                    done ? t.sidebarStreakOn : t.sidebarStreakOff
                  }`}
                >
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'][idx]}
                </div>
              ))}
            </div>
          </div>

          {/* League card */}
          <div data-tour="tour-xp" className={`mx-3 mt-3 rounded-2xl p-4 ${t.sidebarCardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <p className={`text-xs font-bold ${t.sidebarCardMuted}`}>{levelName(level)} League</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${t.sidebarLeagueBadge}`}>Lv {level}</span>
            </div>
            <p className="mt-2 text-xl font-black">{xp} <span className={`text-sm font-bold ${t.sidebarXpText}`}>XP</span></p>
            <div className={`mt-2 h-2 overflow-hidden rounded-full ${t.sidebarXpBar}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f3e515] to-[#f59e0b] transition-all duration-500"
                style={{ width: `${clamp((xp % 1400) / 14, 5, 100)}%` }}
              />
            </div>
            <p className={`mt-1.5 text-[10px] ${t.sidebarXpText}`}>{1400 - (xp % 1400)} XP to next level</p>
          </div>

          {/* XP Breakdown */}
          <div className={`mx-3 mt-3 rounded-2xl p-4 ${t.sidebarCardBg}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${t.sidebarCardMuted}`}>How you earn XP</p>
            <div className="mt-2 space-y-1.5">
              {XP_ACTIONS.slice(0, 4).map((a) => (
                <div key={a.action} className="flex items-center justify-between">
                  <span className={`flex items-center gap-2 text-[11px] ${dark ? 'text-white/60' : 'text-slate-500'}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${dark ? 'bg-white/[0.06] text-white/70' : 'bg-slate-100 text-slate-500'}`}>
                      <a.icon className="h-3.5 w-3.5" />
                    </span>
                    {a.action}
                  </span>
                  <span className="text-[10px] font-bold text-[#f3e515]">+{a.xp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profile button */}
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className={`mx-3 mt-3 flex items-center gap-3 rounded-2xl p-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${t.sidebarCardBg}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f3e515] to-[#f59e0b] text-sm font-black text-black">
              F
            </div>
            <div className="text-left">
              <p className="text-sm font-black">faith</p>
              <p className={`text-[10px] ${t.sidebarCardMuted}`}>{ACHIEVEMENTS.filter(a => a.earned).length}/{ACHIEVEMENTS.length} achievements</p>
            </div>
            <ChevronRight className={`ml-auto h-4 w-4 ${dark ? 'text-white/30' : 'text-slate-300'}`} />
          </button>

          {/* Connection status */}
          <div className={`mx-3 mt-3 mb-4 rounded-full px-3 py-2 ${dark ? 'bg-white/5' : 'bg-slate-50 ring-1 ring-slate-200/80'}`}>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  connection === 'online' ? 'bg-emerald-400 relay-pulse-glow' : connection === 'offline' ? 'bg-rose-400' : 'bg-amber-400'
                }`}
              />
              <p className={`text-[11px] font-semibold ${t.sidebarConnText}`}>
                {connection === 'online' ? 'Backend connected' : connection === 'offline' ? 'Backend offline' : 'Checking...'}
              </p>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className={`flex items-center justify-between px-5 py-3 transition-colors duration-300 ${t.headerBg}`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToLanding}
                className={`flex lg:hidden h-9 w-9 items-center justify-center rounded-lg ${t.headerBtnBg}`}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className={`text-xl font-black tracking-tight ${t.headerTitle}`}>
                  {activeTab === 'build' && 'Build Studio'}
                  {activeTab === 'learn' && 'Learning Lab'}
                  {activeTab === 'sandbox' && 'Sandbox'}
                  {activeTab === 'community' && 'Community'}
                  {activeTab === 'library' && 'Project Library'}
                </h1>
                <p className={`text-xs font-medium ${t.headerSub}`}>
                  {activeTab === 'build' && 'Live guidance for your current build'}
                  {activeTab === 'learn' && 'Track concepts and master electronics'}
                  {activeTab === 'sandbox' && '3D breadboard playground — build and simulate'}
                  {activeTab === 'community' && 'Compete, share, and learn together'}
                  {activeTab === 'library' && 'Pick your next project'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile tabs */}
              <div className={`flex lg:hidden gap-1 rounded-xl p-1 ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
                {APP_TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-lg p-2 transition-all ${active ? 'bg-[#f3e515] text-black shadow-sm' : dark ? 'text-white/40' : 'text-slate-400'}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={checkConnection}
                className={`hidden sm:flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${t.headerBtnBg}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync
              </button>
              {/* Dark/Light mode toggle */}
              <button
                type="button"
                onClick={() => setDark((prev) => !prev)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${t.headerBtnBg}`}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => { setTourStep(0); setTourOpen(true); }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${t.headerTourBg}`}
              >
                <GraduationCap className="h-4 w-4" />
                Tour
              </button>
            </div>
          </header>

          {error && (
            <div className={`mx-5 mt-3 relay-fade-in flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${t.errorBg}`}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
              <button type="button" onClick={() => setError('')} className={`ml-auto ${t.errorClose}`}><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
            {/* ═══ BUILD TAB ═══ */}
            {activeTab === 'build' && (
              <div className="relay-fade-in space-y-5">
                {/* Active build context */}
                {activeBuild && (
                  <div className={`relay-fade-in flex items-center gap-4 rounded-xl p-4 ${dark ? 'bg-white/[0.04] ring-1 ring-white/10' : 'bg-slate-50 ring-1 ring-slate-200/80'}`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: activeBuild.color }}>
                      <activeBuild.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{activeBuild.title}</p>
                      <p className={`text-[11px] mt-0.5 ${dark ? 'text-white/40' : 'text-slate-400'}`}>{activeBuild.desc} · <span className="font-bold">{activeBuild.est}</span></p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeBuild.parts.map((part) => (
                          <span key={part} className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${dark ? 'bg-white/5 text-white/40' : 'bg-white text-slate-500'}`}>{part}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setActiveBuild(null); setActiveTab('library'); }}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold ${dark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    >
                      Change
                    </button>
                  </div>
                )}
                {/* 3D Preview for Light-Activated Alarm */}
                {activeBuild?.title === 'Light-Activated Alarm' && (
                  <div className={`overflow-hidden rounded-xl ${dark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200/80'}`}>
                    <SceneErrorBoundary
                      fallback={
                        <div className={`flex h-[220px] flex-col items-center justify-center gap-2 text-center px-4 ${dark ? 'bg-white/[0.03] text-white/50' : 'bg-slate-50 text-slate-500'}`}>
                          <p className="text-xs font-bold uppercase tracking-wider">3D preview unavailable</p>
                          <p className="text-[11px]">Your build still works. Continue in Build mode while we recover the preview renderer.</p>
                        </div>
                      }
                    >
                      <React.Suspense fallback={<div className="flex h-[220px] items-center justify-center text-xs text-slate-400">Loading 3D preview...</div>}>
                        <SandboxScene
                          className="h-[220px] w-full"
                          components={SANDBOX_PRESETS['Light-Activated Alarm']?.components || []}
                          selectedTool="select"
                          onPlaceComponent={() => {}}
                          onRemoveComponent={() => {}}
                          onStartWire={() => {}}
                          onEndWire={() => {}}
                          onSelectEntity={() => {}}
                          onMoveEntity={() => {}}
                          onMoveSelectedEntity={() => {}}
                          wireStart={null}
                          selectedEntity={null}
                          simState={{ running: false, ledStates: {}, buzzerOn: false, serialOutput: [], analogValues: {} }}
                          cameraPreset="fit"
                          cameraTick={0}
                        />
                      </React.Suspense>
                    </SceneErrorBoundary>
                    <div className={`flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold ${dark ? 'bg-white/[0.03] text-white/30' : 'bg-slate-50 text-slate-400'}`}>
                      <RefreshCw className="h-3 w-3" /> Drag to rotate · Scroll to zoom
                    </div>
                  </div>
                )}

                {/* Build pipeline steps */}
                <div data-tour="tour-build-pipeline" className="flex items-center gap-1 overflow-x-auto pb-1">
                  {FOCUS_STEPS.map((step, idx) => {
                    const active = step.stage === focusStage;
                    const completed = idx < currentStepIndex;
                    const Icon = step.icon;
                    return (
                      <React.Fragment key={step.label}>
                        {idx > 0 && (
                          <div className={`h-0.5 w-6 shrink-0 rounded-full transition-colors ${completed ? t.pipelineLineDone : t.pipelineLine}`} />
                        )}
                        <button
                          type="button"
                          disabled={!step.unlocked}
                          onClick={() => step.unlocked && setFocusStage(step.stage)}
                          className={`group flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                            active
                              ? t.pipelineActive
                              : completed
                              ? t.pipelineCompleted
                              : step.unlocked
                              ? t.pipelineDefault
                              : t.pipelineLocked
                          }`}
                        >
                          {completed ? (
                            <CheckCircle2 className={`h-4 w-4 ${dark ? 'text-[#f3e515]' : 'text-[#0a0a0a]'}`} />
                          ) : (
                            <Icon className={`h-4 w-4 ${active ? (dark ? 'text-[#0a0a0a]' : 'text-[#f3e515]') : ''}`} />
                          )}
                          <span className="hidden sm:inline">{step.label}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Simulation mode banner */}
                {simMode && live.state === 'connected' && (
                  <div className={`relay-fade-in flex items-center gap-3 rounded-xl px-4 py-3 ${
                    dark ? 'bg-[#f3e515]/10 ring-1 ring-[#f3e515]/20' : 'bg-[#f3e515]/15 ring-1 ring-[#f3e515]/30'
                  }`}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f3e515] text-black">
                      <Gamepad2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black ${dark ? 'text-[#f3e515]' : 'text-[#0a0a0a]'}`}>Demo Mode Active</p>
                      <p className={`text-[11px] ${dark ? 'text-white/50' : 'text-slate-500'}`}>
                        No hardware needed. Turn on your camera and hold up any object — Relay will identify it in real time.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSimMode(false); live.disconnect(); }}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        dark ? 'bg-white/10 text-white/60 hover:bg-white/15' : 'bg-black/5 text-slate-500 hover:bg-black/10'
                      }`}
                    >
                      Exit Demo
                    </button>
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
                  {/* Camera — the HERO (dominates left side) */}
                  <section data-tour="tour-camera" className={`group relative overflow-hidden rounded-2xl transition-colors duration-300 ${t.cameraBg}`}>
                    <div className="relative flex aspect-[4/3] min-h-[420px] items-center justify-center">
                      {/* Live video feed */}
                      <video
                        ref={live.videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 -scale-x-100 ${live.camOn ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      />

                      {/* Placeholder (shown when cam is off) */}
                      {!live.camOn && (
                        <>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(243,229,21,0.06),transparent_70%)]" />
                          <div className="relative text-center px-6">
                            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${t.cameraIconRing}`}>
                              <Camera className={`h-9 w-9 ${t.cameraIcon}`} />
                            </div>
                            <p className={`text-lg font-black ${t.cameraText}`}>Camera Feed</p>
                            <p className={`mt-1 text-sm ${dark ? 'text-white/50' : 'text-slate-500'}`}>Point your webcam at the breadboard to begin</p>
                            {live.state !== 'connected' && (
                              <div className="mt-6 flex flex-col items-center gap-3">
                                <button
                                  type="button"
                                  onClick={startSession}
                                  disabled={busy || live.state === 'connecting'}
                                  className="relay-pulse-glow inline-flex items-center gap-2 rounded-full bg-[#f3e515] px-6 py-3 text-sm font-black text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                                >
                                  <PlayCircle className="h-5 w-5" />
                                  {live.state === 'connecting' ? 'Connecting...' : sessionId ? 'Resume Session' : 'Start Live Session'}
                                </button>

                                <div className={`flex items-center gap-3 ${t.cameraSub}`}>
                                  <div className={`h-px w-8 ${dark ? 'bg-white/10' : 'bg-slate-200'}`} />
                                  <span className="text-[11px] font-semibold uppercase tracking-wider">or</span>
                                  <div className={`h-px w-8 ${dark ? 'bg-white/10' : 'bg-slate-200'}`} />
                                </div>

                                <button
                                  type="button"
                                  onClick={startSimulation}
                                  disabled={busy || live.state === 'connecting'}
                                  className={`group inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-60 ${
                                    dark
                                      ? 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15'
                                      : 'bg-[#0a0a0a] text-[#f3e515] shadow-lg hover:bg-[#1a1a1a]'
                                  }`}
                                >
                                  <Gamepad2 className="h-5 w-5" />
                                  Demo Mode
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                                    dark ? 'bg-[#f3e515]/20 text-[#f3e515]' : 'bg-[#f3e515]/30 text-[#0a0a0a]'
                                  }`}>
                                    No hardware needed
                                  </span>
                                </button>
                                <p className={`max-w-xs text-[11px] leading-relaxed ${dark ? 'text-white/50' : 'text-slate-500'}`}>
                                  Try Demo Mode to experience the full build flow without electronics components. Hold up any object to see Relay's live vision.
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Live controls overlay */}
                      {live.state === 'connected' && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-2 py-1.5 backdrop-blur-md bg-black/30">
                          <button
                            type="button"
                            onClick={live.toggleMic}
                            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 ${
                              live.micOn
                                ? 'bg-[#f3e515] text-black shadow-lg shadow-[#f3e515]/30'
                                : 'bg-white/15 text-white/80 hover:bg-white/25'
                            }`}
                            aria-label={live.micOn ? 'Mute microphone' : 'Unmute microphone'}
                          >
                            {live.micOn ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={live.toggleCam}
                            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 ${
                              live.camOn
                                ? 'bg-[#f3e515] text-black shadow-lg shadow-[#f3e515]/30'
                                : 'bg-white/15 text-white/80 hover:bg-white/25'
                            }`}
                            aria-label={live.camOn ? 'Turn off camera' : 'Turn on camera'}
                          >
                            {live.camOn ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
                          </button>
                          <div className="mx-1 h-6 w-px bg-white/20" />
                          <button
                            type="button"
                            onClick={() => { live.disconnect(); setSimMode(false); }}
                            className="flex h-10 items-center gap-1.5 rounded-full bg-rose-500/80 px-4 text-sm font-bold text-white transition-all hover:bg-rose-500 active:scale-95"
                          >
                            <X className="h-4 w-4" />
                            End
                          </button>
                        </div>
                      )}

                      {/* Status badge */}
                      <div className={`absolute right-4 top-4 flex items-center gap-2 rounded-full px-3 py-1.5 ${t.cameraBadge}`}>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            live.state === 'connected' ? 'bg-emerald-400 relay-pulse-glow' : connection === 'online' ? 'bg-emerald-400' : connection === 'offline' ? 'bg-rose-400' : 'bg-amber-400'
                          }`}
                        />
                        <span className={`text-[11px] font-bold ${t.cameraBadgeText}`}>
                          {live.state === 'connected' ? (simMode ? 'Demo' : live.micOn ? 'Listening' : 'Live') : connection === 'online' ? 'Ready' : connection === 'offline' ? 'Offline' : 'Connecting'}
                        </span>
                      </div>
                      {/* Kit badge */}
                      <div className="absolute top-4 left-4 rounded-full px-3 py-1.5 backdrop-blur-md bg-black/30">
                        <select
                          value={kitProfile}
                          onChange={(e) => setKitProfile(e.target.value)}
                          className="bg-transparent text-[11px] font-bold text-white/80 outline-none"
                        >
                          <option className="bg-[#1a1a1e] text-white">Generic Breadboard Kit</option>
                          <option className="bg-[#1a1a1e] text-white">Arduino Starter Kit</option>
                          <option className="bg-[#1a1a1e] text-white">Custom Components</option>
                          <option className="bg-[#1a1a1e] text-white">Sensor Pack + Breadboard</option>
                        </select>
                      </div>
                    </div>
                    {/* Gemini API session limit notice */}
                    {live.state === 'connected' && (
                      <div className={`relay-fade-in flex items-center gap-2 px-3 py-2 rounded-b-xl -mt-2 text-[10px] ${
                        dark ? 'bg-white/5 text-white/40' : 'bg-slate-50 text-slate-400'
                      }`}>
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>
                          Gemini API session limits: <strong className={dark ? 'text-white/60' : 'text-slate-500'}>15 min audio-only</strong> · <strong className={dark ? 'text-white/60' : 'text-slate-500'}>2 min with video</strong>.
                          {' '}End &amp; restart for fresh limits.
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Right column — Chat assistant (height-locked to camera) */}
                  <div data-tour="tour-chat" className="flex flex-col gap-4 max-h-[calc(100vh-200px)] xl:max-h-none xl:h-0 xl:min-h-full">
                    <section className={`flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                      <div className={`flex items-center justify-between px-4 py-3 ${t.cardHeaderBorder}`}>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${dark ? 'bg-[#f3e515]' : 'bg-[#0a0a0a]'}`}>
                            <Sparkles className={`h-3.5 w-3.5 ${dark ? 'text-[#0a0a0a]' : 'text-[#f3e515]'}`} />
                          </div>
                          <p className={`text-sm font-black ${t.cardTitle}`}>Relay Assistant</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${dark ? 'bg-white/5 text-white/40' : 'bg-slate-100 text-slate-400'}`}>
                          {focusStage}
                        </span>
                      </div>

                      <div className={`relay-chat-scroll flex-1 min-h-0 overflow-y-auto p-4 ${t.chatBg}`}>
                        {turns.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${t.chatEmptyIcon}`}>
                              <MessageSquare className="h-6 w-6" />
                            </div>
                            <p className={`mt-3 text-sm font-bold ${t.chatEmptyText}`}>No messages yet</p>
                            <p className={`mt-1 text-xs ${t.chatEmptySub}`}>Start a session or pick a prompt below</p>
                          </div>
                        ) : (
                          <div className="space-y-3 relay-stagger">
                            {turns.map((turn, idx) => (
                              <div
                                key={`${turn.timestamp}-${idx}`}
                                className={`relay-slide-right flex ${turn.role === 'you' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                                    turn.role === 'you'
                                      ? t.chatYouBubble
                                      : turn.role === 'relay'
                                      ? t.chatRelayBubble
                                      : t.chatSystemBubble
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap font-medium leading-relaxed">{turn.text}</p>
                                  <p className={`mt-1 text-[10px] ${turn.role === 'you' ? t.chatYouTime : t.chatTime}`}>
                                    {prettyTime(turn.timestamp)}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div ref={chatEndRef} />
                          </div>
                        )}
                      </div>

                      {/* Quick prompts */}
                      <div className={`px-4 py-2 ${t.chatInputBorder}`}>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {QUICK_PROMPTS.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => setMessage(prompt)}
                              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${t.chatPromptBg}`}
                            >
                              {prompt.length > 38 ? `${prompt.slice(0, 38)}...` : prompt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Input */}
                      <div className={`flex items-end gap-2 p-3 ${t.chatInputBorder}`}>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                          placeholder="Ask Relay anything..."
                          rows={1}
                          className={`min-h-[40px] flex-1 resize-none rounded-xl border-0 px-3 py-2.5 text-sm font-medium outline-none transition-all ${t.chatInputBg}`}
                        />
                        <button
                          type="button"
                          onClick={sendMessage}
                          disabled={busy}
                          className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-50 ${t.chatSendBg}`}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </section>

                    {/* Serial Monitor — visible during 'run' stage */}
                    {focusStage === 'run' && (
                      <section className={`overflow-hidden rounded-2xl ${dark ? 'bg-[#0a0a0a] ring-1 ring-white/10' : 'bg-[#1a1a2e] ring-1 ring-slate-700/30'}`}>
                        <div className="flex items-center justify-between px-4 py-2.5 bg-black/30">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 relay-pulse-glow" />
                            <span className="text-[11px] font-bold text-emerald-400">Serial Monitor</span>
                          </div>
                          <span className="text-[10px] text-white/30 font-mono">9600 baud</span>
                        </div>
                        <div className="px-4 py-3 font-mono text-[11px] leading-relaxed text-emerald-300/80 max-h-[140px] overflow-y-auto">
                          <p className="text-white/30">--- Relay Serial Monitor ---</p>
                          <SerialOutput />
                        </div>
                      </section>
                    )}

                    {/* Save Twin — visible during 'report' stage */}
                    {focusStage === 'report' && (
                      <section id="twin-export" className={`overflow-hidden rounded-2xl ${dark ? 'bg-white/[0.03] ring-1 ring-white/10' : 'bg-slate-50 ring-1 ring-slate-200'}`}>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Cpu className={`h-4 w-4 ${dark ? 'text-teal-400' : 'text-teal-600'}`} />
                            <span className={`text-[11px] font-black ${dark ? 'text-teal-400' : 'text-teal-700'}`}>3D Digital Twin</span>
                          </div>
                        </div>
                        <SceneErrorBoundary fallback={<div className="h-[200px] flex items-center justify-center text-xs text-slate-400">3D preview unavailable</div>}>
                          <React.Suspense fallback={<div className="h-[200px] flex items-center justify-center text-xs text-slate-400">Loading 3D...</div>}>
                            <SandboxScene
                              className="h-[200px] w-full"
                              components={SANDBOX_PRESETS['Light-Activated Alarm']?.components || []}
                              selectedTool="select"
                              onPlaceComponent={() => {}}
                              onRemoveComponent={() => {}}
                              onStartWire={() => {}}
                              onEndWire={() => {}}
                              onSelectEntity={() => {}}
                              onMoveEntity={() => {}}
                              onMoveSelectedEntity={() => {}}
                              wireStart={null}
                              selectedEntity={null}
                              simState={{ running: false, ledStates: {}, buzzerOn: false, serialOutput: [], analogValues: {} }}
                              cameraPreset="fit"
                              cameraTick={0}
                            />
                          </React.Suspense>
                        </SceneErrorBoundary>
                        <div className="flex items-center gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => {
                              const section = document.getElementById('twin-export');
                              const canvas = section?.querySelector('canvas') as HTMLCanvasElement | null;
                              if (!canvas) return;
                              // Wait one frame so the canvas has rendered content
                              requestAnimationFrame(() => {
                                const link = document.createElement('a');
                                link.download = `relay-twin-${(activeBuild?.title || 'build').replace(/\s+/g, '-').toLowerCase()}.png`;
                                link.href = canvas.toDataURL('image/png');
                                link.click();
                              });
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                              dark ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                            }`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Export as PNG
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSandboxPreset(SANDBOX_PRESETS['Light-Activated Alarm'] || null);
                              setActiveTab('sandbox');
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                              dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <Cpu className="h-3.5 w-3.5" />
                            Open in Sandbox
                          </button>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ LEARN TAB ═══ */}
            {activeTab === 'learn' && activeLesson && LESSON_CONTENT[activeLesson.title] && (() => {
              const content = LESSON_CONTENT[activeLesson.title];
              const step = content.steps[lessonStep];
              const totalSteps = content.steps.length;
              const progressPct = Math.round((lessonStep / totalSteps) * 100);

              // ── Lesson complete screen ──
              if (lessonComplete) return (
                <div className="relay-fade-in flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className={`text-2xl font-black ${t.cardTitle}`}>Lesson Complete!</h2>
                  <p className={`mt-2 text-sm ${t.cardSub}`}>{activeLesson.title}</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl px-5 py-3" style={{ backgroundColor: `${activeLesson.color}15` }}>
                      <Zap className="h-5 w-5" style={{ color: activeLesson.color }} />
                      <span className="text-xl font-black" style={{ color: activeLesson.color }}>+{content.xpReward} XP</span>
                    </div>
                    <div className={`flex items-center gap-2 rounded-xl px-5 py-3 ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
                      <Heart className="h-5 w-5 text-rose-400" />
                      <span className={`text-xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{lessonHearts}/3</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveLesson(null)}
                    className="mt-8 flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-black text-white transition-all active:scale-95"
                    style={{ backgroundColor: activeLesson.color }}
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              );

              return (
                <div className="relay-fade-in max-w-2xl mx-auto">
                  {/* ── Top bar: back, progress, hearts ── */}
                  <div className="flex items-center gap-3 mb-6">
                    <button type="button" onClick={() => setActiveLesson(null)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${t.headerBtnBg}`}>
                      <X className="h-4 w-4" />
                    </button>
                    {/* Progress bar */}
                    <div className={`flex-1 h-3 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPct}%`, backgroundColor: activeLesson.color }}
                      />
                    </div>
                    {/* Hearts */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[0, 1, 2].map(i => (
                        <Heart key={i} className={`h-5 w-5 transition-all ${i < lessonHearts ? 'text-rose-400 fill-rose-400' : (dark ? 'text-white/10' : 'text-slate-200')}`} />
                      ))}
                    </div>
                  </div>

                  {/* ── Step content ── */}
                  <div key={lessonStep} className="relay-fade-in">

                    {/* TEACH step */}
                    {step.type === 'teach' && (
                      <div className="space-y-4">
                        <h2 className={`text-xl font-black ${t.cardTitle}`}>{step.title}</h2>
                        <div className={`rounded-2xl p-5 ${t.cardBg}`}>
                          <p className={`text-[14px] leading-[1.8] whitespace-pre-line ${dark ? 'text-white/70' : 'text-slate-600'}`}>{step.body}</p>
                          {step.diagram && (
                            <div className={`mt-4 rounded-xl p-4 font-mono text-sm text-center ${dark ? 'bg-white/5 text-white/50' : 'bg-slate-50 text-slate-500'}`}>
                              {step.diagram}
                            </div>
                          )}
                        </div>
                        {step.circuitDiagram && (
                          <CircuitDiagram
                            circuit={step.circuitDiagram as CircuitId}
                            dark={dark}
                            showLabels
                            showCurrentFlow={step.showCurrentFlow}
                            className="rounded-xl overflow-hidden"
                          />
                        )}
                        <button
                          type="button"
                          onClick={advanceLessonStep}
                          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]"
                          style={{ backgroundColor: activeLesson.color }}
                        >
                          Continue
                        </button>
                      </div>
                    )}

                    {/* MULTIPLE CHOICE step */}
                    {step.type === 'multiple_choice' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>{step.question}</h2>
                        {step.circuitDiagram && (
                          <CircuitDiagram circuit={step.circuitDiagram as CircuitId} dark={dark} showLabels className="rounded-xl overflow-hidden" />
                        )}
                        <div className="space-y-2">
                          {step.options.map((opt, idx) => {
                            const selected = lessonAnswer === idx;
                            const isCorrect = idx === step.correct;
                            const showResult = lessonAnswered;
                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={lessonAnswered}
                                onClick={() => { setLessonAnswer(idx); checkLessonAnswer(step, idx); }}
                                className={`w-full text-left rounded-xl px-4 py-3.5 text-[14px] font-semibold transition-all border-2 ${
                                  showResult
                                    ? isCorrect
                                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                                      : selected
                                        ? 'border-rose-400 bg-rose-400/10 text-rose-400'
                                        : dark ? 'border-white/5 text-white/30' : 'border-slate-100 text-slate-300'
                                    : selected
                                      ? `border-current`
                                      : dark ? 'border-white/10 text-white/70 hover:border-white/25' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                                style={selected && !showResult ? { borderColor: activeLesson.color, color: activeLesson.color } : undefined}
                              >
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black mr-3 ${
                                  showResult && isCorrect ? 'bg-emerald-400 text-white'
                                  : showResult && selected ? 'bg-rose-400 text-white'
                                  : dark ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {/* Feedback */}
                        {lessonAnswered && (
                          <div className={`relay-fade-in rounded-xl p-4 ${lessonCorrect ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                            <p className={`text-sm font-black ${lessonCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {lessonCorrect ? 'Correct!' : 'Not quite.'}
                            </p>
                            <p className={`mt-1 text-xs ${dark ? 'text-white/50' : 'text-slate-500'}`}>{step.explanation}</p>
                          </div>
                        )}
                        {lessonAnswered && (
                          <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>
                            Continue
                          </button>
                        )}
                      </div>
                    )}

                    {/* TRUE/FALSE step */}
                    {step.type === 'true_false' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>True or False?</h2>
                        <div className={`rounded-2xl p-5 ${t.cardBg}`}>
                          <p className={`text-[14px] leading-relaxed ${dark ? 'text-white/70' : 'text-slate-600'}`}>{step.statement}</p>
                        </div>
                        {step.circuitDiagram && (
                          <CircuitDiagram circuit={step.circuitDiagram as CircuitId} dark={dark} showLabels className="rounded-xl overflow-hidden" />
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {[true, false].map(val => {
                            const selected = lessonAnswer === val;
                            const isCorrect = val === step.correct;
                            const showResult = lessonAnswered;
                            return (
                              <button
                                key={String(val)}
                                type="button"
                                disabled={lessonAnswered}
                                onClick={() => { setLessonAnswer(val); checkLessonAnswer(step, val); }}
                                className={`rounded-xl py-4 text-base font-black transition-all border-2 ${
                                  showResult
                                    ? isCorrect ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400' : selected ? 'border-rose-400 bg-rose-400/10 text-rose-400' : dark ? 'border-white/5 text-white/20' : 'border-slate-100 text-slate-300'
                                    : dark ? 'border-white/10 text-white/70 hover:border-white/25' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                {val ? 'True' : 'False'}
                              </button>
                            );
                          })}
                        </div>
                        {lessonAnswered && (
                          <div className={`relay-fade-in rounded-xl p-4 ${lessonCorrect ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                            <p className={`text-sm font-black ${lessonCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>{lessonCorrect ? 'Correct!' : 'Not quite.'}</p>
                            <p className={`mt-1 text-xs ${dark ? 'text-white/50' : 'text-slate-500'}`}>{step.explanation}</p>
                          </div>
                        )}
                        {lessonAnswered && (
                          <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>Continue</button>
                        )}
                      </div>
                    )}

                    {/* FILL BLANK step */}
                    {step.type === 'fill_blank' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>Fill in the blank</h2>
                        <div className={`rounded-2xl p-5 ${t.cardBg}`}>
                          <p className={`text-[14px] leading-relaxed ${dark ? 'text-white/70' : 'text-slate-600'}`}>{step.prompt}</p>
                        </div>
                        {step.circuitDiagram && (
                          <CircuitDiagram circuit={step.circuitDiagram as CircuitId} dark={dark} showLabels className="rounded-xl overflow-hidden" />
                        )}
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={typeof lessonAnswer === 'string' ? lessonAnswer : ''}
                            onChange={e => setLessonAnswer(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && lessonAnswer && !lessonAnswered) checkLessonAnswer(step, lessonAnswer); }}
                            disabled={lessonAnswered}
                            placeholder="Type your answer..."
                            className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold outline-none transition-all ${
                              lessonAnswered
                                ? lessonCorrect ? 'border-emerald-400 bg-emerald-400/5' : 'border-rose-400 bg-rose-400/5'
                                : dark ? 'border-white/10 bg-white/5 text-white placeholder:text-white/20 focus:border-white/30' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-300 focus:border-slate-400'
                            }`}
                          />
                          {!lessonAnswered && (
                            <button
                              type="button"
                              disabled={!lessonAnswer}
                              onClick={() => lessonAnswer !== null && checkLessonAnswer(step, lessonAnswer)}
                              className="shrink-0 rounded-xl px-5 py-3 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
                              style={{ backgroundColor: activeLesson.color }}
                            >
                              Check
                            </button>
                          )}
                        </div>
                        {!lessonAnswered && step.hint && (
                          <p className={`text-xs ${dark ? 'text-white/25' : 'text-slate-400'}`}>Hint: {step.hint}</p>
                        )}
                        {lessonAnswered && (
                          <div className={`relay-fade-in rounded-xl p-4 ${lessonCorrect ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                            <p className={`text-sm font-black ${lessonCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>{lessonCorrect ? 'Correct!' : `The answer is: ${step.answer}`}</p>
                          </div>
                        )}
                        {lessonAnswered && (
                          <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>Continue</button>
                        )}
                      </div>
                    )}

                    {/* MATCH step */}
                    {step.type === 'match' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>{step.instruction}</h2>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Left column */}
                          <div className="space-y-2">
                            {step.pairs.map((pair, idx) => {
                              const matched = matchedPairs.has(idx);
                              const selected = matchSelected?.side === 'left' && matchSelected.idx === idx;
                              return (
                                <button
                                  key={`l-${idx}`}
                                  type="button"
                                  disabled={matched}
                                  onClick={() => {
                                    if (matchSelected?.side === 'right') {
                                      // Check if this left matches the selected right
                                      const rightOrigIdx = matchShuffledRight[matchSelected.idx];
                                      if (rightOrigIdx === idx) {
                                        setMatchedPairs(prev => new Set([...prev, idx]));
                                        setMatchSelected(null);
                                        // If all matched, auto-advance
                                        if (matchedPairs.size + 1 === step.pairs.length) {
                                          setTimeout(advanceLessonStep, 600);
                                        }
                                      } else {
                                        setMatchSelected({ side: 'left', idx });
                                      }
                                    } else {
                                      setMatchSelected({ side: 'left', idx });
                                    }
                                  }}
                                  className={`w-full rounded-xl px-3 py-3 text-[13px] font-semibold text-left transition-all border-2 ${
                                    matched ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400 opacity-60'
                                    : selected ? 'border-current shadow-sm' : dark ? 'border-white/10 text-white/70 hover:border-white/20' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                  }`}
                                  style={selected ? { borderColor: activeLesson.color, color: activeLesson.color } : undefined}
                                >
                                  {pair[0]}
                                </button>
                              );
                            })}
                          </div>
                          {/* Right column (shuffled) */}
                          <div className="space-y-2">
                            {matchShuffledRight.map((origIdx, displayIdx) => {
                              const matched = matchedPairs.has(origIdx);
                              const selected = matchSelected?.side === 'right' && matchSelected.idx === displayIdx;
                              return (
                                <button
                                  key={`r-${displayIdx}`}
                                  type="button"
                                  disabled={matched}
                                  onClick={() => {
                                    if (matchSelected?.side === 'left') {
                                      // Check if selected left matches this right
                                      if (origIdx === matchSelected.idx) {
                                        setMatchedPairs(prev => new Set([...prev, origIdx]));
                                        setMatchSelected(null);
                                        if (matchedPairs.size + 1 === step.pairs.length) {
                                          setTimeout(advanceLessonStep, 600);
                                        }
                                      } else {
                                        setMatchSelected({ side: 'right', idx: displayIdx });
                                      }
                                    } else {
                                      setMatchSelected({ side: 'right', idx: displayIdx });
                                    }
                                  }}
                                  className={`w-full rounded-xl px-3 py-3 text-[13px] font-semibold text-left transition-all border-2 ${
                                    matched ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400 opacity-60'
                                    : selected ? 'border-current shadow-sm' : dark ? 'border-white/10 text-white/70 hover:border-white/20' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                  }`}
                                  style={selected ? { borderColor: activeLesson.color, color: activeLesson.color } : undefined}
                                >
                                  {step.pairs[origIdx][1]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <p className={`text-xs text-center ${dark ? 'text-white/25' : 'text-slate-400'}`}>
                          {matchedPairs.size}/{step.pairs.length} matched
                        </p>
                      </div>
                    )}

                    {/* SPOT ERROR step */}
                    {step.type === 'spot_error' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>{step.question}</h2>
                        <CircuitDiagram
                          circuit={step.circuitDiagram as CircuitId}
                          dark={dark}
                          clickable={!lessonAnswered}
                          showLabels
                          errorRegion={spotErrorRegion || undefined}
                          onRegionClick={(regionId) => {
                            if (lessonAnswered) return;
                            setSpotErrorRegion(regionId);
                            const correct = regionId === step.correctRegion;
                            setLessonAnswered(true);
                            setLessonCorrect(correct);
                            if (!correct) setLessonHearts(h => Math.max(0, h - 1));
                          }}
                          className="rounded-xl overflow-hidden"
                        />
                        {lessonAnswered && (
                          <div className={`relay-fade-in rounded-xl p-4 ${lessonCorrect ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                            <p className={`text-sm font-black ${lessonCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {lessonCorrect ? 'You found it!' : 'Not quite — look more carefully.'}
                            </p>
                            <p className={`mt-1 text-xs ${dark ? 'text-white/50' : 'text-slate-500'}`}>{step.explanation}</p>
                          </div>
                        )}
                        {lessonAnswered && (
                          <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>Continue</button>
                        )}
                      </div>
                    )}

                    {/* IDENTIFY COMPONENT step */}
                    {step.type === 'identify_component' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>{step.question}</h2>
                        <CircuitDiagram
                          circuit={step.circuitDiagram as CircuitId}
                          dark={dark}
                          clickable={!lessonAnswered}
                          showLabels
                          highlightRegion={lessonAnswered ? step.correctComponent : undefined}
                          onRegionClick={(regionId) => {
                            if (lessonAnswered) return;
                            const correct = regionId === step.correctComponent;
                            setLessonAnswered(true);
                            setLessonCorrect(correct);
                            if (!correct) setLessonHearts(h => Math.max(0, h - 1));
                          }}
                          className="rounded-xl overflow-hidden"
                        />
                        {!lessonAnswered && (
                          <p className={`text-xs text-center ${dark ? 'text-white/30' : 'text-slate-400'}`}>Click on the correct component in the diagram above</p>
                        )}
                        {lessonAnswered && (
                          <div className={`relay-fade-in rounded-xl p-4 ${lessonCorrect ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                            <p className={`text-sm font-black ${lessonCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {lessonCorrect ? 'Correct!' : 'Not quite.'}
                            </p>
                            <p className={`mt-1 text-xs ${dark ? 'text-white/50' : 'text-slate-500'}`}>{step.explanation}</p>
                          </div>
                        )}
                        {lessonAnswered && (
                          <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>Continue</button>
                        )}
                      </div>
                    )}

                    {/* DRAW CONNECTION step */}
                    {step.type === 'draw_connection' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>{step.instruction}</h2>
                        <CircuitDrawingCanvas
                          dark={dark}
                          terminals={step.terminals}
                          expectedConnections={step.expectedConnections}
                          onComplete={(correct) => {
                            setDrawingComplete(true);
                            setLessonAnswered(true);
                            setLessonCorrect(correct);
                          }}
                          className="rounded-xl overflow-hidden"
                        />
                        {drawingComplete && (
                          <div className="relay-fade-in rounded-xl p-4 bg-emerald-400/10">
                            <p className="text-sm font-black text-emerald-400">All connections made!</p>
                            <p className={`mt-1 text-xs ${dark ? 'text-white/50' : 'text-slate-500'}`}>{step.explanation}</p>
                          </div>
                        )}
                        {drawingComplete && (
                          <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>Continue</button>
                        )}
                        {!drawingComplete && (
                          <p className={`text-xs text-center ${dark ? 'text-white/30' : 'text-slate-400'}`}>Click and drag between terminals to draw wires</p>
                        )}
                      </div>
                    )}

                    {/* DRAG ORDER step */}
                    {step.type === 'drag_order' && (
                      <div className="space-y-4">
                        <h2 className={`text-lg font-black leading-snug ${t.cardTitle}`}>{step.instruction}</h2>
                        <div className="space-y-2">
                          {dragItems.map((itemIdx, displayPos) => {
                            const isCorrectPos = dragCorrect !== null && step.correctOrder[displayPos] === itemIdx;
                            return (
                              <div
                                key={itemIdx}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all ${
                                  dragCorrect !== null
                                    ? isCorrectPos
                                      ? 'border-emerald-400/30 bg-emerald-400/5'
                                      : 'border-rose-400/30 bg-rose-400/5'
                                    : dark ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {/* Position number */}
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                  dragCorrect !== null
                                    ? isCorrectPos ? 'bg-emerald-400 text-white' : 'bg-rose-400 text-white'
                                    : dark ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {displayPos + 1}
                                </span>
                                <span className={`text-[13px] font-semibold flex-1 ${dark ? 'text-white/70' : 'text-slate-700'}`}>
                                  {step.items[itemIdx]}
                                </span>
                                {/* Move buttons */}
                                {dragCorrect === null && (
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      disabled={displayPos === 0}
                                      onClick={() => {
                                        const newItems = [...dragItems];
                                        [newItems[displayPos - 1], newItems[displayPos]] = [newItems[displayPos], newItems[displayPos - 1]];
                                        setDragItems(newItems);
                                      }}
                                      className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-all ${
                                        displayPos === 0 ? 'opacity-20' : dark ? 'text-white/40 hover:bg-white/10 hover:text-white/70' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                      }`}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={displayPos === dragItems.length - 1}
                                      onClick={() => {
                                        const newItems = [...dragItems];
                                        [newItems[displayPos], newItems[displayPos + 1]] = [newItems[displayPos + 1], newItems[displayPos]];
                                        setDragItems(newItems);
                                      }}
                                      className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-all ${
                                        displayPos === dragItems.length - 1 ? 'opacity-20' : dark ? 'text-white/40 hover:bg-white/10 hover:text-white/70' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                      }`}
                                    >
                                      ▼
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {dragCorrect === null && (
                          <button
                            type="button"
                            onClick={() => {
                              const correct = dragItems.every((itemIdx, pos) => step.correctOrder[pos] === itemIdx);
                              setDragCorrect(correct);
                              setLessonAnswered(true);
                              setLessonCorrect(correct);
                              if (!correct) setLessonHearts(h => Math.max(0, h - 1));
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]"
                            style={{ backgroundColor: activeLesson.color }}
                          >
                            Check Order
                          </button>
                        )}
                        {dragCorrect !== null && (
                          <>
                            <div className={`relay-fade-in rounded-xl p-4 ${dragCorrect ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                              <p className={`text-sm font-black ${dragCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {dragCorrect ? 'Perfect order!' : 'Not quite right — check the sequence.'}
                              </p>
                            </div>
                            <button type="button" onClick={advanceLessonStep} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98]" style={{ backgroundColor: activeLesson.color }}>Continue</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step counter */}
                  <p className={`mt-6 text-center text-[11px] font-semibold ${dark ? 'text-white/20' : 'text-slate-300'}`}>
                    {lessonStep + 1} of {totalSteps}
                  </p>
                </div>
              );
            })()}

            {activeTab === 'learn' && !activeLesson && (
              <div className="relay-fade-in space-y-5">
                <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                  {/* Knowledge graph */}
                  <section data-tour="tour-knowledge-graph" className={`overflow-hidden rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                    <div className={`px-5 py-4 ${t.cardHeaderBorder}`}>
                      <h2 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Knowledge Graph</h2>
                      <p className={`mt-0.5 text-xs ${t.cardSub}`}>Drag nodes to rearrange. Size shows mastery.</p>
                    </div>

                    <div ref={graphRef} className={`relative h-[380px] ${t.graphBg}`}>
                      <svg className="absolute inset-0 h-full w-full">
                        {graphEdges.map(([a, b]) => {
                          const na = nodeById[a];
                          const nb = nodeById[b];
                          if (!na || !nb) return null;
                          const avgMastery = (na.mastery + nb.mastery) / 2;
                          return (
                            <line
                              key={`${a}-${b}`}
                              x1={`${na.x}%`}
                              y1={`${na.y}%`}
                              x2={`${nb.x}%`}
                              y2={`${nb.y}%`}
                              stroke={avgMastery > 50 ? na.color : t.graphEdge}
                              strokeWidth={avgMastery > 50 ? '2.5' : '1.5'}
                              strokeOpacity={avgMastery > 50 ? 0.4 : 0.25}
                              className="relay-edge-flow"
                            />
                          );
                        })}
                      </svg>

                      {skillNodes.map((node) => {
                        const size = 40 + node.mastery * 0.35;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onPointerDown={(event) => beginNodeDrag(event, node.id)}
                            className="group/node absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full transition-all duration-300 hover:shadow-xl hover:scale-110 active:cursor-grabbing active:scale-95"
                            style={{
                              left: `${node.x}%`,
                              top: `${node.y}%`,
                              width: size,
                              height: size,
                              background: `conic-gradient(${node.color} ${node.mastery}%, ${t.graphNodeFallback} ${node.mastery}%)`,
                              boxShadow: `0 0 ${node.mastery / 5}px ${node.color}30`,
                            }}
                          >
                            <span className={`flex h-full w-full items-center justify-center rounded-full text-[10px] font-black ${t.graphNodeInner}`} style={{ margin: 3 }}>
                              {node.mastery}
                            </span>
                            <span className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-8 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ${dark ? 'text-white/60' : 'text-slate-600'}`}>
                              {node.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`p-5 ${t.cardHeaderBorder.replace('border-b', 'border-t')}`}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {skillNodes.map((node) => (
                          <div key={node.id} className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: node.color }} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className={`text-xs font-bold ${t.masteryLabel}`}>{node.label}</p>
                                <p className="text-[11px] font-bold" style={{ color: node.color }}>{node.mastery}%</p>
                              </div>
                              <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${t.masteryBarBg}`}>
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${node.mastery}%`, backgroundColor: node.color }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Learning path */}
                  <section data-tour="tour-learning-path" className={`rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                    <div className={`px-5 py-4 ${t.cardHeaderBorder}`}>
                      <h3 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Learning Path</h3>
                      <p className={`mt-0.5 text-xs ${t.cardSub}`}>Guided lessons, Brilliant-style</p>
                    </div>
                    <div className="p-4 relay-stagger">
                      {[
                        { title: 'Voltage Basics', desc: 'What voltage is, how to measure it, and why it matters for every circuit.', time: '8 min', color: '#38bdf8' },
                        { title: 'Current Flow Intuition', desc: 'Build an intuition for how current flows through series and parallel paths.', time: '12 min', color: '#f59e0b' },
                        { title: 'Breadboard Confidence Drill', desc: 'Learn the internal connections of a breadboard and practice placing components accurately.', time: '15 min', color: '#a78bfa' },
                        { title: 'Sensor Signal Sanity Checks', desc: 'How to verify your sensor output is reasonable before trusting it in code.', time: '18 min', color: '#34d399' },
                      ].map((lesson) => {
                        const progress = lessonProgress[lesson.title] || 0;
                        const done = progress === 100;
                        const started = progress > 0;
                        return (
                          <div
                            key={lesson.title}
                            className="relay-fade-in group mb-3 overflow-hidden rounded-xl transition-all hover:shadow-md"
                            style={{ borderLeft: `4px solid ${lesson.color}` }}
                          >
                            <div className={`flex items-center gap-4 p-4 rounded-r-xl ${t.lessonCardBg}`}>
                              <div
                                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                                style={{ backgroundColor: `${lesson.color}15` }}
                              >
                                {done ? (
                                  <CheckCircle2 className="h-6 w-6" style={{ color: lesson.color }} />
                                ) : (
                                  <>
                                    <BookOpen className="h-5 w-5" style={{ color: lesson.color }} />
                                    {started && (
                                      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48">
                                        <circle cx="24" cy="24" r="22" fill="none" stroke={lesson.color} strokeWidth="2" strokeDasharray={`${progress * 1.38} 138`} opacity="0.4" />
                                      </svg>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${t.cardTitle}`}>{lesson.title}</p>
                                <p className={`text-[11px] leading-relaxed mt-0.5 ${t.cardSub}`}>{lesson.desc}</p>
                                <p className={`text-[10px] mt-1 ${dark ? 'text-white/25' : 'text-slate-300'}`}>{lesson.time} {started && !done ? `· ${progress}% done` : ''}</p>
                              </div>
                              <button
                                onClick={() => startLesson({ ...lesson, progress })}
                                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all hover:scale-105 active:scale-95"
                                style={{
                                  backgroundColor: done ? `${lesson.color}15` : lesson.color,
                                  color: done ? lesson.color : '#fff',
                                }}
                              >
                                {done ? 'Review' : started ? 'Continue' : 'Start'}
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                  <section className={`rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                    <div className={`flex items-center justify-between px-5 py-4 ${t.cardHeaderBorder}`}>
                      <div>
                        <h3 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Adaptive Practice</h3>
                        <p className={`mt-0.5 text-xs ${t.cardSub}`}>Fresh questions based on your weak areas.</p>
                      </div>
                      <button
                        type="button"
                        onClick={startAdaptiveDrill}
                        disabled={adaptiveLoading}
                        className={`rounded-lg px-3.5 py-2 text-xs font-black transition-all active:scale-95 ${
                          dark ? 'bg-[#f3e515] text-black hover:bg-[#e8db11]' : 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]'
                        }`}
                      >
                        {adaptiveLoading ? 'Generating...' : adaptiveQueue.length ? 'Regenerate' : 'Generate Set'}
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      {adaptiveMeta && (
                        <div className={`rounded-xl p-3 ${dark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                          <p className={`text-[11px] font-semibold ${t.cardSub}`}>
                            Recommended topic: <span className={t.cardTitle}>{adaptiveMeta.recommendedTopic}</span>
                          </p>
                          {adaptiveMeta.skillGaps.length > 0 && (
                            <p className={`mt-1 text-[11px] ${t.cardSub}`}>Skill gaps: {adaptiveMeta.skillGaps.join(', ')}</p>
                          )}
                        </div>
                      )}

                      {adaptiveError && (
                        <div className={`rounded-xl p-3 text-[12px] font-semibold ${dark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
                          {adaptiveError}
                        </div>
                      )}

                      {!currentAdaptiveQuestion && !adaptiveLoading && (
                        <div className={`rounded-xl border border-dashed p-6 text-center ${dark ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-400'}`}>
                          Generate a set to start adaptive drilling.
                        </div>
                      )}

                      {currentAdaptiveQuestion && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <span className={`rounded-full px-2 py-0.5 ${dark ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'}`}>{currentAdaptiveQuestion.topic}</span>
                            <span className={`rounded-full px-2 py-0.5 ${dark ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'}`}>{currentAdaptiveQuestion.type}</span>
                          </div>
                          <h4 className={`text-sm font-black leading-relaxed ${t.cardTitle}`}>{currentAdaptiveQuestion.question}</h4>

                          {currentAdaptiveQuestion.diagram_id && (
                            <CircuitDiagram
                              circuit={currentAdaptiveQuestion.diagram_id as CircuitId}
                              dark={dark}
                              showLabels
                              className="rounded-xl overflow-hidden"
                            />
                          )}

                          {currentAdaptiveQuestion.type === 'multiple_choice' && (
                            <div className="space-y-2">
                              {(currentAdaptiveQuestion.options || []).map((option, optionIndex) => (
                                <button
                                  key={`${currentAdaptiveQuestion.id}-opt-${optionIndex}`}
                                  type="button"
                                  disabled={Boolean(adaptiveFeedback)}
                                  onClick={() => { setAdaptiveError(''); setAdaptiveSelectedOption(optionIndex); }}
                                  className={`w-full rounded-xl border-2 px-3 py-2.5 text-left text-[13px] font-semibold transition-all ${
                                    adaptiveSelectedOption === optionIndex
                                      ? dark ? 'border-[#f3e515] text-[#f3e515]' : 'border-[#0a0a0a] text-[#0a0a0a]'
                                      : dark ? 'border-white/10 text-white/70 hover:border-white/25' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  {option.text}
                                </button>
                              ))}
                            </div>
                          )}

                          {currentAdaptiveQuestion.type === 'true_false' && (
                            <div className="grid grid-cols-2 gap-2">
                              {['True', 'False'].map((label, index) => (
                                <button
                                  key={label}
                                  type="button"
                                  disabled={Boolean(adaptiveFeedback)}
                                  onClick={() => { setAdaptiveError(''); setAdaptiveSelectedOption(index); }}
                                  className={`rounded-xl border-2 px-3 py-2.5 text-sm font-black transition-all ${
                                    adaptiveSelectedOption === index
                                      ? dark ? 'border-[#f3e515] text-[#f3e515]' : 'border-[#0a0a0a] text-[#0a0a0a]'
                                      : dark ? 'border-white/10 text-white/70 hover:border-white/25' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}

                          {currentAdaptiveQuestion.type === 'fill_blank' && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={adaptiveTypedAnswer}
                                onChange={(event) => { setAdaptiveError(''); setAdaptiveTypedAnswer(event.target.value); }}
                                disabled={Boolean(adaptiveFeedback)}
                                placeholder="Type your answer"
                                className={`w-full rounded-xl border-2 px-3 py-2.5 text-sm font-semibold outline-none ${
                                  dark ? 'border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-white/25' : 'border-slate-200 bg-white text-slate-700 placeholder:text-slate-300 focus:border-slate-400'
                                }`}
                              />
                              {currentAdaptiveQuestion.hint && !adaptiveFeedback && (
                                <p className={`text-[11px] ${t.cardSub}`}>Hint: {currentAdaptiveQuestion.hint}</p>
                              )}
                            </div>
                          )}

                          {!adaptiveFeedback && (
                            <button
                              type="button"
                              onClick={() => evaluateAdaptiveAnswer(currentAdaptiveQuestion)}
                              className={`w-full rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                                dark ? 'bg-[#f3e515] text-black hover:bg-[#e8db11]' : 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]'
                              }`}
                            >
                              Check Answer
                            </button>
                          )}

                          {adaptiveFeedback && (
                            <div className={`rounded-xl p-3 ${adaptiveFeedback.correct ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                              <p className={`text-sm font-black ${adaptiveFeedback.correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {adaptiveFeedback.correct ? 'Correct' : 'Needs review'}
                              </p>
                              <p className={`mt-1 text-xs ${t.cardSub}`}>{adaptiveFeedback.message}</p>
                              <button
                                type="button"
                                onClick={continueAdaptiveQuestion}
                                className={`mt-3 w-full rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                                  dark ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Continue
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className={`rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                    <div className={`px-5 py-4 ${t.cardHeaderBorder}`}>
                      <h3 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Answered History</h3>
                      <p className={`mt-0.5 text-xs ${t.cardSub}`}>Recent adaptive responses (newest first).</p>
                    </div>
                    <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
                      {adaptiveHistory.length === 0 && (
                        <div className={`rounded-xl border border-dashed p-5 text-center text-[12px] ${dark ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-400'}`}>
                          No answers yet. Complete adaptive questions to build review memory.
                        </div>
                      )}
                      {adaptiveHistory.map((entry) => (
                        <article key={entry.id} className={`rounded-xl p-3 ${dark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${t.cardSub}`}>{entry.topic}</span>
                            <span className={`text-[10px] font-black ${entry.correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {entry.correct ? 'Correct' : 'Retry queued'}
                            </span>
                          </div>
                          <p className={`mt-1 text-[12px] font-semibold leading-relaxed ${t.cardTitle}`}>{entry.question}</p>
                          <p className={`mt-1 text-[11px] ${t.cardSub}`}>Your answer: {entry.answerGiven || '—'}</p>
                          <p className={`mt-1 text-[10px] ${dark ? 'text-white/30' : 'text-slate-400'}`}>{prettyTime(entry.answeredAt)}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Drawing Exercise */}
                <section className={`rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                  <div className={`flex items-center justify-between px-5 py-4 ${t.cardHeaderBorder}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${dark ? 'bg-[#f3e515]/10' : 'bg-[#0a0a0a]/5'}`}>
                        <PenTool className={`h-4 w-4 ${dark ? 'text-[#f3e515]' : 'text-[#0a0a0a]'}`} />
                      </div>
                      <div>
                        <h3 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Drawing Exercise</h3>
                        <p className={`mt-0.5 text-xs ${t.cardSub}`}>Draw circuits and get AI-powered feedback via Gemini Vision.</p>
                      </div>
                    </div>
                    {!drawExerciseActive && (
                      <button
                        type="button"
                        onClick={startDrawExercise}
                        className={`rounded-lg px-3.5 py-2 text-xs font-black transition-all active:scale-95 ${
                          dark ? 'bg-[#f3e515] text-black hover:bg-[#e8db11]' : 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]'
                        }`}
                      >
                        Start Drawing
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    {!drawExerciseActive ? (
                      <div className={`rounded-xl border border-dashed p-8 text-center ${dark ? 'border-white/10' : 'border-slate-200'}`}>
                        <PenTool className={`mx-auto h-8 w-8 mb-3 ${dark ? 'text-white/20' : 'text-slate-300'}`} />
                        <p className={`text-sm font-bold ${dark ? 'text-white/40' : 'text-slate-400'}`}>Draw a circuit diagram and submit it for AI assessment.</p>
                        <p className={`mt-1 text-xs ${dark ? 'text-white/25' : 'text-slate-300'}`}>Gemini Vision analyzes your drawing and provides targeted feedback.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Exercise selector */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {DRAW_EXERCISES.map((ex, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => { setCurrentDrawExercise(idx); setDrawExerciseFeedback(null); clearDrawCanvas(); }}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                                currentDrawExercise === idx
                                  ? dark ? 'bg-[#f3e515] text-black' : 'bg-[#0a0a0a] text-[#f3e515]'
                                  : dark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </div>

                        {/* Prompt */}
                        <div className={`rounded-xl p-3 ${dark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                          <p className={`text-sm font-black ${t.cardTitle}`}>{DRAW_EXERCISES[currentDrawExercise].title}</p>
                          <p className={`mt-1 text-xs ${t.cardSub}`}>{DRAW_EXERCISES[currentDrawExercise].hint}</p>
                        </div>

                        {/* Canvas */}
                        <div className={`rounded-xl overflow-hidden border-2 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
                          <canvas
                            ref={drawCanvasRef}
                            className={`w-full touch-none ${drawIsEraser ? 'cursor-cell' : 'cursor-crosshair'}`}
                            style={{ height: 280 }}
                            onMouseDown={onDrawStart}
                            onMouseMove={onDrawMove}
                            onMouseUp={onDrawEnd}
                            onMouseLeave={onDrawEnd}
                            onTouchStart={onDrawStart}
                            onTouchMove={onDrawMove}
                            onTouchEnd={onDrawEnd}
                          />
                        </div>

                        {/* Pen colors & eraser */}
                        <div className="flex items-center gap-1.5">
                          {['#000000','#ef4444','#3b82f6','#22c55e','#f3e515'].map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setDrawPenColor(c); setDrawIsEraser(false); }}
                              className={`h-6 w-6 rounded-full border-2 transition-all ${drawPenColor === c && !drawIsEraser ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setDrawIsEraser(!drawIsEraser)}
                            className={`ml-1 rounded-lg px-2 py-1 text-[10px] font-black transition-all ${
                              drawIsEraser
                                ? 'bg-[#f3e515] text-black'
                                : dark ? 'bg-white/10 text-white/50 hover:bg-white/15' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                            }`}
                          >
                            Eraser
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={clearDrawCanvas}
                            className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                              dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={submitDrawing}
                            disabled={drawExerciseLoading}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 disabled:opacity-60 ${
                              dark ? 'bg-[#f3e515] text-black hover:bg-[#e8db11]' : 'bg-[#0a0a0a] text-[#f3e515] hover:bg-[#1a1a1a]'
                            }`}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {drawExerciseLoading ? 'Assessing...' : 'Submit for Assessment'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDrawExerciseActive(false); setDrawExerciseFeedback(null); }}
                            className={`rounded-xl px-3 py-2.5 text-xs font-black transition-all active:scale-95 ${
                              dark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            Close
                          </button>
                        </div>

                        {/* Feedback */}
                        {drawExerciseFeedback && (
                          <div className={`relay-fade-in rounded-xl p-4 ${drawExerciseFeedback.correct ? 'bg-emerald-400/10' : 'bg-amber-400/10'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-sm font-black ${drawExerciseFeedback.correct ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {drawExerciseFeedback.correct ? 'Correct!' : 'Needs work'}
                              </span>
                              <span className={`text-[10px] font-bold ${dark ? 'text-white/30' : 'text-slate-400'}`}>
                                Confidence: {Math.round(drawExerciseFeedback.confidence * 100)}%
                              </span>
                            </div>
                            <p className={`text-xs leading-relaxed ${t.cardSub}`}>{drawExerciseFeedback.feedback}</p>
                            {drawExerciseFeedback.components.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {drawExerciseFeedback.components.map((comp, i) => (
                                  <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${dark ? 'bg-white/10 text-white/50' : 'bg-slate-200 text-slate-500'}`}>
                                    {comp}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* ═══ COMMUNITY TAB ═══ */}
            {activeTab === 'community' && (
              <div className="relay-fade-in grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                {/* Leaderboard */}
                <section data-tour="tour-leaderboard" className={`overflow-hidden rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                  <div className={`flex items-center justify-between px-5 py-4 ${t.cardHeaderBorder}`}>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      <h2 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Relay League</h2>
                    </div>
                    <div className={`flex rounded-lg p-0.5 ${t.leagueTabBg}`}>
                      {(['weekly', 'alltime'] as const).map((view) => (
                        <button
                          key={view}
                          type="button"
                          onClick={() => setLeagueView(view)}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-black transition-all ${
                            leagueView === view ? t.leagueTabActive : t.leagueTabInactive
                          }`}
                        >
                          {view === 'weekly' ? 'This Week' : 'All Time'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Podium top 3 */}
                  <div className="flex items-end justify-center gap-4 px-5 pt-6 pb-4">
                    {[1, 0, 2].map((rank) => {
                      const entry = leaderboard[rank];
                      if (!entry) return null;
                      const heights = [140, 100, 80];
                      const sizes = ['h-14 w-14', 'h-12 w-12', 'h-11 w-11'];
                      const medals = ['relay-podium-1', 'relay-podium-2', 'relay-podium-3'];
                      const crownColors = ['text-amber-400', 'text-slate-400', 'text-orange-400'];
                      return (
                        <div key={entry.name} className="flex flex-col items-center" style={{ order: rank === 0 ? 0 : rank === 1 ? -1 : 1 }}>
                          {rank === 0 && <Crown className="h-5 w-5 text-amber-400 mb-1 relay-streak-flame" />}
                          <div
                            className={`${sizes[rank]} mb-2 flex items-center justify-center rounded-full text-sm font-black text-white ring-2 ring-white/20 shadow-lg ${medals[rank]}`}
                          >
                            {entry.avatar}
                          </div>
                          <p className={`text-xs font-black ${dark ? 'text-white/80' : 'text-slate-700'}`}>{entry.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <p className={`text-[10px] font-semibold ${dark ? 'text-white/40' : 'text-slate-400'}`}>{entry.points.toLocaleString()} XP</p>
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
                              <Flame className="h-2.5 w-2.5" />{entry.streak}
                            </span>
                          </div>
                          <div
                            className={`mt-2 w-20 rounded-t-xl ${medals[rank]} transition-all duration-500`}
                            style={{ height: heights[rank] }}
                          >
                            <div className="flex h-full items-start justify-center pt-3">
                              <span className="text-2xl font-black text-white/90">#{rank + 1}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rest of leaderboard */}
                  <div className={`px-5 py-3 relay-stagger ${t.cardHeaderBorder.replace('border-b', 'border-t')}`}>
                    {leaderboard.slice(3).map((entry, idx) => (
                      <div key={entry.name} className="relay-fade-in flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${t.leagueRankBg}`}>
                            {idx + 4}
                          </span>
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white"
                            style={{ backgroundColor: AVATAR_COLORS[(idx + 3) % AVATAR_COLORS.length] }}
                          >
                            {entry.avatar}
                          </div>
                          <p className={`text-sm font-bold ${dark ? 'text-white/70' : 'text-slate-700'}`}>{entry.name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`font-bold ${dark ? 'text-white/40' : 'text-slate-500'}`}>{entry.points} XP</span>
                          <span className="flex items-center gap-1 font-semibold text-amber-500">
                            <Flame className="h-3 w-3" />
                            {entry.streak}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Challenges */}
                  <div className={`px-5 py-4 ${t.cardHeaderBorder.replace('border-b', 'border-t')}`}>
                    <h3 className={`text-sm font-black ${t.cardTitle}`}>Active Challenges</h3>
                    <div className="mt-3 space-y-2 relay-stagger">
                      {[
                        { id: 'streak7', title: '7-Day Build Streak', reward: '+140 XP', icon: Flame, color: '#f59e0b', desc: 'Complete at least one build session every day for 7 consecutive days. Each session must reach the wiring stage or beyond.', requirements: ['Build something every day for 7 days', 'Each session must reach the wiring stage', 'Streak resets if you miss a day'] },
                        { id: 'genericOnly', title: 'No Proprietary Kit Build', reward: 'Maker Badge', icon: Zap, color: '#a78bfa', desc: 'Complete a full build using only a generic breadboard and loose components — no branded starter kit allowed.', requirements: ['Select "Generic Breadboard Kit" as your kit', 'Complete all 5 stages of a build', 'No Arduino Starter Kit components'] },
                        { id: 'teachBack', title: 'Teach One Concept', reward: 'Mentor Badge', icon: GraduationCap, color: '#34d399', desc: 'Explain a concept you learned to the community by writing a post about it. Share what you built and what you figured out.', requirements: ['Complete at least one build', 'Write a community post explaining a concept', 'Get at least 3 likes on your post'] },
                      ].map((challenge) => {
                        const joined = joinedChallenges[challenge.id];
                        const Icon = challenge.icon;
                        return (
                          <div key={challenge.id} className={`relay-fade-in flex items-center gap-3 rounded-xl p-3 ${t.challengeBg}`}>
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${challenge.color}20` }}
                            >
                              <Icon className="h-5 w-5" style={{ color: challenge.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold ${t.cardTitle}`}>{challenge.title}</p>
                              <p className={`text-[11px] ${t.cardSub}`}>{challenge.reward}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => joined ? toggleChallenge(challenge.id) : setChallengeModal({ id: challenge.id, title: challenge.title, reward: challenge.reward, desc: challenge.desc, requirements: challenge.requirements, color: challenge.color })}
                              className={`rounded-full px-3.5 py-1.5 text-xs font-black transition-all duration-200 active:scale-95 ${
                                joined ? t.challengeJoined : t.challengeNotJoined
                              }`}
                            >
                              {joined ? 'Joined' : 'Join'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Community feed */}
                <section data-tour="tour-community-feed" className={`rounded-2xl transition-colors duration-300 ${t.cardBg}`}>
                  <div className={`px-5 py-4 ${t.cardHeaderBorder}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className={`text-lg font-black tracking-tight ${t.cardTitle}`}>Community Feed</h2>
                        <p className={`mt-0.5 text-xs ${t.cardSub}`}>Builds, reflections, and wins from the community</p>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 relay-pulse-glow" />
                        {posts.length} new
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-4 relay-stagger">
                    {posts.map((post) => (
                      <article key={post.id} className={`relay-fade-in rounded-xl p-4 transition-all duration-200 hover:shadow-md ${t.postBg}`}>
                        {/* Author row */}
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white shadow-sm"
                            style={{ backgroundColor: AVATAR_COLORS[post.author.charCodeAt(0) % AVATAR_COLORS.length] }}
                          >
                            {post.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-black ${t.postAuthor}`}>@{post.author}</p>
                              {post.badge && (
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${t.postBadge}`}>
                                  {post.badge}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className={`text-[11px] ${t.cardSub}`}>{post.timeAgo}</p>
                              {post.buildName && (
                                <>
                                  <span className={`text-[10px] ${t.cardSub}`}>&middot;</span>
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${dark ? 'text-[#f3e515]/60' : 'text-slate-500'}`}>
                                    <Zap className="h-2.5 w-2.5" />{post.buildName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Content */}
                        <div className="mt-3">
                          <h3 className={`text-sm font-black leading-snug ${t.postAuthor}`}>{post.title}</h3>
                          <p className={`mt-1.5 text-[13px] leading-relaxed ${t.postBody}`}>{post.body}</p>
                        </div>
                        {/* Actions */}
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => togglePostLike(post.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                              post.liked ? t.likeBgOn : t.likeBgOff
                            }`}
                          >
                            <Heart
                              className={`h-3.5 w-3.5 transition-transform ${likeAnimating === post.id ? 'relay-heart-pop' : ''} ${
                                post.liked ? 'fill-[#f3e515]' : ''
                              }`}
                            />
                            {post.likes}
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                              expandedComments[post.id]
                                ? (dark ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600')
                                : t.commentBg
                            }`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {post.comments + (commentReplies[post.id]?.length || 0) - (post.replyPreview ? 1 : 0)}
                          </button>
                        </div>
                        {/* Reply preview (collapsed) */}
                        {!expandedComments[post.id] && post.replyPreview && (
                          <button
                            type="button"
                            onClick={() => setExpandedComments((prev) => ({ ...prev, [post.id]: true }))}
                            className={`mt-3 flex w-full items-start gap-2 rounded-lg p-2.5 text-left transition-colors ${dark ? 'bg-white/[0.03] hover:bg-white/[0.05]' : 'bg-white/60 hover:bg-white/80'}`}
                          >
                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                              style={{ backgroundColor: AVATAR_COLORS[post.replyPreview.author.charCodeAt(0) % AVATAR_COLORS.length] }}
                            >
                              {post.replyPreview.avatar}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[11px] font-bold ${dark ? 'text-white/50' : 'text-slate-500'}`}>@{post.replyPreview.author}</p>
                              <p className={`text-[11px] leading-relaxed ${dark ? 'text-white/35' : 'text-slate-400'}`}>{post.replyPreview.text}</p>
                            </div>
                          </button>
                        )}

                        {/* Expanded comments thread */}
                        {expandedComments[post.id] && (
                          <div className={`mt-3 rounded-xl p-3 space-y-3 ${dark ? 'bg-white/[0.02]' : 'bg-slate-50/80'}`}>
                            {(commentReplies[post.id] || []).map((reply, ri) => (
                              <div key={ri} className="flex items-start gap-2">
                                <div
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                                  style={{ backgroundColor: AVATAR_COLORS[reply.author.charCodeAt(0) % AVATAR_COLORS.length] }}
                                >
                                  {reply.avatar}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-[11px] font-bold ${dark ? 'text-white/60' : 'text-slate-600'}`}>@{reply.author}</p>
                                    <p className={`text-[9px] ${dark ? 'text-white/25' : 'text-slate-300'}`}>{reply.timeAgo}</p>
                                  </div>
                                  <p className={`text-[11px] leading-relaxed mt-0.5 ${dark ? 'text-white/45' : 'text-slate-500'}`}>{reply.text}</p>
                                </div>
                              </div>
                            ))}
                            {/* Reply input */}
                            <div className="flex items-center gap-2 pt-1">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f3e515] text-[9px] font-black text-black">F</div>
                              <input
                                type="text"
                                value={commentDrafts[post.id] || ''}
                                onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && commentDrafts[post.id]?.trim()) {
                                    setCommentReplies((prev) => ({
                                      ...prev,
                                      [post.id]: [...(prev[post.id] || []), { author: 'faith', text: commentDrafts[post.id].trim(), avatar: 'F', timeAgo: 'just now' }],
                                    }));
                                    setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                                  }
                                }}
                                placeholder="Write a reply..."
                                className={`flex-1 rounded-lg border-0 px-2.5 py-1.5 text-[11px] font-medium outline-none ${
                                  dark ? 'bg-white/5 text-white placeholder:text-white/20 focus:ring-1 focus:ring-white/20' : 'bg-white text-slate-700 placeholder:text-slate-300 focus:ring-1 focus:ring-slate-300'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!commentDrafts[post.id]?.trim()) return;
                                  setCommentReplies((prev) => ({
                                    ...prev,
                                    [post.id]: [...(prev[post.id] || []), { author: 'faith', text: commentDrafts[post.id].trim(), avatar: 'F', timeAgo: 'just now' }],
                                  }));
                                  setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                                }}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all active:scale-90 ${
                                  dark ? 'bg-[#f3e515] text-black' : 'bg-[#0a0a0a] text-[#f3e515]'
                                }`}
                              >
                                <Send className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ═══ LIBRARY TAB ═══ */}
            {/* ═══ SANDBOX TAB ═══ */}
            {activeTab === 'sandbox' && (
              <div data-tour="tour-sandbox" className="relay-fade-in -mx-6 -mb-6" style={{ height: 'calc(100vh - 120px)' }}>
                <React.Suspense fallback={
                  <div className={`flex items-center justify-center h-full ${dark ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
                    <div className="text-center">
                      <Cpu className="h-10 w-10 mx-auto mb-3 animate-pulse" style={{ color: '#f3e515' }} />
                      <p className={`text-sm font-bold ${dark ? 'text-white/40' : 'text-slate-400'}`}>Loading Sandbox...</p>
                    </div>
                  </div>
                }>
                  <Sandbox dark={dark} t={t} preset={sandboxPreset} />
                </React.Suspense>
              </div>
            )}

            {activeTab === 'library' && (
              <div data-tour="tour-library" className="relay-fade-in">
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 relay-stagger">
                  {BUILD_LIBRARY.map((item) => {
                    const Icon = item.icon;
                    const levelColors: Record<string, string> = {
                      Beginner: 'bg-emerald-100 text-emerald-700',
                      Intermediate: 'bg-amber-100 text-amber-700',
                      Advanced: 'bg-rose-100 text-rose-700',
                    };
                    const darkLevelColors: Record<string, string> = {
                      Beginner: 'bg-emerald-500/20 text-emerald-400',
                      Intermediate: 'bg-amber-500/20 text-amber-400',
                      Advanced: 'bg-rose-500/20 text-rose-400',
                    };
                    return (
                      <article
                        key={item.title}
                        className={`relay-fade-in group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1.5 ${t.libCardRing} ${t.libBodyBg} shadow-sm`}
                      >
                        {/* Colored header with gradient */}
                        <div className="relative h-32 overflow-hidden" style={{ backgroundColor: typeof t.libHeaderBg === 'function' ? t.libHeaderBg(item.color) : '' }}>
                          <div
                            className="absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-15 transition-transform duration-500 group-hover:scale-150"
                            style={{ backgroundColor: item.color }}
                          />
                          <div
                            className="absolute -left-4 bottom-0 h-20 w-20 rounded-full opacity-10"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="absolute bottom-4 left-4 flex items-end gap-3">
                            <div
                              className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                              style={{ backgroundColor: item.color }}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-slate-400'}`}>{item.mode}</p>
                              <p className={`text-[11px] font-semibold ${dark ? 'text-white/30' : 'text-slate-400'}`}>{item.parts.length} components</p>
                            </div>
                          </div>
                          <div className="absolute right-3 top-3">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${dark ? (darkLevelColors[item.level] || '') : (levelColors[item.level] || '')}`}>
                              {item.level}
                            </span>
                          </div>
                        </div>
                        {/* Body */}
                        <div className="p-4">
                          <h3 className={`text-base font-black leading-snug ${t.libTitle}`}>{item.title}</h3>
                          <p className={`mt-1.5 text-xs leading-relaxed ${t.libSub}`}>{item.desc}</p>

                          {/* Parts preview */}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {item.parts.slice(0, 3).map((part) => (
                              <span key={part} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${dark ? 'bg-white/5 text-white/40' : 'bg-slate-100 text-slate-500'}`}>
                                {part}
                              </span>
                            ))}
                            {item.parts.length > 3 && (
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${dark ? 'bg-white/5 text-white/30' : 'bg-slate-100 text-slate-400'}`}>
                                +{item.parts.length - 3} more
                              </span>
                            )}
                          </div>

                          <div className={`mt-4 flex items-center justify-between pt-3 ${dark ? 'border-t border-white/5' : 'border-t border-slate-100'}`}>
                            <div>
                              <span className={`text-xs font-bold ${dark ? 'text-white/50' : 'text-slate-500'}`}>{item.est}</span>
                              <span className={`ml-2 text-[10px] ${dark ? 'text-white/25' : 'text-slate-300'}`}>{item.builds.toLocaleString()} builds</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {SANDBOX_PRESETS[item.title] ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSandboxPreset(SANDBOX_PRESETS[item.title]);
                                    setActiveTab('sandbox');
                                  }}
                                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black transition-all duration-200 hover:scale-105 active:scale-95 ${dark ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
                                >
                                  <Cpu className="h-3.5 w-3.5" />
                                  3D Twin
                                </button>
                              ) : (
                                <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider ${dark ? 'bg-white/5 text-white/25' : 'bg-slate-100 text-slate-400'}`}>
                                  Mock
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBuild(item);
                                  setActiveTab('build');
                                  setFocusStage('inventory');
                                }}
                                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-black transition-all duration-200 hover:scale-105 active:scale-95 ${t.libBtnBg}`}
                              >
                                <PlayCircle className="h-3.5 w-3.5" />
                                Start
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Toast: mock builds notice */}
                <div className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${dark ? 'border-white/10 bg-white/5' : 'border-amber-200 bg-amber-50'}`}>
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${dark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className={`text-xs font-black ${dark ? 'text-white/80' : 'text-amber-900'}`}>3D Twin available for Light-Activated Alarm</p>
                    <p className={`mt-1 text-[11px] leading-relaxed ${dark ? 'text-white/40' : 'text-amber-700/70'}`}>
                      The Light-Activated Alarm has a fully working 3D digital twin with live simulation, buzzer audio, and pre-built circuit.
                      Other projects are marked <span className="font-bold">Mock</span> — during scale-up, we plan to add 3D twins for all builds
                      with live Gemini API feedback for real-time circuit validation.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ═══ CHALLENGE DETAIL MODAL ═══ */}
      {challengeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setChallengeModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className={`relay-scale-in relative w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl ${t.tourBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative overflow-hidden px-5 pt-6 pb-4" style={{ backgroundColor: `${challengeModal.color}15` }}>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20" style={{ backgroundColor: challengeModal.color }} />
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${challengeModal.color}25` }}>
                  <Trophy className="h-6 w-6" style={{ color: challengeModal.color }} />
                </div>
                <div>
                  <p className={`text-base font-black ${t.tourTitle}`}>{challengeModal.title}</p>
                  <p className="text-xs font-bold" style={{ color: challengeModal.color }}>{challengeModal.reward}</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 py-4">
              <p className={`text-[13px] leading-relaxed ${t.tourBody}`}>{challengeModal.desc}</p>
              <div className="mt-4">
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${dark ? 'text-white/30' : 'text-slate-400'}`}>Requirements</p>
                <ul className="space-y-1.5">
                  {challengeModal.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${dark ? 'text-white/20' : 'text-slate-300'}`} />
                      <span className={`text-xs ${t.tourBody}`}>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Actions */}
            <div className={`flex items-center justify-between px-5 py-4 ${t.tourBorder}`}>
              <button
                type="button"
                onClick={() => setChallengeModal(null)}
                className={`rounded-lg px-4 py-2 text-xs font-bold ${t.tourBack}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { toggleChallenge(challengeModal.id); setChallengeModal(null); }}
                className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-black transition-all active:scale-95"
                style={{ backgroundColor: challengeModal.color, color: '#fff' }}
              >
                <Zap className="h-3.5 w-3.5" />
                Join Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROFILE / ACHIEVEMENTS ═══ */}
      {showProfile && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={() => setShowProfile(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div
            className={`relay-fade-in relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl ${dark ? 'bg-[#111114]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setShowProfile(false)}
              className={`absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${dark ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Avatar + name — centered, clean */}
            <div className="flex flex-col items-center pt-8 pb-2 px-6">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#f3e515] via-[#f59e0b] to-[#f3e515] text-3xl font-black text-black shadow-lg shadow-[#f3e515]/20">
                  F
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e515] text-xs font-black text-black ring-3 ring-white dark:ring-[#111114]">
                  {level}
                </div>
              </div>
              <h2 className={`mt-3 text-xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>faith</h2>
              <p className={`text-sm font-medium ${dark ? 'text-white/40' : 'text-slate-400'}`}>{levelName(level)} League</p>
            </div>

            {/* Stats row — big numbers, tiny labels */}
            <div className="flex justify-center gap-8 py-4">
              {[
                { value: streakCount, label: 'Day Streak', icon: <Flame className="h-4 w-4 text-amber-400" /> },
                { value: ACHIEVEMENTS.filter(a => a.earned).length, label: 'Achievements', icon: <Trophy className="h-4 w-4 text-[#f3e515]" /> },
                { value: xp, label: 'Total XP', icon: <Zap className="h-4 w-4 text-[#f3e515]" /> },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {stat.icon}
                    <span className={`text-2xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</span>
                  </div>
                  <p className={`mt-0.5 text-[10px] font-semibold ${dark ? 'text-white/30' : 'text-slate-400'}`}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Tab switcher */}
            <div className={`mx-6 flex rounded-xl p-1 ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
              {(['stats', 'achievements'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setProfileTab(tab)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    profileTab === tab
                      ? (dark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                      : (dark ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600')
                  }`}
                >
                  {tab === 'stats' ? 'My Stats' : 'Achievements'}
                </button>
              ))}
            </div>

            {/* ── Stats tab ── */}
            {profileTab === 'stats' && (
              <div className="px-6 pt-5 pb-6 space-y-5">
                {/* XP Breakdown */}
                <div>
                  <h3 className={`text-[11px] font-bold uppercase tracking-widest ${dark ? 'text-white/30' : 'text-slate-400'}`}>How you earn XP</h3>
                  <div className="mt-3 space-y-1">
                    {XP_ACTIONS.map((a) => (
                      <div key={a.action} className={`flex items-center justify-between py-2 ${dark ? 'border-b border-white/5' : 'border-b border-slate-50'}`}>
                        <span className={`flex items-center gap-3 text-[13px] ${dark ? 'text-white/60' : 'text-slate-600'}`}>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${dark ? 'bg-white/[0.06] text-white/75' : 'bg-slate-100 text-slate-500'}`}>
                            <a.icon className="h-4 w-4" />
                          </span>
                          {a.action}
                        </span>
                        <span className={`text-xs font-black bg-gradient-to-r from-[#f3e515] to-[#f59e0b] bg-clip-text text-transparent`}>+{a.xp} XP</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session History */}
                <div>
                  <h3 className={`text-[11px] font-bold uppercase tracking-widest ${dark ? 'text-white/30' : 'text-slate-400'}`}>Recent Sessions</h3>
                  <div className="mt-3 space-y-2">
                    {[
                      { build: 'Light-Activated Alarm', date: 'Today', stage: 'wiring', xp: 80 },
                      { build: 'Light-Activated Alarm', date: 'Yesterday', stage: 'code', xp: 105 },
                      { build: 'Light-Activated Alarm', date: 'Mar 6', stage: 'inventory', xp: 50 },
                    ].map((session, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${dark ? 'bg-white/[0.03] hover:bg-white/[0.06]' : 'bg-slate-50 hover:bg-slate-100'}`}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #f3e515 0%, #f59e0b 100%)' }}>
                          <Zap className="h-4 w-4 text-black" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{session.build}</p>
                          <p className={`text-[11px] ${dark ? 'text-white/30' : 'text-slate-400'}`}>{session.date} · {session.stage}</p>
                        </div>
                        <span className="text-xs font-black text-[#f3e515]">+{session.xp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Achievements tab ── */}
            {profileTab === 'achievements' && (
              <div className="px-6 pt-5 pb-6">
                <p className={`text-[11px] font-semibold mb-4 ${dark ? 'text-white/30' : 'text-slate-400'}`}>
                  {ACHIEVEMENTS.filter(a => a.earned).length} of {ACHIEVEMENTS.length} unlocked · Tap to inspect
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {ACHIEVEMENTS.map((ach) => (
                    <div
                      key={ach.id}
                      className="cursor-pointer"
                      style={{ perspective: '500px' }}
                      onClick={() => { if (ach.earned) { setInspectCard(ach); setInspectFlipped(false); } }}
                      onMouseMove={(e) => {
                        if (!ach.earned) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        const el = e.currentTarget.firstElementChild as HTMLElement;
                        if (el) {
                          el.style.transform = `rotateX(${((y - 50) / 50) * -8}deg) rotateY(${((x - 50) / 50) * 8}deg)`;
                          el.style.setProperty('--mx', `${x}%`);
                          el.style.setProperty('--my', `${y}%`);
                          el.style.setProperty('--bg-x', `${x}%`);
                          el.style.setProperty('--bg-y', `${y}%`);
                        }
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget.firstElementChild as HTMLElement;
                        if (el) { el.style.transform = ''; }
                      }}
                    >
                      <div
                        className={`relay-holo-card ${ach.earned ? 'earned' : 'locked'} flex flex-col`}
                        style={{ '--holo-glow': ach.glowColor, '--card-bg': ach.earned ? ach.bg : (dark ? '#18181b' : '#e2e8f0'), aspectRatio: '3/4' } as React.CSSProperties}
                      >
                        {/* Shape centerpiece */}
                        <div className="relative z-[3] flex flex-1 items-center justify-center">
                          <CardShape shape={ach.shape} className={`h-14 w-14 ${!ach.earned ? 'opacity-20' : 'drop-shadow-lg'}`} />
                        </div>
                        {/* Frosted info bar */}
                        <div className="relay-card-info relative z-[3] px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black text-white/90 leading-tight">{ach.title}</p>
                            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: RARITY_LABELS[ach.tier].color }}>
                              {RARITY_LABELS[ach.tier].label}
                            </span>
                          </div>
                          <p className="text-[9px] text-white/40 mt-0.5">{ach.desc} · {ach.rarity}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={`mt-4 text-center text-[10px] ${dark ? 'text-white/20' : 'text-slate-300'}`}>
                  Cards to unlock: {ACHIEVEMENTS.filter(a => !a.earned).length}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CARD INSPECT MODE ═══ */}
      {inspectCard && (
        <div
          className="relay-card-inspect-overlay"
          onClick={() => setInspectCard(null)}
        >
          <div className="relay-card-inspect-wrapper" onClick={(e) => e.stopPropagation()}>
            {/* Tilt layer — instant mouse tracking, no transition */}
            <div
              className="relay-card-inspect-tilt"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                const rotY = ((x - 50) / 50) * 18;
                const rotX = ((y - 50) / 50) * -18;
                e.currentTarget.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
                // Update holo highlight on the front face
                const front = e.currentTarget.querySelector('.relay-holo-card') as HTMLElement;
                if (front) {
                  front.style.setProperty('--mx', `${x}%`);
                  front.style.setProperty('--my', `${y}%`);
                  front.style.setProperty('--bg-x', `${x}%`);
                  front.style.setProperty('--bg-y', `${y}%`);
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
              }}
            >
              {/* Flip layer — smooth 0.6s transition, separate from tilt */}
              <div className={`relay-card-inspect-flip ${inspectFlipped ? 'flipped' : ''}`}>
                {/* FRONT */}
                <div
                  className="relay-card-inspect-face relay-holo-card earned inspecting"
                  style={{ '--holo-glow': inspectCard.glowColor, '--card-bg': inspectCard.bg } as React.CSSProperties}
                >
                  <div className="relative z-[3] flex h-full flex-col">
                    <div className="flex flex-1 items-center justify-center">
                      <CardShape shape={inspectCard.shape} className="h-24 w-24 drop-shadow-2xl" />
                    </div>
                    <div className="relay-card-info px-5 py-4">
                      <div className="flex items-center justify-between">
                        <p className="text-base font-black text-white/95">{inspectCard.title}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RARITY_LABELS[inspectCard.tier].color }}>
                          {RARITY_LABELS[inspectCard.tier].label}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/45 mt-1">{inspectCard.desc}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-white/30">{inspectCard.rarity}% of builders</span>
                        {inspectCard.earnedDate && <span className="text-[10px] text-white/30">Earned {inspectCard.earnedDate}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BACK */}
                <div
                  className="relay-card-inspect-face relay-card-inspect-back"
                  style={{ background: inspectCard.bg }}
                >
                  <div className="relative z-[3] flex h-full flex-col items-center justify-center p-6 text-center">
                    <CardShape shape={inspectCard.shape} className="h-16 w-16 opacity-30 mb-4" />
                    <p className="text-lg font-black text-white/90">{inspectCard.title}</p>
                    <p className="mt-3 text-sm leading-relaxed italic text-white/50 max-w-[240px]">
                      "{inspectCard.backText}"
                    </p>
                    {inspectCard.earnedDate && (
                      <p className="mt-4 text-xs font-bold text-white/25">Unlocked {inspectCard.earnedDate}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Flip button */}
            <button
              type="button"
              onClick={() => setInspectFlipped(f => !f)}
              className="mt-4 mx-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {inspectFlipped ? 'Show Front' : 'Flip Card'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ TOUR SPOTLIGHT ═══ */}
      {tourOpen && (
        <>
          {/* Dim overlay — click to dismiss */}
          <div
            className="fixed inset-0 z-[60] transition-opacity duration-300"
            onClick={() => setTourOpen(false)}
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          />

          {/* Spotlight cutout — box-shadow trick to dim everything except target */}
          {spotlightRect && (
            <div
              className="fixed z-[61] rounded-xl pointer-events-none transition-all duration-200 ease-out"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                border: '2px solid rgba(243,229,21,0.5)',
              }}
            />
          )}

          {/* Popover card — positioned relative to spotlight */}
          <div
            className={`fixed z-[62] w-[320px] overflow-hidden rounded-2xl shadow-2xl transition-all duration-200 ease-out ${t.tourBg}`}
            style={getPopoverStyle()}
          >
            {/* Progress strip */}
            <div className="flex gap-1 px-4 pt-4">
              {TOUR_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    idx <= tourStep ? 'bg-[#f3e515]' : t.tourBarOff
                  }`}
                />
              ))}
            </div>

            <div className="px-4 pt-3 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${t.tourStep}`}>
                    {tourStep + 1} / {TOUR_STEPS.length}
                    {TOUR_STEPS[tourStep].tab && (
                      <span className="ml-2 normal-case tracking-normal font-semibold">
                        {TOUR_STEPS[tourStep].tab === 'build' ? 'Build' : TOUR_STEPS[tourStep].tab === 'learn' ? 'Learn' : TOUR_STEPS[tourStep].tab === 'community' ? 'Community' : 'Library'}
                      </span>
                    )}
                  </p>
                  <h3 className={`mt-1.5 text-lg font-black tracking-tight leading-snug ${t.tourTitle}`}>{TOUR_STEPS[tourStep].title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTourOpen(false)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${t.tourClose}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className={`mt-2 text-[13px] leading-relaxed ${t.tourBody}`}>{TOUR_STEPS[tourStep].body}</p>
            </div>

            <div className={`flex items-center justify-between px-4 py-3 ${t.tourBorder}`}>
              <button
                type="button"
                onClick={retreatTour}
                disabled={tourStep === 0}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-30 ${t.tourBack}`}
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTourOpen(false)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${t.tourBack}`}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={advanceTour}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black transition-all active:scale-95 ${t.tourNext}`}
                >
                  {tourStep < TOUR_STEPS.length - 1 ? (
                    <>Next <ChevronRight className="h-3.5 w-3.5" /></>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Done</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
