import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock, Cpu, Eye, MessageSquare, ScanLine } from 'lucide-react';
import { BUILD_LIBRARY } from './ohmlet/data/library';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app') => void;

interface BuildPageProps {
  onNavigate: Nav;
}

// Everything on this page comes from the real build library the product ships.
// It deliberately shows no builder names, likes, comments, ratings or reviews:
// there is no community data yet, and inventing it would be a lie told to people
// deciding whether to pay. Real parts lists and real timings sell it better.
type Level = 'All' | 'Beginner' | 'Intermediate' | 'Advanced';


const LEVELS: Level[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];

// What a session actually does. Every line here is a shipped capability, not a
// claim about other people's experiences.
const HOW: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = [
  {
    icon: ScanLine,
    title: 'It checks your parts first',
    body: 'Hold your components up to the camera and the tutor confirms you have the right ones before you wire anything.',
  },
  {
    icon: Eye,
    title: 'It watches the board as you wire',
    body: 'A resistor in the wrong row or a jumper on the wrong rail gets caught while you are still holding it.',
  },
  {
    icon: MessageSquare,
    title: 'You talk, it answers',
    body: 'Ask why the circuit works, out loud, mid-build. It writes and debugs the Arduino sketch with you.',
  },
];

export const BuildPage: React.FC<BuildPageProps> = ({ onNavigate }) => {
  const [active, setActive] = useState<Level>('All');

  const visible = useMemo(
    () => (active === 'All' ? BUILD_LIBRARY : BUILD_LIBRARY.filter((b) => b.level === active)),
    [active],
  );

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="px-6 pt-12 pb-12 text-center md:pt-16">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-ohmlet-green-deep">Build</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.035em] text-ohmlet-ink md:text-6xl">
          Real circuits, on a real breadboard.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
          Every build in the library is a physical project you wire yourself, with a tutor watching the board and
          talking you through it. No kit? Build it in the simulator first.
        </p>
      </section>

      {/* Filter by real difficulty */}
      <section className="px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2">
          {LEVELS.map((lvl) => {
            const on = lvl === active;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setActive(lvl)}
                aria-pressed={on}
                className={`rounded-full border-2 border-ohmlet-ink px-4 py-2 text-sm font-black transition-all ${
                  on ? 'bg-ohmlet-ink text-white' : 'bg-white text-ohmlet-ink hover:bg-ohmlet-gold-soft'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      </section>

      {/* Builds grid — the real library, with the real parts you need */}
      <section className="px-6 pt-10 pb-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => {
            const Icon = b.icon;
            return (
              <article
                key={b.title}
                className="flex flex-col overflow-hidden rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-white shadow-press transition-transform hover:-translate-y-1"
              >
                <div
                  className="relative flex h-28 items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${b.color} 0%, ${b.color}cc 100%)` }}
                >
                  <Icon className="h-10 w-10 text-ohmlet-ink" />
                  <span className="absolute right-3 top-3 rounded-full border-2 border-ohmlet-ink bg-white/90 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-ohmlet-ink">
                    {b.level}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-black leading-tight tracking-tight text-ohmlet-ink">{b.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{b.desc}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-ohmlet-ink-soft">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {b.est}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" /> {b.mode}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-ohmlet-line pt-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-ohmlet-ink-soft">
                      {b.parts.length} parts
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-ohmlet-ink-soft">
                      {b.parts.join(' · ')}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How a session actually goes — shipped capabilities, not testimonials */}
      <section className="bg-ohmlet-cream px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-5xl">
              What happens when you go live.
            </h2>
            <p className="mt-4 text-lg font-semibold leading-relaxed text-ohmlet-ink-soft">
              You point a camera at your bench and start talking. Here is what the tutor does with that.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {HOW.map((h, i) => {
              const Icon = h.icon;
              return (
                <div key={h.title} className="flex flex-col rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-7 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-black text-ohmlet-ink-soft">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-black leading-tight tracking-tight text-ohmlet-ink">{h.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{h.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-4xl">
          Start with the light-activated alarm.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base font-semibold text-ohmlet-ink-soft">
          Twenty minutes, six parts, and a circuit that reacts to the world.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('ohmlet-app')}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-8 py-4 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
        >
          Start building
          <ArrowRight className="h-5 w-5" />
        </button>
      </section>
    </div>
  );
};
