import React, { useMemo } from 'react';
import ReactNiceAvatar from 'react-nice-avatar';
import { normalizeAvatar, type OhmletAvatarConfig } from './avatarConfig';

// ── OhmletAvatar ──
//
// One shared render component for the user's avatar (nav chip, account hero,
// community, leaderboard). Wraps react-nice-avatar (the flat-SVG engine) and
// layers Ohmlet "lab gear" on top from four independent slots (head/eyes/face/
// neck), so gear stacks into a real lab look. Every gear SVG below is drawn in a
// 0..256 viewBox calibrated to the avatar's actual geometry (head, eyes, ears,
// shoulders), so they sit correctly at any size.

interface OhmletAvatarProps {
  config: OhmletAvatarConfig | unknown;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
  ring?: boolean;
}

const STROKE = '#14201e';

// Gear art, each a <g> in the 256 viewBox. Calibrated against rendered avatars.
const GEAR: Record<string, React.ReactNode> = {
  goggles: (
    <g>
      <path d="M70 120 Q60 122 58 128" stroke={STROKE} strokeWidth="7" fill="none" />
      <path d="M186 120 Q196 122 198 128" stroke={STROKE} strokeWidth="7" fill="none" />
      <rect x="72" y="115" width="112" height="9" rx="4" fill={STROKE} />
      <path d="M78 116 Q78 100 100 100 L156 100 Q178 100 178 116 L178 134 Q178 152 152 152 L104 152 Q78 152 78 134 Z" fill="#1b2733" stroke={STROKE} strokeWidth="6" />
      <path d="M86 116 Q86 108 102 108 L154 108 Q170 108 170 116 L170 132 Q170 144 150 144 L106 144 Q86 144 86 132 Z" fill="#7fd4ff" opacity="0.5" />
      <ellipse cx="108" cy="118" rx="10" ry="6" fill="#ffffff" opacity="0.6" />
    </g>
  ),
  hardHat: (
    <g>
      <path d="M70 92 Q70 44 128 44 Q186 44 186 92 Z" fill="#f5b800" stroke={STROKE} strokeWidth="6" />
      <path d="M62 92 Q62 84 72 84 L184 84 Q194 84 194 92 Q194 100 184 100 L72 100 Q62 100 62 92 Z" fill="#f5b800" stroke={STROKE} strokeWidth="6" />
      <path d="M128 46 L128 84 M104 49 L104 84 M152 49 L152 84" stroke={STROKE} strokeWidth="4" opacity="0.5" />
      <ellipse cx="100" cy="64" rx="10" ry="14" fill="#fff" opacity="0.35" />
    </g>
  ),
  earDefenders: (
    <g>
      <path d="M64 132 Q64 52 128 52 Q192 52 192 132" stroke={STROKE} strokeWidth="11" fill="none" />
      <path d="M64 132 Q64 56 128 56 Q192 56 192 132" stroke="#f5b800" strokeWidth="6" fill="none" />
      <rect x="48" y="120" width="30" height="46" rx="12" fill="#1b2733" stroke={STROKE} strokeWidth="6" />
      <rect x="178" y="120" width="30" height="46" rx="12" fill="#1b2733" stroke={STROKE} strokeWidth="6" />
      <rect x="55" y="128" width="16" height="30" rx="7" fill="#f5b800" opacity="0.8" />
      <rect x="185" y="128" width="16" height="30" rx="7" fill="#f5b800" opacity="0.8" />
    </g>
  ),
  mask: (
    <g>
      <path d="M96 140 Q74 150 78 172" stroke={STROKE} strokeWidth="4" fill="none" />
      <path d="M168 138 Q190 148 186 170" stroke={STROKE} strokeWidth="4" fill="none" />
      <path d="M92 138 Q128 132 172 138 L168 176 Q128 196 96 176 Z" fill="#eef3f7" stroke={STROKE} strokeWidth="6" />
      <path d="M94 150 Q128 146 170 150 M95 162 Q128 159 169 162" stroke={STROKE} strokeWidth="3" opacity="0.3" fill="none" />
    </g>
  ),
  labCoat: (
    <g>
      <path d="M86 232 L120 214 L128 226 L136 214 L170 232 L170 256 L86 256 Z" fill="#f4f6f8" stroke={STROKE} strokeWidth="6" />
      <path d="M120 214 L112 256 M136 214 L144 256" stroke={STROKE} strokeWidth="4" opacity="0.4" fill="none" />
      <rect x="146" y="238" width="20" height="16" rx="2" fill="none" stroke={STROKE} strokeWidth="3" opacity="0.6" />
      <rect x="152" y="234" width="4" height="16" rx="2" fill="#549cf0" />
    </g>
  ),
};

export const OhmletAvatar: React.FC<OhmletAvatarProps> = ({ config, size = 40, shape = 'circle', className, ring }) => {
  const cfg = useMemo(() => normalizeAvatar(config), [config]);
  // Order matters: neck + face under, then head + eyes on top.
  const layers = [cfg.neckGear, cfg.faceGear, cfg.eyeGear, cfg.headGear].filter(Boolean) as string[];
  return (
    <div
      className={`relative inline-block shrink-0 ${ring ? 'rounded-full ring-2 ring-ohmlet-ink' : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <ReactNiceAvatar style={{ width: size, height: size }} shape={shape} {...cfg} />
      {layers.length > 0 && (
        <svg
          viewBox="0 0 256 256"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ borderRadius: shape === 'circle' ? '100%' : shape === 'rounded' ? '12%' : 0, overflow: 'hidden' }}
          aria-hidden
        >
          {layers.map((g) => (
            <React.Fragment key={g}>{GEAR[g]}</React.Fragment>
          ))}
        </svg>
      )}
    </div>
  );
};

export default OhmletAvatar;
