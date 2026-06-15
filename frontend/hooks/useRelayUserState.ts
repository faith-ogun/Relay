import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadRelayState, saveRelayState } from '../services/firestoreRelayState';

const STORAGE_VERSION = 1;

type PersistEnvelope<T> = {
  version: number;
  data: T;
  updatedAt: string;
};

type UseRelayUserStateOptions<T extends Record<string, unknown>> = {
  userId: string;
  key: string;
  defaults: T;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const mergeState = <T extends Record<string, unknown>>(base: T, incoming: Partial<T> | null | undefined): T => {
  if (!incoming) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const baseValue = out[key];
    if (isObject(baseValue) && isObject(value)) {
      out[key] = mergeState(baseValue, value as Partial<Record<string, unknown>>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
};

export function useRelayUserState<T extends Record<string, unknown>>({
  userId,
  key,
  defaults,
}: UseRelayUserStateOptions<T>) {
  const storageKey = useMemo(() => `relay:${userId}:${key}:v${STORAGE_VERSION}`, [userId, key]);
  const [state, setState] = useState<T>(defaults);
  const [ready, setReady] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const updateState = useCallback((patch: Partial<T>) => {
    setState((prev) => mergeState(prev, patch));
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    setReady(false);
    setPersistError(null);
    setState(defaults);

    const hydrate = async () => {
      try {
        const localRaw = localStorage.getItem(storageKey);
        if (localRaw) {
          const local = JSON.parse(localRaw) as PersistEnvelope<T> | T;
          const localData = (isObject(local) && 'data' in local ? (local as PersistEnvelope<T>).data : local) as Partial<T>;
          if (!cancelled) setState((prev) => mergeState(prev, localData));
        }
      } catch {
        // Ignore invalid local cache and continue.
      }

      try {
        const remote = await loadRelayState<PersistEnvelope<T> | T>(userId);
        if (!cancelled && remote) {
          const remoteData = (isObject(remote) && 'data' in remote ? (remote as PersistEnvelope<T>).data : remote) as Partial<T>;
          setState((prev) => mergeState(prev, remoteData));
        }
      } catch (err) {
        if (!cancelled) {
          setPersistError(err instanceof Error ? err.message : 'Failed to load persisted data.');
        }
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setReady(true);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [defaults, storageKey, userId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      const envelope: PersistEnvelope<T> = {
        version: STORAGE_VERSION,
        data: state,
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(envelope));
      } catch {
        // Local storage can fail in private mode/quota conditions; ignore.
      }
      saveRelayState(userId, envelope).catch((err) => {
        setPersistError(err instanceof Error ? err.message : 'Failed to save persisted data.');
      });
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state, storageKey, userId]);

  return {
    state,
    setState,
    updateState,
    ready,
    persistError,
  };
}

