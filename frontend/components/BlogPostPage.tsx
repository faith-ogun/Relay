import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, ImageIcon, Lightbulb, Video } from 'lucide-react';
import { findPost, type Block } from './blog/posts';

type Nav = (route: 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app') => void;

interface BlogPostPageProps {
  slug: string;
  onNavigate: Nav;
  onOpenPost: (slug: string) => void;
}

const BlockView: React.FC<{ block: Block }> = ({ block }) => {
  switch (block.type) {
    case 'h2':
      return <h2 className="mt-12 text-3xl font-black tracking-[-0.02em] text-ohmlet-ink">{block.text}</h2>;
    case 'h3':
      return <h3 className="mt-8 text-xl font-black tracking-tight text-ohmlet-ink">{block.text}</h3>;
    case 'p':
      return <p className="mt-4 text-lg font-medium leading-relaxed text-ohmlet-ink-soft">{block.text}</p>;
    case 'list':
      return block.ordered ? (
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-lg font-medium text-ohmlet-ink-soft marker:font-black marker:text-ohmlet-ink">
          {block.items.map((it) => <li key={it} className="pl-1 leading-relaxed">{it}</li>)}
        </ol>
      ) : (
        <ul className="mt-4 space-y-2">
          {block.items.map((it) => (
            <li key={it} className="flex items-start gap-3 text-lg font-medium leading-relaxed text-ohmlet-ink-soft">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ohmlet-gold-deep" />
              {it}
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div className="mt-6 overflow-hidden rounded-2xl border-2 border-ohmlet-ink">
          <table className="w-full text-left text-sm">
            <thead className="bg-ohmlet-ink text-white">
              <tr>{block.head.map((h) => <th key={h} className="px-4 py-3 font-black">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className={i % 2 ? 'bg-ohmlet-gold-soft/40' : 'bg-white'}>
                  {row.map((c, j) => (
                    <td key={j} className={`px-4 py-3 font-semibold ${j === 0 ? 'text-ohmlet-ink' : 'text-ohmlet-ink-soft'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout':
      return (
        <div className="mt-6 flex gap-3 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-ohmlet-gold-deep" />
          <div>
            {block.title && <p className="text-sm font-black uppercase tracking-wide text-ohmlet-ink">{block.title}</p>}
            <p className="mt-1 text-base font-semibold leading-relaxed text-ohmlet-ink">{block.text}</p>
          </div>
        </div>
      );
    case 'code':
      return (
        <figure className="mt-6 overflow-hidden rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-ink">
          {block.caption && (
            <figcaption className="border-b border-white/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-ohmlet-gold">
              {block.caption}
            </figcaption>
          )}
          <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed text-ohmlet-gold-soft">
            <code className="font-mono">{block.code}</code>
          </pre>
        </figure>
      );
    case 'quote':
      return (
        <p className="mt-6 rounded-2xl bg-ohmlet-ink px-6 py-5 text-center font-mono text-lg font-bold text-ohmlet-gold">
          {block.text}
        </p>
      );
    case 'media':
      return (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ohmlet-ink/30 bg-ohmlet-cream px-6 py-12 text-center">
          {block.kind === 'video' ? (
            <Video className="h-7 w-7 text-ohmlet-ink-soft" />
          ) : (
            <ImageIcon className="h-7 w-7 text-ohmlet-ink-soft" />
          )}
          <p className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">
            {block.kind} placeholder
          </p>
          <p className="max-w-md text-sm font-semibold text-ohmlet-ink-soft">{block.note}</p>
        </div>
      );
    default:
      return null;
  }
};

export const BlogPostPage: React.FC<BlogPostPageProps> = ({ slug, onNavigate, onOpenPost }) => {
  const post = findPost(slug);

  useEffect(() => {
    if (!post) return;
    const prevTitle = document.title;
    document.title = `${post.title} | Ohmlet`;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') ?? '';
    meta?.setAttribute('content', post.metaDescription);

    // Structured data: Article + FAQPage (PAA / AI Overview eligibility).
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'ohmlet-blog-jsonld';
    ld.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.metaDescription,
        author: { '@type': 'Organization', name: post.author },
        publisher: { '@type': 'Organization', name: 'Ohmlet' },
        keywords: post.keywords.join(', '),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ]);
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      meta?.setAttribute('content', prevDesc);
      document.getElementById('ohmlet-blog-jsonld')?.remove();
    };
  }, [post]);

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-black text-ohmlet-ink">Post not found</h1>
        <button
          type="button"
          onClick={() => onNavigate('blog')}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3 font-black text-ohmlet-ink shadow-press-sm"
        >
          Back to the blog
        </button>
      </div>
    );
  }

  const related = post.related.map(findPost).filter(Boolean);

  return (
    <article className="w-full">
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-20">
        <button
          type="button"
          onClick={() => onNavigate('blog')}
          className="inline-flex items-center gap-2 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          All posts
        </button>

        <p className="mt-8 text-xs font-black uppercase tracking-[0.16em] text-ohmlet-blue-deep">{post.category}</p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.03em] text-ohmlet-ink md:text-5xl">
          {post.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold text-ohmlet-ink-soft">
          <span>{post.author}</span>
          <span className="h-1 w-1 rounded-full bg-ohmlet-ink-soft" />
          <span>{post.date}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {post.read}
          </span>
        </div>

        <div className={`mt-8 flex h-44 items-center justify-center rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-gradient-to-br ${post.swatch}`}>
          <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="h-32 w-auto" draggable={false} />
        </div>

        {/* Key takeaways: snippet-friendly summary up top */}
        <div className="mt-8 rounded-2xl border-2 border-ohmlet-ink bg-white p-6 shadow-press-sm">
          <p className="text-sm font-black uppercase tracking-wide text-ohmlet-ink">Key takeaways</p>
          <ul className="mt-3 space-y-2">
            {post.takeaways.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-base font-semibold text-ohmlet-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ohmlet-green text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Body */}
        <div>
          {post.body.map((block, i) => <BlockView key={i} block={block} />)}
        </div>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="text-3xl font-black tracking-[-0.02em] text-ohmlet-ink">Frequently asked questions</h2>
          <div className="mt-6 space-y-4">
            {post.faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border-2 border-ohmlet-line bg-white p-5 shadow-soft">
                <h3 className="text-lg font-black text-ohmlet-ink">{faq.q}</h3>
                <p className="mt-2 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-14 rounded-[1.8rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-ink px-8 py-10 text-center shadow-press">
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">Reading about it is step one.</h2>
          <p className="mx-auto mt-3 max-w-md text-base font-semibold text-white/70">
            Open Ohmlet and build it for real, with a tutor watching your bench.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('ohmlet-app')}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-7 py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            Open Ohmlet
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-black tracking-tight text-ohmlet-ink">Keep reading</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <button
                  key={r!.slug}
                  type="button"
                  onClick={() => onOpenPost(r!.slug)}
                  className="rounded-2xl border-2 border-ohmlet-line bg-white p-5 text-left shadow-soft transition-transform hover:-translate-y-1"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">{r!.category}</p>
                  <p className="mt-1 font-black leading-tight text-ohmlet-ink">{r!.title}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
};
