import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  assessAge,
  initialStatusFor,
  readAgeGateDecision,
  writeAgeGateDecision,
  type AgeAssessment,
  type AgeStatus,
} from './ageModel';

// The neutral age screen (task #94). We ask WHEN and WHERE you were born, never
// a leading "are you 16?" (which invites lying, and the FTC/ICO/EDPB all reject
// as an assurance method). The answer is stored once per device (anti-retry) and
// routes the user to the adult flow, the parent-consent flow, or a block.

export interface AgeGateResult {
  birthYear: number;
  country: string;
  status: AgeStatus;
  assessment: AgeAssessment;
}

interface AgeGateProps {
  /** The signed-in user this decision belongs to. Answers are stored per user,
   *  never per device: a shared family or classroom machine must not hand one
   *  account's age answer to the next person who signs up. */
  userId: string;
  onResolved: (result: AgeGateResult) => void;
}

// Ireland-first (our home), then the EU + common markets, then a catch-all that
// defaults to the safe 16 ceiling. Data-minimised: country + birth year only.
const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'IE', label: 'Ireland' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'PL', label: 'Poland' },
  { code: 'SE', label: 'Sweden' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'XX', label: 'Somewhere else' },
];

export const AgeGate: React.FC<AgeGateProps> = ({ userId, onResolved }) => {
  const resolvedRef = useRef(false);
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [country, setCountry] = useState<string>('');

  const resolve = (result: AgeGateResult) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolved(result);
  };

  // Answer-once: if THIS USER already answered on this device, honour that
  // decision rather than re-prompting (a rejected minor must not retry a
  // passing date).
  useEffect(() => {
    const prior = readAgeGateDecision(userId);
    if (prior) {
      resolve({
        birthYear: prior.birthYear,
        country: prior.country ?? 'XX',
        status: prior.ageStatus,
        assessment: assessAge(prior.birthYear, prior.country),
      });
    }
  }, [userId]); // re-checked if the signed-in user changes

  const years = useMemo(() => {
    const now = new Date().getUTCFullYear();
    return Array.from({ length: 100 }, (_, i) => now - i);
  }, []);

  const canContinue = birthYear !== '' && country !== '';

  const submit = () => {
    if (!canContinue) return;
    const by = Number(birthYear);
    const assessment = assessAge(by, country);
    const status = initialStatusFor(assessment);
    writeAgeGateDecision(userId, { birthYear: by, country, decidedAt: new Date().toISOString(), ageStatus: status });
    resolve({ birthYear: by, country, status, assessment });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-[1.8rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-surface p-8 shadow-press">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-ohmlet-blue-deep">Welcome to Ohmlet</p>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.02em] text-ohmlet-ink">
          One quick thing before you build.
        </h1>
        <p className="mt-3 text-base font-semibold leading-relaxed text-ohmlet-ink-soft">
          Tell us when and where you were born so we set Ohmlet up the right way for you. If you're younger
          than the age in your country, we'll bring a parent in to help you get started.
        </p>

        <label className="mt-6 block text-sm font-black text-ohmlet-ink" htmlFor="ag-year">
          What year were you born?
        </label>
        <select
          id="ag-year"
          value={birthYear === '' ? '' : String(birthYear)}
          onChange={(e) => setBirthYear(e.target.value === '' ? '' : Number(e.target.value))}
          className="mt-2 w-full rounded-2xl border-2 border-ohmlet-line bg-ohmlet-surface px-4 py-3 text-base font-bold text-ohmlet-ink focus:border-ohmlet-ink focus:outline-none"
        >
          <option value="">Choose a year</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-black text-ohmlet-ink" htmlFor="ag-country">
          Where are you?
        </label>
        <select
          id="ag-country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-2 w-full rounded-2xl border-2 border-ohmlet-line bg-ohmlet-surface px-4 py-3 text-base font-bold text-ohmlet-ink focus:border-ohmlet-ink focus:outline-none"
        >
          <option value="">Choose a country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        <button
          type="button"
          disabled={!canContinue}
          onClick={submit}
          className="mt-7 w-full rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 text-base font-black text-ohmlet-ink shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-40"
        >
          Continue
        </button>

        <p className="mt-4 text-xs font-semibold leading-relaxed text-ohmlet-ink-soft">
          We store only your birth year, never your full date of birth. Ohmlet is for learners of all ages,
          with extra care for younger builders.
        </p>
      </div>
    </div>
  );
};
