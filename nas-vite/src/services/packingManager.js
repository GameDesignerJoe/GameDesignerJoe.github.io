// src/services/packingManager.js
import { gameStore } from '../state/store.js';
import { ITEMS_DATABASE } from '../config/itemsDatabase.js';
// CSS is now loaded via HTML link tag

export class PackingManager {
    constructor(containerElement) {
        this.container = containerElement;
        this.gameStore = gameStore;
        this.tooltipElement = null;
        
        // Add class to body when packing manager is active
        document.body.classList.add('packing-active');
        
        this.initializeUI();
        this.updateAvailableItemsPanel();
    }

    initializeUI() {
        // Create title first, before the wrapper
        this.createTitle();
        
        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'packing-container';
        this.container.appendChild(this.wrapper);
        
        // Create tabs BEFORE the items panels
        this.createTabs();
        
        // Create item panels container
        const panelsContainer = document.createElement('div');
        panelsContainer.className = 'panels-container';
        this.wrapper.appendChild(panelsContainer);
        
        // Create panels
        this.createAvailableItemsPanel(panelsContainer);
        this.createSelectedItemsPanel(panelsContainer);
        
        // Create bottom buttons - using the existing method name
        this.createControlButtons();
        
        // Add this line to initialize the weight display immediately
        this.updateWeightDisplay();
        
        this.setupEventListeners();
    }

    createTabs() {
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'tabs-container';
        tabsDiv.innerHTML = `
            <button class="tab-button active" data-panel="available">Available Items</button>
            <button class="tab-button" data-panel="packed">Packed Items</button>
        `;
        
        tabsDiv.querySelectorAll('.tab-button').forEach(button => {
            button.onclick = () => this.switchTab(button.dataset.panel);
        });
        
        // Add to wrapper instead of SVG
        this.wrapper.appendChild(tabsDiv);
    }
    
    switchTab(panelName) {
        // Update panel visibility
        this.availableItemsContainer.classList.toggle('active', panelName === 'available');
        this.selectedItemsContainer.classList.toggle('active', panelName === 'packed');
        
        // Update tab button styles
        const buttons = document.querySelectorAll('.tab-button');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelName);
        });
    }

    createTitle() {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'packing-header';
        
        const h1 = document.createElement('h1');
        h1.textContent = "NOT ALL SURVIVE";
        
        const h2 = document.createElement('h2');
        h2.textContent = "Expedition Supplies";
        
        titleDiv.appendChild(h1);
        titleDiv.appendChild(h2);
        
        this.container.appendChild(titleDiv);
    }
    
    createAvailableItemsPanel(container) {
        const scrollableDiv = document.createElement('div');
        scrollableDiv.className = 'scrollable-panel active'; // Start with available items visible
        container.appendChild(scrollableDiv);
        this.availableItemsContainer = scrollableDiv;
    }

    createSelectedItemsPanel(container) {
        const scrollableDiv = document.createElement('div');
        scrollableDiv.className = 'scrollable-panel';
        container.appendChild(scrollableDiv);
        this.selectedItemsContainer = scrollableDiv;
    }

    createItemEntry(container, item, isAvailable) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-entry';
    
        itemDiv.innerHTML = `
            <span>${item.name}</span>
            <span>${item.weight} lbs</span>
            <button class="item-button ${isAvailable ? 'take' : 'remove'}">
                ${isAvailable ? 'Take' : 'Remove'}
            </button>
        `;
    
        const button = itemDiv.querySelector('button');
        button.onclick = () => {
            if (isAvailable) {
                this.gameStore.packing.addItem(item);
            } else {
                this.gameStore.packing.removeItem(item.id);
            }
            this.updateUI();
        };
    
        container.appendChild(itemDiv);
    }

    createButton(text, x, y, width, height, color, onClick) {
        const button = document.createElementNS("http://www.w3.org/2000/svg", "g");
        button.style.cursor = 'pointer';
        
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", color);
        rect.setAttribute("rx", "4");
        
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElement.setAttribute("x", x + width/2);
        textElement.setAttribute("y", y + height/2 + 6);
        textElement.setAttribute("text-anchor", "middle");
        textElement.setAttribute("font-size", "16");
        textElement.setAttribute("fill", "white");
        textElement.setAttribute("font-family", "'Old Standard TT', serif");
        textElement.textContent = text;
    
        button.appendChild(rect);
        button.appendChild(textElement);
        
        button.addEventListener("mouseover", () => {
            rect.setAttribute("fill", "#3399ee");
        });
        button.addEventListener("mouseout", () => {
            rect.setAttribute("fill", color);
        });
        button.addEventListener("mousedown", () => {
            rect.setAttribute("fill", "#2288dd");
        });
        button.addEventListener("mouseup", () => {
            rect.setAttribute("fill", "#3399ee");
        });
        
        button.addEventListener("click", (e) => {
            console.log('Button clicked:', text);
            onClick(e);
        });
        return button;
    }

    createControlButtons() {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'bottom-controls';
        
        const standardLoadBtn = document.createElement('button');
        standardLoadBtn.className = 'control-button';
        standardLoadBtn.textContent = 'Standard Load';
        standardLoadBtn.onclick = () => this.handleStandardLoad();
        
        const embarkBtn = document.createElement('button');
        embarkBtn.className = 'control-button';
        embarkBtn.textContent = 'EMBARK!';
        embarkBtn.onclick = () => this.handleEmbark();
        
        controlsDiv.appendChild(standardLoadBtn);
        controlsDiv.appendChild(embarkBtn);
        
        this.wrapper.appendChild(controlsDiv);
    }

    createCategoryHeader(panel, category, yOffset) {
        const header = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Background
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", yOffset);
        bg.setAttribute("width", "300");
        bg.setAttribute("height", "30");
        bg.setAttribute("fill", "#777777");
        header.appendChild(bg);

        // Text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", "15");
        text.setAttribute("y", yOffset + 20);
        text.setAttribute("font-size", "16");
        text.setAttribute("font-weight", "600");
        text.setAttribute("fill", "#f0f0f0");
        text.textContent = category;
        header.appendChild(text);

        panel.appendChild(header);
        return yOffset + 35; // Return next Y position with some padding
    }

    createItemEntry(container, item, isAvailable) {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 10px;
            margin: 2px 0;
            margin-bottom: 2px;
            background: #555555;
            color: #f0f0f0;
            font-family: 'Vollkorn', serif;
            font-style: italic;
        `;
    
        itemDiv.innerHTML = `
            <span>${item.name}</span>
            <span>${item.weight} lbs</span>
            <button class="${isAvailable ? 'take-btn' : 'remove-btn'}"
                    style="
                        padding: 2px 8px;
                        background: ${isAvailable ? '#007bff' : '#dc3545'};
                        color: white;
                        border: none;
                        cursor: pointer;
                        font-family: inherit;
                        font-style: italic;
                    "
            >${isAvailable ? 'Take' : 'Remove'}</button>
        `;
    
        const button = itemDiv.querySelector('button');
        button.onclick = () => {
            if (isAvailable) {
                this.gameStore.packing.addItem(item);
            } else {
                this.gameStore.packing.removeItem(item.id);
            }
            this.updateUI();
        };
    
        container.appendChild(itemDiv);
    }
    
    updateUI() {
        this.updateSelectedItemsPanel();
        this.updateAvailableItemsPanel();
        this.updateWeightDisplay();
    }

    updateAvailableItemsPanel() {
    const container = this.availableItemsContainer;
    if (!container) return;

    // Clear existing items
    container.innerHTML = '';

    // Add initial spacing div
    const spacerDiv = document.createElement('div');
    spacerDiv.style.height = '0px';  // Adjust this value to move content down
    container.appendChild(spacerDiv);

    const categorizedItems = Object.values(ITEMS_DATABASE).reduce((categories, item) => {
        if (!categories.has(item.category)) {
            categories.set(item.category, []);
        }
        categories.get(item.category).push(item);
        return categories;
    }, new Map());
    
        categorizedItems.forEach((items, category) => {
            // Add category header
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = `
                background: #007bff;;
                padding: 3px 8px;  
                margin-bottom: 3px;  
                font-size: 20px;  
                font-weight: bold;
                max-width: 950px;  
            `;
            headerDiv.textContent = category;
            container.appendChild(headerDiv);
    
            // Add items
            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0px;
                    margin: 2px 0;
                    //background: #555555;
                    max-width: 100%;  // Add this to limit width
                `;

                // In the items.forEach section:
                itemDiv.innerHTML = `
                <span style="flex: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
                <span style="width: 60px; text-align: right;">${item.weight} lbs</span>
                <button style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 2px 6px;
                    min-width: 50px;
                    cursor: pointer;
                    font-family: inherit;
                    font-style: italic;
                    transition: background-color 0.15s ease, color 0.15s ease;
                ">Take</button>
                `;

                const button = itemDiv.querySelector('button');
                button.onmousedown = () => {
                button.style.backgroundColor = 'white';
                button.style.color = '#007bff';
                };

                button.onmouseup = () => {
                button.style.backgroundColor = '#007bff';
                button.style.color = 'white';
                };

                button.onclick = () => {
                this.gameStore.packing.addItem(item);
                this.updateUI();
                };
    
                container.appendChild(itemDiv);
            });
        });
    }

    updateSelectedItemsPanel() {
        const container = this.selectedItemsContainer;
        if (!container) return;
    
        // Clear existing items
        container.innerHTML = '';
    
        // Add initial spacing div
        const spacerDiv = document.createElement('div');
        spacerDiv.style.height = '0px';
        container.appendChild(spacerDiv);
    
        // Add selected items
        const items = Array.from(this.gameStore.packing.selectedItems.values());
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 0px;  // Match Available Items padding
                margin: 2px 0;
                max-width: 100%;   // Match Available Items width
            `;

            itemDiv.innerHTML = `
                <span style="flex: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 16px;">${item.name}</span>
                <span style="width: 60px; text-align: right;">${item.weight} lbs</span>
                <button style="
                    background: rgb(255, 60, 0);
                    color: white;
                    border: none;
                    padding: 2px 6px;
                    min-width: 50px;
                    cursor: pointer;
                    font-family: inherit;
                    font-style: italic;
                    transition: background-color 0.15s ease, color 0.15s ease;
                ">Remove</button>
            `;

            const button = itemDiv.querySelector('button');
            button.onmousedown = () => {
                button.style.backgroundColor = 'white';
                button.style.color = 'rgb(255, 60, 0)';
            };

            button.onmouseup = () => {
                button.style.backgroundColor = 'rgb(255, 60, 0)';
                button.style.color = 'white';
            };

            button.onclick = () => {
                this.gameStore.packing.removeItem(item.id);
                this.updateUI();
            };
    
            container.appendChild(itemDiv);
        });
    }

    updateWeightDisplay() {
        const weight = this.gameStore.packing.totalWeight || 0;  // Use 0 if totalWeight is falsy
        const maxWeight = this.gameStore.packing.MAX_WEIGHT;
        
        // Create weight display if it doesn't exist
        if (!this.weightDisplay) {
            this.weightDisplay = document.createElement('div');
            this.weightDisplay.className = 'weight-display';
            // Add it before the bottom controls
            const bottomControls = this.wrapper.querySelector('.bottom-controls');
            this.wrapper.insertBefore(this.weightDisplay, bottomControls);
        }
        
        // Always display the weight
        this.weightDisplay.textContent = `Total Weight: ${weight}/${maxWeight} lbs`;
        
        // Update color based on weight
        const weightPercentage = (weight / maxWeight) * 100;
        if (weightPercentage > 90) {
            this.weightDisplay.style.color = "#dc3545";
        } else if (weightPercentage > 75) {
            this.weightDisplay.style.color = "#ffc107";
        } else {
            this.weightDisplay.style.color = "#f0f0f0";
        }
    }

    setupEventListeners() {
        // Global mouse move for tooltip positioning
        document.addEventListener('mousemove', (e) => {
            if (this.tooltipElement && this.tooltipElement.style.display === 'block') {
                const x = e.pageX + 10;
                const y = e.pageY + 10;
                this.tooltipElement.style.left = `${x}px`;
                this.tooltipElement.style.top = `${y}px`;
            }
        });

        // ESC key to close tooltip
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.tooltipElement) {
                this.hideTooltip();
            }
        });
    }

    handleStandardLoad() {
        console.log('Standard Load clicked');
        console.log('Packing state:', this.gameStore?.packing);
        if (this.gameStore?.packing?.loadStandardLoadout) {
            console.log('Calling loadStandardLoadout');
            this.gameStore.packing.loadStandardLoadout();
        } else {
            console.error('Packing state not properly initialized');
        }
        this.updateUI();
    }
    

    handleEmbark() {
        console.log('Embark clicked');
        console.log('Selected items:', this.gameStore?.packing?.selectedItems.size);
        
        if (this.gameStore.packing.selectedItems.size === 0) {
            if (!confirm("Are you sure you want to embark with no items?")) {
                return;
            }
        }
    
        const gameItems = this.gameStore.packing.getGameItems();
        console.log('Game items:', gameItems);
        
        // Remove body class when packing manager is closed
        document.body.classList.remove('packing-active');
        
        // Hide packing screen and remove it from DOM
        this.container.style.display = "none";
        this.container.remove();
        
        // Show game elements
        document.querySelectorAll('.game-element').forEach(el => {
            el.style.display = 'block';
        });
        
        if (this.onEmbarked) {
            console.log('Calling onEmbarked callback');
            this.onEmbarked(gameItems);
        } else {
            console.error('No onEmbarked callback set');
        }
    }
}

export default PackingManager;