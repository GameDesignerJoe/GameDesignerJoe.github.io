// src/state/game/packingState.js
import { ITEMS_DATABASE } from '../../config/itemsDatabase.js';

export const PackingState = {
    selectedItems: new Map(),
    totalWeight: 0,
    MAX_WEIGHT: 600,

    // Reset state
    reset() {
        this.selectedItems.clear();
        this.totalWeight = 0;
    },

    // Add an item to selection
    addItem(item) {
        if (this.totalWeight + item.weight > this.MAX_WEIGHT) {
            return false;
        }

        const itemId = `${item.name}-${Date.now()}`;
        this.selectedItems.set(itemId, {
            ...item,
            id: itemId,
            durability: 100,
            durabilityState: 'Pristine'
        });
        this.totalWeight += item.weight;
        return true;
    },

    // Remove an item from selection
    removeItem(itemId) {
        const item = this.selectedItems.get(itemId);
        if (item) {
            this.totalWeight -= item.weight;
            this.selectedItems.delete(itemId);
            return true;
        }
        return false;
    },

    // Load standard expedition loadout
    loadStandardLoadout() {
        this.reset();
        const standardLoadout = {
            'Sledge': 1,
            'Canvas Tent': 1,
            'Primus Stove': 1,
            'Ice Axe': 1,
            'Pemmican': 10,
            'Ship\'s Biscuits': 3,
            'Dried Milk': 4,
            'Chocolate Blocks': 8,
            'Emergency Seal Meat': 1,
            'Paraffin Fuel': 3,
            'Sextant': 1,
            'Compass': 1,
            'Maps & Charts': 1,
            'Burberry Windproof Suit': 1,
            'Woolen Underwear': 2,
            'Finnesko Boots': 1,
            'Snow Goggles': 1,
            'Medical Kit': 1,
            'Emergency Rope': 1,
            'Basic Sewing Kit': 1,
            'Sledge Repair Kit': 1,
            'Tool Maintenance Kit': 1
        };

        Object.entries(standardLoadout).forEach(([itemName, quantity]) => {
            for (let i = 0; i < quantity; i++) {
                const itemTemplate = ITEMS_DATABASE[itemName];
                if (itemTemplate) {
                    this.addItem(itemTemplate);
                }
            }
        });
    },

    getGameItems() {
        return Array.from(this.selectedItems.values()).map(item => ({
            name: item.name,
            durability: item.durability,
            weight: item.weight,
            state: item.durabilityState,
            category: item.category,
            effects: item.effects,
            special: item.special
        }));
    }
};

// Bind all methods to PackingState
Object.getOwnPropertyNames(PackingState)
    .filter(prop => typeof PackingState[prop] === 'function')
    .forEach(method => {
        PackingState[method] = PackingState[method].bind(PackingState);
    });