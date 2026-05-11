// LOCKDOWN ICE — Corp closes one cycle. The intrusion window shrinks.
export default {
  id:   'ice-lockdown',
  name: 'LOCKDOWN',
  onResolve(state, fx){
    if(state.maxRows <= state.rows.length + 1) return;       // no headroom to remove
    fx.applyLockdown();
    fx.addIceLog('ice-lockdown', 'LOCKDOWN — One cycle removed from your intrusion window.');
  },
};
