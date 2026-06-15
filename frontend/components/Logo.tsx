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
      {/* Logo artwork is transparent, so it sits on any surface. */}
      <img
        src="/brand/ohmlet-logo.png"
        alt="Ohmlet"
        style={{ height }}
        className="w-auto select-none"
        draggable={false}
      />
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
