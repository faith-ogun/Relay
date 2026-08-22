// theme.ts — Ohmlet brand tokens, scene-duration map, and the journey data.
// Palette from CLAUDE.md: electric yellow accent, navy-black ink, calm white page.

export const COLORS = {
  bg: "#ffffff", // the page — flat, still white
  panel: "#f8fafc", // slate-50 surface
  panel2: "#f1f5f9", // slate-100 surface
  line: "#e2e8f0", // slate-200 hairline
  ink: "#0f172a", // slate-900 — primary text / headings
  inkSoft: "#334155", // slate-700 — body
  muted: "#64748b", // slate-500 — secondary
  faint: "#94a3b8", // slate-400 — metadata
  yellow: "#f3e515", // the signature accent
  yellowSoft: "#fffde8", // yellow wash
  blue: "#3e86e8", // brand deep-blue accent (links, highlights)
  green: "#16a34a", // "shipped / done"
} as const;

export const FPS = 30;

// One scene-duration map for this video. Values are FRAMES (seconds x 30).
export const SCENES = {
  title: 165, // ~5.5s
  whatItIs: 240, // ~8s
  phase: 210, // ~7s EACH — one per journey phase (7 phases)
  cut: 315, // ~10.5s — the honest "what was cut" beat
  now: 285, // ~9.5s — where we are
  future: 315, // ~10.5s — where it's going
  close: 165, // ~5.5s
} as const;

// The journey. Each phase carries its real task numbers (from the git history),
// so the timeline shows exactly what shipped in each stretch.
export interface Phase {
  tag: string;
  date: string;
  title: string;
  lead: string;
  tasks: string[];
  points: string[];
}

export const PHASES: Phase[] = [
  {
    tag: "INCEPTION",
    date: "Feb - Mar 2026",
    title: 'Born as "Relay"',
    lead: "A real-time voice and vision lab tutor for electronics. The seed idea.",
    tasks: ["first commit", "iter 001"],
    points: [
      "First commit, February 24",
      "Named Relay, then RelayLab",
      "Later rebranded to Ohmlet",
    ],
  },
  {
    tag: "LEARNING CORE",
    date: "Jun 15 - 19",
    title: "The lesson loop",
    lead: "The curriculum spine: an interactive, Duolingo-style way to learn.",
    tasks: ["iter 002 - 006"],
    points: [
      "Workspace views and lesson runner",
      "Authoring rails and tiered leveling",
      "The interactive lesson rebuild",
    ],
  },
  {
    tag: "COMMERCIAL + SECURITY SPINE",
    date: "Jun 20",
    title: "A product, in one day",
    lead: "Auth, isolation, entitlements, payments, and the full 12-unit lesson loop.",
    tasks: ["#29", "#44", "#56", "#47", "#45", "#30"],
    points: [
      "Firebase Auth, per-user isolation, entitlements",
      "Stripe Checkout and webhook",
      "All 12 curriculum units on the run loop",
    ],
  },
  {
    tag: "TRUST + SOCIAL + SIMULATOR",
    date: "Jun 21 - 25",
    title: "Depth and a real simulator",
    lead: "GDPR, tests, the social layer, and a true circuit simulator that runs real code.",
    tasks: ["#34", "#49", "#63", "#50", "#67", "#71", "#73"],
    points: [
      "GDPR export/delete, CI hard gate, resilience",
      "Community feed, comments, weekly league",
      "DC simulator + real Arduino via AVR8js",
    ],
  },
  {
    tag: "PRODUCT DEPTH",
    date: "Jun 26 - 27",
    title: "The full experience",
    lead: "Interview mode, the 3D digital twin, accessibility, and backups.",
    tasks: ["#21", "#31", "#38", "#54", "#52", "#53"],
    points: [
      "Interview Mode (backend + frontend)",
      "3D digital-twin generation + viewer",
      "WCAG 2.2 AA, caching, disaster recovery",
    ],
  },
  {
    tag: "GROWTH + BRAND",
    date: "Jul 2 - 5",
    title: "Instrument and polish",
    lead: "The activation metric, the first SEO guides, and the navy-black brand pass.",
    tasks: ["#83", "#20"],
    points: [
      "North-star build analytics (FBC7)",
      "Two SEO Arduino build guides",
      "Brand ink moved to navy-black",
    ],
  },
  {
    tag: "SAFETY + MONETIZATION SPRINT",
    date: "Jul 11",
    title: "Safe, and ready to earn",
    lead: "Child mode, the first-build paywall, moderation, and the twin-share loop.",
    tasks: ["#94", "#18", "#96", "#98", "#97", "#79"],
    points: [
      "Child mode: consent, gate, safe runtime",
      "First-build paywall + under-18 payment gate",
      "Community moderation + 3D-twin sharing",
    ],
  },
];

// The honest "what was cut / descoped" beat.
export const CUTS: { label: string; detail: string }[] = [
  { label: '"Relay" / "RelayLab"', detail: "renamed to Ohmlet, the ohm-resistor egg" },
  { label: "Neon brutalism", detail: "moved to a calm, Duolingo-edge look on white" },
  { label: "Older concepts (ICE)", detail: "dropped for a voice-first authored curriculum" },
  { label: "Avatar lab gear", detail: "built, then removed as clutter" },
  { label: "Notebooks, charts, slides", detail: "out of scope on purpose, only the 3D twin ships" },
  { label: "All-ages legal", detail: "written, benched behind the flag until sign-off" },
];

// Where it's going.
export const FUTURE: { tasks: string; title: string; detail: string }[] = [
  { tasks: "#79 + #64", title: "Finish the web sprint", detail: "the public twin-share page, then Stripe live" },
  { tasks: "#28", title: "Lifecycle email", detail: "Resend, once Workspace is set up" },
  { tasks: "#70", title: "The mobile app", detail: "Expo + RevenueCat, for the Shipaton (Aug - Sep)" },
  { tasks: "#65 #76 #66", title: "Retention + growth", detail: "streaks, reverse-trial, twin showcase" },
];

export const TOTAL_FRAMES =
  SCENES.title +
  SCENES.whatItIs +
  PHASES.length * SCENES.phase +
  SCENES.cut +
  SCENES.now +
  SCENES.future +
  SCENES.close;
