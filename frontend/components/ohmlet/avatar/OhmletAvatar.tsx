import React, { useMemo } from 'react';
import ReactNiceAvatar from 'react-nice-avatar';
import { normalizeAvatar, type OhmletAvatarConfig, type OhmletProp } from './avatarConfig';

// ── OhmletAvatar (#avatar) ──
//
// One render component used everywhere a user's avatar appears (nav chip, account
// hero, community, leaderboard). Wraps react-nice-avatar (the flat-SVG engine) and
// layers an optional Ohmlet brand "prop" (lab cosmetics) on top. Crisp at any size.

interface OhmletAvatarProps {
  config: OhmletAvatarConfig | unknown;
  size?: number;
  /** 'circle' (default) | 'rounded' | 'square'. */
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
  ring?: boolean;
}

// Brand prop overlays, drawn as inline SVG sized to the avatar's viewBox (0..1).
const PropLayer: React.FC<{ prop: OhmletProp }> = ({ prop }) => {
  if (prop === 'goggles') {
    return (
      <svg viewBox="0 0 1 1" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <g transform="translate(0.5 0.42)">
          <rect x="-0.30" y="-0.05" width="0.60" height="0.05" rx="0.025" fill="#14201e" />
          <circle cx="-0.14" cy="0.0" r="0.12" fill="#0a0a0a" stroke="#14201e" strokeWidth="0.03" />
          <circle cx="0.14" cy="0.0" r="0.12" fill="#0a0a0a" stroke="#14201e" strokeWidth="0.03" />
          <circle cx="-0.14" cy="0.0" r="0.085" fill="#9fe7ff" opacity="0.85" />
          <circle cx="0.14" cy="0.0" r="0.085" fill="#9fe7ff" opacity="0.85" />
          <circle cx="-0.17" cy="-0.04" r="0.03" fill="#fff" opacity="0.9" />
          <circle cx="0.11" cy="-0.04" r="0.03" fill="#fff" opacity="0.9" />
        </g>
      </svg>
    );
  }
  if (prop === 'visor') {
    return (
      <svg viewBox="0 0 1 1" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <g transform="translate(0.5 0.4)">
          <path d="M-0.34 -0.02 a0.34 0.2 0 0 1 0.68 0 l0 0.07 a0.34 0.16 0 0 1 -0.68 0 z" fill="#14201e" />
          <path d="M-0.31 0.0 a0.31 0.17 0 0 1 0.62 0 l0 0.05 a0.31 0.14 0 0 1 -0.62 0 z" fill="#3aa0ff" opacity="0.85" />
          <path d="M-0.26 -0.005 q0.26 -0.06 0.52 0" stroke="#bfe6ff" strokeWidth="0.012" fill="none" opacity="0.8" />
        </g>
      </svg>
    );
  }
  // boltBand: a yellow headband with a lightning bolt
  return (
    <svg viewBox="0 0 1 1" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <g transform="translate(0.5 0.25)">
        <rect x="-0.32" y="-0.035" width="0.64" height="0.075" rx="0.03" fill="#f3e515" stroke="#14201e" strokeWidth="0.02" />
        <path d="M0.02 -0.03 l-0.06 0.06 l0.035 0 l-0.02 0.05 l0.07 -0.07 l-0.035 0 z" fill="#14201e" />
      </g>
    </svg>
  );
};

export const OhmletAvatar: React.FC<OhmletAvatarProps> = ({ config, size = 40, shape = 'circle', className, ring }) => {
  const cfg = useMemo(() => normalizeAvatar(config), [config]);
  // react-nice-avatar consumes the AvatarFullConfig fields directly.
  return (
    <div
      className={`relative inline-block shrink-0 ${ring ? 'rounded-full ring-2 ring-ohmlet-ink' : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <ReactNiceAvatar style={{ width: size, height: size }} shape={shape} {...cfg} />
      {cfg.prop && <PropLayer prop={cfg.prop} />}
    </div>
  );
};

export default OhmletAvatar;
