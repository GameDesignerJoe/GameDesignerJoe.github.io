// src/core/foodSystem.js

import { ITEMS_DATABASE } from '../config/itemsDatabase.js';
import { PLAYER_STATS } from '../config/constants.js';

// Food eating duration configuration (in milliseconds)
const FOOD_DURATIONS = {
    SIMPLE: 1500,    // 1.5 seconds
    MEDIUM: 2500,    // 2.5 seconds
    COMPLEX: 5000,   // 5 seconds
    COOKING: 5000    // 5 seconds for cooking
};

export class FoodSystem {
    constructor(gameStore, messageSystem) {
        this.gameStore = gameStore;
        this.messageSystem = messageSystem;
        this.isEating = false;
        this.selectedFood = null;
        this.eatingProgress = 0;
        this.animationFrame = null;
    }

    getFoodDuration(foodName) {
        const food = ITEMS_DATABASE[foodName];
        if (!food) return FOOD_DURATIONS.MEDIUM;

        if (foodName === "Ship's Biscuits" || foodName === "Chocolate Blocks") {
            return FOOD_DURATIONS.SIMPLE;
        } else if (food.special?.includes('requires stove')) {
            return FOOD_DURATIONS.COMPLEX;
        } else {
            return FOOD_DURATIONS.MEDIUM;
        }
    }

    async startEatingProcess(foodName, button) {
        if (this.isEating) return;
        
        const food = ITEMS_DATABASE[foodName];
        if (!food) return;

        this.isEating = true;
        this.selectedFood = foodName;

        // Disable all eat buttons
        document.querySelectorAll('.eat-button').forEach(btn => {
            btn.disabled = true;
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.textContent = 'Eating...';
        });

        try {
            // If food needs cooking, show cooking progress first
            if (food.special?.includes('requires stove')) {
                await this.animateProgress(button, FOOD_DURATIONS.COOKING, `Cooking ${foodName}`);
            }

            // Then show eating progress
            await this.animateProgress(button, this.getFoodDuration(foodName), `Eating ${foodName}`);

            // Complete the eating process
            this.completeEating(foodName);
        } catch (error) {
            console.error('Error during eating process:', error);
            this.resetEatingState();
        }
    }

    animateProgress(button, duration, text) {
        return new Promise((resolve) => {
            const startTime = performance.now();
            
            // Set up initial button state
            button.style.position = 'relative';
            button.style.color = 'rgba(255, 255, 255, 0.7)';
            button.textContent = text;

            // Create progress bar overlay
            const progress = document.createElement('div');
            progress.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                width: 0%;
                background: linear-gradient(to right, rgba(100, 223, 255, 0.4), rgba(1, 120, 176, 0.4));
                transition: width 0.1s linear;
                border-radius: 4px;
                pointer-events: none;
            `;
            button.appendChild(progress);

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progressPercent = Math.min((elapsed / duration) * 100, 100);
                
                progress.style.width = `${progressPercent}%`;
                
                if (elapsed < duration) {
                    this.animationFrame = requestAnimationFrame(animate);
                } else {
                    button.removeChild(progress);
                    resolve();
                }
            };

            this.animationFrame = requestAnimationFrame(animate);
        });
    }

    completeEating(foodName) {
        // Apply food effects
        const result = this.gameStore.food.applyFoodEffects(foodName, this.gameStore.player);
        this.messageSystem.showPlayerMessage(result.message, result.success ? "STATUS" : "WARNING");

        // Reset state
        this.resetEatingState();

        // Update the food modal
        const modal = document.querySelector('.food-modal');
        if (modal) {
            const foodList = modal.querySelector('.food-list');
            if (foodList) {
                foodList.innerHTML = this.renderFoodItems();
            }
        }
    }

    resetEatingState() {
        this.isEating = false;
        this.selectedFood = null;
        this.eatingProgress = 0;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Re-enable all eat buttons and reset their state
        document.querySelectorAll('.eat-button').forEach(btn => {
            btn.disabled = false;
            btn.style.background = '';
            const foodName = btn.closest('.food-item').querySelector('.food-name').textContent;
            btn.textContent = this.getButtonText(ITEMS_DATABASE[foodName]);
        });
    }

    handleFoodIconClick() {
        if (!this.gameStore.player.isCamping && !this.gameStore.player.isResting) {
            this.messageSystem.showPlayerMessage(
                "You must make camp or rest before eating.",
                "WARNING"
            );
            return;
        }

        // Create and show food modal
        const modal = document.createElement('div');
        modal.className = 'food-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'food-modal-content';
        
        modalContent.innerHTML = `
            <h2>FOOD INVENTORY</h2>
            <div class="food-list">
                ${this.renderFoodItems()}
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add click handler to close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    renderFoodItems() {
        const foodItems = Array.from(this.gameStore.packing.selectedItems.values())
            .filter(item => ITEMS_DATABASE[item.name].category === 'Food & Provisions');

        if (foodItems.length === 0) {
            return '<div class="no-food">No food items in inventory</div>';
        }

        // Group items by name
        const groupedItems = new Map();
        foodItems.forEach(item => {
            if (!groupedItems.has(item.name)) {
                groupedItems.set(item.name, { item: ITEMS_DATABASE[item.name], count: 1 });
            } else {
                groupedItems.get(item.name).count++;
            }
        });

        return Array.from(groupedItems.entries()).map(([name, { item, count }]) => `
            <div class="food-item" data-food-name="${name}">
                <div class="food-item-header">
                    <span class="food-name">${name}</span>
                    <span class="food-quantity">x${count}</span>
                </div>
                <div class="food-details">
                    ${item.effects ? `<div class="food-effects">✧ ${item.effects}</div>` : ''}
                    ${item.duration ? `<div class="food-duration">⌛ ${item.duration}</div>` : ''}
                    ${item.special ? `<div class="food-special">★ ${item.special}</div>` : ''}
                </div>
                <div class="food-tooltip">${item.tooltip || ''}</div>
                <button class="eat-button" onclick="window.eatFood('${name}')" 
                    ${this.getButtonDisabledState(item)}>
                    ${this.getButtonText(item)}
                </button>
            </div>
        `).join('');
    }

    eatFood(foodName) {
        // Check if already at full health
        const isHealthFull = this.gameStore.player.stats.health >= PLAYER_STATS.MAX_VALUE;
        if (isHealthFull) {
            this.messageSystem.showPlayerMessage(
                "You are already at full health.",
                "WARNING"
            );
            return;
        }

        // Check if eating is in progress
        if (this.isEating) {
            return;
        }

        // Find the food item
        const foodItem = Array.from(this.gameStore.packing.selectedItems.values())
            .find(item => item.name === foodName);

        if (!foodItem) {
            this.messageSystem.showPlayerMessage(
                "Food item not found in inventory.",
                "ERROR"
            );
            return;
        }

        // Check if item needs cooking and has stove/fuel
        if (foodItem.special?.includes('requires stove')) {
            const hasStove = Array.from(this.gameStore.packing.selectedItems.values())
                .some(item => item.name === 'Primus Stove');
            const hasFuel = Array.from(this.gameStore.packing.selectedItems.values())
                .some(item => item.name === 'Paraffin Fuel');
            
            if (!hasStove && !hasFuel) {
                this.messageSystem.showPlayerMessage(
                    "You need both a stove and fuel to cook this food.",
                    "WARNING"
                );
                return;
            } else if (!hasStove) {
                this.messageSystem.showPlayerMessage(
                    "You need a stove to cook this food.",
                    "WARNING"
                );
                return;
            } else if (!hasFuel) {
                this.messageSystem.showPlayerMessage(
                    "You need fuel to cook this food.",
                    "WARNING"
                );
                return;
            }
        }

        // Remove the food item from inventory
        this.gameStore.packing.removeItem(foodItem.id);

        // Remove fuel if cooking was required
        if (foodItem.special?.includes('requires stove')) {
            const fuelItem = Array.from(this.gameStore.packing.selectedItems.values())
                .find(item => item.name === 'Paraffin Fuel');
            if (fuelItem) {
                this.gameStore.packing.removeItem(fuelItem.id);
            }
        }

        // Find the button using the data attribute
        const foodItemElement = document.querySelector(`.food-item[data-food-name="${foodName}"]`);
        const button = foodItemElement?.querySelector('.eat-button');
        if (button) {
            this.startEatingProcess(foodName, button);
        }
    }

    getButtonDisabledState(item) {
        if (this.isEating || this.gameStore.player.stats.health >= PLAYER_STATS.MAX_VALUE) {
            return 'disabled';
        }

        if (item.special?.includes('requires stove')) {
            const hasStove = Array.from(this.gameStore.packing.selectedItems.values())
                .some(item => item.name === 'Primus Stove');
            const hasFuel = Array.from(this.gameStore.packing.selectedItems.values())
                .some(item => item.name === 'Paraffin Fuel');
            
            if (!hasStove || !hasFuel) {
                return 'disabled';
            }
        }

        return '';
    }

    getButtonText(item) {
        if (this.isEating) {
            return 'Eating...';
        }

        if (this.gameStore.player.stats.health >= PLAYER_STATS.MAX_VALUE) {
            return 'Full Health';
        }

        if (item.special?.includes('requires stove')) {
            const hasStove = Array.from(this.gameStore.packing.selectedItems.values())
                .some(item => item.name === 'Primus Stove');
            const hasFuel = Array.from(this.gameStore.packing.selectedItems.values())
                .some(item => item.name === 'Paraffin Fuel');
            
            if (!hasStove && !hasFuel) {
                return 'No Stove or Fuel';
            } else if (!hasFuel) {
                return 'No Fuel';
            } else if (!hasStove) {
                return 'No Stove';
            }
            
            return 'Cook & Eat';
        }

        return 'Eat';
    }
}

// Make eatFood globally available for the onclick handler
window.eatFood = (foodName) => {
    if (window.gameStore?.foodSystem) {
        window.gameStore.foodSystem.eatFood(foodName);
    }
};

export default FoodSystem;
