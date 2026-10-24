// Audio recorders (Joe): small recorders carried in the pack, each holding one short message.
// Tap one in the pack to play it; tap again to stop it. Joe will record the real ones: drop each
// file in not-all-survive/assets/recordings/ and set `src` below. Until a file exists, the text
// is read by the browser's own voice (a placeholder), quietly, under tape hiss.
//
// Carrying one is hope: anyone with a recorder in their pack loses warmth and energy ~10% slower
// (body.js). The game never says so.
//
// Each recording becomes its own pack item ('rec_<id>', items.js), so it travels like any other.
// For now one sits on the sled; later ones will be found on the dead (the radio goal).
export const RECORDINGS = [
  {
    id: 'leader', title: 'The leader’s message', src: 'assets/recordings/leader.mp3',
    // PLACEHOLDER words until Joe records it
    text: 'If you are hearing this, then you made it to the camp. Good. Rest. Eat. Then go and find them. We do not leave anyone out there. Not if we can help it.',
  },
];
export const RECORDING = Object.fromEntries(RECORDINGS.map(r => [r.id, r]));
