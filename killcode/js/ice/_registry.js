// ══════════════════════════════════════════════
// kill.code — ice/_registry.js
// The ONE place adding a new ICE card requires touching besides the new file.
// To add an ICE card: create ice/<id>.js with a default export, then import +
// add it here (and optionally include the id in ICE_DECK_SRC in config.js).
// ══════════════════════════════════════════════

import lock        from './lock.js';
import badData     from './bad-data.js';
import blackout    from './blackout.js';
import disappear   from './disappear.js';
import purge       from './purge.js';
import lockdown    from './lockdown.js';
import lostContext from './lost-context.js';
import badSector   from './bad-sector.js';

export const ICE_CARDS = {
  'ice-lock':         lock,
  'ice-bad-data':     badData,
  'ice-blackout':     blackout,
  'ice-disappear':    disappear,
  'ice-purge':        purge,
  'ice-lockdown':     lockdown,
  'ice-lost-context': lostContext,
  'ice-bad-sector':   badSector,
};

export const getIce = (id) => ICE_CARDS[id];
