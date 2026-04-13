// Color theme definitions. Each theme defines a full palette of CSS custom
// properties. The DOM is updated via inline style on :root, so themes also
// apply cleanly to the canvas export (which reads these colors via helpers).

export const THEMES = {
  midnight: {
    name: 'Midnight',
    description: 'Deep navy with pink accents',
    colors: {
      bg: '#1a1a2e',
      surface: '#16213e',
      text: '#e0e0e0',
      muted: '#8888aa',
      accent: '#e94560',
      'root-color': '#e94560',
      'note-color': '#0f9b8e',
      'dot-text': '#ffffff',
      'fret-wire': '#555555',
      'string-color': '#c0a060',
      'nut-color': '#dddddd',
      inlay: '#ffffff',
      'btn-bg': '#222233',
      'btn-hover': '#333344',
    },
  },
  slate: {
    name: 'Slate',
    description: 'Minimal dark grayscale',
    colors: {
      bg: '#1e1e1e',
      surface: '#2a2a2a',
      text: '#e5e5e5',
      muted: '#909090',
      accent: '#6aa9ff',
      'root-color': '#d94c5a',
      'note-color': '#4a9a8c',
      'dot-text': '#ffffff',
      'fret-wire': '#5a5a5a',
      'string-color': '#a89974',
      'nut-color': '#d0d0d0',
      inlay: '#ffffff',
      'btn-bg': '#333333',
      'btn-hover': '#444444',
    },
  },
  light: {
    name: 'Light',
    description: 'Clean daylight look — great for print',
    colors: {
      bg: '#fafaf7',
      surface: '#ffffff',
      text: '#2c2a26',
      muted: '#6e6a62',
      accent: '#c64747',
      'root-color': '#c64747',
      'note-color': '#2a7f6f',
      'dot-text': '#ffffff',
      'fret-wire': '#999999',
      'string-color': '#a8895a',
      'nut-color': '#333333',
      inlay: '#4a4a4a',
      'btn-bg': '#f0ede6',
      'btn-hover': '#e5e1d8',
    },
  },
  sepia: {
    name: 'Sepia',
    description: 'Warm paper, easy on the eyes',
    colors: {
      bg: '#f4ecd8',
      surface: '#ede0c4',
      text: '#3a2f20',
      muted: '#7a6a4e',
      accent: '#8b3a2b',
      'root-color': '#8b3a2b',
      'note-color': '#2f6a4a',
      'dot-text': '#f4ecd8',
      'fret-wire': '#8a7454',
      'string-color': '#8c6f3a',
      'nut-color': '#2a1f10',
      inlay: '#3a2f20',
      'btn-bg': '#e0d0a8',
      'btn-hover': '#d4c19a',
    },
  },
  contrast: {
    name: 'High Contrast',
    description: 'Bold black + bright colors',
    colors: {
      bg: '#000000',
      surface: '#1a1a1a',
      text: '#ffffff',
      muted: '#cccccc',
      accent: '#ffeb3b',
      'root-color': '#ff3030',
      'note-color': '#00e5ff',
      'dot-text': '#000000',
      'fret-wire': '#aaaaaa',
      'string-color': '#ffcc00',
      'nut-color': '#ffffff',
      inlay: '#ffffff',
      'btn-bg': '#222222',
      'btn-hover': '#333333',
    },
  },
  blueprint: {
    name: 'Blueprint',
    description: 'Technical navy with warm accents',
    colors: {
      bg: '#0d2847',
      surface: '#133661',
      text: '#e8f0fa',
      muted: '#8ab0d0',
      accent: '#ff9f40',
      'root-color': '#ff6b6b',
      'note-color': '#40c0a0',
      'dot-text': '#ffffff',
      'fret-wire': '#4a7ba0',
      'string-color': '#dde8f5',
      'nut-color': '#ffffff',
      inlay: '#a8c8e8',
      'btn-bg': '#1a4270',
      'btn-hover': '#245490',
    },
  },
};

export const DEFAULT_THEME = 'midnight';

export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME];
}

// Apply a theme by setting CSS custom properties on the root element.
export function applyTheme(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value);
  }
  // Set a data attribute too so CSS can conditionally target themes if needed
  document.body.setAttribute('data-theme', themeId);
}

// Resolve a color from the current theme (for canvas rendering).
export function themeColor(themeId, key) {
  return getTheme(themeId).colors[key];
}
