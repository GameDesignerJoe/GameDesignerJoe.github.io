import * as Honeycomb from 'honeycomb-grid'
import { GAME_CONFIG } from '../../config/config.js'

console.log('Setting up hex factory...')
const HexFactory = Honeycomb.defineHex({
    dimensions: { width: GAME_CONFIG.HEX_SIZE * 2, height: GAME_CONFIG.HEX_SIZE * 2 },
    orientation: 'flat'
})

const grid = new Honeycomb.Grid(HexFactory, [
    ...Array.from({ length: GAME_CONFIG.GRID_HEIGHT }, (_, row) =>
        Array.from({ length: GAME_CONFIG.GRID_WIDTH }, (_, col) => 
            new HexFactory({ 
                q: col,
                r: row,
                s: -col - row
            })
        )
    ).flat()
])

// Create initial hex positions
console.log('Setting up starting positions...')
const firstRowHexes = Array.from(grid.filter(hex => hex.y === 0))
const playerStartHex = firstRowHexes[Math.floor(firstRowHexes.length / 2)]
const baseCamp = playerStartHex

const lastRowHexes = Array.from(grid.filter(hex => hex.y >= GAME_CONFIG.GRID_HEIGHT - 2))
const southPole = lastRowHexes[Math.floor(Math.random() * GAME_CONFIG.GRID_WIDTH)]

const hexHelpers = {
    toPoint(hex) {
        const width = GAME_CONFIG.HEX_SIZE * 2
        const height = GAME_CONFIG.HEX_SIZE * 2
        return {
            x: width * (hex.q + hex.r/2),
            y: height * (hex.r * 3/4)
        }
    },
    center() {
        return { x: 0, y: 0 }
    },
    corners() {
        const width = GAME_CONFIG.HEX_SIZE * 2
        const height = GAME_CONFIG.HEX_SIZE * 2
        const corners = []
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i
            corners.push({
                x: width/2 * Math.cos(angle),
                y: height/2 * Math.sin(angle)
            })
        }
        return corners
    },
    toString(hex) {
        return `${hex.q},${hex.r}`
    },
    distance(hex1, hex2) {
        return Math.max(
            Math.abs(hex1.q - hex2.q),
            Math.abs(hex1.r - hex2.r),
            Math.abs(-hex1.q - hex1.r - (-hex2.q - hex2.r))
        )
    }
}

// First store Grid constructor
const GridConstructor = Honeycomb.Grid

export { 
    HexFactory as Hex,
    GridConstructor as Grid,
    grid,
    playerStartHex,
    baseCamp,
    southPole,
    hexHelpers
}