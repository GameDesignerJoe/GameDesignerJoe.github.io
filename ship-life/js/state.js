// Ship Life - State Management (Blackboard System)

const SAVE_KEY = 'shiplife_save';
const SAVE_VERSION = '1.0';

// Global game state
let gameState = null;

/**
 * Create a new blank save state
 */
function createNewSave() {
    return {
        version: SAVE_VERSION,
        active_guardian: null,
        last_room: 'landing_page',
        inventory: {
            plasma_cell: 20,
            metal_parts: 15,
            common_alloy: 10,
            battery: 5
        },
        workstations: {},
        learned_blueprints: [
            'blueprint_basic_rifle',
            'blueprint_basic_shield'
        ],
        completed_missions: [],
        total_missions_run: 0,
        mission_counters: {
            total: 0
        },
        relationships: {
            missions_together: {},
            conversations_completed: {}
        },
        completed_conversations: [],
        flags: {},
        loadouts: {
            stella: { equipment: null, aspects: [null, null, null] },
            vawn: { equipment: null, aspects: [null, null, null] },
            tiberius: { equipment: null, aspects: [null, null, null] },
            maestra: { equipment: null, aspects: [null, null, null] }
        }
    };
}

/**
 * Load save from localStorage
 */
function loadSave() {
    try {
        const saveData = localStorage.getItem(SAVE_KEY);
        if (!saveData) {
            console.log('No save file found. Creating new save.');
            return createNewSave();
        }
        
        const parsed = JSON.parse(saveData);
        
        // Ensure loadouts exist (backward compatibility)
        if (!parsed.loadouts) {
            parsed.loadouts = {
                stella: { equipment: null, aspects: [null, null, null] },
                vawn: { equipment: null, aspects: [null, null, null] },
                tiberius: { equipment: null, aspects: [null, null, null] },
                maestra: { equipment: null, aspects: [null, null, null] }
            };
            console.log('Loadouts initialized for existing save.');
        }
        
        console.log('Save file loaded successfully.');
        return parsed;
    } catch (error) {
        console.error('Save file corrupted:', error);
        alert('Save file corrupted. Starting fresh.');
        localStorage.removeItem(SAVE_KEY);
        return createNewSave();
    }
}

/**
 * Save state to localStorage
 */
function autoSave(state) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state, null, 2));
        return true;
    } catch (error) {
        console.error('Save failed:', error);
        showNotification('Unable to save progress. Check browser storage.', 'error');
        return false;
    }
}

/**
 * Initialize starting blueprints
 */
function initializeStartingBlueprints(state, blueprints) {
    if (state.learned_blueprints.length === 0) {
        const startingBlueprints = blueprints.filter(bp => bp.unlocked_at_start);
        state.learned_blueprints = startingBlueprints.map(bp => bp.id);
        console.log('Starting blueprints initialized:', state.learned_blueprints);
    }
}

/**
 * Initialize workstation levels
 */
function initializeWorkstations(state, workstations) {
    workstations.forEach(ws => {
        if (!state.workstations[ws.id]) {
            state.workstations[ws.id] = { level: 1 };
        }
    });
}

/**
 * Generate relationship key (alphabetically sorted)
 */
function getRelationshipKey(guardian1, guardian2) {
    const sorted = [guardian1, guardian2].sort();
    return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Add item to inventory
 */
function addToInventory(state, itemId, quantity) {
    if (!state.inventory[itemId]) {
        state.inventory[itemId] = 0;
    }
    state.inventory[itemId] += quantity;
}

/**
 * Remove item from inventory
 */
function removeFromInventory(state, itemId, quantity) {
    if (!state.inventory[itemId]) {
        return false;
    }
    
    if (state.inventory[itemId] < quantity) {
        return false;
    }
    
    state.inventory[itemId] -= quantity;
    
    // Clean up zero quantities
    if (state.inventory[itemId] <= 0) {
        delete state.inventory[itemId];
    }
    
    return true;
}

/**
 * Check if player has enough resources
 */
function hasResources(state, requirements) {
    for (const req of requirements) {
        const owned = state.inventory[req.item] || 0;
        if (owned < req.amount) {
            return false;
        }
    }
    return true;
}

/**
 * Set a flag
 */
function setFlag(state, flagName, value = true) {
    state.flags[flagName] = value;
}

/**
 * Check if flag is set
 */
function hasFlag(state, flagName) {
    return state.flags[flagName] === true;
}

/**
 * Increment mission counter
 */
function incrementMissionCounter(state, guardianId = null) {
    state.mission_counters.total++;
    
    if (guardianId) {
        if (!state.mission_counters[guardianId]) {
            state.mission_counters[guardianId] = 0;
        }
        state.mission_counters[guardianId]++;
    }
}

/**
 * Increment missions_together for Guardian pairs
 */
function incrementMissionsTogether(state, guardians) {
    // Generate all pairs
    for (let i = 0; i < guardians.length; i++) {
        for (let j = i + 1; j < guardians.length; j++) {
            const key = getRelationshipKey(guardians[i], guardians[j]);
            if (!state.relationships.missions_together[key]) {
                state.relationships.missions_together[key] = 0;
            }
            state.relationships.missions_together[key]++;
        }
    }
}

/**
 * Increment relationship points between two guardians
 * @param {Object} state - Game state
 * @param {string} guardian1 - First guardian ID
 * @param {string} guardian2 - Second guardian ID
 * @param {number} amount - Amount to increment (default 1)
 */
function incrementRelationship(state, guardian1, guardian2, amount = 1) {
    const key = getRelationshipKey(guardian1, guardian2);
    if (!state.relationships.missions_together[key]) {
        state.relationships.missions_together[key] = 0;
    }
    state.relationships.missions_together[key] += amount;
    console.log(`Relationship increased: ${guardian1} & ${guardian2} (+${amount}) = ${state.relationships.missions_together[key]}`);
}

/**
 * Reset save (debug function)
 */
function resetSave() {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
    }
}

/**
 * Export save as JSON file
 */
function exportSave() {
    const saveData = localStorage.getItem(SAVE_KEY);
    if (!saveData) {
        alert('No save file to export.');
        return;
    }
    
    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shiplife_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Import save from JSON file
 */
function importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const saveData = JSON.parse(event.target.result);
                localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
                alert('Save imported successfully. Reloading...');
                location.reload();
            } catch (error) {
                alert('Invalid save file.');
                console.error(error);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

console.log('State management system loaded.');
