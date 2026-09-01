import React, { useEffect, useState } from 'react';
import { ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
import type { AgeProfile } from './ageModel';
import { ParentNotice } from './ParentNotice';
import { PARENT_NOTICE } from './notices';
import { startConsent, confirmConsent, ConsentApiError } from './consentApi';
import { getIdToken } from '../../../services/firebase';

// The hold state for a minor who passed the neutral age gate but does not yet have
// verified parental consent. A parent taps "Give consent", is redirected to Stripe's
// hosted card check (a €0 verification, nothing charged), and returns here where the
// server re-verifies and flips the consent claim. The live tutor stays gated
// server-side throughout, whatever happens on screen.

interface Props {
  profile: AgeProfile;
  onConsented: () => void;
}

type Phase = 'idle' | 'starting' | 'verifying' | 'error' | 'cancelled';

function clearConsentParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('consent');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* no-op */
  }
}

export const ParentConsentPending: React.FC<Props> = ({ profile, onConsented }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');

  // Handle the return from Stripe's hosted page. On success we re-verify server-side
  // (never trusting the query string), refresh the token so the new claim is live,
  // then let onboarding move on.
  useEffect(() => {
    const consent = new URLSearchParams(window.location.search).get('consent');
    if (consent === 'return') {
      setPhase('verifying');
      confirmConsent('')
        .then(async () => {
          await getIdToken(true);
          clearConsentParam();
          onConsented();
        })
        .catch((e: unknown) => {
          clearConsentParam();
          setPhase('error');
          setError(
            e instanceof ConsentApiError && e.status === 409
              ? "We couldn't confirm that just yet. If you finished the card step, give it another try in a moment."
              : 'Something went wrong confirming consent. Please try again.',
          );
        });
    } else if (consent === 'cancel') {
      clearConsentParam();
      setPhase('cancelled');
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginConsent = async () => {
    setPhase('starting');
    setError('');
    try {
      const res = await startConsent('');
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      // No URL means the server already considers consent verified.
      await getIdToken(true);
      onConsented();
    } catch (e: unknown) {
      setPhase('error');
      setError(
        e instanceof ConsentApiError && e.status === 503
          ? 'Parental consent is not set up yet. Please check back soon.'
          : 'We could not start the verification. Please try again.',
      );
    }
  };

  const busy = phase === 'starting' || phase === 'verifying';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="rounded-[1.8rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-surface p-8 shadow-press">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft">
          <ShieldCheck className="h-7 w-7 text-ohmlet-ink" strokeWidth={2.4} />
        </div>
        <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">
          Let's bring in a grown-up.
        </h1>
        <p className="mt-3 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">
          Because you're under {profile.consentAgeApplied ?? 16}, a parent or guardian reads the note below and says
          it's okay before the camera-and-voice tutor starts. It only takes a minute, and then you're off to your first
          circuit.
        </p>
        <p className="mt-5 text-sm font-black text-ohmlet-ink">Ask a parent or guardian to take it from here.</p>
      </header>

      <ParentNotice />

      <div className="rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-gold-soft p-6 shadow-press">
        <p className="text-[0.95rem] font-semibold leading-relaxed text-ohmlet-ink">{PARENT_NOTICE.closing}</p>

        {phase === 'verifying' ? (
          <div className="mt-5 flex items-center gap-2.5 border-t-2 border-ohmlet-ink/15 pt-4 text-ohmlet-ink">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" strokeWidth={2.4} />
            <p className="text-sm font-black">Confirming, one moment...</p>
          </div>
        ) : (
          <div className="mt-5 border-t-2 border-ohmlet-ink/15 pt-5">
            {error && <p className="mb-3 text-sm font-bold text-ohmlet-red">{error}</p>}
            {phase === 'cancelled' && !error && (
              <p className="mb-3 text-sm font-semibold text-ohmlet-ink-soft">
                Looks like that didn't finish. Ready whenever you are.
              </p>
            )}
            <button
              type="button"
              onClick={beginConsent}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            >
              {phase === 'starting' ? (
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.4} />
              ) : (
                <CreditCard className="h-5 w-5" strokeWidth={2.2} />
              )}
              {phase === 'error' ? 'Try again' : 'Give consent with a quick card check'}
            </button>
            <p className="mt-2.5 text-center text-xs font-semibold text-ohmlet-ink-soft">Nothing is charged.</p>
          </div>
        )}
      </div>
    </div>
  );
};
