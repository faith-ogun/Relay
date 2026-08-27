// Checkpoints — the reward for clearing a whole skill, granted by the server.
//
// The mirror of frontend/services/checkpoints.ts, against the same endpoints, so
// a checkpoint collected in the browser is already paid when the app opens.
//
// The server owns the reward completely (backend/live-bridge/app/checkpoints.py):
// it decides WHICH skills are cleared by reading the learner's own state, it
// computes the XP from the authored step count, and it records the grant inside
// a Firestore transaction keyed on (uid, skillId). A second claim therefore
// grants zero, whatever this client does.
//
// What the CLIENT owns is the running XP total, which lives in the shared
// progress record. That split is the whole reason this file is careful: if the
// client also added XP optimistically, a learner who tapped twice, or collected
// on their phone and then opened the web, would be paid once by the server's
// record and twice by their own counter.
//
// So there is no optimistic add anywhere here. Instead the progress record
// carries a LEDGER, `checkpointXp`: how much checkpoint XP has already been
// folded into `xp`. Every fold names an ABSOLUTE total and pays only the
// difference, so running it twice, on two devices, out of order, or after the
// app is killed between the claim and the save all land on the same number.
// Nothing here ever adds a delta to whatever the ledger happens to hold: that
// is the one shape that double-pays, because two things can fold the same
// grant.

import { API_BASE } from './config';
import { getIdToken } from './firebase';

/** One cleared skill and what it paid. Returned by both endpoints. */
export interface CheckpointReward {
  skillId: string;
  title: string;
  unitId: string;
  xp: number;
}

export interface CheckpointStatus {
  /** skillId -> XP already granted. The server's record, not ours. */
  claimed: Record<string, number>;
  /** Cleared but unpaid: every one of these is collectable right now. */
  available: CheckpointReward[];
  /** Sum of `claimed`. The figure the local ledger reconciles against. */
  totalClaimedXp: number;
}

export interface CheckpointGrant {
  /** What this call actually paid. Empty means the claim was a no-op, which is
   *  the normal answer on a device that is catching up rather than earning. */
  granted: CheckpointReward[];
  xp: number;
}

/** Why a call failed, at the resolution the UI needs. Matches community.ts. */
export type FailReason =
  | 'offline'
  | 'timeout'
  | 'unauthenticated'
  | 'rate_limited'
  | 'server';

export type Result<T> = { ok: true; data: T } | { ok: false; reason: FailReason };

/** Anything carrying the XP total and the ledger beside it. */
export interface XpLedger {
  xp: number;
  /** Checkpoint XP already folded into `xp`. Absent on records written before
   *  checkpoints paid out, which is correctly read as zero: nothing had been
   *  granted then, because no client called the endpoint. */
  checkpointXp?: number;
}

/**
 * React Native's fetch has NO default timeout, so a request on a weak
 * connection can sit open indefinitely and the screen just looks dead. Twelve
 * seconds covers a Cloud Run cold start on a slow link and still surfaces a real
 * failure while the learner is looking at it.
 */
const TIMEOUT_MS = 12_000;

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  if (!API_BASE) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  // A missing token is a session problem, not a network one, and telling
  // someone to check their connection when they need to sign in again wastes
  // their time.
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/v1/me${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthenticated' };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const aborted = (err as { name?: string } | null)?.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** What has been granted, and what is earned and waiting. */
export function fetchCheckpoints(): Promise<Result<CheckpointStatus>> {
  return call<CheckpointStatus>('/checkpoints');
}

// One claim in flight at a time, so a second tap costs no second round trip.
// Note what this dedupe does NOT do: both callers get the SAME reply, so both
// see the same non-empty grant, and both fold it. Correctness therefore cannot
// rest here or on the button's disabled state — it rests on `foldClaim` naming
// an absolute total, which makes the second fold a no-op.
let claiming: Promise<Result<CheckpointGrant>> | null = null;

/**
 * Collect every checkpoint earned and not yet paid for.
 *
 * Never retried. A POST that timed out may well have been applied, and the reply
 * carries the ceremony: a retry could celebrate a grant that already happened,
 * or show nothing for one that did.
 */
export function claimCheckpoints(): Promise<Result<CheckpointGrant>> {
  if (claiming) return claiming;
  const p = call<CheckpointGrant>('/checkpoints/claim', { method: 'POST' });
  claiming = p;
  // Cleared from outside the promise chain, so a synchronous rejection cannot
  // latch this forever.
  void p.finally(() => { if (claiming === p) claiming = null; });
  return p;
}

/**
 * Fold the server's total granted XP into a progress record, exactly once.
 *
 * Returns the patch to apply, or null when the record is already square with
 * the server, which is the common case and worth detecting so an untouched
 * record is not rewritten on every visit.
 *
 * `checkpointXp` is a HIGH-WATER MARK, not simply the last total seen. A total
 * LOWER than the mark can only be a stale read: a GET issued before a claim
 * committed and answered after it. Writing that back would leave the granted XP
 * sitting inside `xp` with nothing accounting for it, and the next fetch would
 * pay it a second time. A genuinely lower server total means the claim record
 * was restored from a backup; holding the mark under-pays a re-grant in that one
 * case, which is the right way round to be wrong.
 */
export function foldCheckpointXp<T extends XpLedger>(
  progress: T,
  totalClaimedXp: number,
): Pick<XpLedger, 'xp' | 'checkpointXp'> | null {
  if (!Number.isFinite(totalClaimedXp) || totalClaimedXp < 0) return null;
  const folded = progress.checkpointXp ?? 0;
  if (totalClaimedXp <= folded) return null;
  return { xp: progress.xp + (totalClaimedXp - folded), checkpointXp: totalClaimedXp };
}

/**
 * Fold a claim this client has just been handed, without waiting to re-read the
 * server's total.
 *
 * `totalClaimedBefore` is the total this client last saw from GET /checkpoints,
 * captured when the claim was fired. With `grantedXp` it names an ABSOLUTE
 * total, and that is what makes this safe. Adding a delta to whatever the ledger
 * happens to hold when the reply lands double-pays whenever something else
 * folded the same grant first, and two things can: a background status refresh
 * that raced the claim, and a second caller awaiting the same deduplicated
 * promise. Folding to a fixed number makes both of those no-ops, because the
 * ledger is already standing there.
 *
 * It can never land long. The skills in `granted` were absent from the claim
 * record the server read, so they were absent from `totalClaimedBefore` too, and
 * that record only grows: `totalClaimedBefore + grantedXp` is at most the
 * server's true total. When it lands short, because another device collected
 * something this record never saw, the next `foldCheckpointXp` against a
 * fetched status adds the remainder.
 */
export function foldClaim<T extends XpLedger>(
  progress: T,
  totalClaimedBefore: number,
  grantedXp: number,
): Pick<XpLedger, 'xp' | 'checkpointXp'> | null {
  if (!Number.isFinite(grantedXp) || grantedXp <= 0) return null;
  if (!Number.isFinite(totalClaimedBefore) || totalClaimedBefore < 0) return null;
  return foldCheckpointXp(progress, totalClaimedBefore + grantedXp);
}
