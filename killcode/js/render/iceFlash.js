// ══════════════════════════════════════════════
// kill.code — render/iceFlash.js
// Pulses the affected board element + the latest Corp Activity log entry
// when an ICE effect lands. Each fx.* call emits 'effects.applied' which
// triggers a synchronous full re-render of the board — so we defer the
// pulse-class addition to the next tick so it sticks on the freshly painted
// DOM rather than the about-to-be-destroyed one.
// ══════════════════════════════════════════════

import { bus } from '../bus.js';

const PEG_PULSE_MS = 1400;
const LOG_PULSE_MS = 1400;

function flash(el, cls, dur){
  if(!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;             // force reflow so re-adding the class re-triggers the animation
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), dur);
}

function activeRowSlot(slotIndex){
  const peg = document.querySelector(`.row.active .peg:nth-of-type(${slotIndex + 1})`);
  return peg ?? null;
}

function pastRow(rowIndex){
  // rowIndex is the index into state.rows. Row DOM order matches state order;
  // .row.active is the first non-past row, so we grab board rows by position.
  const rows = document.querySelectorAll('.board .row');
  return rows[rowIndex] ?? null;
}

function pastRowPeg(rowIndex, slot){
  const row = pastRow(rowIndex);
  if(!row) return null;
  const pegs = row.querySelectorAll('.peg');
  return pegs[slot] ?? null;
}

function pastRowFeedback(rowIndex){
  const row = pastRow(rowIndex);
  return row?.querySelector('.fb') ?? null;
}

function latestLogEntry(){
  const entries = document.querySelectorAll('#ice-log .ice-log-entry');
  return entries[entries.length - 1] ?? null;
}

function defer(fn){ setTimeout(fn, 0); }

export function wireIceFlashToBus(){
  // ── Board pulses ──
  // Active-row peg (LOCK / BAD DATA)
  bus.on('ice.lock.applied',    ({ slotIndex }) =>
    defer(() => flash(activeRowSlot(slotIndex), 'ice-pulse', PEG_PULSE_MS)));
  bus.on('ice.baddata.applied', ({ slotIndex }) =>
    defer(() => flash(activeRowSlot(slotIndex), 'ice-pulse', PEG_PULSE_MS)));

  // Past-row feedback area (BLACKOUT hits the last submitted row;
  // DISAPPEARING PEG hits a historical row chosen by the effect).
  bus.on('ice.blackout.applied',  ({ rowIndex }) =>
    defer(() => flash(pastRowFeedback(rowIndex), 'ice-pulse', PEG_PULSE_MS)));
  bus.on('ice.disappear.applied', ({ rowIndex }) =>
    defer(() => flash(pastRowFeedback(rowIndex), 'ice-pulse', PEG_PULSE_MS)));

  // Past-row entire row (LOST CONTEXT)
  bus.on('ice.lostcontext.applied', ({ rowIndex }) =>
    defer(() => flash(pastRow(rowIndex), 'ice-pulse', PEG_PULSE_MS)));

  // Past-row single peg (BAD SECTOR)
  bus.on('ice.badsector.applied', ({ rowIndex, slot }) =>
    defer(() => flash(pastRowPeg(rowIndex, slot), 'ice-pulse', PEG_PULSE_MS)));

  // Resource attacks — no specific tile, pulse a relevant chrome element
  bus.on('ice.purge.applied',    () =>
    defer(() => flash(document.getElementById('queue-lbl'), 'ice-pulse', PEG_PULSE_MS)));
  bus.on('ice.lockdown.applied', () =>
    defer(() => flash(document.getElementById('status'),   'ice-pulse', PEG_PULSE_MS)));

  // ── Corp Activity log pulse ──
  // ice.logged fires from inside fx.addIceLog, after iceLog.js has appended
  // the entry. Defer so the append is fully resolved before we flash it.
  bus.on('ice.logged', () =>
    defer(() => flash(latestLogEntry(), 'ice-log-pulse', LOG_PULSE_MS)));
}
