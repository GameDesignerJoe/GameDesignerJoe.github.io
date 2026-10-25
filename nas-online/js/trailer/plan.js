// The cut. One entry per shot, in order: dur (seconds on screen), head / tail (extra seconds rendered
// either side for transitions), the page's URL params (things modules read at load), and how it joins
// the next shot (cut | dissolve | white | gust | ink | black). No browser APIs here: render.js imports it.
export const FPS = 30;

// Every shot but the bear's runs without the wildlife module (penguins and the bear wander into frame).
const NOWILD = 'only=explorer,thinice,footprints,weather,body,camp,puptent,fallen,distress,burden,thirst,night,bright,pack,radio';

export const PLAN = [
  { id: 'open',     dur: 10,  head: 0,   tail: 0.5, params: 'day&weather=calm&' + NOWILD,                    out: 'cut' },
  { id: 'camp',     dur: 5,   head: 0.5, tail: 0.5, params: 'day&weather=calm&' + NOWILD,                    out: 'dissolve' },
  { id: 'crawl',    dur: 4,   head: 0.5, tail: 0.5, params: 'day&weather=calm&' + NOWILD,                    out: 'cut' },
  { id: 'packing',  dur: 3,   head: 0,   tail: 0.5, params: 'day&weather=calm&' + NOWILD,                    out: 'gust' },
  { id: 'radio',    dur: 6,   head: 0.5, tail: 0.5, params: 'day&weather=calm&sos=1700,1200&' + NOWILD,      out: 'cut' },
  { id: 'setout',   dur: 3,   head: 0,   tail: 0.5, params: 'day&weather=calm&' + NOWILD,                    out: 'cut' },
  { id: 'deep',     dur: 2,   head: 0,   tail: 0.3, params: 'day&weather=wind&' + NOWILD,                    out: 'cut' },
  { id: 'climb',    dur: 2.5, head: 0,   tail: 0.3, params: 'day&weather=calm&' + NOWILD,                    out: 'cut' },
  { id: 'glare',    dur: 2,   head: 0,   tail: 0.3, params: 'day&bright&weather=calm&' + NOWILD,             out: 'cut' },
  { id: 'lake',     dur: 2,   head: 0,   tail: 0.3, params: 'day&weather=calm&' + NOWILD,                    out: 'cut' },
  { id: 'thin',     dur: 2.5, head: 0,   tail: 0.3, params: 'day&weather=calm&' + NOWILD,                    out: 'white' },
  { id: 'heave',    dur: 2,   head: 0.3, tail: 0.3, params: 'day&weather=calm&' + NOWILD,                    out: 'cut' },
  { id: 'third',    dur: 3,   head: 0,   tail: 0.5, params: 'day&weather=calm&water=0.05&tx=1000&ty=1560&ta=0&' + NOWILD + '', out: 'gust' },
  { id: 'storm',    dur: 3,   head: 0.5, tail: 0.3, params: 'day&weather=storm&' + NOWILD,                   out: 'cut' },
  { id: 'pitch',    dur: 4,   head: 0,   tail: 0.5, params: 'day&weather=storm&' + NOWILD,                   out: 'ink' },
  { id: 'bear',     dur: 5.5, head: 0.5, tail: 0,   params: 'night&weather=calm&bear=near&wxoff=frost&x=1480&y=1548', out: 'black' },
  { id: 'flare',    dur: 4,   head: 0,   tail: 0.5, params: 'night&weather=calm&bear=near&wxoff=frost&x=1480&y=1548', out: 'dissolve' },
  { id: 'beacon',   dur: 3,   head: 0.5, tail: 0.3, params: 'night&weather=calm&sos=1200,1600&wxoff=frost&' + NOWILD, out: 'cut' },
  { id: 'wrap',     dur: 3,   head: 0,   tail: 0.5, params: 'day&weather=calm&sos=1200,1600&' + NOWILD,      out: 'dissolve' },
  { id: 'drag',     dur: 3.5, head: 0.5, tail: 0.5, params: 'day&weather=calm&goal=wrapped&' + NOWILD,       out: 'dissolve' },
  { id: 'skis',     dur: 3,   head: 0.5, tail: 0.5, params: 'day&weather=calm&' + NOWILD,                    out: 'ink' },
  { id: 'pup',      dur: 14,  head: 0.5, tail: 0,   params: 'night&weather=calm&' + NOWILD + '', out: 'black' },
];

// The letterbox (px of 1080, each bar) by trailer time: shut on black at the top, parting on the white
// void, 2.39:1 through the film, closing in a little through the storm and the bear, easing at the end.
export function barsAt(T) {
  const sm = (a, b, v) => { const x = Math.max(0, Math.min(1, (v - a) / (b - a))); return x * x * (3 - 2 * x); };
  const OPEN = 138, TIGHT = 176;
  let h = 540 - (540 - OPEN) * sm(0.75, 1.9, T);
  h += (TIGHT - OPEN) * (sm(47, 50, T) - sm(63.2, 64.5, T));
  h -= 28 * sm(78, 86, T);
  return h;
}

// Musical cues shared by the overlay and the score (trailer seconds). The radio's blips and its SOS
// (unit: seconds per morse dot), the hits the cut lands on.
export const CUES = {
  blips: [22.6, 23.9, 24.9, 25.6],
  sos: { start: 25.9, unit: 0.09 },
  beaconSos: { start: 64.1, unit: 0.16 },
  flare: 60.4,          // the flare catches (after the silence)
  silence: [59.5, 60.15],
  title: 82,
};

// Start time of each shot on the timeline (seconds), from the durations.
export function timeline() {
  let at = 0;
  return PLAN.map(p => { const s = { ...p, at }; at += p.dur; return s; });
}
