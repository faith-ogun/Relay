import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchFilm, type FilmUrls } from '../../services/careerLabs';

/**
 * The player.
 *
 * The signed URL is fetched here, on open, and thrown away on close. Captions
 * ship with every film and default to on: these are explanatory films watched on
 * a bench, often next to something that is buzzing.
 */
export const FilmModal: React.FC<{ skillId: string; title: string; onClose: () => void }> = ({ skillId, title, onClose }) => {
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
          <p className="rounded-2xl bg-ohmlet-surface px-5 py-6 text-center text-sm font-semibold text-ohmlet-ink-soft">{failure}</p>
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
