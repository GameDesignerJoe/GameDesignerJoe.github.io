// Game events in plain words, for people: the debug panel's rolling log (ui/debug.js) and the sim's recorded
// trace (sim/sim.js, played back by replay/). Not a system module. describe(e) -> a short line, or null for the
// events that come every step or breath (footsteps, panting, splashes, creaks, flaps...).
import { ITEMS } from '../items.js';

const nm = id => (ITEMS[id]?.name || id || '').toLowerCase();
const BEAR = { warn: 'Bear warned (slammed the snow)', roar: 'Bear charged', maul: null, rip: 'Bear tore at the pup tent', hurt: 'Bear hit', die: 'Bear killed', plunge: 'Bear went through the ice', heave: 'Bear heaved out of the ice' };
const REFUSE = { wind: 'too windy', gear: 'no axes and crampons', tired: 'too tired', hurt: 'too hurt', parched: 'too parched', burden: 'carrying the body' };

export function describe(e) {
  switch (e.type) {
    case 'eat': return e.stage === 'done' ? 'Ate a ration' : null;
    case 'drink': return e.stage === 'done' ? 'Drank' : e.stage === 'fill' ? 'Filled the flask at the stove' : null;
    case 'snowEat': return e.stage === 'done' ? 'Ate a mittful of snow' : null;
    case 'splint': return e.stage === 'done' ? 'Splinted the leg' : null;
    case 'pitch':
      if (e.stage === 'done') return `Pitched the pup tent${e.tries > 1 ? ` (try ${e.tries})` : ''}`;
      if (e.stage === 'collapse') return 'The wind brought the tent down';
      if (e.stage === 'stop') return 'Gave up pitching';
      return null;
    case 'strike': return e.stage === 'done' ? 'Struck the pup tent' : null;
    case 'tent': return { in: `Crawled into the ${e.shelter?.kind === 'pup' || e.shelter === 'pup' ? 'pup tent' : 'tent'}`, out: 'Crawled out', sleep: 'Slept', wake: 'Woke at dawn' }[e.action] || null;
    case 'crack': return (e.stress ?? e.strength ?? 0) >= 0.4 ? 'Ice cracked' : null;
    case 'breakthrough': return 'Through the ice!';
    case 'plunge': return e.deep ? 'Into deep water' : 'Into the water';
    case 'heave': return e.stage === 'out' ? 'Heaved out of the water' : null;
    case 'shore': return 'Stopped at the water\'s edge';
    case 'bear': return e.kind === 'maul' ? (e.fatal ? 'Killed by the bear' : 'Mauled by the bear') : BEAR[e.kind] || null;
    case 'rifle': return e.stage === 'shot' ? (e.hit ? `Shot: hit the ${e.kind || 'target'} (${e.d} px)` : `Shot: missed (${e.d ?? '?'} px)`) : e.stage === 'dry' ? 'Rifle: no cartridges' : null;
    case 'flare': return e.stage === 'strike' ? 'Struck a flare' : e.stage === 'out' ? 'The flare burned out' : null;
    case 'butcher': return e.stage === 'done' ? 'Butchered the carcass' : null;
    case 'distress': return e.stage === 'found' ? 'Found the body' : null;
    case 'wrap': return e.stage === 'done' ? 'Wrapped the body' : e.stage === 'stop' ? 'Stopped wrapping' : null;
    case 'goal': return { wrapped: null, carry: 'Took the body up on the back', drag: 'Took up the rope: dragging', down: 'Set the body down', home: 'Brought them home' }[e.stage] || null;
    case 'snag': return 'The body snagged';
    case 'refuse': return `Refused the climb (${REFUSE[e.reason] || e.reason})`;
    case 'impact': return `Fell ${Math.round(e.height || 0)} px${e.fatal ? ': fatal' : ''}`;
    case 'injury': return e.cause === 'slip' ? 'Slipped on the ice' : e.cause === 'knock' ? 'Knocked down hard' : null;
    case 'fall': return e.drop ? null : 'Knocked over by the wind';
    case 'gear': return `${e.item === 'axes' ? 'Ice axes' : e.item[0].toUpperCase() + e.item.slice(1)} ${e.on ? 'on' : 'off'}${e.auto ? ' (by themselves)' : ''}`;
    case 'transfer': return e.to === 'pack' ? `Took ${e.n > 1 ? e.n + ' ' : 'the '}${nm(e.id)}` : `Left ${e.n > 1 ? e.n + ' ' : 'the '}${nm(e.id)} (${e.to})`;
    case 'pickup': return `Picked up ${nm(e.id)}`;
    case 'drop': return `Dropped ${nm(e.id)}`;
    case 'radio': return e.on ? 'Radio on' : 'Radio off';
    case 'rest': return 'Stopped for breath';
    case 'tired': return 'Sat down spent';
    case 'dizzy': return 'Lightheaded';
    case 'vertigo': return 'Looked down the wall';
    case 'peel': return 'A gust peeled them off the wall';
    case 'replant': return 'Drove the axes back in';
    case 'death': return `Died (${e.cause})`;
    case 'handover': return `${e.name} is gone; the next sets out`;
    case 'expedition': return 'The expedition is over';
    case 'mirage': return e.stage === 'start' ? 'A mirage on the horizon' : null;
    case 'thirdman': return e.stage === 'in' ? 'The Third Man walks alongside' : null;
    case 'avalanche': return 'An avalanche';
    default: return null;
  }
}
