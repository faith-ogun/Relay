// ── Product analytics, first-party ──
//
// No third-party SDK, on purpose. Ohmlet ships with no tracker of any kind,
// which is why the privacy manifest says NSPrivacyTracking: false and the app
// shows no App Tracking Transparency prompt. An analytics SDK would flip that,
// cost a prompt most people decline, and hand a third party a copy of who is
// learning what.
//
// Events go to our own backend in europe-west1 instead. The catalogue mirrors
// frontend/services/analytics.ts, so a web funnel and a mobile funnel are the
// same funnel.
//
// Three properties this has to have, because analytics that misbehaves is worse
// than none:
//   - It never blocks the learner. Every call returns immediately.
//   - It never throws into a handler.
//   - It survives being offline: events queue and go out on the next flush
//     rather than being lost or retried in a tight loop.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE } from './config';
import { getIdToken } from './firebase';

export type AnalyticsEvent =
  | 'sign_up' | 'login' | 'onboarding_complete' | 'setup_complete'
  | 'lesson_start' | 'lesson_complete'
  | 'live_session_start' | 'live_session_end'
  | 'build_complete' | 'first_build_complete'
  | 'streak_extended' | 'challenge_join' | 'challenge_leave'
  | 'simulator_open' | 'sketch_compile' | 'twin_generated'
  | 'twin_shared' | 'shared_twin_view' | 'shared_twin_cta'
  | 'interview_start' | 'interview_complete'
  | 'paywall_view' | 'checkout_start' | 'purchase_complete' | 'restore_purchases'
  | 'account_delete_start' | 'account_deleted';

type Props = Record<string, string | number | boolean>;

interface Queued {
  name: AnalyticsEvent;
  props: Props;
  at: string;
  platform: string;
}

const QUEUE_KEY = 'ohmlet.events.v1';
const MAX_QUEUE = 200;      // beyond this the oldest are dropped, not the newest
const BATCH = 50;           // matches the server's cap
const FLUSH_AFTER_MS = 4000;

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let loaded = false;
let sending = false;

async function loadQueue(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) queue = JSON.parse(raw) as Queued[];
  } catch {
    queue = [];
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* storage blocked: events live in memory for this session only */
  }
}

/**
 * Record an event. Fire and forget: never awaited by a caller, never throws.
 */
export function track(name: AnalyticsEvent, props: Props = {}): void {
  void (async () => {
    try {
      await loadQueue();
      queue.push({ name, props, at: new Date().toISOString(), platform: Platform.OS });
      if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
      await persist();
      schedule();
    } catch {
      /* analytics must never be the reason something the learner did fails */
    }
  })();
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => { timer = null; void flush(); }, FLUSH_AFTER_MS);
}

/**
 * Send what is queued. Called on a timer and at natural boundaries (sign-out,
 * before an account is deleted) where losing the queue would lose the answer.
 */
export async function flush(): Promise<void> {
  if (sending) return;
  await loadQueue();
  if (!queue.length) return;

  const token = await getIdToken();
  if (!token) return;                    // signed out: keep them for later

  sending = true;
  const batch = queue.slice(0, BATCH);
  try {
    const res = await fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: batch }),
    });
    if (res.ok) {
      queue = queue.slice(batch.length);
      await persist();
      if (queue.length) schedule();      // more to send
    } else if (res.status === 422 || res.status === 413) {
      // The server rejected the SHAPE of this batch. Retrying forever would
      // wedge the queue behind a poisoned event, so drop it and move on.
      queue = queue.slice(batch.length);
      await persist();
    }
    // Any other status (offline, 5xx, rate limited) leaves the queue intact.
  } catch {
    /* offline: try again on the next event */
  } finally {
    sending = false;
  }
}

/** Drop everything queued. Called when an account is deleted on this device. */
export async function clearEvents(): Promise<void> {
  queue = [];
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    /* nothing stored */
  }
}
