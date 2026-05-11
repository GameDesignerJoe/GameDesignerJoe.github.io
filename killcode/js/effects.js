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

  // ── ICE / Corp counterplay ───────────────────
  // LOCK ICE — force a slot from the last guess into the current row.
  applyCorpLock(slotIndex, colourIndex){
    if(state.locked[slotIndex]) return;             // never overwrite a ROOT-confirmed tile
    state.cur[slotIndex]        = colourIndex;
    state.corpLocked[slotIndex] = true;
    bus.emit('ice.lock.applied', { slotIndex, colourIndex });
    applied('applyCorpLock', { slotIndex, colourIndex });
  },

  // BAD DATA ICE — block a slot from input this turn.
  applyBadData(slotIndex){
    if(!state.badDataSlots.includes(slotIndex)) state.badDataSlots.push(slotIndex);
    bus.emit('ice.baddata.applied', { slotIndex });
    applied('applyBadData', { slotIndex });
  },

  // BLACKOUT ICE — hide one feedback peg on the row just submitted.
  applyBlackout(){
    if(!state.rows.length) return;
    const row = state.rows[state.rows.length - 1];
    row.hiddenFeedback = (row.hiddenFeedback ?? 0) + 1;
    bus.emit('ice.blackout.applied', { rowIndex: state.rows.length - 1 });
    applied('applyBlackout', {});
  },

  // DISAPPEARING PEG ICE — remove a feedback peg from a previous visible row.
  applyDisappearingPeg(){
    const idx = state.rows.findLastIndex(r => !r.hidden && (r.hiddenFeedback ?? 0) < 4);
    if(idx < 0) return;
    state.rows[idx].hiddenFeedback = (state.rows[idx].hiddenFeedback ?? 0) + 1;
    bus.emit('ice.disappear.applied', { rowIndex: idx });
    applied('applyDisappearingPeg', { rowIndex: idx });
  },

  // PURGE ICE — burn the top card from the player's draw queue.
  applyPurge(){
    if(!state.deck.length) return;
    const purged = state.deck.pop();
    bus.emit('ice.purge.applied', { purged });
    applied('applyPurge', { purged });
  },

  // LOCKDOWN ICE — remove one cycle from the board.
  applyLockdown(){
    if(state.maxRows > state.rows.length + 1){
      state.maxRows--;
      bus.emit('ice.lockdown.applied', {});
    }
    applied('applyLockdown', {});
  },

  // LOST CONTEXT ICE — hide the oldest visible guess row.
  applyLostContext(){
    const idx = state.rows.findIndex(r => !r.hidden);
    if(idx < 0) return;
    state.rows[idx].hidden = true;
    bus.emit('ice.lostcontext.applied', { rowIndex: idx });
    applied('applyLostContext', { rowIndex: idx });
  },

  // BAD SECTOR ICE — black out one tile in a random previous visible row.
  applyBadSector(){
    const candidates = state.rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !r.hidden);
    if(!candidates.length) return;
    const { r, i } = candidates[Math.floor(Math.random() * candidates.length)];
    if(!r.obscuredSlots) r.obscuredSlots = [];
    const available = [0,1,2,3].filter(s => !r.obscuredSlots.includes(s));
    if(!available.length) return;
    const slot = available[Math.floor(Math.random() * available.length)];
    r.obscuredSlots.push(slot);
    bus.emit('ice.badsector.applied', { rowIndex: i, slot });
    applied('applyBadSector', { rowIndex: i, slot });
  },

  // Add a line to the Corp log. Emits 'ice.logged' for incremental rendering.
  addIceLog(id, message){
    const entry = { turn: state.rows.length + 1, id, message };
    state.iceLog.push(entry);
    bus.emit('ice.logged', entry);
    applied('addIceLog', { id, message });
  },
};
