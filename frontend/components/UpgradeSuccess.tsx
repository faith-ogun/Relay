import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { track } from '../services/analytics';

interface UpgradeSuccessProps {
  onEnter: () => void; // into the workspace
  onHome: () => void;
}

type PaidPlan = 'pro' | 'max';

const PLAN_COPY: Record<PaidPlan, { name: string; tagline: string; features: string[] }> = {
  pro: {
    name: 'Pro',
    tagline: "Your full bench tutor is unlocked. Let's build something.",
    features: [
      'Live tutor sessions, up to 10 hours a month',
      'All build paths & advanced lessons',
      '3D digital twin of every build',
      'Progress tracking, streaks & XP',
    ],
  },
  max: {
    name: 'Max',
    tagline: "Everything's unlocked, including the career track. Time to get hired.",
    features: [
      'Everything in Pro',
      'Interview Mode: AI mock interviews tuned to a job description',
      'Company prep from real interview data',
      'Career coaching sessions',
      'Early access to Ohmlet Labs',
      'Live tutor sessions, up to 30 hours a month',
    ],
  },
};

const readPlan = (): PaidPlan => {
  const p = new URLSearchParams(window.location.search).get('plan');
  return p === 'max' ? 'max' : 'pro';
};

export const UpgradeSuccess: React.FC<UpgradeSuccessProps> = ({ onEnter, onHome }) => {
  const plan = useMemo(readPlan, []);
  const copy = PLAN_COPY[plan];
  const isMax = plan === 'max';
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 40);
    return () => clearTimeout(t);
  }, []);

  // Stripe redirects here after a completed Checkout: the client-observable
  // conversion. (The plan write is authoritative via the webhook, #30.)
  useEffect(() => {
    track('subscribe', { plan });
  }, [plan]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ohmlet-cream px-6 font-display">
      {/* atmospheric glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: isMax
            ? 'radial-gradient(60% 50% at 50% 0%, rgba(250,204,46,0.18), transparent 70%)'
            : 'radial-gradient(60% 50% at 50% 0%, rgba(250,204,46,0.28), transparent 70%)',
        }}
      />

      <div
        className={`relative w-full max-w-lg rounded-[2rem] border-[2.5px] border-ohmlet-ink p-9 shadow-press transition-all duration-500 ${
          isMax ? 'bg-ohmlet-ink text-white' : 'bg-white text-ohmlet-ink'
        } ${shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black uppercase tracking-wide ${
            isMax ? 'border-ohmlet-gold text-ohmlet-gold' : 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Payment confirmed
        </span>

        <h1 className={`mt-5 text-4xl font-black leading-[1.02] tracking-[-0.03em] ${isMax ? 'text-white' : 'text-ohmlet-ink'}`}>
          You're on Ohmlet{' '}
          <span className={isMax ? 'ohmlet-shimmer lowercase' : 'text-ohmlet-gold-deep'}>{copy.name}</span>.
        </h1>
        <p className={`mt-3 text-base font-semibold ${isMax ? 'text-white/70' : 'text-ohmlet-ink-soft'}`}>{copy.tagline}</p>

        <ul className="mt-7 space-y-3">
          {copy.features.map((f, i) => (
            <li
              key={f}
              className={`flex items-start gap-2.5 text-sm font-semibold transition-all duration-500 ${
                isMax ? 'text-white/90' : 'text-ohmlet-ink'
              } ${shown ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'}`}
              style={{ transitionDelay: `${120 + i * 70}ms` }}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  isMax ? 'bg-ohmlet-gold text-ohmlet-ink' : 'bg-ohmlet-green text-white'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onEnter}
          className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] px-6 py-3.5 text-base font-black shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none ${
            isMax
              ? 'border-ohmlet-gold bg-ohmlet-gold text-ohmlet-ink'
              : 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink'
          }`}
        >
          Enter your workspace
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onHome}
          className={`mt-3 block w-full text-center text-sm font-bold transition-colors ${
            isMax ? 'text-white/55 hover:text-white' : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
          }`}
        >
          Back to home
        </button>

        <p className={`mt-6 text-center text-xs font-semibold ${isMax ? 'text-white/45' : 'text-ohmlet-ink-soft'}`}>
          A receipt is on its way to your email. Manage your plan anytime from Pricing.
        </p>
      </div>
    </div>
  );
};
