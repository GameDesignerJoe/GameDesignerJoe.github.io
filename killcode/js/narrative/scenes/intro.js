// intro — cosmetic dialogue at the start of the very first run.
// Disabled by default. Enable by uncommenting in narrative/scenes/_registry.js.

export default {
  id: 'intro',
  trigger: {
    event: 'game.started',
    once:  true,
    when:  () => true,
  },
  dialogue: [
    { speaker: 'handler', lines: ["You're in. Four-key hash, five cycles, no second chances."] },
    { speaker: 'handler', lines: ["Programs queued. Crack it before they trace you."] },
  ],
  effects(){ /* purely cosmetic */ },
};
