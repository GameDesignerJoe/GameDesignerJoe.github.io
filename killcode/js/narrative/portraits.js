// ══════════════════════════════════════════════
// kill.code — narrative/portraits.js
// Character lookup table. Add a new character = add a row here.
// Keep this lean — full character sheets are not needed yet.
// ══════════════════════════════════════════════

export const PORTRAITS = {
  handler: { name: 'Handler', glyph: '◆', colour: 'var(--neon)'  },
  rival:   { name: 'Rival',   glyph: '⚠', colour: 'var(--red)'   },
  self:    { name: '//',      glyph: '·', colour: 'var(--text2)' },
};

export const getPortrait = (id) => PORTRAITS[id] ?? PORTRAITS.self;
