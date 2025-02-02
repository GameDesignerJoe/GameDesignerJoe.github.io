// src/services/packingManager.js
import { gameStore } from '../state/store.js';
import { ITEMS_DATABASE } from '../config/itemsDatabase.js';

export class PackingManager {
    constructor(containerElement) {
        this.container = containerElement;
        this.gameStore = gameStore;
        this.tooltipElement = null;
        this.initializeUI();
        this.updateAvailableItemsPanel();
    }

    initializeUI() {
        // Create responsive container wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.style.cssText = `
            position: relative;
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            box-sizing: border-box;
        `;
        this.container.appendChild(this.wrapper);
    
        // Create SVG container with responsive sizing
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("viewBox", "0 0 800 600");
        this.svg.style.cssText = `
            width: 100%;
            height: auto;
            min-height: 500px;
            max-height: 80vh;
            background: #444444;
            color: #f0f0f0;
            font-family: 'Vollkorn', serif;
            font-style: italic;
        `;
        this.wrapper.appendChild(this.svg);
    
        // Initialize all UI elements in the correct order
        this.createTitle();
        this.createAvailableItemsPanel();
        this.createSelectedItemsPanel();
        this.createControlButtons();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    createTitle() {
        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("x", "400");
        title.setAttribute("y", "40");
        title.setAttribute("text-anchor", "middle");
        title.setAttribute("font-size", "36");
        title.setAttribute("font-weight", "700");
        title.setAttribute("fill", "#f0f0f0");
        title.setAttribute("font-family", "'Old Standard TT', serif");
        title.textContent = "Expedition Supplies";
        this.svg.appendChild(title);
    }
    
    createAvailableItemsPanel() {
        const panel = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Center the panel
        const panelWidth = 340;
        const panelX = (800 - (panelWidth * 2 + 20)) / 2;
        
        const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        background.setAttribute("x", panelX);
        background.setAttribute("y", "80");
        background.setAttribute("width", panelWidth);
        background.setAttribute("height", "440");
        background.setAttribute("fill", "#555555");
        background.setAttribute("stroke", "#777777");
        panel.appendChild(background);
    
        // Add column title
        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("x", panelX + panelWidth / 2);
        title.setAttribute("y", "70");
        title.setAttribute("text-anchor", "middle");
        title.setAttribute("font-size", "24");
        title.setAttribute("font-weight", "700");
        title.setAttribute("fill", "#f0f0f0");
        title.textContent = "Available Items";
        this.svg.appendChild(title);
    
        // Add the panel to the SVG
        this.svg.appendChild(panel);
    
        // Update scrollable div positioning
        const scrollableDiv = document.createElement('div');
        scrollableDiv.style.cssText = `
            position: absolute;
            left: 50%;
            transform: translateX(-100%);
            top: 95px;
            width: ${panelWidth}px;
            height: 405px;
            overflow-y: auto;
            overflow-x: hidden;
            background: transparent;
            color: #f0f0f0;
            font-family: 'Vollkorn', serif;
            font-style: italic;
            padding: 0 20px;
            scrollbar-width: none;
        `;
        
        this.wrapper.appendChild(scrollableDiv);
        this.availableItemsContainer = scrollableDiv;
    }

    createSelectedItemsPanel() {
        const panel = document.createElementNS("http://www.w3.org/2000/svg", "g");
        panel.setAttribute("id", "selected-items");
        
        const panelWidth = 340;
        const panelX = (800 + 20) / 2;
        
        const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        background.setAttribute("x", panelX);
        background.setAttribute("y", "80");
        background.setAttribute("width", panelWidth);
        background.setAttribute("height", "440");
        background.setAttribute("fill", "#555555");
        background.setAttribute("stroke", "#777777");
        panel.appendChild(background);
    
        // Add column title
        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("x", panelX + panelWidth / 2);
        title.setAttribute("y", "70");
        title.setAttribute("text-anchor", "middle");
        title.setAttribute("font-size", "24");
        title.setAttribute("font-weight", "700");
        title.setAttribute("fill", "#f0f0f0");
        title.textContent = "Packed Items";
        this.svg.appendChild(title);
    
        // Add the panel to the SVG
        this.svg.appendChild(panel);
    
        const scrollableDiv = document.createElement('div');
        scrollableDiv.style.cssText = `
            position: absolute;
            left: 50%;
            transform: translateX(0%);
            top: 95px;
            width: ${panelWidth}px;
            height: 370px;
            overflow-y: auto;
            overflow-x: hidden;
            background: transparent;
            color: #f0f0f0;
            font-family: 'Vollkorn', serif;
            font-style: italic;
            padding: 0 20px;
            scrollbar-width: none;
        `;
        
        this.wrapper.appendChild(scrollableDiv);
        this.selectedItemsContainer = scrollableDiv;
    }

    createControlButtons() {
        const buttonY = 540;
        const buttonWidth = 160;
        const gap = 20;
        
        // Position buttons to the right of the selected items column
        const panelWidth = 340;
        const panelX = (800 + 20) / 2;
        const startX = panelX + panelWidth - (buttonWidth * 2 + gap);
    
        // Create Standard Load button
        const standardLoadBtn = this.createButton(
            "Standard Load",
            startX, 
            buttonY, 
            buttonWidth, 
            40,
            "#555555",
            () => this.handleStandardLoad()
        );
    
        // Create Embark button
        const embarkBtn = this.createButton(
            "EMBARK!",
            startX + buttonWidth + gap, 
            buttonY, 
            buttonWidth, 
            40,
            "#555555",
            () => this.handleEmbark()
        );
    
        this.svg.appendChild(standardLoadBtn);
        this.svg.appendChild(embarkBtn);
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
        rect.setAttribute("stroke", "#777777");
        rect.setAttribute("rx", "5");
        
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElement.setAttribute("x", x + width/2);
        textElement.setAttribute("y", y + height/2 + 5);
        textElement.setAttribute("text-anchor", "middle");
        textElement.setAttribute("font-size", "16");
        textElement.setAttribute("font-style", "italic");
        textElement.setAttribute("fill", "#f0f0f0");
        textElement.setAttribute("font-family", "'Old Standard TT', serif");
        textElement.textContent = text;

        button.appendChild(rect);
        button.appendChild(textElement);
        
        button.addEventListener("mouseover", () => {
            rect.setAttribute("fill", "#666666");
        });
        button.addEventListener("mouseout", () => {
            rect.setAttribute("fill", color);
        });
        button.addEventListener("mousedown", () => {
            rect.setAttribute("fill", "#777777");
        });
        button.addEventListener("mouseup", () => {
            rect.setAttribute("fill", "#666666");
        });
        
        button.addEventListener("click", onClick);
        return button;
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
            padding: 5px;
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
    spacerDiv.style.height = '20px';  // Adjust this value to move content down
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
                background: #777777;
                padding: 5px 10px;
                margin-bottom: 5px;
                font-size: 16px;
                font-weight: bold;
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
                    padding: 5px 10px;
                    margin: 2px 0;
                    background: #555555;
                `;
    
                itemDiv.innerHTML = `
                    <span style="flex: 1;">${item.name}</span>
                    <span style="margin: 0 10px;">${item.weight} lbs</span>
                    <button style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 2px 10px;
                        cursor: pointer;
                        font-family: inherit;
                        font-style: italic;
                    ">Take</button>
                `;
    
                const button = itemDiv.querySelector('button');
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
        spacerDiv.style.height = '20px';
        container.appendChild(spacerDiv);
    
        // Add selected items
        const items = Array.from(this.gameStore.packing.selectedItems.values());
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 10px;
                margin: 2px 0;
                background: #555555;
            `;
    
            itemDiv.innerHTML = `
                <span style="flex: 1;">${item.name}</span>
                <span style="margin: 0 10px;">${item.weight} lbs</span>
                <button style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 2px 10px;
                    cursor: pointer;
                    font-family: inherit;
                    font-style: italic;
                ">Remove</button>
            `;
    
            const button = itemDiv.querySelector('button');
            button.onclick = () => {
                this.gameStore.packing.removeItem(item.id);
                this.updateUI();
            };
    
            container.appendChild(itemDiv);
        });
    }

    updateWeightDisplay() {
        const weight = this.gameStore.packing.totalWeight;
        const maxWeight = this.gameStore.packing.MAX_WEIGHT;
        
        // Update or create weight display
        let weightDisplay = this.weightDisplay;
        if (!weightDisplay) {
            weightDisplay = document.createElementNS("http://www.w3.org/2000/svg", "text");
            weightDisplay.setAttribute("x", "430");
            weightDisplay.setAttribute("y", "500");
            weightDisplay.setAttribute("font-size", "16");
            weightDisplay.setAttribute("fill", "#f0f0f0");
            this.svg.appendChild(weightDisplay);
            this.weightDisplay = weightDisplay;
        }
        
        weightDisplay.textContent = `Total Weight: ${weight}/${maxWeight} lbs`;
        
        // Update color based on weight
        const weightPercentage = (weight / maxWeight) * 100;
        if (weightPercentage > 90) {
            weightDisplay.setAttribute("fill", "#dc3545");
        } else if (weightPercentage > 75) {
            weightDisplay.setAttribute("fill", "#ffc107");
        } else {
            weightDisplay.setAttribute("fill", "#f0f0f0");
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
        this.gameStore.packing.loadStandardLoadout();
        this.updateUI();
    }

    handleEmbark() {
        if (this.gameStore.packing.selectedItems.size === 0) {
            if (!confirm("Are you sure you want to embark with no items?")) {
                return;
            }
        }

        const gameItems = this.gameStore.packing.getGameItems();
        
        // Hide packing screen
        this.container.style.display = "none";
        
        // Trigger game start through callback
        if (this.onEmbarked) {
            this.onEmbarked(gameItems);
        }
    }
}

export default PackingManager;    