// src/utils/grid.js

import { GRID } from '../../../config/constants.js';

export const createHexPoints = (size) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (60 * i - 30) * Math.PI / 180;
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

export const getHexCenter = (q, r) => {
    const hexWidth = Math.sqrt(3) * GRID.HEX_SIZE;
    const hexHeight = GRID.HEX_SIZE * 2;
    const x = hexWidth * (q + r/2);
    const y = hexHeight * (r * 3/4);
    return { x, y };
};

export const hexDistance = (hex1, hex2) => {
    return (Math.abs(hex1.q - hex2.q) + 
            Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + 
            Math.abs(hex1.r - hex2.r)) / 2;
};

export const isAdjacent = (hex1, hex2) => {
    return hexDistance(hex1, hex2) === 1;
};

export const getAdjacentHexes = (position) => {
    const directions = [
        {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
        {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
    ];
    
    return directions.map(dir => ({
        q: position.q + dir.q,
        r: position.r + dir.r
    }));
};