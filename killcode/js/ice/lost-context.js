// LOST CONTEXT ICE — Corp wipes the player's oldest entry from the record.
export default {
  id:   'ice-lost-context',
  name: 'LOST CONTEXT',
  onResolve(state, fx){
    if(!state.rows.some(r => !r.hidden)) return;
    fx.applyLostContext();
    fx.addIceLog('ice-lost-context', 'LOST CONTEXT — Oldest entry deleted from your log.');
  },
};
