// The game's one accent colour. Yellow marks what deserves the player's attention:
// the explorer and their camp now, and later anything else worth noticing.
export const SIGNAL = {
  lit: '#e2a53b',      // sunlit face of yellow canvas / cloth
  base: '#c98a2c',     // mid tone
  shadow: '#8f5f1f',   // side away from the light
  deep: '#5e3d14',     // creases, the darkest folds
  glow: '#ffc96b',     // light spilling from inside the tent at night
};

// The four members of the party each wear their own bright coat (Joe): yellow, orange, red, pink,
// in the order they set out. (The tents stay signal yellow.) Same four tones as SIGNAL.
export const COATS = [
  { name: 'yellow', lit: SIGNAL.lit, shadow: SIGNAL.shadow, deep: SIGNAL.deep },
  { name: 'orange', lit: '#de7c2f', shadow: '#9b4f1b', deep: '#5e2e0f' },
  { name: 'red',    lit: '#c8463b', shadow: '#882b24', deep: '#521814' },
  { name: 'pink',   lit: '#d97393', shadow: '#984a63', deep: '#5c2a3b' },
];
