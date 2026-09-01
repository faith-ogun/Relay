"""The live agent's tools must never block the event loop.

ADK's FunctionTool awaits a coroutine tool but calls a synchronous one directly
on the running loop, with no thread offload:

    if is_async:
        return await target(**args_to_call)
    else:
        return target(**args_to_call)          # <- blocks everything

A Gemini Pro call takes seconds. One synchronous tool therefore freezes audio for
every OTHER learner sharing the Cloud Run instance while one of them waits for a
code generation. That is invisible in a single-user test and obvious under load,
so it is asserted here instead.
"""

from __future__ import annotations

import inspect

import pytest

from ohmlet_live_agent import tools as agent_tools

TOOLS = [
    agent_tools.generate_arduino_code,
    agent_tools.debug_code,
    agent_tools.explain_concept,
    agent_tools.identify_component,
]


@pytest.mark.parametrize("tool", TOOLS, ids=lambda t: t.__name__)
def test_tool_is_a_coroutine_function(tool):
    assert inspect.iscoroutinefunction(tool), (
        f"{tool.__name__} is synchronous. ADK will call it on the event loop and "
        f"stall every concurrent live session for the duration of the model call."
    )


def test_every_registered_tool_is_async():
    """Catches a NEW tool added to the agent without being made async."""
    from ohmlet_live_agent.agent import agent, child_agent

    for a in (agent, child_agent):
        for tool in a.tools:
            assert inspect.iscoroutinefunction(tool), (
                f"{a.name} registers a synchronous tool: {getattr(tool, '__name__', tool)}"
            )


def test_client_is_built_once(monkeypatch):
    """The genai client was previously constructed per call, which re-resolved
    credentials and rebuilt a connection pool on the learner's critical path.

    The real constructor is stubbed so this asserts the caching, not the ability
    to reach Google from a test runner.
    """
    built = []

    class FakeClient:
        def __init__(self, **kwargs):
            built.append(kwargs)

    monkeypatch.setattr(agent_tools.genai, "Client", FakeClient)
    monkeypatch.setattr(agent_tools, "_client", None)

    first = agent_tools._get_client()
    second = agent_tools._get_client()

    assert first is second
    assert len(built) == 1, f"client rebuilt {len(built)} times"
