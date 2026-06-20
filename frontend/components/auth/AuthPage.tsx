import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { OhmletLogo } from '../Logo';
import { authErrorMessage, useAuth } from '../../hooks/useAuth';

type Mode = 'login' | 'signup' | 'reset';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  /** Called after a successful auth. isNewSignup routes to the welcome questionnaire. */
  onAuthed: (isNewSignup: boolean) => void;
  onNavigateHome: () => void;
}

// The left panel art (frontend/public/onboarding/hero.png). Until it lands, a
// branded gradient + the waving mascot stands in so the screen is never broken.
const HERO_SRC = '/onboarding/hero.png';

const GoogleMark: React.FC = () => (
  <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden focusable="false">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>
);

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', onAuthed, onNavigateHome }) => {
  const { signInEmail, signUpEmail, signInGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<null | 'email' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [heroOk, setHeroOk] = useState(true);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMode(initialMode), [initialMode]);
  useEffect(() => {
    setError(null);
    setResetSent(false);
    firstFieldRef.current?.focus();
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy('email');
    try {
      if (mode === 'login') {
        await signInEmail(email, password);
        onAuthed(false);
      } else if (mode === 'signup') {
        await signUpEmail(name, email, password);
        onAuthed(true);
      } else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    if (busy) return;
    setError(null);
    setBusy('google');
    try {
      await signInGoogle();
      onAuthed(false);
    } catch (err) {
      const msg = authErrorMessage(err);
      // A cancelled popup is not an error worth shouting about.
      if (!/cancelled/i.test(msg)) setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const heading = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Start building' : 'Reset your password';
  const sub =
    mode === 'login'
      ? 'Log in to pick up where you left off.'
      : mode === 'signup'
      ? 'Create your account and learn electronics by building.'
      : 'We will email you a link to set a new password.';

  return (
    <div className="grid min-h-screen grid-cols-1 bg-ohmlet-cream font-display lg:grid-cols-[1.05fr_1fr]">
      {/* Left: hero panel (image with branded fallback) */}
      <aside className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_30%_20%,#ffe98a_0%,#facc2e_45%,#f0b400_100%)]" />
        {heroOk ? (
          <img
            src={HERO_SRC}
            alt=""
            aria-hidden
            onError={() => setHeroOk(false)}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-12 text-center">
            <img src="/mascot/wave.png" alt="" aria-hidden className="h-44 w-auto drop-shadow-xl" draggable={false} />
            <p className="max-w-sm text-2xl font-black leading-tight text-ohmlet-ink">
              Learn electronics by building, with a tutor that watches your bench.
            </p>
          </div>
        )}
      </aside>

      {/* Right: form */}
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex w-fit items-center transition-transform hover:scale-[1.02]"
            aria-label="Ohmlet home"
          >
            <OhmletLogo tone="light" height={40} />
          </button>

          <div className="flex flex-1 flex-col justify-center py-10">
            <h1 className="text-3xl font-black tracking-tight text-ohmlet-ink sm:text-4xl">{heading}</h1>
            <p className="mt-2 text-sm font-semibold text-ohmlet-ink-soft">{sub}</p>

            {mode !== 'reset' && (
              <>
                <button
                  type="button"
                  onClick={google}
                  disabled={!!busy}
                  className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-ohmlet-ink bg-white px-5 py-3.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-60"
                  aria-busy={busy === 'google'}
                >
                  {busy === 'google' ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <GoogleMark />}
                  Continue with Google
                </button>
                <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-ohmlet-ink-soft">
                  <span className="h-px flex-1 bg-ohmlet-line" />
                  or
                  <span className="h-px flex-1 bg-ohmlet-line" />
                </div>
              </>
            )}

            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              {mode === 'signup' && (
                <Field
                  ref={firstFieldRef}
                  icon={<UserIcon className="h-5 w-5" />}
                  label="Name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={setName}
                  placeholder="What should we call you?"
                />
              )}
              <Field
                ref={mode === 'signup' ? undefined : firstFieldRef}
                icon={<Mail className="h-5 w-5" />}
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                invalid={!!error}
              />
              {mode !== 'reset' && (
                <div>
                  <Field
                    icon={<Lock className="h-5 w-5" />}
                    label="Password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={setPassword}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                    invalid={!!error}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    }
                  />
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="mt-2 text-sm font-bold text-ohmlet-ink-soft underline-offset-2 hover:text-ohmlet-ink hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl border-2 border-ohmlet-red/30 bg-[#fdece8] px-4 py-2.5 text-sm font-bold text-ohmlet-red">
                  {error}
                </p>
              )}
              {resetSent && (
                <p role="status" className="rounded-xl border-2 border-ohmlet-green/40 bg-[#f1f9e6] px-4 py-2.5 text-sm font-bold text-ohmlet-ink">
                  Check your inbox for a reset link.
                </p>
              )}

              <button
                type="submit"
                disabled={!!busy}
                aria-busy={busy === 'email'}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-6 py-3.5 text-base font-black text-ohmlet-ink shadow-press transition-all enabled:hover:translate-y-[3px] enabled:hover:shadow-none disabled:opacity-60"
              >
                {busy === 'email' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm font-semibold text-ohmlet-ink-soft">
              {mode === 'reset' ? (
                <button type="button" onClick={() => setMode('login')} className="font-black text-ohmlet-ink hover:underline">
                  Back to log in
                </button>
              ) : mode === 'login' ? (
                <>
                  New to Ohmlet?{' '}
                  <button type="button" onClick={() => setMode('signup')} className="font-black text-ohmlet-ink hover:underline">
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => setMode('login')} className="font-black text-ohmlet-ink hover:underline">
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>

          <p className="text-center text-xs font-semibold text-ohmlet-ink-soft">
            By continuing you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
};

// ── A labelled input with a leading icon and optional trailing control ──
interface FieldProps {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  trailing?: React.ReactNode;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ icon, label, type, value, onChange, placeholder, autoComplete, invalid, trailing }, ref) => {
    const id = `f-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">
          {label}
        </label>
        <div
          className={`flex items-center gap-2.5 rounded-2xl border-2 bg-white px-4 py-3 transition-colors focus-within:border-ohmlet-ink ${
            invalid ? 'border-ohmlet-red/40' : 'border-ohmlet-line'
          }`}
        >
          <span className="shrink-0 text-ohmlet-ink-soft">{icon}</span>
          <input
            ref={ref}
            id={id}
            type={type}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className="w-full bg-transparent text-[15px] font-semibold text-ohmlet-ink outline-none placeholder:font-medium placeholder:text-ohmlet-ink-soft/60"
          />
          {trailing && <span className="shrink-0">{trailing}</span>}
        </div>
      </div>
    );
  },
);
Field.displayName = 'Field';
