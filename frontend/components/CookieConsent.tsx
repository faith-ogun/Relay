import React, { useCallback, useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { getConsent, hasDecided, onOpenSettings, setConsent } from '../services/cookieConsent';

interface CookieConsentProps {
  /** Open the full Cookie Policy (SPA navigation handled by the host). */
  onOpenPolicy: () => void;
}

// Global cookie banner (#37). Shown on first visit until the user accepts or
// rejects analytics cookies, and re-openable later from the footer. Rejecting is
// exactly as easy as accepting (same size, same prominence), and analytics
// cookies stay off until opt-in, as our Cookie Policy promises.
export const CookieConsent: React.FC<CookieConsentProps> = ({ onOpenPolicy }) => {
  const [open, setOpen] = useState(false);
  // True when re-opened from the footer to change an existing choice: only then
  // do we allow dismissing without choosing (the prior choice still stands).
  const [revisiting, setRevisiting] = useState(false);
  const [entered, setEntered] = useState(false);

  // First visit: ask only if no choice is stored yet.
  useEffect(() => {
    if (!hasDecided()) setOpen(true);
  }, []);

  // Footer "Cookie settings" re-opens the banner to change a previous choice.
  useEffect(
    () =>
      onOpenSettings(() => {
        setRevisiting(true);
        setOpen(true);
      }),
    [],
  );

  // Drive the slide-up entrance on each open.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = useCallback(() => {
    setEntered(false);
    window.setTimeout(() => {
      setOpen(false);
      setRevisiting(false);
    }, 220);
  }, []);

  const decide = useCallback(
    (analytics: boolean) => {
      setConsent(analytics);
      close();
    },
    [close],
  );

  // When revisiting, Escape dismisses without changing the stored choice.
  useEffect(() => {
    if (!open || !revisiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, revisiting, close]);

  if (!open) return null;

  const current = getConsent();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4 sm:px-6 sm:pb-6"
      role="dialog"
      aria-modal="false"
      aria-label="Cookie choices"
    >
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-ohmlet-ink bg-ohmlet-cream shadow-press transition-all duration-300 ease-out ${
          entered ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        {/* Gold rail — a small signature accent, not a flat card edge. */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-ohmlet-gold" aria-hidden />

        {revisiting && (
          <button
            type="button"
            onClick={close}
            aria-label="Close cookie settings"
            className="absolute right-3 top-3.5 rounded-full p-1.5 text-ohmlet-ink/70 transition-colors hover:bg-ohmlet-ink/10 hover:text-ohmlet-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          {/* Icon badge */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold shadow-press-sm">
            <Cookie className="h-6 w-6 text-ohmlet-ink" strokeWidth={2.5} />
          </div>

          {/* Copy */}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold leading-tight text-ohmlet-ink">
              We use cookies to keep Ohmlet working
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-ohmlet-ink-soft">
              Essential cookies keep you signed in and secure. With your permission, we also use analytics to
              understand how the app is used so we can improve it. No ads, and we never sell your data.{' '}
              <button
                type="button"
                onClick={onOpenPolicy}
                className="font-bold text-ohmlet-ink underline decoration-ohmlet-gold-deep decoration-2 underline-offset-2 transition-colors hover:text-ohmlet-gold-deep"
              >
                Read our Cookie Policy
              </button>
            </p>
          </div>

          {/* Choices — reject is exactly as prominent as accept. */}
          <div className="flex shrink-0 gap-2.5 sm:flex-col-reverse sm:gap-2 lg:flex-row">
            <button
              type="button"
              onClick={() => decide(false)}
              className="flex-1 whitespace-nowrap rounded-xl border-2 border-ohmlet-ink bg-white px-5 py-2.5 text-sm font-extrabold text-ohmlet-ink transition-all hover:-translate-y-0.5 hover:bg-ohmlet-cream active:translate-y-0 sm:flex-none"
            >
              Reject non-essential
            </button>
            <button
              type="button"
              onClick={() => decide(true)}
              className="flex-1 whitespace-nowrap rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-5 py-2.5 text-sm font-extrabold text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none sm:flex-none"
            >
              Accept all
            </button>
          </div>
        </div>

        {revisiting && current && (
          <p className="border-t-2 border-ohmlet-ink/10 px-6 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ohmlet-ink-soft">
            Current choice: analytics {current.analytics ? 'allowed' : 'off'}
          </p>
        )}
      </div>
    </div>
  );
};
