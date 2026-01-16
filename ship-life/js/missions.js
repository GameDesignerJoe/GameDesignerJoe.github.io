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
    
    console.log(`Mission: ${mission.name}`);
    console.log(`Squad: ${squad.join(', ')}`);
    console.log(`Success Rate: ${rateCalc.base}% + ${rateCalc.loadoutBonus}% = ${rateCalc.final}%`);
    console.log(`Roll: ${roll.toFixed(2)} - ${success ? 'SUCCESS' : 'FAILURE'}`);
    
    // Roll rewards (with anomaly multiplier)
    const rewardPool = success ? mission.rewards.success : mission.rewards.failure;
    const anomalyMultiplier = mission.anomaly?.effects?.reward_multiplier || 1.0;
    const rewards = rollRewards(rewardPool, anomalyMultiplier);
    
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
    
    unlockNavigation();
    
    // Return to mission computer
    switchRoom('mission_computer');
}

console.log('Mission system loaded.');
