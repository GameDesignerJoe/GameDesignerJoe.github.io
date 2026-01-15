// Ship Life - Conversation System

let currentConversation = null;
let currentLineIndex = 0;

/**
 * Get conversations involving a specific Guardian pair
 */
function getConversationsForPair(guardian1Id, guardian2Id) {
    const conversations = window.conversationsData || [];
    return conversations.filter(conv => {
        const participants = conv.participants;
        return (participants.includes(guardian1Id) && participants.includes(guardian2Id));
    });
}

/**
 * Check if conversation prerequisites are met
 */
function checkConversationPrerequisites(conversation, state) {
    const prereqs = conversation.prerequisites;
    
    // Check missions_together
    if (prereqs.missions_together) {
        for (const [pair, required] of Object.entries(prereqs.missions_together)) {
            const current = state.relationships.missions_together[pair] || 0;
            if (current < required) {
                return false;
            }
        }
    }
    
    // Check total_missions
    if (prereqs.total_missions > 0) {
        if (state.mission_counters.total < prereqs.total_missions) {
            return false;
        }
    }
    
    // Check flags
    if (prereqs.flags && prereqs.flags.length > 0) {
        for (const flag of prereqs.flags) {
            if (!hasFlag(state, flag)) {
                return false;
            }
        }
    }
    
    // Check previous_conversations
    if (prereqs.previous_conversations && prereqs.previous_conversations.length > 0) {
        for (const convId of prereqs.previous_conversations) {
            if (!state.completed_conversations.includes(convId)) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Check if player character meets requirements
 */
function checkPlayerCharRequirement(conversation, activeGuardianId) {
    const req = conversation.player_char_req;
    
    // "any" allows all players
    if (req === "any") {
        return true;
    }
    
    // Single string ID
    if (typeof req === "string") {
        return req === activeGuardianId;
    }
    
    // Array of IDs (OR logic)
    if (Array.isArray(req)) {
        return req.includes(activeGuardianId);
    }
    
    return false;
}

/**
 * Get eligible conversations for the Observation Deck
 */
function getEligibleConversations(activeGuardianId, state) {
    const conversations = window.conversationsData || [];
    
    return conversations.filter(conv => {
        // Must involve active Guardian
        if (!conv.participants.includes(activeGuardianId)) {
            return false;
        }
        
        // Check player_char_req
        if (!checkPlayerCharRequirement(conv, activeGuardianId)) {
            return false;
        }
        
        // Check prerequisites
        if (!checkConversationPrerequisites(conv, state)) {
            return false;
        }
        
        // Important conversations: only show if not completed
        if (conv.type === "important") {
            if (state.completed_conversations.includes(conv.id)) {
                return false;
            }
        }
        
        return true;
    });
}

/**
 * Get Guardians with available conversations
 */
function getGuardiansWithConversations(activeGuardianId, state) {
    const allGuardians = window.guardiansData || [];
    const eligibleConvs = getEligibleConversations(activeGuardianId, state);
    
    // Find which Guardians have conversations
    const guardiansWithConvs = new Set();
    
    eligibleConvs.forEach(conv => {
        // Find the OTHER participant (not the active Guardian)
        const otherGuardian = conv.participants.find(p => p !== activeGuardianId);
        if (otherGuardian) {
            guardiansWithConvs.add(otherGuardian);
        }
    });
    
    // Return Guardian data for those with conversations
    return allGuardians.filter(g => guardiansWithConvs.has(g.id));
}

/**
 * Start a conversation
 */
function startConversation(conversation) {
    currentConversation = conversation;
    currentLineIndex = 0;
    
    // Show conversation UI
    const ui = document.getElementById('conversation-ui');
    ui.classList.remove('hidden');
    
    // Lock navigation
    lockNavigation();
    
    // Set up portraits
    const actor1 = conversation.participants[0];
    const actor2 = conversation.participants[1];
    
    const leftPortrait = document.getElementById('portrait-left');
    const rightPortrait = document.getElementById('portrait-right');
    
    const guardian1 = getGuardianById(actor1);
    const guardian2 = getGuardianById(actor2);
    
    renderVisual(guardian1.portrait, leftPortrait);
    renderVisual(guardian2.portrait, rightPortrait);
    
    if (guardian1.portrait.show_name) {
        leftPortrait.textContent = guardian1.name;
    }
    if (guardian2.portrait.show_name) {
        rightPortrait.textContent = guardian2.name;
    }
    
    // Store portrait guardian IDs for highlighting
    leftPortrait.dataset.guardianId = actor1;
    rightPortrait.dataset.guardianId = actor2;
    
    // Display first line
    displayCurrentLine();
}

/**
 * Display the current dialogue line
 */
function displayCurrentLine() {
    if (!currentConversation) return;
    
    const line = currentConversation.lines[currentLineIndex];
    if (!line) {
        endConversation();
        return;
    }
    
    // Update speaker name
    const speakerName = document.getElementById('speaker-name');
    const guardian = getGuardianById(line.actor);
    speakerName.textContent = guardian.name;
    
    // Update dialogue text
    const dialogueText = document.getElementById('dialogue-text');
    dialogueText.textContent = line.text;
    
    // Highlight current speaker's portrait
    highlightSpeaker(line.actor);
}

/**
 * Highlight the current speaker's portrait
 */
function highlightSpeaker(actorId) {
    const leftPortrait = document.getElementById('portrait-left');
    const rightPortrait = document.getElementById('portrait-right');
    
    // Remove previous highlights
    leftPortrait.classList.remove('speaking');
    rightPortrait.classList.remove('speaking');
    
    // Add highlight to current speaker
    if (leftPortrait.dataset.guardianId === actorId) {
        leftPortrait.classList.add('speaking');
    } else if (rightPortrait.dataset.guardianId === actorId) {
        rightPortrait.classList.add('speaking');
    }
}

/**
 * Advance to next dialogue line
 */
function advanceDialogue() {
    if (!currentConversation) return;
    
    currentLineIndex++;
    
    if (currentLineIndex >= currentConversation.lines.length) {
        endConversation();
    } else {
        displayCurrentLine();
    }
}

/**
 * End the conversation
 */
function endConversation() {
    if (!currentConversation) return;
    
    // Mark conversation as completed
    if (!gameState.completed_conversations.includes(currentConversation.id)) {
        gameState.completed_conversations.push(currentConversation.id);
    }
    
    // Save progress
    autoSave(gameState);
    
    // Hide conversation UI
    const ui = document.getElementById('conversation-ui');
    ui.classList.add('hidden');
    
    // Unlock navigation
    unlockNavigation();
    
    // Reset state
    currentConversation = null;
    currentLineIndex = 0;
    
    // Refresh Observation Deck
    switchRoom('observation_deck');
    
    showNotification('Conversation complete!');
}

/**
 * Lock navigation during conversations
 */
function lockNavigation() {
    const navBar = document.getElementById('navigation-bar');
    navBar.style.pointerEvents = 'none';
    navBar.style.opacity = '0.5';
}

/**
 * Unlock navigation
 */
function unlockNavigation() {
    const navBar = document.getElementById('navigation-bar');
    navBar.style.pointerEvents = 'auto';
    navBar.style.opacity = '1';
}

console.log('Conversation system loaded.');
