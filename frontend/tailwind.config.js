/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ohmlet: {
          gold: '#facc2e',
          'gold-deep': '#f5b800',
          'gold-soft': '#fff6d6',
          // The plate under a gold surface, and readable text on one. Ink on
          // gold is a hazard stripe; gold-text is not.
          'gold-plate': '#c99a00',
          'gold-text': '#8f6d00',
          ink: '#14181f',
          'ink-soft': '#474d57',
          'ink-mute': '#a8adb6',
          red: '#ff6f5e',
          blue: '#549cf0',
          'blue-deep': '#3e86e8',
          'blue-soft': '#eaf2fe',
          green: '#84cc30',
          'green-deep': '#6fb519',
          cream: '#faf8f0',
          line: '#ece7db',
        },
      },
      boxShadow: {
        press: '0 5px 0 #14181f',
        'press-sm': '0 3px 0 #14181f',
        'press-gold': '0 5px 0 #f5b800',
        soft: '0 2px 4px rgba(20,24,31,0.04), 0 8px 24px rgba(20,24,31,0.06)',
      },
    },
  },
  plugins: [],
};
