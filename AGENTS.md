# AGENTS.md — Ohmlet

## What Ohmlet Is

Ohmlet is a **commercial, real-time multimodal lab tutor for learning electronics, mechatronics, and robotics by building.** It uses the Gemini Live API (bidirectional audio/video streaming) to watch a learner's physical workspace — breadboard, Arduino, components — and guide them through builds with voice + vision, correcting mistakes mid-action.

Think **Duolingo / Brilliant / Mimo, but for hands-on electronics.** A friendly mascot (the Ohmlet — an ohm-resistor egg), a gamified learning loop, a real social layer, and a live AI bench tutor that sees and talks. It is a product people pay for and recommend by word of mouth, not a demo.

Ohmlet is **NOT** a chatbot with a text box. It is a live, voice-driven, camera-on workspace. The learner talks to it, it sees their bench, it corrects them in real time.

- **Domain:** `ohmlet.org`
- **GCP project:** `ohmlet-app`
- **Repo:** private; `main` is the production line.

### Core learning loop

1. Learner picks a build from the library (e.g. "Light-Activated Alarm")
2. Agent verifies components via camera (inventory check)
3. Agent guides wiring step-by-step, correcting mistakes in real time
4. Agent generates/debugs Arduino code
5. Learner runs the circuit; agent validates via serial output + camera
6. Session ends → agent produces a 3D twin of the completed build
7. XP earned, streak updated, build shared to community if opted in

---

## Engineering Standards & Working Philosophy — READ FIRST

This is a **commercial product being built to last and to scale.** The bar is production-grade, professional, current-year (2026) best practice. Hold it on every change.

**Non-negotiable principles:**

1. **Never cut a feature for expediency.** Do not propose dropping, stubbing, or faking a feature because it's "hard," "takes time," or "the user probably won't need it." If it belongs in the product, we build it properly. The correct response to difficulty is a plan, not a downgrade.
2. **Never argue a user doesn't need something.** Do not rationalize skipping work with "users won't notice" or "this is good enough." Assume real, paying, demanding users. Build for them.
3. **Always choose the most professional, industrial, scalable option.** When there's a quick hack and a proper solution, default to the proper one. Modern, maintainable, well-architected, secure, observable. If a shortcut is genuinely warranted, say so explicitly and explain the tradeoff — never sneak it in.
4. **No placeholders in shipped surfaces.** No "coming soon," no lorem ipsum, no fake-but-pretty data presented as real. If something isn't built, it isn't in the UI yet.
5. **Persevere.** Debugging is the job. Don't abandon an approach at the first error or suggest the feature be removed because a library is awkward. Find the real fix.
6. **Modern stack discipline.** Use current, supported versions and patterns. No deprecated APIs, no copy-paste cruft, no dead code left behind. Type everything. Handle errors and loading/empty states as first-class.
7. **Production concerns are part of "done":** accessibility, responsive layout, error handling, loading states, auth/permissions where relevant, performance, and security are not optional polish — they are the definition of complete.

If you ever feel the pull to say "we don't really need this" — stop. That instinct is wrong here. Re-scope honestly or build it right.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite + Tailwind CSS (in `frontend/`) |
| 3D / canvas | Three.js (`@react-three/fiber` + `drei`), Monaco editor |
| Backend | FastAPI (Python 3.13) on Cloud Run — modular microservices in `backend/` |
| Agent framework | Google ADK (Agent Development Kit) with bidi-streaming |
| AI models | Multi-model: Flash for real-time voice, Pro for code gen/reasoning (see below) |
| State | Firestore (session state, user profiles, build progress) |
| Storage | Google Cloud Storage (session clips, serial logs, 3D assets) |
| Hosting | Firebase Hosting (frontend), Cloud Run (services) |
| Project ID | `ohmlet-app` |

On Cloud Run with Vertex AI, no API key is needed — authentication uses the service account automatically.

---

## Repo Structure

The repo is **cleanly split into `frontend/` and `backend/`** at the root. The root stays minimal.

```
ohmlet/
├── CLAUDE.md                      ← committed agent guide (this file)
├── AGENTS.md                      ← local Claude Code twin (gitignored); keep in sync
├── README.md
├── LICENSE
├── deploy.sh                      ← Cloud Run + frontend deploy orchestration
├── frontend/                      ← the entire web app
│   ├── package.json, vite.config.ts, tsconfig*.json, tailwind/postcss configs
│   ├── firebase.json, .firebaserc ← Firebase Hosting config
│   ├── .env / .env.local          ← local env (gitignored)
│   ├── index.html, index.tsx, App.tsx, styles.css
│   ├── public/
│   ├── hooks/                     ← useLiveBridge, useOhmletIdentity, useOhmletUserState
│   ├── services/                  ← firestoreOhmletState, quizEngineClient
│   └── components/
│       ├── Home.tsx, Header.tsx, Footer.tsx, Logo.tsx   ← landing (yellow, marketing)
│       ├── MissionPage.tsx, TechnologyPage.tsx
│       ├── OhmletLab.tsx          ← the app workspace (mid-refactor → thin shell)
│       ├── Sandbox.tsx, SandboxScene.tsx, CircuitDiagram.tsx, ArduinoScene.tsx
│       └── ohmlet/                ← OhmletLab module tree
│           ├── types.ts
│           ├── data/             ← achievements, lessons, library, tour, leaderboard, defaults
│           ├── hooks/            ← (in progress) useXp, useLiveSession, useLessons, …
│           └── tabs/             ← (planned) BuildTab, LearnTab, CommunityTab, LibraryTab, SandboxTab
└── backend/                       ← modular microservices, each its own Cloud Run service
    ├── live-bridge/               ← real-time bidi streaming (WebSocket ↔ Gemini Live via ADK)
    │   └── app/ohmlet_live_agent/ ← ADK agent with multi-model tool dispatch
    ├── quiz-engine/               ← adaptive quiz + drawing assessment
    └── vision-verifier/           ← camera component inventory check (Gemini 3.5 Flash vision)
```

All services share an observability spine: `app/obs.py` (structured JSON logs +
Cloud Trace correlation, `/internal/metrics`, security audit trail, clean 500s)
and `app/cors.py` (scoped CORS), duplicated per service like `resilience.py`.
See `ops/observability.md` and `ops/alerting.sh`.

Future backend services (each independent): `reporter/` (3D twin generation).

---

## Design System — The Rules

### Brand identity

- **Mascot:** the **Ohmlet** — a friendly egg-shaped resistor character (ohm + omelette) with a lightning bolt. It carries the brand emotionally, the way Duolingo's owl or Brilliant's Koji does. Always show the mascot in an electronics context (bolt, breadboard, probe) so it never reads as "food."
- **Landing page:** Electric/neon yellow `#f3e515` background, black text, bold uppercase headings. The marketing face.
- **App workspace** (`/ohmlet-app`): White/light slate background. Yellow is used ONLY for accent buttons, active states, and progress indicators. The workspace must feel calm, focused, professional.
- **Font:** one consistent font stack across landing and app. If upgrading, pick ONE distinctive display + body pair and use it everywhere.
- **Logo / wordmark:** "OHMLET" with the lightning bolt integrated into the Ø. Consistent everywhere.

### Anti-slop principles — READ THIS BEFORE WRITING ANY UI CODE

The UI must look like a real, premium product — never "mocked up" or "AI slop." Concretely:

**What makes UI feel fake:**
- Placeholder data that obviously isn't real (fake usernames, round numbers, generic descriptions)
- Flat rectangles with text pretending to be interactive elements
- A knowledge graph that is just colored dots and lines, not a real interactive visualization
- A community feed of static cards with no threading, avatars, timestamps, or interaction
- A leaderboard that is just a vertical list of rectangles
- Everything using the same `rounded-xl border border-slate-200` pattern — zero hierarchy variation
- No depth, texture, or spatial interest — just stacked boxes
- No micro-interactions, transitions, or responsive state changes
- Elements that claim interactivity but do nothing

**What "not fake" looks like (references):**
- **Brilliant.org:** clean but alive. Smooth transitions. Content-rich cards with real visual weight. Progress feels tangible. League/ranking UI has personality.
- **Duolingo:** gamification that feels earned. Celebratory streaks. Custom, playful icons — not generic lucide. Progress has ceremony.

**Rules for every UI element:**

1. **No empty states that look broken.** Purposeful empty states with illustration or CTA — never a dashed grey box.
2. **Interactive elements have visible feedback.** Hover, press, transitions — scale/shadow/elevation, not just color swap.
3. **Stop using one card pattern for everything.** A leaderboard entry, a community post, and a build step must have fundamentally different layout DNA.
4. **Visual hierarchy through size, weight, and space** — not just borders. Large type for important things. Generous whitespace. Depth for focus.
5. **Animations are purposeful.** Entrances, transitions, progress celebrations. Stagger reveals. Things arrive, not appear. If removing an animation doesn't hurt, remove it.
6. **Community feels like a real social space.** Avatars, relative timestamps, threaded replies, animated reaction counts, activity indicators.
7. **The knowledge graph is a real interactive graph.** Canvas/SVG, force-directed layout, animated edges, zoom/pan — not positioned divs.
8. **Gamification feels rewarding.** XP animates. Level-ups have ceremony. Streaks feel alive. League positions show movement.
9. **The camera/live feed is the hero of the Build tab.** It dominates the viewport, with controls overlaid — not one card among many.
10. **Typography does work.** Aggressive size contrast (24px+ headings, 13px body, 10px metadata). Weight contrast matters as much as size.

### Color tokens (use these, not arbitrary hex)

```css
--ohmlet-yellow: #f3e515;
--ohmlet-yellow-hover: #e8db11;
--ohmlet-yellow-soft: #fffde8;
--ohmlet-black: #0a0a0a;
--ohmlet-white: #ffffff;
--ohmlet-slate-50: #f8fafc;
--ohmlet-slate-100: #f1f5f9;
--ohmlet-slate-200: #e2e8f0;
--ohmlet-slate-500: #64748b;
--ohmlet-slate-700: #334155;
--ohmlet-slate-900: #0f172a;
```

### Anti-slop technical rules (enforce strictly)

1. **Shadow hierarchy, not uniform `shadow-md`.** Define 3–4 levels (`--shadow-card`, `--shadow-elevated`, `--shadow-overlay`). Never the same shadow on adjacent elements.
2. **Atmospheric backgrounds.** Subtle radial/mesh gradients or noise behind major sections, not flat fills.
3. **One signature animation per view.** A well-orchestrated staggered entrance beats twenty random wobbles.
4. **Card variation is structural, not cosmetic.** If you can swap one component for another and nobody notices, they're too similar.
5. **Color confidence.** Commit to the yellow `#f3e515` as a bold accent. Timid, evenly-distributed palettes read as AI output.
6. **Typography is the biggest lever.** Default-looking type (Inter/Roboto at 14px everywhere) reads as AI. Use aggressive size + weight contrast.
7. **Premium effects: subtlety wins.** Gentle shimmer = premium; overdone = gaudy. Mouse-following specular highlights (`--mx`, `--my`) read as interactive. Use only for reward moments.
8. **Glassmorphism sparingly.** `backdrop-filter: blur()` for overlays on camera feeds — not on every card.
9. **Never over-generate.** More containers ≠ better UI. Strip to the minimum elements needed. Flatten nested wrappers.
10. **Constraints prevent slop.** When tokens (colors, shadows, spacing, states) are explicit and enforced, AI helps; when implicit, slop spreads.

### Component quality bar

Before submitting any component, ask:
- Would this look at home on Brilliant.org or Linear?
- Is one visual pattern repeated >3 times without variation?
- Does every interactive element have hover + active + transition?
- Is there at least one purposeful motion element?
- Would a designer say "an AI made this"? If yes, redo it.
- Can I remove an element and still communicate? If yes, remove it.
- More than 2 nested containers for one piece of content? Flatten it.

---

## Multi-Model Architecture

The live agent is the single entry point for voice sessions but dispatches to different models via ADK tool functions based on task complexity. The learner hears one voice; multiple models work behind the scenes.

| Role | Model | When used |
|------|-------|-----------|
| Live tutor (voice + vision) | `gemini-live-2.5-flash-native-audio` | Always-on for real-time voice I/O |
| Quick checks (component ID, simple Q&A) | `gemini-2.5-flash` | Fast tasks during conversation |
| Code generation (Arduino sketches) | `gemini-2.5-pro` | Generating or debugging code |
| Deep reasoning (complex debugging) | `gemini-2.5-pro` | Learner stuck, needs detailed explanation |

---

## Workflow Rules

1. **Plan before building.** For any task touching 3+ files or making architectural decisions: write a plan in `tasks/todo.md` with checkable items, get confirmation, track progress.
2. **One thing at a time.** Atomic, testable changes. Build → verify → commit → move on. Don't refactor five files at once.
3. **Frontend validation.** After any frontend change run `cd frontend && npm run build` — it must pass with zero errors. Then describe the visual result and confirm no regressions.
4. **Backend validation.** Run `python3 -m py_compile` on modified files; run tests if present; confirm services start without import errors.
5. **Iteration logging.** After a meaningful unit of work, create `logs/YYYY-MM-DD-iter-NNN-short-description.md`: what changed, why, what was validated, what's next.
6. **Learn from corrections.** When corrected, update `tasks/lessons.md` with a rule that prevents recurrence.
7. **Never mark done without proof.** No "implemented" without a passing build; no "looks good" without describing the visual result; no claiming interactivity works without testing it.
8. **Commit discipline.** Never commit/push to `main` directly for non-trivial work — branch, build green, then merge. Write clear, scoped commit messages.

---

## What Matters (priority order)

1. **The frontend looks and feels like a premium product.** Every pixel matters. This gates everything else.
2. **The live session (Build tab) is the heart of Ohmlet** — camera + voice + real-time guidance. This is the product.
3. **Gamification and community feel alive,** not bolted on. These are the retention engine and the word-of-mouth differentiator.
4. **The knowledge graph / learning progression is genuinely interactive,** not decorative.
5. **Backend services are modular** — each feature its own folder under `backend/`, deployed as its own Cloud Run service. `live-bridge` is the core real-time service.
6. **The Arduino Starter Kit** is the flagship hardware; the demo build is an **LDR (light sensor) + LED/buzzer** project.

---

## Scope

### In scope
Landing page · Ohmlet workspace (Build, Learn, Community, Library, Sandbox tabs) · live voice + video via Gemini Live · component inventory verification via camera · step-by-step wiring guidance with error correction · Arduino code generation + self-correction · 3D digital twin of completed build · XP / streak / league gamification · community feed with builds + reactions · interactive knowledge graph · build library · simulation mode (for users without hardware) · Google Cloud deployment · accounts, billing, and the commercial spine.

### Out of scope (deliberately not building)
Notebook/Colab generation · chart/plot generation · slide-deck generation · any "create documents for me" workflow. The only post-session artifact is the **3D digital twin.**

---

## Environment Variables

```env
# frontend/.env.local
VITE_OHMLET_API_BASE_URL=http://localhost:8082
VITE_OHMLET_WS_URL=ws://localhost:8082
VITE_OHMLET_QUIZ_API_BASE_URL=http://localhost:8083
VITE_OHMLET_DEFAULT_USER_ID=faith
VITE_FIREBASE_API_KEY=...
VITE_OHMLET_GCP_PROJECT_ID=ohmlet-app

# backend / deploy
GOOGLE_CLOUD_PROJECT=ohmlet-app
GOOGLE_CLOUD_REGION=europe-west1
```

---

## Commands

```bash
# Frontend (run from frontend/)
cd frontend
npm install
npm run dev          # dev server on port 3000
npm run build        # production build — must pass before any merge

# Backend — live-bridge (port 8082)
cd backend/live-bridge
python3 -m venv .venv && source .venv/bin/activate   # Python 3.13, NOT 3.14
pip install -r requirements.txt
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload

# Syntax check
python3 -m py_compile backend/live-bridge/app/main.py

# Deploy (no API key needed — Vertex AI uses the service account)
./deploy.sh              # all services + frontend build
./deploy.sh live-bridge  # one service
```

---

## Things That Will Get You Corrected

- Suggesting we drop/skip/fake a feature because it's hard or "users won't need it"
- Choosing a quick hack over the professional, scalable solution without flagging it
- Making the UI look generic / templated / AI-generated
- Using the same card component for every piece of content
- Adding technical jargon to user-facing UI (session ID, API URL, microservice status)
- Building features that look interactive but don't work
- Stacking flat rectangles and calling it a layout
- Using only lucide-react icons with no custom visual elements
- Forgetting hover/active/transition states
- Writing "placeholder" or "coming soon" in visible UI
- Removing features the user asked for; adding ones they removed (notebooks, charts, slides)
- Not running the build after frontend changes; not logging meaningful work
- Reintroducing the "Relay" name (the brand is **Ohmlet**) — except the literal electronics *relay module* component, which is a real part and stays
