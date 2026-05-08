// ══════════════════════════════════════════════
// kill.code — bus.js
// Tiny pub/sub event bus. Engine emits, render + audio + narrative listen.
// ══════════════════════════════════════════════

const _h = new Map();

export const bus = {
  on(ev, fn){
    if(!_h.has(ev)) _h.set(ev, []);
    _h.get(ev).push(fn);
  },
  off(ev, fn){
    const a = _h.get(ev);
    if(a) _h.set(ev, a.filter(f => f !== fn));
  },
  emit(ev, payload){
    const a = _h.get(ev);
    if(a) a.slice().forEach(fn => fn(payload));
  },
};
