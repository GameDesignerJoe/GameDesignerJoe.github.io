// Ship Life - Guardian Management

/**
 * Get Guardian by ID
 */
function getGuardianById(guardianId) {
    return window.guardiansData.find(g => g.id === guardianId);
}

/**
 * Get current active Guardian
 */
function getActiveGuardian() {
    if (!gameState || !gameState.active_guardian) {
        return null;
    }
    return getGuardianById(gameState.active_guardian);
}

console.log('Guardian system loaded.');
