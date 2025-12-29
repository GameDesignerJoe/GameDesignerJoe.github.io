/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          dark: '#1a1f2e',
          gray: '#2a3342',
          blue: '#1b2838',
          accent: '#66c0f4',
          gold: '#d4af37',
          bronze: '#cd7f32',
        },
      },
    },
  },
  plugins: [],
};
