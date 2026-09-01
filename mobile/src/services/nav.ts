// ── Going back, when there may be nothing to go back to ──
//
// `router.back()` is a no-op when the current screen was reached with
// `replace`, or when it is the first screen of a cold launch. React Navigation
// logs "The action 'GO_BACK' was not handled by any navigator" and the person
// is simply stuck: the button they pressed did nothing, and there is nothing on
// screen to tell them why.
//
// That is exactly how sign-in trapped people. It is reached by a redirect from
// the entry gate, so its back button had no history to pop and the only way out
// of the app was the home button.
//
// Every back affordance goes through here and names where it belongs when there
// is no history, so a back button is never decoration.

import { router, type Href } from 'expo-router';

export function goBack(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
