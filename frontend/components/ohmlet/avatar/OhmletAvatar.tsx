import React, { useMemo } from 'react';
import ReactNiceAvatar from 'react-nice-avatar';
import { normalizeAvatar, type OhmletAvatarConfig } from './avatarConfig';

// ── OhmletAvatar ──
//
// One shared render component for the user's avatar (nav chip, account hero,
// community, leaderboard). Wraps react-nice-avatar (the flat-SVG engine).

interface OhmletAvatarProps {
  config: OhmletAvatarConfig | unknown;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
  ring?: boolean;
}

export const OhmletAvatar: React.FC<OhmletAvatarProps> = ({ config, size = 40, shape = 'circle', className, ring }) => {
  const cfg = useMemo(() => normalizeAvatar(config), [config]);
  return (
    <div
      className={`relative inline-block shrink-0 ${ring ? 'rounded-full ring-2 ring-ohmlet-ink' : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <ReactNiceAvatar style={{ width: size, height: size }} shape={shape} {...cfg} />
    </div>
  );
};

export default OhmletAvatar;
