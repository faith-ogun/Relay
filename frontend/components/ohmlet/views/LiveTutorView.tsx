import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cpu,
  Focus,
  Loader2,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
  ScanLine,
  Volume2,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { useLiveBridge } from '../../../hooks/useLiveBridge';
import { track } from '../../../services/analytics';
import { usePlan } from '../../../hooks/usePlan';
import { useIdentity } from '../../../hooks/useIdentity';
import { LIVE_MINUTES_PER_MONTH, PLAN_META } from '../entitlements';
import { BUILD_LIBRARY } from '../data/library';
import {
  verifyInventory,
  verifierConfigured,
  VerifierError,
  type InventoryResult,
  type PartStatus,
} from '../../../services/visionVerifier';
import { reporterConfigured } from '../../../services/reporter';
import { TwinStudio } from '../twin/TwinStudio';

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
  /** Route the learner to the upgrade path (pricing now, Stripe Checkout via #30). */
  onUpgrade?: () => void;
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

export const LiveTutorView: React.FC<LiveTutorViewProps> = ({ buildTitle, onUpgrade }) => {
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
  // The captured build photo currently being turned into a 3D twin (#31).
  const [twinFrame, setTwinFrame] = useState<string | null>(null);
  const [twinBusy, setTwinBusy] = useState(false);
  const budgetImageState = useState(true); // [ok, setOk] for the 402 art fallback

  const { canGoLive, liveCapMinutes, liveMinutesRemaining, liveSecondsUsed, consumeLiveSeconds, plan } = usePlan(userId);

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
    grabFrame,
    sendText,
    sendStageUpdate,
    videoRef,
  } = useLiveBridge({ wsUrl, userId, sessionId });

  const live = state === 'connected';
  const connecting = state === 'connecting';
  const unlimited = liveCapMinutes === Infinity;
  // Warn as the monthly budget runs low so running out is never a surprise.
  // Threshold scales with the cap: 10% of it, but at least 10 minutes.
  const lowTimeThreshold = Math.max(10, liveCapMinutes * 0.1);
  const lowTime = !unlimited && liveMinutesRemaining > 0 && liveMinutesRemaining <= lowTimeThreshold;

  // Meter live time against the plan's monthly budget while connected, and cut the
  // session off when the budget runs out (the same cap the server enforces).
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => consumeLiveSeconds(10), 10000);
    return () => clearInterval(id);
  }, [live, consumeLiveSeconds]);

  useEffect(() => {
    if (live && liveMinutesRemaining <= 0) disconnect();
  }, [live, liveMinutesRemaining, disconnect]);

  // Pair every live_session_start with an end event when the session closes
  // (user ends it, runs out of minutes, or leaves the view).
  const wasLive = useRef(false);
  useEffect(() => {
    if (live) {
      wasLive.current = true;
    } else if (wasLive.current) {
      wasLive.current = false;
      track('live_session_end');
    }
  }, [live]);

  // Start the session and request mic + camera in the same user gesture so the
  // browser shows the permission prompt right away.
  const goLive = () => {
    track('live_session_start');
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

  // Capture a clean still of the finished build and hand it to the twin studio.
  const captureTwin = useCallback(async () => {
    setTwinBusy(true);
    const frame = await grabFrame(1024);
    setTwinBusy(false);
    if (frame) setTwinFrame(frame);
  }, [grabFrame]);

  const send = (text: string) => {
    if (!text.trim() || !live) return;
    sendText(text, stage);
    setDraft('');
  };

  // ── Out of live budget (the upgrade moment, a friendly 402) ──
  if (!live && !connecting && !canGoLive) {
    const upgradeTo = plan === 'free' ? PLAN_META.pro : PLAN_META.max;
    const upgradeHours = Math.round(LIVE_MINUTES_PER_MONTH[upgradeTo.id] / 60);
    const upgradeLine = `${upgradeHours} hours of live time a month`;
    const [imgOk, setImgOk] = budgetImageState;
    return (
      <div className="ohmlet-rise mx-auto max-w-xl">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live tutor</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">That is this month's bench time used.</h1>
        <div className="mt-6 overflow-hidden rounded-[1.8rem] border-[3px] border-ohmlet-ink bg-white shadow-press">
          <div className="flex flex-col items-center gap-5 bg-ohmlet-gold-soft px-7 py-8 text-center">
            <img
              src="/errors/402.png"
              alt=""
              aria-hidden
              onError={() => setImgOk(false)}
              className="h-28 w-auto"
              style={{ display: imgOk ? undefined : 'none' }}
              draggable={false}
            />
            {!imgOk && (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-white">
                <Lock className="h-7 w-7 text-ohmlet-gold-deep" />
              </span>
            )}
            <div>
              <p className="text-lg font-black text-ohmlet-ink">
                You have used all {liveCapMinutes} live minutes on the {PLAN_META[plan].label} plan this month.
              </p>
              <p className="mt-1.5 text-sm font-semibold text-ohmlet-ink-soft">
                Your lessons, sandbox, and community stay open, and live resets at the start of next month. Learners who
                upgrade go hands-on far more often, which is where it really sticks.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 px-7 py-6 sm:flex-row sm:justify-center">
            <button
              onClick={onUpgrade}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 text-base font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none sm:w-auto"
            >
              Upgrade to {upgradeTo.label} for {upgradeLine}
            </button>
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
              {!unlimited && ` ${Math.floor(liveMinutesRemaining)} of ${liveCapMinutes} min left this month.`}
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
            <span
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-black ${
                lowTime ? 'border-ohmlet-red bg-[#fdece8] text-ohmlet-red' : 'border-ohmlet-line bg-white text-ohmlet-ink-soft'
              }`}
            >
              {Math.floor(liveMinutesRemaining)} min left this month
            </span>
          )}
          {lowTime && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-3 py-1.5 text-xs font-black text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
            >
              Upgrade
            </button>
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

          {/* Kit check (#33): the inventory stage verifies parts via the camera. */}
          {stage === 'inventory' && verifierConfigured() && (
            <KitCheck build={build} camOn={camOn} grabFrame={grabFrame} />
          )}

          {/* 3D twin (#31): the post-session artifact, captured from the finished build. */}
          {stage === 'test' && reporterConfigured() && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-ohmlet-line bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="text-sm font-black tracking-tight text-ohmlet-ink">Capture a 3D twin</p>
                <p className="mt-0.5 text-xs font-semibold text-ohmlet-ink-soft">
                  Turn your finished build into a 3D model you can keep and spin.
                </p>
              </div>
              <button
                type="button"
                onClick={captureTwin}
                disabled={!camOn || twinBusy}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-3.5 py-2 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {twinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" strokeWidth={2.5} />}
                {twinBusy ? 'Capturing' : 'Create twin'}
              </button>
            </div>
          )}
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

      {twinFrame && (
        <TwinStudio
          imageBase64={twinFrame}
          title={build.title}
          buildId={build.title}
          sessionId={sessionId}
          onClose={() => setTwinFrame(null)}
          onUpgrade={onUpgrade}
        />
      )}
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

// ── Kit check (#33) ──
// The inventory stage's camera verification: grab a still of the bench, ask the
// vision-verifier to confirm the parts, and show a per-part checklist. A real,
// working interaction — not a static cue.

const STATUS_META: Record<PartStatus['status'], { icon: React.ComponentType<{ className?: string }>; tint: string; ring: string }> = {
  present: { icon: CheckCircle2, tint: 'text-ohmlet-green', ring: 'border-ohmlet-green/30 bg-[#eafaf0]' },
  missing: { icon: XCircle, tint: 'text-ohmlet-red', ring: 'border-ohmlet-red/30 bg-[#fdece8]' },
  unsure: { icon: CircleHelp, tint: 'text-ohmlet-gold-deep', ring: 'border-ohmlet-gold/40 bg-ohmlet-gold-soft' },
};

const KitCheck: React.FC<{
  build: (typeof BUILD_LIBRARY)[number];
  camOn: boolean;
  grabFrame: (maxWidth?: number) => Promise<string | null>;
}> = ({ build, camOn, grabFrame }) => {
  const [phase, setPhase] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<InventoryResult | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setPhase('checking');
    setError('');
    const frame = await grabFrame();
    if (!frame) {
      setError('Turn the camera on and point it at your parts, then run the check.');
      setPhase('error');
      return;
    }
    try {
      const res = await verifyInventory(frame, build.parts, build.title);
      setResult(res);
      setPhase('done');
    } catch (e) {
      setError(e instanceof VerifierError ? e.message : "Couldn't check your kit just now. Please try again.");
      setPhase('error');
    }
  };

  const presentCount = result?.parts.filter((p) => p.status === 'present').length ?? 0;

  return (
    <div className="mt-4 overflow-hidden rounded-[1.4rem] border-2 border-ohmlet-line bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-ohmlet-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ohmlet-ink">
            <ScanLine className="h-4 w-4 text-ohmlet-gold" />
          </span>
          <div>
            <h3 className="text-sm font-black tracking-tight leading-none">Kit check</h3>
            {result && (
              <p className="mt-1 text-[11px] font-bold text-ohmlet-ink-soft">
                {presentCount} of {result.parts.length} parts spotted
              </p>
            )}
          </div>
        </div>
        {result && (
          <span
            className={`rounded-full border-2 px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
              result.ready ? 'border-ohmlet-green bg-[#eafaf0] text-ohmlet-green' : 'border-ohmlet-gold bg-ohmlet-gold-soft text-ohmlet-gold-deep'
            }`}
          >
            {result.ready ? 'Ready to wire' : 'Almost there'}
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm font-semibold text-ohmlet-ink-soft">
              Lay your parts out where the camera can see them, then scan to confirm your kit.
            </p>
            <button
              onClick={run}
              disabled={!camOn}
              className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-5 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-40"
            >
              <ScanLine className="h-4 w-4" /> Scan my parts
            </button>
            {!camOn && <p className="text-[11px] font-bold text-ohmlet-ink-soft">Turn the camera on first.</p>}
          </div>
        )}

        {phase === 'checking' && (
          <div className="flex items-center justify-center gap-2.5 py-6 text-sm font-bold text-ohmlet-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin text-ohmlet-gold-deep" /> Checking your kit...
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm font-semibold text-ohmlet-red">{error}</p>
            <button
              onClick={run}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-4 py-2 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ohmlet-ink">{result.feedback}</p>
            <ul className="space-y-2">
              {result.parts.map((p) => {
                const meta = STATUS_META[p.status];
                const Icon = meta.icon;
                return (
                  <li key={p.name} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${meta.ring}`}>
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tint}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ohmlet-ink">{p.name}</p>
                      {p.note && <p className="text-[11px] font-semibold text-ohmlet-ink-soft">{p.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {result.found_extras.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ohmlet-ink-soft">Also spotted</span>
                {result.found_extras.map((e) => (
                  <span key={e} className="rounded-full border border-ohmlet-line bg-ohmlet-cream px-2 py-0.5 text-[11px] font-bold text-ohmlet-ink-soft">
                    {e}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={run}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-4 py-2 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
            >
              <RefreshCw className="h-4 w-4" /> Scan again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
