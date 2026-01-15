// Ship Life - Room System and Navigation

let roomsData = null;
let currentRoom = null;

/**
 * Initialize navigation bar
 */
function initializeNavigation(rooms) {
    const navBar = document.getElementById('navigation-bar');
    navBar.innerHTML = '';
    
    // Filter out landing_page and character_select from nav
    const navRooms = rooms.filter(r => 
        r.id !== 'landing_page' && r.id !== 'character_select'
    );
    
    navRooms.forEach(room => {
        const button = document.createElement('button');
        button.className = 'nav-button';
        button.textContent = room.name;
        button.dataset.room = room.id;
        button.onclick = () => switchRoom(room.id);
        navBar.appendChild(button);
    });
}

/**
 * Switch to a different room
 */
function switchRoom(roomId) {
    const room = roomsData.find(r => r.id === roomId);
    if (!room) {
        console.error('Room not found:', roomId);
        return;
    }
    
    // Close any open sidebars/modals
    closeSidebar();
    
    // Update current room
    currentRoom = room;
    
    // Set background
    setRoomBackground(room.background);
    
    // Set title
    if (room.title_display) {
        setRoomTitle(room.name);
    } else {
        setRoomTitle('', false);
    }
    
    // Clear and render room content
    clearRoom();
    renderRoom(room);
    
    // Update nav highlight
    updateNavHighlight(roomId);
    
    // Save last room
    if (gameState && gameState.active_guardian) {
        gameState.last_room = roomId;
        autoSave(gameState);
    }
    
    console.log('Switched to room:', roomId);
}

/**
 * Update navigation highlight
 */
function updateNavHighlight(roomId) {
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.room === roomId);
    });
}

/**
 * Render room content based on room type
 */
function renderRoom(room) {
    const container = document.getElementById('room-container');
    
    switch (room.id) {
        case 'landing_page':
            renderLandingPage(container);
            break;
        case 'character_select':
            renderCharacterSelect(container);
            break;
        case 'mission_computer':
            renderMissionComputer(container);
            break;
        case 'workstation_room':
            renderWorkstationRoom(container);
            break;
        case 'planetfall_portal':
            renderPlanetfallPortal(container);
            break;
        case 'character_room':
            renderCharacterRoom(container);
            break;
        case 'inventory':
            renderInventory(container);
            break;
        case 'observation_deck':
            renderObservationDeck(container);
            break;
        default:
            container.innerHTML = '<p>Room under construction...</p>';
    }
}

/**
 * Render Landing Page
 */
function renderLandingPage(container) {
    // Landing page should auto-transition, so just return empty
    // The main.js will handle the initial room switching
    container.className = 'landing-page';
    container.innerHTML = '<p style="opacity: 0;">Loading...</p>';
}

/**
 * Render Character Select
 */
function renderCharacterSelect(container) {
    container.className = 'character-select';
    
    const title = document.createElement('h2');
    title.textContent = 'Select Your Guardian';
    container.appendChild(title);
    
    const grid = document.createElement('div');
    grid.className = 'guardian-grid';
    
    // Get guardians data
    const guardians = window.guardiansData || [];
    
    guardians.forEach(guardian => {
        const card = document.createElement('div');
        card.className = 'guardian-card';
        
        const portrait = document.createElement('div');
        portrait.className = 'guardian-card-portrait';
        renderVisual(guardian.portrait, portrait);
        if (guardian.portrait.show_name) {
            portrait.textContent = guardian.name;
        }
        
        const name = document.createElement('div');
        name.className = 'guardian-card-name';
        name.textContent = guardian.name;
        
        const role = document.createElement('div');
        role.className = 'guardian-card-role';
        role.textContent = guardian.role;
        
        card.appendChild(portrait);
        card.appendChild(name);
        card.appendChild(role);
        
        card.onclick = () => selectGuardian(guardian);
        
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

/**
 * Select a Guardian
 */
function selectGuardian(guardian) {
    gameState.active_guardian = guardian.id;
    autoSave(gameState);
    
    // Update display
    updateGuardianDisplay(guardian);
    
    // Show navigation
    const navBar = document.getElementById('navigation-bar');
    navBar.classList.remove('hidden');
    
    // Go to mission computer
    switchRoom('mission_computer');
    
    showNotification(`${guardian.name} selected!`);
}

/**
 * Render Character Room (for switching Guardians during gameplay)
 */
function renderCharacterRoom(container) {
    container.className = 'character-select';
    
    const title = document.createElement('h2');
    title.textContent = 'Switch Guardian';
    container.appendChild(title);
    
    const grid = document.createElement('div');
    grid.className = 'guardian-grid';
    
    // Get guardians data
    const guardians = window.guardiansData || [];
    
    guardians.forEach(guardian => {
        const card = document.createElement('div');
        card.className = 'guardian-card';
        
        // Highlight active Guardian
        if (guardian.id === gameState.active_guardian) {
            card.style.borderColor = 'var(--success)';
            card.style.background = 'rgba(46, 204, 113, 0.15)';
        }
        
        const portrait = document.createElement('div');
        portrait.className = 'guardian-card-portrait';
        renderVisual(guardian.portrait, portrait);
        if (guardian.portrait.show_name) {
            portrait.textContent = guardian.name;
        }
        
        const name = document.createElement('div');
        name.className = 'guardian-card-name';
        name.textContent = guardian.name;
        
        const role = document.createElement('div');
        role.className = 'guardian-card-role';
        role.textContent = guardian.role;
        
        // Show active indicator
        if (guardian.id === gameState.active_guardian) {
            const activeIndicator = document.createElement('div');
            activeIndicator.style.fontSize = '12px';
            activeIndicator.style.color = 'var(--success)';
            activeIndicator.style.fontWeight = '600';
            activeIndicator.textContent = 'ACTIVE';
            card.appendChild(portrait);
            card.appendChild(name);
            card.appendChild(activeIndicator);
            card.appendChild(role);
        } else {
            card.appendChild(portrait);
            card.appendChild(name);
            card.appendChild(role);
        }
        
        card.onclick = () => {
            if (guardian.id !== gameState.active_guardian) {
                switchGuardian(guardian);
            }
        };
        
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

/**
 * Switch to a different Guardian
 */
function switchGuardian(guardian) {
    const previousGuardian = gameState.active_guardian;
    gameState.active_guardian = guardian.id;
    autoSave(gameState);
    
    // Update display
    updateGuardianDisplay(guardian);
    
    showNotification(`Switched to ${guardian.name}!`);
    
    // Refresh the Character Room to show new active Guardian
    switchRoom('character_room');
}

/**
 * Render Mission Computer
 */
function renderMissionComputer(container) {
    const grid = document.createElement('div');
    grid.className = 'mission-grid';
    
    // Get available missions
    const availableMissions = getAvailableMissions(window.missionsData || [], gameState);
    const displayMissions = selectMissionsForDisplay(availableMissions, 3);
    
    // Fill empty slots if needed
    while (displayMissions.length < 3) {
        displayMissions.push(null);
    }
    
    displayMissions.forEach(mission => {
        if (mission) {
            const card = createMissionCard(mission, false);
            grid.appendChild(card);
        } else {
            // Empty slot
            const card = document.createElement('div');
            card.className = 'mission-card locked';
            card.innerHTML = '<p style="text-align: center; padding: 40px;">No missions available</p>';
            grid.appendChild(card);
        }
    });
    
    container.appendChild(grid);
}

/**
 * Create mission card element
 */
function createMissionCard(mission, isLocked) {
    const card = document.createElement('div');
    card.className = 'mission-card';
    if (isLocked) card.classList.add('locked');
    
    const visual = document.createElement('div');
    visual.className = 'mission-card-visual';
    renderVisual(mission.visual, visual);
    if (mission.visual.show_name) {
        visual.textContent = mission.name;
    }
    
    const name = document.createElement('div');
    name.className = 'mission-card-name';
    name.textContent = mission.name;
    
    const description = document.createElement('div');
    description.className = 'mission-card-description';
    description.textContent = mission.description;
    
    const difficulty = document.createElement('div');
    difficulty.className = 'mission-card-difficulty';
    difficulty.textContent = `Difficulty: ${mission.difficulty}/10`;
    
    card.appendChild(visual);
    card.appendChild(name);
    card.appendChild(description);
    card.appendChild(difficulty);
    
    if (!isLocked) {
        card.onclick = () => selectMission(mission);
    }
    
    return card;
}

/**
 * Select a mission
 */
function selectMission(mission) {
    // Store selected mission
    window.selectedMission = mission;
    switchRoom('planetfall_portal');
}

/**
 * Render Planetfall Portal
 */
function renderPlanetfallPortal(container) {
    container.className = 'planetfall-container';
    
    const mission = window.selectedMission;
    
    if (!mission) {
        container.innerHTML = '<p>No mission selected</p>';
        return;
    }
    
    const display = document.createElement('div');
    display.className = 'selected-mission-display';
    display.innerHTML = `
        <h2>${mission.name}</h2>
        <p>${mission.description}</p>
        <p><strong>Difficulty:</strong> ${mission.difficulty}/10</p>
        <p><strong>Success Rate:</strong> ${100 - (mission.difficulty * 10)}%</p>
    `;
    
    const launchButton = createButton('Launch Mission', 'launch-button', () => {
        startMissionSimulation(mission);
    });
    
    container.appendChild(display);
    container.appendChild(launchButton);
}

/**
 * Render Workstation Room
 */
function renderWorkstationRoom(container) {
    const grid = document.createElement('div');
    grid.className = 'workstation-grid';
    
    const workstations = window.workstationsData || [];
    
    workstations.forEach(ws => {
        const card = document.createElement('div');
        card.className = 'workstation-card';
        
        const visual = document.createElement('div');
        visual.className = 'workstation-visual';
        renderVisual(ws.visual, visual);
        if (ws.visual.show_name) {
            visual.textContent = ws.name;
        }
        
        const name = document.createElement('div');
        name.className = 'workstation-name';
        const currentLevel = gameState.workstations[ws.id]?.level || 1;
        name.textContent = ws.level_names[currentLevel] || ws.name;
        
        const level = document.createElement('div');
        level.className = 'workstation-level';
        level.textContent = `Level ${currentLevel}/${ws.max_level}`;
        
        card.appendChild(visual);
        card.appendChild(name);
        card.appendChild(level);
        
        card.onclick = () => openWorkstation(ws);
        
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

/**
 * Render Inventory
 */
function renderInventory(container) {
    container.className = 'inventory-container';
    
    // Get all items owned by player
    const ownedItems = [];
    for (const itemId in gameState.inventory) {
        if (gameState.inventory[itemId] > 0) {
            const itemData = window.itemsData.find(i => i.id === itemId);
            if (itemData) {
                ownedItems.push({
                    ...itemData,
                    quantity: gameState.inventory[itemId]
                });
            }
        }
    }
    
    if (ownedItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; opacity: 0.7;">Your inventory is empty</p>';
        return;
    }
    
    // Group items by type
    const groupedItems = {
        resource: [],
        blueprint: [],
        aspect: []
    };
    
    ownedItems.forEach(item => {
        if (groupedItems[item.type]) {
            groupedItems[item.type].push(item);
        }
    });
    
    // Render each group
    const typeNames = {
        resource: 'Resources',
        blueprint: 'Blueprints',
        aspect: 'Equipment & Aspects'
    };
    
    for (const type in groupedItems) {
        const items = groupedItems[type];
        if (items.length === 0) continue;
        
        const section = document.createElement('div');
        section.className = 'inventory-section';
        
        const header = document.createElement('h3');
        header.className = 'inventory-section-header';
        header.textContent = typeNames[type];
        section.appendChild(header);
        
        const grid = document.createElement('div');
        grid.className = 'inventory-grid';
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'inventory-item';
            
            const icon = document.createElement('div');
            icon.className = 'inventory-item-icon';
            renderVisual(item.icon, icon);
            if (item.icon.show_name) {
                icon.textContent = item.name;
            }
            
            const name = document.createElement('div');
            name.className = 'inventory-item-name';
            name.textContent = item.name;
            
            const quantity = document.createElement('div');
            quantity.className = 'inventory-item-quantity';
            quantity.textContent = `x${item.quantity}`;
            
            const description = document.createElement('div');
            description.className = 'inventory-item-description';
            description.textContent = item.description;
            
            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(quantity);
            card.appendChild(description);
            
            grid.appendChild(card);
        });
        
        section.appendChild(grid);
        container.appendChild(section);
    }
}

/**
 * Render Observation Deck
 */
function renderObservationDeck(container) {
    container.className = 'observation-deck';
    
    const activeGuardianId = gameState.active_guardian;
    
    if (!activeGuardianId) {
        container.innerHTML = '<p style="text-align: center;">No active Guardian</p>';
        return;
    }
    
    // Get Guardians with available conversations
    const guardians = getGuardiansWithConversations(activeGuardianId, gameState);
    
    if (guardians.length === 0) {
        container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No one here right now. Complete more missions to unlock conversations.</p>';
        return;
    }
    
    const grid = document.createElement('div');
    grid.className = 'guardian-npc-grid';
    
    guardians.forEach(guardian => {
        const card = document.createElement('div');
        card.className = 'guardian-npc-card';
        
        const portrait = document.createElement('div');
        portrait.className = 'guardian-card-portrait';
        renderVisual(guardian.portrait, portrait);
        if (guardian.portrait.show_name) {
            portrait.textContent = guardian.name;
        }
        
        const name = document.createElement('div');
        name.className = 'guardian-card-name';
        name.textContent = guardian.name;
        
        const role = document.createElement('div');
        role.className = 'guardian-card-role';
        role.textContent = guardian.role;
        
        card.appendChild(portrait);
        card.appendChild(name);
        card.appendChild(role);
        
        card.onclick = () => showConversationList(guardian.id);
        
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

/**
 * Show conversation list for a Guardian
 */
function showConversationList(guardianId) {
    const sidebar = document.getElementById('workstation-sidebar');
    const title = document.getElementById('workstation-title');
    const recipeList = document.getElementById('recipe-list');
    const recipeDetails = document.getElementById('recipe-details');
    
    const guardian = getGuardianById(guardianId);
    title.textContent = `Talk to ${guardian.name}`;
    
    // Get available conversations with this Guardian
    const conversations = getConversationsForPair(gameState.active_guardian, guardianId);
    const eligible = conversations.filter(conv => {
        return checkPlayerCharRequirement(conv, gameState.active_guardian) &&
               checkConversationPrerequisites(conv, gameState) &&
               (conv.type === "background" || !gameState.completed_conversations.includes(conv.id));
    });
    
    // Separate by type
    const important = eligible.filter(c => c.type === "important");
    const background = eligible.filter(c => c.type === "background");
    
    // Show Important conversations + 1 Background
    const toShow = [...important];
    if (background.length > 0) {
        toShow.push(background[0]);
    }
    
    // Render conversation list
    recipeList.innerHTML = '';
    toShow.forEach(conv => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'recipe-name';
        titleDiv.textContent = conv.title;
        
        const typeDiv = document.createElement('div');
        typeDiv.className = 'recipe-description';
        typeDiv.textContent = conv.type === "important" ? "Story" : "Chat";
        typeDiv.style.color = conv.type === "important" ? "var(--primary)" : "var(--disabled)";
        
        card.appendChild(titleDiv);
        card.appendChild(typeDiv);
        
        card.onclick = () => {
            startConversation(conv);
            closeSidebar();
        };
        
        recipeList.appendChild(card);
    });
    
    recipeDetails.innerHTML = '<p class="select-prompt">Select a conversation to begin</p>';
    
    sidebar.classList.remove('hidden');
}

console.log('Room system loaded.');
