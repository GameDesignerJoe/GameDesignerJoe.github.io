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

        // Trigger animations with slight delays
        requestAnimationFrame(() => {
            setTimeout(() => ad.classList.add('visible'), 500);
            setTimeout(() => title.classList.add('visible'), 2500);
            setTimeout(() => button.classList.add('visible'), 4500);
        });
    }

    handleStart() {
        // Fade out loading screen
        this.container.style.transition = 'opacity 1s ease-in-out';
        this.container.style.opacity = '0';

        setTimeout(() => {
            // Remove loading screen
            document.body.removeChild(this.container);
            
            // Initialize game systems first
            if (this.onComplete) {
                this.onComplete();
            }
            
            // Show packing screen only after game systems are initialized
            requestAnimationFrame(() => {
                const packingScreen = document.getElementById('packing-screen');
                if (packingScreen) {
                    packingScreen.style.display = 'block';
                    packingScreen.style.opacity = '0';
                    requestAnimationFrame(() => {
                        packingScreen.style.transition = 'opacity 0.5s ease-in-out';
                        packingScreen.style.opacity = '1';
                    });
                }
            });
        }, 1000);
    }
}

export default LoadingScreen;