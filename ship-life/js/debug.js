// Ship Life - Debug Menu

/**
 * Toggle debug menu visibility
 */
function toggleDebugMenu() {
    const menu = document.getElementById('debug-menu');
    menu.classList.toggle('hidden');
}

/**
 * Switch debug tab
 */
function switchDebugTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.debug-tab').forEach(tab => {
        tab.classList.toggle('hidden', tab.id !== `debug-${tabName}`);
    });
}

/**
 * Log debug message
 */
function debugLog(message, type = 'info') {
    const output = document.getElementById('debug-output');
    const messageDiv = document.createElement('div');
    messageDiv.className = `debug-message ${type}`;
    messageDiv.textContent = `> ${message}`;
    output.appendChild(messageDiv);
    output.scrollTop = output.scrollHeight;
}

/**
 * Execute debug command
 */
function executeDebugCommand(command) {
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    
    debugLog(command, 'info');
    
    switch (cmd) {
        case 'give_item':
            const itemId = parts[1];
            const amount = parseInt(parts[2]) || 1;
            addToInventory(gameState, itemId, amount);
            autoSave(gameState);
            debugLog(`Added ${amount}x ${itemId}`, 'success');
            break;
            
        case 'remove_item':
            const removeId = parts[1];
            const removeAmount = parseInt(parts[2]) || 1;
            const success = removeFromInventory(gameState, removeId, removeAmount);
            if (success) {
                autoSave(gameState);
                debugLog(`Removed ${removeAmount}x ${removeId}`, 'success');
            } else {
                debugLog(`Failed to remove ${removeId}`, 'error');
            }
            break;
            
        case 'set_flag':
            const flagName = parts[1];
            const flagValue = parts[2] === 'true';
            setFlag(gameState, flagName, flagValue);
            autoSave(gameState);
            debugLog(`Set ${flagName} = ${flagValue}`, 'success');
            break;
            
        case 'clear_flag':
            const clearFlag = parts[1];
            setFlag(gameState, clearFlag, false);
            autoSave(gameState);
            debugLog(`Cleared ${clearFlag}`, 'success');
            break;
            
        case 'set_guardian':
            const guardianId = parts[1];
            gameState.active_guardian = guardianId;
            const guardian = getGuardianById(guardianId);
            updateGuardianDisplay(guardian);
            autoSave(gameState);
            debugLog(`Active Guardian: ${guardianId}`, 'success');
            break;
            
        case 'complete_mission':
            const missionId = parts[1];
            if (!gameState.completed_missions.includes(missionId)) {
                gameState.completed_missions.push(missionId);
                autoSave(gameState);
                debugLog(`Completed mission: ${missionId}`, 'success');
            } else {
                debugLog(`Mission already completed: ${missionId}`, 'error');
            }
            break;
            
        case 'reset_save':
            debugResetSave();
            break;
            
        case 'set_missions_together':
            const pair = parts[1]; // e.g. stella_vawn
            const missions = parseInt(parts[2]) || 0;
            if (!gameState.relationships.missions_together[pair]) {
                gameState.relationships.missions_together[pair] = 0;
            }
            gameState.relationships.missions_together[pair] = missions;
            autoSave(gameState);
            debugLog(`Set ${pair} missions_together = ${missions}`, 'success');
            break;
            
        case 'help':
            debugLog('Available commands:', 'info');
            debugLog('  give_item [id] [amount]', 'info');
            debugLog('  remove_item [id] [amount]', 'info');
            debugLog('  set_flag [name] [true/false]', 'info');
            debugLog('  clear_flag [name]', 'info');
            debugLog('  set_guardian [id]', 'info');
            debugLog('  complete_mission [id]', 'info');
            debugLog('  set_missions_together [pair] [count]', 'info');
            debugLog('  reset_save', 'info');
            break;
            
        default:
            debugLog(`Unknown command: ${cmd}. Type 'help' for commands.`, 'error');
    }
}

/**
 * Initialize debug console
 */
function initializeDebugConsole() {
    const input = document.getElementById('debug-input');
    
    // Make sure input is focusable
    input.addEventListener('click', () => {
        input.focus();
    });
    
    // Auto-focus when debug menu opens
    const debugToggle = document.getElementById('debug-toggle');
    debugToggle.addEventListener('click', () => {
        setTimeout(() => {
            if (!document.getElementById('debug-menu').classList.contains('hidden')) {
                input.focus();
            }
        }, 100);
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            executeDebugCommand(input.value);
            input.value = '';
        }
    });
    
    // Add welcome message
    debugLog('Debug console initialized. Type "help" for commands.', 'info');
}

/**
 * View Blackboard
 */
function debugViewBlackboard() {
    const output = document.getElementById('debug-output');
    output.innerHTML = '';
    debugLog('=== BLACKBOARD STATE ===', 'info');
    debugLog(JSON.stringify(gameState, null, 2), 'info');
}

/**
 * View Inventory
 */
function debugViewInventory() {
    displayInventory();
    const output = document.getElementById('debug-output');
    debugLog('Inventory displayed in browser console', 'success');
}

/**
 * Reset Save
 */
function debugResetSave() {
    resetSave();
}

/**
 * Give 100 of each resource
 */
function debugGiveResources() {
    const resources = window.itemsData.filter(i => i.type === 'resource');
    resources.forEach(resource => {
        addToInventory(gameState, resource.id, 100);
    });
    autoSave(gameState);
    debugLog(`Added 100 of each resource (${resources.length} items)`, 'success');
    showNotification('Resources added!');
}

/**
 * Give ALL items (resources, blueprints, aspects)
 */
function debugGiveAllItems() {
    const allItems = window.itemsData || [];
    let count = 0;
    
    allItems.forEach(item => {
        // Give appropriate amounts based on type
        const amount = item.type === 'resource' ? 50 : 5;
        addToInventory(gameState, item.id, amount);
        count++;
    });
    
    autoSave(gameState);
    debugLog(`Added ALL items: ${count} different items`, 'success');
    showNotification(`All ${count} items added to inventory!`);
}

/**
 * Toggle music on/off
 */
function debugToggleMusic() {
    const enabled = window.audioManager.toggleMusic();
    debugLog(`Music ${enabled ? 'enabled' : 'disabled'}`, 'success');
    const btn = document.getElementById('debug-toggle-music');
    btn.textContent = `Music: ${enabled ? 'ON' : 'OFF'}`;
}

/**
 * Toggle SFX on/off
 */
function debugToggleSFX() {
    const enabled = window.audioManager.toggleSFX();
    debugLog(`SFX ${enabled ? 'enabled' : 'disabled'}`, 'success');
    const btn = document.getElementById('debug-toggle-sfx');
    btn.textContent = `SFX: ${enabled ? 'ON' : 'OFF'}`;
}

/**
 * Test sound effect
 */
function debugTestSFX() {
    window.audioManager.playSFX(SFX.CLICK);
    debugLog('Testing sound effect: click', 'info');
}

/**
 * Validate all data files
 */
function debugValidateData() {
    const output = document.getElementById('debug-output');
    output.innerHTML = '';
    
    debugLog('=== VALIDATING ALL DATA FILES ===', 'info');
    
    const result = window.dataValidator.validateAll();
    
    debugLog('', 'info');
    debugLog(`✓ Validation Complete!`, 'success');
    debugLog(`  Errors: ${result.errors.length}`, result.errors.length > 0 ? 'error' : 'success');
    debugLog(`  Warnings: ${result.warnings.length}`, result.warnings.length > 0 ? 'error' : 'info');
    
    if (result.errors.length > 0) {
        debugLog('', 'info');
        debugLog('=== ERRORS ===', 'error');
        result.errors.forEach(err => {
            debugLog(`[${err.category}] ${err.message}`, 'error');
        });
    }
    
    if (result.warnings.length > 0) {
        debugLog('', 'info');
        debugLog('=== WARNINGS ===', 'error');
        result.warnings.forEach(warn => {
            debugLog(`[${warn.category}] ${warn.message}`, 'error');
        });
    }
    
    if (result.success) {
        debugLog('', 'info');
        debugLog('✅ All data files are valid!', 'success');
        showNotification('Data validation passed!');
    } else {
        showNotification(`Validation failed: ${result.errors.length} errors`, 'error');
    }
}

console.log('Debug system loaded.');
