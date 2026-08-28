#!/bin/sh
# Render lesson films to out/.
#
# Ids come from the lessons directory rather than a list in here, because the
# list went stale once already. Pass ids as arguments to render just those;
# with none, it renders every film that has no MP4 yet. FORCE=1 re-renders.
cd "$(dirname "$0")/.." || exit 1
LOG=out/render.log
mkdir -p out
: > "$LOG"
log(){ echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

if [ $# -gt 0 ]; then
  IDS="$*"
else
  IDS=$(ls src/lesson-film/lessons/*.ts | xargs -n1 basename | sed 's/\.ts$//')
fi

for id in $IDS; do
  for shape in Phone:phone-1080x1920 Web:web-1920x1080; do
    comp="Lesson-${id}-${shape%%:*}"
    out="out/ohmlet-lesson-${id}-${shape##*:}.mp4"
    if [ -f "$out" ] && [ "$FORCE" != "1" ]; then
      log "SKIP  $out (already rendered)"
      continue
    fi
    log "START $comp"
    if npx remotion render src/index.ts "$comp" "$out" \
         --codec=h264 --log=error >> "$LOG" 2>&1; then
      log "DONE  $out  $(du -h "$out" | cut -f1)"
    else
      log "FAIL  $comp"
    fi
  done
done
log "ALL RENDERS FINISHED"
