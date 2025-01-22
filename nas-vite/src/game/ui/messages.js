// src/game/ui/messages.js

// Message types
export const MESSAGE_TYPES = {
    TERRAIN: 'terrain',     // For terrain-related messages (impassable, exhaustion)
    STATUS: 'status',       // For important status messages (starving, victory)
};

export const MessageManager = {
    activeMessageTimeout: null,
    currentMessageType: null,

    // Modify the showPlayerMessage function to handle timeouts better
    showPlayerMessage(message, type = MESSAGE_TYPES.TERRAIN) {
        // Don't show messages during whiteout except for STATUS messages
        if (WEATHER.state.whiteoutPhase && type !== MESSAGE_TYPES.STATUS) {
            console.log('Message Debug: Suppressing message during whiteout:', message);
            return;
        }
    
        // Clear any existing timeout
        if (this.activeMessageTimeout) {
            clearTimeout(this.activeMessageTimeout);
        }
        
        const messageContainer = document.getElementById('player-message');
        const messageText = document.getElementById('player-message-text');
        
        // Remove any existing weather classes first
        messageContainer.classList.remove('whiteout-message', 'blizzard-message');
        
        // Add weather-specific classes
        if (WEATHER.state.whiteoutPhase) {
            messageContainer.classList.add('whiteout-message');
        } else if (WEATHER.state.blizzardActive) {
            messageContainer.classList.add('blizzard-message');
        }
        
        messageText.textContent = message;
        messageContainer.classList.add('visible');
        this.currentMessageType = type;
        
        // Set timeout for all message types
        this.activeMessageTimeout = setTimeout(() => {
            console.log('Message Debug: Clearing message:', message);
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
        // Don't update if we're in a major game state
        if (gameWon || southPoleVisited && playerPosition.q === southPole.q && playerPosition.r === southPole.r) {
            return;
        }
        // If game is won, don't update location info
        if (gameWon) {
            return;
        }
    
        const messageElement = document.getElementById('game-message');
        
        // Add/remove weather classes for styling
        messageElement.classList.remove('whiteout-message', 'blizzard-message');
    
        if (WEATHER.state.whiteoutPhase) {
            messageElement.classList.add('whiteout-message');
            messageElement.innerHTML = `
                <h3>White Out Conditions</h3>
                <p><em>"The world beyond arm's reach has vanished into white..."</em></p>
            `;
            return;
        }
    
        if (WEATHER.state.blizzardActive) {
            messageElement.classList.add('blizzard-message');
            messageElement.innerHTML = `
                <h3>Blizzard Conditions</h3>
                <p><em>"The howling wind makes it difficult to see far..."</em></p>
            `;
            return;
        }

        // Regular location info continues here...
        const atBaseCamp = playerPosition.q === baseCamp.q && playerPosition.r === baseCamp.r;
        const atSouthPole = southPole && playerPosition.q === southPole.q && playerPosition.r === southPole.r;
        
        if (atBaseCamp && !gameWon) {
            document.getElementById('game-message').innerHTML = `
                <h3>Base Camp</h3>
                <p><em>"The familiar sight of base camp brings a sense of relief."</em></p>
            `;
        } else if (atSouthPole) {
            document.getElementById('game-message').innerHTML = `
                <h3>South Pole</h3>
                <p><em>"Could this be it? The South Pole itself?"</em></p>
            `;
        } else {
            // Find the hex at current position
            const currentHex = document.querySelector(`polygon[data-q="${playerPosition.q}"][data-r="${playerPosition.r}"]`);
            if (currentHex) {
                const terrain = currentHex.getAttribute('data-terrain');
                const terrainInfo = TERRAIN_TYPES[terrain];
                document.getElementById('game-message').innerHTML = `
                    <h3>${terrainInfo.name}</h3>
                    <p><em>${terrainInfo.quote}</em></p>
                `;
            }
        }
    },

    showLocationMessage() {
        const messageElement = document.getElementById('game-message');
        const atBaseCamp = playerPosition.q === baseCamp.q && playerPosition.r === baseCamp.r;
        const atSouthPole = southPole && playerPosition.q === southPole.q && playerPosition.r === southPole.r;
        
        if (atBaseCamp && !gameWon) {
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
            const currentHex = document.querySelector(
                `polygon[data-q="${playerPosition.q}"][data-r="${playerPosition.r}"]`
            );
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
}