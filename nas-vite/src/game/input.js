import { Grid, hexHelpers } from './core/grid.js'
import { gameState, timing } from './core/state.js'
import { showDetailsPanel, hideDetailsPanel } from './ui/details.js'

function handlePointerEvent(event, canvas) {
    const rect = canvas.getBoundingClientRect()
    
    const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX
    const clientY = event.type.includes('touch') ? event.touches[0].clientY : event.clientY
    
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const adjustedX = (mouseX * scaleX) - gameState.viewport.x
    const adjustedY = (mouseY * scaleY) - gameState.viewport.y
    
    // Create coordinates array for point conversion
    return [adjustedX, adjustedY]
}

function addEventListeners(canvas) {
    let touchStartHex = null
    
    canvas.addEventListener('mousemove', (event) => {
        const now = performance.now()
        if (now - timing.lastHoverCheck < 32) return
        timing.lastHoverCheck = now
        
        const point = handlePointerEvent(event, canvas)
        const pointHex = Grid.pointToHex(point)
        if (pointHex) {
            gameState.hoveredHex = pointHex
        } else {
            gameState.hoveredHex = null
        }
    })
    
    // Rest of the event listeners...
}

export {
    handlePointerEvent,
    addEventListeners
}