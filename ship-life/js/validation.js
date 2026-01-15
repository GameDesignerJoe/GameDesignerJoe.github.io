// Ship Life - Data Validation System

/**
 * Data Validator
 * Checks JSON data for errors, missing references, and issues
 */

class DataValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }
    
    /**
     * Clear all errors and warnings
     */
    clear() {
        this.errors = [];
        this.warnings = [];
    }
    
    /**
     * Add an error
     */
    addError(category, message) {
        this.errors.push({ category, message });
        console.error(`[Validation Error] ${category}: ${message}`);
    }
    
    /**
     * Add a warning
     */
    addWarning(category, message) {
        this.warnings.push({ category, message });
        console.warn(`[Validation Warning] ${category}: ${message}`);
    }
    
    /**
     * Validate all game data
     */
    validateAll() {
        this.clear();
        console.log('=== Starting Data Validation ===');
        
        this.validateItems();
        this.validateGuardians();
        this.validateMissions();
        this.validateWorkstations();
        this.validateConversations();
        this.validateRooms();
        
        console.log('=== Validation Complete ===');
        console.log(`Errors: ${this.errors.length}`);
        console.log(`Warnings: ${this.warnings.length}`);
        
        return {
            errors: this.errors,
            warnings: this.warnings,
            success: this.errors.length === 0
        };
    }
    
    /**
     * Validate items data
     */
    validateItems() {
        const items = window.itemsData || [];
        const ids = new Set();
        
        console.log(`Validating ${items.length} items...`);
        
        items.forEach((item, index) => {
            // Check required fields
            if (!item.id) {
                this.addError('Items', `Item at index ${index} missing 'id' field`);
            }
            if (!item.name) {
                this.addError('Items', `Item '${item.id}' missing 'name' field`);
            }
            if (!item.type) {
                this.addError('Items', `Item '${item.id}' missing 'type' field`);
            }
            
            // Check for duplicate IDs
            if (item.id) {
                if (ids.has(item.id)) {
                    this.addError('Items', `Duplicate item ID: '${item.id}'`);
                }
                ids.add(item.id);
            }
            
            // Check icon structure
            if (!item.icon || !item.icon.type) {
                this.addWarning('Items', `Item '${item.id}' has no icon or icon.type`);
            }
        });
    }
    
    /**
     * Validate guardians data
     */
    validateGuardians() {
        const guardians = window.guardiansData || [];
        const ids = new Set();
        
        console.log(`Validating ${guardians.length} guardians...`);
        
        guardians.forEach((guardian, index) => {
            // Check required fields
            if (!guardian.id) {
                this.addError('Guardians', `Guardian at index ${index} missing 'id' field`);
            }
            if (!guardian.name) {
                this.addError('Guardians', `Guardian '${guardian.id}' missing 'name' field`);
            }
            if (!guardian.role) {
                this.addWarning('Guardians', `Guardian '${guardian.id}' missing 'role' field`);
            }
            
            // Check for duplicate IDs
            if (guardian.id) {
                if (ids.has(guardian.id)) {
                    this.addError('Guardians', `Duplicate guardian ID: '${guardian.id}'`);
                }
                ids.add(guardian.id);
            }
            
            // Check portrait structure
            if (!guardian.portrait || !guardian.portrait.type) {
                this.addWarning('Guardians', `Guardian '${guardian.id}' has no portrait or portrait.type`);
            }
        });
    }
    
    /**
     * Validate missions data
     */
    validateMissions() {
        const missions = window.missionsData || [];
        const ids = new Set();
        
        console.log(`Validating ${missions.length} missions...`);
        
        missions.forEach((mission, index) => {
            // Check required fields
            if (!mission.id) {
                this.addError('Missions', `Mission at index ${index} missing 'id' field`);
            }
            if (!mission.name) {
                this.addError('Missions', `Mission '${mission.id}' missing 'name' field`);
            }
            if (mission.difficulty === undefined) {
                this.addWarning('Missions', `Mission '${mission.id}' missing 'difficulty' field`);
            }
            
            // Check for duplicate IDs
            if (mission.id) {
                if (ids.has(mission.id)) {
                    this.addError('Missions', `Duplicate mission ID: '${mission.id}'`);
                }
                ids.add(mission.id);
            }
            
            // Validate rewards
            if (mission.rewards && mission.rewards.length > 0) {
                mission.rewards.forEach(reward => {
                    if (reward.type === 'item' && reward.item) {
                        const itemExists = window.itemsData.some(i => i.id === reward.item);
                        if (!itemExists) {
                            this.addError('Missions', `Mission '${mission.id}' rewards invalid item: '${reward.item}'`);
                        }
                    }
                });
            }
            
            // Validate prerequisites
            if (mission.prerequisites && mission.prerequisites.missions_completed) {
                mission.prerequisites.missions_completed.forEach(prereqId => {
                    const prereqExists = missions.some(m => m.id === prereqId);
                    if (!prereqExists) {
                        this.addError('Missions', `Mission '${mission.id}' has invalid prerequisite: '${prereqId}'`);
                    }
                });
            }
        });
    }
    
    /**
     * Validate workstations data
     */
    validateWorkstations() {
        const workstations = window.workstationsData || [];
        const ids = new Set();
        
        console.log(`Validating ${workstations.length} workstations...`);
        
        workstations.forEach((ws, index) => {
            // Check required fields
            if (!ws.id) {
                this.addError('Workstations', `Workstation at index ${index} missing 'id' field`);
            }
            if (!ws.name) {
                this.addError('Workstations', `Workstation '${ws.id}' missing 'name' field`);
            }
            
            // Check for duplicate IDs
            if (ws.id) {
                if (ids.has(ws.id)) {
                    this.addError('Workstations', `Duplicate workstation ID: '${ws.id}'`);
                }
                ids.add(ws.id);
            }
            
            // Validate recipes
            if (ws.recipes && ws.recipes.length > 0) {
                ws.recipes.forEach(recipe => {
                    // Check recipe cost items
                    if (recipe.cost) {
                        recipe.cost.forEach(cost => {
                            const itemExists = window.itemsData.some(i => i.id === cost.item);
                            if (!itemExists) {
                                this.addError('Workstations', `Recipe '${recipe.id}' in '${ws.id}' requires invalid item: '${cost.item}'`);
                            }
                        });
                    }
                    
                    // Check recipe output
                    if (recipe.output && recipe.output.item) {
                        const itemExists = window.itemsData.some(i => i.id === recipe.output.item);
                        if (!itemExists) {
                            this.addError('Workstations', `Recipe '${recipe.id}' in '${ws.id}' outputs invalid item: '${recipe.output.item}'`);
                        }
                    }
                    
                    // Check blueprint requirement
                    if (recipe.blueprint_required) {
                        const blueprintExists = window.itemsData.some(i => i.id === recipe.blueprint_required && i.type === 'blueprint');
                        if (!blueprintExists) {
                            this.addError('Workstations', `Recipe '${recipe.id}' requires invalid blueprint: '${recipe.blueprint_required}'`);
                        }
                    }
                });
            }
        });
    }
    
    /**
     * Validate conversations data
     */
    validateConversations() {
        const conversations = window.conversationsData || [];
        const ids = new Set();
        const guardianIds = window.guardiansData.map(g => g.id);
        
        console.log(`Validating ${conversations.length} conversations...`);
        
        conversations.forEach((conv, index) => {
            // Check required fields
            if (!conv.id) {
                this.addError('Conversations', `Conversation at index ${index} missing 'id' field`);
            }
            if (!conv.title) {
                this.addWarning('Conversations', `Conversation '${conv.id}' missing 'title' field`);
            }
            
            // Check for duplicate IDs
            if (conv.id) {
                if (ids.has(conv.id)) {
                    this.addError('Conversations', `Duplicate conversation ID: '${conv.id}'`);
                }
                ids.add(conv.id);
            }
            
            // Validate participants
            if (conv.participants) {
                conv.participants.forEach(participantId => {
                    if (!guardianIds.includes(participantId)) {
                        this.addError('Conversations', `Conversation '${conv.id}' has invalid participant: '${participantId}'`);
                    }
                });
            }
            
            // Check dialogue/lines structure
            if (!conv.dialogue && !conv.lines) {
                this.addError('Conversations', `Conversation '${conv.id}' has no dialogue or lines`);
            } else if (conv.dialogue && conv.dialogue.length === 0) {
                this.addError('Conversations', `Conversation '${conv.id}' has empty dialogue array`);
            } else if (conv.lines && conv.lines.length === 0) {
                this.addError('Conversations', `Conversation '${conv.id}' has empty lines array`);
            }
        });
    }
    
    /**
     * Validate rooms data
     */
    validateRooms() {
        const rooms = window.roomsData || [];
        const ids = new Set();
        
        console.log(`Validating ${rooms.length} rooms...`);
        
        rooms.forEach((room, index) => {
            // Check required fields
            if (!room.id) {
                this.addError('Rooms', `Room at index ${index} missing 'id' field`);
            }
            if (!room.name) {
                this.addError('Rooms', `Room '${room.id}' missing 'name' field`);
            }
            
            // Check for duplicate IDs
            if (room.id) {
                if (ids.has(room.id)) {
                    this.addError('Rooms', `Duplicate room ID: '${room.id}'`);
                }
                ids.add(room.id);
            }
        });
    }
}

// Initialize validator
window.dataValidator = new DataValidator();

console.log('Data validation system loaded.');
