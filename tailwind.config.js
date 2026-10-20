/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}"
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f5f1ea',
        'bg-2': '#efeae0',
        fg: '#1a1816',
        muted: '#6b635a',
        'muted-2': '#6f675e',
        hair: '#e1dacb',
        'hair-2': '#d6cebd',
        accent: '#a44224',
        'accent-ink': '#7a3318',
        'accent-wash': 'rgba(164, 66, 36, 0.04)',
        'surface-page': '#f5f1ea',
        'surface-alt': '#efeae0'
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace']
      }
    }
  },
  plugins: []
};
