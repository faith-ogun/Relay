import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactNiceAvatar from 'react-nice-avatar';
import { OhmletFace } from './OhmletFace';
import {
  DEFAULT_BG_COLOR,
  DEFAULT_FACE_COLOR,
  normalizeAvatar,
  toLibraryProps,
  type OhmletAvatarConfig,
} from './avatarConfig';

// ── OhmletAvatar ──
//
// One shared render component for the user's avatar (nav chip, account hero,
// community, leaderboard). Wraps react-nice-avatar (the flat-SVG engine) and
// takes over two things the library cannot do itself: the head outline, so
// Round and Tapered are actually different shapes (see OhmletFace), and the
// background, so the gradient option is a real gradient.
//
// The library's own head is the first layer inside its tree and everything else
// stacks on top of it, so we cannot render ours in between from React. Instead
// we hide the library's head in place and paint ours in the same box, one layer
// underneath the whole library tree. If the library's internals ever move and
// its head cannot be found, we leave it alone and keep its stock head: one head
// on a slightly wrong shape beats two heads.

// Our head layer uses the library's own face viewBox, so the lookup has to be
// scoped to the library's subtree or it finds ours and hides the wrong one.
const ENGINE_CLASS = 'ohmlet-avatar-engine';
const STOCK_FACE_SELECTOR = `:scope > .${ENGINE_CLASS} svg[viewBox="0 0 200 320"]`;

type AvatarShape = 'circle' | 'rounded' | 'square';

const CORNER_RADIUS: Record<AvatarShape, string> = {
  circle: '50%',
  rounded: '6px',
  square: '0px',
};

interface OhmletAvatarProps {
  config: OhmletAvatarConfig | unknown;
  size?: number;
  shape?: AvatarShape;
  className?: string;
  ring?: boolean;
  /**
   * Names the person this avatar belongs to, for screen readers. Leave it unset
   * where the name is already next to the avatar: the image is then decorative
   * and is hidden from assistive tech rather than announced twice.
   */
  label?: string;
}

export const OhmletAvatar: React.FC<OhmletAvatarProps> = ({
  config,
  size = 40,
  shape = 'circle',
  className,
  ring,
  label,
}) => {
  const cfg = useMemo(() => normalizeAvatar(config), [config]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ownsFace, setOwnsFace] = useState(false);

  // No dependency list on purpose: re-running is one querySelector, and it keeps
  // the library's head hidden if React ever swaps that node out under us. A
  // layout effect lands before paint, so the stock head is never seen.
  useLayoutEffect(() => {
    const stockFace = hostRef.current?.querySelector<SVGSVGElement>(STOCK_FACE_SELECTOR);
    if (!stockFace) return;
    stockFace.style.visibility = 'hidden';
    setOwnsFace(true);
  });

  const bgColor = cfg.bgColor || DEFAULT_BG_COLOR;
  // Position and clipping live here rather than in utility classes: the head
  // layer is absolutely positioned against this box, so it is geometry, not
  // styling, and it must hold even where the utility sheet does not reach.
  const frame: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: size,
    height: size,
    borderRadius: CORNER_RADIUS[shape],
    background: bgColor,
  };
  if (cfg.isGradient) {
    // Falls back to the flat background on its own if color-mix is unsupported:
    // the whole declaration is dropped and the solid `background` stays.
    frame.backgroundImage =
      `linear-gradient(155deg, color-mix(in oklab, #ffffff 46%, ${bgColor}) 0%,` +
      ` ${bgColor} 54%, color-mix(in oklab, #0f172a 16%, ${bgColor}) 100%)`;
  }

  return (
    <div
      ref={hostRef}
      className={['inline-block', 'shrink-0', ring ? 'ring-2 ring-ohmlet-ink' : '', className ?? ''].filter(Boolean).join(' ')}
      style={frame}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {ownsFace && <OhmletFace shape={cfg.faceShape} color={cfg.faceColor || DEFAULT_FACE_COLOR} />}
      <ReactNiceAvatar
        className={ENGINE_CLASS}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
        shape={shape}
        {...toLibraryProps(cfg)}
      />
    </div>
  );
};

export default OhmletAvatar;
