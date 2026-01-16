// Ship Life - Trophy System

let trophiesData = null;

/**
 * Check if a trophy is unlocked
 */
function isTrophyUnlocked(trophy, state) {
    const req = trophy.requirement;
    
    switch (req.type) {
        case 'missions_completed':
            const completed = state.completed_missions?.length || 0;
            return completed >= req.count;
            
        case 'perfect_streak':
            // Check if player has completed X missions with 100% success
            const totalRun = state.total_missions_run || 0;
            const totalCompleted = state.completed_missions?.length || 0;
            return totalRun >= req.count && totalCompleted >= req.count && totalRun === totalCompleted;
            
        case 'mission_type':
            // Count missions of specific type
            const missions = window.missionsData || [];
            let typeCount = 0;
            state.completed_missions?.forEach(missionId => {
                const mission = missions.find(m => m.id === missionId);
                if (mission && mission.mission_type === req.mission_type) {
                    typeCount++;
                }
            });
            return typeCount >= req.count;
            
        case 'squad_size':
            // Check if player has ever used a squad of this size
            // Would need to track this in mission history
            return state.flags?.[`squad_size_${req.size}`] || false;
            
        case 'solo_difficult':
            // Check if player completed difficult mission solo
            return state.flags?.solo_difficult || false;
            
        case 'full_loadouts':
            // Check if all guardians have full loadouts
            const guardians = window.guardiansData || [];
            let fullCount = 0;
            guardians.forEach(guardian => {
                const loadout = getLoadout(state, guardian.id);
                const equipped = (loadout.equipment ? 1 : 0) + loadout.aspects.filter(a => a).length;
                if (equipped === 4) fullCount++;
            });
            return fullCount >= req.count;
            
        case 'unique_crafts':
            // Check unique items crafted
            const crafted = state.crafted_items || {};
            return Object.keys(crafted).length >= req.count;
            
        case 'rare_items':
            // Count rare items in inventory (placeholder - needs rarity system)
            return false; // Not implemented yet
            
        case 'conversations':
            // Check conversations completed
            const convos = state.completed_conversations?.length || 0;
            return convos >= req.count;
            
        default:
            console.warn('Unknown trophy requirement type:', req.type);
            return false;
    }
}

/**
 * Get trophy progress (0-100)
 */
function getTrophyProgress(trophy, state) {
    const req = trophy.requirement;
    
    switch (req.type) {
        case 'missions_completed':
            const completed = state.completed_missions?.length || 0;
            return Math.min(100, Math.round((completed / req.count) * 100));
            
        case 'perfect_streak':
            const totalRun = state.total_missions_run || 0;
            return Math.min(100, Math.round((totalRun / req.count) * 100));
            
        case 'mission_type':
            const missions = window.missionsData || [];
            let typeCount = 0;
            state.completed_missions?.forEach(missionId => {
                const mission = missions.find(m => m.id === missionId);
                if (mission && mission.mission_type === req.mission_type) {
                    typeCount++;
                }
            });
            return Math.min(100, Math.round((typeCount / req.count) * 100));
            
        case 'squad_size':
        case 'solo_difficult':
            return isTrophyUnlocked(trophy, state) ? 100 : 0;
            
        case 'full_loadouts':
            const guardians = window.guardiansData || [];
            let fullCount = 0;
            guardians.forEach(guardian => {
                const loadout = getLoadout(state, guardian.id);
                const equipped = (loadout.equipment ? 1 : 0) + loadout.aspects.filter(a => a).length;
                if (equipped === 4) fullCount++;
            });
            return Math.min(100, Math.round((fullCount / req.count) * 100));
            
        case 'unique_crafts':
            const crafted = state.crafted_items || {};
            const uniqueCount = Object.keys(crafted).length;
            return Math.min(100, Math.round((uniqueCount / req.count) * 100));
            
        case 'rare_items':
            return 0; // Not implemented yet
            
        case 'conversations':
            const convos = state.completed_conversations?.length || 0;
            return Math.min(100, Math.round((convos / req.count) * 100));
            
        default:
            return 0;
    }
}

/**
 * Check for newly unlocked trophies and show notifications
 */
function checkNewTrophies(state) {
    if (!trophiesData) return;
    
    // Track which trophies have been notified
    if (!state.notified_trophies) {
        state.notified_trophies = [];
    }
    
    trophiesData.forEach(trophy => {
        if (isTrophyUnlocked(trophy, state) && !state.notified_trophies.includes(trophy.id)) {
            showNotification(`🏆 Trophy Unlocked: ${trophy.name}!`, 'success');
            state.notified_trophies.push(trophy.id);
            autoSave(state);
        }
    });
}

/**
 * Get all trophies with unlock status
 */
function getTrophiesWithStatus(state) {
    if (!trophiesData) return [];
    
    return trophiesData.map(trophy => ({
        ...trophy,
        unlocked: isTrophyUnlocked(trophy, state),
        progress: getTrophyProgress(trophy, state)
    }));
}

console.log('Trophy system loaded.');
