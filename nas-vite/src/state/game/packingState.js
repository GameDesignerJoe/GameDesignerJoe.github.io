// src/state/game/packingState.js
import { ITEMS_DATABASE } from '../../config/itemsDatabase.js';

export const PackingState = {
    selectedItems: new Map(),
    totalWeight: 0,
    BASE_WEIGHT: 60,
    SLEDGE_BONUS: 300,  // Additional capacity from sledge
    MAX_WEIGHT: 60,
    initialized: false,

    init(store) {
        if (this.initialized) return;
        this.store = store;
        this.reset();
        this.initialized = true;
    },

    updateMaxWeight() {
        const hasSledge = Array.from(this.selectedItems.values())
            .some(item => item.name === "Sledge");
        this.MAX_WEIGHT = hasSledge ? this.BASE_WEIGHT + this.SLEDGE_BONUS : this.BASE_WEIGHT;
    },

    // Reset state
    reset() {
        this.selectedItems.clear();
        this.totalWeight = 0;
    },

    // Add an item to selection
    addItem(item) {
        console.log('Adding item:', item.name, 'Weight:', item.weight, 'Current total:', this.totalWeight);
        
        // Check for sledge
        const isSledge = item.name === "Sledge";
        if (isSledge) {
            // Check if player already has a sledge
            const hasSledge = Array.from(this.selectedItems.values())
                .some(item => item.name === "Sledge");
            if (hasSledge) {
                console.log('Already have a sledge');
                return false;
            }
            // Temporarily increase MAX_WEIGHT to allow sledge
            this.MAX_WEIGHT = this.BASE_WEIGHT + this.SLEDGE_BONUS;
        }
        
        // Check if adding this item would exceed weight limit
        if (this.totalWeight + item.weight > this.MAX_WEIGHT) {
            console.log('Would exceed weight limit');
            if (isSledge) this.MAX_WEIGHT = this.BASE_WEIGHT;
            return false;
        }

        // Generate unique ID with timestamp and random number to avoid collisions
        const itemId = `${item.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Add item to selection
        this.selectedItems.set(itemId, {
            ...item,
            id: itemId,
            durability: 100,
            durabilityState: 'Pristine'
        });
        
        // Update total weight
        this.totalWeight += item.weight;
        console.log('New total weight:', this.totalWeight);
        
        return true;
    },

    // Remove an item from selection
    removeItem(itemId) {
        const item = this.selectedItems.get(itemId);
        if (item) {
            const isSledge = item.name === "Sledge";
            this.totalWeight -= item.weight;
            this.selectedItems.delete(itemId);
            
            // If we removed a sledge, update weight limit and check if we need to remove items
            if (isSledge) {
                this.MAX_WEIGHT = this.BASE_WEIGHT;
                if (this.totalWeight > this.MAX_WEIGHT) {
                    // Remove items until we're under the new limit
                    const itemsToRemove = [];
                    for (const [id, item] of this.selectedItems) {
                        if (item.name !== "Sledge") {
                            itemsToRemove.push(id);
                            this.totalWeight -= item.weight;
                            if (this.totalWeight <= this.MAX_WEIGHT) break;
                        }
                    }
                    itemsToRemove.forEach(id => this.selectedItems.delete(id));
                }
            }
            return true;
        }
        return false;
    },

    // Load standard expedition loadout
    loadStandardLoadout() {
        console.log('Loading standard loadout');
        this.reset();
        const standardLoadout = {
            // Essential Equipment
            'Sledge': 1,
            'Canvas Tent': 1,
            'Primus Stove': 1,
            'Climbing Equipment': 1,

            // Food & Cooking
            'Pemmican': 15,
            'Ship\'s Biscuits': 6,
            'Dried Milk': 8,
            'Chocolate Blocks': 10,
            'Emergency Seal Meat': 2,
            'Paraffin Fuel': 5,

            // Weather Protection
            'Burberry Windproof Suit': 1,
            'Woolen Underwear': 1,
            'Finnesko Boots': 1,
            'Snow Goggles': 1,
            'Fur-Lined Mittens': 1,
            'Balaclava Cap': 1,
            'Sealskin Face Mask': 1,
            'Thick Wool Socks': 1,
            'Jersey Sweater': 1,
            'Fur-Lined Hood': 1,

            // Navigation & Tools
            'Sextant': 1,
            'Compass': 1,
            'Maps & Charts': 1,

            // Medical & Emergency
            'Medical Kit': 1,
            'Emergency Rope': 1,

            // Repair Kits
            'Basic Sewing Kit': 1,
            'Sledge Repair Kit': 1,
            'Tool Maintenance Kit': 1
        };

        Object.entries(standardLoadout).forEach(([itemName, quantity]) => {
            const itemTemplate = ITEMS_DATABASE[itemName];
            if (itemTemplate) {
                for (let i = 0; i < quantity; i++) {
                    this.addItem(itemTemplate);
                }
            }
        });

        console.log('Standard loadout complete', this.selectedItems.size, 'items loaded');
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
