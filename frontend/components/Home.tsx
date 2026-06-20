import React from 'react';
import { ArrowRight } from 'lucide-react';

interface HomeProps {
  onNavigate: (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'signup' | 'ohmlet-app') => void;
}

const uiStyles = `
@keyframes ohmlet-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.ohmlet-marquee { animation: ohmlet-marquee 26s linear infinite; }
@keyframes ohmlet-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
.ohmlet-float { animation: ohmlet-float 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ohmlet-marquee, .ohmlet-float { animation: none !important; }
}
`;

const marqueeItems = [
  'VOICE',
  'VISION',
  'WIRING CHECKS',
  'INTERACTIVE LESSONS',
  'SERIAL MONITOR',
  '3D SANDBOX',
  'CIRCUIT DIAGRAMS',
  'COMMUNITY FEED',
] as const;

type Feature = {
  kicker: string;
  kickerClass: string;
  heading: React.ReactNode;
  body: string;
  image: string;
  imageAlt: string;
  tint: string;
  reverse?: boolean;
  /** Image fills its column edge-to-edge (no vertical padding, larger). */
  fillImage?: boolean;
};

const features: Feature[] = [
  {
    kicker: 'Personalized',
    kickerClass: 'text-ohmlet-blue-deep',
    heading: (
      <>
        Guidance built around <span className="text-ohmlet-blue-deep">your bench.</span>
      </>
    ),
    body: "Ohmlet sees exactly what's in front of you: every wire, part, and pin. It checks all of it against what the circuit actually needs. No generic steps. Just the right nudge, right when you need it.",
    image: '/brand/feature-personalized.png',
    imageAlt: 'The Ohmlet pointing at a tablet showing a live circuit with a checkmark',
    tint: 'bg-ohmlet-blue-soft',
  },
  {
    kicker: 'Mastery',
    kickerClass: 'text-ohmlet-green-deep',
    heading: (
      <>
        Turn one build into <span className="text-ohmlet-green-deep">real understanding.</span>
      </>
    ),
    body: "Every session tracks what you've mastered and where you got stuck, then shapes a path from it, so you walk away knowing why the circuit works, not just that it does.",
    image: '/brand/feature-science.png',
    imageAlt: 'The Ohmlet beside a tablet showing a learning progress path and rising chart',
    tint: 'bg-white',
    reverse: true,
  },
  {
    kicker: 'Your pace',
    kickerClass: 'text-ohmlet-red',
    heading: (
      <>
        No deadlines. <span className="text-ohmlet-red">Just progress.</span>
      </>
    ),
    body: 'Speed through a path in a weekend or pick it up ten minutes at a time. Your streak waits for you, and every step counts.',
    image: '/brand/feature-pace.png',
    imageAlt: 'The Ohmlet moving along a learning path at its own speed',
    tint: 'bg-ohmlet-gold-soft',
    fillImage: true,
  },
];

const FeatureSection: React.FC<{ feature: Feature }> = ({ feature }) => {
  const fill = feature.fillImage;
  return (
    <section className={`${feature.tint} overflow-hidden ${fill ? '' : 'px-6 py-20 md:py-28'}`}>
      <div
        className={`mx-auto grid max-w-6xl gap-10 md:gap-16 lg:grid-cols-2 ${
          fill ? 'items-stretch' : 'items-center'
        } ${feature.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
      >
        <div className={fill ? 'flex items-end justify-center' : 'flex justify-center'}>
          <img
            src={feature.image}
            alt={feature.imageAlt}
            className={
              fill
                ? 'ohmlet-float block w-full max-w-[560px] self-stretch object-contain object-bottom lg:max-w-none'
                : 'ohmlet-float w-full max-w-[420px]'
            }
            draggable={false}
            loading="lazy"
          />
        </div>
        <div className={`${fill ? 'self-center px-6 py-16 md:py-20' : ''} ${feature.reverse ? 'lg:order-1' : ''}`}>
          <p className={`text-sm font-extrabold uppercase tracking-[0.18em] ${feature.kickerClass}`}>
            {feature.kicker}
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[1.05] tracking-[-0.02em] text-ohmlet-ink md:text-5xl">
            {feature.heading}
          </h2>
          <p className="mt-5 max-w-xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
            {feature.body}
          </p>
        </div>
      </div>
    </section>
  );
};

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="w-full">
      <style>{uiStyles}</style>

      {/* ── Hero ── */}
      <section className="px-6 pt-10 pb-20 md:pt-16 md:pb-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.035em] text-ohmlet-ink md:text-7xl">
              Learn electronics by building.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-2xl lg:mx-0">
              Ohmlet is a live AI tutor that watches your bench, talks you through every build, and catches mistakes the
              moment you make them.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <button
                type="button"
                onClick={() => onNavigate('signup')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-4 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none sm:w-auto"
              >
                Start building
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('learn')}
                className="inline-flex w-full items-center justify-center rounded-2xl border-[2.5px] border-ohmlet-ink bg-white px-7 py-4 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none sm:w-auto"
              >
                See how it works
              </button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <img
              src="/brand/hero-collage.png"
              alt="The Ohmlet mascot building circuits in many ways"
              className="w-full max-w-[520px]"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* ── Capability marquee (kept) ── */}
      <section className="overflow-hidden border-y-[3px] border-ohmlet-ink bg-ohmlet-ink text-ohmlet-gold">
        <div className="ohmlet-marquee flex min-w-max items-center gap-6 px-6 py-5 text-xl font-black tracking-tight md:text-2xl">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <div key={`${item}-${index}`} className="inline-flex items-center gap-6">
              <span>{item}</span>
              <span className="h-2 w-2 rounded-full bg-ohmlet-gold" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Meet the Ohmlet ── */}
      <section className="px-6 py-20 text-center md:py-28">
        <div className="mx-auto max-w-3xl">
          <img
            src="/brand/ohmlet-mascot.png"
            alt="The Ohmlet mascot"
            className="ohmlet-float mx-auto h-36 w-auto md:h-44"
            draggable={false}
          />
          <p className="mt-8 text-sm font-extrabold uppercase tracking-[0.18em] text-ohmlet-ink-soft">
            Meet the Ohmlet
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[1.05] tracking-[-0.02em] text-ohmlet-ink md:text-6xl">
            A tutor that sees your bench and talks you through it.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
            Part lab partner, part patient expert. Point your camera, ask out loud, and build. The Ohmlet watches,
            listens, and corrects you in real time.
          </p>
        </div>
      </section>

      {/* ── Feature sections ── */}
      {features.map((feature) => (
        <FeatureSection key={feature.kicker} feature={feature} />
      ))}

      {/* ── Pre-footer CTA ── full-bleed illustration whose yellow wave merges into the gold footer ── */}
      <section className="px-6 pt-20 text-center md:pt-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-black leading-[1.05] tracking-[-0.02em] text-ohmlet-ink md:text-6xl">
            Ready to build something real?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
            Open your kit, open Ohmlet, and start your first build.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="mt-9 inline-flex items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-9 py-4 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            Open Ohmlet
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>
      <img
        src="/brand/cta-toolbox.png"
        alt="The Ohmlet popping out of a toolbox surrounded by components"
        className="-mb-px mt-8 block w-full"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
};
