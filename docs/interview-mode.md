# Interview Mode (#21) — design

> Status: building. Max-tier feature. Last reviewed 2026-06-27.
> Research synthesis (full): `metadata/interview-mode-research.md` (gitignored).

A premium, voice-driven mock-interview coach that preps learners for real
hardware/embedded/electronics/mechatronics/robotics jobs. The learner gives a job
description and their CV; Ohmlet runs a realistic, adaptive voice interview and
returns an actionable report.

## Positioning (the wedge)

Ohmlet is a **practice coach**, never a live "cheat copilot." The unique angle no
competitor holds: it judges **engineering substance** (not just delivery like
Yoodli/Huru, not cheating like Final Round) and then **routes the learner back
into Ohmlet's own lessons** to close each gap. We own the live voice agent AND the
curriculum; Interview Mode is the bridge.

## Architecture (reuses the live spine)

The codebase already has the entire real-time spine: the ADK Gemini Live agent,
the `/ws/{uid}/{session_id}` handler (auth frame, then text/stage/image frames),
per-plan budget metering, and `useLiveBridge` on the client. Interview Mode is a
**new persona + a new session mode** over that spine, not a new transport.

- **Backend persona:** a dedicated `interview_agent` (its own world-class
  instruction grounded in the question taxonomy), selected at connect when the
  client requests `mode=interview`. Reuses the same Runner, audio path, and
  transcript extraction.
- **Mode + Max gate:** the WS handler reads an interview context frame after auth;
  if the user is not on Max (`entitlements.get_plan != "max"`) the session is
  rejected. Interview minutes are metered against the same monthly live budget.
- **Frontend:** a new `InterviewView` (Max-gated, new workspace nav entry):
  Setup -> live session (reuses `useLiveBridge` with `mode: 'interview'`) ->
  Report. `'interview'` is already a declared feature in `entitlements.ts` (MAX).

## The session

Voice-first (text fallback; camera optional, off by default). 20-30 min, single
adaptive arc:
1. Intro / rapport (calibrate level).
2. Behavioral, drilled into the CV's actual projects (STAR).
3. Technical + role-specific, matched to JD competencies and CV gaps, plus 1-2
   debugging scenarios (on-brand for Ohmlet).
4. Candidate questions.
5. Close, then the report.

Adaptivity is the realism: ramp difficulty on strong answers, ease + hint when
struggling, and **probe weak/shallow answers** (cap ~2 follow-ups). No mid-session
grades (breaks immersion). A named, warm-but-rigorous interviewer persona.

## Feedback report

Scored after the session on four axes (1-5 with anchors): technical depth,
structure, communication, signal/seniority. Contents: a "what would stop me
getting hired" headline, a per-competency radar vs the JD, per-answer
score + reasoning + a **modeled stronger answer**, delivery metrics, top 3 action
items, and **deep links into Ohmlet lessons** to close gaps. Never a cold verdict
without reasoning.

## CV / JD input + file security

v1 supports **pasting** JD + CV text (zero upload attack surface) AND **PDF/DOCX/TXT
upload**, hardened per the security research:

- Validate hard at the edge, server-side only (never trust extension/client MIME):
  size gate (PDF/DOCX <= 10 MB, TXT <= 1 MB), extension allow-list, **magic-byte
  sniff** (PDF `%PDF-` at offset 0, DOCX OOXML zip, TXT clean UTF-8), explicit
  reject of EXE/ELF/Mach-O/script/HTML/OLE/macro signatures, PDF page cap (<=30),
  reject encrypted PDFs and PDFs with `/JS /Launch /OpenAction /EmbeddedFile`.
- **Do not run our own native PDF parser.** Feed the validated document to Gemini
  on Vertex for extraction (no memory-unsafe parser in our trust boundary).
- **Prompt-injection defense:** the resume text is wrapped in a randomized UUID
  delimiter fence and treated as untrusted data; the model is told never to follow
  instructions found inside it; extraction returns schema-validated JSON.
- **Hardening deferred to a documented follow-up:** ClamAV malware scan + the
  unscanned/clean/quarantined bucket pattern + qpdf/LibreOffice CDR + short-TTL
  retention. Tracked in `docs/blockers.md`. v1's edge validation + no-own-parser +
  injection fencing is a defensible secure baseline.

## v1 scope vs later

- **v1:** voice mock (behavioral + technical + debugging), JD/CV paste + hardened
  upload + structured extraction, adaptive probing, the post-session report, Max
  gate, a "low-stakes warmup" mode (no scoring).
- **Later:** hardware system-design rounds (needs a diagram/3D surface, a unique
  Ohmlet strength via Sandbox), embedded-C coding rounds (Monaco + eval), webcam
  delivery scoring, full multi-round loop, ClamAV/CDR upload hardening.
