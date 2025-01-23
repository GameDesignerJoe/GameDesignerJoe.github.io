// src/game/ui/messages.js

import { GameState } from '../core/gameState.js';
import { WeatherState } from '../core/weatherState.js';
import { TERRAIN_TYPES, SPECIAL_LOCATIONS } from '../core/gameState.js';

export const MESSAGE_TYPES = {
    TERRAIN: 'terrain',
    STATUS: 'status',
};

export const MessageManager = {
    activeMessageTimeout: null,
    currentMessageType: null,

    showPlayerMessage(message, type = MESSAGE_TYPES.TERRAIN) {
        // Don't show messages during whiteout except for STATUS messages
        if (WeatherState.effects.whiteoutPhase && type !== MESSAGE_TYPES.STATUS) {
            return;
        }
    
        if (this.activeMessageTimeout) {
            clearTimeout(this.activeMessageTimeout);
        }
        
        const messageContainer = document.getElementById('player-message');
        const messageText = document.getElementById('player-message-text');
        
        messageContainer.classList.remove('whiteout-message', 'blizzard-message');
        
        if (WeatherState.effects.whiteoutPhase) {
            messageContainer.classList.add('whiteout-message');
        } else if (WeatherState.effects.blizzardActive) {
            messageContainer.classList.add('blizzard-message');
        }
        
        messageText.textContent = message;
        messageContainer.classList.add('visible');
        this.currentMessageType = type;
        
        this.activeMessageTimeout = setTimeout(() => {
            messageContainer.classList.remove('visible');
            this.currentMessageType = null;
        }, 5000);
    },

    clearTerrainMessage() {
        if (this.currentMessageType === MESSAGE_TYPES.TERRAIN) {
            const messageContainer = document.getElementById('player-message');
            messageContainer.classList.remove('visible');
            this.currentMessageType = null;
            if (this.activeMessageTimeout) {
                clearTimeout(this.activeMessageTimeout);
                this.activeMessageTimeout = null;
            }
        }
    },

    showInitialMessage() {
        const messageElement = document.getElementById('game-message');
        messageElement.className = 'narrative';
        messageElement.innerHTML = 
            "Before you lies the vast Antarctic expanse, untamed and unforgiving. The freezing wind howls a challenge promising either immortal glory or eternal rest beneath the ice.";
    },

    updateCurrentLocationInfo() {
        // Don't update if in special game states
        if (GameState.game.won || 
            (GameState.world.southPoleVisited && 
             GameState.player.position.q === GameState.world.southPole.q && 
             GameState.player.position.r === GameState.world.southPole.r)) {
            return;
        }
    
        const messageElement = document.getElementById('game-message');
        messageElement.classList.remove('whiteout-message', 'blizzard-message');
    
        if (WeatherState.effects.whiteoutPhase) {
            messageElement.classList.add('whiteout-message');
            messageElement.innerHTML = `
                <h3>White Out Conditions</h3>
                <p><em>"The world beyond arm's reach has vanished into white..."</em></p>
            `;
            return;
        }
    
        if (WeatherState.effects.blizzardActive) {
            messageElement.classList.add('blizzard-message');
            messageElement.innerHTML = `
                <h3>Blizzard Conditions</h3>
                <p><em>"The howling wind makes it difficult to see far..."</em></p>
            `;
            return;
        }

        const { q, r } = GameState.player.position;
        const atBaseCamp = q === GameState.world.baseCamp.q && r === GameState.world.baseCamp.r;
        const atSouthPole = q === GameState.world.southPole.q && r === GameState.world.southPole.r;
        
        if (atBaseCamp && !GameState.game.won) {
            messageElement.innerHTML = `
                <h3>Base Camp</h3>
                <p><em>"The familiar sight of base camp brings a sense of relief."</em></p>
            `;
        } else if (atSouthPole) {
            messageElement.innerHTML = `
                <h3>South Pole</h3>
                <p><em>"Could this be it? The South Pole itself?"</em></p>
            `;
        } else {
            const currentHex = document.querySelector(`polygon[data-q="${q}"][data-r="${r}"]`);
            if (currentHex) {
                const terrain = currentHex.getAttribute('data-terrain');
                const terrainInfo = TERRAIN_TYPES[terrain];
                messageElement.innerHTML = `
                    <h3>${terrainInfo.name}</h3>
                    <p><em>${terrainInfo.quote}</em></p>
                `;
            }
        }
    }
};