// BLACKOUT ICE — Corp suppresses one feedback signal on the row just submitted.
export default {
  id:   'ice-blackout',
  name: 'BLACKOUT',
  onResolve(state, fx){
    if(!state.rows.length) return;                           // cycle 1 guard
    fx.applyBlackout();
    fx.addIceLog('ice-blackout', 'BLACKOUT — One feedback signal suppressed on last submission.');
  },
};
