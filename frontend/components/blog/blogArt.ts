// ── Blog illustrations ──
//
// Hand-authored, on-brand SVG diagrams that replace the media placeholders in
// the build guides. Keyed by a short `art` id set on each `media` block in
// posts.ts. Rendered inline (see BlogArt in BlogPostPage) so the labels inherit
// the page's Nunito. Every string here is static and authored in-repo (no user
// input ever reaches it), so inline injection is safe.
//
// Palette matches the app tokens: ink #14181f, cream #faf8f0, gold #facc2e,
// blue #549cf0/#3e86e8, green #84cc30/#6fb519, red #ff6f5e. Electronics are
// drawn accurately (220Ω = red-red-brown-gold; 10kΩ = brown-black-orange-gold).

const ROOT =
  'style="width:100%;height:auto;display:block;font-family:\'Nunito\',system-ui,-apple-system,sans-serif"';
const MONO = "font-family=\"'JetBrains Mono',ui-monospace,monospace\"";

export const BLOG_ART: Record<string, string> = {
  // ────────────────────────────── Ohm's law: LED with/without a resistor
  'ohms-law-led': `<svg viewBox="0 0 800 486" ${ROOT} role="img" aria-label="LED without a resistor burns out; with a 220 ohm resistor it glows.">
  <defs>
    <radialGradient id="oll-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffe37a"/><stop offset="55%" stop-color="#facc2e"/><stop offset="100%" stop-color="#f5b800"/></radialGradient>
    <radialGradient id="oll-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#facc2e" stop-opacity=".55"/><stop offset="100%" stop-color="#facc2e" stop-opacity="0"/></radialGradient>
    <linearGradient id="oll-res" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f4e2c0"/><stop offset="100%" stop-color="#e3caa0"/></linearGradient>
  </defs>
  <text x="40" y="46" font-size="27" font-weight="900" fill="#14181f">Why your LED needs a resistor</text>
  <text x="40" y="72" font-size="15" font-weight="700" fill="#474d57">Same LED, same 5&#8202;V. The only difference is one small part.</text>
  <g transform="translate(40,98)">
    <rect x="0" y="0" width="342" height="252" rx="18" fill="#fff5f3" stroke="#ffcfc7" stroke-width="2"/>
    <rect x="16" y="16" width="150" height="26" rx="13" fill="#ff6f5e"/>
    <text x="91" y="34" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">NO RESISTOR</text>
    <rect x="24" y="120" width="58" height="44" rx="10" fill="#14181f"/>
    <text x="53" y="147" font-size="16" font-weight="900" fill="#facc2e" text-anchor="middle">5V</text>
    <path d="M82 142 H176" stroke="#ff6f5e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M176 142 H236 M300 142 V196 H150" stroke="#14181f" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(214,142)">
      <path d="M-6 -44 q-10 -12 2 -22 q10 -8 0 -20" stroke="#b7b0a4" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
      <path d="M10 -48 q-8 -10 2 -18" stroke="#cfc8bb" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M0 44 v-36 M14 44 v-48" stroke="#7c8b88" stroke-width="4" stroke-linecap="round" transform="translate(-7,-8)"/>
      <path d="M-16 -8 v-14 a16 16 0 0 1 32 0 v14 z" fill="#c9c3b7" stroke="#8f887a" stroke-width="2.5"/>
      <rect x="-16" y="-8" width="32" height="6" rx="2" fill="#8f887a"/>
      <path d="M-4 -30 l6 8 l-7 6 l8 6" stroke="#14181f" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g transform="translate(300,120)"><circle r="17" fill="#ff6f5e" stroke="#14181f" stroke-width="2.5"/><path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></g>
    <text x="171" y="238" font-size="13.5" font-weight="800" fill="#c0392b" text-anchor="middle">Full current floods through &#8594; it burns out</text>
  </g>
  <g transform="translate(418,98)">
    <rect x="0" y="0" width="342" height="252" rx="18" fill="#f4fbea" stroke="#c6e79a" stroke-width="2"/>
    <rect x="16" y="16" width="150" height="26" rx="13" fill="#6fb519"/>
    <text x="91" y="34" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">WITH 220&#8486;</text>
    <rect x="24" y="120" width="58" height="44" rx="10" fill="#14181f"/>
    <text x="53" y="147" font-size="16" font-weight="900" fill="#facc2e" text-anchor="middle">5V</text>
    <path d="M82 142 H104" stroke="#ff6f5e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g transform="translate(104,142)">
      <path d="M0 0 H8 M64 0 H72" stroke="#14181f" stroke-width="4" stroke-linecap="round"/>
      <rect x="8" y="-13" width="56" height="26" rx="9" fill="url(#oll-res)" stroke="#b98f52" stroke-width="2"/>
      <rect x="17" y="-13" width="5" height="26" fill="#c0392b"/><rect x="25" y="-13" width="5" height="26" fill="#c0392b"/><rect x="33" y="-13" width="5" height="26" fill="#7c3f00"/><rect x="50" y="-13" width="5" height="26" fill="#d4a017"/>
    </g>
    <path d="M176 142 H236 M300 142 V196 H150" stroke="#14181f" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(214,142)">
      <circle cx="0" cy="-24" r="46" fill="url(#oll-halo)"/>
      <path d="M0 44 v-36 M14 44 v-48" stroke="#7c8b88" stroke-width="4" stroke-linecap="round" transform="translate(-7,-8)"/>
      <path d="M-16 -8 v-14 a16 16 0 0 1 32 0 v14 z" fill="url(#oll-glow)" stroke="#f5b800" stroke-width="2.5"/>
      <rect x="-16" y="-8" width="32" height="6" rx="2" fill="#f5b800"/>
      <path d="M-6 -20 q6 -6 12 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>
    </g>
    <g transform="translate(300,120)"><circle r="17" fill="#6fb519" stroke="#14181f" stroke-width="2.5"/><path d="M-7 0 L-2 6 L8 -6" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    <text x="171" y="238" font-size="13.5" font-weight="800" fill="#4d7c0f" text-anchor="middle">Current limited to a safe level &#8594; it glows</text>
  </g>
  <g transform="translate(40,368)">
    <rect x="0" y="0" width="720" height="86" rx="16" fill="#14181f"/>
    <text x="26" y="34" font-size="14" font-weight="800" fill="#facc2e">OHM&#8217;S LAW &#183; pick the resistor</text>
    <text x="26" y="66" font-size="21" font-weight="900" fill="#fff">R = (V &#8722; V<tspan font-size="14" dy="4">f</tspan><tspan dy="-4">) / I  =  (5 &#8722; 2) / 0.02</tspan></text>
    <g transform="translate(505,20)"><rect x="0" y="0" width="190" height="46" rx="12" fill="#facc2e"/><text x="95" y="30" font-size="18" font-weight="900" fill="#14181f" text-anchor="middle">= 150&#8486; &#8594; use 220&#8486;</text></g>
    <text x="600" y="82" font-size="11" font-weight="700" fill="#9aa0a6" text-anchor="middle">nearest standard value above 150&#8486;</text>
  </g>
</svg>`,

  // ────────────────────────────── Breadboard anatomy
  'breadboard-anatomy': `<svg viewBox="0 0 800 470" ${ROOT} role="img" aria-label="Annotated breadboard showing power rails, terminal rows, the center gap, and connected strips.">
  <defs><pattern id="ba-h" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="10.5" cy="10.5" r="3.6" fill="#cfc8b6"/><circle cx="10.5" cy="10.5" r="2.4" fill="#efeadd"/></pattern></defs>
  <text x="40" y="46" font-size="27" font-weight="900" fill="#14181f">How a breadboard is wired inside</text>
  <text x="40" y="72" font-size="15" font-weight="700" fill="#474d57">Holes in the same strip are already connected. No solder needed.</text>
  <g transform="translate(150,104)">
    <rect x="0" y="0" width="500" height="300" rx="16" fill="#f6f3ea" stroke="#14181f" stroke-width="2.5"/>
    <path d="M24 30 H476" stroke="#ff6f5e" stroke-width="3"/>
    <path d="M24 66 H476" stroke="#549cf0" stroke-width="3"/>
    <text x="14" y="34" font-size="16" font-weight="900" fill="#ff6f5e" text-anchor="middle">+</text>
    <text x="14" y="72" font-size="18" font-weight="900" fill="#549cf0" text-anchor="middle">&#8722;</text>
    <rect x="24" y="36" width="452" height="18" fill="url(#ba-h)"/>
    <rect x="24" y="70" width="452" height="18" fill="url(#ba-h)"/>
    <rect x="24" y="112" width="452" height="63" fill="url(#ba-h)"/>
    <rect x="24" y="181" width="452" height="16" rx="4" fill="#e3ddcc"/>
    <path d="M24 189 H476" stroke="#cfc8b6" stroke-width="1.5" stroke-dasharray="2 5"/>
    <rect x="24" y="203" width="452" height="63" fill="url(#ba-h)"/>
    <rect x="24" y="272" width="452" height="21" fill="url(#ba-h)"/>
    <rect x="120.5" y="108" width="21" height="71" rx="10" fill="#facc2e" fill-opacity=".22" stroke="#f5b800" stroke-width="2"/>
    <rect x="150" y="34" width="180" height="29" rx="10" fill="#ff6f5e" fill-opacity=".14" stroke="#ff6f5e" stroke-width="1.6" stroke-dasharray="4 4"/>
  </g>
  <g font-size="12.5" font-weight="800">
    <g transform="translate(560,150)"><rect x="0" y="-16" width="200" height="52" rx="12" fill="#fff" stroke="#14181f" stroke-width="2"/><text x="14" y="4" fill="#14181f">Power rails</text><text x="14" y="24" fill="#474d57" font-weight="700">run the whole length: + and &#8722;</text><path d="M0 8 H-30" stroke="#14181f" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <g transform="translate(40,196)"><rect x="0" y="-16" width="196" height="52" rx="12" fill="#fff6d6" stroke="#f5b800" stroke-width="2"/><text x="14" y="4" fill="#8a6a05">These 5 holes are one strip</text><text x="14" y="24" fill="#8a6a05" font-weight="700">connect here, they all connect</text><path d="M196 8 H262" stroke="#f5b800" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>
    <g transform="translate(300,430)"><rect x="-110" y="-18" width="220" height="34" rx="12" fill="#fff" stroke="#14181f" stroke-width="2"/><text x="0" y="4" fill="#14181f" text-anchor="middle">Center gap splits top from bottom</text><path d="M0 -18 V-40" stroke="#14181f" stroke-width="2" fill="none" stroke-linecap="round"/></g>
  </g>
</svg>`,

  // ────────────────────────────── Serial monitor: noise vs clean
  'serial-noise-clean': `<svg viewBox="0 0 800 428" ${ROOT} role="img" aria-label="Serial monitor: a floating pin shows random noise; a pull-down resistor gives clean readings.">
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">A floating pin reads pure noise</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">Add a pull-down and the same pin snaps to a steady 0, then a clean 1 on press.</text>
  <rect x="40" y="92" width="720" height="300" rx="14" fill="#fff" stroke="#14181f" stroke-width="2.5"/>
  <rect x="40" y="92" width="720" height="32" rx="14" fill="#14181f"/>
  <rect x="40" y="110" width="720" height="14" fill="#14181f"/>
  <circle cx="60" cy="108" r="4.5" fill="#ff6f5e"/><circle cx="76" cy="108" r="4.5" fill="#facc2e"/><circle cx="92" cy="108" r="4.5" fill="#6fb519"/>
  <text x="400" y="112" font-size="13" font-weight="800" fill="#fff" text-anchor="middle" ${MONO}>Serial Monitor &#8212; 9600 baud</text>
  <path d="M400 124 V392" stroke="#ece7db" stroke-width="2" stroke-dasharray="3 5"/>
  <rect x="64" y="140" width="150" height="24" rx="12" fill="#ff6f5e"/><text x="139" y="157" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">FLOATING PIN</text>
  <path d="M64 300 L84 250 L104 300 L118 250 L138 300 L152 250 L172 250 L186 300 L206 250 L220 300 L240 250 L260 300 L280 250 L300 300 L320 250 L340 300 L360 250 L376 300" fill="none" stroke="#ff6f5e" stroke-width="3" stroke-linejoin="round"/>
  <text x="64" y="196" ${MONO} font-size="14" font-weight="700" fill="#474d57">1 0 1 1 0 1 0 0 1 0 1</text>
  <text x="64" y="216" ${MONO} font-size="14" font-weight="700" fill="#474d57">0 1 1 0 1 0 0 1 1 0 1</text>
  <text x="220" y="340" font-size="13" font-weight="800" fill="#c0392b" text-anchor="middle">jittery, random garbage</text>
  <rect x="450" y="140" width="176" height="24" rx="12" fill="#6fb519"/><text x="538" y="157" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">WITH 10k&#8486; PULL-DOWN</text>
  <path d="M424 300 H560 V250 H736" fill="none" stroke="#6fb519" stroke-width="3.4" stroke-linejoin="round"/>
  <text x="470" y="290" font-size="11" font-weight="800" fill="#6fb519">LOW (0)</text>
  <text x="650" y="240" font-size="11" font-weight="800" fill="#6fb519">HIGH (1) on press</text>
  <text x="424" y="196" ${MONO} font-size="14" font-weight="700" fill="#474d57">0 0 0 0 0 0 0 0 0 0 0</text>
  <text x="424" y="216" ${MONO} font-size="14" font-weight="700" fill="#14181f">0 0 0 1 1 1 1 1 1 1 1</text>
  <text x="580" y="340" font-size="13" font-weight="800" fill="#4d7c0f" text-anchor="middle">steady and predictable</text>
  <g transform="translate(340,356)"><rect x="0" y="0" width="120" height="30" rx="15" fill="#facc2e" stroke="#14181f" stroke-width="2"/><text x="52" y="20" font-size="12.5" font-weight="900" fill="#14181f" text-anchor="middle">add 10k&#8486;</text><path d="M92 15 h14 m-5 -5 l5 5 l-5 5" fill="none" stroke="#14181f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`,

  // ────────────────────────────── Resistor color code
  'resistor-color-code': `<svg viewBox="0 0 800 496" ${ROOT} role="img" aria-label="Resistor color code chart with band meanings and worked examples for 220 and 10k ohm.">
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">Read any resistor in 4 bands</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">Two digits, a multiplier, a tolerance. That&#8217;s the whole trick.</text>
  <g transform="translate(0,110)">
    <path d="M150 40 H250 M470 40 H630" stroke="#14181f" stroke-width="5" stroke-linecap="round"/>
    <rect x="250" y="10" width="220" height="60" rx="22" fill="#f0ddb8" stroke="#b98f52" stroke-width="2.5"/>
    <rect x="286" y="10" width="16" height="60" fill="#c0392b"/><rect x="320" y="10" width="16" height="60" fill="#c0392b"/><rect x="354" y="10" width="16" height="60" fill="#7c3f00"/><rect x="420" y="10" width="16" height="60" fill="#d4a017"/>
    <g font-size="11.5" font-weight="800" fill="#14181f" text-anchor="middle">
      <path d="M294 10 V-14 H262" fill="none" stroke="#14181f" stroke-width="1.6"/><text x="262" y="-20">1st digit</text>
      <path d="M328 78 V96" fill="none" stroke="#14181f" stroke-width="1.6"/><text x="328" y="112">2nd digit</text>
      <path d="M362 10 V-14 H396" fill="none" stroke="#14181f" stroke-width="1.6"/><text x="404" y="-20" text-anchor="start">&#215; multiplier</text>
      <path d="M428 78 V96" fill="none" stroke="#14181f" stroke-width="1.6"/><text x="428" y="112">tolerance</text>
    </g>
  </g>
  <g transform="translate(40,262)" font-size="12.5" font-weight="800">
    <g><rect x="0" y="0" width="16" height="16" rx="3" fill="#14181f"/><text x="24" y="13" fill="#14181f">Black &#183; 0</text></g>
    <g transform="translate(0,26)"><rect width="16" height="16" rx="3" fill="#7c3f00"/><text x="24" y="13" fill="#14181f">Brown &#183; 1</text></g>
    <g transform="translate(0,52)"><rect width="16" height="16" rx="3" fill="#c0392b"/><text x="24" y="13" fill="#14181f">Red &#183; 2</text></g>
    <g transform="translate(0,78)"><rect width="16" height="16" rx="3" fill="#e08a1e"/><text x="24" y="13" fill="#14181f">Orange &#183; 3</text></g>
    <g transform="translate(0,104)"><rect width="16" height="16" rx="3" fill="#e8c400"/><text x="24" y="13" fill="#14181f">Yellow &#183; 4</text></g>
    <g transform="translate(180,0)"><rect width="16" height="16" rx="3" fill="#4d9c3f"/><text x="24" y="13" fill="#14181f">Green &#183; 5</text></g>
    <g transform="translate(180,26)"><rect width="16" height="16" rx="3" fill="#3e86e8"/><text x="24" y="13" fill="#14181f">Blue &#183; 6</text></g>
    <g transform="translate(180,52)"><rect width="16" height="16" rx="3" fill="#7c3aed"/><text x="24" y="13" fill="#14181f">Violet &#183; 7</text></g>
    <g transform="translate(180,78)"><rect width="16" height="16" rx="3" fill="#8d97a3"/><text x="24" y="13" fill="#14181f">Grey &#183; 8</text></g>
    <g transform="translate(180,104)"><rect width="16" height="16" rx="3" fill="#e7e2d5" stroke="#cfc8b6"/><text x="24" y="13" fill="#14181f">White &#183; 9</text></g>
  </g>
  <g transform="translate(400,258)">
    <rect x="0" y="0" width="360" height="140" rx="16" fill="#faf8f0" stroke="#ece7db" stroke-width="2"/>
    <text x="20" y="30" font-size="13" font-weight="900" fill="#8a6a05">WORKED EXAMPLES</text>
    <g transform="translate(30,58)"><path d="M0 8 H14 M70 8 H84" stroke="#14181f" stroke-width="3.5" stroke-linecap="round"/><rect x="14" y="-8" width="56" height="32" rx="11" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="22" y="-8" width="6" height="32" fill="#c0392b"/><rect x="31" y="-8" width="6" height="32" fill="#c0392b"/><rect x="40" y="-8" width="6" height="32" fill="#7c3f00"/><rect x="56" y="-8" width="6" height="32" fill="#d4a017"/></g>
    <text x="130" y="72" font-size="15" font-weight="900" fill="#14181f">red red brown = 220&#8486;</text>
    <g transform="translate(30,108)"><path d="M0 8 H14 M70 8 H84" stroke="#14181f" stroke-width="3.5" stroke-linecap="round"/><rect x="14" y="-8" width="56" height="32" rx="11" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="22" y="-8" width="6" height="32" fill="#7c3f00"/><rect x="31" y="-8" width="6" height="32" fill="#14181f"/><rect x="40" y="-8" width="6" height="32" fill="#e08a1e"/><rect x="56" y="-8" width="6" height="32" fill="#d4a017"/></g>
    <text x="130" y="122" font-size="15" font-weight="900" fill="#14181f">brown black orange = 10k&#8486;</text>
  </g>
</svg>`,

  // ────────────────────────────── PWM duty cycle
  'pwm-duty-cycle': `<svg viewBox="0 0 800 420" ${ROOT} role="img" aria-label="PWM square waves at 25, 50, and 75 percent duty cycle with matching LED brightness.">
  <defs>
    <radialGradient id="pwm-g" cx="50%" cy="45%" r="58%"><stop offset="0%" stop-color="#ffe37a"/><stop offset="55%" stop-color="#facc2e"/><stop offset="100%" stop-color="#f5b800"/></radialGradient>
    <radialGradient id="pwm-h" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#facc2e" stop-opacity=".6"/><stop offset="100%" stop-color="#facc2e" stop-opacity="0"/></radialGradient>
  </defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">PWM: brightness by blinking fast</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">The pin flips on and off thousands of times a second. More &#8220;on&#8221; = brighter.</text>
  <text x="40" y="108" font-size="12" font-weight="800" fill="#8a6a05">DUTY CYCLE</text>
  <text x="300" y="108" font-size="12" font-weight="800" fill="#8a6a05" text-anchor="middle">SIGNAL</text>
  <text x="600" y="108" font-size="12" font-weight="800" fill="#8a6a05" text-anchor="end">CODE</text>
  <text x="712" y="108" font-size="12" font-weight="800" fill="#8a6a05" text-anchor="middle">LED</text>
  <g transform="translate(0,130)">
    <text x="40" y="30" font-size="22" font-weight="900" fill="#14181f">25%</text>
    <path d="M150 44 h20 v-34 h40 v34 h60 v-34 h40 v34 h60 v-34 h20" fill="none" stroke="#3e86e8" stroke-width="3.2" stroke-linejoin="round"/>
    <text x="600" y="20" font-size="13" font-weight="800" fill="#14181f" text-anchor="end" ${MONO}>analogWrite(64)</text>
    <text x="600" y="40" font-size="12" font-weight="700" fill="#474d57" text-anchor="end">dim</text>
    <g transform="translate(712,18)"><circle r="30" fill="url(#pwm-h)" opacity=".35"/><path d="M-13 8 v-11 a13 13 0 0 1 26 0 v11 z" fill="url(#pwm-g)" stroke="#f5b800" stroke-width="2.2" opacity=".55"/><rect x="-13" y="8" width="26" height="5" rx="2" fill="#f5b800" opacity=".55"/></g>
  </g>
  <g transform="translate(0,218)">
    <text x="40" y="30" font-size="22" font-weight="900" fill="#14181f">50%</text>
    <path d="M150 44 h40 v-34 h50 v34 h50 v-34 h50 v34 h50 v-34 h30" fill="none" stroke="#3e86e8" stroke-width="3.2" stroke-linejoin="round"/>
    <text x="600" y="20" font-size="13" font-weight="800" fill="#14181f" text-anchor="end" ${MONO}>analogWrite(128)</text>
    <text x="600" y="40" font-size="12" font-weight="700" fill="#474d57" text-anchor="end">medium</text>
    <g transform="translate(712,18)"><circle r="30" fill="url(#pwm-h)" opacity=".7"/><path d="M-13 8 v-11 a13 13 0 0 1 26 0 v11 z" fill="url(#pwm-g)" stroke="#f5b800" stroke-width="2.2" opacity=".8"/><rect x="-13" y="8" width="26" height="5" rx="2" fill="#f5b800" opacity=".8"/></g>
  </g>
  <g transform="translate(0,306)">
    <text x="40" y="30" font-size="22" font-weight="900" fill="#14181f">75%</text>
    <path d="M150 44 h60 v-34 h30 v34 h30 v-34 h60 v34 h30 v-34 h60" fill="none" stroke="#3e86e8" stroke-width="3.2" stroke-linejoin="round"/>
    <text x="600" y="20" font-size="13" font-weight="800" fill="#14181f" text-anchor="end" ${MONO}>analogWrite(191)</text>
    <text x="600" y="40" font-size="12" font-weight="700" fill="#474d57" text-anchor="end">bright</text>
    <g transform="translate(712,18)"><circle r="34" fill="url(#pwm-h)"/><path d="M-13 8 v-11 a13 13 0 0 1 26 0 v11 z" fill="url(#pwm-g)" stroke="#f5b800" stroke-width="2.2"/><rect x="-13" y="8" width="26" height="5" rx="2" fill="#f5b800"/></g>
  </g>
</svg>`,

  // ────────────────────────────── Multimeter probe placement
  'multimeter-probe': `<svg viewBox="0 0 800 420" ${ROOT} role="img" aria-label="A multimeter set to DC volts, red probe on the plus rail and black probe on the minus rail, reading 5 volts.">
  <defs><pattern id="mm-h" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="3.6" fill="#cfc8b6"/><circle cx="11" cy="11" r="2.4" fill="#efeadd"/></pattern></defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">Check a rail before you trust it</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">Dial to DC volts, red probe on +, black on &#8722;. The screen tells the truth.</text>
  <rect x="60" y="104" width="250" height="286" rx="22" fill="#facc2e" stroke="#14181f" stroke-width="2.5"/>
  <rect x="60" y="150" width="250" height="24" fill="#f5b800"/>
  <path d="M60 126 a22 22 0 0 1 22 -22 h206 a22 22 0 0 1 22 22 v48 h-250 z" fill="#f5b800"/>
  <text x="185" y="140" font-size="13" font-weight="900" fill="#14181f" text-anchor="middle" opacity=".7">OHM-METER</text>
  <rect x="88" y="186" width="194" height="66" rx="10" fill="#dbe7cf" stroke="#14181f" stroke-width="2"/>
  <text x="264" y="234" font-size="38" font-weight="700" fill="#1c2b24" text-anchor="end" ${MONO}>5.00</text>
  <text x="100" y="204" font-size="11" font-weight="800" fill="#4d6b52">DC V</text>
  <circle cx="150" cy="316" r="46" fill="#fffbe9" stroke="#14181f" stroke-width="2.5"/>
  <g font-size="9" font-weight="800" fill="#14181f" text-anchor="middle"><text x="150" y="284">V&#9107;</text><text x="192" y="304">V~</text><text x="196" y="340">A</text><text x="168" y="360">&#937;</text><text x="126" y="360">OFF</text></g>
  <line x1="150" y1="316" x2="150" y2="286" stroke="#ff6f5e" stroke-width="4" stroke-linecap="round"/>
  <circle cx="150" cy="316" r="8" fill="#14181f"/>
  <circle cx="118" cy="374" r="9" fill="#14181f" stroke="#14181f" stroke-width="2"/><circle cx="118" cy="374" r="3.5" fill="#8d97a3"/>
  <circle cx="230" cy="374" r="9" fill="#ff6f5e" stroke="#14181f" stroke-width="2"/><circle cx="230" cy="374" r="3.5" fill="#fff"/>
  <text x="118" y="392" font-size="8.5" font-weight="800" fill="#14181f" text-anchor="middle">COM</text>
  <text x="230" y="392" font-size="8.5" font-weight="800" fill="#14181f" text-anchor="middle">V&#937;</text>
  <rect x="430" y="150" width="320" height="150" rx="14" fill="#f6f3ea" stroke="#14181f" stroke-width="2.5"/>
  <path d="M452 192 H728" stroke="#ff6f5e" stroke-width="3"/><text x="444" y="197" font-size="16" font-weight="900" fill="#ff6f5e" text-anchor="end">+</text>
  <rect x="452" y="200" width="276" height="20" fill="url(#mm-h)"/>
  <path d="M452 258 H728" stroke="#549cf0" stroke-width="3"/><text x="444" y="263" font-size="18" font-weight="900" fill="#549cf0" text-anchor="end">&#8722;</text>
  <rect x="452" y="238" width="276" height="20" fill="url(#mm-h)"/>
  <path d="M230 374 C330 380 300 210 560 210" fill="none" stroke="#ff6f5e" stroke-width="5" stroke-linecap="round"/>
  <path d="M118 374 C120 420 470 330 620 248" fill="none" stroke="#14181f" stroke-width="5" stroke-linecap="round"/>
  <path d="M560 200 l-7 -16 l14 0 z" fill="#8d97a3" stroke="#14181f" stroke-width="1.6"/><circle cx="560" cy="210" r="5" fill="#ff6f5e" stroke="#14181f" stroke-width="1.6"/>
  <path d="M620 258 l-7 16 l14 0 z" fill="#8d97a3" stroke="#14181f" stroke-width="1.6"/><circle cx="620" cy="248" r="5" fill="#14181f"/>
  <g font-size="12" font-weight="800">
    <g transform="translate(556,120)"><rect x="0" y="0" width="150" height="26" rx="13" fill="#ff6f5e"/><text x="75" y="17" fill="#fff" text-anchor="middle">red probe &#8594; + rail</text></g>
    <g transform="translate(556,300)"><rect x="0" y="0" width="150" height="26" rx="13" fill="#14181f"/><text x="75" y="17" fill="#fff" text-anchor="middle">black probe &#8594; &#8722; rail</text></g>
  </g>
</svg>`,

  // ────────────────────────────── Light-activated alarm wiring (LDR divider + buzzer)
  'alarm-wiring': `<svg viewBox="0 0 800 480" ${ROOT} role="img" aria-label="LDR and 10k resistor form a divider into A0; a buzzer on pin 8.">
  <defs><pattern id="aw-h" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="10.5" cy="10.5" r="3.5" fill="#cfc8b6"/><circle cx="10.5" cy="10.5" r="2.3" fill="#efeadd"/></pattern></defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">The circuit that senses darkness</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">An LDR and a 10&#8202;k&#8486; split 5V; A0 reads the middle, the buzzer sounds on D8.</text>
  <g>
    <rect x="40" y="150" width="144" height="278" rx="14" fill="#2c6fae" stroke="#14181f" stroke-width="2.5"/>
    <rect x="58" y="140" width="44" height="20" rx="4" fill="#b7bcc4" stroke="#14181f" stroke-width="2"/>
    <text x="168" y="175" font-size="11.5" font-weight="900" fill="#fff" text-anchor="end" opacity=".9">OHM &#183; UNO</text>
    <rect x="156" y="185" width="26" height="230" rx="5" fill="#14181f"/>
    <g font-size="11" font-weight="800" fill="#fff" text-anchor="end"><circle cx="176" cy="200" r="5.5" fill="#facc2e"/><text x="150" y="204">5V</text><circle cx="176" cy="250" r="5.5" fill="#facc2e"/><text x="150" y="254">A0</text><circle cx="176" cy="330" r="5.5" fill="#facc2e"/><text x="150" y="334">D8</text><circle cx="176" cy="392" r="5.5" fill="#facc2e"/><text x="150" y="396">GND</text></g>
  </g>
  <g>
    <rect x="250" y="150" width="512" height="278" rx="16" fill="#f6f3ea" stroke="#14181f" stroke-width="2.5"/>
    <path d="M270 178 H744" stroke="#ff6f5e" stroke-width="2.5" opacity=".55"/><text x="262" y="197" font-size="15" font-weight="900" fill="#ff6f5e" text-anchor="end">+</text>
    <rect x="272" y="185" width="470" height="18" fill="url(#aw-h)"/>
    <rect x="272" y="222" width="470" height="52" fill="url(#aw-h)"/>
    <rect x="272" y="288" width="470" height="14" rx="4" fill="#e6e0cf"/>
    <rect x="272" y="316" width="470" height="46" fill="url(#aw-h)"/>
    <path d="M270 396 H744" stroke="#549cf0" stroke-width="2.5" opacity=".55"/><text x="262" y="407" font-size="17" font-weight="900" fill="#549cf0" text-anchor="end">&#8722;</text>
    <rect x="272" y="400" width="470" height="18" fill="url(#aw-h)"/>
  </g>
  <g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M176 200 H300 V186" stroke="#ff6f5e"/>
    <path d="M430 186 V210" stroke="#14181f" stroke-width="4"/>
    <path d="M430 254 V316" stroke="#14181f" stroke-width="4"/>
    <path d="M430 352 V400" stroke="#14181f" stroke-width="4"/>
    <path d="M430 272 H208 V250 H176" stroke="#6fb519"/>
    <path d="M176 330 H206 V166 H620 V262" stroke="#3e86e8"/>
    <path d="M620 318 V400" stroke="#14181f" stroke-width="4"/>
    <path d="M300 400 H176" stroke="#14181f" stroke-width="4"/>
  </g>
  <g transform="translate(430,232)">
    <circle r="22" fill="#fbe9a6" stroke="#14181f" stroke-width="2.5"/>
    <path d="M-9 8 L-3 8 L-1 -2 L3 8 L7 -2 L9 4" fill="none" stroke="#14181f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-22 -20 l7 5 M-16 -25 l6 6" stroke="#f5b800" stroke-width="2.6" stroke-linecap="round"/>
  </g>
  <g transform="translate(430,318)">
    <rect x="-9" y="0" width="18" height="34" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/>
    <rect x="-9" y="4" width="18" height="3.5" fill="#7c3f00"/><rect x="-9" y="11" width="18" height="3.5" fill="#14181f"/><rect x="-9" y="18" width="18" height="3.5" fill="#e08a1e"/><rect x="-9" y="27" width="18" height="3.5" fill="#d4a017"/>
  </g>
  <g transform="translate(620,290)">
    <circle r="28" fill="#20242c" stroke="#14181f" stroke-width="2.5"/>
    <circle r="10" fill="#14181f" stroke="#3a3f48" stroke-width="2"/><circle cx="0" cy="-2" r="2.6" fill="#6b7280"/>
    <text x="14" y="-14" font-size="13" font-weight="900" fill="#facc2e">+</text>
    <path d="M30 -14 q10 14 0 28 M38 -22 q16 22 0 44" stroke="#549cf0" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>
  </g>
  <g fill="#14181f"><circle cx="300" cy="186" r="4"/><circle cx="430" cy="186" r="4"/><circle cx="430" cy="272" r="5"/><circle cx="430" cy="400" r="4"/><circle cx="620" cy="400" r="4"/><circle cx="300" cy="400" r="4"/></g>
  <g font-size="11.5" font-weight="800">
    <g transform="translate(454,206)"><rect x="0" y="-12" width="60" height="22" rx="11" fill="#fff" stroke="#14181f" stroke-width="1.6"/><text x="30" y="4" fill="#14181f" text-anchor="middle">LDR</text></g>
    <g transform="translate(454,326)"><rect x="0" y="-12" width="60" height="22" rx="11" fill="#fff" stroke="#14181f" stroke-width="1.6"/><text x="30" y="4" fill="#14181f" text-anchor="middle">10k&#8486;</text></g>
    <g transform="translate(214,272)"><rect x="0" y="-12" width="150" height="22" rx="11" fill="#6fb519"/><text x="75" y="4" fill="#fff" text-anchor="middle">middle voltage &#8594; A0</text></g>
    <g transform="translate(590,150)"><rect x="0" y="0" width="150" height="24" rx="12" fill="#fff" stroke="#14181f" stroke-width="1.8"/><text x="75" y="16" fill="#14181f" text-anchor="middle">buzzer on D8</text></g>
  </g>
</svg>`,

  // ────────────────────────────── Traffic light wiring (3 LEDs)
  'traffic-light-wiring': `<svg viewBox="0 0 800 500" ${ROOT} role="img" aria-label="Three LEDs, each with a 220 ohm resistor to pins 2, 3, 4, all cathodes to ground.">
  <defs>
    <pattern id="tl-h" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="10.5" cy="10.5" r="3.5" fill="#cfc8b6"/><circle cx="10.5" cy="10.5" r="2.3" fill="#efeadd"/></pattern>
    <radialGradient id="tl-r" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff6f5e" stop-opacity=".55"/><stop offset="100%" stop-color="#ff6f5e" stop-opacity="0"/></radialGradient>
    <radialGradient id="tl-a" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f5b800" stop-opacity=".55"/><stop offset="100%" stop-color="#f5b800" stop-opacity="0"/></radialGradient>
    <radialGradient id="tl-g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#84cc30" stop-opacity=".55"/><stop offset="100%" stop-color="#84cc30" stop-opacity="0"/></radialGradient>
  </defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">Three LEDs, three pins, one ground</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">Each LED gets its own 220&#8486; resistor; every cathode returns to GND.</text>
  <g>
    <rect x="40" y="164" width="144" height="272" rx="14" fill="#2c6fae" stroke="#14181f" stroke-width="2.5"/>
    <rect x="58" y="154" width="44" height="20" rx="4" fill="#b7bcc4" stroke="#14181f" stroke-width="2"/>
    <text x="168" y="188" font-size="11.5" font-weight="900" fill="#fff" text-anchor="end" opacity=".9">OHM &#183; UNO</text>
    <rect x="156" y="200" width="26" height="222" rx="5" fill="#14181f"/>
    <g font-size="11" font-weight="800" fill="#fff" text-anchor="end"><circle cx="176" cy="224" r="5.5" fill="#facc2e"/><text x="150" y="228">D2</text><circle cx="176" cy="278" r="5.5" fill="#facc2e"/><text x="150" y="282">D3</text><circle cx="176" cy="332" r="5.5" fill="#facc2e"/><text x="150" y="336">D4</text><circle cx="176" cy="402" r="5.5" fill="#facc2e"/><text x="150" y="406">GND</text></g>
  </g>
  <g>
    <rect x="250" y="164" width="512" height="272" rx="16" fill="#f6f3ea" stroke="#14181f" stroke-width="2.5"/>
    <rect x="272" y="196" width="470" height="40" fill="url(#tl-h)"/>
    <rect x="272" y="288" width="470" height="14" rx="4" fill="#e6e0cf"/>
    <rect x="272" y="316" width="470" height="40" fill="url(#tl-h)"/>
    <path d="M270 406 H744" stroke="#549cf0" stroke-width="2.5" opacity=".55"/><text x="262" y="416" font-size="17" font-weight="900" fill="#549cf0" text-anchor="end">&#8722;</text>
    <rect x="272" y="410" width="470" height="18" fill="url(#tl-h)"/>
  </g>
  <g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M182 224 H214 V190 H390 V232" stroke="#ff6f5e"/>
    <path d="M182 278 H238 V176 H490 V232" stroke="#f5b800"/>
    <path d="M182 332 H262 V162 H590 V232" stroke="#6fb519"/>
    <path d="M390 316 V410" stroke="#3e86e8"/><path d="M490 316 V410" stroke="#3e86e8"/><path d="M590 316 V410" stroke="#3e86e8"/>
    <path d="M300 410 H190 V402 H182" stroke="#14181f" stroke-width="4"/>
  </g>
  <g transform="translate(390,232)"><rect x="-9" y="0" width="18" height="34" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-9" y="4" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="11" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="18" width="18" height="3.5" fill="#7c3f00"/><rect x="-9" y="27" width="18" height="3.5" fill="#d4a017"/><g transform="translate(0,58)"><circle r="26" fill="url(#tl-r)"/><path d="M-13 5 v-11 a13 13 0 0 1 26 0 v11 z" fill="#ff6f5e" stroke="#c0392b" stroke-width="2.2"/><rect x="-13" y="5" width="26" height="5" rx="2" fill="#c0392b"/></g></g>
  <g transform="translate(490,232)"><rect x="-9" y="0" width="18" height="34" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-9" y="4" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="11" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="18" width="18" height="3.5" fill="#7c3f00"/><rect x="-9" y="27" width="18" height="3.5" fill="#d4a017"/><g transform="translate(0,58)"><circle r="26" fill="url(#tl-a)"/><path d="M-13 5 v-11 a13 13 0 0 1 26 0 v11 z" fill="#facc2e" stroke="#f5b800" stroke-width="2.2"/><rect x="-13" y="5" width="26" height="5" rx="2" fill="#f5b800"/></g></g>
  <g transform="translate(590,232)"><rect x="-9" y="0" width="18" height="34" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-9" y="4" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="11" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="18" width="18" height="3.5" fill="#7c3f00"/><rect x="-9" y="27" width="18" height="3.5" fill="#d4a017"/><g transform="translate(0,58)"><circle r="26" fill="url(#tl-g)"/><path d="M-13 5 v-11 a13 13 0 0 1 26 0 v11 z" fill="#84cc30" stroke="#6fb519" stroke-width="2.2"/><rect x="-13" y="5" width="26" height="5" rx="2" fill="#6fb519"/></g></g>
  <g fill="#14181f"><circle cx="390" cy="410" r="4"/><circle cx="490" cy="410" r="4"/><circle cx="590" cy="410" r="4"/><circle cx="300" cy="410" r="4"/></g>
  <g font-size="11.5" font-weight="800">
    <g transform="translate(408,240)"><rect x="0" y="-11" width="70" height="22" rx="11" fill="#fff" stroke="#14181f" stroke-width="1.6"/><text x="35" y="4" fill="#c0392b" text-anchor="middle">D2 red</text></g>
    <g transform="translate(508,240)"><rect x="0" y="-11" width="80" height="22" rx="11" fill="#fff" stroke="#14181f" stroke-width="1.6"/><text x="40" y="4" fill="#a06a00" text-anchor="middle">D3 amber</text></g>
    <g transform="translate(608,240)"><rect x="0" y="-11" width="76" height="22" rx="11" fill="#fff" stroke="#14181f" stroke-width="1.6"/><text x="38" y="4" fill="#4d7c0f" text-anchor="middle">D4 green</text></g>
    <text x="506" y="454" font-size="12.5" font-weight="800" fill="#474d57" text-anchor="middle">220&#8486; on every LED &#183; all cathodes return to the &#8722; (GND) rail</text>
  </g>
</svg>`,

  // ────────────────────────────── Push-button wiring (pull-down + LED)
  'pushbutton-wiring': `<svg viewBox="0 0 800 470" ${ROOT} role="img" aria-label="Pushbutton wiring with a pull-down resistor and an LED.">
  <defs>
    <pattern id="pb-h" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="10.5" cy="10.5" r="3.5" fill="#cfc8b6"/><circle cx="10.5" cy="10.5" r="2.3" fill="#efeadd"/></pattern>
    <radialGradient id="pb-g" cx="50%" cy="42%" r="58%"><stop offset="0%" stop-color="#ffe37a"/><stop offset="55%" stop-color="#facc2e"/><stop offset="100%" stop-color="#f5b800"/></radialGradient>
    <radialGradient id="pb-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#facc2e" stop-opacity=".5"/><stop offset="100%" stop-color="#facc2e" stop-opacity="0"/></radialGradient>
  </defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">Push-button with a pull-down</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">The 10&#8202;k&#8486; holds D2 at a clean LOW until you press.</text>
  <g>
    <rect x="40" y="150" width="144" height="270" rx="14" fill="#2c6fae" stroke="#14181f" stroke-width="2.5"/>
    <rect x="58" y="140" width="44" height="20" rx="4" fill="#b7bcc4" stroke="#14181f" stroke-width="2"/>
    <text x="168" y="175" font-size="11.5" font-weight="900" fill="#fff" text-anchor="end" opacity=".9">OHM &#183; UNO</text>
    <rect x="156" y="185" width="26" height="222" rx="5" fill="#14181f"/>
    <g font-size="11" font-weight="800" fill="#fff" text-anchor="end"><circle cx="176" cy="200" r="5.5" fill="#facc2e"/><text x="150" y="204">5V</text><circle cx="176" cy="250" r="5.5" fill="#facc2e"/><text x="150" y="254">D13</text><circle cx="176" cy="372" r="5.5" fill="#facc2e"/><text x="150" y="376">D2</text><circle cx="176" cy="392" r="5.5" fill="#facc2e"/><text x="150" y="396">GND</text></g>
  </g>
  <g>
    <rect x="250" y="150" width="512" height="270" rx="16" fill="#f6f3ea" stroke="#14181f" stroke-width="2.5"/>
    <path d="M270 178 H744" stroke="#ff6f5e" stroke-width="2.5" opacity=".55"/><text x="262" y="197" font-size="15" font-weight="900" fill="#ff6f5e" text-anchor="end">+</text>
    <rect x="272" y="185" width="470" height="18" fill="url(#pb-h)"/>
    <rect x="272" y="222" width="470" height="52" fill="url(#pb-h)"/>
    <rect x="272" y="288" width="470" height="14" rx="4" fill="#e6e0cf"/>
    <rect x="272" y="316" width="470" height="46" fill="url(#pb-h)"/>
    <path d="M270 388 H744" stroke="#549cf0" stroke-width="2.5" opacity=".55"/><text x="262" y="399" font-size="17" font-weight="900" fill="#549cf0" text-anchor="end">&#8722;</text>
    <rect x="272" y="392" width="470" height="18" fill="url(#pb-h)"/>
  </g>
  <g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M176 200 H300 V186" stroke="#ff6f5e"/>
    <path d="M410 186 V258" stroke="#ff6f5e"/>
    <path d="M176 250 V168 H620 V240" stroke="#6fb519"/>
    <path d="M660 240 V276" stroke="#14181f" stroke-width="4"/>
    <path d="M660 300 V392" stroke="#3e86e8"/>
    <path d="M450 334 V372 H176" stroke="#3e86e8"/>
    <path d="M450 346 H490" stroke="#14181f" stroke-width="4"/>
    <path d="M490 384 V392" stroke="#14181f" stroke-width="4"/>
    <path d="M300 392 H176" stroke="#14181f" stroke-width="4"/>
  </g>
  <g transform="translate(620,240)"><path d="M0 0 H4 M36 0 H40" stroke="#14181f" stroke-width="4" stroke-linecap="round"/><rect x="4" y="-10" width="32" height="20" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="9" y="-10" width="3.5" height="20" fill="#c0392b"/><rect x="14" y="-10" width="3.5" height="20" fill="#c0392b"/><rect x="19" y="-10" width="3.5" height="20" fill="#7c3f00"/><rect x="28" y="-10" width="3.5" height="20" fill="#d4a017"/></g>
  <g transform="translate(660,287)"><circle cx="0" cy="0" r="30" fill="url(#pb-halo)"/><path d="M-14 -1 v-11 a14 14 0 0 1 28 0 v11 z" fill="url(#pb-g)" stroke="#f5b800" stroke-width="2.4"/><rect x="-14" y="-1" width="28" height="5" rx="2" fill="#f5b800"/></g>
  <g transform="translate(490,352)"><rect x="-10" y="0" width="20" height="34" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-10" y="4" width="20" height="3.5" fill="#7c3f00"/><rect x="-10" y="11" width="20" height="3.5" fill="#14181f"/><rect x="-10" y="18" width="20" height="3.5" fill="#e08a1e"/><rect x="-10" y="27" width="20" height="3.5" fill="#d4a017"/></g>
  <g>
    <rect x="392" y="252" width="76" height="84" rx="9" fill="#e7e2d5" stroke="#14181f" stroke-width="2.5"/>
    <rect x="404" y="248" width="8" height="10" rx="2" fill="#8f887a"/><rect x="448" y="248" width="8" height="10" rx="2" fill="#8f887a"/><rect x="404" y="330" width="8" height="10" rx="2" fill="#8f887a"/><rect x="448" y="330" width="8" height="10" rx="2" fill="#8f887a"/>
    <circle cx="430" cy="294" r="18" fill="#ff6f5e" stroke="#14181f" stroke-width="2.5"/><circle cx="424" cy="288" r="6" fill="#fff" opacity=".4"/>
  </g>
  <g fill="#14181f"><circle cx="300" cy="186" r="4"/><circle cx="410" cy="186" r="4"/><circle cx="620" cy="240" r="4"/><circle cx="660" cy="392" r="4"/><circle cx="450" cy="334" r="4"/><circle cx="490" cy="392" r="4"/><circle cx="300" cy="392" r="4"/></g>
  <g font-size="12" font-weight="800">
    <g transform="translate(506,352)"><rect x="0" y="6" width="118" height="24" rx="12" fill="#fff" stroke="#14181f" stroke-width="1.8"/><text x="12" y="22" fill="#14181f">10k&#8486; pull-down</text></g>
    <g transform="translate(600,150)"><rect x="0" y="0" width="150" height="24" rx="12" fill="#fff" stroke="#14181f" stroke-width="1.8"/><text x="75" y="16" fill="#14181f" text-anchor="middle">LED + 220&#8486; on D13</text></g>
  </g>
</svg>`,

  // ────────────────────────────── Potentiometer wiring
  'potentiometer-wiring': `<svg viewBox="0 0 800 470" ${ROOT} role="img" aria-label="Potentiometer outer legs to 5V and ground, wiper to A0, LED with 220 ohm on pin 9.">
  <defs>
    <pattern id="po-h" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="10.5" cy="10.5" r="3.5" fill="#cfc8b6"/><circle cx="10.5" cy="10.5" r="2.3" fill="#efeadd"/></pattern>
    <radialGradient id="po-g" cx="50%" cy="42%" r="58%"><stop offset="0%" stop-color="#ffe37a"/><stop offset="55%" stop-color="#facc2e"/><stop offset="100%" stop-color="#f5b800"/></radialGradient>
    <radialGradient id="po-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#facc2e" stop-opacity=".5"/><stop offset="100%" stop-color="#facc2e" stop-opacity="0"/></radialGradient>
  </defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">A knob the Arduino can read</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">Outer legs bridge 5V and GND; the wiper sends the middle voltage to A0.</text>
  <g>
    <rect x="40" y="150" width="144" height="270" rx="14" fill="#2c6fae" stroke="#14181f" stroke-width="2.5"/>
    <rect x="58" y="140" width="44" height="20" rx="4" fill="#b7bcc4" stroke="#14181f" stroke-width="2"/>
    <text x="168" y="175" font-size="11.5" font-weight="900" fill="#fff" text-anchor="end" opacity=".9">OHM &#183; UNO</text>
    <rect x="156" y="185" width="26" height="222" rx="5" fill="#14181f"/>
    <g font-size="11" font-weight="800" fill="#fff" text-anchor="end"><circle cx="176" cy="200" r="5.5" fill="#facc2e"/><text x="150" y="204">5V</text><circle cx="176" cy="250" r="5.5" fill="#facc2e"/><text x="150" y="254">A0</text><circle cx="176" cy="330" r="5.5" fill="#facc2e"/><text x="150" y="334">D9</text><circle cx="176" cy="392" r="5.5" fill="#facc2e"/><text x="150" y="396">GND</text></g>
  </g>
  <g>
    <rect x="250" y="150" width="512" height="270" rx="16" fill="#f6f3ea" stroke="#14181f" stroke-width="2.5"/>
    <path d="M270 178 H744" stroke="#ff6f5e" stroke-width="2.5" opacity=".55"/><text x="262" y="197" font-size="15" font-weight="900" fill="#ff6f5e" text-anchor="end">+</text>
    <rect x="272" y="185" width="470" height="18" fill="url(#po-h)"/>
    <rect x="272" y="222" width="470" height="52" fill="url(#po-h)"/>
    <rect x="272" y="288" width="470" height="14" rx="4" fill="#e6e0cf"/>
    <rect x="272" y="316" width="470" height="46" fill="url(#po-h)"/>
    <path d="M270 388 H744" stroke="#549cf0" stroke-width="2.5" opacity=".55"/><text x="262" y="399" font-size="17" font-weight="900" fill="#549cf0" text-anchor="end">&#8722;</text>
    <rect x="272" y="392" width="470" height="18" fill="url(#po-h)"/>
  </g>
  <g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M176 200 H300 V186" stroke="#ff6f5e"/>
    <path d="M392 214 V186" stroke="#ff6f5e"/>
    <path d="M440 214 V392" stroke="#3e86e8"/>
    <path d="M416 214 V262 H208 V250 H176" stroke="#6fb519"/>
    <path d="M176 330 H206 V166 H660 V200" stroke="#facc2e"/>
    <path d="M660 234 V276" stroke="#14181f" stroke-width="4"/>
    <path d="M660 300 V392" stroke="#3e86e8"/>
    <path d="M300 392 H176" stroke="#14181f" stroke-width="4"/>
  </g>
  <g>
    <rect x="368" y="150" width="96" height="52" rx="12" fill="#2b6cae" stroke="#14181f" stroke-width="2.5"/>
    <circle cx="416" cy="150" r="20" fill="#3e86e8" stroke="#14181f" stroke-width="2.5"/>
    <path d="M416 150 L416 134" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <rect x="388" y="200" width="8" height="16" rx="2" fill="#8f887a"/><rect x="412" y="200" width="8" height="16" rx="2" fill="#8f887a"/><rect x="436" y="200" width="8" height="16" rx="2" fill="#8f887a"/>
  </g>
  <g transform="translate(660,217)"><rect x="-9" y="0" width="18" height="34" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-9" y="4" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="11" width="18" height="3.5" fill="#c0392b"/><rect x="-9" y="18" width="18" height="3.5" fill="#7c3f00"/><rect x="-9" y="27" width="18" height="3.5" fill="#d4a017"/></g>
  <g transform="translate(660,287)"><circle cx="0" cy="0" r="28" fill="url(#po-halo)"/><path d="M-13 -1 v-11 a13 13 0 0 1 26 0 v11 z" fill="url(#po-g)" stroke="#f5b800" stroke-width="2.3"/><rect x="-13" y="-1" width="26" height="5" rx="2" fill="#f5b800"/></g>
  <g fill="#14181f"><circle cx="300" cy="186" r="4"/><circle cx="392" cy="186" r="4"/><circle cx="440" cy="392" r="4"/><circle cx="660" cy="392" r="4"/><circle cx="300" cy="392" r="4"/></g>
  <g font-size="11.5" font-weight="800">
    <g transform="translate(300,120)"><rect x="0" y="0" width="140" height="24" rx="12" fill="#fff" stroke="#14181f" stroke-width="1.8"/><text x="70" y="16" fill="#14181f" text-anchor="middle">potentiometer (10k&#8486;)</text></g>
    <g transform="translate(228,272)"><rect x="0" y="-12" width="96" height="22" rx="11" fill="#6fb519"/><text x="48" y="4" fill="#fff" text-anchor="middle">wiper &#8594; A0</text></g>
    <g transform="translate(600,150)"><rect x="0" y="0" width="150" height="24" rx="12" fill="#fff" stroke="#14181f" stroke-width="1.8"/><text x="75" y="16" fill="#14181f" text-anchor="middle">LED + 220&#8486; on D9</text></g>
  </g>
</svg>`,

  // ────────────────────────────── Before/after: messy vs finished
  'before-after-alarm': `<svg viewBox="0 0 800 418" ${ROOT} role="img" aria-label="A messy first breadboard attempt beside a clean, finished light-activated alarm.">
  <defs>
    <pattern id="ba2-h" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="3.2" fill="#cfc8b6"/><circle cx="10" cy="10" r="2.1" fill="#efeadd"/></pattern>
  </defs>
  <text x="40" y="44" font-size="26" font-weight="900" fill="#14181f">Everyone starts with a mess</text>
  <text x="40" y="69" font-size="15" font-weight="700" fill="#474d57">Same parts, same goal. The difference is a plan, and a few minutes of tidying.</text>
  <g transform="translate(40,90)">
    <rect x="0" y="0" width="342" height="290" rx="18" fill="#f1eee6" stroke="#ddd6c6" stroke-width="2"/>
    <rect x="18" y="18" width="120" height="26" rx="13" fill="#8d97a3"/><text x="78" y="36" font-size="12.5" font-weight="800" fill="#fff" text-anchor="middle">FIRST TRY</text>
    <rect x="40" y="86" width="262" height="130" rx="12" fill="#f6f3ea" stroke="#c9c2b1" stroke-width="2"/>
    <rect x="54" y="100" width="234" height="42" fill="url(#ba2-h)"/>
    <rect x="54" y="160" width="234" height="42" fill="url(#ba2-h)"/>
    <g fill="none" stroke-width="4.5" stroke-linecap="round">
      <path d="M70 120 C140 60 210 250 300 150" stroke="#ff6f5e" opacity=".9"/>
      <path d="M90 200 C160 120 120 40 250 110" stroke="#3e86e8" opacity=".9"/>
      <path d="M60 170 C180 210 210 90 290 190" stroke="#6fb519" opacity=".9"/>
      <path d="M110 90 C120 180 240 200 280 120" stroke="#facc2e" opacity=".95"/>
      <path d="M74 210 C130 250 200 60 240 210" stroke="#9d5cff" opacity=".8"/>
    </g>
    <g transform="translate(150,150) rotate(24)"><rect x="-22" y="-9" width="44" height="18" rx="7" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-14" y="-9" width="4" height="18" fill="#c0392b"/><rect x="-8" y="-9" width="4" height="18" fill="#7c3f00"/></g>
    <g transform="translate(250,60)"><rect x="0" y="0" width="58" height="30" rx="15" fill="#fff" stroke="#8d97a3" stroke-width="2"/><text x="29" y="21" font-size="16" font-weight="900" fill="#8d97a3" text-anchor="middle">?!</text></g>
    <text x="171" y="256" font-size="13.5" font-weight="800" fill="#6b7280" text-anchor="middle">wires everywhere, nothing beeps</text>
  </g>
  <g transform="translate(418,90)">
    <rect x="0" y="0" width="342" height="290" rx="18" fill="#f4fbea" stroke="#c6e79a" stroke-width="2"/>
    <rect x="18" y="18" width="118" height="26" rx="13" fill="#6fb519"/><text x="77" y="36" font-size="12.5" font-weight="800" fill="#fff" text-anchor="middle">FINISHED</text>
    <g transform="translate(300,32)"><circle r="17" fill="#6fb519" stroke="#14181f" stroke-width="2.5"/><path d="M-7 0 L-2 6 L8 -6" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    <rect x="40" y="86" width="262" height="130" rx="12" fill="#f6f3ea" stroke="#c9c2b1" stroke-width="2"/>
    <path d="M54 98 H288" stroke="#ff6f5e" stroke-width="2" opacity=".5"/><path d="M54 206 H288" stroke="#549cf0" stroke-width="2" opacity=".5"/>
    <rect x="54" y="104" width="234" height="34" fill="url(#ba2-h)"/>
    <rect x="54" y="166" width="234" height="34" fill="url(#ba2-h)"/>
    <g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M78 120 V151" stroke="#ff6f5e"/><path d="M78 151 V183" stroke="#14181f" stroke-width="4"/><path d="M244 120 V183" stroke="#3e86e8"/></g>
    <g transform="translate(120,151)"><circle r="15" fill="#fbe9a6" stroke="#14181f" stroke-width="2.2"/><path d="M-7 6 L-2 6 L0 -3 L3 6 L6 -1" fill="none" stroke="#14181f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g transform="translate(180,151)"><rect x="-20" y="-8" width="40" height="16" rx="6" fill="#f0ddb8" stroke="#b98f52" stroke-width="2"/><rect x="-12" y="-8" width="3.5" height="16" fill="#7c3f00"/><rect x="-6" y="-8" width="3.5" height="16" fill="#14181f"/><rect x="0" y="-8" width="3.5" height="16" fill="#e08a1e"/></g>
    <g transform="translate(244,151)"><circle r="26" fill="#facc2e" opacity=".18"/><circle r="15" fill="#20242c" stroke="#14181f" stroke-width="2.2"/><circle r="5" fill="#14181f"/><path d="M20 -8 q7 8 0 16 M26 -14 q11 14 0 28" stroke="#f5b800" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
    <text x="171" y="256" font-size="13.5" font-weight="800" fill="#4d7c0f" text-anchor="middle">tidy, and it actually sounds</text>
  </g>
</svg>`,
};
