# Serving the lesson films

Forty three films live in `gs://ohmlet-app-lessons`, addressed by **skill id**:

```
gs://ohmlet-app-lessons/v1/<skill-id>/
  ohmlet-lesson-<skill-id>-phone-1080x1920.mp4    the phone cut
  ohmlet-lesson-<skill-id>-web-1920x1080.mp4      the web cut
  ohmlet-lesson-<skill-id>-<shape>.jpg            poster frames
  <skill-id>.vtt                                  captions
```

The bucket has **public access prevention enforced**, on purpose. That is why
nothing could play them until now: there was no URL to hand a client.

## Signed URLs, not a proxy

`backend/live-bridge/app/films.py` mints a V4 signed URL per request, valid for
30 minutes.

Proxying the bytes through Cloud Run would have worked and would be much worse. A
three minute film is 13 to 17MB. Streaming that through a FastAPI worker charges
vCPU-seconds and memory-seconds for the entire playback, pins a container
instance open per concurrent viewer, and puts video traffic in contention with
the live tutor's WebSockets on the same instances. Signing hands the bytes to GCS
and lets a CDN be dropped in front later without touching this code.

Nothing caches the signed URL. A cached one outlives the reason it was
short-lived.

## The IAM that makes signing work, and the failure if it is missing

Cloud Run's runtime service account has **no downloadable private key**, and must
not. So `generate_signed_url` cannot sign locally; it calls the IAM SignBlob API
using the instance's own access token, which requires the service account to be
able to impersonate **itself**.

Granted 2026-08-28:

```bash
SA=ohmlet-live-bridge@ohmlet-app.iam.gserviceaccount.com

# Sign as itself. Without this every film request 403s at REQUEST time, not at
# deploy time, so a deploy looks clean and playback is broken.
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountTokenCreator" --project=ohmlet-app

# Read the films. objectViewer, not admin: this service only ever reads.
gcloud storage buckets add-iam-policy-binding gs://ohmlet-app-lessons \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectViewer" --project=ohmlet-app
```

To check both are still in place:

```bash
gcloud iam service-accounts get-iam-policy "$SA" --project=ohmlet-app \
  | grep -q serviceAccountTokenCreator && echo "can sign"
```

## Gating

Films are **free on every plan** by decision (Faith, 2026-08-28). What is gated
is early access to the unfinished PLAYER, through Ohmlet Labs:

```
OHMLET_LAB_LESSON_FILMS=max   Max only, the current setting
OHMLET_LAB_LESSON_FILMS=all   everyone, once the player holds up
OHMLET_LAB_LESSON_FILMS=off   nobody, if it misbehaves
```

Changing the stage is an environment variable, not a deploy. That is the point:
a Labs feature that starts misbehaving can be pulled back in seconds.

## What is still missing

- **No CDN.** Every view is served from the `europe-west1` origin with nothing
  absorbing repeat demand, so the first film of unit one is fetched in full by
  every new learner and playback starts slowly far from Europe. Cloud CDN in
  front of the bucket with signed cookies is the next step.
- **No offline download.** A film needs a connection. This is stated on the Labs
  card rather than discovered.
- **One bitrate.** 1080p only, no adaptive ladder. Fine on wifi, not on a train.
