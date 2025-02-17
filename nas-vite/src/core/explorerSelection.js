// src/core/explorerSelection.js

export class ExplorerSelection {
    constructor() {
        this.container = null;
        this.onComplete = null;
        this.selectedExplorer = null;
        this.continueButton = null;
        this.init();
    }

    init() {
        // Remove any existing explorer selection screen
        const existingScreen = document.querySelector('.explorer-selection-screen');
        if (existingScreen) {
            existingScreen.remove();
        }

        // Create explorer selection screen container
        this.container = document.createElement('div');
        this.container.className = 'explorer-selection-screen';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.right = '0';
        this.container.style.bottom = '0';
        this.container.style.backgroundColor = '#013A63';
        this.container.style.color = '#fff';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.padding = 'calc(env(safe-area-inset-top, 40px) + 20px) env(safe-area-inset-right, 20px) env(safe-area-inset-bottom, 20px) env(safe-area-inset-left, 20px)';
        this.container.style.boxSizing = 'border-box';
        this.container.style.overflowY = 'auto';
        this.container.style.webkitOverflowScrolling = 'touch';

        // Create inner container with max width
        const innerContainer = document.createElement('div');
        innerContainer.style.width = '100%';
        innerContainer.style.maxWidth = '800px';
        innerContainer.style.height = '100%';
        innerContainer.style.display = 'flex';
        innerContainer.style.flexDirection = 'column';
        innerContainer.style.alignItems = 'center';
        this.container.appendChild(innerContainer);

        // Create title
        const title = document.createElement('h2');
        title.style.fontFamily = "'Old Standard TT', serif";
        title.style.fontSize = '26px';
        title.style.margin = '0 0 30px 0';
        title.style.color = 'rgba(255, 255, 255, 0.8)';
        title.style.textTransform = 'uppercase';
        title.textContent = 'Choose Your Explorer';
        innerContainer.appendChild(title);

        // Create selected explorer display
        const selectedExplorer = document.createElement('div');
        selectedExplorer.style.backgroundColor = 'transparent';
        selectedExplorer.style.padding = '0';
        selectedExplorer.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        selectedExplorer.style.width = '200px';
        selectedExplorer.style.aspectRatio = '1';
        selectedExplorer.style.position = 'relative';
        selectedExplorer.style.marginBottom = '30px';
        selectedExplorer.style.display = 'flex';
        selectedExplorer.style.flexDirection = 'column';
        selectedExplorer.style.alignItems = 'center';
        selectedExplorer.style.gap = '10px';
        innerContainer.appendChild(selectedExplorer);

        // Create scrollable container
        const scrollContainer = document.createElement('div');
        scrollContainer.style.flex = '1';
        scrollContainer.style.width = '100%';
        scrollContainer.style.overflowY = 'scroll';
        scrollContainer.style.scrollbarWidth = 'none';
        scrollContainer.style.msOverflowStyle = 'none';
        scrollContainer.style.webkitScrollbar = 'none';
        scrollContainer.style.marginBottom = '20px';
        scrollContainer.style.padding = '10px';
        scrollContainer.style.boxSizing = 'border-box';
        scrollContainer.style.minHeight = '0';

        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
        gridContainer.style.gap = '20px';
        gridContainer.style.width = '75%';
        gridContainer.style.margin = '0 auto';

        // Create explorer cells
        for (let i = 1; i <= 8; i++) {
            const cell = document.createElement('div');
            cell.style.backgroundColor = 'transparent';
            cell.style.padding = '0';
            cell.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            cell.style.cursor = 'pointer';
            cell.style.position = 'relative';
            cell.style.width = '100%';
            cell.style.aspectRatio = '1';

            // Create image
            const img = document.createElement('img');
            img.src = `./art/explorers/explorer_0${i}.png`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.position = 'absolute';
            img.style.top = '0';
            img.style.left = '0';
            cell.appendChild(img);

            cell.addEventListener('click', () => {
                // Remove selected class from all cells
                gridContainer.querySelectorAll('div').forEach(div => {
                    div.style.outline = 'none';
                });
                // Add selected class to clicked cell
                cell.style.outline = '2px solid #44aaff';
                
                // Update selected explorer display
                selectedExplorer.innerHTML = '';
                selectedExplorer.style.border = '3px solid gold';
                const selectedImg = document.createElement('img');
                selectedImg.src = `./art/explorers/explorer_0${i}.png`;
                selectedImg.style.width = '100%';
                selectedImg.style.height = '100%';
                selectedImg.style.objectFit = 'cover';
                selectedImg.style.position = 'absolute';
                selectedImg.style.top = '0';
                selectedImg.style.left = '0';
                selectedExplorer.appendChild(selectedImg);

                // Update selection state and button
                this.selectedExplorer = i;
                this.updateContinueButton();
            });
            gridContainer.appendChild(cell);
        }

        scrollContainer.appendChild(gridContainer);
        innerContainer.appendChild(scrollContainer);

        // Create continue button
        this.continueButton = document.createElement('button');
        this.continueButton.className = 'start-button';
        this.continueButton.style.padding = '20px 40px';
        this.continueButton.style.fontSize = '24px';
        this.continueButton.style.cursor = 'default';
        this.continueButton.style.backgroundColor = '#666';
        this.continueButton.style.color = '#aaa';
        this.continueButton.style.border = '2px solid #666';
        this.continueButton.style.textTransform = 'uppercase';
        this.continueButton.style.fontFamily = "'Old Standard TT', serif";
        this.continueButton.style.transition = 'all 0.3s ease';
        this.continueButton.disabled = true;
        this.continueButton.textContent = 'SELECT EXPLORER';
        this.continueButton.addEventListener('click', () => this.handleContinue());
        innerContainer.appendChild(this.continueButton);

        // Initialize button state
        this.updateContinueButton();

        // Add to document
        document.body.appendChild(this.container);
    }

    updateContinueButton() {
        if (this.selectedExplorer) {
            this.continueButton.disabled = false;
            this.continueButton.style.backgroundColor = 'transparent';
            this.continueButton.style.color = '#fff';
            this.continueButton.style.border = '2px solid #fff';
            this.continueButton.style.cursor = 'pointer';
            this.continueButton.textContent = 'CONFIRM EXPLORER';

            // Add hover effects only when enabled
            this.continueButton.addEventListener('mouseover', () => {
                if (!this.continueButton.disabled) {
                    this.continueButton.style.backgroundColor = '#fff';
                    this.continueButton.style.color = '#000';
                }
            });
            this.continueButton.addEventListener('mouseout', () => {
                if (!this.continueButton.disabled) {
                    this.continueButton.style.backgroundColor = 'transparent';
                    this.continueButton.style.color = '#fff';
                }
            });
        } else {
            this.continueButton.disabled = true;
            this.continueButton.style.backgroundColor = '#666';
            this.continueButton.style.color = '#aaa';
            this.continueButton.style.border = '2px solid #666';
            this.continueButton.style.cursor = 'default';
            this.continueButton.textContent = 'SELECT EXPLORER';
        }
    }

    handleContinue() {
        if (!this.selectedExplorer) return;
        
        // Remove explorer selection screen
        document.body.removeChild(this.container);
        
        // Call onComplete callback if it exists
        if (this.onComplete) {
            this.onComplete();
        }
    }
}

export default ExplorerSelection;
