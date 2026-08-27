import React, { useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Battery,
  Bug,
  CircuitBoard,
  Code2,
  Cpu,
  Gauge,
  Lightbulb,
  Radio,
  Thermometer,
  Wrench,
  Zap,
} from 'lucide-react';

import {
  allLessons, getCurriculumSnapshot, subscribeCurriculum, type CurriculumAccent,
} from './ohmlet/data/curriculum';

type IconType = React.ComponentType<{ className?: string }>;
type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app') => void;

interface LearnPageProps {
  onNavigate: Nav;
}

// The path below is rendered from the SHIPPED curriculum, so the unit names,
// order and counts on this public page can never drift from what a learner
// actually gets after paying.
//
// Read through the store, not as a module constant. The curriculum used to be a
// frozen array and a top-level `const TOTAL_LESSONS = allLessons().length` was
// correct; it is now swapped at runtime when a newer corpus arrives from the
// server, so a constant captured at import time would quietly advertise the
// bundled count to every visitor while the app taught something else. A public
// marketing page claiming the wrong number of lessons is exactly the drift this
// comment promises cannot happen.

const UNIT_TINT: Record<CurriculumAccent, string> = {
  gold: 'bg-ohmlet-gold-soft',
  blue: 'bg-ohmlet-blue-soft',
  green: 'bg-[#eef7e0]',
  red: 'bg-[#fdece8]',
};

const topics: Array<{ title: string; icon: IconType; skills: string[] }> = [
  {
    title: 'Foundations',
    icon: Zap,
    skills: ['Voltage, current & resistance', 'Ohm’s law', 'Series vs parallel', 'Reading a schematic'],
  },
  {
    title: 'Components',
    icon: CircuitBoard,
    skills: ['Resistors & color codes', 'LEDs & diodes', 'Capacitors', 'Push buttons & switches'],
  },
  {
    title: 'Breadboarding',
    icon: Wrench,
    skills: ['How rails connect', 'Clean wiring habits', 'Power & ground', 'Avoiding shorts'],
  },
  {
    title: 'Sensors & Inputs',
    icon: Gauge,
    skills: ['LDR & light', 'Temperature', 'Potentiometers', 'Analog vs digital reads'],
  },
  {
    title: 'Arduino & Code',
    icon: Cpu,
    skills: ['Pins & I/O', 'The serial monitor', 'Loops & timing', 'Reading sketches'],
  },
  {
    title: 'Power & Debugging',
    icon: Battery,
    skills: ['Safe current limits', 'Measuring with a multimeter', 'Finding a dead wire', 'Fixing your own build'],
  },
];

export const LearnPage: React.FC<LearnPageProps> = ({ onNavigate }) => {
  const { units } = useSyncExternalStore(subscribeCurriculum, getCurriculumSnapshot, getCurriculumSnapshot);
  const totalLessons = allLessons().length;

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="px-6 pt-12 pb-16 md:pt-16 md:pb-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="text-center lg:text-left">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-ohmlet-blue-deep">Learn</p>
            <h1 className="mt-4 text-5xl font-black leading-[0.98] tracking-[-0.035em] text-ohmlet-ink md:text-6xl">
              Everything you’ll learn.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl lg:mx-0">
              From your first lit LED to a sensor-driven, code-controlled circuit, Ohmlet takes you build by build, with
              a tutor watching every step.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('ohmlet-app')}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3.5 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
            >
              Start learning
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex justify-center lg:justify-end">
            <img src="/brand/feature-personalized.png" alt="The Ohmlet teaching a circuit on a tablet" className="w-full max-w-[400px]" draggable={false} />
          </div>
        </div>
      </section>

      {/* The learning path — the REAL curriculum units, in the order they unlock */}
      <section className="bg-ohmlet-cream px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-5xl">The learning path</h2>
            <p className="mt-4 text-lg font-semibold text-ohmlet-ink-soft">
              {units.length} units, {totalLessons} lessons, in the order they unlock. Each one stacks on the last,
              so skills compound instead of scattering.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {units.map((unit, i) => (
              <article
                key={unit.id}
                className={`${UNIT_TINT[unit.accent] ?? 'bg-white'} group rounded-[1.8rem] border-[2.5px] border-ohmlet-ink p-7 shadow-press transition-transform hover:-translate-y-1`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-white text-lg font-black text-ohmlet-ink">
                    {i + 1}
                  </span>
                  <span className="rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-ohmlet-ink">
                    {unit.level}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tight text-ohmlet-ink">{unit.title}</h3>
                <p className="mt-3 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">{unit.subtitle}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Topic areas */}
      <section className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-5xl">What you’ll master</h2>
            <p className="mt-4 text-lg font-semibold text-ohmlet-ink-soft">
              Every build reinforces the fundamentals. Here’s the ground you’ll cover along the way.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.title} className="rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-6 shadow-soft">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ohmlet-ink text-ohmlet-gold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-black tracking-tight text-ohmlet-ink">{topic.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {topic.skills.map((skill) => (
                      <li key={skill} className="flex items-start gap-2 text-sm font-semibold text-ohmlet-ink-soft">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ohmlet-green" />
                        {skill}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl rounded-[2rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-ink px-8 py-14 text-center shadow-press">
          <h2 className="text-3xl font-black tracking-[-0.02em] text-white md:text-4xl">Pick a path and start building.</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg font-semibold text-white/70">
            You learn by doing it for real, with the Ohmlet guiding every wire.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('ohmlet-app')}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-8 py-4 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            Open Ohmlet
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
};
