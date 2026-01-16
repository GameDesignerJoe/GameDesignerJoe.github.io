// Ship Life - Workstation and Crafting System

let currentWorkstation = null;

/**
 * Open workstation sidebar
 */
function openWorkstation(workstation) {
    currentWorkstation = workstation;
    const sidebar = document.getElementById('workstation-sidebar');
    sidebar.classList.remove('hidden');
    
    const title = document.getElementById('workstation-title');
    const currentLevel = gameState.workstations[workstation.id]?.level || 1;
    title.textContent = workstation.level_names[currentLevel] || workstation.name;
    
    // Special handling for Knowledge Base
    if (workstation.id === 'knowledge_base') {
        renderKnowledgeBase();
    } else {
        renderRecipeList(workstation);
        
        // Clear details panel
        const detailsPanel = document.getElementById('recipe-details');
        detailsPanel.innerHTML = '<p class="select-prompt">Select a recipe or upgrade to view details</p>';
    }
}

/**
 * Render recipe list
 */
function renderRecipeList(workstation) {
    const recipeList = document.getElementById('recipe-list');
    recipeList.innerHTML = '';
    
    const currentLevel = gameState.workstations[workstation.id]?.level || 1;
    
    // Add upgrade option if not at max level
    if (currentLevel < workstation.max_level) {
        const upgrade = createUpgradeItem(workstation, currentLevel);
        recipeList.appendChild(upgrade);
    }
    
    // Add all recipes
    workstation.recipes.forEach(recipe => {
        const item = createRecipeItem(recipe, workstation);
        recipeList.appendChild(item);
    });
}

/**
 * Create upgrade list item
 */
function createUpgradeItem(workstation, currentLevel) {
    const div = document.createElement('div');
    div.className = 'recipe-item';
    
    const targetLevel = currentLevel + 1;
    const upgradeCost = workstation.upgrade_costs.find(u => u.level === targetLevel);
    
    // Check if player can afford upgrade
    const canAfford = hasResources(gameState, upgradeCost.resources);
    if (!canAfford) {
        div.classList.add('grayed-out');
    }
    
    div.innerHTML = `
        <div class="recipe-item-name">⬆️ Upgrade to Level ${targetLevel}</div>
        <div class="recipe-item-level">${workstation.level_names[targetLevel] || `Level ${targetLevel}`}</div>
    `;
    
    div.onclick = () => showUpgradeDetails(workstation, currentLevel, upgradeCost);
    
    return div;
}

/**
 * Create recipe list item
 */
function createRecipeItem(recipe, workstation) {
    const div = document.createElement('div');
    div.className = 'recipe-item';
    
    const currentLevel = gameState.workstations[workstation.id]?.level || 1;
    const canCraft = canCraftRecipe(recipe, workstation, gameState);
    
    if (!canCraft) {
        div.classList.add('grayed-out');
    }
    
    div.innerHTML = `
        <div class="recipe-item-name">${recipe.name}</div>
        <div class="recipe-item-level">Requires Level ${recipe.required_level}</div>
    `;
    
    div.onclick = () => showRecipeDetails(recipe, workstation);
    
    return div;
}

/**
 * Check if recipe can be crafted
 */
function canCraftRecipe(recipe, workstation, state) {
    const currentLevel = state.workstations[workstation.id]?.level || 1;
    
    // Check workstation level
    if (currentLevel < recipe.required_level) {
        return false;
    }
    
    // Check blueprint
    if (recipe.blueprint_required) {
        if (!state.learned_blueprints.includes(recipe.blueprint_required)) {
            return false;
        }
    }
    
    // Check resources
    return hasResources(state, recipe.cost);
}

/**
 * Show upgrade details
 */
function showUpgradeDetails(workstation, currentLevel, upgradeCost) {
    const detailsPanel = document.getElementById('recipe-details');
    
    const targetLevel = currentLevel + 1;
    const canAfford = hasResources(gameState, upgradeCost.resources);
    
    let html = `
        <h3>Upgrade to Level ${targetLevel}</h3>
        <p>${workstation.level_names[targetLevel] || `Level ${targetLevel}`}</p>
        
        <div class="requirements-section">
            <h4>Required Resources</h4>
    `;
    
    upgradeCost.resources.forEach(req => {
        const owned = gameState.inventory[req.item] || 0;
        const sufficient = owned >= req.amount;
        const item = window.itemsData.find(i => i.id === req.item);
        const itemName = item ? item.name : req.item;
        
        html += `
            <div class="requirement-item">
                <span class="requirement-label">${itemName}</span>
                <span class="requirement-value ${sufficient ? '' : 'insufficient'}">${owned}/${req.amount}</span>
            </div>
        `;
    });
    
    html += `
        </div>
        <button class="craft-button" ${canAfford ? '' : 'disabled'} onclick="upgradeWorkstation()">
            Upgrade Workstation
        </button>
    `;
    
    detailsPanel.innerHTML = html;
}

/**
 * Show recipe details
 */
function showRecipeDetails(recipe, workstation) {
    const detailsPanel = document.getElementById('recipe-details');
    
    const currentLevel = gameState.workstations[workstation.id]?.level || 1;
    const canCraft = canCraftRecipe(recipe, workstation, gameState);
    
    let html = `
        <h3>${recipe.name}</h3>
        <p>${recipe.description || 'No description available.'}</p>
        
        <div class="requirements-section">
            <h4>Requirements</h4>
            
            <div class="requirement-item">
                <span class="requirement-label">Workstation Level</span>
                <span class="requirement-value ${currentLevel >= recipe.required_level ? '' : 'insufficient'}">
                    ${currentLevel}/${recipe.required_level}
                </span>
            </div>
    `;
    
    // Check blueprint
    if (recipe.blueprint_required) {
        const hasBlueprint = gameState.learned_blueprints.includes(recipe.blueprint_required);
        html += `
            <div class="requirement-item">
                <span class="requirement-label">Blueprint</span>
                <span class="requirement-value ${hasBlueprint ? '' : 'insufficient'}">
                    ${hasBlueprint ? '✓' : '✗'}
                </span>
            </div>
        `;
    }
    
    html += '<h4>Required Resources</h4>';
    
    recipe.cost.forEach(req => {
        const owned = gameState.inventory[req.item] || 0;
        const sufficient = owned >= req.amount;
        const item = window.itemsData.find(i => i.id === req.item);
        const itemName = item ? item.name : req.item;
        
        html += `
            <div class="requirement-item">
                <span class="requirement-label">${itemName}</span>
                <span class="requirement-value ${sufficient ? '' : 'insufficient'}">${owned}/${req.amount}</span>
            </div>
        `;
    });
    
    html += `
        </div>
        <button class="craft-button" ${canCraft ? '' : 'disabled'} 
                onclick="craftItem('${recipe.id}')">
            Craft ${recipe.name}
        </button>
    `;
    
    detailsPanel.innerHTML = html;
}

/**
 * Craft an item
 */
function craftItem(recipeId) {
    const recipe = currentWorkstation.recipes.find(r => r.id === recipeId);
    if (!recipe) {
        console.error('Recipe not found:', recipeId);
        return;
    }
    
    if (!canCraftRecipe(recipe, currentWorkstation, gameState)) {
        showNotification('Cannot craft this item', 'error');
        return;
    }
    
    // Deduct resources
    recipe.cost.forEach(req => {
        removeFromInventory(gameState, req.item, req.amount);
    });
    
    // Add output
    addToInventory(gameState, recipe.output.item, recipe.output.amount);
    
    // Auto-save
    autoSave(gameState);
    
    // Show notification
    showNotification(`Crafted: ${recipe.name}`);
    
    // Refresh displays
    openWorkstation(currentWorkstation);
}

/**
 * Upgrade workstation
 */
function upgradeWorkstation() {
    const currentLevel = gameState.workstations[currentWorkstation.id]?.level || 1;
    
    if (currentLevel >= currentWorkstation.max_level) {
        showNotification('Workstation already at max level', 'error');
        return;
    }
    
    const targetLevel = currentLevel + 1;
    const upgradeCost = currentWorkstation.upgrade_costs.find(u => u.level === targetLevel);
    
    if (!hasResources(gameState, upgradeCost.resources)) {
        showNotification('Insufficient resources', 'error');
        return;
    }
    
    // Deduct resources
    upgradeCost.resources.forEach(req => {
        removeFromInventory(gameState, req.item, req.amount);
    });
    
    // Increment level
    gameState.workstations[currentWorkstation.id].level = targetLevel;
    
    // Auto-save
    autoSave(gameState);
    
    // Show notification
    showNotification(`Upgraded to ${currentWorkstation.level_names[targetLevel] || `Level ${targetLevel}`}!`);
    
    // Refresh workstation room display (updates the card level)
    if (currentRoom && currentRoom.id === 'workstation_room') {
        const container = document.getElementById('room-container');
        clearRoom();
        renderWorkstationRoom(container);
    }
    
    // Refresh sidebar
    openWorkstation(currentWorkstation);
}

/**
 * Render Knowledge Base UI
 */
function renderKnowledgeBase() {
    const recipeList = document.getElementById('recipe-list');
    const detailsPanel = document.getElementById('recipe-details');
    
    // Get all blueprint items
    const allBlueprints = window.itemsData.filter(item => item.type === 'blueprint');
    
    // Separate into learned and unlearned
    const unlearned = allBlueprints.filter(bp => {
        const inInventory = gameState.inventory[bp.id] && gameState.inventory[bp.id] > 0;
        const alreadyLearned = gameState.learned_blueprints.includes(bp.id);
        return inInventory && !alreadyLearned;
    });
    
    const learned = allBlueprints.filter(bp => gameState.learned_blueprints.includes(bp.id));
    
    // Render left panel (available blueprints)
    recipeList.innerHTML = '<h3 style="padding: 10px; margin: 0; border-bottom: 2px solid var(--primary);">Available Blueprints</h3>';
    
    if (unlearned.length === 0) {
        recipeList.innerHTML += '<p style="padding: 15px; opacity: 0.6;">No blueprints in inventory</p>';
    } else {
        unlearned.forEach(bp => {
            const div = document.createElement('div');
            div.className = 'recipe-item';
            div.innerHTML = `
                <div class="recipe-item-name">${bp.name}</div>
                <div class="recipe-item-level">Ready to Upload</div>
            `;
            div.onclick = () => showBlueprintDetails(bp);
            recipeList.appendChild(div);
        });
    }
    
    // Render right panel (learned blueprints)
    detailsPanel.innerHTML = `
        <h3>Learned Blueprints</h3>
        <p>These blueprints have been uploaded to the Knowledge Base.</p>
        <div style="max-height: 400px; overflow-y: auto; margin-top: 15px;">
    `;
    
    if (learned.length === 0) {
        detailsPanel.innerHTML += '<p style="opacity: 0.6;">No blueprints learned yet</p>';
    } else {
        learned.forEach(bp => {
            detailsPanel.innerHTML += `
                <div style="padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.05); border-radius: 6px;">
                    <div style="font-weight: 600;">${bp.name}</div>
                    <div style="font-size: 12px; opacity: 0.7;">✓ Uploaded</div>
                </div>
            `;
        });
    }
    
    detailsPanel.innerHTML += '</div>';
}

/**
 * Show blueprint details
 */
function showBlueprintDetails(blueprint) {
    const detailsPanel = document.getElementById('recipe-details');
    
    detailsPanel.innerHTML = `
        <h3>${blueprint.name}</h3>
        <p>${blueprint.description}</p>
        
        <div class="requirements-section">
            <h4>Blueprint Information</h4>
            <div class="requirement-item">
                <span class="requirement-label">Status</span>
                <span class="requirement-value">In Inventory</span>
            </div>
            <div class="requirement-item">
                <span class="requirement-label">Quantity</span>
                <span class="requirement-value">${gameState.inventory[blueprint.id] || 0}</span>
            </div>
        </div>
        
        <button class="craft-button" onclick="uploadBlueprint('${blueprint.id}')">
            Upload to Knowledge Base
        </button>
        
        <p style="margin-top: 15px; font-size: 13px; opacity: 0.7;">
            Uploading this blueprint will unlock its associated recipe in other workstations.
        </p>
    `;
}

/**
 * Upload blueprint to Knowledge Base
 */
function uploadBlueprint(blueprintId) {
    // Check if player has the blueprint
    if (!gameState.inventory[blueprintId] || gameState.inventory[blueprintId] <= 0) {
        showNotification('Blueprint not in inventory', 'error');
        return;
    }
    
    // Check if already learned
    if (gameState.learned_blueprints.includes(blueprintId)) {
        showNotification('Blueprint already uploaded', 'error');
        return;
    }
    
    // Remove from inventory
    removeFromInventory(gameState, blueprintId, 1);
    
    // Add to learned blueprints
    if (!gameState.learned_blueprints.includes(blueprintId)) {
        gameState.learned_blueprints.push(blueprintId);
    }
    
    // Auto-save
    autoSave(gameState);
    
    // Get blueprint name
    const blueprint = window.itemsData.find(item => item.id === blueprintId);
    const blueprintName = blueprint ? blueprint.name : blueprintId;
    
    // Show notification
    showNotification(`Uploaded: ${blueprintName}`);
    
    // Refresh Knowledge Base display
    renderKnowledgeBase();
}

console.log('Workstation system loaded.');
