import React from 'react';
import { Zap, Sparkles, X, Clock, Map as MapIcon, Boxes } from 'lucide-react';

// The conversion moment (#18): a celebratory overlay when a build completes, at the
// peak-intent instant the learner has just felt the product work. For free users it
// carries a Pro upsell tied to what they just did; for Pro users it is pure ceremony.
// This is the contract the mobile RevenueCat paywall mirrors.

interface Props {
  buildTitle: string;
  isPro: boolean;
  isFirstBuild: boolean;
  /** False for under-18s (they cannot self-purchase, #96): show ceremony, no upsell. */
  canUpgrade?: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}

const PRO_PERKS: Array<{ icon: typeof Clock; label: string }> = [
  { icon: Clock, label: 'Unlimited live tutor time' },
  { icon: MapIcon, label: 'Every build path unlocked' },
  { icon: Boxes, label: 'A 3D twin of every build' },
];

export const BuildCelebration: React.FC<Props> = ({ buildTitle, isPro, isFirstBuild, canUpgrade = true, onUpgrade, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ohmlet-ink/40 p-4 backdrop-blur-sm">
      <div className="ohmlet-rise relative w-full max-w-md overflow-hidden rounded-[1.8rem] border-[3px] border-ohmlet-ink bg-white shadow-press">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ohmlet-ink/15 text-ohmlet-ink-soft transition-colors hover:border-ohmlet-ink hover:text-ohmlet-ink"
        >
          <X className="h-4 w-4" strokeWidth={2.6} />
        </button>

        <div className="bg-gradient-to-br from-ohmlet-gold-soft to-white px-8 pt-9 pb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press">
            <Zap className="h-8 w-8" strokeWidth={2.4} fill="currentColor" />
          </div>
          <p className="mt-4 text-[0.7rem] font-black uppercase tracking-[0.18em] text-ohmlet-gold-deep">
            {isFirstBuild ? 'Your first build' : 'Build complete'}
          </p>
          <h2 className="mt-1 text-3xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">
            {isFirstBuild ? 'You built it!' : 'Nicely done!'}
          </h2>
          <p className="mt-2 text-sm font-bold text-ohmlet-ink-soft">{buildTitle}</p>
        </div>

        {isPro || !canUpgrade ? (
          <div className="px-8 pb-8 pt-2 text-center">
            <p className="text-base font-semibold leading-relaxed text-ohmlet-ink-soft">
              That is another one on the bench. Ready for the next?
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Keep building
            </button>
          </div>
        ) : (
          <div className="px-8 pb-8 pt-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ohmlet-gold-deep" strokeWidth={2.4} />
              <p className="text-sm font-black text-ohmlet-ink">Keep the momentum with Pro</p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {PRO_PERKS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm font-semibold text-ohmlet-ink">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-ohmlet-ink bg-ohmlet-gold-soft">
                    <Icon className="h-3.5 w-3.5 text-ohmlet-ink" strokeWidth={2.4} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onUpgrade}
              className="mt-5 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Go Pro
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-2 text-sm font-bold text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
