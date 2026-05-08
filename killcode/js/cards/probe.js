// PROBE — pick any slot, then any key — confirms if that key belongs at that position.
// Multi-step card. Engine consumes `steps[]` one at a time; each step's `pick(value, …)`
// fires when the user clicks a button in the desc-bar UI.
import { K } from '../config.js';

export default {
  id:       'probe',
  name:     'PROBE',
  category: 'RECON',
  catCls:   'recon',
  symbol:   '✦',
  desc:     'Pick any slot, then any key — confirms if that key belongs at that position. Works any round.',
  cost:     null,

  steps: [
    {
      id:        'probe-slot',
      promptHdr: 'PROBE — Select a Slot',
      promptTxt: 'Which position do you want to test?',
      // shape: 'pos' (number buttons) | 'colour' (colour swatches)
      shape:     'pos',
      choices(state){
        return [0,1,2,3].map(i => ({ value: i, label: String(i+1) }));
      },
      pick(value, state, fx, ctx){
        ctx.slot = value;
        // Returning nothing → engine advances to the next step.
      },
    },
    {
      id:        'probe-colour',
      promptHdr: (ctx) => `PROBE — Slot ${ctx.slot + 1} · Select a Key`,
      promptTxt: 'Which key do you suspect belongs here?',
      shape:     'colour',
      choices(state){
        return K.map((c, i) => ({
          value:    i,
          colour:   c,
          disabled: state.eliminated.includes(i),
        }));
      },
      pick(value, state, fx, ctx){
        const ok = state.secret[ctx.slot] === value;
        const c  = K[value];
        fx.addIntel('✦',
          `PROBE — Slot ${ctx.slot + 1} / <span style="color:${c.fg}">${c.sym} ${c.name}</span> — ` +
          (ok ? `<strong style="color:var(--neon)">CONFIRMED ✓</strong>`
              : `<strong style="color:var(--red)">REJECTED ✗</strong>`));
      },
    },
  ],
};
