// Ship Life - Text Chain System
// Interactive text feed for location drops

let textChainState = {
    entries: [],
    isPaused: false,
    autoAdvanceTimer: null,
    currentActivityIndex: 0,
    activities: [],
    location: null,
    guardian: null,
    activityCounter: 0,
    startingInventory: {},
    extractionReason: null
};

/**
 * Initialize text chain for a drop
 */
function initTextChain(location, activities, guardianId) {
    console.log('[Text Chain] Initializing drop');
    console.log('Location:', location.name);
    console.log('Activities:', activities.length);
    console.log('Guardian:', guardianId);
    
    // Snapshot starting inventory
    const startingInventorySnapshot = {};
    for (const itemId in gameState.inventory) {
        startingInventorySnapshot[itemId] = gameState.inventory[itemId];
    }
    
    // Reset state
    textChainState = {
        entries: [],
        isPaused: false,
        autoAdvanceTimer: null,
        currentActivityIndex: 0,
        activities: activities,
        location: location,
        guardian: getGuardianById(guardianId),
        activityCounter: 0,
        startingInventory: startingInventorySnapshot,
        extractionReason: null
    };
    
    // Show text chain UI
    showTextChainUI();
    
    // Start the sequence
    startDropSequence();
}

/**
 * Show text chain UI (replace planetfall portal content)
 */
function showTextChainUI() {
    const container = document.getElementById('room-container');
    container.className = 'text-chain-container';
    container.innerHTML = `
        <div class="text-chain-feed" id="textChainFeed">
            <!-- Entries will appear here -->
        </div>
        <div class="choice-popup-overlay hidden" id="choicePopup">
            <div class="choice-popup">
                <h3 id="choiceTitle"></h3>
                <p id="choiceDescription"></p>
                <div class="choice-buttons" id="choiceButtons">
                    <!-- Buttons populated dynamically -->
                </div>
            </div>
        </div>
        <div class="extraction-container hidden" id="extractionContainer">
            <div class="extraction-reason" id="extractionReason"></div>
            <button class="btn-extract" onclick="handleExtraction()">Extract and Return to Ship</button>
        </div>
    `;
}

/**
 * Start the drop sequence
 */
function startDropSequence() {
    // Opening narration
    addEntry('narration', `The dropship descends toward ${textChainState.location.name}.`);
    
    setTimeout(() => {
        addEntry('narration', 'The hatch opens. You step out into unknown territory.');
        
        setTimeout(() => {
            // Start first activity encounter
            processNextActivity();
        }, 3000);
    }, 3000);
}

/**
 * Process the next activity in the sequence
 */
function processNextActivity() {
    // Check extraction conditions first
    if (checkExtractionConditions()) {
        return; // Extraction triggered
    }
    
    // Check if we've processed all activities
    if (textChainState.currentActivityIndex >= textChainState.activities.length) {
        // No more activities, trigger extraction
        triggerExtraction('Completed exploration');
        return;
    }
    
    const activity = textChainState.activities[textChainState.currentActivityIndex];
    
    console.log('[Text Chain] Processing activity:', activity.name);
    
    // Show initiate dialogue
    const initiateDialogue = getDialogue(activity, textChainState.guardian.id, 'initiate');
    if (initiateDialogue) {
        addEntry(initiateDialogue.type, initiateDialogue.text, initiateDialogue.speaker);
    }
    
    // Wait, then show choice popup
    setTimeout(() => {
        showActivityChoice(activity);
    }, 3000);
}

/**
 * Add an entry to the text chain
 */
function addEntry(type, text, speakerId = null) {
    const feed = document.getElementById('textChainFeed');
    if (!feed) return;
    
    const entry = document.createElement('div');
    entry.className = `text-entry ${type}`;
    
    if (type === 'dialogue' && speakerId) {
        const guardian = getGuardianById(speakerId);
        
        const portrait = document.createElement('div');
        portrait.className = 'dialogue-portrait';
        renderVisual(guardian.portrait, portrait);
        
        const bubble = document.createElement('div');
        bubble.className = 'dialogue-bubble';
        
        const name = document.createElement('span');
        name.className = 'speaker-name';
        name.textContent = guardian.name;
        
        const textP = document.createElement('p');
        textP.textContent = text;
        
        bubble.appendChild(name);
        bubble.appendChild(textP);
        
        entry.appendChild(portrait);
        entry.appendChild(bubble);
    } else {
        const textP = document.createElement('p');
        textP.textContent = text;
        entry.appendChild(textP);
    }
    
    feed.appendChild(entry);
    
    // Scroll to bottom
    feed.scrollTop = feed.scrollHeight;
    
    // Store in state
    textChainState.entries.push({ type, text, speakerId });
}

/**
 * Show activity choice popup
 */
function showActivityChoice(activity) {
    textChainState.isPaused = true;
    
    const popup = document.getElementById('choicePopup');
    const title = document.getElementById('choiceTitle');
    const description = document.getElementById('choiceDescription');
    const buttons = document.getElementById('choiceButtons');
    
    title.textContent = activity.name;
    description.textContent = activity.description;
    
    buttons.innerHTML = `
        <button class="btn-engage" onclick="handleActivityChoice('engage')">Engage</button>
        <button class="btn-avoid" onclick="handleActivityChoice('avoid')">Avoid</button>
    `;
    
    popup.classList.remove('hidden');
}

/**
 * Handle activity choice
 */
function handleActivityChoice(choice) {
    const popup = document.getElementById('choicePopup');
    popup.classList.add('hidden');
    
    const activity = textChainState.activities[textChainState.currentActivityIndex];
    
    // Log choice
    addEntry('player-choice', `You chose to ${choice.charAt(0).toUpperCase() + choice.slice(1)}`);
    
    if (choice === 'engage') {
        handleEngage(activity);
    } else if (choice === 'avoid') {
        handleAvoid(activity);
    }
}

/**
 * Handle engage choice
 */
function handleEngage(activity) {
    // Show engage dialogue
    const engageDialogue = getDialogue(activity, textChainState.guardian.id, 'engage');
    if (engageDialogue) {
        addEntry(engageDialogue.type, engageDialogue.text, engageDialogue.speaker);
    }
    
    setTimeout(() => {
        // Roll for success
        const success = rollActivitySuccess(activity);
        
        if (success) {
            handleActivitySuccess(activity);
        } else {
            handleActivityFailure(activity);
        }
    }, 3000);
}

/**
 * Handle avoid choice
 */
function handleAvoid(activity) {
    addEntry('narration', 'You attempt to avoid the encounter...');
    
    setTimeout(() => {
        // Roll detection
        const detected = rollPercentage(activity.detection_risk);
        
        console.log('[Detection Roll]', detected ? 'DETECTED' : 'NOT DETECTED', `(${activity.detection_risk}%)`);
        
        if (detected) {
            // Detected!
            addEntry('system-event', `The ${activity.name} detects your presence!`);
            textChainState.activityCounter++; // Count as avoided (detected)
            
            setTimeout(() => {
                showDetectionChoice(activity);
            }, 3000);
        } else {
            // Successfully avoided
            addEntry('system-event', 'You slip past undetected.');
            // Don't increment counter for successful avoidance
            
            setTimeout(() => {
                // Move to next activity
                textChainState.currentActivityIndex++;
                processNextActivity();
            }, 3000);
        }
    }, 3000);
}

/**
 * Show detection choice (Engage or Flee)
 */
function showDetectionChoice(activity) {
    textChainState.isPaused = true;
    
    const popup = document.getElementById('choicePopup');
    const title = document.getElementById('choiceTitle');
    const description = document.getElementById('choiceDescription');
    const buttons = document.getElementById('choiceButtons');
    
    title.textContent = 'Detected!';
    description.textContent = `The ${activity.name} has spotted you!`;
    
    buttons.innerHTML = `
        <button class="btn-engage" onclick="handleDetectionChoice('engage')">Engage</button>
        <button class="btn-flee" onclick="handleDetectionChoice('flee')">Flee</button>
    `;
    
    popup.classList.remove('hidden');
}

/**
 * Handle detection choice
 */
function handleDetectionChoice(choice) {
    const popup = document.getElementById('choicePopup');
    popup.classList.add('hidden');
    
    const activity = textChainState.activities[textChainState.currentActivityIndex];
    
    // Log choice
    addEntry('player-choice', `You chose to ${choice.charAt(0).toUpperCase() + choice.slice(1)}`);
    
    if (choice === 'engage') {
        handleEngage(activity);
    } else if (choice === 'flee') {
        handleFlee(activity);
    }
}

/**
 * Handle flee attempt
 */
function handleFlee(activity) {
    addEntry('narration', 'You attempt to escape...');
    
    setTimeout(() => {
        // Roll flee chance
        const fleeSuccess = rollPercentage(activity.flee_chance);
        
        console.log('[Flee Roll]', fleeSuccess ? 'SUCCESS' : 'FAILED', `(${activity.flee_chance}%)`);
        
        if (fleeSuccess) {
            // Escaped!
            addEntry('system-event', 'You successfully escape!');
            
            setTimeout(() => {
                // Move to next activity
                textChainState.currentActivityIndex++;
                processNextActivity();
            }, 3000);
        } else {
            // Flee failed, forced to engage
            addEntry('system-event', 'Your escape is blocked! You must fight!');
            
            setTimeout(() => {
                handleEngage(activity);
            }, 3000);
        }
    }, 3000);
}

/**
 * Roll for activity success
 */
function rollActivitySuccess(activity) {
    const successRate = calculateMissionSuccessRate(
        gameState,
        [textChainState.guardian.id],
        activity
    );
    
    const roll = Math.random() * 100;
    const success = roll <= successRate.final;
    
    console.log('[Success Roll]', success ? 'SUCCESS' : 'FAILURE', `(${roll.toFixed(1)} vs ${successRate.final}%)`);
    
    return success;
}

/**
 * Handle activity success
 */
function handleActivitySuccess(activity) {
    // Show success dialogue
    const successDialogue = getDialogue(activity, textChainState.guardian.id, 'success');
    if (successDialogue) {
        addEntry(successDialogue.type, successDialogue.text, successDialogue.speaker);
    }
    
    // Award loot
    const loot = calculateActivityLoot([activity]);
    awardActivityLoot(loot);
    
    // Show loot notification
    setTimeout(() => {
        const lootItems = Object.entries(loot).map(([itemId, quantity]) => {
            const item = window.itemsData?.find(i => i.id === itemId);
            return `${item?.name || itemId} x${quantity}`;
        });
        addEntry('system-event', `Resources collected: ${lootItems.join(', ')}`);
        
        // Update inventory count
        textChainState.inventoryCount = countInventorySlots(gameState.inventory);
        textChainState.activityCounter++;
        
        // Move to next activity
        setTimeout(() => {
            textChainState.currentActivityIndex++;
            processNextActivity();
        }, 3000);
    }, 2000);
}

/**
 * Handle activity failure
 */
function handleActivityFailure(activity) {
    // Roll for down
    const downed = rollPercentage(activity.down_risk);
    
    console.log('[Down Roll]', downed ? 'DOWNED' : 'NOT DOWNED', `(${activity.down_risk}%)`);
    
    if (downed) {
        // Guardian is downed!
        const downedDialogue = getDialogue(activity, textChainState.guardian.id, 'downed');
        if (downedDialogue) {
            addEntry(downedDialogue.type, downedDialogue.text, downedDialogue.speaker);
        }
        
        setTimeout(() => {
            triggerExtraction('Downed');
        }, 3000);
    } else {
        // Failed but not downed
        const failDialogue = getDialogue(activity, textChainState.guardian.id, 'fail');
        if (failDialogue) {
            addEntry(failDialogue.type, failDialogue.text, failDialogue.speaker);
        }
        
        addEntry('system-event', 'No resources collected.');
        textChainState.activityCounter++;
        
        // Move to next activity
        setTimeout(() => {
            textChainState.currentActivityIndex++;
            processNextActivity();
        }, 3000);
    }
}

/**
 * Check extraction conditions
 */
function checkExtractionConditions() {
    // Check max activities
    if (textChainState.activityCounter >= textChainState.location.max_activities) {
        triggerExtraction('Max activities reached');
        return true;
    }
    
    // Check inventory full (only count NEW items collected this drop)
    const newItems = {};
    for (const itemId in gameState.inventory) {
        const currentCount = gameState.inventory[itemId] || 0;
        const startingCount = textChainState.startingInventory[itemId] || 0;
        const newCount = currentCount - startingCount;
        
        if (newCount > 0) {
            newItems[itemId] = newCount;
        }
    }
    
    const slotsUsed = countInventorySlots(newItems);
    console.log('[Inventory Check] Slots used this drop:', slotsUsed, '/ 20');
    
    if (slotsUsed >= 20) {
        triggerExtraction('Inventory full');
        return true;
    }
    
    return false;
}

/**
 * Trigger extraction
 */
function triggerExtraction(reason) {
    console.log('[Extraction] Triggered:', reason);
    
    textChainState.extractionReason = reason;
    
    // Show extraction message
    addEntry('extraction-reason', `EXTRACTION TRIGGERED: ${reason.toUpperCase()}`);
    
    // Show extraction button
    setTimeout(() => {
        const extractionContainer = document.getElementById('extractionContainer');
        const extractionReasonDiv = document.getElementById('extractionReason');
        
        extractionReasonDiv.textContent = reason.toUpperCase();
        extractionContainer.classList.remove('hidden');
    }, 2000);
}

/**
 * Handle extraction button click
 */
function handleExtraction() {
    console.log('[Extraction] Returning to ship');
    
    // Update progression
    if (!gameState.progression) {
        gameState.progression = {
            total_drops: 0,
            successful_drops: 0,
            failed_drops: 0,
            activities_completed: { _total: 0 }
        };
    }
    
    const isDowned = textChainState.extractionReason === 'Downed';
    
    if (isDowned) {
        gameState.progression.failed_drops++;
    } else {
        gameState.progression.successful_drops++;
    }
    
    gameState.progression.total_drops++;
    autoSave(gameState);
    
    // Show results
    showDropResults(isDowned);
}

/**
 * Show drop results
 */
function showDropResults(isDowned) {
    const resultsModal = document.getElementById('mission-results');
    const resultsTitle = document.getElementById('results-title');
    const resultsStatus = document.getElementById('results-status');
    const resultsRewards = document.getElementById('results-rewards');
    
    if (isDowned) {
        resultsTitle.textContent = 'Downed';
        resultsStatus.innerHTML = '<p style="color: var(--error); font-size: 18px; font-weight: 600;">Guardian was downed and lost all collected resources</p>';
        resultsRewards.innerHTML = '<p style="opacity: 0.7;">No resources recovered</p>';
    } else {
        resultsTitle.textContent = 'Survived';
        resultsStatus.innerHTML = `<p style="color: var(--success); font-size: 18px; font-weight: 600;">Successfully extracted from ${textChainState.location.name}</p>`;
        
        // Show collected loot
        let rewardsHTML = '<h3 style="margin-top: 20px;">Resources Collected:</h3><ul style="margin-top: 10px;">';
        for (const [itemId, quantity] of Object.entries(gameState.inventory)) {
            if (quantity > 0) {
                const item = window.itemsData?.find(i => i.id === itemId);
                if (item) {
                    rewardsHTML += `<li>${item.name}: ${quantity}</li>`;
                }
            }
        }
        rewardsHTML += '</ul>';
        
        resultsRewards.innerHTML = rewardsHTML;
    }
    
    resultsModal.classList.remove('hidden');
}

/**
 * Get dialogue for activity moment
 */
function getDialogue(activity, guardianId, moment) {
    if (!activity.dialogue) return null;
    
    // Try character-specific dialogue
    if (activity.dialogue[guardianId] && activity.dialogue[guardianId][moment]) {
        return {
            type: 'dialogue',
            speaker: guardianId,
            text: activity.dialogue[guardianId][moment]
        };
    }
    
    // Try default dialogue
    if (activity.dialogue.default && activity.dialogue.default[moment]) {
        return {
            type: 'narration',
            text: activity.dialogue.default[moment]
        };
    }
    
    return null;
}

/**
 * Roll percentage check
 */
function rollPercentage(chance) {
    return Math.random() * 100 <= chance;
}

/**
 * Count inventory slots used
 */
function countInventorySlots(inventory) {
    let slotsUsed = 0;
    const stackLimit = 3;
    
    for (const itemId in inventory) {
        const quantity = inventory[itemId];
        if (quantity > 0) {
            slotsUsed += Math.ceil(quantity / stackLimit);
        }
    }
    
    return slotsUsed;
}

console.log('Text chain system loaded.');
