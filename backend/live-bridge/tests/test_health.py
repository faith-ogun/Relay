"""/health is the only unauthenticated endpoint, and the only way to answer
"which curriculum is production actually serving?" without minting a token.

That question is asked after every curriculum deploy. It went unanswerable for
long enough that a curriculum change was verified by comparing a Cloud Run
revision timestamp against a git commit timestamp, which proves when a container
was built and not what is inside it.
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from fastapi.testclient import TestClient


def _client():
    from main import app

    return TestClient(app)


def test_health_is_open_and_says_which_service_answered():
    res = _client().get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "live-bridge"


def test_health_reports_the_curriculum_the_service_is_serving():
    from curriculum import content_version

    body = _client().get("/health").json()
    assert body["curriculum"] == content_version()
    # A stamp is a content hash. An empty one means the curriculum failed to
    # load, and a health check that says "ok" while serving no lessons is worse
    # than one that fails.
    assert body["curriculum"], "the service is serving no curriculum at all"
