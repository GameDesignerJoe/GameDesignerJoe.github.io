import { GRID_SIZE, PATROL_RADIUS } from './constants.js';

/**
 * Get the patrol zone squares for a warden at a given position
 * For radius 1: returns 3x3 grid (9 squares)
 * @param {{x: number, y: number}} position - Warden position
 * @param {number} radius - Patrol radius (1 for MVG)
 * @returns {{x: number, y: number}[]} - Array of grid positions in patrol zone
 */
export function getPatrolZone(position, radius) {
  const zone = [];
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = position.x + dx;
      const y = position.y + dy;
      
      // Check if position is within grid bounds
      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        zone.push({ x, y });
      }
    }
  }
  
  return zone;
}

/**
 * Check if a grid square is within a warden's patrol zone
 * @param {{x: number, y: number}} squarePos - Grid square position
 * @param {{x: number, y: number}} wardenPos - Warden position
 * @param {number} radius - Patrol radius
 * @returns {boolean}
 */
export function isInPatrolZone(squarePos, wardenPos, radius) {
  const dx = Math.abs(squarePos.x - wardenPos.x);
  const dy = Math.abs(squarePos.y - wardenPos.y);
  return dx <= radius && dy <= radius;
}

/**
 * Check if a position is occupied by any warden
 * @param {{x: number, y: number}} position
 * @param {Warden[]} wardens
 * @returns {boolean}
 */
export function isPositionOccupied(position, wardens) {
  return wardens.some(w => 
    w.position.x === position.x && w.position.y === position.y
  );
}

/**
 * Get warden at a specific position
 * @param {{x: number, y: number}} position
 * @param {Warden[]} wardens
 * @returns {Warden|null}
 */
export function getWardenAtPosition(position, wardens) {
  return wardens.find(w => 
    w.position.x === position.x && w.position.y === position.y
  ) || null;
}
