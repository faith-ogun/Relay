// Generate public/sitemap.xml from the routes and posts the app actually has.
//
// Written rather than hand-maintained because a sitemap that lists a page which
// no longer exists, or misses a post that does, is worse than none: it teaches a
// crawler to distrust the file. Regenerate whenever a post or public route is
// added — it runs as part of `npm run build`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const ORIGIN = 'https://ohmlet.org';

// Public marketing routes only. Anything behind auth is excluded here for the
// same reason robots.txt disallows it.
const ROUTES = ['/', '/learn', '/build', '/blog', '/pricing', '/support', '/terms', '/privacy', '/cookies'];

const posts = readFileSync(resolve(root, 'components/blog/posts.ts'), 'utf8');
const slugs = [...posts.matchAll(/^\s*slug: '([a-z0-9-]+)',/gm)].map((m) => m[1]);
if (slugs.length === 0) throw new Error('No blog slugs found; the posts file shape must have changed.');

// Dates are authored as "Jun 12, 2026". Parsed so <lastmod> is real rather than
// today's date on every entry, which tells a crawler nothing.
const dates = [...posts.matchAll(/^\s*date: '([^']+)',/gm)].map((m) => m[1]);
const iso = (d) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};

const urls = [
  ...ROUTES.map((path) => ({ loc: `${ORIGIN}${path}`, priority: path === '/' ? '1.0' : '0.8' })),
  ...slugs.map((slug, i) => ({
    loc: `${ORIGIN}/blog/${slug}`,
    lastmod: iso(dates[i] ?? ''),
    priority: '0.6',
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => [
  '  <url>',
  `    <loc>${u.loc}</loc>`,
  u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : null,
  `    <priority>${u.priority}</priority>`,
  '  </url>',
].filter(Boolean).join('\n')).join('\n')}
</urlset>
`;

writeFileSync(resolve(root, 'public/sitemap.xml'), xml);
console.log(`sitemap: ${urls.length} urls (${ROUTES.length} routes, ${slugs.length} posts)`);
