import React, { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { BrandSplash } from '../components/BrandSplash';
import { useAuth } from '../hooks/useAuth';
import { hasSeenOnboarding } from '../services/firstRun';
import { readAge } from '../services/gates';

// The brand screen is held for at least this long even when everything resolves
// instantly. Below roughly a second it reads as a flash of colour rather than a
// deliberate moment, which is worse than not having one.
const MIN_SPLASH_MS = 1400;

/**
 * Entry gate.
 *
 *   signed in                  -> home
 *   signed out, first launch   -> welcome (then the tour, then auth)
 *   signed out, been here      -> straight to auth
 *
 * The tour is not re-shown after a sign-out: it introduces the product, and the
 * person has already met it.
 */
export default function Index() {
  const { user, loading } = useAuth();
  const [seenTour, setSeenTour] = useState<boolean | null>(null);
  const [aged, setAged] = useState<boolean | null>(null);
  const [minElapsed, setMinElapsed] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    hasSeenOnboarding().then((seen) => alive && setSeenTour(seen));
    readAge(user?.uid).then((a) => alive && setAged(a !== null));
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started.current));
    const timer = setTimeout(() => alive && setMinElapsed(true), wait);
    return () => { alive = false; clearTimeout(timer); };
  }, [user?.uid]);

  if (loading || seenTour === null || !minElapsed) return <BrandSplash />;

  if (user) {
    // Age assurance runs before anything else a signed-in person can reach. It
    // is keyed by uid, so signing in as someone else on a shared phone asks
    // again rather than inheriting the last person's answer.
    if (aged === null) return <BrandSplash />;
    return <Redirect href={aged ? '/home' : '/age'} />;
  }
  return <Redirect href={seenTour ? '/sign-in' : '/welcome'} />;
}
