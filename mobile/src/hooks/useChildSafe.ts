import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { CHILD_MODE_ENABLED } from '../services/ageModel';
import { readAge } from '../services/gates';

/**
 * Whether this learner gets the child-safe posture (#94).
 *
 * True only when child mode is switched on AND the person assessed as a minor.
 * Both halves matter: with the flag off nobody is in child mode, because the
 * consent machinery it depends on is not live yet.
 *
 * This is a UI posture and nothing more. The real protections are server-side:
 * the live tutor runs the hardened child agent, selected from a verified custom
 * claim on the socket, so a tampered client cannot reach the standard agent.
 * Hiding community here stops a minor SEEING it; the server is what stops them
 * being served by it.
 */
export function useChildSafe(): { childSafe: boolean; resolved: boolean } {
  const { user } = useAuth();
  const [childSafe, setChildSafe] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!CHILD_MODE_ENABLED || !user?.uid) {
      setChildSafe(false);
      setResolved(true);
      return () => { alive = false; };
    }
    readAge(user.uid).then((age) => {
      if (!alive) return;
      setChildSafe(!!age?.isMinor);
      setResolved(true);
    });
    return () => { alive = false; };
  }, [user?.uid]);

  return { childSafe, resolved };
}
