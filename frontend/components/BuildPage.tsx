import React, { useMemo, useState } from 'react';
import { ArrowRight, Heart, MessageCircle, Star } from 'lucide-react';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app') => void;

interface BuildPageProps {
  onNavigate: Nav;
}

type Category = 'All' | 'Lights' | 'Sensors' | 'Robotics' | 'Sound';

type Build = {
  title: string;
  builder: string;
  initials: string;
  category: Exclude<Category, 'All'>;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  blurb: string;
  likes: number;
  comments: number;
  swatch: string;
};

const builds: Build[] = [
  {
    title: 'Light-Activated Night Alarm',
    builder: 'Priya N.',
    initials: 'PN',
    category: 'Sensors',
    difficulty: 'Beginner',
    blurb: 'An LDR that triggers a buzzer when the lights go out. My first build that actually reacted to the world.',
    likes: 214,
    comments: 38,
    swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
  },
  {
    title: 'Breathing LED Mood Lamp',
    builder: 'Marcus T.',
    initials: 'MT',
    category: 'Lights',
    difficulty: 'Beginner',
    blurb: 'PWM fade on an RGB LED. Ohmlet caught that I had my resistor on the wrong leg twice. Worth it.',
    likes: 176,
    comments: 21,
    swatch: 'from-ohmlet-blue to-ohmlet-blue-deep',
  },
  {
    title: 'Servo Sorting Arm',
    builder: 'Lena K.',
    initials: 'LK',
    category: 'Robotics',
    difficulty: 'Intermediate',
    blurb: 'Two servos and a distance sensor that sort small parts into bins. Way harder than it looks, and way more fun.',
    likes: 309,
    comments: 64,
    swatch: 'from-ohmlet-green to-ohmlet-green-deep',
  },
  {
    title: 'Theremin From a Photoresistor',
    builder: 'Sam O.',
    initials: 'SO',
    category: 'Sound',
    difficulty: 'Intermediate',
    blurb: 'Wave your hand, change the pitch. The serial monitor made tuning the mapping so much easier.',
    likes: 142,
    comments: 19,
    swatch: 'from-ohmlet-red to-[#b5331c]',
  },
  {
    title: 'Plant Moisture Reminder',
    builder: 'Yuki A.',
    initials: 'YA',
    category: 'Sensors',
    difficulty: 'Beginner',
    blurb: 'A soil sensor that blinks when my basil needs water. Genuinely use it every day now.',
    likes: 188,
    comments: 27,
    swatch: 'from-ohmlet-blue to-ohmlet-blue-deep',
  },
  {
    title: 'Line-Following Mini Rover',
    builder: 'Diego R.',
    initials: 'DR',
    category: 'Robotics',
    difficulty: 'Advanced',
    blurb: 'IR sensors, motor driver, the whole thing. Took a weekend and three rebuilds. Ohmlet talked me through every short.',
    likes: 421,
    comments: 92,
    swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
  },
];

const categories: Category[] = ['All', 'Lights', 'Sensors', 'Robotics', 'Sound'];

const testimonials: Array<{ quote: string; name: string; role: string; initials: string }> = [
  {
    quote: 'I’ve started a dozen Arduino kits and quit every one. This is the first time something caught my mistake before I gave up.',
    name: 'Priya N.',
    role: 'Self-taught, 3 builds in',
    initials: 'PN',
  },
  {
    quote: 'It feels like having a patient friend who actually knows electronics sitting next to me. I finally understand why the circuit works.',
    name: 'Marcus T.',
    role: 'Design student',
    initials: 'MT',
  },
  {
    quote: 'My students stopped asking me to find their loose wire and started asking better questions. That’s the whole game.',
    name: 'Ms. Okafor',
    role: 'High-school STEM teacher',
    initials: 'MO',
  },
];

export const BuildPage: React.FC<BuildPageProps> = ({ onNavigate }) => {
  const [active, setActive] = useState<Category>('All');

  const visible = useMemo(
    () => (active === 'All' ? builds : builds.filter((b) => b.category === active)),
    [active],
  );

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="px-6 pt-12 pb-12 text-center md:pt-16">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-ohmlet-green-deep">Build</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.035em] text-ohmlet-ink md:text-6xl">
          Built by the community.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
          Real circuits from real learners: the wins, the rebuilds, and the moments it finally clicked. Share yours when
          you’re done.
        </p>
      </section>

      {/* Filter */}
      <section className="px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2">
          {categories.map((cat) => {
            const on = cat === active;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                className={`rounded-full border-2 border-ohmlet-ink px-4 py-2 text-sm font-black transition-all ${
                  on ? 'bg-ohmlet-ink text-white' : 'bg-white text-ohmlet-ink hover:bg-ohmlet-gold-soft'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Builds grid */}
      <section className="px-6 pt-10 pb-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <article
              key={b.title}
              className="overflow-hidden rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-white shadow-press transition-transform hover:-translate-y-1"
            >
              <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${b.swatch}`}>
                <span className="rounded-full border-2 border-ohmlet-ink bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-ohmlet-ink">
                  {b.category}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold-soft text-xs font-black text-ohmlet-ink">
                    {b.initials}
                  </span>
                  <span className="text-sm font-bold text-ohmlet-ink-soft">{b.builder}</span>
                  <span className="ml-auto rounded-full bg-ohmlet-gold-soft px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-ohmlet-ink-soft">
                    {b.difficulty}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black leading-tight tracking-tight text-ohmlet-ink">{b.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{b.blurb}</p>
                <div className="mt-4 flex items-center gap-4 text-sm font-bold text-ohmlet-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <Heart className="h-4 w-4 text-ohmlet-red" />
                    {b.likes}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 text-ohmlet-blue-deep" />
                    {b.comments}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-ohmlet-cream px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1 text-ohmlet-gold-deep">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-5xl">
              People who stuck with it.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="flex flex-col rounded-[1.6rem] border-2 border-ohmlet-line bg-white p-7 shadow-soft">
                <blockquote className="text-lg font-bold leading-relaxed text-ohmlet-ink">“{t.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-blue-soft text-sm font-black text-ohmlet-ink">
                    {t.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-black text-ohmlet-ink">{t.name}</span>
                    <span className="block text-sm font-semibold text-ohmlet-ink-soft">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-4xl">
          Your first build belongs here too.
        </h2>
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
