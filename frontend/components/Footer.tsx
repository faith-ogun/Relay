import React from 'react';
import { openCookieSettings } from '../services/cookieConsent';

type FooterRoute = 'landing' | 'learn' | 'build' | 'blog' | 'pricing' | 'terms' | 'privacy' | 'cookies' | 'support' | 'ohmlet-app';

interface FooterProps {
  onNavigate: (route: FooterRoute) => void;
}

type LinkItem = { label: string; route: FooterRoute };

const COLUMNS: Array<{ heading: string; links: LinkItem[] }> = [
  {
    heading: 'Product',
    links: [
      { label: 'Learn', route: 'learn' },
      { label: 'Build', route: 'build' },
      { label: 'Pricing', route: 'pricing' },
      { label: 'Open Ohmlet', route: 'ohmlet-app' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Blog', route: 'blog' },
      { label: 'Support', route: 'support' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms', route: 'terms' },
      { label: 'Privacy', route: 'privacy' },
      { label: 'Cookies', route: 'cookies' },
    ],
  },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#ffc423] px-6 pb-10 pt-14 font-display">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Brand */}
          <div className="flex flex-col items-start gap-4">
            <button type="button" onClick={() => onNavigate('landing')} aria-label="Ohmlet home">
              <img src="/brand/ohmlet-wordmark.png" alt="Ohmlet" className="h-12 w-auto md:h-14" draggable={false} />
            </button>
            <p className="max-w-xs text-sm font-bold leading-relaxed text-ohmlet-ink/70">
              Learn electronics by building, with a tutor that can see your bench.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ohmlet-ink/55">{col.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={() => onNavigate(link.route)}
                      className="text-sm font-bold text-ohmlet-ink/80 transition-colors hover:text-ohmlet-ink"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t-2 border-ohmlet-ink/15 pt-6 sm:flex-row">
          <p className="text-sm font-bold text-ohmlet-ink/70">
            © {new Date().getFullYear()} Ohmlet · Learn electronics by building
          </p>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => onNavigate('terms')} className="text-xs font-bold text-ohmlet-ink/70 transition-colors hover:text-ohmlet-ink">Terms</button>
            <button type="button" onClick={() => onNavigate('privacy')} className="text-xs font-bold text-ohmlet-ink/70 transition-colors hover:text-ohmlet-ink">Privacy</button>
            <button type="button" onClick={() => onNavigate('cookies')} className="text-xs font-bold text-ohmlet-ink/70 transition-colors hover:text-ohmlet-ink">Cookies</button>
            <button type="button" onClick={openCookieSettings} className="text-xs font-bold text-ohmlet-ink/70 transition-colors hover:text-ohmlet-ink">Cookie settings</button>
          </div>
        </div>
      </div>
    </footer>
  );
};
