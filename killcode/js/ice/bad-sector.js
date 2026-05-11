// BAD SECTOR ICE — Corp corrupts one tile in a previous entry.
export default {
  id:   'ice-bad-sector',
  name: 'BAD SECTOR',
  onResolve(state, fx){
    fx.applyBadSector();
    fx.addIceLog('ice-bad-sector', 'BAD SECTOR — One tile in a previous entry has been corrupted.');
  },
};
