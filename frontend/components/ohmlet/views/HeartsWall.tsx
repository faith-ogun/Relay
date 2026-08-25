import React from 'react';
import { ArrowRight, Heart, RotateCcw } from 'lucide-react';
import { formatWait, useHeartsCountdown } from '../../../hooks/useHearts';

/**
 * The wall a Free learner hits when the pool empties.
 *
 * Two jobs, in this order: make the wait legible, and make the way past it
 * obvious. A bare "come back later" is the version of this screen people
 * uninstall over, so the ring shows the next heart actually arriving, and the
 * moment it lands the screen becomes a way back into the lesson rather than a
 * dead end someone has to navigate out of.
 *
 * Its own component so the one-second countdown re-renders this and nothing
 * else. Inside the runner it would repaint the whole lesson every second.
 */

const R = 52;
const CIRC = 2 * Math.PI * R;

export const HeartsWall: React.FC<{
  onResume: () => void;
  onExit: () => void;
  /** Absent when the learner cannot act on an offer: an under-18 who cannot
   *  self-purchase (#96), a Max subscriber with nothing above them, or the
   *  author preview, which never spends a real heart. */
  onUpgrade?: () => void;
}> = ({ onResume, onExit, onUpgrade }) => {
  const { empty, nextIn, regenProgress } = useHeartsCountdown();
  const refilled = !empty;
  const progress = regenProgress ?? 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ohmlet-cream px-6">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto h-32 w-32">
          <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" className="stroke-ohmlet-line" />
            <circle
              cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
              className={refilled ? 'stroke-ohmlet-green' : 'stroke-ohmlet-red'}
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - (refilled ? 1 : progress))}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart
              className={refilled ? 'h-10 w-10 text-ohmlet-red' : 'h-10 w-10 text-ohmlet-ink-mute'}
              fill={refilled ? 'currentColor' : 'none'}
              strokeWidth={2.2}
            />
          </div>
        </div>

        <h2 className="mt-6 text-3xl font-black tracking-tight">
          {refilled ? 'You have a heart' : 'Out of hearts'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
          {refilled
            ? 'Pick up where you left off. The questions you missed come back first.'
            : 'Hearts come back on their own. Nothing you have learned is lost, and your streak is safe.'}
        </p>

        {!refilled && (
          <div className="mt-7">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-ohmlet-ink-mute">Next heart in</div>
            <div className="mt-1 text-5xl font-black tabular-nums tracking-tight">{formatWait(nextIn) || '--'}</div>
          </div>
        )}

        {refilled ? (
          <button
            onClick={onResume}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 font-black shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
        ) : onUpgrade ? (
          /* Deliberately not the standard white card: this is an offer, so it
             carries the gold surface the rest of the lesson never uses. */
          <button
            onClick={onUpgrade}
            className="mt-8 block w-full rounded-[1.75rem] border-[2.5px] border-ohmlet-gold-plate bg-ohmlet-gold-soft p-6 text-left shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
          >
            <div className="text-lg font-black tracking-tight">Never run out</div>
            <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ohmlet-gold-text">
              Pro and Max have unlimited hearts, so a wrong answer costs you nothing but the time
              it takes to understand it.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-black">
              See plans <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        ) : null}

        <button onClick={onExit} className="mt-4 text-sm font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
          Leave lesson
        </button>
      </div>
    </div>
  );
};
