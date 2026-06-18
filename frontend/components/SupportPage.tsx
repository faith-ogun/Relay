import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, Cpu, CreditCard, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { CONTACT_EMAIL } from './legal/content';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'terms' | 'privacy' | 'cookies' | 'support' | 'ohmlet-app') => void;

interface SupportPageProps {
  onNavigate: Nav;
}

const CATEGORIES = [
  { icon: Cpu, title: 'Using the tutor', desc: 'Getting the camera and voice working, and making the most of a live session.' },
  { icon: Wrench, title: 'Hardware & builds', desc: 'Which kit to use, finding parts, and getting a build to work.' },
  { icon: CreditCard, title: 'Account & billing', desc: 'Plans, upgrades, cancellations, and receipts.' },
  { icon: ShieldCheck, title: 'Privacy & data', desc: 'What we collect, and how to export or delete your data.' },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Do I need to own hardware to use Ohmlet?',
    a: 'No. You can learn in simulation mode and follow lessons without any parts. When you are ready, switch to your real breadboard and the live tutor will watch along. Any standard Arduino starter kit works well.',
  },
  {
    q: 'The tutor cannot see my breadboard. What do I check?',
    a: 'Make sure you granted camera permission in your browser, that the camera is turned on in the session (it is off by default), and that you are pointing it at the bench in good light. On a phone, use the rear camera with the switch button.',
  },
  {
    q: 'How do I change or cancel my plan?',
    a: 'Open your account settings and manage your subscription there. You can upgrade, downgrade, or cancel at any time; if you cancel, your plan stays active until the end of the period you have paid for.',
  },
  {
    q: 'Is my camera being recorded?',
    a: 'No. A session is voice-first and the camera is off until you turn it on. When it is on, Ohmlet sends periodic still snapshots to power the tutor, not a video recording, and we do not store raw video. See our Privacy Policy for the full detail.',
  },
  {
    q: 'How do I export or delete my data?',
    a: 'You can request a copy of your data or delete your account from your account settings, or email us and we will help. Deleting your account removes your personal data, except records we must keep by law.',
  },
  {
    q: 'Is Ohmlet safe for younger learners?',
    a: 'Ohmlet is built for low-voltage hobby electronics such as Arduino projects. We recommend adult supervision for younger learners, and it is required for anything beyond low-voltage work. Please always follow basic electronics safety.',
  },
];

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-white shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-base font-black text-ohmlet-ink">{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-ohmlet-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-5 text-[15px] font-medium leading-relaxed text-ohmlet-ink-soft">{a}</p>}
    </div>
  );
};

export const SupportPage: React.FC<SupportPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Support | Ohmlet';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="border-b border-ohmlet-line bg-ohmlet-cream">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-2 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </button>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-[-0.03em] text-ohmlet-ink md:text-5xl">How can we help?</h1>
            <p className="mt-3 max-w-xl text-lg font-semibold text-ohmlet-ink-soft">
              Answers to the common questions, and a real person when you need one.
            </p>
          </div>
          <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="h-28 w-auto shrink-0 md:h-36" draggable={false} />
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Categories */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft text-ohmlet-ink">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-black text-ohmlet-ink">{c.title}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-ohmlet-ink-soft">{c.desc}</p>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <h2 className="mt-14 text-2xl font-black tracking-[-0.02em] text-ohmlet-ink">Frequently asked questions</h2>
        <div className="mt-5 space-y-3">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>

        {/* Contact CTA */}
        <div className="mt-14 rounded-[1.8rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-ink px-8 py-10 text-center shadow-press">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ohmlet-gold bg-ohmlet-gold/10 text-ohmlet-gold">
            <Mail className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">Still stuck? Talk to us.</h2>
          <p className="mx-auto mt-2 max-w-md text-base font-semibold text-white/70">
            Email us and a real person will get back to you. We read every message.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            <Mail className="h-4 w-4" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
};
