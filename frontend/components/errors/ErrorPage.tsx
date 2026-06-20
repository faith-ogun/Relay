import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * ErrorPage — the designed, on-brand 404 / 403 / 402 states (#58).
 *
 *   404  unknown route (a mistyped or sneaky URL)
 *   403  signed in, but not allowed here (e.g. a non-admin hitting /author)
 *   402  payment required (a premium feature without the plan) — wired fully
 *        once entitlements (#56) land
 *
 * Each uses a mascot mood from /public/mascot. Custom art (lost/stop/locked)
 * drops in over time; until then the existing expressions stand in.
 */

export type ErrorVariant = 404 | 403 | 402;

interface ErrorPageProps {
  variant: ErrorVariant;
  onHome: () => void;
  onPrimary?: () => void; // workspace / upgrade / log in
}

const CONTENT: Record<
  ErrorVariant,
  { code: string; mascot: string; fallback: string; title: string; body: string; primary?: string }
> = {
  404: {
    code: '404',
    mascot: '/mascot/lost.png',
    fallback: '/mascot/think.png',
    title: 'This wire leads nowhere',
    body: "We couldn't find that page. It may have moved, or the address has a typo.",
    primary: 'Back to home',
  },
  403: {
    code: '403',
    mascot: '/mascot/stop.png',
    fallback: '/mascot/oops.png',
    title: 'This bench is off-limits',
    body: "You're signed in, but this area isn't part of your account.",
    primary: 'Go to my workspace',
  },
  402: {
    code: '402',
    mascot: '/mascot/locked.png',
    fallback: '/mascot/encourage.png',
    title: 'That feature is on a higher plan',
    body: 'Upgrade to unlock this, or keep building with everything on your current plan.',
    primary: 'See plans',
  },
};

export const ErrorPage: React.FC<ErrorPageProps> = ({ variant, onHome, onPrimary }) => {
  const c = CONTENT[variant];
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ohmlet-cream px-6 font-display">
      <div className="ohmlet-rise w-full max-w-md text-center">
        <img
          src={imgOk ? c.mascot : c.fallback}
          alt=""
          aria-hidden
          onError={() => setImgOk(false)}
          className="mx-auto h-40 w-auto"
          draggable={false}
        />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-ohmlet-ink-soft">Error {c.code}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ohmlet-ink">{c.title}</h1>
        <p className="mt-3 text-sm font-semibold text-ohmlet-ink-soft">{c.body}</p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {onPrimary && c.primary && (
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
            >
              {c.primary}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onHome}
            className="inline-flex items-center gap-1.5 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </button>
        </div>
      </div>
    </div>
  );
};
