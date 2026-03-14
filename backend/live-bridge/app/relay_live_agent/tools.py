"""Multi-model tool functions for the live agent.

The live agent (native-audio model) calls these tools when it needs
a stronger model for code generation, deep reasoning, or quick lookups.
Each tool internally uses google.genai to call the appropriate model.
"""

import os
from google import genai

# Model routing
FLASH_MODEL = os.getenv("RELAY_FLASH_MODEL", "gemini-3.1-flash-preview")
PRO_MODEL = os.getenv("RELAY_PRO_MODEL", "gemini-3.1-pro-preview")
REASONING_MODEL = os.getenv("RELAY_REASONING_MODEL", "gemini-2.5-pro")


def _get_client() -> genai.Client:
    """Get a genai client (works with both API key and Vertex AI)."""
    use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "FALSE").upper() == "TRUE"
    if use_vertex:
        return genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "europe-west1"),
        )
    return genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


def generate_arduino_code(description: str, components: str, stage: str = "code") -> str:
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

    response = client.models.generate_content(model=PRO_MODEL, contents=prompt)
    return response.text


def debug_code(code: str, error_message: str) -> str:
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

    response = client.models.generate_content(model=PRO_MODEL, contents=prompt)
    return response.text


def explain_concept(concept: str, context: str = "") -> str:
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

    response = client.models.generate_content(model=REASONING_MODEL, contents=prompt)
    return response.text


def identify_component(description: str) -> str:
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

    response = client.models.generate_content(model=FLASH_MODEL, contents=prompt)
    return response.text
