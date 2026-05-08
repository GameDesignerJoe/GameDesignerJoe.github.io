// PING — scans hash structure. Tells you if any key appears more than once.
export default {
  id:       'ping',
  name:     'PING',
  category: 'RECON',
  catCls:   'recon',
  symbol:   '⊙',
  desc:     'Scans hash structure. Tells you if any key appears more than once.',
  cost:     null,

  onResolve(state, fx){
    const repeated = new Set(state.secret).size < state.secret.length;
    fx.addIntel('≡', repeated
      ? `PING — Hash contains <strong>repeated keys</strong>.`
      : `PING — Hash has <strong>no repeated keys</strong>. All four are unique.`);
  },
};
