import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_DOCS, POLICY_UPDATED, type LegalBlock, type LegalDoc } from './content';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'terms' | 'privacy' | 'cookies' | 'support' | 'ohmlet-app') => void;

interface LegalPageProps {
  slug: LegalDoc['slug'];
  onNavigate: Nav;
}

const BlockView: React.FC<{ block: LegalBlock }> = ({ block }) => {
  switch (block.type) {
    case 'p':
      return <p className="mt-3 text-[15px] font-medium leading-relaxed text-ohmlet-ink-soft">{block.text}</p>;
    case 'sub':
      return <h3 className="mt-5 text-base font-black tracking-tight text-ohmlet-ink">{block.text}</h3>;
    case 'list':
      return (
        <ul className="mt-3 space-y-2">
          {block.items.map((it) => (
            <li key={it} className="flex items-start gap-2.5 text-[15px] font-medium leading-relaxed text-ohmlet-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ohmlet-gold-deep" />
              {it}
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div className="mt-4 overflow-hidden rounded-2xl border-2 border-ohmlet-ink">
          <table className="w-full text-left text-sm">
            <thead className="bg-ohmlet-ink text-white">
              <tr>{block.head.map((h) => <th key={h} className="px-4 py-2.5 font-black">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className={i % 2 ? 'bg-ohmlet-gold-soft/40' : 'bg-white'}>
                  {row.map((c, j) => (
                    <td key={j} className={`px-4 py-2.5 align-top font-semibold ${j === 0 ? 'text-ohmlet-ink' : 'text-ohmlet-ink-soft'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
};

export const LegalPage: React.FC<LegalPageProps> = ({ slug, onNavigate }) => {
  const doc = LEGAL_DOCS[slug];

  useEffect(() => {
    const prev = document.title;
    document.title = `${doc.title} | Ohmlet`;
    return () => {
      document.title = prev;
    };
  }, [doc.title]);

  return (
    <div className="w-full">
      {/* Header band */}
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
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-[-0.03em] text-ohmlet-ink md:text-5xl">{doc.title}</h1>
            <p className="mt-3 max-w-xl text-lg font-semibold text-ohmlet-ink-soft">{doc.tagline}</p>
            <p className="mt-4 inline-block rounded-full border-2 border-ohmlet-line bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">
              Last updated {POLICY_UPDATED}
            </p>
          </div>
          {/* Real mascot; a custom "mascot with a clipboard" illustration could elevate this later. */}
          <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="h-28 w-auto shrink-0 md:h-36" draggable={false} />
        </div>
      </section>

      {/* Body: sticky TOC + content */}
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-8 space-y-1">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">On this page</p>
            {doc.sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm font-bold text-ohmlet-ink-soft transition-colors hover:bg-ohmlet-gold-soft hover:text-ohmlet-ink"
              >
                {s.heading}
              </a>
            ))}
          </nav>
        </aside>

        <article>
          <p className="text-lg font-semibold leading-relaxed text-ohmlet-ink">{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-8">
              <h2 className="text-2xl font-black tracking-[-0.02em] text-ohmlet-ink">{s.heading}</h2>
              {s.blocks.map((b, i) => <BlockView key={i} block={b} />)}
            </section>
          ))}

          {/* Cross-links */}
          <div className="mt-14 flex flex-wrap gap-3 border-t border-ohmlet-line pt-8">
            {(['terms', 'privacy', 'cookies'] as const)
              .filter((s) => s !== slug)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onNavigate(s)}
                  className="rounded-2xl border-2 border-ohmlet-line bg-white px-5 py-2.5 text-sm font-black text-ohmlet-ink shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  {LEGAL_DOCS[s].title}
                </button>
              ))}
            <button
              type="button"
              onClick={() => onNavigate('support')}
              className="rounded-2xl border-2 border-ohmlet-line bg-white px-5 py-2.5 text-sm font-black text-ohmlet-ink shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Support
            </button>
          </div>
        </article>
      </div>
    </div>
  );
};
