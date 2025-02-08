// src/core/loadingScreen.js

export class LoadingScreen {
    constructor() {
        this.container = null;
        this.onComplete = null;
        this.init();
    }

    init() {
        // First, hide everything
        document.querySelectorAll('.game-element').forEach(el => {
            el.style.display = 'none';
        });

        const packingScreen = document.getElementById('packing-screen');
        if (packingScreen) {
            packingScreen.style.display = 'none';
        }

        // Create loading screen container
        this.container = document.createElement('div');
        this.container.className = 'loading-screen';

        // Create title
        const title = document.createElement('div');
        title.className = 'title-text';
        title.textContent = 'NOT ALL SURVIVE';
        this.container.appendChild(title);

        // Create advertisement
        const ad = document.createElement('div');
        ad.className = 'advertisement';
        ad.innerHTML = `Men wanted for hazardous journey.<br>
                       Low wages, bitter cold,<br>
                       long hours of complete darkness.<br>
                       Safe return doubtful.<br>
                       Honour and recognition in event of success.`;
        this.container.appendChild(ad);

        // Create start button
        const button = document.createElement('button');
        button.className = 'start-button';
        button.textContent = 'ANSWER THE CALL';
        button.addEventListener('click', () => this.handleStart());
        this.container.appendChild(button);

        // Add to document
        document.body.appendChild(this.container);

        // Elements are now visible by default through CSS
    }

    handleStart() {
        // Remove loading screen immediately
        document.body.removeChild(this.container);
        
        // Initialize game systems
        if (this.onComplete) {
            this.onComplete();
        }
        
        // Show packing screen
        const packingScreen = document.getElementById('packing-screen');
        if (packingScreen) {
            packingScreen.style.display = 'block';
        }
    }
}

export default LoadingScreen;
