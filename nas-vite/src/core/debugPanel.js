// src/core/debugPanel.js

class DebugPanel {
    constructor() {
        if (DebugPanel.instance) {
            return DebugPanel.instance;
        }
        
        this.isActive = false;
        this.debugManager = null;
        this.weatherSystem = null;

        // Wait for controls container to exist before creating panel
        const checkForControls = () => {
            if (document.querySelector('.game-controls-area')) {
                this.createDebugPanel();
                this.createDebugButton();
            } else {
                setTimeout(checkForControls, 100);
            }
        };
        checkForControls();

        DebugPanel.instance = this;
    }

    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.className = 'performance-panel hidden'; // Reuse performance panel styling
        panel.innerHTML = `
            <div class="performance-content">
                <div class="performance-section">
                    <h4>Debug Controls</h4>
                    <div class="debug-buttons">
                        <button class="debug-button" data-action="godMode">
                            God Mode
                            <span class="shortcut">Ctrl+Alt+G</span>
                        </button>
                        <button class="debug-button" data-action="fogOfWar">
                            Toggle Fog of War
                            <span class="shortcut">Ctrl+Alt+F</span>
                        </button>
                        <button class="debug-button" data-action="southPole">
                            Highlight South Pole
                            <span class="shortcut">Ctrl+Alt+S</span>
                        </button>
                        <button class="debug-button" data-action="blizzard">
                            Trigger Blizzard
                            <span class="shortcut">Ctrl+Alt+B</span>
                        </button>
                        <button class="debug-button" data-action="whiteout">
                            Trigger Whiteout
                            <span class="shortcut">Ctrl+Alt+W</span>
                        </button>
                        <button class="debug-button" data-action="clearWeather">
                            Clear Weather
                            <span class="shortcut">Ctrl+Alt+C</span>
                        </button>
                        <button class="debug-button" data-action="disableWeather">
                            Disable Weather
                            <span class="shortcut">Ctrl+Alt+D</span>
                        </button>
                        <button class="debug-button" data-action="reduceHealth">
                            Reduce Health
                            <span class="shortcut">Ctrl+Alt+H</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insert after the controls container in game-controls-area
        const controlsArea = document.querySelector('.game-controls-area');
        if (controlsArea) {
            controlsArea.appendChild(panel);
        }

        // Add click handlers for debug buttons
        panel.querySelectorAll('.debug-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                this.handleDebugAction(action, button);
            });
        });

        // Add styles for debug panel
        const style = document.createElement('style');
        style.textContent = `
            .debug-button {
                width: 100%;
                padding: 8px;
                margin: 4px 0;
                background: rgba(255, 215, 0, 0.1);
                border: 1px solid rgba(255, 215, 0, 0.3);
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-family: inherit;
                transition: all 0.2s ease;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }

            .debug-button:hover {
                background: rgba(255, 215, 0, 0.2);
            }

            .debug-button.active {
                background: rgba(255, 215, 0, 0.3);
                border-color: rgba(255, 215, 0, 0.5);
            }

            .debug-panel-button {
                padding: 8px;
                border-radius: 4px;
                transition: all 0.2s;
                background: transparent;
                border: none;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 48px;
                height: 48px;
                pointer-events: all;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
            }

            .debug-panel-button:hover {
                background: rgba(255, 215, 0, 0.2);
            }

            .debug-panel-button.active {
                background: rgba(255, 215, 0, 0.3);
                box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.5);
            }

            .debug-icon {
                width: 32px;
                height: 32px;
                transition: filter 0.2s, opacity 0.2s;
                pointer-events: none;
                user-select: none;
                filter: invert(1);
                opacity: 0.3;
            }

            .debug-panel-button:hover .debug-icon,
            .debug-panel-button.active .debug-icon {
                opacity: 0.8;
            }

            .shortcut {
                font-size: 0.8em;
                opacity: 0.6;
                font-family: monospace;
                padding: 2px 4px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                white-space: nowrap;
            }

            .debug-button:hover .shortcut {
                opacity: 0.8;
            }
        `;
        document.head.appendChild(style);
    }

    createDebugButton() {
        const controlsContainer = document.querySelector('.controls-container');
        if (!controlsContainer) return;

        const button = document.createElement('button');
        button.className = 'debug-panel-button';
        button.innerHTML = `<img src="./public/art/bug.svg" alt="Debug" class="debug-icon">`;

        // Insert next to the performance monitor button
        const perfButton = controlsContainer.querySelector('.performance-button');
        if (perfButton) {
            controlsContainer.insertBefore(button, perfButton);
        } else {
            controlsContainer.appendChild(button);
        }

        button.addEventListener('click', () => this.togglePanel());
    }

    togglePanel() {
        const panel = document.getElementById('debug-panel');
        const debugButton = document.querySelector('.debug-panel-button');
        const perfPanel = document.getElementById('performance-panel');
        const body = document.body;
        
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            debugButton?.classList.add('active');
            this.isActive = true;
            // Enable scrolling when debug panel is active
            body.style.overflow = 'auto';
            body.style.touchAction = 'auto';
        } else {
            panel.classList.add('hidden');
            debugButton?.classList.remove('active');
            this.isActive = false;
            // Only restore original overflow settings if perf monitor is also hidden
            if (perfPanel.classList.contains('hidden')) {
                body.style.overflow = 'hidden';
                body.style.touchAction = 'none';
            }
        }
    }

    handleDebugAction(action, button) {
        if (!this.debugManager || !this.weatherSystem) return;

        switch (action) {
            case 'disableWeather':
                this.debugManager.toggleWeatherDisabled();
                button.classList.toggle('active', this.debugManager.weatherDisabled);
                break;
            case 'godMode':
                this.debugManager.toggleGodMode();
                button.classList.toggle('active', this.debugManager.godModeActive);
                break;
            case 'fogOfWar':
                this.debugManager.toggleFogOfWar();
                button.classList.toggle('active', this.debugManager.fogRevealActive);
                break;
            case 'southPole':
                this.debugManager.toggleSouthPoleHighlight();
                button.classList.toggle('active', this.debugManager.southPoleHighlightActive);
                break;
            case 'blizzard':
                this.weatherSystem.triggerBlizzard();
                break;
            case 'whiteout':
                this.weatherSystem.triggerWhiteout();
                break;
            case 'clearWeather':
                this.weatherSystem.resetWeatherState();
                break;
            case 'reduceHealth':
                if (!this.debugManager.godModeActive) {
                    const currentHealth = this.debugManager.store.player.stats.health;
                    const reduction = 20;
                    this.debugManager.store.player.stats.health = Math.max(0, currentHealth - reduction);
                    this.debugManager.showDebugMessage(`HEALTH REDUCED BY ${reduction}%`);
                } else {
                    this.debugManager.showDebugMessage('HEALTH REDUCTION BLOCKED BY GOD MODE');
                }
                break;
        }
    }

    setDebugManager(debugManager) {
        this.debugManager = debugManager;
    }

    setWeatherSystem(weatherSystem) {
        this.weatherSystem = weatherSystem;
    }
}

// Create and export a single instance
export const debugPanel = new DebugPanel();
export default debugPanel;
