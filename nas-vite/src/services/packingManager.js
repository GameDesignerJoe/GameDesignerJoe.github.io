// src/services/packingManager.js
import { gameStore } from '../state/store.js';
import { ITEMS_DATABASE } from '../config/itemsDatabase.js';

export class PackingManager {
    formatWeight(weight) {
        return weight < 1 ? weight.toFixed(2) : Math.round(weight);
    }

    constructor(containerElement) {
        this.container = containerElement;
        this.gameStore = gameStore;
        this.tooltipElement = null;
        this.currentDetailsItem = null;
        
        document.body.classList.add('packing-active');
        
        this.initializeUI();
        this.updateAvailableItemsPanel();
    }

    reset() {
        // Clear all selected items
        if (this.gameStore?.packing) {
            this.gameStore.packing.selectedItems.clear();
            this.gameStore.packing.totalWeight = 0;
            this.gameStore.packing.MAX_WEIGHT = this.gameStore.packing.BASE_WEIGHT;
        }

        // Reset UI
        this.updateUI();

        // Show the packing screen
        if (this.container) {
            this.container.style.display = 'block';
            document.body.classList.add('packing-active');
            
            // Reset scroll position
            const scrollablePanels = this.container.querySelectorAll('.scrollable-panel');
            scrollablePanels.forEach(panel => {
                panel.scrollTop = 0;
            });
            
            // Reset to available items tab
            const availableTab = this.container.querySelector('[data-panel="available"]');
            if (availableTab) {
                availableTab.click();
            }
        }

        // Hide game elements
        document.querySelectorAll('.game-element').forEach(el => {
            el.style.display = 'none';
        });
    }

    initializeUI() {
        this.createTitle();
        
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'packing-container';
        this.container.appendChild(this.wrapper);
        
        this.createTabs();
        
        const panelsContainer = document.createElement('div');
        panelsContainer.className = 'panels-container';
        this.wrapper.appendChild(panelsContainer);
        
        this.createAvailableItemsPanel(panelsContainer);
        this.createSelectedItemsPanel(panelsContainer);
        this.createControlButtons();
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
        
        this.wrapper.appendChild(tabsDiv);
    }
    
    switchTab(panelName) {
        this.availableItemsContainer.classList.toggle('active', panelName === 'available');
        this.selectedItemsContainer.classList.toggle('active', panelName === 'packed');
        
        const buttons = document.querySelectorAll('.tab-button');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelName);
        });
    }

    createTitle() {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'packing-header';
        
        const h2 = document.createElement('h2');
        h2.textContent = "Expedition Supplies";
        
        titleDiv.appendChild(h2);
        this.container.appendChild(titleDiv);
    }
    
    createAvailableItemsPanel(container) {
        const scrollableDiv = document.createElement('div');
        scrollableDiv.className = 'scrollable-panel active';
        container.appendChild(scrollableDiv);
        this.availableItemsContainer = scrollableDiv;
    }

    createSelectedItemsPanel(container) {
        const scrollableDiv = document.createElement('div');
        scrollableDiv.className = 'scrollable-panel';
        container.appendChild(scrollableDiv);
        this.selectedItemsContainer = scrollableDiv;
    }

    showItemDetails(item, currentQuantity = 0) {
        this.currentDetailsItem = item;
        
        const standardLoadout = {
            'Sledge': 1, 'Canvas Tent': 1, 'Primus Stove': 1, 'Ice Axe': 1,
            'Pemmican': 10, 'Ship\'s Biscuits': 3, 'Dried Milk': 4,
            'Chocolate Blocks': 8, 'Emergency Seal Meat': 1, 'Paraffin Fuel': 3,
            'Sextant': 1, 'Compass': 1, 'Maps & Charts': 1,
            'Burberry Windproof Suit': 1, 'Woolen Underwear': 2,
            'Finnesko Boots': 1, 'Snow Goggles': 1, 'Medical Kit': 1,
            'Emergency Rope': 1, 'Basic Sewing Kit': 1,
            'Sledge Repair Kit': 1, 'Tool Maintenance Kit': 1
        };
        
        const recommendedQuantity = standardLoadout[item.name] || 1;
        
        const overlay = document.createElement('div');
        overlay.className = 'item-details-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeItemDetails();
        };
        
        const panel = document.createElement('div');
        panel.className = 'item-details-panel';
        
        // If this is a sledge, show its effect on capacity
        const isSledge = item.name === "Sledge";
        const capacityNote = isSledge ? 
            '<div style="margin-top: 10px; color: #ffc107;">Adding a Sledge increases your carrying capacity by 300 lbs (to 360 lbs total).</div>' : '';
        
        // For sledge, use the higher weight limit to calculate max quantity
        const effectiveMaxWeight = isSledge ? this.gameStore.packing.BASE_WEIGHT + this.gameStore.packing.SLEDGE_BONUS : this.gameStore.packing.MAX_WEIGHT;
        const remainingWeight = effectiveMaxWeight - this.gameStore.packing.totalWeight;
        const currentItemsWeight = currentQuantity * item.weight;
        const maxQuantity = isSledge ? 1 : Math.floor((remainingWeight + currentItemsWeight) / item.weight);
        
        // Set initial quantity - use current quantity for existing items, or 1 for new items from Take button
        const initialQuantity = currentQuantity > 0 ? currentQuantity : 1;
        
        panel.innerHTML = `
            <div class="item-details-title">${item.name}</div>
            <div class="item-details-description">${item.tooltip}</div>
            <div class="item-details-effects">
                <h3>Effects & Properties</h3>
                <ul>
                    ${item.effects ? `<li>${item.effects}</li>` : ''}
                    ${item.special ? `<li>${item.special}</li>` : ''}
                    ${item.duration ? `<li>${item.duration}</li>` : ''}
                </ul>
            </div>
            <div class="item-details-quantity">
                <label>Quantity ${isSledge ? '(Max: 1, Recommended: 1)' : `(Recommended: ${recommendedQuantity})`}:</label>
                <input type="number" min="0" max="${maxQuantity}" value="${initialQuantity}" id="quantity-input" 
                    inputmode="numeric" pattern="[0-9]*" 
                    onkeypress="return event.charCode >= 48 && event.charCode <= 57">
                <div class="item-details-quantity-info">Maximum: ${maxQuantity} (based on weight limit)</div>
                ${capacityNote}
            </div>
            <div class="item-details-weight">
                Total Weight: ${this.formatWeight(initialQuantity * item.weight)} lbs
            </div>
            <div class="item-details-buttons">
                <button class="item-details-button cancel">Cancel</button>
                <button class="item-details-button confirm">Confirm</button>
            </div>
        `;
        
        const quantityInput = panel.querySelector('#quantity-input');
        const weightDisplay = panel.querySelector('.item-details-weight');
        
        // Update weight display when quantity changes
        quantityInput.addEventListener('input', () => {
            const quantity = parseInt(quantityInput.value) || 0;
            const totalWeight = this.formatWeight(quantity * item.weight);
            weightDisplay.textContent = `Total Weight: ${totalWeight} lbs`;
        });
        
        panel.querySelector('.cancel').onclick = () => this.closeItemDetails();
        panel.querySelector('.confirm').onclick = () => {
            // Get and validate the input value
            const rawValue = quantityInput.value.trim();
            console.log('Raw input value:', rawValue);
            
            if (rawValue === '' || isNaN(rawValue)) {
                console.log('Invalid quantity input');
                return;
            }
            
            const quantity = parseInt(rawValue);
            console.log('Parsed quantity:', quantity);
            
            // Remove existing items first
            const itemsToRemove = Array.from(this.gameStore.packing.selectedItems.values())
                .filter(i => i.name === item.name);
            console.log('Removing existing items:', itemsToRemove.length);
            itemsToRemove.forEach(i => this.gameStore.packing.removeItem(i.id));
            
            // Add new items if quantity > 0
            if (quantity > 0) {
                console.log('Adding new quantity:', quantity);
                let addedCount = 0;
                for (let i = 0; i < quantity; i++) {
                    const success = this.gameStore.packing.addItem(item);
                    if (!success) {
                        console.log(`Failed to add item ${i + 1}, stopping`);
                        if (addedCount === 0) {
                            this.showWarningOverlay(
                                'Weight Limit',
                                'Could not add items due to weight limit'
                            );
                        }
                        break;
                    }
                    addedCount++;
                    console.log(`Added item ${i + 1} successfully`);
                }
            }
            
            this.closeItemDetails();
            this.updateUI();
        };
        
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeItemDetails();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    closeItemDetails() {
        const overlay = document.querySelector('.item-details-overlay');
        if (overlay) {
            overlay.remove();
        }
        this.currentDetailsItem = null;
    }

    showWarningOverlay(title, message, onContinue = null) {
        const overlay = document.createElement('div');
        overlay.className = 'warning-overlay';
        
        const panel = document.createElement('div');
        panel.className = 'warning-panel';
        
        panel.innerHTML = `
            <div class="warning-title">${title}</div>
            <div class="warning-message">${message}</div>
            <div class="warning-buttons">
                <button class="warning-button cancel">Cancel</button>
                ${onContinue ? '<button class="warning-button continue">Continue</button>' : ''}
            </div>
        `;
        
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        
        // Handle button clicks
        const cancelBtn = panel.querySelector('.cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.body.removeChild(overlay);
            };
        }
        
        const continueBtn = panel.querySelector('.continue');
        if (continueBtn && onContinue) {
            continueBtn.onclick = () => {
                document.body.removeChild(overlay);
                onContinue();
            };
        }
        
        // Handle ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Handle click outside
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };
    }

    updateAvailableItemsPanel() {
        const container = this.availableItemsContainer;
        if (!container) return;

        container.innerHTML = '';
        const spacerDiv = document.createElement('div');
        spacerDiv.style.height = '0px';
        container.appendChild(spacerDiv);

        const categorizedItems = Object.values(ITEMS_DATABASE).reduce((categories, item) => {
            if (!categories.has(item.category)) {
                categories.set(item.category, []);
            }
            categories.get(item.category).push(item);
            return categories;
        }, new Map());
    
        categorizedItems.forEach((items, category) => {
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = `
                background: #007bff;
                padding: 3px 8px;
                margin-bottom: 3px;
                font-size: 20px;
                font-weight: bold;
                max-width: 950px;
            `;
            headerDiv.textContent = category;
            container.appendChild(headerDiv);
    
            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0px;
                    margin: 2px 0;
                    max-width: 100%;
                `;

                // Count existing quantity of this item
                const existingCount = Array.from(this.gameStore.packing.selectedItems.values())
                    .filter(i => i.name === item.name).length;

                itemDiv.innerHTML = `
                    <span style="flex: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 19px;">${item.name}</span>
                    <span style="width: 60px; text-align: right; margin-right: 10px;">${this.formatWeight(item.weight)} lbs</span>
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
                    this.showItemDetails(item, existingCount);
                };
    
                container.appendChild(itemDiv);
            });
        });
    }

    updateSelectedItemsPanel() {
        const container = this.selectedItemsContainer;
        if (!container) return;
    
        container.innerHTML = '';
        const spacerDiv = document.createElement('div');
        spacerDiv.style.height = '0px';
        container.appendChild(spacerDiv);
    
        // First group items by category, then by name
        const categorizedItems = new Map();
        Array.from(this.gameStore.packing.selectedItems.values()).forEach(item => {
            if (!categorizedItems.has(item.category)) {
                categorizedItems.set(item.category, new Map());
            }
            const categoryGroup = categorizedItems.get(item.category);
            if (!categoryGroup.has(item.name)) {
                categoryGroup.set(item.name, {
                    item: item,
                    count: 1
                });
            } else {
                categoryGroup.get(item.name).count++;
            }
        });

        // Render each category
        categorizedItems.forEach((categoryItems, category) => {
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = `
                background: #007bff;
                padding: 3px 8px;
                margin-bottom: 3px;
                font-size: 20px;
                font-weight: bold;
                max-width: 950px;
            `;
            headerDiv.textContent = category;
            container.appendChild(headerDiv);

            // Render items in this category
            categoryItems.forEach(({item, count}) => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0px;
                    margin: 2px 0;
                    max-width: 100%;
                `;

                const totalWeight = this.formatWeight(count * item.weight);
                itemDiv.innerHTML = `
                    <span style="flex: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 19px;">${item.name}</span>
                    <span style="width: 100px; text-align: right; white-space: nowrap; margin-right: 10px;">(${count}) ${totalWeight} lbs</span>
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
                    ">Change</button>
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
                    this.showItemDetails(ITEMS_DATABASE[item.name], count);
                };
        
                container.appendChild(itemDiv);
            });
        });
    }

    updateWeightDisplay() {
        const weight = this.gameStore.packing.totalWeight || 0;
        const maxWeight = this.gameStore.packing.MAX_WEIGHT;
        
        if (!this.weightDisplay) {
            this.weightDisplay = document.createElement('div');
            this.weightDisplay.className = 'weight-display';
            const bottomControls = this.wrapper.querySelector('.bottom-controls');
            bottomControls.insertBefore(this.weightDisplay, bottomControls.firstChild);
        }
        
        this.weightDisplay.textContent = `Total Weight: ${this.formatWeight(weight)}/${this.formatWeight(maxWeight)} lbs`;
        
        const weightPercentage = (weight / maxWeight) * 100;
        if (weightPercentage > 90) {
            this.weightDisplay.style.color = "#dc3545";
        } else if (weightPercentage > 75) {
            this.weightDisplay.style.color = "#ffc107";
        } else {
            this.weightDisplay.style.color = "#f0f0f0";
        }
    }

    createControlButtons() {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'bottom-controls';
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';
        
        const standardLoadBtn = document.createElement('button');
        standardLoadBtn.className = 'control-button';
        standardLoadBtn.textContent = 'Standard Load';
        standardLoadBtn.onclick = () => this.handleStandardLoad();
        
        const embarkBtn = document.createElement('button');
        embarkBtn.className = 'control-button';
        embarkBtn.textContent = 'EMBARK!';
        embarkBtn.onclick = () => this.handleEmbark();
        
        buttonsContainer.appendChild(standardLoadBtn);
        buttonsContainer.appendChild(embarkBtn);
        controlsDiv.appendChild(buttonsContainer);
        
        this.wrapper.appendChild(controlsDiv);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentDetailsItem) {
                this.closeItemDetails();
            }
        });
    }

    handleStandardLoad() {
        if (this.gameStore?.packing?.loadStandardLoadout) {
            this.gameStore.packing.loadStandardLoadout();
        }
        this.updateUI();
    }

    handleEmbark() {
        // Check if weight is over limit
        if (this.gameStore.packing.totalWeight > this.gameStore.packing.MAX_WEIGHT) {
            this.showWarningOverlay(
                'Weight Limit Exceeded',
                `You are carrying too much weight (${this.formatWeight(this.gameStore.packing.totalWeight)} lbs). Maximum allowed is ${this.formatWeight(this.gameStore.packing.MAX_WEIGHT)} lbs. Add a Sledge to increase capacity by 300 lbs.`
            );
            return;
        }

        if (this.gameStore.packing.selectedItems.size === 0) {
            this.showWarningOverlay(
                'Warning',
                'Are you sure you want to embark with no items? The Antarctic is an unforgiving place.',
                () => this.completeEmbark()
            );
            return;
        }
        
        this.completeEmbark();
    }
    
    completeEmbark() {
        const gameItems = this.gameStore.packing.getGameItems();
        document.body.classList.remove('packing-active');
        this.container.style.display = "none";
        
        // Show game elements
        document.querySelectorAll('.game-element').forEach(el => {
            el.style.display = 'block';
        });
        
        // Call onEmbarked with game items
        if (this.onEmbarked) {
            this.onEmbarked(gameItems);
        }
    }

    updateUI() {
        this.updateSelectedItemsPanel();
        this.updateAvailableItemsPanel();
        this.updateWeightDisplay();
    }
}

export default PackingManager;
