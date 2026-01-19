// Ship Life - Loadout Management System

/**
 * Initialize loadouts for all guardians if they don't exist
 */
function initializeLoadouts(state) {
    if (!state.loadouts) {
        state.loadouts = {};
    }
    
    // Ensure each guardian from guardiansData has a loadout structure
    if (window.guardiansData) {
        window.guardiansData.forEach(guardian => {
            if (!state.loadouts[guardian.id]) {
                state.loadouts[guardian.id] = {
                    equipment: null,
                    aspects: [null, null, null]
                };
            }
        });
    }
}

/**
 * Get loadout for a specific guardian
 */
function getLoadout(state, guardianId) {
    initializeLoadouts(state);
    
    // Ensure this specific guardian has a loadout
    if (!state.loadouts[guardianId]) {
        state.loadouts[guardianId] = {
            equipment: null,
            aspects: [null, null, null]
        };
    }
    
    return state.loadouts[guardianId];
}

/**
 * Equip an item to a guardian's equipment slot
 */
function equipItem(state, guardianId, itemId, slotType, slotIndex = 0) {
    initializeLoadouts(state);
    
    const item = window.itemsData.find(i => i.id === itemId);
    if (!item) {
        console.error(`Item ${itemId} not found`);
        return false;
    }
    
    // Validate item type
    if (slotType === 'equipment' && item.type !== 'equipment') {
        console.error(`Cannot equip ${itemId} in equipment slot - wrong type`);
        return false;
    }
    
    if (slotType === 'aspect' && item.type !== 'aspect') {
        console.error(`Cannot equip ${itemId} in aspect slot - wrong type`);
        return false;
    }
    
    const loadout = state.loadouts[guardianId];
    
    // Equip the item
    if (slotType === 'equipment') {
        loadout.equipment = itemId;
    } else if (slotType === 'aspect') {
        if (slotIndex < 0 || slotIndex > 2) {
            console.error(`Invalid aspect slot index: ${slotIndex}`);
            return false;
        }
        loadout.aspects[slotIndex] = itemId;
    }
    
    console.log(`Equipped ${item.name} to ${guardianId}'s ${slotType} slot`);
    return true;
}

/**
 * Unequip an item from a guardian's loadout
 */
function unequipItem(state, guardianId, slotType, slotIndex = 0) {
    initializeLoadouts(state);
    
    const loadout = state.loadouts[guardianId];
    
    if (slotType === 'equipment') {
        const itemId = loadout.equipment;
        loadout.equipment = null;
        console.log(`Unequipped equipment from ${guardianId}`);
        return itemId;
    } else if (slotType === 'aspect') {
        if (slotIndex < 0 || slotIndex > 2) {
            console.error(`Invalid aspect slot index: ${slotIndex}`);
            return null;
        }
        const itemId = loadout.aspects[slotIndex];
        loadout.aspects[slotIndex] = null;
        console.log(`Unequipped aspect ${slotIndex} from ${guardianId}`);
        return itemId;
    }
    
    return null;
}

/**
 * Get all items equipped by a guardian
 */
function getEquippedItems(state, guardianId) {
    const loadout = getLoadout(state, guardianId);
    const equipped = [];
    
    if (loadout.equipment) {
        equipped.push(loadout.equipment);
    }
    
    loadout.aspects.forEach(aspectId => {
        if (aspectId) {
            equipped.push(aspectId);
        }
    });
    
    return equipped;
}

/**
 * Calculate loadout bonus for a mission
 */
function calculateLoadoutBonus(state, selectedGuardians, mission) {
    let totalBonus = 0;
    
    selectedGuardians.forEach(guardianId => {
        const loadout = getLoadout(state, guardianId);
        
        // Check equipment bonus
        if (loadout.equipment) {
            const item = window.itemsData.find(i => i.id === loadout.equipment);
            if (item && item.mission_bonuses) {
                const bonus = item.mission_bonuses[mission.mission_type] || 0;
                totalBonus += bonus;
            }
        }
        
        // Check aspect bonuses
        loadout.aspects.forEach(aspectId => {
            if (aspectId) {
                const item = window.itemsData.find(i => i.id === aspectId);
                if (item && item.mission_bonuses) {
                    const bonus = item.mission_bonuses[mission.mission_type] || 0;
                    totalBonus += bonus;
                }
            }
        });
    });
    
    return totalBonus;
}

/**
 * Check if mission requirements are met (including anomaly requirements)
 */
function checkMissionRequirements(state, selectedGuardians, mission) {
    // Check base mission requirements
    if (mission.requirements && mission.requirements.equipment_subtype) {
        const requiredSubtype = mission.requirements.equipment_subtype;
        let hasRequired = false;
        
        // Check if any selected guardian has the required equipment or aspect
        for (const guardianId of selectedGuardians) {
            const loadout = getLoadout(state, guardianId);
            
            // Check equipment slot
            if (loadout.equipment) {
                const item = window.itemsData.find(i => i.id === loadout.equipment);
                if (item && item.subtype === requiredSubtype) {
                    hasRequired = true;
                    break;
                }
            }
            
            // Check aspect slots
            for (const aspectId of loadout.aspects) {
                if (aspectId) {
                    const item = window.itemsData.find(i => i.id === aspectId);
                    if (item && item.subtype === requiredSubtype) {
                        hasRequired = true;
                        break;
                    }
                }
            }
            
            if (hasRequired) break;
        }
        
        if (!hasRequired) {
            // Capitalize first letter for display
            const displaySubtype = requiredSubtype.charAt(0).toUpperCase() + requiredSubtype.slice(1);
            
            return {
                met: false,
                missing: `Mission requires at least one piece of ${displaySubtype} equipment`
            };
        }
    }
    
    // Check anomaly requirements
    if (mission.anomaly && mission.anomaly.effects) {
        const effects = mission.anomaly.effects;
        
        // Check minimum Guardian count
        if (effects.requires_minimum_guardians && selectedGuardians.length < effects.requires_minimum_guardians) {
            return {
                met: false,
                missing: `${mission.anomaly.name} requires at least ${effects.requires_minimum_guardians} Guardians`
            };
        }
        
        // Check specific Guardian requirement
        if (effects.requires_specific_guardian && !selectedGuardians.includes(effects.requires_specific_guardian)) {
            const guardian = window.guardiansData?.find(g => g.id === effects.requires_specific_guardian);
            const guardianName = guardian ? guardian.name : effects.requires_specific_guardian;
            return {
                met: false,
                missing: `${mission.anomaly.name} requires ${guardianName} in the squad`
            };
        }
        
        // Check equipment type requirement
        if (effects.requires_equipment_type) {
            let hasEquipment = false;
            
            for (const guardianId of selectedGuardians) {
                const loadout = getLoadout(state, guardianId);
                
                // Check equipment slot
                if (loadout.equipment) {
                    const item = window.itemsData.find(i => i.id === loadout.equipment);
                    if (item && item.equipment_type === effects.requires_equipment_type) {
                        hasEquipment = true;
                        break;
                    }
                }
            }
            
            if (!hasEquipment) {
                // Capitalize equipment type for display
                const equipmentName = effects.requires_equipment_type
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                
                return {
                    met: false,
                    missing: `Requires at least one Guardian equipped with ${equipmentName} equipment`
                };
            }
        }
    }
    
    return { met: true, missing: null };
}

/**
 * Calculate gear stat bonus with stat weights
 */
function calculateGearStatBonus(statBonuses, requiredStats, statWeights) {
    let bonus = 0;
    
    // Primary stat bonus
    if (requiredStats.primary && statBonuses[requiredStats.primary]) {
        bonus += statBonuses[requiredStats.primary] * statWeights.primary;
    }
    
    // Secondary stat bonus
    if (requiredStats.secondary && statBonuses[requiredStats.secondary]) {
        bonus += statBonuses[requiredStats.secondary] * statWeights.secondary;
    }
    
    // Tertiary stat bonus
    if (requiredStats.tertiary && statBonuses[requiredStats.tertiary]) {
        bonus += statBonuses[requiredStats.tertiary] * statWeights.tertiary;
    }
    
    return bonus;
}

/**
 * Calculate mission success rate with Guardian stats + loadout bonuses
 */
function calculateMissionSuccessRate(state, selectedGuardians, mission) {
    // Get difficulty multiplier (use new field, fallback to old calculation)
    const difficultyMultiplier = mission.difficulty_multiplier || (mission.difficulty / 5);
    
    // Get stat requirements
    const requiredStats = mission.required_stats || { primary: "attack" };
    const statWeights = {
        primary: 0.5,
        secondary: requiredStats.secondary ? 0.3 : 0,
        tertiary: requiredStats.tertiary ? 0.2 : 0
    };
    
    // Calculate total points from all Guardians
    let totalPoints = 0;
    
    selectedGuardians.forEach(guardianId => {
        const guardian = window.guardiansData.find(g => g.id === guardianId);
        if (!guardian || !guardian.stats) {
            console.warn(`Guardian ${guardianId} missing stats, skipping`);
            return;
        }
        
        // Guardian stat contribution (base 50 points × weighted stats)
        let guardianContribution = 0;
        
        // Primary stat (50% weight)
        const primaryStat = guardian.stats[requiredStats.primary] || 25;
        guardianContribution += 50 * (primaryStat / 50) * statWeights.primary;
        
        // Secondary stat (30% weight)
        if (requiredStats.secondary) {
            const secondaryStat = guardian.stats[requiredStats.secondary] || 25;
            guardianContribution += 50 * (secondaryStat / 50) * statWeights.secondary;
        }
        
        // Tertiary stat (20% weight)
        if (requiredStats.tertiary) {
            const tertiaryStat = guardian.stats[requiredStats.tertiary] || 25;
            guardianContribution += 50 * (tertiaryStat / 50) * statWeights.tertiary;
        }
        
        // If only primary stat, use full 50 points
        if (!requiredStats.secondary && !requiredStats.tertiary) {
            guardianContribution = 50 * (primaryStat / 50);
        }
        
        totalPoints += guardianContribution;
        
        // Gear stat bonuses from this Guardian's loadout
        const loadout = getLoadout(state, guardianId);
        let gearContribution = 0;
        
        // Equipment slot
        if (loadout.equipment) {
            const item = window.itemsData.find(i => i.id === loadout.equipment);
            if (item && item.stat_bonuses) {
                gearContribution += calculateGearStatBonus(item.stat_bonuses, requiredStats, statWeights);
            }
        }
        
        // Aspect slots
        loadout.aspects.forEach(aspectId => {
            if (aspectId) {
                const item = window.itemsData.find(i => i.id === aspectId);
                if (item && item.stat_bonuses) {
                    gearContribution += calculateGearStatBonus(item.stat_bonuses, requiredStats, statWeights);
                }
            }
        });
        
        totalPoints += gearContribution;
    });
    
    // Legacy mission_bonuses (will be deprecated)
    const legacyBonus = calculateLoadoutBonus(state, selectedGuardians, mission);
    
    // Anomaly modifier
    let anomalyModifier = 0;
    if (mission.anomaly && mission.anomaly.effects && mission.anomaly.effects.difficulty_modifier) {
        anomalyModifier = -mission.anomaly.effects.difficulty_modifier;
    }
    
    // Final success percentage
    const successPercentage = Math.min(100, Math.max(0, (totalPoints / difficultyMultiplier)));
    
    // Apply legacy bonus and anomaly (as flat % adjustments for backward compatibility)
    const finalSuccess = Math.min(100, Math.max(0, successPercentage + legacyBonus + anomalyModifier));
    
    return {
        base: Math.round(successPercentage),
        loadoutBonus: legacyBonus,
        anomalyModifier: anomalyModifier,
        final: Math.round(finalSuccess),
        debug: {
            totalPoints: totalPoints,
            difficultyMultiplier: difficultyMultiplier,
            requiredStats: requiredStats
        }
    };
}

/**
 * Get available items for a slot type
 */
function getAvailableItemsForSlot(slotType) {
    if (slotType === 'equipment') {
        return window.itemsData.filter(item => item.type === 'equipment');
    } else if (slotType === 'aspect') {
        return window.itemsData.filter(item => item.type === 'aspect');
    }
    return [];
}

/**
 * Check if an item is currently equipped by any guardian
 */
function isItemEquipped(state, itemId) {
    initializeLoadouts(state);
    
    for (const guardianId in state.loadouts) {
        const loadout = state.loadouts[guardianId];
        
        if (loadout.equipment === itemId) {
            return { equipped: true, guardian: guardianId, slot: 'equipment' };
        }
        
        const aspectIndex = loadout.aspects.indexOf(itemId);
        if (aspectIndex !== -1) {
            return { equipped: true, guardian: guardianId, slot: 'aspect', index: aspectIndex };
        }
    }
    
    return { equipped: false };
}

/**
 * Get loadout summary for display
 */
function getLoadoutSummary(state, guardianId) {
    const loadout = getLoadout(state, guardianId);
    const summary = {
        equipment: null,
        aspects: []
    };
    
    if (loadout.equipment) {
        const item = window.itemsData.find(i => i.id === loadout.equipment);
        if (item) {
            summary.equipment = {
                id: item.id,
                name: item.name,
                subtype: item.subtype,
                bonuses: item.mission_bonuses || {}
            };
        }
    }
    
    loadout.aspects.forEach((aspectId, index) => {
        if (aspectId) {
            const item = window.itemsData.find(i => i.id === aspectId);
            if (item) {
                summary.aspects[index] = {
                    id: item.id,
                    name: item.name,
                    subtype: item.subtype,
                    bonuses: item.mission_bonuses || {}
                };
            }
        } else {
            summary.aspects[index] = null;
        }
    });
    
    return summary;
}

console.log('Loadout system loaded.');
