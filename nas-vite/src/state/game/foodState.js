// src/state/game/foodState.js

export const foodState = {
    isEating: false,
    selectedFood: null,
    eatingProgress: 0,
    consumptionTimes: {
        'Ship\'s Biscuits': 2.5,  // seconds
        'Pemmican': 5,
        'Chocolate Blocks': 4,
        'Dried Milk': 7.5,
        'Emergency Seal Meat': 10
    },

    healingAmounts: {
        'Ship\'s Biscuits': 15,
        'Pemmican': 25,
        'Chocolate Blocks': 20,
        'Dried Milk': 30,
        'Emergency Seal Meat': 40
    },
    
    // Methods
    setEating(value) {
        this.isEating = value;
        if (!value) {
            this.selectedFood = null;
            this.eatingProgress = 0;
        }
    },
    
    setSelectedFood(food) {
        this.selectedFood = food;
    },
    
    setEatingProgress(progress) {
        this.eatingProgress = Math.min(Math.max(progress, 0), 100);
    },
    
    getConsumptionTime(foodName) {
        return this.consumptionTimes[foodName] || 5; // Default to 5 seconds if not specified
    },
    
    applyFoodEffects(foodName, player) {
        const healAmount = this.healingAmounts[foodName] || 20; // Default healing if not specified
        const isHealthFull = player.stats.health >= 100;

        if (isHealthFull) {
            return {
                success: false,
                message: "You are already at full health."
            };
        }

        player.heal(healAmount);
        return {
            success: true,
            message: `You eat the ${foodName} and recover ${healAmount} health.`
        };
    },

    reset() {
        this.isEating = false;
        this.selectedFood = null;
        this.eatingProgress = 0;
    }
};

export default foodState;
