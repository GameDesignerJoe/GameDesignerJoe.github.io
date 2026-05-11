// PURGE ICE — Corp burns the next program in the player's draw queue.
export default {
  id:   'ice-purge',
  name: 'PURGE',
  onResolve(state, fx){
    if(!state.deck.length) return;
    fx.applyPurge();
    fx.addIceLog('ice-purge', 'PURGE — Next program in queue has been incinerated.');
  },
};
