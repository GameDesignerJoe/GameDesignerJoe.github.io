// Ship Life - Inventory System

/**
 * Get item by ID
 */
function getItemById(itemId) {
    return window.itemsData.find(i => i.id === itemId);
}

/**
 * Display inventory (for debug or future inventory screen)
 */
function displayInventory() {
    console.log('=== INVENTORY ===');
    
    if (Object.keys(gameState.inventory).length === 0) {
        console.log('Inventory is empty');
        return;
    }
    
    // Group items by type
    const itemsByType = {};
    
    Object.entries(gameState.inventory).forEach(([itemId, quantity]) => {
        const item = getItemById(itemId);
        const type = item ? item.type : 'unknown';
        
        if (!itemsByType[type]) {
            itemsByType[type] = [];
        }
        
        itemsByType[type].push({
            id: itemId,
            name: item ? item.name : itemId,
            quantity
        });
    });
    
    // Display by type
    Object.entries(itemsByType).forEach(([type, items]) => {
        console.log(`\n${type.toUpperCase()}:`);
        items.forEach(item => {
            console.log(`  ${item.name} x${item.quantity}`);
        });
    });
}

console.log('Inventory system loaded.');
