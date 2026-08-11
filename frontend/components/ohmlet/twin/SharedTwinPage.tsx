import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, Eye, Loader2, Rotate3d } from 'lucide-react';
import { OhmletLogo } from '../../Logo';
import { track } from '../../../services/analytics';
import {
  fetchSharedTwin,
  reporterConfigured,
  sharedModelUrl,
  type SharedTwin,
} from '../../../services/reporter';

// Three.js is heavy: only pull it in once we know there is a twin to show.
const TwinViewer = lazy(() => import('./TwinViewer'));

type Phase = 'loading' | 'ready' | 'missing';

interface SharedTwinPageProps {
  shareId: string;
  onStart: () => void;
  onHome: () => void;
}

// ── The public build page (#79) ──
//
// Anyone with the link can see a finished build spinning in 3D, with no account
// and no auth. This is the surface that travels: for most visitors it is the
// first time they ever see Ohmlet, so it has to carry the brand and convert,
// not just render a mesh.
export const SharedTwinPage: React.FC<SharedTwinPageProps> = ({ shareId, onStart, onHome }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [twin, setTwin] = useState<SharedTwin | null>(null);

  useEffect(() => {
    let live = true;
    if (!reporterConfigured()) {
      setPhase('missing');
      return;
    }
    void (async () => {
      const found = await fetchSharedTwin(shareId);
      if (!live) return;
      if (found) {
        setTwin(found);
        setPhase('ready');
        track('shared_twin_view');
      } else {
        setPhase('missing');
      }
    })();
    return () => {
      live = false;
    };
  }, [shareId]);

  const start = () => {
    track('shared_twin_cta');
    onStart();
  };

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display">
      {/* Slim public bar: the mark goes home, the button converts. */}
      <header className="sticky top-0 z-30 border-b-2 border-ohmlet-ink/10 bg-ohmlet-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onHome}
            aria-label="Ohmlet home"
            className="rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ohmlet-ink"
          >
            <OhmletLogo height={30} />
          </button>
          <button
            type="button"
            onClick={start}
            className="rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
          >
            Start building
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {phase === 'missing' ? (
          <NotFound onStart={start} />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-ohmlet-ink">
                <Eye className="h-3.5 w-3.5" strokeWidth={2.6} /> A real build
              </span>
              <span className="text-sm font-bold text-ohmlet-ink-soft">
                Made on Ohmlet, captured from the bench
              </span>
            </div>

            {/* The model is the hero: it dominates, controls sit on top of it. */}
            <section className="relative overflow-hidden rounded-[1.75rem] border-2 border-ohmlet-ink bg-ohmlet-ink shadow-press">
              <div className="relative h-[46vh] min-h-[320px] w-full sm:h-[58vh]">
                {phase === 'ready' ? (
                  <Suspense fallback={<Stage label="Loading the build" spin />}>
                    <TwinViewer src={sharedModelUrl(shareId)} className="h-full w-full" margin={1.7} />
                    <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur">
                      <Rotate3d className="h-3.5 w-3.5" strokeWidth={2.6} /> Drag to spin
                    </span>
                  </Suspense>
                ) : (
                  <Stage label="Loading the build" spin />
                )}
              </div>

              {/* Caption bar, welded to the stage rather than floating as its own card. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ohmlet-ink bg-white px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black tracking-[-0.01em] text-ohmlet-ink sm:text-2xl">
                    {twin?.title || 'A finished build'}
                  </h1>
                  <p className="text-xs font-bold uppercase tracking-wide text-ohmlet-ink-soft">
                    3D digital twin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={start}
                  className="group inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
                >
                  Build yours
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.8}
                  />
                </button>
              </div>
            </section>

            <Pitch onStart={start} />
          </>
        )}
      </main>
    </div>
  );
};

// The dark stage placeholder, used while the mesh loads. Deliberately the same
// ink as the viewer background so there is no flash when the model arrives.
const Stage: React.FC<{ label: string; spin?: boolean }> = ({ label, spin }) => (
  <div
    className="flex h-full flex-col items-center justify-center gap-3 bg-ohmlet-ink"
    role="status"
    aria-live="polite"
  >
    <Loader2
      className={`h-7 w-7 text-ohmlet-gold ${spin ? 'motion-safe:animate-spin' : ''}`}
      strokeWidth={2.4}
    />
    <p className="text-sm font-black text-white">{label}</p>
  </div>
);

// The conversion beat: what this thing is, then the ask. Three plain steps, laid
// out as a numbered strip so it reads as a process, not three identical cards.
const Pitch: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <section className="mt-12">
    <h2 className="text-2xl font-black tracking-[-0.01em] text-ohmlet-ink sm:text-3xl">
      This was built with a tutor watching
    </h2>
    <p className="mt-2 max-w-2xl text-base font-semibold leading-relaxed text-ohmlet-ink-soft">
      Ohmlet is a live tutor for electronics. It sees your breadboard through your camera, talks you
      through the wiring, and catches the mistake before you power anything on.
    </p>

    <ol className="mt-8 grid gap-4 sm:grid-cols-3">
      {[
        { n: '1', t: 'Point your camera', d: 'It checks your parts and your wiring as you go.' },
        { n: '2', t: 'Build it for real', d: 'Voice guidance, step by step, correcting you mid-build.' },
        { n: '3', t: 'Keep the twin', d: 'Finish, and your circuit becomes a 3D model like this one.' },
      ].map((s) => (
        <li key={s.n} className="flex gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold-soft text-sm font-black text-ohmlet-ink">
            {s.n}
          </span>
          <div>
            <p className="text-base font-black text-ohmlet-ink">{s.t}</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>

    <div className="mt-10 flex flex-col items-start gap-4 rounded-[1.5rem] border-2 border-ohmlet-ink bg-white px-6 py-7 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div>
        <p className="text-xl font-black tracking-[-0.01em] text-ohmlet-ink sm:text-2xl">
          Build your first circuit today
        </p>
        <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">
          Start free. No kit? Build it in the simulator first.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="group inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black text-ohmlet-ink shadow-press transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
      >
        Start building
        <ArrowRight
          className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.8}
        />
      </button>
    </div>
  </section>
);

// A real, on-brand dead end: the link expired or the owner unshared it. Never a
// bare grey box, and it still offers the way in.
const NotFound: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="mx-auto flex max-w-md flex-col items-center px-2 py-14 text-center">
    <img src="/mascot/oops.png" alt="" aria-hidden className="h-28 w-auto" draggable={false} />
    <h1 className="mt-5 text-2xl font-black tracking-[-0.01em] text-ohmlet-ink">
      This build isn't shared anymore
    </h1>
    <p className="mt-2 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">
      The link may have expired, or the person who made it turned sharing off. The good news is you
      can build one of your own.
    </p>
    <button
      type="button"
      onClick={onStart}
      className="group mt-7 inline-flex items-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-6 py-3 text-base font-black text-ohmlet-ink shadow-press transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
    >
      Start building
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.8} />
    </button>
  </div>
);

export default SharedTwinPage;
