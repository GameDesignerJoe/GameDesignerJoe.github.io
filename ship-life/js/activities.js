// Ship Life - Activities System

/**
 * Spawn activities for a location (Phase 1: Simple random spawning)
 */
function spawnActivities(location) {
    const allActivities = window.activitiesData || [];
    
    if (allActivities.length === 0) {
        console.error('No activities data loaded');
        return [];
    }
    
    // Roll activity count from location's spawn range
    const min = location.activity_spawn_range.min;
    const max = location.activity_spawn_range.max;
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // For Phase 1: Just pick random activities (ignore rarity/type distribution)
    const spawned = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * allActivities.length);
        const activity = {...allActivities[randomIndex]}; // Clone the activity
        spawned.push(activity);
    }
    
    console.log('=== ACTIVITY SPAWNING ===');
    console.log(`Location: ${location.name}`);
    console.log(`Activity Count: ${count} (${min}-${max} range)`);
    console.log('Spawned Activities:', spawned.map(a => `${a.name} (${a.type}, ${a.rarity})`));
    
    return spawned;
}

/**
 * Calculate total loot from spawned activities (Phase 1: All successful)
 */
function calculateActivityLoot(activities) {
    const totalLoot = {};
    
    activities.forEach(activity => {
        console.log(`Processing loot for: ${activity.name}`);
        
        activity.loot_table.forEach(lootEntry => {
            // Roll for drop
            const dropRoll = Math.random() * 100;
            if (dropRoll <= lootEntry.drop_chance) {
                // Roll quantity
                const quantity = Math.floor(Math.random() * (lootEntry.max - lootEntry.min + 1)) + lootEntry.min;
                
                // Add to total loot
                if (!totalLoot[lootEntry.resource_id]) {
                    totalLoot[lootEntry.resource_id] = 0;
                }
                totalLoot[lootEntry.resource_id] += quantity;
                
                const item = window.itemsData?.find(i => i.id === lootEntry.resource_id);
                console.log(`  - ${item?.name || lootEntry.resource_id} x${quantity} (rolled ${lootEntry.min}-${lootEntry.max}, drop chance ${lootEntry.drop_chance}%)`);
            }
        });
    });
    
    console.log('=== TOTAL LOOT ===');
    Object.entries(totalLoot).forEach(([itemId, quantity]) => {
        const item = window.itemsData?.find(i => i.id === itemId);
        console.log(`${item?.name || itemId}: ${quantity}`);
    });
    
    return totalLoot;
}

/**
 * Award loot to player inventory
 */
function awardActivityLoot(lootObject) {
    let totalItems = 0;
    
    for (const [itemId, quantity] of Object.entries(lootObject)) {
        addToInventory(gameState, itemId, quantity);
        totalItems += quantity;
    }
    
    console.log(`Awarded ${totalItems} items to inventory`);
    autoSave(gameState);
}

console.log('Activities system loaded.');
