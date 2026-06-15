import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { OhmletLogo } from './Logo';

type SiteRoute = 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'ohmlet-app';

interface HeaderProps {
  activeRoute: string;
  navItems: ReadonlyArray<{ route: 'learn' | 'build' | 'blog' | 'pricing'; label: string }>;
  darkRoute?: boolean;
  onNavigate: (route: SiteRoute) => void;
  onOpenOhmletApp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRoute,
  navItems,
  darkRoute = false,
  onNavigate,
  onOpenOhmletApp,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 font-display">
      <div
        className={`mx-auto max-w-7xl rounded-2xl backdrop-blur-md ${
          darkRoute
            ? 'border border-white/10 bg-[#0b1413]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
            : 'border border-ohmlet-line bg-ohmlet-cream/95 shadow-soft'
        }`}
      >
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-5">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                onNavigate('landing');
                setMobileOpen(false);
              }}
              className="inline-flex items-center transition-transform hover:scale-[1.02]"
              aria-label="Ohmlet home"
            >
              <OhmletLogo tone={darkRoute ? 'dark' : 'light'} height={44} />
            </button>
          </div>

          <nav className="hidden items-center justify-center gap-7 md:flex">
            {navItems.map((item) => {
              const active = activeRoute === item.route;

              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className={`relative text-[15px] font-extrabold transition-colors ${
                    darkRoute
                      ? active
                        ? 'text-white'
                        : 'text-white/60 hover:text-white'
                      : active
                      ? 'text-ohmlet-ink'
                      : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-ohmlet-gold" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onOpenOhmletApp}
              className={`hidden items-center gap-2 rounded-xl border-[2.5px] border-ohmlet-ink px-4 py-2 text-sm font-extrabold text-ohmlet-ink transition-all sm:inline-flex ${
                darkRoute ? 'bg-ohmlet-gold' : 'bg-ohmlet-gold'
              } shadow-press-sm hover:translate-y-[2px] hover:shadow-none`}
            >
              Open app
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl md:hidden ${
                darkRoute
                  ? 'border border-white/10 bg-white/5 text-white'
                  : 'border border-ohmlet-line bg-white text-ohmlet-ink'
              }`}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className={`px-3 pb-3 pt-2 md:hidden ${darkRoute ? 'border-t border-white/10' : 'border-t border-ohmlet-line'}`}>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  onNavigate('landing');
                  setMobileOpen(false);
                }}
                className={`rounded-xl px-3 py-3 text-left text-sm font-extrabold ${
                  darkRoute
                    ? activeRoute === 'landing'
                      ? 'bg-ohmlet-gold text-ohmlet-ink'
                      : 'bg-white/5 text-white'
                    : activeRoute === 'landing'
                    ? 'bg-ohmlet-gold text-ohmlet-ink'
                    : 'bg-ohmlet-gold-soft text-ohmlet-ink'
                }`}
              >
                Home
              </button>
              {navItems.map((item) => (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => {
                    onNavigate(item.route);
                    setMobileOpen(false);
                  }}
                  className={`rounded-xl px-3 py-3 text-left text-sm font-extrabold ${
                    darkRoute
                      ? activeRoute === item.route
                        ? 'bg-ohmlet-gold text-ohmlet-ink'
                        : 'bg-white/5 text-white'
                      : activeRoute === item.route
                      ? 'bg-ohmlet-gold text-ohmlet-ink'
                      : 'bg-white text-ohmlet-ink border border-ohmlet-line'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  onOpenOhmletApp();
                  setMobileOpen(false);
                }}
                className="rounded-xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-3 py-3 text-left text-sm font-extrabold text-ohmlet-ink shadow-press-sm"
              >
                Open app
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
