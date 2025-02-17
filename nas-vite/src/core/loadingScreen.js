// src/core/loadingScreen.js

export class LoadingScreen {
    constructor() {
        this.container = null;
        this.onComplete = null;
        this.init();
    }

    init() {
        // Remove any existing loading screen
        const existingScreen = document.querySelector('.loading-screen');
        if (existingScreen) {
            existingScreen.remove();
        }

        // Hide all game elements
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
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.justifyContent = 'flex-start';
        this.container.style.alignItems = 'center';
        this.container.style.position = 'relative';

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

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'loading-screen-button-container';

        // Create start button
        const button = document.createElement('button');
        button.className = 'start-button';
        button.textContent = 'ANSWER THE CALL';
        button.setAttribute('id', 'start-game-button');
        button.setAttribute('type', 'button');
        button.setAttribute('data-testid', 'start-game-button');
        button.style.outline = 'none';
        button.style.webkitTapHighlightColor = 'transparent';
        
        // Add click handlers
        const handleClick = (e) => {
            console.log('Button clicked:', e.type);
            e.preventDefault();
            e.stopPropagation();
            this.handleStart();
        };

        button.addEventListener('click', handleClick);
        button.addEventListener('mousedown', handleClick);
        button.addEventListener('touchstart', handleClick, { passive: false });

        buttonContainer.appendChild(button);
        this.container.appendChild(buttonContainer);

        // Store click handler for cleanup
        this.handleClick = handleClick;

        // Log button creation
        console.log('Start button created with ID:', button.id);

        // Debug button position
        setTimeout(() => {
            const rect = button.getBoundingClientRect();
            console.log('Button position:', {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
            });
        }, 100);

        // Add to document
        document.body.appendChild(this.container);

        // Elements are now visible by default through CSS
    }

    handleStart() {
        console.log('handleStart called');
        // Remove event listeners
        const button = document.getElementById('start-game-button');
        if (button) {
            button.removeEventListener('click', this.handleClick);
            button.removeEventListener('mousedown', this.handleClick);
            button.removeEventListener('touchstart', this.handleClick);
        }
        
        // Remove loading screen immediately
        document.body.removeChild(this.container);
        
        // Call onComplete callback to transition to explorer selection
        if (this.onComplete) {
            console.log('Calling onComplete callback');
            this.onComplete();
        } else {
            console.log('No onComplete callback found');
        }
    }
}

export default LoadingScreen;
