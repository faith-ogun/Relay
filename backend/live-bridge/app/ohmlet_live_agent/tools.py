"""Multi-model tool functions for the live agent.

The live agent (native-audio model) calls these tools when it needs
a stronger model for code generation, deep reasoning, or quick lookups.
Each tool internally uses google.genai to call the appropriate model.

Every tool here is `async` on purpose. ADK's FunctionTool awaits a coroutine
tool but calls a SYNCHRONOUS one directly on the event loop, with no thread
offload (see `_invoke_callable`). A Pro-model call takes seconds, so a single
sync tool would stall the loop for every OTHER live session sharing the
instance: their audio stops flowing while one learner waits for a code
generation. Async keeps each session's latency its own.
"""

import contextvars
import os
import threading
from google import genai

# Model routing
FLASH_MODEL = os.getenv("OHMLET_FLASH_MODEL", "gemini-3.7-flash")
PRO_MODEL = os.getenv("OHMLET_PRO_MODEL", "gemini-3.1-pro-preview")
REASONING_MODEL = os.getenv("OHMLET_REASONING_MODEL", "gemini-3.1-pro-preview")

# Plan-aware routing: priority plans (Pro/max) get the premium models for the
# expensive code + reasoning tools; everyone else is routed to Flash so a Free
# session can't quietly run up Pro-model spend. The WS handler sets this per
# session via set_priority_models(); contextvars keep it isolated per session.
_priority_models: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "ohmlet_priority_models", default=False
)


def set_priority_models(enabled: bool) -> None:
    """Called once per live session to select the model tier for its plan."""
    _priority_models.set(enabled)


def _code_model() -> str:
    return PRO_MODEL if _priority_models.get() else FLASH_MODEL


def _reasoning_model() -> str:
    return REASONING_MODEL if _priority_models.get() else FLASH_MODEL


# One client per process. It was previously constructed per tool call, which
# meant re-resolving credentials and building a fresh connection pool on every
# invocation — pure latency on the learner's critical path. The client is
# thread-safe and holds the pooled HTTP transport, so it is built once.
_client: genai.Client | None = None
_client_lock = threading.Lock()


def _get_client() -> genai.Client:
    """The process-wide genai client (works with both API key and Vertex AI)."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "FALSE").upper() == "TRUE"
                if use_vertex:
                    _client = genai.Client(
                        vertexai=True,
                        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
                        location=os.getenv(
                            "OHMLET_TEXT_LOCATION",
                            os.getenv("GOOGLE_CLOUD_LOCATION", "global"),
                        ),
                    )
                else:
                    _client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    return _client


async def generate_arduino_code(description: str, components: str, stage: str = "code") -> str:
    """Generate Arduino sketch code for a given circuit description.

    Use this tool when the user needs Arduino code written, debugged, or explained.
    Provide a clear description of what the circuit should do and what components are involved.

    Args:
        description: What the circuit should do (e.g. "Turn on LED when LDR detects darkness")
        components: Comma-separated list of components (e.g. "Arduino Uno, LDR, 10k resistor, LED")
        stage: Current build stage for context

    Returns:
        Complete Arduino sketch code with comments.
    """
    client = _get_client()
    prompt = f"""You are an Arduino code generator. Write a complete, working Arduino sketch.

Circuit description: {description}
Components: {components}
Build stage: {stage}

Rules:
- Write complete code (include setup() and loop())
- Add clear comments explaining each section
- Use descriptive variable names
- Include serial output for debugging
- Handle edge cases (debounce, etc.) where appropriate
- Keep it beginner-friendly

Return ONLY the Arduino code, no markdown fences."""

    response = await client.aio.models.generate_content(model=_code_model(), contents=prompt)
    return response.text


async def debug_code(code: str, error_message: str) -> str:
    """Debug Arduino code given a compile or runtime error.

    Use this tool when the user reports an error with their Arduino code.

    Args:
        code: The Arduino code that has an error
        error_message: The error message from the Arduino IDE or serial monitor

    Returns:
        Corrected code with explanation of what was wrong.
    """
    client = _get_client()
    prompt = f"""You are an Arduino debugging expert. Fix this code.

Code:
{code}

Error:
{error_message}

Respond with:
1. A one-line explanation of the bug
2. The corrected complete code (no markdown fences)"""

    response = await client.aio.models.generate_content(model=_code_model(), contents=prompt)
    return response.text


async def explain_concept(concept: str, context: str = "") -> str:
    """Explain an electronics or Arduino concept in depth.

    Use this tool when the user asks "why" or "how does this work" about a concept
    that needs a thorough explanation. For quick answers, just respond directly.

    Args:
        concept: The concept to explain (e.g. "voltage divider", "PWM", "pull-up resistor")
        context: Additional context about what the user is building

    Returns:
        Clear, beginner-friendly explanation.
    """
    client = _get_client()
    prompt = f"""Explain this electronics/Arduino concept for a beginner:

Concept: {concept}
Context: {context or "General electronics learning"}

Rules:
- Use simple analogies
- Keep it under 150 words
- Relate it to practical use in Arduino projects
- If relevant, mention common mistakes beginners make"""

    response = await client.aio.models.generate_content(model=_reasoning_model(), contents=prompt)
    return response.text


async def identify_component(description: str) -> str:
    """Quickly identify an electronic component from a description.

    Use this tool when the user holds up a component to the camera and you need
    to confirm what it is, or when they describe something they're unsure about.

    Args:
        description: Visual description of the component (color bands, shape, markings, etc.)

    Returns:
        Component identification with key specs.
    """
    client = _get_client()
    prompt = f"""Identify this electronic component from the description:

{description}

Respond in this format:
Component: [name]
Value/Rating: [if applicable]
Purpose: [one sentence]
Tip: [one beginner-friendly tip about using it]"""

    response = await client.aio.models.generate_content(model=FLASH_MODEL, contents=prompt)
    return response.text
