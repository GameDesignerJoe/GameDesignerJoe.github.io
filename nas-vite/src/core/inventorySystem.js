// src/core/inventorySystem.js

import { ITEMS_DATABASE } from '../config/itemsDatabase.js';

export class InventorySystem {
    constructor(gameStore) {
        this.gameStore = gameStore;
    }

    handleInventoryIconClick() {
        // Create and show inventory modal
        const modal = document.createElement('div');
        modal.className = 'inventory-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'inventory-modal-content';
        
        modalContent.innerHTML = `
            <h2>INVENTORY</h2>
            <div class="inventory-list">
                ${this.renderInventoryItems()}
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

        // Add the same styles as food modal
        const style = document.createElement('style');
        style.textContent = `
            .inventory-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }

            .inventory-modal-content {
                background: #01497C;
                padding: 20px;
                border-radius: 8px;
                max-width: 425px;  /* Reduced from 500px by 15% */
                width: 76.5%;  /* Reduced from 90% by 15% */
                max-height: 80vh;
                overflow-y: auto;
                scrollbar-width: none;  /* Firefox */
                -ms-overflow-style: none;  /* IE and Edge */
                color: white;
                font-family: 'Old Standard TT', serif;
            }

            .inventory-modal-content::-webkit-scrollbar {
                display: none;  /* Chrome, Safari and Opera */
            }

            .inventory-modal-content h2 {
                text-align: center;
                margin-bottom: 20px;
                font-size: 24px;
                color: rgba(255, 255, 255, 0.9);
            }

            .inventory-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .inventory-item {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                padding: 10px;
            }

            .inventory-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }

            .inventory-name {
                font-weight: bold;
                color: rgba(255, 255, 255, 0.9);
                font-size: 18px;
            }

            .inventory-quantity {
                color: rgba(255, 255, 255, 0.7);
                font-size: 16px;
            }

            .inventory-details {
                font-size: 16px;
                color: rgba(255, 255, 255, 0.7);
            }

            .no-items {
                text-align: center;
                padding: 20px;
                color: rgba(255, 255, 255, 0.7);
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    renderInventoryItems() {
        const items = Array.from(this.gameStore.packing.selectedItems.values());

        if (items.length === 0) {
            return '<div class="no-items">No items in inventory</div>';
        }

        // Group items by name
        const groupedItems = new Map();
        items.forEach(item => {
            if (!groupedItems.has(item.name)) {
                groupedItems.set(item.name, { item: ITEMS_DATABASE[item.name], count: 1 });
            } else {
                groupedItems.get(item.name).count++;
            }
        });

        return Array.from(groupedItems.entries()).map(([name, { item, count }]) => `
            <div class="inventory-item">
                <div class="inventory-item-header">
                    <span class="inventory-name">${name}</span>
                    <span class="inventory-quantity">x${count}</span>
                </div>
                <div class="inventory-details">
                    ${item.category ? `<div>Category: ${item.category}</div>` : ''}
                    ${item.effects ? `<div>✧ ${item.effects}</div>` : ''}
                    ${item.special ? `<div>★ ${item.special}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
}

export default InventorySystem;
