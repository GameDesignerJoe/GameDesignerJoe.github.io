// Word lists per the GDD, lightly de-duplicated. Tier 1 uses common-letter
// alphabet (E, T, A, N, I, M, O, S, R, H, D, L, U). Tier 2 adds W, G, K, C,
// F, B. Tier 3 adds V, P, Y, X, Q, J, Z. Cross-tier dups are tolerated.

export const WORDS_TIER_1 = [
  'IT', 'IS', 'AT', 'AN', 'AS', 'AM', 'ON', 'OR', 'IN', 'TO',
  'SO', 'NO', 'ME', 'BE', 'WE', 'HE', 'US', 'UP', 'OH', 'AH',
  'IF', 'OF', 'HI', 'SEA', 'TEN', 'TEA', 'ATE', 'EAT', 'ICE', 'AGE',
  'ARM', 'ART', 'EAR', 'EYE', 'END', 'INK', 'HAT', 'HIT', 'OAT', 'NET',
  'NOT', 'NOW', 'ONE', 'OUR', 'OUT', 'MAN', 'MEN', 'MAP', 'MAT', 'SUN',
  'RUN', 'RED', 'RAT', 'RID', 'RIM', 'SIT', 'SET', 'SON', 'SIR', 'SAT',
  'SAD', 'SAW', 'SEE', 'SIN', 'STAR', 'MOON', 'SOON', 'HEAT', 'EAST',
  'NEST', 'STEM', 'MEAN', 'NAME', 'SALT', 'HEAD', 'LAND', 'HAND', 'LAST',
  'TEAM', 'LETTER',
];

export const WORDS_TIER_2 = [
  'DOG', 'CAT', 'CAR', 'BIG', 'BAD', 'BOX', 'BUG', 'BUS', 'BED', 'BEG',
  'BET', 'BIT', 'GUM', 'GAS', 'GOD', 'GOT', 'GAP', 'GAB', 'CUP', 'COW',
  'CAN', 'CAB', 'COD', 'COG', 'CUE', 'FUN', 'FED', 'FAN', 'FIG', 'FAT',
  'FIT', 'FAR', 'FEW', 'KID', 'KIT', 'KEY', 'KING', 'DUCK', 'CAKE', 'BAKE',
  'LAKE', 'MAKE', 'TAKE', 'RIDE', 'WIDE', 'SIDE', 'HIDE', 'HOME', 'GAME',
  'FAME', 'ROOM', 'FOOD', 'GOOD', 'WOOD', 'WORK', 'WORD', 'BIRD', 'FACT',
  'FAST', 'CAST', 'COST', 'COLD', 'GOLD', 'BOLD', 'SAND', 'BAND', 'SHIP',
  'FISH', 'FIRE', 'CLOCK', 'CHAIR', 'BREAD',
];

export const WORDS_TIER_3 = [
  'YES', 'WHY', 'YOU', 'SKY', 'JAR', 'JAM', 'JOY', 'JOB', 'JET', 'ZIP',
  'ZOO', 'BOY', 'TOY', 'PIE', 'PAY', 'PAL', 'PEN', 'PUT', 'POT', 'PIT',
  'PET', 'PAN', 'PUP', 'VAN', 'VET', 'VIA', 'FOX', 'TAX', 'WAX', 'SIX',
  'JUICE', 'JAZZ', 'BUZZ', 'ZEBRA', 'VIVID', 'FUZZY', 'PUZZLE', 'QUICK',
  'QUEEN', 'QUIET', 'EXACT', 'EQUIP', 'EXTRA', 'MAYBE', 'HAPPY', 'PUPPY',
  'JACKET', 'PYRAMID',
];

export const ALL_WORDS = [
  ...WORDS_TIER_1,
  ...WORDS_TIER_2,
  ...WORDS_TIER_3,
];

// Fisher–Yates in-place shuffle, returns a new array.
export function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
