// src/game/movement.js

// Import dependencies
import { MessageManager, MESSAGE_TYPES } from './ui/messages.js';
import { StatsManager, stats, STATS } from './stats.js';
import { WeatherManager, WEATHER } from './weather.js';
import { VisibilityManager } from './visibility.js';
import { GridManager } from './core/grid.js';
import { MOVEMENT, PLAYER_COLORS } from './constants.js';  // Add this import

window.PLAYER_COLORS = PLAYER_COLORS; // If we still need this global

export const MovementManager = {
    // Calculate animation duration based on terrain stamina cost
    calculateMovementDuration(terrainStaminaCost = 0) {
        const duration = MOVEMENT.BASE_DURATION + (terrainStaminaCost * MOVEMENT.STAMINA_FACTOR);
        return Math.min(Math.max(duration, MOVEMENT.MIN_DURATION), MOVEMENT.MAX_DURATION);
    },

    // Animate player movement between hexes
    async animatePlayerMovement(startQ, startR, endQ, endR, terrainStaminaCost = 0) {
        return new Promise((resolve) => {
            const player = document.getElementById('player');
            const hexGroup = document.getElementById('hexGroup');
            const startPos = this.getHexCenter(startQ, startR);
            const endPos = this.getHexCenter(endQ, endR);
            
            const duration = this.calculateMovementDuration(terrainStaminaCost);
            const startTime = performance.now();
            
            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function for smoother movement
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                // Update player position
                const currentX = startPos.x + (endPos.x - startPos.x) * eased;
                const currentY = startPos.y + (endPos.y - startPos.y) * eased;
                
                player.setAttribute("cx", currentX);
                player.setAttribute("cy", currentY);
                
                // Update viewport position (negated to center on player)
                hexGroup.setAttribute('transform', `translate(${-currentX}, ${-currentY})`);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            }
            
            requestAnimationFrame(animate);
        });
    },

    // Update player position with all related effects
    async updatePlayerPosition(newQ, newR) {
        if (!window.gameRunning || window.gameWon) return;
        
        const player = document.getElementById('player');
        const targetHex = document.querySelector(`polygon[data-q="${newQ}"][data-r="${newR}"]`);
        const targetTerrain = window.TERRAIN_TYPES[targetHex.getAttribute('data-terrain')];
        
        // Store old position for animation
        const oldQ = window.playerPosition.q;
        const oldR = window.playerPosition.r;
        
        // Update game state
        window.playerPosition = { q: newQ, r: newR };
        window.visitedHexes.add(`${newQ},${newR}`);
        
        // Apply ice field damage
        if (targetTerrain && targetTerrain.healthRisk) {
            stats.health = Math.max(0, stats.health - (targetTerrain.healthRisk * 100));
            MessageManager.showPlayerMessage("The bitter cold of the ice field bites into you.");
        }
        
        // Handle weather updates
        if (WEATHER.state.blizzardActive) {
            WEATHER.state.temporaryFog.add(`${newQ},${newR}`);
            VisibilityManager.getAdjacentHexes(window.playerPosition).forEach(hex => {
                WEATHER.state.temporaryFog.add(`${hex.q},${hex.r}`);
            });
            VisibilityManager.updateVisibility(true);
        } else {
            VisibilityManager.updateVisibility(false);
        }
        
        // Animate the movement
        await this.animatePlayerMovement(
            oldQ, oldR, 
            newQ, newR, 
            targetTerrain?.staminaCost || 0
        );
        
        // Check victory conditions after movement completes
        if (newQ === window.southPole.q && newR === window.southPole.r && !window.southPoleVisited) {
            window.southPoleVisited = true;
            document.getElementById('game-message').className = 'narrative';
            document.getElementById('game-message').innerHTML = 
                "At last! Through bitter cold and endless white, you've reached the South Pole! Now the treacherous journey back to base camp awaits...";
        } else if (window.southPoleVisited && newQ === window.baseCamp.q && newR === window.baseCamp.r) {
            window.handleVictoryPhase("Against all odds, you've done it! You've reached the South Pole and returned to tell the tale. Your name will be forever etched in the annals of polar exploration.");
        }
        
        // Reset selection state and update UI
        window.selectedHex = null;
        this.resetHexColors();
        MessageManager.updateCurrentLocationInfo();
        },

    // Helper function for hex center calculation
    getHexCenter(q, r) {
        const hexWidth = Math.sqrt(3) * 30; // Using the hexSize constant of 30
        const hexHeight = 30 * 2;
        const x = hexWidth * (q + r/2);
        const y = hexHeight * (r * 3/4);
        return { x, y };
    },

    resetHexColors() {
        // Only select polygons that have terrain data
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            const terrain = hex.getAttribute('data-terrain');
            if (terrain === 'BASE_CAMP') {
                hex.setAttribute('fill', window.SPECIAL_LOCATIONS.BASE_CAMP.color);
            } else if (terrain === 'SOUTH_POLE') {
                hex.setAttribute('fill', window.SPECIAL_LOCATIONS.SOUTH_POLE.color);
            } else {
                hex.setAttribute('fill', window.TERRAIN_TYPES[terrain].color);
            }
            // Reset stroke to white
            hex.setAttribute('stroke', '#ffffff');
            hex.setAttribute('stroke-width', '1');
        });
    },

    handleHexClick(event) {
        if (!window.gameRunning || stats.health <= 0) return;
    
        MessageManager.clearTerrainMessage();
        event.preventDefault();
        
        const hex = event.target;
        const q = parseInt(hex.getAttribute('data-q'));
        const r = parseInt(hex.getAttribute('data-r'));
        const hexId = `${q},${r}`;
        const terrain = hex.getAttribute('data-terrain');
    
        // Get terrain info based on type
        const terrainInfo = terrain === 'BASE_CAMP' ? window.SPECIAL_LOCATIONS.BASE_CAMP :
                          terrain === 'SOUTH_POLE' ? window.SPECIAL_LOCATIONS.SOUTH_POLE :
                          TERRAIN_TYPES[terrain];
    
        // Handle visibility restrictions based on weather
        if (WEATHER.state.whiteoutPhase) {
            if (!GridManager.isAdjacent({ q, r }, window.playerPosition)) {  // Changed this line
                return;
            }
        } else if (!WEATHER.state.blizzardActive && !window.visibleHexes.has(hexId) && 
                  !window.visitedHexes.has(hexId) && !(q === window.baseCamp.q && r === window.baseCamp.r)) {
            return;
        }

        // Check for South Pole spotting
        if (terrain === 'SOUTH_POLE' && !window.southPoleSpotted && !window.visitedHexes.has(hexId)) {
            window.southPoleSpotted = true;
            MessageManager.showPlayerMessage("Your heart pounds as you spot a dark shape through the swirling snow. After all this struggle, could it truly be the Pole?", MESSAGE_TYPES.TERRAIN);
        }

        // Reset hex colors and check movement possibility
        this.resetHexColors();
        const isAdjacentToPlayer = GridManager.isAdjacent({ q, r }, window.playerPosition);  // Changed this line
        const staminaCost = terrainInfo.staminaCost || STATS.MOVE_STAMINA_COST;

        // Handle hex selection and movement
        if (window.selectedHex && window.selectedHex === hex) {
            if (isAdjacentToPlayer) {
                const totalStaminaCost = STATS.MOVE_STAMINA_COST + (terrainInfo.staminaCost || 0);
                
                if (!terrainInfo.passable) {
                    MessageManager.showPlayerMessage("This terrain is impassable!", MESSAGE_TYPES.TERRAIN);
                } else if (stats.stamina < totalStaminaCost) {
                    MessageManager.showPlayerMessage(`You are too exhausted`, MESSAGE_TYPES.TERRAIN);
                    const staminaBar = document.getElementById('stamina-bar').parentElement;
                    staminaBar.classList.add('pulse-warning');
                    setTimeout(() => staminaBar.classList.remove('pulse-warning'), 1500);
                } else {
                    this.handleMovement(q, r, totalStaminaCost);
                }
            }
            window.selectedHex = null;
        } else {
            window.selectedHex = hex;
            hex.setAttribute('stroke', '#000000');
            hex.setAttribute('stroke-width', '3');
            
            if (!WEATHER.state.whiteoutPhase && 
                (!WEATHER.state.blizzardActive || (q === window.playerPosition.q && r === window.playerPosition.r))) {
                document.getElementById('game-message').className = 'terrain-info';
                document.getElementById('game-message').innerHTML = `
                    <h3>${terrainInfo.name}</h3>
                    <p><em>${terrainInfo.quote}</em></p>
                `;
            }
        }
    },

    // Helper method to handle the actual movement
    async handleMovement(q, r, totalStaminaCost) {
        stats.stamina -= totalStaminaCost;
        
        if (stats.hunger > 5) {
            stats.hunger -= 5;
        } else {
            stats.hunger = 0;
            stats.health = Math.max(0, stats.health - 5);
            stats.stamina = Math.max(0, stats.stamina - 5);
            
            const healthBar = document.getElementById('health-bar').parentElement;
            const staminaBar = document.getElementById('stamina-bar').parentElement;
            healthBar.classList.add('pulse-warning');
            staminaBar.classList.add('pulse-warning');
            setTimeout(() => {
                healthBar.classList.remove('pulse-warning');
                staminaBar.classList.remove('pulse-warning');
            }, 1500);
        }
        
        window.lastMoveTime = Date.now();
        StatsManager.updateStatsDisplay();
        await this.updatePlayerPosition(q, r);
    }
};