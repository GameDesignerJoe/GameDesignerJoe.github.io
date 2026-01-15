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
    
    renderRecipeList(workstation);
    
    // Clear details panel
    const detailsPanel = document.getElementById('recipe-details');
    detailsPanel.innerHTML = '<p class="select-prompt">Select a recipe or upgrade to view details</p>';
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
    
    // Refresh displays
    openWorkstation(currentWorkstation);
}

console.log('Workstation system loaded.');
