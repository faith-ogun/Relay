import React, { useCallback, useEffect, useState } from 'react';
import { Beaker, Lock, Play, X } from 'lucide-react';
import { fetchFilm, fetchLabs, type FilmUrls, type LabsStatus } from '../../../services/careerLabs';
import { getManifest, type Manifest } from '../../../services/curriculum';

/**
 * Ohmlet Labs, and the lesson films.
 *
 * Labs is features that work but are not finished: switched on early for the
 * people paying most, and graduating to everyone once they hold up.
 *
 * Two states, and the second matters as much as the first. A learner WITHOUT
 * early access still gets a populated screen showing what is in Labs and what it
 * costs to get in. An empty screen reads as broken, and hiding the thing you are
 * selling is a strange way to sell it.
 *
 * The films are behind the `lesson-films` lab. Their URLs are V4-signed and
 * expire in thirty minutes, so they are fetched when the learner presses play
 * and never cached: a cached signed URL is one that outlives the reason it was
 * short-lived.
 */

/** Review and gateway skills have no film: the unit boss covers that ground. */
const hasFilm = (skillId: string) => !skillId.endsWith('-check') && !skillId.endsWith('-gateway');

interface Props {
  /** Absent when the workspace has no upgrade route wired (child-safe shells). */
  onUpgrade?: () => void;
}

export const LabsView: React.FC<Props> = ({ onUpgrade }) => {
  const [status, setStatus] = useState<LabsStatus | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<{ skillId: string; title: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchLabs(), getManifest()])
      .then(([labs, m]) => {
        if (!alive) return;
        if (labs.ok) setStatus(labs.data);
        setManifest(m);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filmsOn = !!status?.labs.some((l) => l.id === 'lesson-films');

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-ohmlet-line/60" />)}
      </div>
    );
  }

  return (
    <div className="ohmlet-rise mx-auto max-w-3xl">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Ohmlet</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Labs.</h1>
      <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
        Features that work but are not finished. Max gets them first, and they open
        to everyone once they hold up.
      </p>

      {!status && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-ohmlet-line px-5 py-6 text-center">
          <p className="text-sm font-semibold text-ohmlet-ink-soft">
            Labs could not be reached just now. Reload and it will try again.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {status?.labs.map((lab) => (
          <section key={lab.id} className="overflow-hidden rounded-[1.5rem] border-2 border-ohmlet-ink bg-white shadow-press">
            <div className="flex items-center gap-3 border-b-2 border-ohmlet-ink bg-ohmlet-gold-soft px-5 py-3">
              <Beaker className="h-4 w-4 shrink-0 text-ohmlet-gold-deep" strokeWidth={2.5} />
              <h2 className="flex-1 text-base font-black tracking-tight">{lab.title}</h2>
              {lab.earlyAccess && (
                <span className="rounded-full bg-ohmlet-ink px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-gold">
                  Early access
                </span>
              )}
            </div>
            <div className="px-5 py-4">
              <p className="text-sm font-semibold leading-relaxed text-ohmlet-ink">{lab.blurb}</p>
              {/* Always shown. Early access to a rough feature is only a privilege
                  if you are told which part is rough. */}
              <div className="mt-3 rounded-xl border-2 border-dashed border-ohmlet-line px-3.5 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ohmlet-ink-soft">Still rough</p>
                <p className="mt-1 text-xs font-semibold leading-snug text-ohmlet-ink-soft">{lab.rough}</p>
              </div>
            </div>
          </section>
        ))}

        {status?.comingToEveryone.map((lab) => (
          <section key={lab.id} className="rounded-[1.5rem] border-2 border-ohmlet-line bg-ohmlet-cream px-5 py-4 shadow-soft">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 shrink-0 text-ohmlet-ink-soft" strokeWidth={2.5} />
              <h2 className="flex-1 text-base font-black tracking-tight text-ohmlet-ink-soft">{lab.title}</h2>
              <span className="rounded-full border-2 border-ohmlet-line bg-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-ink-soft">
                Max
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{lab.blurb}</p>
            {onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="mt-3 rounded-xl border-2 border-ohmlet-ink bg-white px-4 py-2 text-sm font-black text-ohmlet-ink transition-all hover:-translate-y-0.5"
              >
                See Max
              </button>
            )}
          </section>
        ))}
      </div>

      {filmsOn && manifest && (
        <section className="mt-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">The films</h2>
          <p className="mt-1 max-w-xl text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
            One short film per skill, on the idea the lesson is built around.
          </p>
          <div className="mt-4 space-y-6">
            {manifest.units.map((unit) => {
              const skills = unit.skills.filter((sk) => hasFilm(sk.id));
              if (!skills.length) return null;
              return (
                <div key={unit.id}>
                  <h3 className="text-xs font-black uppercase tracking-wide text-ohmlet-ink">{unit.title}</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {skills.map((sk) => (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => setPlaying({ skillId: sk.id, title: sk.title })}
                        className="group flex items-center gap-3 rounded-xl border-2 border-ohmlet-line bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-ohmlet-ink"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ohmlet-ink text-ohmlet-gold transition-colors group-hover:bg-ohmlet-gold group-hover:text-ohmlet-ink">
                          <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                        </span>
                        <span className="truncate text-sm font-extrabold">{sk.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {playing && (
        <FilmModal skillId={playing.skillId} title={playing.title} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
};

/**
 * The player.
 *
 * The signed URL is fetched here, on open, and thrown away on close. Captions
 * ship with every film and default to on: these are explanatory films watched on
 * a bench, often next to something that is buzzing.
 */
const FilmModal: React.FC<{ skillId: string; title: string; onClose: () => void }> = ({ skillId, title, onClose }) => {
  const [urls, setUrls] = useState<FilmUrls | null>(null);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchFilm(skillId).then((r) => {
      if (!alive) return;
      if (r.ok) setUrls(r.data);
      else setFailure('That film could not be loaded just now.');
    });
    return () => { alive = false; };
  }, [skillId]);

  const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ohmlet-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} film`}
      onClick={onClose}
    >
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 pb-3">
          <h2 className="flex-1 text-lg font-black tracking-tight text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/25 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {failure ? (
          <p className="rounded-2xl bg-white px-5 py-6 text-center text-sm font-semibold text-ohmlet-ink-soft">{failure}</p>
        ) : urls ? (
          <video
            className="w-full rounded-2xl border-2 border-white/20 bg-black"
            src={urls.video.web}
            poster={urls.poster.web}
            controls
            autoPlay
            crossOrigin="anonymous"
          >
            <track kind="captions" src={urls.captions} srcLang="en" label="English" default />
          </video>
        ) : (
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/10" />
        )}
      </div>
    </div>
  );
};
