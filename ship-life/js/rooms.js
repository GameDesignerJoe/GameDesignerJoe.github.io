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
    
    // Play room music if available
    if (room.music && window.audioManager) {
        window.audioManager.playMusic(room.music);
    }
    
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
        case 'quarters':
            renderQuarters(container);
            break;
        default:
            container.innerHTML = '<p>Room under construction...</p>';
    }
}

/**
 * Render Landing Page
 */
function renderLandingPage(container) {
    container.className = 'landing-page';
    
    const title = document.createElement('h1');
    title.textContent = 'Fellowdivers Ship Life';
    title.style.marginBottom = '60px';
    
    const playButton = createButton('Play', 'landing-button', () => {
        // Start background music when player clicks Play
        if (window.audioManager && window.audioManager.settings.musicEnabled) {
            window.audioManager.playMusic('bgm_ship_01');
        }
        
        // Go to character select
        switchRoom('character_select');
    });
    
    container.appendChild(title);
    container.appendChild(playButton);
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
    // Set container class for proper layout
    container.className = 'mission-computer-container';
    
    // Mission stats section
    const statsDiv = document.createElement('div');
    statsDiv.className = 'mission-stats';
    
    const completedMissions = gameState.completed_missions || [];
    const totalMissions = completedMissions.length;
    const totalRun = gameState.total_missions_run || 0;
    const successRate = totalRun > 0 ? Math.round((totalMissions / totalRun) * 100) : 0;
    
    statsDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Missions Completed:</span>
            <span class="stat-value">${totalMissions}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Success Rate:</span>
            <span class="stat-value">${successRate}%</span>
        </div>
    `;
    
    container.appendChild(statsDiv);
    
    // Mission grid
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
    
    // Check if mission is new (never completed)
    if (!isLocked && mission) {
        const completedMissions = gameState.completed_missions || [];
        const isNew = !completedMissions.includes(mission.id);
        if (isNew) {
            card.classList.add('mission-new');
            const newBadge = document.createElement('div');
            newBadge.className = 'new-badge';
            newBadge.textContent = 'NEW!';
            card.appendChild(newBadge);
        }
    }
    
    const visual = document.createElement('div');
    visual.className = 'mission-card-visual';
    renderVisual(mission.visual, visual);
    if (mission.visual.show_name) {
        visual.textContent = mission.name;
    }
    
    const name = document.createElement('div');
    name.className = 'mission-card-name';
    name.textContent = mission.name;
    
    // Add chain info if available
    if (mission.chain) {
        const chainInfo = document.createElement('div');
        chainInfo.className = 'mission-chain-badge';
        chainInfo.textContent = `${mission.chain.name} - Part ${mission.chain.part}/${mission.chain.total}`;
        card.appendChild(chainInfo);
    }
    
    const description = document.createElement('div');
    description.className = 'mission-card-description';
    description.textContent = mission.description;
    
    // Add resource preview
    if (mission.rewards && mission.rewards.success) {
        const resourcePreview = document.createElement('div');
        resourcePreview.className = 'mission-resources';
        
        // Get top 3 rewards by drop chance
        const topRewards = mission.rewards.success
            .sort((a, b) => b.drop_chance - a.drop_chance)
            .slice(0, 3);
        
        const rewardNames = [];
        topRewards.forEach(reward => {
            const item = window.itemsData?.find(i => i.id === reward.item);
            if (item) {
                rewardNames.push(item.name);
            }
        });
        
        if (rewardNames.length > 0) {
            resourcePreview.textContent = 'Rewards: ' + rewardNames.join(', ');
            card.appendChild(resourcePreview);
        }
    }
    
    const difficulty = document.createElement('div');
    difficulty.className = 'mission-card-difficulty';
    difficulty.textContent = `Difficulty: ${mission.difficulty}/10`;
    
    // Add anomaly badge if present
    if (mission.anomaly) {
        const anomalyBadge = document.createElement('div');
        anomalyBadge.className = `mission-anomaly-badge anomaly-${mission.anomaly.category}`;
        anomalyBadge.style.background = mission.anomaly.icon.value;
        anomalyBadge.textContent = `⚡ ${mission.anomaly.name}`;
        anomalyBadge.title = mission.anomaly.description;
        
        // Add effect indicator
        if (mission.anomaly.effects.reward_multiplier && mission.anomaly.effects.reward_multiplier > 1) {
            const multiplier = Math.round((mission.anomaly.effects.reward_multiplier - 1) * 100);
            anomalyBadge.textContent += ` (+${multiplier}% rewards)`;
        }
        
        card.appendChild(anomalyBadge);
        
        // Add requirement hint if anomaly has requirements
        if (mission.anomaly.effects) {
            const effects = mission.anomaly.effects;
            let requirementHint = '';
            
            if (effects.requires_minimum_guardians) {
                requirementHint = `Requires ${effects.requires_minimum_guardians}+ Guardians`;
            } else if (effects.requires_equipment_type) {
                const equipName = effects.requires_equipment_type
                    .split('_')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                requirementHint = `Requires ${equipName}`;
            } else if (effects.requires_specific_guardian) {
                const guard = window.guardiansData?.find(g => g.id === effects.requires_specific_guardian);
                requirementHint = `Requires ${guard ? guard.name : 'specific Guardian'}`;
            }
            
            if (requirementHint) {
                const reqDiv = document.createElement('div');
                reqDiv.className = 'mission-requirement-hint';
                reqDiv.textContent = `⚠️ ${requirementHint}`;
                card.appendChild(reqDiv);
            }
        }
    }
    
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
    
    // Initialize selected guardians if not exists
    if (!window.selectedGuardians) {
        window.selectedGuardians = [];
    }
    
    // Mission info section
    const missionInfo = document.createElement('div');
    missionInfo.className = 'selected-mission-display';
    missionInfo.innerHTML = `
        <h2>${mission.name}</h2>
        <p>${mission.description}</p>
        <p><strong>Difficulty:</strong> ${mission.difficulty}/10</p>
    `;
    
    // Squad selection section
    const squadSection = document.createElement('div');
    squadSection.className = 'squad-selection-section';
    
    const squadTitle = document.createElement('h3');
    squadTitle.textContent = 'Select Squad (1-4 Guardians)';
    squadTitle.style.marginBottom = '15px';
    squadSection.appendChild(squadTitle);
    
    const guardianGrid = document.createElement('div');
    guardianGrid.className = 'squad-guardian-grid';
    
    const guardians = window.guardiansData || [];
    guardians.forEach(guardian => {
        const card = document.createElement('div');
        card.className = 'squad-guardian-card';
        
        const isSelected = window.selectedGuardians.includes(guardian.id);
        if (isSelected) {
            card.classList.add('selected');
        }
        
        // Portrait
        const portrait = document.createElement('div');
        portrait.className = 'squad-guardian-portrait';
        renderVisual(guardian.portrait, portrait);
        if (guardian.portrait.show_name) {
            portrait.textContent = guardian.name;
        }
        
        // Name
        const name = document.createElement('div');
        name.className = 'squad-guardian-name';
        name.textContent = guardian.name;
        
        // Loadout preview
        const loadoutPreview = document.createElement('div');
        loadoutPreview.className = 'squad-loadout-preview';
        const loadout = getLoadout(gameState, guardian.id);
        
        // Show equipped items
        let equippedCount = 0;
        if (loadout.equipment) equippedCount++;
        equippedCount += loadout.aspects.filter(a => a).length;
        
        loadoutPreview.textContent = `${equippedCount}/4 equipped`;
        loadoutPreview.style.fontSize = '11px';
        loadoutPreview.style.opacity = '0.7';
        
        // Manage loadout button
        const manageBtn = document.createElement('button');
        manageBtn.className = 'manage-loadout-btn';
        manageBtn.textContent = 'Manage Loadout';
        manageBtn.onclick = (e) => {
            e.stopPropagation();
            openLoadoutModal(guardian.id);
        };
        
        card.appendChild(portrait);
        card.appendChild(name);
        card.appendChild(loadoutPreview);
        card.appendChild(manageBtn);
        
        // Toggle selection
        card.onclick = () => toggleGuardianSelection(guardian.id);
        
        guardianGrid.appendChild(card);
    });
    
    squadSection.appendChild(guardianGrid);
    
    // Success rate display
    const successSection = document.createElement('div');
    successSection.className = 'success-rate-section';
    successSection.id = 'success-rate-display';
    updateSuccessRateDisplay(successSection, mission);
    
    // Launch button
    const launchButton = createButton('Launch Mission', 'launch-button', () => {
        launchMissionWithSquad(mission);
    });
    
    container.appendChild(missionInfo);
    container.appendChild(squadSection);
    container.appendChild(successSection);
    container.appendChild(launchButton);
}

/**
 * Toggle guardian selection for squad
 */
function toggleGuardianSelection(guardianId) {
    if (!window.selectedGuardians) {
        window.selectedGuardians = [];
    }
    
    const index = window.selectedGuardians.indexOf(guardianId);
    if (index > -1) {
        // Deselect
        window.selectedGuardians.splice(index, 1);
    } else {
        // Select (max 4)
        if (window.selectedGuardians.length < 4) {
            window.selectedGuardians.push(guardianId);
        } else {
            showNotification('Maximum 4 guardians per mission', 'error');
            return;
        }
    }
    
    // Refresh planetfall portal
    switchRoom('planetfall_portal');
}

/**
 * Update success rate display
 */
function updateSuccessRateDisplay(container, mission) {
    container.innerHTML = '';
    
    if (window.selectedGuardians.length === 0) {
        container.innerHTML = '<p style="opacity: 0.7;">Select at least 1 guardian</p>';
        return;
    }
    
    const rateCalc = calculateMissionSuccessRate(gameState, window.selectedGuardians, mission);
    const requirementCheck = checkMissionRequirements(gameState, window.selectedGuardians, mission);
    
    const title = document.createElement('div');
    title.style.fontSize = '14px';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    title.textContent = 'Mission Success Rate';
    
    const breakdown = document.createElement('div');
    breakdown.style.fontSize = '13px';
    
    let breakdownHTML = `<div>Base Rate: ${rateCalc.base}%</div>`;
    breakdownHTML += `<div style="color: var(--primary);">Loadout Bonus: +${rateCalc.loadoutBonus}%</div>`;
    
    // Show anomaly modifier if present
    if (rateCalc.anomalyModifier !== 0) {
        const modColor = rateCalc.anomalyModifier > 0 ? 'var(--success)' : 'var(--error)';
        const modSign = rateCalc.anomalyModifier > 0 ? '+' : '';
        breakdownHTML += `<div style="color: ${modColor};">Anomaly Effect: ${modSign}${rateCalc.anomalyModifier}%</div>`;
    }
    
    breakdownHTML += `<div style="font-size: 16px; font-weight: 700; margin-top: 8px; color: ${rateCalc.final >= 80 ? 'var(--success)' : rateCalc.final >= 50 ? 'var(--warning)' : 'var(--error)'};">
        Final: ${rateCalc.final}%
    </div>`;
    
    breakdown.innerHTML = breakdownHTML;
    
    container.appendChild(title);
    container.appendChild(breakdown);
    
    // Show requirements warning
    if (!requirementCheck.met) {
        const warning = document.createElement('div');
        warning.style.color = 'var(--error)';
        warning.style.marginTop = '10px';
        warning.style.padding = '10px';
        warning.style.background = 'rgba(231, 76, 60, 0.2)';
        warning.style.borderRadius = '5px';
        warning.style.fontSize = '12px';
        warning.innerHTML = `⚠️ ${requirementCheck.missing}`;
        container.appendChild(warning);
    }
}

/**
 * Launch mission with selected squad
 */
function launchMissionWithSquad(mission) {
    if (window.selectedGuardians.length === 0) {
        showNotification('Select at least 1 guardian', 'error');
        return;
    }
    
    // Check requirements
    const requirementCheck = checkMissionRequirements(gameState, window.selectedGuardians, mission);
    if (!requirementCheck.met) {
        showNotification(requirementCheck.missing, 'error');
        return;
    }
    
    // Start mission with loadout bonuses
    startMissionSimulation(mission, window.selectedGuardians);
}

/**
 * Open loadout management modal
 */
function openLoadoutModal(guardianId) {
    window.currentLoadoutGuardian = guardianId;
    const guardian = getGuardianById(guardianId);
    
    // Set guardian info
    const portrait = document.getElementById('loadout-guardian-portrait');
    const name = document.getElementById('loadout-guardian-name');
    renderVisual(guardian.portrait, portrait);
    if (guardian.portrait.show_name) {
        portrait.textContent = guardian.name;
    }
    name.textContent = guardian.name;
    
    // Load current loadout into slots
    refreshLoadoutSlots(guardianId);
    
    // Clear item picker
    const picker = document.getElementById('item-picker');
    picker.innerHTML = '<p class="picker-hint">Click a slot above to choose items</p>';
    
    // Show modal
    const modal = document.getElementById('loadout-modal');
    modal.classList.remove('hidden');
    
    // Add click handlers to slots
    document.querySelectorAll('.loadout-slot').forEach(slot => {
        slot.onclick = () => selectLoadoutSlot(slot);
    });
}

/**
 * Close loadout modal
 */
function closeLoadoutModal() {
    const modal = document.getElementById('loadout-modal');
    modal.classList.add('hidden');
    window.currentLoadoutGuardian = null;
    
    // Refresh planetfall portal if we're there
    if (currentRoom && currentRoom.id === 'planetfall_portal') {
        switchRoom('planetfall_portal');
    }
}

/**
 * Refresh loadout slots display
 */
function refreshLoadoutSlots(guardianId) {
    const loadout = getLoadout(gameState, guardianId);
    
    // Equipment slot
    const equipSlot = document.querySelector('.loadout-slot[data-slot-type="equipment"]');
    updateSlotDisplay(equipSlot, loadout.equipment);
    
    // Aspect slots
    loadout.aspects.forEach((aspectId, index) => {
        const slot = document.querySelector(`.loadout-slot[data-slot-type="aspect"][data-slot-index="${index}"]`);
        updateSlotDisplay(slot, aspectId);
    });
}

/**
 * Update a slot's visual display
 */
function updateSlotDisplay(slotElement, itemId) {
    const content = slotElement.querySelector('.slot-content');
    
    if (!itemId) {
        content.className = 'slot-content empty';
        content.textContent = 'Empty';
        return;
    }
    
    const item = window.itemsData.find(i => i.id === itemId);
    if (!item) {
        content.className = 'slot-content empty';
        content.textContent = 'Empty';
        return;
    }
    
    const slotType = slotElement.dataset.slotType;
    const slotIndex = parseInt(slotElement.dataset.slotIndex);
    const guardianId = window.currentLoadoutGuardian;
    
    content.className = 'slot-content filled';
    
    // Create elements
    const iconDiv = document.createElement('div');
    iconDiv.className = 'slot-item-icon';
    renderVisual(item.icon, iconDiv); // Use renderVisual to handle both color and image
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'slot-item-name';
    nameDiv.textContent = item.name;
    
    const unequipBtn = document.createElement('button');
    unequipBtn.className = 'slot-unequip-btn';
    unequipBtn.textContent = '×';
    unequipBtn.onclick = (e) => {
        e.stopPropagation();
        unequipSlot(guardianId, slotType, slotIndex);
    };
    
    // Clear and append
    content.innerHTML = '';
    content.appendChild(iconDiv);
    content.appendChild(nameDiv);
    content.appendChild(unequipBtn);
}

/**
 * Unequip an item from a slot (called from slot button)
 */
function unequipSlot(guardianId, slotType, slotIndex) {
    unequipItem(gameState, guardianId, slotType, slotIndex);
    refreshLoadoutSlots(guardianId);
    autoSave(gameState);
    
    // Refresh picker if this slot is currently selected
    const activeSlot = document.querySelector('.loadout-slot.active');
    if (activeSlot && 
        activeSlot.dataset.slotType === slotType && 
        parseInt(activeSlot.dataset.slotIndex) === slotIndex) {
        showItemPicker(slotType, slotIndex);
    }
    
    showNotification('Item unequipped', 'success');
}

/**
 * Select a loadout slot to equip items
 */
function selectLoadoutSlot(slotElement) {
    // Remove previous selection
    document.querySelectorAll('.loadout-slot').forEach(s => s.classList.remove('active'));
    slotElement.classList.add('active');
    
    const slotType = slotElement.dataset.slotType;
    const slotIndex = parseInt(slotElement.dataset.slotIndex);
    
    // Update picker title
    const pickerTitle = document.getElementById('picker-title');
    pickerTitle.textContent = slotType === 'equipment' ? 'Equipment' : `Aspect ${slotIndex + 1}`;
    
    // Show available items
    showItemPicker(slotType, slotIndex);
}

/**
 * Show item picker for a slot
 */
function showItemPicker(slotType, slotIndex) {
    const picker = document.getElementById('item-picker');
    picker.innerHTML = '';
    
    // Get available items
    const availableItems = getAvailableItemsForSlot(slotType);
    
    const guardianId = window.currentLoadoutGuardian;
    const loadout = getLoadout(gameState, guardianId);
    const currentItem = slotType === 'equipment' ? loadout.equipment : loadout.aspects[slotIndex];
    
    // Show available items
    availableItems.forEach(item => {
        // Check if item is owned
        const owned = gameState.inventory[item.id] || 0;
        if (owned === 0) return; // Skip items not owned
        
        const card = document.createElement('div');
        card.className = 'item-picker-card';
        
        // Check if already equipped
        const equipped = isItemEquipped(gameState, item.id);
        if (equipped.equipped) {
            card.classList.add('equipped');
            
            // Add guardian indicator
            const guardianIndicator = document.createElement('div');
            guardianIndicator.className = 'equipped-by-indicator';
            const equippedGuardian = getGuardianById(equipped.guardian);
            if (equippedGuardian) {
                guardianIndicator.style.background = equippedGuardian.portrait.value;
                guardianIndicator.title = `Equipped by ${equippedGuardian.name}`;
            }
            card.appendChild(guardianIndicator);
        }
        
        const icon = document.createElement('div');
        icon.className = 'picker-item-icon';
        icon.style.background = item.icon.value;
        
        const name = document.createElement('div');
        name.className = 'picker-item-name';
        name.textContent = item.name;
        
        const desc = document.createElement('div');
        desc.className = 'picker-item-description';
        desc.textContent = item.description;
        
        // Show bonuses if applicable
        if (item.mission_bonuses && window.selectedMission) {
            const bonusDiv = document.createElement('div');
            bonusDiv.className = 'picker-item-bonuses';
            
            const missionType = window.selectedMission.mission_type;
            const bonus = item.mission_bonuses[missionType];
            
            if (bonus) {
                bonusDiv.textContent = `+${bonus}% ${missionType}`;
                bonusDiv.style.color = 'var(--success)';
            } else {
                bonusDiv.textContent = 'No bonus for this mission';
                bonusDiv.style.opacity = '0.5';
            }
            
            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(bonusDiv);
            card.appendChild(desc);
        } else {
            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(desc);
        }
        
        // Equip on click
        card.onclick = () => {
            if (equipped.equipped) {
                showNotification(`${item.name} is already equipped on ${equipped.guardian}`, 'error');
                return;
            }
            
            // Unequip old item if slot is occupied
            const loadout = getLoadout(gameState, guardianId);
            const oldItem = slotType === 'equipment' ? loadout.equipment : loadout.aspects[slotIndex];
            
            equipItem(gameState, guardianId, item.id, slotType, slotIndex);
            refreshLoadoutSlots(guardianId);
            autoSave(gameState);
            
            // Refresh item picker to update "equipped" states
            showItemPicker(slotType, slotIndex);
            
            showNotification(`Equipped ${item.name}`, 'success');
        };
        
        picker.appendChild(card);
    });
    
    if (picker.children.length === 0 || (picker.children.length === 1 && currentItem)) {
        picker.innerHTML += '<p class="picker-hint">No items available for this slot</p>';
    }
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

/**
 * Render Quarters (Statistics & Trophies)
 */
function renderQuarters(container) {
    container.className = 'quarters-container';
    
    // Calculate statistics
    const stats = calculateStatistics(gameState);
    
    // Statistics Section
    const statsSection = document.createElement('div');
    statsSection.className = 'quarters-section';
    
    const statsTitle = document.createElement('h2');
    statsTitle.className = 'quarters-section-title';
    statsTitle.textContent = 'Statistics';
    statsSection.appendChild(statsTitle);
    
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    
    // Mission Stats
    const missionStats = [
        { label: 'Missions Completed', value: stats.missions.total },
        { label: 'Total Missions Run', value: stats.missions.totalRun },
        { label: 'Success Rate', value: `${stats.missions.successRate}%` },
        { label: 'Most Used Guardian', value: stats.guardians.mostUsed }
    ];
    
    missionStats.forEach(stat => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        statCard.innerHTML = `
            <div class="stat-card-label">${stat.label}</div>
            <div class="stat-card-value">${stat.value}</div>
        `;
        statsGrid.appendChild(statCard);
    });
    
    statsSection.appendChild(statsGrid);
    container.appendChild(statsSection);
    
    // Trophies Section
    const trophiesSection = document.createElement('div');
    trophiesSection.className = 'quarters-section';
    
    const trophiesTitle = document.createElement('h2');
    trophiesTitle.className = 'quarters-section-title';
    trophiesTitle.textContent = 'Trophies';
    trophiesSection.appendChild(trophiesTitle);
    
    const trophiesGrid = document.createElement('div');
    trophiesGrid.className = 'trophies-grid';
    
    // Get trophies with status
    const trophies = getTrophiesWithStatus(gameState);
    
    trophies.forEach(trophy => {
        const trophyCard = document.createElement('div');
        trophyCard.className = 'trophy-card';
        if (trophy.unlocked) {
            trophyCard.classList.add('unlocked');
        }
        
        const icon = document.createElement('div');
        icon.className = 'trophy-icon';
        icon.style.background = trophy.icon.value;
        
        // Add unlocked stamp
        if (trophy.unlocked) {
            const stamp = document.createElement('div');
            stamp.className = 'trophy-stamp';
            stamp.textContent = '✓';
            icon.appendChild(stamp);
        }
        
        const name = document.createElement('div');
        name.className = 'trophy-name';
        name.textContent = trophy.name;
        
        const description = document.createElement('div');
        description.className = 'trophy-description';
        description.textContent = trophy.description;
        
        // Progress bar if not unlocked
        if (!trophy.unlocked) {
            const progressBar = document.createElement('div');
            progressBar.className = 'trophy-progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'trophy-progress-fill';
            progressFill.style.width = `${trophy.progress}%`;
            progressFill.textContent = `${trophy.progress}%`;
            
            progressBar.appendChild(progressFill);
            
            trophyCard.appendChild(icon);
            trophyCard.appendChild(name);
            trophyCard.appendChild(description);
            trophyCard.appendChild(progressBar);
        } else {
            trophyCard.appendChild(icon);
            trophyCard.appendChild(name);
            trophyCard.appendChild(description);
        }
        
        trophiesGrid.appendChild(trophyCard);
    });
    
    trophiesSection.appendChild(trophiesGrid);
    container.appendChild(trophiesSection);
}

console.log('Room system loaded.');
