"""GDPR / privacy rights (#34) — data export and account deletion.

Built to the most stringent standard (GDPR Art. 15 access, Art. 20 portability,
Art. 17 erasure), which in practice also satisfies CCPA/CPRA (California), LGPD
(Brazil), PIPEDA (Canada) and Australia's APPs — they converge on the same core
rights. Both endpoints derive the UID from the verified token, never the client,
so a user can only export or delete THEIR OWN data.

Erasure covers: the plan, learning state, Stripe customer, live budget, usage
records, every community artefact (posts, comments, reactions, challenge
memberships, leaderboard rows, blocks both by and against the user), the consent
record, interview reports, 3D twins and their files in Cloud Storage, and
finally the Firebase Auth user, which revokes every session.

Two things are deliberately kept:

  - Payment and tax records (GDPR Art. 17(3)(b)). Deletion cancels the
    subscription and deletes the Stripe customer; Stripe retains the invoices it
    is legally required to keep. Compliant, not a gap.
  - Moderation reports the user filed, with the reporter identity stripped. They
    are the DSA notice-and-action audit trail, and deleting them outright would
    let someone erase their reporting history by deleting an account. This is the
    "or anonymise" half of what the privacy policy promises.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

import entitlements
import obs
from auth import _ensure_app, require_claims

logger = logging.getLogger("ohmlet.privacy")

router = APIRouter(prefix="/v1/me", tags=["privacy"])

STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")
USAGE_COLLECTION = os.getenv("OHMLET_USAGE_COLLECTION", "usage_sessions")

# Everything else that carries a uid. Erasure previously covered only the plan,
# state, Stripe customer, live budget and usage records, so a deleted account
# left its community posts, comments, reactions, challenge memberships,
# leaderboard rows, blocks, consent record, interview reports and 3D twins
# behind, each still tagged with the uid. The policy says we "delete or
# anonymise your personal data", and that was not being met.
#
# Each entry is (collection, uid-field). A None field means the uid is the
# document id itself.
_UID_FIELD_COLLECTIONS: tuple[tuple[str, str], ...] = (
    (os.getenv("OHMLET_POSTS_COLLECTION", "community_posts"), "uid"),
    (os.getenv("OHMLET_COMMENTS_COLLECTION", "community_comments"), "uid"),
    (os.getenv("OHMLET_REACTIONS_COLLECTION", "community_reactions"), "uid"),
    (os.getenv("OHMLET_CHALLENGE_MEMBERS_COLLECTION", "community_challenge_members"), "uid"),
    (os.getenv("OHMLET_LEADERBOARD_COLLECTION", "community_leaderboard"), "uid"),
    (os.getenv("OHMLET_BLOCKS_COLLECTION", "community_blocks"), "uid"),
    (os.getenv("OHMLET_INTERVIEWS_COLLECTION", "ohmlet_interviews"), "uid"),
    (os.getenv("OHMLET_TWINS_COLLECTION", "ohmlet_twins"), "uid"),
    (os.getenv("OHMLET_TWIN_SHARES_COLLECTION", "ohmlet_twin_shares"), "uid"),
    (os.getenv("OHMLET_EVENTS_COLLECTION", "ohmlet_events"), "uid"),
)

# Blocks the user is the TARGET of belong to the people who set them: those stay,
# but the pointer to a person who no longer exists is scrubbed.
_BLOCKS_COLLECTION = os.getenv("OHMLET_BLOCKS_COLLECTION", "community_blocks")

# Consent records are keyed by the child's uid.
_CONSENT_COLLECTION = os.getenv("OHMLET_CONSENT_COLLECTION", "ohmlet_consent")

# Moderation reports are NOT deleted. They are the notice-and-action audit trail
# the DSA requires us to keep, and deleting them would let someone erase their
# own reporting history by deleting an account. The identity is removed instead,
# which is the "or anonymise" half of what the policy promises.
_REPORTS_COLLECTION = os.getenv("OHMLET_REPORTS_COLLECTION", "community_reports")

TWINS_BUCKET = os.getenv("OHMLET_TWINS_BUCKET", "ohmlet-app-twins")

if not stripe.api_key:
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


def _client():
    from state_store import get_client  # lazy: avoid circular import at module load

    return get_client()


def _profile(uid: str) -> dict:
    """Identity fields from Firebase Auth (best-effort)."""
    try:
        _ensure_app()
        from firebase_admin import auth as fb_auth

        u = fb_auth.get_user(uid)
        meta = u.user_metadata
        return {
            "email": u.email,
            "displayName": u.display_name,
            "emailVerified": u.email_verified,
            "createdAt": getattr(meta, "creation_timestamp", None),
            "lastSignInAt": getattr(meta, "last_sign_in_timestamp", None),
            "providers": [p.provider_id for p in (u.provider_data or [])],
        }
    except Exception as exc:
        logger.warning("profile fetch failed for %s: %s", uid, exc)
        return {}


def _budget_docs(client, uid: str):
    """All monthly live-usage docs for the user (ids are '<uid>_<YYYY-MM>')."""
    prefix = f"{uid}_"
    return [d for d in client.collection(entitlements.BUDGET_COLLECTION).list_documents() if d.id.startswith(prefix)]


# ── Export: everything we hold about the user (Art. 15 + 20) ──
def _purge_by_field(client, collection: str, field: str, uid: str) -> int:
    """Delete every document in `collection` where `field == uid`. Returns the count."""
    from google.cloud.firestore_v1.base_query import FieldFilter

    removed = 0
    try:
        for snap in client.collection(collection).where(filter=FieldFilter(field, "==", uid)).stream():
            snap.reference.delete()
            removed += 1
    except Exception as exc:
        # One collection failing must not abandon the rest of the erasure; the
        # miss is logged loudly because it leaves personal data behind.
        logger.error("erasure failed for %s.%s=%s: %s", collection, field, uid, exc)
    return removed


def _anonymise_reports(client, uid: str) -> int:
    """Strip the reporter identity from moderation reports, keeping the record.

    The report itself is a legal audit trail (DSA notice-and-action) and is
    exempt from erasure under Art. 17(3). What is not needed is who filed it, so
    the uid is replaced. The document id still contains the uid, so the row is
    rewritten under a fresh id and the original removed.
    """
    changed = 0
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter

        col = client.collection(_REPORTS_COLLECTION)
        for snap in col.where(filter=FieldFilter("reporterUid", "==", uid)).stream():
            data = snap.to_dict() or {}
            data["reporterUid"] = "deleted-account"
            data["reporterErasedAt"] = _iso_now()
            col.document().set(data)
            snap.reference.delete()
            changed += 1
    except Exception as exc:
        logger.error("report anonymisation failed for %s: %s", uid, exc)
    return changed


def _purge_blocks_targeting(client, uid: str) -> int:
    """Remove block rows that POINT AT this user.

    The block itself belongs to the person who set it, so it is not their data
    to lose; but it names someone who no longer exists, so the row goes.
    """
    return _purge_by_field(client, _BLOCKS_COLLECTION, "targetUid", uid)


def _purge_twin_objects(uid: str) -> int:
    """Delete the user's 3D twin files from Cloud Storage.

    Twin GLBs are stored under `twins/<uid>/`, so erasure is a prefix delete.
    Firestore rows alone are not enough: the models themselves are personal data
    (they are a capture of the learner's own bench).
    """
    removed = 0
    try:
        from google.cloud import storage

        bucket = storage.Client().bucket(TWINS_BUCKET)
        for blob in bucket.list_blobs(prefix=f"twins/{uid}/"):
            blob.delete()
            removed += 1
    except Exception as exc:
        # The bucket may not exist yet in an environment where the reporter has
        # never been deployed. That is not a reason to fail the deletion, but it
        # is a reason to be loud about it.
        logger.error("twin object purge failed for %s: %s", uid, exc)
    return removed


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/export")
def export_data(claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    out: dict = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "userId": uid,
        "profile": _profile(uid),
        "plan": {},
        "progress": {},
        "liveUsage": [],
        "usageSessions": [],
        "billing": {},
        "notice": (
            "This is all personal data Ohmlet holds about you, including your "
            "community posts and comments, challenge memberships, league "
            "standings, interview reports and 3D twins. Payment and tax records "
            "held by our payment processor (Stripe) are retained as required by "
            "law and are not included here. Moderation reports you filed are "
            "also excluded: they are a legal audit trail, and your identity is "
            "removed from them if you delete your account."
        ),
    }

    plan_snap = client.collection(entitlements.PLANS_COLLECTION).document(uid).get()
    if plan_snap.exists:
        plan = plan_snap.to_dict() or {}
        out["plan"] = {k: v for k, v in plan.items() if k != "stripeCustomerId"}
        if plan.get("stripeCustomerId"):
            out["billing"] = {"stripeCustomerId": plan["stripeCustomerId"]}

    state_snap = client.collection(STATE_COLLECTION).document(uid).get()
    if state_snap.exists:
        out["progress"] = state_snap.to_dict()

    for d in _budget_docs(client, uid):
        snap = d.get()
        if snap.exists:
            out["liveUsage"].append({"period": d.id, **(snap.to_dict() or {})})

    try:
        for doc in client.collection(USAGE_COLLECTION).where("user_id", "==", uid).stream():
            out["usageSessions"].append(doc.to_dict())
    except Exception as exc:
        logger.warning("usage export failed for %s: %s", uid, exc)

    # The export must cover the same ground the erasure does, or the two rights
    # disagree: a user could delete data they were never shown. Everything the
    # deletion reaches by uid is exported here under its collection name.
    from google.cloud.firestore_v1.base_query import FieldFilter

    for collection, field in _UID_FIELD_COLLECTIONS:
        rows: list[dict] = []
        try:
            for snap in client.collection(collection).where(filter=FieldFilter(field, "==", uid)).stream():
                rows.append({"id": snap.id, **(snap.to_dict() or {})})
        except Exception as exc:
            logger.warning("export failed for %s: %s", collection, exc)
        out[collection] = rows

    try:
        consent_snap = client.collection(_CONSENT_COLLECTION).document(uid).get()
        out[_CONSENT_COLLECTION] = consent_snap.to_dict() if consent_snap.exists else {}
    except Exception as exc:
        logger.warning("consent export failed for %s: %s", uid, exc)
        out[_CONSENT_COLLECTION] = {}

    obs.audit("privacy.data_exported", uid=uid)
    return out


# ── Delete: erase everything (Art. 17, right to be forgotten) ──
@router.post("/delete")
async def delete_account(request: Request, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not (isinstance(body, dict) and body.get("confirm")):
        raise HTTPException(400, "Account deletion must be explicitly confirmed.")

    client = _client()
    customer = entitlements.get_customer(uid)

    # 1) Stop billing: cancel subscriptions, then delete the Stripe customer.
    #    (Stripe still keeps the invoices/charges it must retain for tax law.)
    if customer and stripe.api_key:
        try:
            for sub in stripe.Subscription.list(customer=customer, status="all").auto_paging_iter():
                if sub.get("status") in ("active", "trialing", "past_due", "unpaid"):
                    stripe.Subscription.cancel(sub.id)
            stripe.Customer.delete(customer)
        except Exception as exc:
            logger.warning("stripe cleanup failed for %s (continuing erasure): %s", uid, exc)

    # 2) Erase our personal data across every collection.
    deleted = []
    for coll, doc_id in (
        (entitlements.PLANS_COLLECTION, uid),
        (STATE_COLLECTION, uid),
        (entitlements.CUSTOMERS_COLLECTION, customer),
    ):
        if doc_id:
            try:
                client.collection(coll).document(doc_id).delete()
                deleted.append(coll)
            except Exception as exc:
                logger.warning("delete %s/%s failed: %s", coll, doc_id, exc)

    for d in _budget_docs(client, uid):
        try:
            d.delete()
        except Exception as exc:
            logger.warning("budget delete %s failed: %s", d.id, exc)

    try:
        for doc in client.collection(USAGE_COLLECTION).where("user_id", "==", uid).stream():
            doc.reference.delete()
    except Exception as exc:
        logger.warning("usage delete failed for %s: %s", uid, exc)

    # Everything the original erasure missed: the community footprint, the
    # consent record, interview reports, and the 3D twins with their files.
    purged: dict[str, int] = {}
    for collection, field in _UID_FIELD_COLLECTIONS:
        count = _purge_by_field(client, collection, field, uid)
        if count:
            purged[collection] = count

    blocks_targeting = _purge_blocks_targeting(client, uid)
    if blocks_targeting:
        purged[f"{_BLOCKS_COLLECTION}:targeting"] = blocks_targeting

    try:
        client.collection(_CONSENT_COLLECTION).document(uid).delete()
        deleted.append(_CONSENT_COLLECTION)
    except Exception as exc:
        logger.error("consent record delete failed for %s: %s", uid, exc)

    twin_objects = _purge_twin_objects(uid)
    if twin_objects:
        purged["twin_objects"] = twin_objects

    # Retained, with the identity stripped: see _anonymise_reports.
    anonymised_reports = _anonymise_reports(client, uid)

    # 3) Remove the identity itself (revokes all sessions).
    try:
        _ensure_app()
        from firebase_admin import auth as fb_auth

        fb_auth.delete_user(uid)
        deleted.append("auth")
    except Exception as exc:
        logger.error("auth user delete failed for %s: %s", uid, exc)
        raise HTTPException(502, "Could not fully delete the account; please contact support.") from exc

    obs.audit(
        "privacy.account_deleted",
        uid=uid,
        collections=deleted,
        purged=purged,
        anonymisedReports=anonymised_reports,
        hadStripeCustomer=bool(customer),
    )
    logger.info(
        "account erased: uid=%s collections=%s purged=%s anonymisedReports=%d",
        uid, deleted, purged, anonymised_reports,
    )
    return {"status": "deleted", "deletedAt": _iso_now()}
