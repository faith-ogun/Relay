"""Child mode (#94): server-side age assessment, verifiable parental consent, and
the gate that keeps an unconsented minor out of a live (camera + mic) session.

How it fits together
--------------------
- The browser shows a neutral age screen; it POSTs birth year + country here. The
  SERVER computes whether the learner is a minor (never trusting a client flag)
  and writes the answer onto the user's Firebase **custom claims**
  (`isMinor`, `consentVerified`, `ageStatus`). Those claims ride in the ID token,
  so the WebSocket handshake can gate a live session by reading the verified token
  with no extra round-trip, exactly like the admin / Max checks already do.

- A minor is held until a parent completes **verifiable parental consent (VPC)**.
  Consent is obtained through a swappable `ConsentProvider`:
    * `stripe`  — a €0 Stripe SetupIntent. The parent authenticates a real card
                  through SCA (3-D Secure); succeeding proves control of an adult
                  payment instrument. This is a proportionate INTERIM VPC (a teen
                  could in theory hold a card, hence "interim").
    * `kws`     — Epic's Kids Web Services, the COPPA-grade engine, wired later
                  (#100) once the admin/email loops are set up. Ships inert.

- The consent record is an append-only document in its own access-restricted
  collection (`ohmlet_consent`), written only by this service via the Admin SDK —
  the DPIA's "separate, access-restricted consent record". Firestore client rules
  deny browser access; the Admin SDK bypasses them.

Everything here is dark until `OHMLET_CHILD_MODE` is switched on AND a provider is
configured, so shipping it changes nothing in production (adults are never gated,
endpoints 503/400 cleanly). Do NOT open child mode to real minors before the DPIA
(#95) is signed off by the solicitor (#99).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

import obs
from auth import require_claims, set_consent_claims

logger = logging.getLogger("ohmlet.consent")

router = APIRouter(prefix="/v1/consent", tags=["consent"])

CONSENT_COLLECTION = os.getenv("OHMLET_CONSENT_COLLECTION", "ohmlet_consent")


def child_mode_enabled() -> bool:
    """Server-side kill switch. Read live (not cached) so the flag can be flipped
    with an env change + restart, and so tests can toggle it."""
    return os.getenv("OHMLET_CHILD_MODE", "").strip().lower() in ("1", "true", "yes", "on")


# ── Age assessment (server-authoritative) ───────────────────────────────────────
# The digital-consent age varies by country (GDPR Art 8 lets member states pick
# 13-16; Ireland is 16). Below the consent age we require verifiable parental
# consent; below the COPPA age (13) we additionally treat the learner as a young
# child (US COPPA + the strictest data-minimisation). Only the BIRTH YEAR is ever
# collected, so age is the calendar-year difference; the server's result is the
# single source of truth and the client only displays it.
CONSENT_AGE_BY_COUNTRY: dict[str, int] = {
    "IE": 16, "DE": 16, "NL": 16, "LT": 16, "LU": 16, "HR": 16,
    "FR": 15, "CZ": 15, "GR": 15, "SK": 15,
    "AT": 14, "BG": 14, "CY": 14, "ES": 14, "IT": 14,
    "BE": 13, "DK": 13, "EE": 13, "FI": 13, "LV": 13, "MT": 13,
    "PT": 13, "PL": 13, "SE": 13, "GB": 13, "US": 13,
}
DEFAULT_CONSENT_AGE = 16  # unknown country -> the strictest common EU threshold
COPPA_AGE = 13
CONTRACT_AGE = 18  # minimum age to enter a paid subscription oneself (#96)
MIN_BIRTH_YEAR_SPAN = 120  # sanity bound for a submitted birth year


def consent_age_for(country: str) -> int:
    return CONSENT_AGE_BY_COUNTRY.get((country or "").strip().upper(), DEFAULT_CONSENT_AGE)


@dataclass
class AgeAssessment:
    birth_year: int
    country: str
    age: int
    consent_age: int
    is_minor: bool
    coppa: bool
    age_status: str  # "adult" | "minor_pending_consent" | "minor_consented"


def assess_age(birth_year: int, country: str, *, consent_verified: bool = False) -> AgeAssessment:
    now_year = datetime.now(timezone.utc).year
    if not isinstance(birth_year, int) or birth_year < now_year - MIN_BIRTH_YEAR_SPAN or birth_year > now_year:
        raise HTTPException(status_code=422, detail="birthYear is out of range")
    country = (country or "").strip().upper()[:2]
    age = now_year - birth_year
    consent_age = consent_age_for(country)
    is_minor = age < consent_age
    coppa = age < COPPA_AGE
    if not is_minor:
        status = "adult"
    elif consent_verified:
        status = "minor_consented"
    else:
        status = "minor_pending_consent"
    return AgeAssessment(
        birth_year=birth_year, country=country, age=age, consent_age=consent_age,
        is_minor=is_minor, coppa=coppa, age_status=status,
    )


# ── The live-session gate (read straight off the verified token) ─────────────────

def is_child(decoded: dict) -> bool:
    """Whether this session must run on the hardened child agent."""
    return child_mode_enabled() and bool(decoded.get("isMinor"))


def live_blocked(decoded: dict) -> str | None:
    """Reason code if this token may NOT open a live session, else None.

    Default-deny for children: with child mode on, every learner must have passed
    the neutral age screen (so we know whether they are a minor), and a minor must
    have verified parental consent. Adults, once assessed, pass untouched. Returns
    a stable code the client maps to the right screen."""
    if not child_mode_enabled():
        return None
    if not decoded.get("ageStatus"):
        return "age_check_required"  # must complete the neutral age screen first
    if decoded.get("isMinor") and not decoded.get("consentVerified"):
        return "consent_required"
    return None


def purchase_blocked(uid: str) -> bool:
    """Payment age gate (#96): a user under 18 cannot enter a paid subscription
    themselves — a parent or guardian manages a child account's plan. Computed from
    the stored birth year (so a 16-17-year-old who is NOT a data-consent minor is
    still blocked from contracting). No gate unless child mode is on and the birth
    year is known."""
    if not child_mode_enabled():
        return False
    birth_year = read_record(uid).get("birthYear")
    if not isinstance(birth_year, int):
        return False
    return (datetime.now(timezone.utc).year - birth_year) < CONTRACT_AGE


# ── Consent record store (append-only, access-restricted) ────────────────────────

def _doc_ref(child_uid: str):
    from state_store import get_client
    return get_client().collection(CONSENT_COLLECTION).document(child_uid)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_record(child_uid: str) -> dict[str, Any]:
    try:
        snap = _doc_ref(child_uid).get()
        return snap.to_dict() or {} if snap.exists else {}
    except Exception as exc:  # a consent read must never crash a session
        logger.warning("consent record read failed for %s: %s", child_uid, exc)
        return {}


def _append_event(child_uid: str, event: str, detail: dict[str, Any] | None = None) -> None:
    """Record one consent lifecycle event. Append-only via ArrayUnion so the audit
    trail is never rewritten (COPPA/GDPR-K expect a durable record of consent)."""
    try:
        from google.cloud import firestore
        _doc_ref(child_uid).set(
            {"events": firestore.ArrayUnion([{"event": event, "at": _now(), "detail": detail or {}}])},
            merge=True,
        )
    except Exception as exc:
        logger.warning("consent event append failed for %s: %s", child_uid, exc)


def _write_age(child_uid: str, a: AgeAssessment) -> None:
    _doc_ref(child_uid).set(
        {
            "childUid": child_uid,
            "birthYear": a.birth_year,          # birth year only, never a full DOB
            "country": a.country,
            "consentAge": a.consent_age,
            "isMinor": a.is_minor,
            "coppa": a.coppa,
            "ageStatus": a.age_status,
            "updatedAt": _now(),
        },
        merge=True,
    )


# ── Consent providers (swappable) ────────────────────────────────────────────────

@dataclass
class ConsentOutcome:
    verified: bool
    reference: str
    detail: dict[str, Any] = field(default_factory=dict)


class ConsentProvider(Protocol):
    name: str
    def is_configured(self) -> bool: ...
    def start(self, *, child_uid: str, parent_email: str, return_base: str) -> dict[str, Any]: ...
    def verify(self, *, reference: str) -> ConsentOutcome: ...


class StripeConsentProvider:
    """Verifiable parental consent by €0 card verification (Stripe Checkout, setup mode).

    The parent is redirected to Stripe's hosted page, enters a card, and completes SCA
    (3-D Secure); nothing is charged.
    Succeeding evidences control of an adult payment instrument, corroborating
    that a real parent gave consent. Proportionate INTERIM VPC; KWS (#100) is the
    stronger upgrade."""

    name = "stripe"

    def is_configured(self) -> bool:
        return bool(os.getenv("STRIPE_SECRET_KEY"))

    def start(self, *, child_uid: str, parent_email: str, return_base: str) -> dict[str, Any]:
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        try:
            customer = stripe.Customer.create(
                email=parent_email or None,
                metadata={"childUid": child_uid, "role": "ohmlet_parent_consent"},
            )
            session = stripe.checkout.Session.create(
                mode="setup",
                customer=customer.id,
                payment_method_types=["card"],
                success_url=f"{return_base}/welcome?consent=return",
                cancel_url=f"{return_base}/welcome?consent=cancel",
                metadata={"childUid": child_uid, "purpose": "ohmlet_parental_consent"},
                setup_intent_data={"metadata": {"childUid": child_uid, "purpose": "ohmlet_parental_consent"}},
            )
        except Exception as exc:
            logger.error("stripe consent start failed for %s: %s", child_uid, exc)
            raise HTTPException(status_code=502, detail="Could not start consent verification.") from exc
        return {"provider": self.name, "reference": session.id, "url": session.url, "customerId": customer.id}

    def verify(self, *, reference: str) -> ConsentOutcome:
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        try:
            session = stripe.checkout.Session.retrieve(reference, expand=["setup_intent"])
        except Exception as exc:
            logger.error("stripe consent verify failed for %s: %s", reference, exc)
            raise HTTPException(status_code=502, detail="Could not verify consent.") from exc
        setup_intent = getattr(session, "setup_intent", None)
        si_status = getattr(setup_intent, "status", None)
        verified = getattr(session, "status", None) == "complete" and si_status == "succeeded"
        return ConsentOutcome(
            verified=bool(verified), reference=reference,
            detail={"session_status": getattr(session, "status", None), "setup_intent_status": si_status},
        )


class KwsConsentProvider:
    """Kids Web Services (Epic) — the COPPA-grade VPC engine. Wired in #100 once
    the admin/email loops are set up; ships inert so the interface is stable now."""

    name = "kws"

    def is_configured(self) -> bool:
        return bool(os.getenv("KWS_API_KEY"))

    def start(self, *, child_uid: str, parent_email: str, return_base: str) -> dict[str, Any]:
        raise HTTPException(status_code=503, detail="KWS consent is not configured yet.")

    def verify(self, *, reference: str) -> ConsentOutcome:
        raise HTTPException(status_code=503, detail="KWS consent is not configured yet.")


_PROVIDERS: dict[str, ConsentProvider] = {"stripe": StripeConsentProvider(), "kws": KwsConsentProvider()}


def get_provider() -> ConsentProvider:
    return _PROVIDERS.get(os.getenv("OHMLET_CONSENT_PROVIDER", "stripe").strip().lower(), _PROVIDERS["stripe"])


def _return_base(request: Request) -> str:
    """Where Stripe sends the parent's browser back to. Prefer the Origin the request
    came from (so localhost / preview / prod each return to themselves), else the
    configured app URL. Only http(s) origins are accepted."""
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin.startswith("https://") or origin.startswith("http://"):
        return origin
    return os.getenv("OHMLET_APP_URL", "https://ohmlet.org").rstrip("/")


# ── Endpoints ────────────────────────────────────────────────────────────────────

def _require_child_mode() -> None:
    if not child_mode_enabled():
        raise HTTPException(status_code=400, detail="Child mode is not enabled.")


@router.post("/age")
def submit_age(request_body: dict, claims: dict = Depends(require_claims)) -> dict[str, Any]:
    """Record the learner's age determination and stamp the age/consent claims.

    Called right after the neutral age screen, for EVERY learner (an adult gets
    isMinor=false and passes the gate; a minor is held for consent). The server
    computes the assessment itself — the birth year is the only input trusted."""
    _require_child_mode()
    uid = claims["uid"]
    birth_year = request_body.get("birthYear")
    country = request_body.get("country", "")
    try:
        birth_year = int(birth_year)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="birthYear must be a number")

    # Preserve an already-verified consent so re-submitting the age screen cannot
    # silently downgrade a consented minor back to pending.
    already_verified = bool(read_record(uid).get("consentVerified"))
    a = assess_age(birth_year, country, consent_verified=already_verified)
    _write_age(uid, a)
    set_consent_claims(uid, is_minor=a.is_minor, consent_verified=already_verified and a.is_minor, age_status=a.age_status)
    _append_event(uid, "age_assessed", {"isMinor": a.is_minor, "coppa": a.coppa, "consentAge": a.consent_age})
    obs.audit("consent.age_assessed", uid=uid, isMinor=a.is_minor, coppa=a.coppa, country=a.country)
    return {"isMinor": a.is_minor, "coppa": a.coppa, "consentAge": a.consent_age, "ageStatus": a.age_status}


@router.post("/start")
def start_consent(request_body: dict, request: Request, claims: dict = Depends(require_claims)) -> dict[str, Any]:
    """A parent, on the child's device, begins verifiable consent. Returns a
    provider handle (a redirect URL to the hosted card check) for the browser."""
    _require_child_mode()
    uid = claims["uid"]
    record = read_record(uid)
    if not record.get("isMinor"):
        raise HTTPException(status_code=409, detail="This account does not require parental consent.")
    if record.get("consentVerified"):
        return {"status": "verified"}

    parent_email = (request_body.get("parentEmail") or "").strip()
    provider = get_provider()
    if not provider.is_configured():
        raise HTTPException(status_code=503, detail="Parental consent is not configured yet.")

    handle = provider.start(child_uid=uid, parent_email=parent_email, return_base=_return_base(request))
    _doc_ref(uid).set(
        {
            "consentStatus": "pending",
            "consentMethod": provider.name,
            "consentProvider": provider.name,
            "consentReference": handle.get("reference"),
            "parentEmail": parent_email or None,   # the contracting adult, kept to honour parental rights
            "updatedAt": _now(),
        },
        merge=True,
    )
    _append_event(uid, "consent_started", {"provider": provider.name, "reference": handle.get("reference")})
    obs.audit("consent.started", uid=uid, provider=provider.name)
    # The browser only needs the hosted-page URL to redirect the parent to.
    return {"provider": provider.name, "url": handle.get("url"), "reference": handle.get("reference")}


@router.post("/confirm")
def confirm_consent(request_body: dict, claims: dict = Depends(require_claims)) -> dict[str, Any]:
    """Finalise consent after the parent completed the provider flow. The server
    re-verifies with the provider (never trusting the client's word) and only then
    flips the consent claim so the live tutor unlocks."""
    _require_child_mode()
    uid = claims["uid"]
    record = read_record(uid)
    if not record.get("isMinor"):
        raise HTTPException(status_code=409, detail="This account does not require parental consent.")
    reference = (request_body.get("reference") or record.get("consentReference") or "").strip()
    if not reference:
        raise HTTPException(status_code=422, detail="No consent reference to confirm.")

    provider = get_provider()
    outcome = provider.verify(reference=reference)
    if not outcome.verified:
        _append_event(uid, "consent_pending", {"reference": reference, **outcome.detail})
        raise HTTPException(status_code=409, detail="Consent is not complete yet.")

    _doc_ref(uid).set(
        {"consentStatus": "verified", "consentVerified": True, "ageStatus": "minor_consented", "verifiedAt": _now()},
        merge=True,
    )
    set_consent_claims(uid, is_minor=True, consent_verified=True, age_status="minor_consented")
    _append_event(uid, "consent_verified", {"provider": provider.name, "reference": reference})
    obs.audit("consent.verified", uid=uid, provider=provider.name)
    return {"status": "verified"}


@router.get("/status")
def consent_status(claims: dict = Depends(require_claims)) -> dict[str, Any]:
    """The caller's own age/consent status, for the client to route on."""
    uid = claims["uid"]
    record = read_record(uid)
    return {
        "childModeEnabled": child_mode_enabled(),
        "isMinor": bool(record.get("isMinor")) or bool(claims.get("isMinor")),
        "ageStatus": record.get("ageStatus") or claims.get("ageStatus"),
        "consentVerified": bool(record.get("consentVerified")) or bool(claims.get("consentVerified")),
        "consentProvider": record.get("consentProvider"),
    }
