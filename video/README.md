# video

Two unrelated things share this Remotion project, and they stay unrelated.

| Composition | What it is |
|---|---|
| `OhmletJourney` | The pitch / build-journey film. Uses the LANDING page palette in `src/theme.ts`. |
| `Lesson-*-Phone`, `Lesson-*-Web` | Lesson films for the app. Own palette in `src/lesson-film/palette.ts`. |

They share exactly one module, `src/font.ts`, and nothing else. The lesson films
deliberately do not use `theme.ts`: it still carries the pre-rebrand neon yellow
from the marketing site, and a learner meets these films inside the app, right
after a lesson, so they have to match what is on screen either side of them.

## Lesson films

```
npm run tts            # narration, one WAV per segment, into public/audio/
npm run captions       # .vtt sidecars into out/
npm run render:lessons # all six MP4s into out/
```

**The order matters.** The picture is laid out from the MEASURED length of each
narration file, not from designed durations, so `tts` has to run before anything
can be rendered or even listed. Change a line of script and you must re-run
`tts` (it only synthesises files that are missing, so delete the segment you
changed) and re-copy the timings into `src/lesson-film/timings/`.

That is the one non-obvious thing about this project, and it is deliberate: it
means narration and picture cannot drift apart over three minutes, and rewriting
a sentence reflows the film instead of breaking every cue after it.

## Shapes

1080x1920 for the phone, 1920x1080 for the web. No 720p rung: a preview ladder
is a render cost paid on every version for a quality nobody chooses.

## Where the output goes

`gs://ohmlet-app-lessons` (`ohmlet-app`, europe-west1). Private, with public
access prevention enforced. A CDN and signed URLs are the next piece of work;
a bucket that starts public is hard to make private afterwards.

Placement in the learning loop is argued in
`metadata/decisions/2026-08-28_lesson-video-placement.md`.
