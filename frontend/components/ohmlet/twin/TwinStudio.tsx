import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Loader2, Rotate3d, Sparkles, X } from 'lucide-react';
import { generateTwin, fetchTwinModelUrl, ReporterError, type Twin } from '../../../services/reporter';
import { track } from '../../../services/analytics';
import { useDialog } from '../../../hooks/useDialog';

// Three.js viewer is heavy — load it only when a twin is ready to show.
const TwinViewer = lazy(() => import('./TwinViewer'));

type Phase = 'generating' | 'ready' | 'error' | 'quota';

interface TwinStudioProps {
  /** Base64 still of the finished build (no data: prefix). */
  imageBase64: string;
  title?: string;
  sessionId?: string;
  buildId?: string;
  onClose: () => void;
  onUpgrade?: () => void;
}

// TwinStudio (#31): turns the captured build photo into a 3D digital twin and
// shows it in an interactive viewer. Honest states throughout — a real spinner
// while the mesh generates, a real error if it fails, an upgrade path on quota.
export const TwinStudio: React.FC<TwinStudioProps> = ({
  imageBase64,
  title,
  sessionId,
  buildId,
  onClose,
  onUpgrade,
}) => {
  const [phase, setPhase] = useState<Phase>('generating');
  const [twin, setTwin] = useState<Twin | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const panelRef = useDialog<HTMLDivElement>(onClose);
  const startedRef = useRef(false);
  const urlRef = useRef<string | null>(null);

  const run = useCallback(async () => {
    setPhase('generating');
    setError('');
    try {
      const created = await generateTwin(imageBase64, { title, sessionId, buildId });
      setTwin(created);
      const url = await fetchTwinModelUrl(created.id);
      if (!url) throw new ReporterError('The twin was created but could not be loaded.', 500);
      urlRef.current = url;
      setModelUrl(url);
      setPhase('ready');
      track('twin_generated', { build_id: buildId });
    } catch (e) {
      const err = e as ReporterError;
      if (err.status === 402) {
        setPhase('quota');
      } else {
        setError(err.message || 'Something went wrong generating your twin.');
        setPhase('error');
      }
    }
  }, [imageBase64, title, sessionId, buildId]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
  }, [run]);

  // Release the object URL when the studio closes.
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ohmlet-ink/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="twin-studio-title"
        className="relative w-full max-w-lg overflow-hidden rounded-[1.75rem] border-2 border-ohmlet-ink bg-white shadow-press motion-safe:animate-[ohmlet-scale-in_220ms_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close 3D twin"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/85 p-1.5 text-ohmlet-ink/70 backdrop-blur transition-colors hover:bg-white hover:text-ohmlet-ink"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {/* Stage: viewer when ready, status panel otherwise */}
        <div className="relative h-72 w-full border-b-2 border-ohmlet-ink bg-ohmlet-slate-900">
          {phase === 'ready' && modelUrl ? (
            <Suspense
              fallback={
                <StatusPanel icon={Loader2} spin title="Loading your twin" sub="Almost there." />
              }
            >
              <TwinViewer src={modelUrl} className="h-full w-full" />
              <span className="pointer-events-none absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
                <Rotate3d className="h-3 w-3" /> Drag to spin
              </span>
            </Suspense>
          ) : phase === 'generating' ? (
            <StatusPanel
              icon={Sparkles}
              spin
              title="Sculpting your 3D twin"
              sub="Turning your finished build into a model you can spin. This takes a few seconds."
            />
          ) : phase === 'quota' ? (
            <StatusPanel icon={Box} title="You're out of twins this month" sub="Upgrade to turn more builds into 3D models." />
          ) : (
            <StatusPanel icon={Box} title="Couldn't generate the twin" sub={error} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p id="twin-studio-title" className="truncate text-lg font-black tracking-[-0.01em] text-ohmlet-ink">
              {twin?.title || title || 'Your build'}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-ohmlet-ink-soft">3D digital twin</p>
          </div>
          <div className="flex shrink-0 gap-2.5">
            {phase === 'error' && (
              <button
                type="button"
                onClick={() => void run()}
                className="rounded-xl border-2 border-ohmlet-ink bg-white px-4 py-2.5 text-sm font-extrabold text-ohmlet-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Try again
              </button>
            )}
            {phase === 'quota' && onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
              >
                See plans
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusPanel: React.FC<{ icon: React.ElementType; title: string; sub: string; spin?: boolean }> = ({
  icon: Icon,
  title,
  sub,
  spin,
}) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
    <Icon className={`h-8 w-8 text-ohmlet-gold ${spin ? 'animate-spin' : ''}`} strokeWidth={2.2} />
    <p className="text-base font-black text-white">{title}</p>
    {sub && <p className="max-w-sm text-sm font-semibold leading-relaxed text-white/70">{sub}</p>}
  </div>
);
