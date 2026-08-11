import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

// In-session AI safety acknowledgement (#98): shown once before a learner's first
// live session, since the live tutor pairs AI-generated guidance with real
// electronics. Mirrors Terms section 9 in plain language.

const POINTS = [
  "Ohmlet's guidance is AI-generated and can be wrong. Use your own judgement and double-check before you power a circuit.",
  'Stick to low-voltage hobby electronics. Never use mains power, and stop if a part gets hot, smells, or behaves oddly.',
  'You build at your own risk.',
];

interface Props {
  onAccept: () => void;
  onCancel: () => void;
}

export const SafetyAck: React.FC<Props> = ({ onAccept, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-ohmlet-ink/40 p-4 backdrop-blur-sm">
    <div className="ohmlet-rise relative w-full max-w-md rounded-[1.8rem] border-[3px] border-ohmlet-ink bg-white p-8 shadow-press">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ohmlet-ink/15 text-ohmlet-ink-soft transition-colors hover:border-ohmlet-ink hover:text-ohmlet-ink"
      >
        <X className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold-soft">
        <ShieldCheck className="h-7 w-7 text-ohmlet-ink" strokeWidth={2.4} />
      </div>
      <h2 className="mt-5 text-2xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">A quick safety check</h2>
      <ul className="mt-4 space-y-3">
        {POINTS.map((p) => (
          <li key={p} className="flex gap-3 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
            <span aria-hidden className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ohmlet-gold" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAccept}
        className="mt-6 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        I understand, start the session
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 w-full py-2 text-sm font-bold text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
      >
        Not now
      </button>
    </div>
  </div>
);
