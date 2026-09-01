// First-run flag. Device-scoped on purpose: whether the onboarding tour has been
// seen is a property of this INSTALL, not of a person, so unlike the age gate or
// the safety acknowledgement it must not be keyed per user. Someone signing out
// and back in should not be shown the tour again.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ohmlet.onboardingSeen.v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;   // storage blocked: show the tour rather than skip it
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    /* not fatal: worst case the tour shows once more */
  }
}
