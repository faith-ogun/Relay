import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app') => void;

interface BlogPageProps {
  onNavigate: Nav;
}

type Post = {
  title: string;
  excerpt: string;
  category: string;
  date: string;
  read: string;
  author: string;
  swatch: string;
};

const featured: Post = {
  title: 'From Tutorial Hell to Your First Working Circuit',
  excerpt:
    'Watching videos feels like progress, but it isn’t. Here’s the shift that gets beginners from passively following along to actually building, and why a tutor that sees your bench changes everything.',
  category: 'Learning',
  date: 'Jun 12, 2026',
  read: '7 min read',
  author: 'The Ohmlet Team',
  swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
};

const posts: Post[] = [
  {
    title: 'How to Read a Breadboard Without Frying Anything',
    excerpt: 'Power rails, the center gap, and the connections nobody explains: a beginner’s map to the board everything sits on.',
    category: 'Basics',
    date: 'Jun 9, 2026',
    read: '5 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-blue to-ohmlet-blue-deep',
  },
  {
    title: 'Ohm’s Law, Explained With an LED You Can Actually See',
    excerpt: 'V = IR stops being abstract the moment it decides whether your LED glows or pops. Let’s make it physical.',
    category: 'Foundations',
    date: 'Jun 5, 2026',
    read: '6 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-green to-ohmlet-green-deep',
  },
  {
    title: 'Why Your Arduino Sensor Reads Garbage, and How to Fix It',
    excerpt: 'Floating pins, missing pull-downs, and noisy analog reads. The usual suspects behind numbers that make no sense.',
    category: 'Debugging',
    date: 'May 30, 2026',
    read: '8 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-red to-[#b5331c]',
  },
  {
    title: 'Resistor Color Codes: A 5-Minute Cheat Sheet',
    excerpt: 'Stop squinting at tiny bands. A simple way to read any resistor and never mix up your 220Ω and 22kΩ again.',
    category: 'Reference',
    date: 'May 24, 2026',
    read: '4 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
  },
  {
    title: 'PWM, Explained: Make an LED Breathe',
    excerpt: 'Pulse-width modulation sounds intimidating. It’s really just blinking fast enough to fake brightness. Here’s how.',
    category: 'Projects',
    date: 'May 18, 2026',
    read: '6 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-blue to-ohmlet-blue-deep',
  },
  {
    title: 'The Multimeter Skills That Save Every Build',
    excerpt: 'Continuity, voltage, and resistance checks: the three measurements that turn “it doesn’t work” into “found it.”',
    category: 'Debugging',
    date: 'May 11, 2026',
    read: '7 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-green to-ohmlet-green-deep',
  },
];

export const BlogPage: React.FC<BlogPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="px-6 pt-12 pb-10 text-center md:pt-16">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-ohmlet-blue-deep">Blog</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.035em] text-ohmlet-ink md:text-6xl">
          The Ohmlet Blog.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft md:text-xl">
          Plain-English electronics: the concepts, the debugging tricks, and the mindset that gets you from confused to
          building.
        </p>
      </section>

      {/* Featured */}
      <section className="px-6">
        <article className="mx-auto grid max-w-6xl overflow-hidden rounded-[1.8rem] border-[2.5px] border-ohmlet-ink shadow-press md:grid-cols-2">
          <div className={`relative flex min-h-[220px] items-center justify-center bg-gradient-to-br ${featured.swatch} p-8`}>
            <span className="absolute left-5 top-5 rounded-full border-2 border-ohmlet-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-ohmlet-ink">
              Featured
            </span>
            <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="h-40 w-auto" draggable={false} />
          </div>
          <div className="bg-white p-8">
            <p className="text-xs font-black uppercase tracking-wide text-ohmlet-blue-deep">{featured.category}</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-ohmlet-ink">{featured.title}</h2>
            <p className="mt-3 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">{featured.excerpt}</p>
            <div className="mt-5 flex items-center gap-3 text-sm font-bold text-ohmlet-ink-soft">
              <span>{featured.author}</span>
              <span className="h-1 w-1 rounded-full bg-ohmlet-ink-soft" />
              <span>{featured.date}</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {featured.read}
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* Grid */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <article key={p.title} className="overflow-hidden rounded-[1.6rem] border-2 border-ohmlet-line bg-white shadow-soft">
              <div className={`h-28 bg-gradient-to-br ${p.swatch}`} />
              <div className="p-6">
                <p className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">{p.category}</p>
                <h3 className="mt-2 text-xl font-black leading-tight tracking-tight text-ohmlet-ink">{p.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{p.excerpt}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-ohmlet-ink-soft">
                  <span>{p.date}</span>
                  <span className="h-1 w-1 rounded-full bg-ohmlet-ink-soft" />
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {p.read}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.02em] text-ohmlet-ink md:text-4xl">
          Reading about it is step one. Building is step two.
        </h2>
        <button
          type="button"
          onClick={() => onNavigate('ohmlet-app')}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-8 py-4 text-lg font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
        >
          Open Ohmlet
          <ArrowRight className="h-5 w-5" />
        </button>
      </section>
    </div>
  );
};
