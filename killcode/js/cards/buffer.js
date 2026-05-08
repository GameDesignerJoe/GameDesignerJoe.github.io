// BUFFER — buffer overflow. Adds one additional cycle to the intrusion window.
export default {
  id:       'buffer',
  name:     'BUFFER',
  category: 'EXPLOIT',
  catCls:   'exploit',
  symbol:   '+',
  desc:     'Buffer overflow. Adds one additional cycle to your intrusion window.',
  cost:     null,

  onResolve(state, fx){
    fx.grantBufferRow('card:buffer');
    fx.addIntel('+', `BUFFER — Window extended. <strong>${state.maxRows - state.rows.length} cycles remaining.</strong>`);
  },
};
