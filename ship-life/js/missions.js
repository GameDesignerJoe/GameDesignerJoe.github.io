// Ship Life - Mission System

/**
 * Get available missions based on prerequisites
 */
function getAvailableMissions(missions, state) {
    return missions.filter(mission => {
        // Check if already completed and not repeatable
        if (!mission.repeatable && state.completed_missions.includes(mission.id)) {
            return false;
        }
        
        const prereqs = mission.prerequisites;
        
        // Check completed missions
        if (prereqs.missions_completed) {
            for (const reqMission of prereqs.missions_completed) {
                if (!state.completed_missions.includes(reqMission)) {
                    return false;
                }
            }
        }
        
        // Check total missions
        if (prereqs.total_missions && state.mission_counters.total < prereqs.total_missions) {
            return false;
        }
        
        // Check flags
        if (prereqs.flags) {
            for (const flag of prereqs.flags) {
                if (!hasFlag(state, flag)) {
                    return false;
                }
            }
        }
        
        return true;
    });
}

/**
 * Select missions for display (random selection)
 */
function selectMissionsForDisplay(availableMissions, count = 3) {
    const shuffled = [...availableMissions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    
    // Assign anomalies to missions (25% chance per mission)
    assignAnomalies(selected);
    
    return selected;
}

/**
 * Get or initialize current missions for display
 * Missions persist until one is completed
 */
function getCurrentMissions(state, availableMissions, count = 3) {
    // Initialize current_missions if it doesn't exist
    if (!state.current_missions) {
        state.current_missions = [];
    }
    
    // Initialize seen missions tracker
    if (!state.seen_current_missions) {
        state.seen_current_missions = [];
    }
    
    // If we have fewer than count missions, generate new ones to fill
    if (state.current_missions.length < count) {
        const needed = count - state.current_missions.length;
        const newMissions = selectMissionsForDisplay(availableMissions, needed);
        
        // Mark new missions as NOT seen yet (they'll be marked as seen when displayed)
        newMissions.forEach(mission => {
            mission._isNewlyGenerated = true;
        });
        
        state.current_missions.push(...newMissions);
        autoSave(state);
    }
    
    // Filter out any missions that are no longer available (shouldn't happen normally)
    state.current_missions = state.current_missions.filter(mission => 
        mission && availableMissions.some(available => available.id === mission.id)
    );
    
    // Mark missions as seen (for future visits)
    state.current_missions.forEach(mission => {
        if (!state.seen_current_missions.includes(mission.id)) {
            state.seen_current_missions.push(mission.id);
        }
    });
    
    return state.current_missions;
}

/**
 * Remove a completed mission and add a new one
 */
function replaceCompletedMission(state, completedMissionId, availableMissions) {
    if (!state.current_missions) {
        state.current_missions = [];
        return;
    }
    
    // Remove the completed mission
    const index = state.current_missions.findIndex(m => m.id === completedMissionId);
    if (index !== -1) {
        state.current_missions.splice(index, 1);
        
        // Add a new mission to replace it
        const newMissions = selectMissionsForDisplay(availableMissions, 1);
        if (newMissions.length > 0) {
            // Mark as newly generated so it shows NEW badge
            newMissions[0]._isNewlyGenerated = true;
            state.current_missions.push(newMissions[0]);
        }
        
        autoSave(state);
    }
}

/**
 * Get weight for anomaly rarity
 */
function getRarityWeight(rarity) {
    switch (rarity) {
        case 'common': return 6;      // 60%
        case 'uncommon': return 3;    // 30%
        case 'rare': return 1;        // 10%
        default: return 1;
    }
}

/**
 * Roll a random anomaly weighted by rarity
 */
function rollAnomaly() {
    if (!window.anomaliesData || window.anomaliesData.length === 0) {
        return null;
    }
    
    // Create weighted pool
    const pool = [];
    window.anomaliesData.forEach(anomaly => {
        const weight = getRarityWeight(anomaly.rarity);
        for (let i = 0; i < weight; i++) {
            pool.push(anomaly);
        }
    });
    
    // Pick random anomaly from weighted pool
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Assign anomalies to missions
 * @param {Array} missions - Missions to potentially add anomalies to
 * @param {number} chance - Chance (0-1) for each mission to get an anomaly
 */
function assignAnomalies(missions, chance = 0.25) {
    missions.forEach(mission => {
        // Only assign if mission doesn't already have one
        if (!mission.anomaly && Math.random() < chance) {
            mission.anomaly = rollAnomaly();
            console.log(`Assigned anomaly "${mission.anomaly?.name}" to mission "${mission.name}"`);
        }
    });
}

/**
 * Start mission simulation
 */
async function startMissionSimulation(mission, selectedGuardians = null) {
    lockNavigation();
    
    // Use provided squad or fallback to all guardians
    const squad = selectedGuardians || ['stella', 'vawn', 'tiberius', 'maestra'];
    
    const container = document.getElementById('room-container');
    container.innerHTML = '';
    container.className = 'simulation-screen';
    
    // Create simulation UI
    const title = document.createElement('h2');
    title.textContent = mission.name;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'simulation-message';
    messageDiv.textContent = 'Preparing for deployment...';
    
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = '0%';
    progressBarContainer.appendChild(progressFill);
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button hidden';
    cancelButton.textContent = 'Skip';
    cancelButton.onclick = () => {
        skipSimulation = true;
    };
    
    container.appendChild(title);
    container.appendChild(messageDiv);
    container.appendChild(progressBarContainer);
    container.appendChild(cancelButton);
    
    // Show cancel button after 3 seconds
    setTimeout(() => {
        cancelButton.classList.remove('hidden');
    }, 3000);
    
    // Run simulation
    let skipSimulation = false;
    const messages = mission.simulation.messages;
    
    for (let i = 0; i < messages.length && !skipSimulation; i++) {
        const msg = messages[i];
        messageDiv.textContent = msg.text;
        await animateProgressBar(progressFill, msg.bar_progress, msg.display_time);
    }
    
    // Ensure progress bar is at 100%
    if (parseFloat(progressFill.style.width) < 100) {
        await animateProgressBar(progressFill, 100, 0.5);
    }
    
    // Calculate success with loadout bonuses
    const rateCalc = calculateMissionSuccessRate(gameState, squad, mission);
    const roll = Math.random() * 100;
    const success = roll <= rateCalc.final;
    
    console.log(`\n========== MISSION SIMULATION ==========`);
    console.log(`Mission: ${mission.name}`);
    console.log(`Difficulty: ${mission.difficulty}/10 (Multiplier: ${rateCalc.debug.difficultyMultiplier})`);
    console.log(`Required Stats:`, rateCalc.debug.requiredStats);
    console.log(`Squad: ${squad.join(', ')}`);
    console.log(`Total Points: ${rateCalc.debug.totalPoints.toFixed(2)}`);
    console.log(`Success Rate: ${rateCalc.base}% (from stats) + ${rateCalc.loadoutBonus}% (legacy) = ${rateCalc.final}%`);
    if (rateCalc.anomalyModifier !== 0) {
        console.log(`Anomaly Modifier: ${rateCalc.anomalyModifier > 0 ? '+' : ''}${rateCalc.anomalyModifier}%`);
    }
    console.log(`Roll: ${roll.toFixed(2)} vs ${rateCalc.final}% - ${success ? '✓ SUCCESS' : '✗ FAILURE'}`);
    console.log(`========================================\n`);
    
    // Roll rewards (with anomaly multiplier)
    const rewardPool = success ? mission.rewards.success : mission.rewards.failure;
    const anomalyMultiplier = mission.anomaly?.effects?.reward_multiplier || 1.0;
    const rewards = rollRewards(rewardPool, anomalyMultiplier);
    
    // Add anomaly bonus items (if mission succeeded and anomaly has bonus items)
    if (success && mission.anomaly?.effects?.reward_bonus_items) {
        mission.anomaly.effects.reward_bonus_items.forEach(bonusItem => {
            rewards.push({
                item: bonusItem.item,
                quantity: bonusItem.amount
            });
        });
        console.log(`Anomaly "${mission.anomaly.name}" granted bonus items`);
    }
    
    // Update state
    addRewardsToInventory(rewards, gameState);
    incrementMissionCounter(gameState, gameState.active_guardian);
    
    // Track total missions run
    if (!gameState.total_missions_run) {
        gameState.total_missions_run = 0;
    }
    gameState.total_missions_run++;
    
    // Track missions together for the squad
    incrementMissionsTogether(gameState, squad);
    
    // Apply anomaly special effects on success
    if (success && mission.anomaly?.effects) {
        const effects = mission.anomaly.effects;
        
        // Relationship bonus
        if (effects.relationship_bonus && squad.length >= 2) {
            // Add relationship points between all squad members
            for (let i = 0; i < squad.length; i++) {
                for (let j = i + 1; j < squad.length; j++) {
                    incrementRelationship(gameState, squad[i], squad[j], effects.relationship_bonus);
                }
            }
            console.log(`Anomaly "${mission.anomaly.name}" granted +${effects.relationship_bonus} relationship to all pairs`);
        }
        
        // Set anomaly unlock flag
        if (effects.unlock_flag) {
            setFlag(gameState, effects.unlock_flag);
            console.log(`Anomaly "${mission.anomaly.name}" set flag: ${effects.unlock_flag}`);
        }
    }
    
    // Set trophy flags based on mission completion
    if (success) {
        // Track completed missions (only add if not already completed)
        if (!gameState.completed_missions.includes(mission.id)) {
            gameState.completed_missions.push(mission.id);
        }
        
        // Trophy flag: Squad size
        setFlag(gameState, `squad_size_${squad.length}`);
        
        // Trophy flag: Solo difficult mission
        if (squad.length === 1 && mission.difficulty >= 3) {
            setFlag(gameState, 'solo_difficult');
        }
        
        // Set completion flags
        if (mission.unlock_on_complete && mission.unlock_on_complete.flags) {
            mission.unlock_on_complete.flags.forEach(flag => {
                setFlag(gameState, flag);
            });
        }
        
        // Check for new trophies
        checkNewTrophies(gameState);
    }
    
    // Auto-save
    autoSave(gameState);
    
    // Show results
    showMissionResults(mission, success, rewards);
}

/**
 * Roll rewards based on drop chances
 * @param {Array} rewardArray - Array of reward definitions
 * @param {number} multiplier - Multiplier for reward quantities (from anomalies)
 */
function rollRewards(rewardArray, multiplier = 1.0) {
    const results = [];
    
    for (const reward of rewardArray) {
        const roll = Math.random() * 100;
        if (roll <= reward.drop_chance) {
            const baseQuantity = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
            const finalQuantity = Math.max(1, Math.floor(baseQuantity * multiplier));
            results.push({ item: reward.item, quantity: finalQuantity });
        }
    }
    
    return results;
}

/**
 * Add rewards to inventory
 */
function addRewardsToInventory(rewards, state) {
    rewards.forEach(reward => {
        addToInventory(state, reward.item, reward.quantity);
    });
}

/**
 * Show mission results modal
 */
function showMissionResults(mission, success, rewards) {
    const modal = document.getElementById('mission-results');
    modal.classList.remove('hidden');
    
    const title = document.getElementById('results-title');
    title.textContent = mission.name;
    
    const status = document.getElementById('results-status');
    status.className = success ? 'results-status success' : 'results-status failure';
    status.textContent = success ? 'MISSION SUCCESS' : 'MISSION FAILED';
    
    // Show anomaly effect message if present
    if (mission.anomaly && success) {
        const anomalyMessage = document.createElement('div');
        anomalyMessage.style.fontSize = '14px';
        anomalyMessage.style.color = 'var(--primary)';
        anomalyMessage.style.marginTop = '10px';
        anomalyMessage.style.padding = '10px';
        anomalyMessage.style.background = 'rgba(74, 144, 226, 0.2)';
        anomalyMessage.style.borderRadius = '5px';
        anomalyMessage.textContent = `⚡ ${mission.anomaly.name} enhanced this mission!`;
        
        status.parentElement.insertBefore(anomalyMessage, status.nextSibling);
    }
    
    const rewardsDiv = document.getElementById('results-rewards');
    rewardsDiv.innerHTML = '<h3>Rewards Received</h3>';
    
    if (rewards.length === 0) {
        rewardsDiv.innerHTML += '<p>No rewards this time.</p>';
    } else {
        rewards.forEach(reward => {
            const item = window.itemsData.find(i => i.id === reward.item);
            const itemName = item ? item.name : reward.item;
            
            const rewardItem = document.createElement('div');
            rewardItem.className = 'reward-item';
            rewardItem.innerHTML = `
                <span>${itemName}</span>
                <span>x${reward.quantity}</span>
            `;
            rewardsDiv.appendChild(rewardItem);
        });
    }
}

/**
 * Continue from mission results
 */
function continueFromResults() {
    const modal = document.getElementById('mission-results');
    modal.classList.add('hidden');
    
    // Get the completed mission from window.selectedMission
    if (window.selectedMission) {
        // Replace only the completed mission with a new one
        const availableMissions = getAvailableMissions(window.missionsData || [], gameState);
        replaceCompletedMission(gameState, window.selectedMission.id, availableMissions);
        
        // Clear the selected mission
        window.selectedMission = null;
    }
    
    unlockNavigation();
    
    // Return to mission computer
    switchRoom('mission_computer');
}

console.log('Mission system loaded.');
