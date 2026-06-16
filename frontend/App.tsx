import React, { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { LearnPage } from './components/LearnPage';
import { BuildPage } from './components/BuildPage';
import { BlogPage } from './components/BlogPage';
import { BlogPostPage } from './components/BlogPostPage';
import { PricingPage } from './components/PricingPage';
import { OhmletLab } from './components/OhmletLab';
import { WorkspaceHome } from './components/WorkspaceHome';

type AppRoute = 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app' | 'workspace';

const ROUTE_PATHS: Record<AppRoute, string> = {
  landing: '/',
  learn: '/learn',
  build: '/build',
  blog: '/blog',
  pricing: '/pricing',
  'ohmlet-app': '/ohmlet-app',
  workspace: '/workspace',
};

const APP_ROUTE_PATHS = new Set(['/ohmlet-app', '/app', '/ohmlet', '/lab']);

const NAV_ITEMS = [
  { route: 'learn', label: 'Learn' },
  { route: 'build', label: 'Build' },
  { route: 'blog', label: 'Blog' },
  { route: 'pricing', label: 'Pricing' },
] as const;

const normalizePath = (pathname: string) => {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
};

const resolveRoute = (pathname: string): AppRoute => {
  const normalized = normalizePath(pathname);

  if (APP_ROUTE_PATHS.has(normalized)) {
    return 'ohmlet-app';
  }
  if (normalized === '/learn') return 'learn';
  if (normalized === '/build') return 'build';
  if (normalized === '/blog' || normalized.startsWith('/blog/')) return 'blog';
  if (normalized === '/pricing') return 'pricing';
  if (normalized === '/workspace') return 'workspace';

  return 'landing';
};

const resolveBlogSlug = (pathname: string): string | null => {
  const match = normalizePath(pathname).match(/^\/blog\/(.+)$/);
  return match ? match[1] : null;
};

const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [blogSlug, setBlogSlug] = useState<string | null>(() => resolveBlogSlug(window.location.pathname));

  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextPath = ROUTE_PATHS[nextRoute];

    if (normalizePath(window.location.pathname) !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setBlogSlug(null);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const openPost = useCallback((slug: string) => {
    const nextPath = `/blog/${slug}`;
    if (normalizePath(window.location.pathname) !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setBlogSlug(slug);
    setRoute('blog');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const openOhmletApp = useCallback(() => {
    navigate('ohmlet-app');
  }, [navigate]);

  const backToLanding = useCallback(() => {
    navigate('landing');
  }, [navigate]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
      setBlogSlug(resolveBlogSlug(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  if (route === 'ohmlet-app') {
    return <OhmletLab onBackToLanding={backToLanding} />;
  }

  if (route === 'workspace') {
    return <WorkspaceHome onBack={backToLanding} />;
  }

  const darkShell = false;

  return (
    <div className="min-h-screen bg-white font-display text-ohmlet-ink selection:bg-ohmlet-gold selection:text-ohmlet-ink">
      <div
        className={`fixed inset-0 pointer-events-none mix-blend-multiply ${
          darkShell ? 'opacity-[0.08]' : 'opacity-[0.03]'
        }`}
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.7\' numOctaves=\'2\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative z-10">
        <Header
          activeRoute={route}
          navItems={NAV_ITEMS}
          darkRoute={darkShell}
          onNavigate={navigate}
          onOpenOhmletApp={openOhmletApp}
        />
        <main>
          {route === 'landing' && <Home onNavigate={navigate} />}
          {route === 'learn' && <LearnPage onNavigate={navigate} />}
          {route === 'build' && <BuildPage onNavigate={navigate} />}
          {route === 'blog' &&
            (blogSlug ? (
              <BlogPostPage slug={blogSlug} onNavigate={navigate} onOpenPost={openPost} />
            ) : (
              <BlogPage onNavigate={navigate} onOpenPost={openPost} />
            ))}
          {route === 'pricing' && <PricingPage onNavigate={navigate} />}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;
