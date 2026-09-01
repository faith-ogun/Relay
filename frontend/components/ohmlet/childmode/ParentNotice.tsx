import React from 'react';
import { Database, ShieldCheck, Ban, CreditCard, KeyRound, type LucideIcon } from 'lucide-react';
import { PARENT_NOTICE, type NoticeSection } from './notices';

// The plain-language parent notice, shown during the consent flow. Content lives in
// notices.ts (single source with the Privacy Policy); this is presentation only.

const SECTION_ICON: Record<string, LucideIcon> = {
  'What Ohmlet collects from your child': Database,
  'How we keep your child safe': ShieldCheck,
  'What we never do': Ban,
  'Giving your consent': CreditCard,
  'Your rights, any time': KeyRound,
};

const Section: React.FC<{ section: NoticeSection }> = ({ section }) => {
  const Icon = SECTION_ICON[section.heading] ?? ShieldCheck;
  return (
    <section className="border-t-2 border-ohmlet-line pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold-soft">
          <Icon className="h-4 w-4 text-ohmlet-ink" strokeWidth={2.4} />
        </span>
        <h3 className="text-base font-black tracking-[-0.01em] text-ohmlet-ink">{section.heading}</h3>
      </div>
      {section.body && (
        <p className="mt-2.5 pl-[2.75rem] text-[0.9rem] font-semibold leading-relaxed text-ohmlet-ink-soft">
          {section.body}
        </p>
      )}
      {section.points && (
        <ul className="mt-2.5 space-y-2 pl-[2.75rem]">
          {section.points.map((point) => (
            <li key={point} className="flex gap-2.5 text-[0.9rem] font-semibold leading-relaxed text-ohmlet-ink-soft">
              <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ohmlet-gold" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const ParentNotice: React.FC = () => (
  <div className="rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-surface p-6 shadow-press sm:p-7">
    <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-ohmlet-blue-deep">{PARENT_NOTICE.title}</p>
    <p className="mt-3 text-[0.95rem] font-semibold leading-relaxed text-ohmlet-ink-soft">{PARENT_NOTICE.intro}</p>
    <div className="mt-6 space-y-5">
      {PARENT_NOTICE.sections.map((section) => (
        <Section key={section.heading} section={section} />
      ))}
    </div>
  </div>
);
