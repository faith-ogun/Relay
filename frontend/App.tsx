import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingQuestions } from './components/auth/OnboardingQuestions';
import { ErrorPage } from './components/errors/ErrorPage';
import { useAuth } from './hooks/useAuth';

// Code-split the heavy, auth-gated app and the secondary marketing pages out of
// the initial bundle, so a first-time landing visitor downloads only the shell.
// WorkspaceHome alone pulls in Monaco, AVR8js, Three.js, and every workspace view.
const lazyNamed = <M, K extends keyof M>(loader: () => Promise<M>, name: K) =>
  React.lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType<any> })));

const LearnPage = lazyNamed(() => import('./components/LearnPage'), 'LearnPage');
const BuildPage = lazyNamed(() => import('./components/BuildPage'), 'BuildPage');
const BlogPage = lazyNamed(() => import('./components/BlogPage'), 'BlogPage');
const BlogPostPage = lazyNamed(() => import('./components/BlogPostPage'), 'BlogPostPage');
const PricingPage = lazyNamed(() => import('./components/PricingPage'), 'PricingPage');
const LegalPage = lazyNamed(() => import('./components/legal/LegalPage'), 'LegalPage');
const SupportPage = lazyNamed(() => import('./components/SupportPage'), 'SupportPage');
const WorkspaceHome = lazyNamed(() => import('./components/WorkspaceHome'), 'WorkspaceHome');
const AuthorPreview = lazyNamed(() => import('./components/ohmlet/views/AuthorPreview'), 'AuthorPreview');
const AchievementsPreview = lazyNamed(() => import('./components/ohmlet/views/AchievementsPreview'), 'AchievementsPreview');
const PartsGallery = React.lazy(() => import('./components/ohmlet/sandbox/PartsGallery'));
const UpgradeSuccess = lazyNamed(() => import('./components/UpgradeSuccess'), 'UpgradeSuccess');
const AccountPage = lazyNamed(() => import('./components/AccountPage'), 'AccountPage');

type AppRoute =
  | 'landing'
  | 'learn'
  | 'build'
  | 'blog'
  | 'pricing'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'support'
  | 'login'
  | 'signup'
  | 'welcome'
  | 'upgrade-success'
  | 'author'
  | 'cards'
  | 'parts'
  | 'account'
  | 'ohmlet-app'
  | 'workspace'
  | 'notfound';

const ROUTE_PATHS: Record<AppRoute, string> = {
  landing: '/',
  learn: '/learn',
  build: '/build',
  blog: '/blog',
  pricing: '/pricing',
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
  support: '/support',
  login: '/login',
  signup: '/signup',
  welcome: '/welcome',
  'upgrade-success': '/upgrade-success',
  author: '/author',
  cards: '/cards',
  parts: '/parts',
  account: '/account',
  'ohmlet-app': '/ohmlet-app',
  workspace: '/workspace',
  notfound: '/404',
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

  if (APP_ROUTE_PATHS.has(normalized)) return 'ohmlet-app';
  if (normalized === '/') return 'landing';
  if (normalized === '/learn') return 'learn';
  if (normalized === '/build') return 'build';
  if (normalized === '/blog' || normalized.startsWith('/blog/')) return 'blog';
  if (normalized === '/pricing') return 'pricing';
  if (normalized === '/terms') return 'terms';
  if (normalized === '/privacy') return 'privacy';
  if (normalized === '/cookies') return 'cookies';
  if (normalized === '/support') return 'support';
  if (normalized === '/login') return 'login';
  if (normalized === '/signup') return 'signup';
  if (normalized === '/welcome') return 'welcome';
  if (normalized === '/upgrade-success') return 'upgrade-success';
  if (normalized === '/author') return 'author';
  if (normalized === '/cards') return 'cards';
  if (normalized === '/parts') return 'parts';
  if (normalized === '/account') return 'account';
  if (normalized === '/workspace') return 'workspace';

  // Anything else is a real 404 (e.g. someone trying /free to be sneaky).
  return 'notfound';
};

const resolveBlogSlug = (pathname: string): string | null => {
  const match = normalizePath(pathname).match(/^\/blog\/(.+)$/);
  return match ? match[1] : null;
};

const AuthSplash: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ohmlet-cream font-display">
    <img src="/mascot/idle.png" alt="" aria-hidden className="h-20 w-auto" draggable={false} />
    <Loader2 className="h-6 w-6 animate-spin text-ohmlet-ink-soft" />
  </div>
);

// Lightweight fallback while a lazy marketing page chunk loads. Reserves height
// so the header/footer don't jump.
const PageSpinner: React.FC = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
    <Loader2 className="h-6 w-6 animate-spin text-ohmlet-ink-soft" />
  </div>
);

const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [blogSlug, setBlogSlug] = useState<string | null>(() => resolveBlogSlug(window.location.pathname));
  const { user, loading, isAdmin, signOut } = useAuth();

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

  const backToLanding = useCallback(() => navigate('landing'), [navigate]);
  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('landing');
  }, [signOut, navigate]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
      setBlogSlug(resolveBlogSlug(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ── Route guards (run once auth state is known) ──
  const isProtected =
    route === 'ohmlet-app' || route === 'workspace' || route === 'author' || route === 'cards' || route === 'parts' || route === 'welcome' || route === 'account';
  const isAuthRoute = route === 'login' || route === 'signup';

  useEffect(() => {
    if (loading) return;
    if (!user && isProtected) {
      navigate('login');
    } else if (user && (route === 'login' || route === 'signup')) {
      navigate('ohmlet-app');
    }
  }, [loading, user, route, navigate, isProtected]);

  // Wait for auth before deciding anything that depends on it (public marketing
  // pages render instantly; only the auth-sensitive routes show the splash).
  if (loading && (isProtected || isAuthRoute)) {
    return <AuthSplash />;
  }

  // ── Auth onboarding ──
  if (route === 'login' || route === 'signup') {
    if (user) return <AuthSplash />; // redirecting to workspace
    return (
      <AuthPage
        initialMode={route}
        onNavigateHome={backToLanding}
        onAuthed={(isNewSignup) => navigate(isNewSignup ? 'welcome' : 'ohmlet-app')}
      />
    );
  }

  if (route === 'welcome') {
    if (!user) return <AuthSplash />;
    return <OnboardingQuestions userId={user.uid} onDone={() => navigate('ohmlet-app')} />;
  }

  // ── Workspace (auth-gated) ──
  if (route === 'ohmlet-app' || route === 'workspace') {
    if (!user) return <AuthSplash />;
    return (
      <Suspense fallback={<AuthSplash />}>
        <WorkspaceHome
          onBack={backToLanding}
          onUpgrade={() => navigate('pricing')}
          onAccount={() => navigate('account')}
        />
      </Suspense>
    );
  }

  // ── Author console (admin only) ──
  if (route === 'author') {
    if (!user) return <AuthSplash />;
    return isAdmin ? (
      <Suspense fallback={<AuthSplash />}>
        <AuthorPreview onBack={backToLanding} />
      </Suspense>
    ) : (
      <ErrorPage variant={403} onHome={backToLanding} onPrimary={() => navigate('ohmlet-app')} />
    );
  }

  // ── Achievement card gallery (admin only) — review art + gloss before ship ──
  if (route === 'cards') {
    if (!user) return <AuthSplash />;
    return isAdmin ? (
      <Suspense fallback={<AuthSplash />}>
        <AchievementsPreview onBack={backToLanding} />
      </Suspense>
    ) : (
      <ErrorPage variant={403} onHome={backToLanding} onPrimary={() => navigate('ohmlet-app')} />
    );
  }

  // ── Sandbox parts gallery (admin only) — review the 3D component meshes ──
  if (route === 'parts') {
    if (!user) return <AuthSplash />;
    return isAdmin ? (
      <Suspense fallback={<AuthSplash />}>
        <PartsGallery onBack={backToLanding} />
      </Suspense>
    ) : (
      <ErrorPage variant={403} onHome={backToLanding} onPrimary={() => navigate('ohmlet-app')} />
    );
  }

  // ── Account & privacy (auth-gated): billing, data export, delete ──
  if (route === 'account') {
    if (!user) return <AuthSplash />;
    return (
      <Suspense fallback={<AuthSplash />}>
        <AccountPage onBack={() => navigate('ohmlet-app')} onUpgrade={() => navigate('pricing')} />
      </Suspense>
    );
  }

  // ── Post-checkout success (Stripe redirects here; plan from ?plan=) ──
  if (route === 'upgrade-success') {
    return (
      <Suspense fallback={<AuthSplash />}>
        <UpgradeSuccess onEnter={() => navigate('ohmlet-app')} onHome={backToLanding} />
      </Suspense>
    );
  }

  // ── 404 ──
  if (route === 'notfound') {
    return <ErrorPage variant={404} onHome={backToLanding} onPrimary={backToLanding} />;
  }

  const darkShell = false;

  return (
    <div className="min-h-screen bg-white font-display text-ohmlet-ink selection:bg-ohmlet-gold selection:text-ohmlet-ink">
      <a href="#main-content" className="ohmlet-skip-link">
        Skip to content
      </a>
      <div
        className={`fixed inset-0 pointer-events-none mix-blend-multiply ${darkShell ? 'opacity-[0.08]' : 'opacity-[0.03]'}`}
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
          isAuthed={!!user}
          userLabel={user?.displayName || user?.email || null}
          onNavigate={navigate}
          onLogin={() => navigate('login')}
          onSignup={() => navigate('signup')}
          onOpenWorkspace={() => navigate('ohmlet-app')}
          onSignOut={handleSignOut}
        />
        <main id="main-content" tabIndex={-1}>
          <Suspense fallback={<PageSpinner />}>
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
            {(route === 'terms' || route === 'privacy' || route === 'cookies') && (
              <LegalPage slug={route} onNavigate={navigate} />
            )}
            {route === 'support' && <SupportPage onNavigate={navigate} />}
          </Suspense>
        </main>
        <Footer onNavigate={navigate} />
      </div>
    </div>
  );
};

export default App;
