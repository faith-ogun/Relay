"""Quiz Engine — AI-powered question generation for Relay's Learn tab.

Generates personalized electronics questions based on user skill level,
weak areas, and learning history. Uses Gemini for question generation
and Google Cloud Vision for assessing user drawings/annotations.
"""

import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Relay Quiz Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──

class SkillProfile(BaseModel):
    """User's current skill levels across topics."""
    voltage_basics: int = Field(0, ge=0, le=100, description="Mastery 0-100")
    current_flow: int = Field(0, ge=0, le=100)
    breadboard: int = Field(0, ge=0, le=100)
    sensors: int = Field(0, ge=0, le=100)
    resistors: int = Field(0, ge=0, le=100)
    leds: int = Field(0, ge=0, le=100)
    arduino_code: int = Field(0, ge=0, le=100)
    circuit_design: int = Field(0, ge=0, le=100)

class GenerateRequest(BaseModel):
    """Request to generate personalized questions."""
    skill_profile: SkillProfile
    topic: Optional[str] = None  # Specific topic, or None for weakest area
    count: int = Field(5, ge=1, le=10)
    difficulty: Optional[str] = None  # easy, medium, hard, or None for adaptive
    allowed_types: Optional[list[str]] = None  # optional frontend constraint

class QuestionOption(BaseModel):
    text: str
    is_correct: bool

class GeneratedQuestion(BaseModel):
    """A single generated question."""
    type: str  # multiple_choice, true_false, fill_blank, spot_error, identify
    topic: str
    difficulty: str
    question: str
    options: Optional[list[QuestionOption]] = None
    correct_answer: Optional[str] = None
    explanation: str
    diagram_id: Optional[str] = None  # Reference to a circuit diagram
    hint: Optional[str] = None

class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestion]
    recommended_topic: str
    skill_gaps: list[str]

class AssessDrawingRequest(BaseModel):
    """Request to assess a user's circuit drawing or annotation."""
    image_base64: str
    expected_components: list[str]
    exercise_type: str  # circle_component, draw_circuit, spot_error

class AssessDrawingResponse(BaseModel):
    correct: bool
    feedback: str
    identified_components: list[str]
    confidence: float


# ── Gemini integration ──

def _get_genai_client():
    """Get Gemini client (Vertex AI or API key)."""
    try:
        from google import genai
        use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"
        if use_vertex:
            return genai.Client(
                vertexai=True,
                project=os.getenv("GOOGLE_CLOUD_PROJECT", "relay-gemini"),
                location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
            )
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            return genai.Client(api_key=api_key)
    except ImportError:
        pass
    return None


QUESTION_GEN_PROMPT = """You are a question generator for an electronics learning platform.
Generate {count} questions for a student learning electronics/Arduino.

Student skill profile:
{profile}

Target topic: {topic}
Difficulty: {difficulty}

Available question types:
- multiple_choice: 4 options, one correct
- true_false: statement that is true or false
- fill_blank: fill in a numerical or short text answer
- spot_error: describe a circuit with an error to find
- identify: name a component or concept from description

Available circuit diagrams you can reference (use diagram_id field):
- series_circuit: Basic series circuit with battery, resistor, LED
- parallel_circuit: Two parallel LED branches
- voltage_divider: LDR + resistor voltage divider
- ldr_alarm: Full light-activated alarm circuit
- led_no_resistor: LED without current-limiting resistor (error)
- reversed_led: LED installed backwards (error)
- short_circuit: Wire bypassing components (error)

Return a JSON array of questions. Each question must have:
- type: one of the types above
- topic: the electronics topic
- difficulty: easy/medium/hard
- question: the question text
- options: (for multiple_choice) array of {{text, is_correct}} objects
- correct_answer: (for fill_blank, true_false) the answer
- explanation: why the answer is correct
- diagram_id: (optional) reference to a circuit diagram to show
- hint: (optional) a hint for the student

Focus on the student's WEAKEST areas. Make questions practical and related to
real Arduino projects. Include circuit analysis, component identification,
troubleshooting, and Ohm's law calculations.

IMPORTANT: Return ONLY valid JSON, no markdown formatting."""


@app.post("/generate", response_model=GenerateResponse)
async def generate_questions(req: GenerateRequest):
    """Generate personalized questions based on skill profile."""
    profile_dict = req.skill_profile.model_dump()

    # Find weakest areas
    sorted_skills = sorted(profile_dict.items(), key=lambda x: x[1])
    skill_gaps = [name for name, score in sorted_skills if score < 70][:3]
    recommended_topic = req.topic or sorted_skills[0][0]

    # Determine difficulty
    avg_skill = sum(profile_dict.values()) / len(profile_dict)
    if req.difficulty:
        difficulty = req.difficulty
    elif avg_skill < 30:
        difficulty = "easy"
    elif avg_skill < 60:
        difficulty = "medium"
    else:
        difficulty = "hard"

    # Try Gemini generation
    client = _get_genai_client()
    if client:
        try:
            prompt = QUESTION_GEN_PROMPT.format(
                count=req.count,
                profile=json.dumps(profile_dict, indent=2),
                topic=recommended_topic,
                difficulty=difficulty,
            )
            if req.allowed_types:
                prompt += (
                    "\n\nOnly return question types from this list: "
                    + ", ".join(req.allowed_types)
                    + "."
                )
            response = client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
            )
            raw = response.text.strip()
            # Strip markdown code block if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                raw = raw.rsplit("```", 1)[0]
            questions_data = json.loads(raw)
            questions = [GeneratedQuestion(**q) for q in questions_data]
            if req.allowed_types:
                allowed = set(req.allowed_types)
                questions = [q for q in questions if q.type in allowed]
            return GenerateResponse(
                questions=questions[: req.count],
                recommended_topic=recommended_topic,
                skill_gaps=skill_gaps,
            )
        except Exception as e:
            # Fall back to pre-built questions
            print(f"Gemini generation failed: {e}")

    # Fallback: return pre-built questions for the topic
    fallback = _get_fallback_questions(
        recommended_topic,
        difficulty,
        req.count,
        req.allowed_types,
    )
    return GenerateResponse(
        questions=fallback,
        recommended_topic=recommended_topic,
        skill_gaps=skill_gaps,
    )


@app.post("/assess-drawing", response_model=AssessDrawingResponse)
async def assess_drawing(req: AssessDrawingRequest):
    """Assess a user's drawing/annotation using Cloud Vision."""
    client = _get_genai_client()
    if not client:
        raise HTTPException(503, "Vision service unavailable")

    try:
        import base64
        image_bytes = base64.b64decode(req.image_base64)

        prompt = f"""Analyze this electronics drawing/annotation.
The student was asked to: {req.exercise_type}
Expected components: {', '.join(req.expected_components)}

Evaluate:
1. Did they correctly identify/draw what was asked?
2. What components can you identify in their drawing?
3. Is their answer correct?

Return JSON: {{"correct": bool, "feedback": str, "identified_components": [str], "confidence": float}}"""

        from google.genai import types
        response = client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        types.Part(inline_data=types.Blob(data=image_bytes, mime_type="image/png")),
                    ],
                ),
            ],
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        result = json.loads(raw)
        return AssessDrawingResponse(**result)
    except Exception as e:
        raise HTTPException(500, f"Assessment failed: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "quiz-engine"}


# ── Fallback question bank ──

def _get_fallback_questions(
    topic: str,
    difficulty: str,
    count: int,
    allowed_types: Optional[list[str]] = None,
) -> list[GeneratedQuestion]:
    """Pre-built questions when Gemini is unavailable."""
    bank: list[GeneratedQuestion] = [
        GeneratedQuestion(
            type="spot_error", topic="circuit_design", difficulty="medium",
            question="This LED circuit is missing something critical. Click on the problem area.",
            explanation="An LED without a current-limiting resistor will draw too much current and burn out instantly.",
            diagram_id="led_no_resistor",
        ),
        GeneratedQuestion(
            type="spot_error", topic="circuit_design", difficulty="medium",
            question="Something is wrong with this LED circuit. Can you spot it?",
            explanation="The LED is installed backwards. The anode (longer leg) must connect to the positive side.",
            diagram_id="reversed_led",
        ),
        GeneratedQuestion(
            type="spot_error", topic="circuit_design", difficulty="hard",
            question="There's a dangerous problem in this circuit. Find it!",
            explanation="A wire is bypassing the resistor and LED, creating a short circuit that could damage the battery.",
            diagram_id="short_circuit",
        ),
        GeneratedQuestion(
            type="multiple_choice", topic="voltage_basics", difficulty="easy",
            question="In this voltage divider, what happens to Vout when the LDR is in darkness?",
            options=[
                QuestionOption(text="Vout increases toward 5V", is_correct=False),
                QuestionOption(text="Vout decreases toward 0V", is_correct=True),
                QuestionOption(text="Vout stays the same", is_correct=False),
                QuestionOption(text="The circuit breaks", is_correct=False),
            ],
            explanation="In darkness, LDR resistance increases, so R1 gets more voltage share, leaving less for R2 (Vout).",
            diagram_id="voltage_divider",
        ),
        GeneratedQuestion(
            type="multiple_choice", topic="current_flow", difficulty="medium",
            question="Looking at this parallel circuit, which LED is brighter if R1 = 220Ω and R2 = 330Ω?",
            options=[
                QuestionOption(text="LED 1 (with R1)", is_correct=True),
                QuestionOption(text="LED 2 (with R2)", is_correct=False),
                QuestionOption(text="They're equally bright", is_correct=False),
                QuestionOption(text="Neither lights up", is_correct=False),
            ],
            explanation="LED 1 has a smaller resistor (220Ω vs 330Ω), so more current flows through it: I = V/R.",
            diagram_id="parallel_circuit",
        ),
        GeneratedQuestion(
            type="identify", topic="circuit_design", difficulty="easy",
            question="In the Light-Activated Alarm circuit, which component senses light?",
            explanation="The LDR (Light Dependent Resistor) changes resistance based on light level.",
            diagram_id="ldr_alarm",
            correct_answer="ldr",
        ),
        GeneratedQuestion(
            type="fill_blank", topic="resistors", difficulty="medium",
            question="In a series circuit with a 5V battery and 250Ω total resistance, the current is ___ mA",
            correct_answer="20",
            explanation="I = V/R = 5V / 250Ω = 0.02A = 20mA",
            diagram_id="series_circuit",
            hint="Use Ohm's Law: I = V/R",
        ),
        GeneratedQuestion(
            type="true_false", topic="breadboard", difficulty="easy",
            question="On a standard breadboard, holes e5 and f5 are electrically connected.",
            correct_answer="false",
            explanation="The center gap separates rows a-e from f-j. They are NOT connected across the gap.",
            diagram_id="breadboard_layout",
        ),
    ]
    # Filter by topic if specific
    if topic and topic != "weakest":
        filtered = [q for q in bank if q.topic == topic]
        if filtered:
            bank = filtered
    if allowed_types:
        allowed = set(allowed_types)
        filtered = [q for q in bank if q.type in allowed]
        if filtered:
            bank = filtered
    return bank[:count]
