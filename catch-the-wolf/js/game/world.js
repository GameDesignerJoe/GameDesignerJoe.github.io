// Movement bounds for the sheep brain (critter.js): a rectangle with solid
// circles to steer around, plus optional food and toys.

import { clamp } from '../engine/util.js';

// A rectangular paddock the farm brain can wander in.
export function paddockWorld(area, avoid, fx) {
  return {
    area, avoid, fx, others: [], foods: [], toys: [],
    inside: (x, y, pad) => x > area.x + pad && x < area.x + area.w - pad && y > area.y + pad && y < area.y + area.h - pad,
    clamp: (x, y, pad) => ({ x: clamp(x, area.x + pad, area.x + area.w - pad), y: clamp(y, area.y + pad, area.y + area.h - pad) }),
  };
}

