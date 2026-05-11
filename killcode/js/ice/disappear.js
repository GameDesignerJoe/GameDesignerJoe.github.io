// DISAPPEARING PEG ICE — Corp erases one historical feedback signal.
export default {
  id:   'ice-disappear',
  name: 'DISAPPEARING PEG',
  onResolve(state, fx){
    fx.applyDisappearingPeg();
    fx.addIceLog('ice-disappear', 'DISAPPEARING PEG — One historical feedback signal has been wiped.');
  },
};
