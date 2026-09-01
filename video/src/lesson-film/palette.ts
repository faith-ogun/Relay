/** The lesson films use the APP's palette, not the pitch video's.
 *
 *  theme.ts next door still carries the old neon landing-page yellow (#f3e515)
 *  from before the rebrand. A learner meets these films inside the app, right
 *  after a lesson, so they have to match what is on screen either side of them
 *  rather than the marketing site. Values are lifted from
 *  mobile/src/theme/tokens.ts. */
export const C = {
  cream: '#faf8f0',
  ink: '#14181f',
  inkSoft: '#474d57',
  inkMute: '#a8adb6',
  inkFaint: '#ebecee',
  line: '#ece7db',
  white: '#ffffff',
  gold: '#facc2e',
  goldDeep: '#f5b800',
  goldSoft: '#fff6d6',
  red: '#ff6f5e',
  blue: '#549cf0',
  blueDeep: '#3e86e8',
  green: '#84cc30',
  greenDeep: '#6fb519',
  copper: '#c17a3f',
} as const;

export const FPS = 30;
/** The beat between one narrated line and the next. Long enough that shots do
 *  not slam together, short enough that a three minute film has no dead air. */
export const GAP_FRAMES = 11;

export interface Frame {
  w: number;
  h: number;
  portrait: boolean;
  stage: { x: number; y: number; w: number; h: number };
  header: number;
  captionTop: number;
  captionH: number;
  /** Multiplier applied to every type size and stroke, so one set of scene
   *  components serves both a 1080x1920 phone film and a 1920x1080 web one. */
  k: number;
}

export const frameFor = (w: number, h: number): Frame => {
  const portrait = h > w;
  const captionH = portrait ? 330 : 200;
  // Narrow in portrait: a schematic is a WIDE drawing in a TALL frame, so every
  // pixel of width it gives up is lost twice over in height.
  const padX = portrait ? 44 : 150;
  const header = portrait ? 210 : 130;
  return {
    w, h, portrait,
    header,
    captionH,
    captionTop: h - captionH,
    stage: { x: padX, y: header, w: w - padX * 2, h: h - header - captionH - (portrait ? 40 : 30) },
    k: portrait ? 1 : 0.85,
  };
};
