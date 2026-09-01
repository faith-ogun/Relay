/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Bound to CSS channel variables, not literals, so the whole palette is
      // theme-swappable from styles.css without touching a component. The
      // `<alpha-value>` placeholder is what keeps `text-ohmlet-ink/70` working;
      // a plain `var(--x)` here would silently render those at full opacity.
      colors: {
        ohmlet: {
          gold: 'rgb(var(--ohmlet-gold-rgb) / <alpha-value>)',
          'gold-deep': 'rgb(var(--ohmlet-gold-deep-rgb) / <alpha-value>)',
          'gold-soft': 'rgb(var(--ohmlet-gold-soft-rgb) / <alpha-value>)',
          // The plate under a gold surface, and readable text on one. Ink on
          // gold is a hazard stripe; gold-text is not.
          'gold-plate': 'rgb(var(--ohmlet-gold-plate-rgb) / <alpha-value>)',
          'gold-text': 'rgb(var(--ohmlet-gold-text-rgb) / <alpha-value>)',
          ink: 'rgb(var(--ohmlet-ink-rgb) / <alpha-value>)',
          'ink-soft': 'rgb(var(--ohmlet-ink-soft-rgb) / <alpha-value>)',
          'ink-mute': 'rgb(var(--ohmlet-ink-mute-rgb) / <alpha-value>)',
          red: 'rgb(var(--ohmlet-red-rgb) / <alpha-value>)',
          blue: 'rgb(var(--ohmlet-blue-rgb) / <alpha-value>)',
          'blue-deep': 'rgb(var(--ohmlet-blue-deep-rgb) / <alpha-value>)',
          'blue-soft': 'rgb(var(--ohmlet-blue-soft-rgb) / <alpha-value>)',
          green: 'rgb(var(--ohmlet-green-rgb) / <alpha-value>)',
          'green-deep': 'rgb(var(--ohmlet-green-deep-rgb) / <alpha-value>)',
          cream: 'rgb(var(--ohmlet-cream-rgb) / <alpha-value>)',
          line: 'rgb(var(--ohmlet-line-rgb) / <alpha-value>)',
          canvas: 'rgb(var(--ohmlet-canvas-rgb) / <alpha-value>)',
          surface: 'rgb(var(--ohmlet-surface-rgb) / <alpha-value>)',
          'on-ink': 'rgb(var(--ohmlet-on-ink-rgb) / <alpha-value>)',
          panel: 'rgb(var(--ohmlet-panel-rgb) / <alpha-value>)',
          'tint-red': 'rgb(var(--ohmlet-tint-red-rgb) / <alpha-value>)',
          'tint-green': 'rgb(var(--ohmlet-tint-green-rgb) / <alpha-value>)',
          'tint-neutral': 'rgb(var(--ohmlet-tint-neutral-rgb) / <alpha-value>)',
          // What `text-white` actually meant, split three ways. See the long
          // note in styles.css: `on-ink` flips with the ink under it, `slab` is
          // a panel that stays dark in every theme, `on-dark` is the foreground
          // for anything that does, and `scrim` is the wash beneath it.
          'on-ink': 'rgb(var(--ohmlet-on-ink-rgb) / <alpha-value>)',
          slab: 'rgb(var(--ohmlet-slab-rgb) / <alpha-value>)',
          'on-dark': 'rgb(var(--ohmlet-on-dark-rgb) / <alpha-value>)',
          scrim: 'rgb(var(--ohmlet-scrim-rgb) / <alpha-value>)',
        },
      },
      boxShadow: {
        // The pressable plate follows the theme too: a hard ink shadow is
        // invisible against a dark page, which would flatten every button in
        // the app the moment dark mode was switched on.
        press: '0 5px 0 rgb(var(--ohmlet-plate-rgb))',
        'press-sm': '0 3px 0 rgb(var(--ohmlet-plate-rgb))',
        'press-gold': '0 5px 0 rgb(var(--ohmlet-gold-deep-rgb))',
        soft: '0 2px 4px rgb(var(--ohmlet-ink-rgb) / 0.04), 0 8px 24px rgb(var(--ohmlet-ink-rgb) / 0.06)',
      },
    },
  },
  plugins: [],
};
