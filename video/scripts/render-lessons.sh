#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
LOG=out/render.log
: > "$LOG"
log(){ echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }

for id in closed-loop time-constant driving-loads; do
  for shape in Phone:phone-1080x1920 Web:web-1920x1080; do
    comp="Lesson-${id}-${shape%%:*}"
    out="out/ohmlet-lesson-${id}-${shape##*:}.mp4"
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
