import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { RelayLogo } from './Logo';

interface HeaderProps {
  activeRoute: string;
  navItems: ReadonlyArray<{ route: 'mission' | 'technology'; label: string }>;
  darkRoute?: boolean;
  onNavigate: (route: 'landing' | 'mission' | 'technology' | 'relay-app') => void;
  onOpenRelayApp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRoute,
  navItems,
  darkRoute = false,
  onNavigate,
  onOpenRelayApp,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <div
        className={`mx-auto max-w-7xl rounded-2xl backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.08)] ${
          darkRoute
            ? 'border border-white/10 bg-[#090c12]/90'
            : 'border-2 border-black/10 bg-[#f3e515]/80'
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
              className="inline-flex items-center gap-3"
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg font-black ${
                  darkRoute ? 'bg-[#f3e515] text-black' : 'bg-black text-[#f3e515]'
                }`}
              >
                R
              </span>
              <RelayLogo tone={darkRoute ? 'light' : 'dark'} />
            </button>
          </div>

          <nav className="hidden items-center justify-center gap-6 md:flex">
            {navItems.map((item) => {
              const active = activeRoute === item.route;

              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className={`text-base font-bold transition-colors ${
                    darkRoute
                      ? active
                        ? 'text-[#f3e515]'
                        : 'text-white/65 hover:text-white'
                      : active
                      ? 'text-black'
                      : 'text-black/60 hover:text-black'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onOpenRelayApp}
              className={`hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition sm:inline-flex ${
                darkRoute
                  ? 'border border-[#f3e515] bg-[#f3e515] text-black hover:bg-[#e5d70e]'
                  : 'border-2 border-black bg-white text-black hover:bg-[#fffbe2]'
              }`}
            >
              Open Relay App
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl md:hidden ${
                darkRoute
                  ? 'border border-white/10 bg-white/5 text-white'
                  : 'border border-black/15 bg-white/60 text-black'
              }`}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className={`px-3 pb-3 pt-2 md:hidden ${darkRoute ? 'border-t border-white/10' : 'border-t border-black/10'}`}>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  onNavigate('landing');
                  setMobileOpen(false);
                }}
                className={`rounded-xl px-3 py-3 text-left text-sm font-bold ${
                  darkRoute
                    ? activeRoute === 'landing'
                      ? 'bg-[#f3e515] text-black'
                      : 'bg-white/5 text-white'
                    : activeRoute === 'landing'
                    ? 'bg-black text-white'
                    : 'bg-white/75 text-black'
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
                  className={`rounded-xl px-3 py-3 text-left text-sm font-bold ${
                    darkRoute
                      ? activeRoute === item.route
                        ? 'bg-[#f3e515] text-black'
                        : 'bg-white/5 text-white'
                      : activeRoute === item.route
                      ? 'bg-black text-white'
                      : 'bg-white/75 text-black'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  onOpenRelayApp();
                  setMobileOpen(false);
                }}
                className={`rounded-xl px-3 py-3 text-left text-sm font-black ${
                  darkRoute
                    ? 'border border-[#f3e515] bg-[#f3e515] text-black'
                    : 'border-2 border-black bg-white text-black'
                }`}
              >
                Open Relay App
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
