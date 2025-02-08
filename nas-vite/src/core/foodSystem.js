// src/core/foodSystem.js

import { ITEMS_DATABASE } from '../config/itemsDatabase.js';
import { PLAYER_STATS } from '../config/constants.js';

export class FoodSystem {
    constructor(gameStore, messageSystem) {
        this.gameStore = gameStore;
        this.messageSystem = messageSystem;
        this.isEating = false;
        this.selectedFood = null;
        this.eatingProgress = 0;
        this.animationFrame = null;
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
        // Allow modal to size according to CSS
        
        modalContent.innerHTML = `
            <h2>FOOD INVENTORY</h2>
            <div class="food-list">
                ${this.renderFoodItems()}
            </div>
        `;

        // Position the modal content to match grid container dimensions
        const gridContainer = document.querySelector('.grid-container');
        if (gridContainer) {
            const rect = gridContainer.getBoundingClientRect();
            // Let CSS handle the sizing
        }
        
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
            <div class="food-item">
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

        // Apply food effects and show message
        const result = this.gameStore.food.applyFoodEffects(foodName, this.gameStore.player);
        this.messageSystem.showPlayerMessage(result.message, result.success ? "STATUS" : "WARNING");

        // Update the modal
        const modal = document.querySelector('.food-modal');
        if (modal) {
            const foodList = modal.querySelector('.food-list');
            if (foodList) {
                foodList.innerHTML = this.renderFoodItems();
            }
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
