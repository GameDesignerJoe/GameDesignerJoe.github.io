// src/game/movement.js

import { gameStore } from '../state/store';
import { MessageManager, MESSAGE_TYPES } from './ui/messages.js';
import { StatsManager } from './stats.js';
import { WeatherState } from './core/weatherState.js';
import { GameState, TERRAIN_TYPES, SPECIAL_LOCATIONS } from './core/gameState.js';
import { VisibilityManager } from './visibility.js';
import { MOVEMENT, PLAYER_COLORS } from './constants.js';
import { getTerrainDetails } from '../config/config.js';

export const MovementManager = {
    calculateMovementDuration(terrainStaminaCost = 0) {
        const duration = MOVEMENT.BASE_DURATION + (terrainStaminaCost * MOVEMENT.STAMINA_FACTOR);
        return Math.min(Math.max(duration, MOVEMENT.MIN_DURATION), MOVEMENT.MAX_DURATION);
    },

    async animatePlayerMovement(startQ, startR, endQ, endR, terrainStaminaCost = 0) {
        return new Promise((resolve) => {
            const player = document.getElementById('player');
            const hexGroup = document.getElementById('hexGroup');
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
        const terrain = targetHex.getAttribute('data-terrain');
        const targetTerrain = terrain === 'BASE_CAMP' ? SPECIAL_LOCATIONS.BASE_CAMP :
                             terrain === 'SOUTH_POLE' ? SPECIAL_LOCATIONS.SOUTH_POLE :
                             TERRAIN_TYPES[terrain];
        
        const oldQ = gameStore.playerPosition.q;
        const oldR = gameStore.playerPosition.r;
        
        // Update position using GameState
        GameState.updatePlayerPosition({ q: newQ, r: newR });
        
        if (targetTerrain?.healthRisk) {
            GameState.player.stats.health = Math.max(
                0, 
                GameState.player.stats.health - (targetTerrain.healthRisk * 100)
            );
            MessageManager.showPlayerMessage(
                "The bitter cold of the ice field bites into you.",
                MESSAGE_TYPES.STATUS
            );
        }
        
        if (WeatherState.current.type === 'BLIZZARD') {
            WeatherState.methods.updateVisibility(`${newQ},${newR}`, true);
            VisibilityManager.getAdjacentHexes({ q: newQ, r: newR }).forEach(hex => {
                WeatherState.methods.updateVisibility(`${hex.q},${hex.r}`, true);
            });
            VisibilityManager.updateVisibility(true);
        } else {
            VisibilityManager.updateVisibility(false);
        }
        
        await this.animatePlayerMovement(
            oldQ, oldR, 
            newQ, newR, 
            targetTerrain?.staminaCost || 0
        );
        
        this.checkVictoryConditions(newQ, newR);
        
        GameState.world.selectedHex = null;
        this.resetHexColors();
        MessageManager.updateCurrentLocationInfo();
    },

    checkVictoryConditions(newQ, newR) {
        const isSouthPole = newQ === gameStore.southPole.q && 
                           newR === gameStore.southPole.r;
        const isBaseCamp = newQ === gameStore.baseCamp.q && 
                          newR === gameStore.baseCamp.r;

        if (isSouthPole && !GameState.world.southPoleVisited) {
            GameState.world.southPoleVisited = true;
            document.getElementById('game-message').className = 'narrative';
            document.getElementById('game-message').innerHTML = 
                "At last! Through bitter cold and endless white, you've reached the South Pole! " +
                "Now the treacherous journey back to base camp awaits...";
        } else if (GameState.world.southPoleVisited && isBaseCamp) {
            this.handleVictory();
        }
    },

    handleVictory() {
        const message = "Against all odds, you've done it! You've reached the South Pole " +
                       "and returned to tell the tale. Your name will be forever etched " +
                       "in the annals of polar exploration.";
        
        GameState.game.won = true;
        
        const restartBtn = document.getElementById('restart-button');
        restartBtn.classList.remove('hidden');
        restartBtn.style.display = 'block';
        
        document.getElementById('game-message').className = 'narrative';
        document.getElementById('game-message').innerHTML = message;
    },

    getHexCenter(q, r) {
        const hexWidth = Math.sqrt(3) * 30;
        const hexHeight = 30 * 2;
        const x = hexWidth * (q + r/2);
        const y = hexHeight * (r * 3/4);
        return { x, y };
    },

    handleHexSelection(hex, q, r, terrainInfo) {
        this.resetHexColors();
        const isAdjacentToPlayer = VisibilityManager.isAdjacent(
            { q, r }, 
            GameState.player.position
        );

        if (GameState.world.selectedHex && GameState.world.selectedHex === hex) {
            if (isAdjacentToPlayer) {
                const totalStaminaCost = MOVEMENT.STAMINA_COST + (terrainInfo.staminaCost || 0);
                
                if (!terrainInfo.passable) {
                    MessageManager.showPlayerMessage(
                        "This terrain is impassable!", 
                        MESSAGE_TYPES.TERRAIN
                    );
                } else if (GameState.player.stats.stamina < totalStaminaCost) {
                    MessageManager.showPlayerMessage(
                        "You are too exhausted",
                        MESSAGE_TYPES.TERRAIN
                    );
                    const staminaBar = document.getElementById('stamina-bar').parentElement;
                    staminaBar.classList.add('pulse-warning');
                    setTimeout(() => staminaBar.classList.remove('pulse-warning'), 1500);
                } else {
                    this.handleMovement(q, r, totalStaminaCost);
                }
            }
            GameState.world.selectedHex = null;
        } else {
            GameState.world.selectedHex = hex;
            hex.setAttribute('stroke', '#000000');
            hex.setAttribute('stroke-width', '3');
            
            if (!WeatherState.effects.whiteoutPhase && 
                (!WeatherState.effects.blizzardActive || 
                 (q === GameState.player.position.q && r === GameState.player.position.r))) {
                document.getElementById('game-message').className = 'terrain-info';
                document.getElementById('game-message').innerHTML = `
                    <h3>${terrainInfo.name}</h3>
                    <p><em>${terrainInfo.quote}</em></p>
                `;
            }
        }
    },

    async handleMovement(q, r, totalStaminaCost) {
        // Update player stamina
        GameState.player.stats.stamina -= totalStaminaCost;
        
        // Update hunger by 5 percent of max value (which is 100)
        GameState.player.stats.hunger = Math.max(
            0,
            GameState.player.stats.hunger - 5
        );

        // Handle starvation effects
        if (GameState.player.stats.hunger <= 0) {
            GameState.player.stats.hunger = 0;
            GameState.player.stats.health = Math.max(0, GameState.player.stats.health - 5);
            GameState.player.stats.stamina = Math.max(0, GameState.player.stats.stamina - 5);
            
            // Visual feedback for critical status
            const healthBar = document.getElementById('health-bar').parentElement;
            const staminaBar = document.getElementById('stamina-bar').parentElement;
            healthBar.classList.add('pulse-warning');
            staminaBar.classList.add('pulse-warning');
            setTimeout(() => {
                healthBar.classList.remove('pulse-warning');
                staminaBar.classList.remove('pulse-warning');
            }, 1500);
        }
        
        // Update time tracking and UI
        GameState.player.lastMoveTime = Date.now();
        StatsManager.updateStatsDisplay();
        await this.updatePlayerPosition(q, r);
    }
};

export default MovementManager;