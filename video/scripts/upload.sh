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
  # PUBLISH UNDER THE SKILL ID, NOT THE FILE NAME.
  #
  # films.py signs v1/<skill id>/..., and two of the earliest films are named
  # after the film rather than the skill: closed-loop is circuits-current, and
  # time-constant is capacitors-basics. Publishing those by file name puts them
  # at an address nothing ever looks at, and the film silently 404s while every
  # other one works. It happened once and was fixed by hand in the bucket.
  #
  # Read from the script itself so the two can never disagree again.
  skill=$(node -e "import('./scripts/lessons.mjs').then(async(m)=>{const l=(await m.allLessons()).find(x=>x.id===process.argv[1]);if(!l){process.exit(3)}process.stdout.write(l.skillId)})" "$id") || {
    echo "  !! $id has no script, or it exports no skillId" >&2; exit 1; }
  if [ "$skill" != "$id" ]; then
    echo "  ${id}  ->  ${skill}"
  else
    echo "  ${skill}"
  fi
  for f in out/ohmlet-lesson-${id}-*.mp4; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # A poster pulled from the film itself, at a point past the title card so it
    # shows the diagram rather than a word.
    poster="out/${base%.mp4}.jpg"
    ffmpeg -y -v error -ss 40 -i "$f" -frames:v 1 -q:v 3 "$poster"
    gcloud storage cp "$f" "$BUCKET/$V/$skill/$base" --project=$PROJECT \
      --content-type=video/mp4 --cache-control="public, max-age=31536000, immutable" -q
    gcloud storage cp "$poster" "$BUCKET/$V/$skill/$(basename "$poster")" --project=$PROJECT \
      --content-type=image/jpeg --cache-control="public, max-age=31536000, immutable" -q
  done
  gcloud storage cp "out/${id}.vtt" "$BUCKET/$V/$skill/${skill}.vtt" --project=$PROJECT \
    --content-type=text/vtt --cache-control="public, max-age=31536000, immutable" -q
done

echo
echo "  --- published ---"
gcloud storage ls -r "$BUCKET/$V/**" --project=$PROJECT
