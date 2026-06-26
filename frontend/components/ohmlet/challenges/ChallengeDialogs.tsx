import React, { useEffect } from 'react';
import { Clock, Gift, Target, Users, X } from 'lucide-react';
import type { Challenge } from '../../../services/community';
import { ChallengeArt, themeFor } from './ChallengeArt';
import { useDialog } from '../../../hooks/useDialog';

// ── Join / leave dialogs for live challenges (#63) ──
//
// Joining is a deliberate, social commitment (Zero-style), so it is confirmed
// through a dialog with the challenge's hero art and a full blurb. Leaving is a
// low-stakes text confirm. Both trap nothing the user can't escape: backdrop
// click and Escape dismiss without acting.

const Backdrop: React.FC<{ onClose: () => void; children: React.ReactNode; labelledBy: string }> = ({
  onClose,
  children,
  labelledBy,
}) => {
  // Focus trap + Escape + focus restoration on the dialog panel.
  const panelRef = useDialog<HTMLDivElement>(onClose);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 bg-ohmlet-ink/45 backdrop-blur-sm motion-safe:animate-[ohmlet-fade-in_180ms_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      {children}
    </div>
  );
};

const MetaChip: React.FC<{ icon: React.ElementType; label: string; value: string; tint: string }> = ({
  icon: Icon,
  label,
  value,
  tint,
}) => (
  <div className="flex items-center gap-2.5 rounded-xl border-2 border-ohmlet-line px-3 py-2" style={{ background: tint }}>
    <Icon className="h-4 w-4 shrink-0 text-ohmlet-ink" strokeWidth={2.5} />
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wide text-ohmlet-ink-soft">{label}</p>
      <p className="truncate text-[13px] font-extrabold text-ohmlet-ink">{value}</p>
    </div>
  </div>
);

interface JoinProps {
  challenge: Challenge;
  onConfirm: () => void;
  onClose: () => void;
}

export const ChallengeJoinDialog: React.FC<JoinProps> = ({ challenge: c, onConfirm, onClose }) => {
  const palette = themeFor(c.theme);
  return (
    <Backdrop onClose={onClose} labelledBy="join-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border-2 border-ohmlet-ink bg-white shadow-press motion-safe:animate-[ohmlet-scale-in_220ms_cubic-bezier(0.34,1.56,0.64,1)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/85 p-1.5 text-ohmlet-ink/70 backdrop-blur transition-colors hover:bg-white hover:text-ohmlet-ink"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {/* Hero art */}
        <div className="relative h-40 w-full border-b-2 border-ohmlet-ink">
          <ChallengeArt art={c.art} theme={c.theme} className="h-full w-full" />
          <div className="absolute bottom-3 left-4 right-4">
            <span className="inline-flex rounded-full border-2 border-ohmlet-ink bg-white/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-ink backdrop-blur">
              Live challenge
            </span>
          </div>
        </div>

        <div className="p-5">
          <h2 id="join-title" className="text-2xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">
            {c.title}
          </h2>
          {c.tagline && <p className="mt-0.5 text-sm font-extrabold" style={{ color: palette.c2 }}>{c.tagline}</p>}
          <p className="mt-2.5 text-[14px] font-semibold leading-relaxed text-ohmlet-ink-soft">{c.longDesc || c.desc}</p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {c.goal && <MetaChip icon={Target} label="Goal" value={c.goal} tint={palette.tint} />}
            {c.durationDays != null && (
              <MetaChip icon={Clock} label="Window" value={`${c.durationDays} days`} tint={palette.tint} />
            )}
            <MetaChip icon={Gift} label="Reward" value={c.reward} tint={palette.tint} />
            <MetaChip icon={Users} label="Joined" value={c.participantCount.toLocaleString()} tint={palette.tint} />
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-ohmlet-ink bg-white px-4 py-2.5 text-sm font-extrabold text-ohmlet-ink transition-all hover:-translate-y-0.5 hover:bg-ohmlet-cream active:translate-y-0"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-[1.4] rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
            >
              Join challenge
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
};

interface LeaveProps {
  challenge: Challenge;
  onConfirm: () => void;
  onClose: () => void;
}

export const ChallengeLeaveDialog: React.FC<LeaveProps> = ({ challenge: c, onConfirm, onClose }) => (
  <Backdrop onClose={onClose} labelledBy="leave-title">
    <div className="relative w-full max-w-sm rounded-[1.5rem] border-2 border-ohmlet-ink bg-white p-6 shadow-press motion-safe:animate-[ohmlet-scale-in_200ms_cubic-bezier(0.34,1.56,0.64,1)]">
      <h2 id="leave-title" className="text-xl font-black tracking-[-0.01em] text-ohmlet-ink">
        Leave this challenge?
      </h2>
      <p className="mt-2 text-[14px] font-semibold leading-relaxed text-ohmlet-ink-soft">
        You will drop out of <span className="font-extrabold text-ohmlet-ink">{c.title}</span> and your progress on it
        resets. You can rejoin any time.
      </p>
      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
        >
          Stay in
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-xl border-2 border-ohmlet-ink bg-white px-4 py-2.5 text-sm font-extrabold text-ohmlet-red transition-all hover:-translate-y-0.5 hover:bg-[#fff1ef] active:translate-y-0"
        >
          Leave
        </button>
      </div>
    </div>
  </Backdrop>
);
