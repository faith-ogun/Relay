export type SkillProfilePayload = {
  voltage_basics: number;
  current_flow: number;
  breadboard: number;
  sensors: number;
  resistors: number;
  leds: number;
  arduino_code: number;
  circuit_design: number;
};

export type QuizOption = {
  text: string;
  is_correct: boolean;
};

export type QuizQuestion = {
  type: string;
  topic: string;
  difficulty: string;
  question: string;
  options?: QuizOption[];
  correct_answer?: string;
  explanation: string;
  diagram_id?: string;
  hint?: string;
};

export type GenerateQuizRequest = {
  skill_profile: SkillProfilePayload;
  topic?: string;
  count?: number;
  difficulty?: string;
  allowed_types?: string[];
};

export type GenerateQuizResponse = {
  questions: QuizQuestion[];
  recommended_topic: string;
  skill_gaps: string[];
};

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

export type AssessDrawingRequest = {
  image_base64: string;
  expected_components: string[];
  exercise_type: 'circle_component' | 'draw_circuit' | 'spot_error';
};

export type AssessDrawingResponse = {
  correct: boolean;
  feedback: string;
  identified_components: string[];
  confidence: number;
};

export async function assessDrawing(
  apiBaseUrl: string,
  request: AssessDrawingRequest
): Promise<AssessDrawingResponse> {
  const root = normalizeUrl(apiBaseUrl);
  const response = await fetch(`${root}/assess-drawing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Drawing assessment failed (${response.status}): ${body}`);
  }
  return (await response.json()) as AssessDrawingResponse;
}

export async function generateQuizQuestions(
  apiBaseUrl: string,
  request: GenerateQuizRequest
): Promise<GenerateQuizResponse> {
  const root = normalizeUrl(apiBaseUrl);
  const response = await fetch(`${root}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Quiz generation failed (${response.status}): ${body}`);
  }
  return (await response.json()) as GenerateQuizResponse;
}

