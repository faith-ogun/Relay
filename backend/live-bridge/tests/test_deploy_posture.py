"""The deployed billing posture, read from deploy.sh rather than assumed.

`revenuecat.ACCEPT_SANDBOX` decides whether a FREE Apple sandbox purchase grants
a real plan in production Firestore. The unit tests around the handler cover both
settings, which means they pass whichever one we ship. This file covers the thing
those cannot: which one we actually ship.

It exists because the original form of this control was a hardcoded

    OHMLET_ACCEPT_SANDBOX_BILLING=true

sitting above a comment reading "REMOVE BEFORE LAUNCH". That is not a gate. It is
a note asking a human to remember something months from now, on the day they are
busiest, and the cost of forgetting is that anyone with a free sandbox tester
account holds a Max subscription.

Now the deploy is safe when nobody is thinking about it, and turning it on costs
one env var for one invocation:

    OHMLET_ACCEPT_SANDBOX_BILLING=true ./deploy.sh live-bridge
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

DEPLOY = Path(__file__).resolve().parents[3] / "deploy.sh"


@pytest.fixture(scope="module")
def deploy_sh() -> str:
    assert DEPLOY.is_file(), f"deploy.sh not found at {DEPLOY}; this test has gone stale"
    return DEPLOY.read_text()


def test_sandbox_billing_is_not_hardcoded_on(deploy_sh: str) -> None:
    """No assignment may switch it on unconditionally."""
    # Matches an assignment to a literal true that is NOT reading the env var,
    # i.e. `OHMLET_ACCEPT_SANDBOX_BILLING=true` rather than the `${...:-}` test.
    hardcoded = [
        line for line in deploy_sh.splitlines()
        if re.search(r'^\s*OHMLET_ACCEPT_SANDBOX_BILLING=(true|1|yes)', line, re.I)
    ]
    assert not hardcoded, (
        "deploy.sh switches sandbox billing on unconditionally:\n  "
        + "\n  ".join(hardcoded)
        + "\nA free Apple sandbox purchase would grant a real plan in production "
          "Firestore. Gate it behind the env var instead:\n"
          "  OHMLET_ACCEPT_SANDBOX_BILLING=true ./deploy.sh live-bridge"
    )


def test_sandbox_billing_is_opt_in_per_invocation(deploy_sh: str) -> None:
    """The opt-in path must still exist, or the rail becomes untestable."""
    assert re.search(r'\$\{OHMLET_ACCEPT_SANDBOX_BILLING:-\}', deploy_sh), (
        "the env-var opt-in for sandbox billing is gone. Verifying an iOS purchase "
        "end to end needs it, and deleting it pushes the next person back to "
        "editing the file, which is how it was left switched on before."
    )


def test_turning_it_on_is_loud(deploy_sh: str) -> None:
    """A silent switch is one nobody notices is still thrown."""
    parts = deploy_sh.split('${OHMLET_ACCEPT_SANDBOX_BILLING:-}', 1)
    assert len(parts) == 2, (
        "no sandbox opt-in block to check. test_sandbox_billing_is_opt_in_per_invocation "
        "explains why it has to exist."
    )
    block = parts[1].split('\nfi', 1)[0]
    assert re.search(r'SANDBOX BILLING IS ON', block), (
        "enabling sandbox billing prints no warning. The deploy log is the only "
        "place this is visible after the fact."
    )
    assert '1;31' in block, "the warning is not printed in red; it needs to stand out in a long deploy log"
