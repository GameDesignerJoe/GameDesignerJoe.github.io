import { gameState } from '../core/state.js'
import { getHexTerrainType } from '../core/terrain.js'

function showDetailsPanel(hex) {
    const detailsPanel = document.getElementById('details-panel')
    if (!detailsPanel) {
        console.warn('Details panel not found')
        return
    }

    const emptyState = detailsPanel.querySelector('.empty-state')
    const terrainDetails = detailsPanel.querySelector('.terrain-details')
    
    if (!emptyState || !terrainDetails) {
        console.warn('Required elements not found in details panel')
        return
    }

    const terrain = getHexTerrainType(hex)
    
    emptyState.classList.add('hidden')
    terrainDetails.classList.remove('hidden')
    
    // Safely update elements with null checks
    const elements = {
        'terrain-name': terrain.name,
        'stamina-cost': terrain.staminaCost || 'None',
        'health-risk': terrain.healthRisk ? `${terrain.healthRisk * 100}%` : 'None',
        'terrain-description': terrain.description,
        'terrain-quote': `<em>"${terrain.quote}"</em>`
    }

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id)
        if (element) {
            if (id === 'terrain-quote') {
                element.innerHTML = value
            } else {
                element.textContent = value
            }
        }
    })

    const confirmButton = document.getElementById('move-confirm')
    if (confirmButton) {
        confirmButton.disabled = !terrain.passable || gameState.stamina < (terrain.staminaCost || 0)
    }
}

function hideDetailsPanel() {
    const detailsPanel = document.getElementById('details-panel')
    if (!detailsPanel) {
        console.warn('Details panel not found')
        return
    }

    const emptyState = detailsPanel.querySelector('.empty-state')
    const terrainDetails = detailsPanel.querySelector('.terrain-details')

    if (emptyState && terrainDetails) {
        emptyState.classList.remove('hidden')
        terrainDetails.classList.add('hidden')
    }
    
    gameState.selectedHex = null
    gameState.hoveredHex = null
}

export {
    showDetailsPanel,
    hideDetailsPanel
}