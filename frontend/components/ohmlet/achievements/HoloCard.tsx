import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CardShape, RARITY_LABELS } from '../data/achievements';
import type { Achievement } from '../types';
import { useDialog } from '../../../hooks/useDialog';

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
        onClick={onClick}
        onMouseMove={tilt}
        onMouseLeave={resetTilt}
        aria-label={`${a.title} — ${RARITY_LABELS[a.tier].label}, earned. View card.`}
        className={`${className} text-left`}
        style={cardVars(a)}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={className} style={cardVars(a)} aria-label={`${a.title} — locked. ${label}.`} role="img">
      {inner}
    </div>
  );
};

/** The pop-out inspector: the card front (art) flips to reveal the story. */
export const CardInspectModal: React.FC<{ a: Achievement; onClose: () => void }> = ({ a, onClose }) => {
  const [flipped, setFlipped] = useState(false);
  const hasArt = !!a.art;
  const panelRef = useDialog<HTMLDivElement>(onClose);
  const titleId = `card-inspect-${a.id}`;
  return (
    <div className="ohmlet-card-inspect-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="ohmlet-card-inspect-wrapper"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <span id={titleId} className="sr-only">
          {a.title} achievement card. {a.desc}
        </span>
        <button
          onClick={onClose}
          className="ohmlet-focus-ring mb-4 ml-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/50 text-white transition-colors hover:bg-white/10"
          aria-label="Close card"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={`ohmlet-card-inspect-flip ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show card front' : 'Flip card to read the story'}
          style={{ width: 280, height: 373, cursor: 'pointer' }}
        >
          {/* Front — the painted art (or gradient fallback) */}
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
          {/* Back — the story (the art has no reverse, so we render a themed panel) */}
          <div className="ohmlet-card-inspect-face ohmlet-card-inspect-back ohmlet-holo-card earned" style={cardVars(a)}>
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
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-wide text-white/75">Tap or press Enter to flip</p>
      </div>
    </div>
  );
};
