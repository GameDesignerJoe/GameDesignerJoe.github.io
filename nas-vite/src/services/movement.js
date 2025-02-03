// src/services/movement.js
import { gameStore } from '../state/store.js';
import { MessageSystem, MESSAGE_CONFIG } from '../core/messages.js';
import { UI } from '../config/constants.js';
import { StatsService } from './stats.js';
import { WeatherState } from '../state/game/weatherState.js';
import { VisibilityManager } from './visibility.js';
import { MOVEMENT, PLAYER_COLORS, GRID } from '../config/constants.js';
import { TERRAIN_TYPES, SPECIAL_LOCATIONS } from '../config/terrain.js';
import perfMonitor from '../core/performanceMonitor.js';

export const MovementManager = {
    init() {
        // Wrap key methods for performance monitoring
        const methodsToTrack = [
            'animatePlayerMovement',
            'updatePlayerPosition',
            'handleMovement',
            'handleHexSelection'
        ];

        methodsToTrack.forEach(method => {
            perfMonitor.wrapMethod(this, method, 'movement.js');
        });
    },

    calculateMovementDuration(terrainStaminaCost = 0) {
        const duration = MOVEMENT.BASE_DURATION + (terrainStaminaCost * MOVEMENT.STAMINA_FACTOR);
        return Math.min(Math.max(duration, MOVEMENT.MIN_DURATION), MOVEMENT.MAX_DURATION);
    },

    async animatePlayerMovement(startQ, startR, endQ, endR, terrainStaminaCost = 0) {
        return new Promise((resolve) => {
            const player = document.getElementById('player');
            const hexGroup = document.getElementById('hexGroup');
            if (!player || !hexGroup) {
                console.error('Missing elements:', { player: !!player, hexGroup: !!hexGroup });
                resolve();
                return;
            }
    
            const startPos = this.getHexCenter(startQ, startR);
            const endPos = this.getHexCenter(endQ, endR);  
            const duration = this.calculateMovementDuration(terrainStaminaCost);
            const startTime = performance.now();
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                const currentX = startPos.x + (endPos.x - startPos.x) * eased;
                const currentY = startPos.y + (endPos.y - startPos.y) * eased;
                
                player.setAttribute("cx", currentX);
                player.setAttribute("cy", currentY);
                hexGroup.setAttribute('transform', `translate(${-currentX}, ${-currentY})`);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    },

    resetHexColors() {
        document.querySelectorAll('polygon[data-terrain]').forEach(hex => {
            const terrain = hex.getAttribute('data-terrain');
            if (terrain === 'BASE_CAMP') {
                hex.setAttribute('fill', SPECIAL_LOCATIONS.BASE_CAMP.color);
            } else if (terrain === 'SOUTH_POLE') {
                hex.setAttribute('fill', SPECIAL_LOCATIONS.SOUTH_POLE.color);
            } else {
                hex.setAttribute('fill', TERRAIN_TYPES[terrain].color);
            }
            hex.setAttribute('stroke', '#ffffff');
            hex.setAttribute('stroke-width', '1');
        });
    },


    async updatePlayerPosition(newQ, newR) {
        if (!gameStore.gameRunning || gameStore.gameWon) return;
        
        const targetHex = document.querySelector(`polygon[data-q="${newQ}"][data-r="${newR}"]`);
        if (!targetHex) {
            console.error('Target hex not found:', { newQ, newR });
            return;
        }

        const terrain = targetHex.getAttribute('data-terrain');
        const targetTerrain = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
        terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
        TERRAIN_TYPES[terrain];
        
        const oldQ = gameStore.playerPosition.q;
        const oldR = gameStore.playerPosition.r;

        // Do the animation first
        await this.animatePlayerMovement(oldQ, oldR, newQ, newR, targetTerrain?.staminaCost || 0);
        
        // Then update state
        gameStore.player.position = { q: newQ, r: newR };
        
        // Update visibility
        const newHexId = `${newQ},${newR}`;
        gameStore.game.world.visitedHexes.add(newHexId);
        
        const adjacentHexes = VisibilityManager.getAdjacentHexes({ q: newQ, r: newR });
        adjacentHexes.forEach(hex => {
            const hexId = `${hex.q},${hex.r}`;
            gameStore.game.world.visibleHexes.add(hexId);
        });

        // Handle terrain effects
        if (targetTerrain?.healthRisk) {
            gameStore.player.stats.health = Math.max(0, gameStore.player.stats.health - (targetTerrain.healthRisk * 100));
            gameStore.messages.showPlayerMessage("The bitter cold of the ice field bites into you.", UI.MESSAGE_TYPES.STATUS);
        }

        // Update fog overlays and check victory/end conditions
        if (WeatherState.current.type === 'BLIZZARD') {
            WeatherState.methods.updateVisibility(`${newQ},${newR}`, true);
            VisibilityManager.updateVisibility(true);
        } else {
            VisibilityManager.updateVisibility(false);
        }

        this.checkVictoryConditions(newQ, newR);
        gameStore.game.world.selectedHex = null;
        this.resetHexColors();
        
        // Only update location info if not skipped
        if (!this.skipLocationUpdate) {
            gameStore.messages.updateCurrentLocationInfo();
        }
        this.skipLocationUpdate = false;  // Reset for next time
    },

    checkVictoryConditions(newQ, newR) {
        const isSouthPole = newQ === gameStore.southPole.q && 
                           newR === gameStore.southPole.r;
        const isBaseCamp = newQ === gameStore.baseCamp.q && 
                          newR === gameStore.baseCamp.r;
    
        if (isSouthPole && !gameStore.game.world.southPoleVisited) {
            // Player has reached South Pole for the first time
            gameStore.game.world.southPoleVisited = true;
            
            // Stop updating location info
            this.skipLocationUpdate = true;
            
            gameStore.messages.showGameMessage(
                "At last! Through bitter cold and endless white, you've reached the South Pole! " +
                "Now the treacherous journey back to base camp awaits...",
                MESSAGE_CONFIG.TYPES.NARRATIVE
            );
        } else if (gameStore.game.world.southPoleVisited && isBaseCamp) {
            // Player has returned to base camp after visiting South Pole
            this.skipLocationUpdate = true;
            this.handleVictory();
        }
    },

    handleVictory() {
        // Update game state
        gameStore.game.won = true;
        gameStore.game.running = false;  // Stop the game
        
        // Clear any existing messages and prevent terrain message from showing
        this.skipLocationUpdate = true;
        gameStore.messages.clearMessages();
        
        // Show victory message
        gameStore.messages.showVictoryMessage();
        
        // Change player appearance to indicate victory
        const player = document.getElementById('player');
        if (player) {
            player.setAttribute('fill', '#FFD700');  // Gold color for victory
        }
        
        // Show restart button using the RestartSystem
        if (gameStore.restartSystem) {
            gameStore.restartSystem.showRestartButton();
        }
    },

    getHexCenter(q, r) {
        const hexWidth = GRID.HEX_WIDTH;
        const hexHeight = GRID.HEX_HEIGHT;
        const x = hexWidth * (q + r/2);
        const y = hexHeight * (r * 3/4);
        // console.log('MovementManager getHexCenter:', { q, r, x, y });  // Debug log
        return { x, y };
    },

    // Update handleHexSelection in MovementManager
    handleHexSelection(hex, q, r, terrainInfo) {
        // Check camping only
        if (gameStore.player.isCamping) {
            gameStore.messages.showPlayerMessage(
                "You must break camp before moving.",
                UI.MESSAGE_TYPES.STATUS
            );
            return;
        }
    
        this.resetHexColors();
        const isAdjacentToPlayer = VisibilityManager.isAdjacent(
            { q, r }, 
            gameStore.playerPosition
        );
    
        if (gameStore.game.world.selectedHex && gameStore.game.world.selectedHex === hex) {
            if (isAdjacentToPlayer) {
                const totalStaminaCost = MOVEMENT.STAMINA_COST + (terrainInfo.staminaCost || 0);
    
                if (!terrainInfo.passable) {
                    gameStore.messages.showPlayerMessage(
                        terrainInfo.description || "This terrain is impassable!", 
                        UI.MESSAGE_TYPES.TERRAIN
                    );
                    return;
                } else if (gameStore.player.stats.stamina < totalStaminaCost) {
                    gameStore.messages.showPlayerMessage(
                        "You are too exhausted",
                        UI.MESSAGE_TYPES.TERRAIN
                    );
                    const staminaBar = document.getElementById('stamina-bar').parentElement;
                    staminaBar.classList.add('pulse-warning');
                    setTimeout(() => staminaBar.classList.remove('pulse-warning'), 1500);
                } else {
                    this.handleMovement(q, r, totalStaminaCost);
                }
            }
            gameStore.game.world.selectedHex = null;
        } else {
            // Only check camping here, let compass stay active
            if (gameStore.player.isCamping) {
                return;
            }
            
            gameStore.game.world.selectedHex = hex;
            hex.setAttribute('stroke', '#000000');
            hex.setAttribute('stroke-width', '3');
            
            if (!WeatherState.effects.whiteoutPhase && 
                (!WeatherState.effects.blizzardActive || 
                (q === gameStore.playerPosition.q && r === gameStore.playerPosition.r))) {
                document.getElementById('game-message').className = 'terrain-info';
                document.getElementById('game-message').innerHTML = `
                    <h3>${terrainInfo.name}</h3>
                    <p><em>${terrainInfo.quote}</em></p>
                `;
            }
        }
    },

    async handleMovement(q, r, totalStaminaCost) {
        // Deactivate compass at start of movement
        if (gameStore.compassSystem?.isActive) {
            gameStore.compassSystem.deactivateCompass();
        }
        
        // Update player stamina
        gameStore.player.stats.stamina -= totalStaminaCost;
        
        // Update time tracking and UI
        gameStore.player.lastMoveTime = Date.now();
        StatsService.updateStatsDisplay();
    
        // Wait for movement to complete
        await this.updatePlayerPosition(q, r);
    }
};

export default MovementManager;
