// Ship Life - Statistics System

/**
 * Calculate all player statistics from game state
 */
function calculateStatistics(state) {
    const stats = {
        missions: calculateMissionStats(state),
        guardians: calculateGuardianStats(state),
        resources: calculateResourceStats(state),
        crafting: calculateCraftingStats(state)
    };
    
    return stats;
}

/**
 * Calculate mission-related statistics
 */
function calculateMissionStats(state) {
    const totalMissions = state.completed_missions?.length || 0;
    const totalRun = state.total_missions_run || 0;
    const successRate = totalRun > 0 ? Math.round((totalMissions / totalRun) * 100) : 0;
    
    // Count by mission type
    const missionsByType = {};
    const missions = window.missionsData || [];
    
    state.completed_missions?.forEach(missionId => {
        const mission = missions.find(m => m.id === missionId);
        if (mission) {
            const type = mission.mission_type;
            missionsByType[type] = (missionsByType[type] || 0) + 1;
        }
    });
    
    // Find most run mission (not tracked yet, placeholder)
    const favoriteMission = "N/A";
    
    return {
        total: totalMissions,
        totalRun: totalRun,
        successRate: successRate,
        byType: missionsByType,
        favorite: favoriteMission
    };
}

/**
 * Calculate guardian-related statistics
 */
function calculateGuardianStats(state) {
    const guardians = window.guardiansData || [];
    const missionCounters = state.mission_counters || {};
    
    // Count missions per guardian
    const guardianMissions = {};
    let mostUsed = null;
    let maxMissions = 0;
    
    guardians.forEach(guardian => {
        const count = missionCounters[guardian.id] || 0;
        guardianMissions[guardian.id] = count;
        
        if (count > maxMissions) {
            maxMissions = count;
            mostUsed = guardian.name;
        }
    });
    
    // Calculate best performing guardian (highest success rate)
    // This would require tracking successes per guardian (not implemented yet)
    const bestPerformer = mostUsed; // Placeholder
    
    return {
        mostUsed: mostUsed || "None",
        missions: guardianMissions,
        bestPerformer: bestPerformer || "None"
    };
}

/**
 * Calculate resource-related statistics
 */
function calculateResourceStats(state) {
    const inventory = state.inventory || {};
    const items = window.itemsData || [];
    
    // Count total resources
    let totalResources = 0;
    for (const itemId in inventory) {
        totalResources += inventory[itemId];
    }
    
    // Find rarest item owned (placeholder - would need rarity system)
    let rarestItem = "None";
    const ownedItems = Object.keys(inventory).filter(id => inventory[id] > 0);
    if (ownedItems.length > 0) {
        const item = items.find(i => i.id === ownedItems[0]);
        rarestItem = item ? item.name : "Unknown";
    }
    
    return {
        total: totalResources,
        rarestItem: rarestItem,
        uniqueItems: ownedItems.length
    };
}

/**
 * Calculate crafting-related statistics
 */
function calculateCraftingStats(state) {
    // Track crafted items (would need to add to state)
    const craftedItems = state.crafted_items || {};
    const uniqueCrafts = Object.keys(craftedItems).length;
    const totalCrafts = Object.values(craftedItems).reduce((sum, count) => sum + count, 0);
    
    return {
        unique: uniqueCrafts,
        total: totalCrafts
    };
}

/**
 * Get formatted stat display
 */
function getStatDisplay(label, value) {
    return {
        label: label,
        value: value
    };
}

console.log('Statistics system loaded.');
