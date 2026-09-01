// The handoff between the interview setup screen and the live session.
//
// An interview spans two screens: /interview sets it up, /live runs it, and
// /interview scores it. The context going in and the transcript coming back have
// to survive that hop, and neither belongs in a route param: a job description
// is paragraphs long and a transcript is the whole conversation. URL-encoding
// either one into a path would be slow, lossy, and visible in logs.
//
// So this is a single in-memory slot, deliberately small and deliberately not
// persisted. An interview that did not finish is not an interview, and restoring
// a half-finished one after a cold start would produce a scored report for a
// conversation the learner does not remember having.

import type { InterviewContext, TranscriptTurn } from './interview';

/** Below this there is nothing to score, and a report generated from one
 *  exchange would be a fabricated assessment of a real person. */
export const MIN_TURNS_TO_SCORE = 2;

interface Handoff {
  ctx: InterviewContext;
  /** Set by /live when the learner ends the session. */
  transcript?: TranscriptTurn[];
}

let slot: Handoff | null = null;

/** Called by /interview immediately before navigating into the live session. */
export function beginInterview(ctx: InterviewContext): void {
  slot = { ctx };
}

/** What /live needs to know: the role, seniority and JD the interviewer opens on. */
export function pendingInterview(): InterviewContext | null {
  return slot ? slot.ctx : null;
}

/** Called by /live on End, before routing back. */
export function finishInterview(transcript: TranscriptTurn[]): void {
  if (slot) slot.transcript = transcript;
}

/**
 * Take the finished interview, exactly once.
 *
 * Consuming clears the slot: a report is generated from a transcript, and the
 * same transcript must not be scored twice because the learner navigated back.
 */
export function takeFinishedInterview(): { ctx: InterviewContext; transcript: TranscriptTurn[] } | null {
  if (!slot || !slot.transcript) return null;
  const done = { ctx: slot.ctx, transcript: slot.transcript };
  slot = null;
  return done;
}

/** Abandoned before it started, or the learner backed out. */
export function clearInterview(): void {
  slot = null;
}
