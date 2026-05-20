import type { Config } from 'tailwindcss';

const channel = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: channel('--bg'),
        surface: channel('--surface'),
        'surface-2': channel('--surface-2'),
        'surface-3': channel('--surface-3'),
        border: channel('--border'),
        'border-strong': channel('--border-strong'),
        text: channel('--text'),
        'text-2': channel('--text-2'),
        'text-3': channel('--text-3'),
        accent: channel('--accent'),
        'accent-dim': channel('--accent-dim'),
        success: channel('--success'),
        indie: channel('--indie'),
        'indie-b': channel('--indie-b'),
        'indie-t': channel('--indie-t'),
        mid: channel('--mid'),
        'mid-b': channel('--mid-b'),
        'mid-t': channel('--mid-t'),
        aaa: channel('--aaa'),
        'aaa-b': channel('--aaa-b'),
        'aaa-t': channel('--aaa-t'),
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      fontFamily: {
        mono: ['SFMono-Regular', 'Consolas', 'monospace'],
      },
      maxWidth: {
        wizard: '740px',
        output: '960px',
      },
    },
  },
  plugins: [],
};

export default config;
