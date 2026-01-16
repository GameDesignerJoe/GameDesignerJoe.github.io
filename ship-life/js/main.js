// Ship Life - Main Initialization

/**
 * Load all JSON data files
 */
async function loadAllData() {
    try {
        const [rooms, missions, guardians, items, workstations, conversations, trophies, anomalies] = await Promise.all([
            fetch('data/rooms.json').then(r => r.json()),
            fetch('data/missions.json').then(r => r.json()),
            fetch('data/guardians.json').then(r => r.json()),
            fetch('data/items.json').then(r => r.json()),
            fetch('data/workstations.json').then(r => r.json()),
            fetch('data/conversations.json').then(r => r.json()),
            fetch('data/trophies.json').then(r => r.json()),
            fetch('data/anomalies.json').then(r => r.json())
        ]);
        
        return { rooms, missions, guardians, items, workstations, conversations, trophies, anomalies };
    } catch (error) {
        console.error('Failed to load data files:', error);
        alert('Failed to load game data. Please refresh the page.');
        throw error;
    }
}

/**
 * Initialize the game
 */
async function initializeGame() {
    console.log('Initializing Ship Life...');
    
    // Load all data
    const data = await loadAllData();
    
    // Store data in window for global access
    window.roomsData = data.rooms.rooms;
    window.missionsData = data.missions.missions;
    window.guardiansData = data.guardians.guardians;
    window.itemsData = data.items.items;
    window.workstationsData = data.workstations.workstations;
    window.conversationsData = data.conversations.conversations;
    window.anomaliesData = data.anomalies.anomalies;
    trophiesData = data.trophies;
    
    // Get blueprints from items (they're stored as type: "blueprint")
    window.blueprintsData = window.itemsData.filter(item => item.type === 'blueprint');
    
    roomsData = window.roomsData;
    
    console.log('Data loaded successfully');
    console.log(`- ${roomsData.length} rooms`);
    console.log(`- ${window.missionsData.length} missions`);
    console.log(`- ${window.guardiansData.length} guardians`);
    console.log(`- ${window.itemsData.length} items`);
    console.log(`- ${window.workstationsData.length} workstations`);
    console.log(`- ${window.blueprintsData.length} blueprints`);
    console.log(`- ${window.conversationsData.length} conversations`);
    console.log(`- ${window.anomaliesData.length} anomalies`);
    console.log(`- ${trophiesData.length} trophies`);
    
    // Load or create save
    gameState = loadSave();
    
    // Initialize starting content
    initializeStartingBlueprints(gameState, window.blueprintsData);
    initializeWorkstations(gameState, window.workstationsData);
    
    // Auto-save after initialization
    autoSave(gameState);
    
    // Initialize navigation
    initializeNavigation(roomsData);
    
    // Initialize debug console
    initializeDebugConsole();
    
    // Check if player has active guardian and go to appropriate room
    if (gameState.active_guardian) {
        const guardian = getGuardianById(gameState.active_guardian);
        updateGuardianDisplay(guardian);
        
        // Show navigation
        const navBar = document.getElementById('navigation-bar');
        navBar.classList.remove('hidden');
        
        // Go to last room or mission computer
        switchRoom(gameState.last_room || 'mission_computer');
    } else {
        // No guardian selected, go to character select
        switchRoom('character_select');
    }
    
    console.log('Ship Life initialized successfully!');
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

console.log('Main system loaded.');
