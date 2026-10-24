// Writes the cut (js/trailer/plan.js) as JSON for the compositor and the score: node timeline.mjs > timeline.json
import { timeline, CUES, FPS } from '../../js/trailer/plan.js';
process.stdout.write(JSON.stringify({ fps: FPS, shots: timeline(), cues: CUES }, null, 1));
