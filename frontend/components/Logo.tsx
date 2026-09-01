import React from 'react';

interface OhmletLogoProps {
  className?: string;
  tone?: 'light' | 'dark';
  showTagline?: boolean;
  /** Height of the logo mark in px. */
  height?: number;
}

/**
 * Ohmlet wordmark.
 *
 * The full logo artwork has a near-white (cream) background, which blends into
 * white surfaces but would show a box on dark ones. So on light surfaces we use
 * the real logo image; on dark surfaces we compose the transparent mascot with a
 * white "ohmlet" wordmark in the brand font.
 */
export const OhmletLogo: React.FC<OhmletLogoProps> = ({
  className = '',
  tone = 'light',
  showTagline = false,
  height = 34,
}) => {
  const onDark = tone === 'dark';

  return (
    <div className={`inline-flex flex-col leading-none ${className}`}>
      {/* Mascot as art, wordmark as text. The combined `ohmlet-logo.png` bakes
          the lettering in as dark ink, which vanishes on a dark ground. Drawing
          a second PNG would mean two assets to keep in sync forever; a text
          wordmark themes itself and stays sharp at any size. */}
      <span className="inline-flex items-center">
        <img
          src="/brand/ohmlet-mascot.png"
          alt=""
          aria-hidden
          style={{ height }}
          className="w-auto select-none"
          draggable={false}
        />
        <span
          className={`ml-1.5 font-display font-black lowercase leading-none tracking-[-0.04em] ${
            onDark ? 'text-white' : 'text-ohmlet-ink'
          }`}
          style={{ fontSize: height * 0.78 }}
        >
          ohmlet
        </span>
      </span>
      <span className="sr-only">Ohmlet</span>
      {showTagline && (
        <span
          className={`mt-1 text-[11px] font-extrabold uppercase tracking-[0.22em] ${
            onDark ? 'text-white/55' : 'text-ohmlet-ink-soft'
          }`}
        >
          Electronics Learning
        </span>
      )}
    </div>
  );
};
