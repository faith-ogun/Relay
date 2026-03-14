import React, { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { MissionPage } from './components/MissionPage';
import { RelayLab } from './components/RelayLab';
import { TechnologyPage } from './components/TechnologyPage';

type AppRoute = 'landing' | 'mission' | 'technology' | 'relay-app';

const ROUTE_PATHS: Record<AppRoute, string> = {
  landing: '/',
  mission: '/mission',
  technology: '/technology',
  'relay-app': '/relay-app',
};

const APP_ROUTE_PATHS = new Set(['/relay-app', '/app', '/relay', '/lab']);

const NAV_ITEMS = [
  { route: 'mission', label: 'Mission' },
  { route: 'technology', label: 'Technology' },
] as const;

const normalizePath = (pathname: string) => {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
};

const resolveRoute = (pathname: string): AppRoute => {
  const normalized = normalizePath(pathname);

  if (APP_ROUTE_PATHS.has(normalized)) {
    return 'relay-app';
  }

  if (normalized === '/mission') {
    return 'mission';
  }

  if (normalized === '/technology') {
    return 'technology';
  }

  return 'landing';
};

const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));

  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextPath = ROUTE_PATHS[nextRoute];

    if (normalizePath(window.location.pathname) !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const openRelayApp = useCallback(() => {
    navigate('relay-app');
  }, [navigate]);

  const backToLanding = useCallback(() => {
    navigate('landing');
  }, [navigate]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  if (route === 'relay-app') {
    return <RelayLab onBackToLanding={backToLanding} />;
  }

  const darkShell = route === 'technology';

  return (
    <div
      className={`min-h-screen ${
        darkShell
          ? 'bg-[#10131c] text-white selection:bg-[#f3e515] selection:text-black'
          : 'bg-[#f3e515] text-black selection:bg-black selection:text-[#f3e515]'
      }`}
    >
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
          onOpenRelayApp={openRelayApp}
        />
        <main>
          {route === 'landing' && <Home onNavigate={navigate} />}
          {route === 'mission' && <MissionPage onNavigate={navigate} />}
          {route === 'technology' && <TechnologyPage onNavigate={navigate} />}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;
