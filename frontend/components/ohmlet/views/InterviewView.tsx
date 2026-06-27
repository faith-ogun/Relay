import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase, ChevronRight, FileText, History, Loader2, Lock, Mic, MicOff, PhoneOff, Radio, Sparkles, Upload, Video, VideoOff,
} from 'lucide-react';
import { useLiveBridge } from '../../../hooks/useLiveBridge';
import { useIdentity } from '../../../hooks/useIdentity';
import { usePlan } from '../../../hooks/usePlan';
import { track } from '../../../services/analytics';
import {
  extractResume, fileToBase64, generateReport, getReport, listReports, InterviewError,
  type InterviewContext, type InterviewReport, type ReportListItem, type TranscriptTurn,
} from '../../../services/interview';
import { InterviewReportView } from '../interview/InterviewReportView';

/**
 * InterviewView (#21) — the Max-tier voice mock-interview coach. Setup (role + JD
 * + CV) -> a live adaptive voice interview with a real interviewer persona -> a
 * detailed feedback report that routes back into Ohmlet's lessons. A practice
 * coach that judges engineering substance, never a live cheat tool.
 */

interface InterviewViewProps {
  onUpgrade?: () => void;
  onOpenLessons?: () => void;
}

type Phase = 'setup' | 'live' | 'generating' | 'report' | 'error';
const SENIORITY = [
  { v: 'intern', label: 'Intern / apprentice' },
  { v: 'new-grad', label: 'New grad (0-2 yr)' },
  { v: 'mid', label: 'Mid (2-6 yr)' },
  { v: 'senior', label: 'Senior / staff (6+ yr)' },
];

export const InterviewView: React.FC<InterviewViewProps> = ({ onUpgrade, onOpenLessons }) => {
  const { userId } = useIdentity();
  const { can } = usePlan(userId);
  const allowed = can('interview');

  const wsUrl = useMemo(() => (import.meta.env.VITE_OHMLET_WS_URL || 'ws://localhost:8082').replace(/\/$/, ''), []);
  const sessionId = useRef(`intv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;

  const [phase, setPhase] = useState<Phase>('setup');
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('mid');
  const [jd, setJd] = useState('');
  const [cv, setCv] = useState('');
  const [warmup, setWarmup] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [history, setHistory] = useState<ReportListItem[]>([]);
  const [openingPast, setOpeningPast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load past reports whenever we land on setup (refreshes after a new interview).
  useEffect(() => {
    if (phase !== 'setup' || !allowed) return;
    let alive = true;
    listReports().then((h) => alive && setHistory(h));
    return () => {
      alive = false;
    };
  }, [phase, allowed]);

  const openPast = useCallback(async (id: string) => {
    setOpeningPast(true);
    const res = await getReport(id);
    setOpeningPast(false);
    if (res?.report) {
      setReport(res.report);
      setPhase('report');
    }
  }, []);

  const ctx: InterviewContext = useMemo(
    () => ({ role: role.trim(), seniority, jobDescription: jd.trim(), resume: cv.trim(), warmup }),
    [role, seniority, jd, cv, warmup],
  );

  // Prime the interviewer right after auth (correct frame ordering via onReady).
  const onReady = useCallback(
    (sendJson: (o: unknown) => void) => {
      sendJson({ type: 'interview_context', ...ctx });
    },
    [ctx],
  );

  const live = useLiveBridge({ wsUrl, userId, sessionId, mode: 'interview', onReady });
  const { state, micOn, camOn, transcripts, connect, disconnect, toggleMic, toggleCam, videoRef } = live;
  const connected = state === 'connected';

  const onUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setFormError('');
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const { text } = await extractResume(b64, file.name);
      setCv(text);
    } catch (e) {
      setFormError(e instanceof InterviewError ? e.message : 'Could not read that file. Try pasting your CV instead.');
    } finally {
      setUploading(false);
    }
  }, []);

  const start = useCallback(() => {
    if (!role.trim() && !jd.trim()) {
      setFormError('Add a role or paste a job description so the interview can be tailored.');
      return;
    }
    setFormError('');
    track('interview_start', { warmup, has_jd: !!jd.trim(), has_cv: !!cv.trim() });
    setPhase('live');
    connect();
  }, [role, jd, cv, warmup, connect]);

  const endAndScore = useCallback(async () => {
    disconnect();
    const turns: TranscriptTurn[] = transcripts
      .filter((t) => t.role === 'agent' || t.role === 'user')
      .map((t) => ({ role: t.role === 'agent' ? 'interviewer' : 'candidate', text: t.text }));
    if (turns.length < 2) {
      // Nothing to score (ended immediately) — back to setup.
      setPhase('setup');
      return;
    }
    setPhase('generating');
    try {
      const { report: rep } = await generateReport(turns, ctx);
      setReport(rep);
      setPhase('report');
      track('interview_complete', { overall: rep.overall, warmup });
    } catch {
      setPhase('error');
    }
  }, [disconnect, transcripts, ctx, warmup]);

  // ── Max gate ──
  if (!allowed) {
    return (
      <div className="ohmlet-rise mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold shadow-press-sm">
          <Lock className="h-7 w-7 text-ohmlet-ink" strokeWidth={2.5} />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.02em]">Interview Mode is a Max feature</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-ohmlet-ink-soft">
          Run realistic voice mock interviews tuned to a job description and your CV, with a detailed
          feedback report that maps straight back to your lessons.
        </p>
        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-3 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
          >
            <Sparkles className="h-4 w-4" /> Upgrade to Max
          </button>
        )}
      </div>
    );
  }

  // ── Report ──
  if (phase === 'report' && report) {
    return (
      <div className="ohmlet-rise">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Interview Mode</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Your feedback report.</h1>
        <div className="mt-6">
          <InterviewReportView
            report={report}
            onRetry={() => { setReport(null); setPhase('setup'); }}
            onOpenLessons={onOpenLessons}
          />
        </div>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className="ohmlet-rise flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Loader2 className="h-9 w-9 animate-spin text-ohmlet-gold-deep" />
        <p className="mt-4 text-lg font-black text-ohmlet-ink">Scoring your interview</p>
        <p className="mt-1 max-w-sm text-sm font-semibold text-ohmlet-ink-soft">
          Quinn is writing up honest, specific feedback and the stronger answers. One moment.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="ohmlet-rise flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-lg font-black text-ohmlet-ink">We couldn't generate the report</p>
        <p className="mt-1 max-w-sm text-sm font-semibold text-ohmlet-ink-soft">Your interview happened, but scoring failed. Give it another go.</p>
        <button type="button" onClick={() => setPhase('setup')} className="mt-5 rounded-xl border-2 border-ohmlet-ink bg-white px-5 py-2.5 text-sm font-extrabold text-ohmlet-ink transition-all hover:-translate-y-0.5">
          Back to setup
        </button>
      </div>
    );
  }

  // ── Live session ──
  if (phase === 'live') {
    const convo = transcripts.filter((t) => t.role !== 'system');
    return (
      <div className="ohmlet-rise">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Interview in progress</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.02em]">{role || 'Mock interview'}{warmup ? ' · Warmup' : ''}</h1>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs font-black ${connected ? 'border-ohmlet-green bg-[#f2fae4] text-ohmlet-green-deep' : 'border-ohmlet-line text-ohmlet-ink-soft'}`}>
            <Radio className="h-3.5 w-3.5" /> {connected ? 'Live with Quinn' : 'Connecting…'}
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          {/* Presence + controls */}
          <div className="rounded-[1.6rem] border-2 border-ohmlet-ink bg-ohmlet-slate-900 p-4 text-white shadow-press-sm">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black/40">
              <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${camOn ? '' : 'hidden'}`} />
              {!camOn && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
                  <Mic className="h-8 w-8" />
                  <p className="text-xs font-bold uppercase tracking-wide">Voice interview · camera optional</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${micOn ? 'border-white/30 bg-white/10' : 'border-ohmlet-red bg-ohmlet-red/20'} text-white transition-colors`}>
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button type="button" onClick={toggleCam} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'} className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${camOn ? 'border-white/30 bg-white/10' : 'border-white/20 bg-transparent'} text-white transition-colors`}>
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
              <button type="button" onClick={endAndScore} className="inline-flex items-center gap-2 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none">
                <PhoneOff className="h-4 w-4" /> End + get feedback
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] font-semibold text-white/50">Speak naturally. Take your time to think. Quinn will not grade you out loud.</p>
          </div>

          {/* Transcript */}
          <div className="flex h-[520px] flex-col rounded-[1.6rem] border-2 border-ohmlet-line bg-white shadow-soft">
            <div className="flex items-center gap-2 border-b border-ohmlet-line px-5 py-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ohmlet-ink"><Briefcase className="h-4 w-4 text-ohmlet-gold" /></span>
              <h3 className="text-sm font-black tracking-tight">Conversation</h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {convo.length === 0 && (
                <p className="mt-8 text-center text-sm font-semibold text-ohmlet-ink-soft">Quinn will start once you are connected. Say hello when you are ready.</p>
              )}
              {convo.map((t, i) => {
                const mine = t.role === 'user';
                return (
                  <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-semibold leading-relaxed ${mine ? 'bg-ohmlet-gold text-ohmlet-ink' : 'border-2 border-ohmlet-line bg-ohmlet-cream text-ohmlet-ink'}`}>
                      <p className="mb-0.5 text-[10px] font-black uppercase tracking-wide opacity-60">{mine ? 'You' : 'Quinn'}</p>
                      {t.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup ──
  return (
    <div className="ohmlet-rise mx-auto max-w-2xl">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Interview Mode · Max</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Practice a real interview.</h1>
      <p className="mt-2 text-sm font-semibold text-ohmlet-ink-soft">
        Quinn runs a realistic voice interview tuned to the role and your CV, then gives you honest,
        specific feedback. This builds reps and kills nerves; it is practice, not a guarantee.
      </p>

      <div className="mt-6 space-y-5 rounded-[1.6rem] border-2 border-ohmlet-ink bg-white p-6 shadow-press-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">Target role</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Embedded Firmware Engineer"
              className="mt-1.5 w-full rounded-xl border-2 border-ohmlet-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ohmlet-ink outline-none transition-colors focus:border-ohmlet-ink"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">Seniority</span>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-2 border-ohmlet-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ohmlet-ink outline-none transition-colors focus:border-ohmlet-ink"
            >
              {SENIORITY.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">Job description</span>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={5}
            placeholder="Paste the job description so Quinn can grill you on what the role actually needs."
            className="mt-1.5 w-full resize-y rounded-xl border-2 border-ohmlet-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ohmlet-ink outline-none transition-colors focus:border-ohmlet-ink"
          />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">Your CV / resume</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-line px-3 py-1 text-xs font-black text-ohmlet-ink transition-colors hover:border-ohmlet-ink disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Reading…' : 'Upload PDF/DOCX'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => { void onUpload(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <textarea
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            rows={5}
            placeholder="Paste your CV, or upload a file above. Quinn will drill into your actual projects."
            className="mt-1.5 w-full resize-y rounded-xl border-2 border-ohmlet-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ohmlet-ink outline-none transition-colors focus:border-ohmlet-ink"
          />
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ohmlet-ink-soft">
            <FileText className="h-3 w-3" /> PDF, DOCX, or TXT. Files are validated for safety and used only to tailor your interview.
          </p>
        </div>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} className="h-4 w-4 accent-ohmlet-gold-deep" />
          <span className="text-sm font-semibold text-ohmlet-ink">
            Warmup mode — a gentler, unscored practice run to take the edge off.
          </span>
        </label>

        {formError && <p className="text-sm font-bold text-ohmlet-red">{formError}</p>}

        <button
          type="button"
          onClick={start}
          className="w-full rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-3.5 text-base font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
        >
          Start the interview
        </button>
      </div>

      {/* Past interviews (the longitudinal trend — deliberate practice is repeated). */}
      {history.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center gap-2 px-1">
            <History className="h-4 w-4 text-ohmlet-ink-soft" />
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Your past interviews</h2>
            <TrendChip history={history} />
          </div>
          <div className="mt-3 space-y-2.5">
            {history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => openPast(h.id)}
                disabled={openingPast}
                className="group flex w-full items-center gap-3 rounded-2xl border-2 border-ohmlet-line bg-white px-4 py-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-ohmlet-ink hover:shadow-press-sm disabled:opacity-60"
              >
                <ScoreRing score={h.overall ?? 0} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ohmlet-ink">{h.role || 'Mock interview'}</p>
                  <p className="text-xs font-bold text-ohmlet-ink-soft">{relTime(h.createdAt)}{h.seniority && h.seniority !== 'unknown' ? ` · ${h.seniority}` : ''}</p>
                </div>
                {openingPast ? <Loader2 className="h-4 w-4 animate-spin text-ohmlet-ink-soft" /> : <ChevronRight className="h-4 w-4 text-ohmlet-ink-soft transition-transform group-hover:translate-x-0.5" />}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Compact "best / latest" trend chip for the history header.
const TrendChip: React.FC<{ history: ReportListItem[] }> = ({ history }) => {
  const scored = history.filter((h) => typeof h.overall === 'number');
  if (scored.length < 2) return null;
  const latest = scored[0].overall ?? 0;
  const prev = scored[1].overall ?? 0;
  const delta = latest - prev;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${up ? 'bg-[#f2fae4] text-ohmlet-green-deep' : 'bg-[#fff1ef] text-ohmlet-red'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta)} vs last
    </span>
  );
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.max(0, Math.min(1, score / 5));
  const color = score >= 4 ? '#6fb519' : score >= 3 ? '#f5b800' : '#ff6f5e';
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${pct * 360}deg, var(--ohmlet-line, #ece7db) 0deg)` }}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
        <span className="text-xs font-black tabular-nums text-ohmlet-ink">{score || '–'}</span>
      </div>
    </div>
  );
};

function relTime(iso?: string): string {
  if (!iso) return 'recently';
  const then = new Date(iso).getTime();
  if (!then) return 'recently';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return new Date(iso).toLocaleDateString();
}
