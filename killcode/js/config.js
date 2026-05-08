// ══════════════════════════════════════════════
// kill.code — config.js
// Constants only. No imports, no logic.
// ══════════════════════════════════════════════

// Colour / key pool. K[i] is colour index i.
export const K = [
  { sym:"◈", fg:"#c9a84c", bg:"#2e2200", name:"AMBER"   },
  { sym:"⊗", fg:"#e04848", bg:"#280000", name:"CRIMSON" },
  { sym:"⬡", fg:"#b090e0", bg:"#1a0e30", name:"VIOLET"  },
  { sym:"⊕", fg:"#52c888", bg:"#001e10", name:"JADE"    },
  { sym:"▲", fg:"#4aa8ef", bg:"#001428", name:"COBALT"  },
  { sym:"⚡", fg:"#e09050", bg:"#261200", name:"COPPER"  },
];

// Starting deck composition. Card ids are looked up in cards/_registry.js.
export const DECK_SRC = ['mole','mole','ghost','ghost','ping','probe','buffer','root','root'];

// Game shape constants.
export const SECRET_LEN        = 4;
export const MAX_ROWS_DEFAULT  = 5;

// Per-colour SFX pitches, indexed by colour index in K.
export const PITCH = [880, 740, 660, 1000, 820, 600];

// localStorage keys, namespaced.
export const STORAGE_KEYS = {
  sfxMute:  'breach_mute',
  bgmMute:  'breach_bgm_mute',
  sfxVol:   'breach_sfx_vol',
  bgmVol:   'breach_bgm_vol',
  stats:    'breach2',
};
