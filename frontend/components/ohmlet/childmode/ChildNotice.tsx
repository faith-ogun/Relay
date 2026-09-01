import React from 'react';
import { Zap, Check } from 'lucide-react';
import { CHILD_NOTICE } from './notices';

// Shown to a consented child once, before their first build. Warm, plain, and
// short. Content lives in notices.ts; this is presentation only.

interface Props {
  onAcknowledge: () => void;
}

export const ChildNotice: React.FC<Props> = ({ onAcknowledge }) => (
  <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
    <div className="rounded-[1.8rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-surface p-8 shadow-press">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-gold">
        <Zap className="h-7 w-7 text-ohmlet-ink" strokeWidth={2.6} fill="currentColor" />
      </div>
      <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">
        {CHILD_NOTICE.title}
      </h1>
      <ul className="mt-5 space-y-3.5">
        {CHILD_NOTICE.lines.map((line) => (
          <li key={line} className="flex gap-3 text-[1.02rem] font-semibold leading-relaxed text-ohmlet-ink-soft">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-ohmlet-ink bg-ohmlet-gold-soft"
            >
              <Check className="h-3.5 w-3.5 text-ohmlet-ink" strokeWidth={3} />
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAcknowledge}
        className="mt-7 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold py-3.5 text-lg font-black text-ohmlet-ink shadow-press transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        {CHILD_NOTICE.cta}
      </button>
    </div>
  </div>
);
