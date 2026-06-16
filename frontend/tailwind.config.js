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
          ink: '#14201e',
          'ink-soft': '#46514e',
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
        press: '0 5px 0 #14201e',
        'press-sm': '0 3px 0 #14201e',
        'press-gold': '0 5px 0 #f5b800',
        soft: '0 2px 4px rgba(20,32,30,0.04), 0 8px 24px rgba(20,32,30,0.06)',
      },
    },
  },
  plugins: [],
};
