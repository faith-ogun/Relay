import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

// ── Drawn icons ──
//
// Five places used an emoji as an icon: a heart, a lock, a speech bubble and a
// close cross. An emoji is not an icon. It renders in the system font, so its
// weight, colour and optical size are outside our control, it looks different on
// every OS version, and it never matches the stroke weight of anything drawn
// beside it. That is most of why a screen reads as unfinished.
//
// All of these are drawn on a 24-unit grid with a 2.2 stroke, so they sit
// consistently next to each other and inherit colour like any other element.

interface Props { size?: number; color?: string; filled?: boolean }

export const Heart: React.FC<Props> = ({ size = 20, color = colors.red, filled = true }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const InfinityMark: React.FC<Props> = ({ size = 20, color = colors.goldText }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 12c-2-2.7-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.3 6-4Zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4Z"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const Lock: React.FC<Props> = ({ size = 18, color = colors.inkSoft }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    <Rect x={5.5} y={10.5} width={13} height={9.5} rx={2.5} fill={color} />
    <Circle cx={12} cy={15.2} r={1.7} fill={colors.white} />
  </Svg>
);

export const Comment: React.FC<Props> = ({ size = 18, color = colors.inkSoft }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5z"
      fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Send.
 *
 * Replaces a literal "↑" that two screens were using as a button face. A text
 * arrow inherits the font, so it sat off-centre, ignored the icon sizing every
 * neighbouring control obeyed, and shifted between iOS versions. Drawn, it is
 * the same weight as Close and Comment beside it.
 */
export const Send: React.FC<Props> = ({ size = 20, color = colors.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 19V6.5M12 5l-5.5 5.5M12 5l5.5 5.5" fill="none" stroke={color}
          strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Close: React.FC<Props> = ({ size = 20, color = colors.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke={color}
          strokeWidth={2.6} strokeLinecap="round" />
  </Svg>
);
