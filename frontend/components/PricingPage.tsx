import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app') => void;

interface PricingPageProps {
  onNavigate: Nav;
}

type Tier = {
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  priceNote: string;
  cta: string;
  highlight?: boolean;
  features: string[];
};

const tiers: Tier[] = [
  {
    name: 'Free',
    tagline: 'Start building today, no card needed.',
    monthly: 0,
    annual: 0,
    priceNote: 'forever',
    cta: 'Get started',
    features: [
      'Your first build path',
      'Voice + camera tutor, 30 minutes a week',
      'Core lessons & circuit diagrams',
      'Community feed access',
    ],
  },
  {
    name: 'Pro',
    tagline: 'The full bench tutor.',
    monthly: 15.99,
    annual: 11.99,
    priceNote: 'month',
    cta: 'Go Pro',
    highlight: true,
    features: [
      'Everything in Free',
      'Live tutor sessions, up to 15 hours a month',
      'All build paths & advanced lessons',
      '3D digital twin of every build',
      'Progress tracking, streaks & XP',
      'Priority response speed',
    ],
  },
  {
    name: 'Teams',
    tagline: 'For classrooms and cohorts.',
    monthly: 9.99,
    annual: 9.99,
    priceNote: 'seat / mo',
    cta: 'Contact us',
    features: [
      'Everything in Pro',
      'Educator dashboard & class progress',
      'Seat management & rosters',
      'Shared build libraries',
      'Billed annually, minimum 5 seats',
    ],
  },
];

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Do I need to own hardware?',
    a: 'No. You can learn in simulation mode, then switch to your real breadboard whenever you’re ready. The tutor works with both.',
  },
  {
    q: 'Which kit works best?',
    a: 'Any standard Arduino starter kit. The guided builds are designed around the common components those kits ship with.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Anytime. Upgrade, downgrade, or cancel from your account. Changes take effect at the next billing cycle.',
  },
  {
    q: 'Is there a discount for students or schools?',
    a: 'Yes. Teams pricing is built for classrooms, and we offer education rates. Reach out and we’ll sort you out.',
  },
];

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="w-full">
      {/* Hero + toggle */}
      <section className="px-6 pt-12 pb-10 text-center md:pt-16">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-ohmlet-gold-deep">Pricing</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.035em] text-ohmlet-ink md:text-6xl">
          Simple pricing.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
          Start free. Go Pro when you’re hooked. Bring your whole class when you’re ready.
        </p>

        <div className="mt-8 inline-flex items-center gap-1 rounded-full border-2 border-ohmlet-ink bg-white p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`rounded-full px-5 py-2 text-sm font-black transition-all ${
              !annual ? 'bg-ohmlet-ink text-white' : 'text-ohmlet-ink'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`rounded-full px-5 py-2 text-sm font-black transition-all ${
              annual ? 'bg-ohmlet-ink text-white' : 'text-ohmlet-ink'
            }`}
          >
            Annual
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${annual ? 'bg-ohmlet-gold text-ohmlet-ink' : 'bg-ohmlet-gold-soft text-ohmlet-ink-soft'}`}>
              Save 25%
            </span>
          </button>
        </div>
      </section>

      {/* Tiers */}
      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-3">
          {tiers.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            return (
              <article
                key={tier.name}
                className={`rounded-[1.8rem] border-[2.5px] border-ohmlet-ink p-7 ${
                  tier.highlight ? 'bg-ohmlet-gold shadow-press lg:-translate-y-3' : 'bg-white shadow-press-sm'
                }`}
              >
                {tier.highlight && (
                  <span className="mb-4 inline-block rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-ohmlet-ink">
                    Most popular
                  </span>
                )}
                <h3 className="text-2xl font-black tracking-tight text-ohmlet-ink">{tier.name}</h3>
                <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">{tier.tagline}</p>

                <div className="mt-6 flex items-end gap-1">
                  {price === null ? (
                    <span className="text-3xl font-black text-ohmlet-ink">Custom</span>
                  ) : (
                    <>
                      <span className="text-5xl font-black tracking-tight text-ohmlet-ink">${price}</span>
                      <span className="mb-1.5 text-sm font-bold text-ohmlet-ink-soft">/{tier.priceNote}</span>
                    </>
                  )}
                </div>
                {price !== null && annual && price > 0 && (
                  <p className="mt-1 text-xs font-bold text-ohmlet-ink-soft">billed annually</p>
                )}
                {price === null && <p className="mt-1 text-xs font-bold text-ohmlet-ink-soft">{tier.priceNote}</p>}

                <button
                  type="button"
                  onClick={() => onNavigate(tier.name === 'Teams' ? 'pricing' : 'ohmlet-app')}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink px-6 py-3.5 text-base font-black text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none ${
                    tier.highlight ? 'bg-white' : 'bg-ohmlet-gold'
                  }`}
                >
                  {tier.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm font-semibold text-ohmlet-ink">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ohmlet-green text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-ohmlet-cream px-6 py-20 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-5xl">
            Questions, answered.
          </h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-6 shadow-soft">
                <h3 className="text-lg font-black text-ohmlet-ink">{faq.q}</h3>
                <p className="mt-2 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
