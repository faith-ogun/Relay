import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { track } from '../../services/analytics';

/**
 * OnboardingQuestions — the short "who are you" survey shown right after sign-up.
 *
 * Feeds segmentation/analytics (why people learn, who they are, where to start).
 * Answers are saved per-user in localStorage for now (the same interim store as
 * usePlan); they move to the user record via the backend once ID-token-verified
 * persistence lands (#44), and emit analytics events once #59 ships.
 */

interface OnboardingQuestionsProps {
  userId: string;
  onDone: () => void;
}

interface Question {
  key: string;
  prompt: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    key: 'reason',
    prompt: 'What brings you to Ohmlet?',
    options: ['Learn a brand-new skill', 'For school or university', 'For work or my career', 'Just curious and tinkering', 'Teaching or mentoring others'],
  },
  {
    key: 'role',
    prompt: 'Which best describes you?',
    options: ['Student', 'Working professional', 'Hobbyist or maker', 'Educator', 'Something else'],
  },
  {
    key: 'experience',
    prompt: 'How much electronics have you done?',
    options: ['Total beginner', 'I know the basics', 'Fairly comfortable', 'Advanced'],
  },
  {
    key: 'goal',
    prompt: 'What do you want to build first?',
    options: ['Lights and LEDs', 'Sensors and alarms', 'Robots and motors', 'Arduino projects', 'Not sure yet'],
  },
];

const storeKey = (userId: string) => `ohmlet.onboarding.${userId}`;
const doneKey = (userId: string) => `ohmlet.onboarded.${userId}`;

export const OnboardingQuestions: React.FC<OnboardingQuestionsProps> = ({ userId, onDone }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const finish = (final: Record<string, string>) => {
    try {
      localStorage.setItem(storeKey(userId), JSON.stringify({ ...final, completedAt: new Date().toISOString() }));
      localStorage.setItem(doneKey(userId), 'true');
    } catch {
      /* non-fatal: the survey is best-effort */
    }
    track('onboarding_complete', { skipped: false });
    onDone();
  };

  const choose = (option: string) => {
    const q = QUESTIONS[step];
    const next = { ...answers, [q.key]: option };
    setAnswers(next);
    if (step + 1 < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      finish(next);
    }
  };

  const skip = () => {
    try {
      localStorage.setItem(doneKey(userId), 'true');
    } catch {
      /* ignore */
    }
    track('onboarding_complete', { skipped: true });
    onDone();
  };

  const q = QUESTIONS[step];

  return (
    <div className="flex min-h-screen flex-col bg-ohmlet-cream font-display">
      {/* progress */}
      <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-6 pt-8">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="shrink-0 rounded-full p-1.5 text-ohmlet-ink-soft transition-colors hover:bg-ohmlet-line hover:text-ohmlet-ink"
            aria-label="Previous question"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-8" />
        )}
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={QUESTIONS.length}>
          {QUESTIONS.map((item, i) => (
            <span
              key={item.key}
              className={`h-2 flex-1 rounded-full transition-colors ${i <= step ? 'bg-ohmlet-gold' : 'bg-ohmlet-line'}`}
            />
          ))}
        </div>
        <button type="button" onClick={skip} className="shrink-0 text-sm font-black text-ohmlet-ink-soft hover:text-ohmlet-ink">
          Skip
        </button>
      </div>

      {/* question */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-4">
          <img src="/mascot/point.png" alt="" aria-hidden className="h-16 w-auto" draggable={false} />
          <h1 className="text-2xl font-black tracking-tight text-ohmlet-ink sm:text-3xl">{q.prompt}</h1>
        </div>

        <div className="grid gap-3">
          {q.options.map((option) => {
            const selected = answers[q.key] === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left text-[15px] font-bold transition-all hover:translate-y-[2px] hover:shadow-none ${
                  selected
                    ? 'border-ohmlet-ink bg-ohmlet-gold-soft shadow-none'
                    : 'border-ohmlet-line bg-white text-ohmlet-ink shadow-press-sm'
                }`}
              >
                {option}
                {selected && <Check className="h-5 w-5 text-ohmlet-ink" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { storeKey as onboardingAnswersKey, doneKey as onboardingDoneKey };
