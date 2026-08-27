import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CardShape, RARITY_LABELS } from '../data/achievements';
import type { Achievement } from '../types';
import { useDialog } from '../../../hooks/useDialog';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

// ── Holographic collectible card (shared) ──
//
// One source of truth for the achievement card look, used by the trophy case
// (AchievementsView) and the admin preview (AchievementsPreview). The face is the
// painted PNG art when present (`a.art`), with the iridescent + specular gloss
// layers rendered on top via CSS (.ohmlet-holo-card.has-art). Cards without art
// fall back to the gradient + centerpiece shape.

// Mouse-tracked tilt + specular position. Instant (no transition) so the gloss
// feels like a real foil card catching the light.
const tilt = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', `${px * 100}%`);
  el.style.setProperty('--my', `${py * 100}%`);
  el.style.setProperty('--bg-x', `${px * 100}%`);
  el.style.setProperty('--bg-y', `${py * 100}%`);
  el.style.transform = `perspective(700px) rotateY(${(px - 0.5) * 14}deg) rotateX(${(0.5 - py) * 14}deg)`;
};
const resetTilt = (e: React.MouseEvent<HTMLElement>) => {
  e.currentTarget.style.transform = '';
};

/** The CSS custom properties that drive a card's colours + art. */
const cardVars = (a: Achievement): React.CSSProperties =>
  ({
    ['--card-bg']: a.bg,
    ['--holo-glow']: a.glowColor,
    ...(a.art ? { ['--card-art']: `url("${encodeURI(a.art)}")` } : {}),
  }) as React.CSSProperties;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Live answer to "has this person asked the OS for less movement?" */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface CardProps {
  a: Achievement;
  earned: boolean;
  /** Bottom label: "Earned" or progress like "12 / 25 builds". */
  label: string;
  onClick?: () => void;
}

/** A single grid tile. Earned cards are real buttons (keyboard-operable); locked
 *  cards are inert, non-focusable tiles that announce their progress. */
export const AchievementCard: React.FC<CardProps> = ({ a, earned, label, onClick }) => {
  const rarityMeta = RARITY_LABELS[a.tier];
  const hasArt = !!a.art;
  const className = `ohmlet-holo-card ${hasArt ? 'has-art' : ''} ${earned ? 'earned cursor-pointer' : 'locked'} aspect-[3/4]`;

  const inner = hasArt ? (
        // Art is self-contained (title, rarity, mascot, frame). Only overlay a
        // progress chip while locked, so a learner sees how close they are.
        !earned && (
          <div className="ohmlet-card-info absolute inset-x-0 bottom-0 z-[3] px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-white/85">{label}</p>
          </div>
        )
      ) : (
        <div className="relative z-[3] flex h-full flex-col items-center justify-between p-4 text-white">
          <span
            className="self-start rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
            style={{ background: 'rgba(255,255,255,0.15)', color: rarityMeta.color }}
          >
            {rarityMeta.label}
          </span>
          <CardShape shape={a.shape} className="h-16 w-16 drop-shadow-lg" />
          <div className="w-full text-center">
            <p className="text-sm font-black leading-tight">{a.title}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-white/80">{label}</p>
          </div>
        </div>
      );

  if (earned) {
    return (
      <button
        type="button"
        onClick={(e) => {
          // Safari does not focus a button on click, and the inspector hands
          // focus back to whatever held it, so claim it here. preventScroll
          // keeps a card sitting half below the fold from nudging the page.
          e.currentTarget.focus({ preventScroll: true });
          onClick?.();
        }}
        onMouseMove={tilt}
        onMouseLeave={resetTilt}
        aria-label={`${a.title}. ${RARITY_LABELS[a.tier].label}, earned. View card.`}
        className={`${className} text-left`}
        style={cardVars(a)}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={className} style={cardVars(a)} aria-label={`${a.title}. Locked. ${label}.`} role="img">
      {inner}
    </div>
  );
};

// Tilt for the popped-out card. Separate from the grid tilt: the perspective
// already comes from the wrapper, and the angle is gentler because the card is
// much larger here. It lives on its own layer above the flip so the two
// transforms never fight, and the custom properties it writes inherit down into
// both card faces to drive the gloss.
const inspectTilt = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', `${px * 100}%`);
  el.style.setProperty('--my', `${py * 100}%`);
  el.style.setProperty('--bg-x', `${px * 100}%`);
  el.style.setProperty('--bg-y', `${py * 100}%`);
  el.style.transform = `rotateY(${(px - 0.5) * 11}deg) rotateX(${(0.5 - py) * 11}deg)`;
};
const resetInspectTilt = (e: React.MouseEvent<HTMLElement>) => {
  e.currentTarget.style.transform = '';
};

/** The pop-out inspector: a true modal. The card front (art) flips to reveal the
 *  story, and the page behind it does not move at all. */
export const CardInspectModal: React.FC<{ a: Achievement; onClose: () => void }> = ({ a, onClose }) => {
  const [flipped, setFlipped] = useState(false);
  const [entered, setEntered] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const hasArt = !!a.art;

  // Order matters: pin the page first, then move focus into the dialog. Focusing
  // an element the browser thinks is off-screen is what used to drag the page
  // down to the card instead of bringing the card to the reader.
  useBodyScrollLock();

  // The trophy case passes an inline arrow (`onClose={() => setInspect(null)}`),
  // so the prop is a fresh function on every render of the view above us, and the
  // view re-renders whenever the workspace does. useDialog keys its effect on
  // that identity: re-running it hands focus back to the card behind the overlay
  // and then pulls it into the panel again, scrolling the page underneath. Latch
  // the current callback and hand useDialog one stable function so the trap is
  // built exactly once per open.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const stableClose = useCallback(() => closeRef.current(), []);

  const panelRef = useDialog<HTMLDivElement>(stableClose);
  const titleId = `card-inspect-${a.id}`;

  // Arrive, don't appear: one frame at the start state, then transition in.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const pressedScrim = useRef(false);
  const onScrimDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    pressedScrim.current = e.target === e.currentTarget;
  }, []);
  const onScrimClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const dismiss = pressedScrim.current && e.target === e.currentTarget;
      pressedScrim.current = false;
      if (dismiss) onClose();
    },
    [onClose],
  );

  // Into <body>, never inline. The trophy case mounts inside `.ohmlet-rise`,
  // whose entrance animation has fill-mode `both` and therefore leaves a
  // transform on the element permanently, and a transformed ancestor becomes the
  // containing block for `position: fixed`. Inline, this overlay was pinned to
  // the tall page rather than the viewport, so the card surfaced partway down
  // the document and the page scrolled to meet it.
  return createPortal(
    <div
      className="ohmlet-card-inspect-overlay"
      style={{
        display: 'block',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        animation: reduceMotion ? 'none' : undefined,
      }}
    >
      {/* Fills the overlay, so the dim area beside the card is a real dismiss
          target, and scrolls the card into reach on very short viewports. */}
      <div
        className="flex min-h-full items-center justify-center px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onMouseDown={onScrimDown}
        onClick={onScrimClick}
      >
        <div
          ref={panelRef}
          className="ohmlet-card-inspect-wrapper"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? 'translate3d(0, 0, 0) scale(1)' : 'translate3d(0, 22px, 0) scale(0.9)',
            transition: reduceMotion
              ? 'none'
              : 'opacity 200ms ease-out, transform 460ms cubic-bezier(0.22, 1.18, 0.36, 1)',
          }}
        >
          <span id={titleId} className="sr-only">
            {a.title} achievement card. {a.desc}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ohmlet-focus-ring mb-4 ml-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/50 text-white transition-all hover:scale-105 hover:border-white hover:bg-white/10 active:scale-95"
            aria-label="Close card"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Tilt layer: holds the foil angle. Sized so a 3:4 card still fits a
              700px-tall laptop and a phone in landscape, and capped at the
              shipped 280px anywhere it already fitted. */}
          <div
            className="ohmlet-card-inspect-tilt"
            style={{ width: 'min(280px, 78vw, 50dvh)' }}
            onMouseMove={inspectTilt}
            onMouseLeave={resetInspectTilt}
          >
            <button
              type="button"
              className={`ohmlet-card-inspect-flip ${flipped ? 'flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Show card front' : 'Flip card to read the story'}
              style={{ cursor: 'pointer' }}
            >
              {/* Front: the painted art (or gradient fallback) */}
              <div
                className={`ohmlet-card-inspect-face ohmlet-holo-card earned inspecting ${hasArt ? 'has-art' : ''}`}
                style={cardVars(a)}
              >
                {!hasArt && (
                  <div className="relative z-[3] flex h-full flex-col items-center justify-between p-6 text-white">
                    <span
                      className="self-start rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
                      style={{ background: 'rgba(255,255,255,0.15)', color: RARITY_LABELS[a.tier].color }}
                    >
                      {RARITY_LABELS[a.tier].label}
                    </span>
                    <CardShape shape={a.shape} className="h-24 w-24 drop-shadow-xl" />
                    <div className="text-center">
                      <p className="text-xl font-black">{a.title}</p>
                      <p className="mt-1 text-sm font-semibold text-white/70">{a.desc}</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Back: the story (the art has no reverse, so we render a themed panel) */}
              <div
                className="ohmlet-card-inspect-face ohmlet-card-inspect-back ohmlet-holo-card earned"
                style={cardVars(a)}
              >
                <div className="relative z-[3] flex h-full flex-col items-center justify-center gap-4 p-7 text-center text-white">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
                    style={{ background: 'rgba(255,255,255,0.15)', color: RARITY_LABELS[a.tier].color }}
                  >
                    {a.title}
                  </span>
                  <p className="text-base font-bold leading-relaxed">{a.backText}</p>
                </div>
              </div>
            </button>
          </div>
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-wide text-white/75">
            Tap or press Enter to flip
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
