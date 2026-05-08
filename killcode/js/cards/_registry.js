// ══════════════════════════════════════════════
// kill.code — cards/_registry.js
// The ONE place adding a new card requires touching besides the new card file.
// To add a card: create cards/<id>.js with a default export, then import + add
// it here. (Optionally include the id in DECK_SRC in config.js.)
// ══════════════════════════════════════════════

import mole   from './mole.js';
import ghost  from './ghost.js';
import ping   from './ping.js';
import probe  from './probe.js';
import buffer from './buffer.js';
import root   from './root.js';

export const CARDS = { mole, ghost, ping, probe, buffer, root };
export const getCard = (id) => CARDS[id];
