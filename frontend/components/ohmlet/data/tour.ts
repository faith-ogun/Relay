import type React from 'react';
import { Camera, Zap, Sparkles, Play, CheckCircle2 } from 'lucide-react';
import type { Stage, TourStep } from '../types';

export const FOCUS_STEPS: Array<{ label: string; stage: Stage; unlocked: boolean; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'Find Components', stage: 'inventory', unlocked: true, icon: Camera },
  { label: 'Wire The Board', stage: 'wiring', unlocked: true, icon: Zap },
  { label: 'Generate Sketch', stage: 'code', unlocked: true, icon: Sparkles },
  { label: 'Run + Validate', stage: 'run', unlocked: true, icon: Play },
  { label: 'Wrap & Save Twin', stage: 'report', unlocked: true, icon: CheckCircle2 },
];

export const TOUR_STEPS: TourStep[] = [
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
    body: 'Point your webcam at your breadboard and Ohmlet watches in real time via the Gemini Live API — it sees your components, wiring, and corrects mistakes as you go. Sessions last up to 15 min (audio) or 2 min (with video) per Gemini API limits. If it disconnects, it will auto-reconnect.',
    position: 'right',
  },
  {
    target: 'tour-chat',
    tab: 'build',
    title: 'Ohmlet Assistant',
    body: 'Chat with Ohmlet using voice or text. It responds with spoken audio and text transcripts. Multiple AI models work behind the scenes — Flash for real-time voice, Pro for code generation, and 2.5-Pro for deep reasoning.',
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
    title: 'Ohmlet League',
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
