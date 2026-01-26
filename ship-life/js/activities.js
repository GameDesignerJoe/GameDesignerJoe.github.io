// Ship Life - Activities System
// Phase 3: Rarity & Type Distribution

/**
 * Spawn activities for a location with rarity and type distribution
 */
function spawnActivities(location) {
    const allActivities = window.activitiesData || [];
    
    if (allActivities.length === 0) {
        console.error('No activities data loaded');
        return [];
    }
    
    console.log('=== ACTIVITY SPAWNING ===');
    console.log(`Location: ${location.name}`);
    
    // Roll activity count from location's spawn range
    const min = location.activity_spawn_range.min;
    const max = location.activity_spawn_range.max;
    const activityCount = Math.floor(Math.random() * (max - min + 1)) + min;
    
    console.log(`Activity Count: ${activityCount} (${min}-${max} range)`);
    
    // Calculate rarity distribution (MTG booster pack model)
    const rarityDist = calculateRarityDistribution(activityCount);
    console.log(`Rarity Distribution: ${rarityDist.common} common, ${rarityDist.rareUncommon} rare/uncommon`);
    
    // Validate type distribution
    const typeDistribution = location.activity_type_distribution;
    const totalPercentage = Object.values(typeDistribution).reduce((sum, val) => sum + val, 0);
    if (totalPercentage !== 100) {
        console.warn(`⚠️ Type distribution doesn't total 100% (got ${totalPercentage}%)`);
    }
    
    // Spawn activities
    const spawnedActivities = [];
    const typeRolls = [];
    
    for (let i = 0; i < activityCount; i++) {
        // Determine rarity for this slot
        const rarity = (i < rarityDist.common) ? 'common' : rollRareOrUncommon();
        
        // Determine type for this slot
        const activityType = rollActivityType(typeDistribution);
        typeRolls.push(`${activityType} (rolled ${Math.floor(Math.random() * 100)})`);
        
        // Select specific activity matching type and rarity
        const activity = selectActivity(allActivities, activityType, rarity);
        if (activity) {
            spawnedActivities.push({...activity}); // Clone the activity
        }
    }
    
    // Log detailed breakdown
    console.log('Type Rolls:', typeRolls);
    console.log('Spawned Activities:');
    spawnedActivities.forEach((act, idx) => {
        console.log(`  ${idx + 1}. ${act.name} (${act.type}, ${act.rarity})`);
    });
    
    return spawnedActivities;
}

/**
 * Calculate rarity distribution using MTG booster pack model
 * For every 2 commons, add 1 rare/uncommon
 */
function calculateRarityDistribution(totalCount) {
    // Formula: commons = ceil(totalCount * 2/3), rare/uncommon = floor(totalCount * 1/3)
    const rareUncommonCount = Math.floor(totalCount / 3);
    const commonCount = totalCount - rareUncommonCount;
    
    return {
        common: commonCount,
        rareUncommon: rareUncommonCount
    };
}

/**
 * Roll whether rare/uncommon slot is rare or uncommon (50/50)
 */
function rollRareOrUncommon() {
    return Math.random() < 0.5 ? 'uncommon' : 'rare';
}

/**
 * Roll activity type based on location's type distribution
 */
function rollActivityType(typeDistribution) {
    const roll = Math.random() * 100;
    let cumulative = 0;
    
    for (const [type, percentage] of Object.entries(typeDistribution)) {
        cumulative += percentage;
        if (roll < cumulative) {
            return type;
        }
    }
    
    // Fallback to first type if something goes wrong
    return Object.keys(typeDistribution)[0];
}

/**
 * Select a specific activity matching type and rarity
 */
function selectActivity(allActivities, type, rarity) {
    // Filter by type and rarity
    const matchingActivities = allActivities.filter(act => 
        act.type === type && act.rarity === rarity
    );
    
    if (matchingActivities.length > 0) {
        // Randomly pick one from matching activities
        const randomIndex = Math.floor(Math.random() * matchingActivities.length);
        return matchingActivities[randomIndex];
    }
    
    // Fallback 1: Try just matching type (ignore rarity)
    const typeMatches = allActivities.filter(act => act.type === type);
    if (typeMatches.length > 0) {
        console.warn(`⚠️ No ${rarity} ${type} activities found, using any ${type}`);
        const randomIndex = Math.floor(Math.random() * typeMatches.length);
        return typeMatches[randomIndex];
    }
    
    // Fallback 2: Return random activity
    console.warn(`⚠️ No ${type} activities found, using random activity`);
    const randomIndex = Math.floor(Math.random() * allActivities.length);
    return allActivities[randomIndex];
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

/**
 * Spawn a single replacement activity when one is successfully avoided
 * Uses same type distribution as original spawn
 */
function spawnReplacementActivity(location, existingActivities) {
    const allActivities = window.activitiesData || [];
    
    if (allActivities.length === 0) {
        console.error('No activities data loaded');
        return null;
    }
    
    // Roll rarity (50/50 common vs rare/uncommon)
    const rarity = Math.random() < 0.66 ? 'common' : rollRareOrUncommon();
    
    // Roll type based on location's type distribution
    const activityType = rollActivityType(location.activity_type_distribution);
    
    // Select activity
    const activity = selectActivity(allActivities, activityType, rarity);
    
    if (activity) {
        console.log(`[Replacement] Spawned ${activity.name} (${activityType}, ${rarity})`);
        return {...activity}; // Clone
    }
    
    return null;
}

console.log('Activities system loaded (Phase 3: Rarity & Type Distribution).');
