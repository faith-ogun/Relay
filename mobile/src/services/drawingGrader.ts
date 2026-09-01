// Drawing assessment, via the quiz-engine's vision model.
//
// A freeform circuit sketch cannot be graded by string comparison, so the
// captured canvas goes to /assess-drawing, which identifies the components
// present and compares them against what the step expected.
//
// The endpoint now requires a Firebase token (it was briefly an open Gemini
// endpoint, closed in the August audit), so every call is authenticated.

import { QUIZ_BASE } from './config';
import { getIdToken } from './firebase';

export interface DrawingVerdict {
  correct: boolean;
  feedback: string;
  identified: string[];
  confidence: number;
}

export const drawingGraderConfigured = (): boolean => !!QUIZ_BASE;

/**
 * Grade a drawing. Returns null when the grader is unreachable, so the caller
 * can fall back rather than marking a learner wrong for a network failure —
 * being told you are wrong when the service is simply down is the worst
 * possible outcome here.
 */
export async function gradeDrawing(
  imageBase64: string,
  expectedComponents: string[],
  exerciseType: string,
): Promise<DrawingVerdict | null> {
  if (!QUIZ_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;

  try {
    const res = await fetch(`${QUIZ_BASE}/assess-drawing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        image_base64: imageBase64,
        expected_components: expectedComponents,
        exercise_type: exerciseType,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      correct: !!data.correct,
      feedback: String(data.feedback ?? ''),
      identified: Array.isArray(data.identified_components) ? data.identified_components : [],
      confidence: Number(data.confidence ?? 0),
    };
  } catch {
    return null;
  }
}
