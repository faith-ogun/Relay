import { useCallback, useEffect, useState } from 'react';
import { fetchMe, minutesRemaining, type Me } from '../services/entitlements';

/**
 * The signed-in user's plan and remaining live budget.
 *
 * Deliberately has no local cache: an out-of-date entitlement is worse than a
 * brief spinner, because it would either show a paid feature to someone who has
 * stopped paying or hide one from someone who just upgraded. The server is the
 * only source.
 */
export function usePlan() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setMe(next);
    return next;
  }, []);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  const remaining = minutesRemaining(me);
  return {
    me,
    loading,
    refresh,
    plan: me?.plan ?? 'free',
    minutesRemaining: remaining,
    unlimited: remaining === null,
    canGoLive: remaining === null || remaining > 0,
  };
}
