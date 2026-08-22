// Nunito — Ohmlet's brand font, bundled locally by @remotion/google-fonts so it
// renders offline (no network fetch at render time).
import { loadFont } from "@remotion/google-fonts/Nunito";

const { fontFamily } = loadFont();

export const NUNITO = fontFamily;
export const MONO =
  '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", ui-monospace, monospace';
