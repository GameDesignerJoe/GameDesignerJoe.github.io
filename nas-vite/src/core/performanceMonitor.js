// src/core/performanceMonitor.js

class PerformanceMonitor {
    constructor() {
        if (PerformanceMonitor.instance) {
            return PerformanceMonitor.instance;
        }
        
        this.isActive = false;
        this.methodStats = new Map();
        this.eventStats = new Map();
        this.frameTime = {
            current: 0,
            avg: 0,
            min: Infinity,
            max: 0,
            samples: [],
            graph: Array(30).fill(0) // Last 30 frames for mini-graph
        };
        this.lastFrameTime = performance.now();
        this.sampleSize = 60; // 1 second at 60fps
        
        // Start the update loop
        this.update = this.update.bind(this);
        requestAnimationFrame(this.update);

        // Wait for controls container to exist before creating panel
        const checkForControls = () => {
            if (document.querySelector('.game-controls-area')) {
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
            <div class="performance-content">
                <div class="performance-section">
                    <h4>Frame Time</h4>
                    <div id="frame-stats"></div>
                    <div id="frame-graph" class="frame-graph"></div>
                </div>
                <div class="performance-section collapsible">
                    <h4 class="section-header">
                        Event Breakdown
                        <span class="toggle-icon">▼</span>
                    </h4>
                    <div id="event-stats" class="section-content"></div>
                </div>
                <div class="performance-section collapsible">
                    <h4 class="section-header">
                        Hot Functions
                        <span class="toggle-icon">▼</span>
                    </h4>
                    <div id="function-stats" class="section-content"></div>
                </div>
            </div>
        `;

        // Insert after the controls container in game-controls-area
        const controlsArea = document.querySelector('.game-controls-area');
        if (controlsArea) {
            controlsArea.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }

        // Add click handlers for collapsible sections
        panel.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                const content = section.querySelector('.section-content');
                const icon = header.querySelector('.toggle-icon');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            });
        });

        // Initialize section states
        panel.querySelectorAll('.section-content').forEach(content => {
            content.style.display = 'block';
        });

        // Add styles for the frame graph
        const style = document.createElement('style');
        style.textContent = `
            .frame-graph {
                display: flex;
                align-items: flex-end;
                height: 20px;
                gap: 1px;
                margin-top: 4px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 2px;
            }
            .frame-bar {
                flex: 1;
                background: #44aaff;
                min-width: 2px;
                transition: height 0.1s ease;
            }
            .frame-bar.warning {
                background: #ffaa44;
            }
            .frame-bar.error {
                background: #ff4444;
            }
            .section-header {
                cursor: pointer;
                user-select: none;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .toggle-icon {
                font-size: 0.8em;
                color: #666;
            }
            .event-breakdown {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .event-item {
                display: flex;
                justify-content: space-between;
                padding: 2px 4px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    togglePanel() {
        const panel = document.getElementById('performance-panel');
        const settingsButton = document.querySelector('.settings-button');
        const body = document.body;
        
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            settingsButton?.classList.add('active');
            this.isActive = true;
            // Enable scrolling when perf monitor is active
            body.style.overflow = 'auto';
            body.style.touchAction = 'auto';
        } else {
            panel.classList.add('hidden');
            settingsButton?.classList.remove('active');
            this.isActive = false;
            // Restore original overflow settings
            body.style.overflow = 'hidden';
            body.style.touchAction = 'none';
        }
    }

    trackMethod(name, file, executionTime) {
        if (!this.methodStats.has(name)) {
            this.methodStats.set(name, {
                file,
                calls: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                lastUpdate: Date.now(),
                recentCalls: [], // Track recent calls for better averaging
                recentTotal: 0
            });
        }

        const stats = this.methodStats.get(name);
        stats.calls++;
        stats.totalTime += executionTime;
        
        // Track recent calls for a more accurate recent average
        stats.recentCalls.push({
            time: executionTime,
            timestamp: Date.now()
        });
        stats.recentTotal += executionTime;
        
        // Keep only calls from the last 10 seconds
        const tenSecondsAgo = Date.now() - 10000;
        while (stats.recentCalls.length > 0 && stats.recentCalls[0].timestamp < tenSecondsAgo) {
            stats.recentTotal -= stats.recentCalls[0].time;
            stats.recentCalls.shift();
        }
        
        stats.avgTime = stats.recentCalls.length > 0 ? 
            stats.recentTotal / stats.recentCalls.length : 
            stats.totalTime / stats.calls;
        stats.maxTime = Math.max(stats.maxTime, executionTime);
        stats.lastUpdate = Date.now();
    }

    trackEvent(type, details, duration) {
        if (!this.eventStats.has(type)) {
            this.eventStats.set(type, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                details: new Map()
            });
        }

        const stats = this.eventStats.get(type);
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.maxTime = Math.max(stats.maxTime, duration);

        if (details) {
            const detailKey = JSON.stringify(details);
            if (!stats.details.has(detailKey)) {
                stats.details.set(detailKey, { count: 0, details });
            }
            stats.details.get(detailKey).count++;
        }
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

            // Update frame graph
            this.frameTime.graph.push(frameTime);
            this.frameTime.graph.shift();

            this.updateDisplay();
        }

        requestAnimationFrame(this.update);
    }

    updateDisplay() {
        const frameStats = document.getElementById('frame-stats');
        const frameGraph = document.getElementById('frame-graph');
        const eventStats = document.getElementById('event-stats');
        const functionStats = document.getElementById('function-stats');
        
        if (frameStats && frameGraph && eventStats && functionStats) {
            // Update frame time display
            frameStats.innerHTML = `
                <div class="stat-row ${this.frameTime.current > 16 ? 'error' : ''}">
                    <div class="frame-stats-group">
                        <span class="stat-label">Crt: ${this.frameTime.current.toFixed(2)}ms</span>
                        <span class="stat-label">Avg: ${this.frameTime.avg.toFixed(2)}ms</span>
                        <span class="stat-label">Min/Max: ${this.frameTime.min.toFixed(2)}/${this.frameTime.max.toFixed(2)}ms</span>
                    </div>
                </div>
            `;

            // Update frame graph
            frameGraph.innerHTML = this.frameTime.graph.map(time => {
                const height = Math.min((time / 32) * 100, 100); // Scale to max 32ms
                const className = time > 16 ? 'error' : time > 8 ? 'warning' : '';
                return `<div class="frame-bar ${className}" style="height: ${height}%"></div>`;
            }).join('');

            // Update event stats
            const sortedEvents = Array.from(this.eventStats.entries())
                .sort(([, a], [, b]) => b.avgTime - a.avgTime);

            eventStats.innerHTML = sortedEvents.map(([type, stats]) => `
                <div class="event-item ${stats.avgTime > 16 ? 'error' : stats.avgTime > 8 ? 'warning' : ''}">
                    <span class="event-name">${type}:</span>
                    <span class="event-value">
                        ${stats.avgTime.toFixed(2)}ms avg
                        (${stats.count} events, max ${stats.maxTime.toFixed(2)}ms)
                    </span>
                </div>
            `).join('');

            // Update function stats with active time window (last 5 seconds)
            const now = Date.now();
            const activeWindow = 10000; // 10 seconds
            const activeMethods = Array.from(this.methodStats.entries())
                .filter(([, stats]) => now - stats.lastUpdate < activeWindow)
                .sort(([, a], [, b]) => b.avgTime - a.avgTime)
                .slice(0, 15); // Show top 15 methods

            functionStats.innerHTML = activeMethods.length > 0 ? 
                activeMethods.map(([name, stats]) => `
                <div class="stat-row ${stats.avgTime > 16 ? 'error' : stats.avgTime > 8 ? 'warning' : ''}">
                    <span class="stat-name">${name} (${stats.file}):</span>
                    <span class="stat-value">
                        ${stats.avgTime.toFixed(2)}ms avg
                        (${stats.recentCalls?.length || 0} recent / ${stats.calls} total calls, 
                        max ${stats.maxTime.toFixed(2)}ms)
                    </span>
                </div>
            `).join('') :
                '<div class="stat-row"><span class="stat-name">No active methods in the last 10 seconds</span></div>';
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

    // New method to wrap event handlers
    wrapEventHandler(handler, eventType) {
        const monitor = this;
        return function(event) {
            const start = performance.now();
            const result = handler.call(this, event);
            const end = performance.now();
            
            monitor.trackEvent(eventType, {
                target: event.target.tagName,
                type: event.type
            }, end - start);
            
            return result;
        };
    }
}

// Create and export a single instance
export const perfMonitor = new PerformanceMonitor();
export default perfMonitor;
