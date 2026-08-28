#!/bin/sh
# Publish the lesson films to GCS.
#
# Laid out under a version prefix from the start. Content is immutable once
# published and the app will cache it hard, so a re-cut has to arrive at a NEW
# address rather than replacing bytes behind a URL somebody is already caching.
# The curriculum already learned this lesson the expensive way.
#
# Ids come from the lessons directory. Pass ids as arguments to publish a subset.
set -e
cd "$(dirname "$0")/.." || exit 1
BUCKET=gs://ohmlet-app-lessons
PROJECT=ohmlet-app
V=v1

if [ $# -gt 0 ]; then
  IDS="$*"
else
  IDS=$(ls src/lesson-film/lessons/*.ts | xargs -n1 basename | sed 's/\.ts$//')
fi

for id in $IDS; do
  echo "  ${id}"
  for f in out/ohmlet-lesson-${id}-*.mp4; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # A poster pulled from the film itself, at a point past the title card so it
    # shows the diagram rather than a word.
    poster="out/${base%.mp4}.jpg"
    ffmpeg -y -v error -ss 40 -i "$f" -frames:v 1 -q:v 3 "$poster"
    gcloud storage cp "$f" "$BUCKET/$V/$id/$base" --project=$PROJECT \
      --content-type=video/mp4 --cache-control="public, max-age=31536000, immutable" -q
    gcloud storage cp "$poster" "$BUCKET/$V/$id/$(basename "$poster")" --project=$PROJECT \
      --content-type=image/jpeg --cache-control="public, max-age=31536000, immutable" -q
  done
  gcloud storage cp "out/${id}.vtt" "$BUCKET/$V/$id/${id}.vtt" --project=$PROJECT \
    --content-type=text/vtt --cache-control="public, max-age=31536000, immutable" -q
done

echo
echo "  --- published ---"
gcloud storage ls -r "$BUCKET/$V/**" --project=$PROJECT
