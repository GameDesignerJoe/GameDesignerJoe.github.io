// ══════════════════════════════════════════════
// kill.code — effects.js
// The `fx` API. Cards and narrative scenes mutate game state ONLY through
// these functions. Each call may also emit a bus event so render/audio/
// narrative can react. `source` is a free-form tag like 'card:root',
// 'scene:rival-lock', so listeners can filter.
// ══════════════════════════════════════════════

import { state } from './state.js';
import { bus }   from './bus.js';
import { K }    from './config.js';

function applied(name, args){ bus.emit('effects.applied', { name, args }); }

export const fx = {
  // ── Intel ────────────────────────────────────
  addIntel(symbol, html){
    bus.emit('intel.added', { symbol, html });
  },

  // ── Slot / lock ──────────────────────────────
  lockSlot(slot, ci, source = 'effect'){
    state.cur[slot]    = ci;
    state.locked[slot] = true;
    state.rooted[slot] = ci;
    bus.emit('slot.locked', { slot, ci, source });
    applied('lockSlot', { slot, ci, source });
  },
  unlockSlot(slot, source = 'effect'){
    state.locked[slot] = false;
    state.rooted[slot] = null;
    applied('unlockSlot', { slot, source });
  },

  // ── Colour pool ──────────────────────────────
  eliminateColour(ci, source = 'effect'){
    if(!state.eliminated.includes(ci)) state.eliminated.push(ci);
    bus.emit('colour.eliminated', { ci, source });
    applied('eliminateColour', { ci, source });
  },
  revealColour(ci, source = 'effect'){
    const c = K[ci];
    fx.addIntel(c.sym, `${source.toUpperCase()} — <strong style="color:${c.fg}">${c.name}</strong> is present in the target hash.`);
    applied('revealColour', { ci, source });
  },

  // ── Hand / deck ──────────────────────────────
  addCardToHand(cardId, source = 'effect'){
    state.hand.push(cardId);
    applied('addCardToHand', { cardId, source });
  },
  removeCardFromHand(handIndex, source = 'effect'){
    state.hand.splice(handIndex, 1);
    applied('removeCardFromHand', { handIndex, source });
  },
  swapHandCard(handIndex, newCardId, source = 'effect'){
    state.hand[handIndex] = newCardId;
    applied('swapHandCard', { handIndex, newCardId, source });
  },
  shuffleIntoDeck(cardId, source = 'effect'){
    state.deck.push(cardId);
    // Light shuffle so the new card doesn't always land on top.
    for(let i = state.deck.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    applied('shuffleIntoDeck', { cardId, source });
  },

  // ── Window ───────────────────────────────────
  grantBufferRow(source = 'effect'){
    state.maxRows++;
    applied('grantBufferRow', { source });
  },

  // ── Secret (powerful — narrative-only) ───────
  setSecretSlot(slot, ci, source = 'effect'){
    const from = state.secret[slot];
    state.secret[slot] = ci;
    bus.emit('secret.changed', { slot, from, to: ci, source });
    applied('setSecretSlot', { slot, ci, source });
  },

  // ── Narrative scratch flags ──────────────────
  setFlag(name, value = true){
    state.flags[name] = value;
    applied('setFlag', { name, value });
  },
};
