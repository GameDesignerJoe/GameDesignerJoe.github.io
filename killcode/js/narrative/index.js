// ══════════════════════════════════════════════
// kill.code — narrative/index.js
// Narrative engine: subscribes to bus events declared by scenes, queues
// matching scenes, drains them through the presenter. Engine NEVER imports
// this file — the dependency arrow points one way.
// ══════════════════════════════════════════════

import { state }    from '../state.js';
import { bus }      from '../bus.js';
import { SCENES }   from './scenes/_registry.js';
import { runScene } from './presenter.js';

const _fired   = new Set();
const _queue   = [];
let   _running = false;

export function initNarrative(){
  if(!SCENES || !SCENES.length) return;
  // Subscribe once per distinct trigger event.
  const events = [...new Set(SCENES.map(s => s.trigger?.event).filter(Boolean))];
  events.forEach(ev => bus.on(ev, (payload) => evaluate(ev, payload)));
}

function evaluate(ev, payload){
  for(const scene of SCENES){
    if(scene.trigger?.event !== ev) continue;
    if(scene.trigger.once && _fired.has(scene.id)) continue;
    let pass = true;
    try { pass = scene.trigger.when ? scene.trigger.when(payload, state) : true; }
    catch(e){ console.error('[scene.trigger.when]', scene.id, e); pass = false; }
    if(!pass) continue;
    _queue.push(scene);
    if(scene.trigger.once) _fired.add(scene.id);
  }
  drain();
}

function drain(){
  if(_running || !_queue.length) return;
  _running = true;
  const scene = _queue.shift();
  runScene(scene, () => {
    _running = false;
    drain();
  });
}
