import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wood: '#3a241a',
        'wood-light': '#5a3a2a',
        brass: '#b08d57',
        'brass-dim': '#7a6140',
        'board-navy': '#0e1a2b',
        'dot-green': '#34d399',
        'dash-amber': '#f5b041',
        'error-red': '#ef4444',
      },
      fontFamily: {
        nameplate: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
