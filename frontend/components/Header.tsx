import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { OhmletLogo } from './Logo';

type SiteRoute = 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'login' | 'signup' | 'ohmlet-app';

interface HeaderProps {
  activeRoute: string;
  navItems: ReadonlyArray<{ route: 'learn' | 'build' | 'blog' | 'pricing'; label: string }>;
  darkRoute?: boolean;
  isAuthed: boolean;
  userLabel: string | null;
  onNavigate: (route: SiteRoute) => void;
  onLogin: () => void;
  onSignup: () => void;
  onOpenWorkspace: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRoute,
  navItems,
  darkRoute = false,
  isAuthed,
  userLabel,
  onNavigate,
  onLogin,
  onSignup,
  onOpenWorkspace,
  onSignOut,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const initial = (userLabel || '?').trim().charAt(0).toUpperCase();

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
                  {active && <span className="absolute -bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-ohmlet-gold" />}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-2">
            {isAuthed ? (
              <>
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="hidden items-center gap-2 rounded-xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-4 py-2 text-sm font-extrabold text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none sm:inline-flex"
                >
                  Open workspace
                </button>
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold-soft text-sm font-black text-ohmlet-ink"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Account menu"
                  >
                    {initial}
                  </button>
                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border-2 border-ohmlet-ink bg-white shadow-press"
                    >
                      {userLabel && (
                        <p className="truncate border-b border-ohmlet-line px-4 py-3 text-xs font-bold text-ohmlet-ink-soft">{userLabel}</p>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onSignOut();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-extrabold text-ohmlet-ink transition-colors hover:bg-ohmlet-gold-soft"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onLogin}
                  className={`hidden rounded-xl px-3 py-2 text-sm font-extrabold transition-colors sm:inline-flex ${
                    darkRoute ? 'text-white/80 hover:text-white' : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={onSignup}
                  className="hidden items-center gap-2 rounded-xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-4 py-2 text-sm font-extrabold text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none sm:inline-flex"
                >
                  Sign up
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl md:hidden ${
                darkRoute ? 'border border-white/10 bg-white/5 text-white' : 'border border-ohmlet-line bg-white text-ohmlet-ink'
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
                  activeRoute === 'landing' ? 'bg-ohmlet-gold text-ohmlet-ink' : 'border border-ohmlet-line bg-white text-ohmlet-ink'
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
                    activeRoute === item.route ? 'bg-ohmlet-gold text-ohmlet-ink' : 'border border-ohmlet-line bg-white text-ohmlet-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {isAuthed ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenWorkspace();
                      setMobileOpen(false);
                    }}
                    className="rounded-xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-3 py-3 text-left text-sm font-extrabold text-ohmlet-ink shadow-press-sm"
                  >
                    Open workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSignOut();
                      setMobileOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-xl border border-ohmlet-line bg-white px-3 py-3 text-left text-sm font-extrabold text-ohmlet-ink"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onLogin();
                      setMobileOpen(false);
                    }}
                    className="rounded-xl border border-ohmlet-line bg-white px-3 py-3 text-left text-sm font-extrabold text-ohmlet-ink"
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSignup();
                      setMobileOpen(false);
                    }}
                    className="rounded-xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-3 py-3 text-left text-sm font-extrabold text-ohmlet-ink shadow-press-sm"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
