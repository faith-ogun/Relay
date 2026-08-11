import React, { useCallback, useState } from 'react';
import { OnboardingQuestions } from '../../auth/OnboardingQuestions';
import { AgeGate, type AgeGateResult } from './AgeGate';
import { ParentConsentPending } from './ParentConsentPending';
import { ChildNotice } from './ChildNotice';
import { useAgeProfile } from './useAgeProfile';
import { buildAgeProfile, CHILD_MODE_ENABLED, type AgeProfile } from './ageModel';
import { submitAge } from './consentApi';
import { getIdToken } from '../../../services/firebase';

// First-run onboarding. With child mode OFF (default) this is exactly the old
// flow. With it ON, every new user meets a neutral age screen first; the result
// routes them to the normal questions (adult / consented minor), holds an
// unconsented minor at the parent step, and shows a consented child a short,
// kid-friendly notice once before their first build.

interface OnboardingProps {
  userId: string;
  onDone: () => void;
}

const childNoticeKey = (userId: string) => `ohmlet.childNoticeSeen.${userId || 'anon'}`;

function readChildNoticeSeen(userId: string): boolean {
  try {
    return localStorage.getItem(childNoticeKey(userId)) === '1';
  } catch {
    return false;
  }
}

export const Onboarding: React.FC<OnboardingProps> = ({ userId, onDone }) => {
  const { ageProfile, setAgeProfile } = useAgeProfile(userId);
  const [childNoticeSeen, setChildNoticeSeen] = useState<boolean>(() => readChildNoticeSeen(userId));

  // On age-gate resolve, tell the SERVER (it is authoritative: it recomputes the age,
  // sets the isMinor/ageStatus custom claims, and writes the consent record). The local
  // build is provisional until then; if the backend is unreachable we keep it and the
  // server-side WS gate will re-prompt for the age check before any live session.
  const handleAgeResolved = useCallback(
    async (r: AgeGateResult) => {
      let profile: AgeProfile = buildAgeProfile(r.birthYear, r.country);
      try {
        const res = await submitAge(r.birthYear, r.country);
        profile = {
          ...profile,
          consentAgeApplied: res.consentAge,
          ageStatus: res.ageStatus,
          accountType: res.isMinor ? 'child' : 'adult',
          isMinor: res.isMinor,
          coppa: res.coppa,
          liveAccessEnabled: !res.isMinor,
        };
        await getIdToken(true); // refresh so the new claim is live for the live-session gate
      } catch {
        /* backend unreachable: keep the provisional local profile */
      }
      setAgeProfile(profile);
    },
    [setAgeProfile],
  );

  if (!CHILD_MODE_ENABLED) {
    return <OnboardingQuestions userId={userId} onDone={onDone} />;
  }

  if (!ageProfile) {
    return <AgeGate onResolved={handleAgeResolved} />;
  }

  if (ageProfile.isMinor && ageProfile.ageStatus !== 'minor_consented') {
    return (
      <ParentConsentPending
        profile={ageProfile}
        onConsented={() => setAgeProfile({ ...ageProfile, ageStatus: 'minor_consented', liveAccessEnabled: true })}
      />
    );
  }

  // Consented minor: a one-time, child-readable "how Ohmlet works for you" notice.
  if (ageProfile.isMinor && !childNoticeSeen) {
    return (
      <ChildNotice
        onAcknowledge={() => {
          try {
            localStorage.setItem(childNoticeKey(userId), '1');
          } catch {
            /* private mode / quota: worst case the notice shows again next time */
          }
          setChildNoticeSeen(true);
        }}
      />
    );
  }

  return <OnboardingQuestions userId={userId} onDone={onDone} />;
};
