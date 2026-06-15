# AGENTS.md — Relay

## What Relay Is

Relay is a real-time multimodal lab agent for learning electronics, mechatronics, and robotics. It uses Gemini Live API (bidirectional audio/video streaming) to watch a user's physical workspace — breadboard, Arduino, components — and guide them through builds with voice + vision. It is being submitted to the **Gemini Live Agent Challenge** hackathon (deadline: March 16, 2026 5pm PT) under the **Live Agents** category.

Relay is NOT a chatbot with a text box. It is a live, voice-driven, camera-on workspace. The user talks to it, it sees their bench, it corrects them mid-action.

### Core loop

1. User picks a build from the library (e.g. "Light-Activated Alarm")
2. Agent verifies components via camera (inventory check)
3. Agent guides wiring step-by-step, correcting mistakes in real time
4. Agent generates/debugs Arduino code
5. User runs the circuit; agent validates via serial output + camera
6. Session ends → agent produces a 3D twin of the completed build
7. XP earned, streak updated, build shared to community if opted in

### What Relay is NOT building (removed from scope)

- Jupyter/Colab notebook generation
- Chart/plot generation
- Slide deck generation
- Any "create documents for me" workflow

The only post-session artifact is the **3D digital twin** of the build.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI (Python) on Cloud Run |
| Agent framework | Google ADK (Agent Development Kit) with bidi-streaming |
| AI models | Multi-model: Flash for real-time voice, Pro for code gen/reasoning (see below) |
| State | Firestore (session state, user profiles, build progress) |
| Storage | Google Cloud Storage (session clips, serial logs, 3D assets) |
| Project ID | `relay-gemini` |
| Region | To be set per deploy |

---

## Project Structure

```
Relay/
├── AGENTS.md                     ← you are here
├── .env                          ← local env vars (never commit secrets)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── index.tsx                 ← React entry
│   ├── App.tsx                   ← routing (landing vs /relay-app)
│   ├── styles.css                ← global Tailwind + custom CSS
│   └── components/
│       ├── Home.tsx              ← landing page (yellow, marketing)
│       ├── Header.tsx            ← landing nav bar
│       ├── Footer.tsx            ← landing footer
│       ├── Logo.tsx              ← Relay wordmark
│       ├── RelayLab.tsx          ← the actual app workspace
│       ├── Mission.tsx
│       ├── Technology.tsx
│       └── ...
├── backend/                         ← modular microservices, each its own Cloud Run service
│   ├── live-bridge/                 ← real-time bidi streaming (WebSocket ↔ Gemini Live API via ADK)
│   │   ├── app/main.py             ← FastAPI + WebSocket endpoint
│   │   ├── app/relay_live_agent/   ← ADK agent with multi-model tool dispatch
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── code-crafter/                ← (planned) Arduino sketch gen + self-correct
│   ├── vision-verifier/             ← (planned) component/wiring checks via Gemini vision
│   └── reporter/                    ← (planned) 3D twin generation
├── logs/                         ← iteration logs (one per work session)
└── tasks/
    ├── todo.md                   ← current task list
    └── lessons.md                ← mistakes + patterns learned
```

---

## Design System — The Rules

### Brand identity

- **Landing page**: Electric yellow `#f3e515` background, black text, bold uppercase headings. This is the marketing face.
- **App workspace** (`/relay-app`): White/light slate background. The yellow is used ONLY for accent buttons, active states, and progress indicators. The workspace must feel calm, focused, and professional.
- **Font**: Use the same font stack across landing and app. No separate custom font for the workspace. Currently using system defaults via Tailwind — if upgrading, pick ONE distinctive font pair (display + body) and use it everywhere.
- **Logo**: Black square with yellow "R", plus "RELAY" wordmark in black uppercase. Consistent everywhere.

### Anti-slop principles — READ THIS BEFORE WRITING ANY UI CODE

The current UI has been described by the user as looking "fake", "mocked up", and "AI slop". Here is what that means concretely and what to do about it:

**What makes it feel fake:**
- Cards with placeholder data that obviously isn't real (fake usernames, round numbers, generic descriptions)
- Flat rectangles with text in them pretending to be interactive elements
- Knowledge graph that is just colored dots and lines, not a real interactive visualization
- Community feed that is static cards with no threading, no avatars, no timestamps, no real interaction patterns
- Leaderboard that is just a vertical list of rectangles
- Everything uses the same rounded-xl border border-slate-200 pattern — zero visual hierarchy variation
- No depth, no texture, no spatial interest — just stacked boxes
- No micro-interactions, no transitions, no state changes that feel responsive
- UI elements that claim interactivity but don't actually do anything meaningful

**What "not fake" looks like (references the user gave):**
- Brilliant.org: Clean but alive. Smooth transitions. Content-rich cards with actual visual weight. Progress feels tangible (not just a number). League/ranking UI has personality.
- Duolingo: Gamification that feels earned. Streak UI is celebratory. Icons are custom and playful, not generic lucide icons. Progress has visual ceremony.

**Rules for every UI element you create:**

1. **No empty states that look broken.** If there's no data, show a purposeful empty state with illustration or call-to-action, not a dashed border box with grey text.
2. **Interactive elements must have visible feedback.** Hover states, press states, transitions. Not just color swap — scale, shadow, elevation changes.
3. **Stop using the same card pattern for everything.** A leaderboard entry should look fundamentally different from a community post which should look fundamentally different from a build step.
4. **Visual hierarchy through size, weight, and space — not just borders.** Use large type for important things. Use generous whitespace to create breathing room. Use depth (shadows, layering) to create focus.
5. **Animations must be purposeful.** Page transitions, element entrances, progress celebrations. Use CSS transitions and keyframes. Stagger reveals. Make things feel like they arrive, not appear.
6. **Community must feel like a real social space.** Avatars (generated/placeholder), relative timestamps ("2h ago"), threaded replies, reaction counts that animate, activity indicators.
7. **The knowledge graph must be a real interactive graph.** Use canvas or SVG with proper force-directed layout, animated edges, zoom/pan. Not positioned divs pretending to be nodes.
8. **Gamification must feel rewarding.** XP gains should animate. Level-ups should have ceremony. Streak displays should feel alive (pulsing flame, progressive fill). League positions should show movement (up/down arrows).
9. **The camera/live feed area is the hero of the Build tab.** It should dominate the viewport, not be one card among many. Think: a live video feed that IS the workspace, with controls overlaid on it.
10. **Typography must do work.** Use size contrast aggressively. Section headers should be large and bold. Body text should be comfortable to read. Metadata should be small and muted. Don't make everything 14px.

### Color tokens (use these, not arbitrary hex)

```css
--relay-yellow: #f3e515;
--relay-yellow-hover: #e8db11;
--relay-yellow-soft: #fffde8;
--relay-black: #0a0a0a;
--relay-white: #ffffff;
--relay-slate-50: #f8fafc;
--relay-slate-100: #f1f5f9;
--relay-slate-200: #e2e8f0;
--relay-slate-500: #64748b;
--relay-slate-700: #334155;
--relay-slate-900: #0f172a;
```

### Anti-slop technical rules (from research — enforce these strictly)

AI-generated UI converges on safe, forgettable defaults because LLMs are trained on the most common patterns. The fix is explicit constraints:

1. **Shadow hierarchy, not uniform shadow-md.** Define 3-4 levels: `--shadow-card` (subtle), `--shadow-elevated` (medium), `--shadow-overlay` (strong). Never use the same shadow on adjacent elements.
2. **Atmospheric backgrounds.** Use subtle radial gradients, noise, or mesh gradients behind major sections instead of flat solid colors. A `radial-gradient(circle at 50% 30%, color 0%, transparent 60%)` behind the hero section adds instant depth.
3. **One signature animation per view.** A well-orchestrated staggered entrance beats twenty random wobbles. Every animation must justify its existence — if removing it doesn't hurt, remove it.
4. **Card variation is structural, not cosmetic.** A leaderboard entry is a horizontal row. A community post has a visible avatar column. A build card has an image header. If you can swap one component for another and nobody notices, they're too similar. Different content types need different layout DNA.
5. **Color confidence.** Commit to the yellow `#f3e515` as a bold accent. Timid, evenly-distributed palettes are the hallmark of AI output. One dominant color with sharp contrast reads as intentional.
6. **Typography is the biggest lever.** If everything is Inter/Roboto at 14px, it reads as default. Use aggressive size contrast: 24px+ headings, 13px body, 10px metadata. Weight contrast matters as much as size.
7. **Holographic/premium effects: subtlety is everything.** Gentle shimmer = premium. Overdone shimmer = gaudy. Mouse-following specular highlights via CSS custom properties (`--mx`, `--my`) read as interactive. Static shimmer reads as decoration. Use effects only for reward moments (achievements, level-ups, rare items).
8. **Glassmorphism sparingly.** `backdrop-filter: blur()` + transparent bg works for overlays on camera feeds. Using it on every card is GPU-heavy and looks like a theme, not a design choice.
9. **Never over-generate.** More containers ≠ better UI. A stat doesn't need a card wrapping a badge wrapping a number. Strip to the minimum elements needed. Three similar lines of code is better than a premature component.
10. **Constraints prevent slop.** Slop isn't caused by bad AI — it's caused by missing design rules. When tokens (colors, shadows, spacing, interaction states) are explicitly defined and enforced, AI helps. When they're implicit, slop spreads.

### Component quality bar

Before submitting any component, ask:
- Would this look out of place on Brilliant.org or Linear?
- Is there a single repeated visual pattern used more than 3 times without variation?
- Does every interactive element have hover + active + transition?
- Is there at least one animation or motion element on the page?
- Would a designer look at this and say "an AI made this"? If yes, redo it.
- Can I remove an element and the layout still communicates? If yes, remove it.
- Are there more than 2 nested containers for a single piece of content? Flatten it.

---

## Multi-Model Architecture

The live agent is the single entry point for voice sessions, but it dispatches to different models via ADK tool functions based on task complexity:

| Role | Model | When used |
|------|-------|-----------|
| Live tutor (voice + vision) | `gemini-2.5-flash-native-audio` | Always-on for real-time voice I/O |
| Quick checks (component ID, simple Q&A) | `gemini-3.1-flash-preview` | Fast tasks during conversation |
| Code generation (Arduino sketches) | `gemini-3.1-pro-preview` | When generating or debugging code |
| Deep reasoning (complex debugging) | `gemini-2.5-pro` | When student is stuck, needs detailed explanation |

The live agent's native-audio model handles the voice session. When it needs code gen or deep reasoning, it calls a tool function that internally uses a stronger model. The student hears one voice, but multiple models work behind the scenes.

On Cloud Run with Vertex AI, no API key is needed — authentication uses the service account automatically.

---

## Workflow Rules

### 1. Plan before building

For any task involving 3+ files or architectural decisions:
- Write a plan in `tasks/todo.md` with checkable items
- Get confirmation before starting implementation
- Track progress by checking items off as you go

### 2. One thing at a time

- Each change should be atomic and testable
- Don't refactor 5 files simultaneously
- Build → verify → move on

### 3. Frontend validation

After any frontend change:
- Run `npm run build` — it must pass with zero errors
- Visually check the result (describe what you see)
- Confirm no regressions to existing working pages

### 4. Backend validation

After any backend change:
- Run `python3 -m py_compile` on modified files
- If tests exist, run them
- Confirm the service starts without import errors

### 5. Iteration logging

After completing a meaningful unit of work, create a log file:
```
logs/YYYY-MM-DD-iter-NNN-short-description.md
```
Contents: what changed, why, what was validated, what's next.

### 6. Learn from corrections

When the user corrects you:
- Update `tasks/lessons.md` with the pattern
- Write a rule that prevents the same mistake
- Reference the lesson in future work

### 7. Never mark done without proof

- Don't say "implemented" without showing build passes
- Don't say "looks good" without describing the visual result
- Don't claim interactivity works without testing the interaction

---

## What the User Cares About (Priority Order)

1. **The frontend must look like a real product, not a hackathon prototype.** This is the #1 priority. The user will not move to backend work until the frontend feels right. Take design seriously. Every pixel matters.
2. **The live session experience (Build tab) is the heart of Relay.** Camera feed + voice + real-time guidance. This is what judges will see in the demo video.
3. **Gamification and community must feel alive**, not bolted on. These are differentiators vs generic Arduino tutors.
4. **The knowledge graph / learning progression must be genuinely interactive**, not decorative.
5. **Backend services are modular** — each feature is its own folder under `backend/` and deploys as its own Cloud Run service. `live-bridge` is the core real-time service; others (code-crafter, vision-verifier, reporter) are separate microservices.
6. **The Arduino Starter Kit** is the flagship hardware. The demo build is an **LDR (light sensor) + LED/buzzer** project.

---

## Scope Boundaries

### In scope (for hackathon submission)

- Landing page (done, may need polish)
- Relay workspace with Build, Learn, Community, Library tabs
- Live voice + video session via Gemini Live API
- Component inventory verification via camera
- Step-by-step wiring guidance with error correction
- Arduino code generation and self-correction
- 3D digital twin of completed build
- XP / streak / league gamification
- Community feed with builds and reactions
- Knowledge graph for electronics concepts
- Build library (templates for various builds, not just Arduino)
- Simulation mode for judges who don't have hardware
- Google Cloud deployment (Cloud Run + Firestore + GCS)
- Architecture diagram
- Demo video (< 4 min)
- README with spin-up instructions

### Out of scope (removed)

- Notebook generation
- Chart/plot generation
- Slide deck / presentation generation
- Any document creation workflow

---

## Key Files and What They Do

| File | Purpose | Notes |
|------|---------|-------|
| `src/App.tsx` | Route controller | Landing (`/`) vs workspace (`/relay-app`) |
| `src/components/Home.tsx` | Landing page | Yellow bg, marketing sections, animations |
| `src/components/RelayLab.tsx` | The app workspace | White bg, tabs, live session, gamification — **this is where most work happens** |
| `src/components/Header.tsx` | Landing nav | Sticky, has "Open Relay App" CTA on right |
| `src/components/Footer.tsx` | Landing footer | Links, social, "Open Relay App" |
| `src/components/Logo.tsx` | Relay wordmark | Used in header, footer, sidebar |
| `.env` | Environment variables | API URLs, project ID, defaults |

---

## Environment Variables

```env
VITE_RELAY_API_BASE_URL=http://localhost:8081
VITE_RELAY_DEFAULT_USER_ID=faith
GOOGLE_CLOUD_PROJECT=relay-gemini
GOOGLE_CLOUD_REGION=us-central1
```

---

## Commands

```bash
# Frontend
npm run dev          # Start dev server (port 3000)
npm run build        # Production build (must pass before any PR)

# Backend — live-bridge (port 8082)
cd backend/live-bridge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload

# Syntax check
python3 -m py_compile backend/live-bridge/app/main.py

# Deploy to Cloud Run (no API key needed — Vertex AI uses service account)
gcloud run deploy relay-live-bridge \
  --source backend/live-bridge \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=relay-gemini,GOOGLE_CLOUD_LOCATION=europe-west1"
```

---

## Things That Will Get You Corrected

- Making the UI look generic/templated/AI-generated
- Using the same card component for every piece of content
- Adding technical jargon to user-facing UI (session ID, API URL, microservice status)
- Creating features that look interactive but don't actually work
- Stacking flat rectangles and calling it a layout
- Using only lucide-react icons with no custom visual elements
- Forgetting hover/active/transition states on interactive elements
- Writing "placeholder" or "coming soon" text in visible UI
- Removing features the user explicitly asked for
- Adding features the user explicitly removed (notebooks, charts, slides)
- Not running `npm run build` after frontend changes
- Not creating an iteration log after meaningful work