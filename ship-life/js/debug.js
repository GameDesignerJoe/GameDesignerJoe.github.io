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
            
        case 'help':
            debugLog('Available commands:', 'info');
            debugLog('  give_item [id] [amount]', 'info');
            debugLog('  remove_item [id] [amount]', 'info');
            debugLog('  set_flag [name] [true/false]', 'info');
            debugLog('  clear_flag [name]', 'info');
            debugLog('  set_guardian [id]', 'info');
            debugLog('  complete_mission [id]', 'info');
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

console.log('Debug system loaded.');
