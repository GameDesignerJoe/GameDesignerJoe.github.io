// rival-lock — a rival hacker breaks in on round 3 and locks one slot to a wrong key.
// Demonstrates a scene mutating mechanics. Disabled by default.

import { pick, randInt } from '../../rng.js';

export default {
  id: 'rival-lock',
  trigger: {
    event: 'turn.started',
    once:  true,
    when:  ({ rowIndex }, state) => rowIndex === 2 && !state.flags.rivalLocked,
  },
  dialogue: [
    { speaker: 'rival', lines: ["Cute attempt. Watch this."] },
    { speaker: 'rival', lines: ["I'm planting a decoy. Try working around <em>that</em>."] },
  ],
  effects(state, fx){
    const free = [0,1,2,3].filter(i => !state.locked[i]);
    if(!free.length){ fx.setFlag('rivalLocked'); return; }
    const slot  = pick(free);
    const wrong = (state.secret[slot] + 1 + randInt(5)) % 6;
    fx.lockSlot(slot, wrong, 'scene:rival-lock');
    fx.addIntel('!', `<strong style="color:var(--red)">RIVAL</strong> — Slot ${slot + 1} jammed with decoy signal.`);
    fx.setFlag('rivalLocked');
  },
};
