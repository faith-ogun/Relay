import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Focus,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
  ScanLine,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-react';
import { useLiveBridge } from '../../../hooks/useLiveBridge';
import { usePlan } from '../../../hooks/usePlan';
import { useIdentity } from '../../../hooks/useIdentity';
import { PLAN_META } from '../entitlements';
import { BUILD_LIBRARY } from '../data/library';

/**
 * LiveTutorView — the live bench session. The camera feed is the hero; voice
 * is the primary channel. The learner points a camera at their breadboard and
 * the tutor sees it, talks them through wiring, and corrects mistakes live.
 *
 * Stages mirror the core learning loop: inventory → wiring → code → test.
 */

interface LiveTutorViewProps {
  /** Optional build to anchor the session (defaults to the flagship LDR alarm). */
  buildTitle?: string;
}

type Stage = 'inventory' | 'wiring' | 'code' | 'test';

const STAGES: Array<{ id: Stage; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = [
  { id: 'inventory', label: 'Inventory', icon: ScanLine, hint: 'Show me your parts so I can check the kit.' },
  { id: 'wiring', label: 'Wiring', icon: Wrench, hint: 'Place each component and I will watch the board.' },
  { id: 'code', label: 'Code', icon: Cpu, hint: 'Let us write and flash the sketch.' },
  { id: 'test', label: 'Test', icon: CheckCircle2, hint: 'Run it. I will read the serial output with you.' },
];

const QUICK = [
  'What part should I place first?',
  'Is this resistor the right value?',
  'Check my wiring so far.',
  'Why is my LED not lighting up?',
];

export const LiveTutorView: React.FC<LiveTutorViewProps> = ({ buildTitle }) => {
  const build = useMemo(
    () => BUILD_LIBRARY.find((b) => b.title === buildTitle) ?? BUILD_LIBRARY[0],
    [buildTitle],
  );

  const wsUrl = useMemo(() => {
    const raw = import.meta.env.VITE_OHMLET_WS_URL || 'ws://localhost:8082';
    return raw.replace(/\/$/, '');
  }, []);
  const { userId } = useIdentity();
  const sessionId = useRef(`live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;

  const [stage, setStage] = useState<Stage>('inventory');
  const [draft, setDraft] = useState('');
  const [snapped, setSnapped] = useState(false);

  const { canGoLive, liveCapMinutes, liveMinutesRemaining, consumeLiveSeconds, plan } = usePlan(userId);

  const {
    state,
    micOn,
    camOn,
    facing,
    transcripts,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
    switchCamera,
    captureSnapshot,
    sendText,
    sendStageUpdate,
    videoRef,
  } = useLiveBridge({ wsUrl, userId, sessionId });

  const live = state === 'connected';
  const connecting = state === 'connecting';
  const unlimited = liveCapMinutes === Infinity;

  // Meter live time against the plan's daily budget while connected, and cut the
  // session off when the budget runs out (the same cap the server enforces).
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => consumeLiveSeconds(10), 10000);
    return () => clearInterval(id);
  }, [live, consumeLiveSeconds]);

  useEffect(() => {
    if (live && liveMinutesRemaining <= 0) disconnect();
  }, [live, liveMinutesRemaining, disconnect]);

  // Start the session and request mic + camera in the same user gesture so the
  // browser shows the permission prompt right away.
  const goLive = () => {
    connect();
    if (!micOn) toggleMic();
    if (!camOn) toggleCam();
  };

  const snapNow = () => {
    captureSnapshot();
    setSnapped(true);
    setTimeout(() => setSnapped(false), 700);
  };

  const setStageAndNotify = (s: Stage) => {
    setStage(s);
    if (live) sendStageUpdate(s);
  };

  const send = (text: string) => {
    if (!text.trim() || !live) return;
    sendText(text, stage);
    setDraft('');
  };

  // ── Out of live budget (plan gate) ──
  if (!live && !connecting && !canGoLive) {
    const upgradeTo = plan === 'free' ? PLAN_META.pro : PLAN_META.max;
    return (
      <div className="ohmlet-rise mx-auto max-w-xl">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live tutor</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">You have used today's bench time.</h1>
        <div className="mt-6 rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-white p-7 shadow-press">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft">
            <Lock className="h-6 w-6 text-ohmlet-gold-deep" />
          </span>
          <p className="mt-4 text-base font-semibold leading-relaxed text-ohmlet-ink">
            The {PLAN_META[plan].label} plan includes {liveCapMinutes} minutes of live tutoring a day. Your lessons,
            sandbox, and community stay open. Live sessions reset tomorrow.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none">
              Upgrade to {upgradeTo.label}
            </button>
            <span className="inline-flex items-center text-sm font-bold text-ohmlet-ink-soft">
              {upgradeTo.label} gives you {upgradeTo.id === 'max' ? 'unlimited' : '180 min/day'} of live time.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-flight (not connected) ──
  if (!live && !connecting) {
    return (
      <div className="ohmlet-rise mx-auto max-w-3xl">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live tutor</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Build with a tutor that sees your bench.</h1>

        <div className="mt-6 overflow-hidden rounded-[1.8rem] border-[3px] border-ohmlet-gold bg-ohmlet-ink text-white shadow-[0_0_40px_rgba(250,204,46,0.18)]">
          <div className="relative grid gap-6 p-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ohmlet-gold/40 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-ohmlet-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-ohmlet-gold" /> Voice + camera
              </span>
              <h2 className="mt-4 text-2xl font-black">{build.title}</h2>
              <p className="mt-2 text-sm font-semibold text-white/65">{build.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Open Ohmlet on the device whose camera you want to use, your laptop or your phone',
                  'Talk to it like a bench partner, hands free',
                  'It glances at your board and catches mistakes before you power on',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm font-semibold text-white/85">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ohmlet-gold" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-ohmlet-gold/10 blur-2xl" />
              <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="ohmlet-float relative h-44 w-auto" draggable={false} />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 bg-black/20 px-8 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-white/55">
              Ohmlet asks for camera and microphone access when the session starts.
              {!unlimited && ` ${Math.floor(liveMinutesRemaining)} of ${liveCapMinutes} min left today.`}
            </p>
            <button
              onClick={goLive}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
            >
              <Radio className="h-5 w-5" /> Go live
            </button>
          </div>
        </div>

        {/* Parts checklist */}
        <div className="mt-6 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-6 shadow-soft">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">What you will need</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {build.parts.map((part) => (
              <span key={part} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-line bg-ohmlet-cream px-3 py-1.5 text-sm font-bold text-ohmlet-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-ohmlet-gold-deep" />
                {part}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Live session ──
  return (
    <div className="ohmlet-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ohmlet-red px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {connecting ? 'Connecting' : 'Live'}
          </span>
          <h1 className="text-xl font-black tracking-tight">{build.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!unlimited && (
            <span className="rounded-full border-2 border-ohmlet-line bg-white px-3 py-1.5 text-xs font-black text-ohmlet-ink-soft">
              {Math.floor(liveMinutesRemaining)} min left today
            </span>
          )}
          <button
            onClick={disconnect}
            className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-white px-4 py-2 text-sm font-black text-ohmlet-red shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
          >
            <PhoneOff className="h-4 w-4" /> End session
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Camera hero */}
        <div>
          <div className="relative overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink bg-ohmlet-ink shadow-press">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full bg-ohmlet-ink object-cover" />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                <CameraOff className="h-10 w-10" />
                <p className="text-sm font-bold">Camera is off. Turn it on so the tutor can see your bench.</p>
              </div>
            )}

            {/* Stage badge */}
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white backdrop-blur">
              {STAGES.find((s) => s.id === stage)?.label}
            </div>

            {/* Speaking indicator */}
            <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
              <Volume2 className="h-3.5 w-3.5 text-ohmlet-gold" /> Tutor audio on
            </div>

            {/* Overlaid controls */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-4">
              <ControlButton on={micOn} onClick={toggleMic} onIcon={Mic} offIcon={MicOff} label={micOn ? 'Mute' : 'Unmute'} />
              <ControlButton on={camOn} onClick={toggleCam} onIcon={Camera} offIcon={CameraOff} label={camOn ? 'Camera off' : 'Camera on'} />
              {camOn && (
                <>
                  <button
                    onClick={snapNow}
                    aria-label="Show the tutor my board now"
                    className={`flex h-12 items-center gap-2 rounded-full border-2 px-4 text-sm font-black transition-all hover:scale-105 ${
                      snapped ? 'border-ohmlet-green bg-ohmlet-green text-white' : 'border-white bg-white text-ohmlet-ink'
                    }`}
                  >
                    <Focus className="h-5 w-5" /> {snapped ? 'Sent' : 'Look now'}
                  </button>
                  <button
                    onClick={switchCamera}
                    aria-label="Switch camera"
                    title={facing === 'environment' ? 'Using rear camera' : 'Using front camera'}
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/40 bg-black/40 text-white backdrop-blur transition-all hover:scale-105"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stage stepper */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {STAGES.map((s) => {
              const Icon = s.icon;
              const on = stage === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStageAndNotify(s.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${
                    on ? 'border-ohmlet-ink bg-ohmlet-gold shadow-press-sm' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft hover:border-ohmlet-ink hover:text-ohmlet-ink'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-black">{s.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-ohmlet-ink-soft">
            {STAGES.find((s) => s.id === stage)?.hint}
          </p>
        </div>

        {/* Transcript + input */}
        <div className="flex h-[520px] flex-col rounded-[1.6rem] border-2 border-ohmlet-line bg-white shadow-soft">
          <div className="flex items-center gap-2 border-b border-ohmlet-line px-5 py-3.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ohmlet-ink">
              <Zap className="h-4 w-4 text-ohmlet-gold" />
            </span>
            <h3 className="text-sm font-black tracking-tight">Conversation</h3>
          </div>

          <div className="ohmlet-chat-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {transcripts.length === 0 && (
              <p className="mt-6 text-center text-sm font-semibold text-ohmlet-ink-soft">
                Say hello, or tap a prompt below to get started.
              </p>
            )}
            {transcripts.map((t, i) => {
              if (t.role === 'system') {
                return (
                  <p key={i} className="text-center text-[11px] font-bold uppercase tracking-wide text-ohmlet-ink-soft/70">
                    {t.text}
                  </p>
                );
              }
              const mine = t.role === 'user';
              return (
                <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-semibold leading-snug ${
                      mine ? 'bg-ohmlet-gold text-ohmlet-ink' : 'border-2 border-ohmlet-line bg-ohmlet-cream text-ohmlet-ink'
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 border-t border-ohmlet-line px-4 pt-3">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border-2 border-ohmlet-line bg-white px-3 py-1.5 text-xs font-bold text-ohmlet-ink-soft transition-colors hover:border-ohmlet-ink hover:text-ohmlet-ink"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Text input (voice is primary; this is the fallback) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-center gap-2 p-4"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type if you cannot talk right now"
              className="flex-1 rounded-2xl border-2 border-ohmlet-line bg-ohmlet-cream px-4 py-2.5 text-sm font-semibold text-ohmlet-ink outline-none focus:border-ohmlet-ink"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-40"
              aria-label="Send"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const ControlButton: React.FC<{
  on: boolean;
  onClick: () => void;
  onIcon: React.ComponentType<{ className?: string }>;
  offIcon: React.ComponentType<{ className?: string }>;
  label: string;
}> = ({ on, onClick, onIcon: OnIcon, offIcon: OffIcon, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all hover:scale-105 ${
      on ? 'border-white bg-white text-ohmlet-ink' : 'border-white/40 bg-black/40 text-white backdrop-blur'
    }`}
  >
    {on ? <OnIcon className="h-5 w-5" /> : <OffIcon className="h-5 w-5" />}
  </button>
);
