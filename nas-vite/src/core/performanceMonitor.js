// src/core/performanceMonitor.js

class PerformanceMonitor {
    constructor() {
        if (PerformanceMonitor.instance) {
            return PerformanceMonitor.instance;
        }
        
        this.isActive = false;
        this.methodStats = new Map();
        this.frameTime = {
            current: 0,
            avg: 0,
            min: Infinity,
            max: 0,
            samples: []
        };
        this.lastFrameTime = performance.now();
        this.sampleSize = 60; // 1 second at 60fps
        
        // Start the update loop
        this.update = this.update.bind(this);
        requestAnimationFrame(this.update);

        // Wait for controls container to exist before creating panel
        const checkForControls = () => {
            if (document.querySelector('.controls-container')) {
                this.createPerformancePanel();
            } else {
                setTimeout(checkForControls, 100);
            }
        };
        checkForControls();

        PerformanceMonitor.instance = this;
    }

    createPerformancePanel() {
        const panel = document.createElement('div');
        panel.id = 'performance-panel';
        panel.className = 'performance-panel hidden';
        panel.innerHTML = `
            <button class="close-button">×</button>
            <div class="performance-content">
                <div class="performance-section">
                    <h4>Frame Time</h4>
                    <div id="frame-stats"></div>
                </div>
                <div class="performance-section">
                    <h4>Hot Functions</h4>
                    <div id="function-stats"></div>
                </div>
            </div>
        `;

        // Add event listeners
        panel.querySelector('.close-button').addEventListener('click', () => {
            this.togglePanel();
            // Also update settings button state
            const settingsButton = document.querySelector('.settings-button');
            if (settingsButton) {
                settingsButton.classList.remove('active');
            }
        });

        // Insert after the controls container
        const controlsContainer = document.querySelector('.controls-container');
        if (controlsContainer) {
            controlsContainer.parentNode.insertBefore(panel, controlsContainer.nextSibling);
        } else {
            document.body.appendChild(panel);
        }
    }

    togglePanel() {
        const panel = document.getElementById('performance-panel');
        const settingsButton = document.querySelector('.settings-button');
        
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            settingsButton?.classList.add('active');
            this.isActive = true;
        } else {
            panel.classList.add('hidden');
            settingsButton?.classList.remove('active');
            this.isActive = false;
        }
    }

    trackMethod(name, file, executionTime) {
        if (!this.methodStats.has(name)) {
            this.methodStats.set(name, {
                file,
                calls: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0
            });
        }

        const stats = this.methodStats.get(name);
        stats.calls++;
        stats.totalTime += executionTime;
        stats.avgTime = stats.totalTime / stats.calls;
        stats.maxTime = Math.max(stats.maxTime, executionTime);
    }

    update() {
        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        if (this.isActive) {
            // Update frame time stats
            this.frameTime.current = frameTime;
            this.frameTime.samples.push(frameTime);
            if (this.frameTime.samples.length > this.sampleSize) {
                this.frameTime.samples.shift();
            }
            
            this.frameTime.avg = this.frameTime.samples.reduce((a, b) => a + b, 0) / this.frameTime.samples.length;
            this.frameTime.min = Math.min(this.frameTime.min, frameTime);
            this.frameTime.max = Math.max(this.frameTime.max, frameTime);

            this.updateDisplay();
        }

        requestAnimationFrame(this.update);
    }

    updateDisplay() {
        const frameStats = document.getElementById('frame-stats');
        const functionStats = document.getElementById('function-stats');
        
        if (frameStats && functionStats) {
            // Update frame time display
            frameStats.innerHTML = `
                <div class="stat-row ${this.frameTime.current > 16 ? 'error' : ''}">
                    <div class="frame-stats-group">
                        <span class="stat-label">Crt:${this.frameTime.current.toFixed(1)}</span>
                        <span class="stat-label">Avg:${this.frameTime.avg.toFixed(1)}</span>
                        <span class="stat-label">${this.frameTime.min.toFixed(1)}/${this.frameTime.max.toFixed(1)}</span>
                    </div>
                </div>
            `;

            // Sort methods by average time and update display
            const sortedMethods = Array.from(this.methodStats.entries())
                .sort(([, a], [, b]) => b.avgTime - a.avgTime)
                .slice(0, 5); // Show top 5 methods

            functionStats.innerHTML = sortedMethods.map(([name, stats]) => `
                <div class="stat-row ${stats.avgTime > 16 ? 'error' : stats.avgTime > 8 ? 'warning' : ''}">
                    <span class="stat-name">${name} (${stats.file}):</span>
                    <span class="stat-value">
                        ${stats.avgTime.toFixed(2)}ms avg
                        (${stats.calls} calls, max ${stats.maxTime.toFixed(2)}ms)
                    </span>
                </div>
            `).join('');
        }
    }

    // Decorator-like function to wrap methods for performance tracking
    wrapMethod(target, methodName, fileName) {
        const original = target[methodName];
        const monitor = this;

        target[methodName] = function(...args) {
            const start = performance.now();
            const result = original.apply(this, args);
            const end = performance.now();
            
            monitor.trackMethod(methodName, fileName, end - start);
            
            return result;
        };
    }
}

// Create and export a single instance
export const perfMonitor = new PerformanceMonitor();
export default perfMonitor;
