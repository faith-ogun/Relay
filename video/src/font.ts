// Nunito — Ohmlet's brand font, bundled locally by @remotion/google-fonts so it
// renders offline (no network fetch at render time).
//
// Weights and subsets are pinned deliberately. The default load pulls every
// weight in every subset, which was 80 network requests per render worker: slow,
// and it makes an offline render fail for fonts nothing in the film uses. These
// four weights are the ones the pitch video and the lesson films actually set.
import { loadFont } from "@remotion/google-fonts/Nunito";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "800", "900"],
  subsets: ["latin"],
});

export const NUNITO = fontFamily;
export const MONO =
  '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", ui-monospace, monospace';
