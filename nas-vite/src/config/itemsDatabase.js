// src/config/itemsDatabase.js

export const ITEMS_DATABASE = {
    // Food & Provisions
    "Pemmican": {
        name: "Pemmican",
        category: "Food & Provisions",
        weight: 1,
        durabilityPoints: 50,
        effects: "Restores 50% hunger, +5% health boost",
        duration: "2 days per block",
        special: "Can be eaten frozen",
        tooltip: "Essential Antarctic expedition food. Made from dried meat and fat, provides maximum calories with minimum weight"
    },
    "Ship's Biscuits": {
        name: "Ship's Biscuits",
        category: "Food & Provisions",
        weight: 2,
        durabilityPoints: 40,
        effects: "Restores 25% hunger",
        duration: "3 days per box",
        special: "Never spoils, can be eaten while moving",
        tooltip: "Standard naval ration. Nearly indestructible, these dense crackers provided basic carbohydrates"
    },
    "Dried Milk": {
        name: "Dried Milk",
        category: "Food & Provisions",
        weight: 0.5,
        durabilityPoints: 30,
        effects: "Restores 10% hunger, Minor stamina boost, +10% health recovery when resting if consumed with other food",
        special: "requires stove",
        tooltip: "Mixed with snow, provided essential calcium and made hot drinks more filling"
    },
    "Chocolate Blocks": {
        name: "Chocolate Blocks",
        category: "Food & Provisions",
        weight: 0.25,
        durabilityPoints: 20,
        effects: "Instant stamina boost (+25%), Prevents freezing damage for 1 hour",
        special: "Can be eaten while moving",
        tooltip: "High-energy emergency ration. Shackleton insisted on quality chocolate for morale"
    },
    "Emergency Seal Meat": {
        name: "Emergency Seal Meat",
        category: "Food & Provisions",
        weight: 5,
        durabilityPoints: 60,
        effects: "Restores 75% hunger, +10% health boost",
        special: "requires stove",
        duration: "Spoils after 5 days if not kept frozen",
        tooltip: "Frozen and preserved. Rich in calories and vitamin C, crucial for preventing scurvy"
    },

    // Equipment
    "Primus Stove": {
        name: "Primus Stove",
        category: "Equipment",
        weight: 8,
        durabilityPoints: 100,
        effects: "Required for cooking and melting snow, Reduces cold damage by 50% when camping",
        special: "Consumes fuel when used",
        tooltip: "Swedish-made portable stove. Essential for melting snow into drinking water and cooking"
    },
    "Paraffin Fuel": {
        name: "Paraffin Fuel",
        category: "Equipment",
        weight: 5,
        effects: "Powers stove for 7 days, Can be burned for emergency warmth",
        special: "Can be used without stove (destroys can)",
        tooltip: "Required for the Primus stove. Each can provided about one week of cooking and melting snow"
    },
    "Climbing Equipment": {
        name: "Climbing Equipment",
        category: "Equipment",
        weight: 4,
        durabilityPoints: 150,
        effects: "Required for traversing cliffs",
        special: "Essential for vertical terrain",
        tooltip: "Vital equipment for navigating steep cliffs and vertical terrain"
    },
    "Canvas Tent": {
        name: "Canvas Tent",
        category: "Equipment",
        weight: 40,
        durabilityPoints: 200,
        effects: "Required for camping in severe weather, Reduces cold damage by 75% while resting",
        special: "Can be cut up for emergency supplies",
        tooltip: "Triple-layer cotton canvas. Heavy but essential shelter against Antarctic storms"
    },
    "Sledge": {
        name: "Sledge",
        category: "Equipment",
        weight: 60,
        durabilityPoints: 300,
        effects: "Required for carrying supplies",
        special: "Can break on rough terrain",
        tooltip: "Norwegian-style wooden sledge. Could carry up to 600 lbs of supplies"
    },

    // Navigation & Scientific
    "Sextant": {
        name: "Sextant",
        category: "Navigation & Scientific",
        weight: 2,
        durabilityPoints: 100,
        effects: "Shows exact position during clear weather, Reduces stamina cost of movement",
        special: "Useless during storms/night",
        tooltip: "Brass navigation instrument. Essential for determining position using sun sightings"
    },
    "Compass": {
        name: "Compass",
        category: "Navigation & Scientific",
        weight: 0.5,
        durabilityPoints: 50,
        effects: "Shows general direction in all weather, Reduces chance of getting lost in storms",
        special: "Less reliable near magnetic pole",
        tooltip: "Less reliable near magnetic pole but crucial for general direction"
    },
    "Maps & Charts": {
        name: "Maps & Charts",
        category: "Navigation & Scientific",
        weight: 1,
        durabilityPoints: 40,
        effects: "Shows known terrain features, Can mark discovered locations",
        special: "Reveals safe paths through dangerous terrain",
        tooltip: "Incomplete but essential. Many areas remained unmapped"
    },

    // Clothing
    "Burberry Windproof Suit": {
        name: "Burberry Windproof Suit",
        category: "Clothing",
        weight: 7,
        durabilityPoints: 150,
        weatherProtection: 0.25,
        effects: "Provides 25% cold protection, Crucial in high winds",
        special: "Only one can be worn at a time",
        tooltip: "Gabardine cotton outer layer. Revolutionary windproof design by Burberry"
    },
    "Woolen Underwear": {
        name: "Woolen Underwear",
        category: "Clothing",
        weight: 3,
        durabilityPoints: 80,
        weatherProtection: 0.05,
        effects: "Provides 5% cold protection, Still works when wet",
        special: "Only one set can be worn at a time",
        tooltip: "Multiple layers worn. Wool retained warmth even when damp"
    },
    "Finnesko Boots": {
        name: "Finnesko Boots",
        category: "Clothing",
        weight: 5,
        durabilityPoints: 120,
        weatherProtection: 0.10,
        effects: "Provides 10% cold protection, Normal movement speed in snow",
        special: "Only one pair can be worn at a time",
        tooltip: "Reindeer-fur boots. Best performing footwear in extreme cold"
    },
    "Fur-Lined Mittens": {
        name: "Fur-Lined Mittens",
        category: "Clothing",
        weight: 1,
        durabilityPoints: 100,
        weatherProtection: 0.10,
        effects: "Provides 10% cold protection, Essential for handling equipment",
        special: "Only one pair can be worn at a time",
        tooltip: "Fur-lined mittens essential for handling equipment in extreme cold"
    },
    "Balaclava Cap": {
        name: "Balaclava Cap",
        category: "Clothing",
        weight: 0.5,
        durabilityPoints: 90,
        weatherProtection: 0.15,
        effects: "Provides 15% cold protection, Protects face and ears",
        special: "Only one can be worn at a time",
        tooltip: "Woolen head covering that protects face and ears from frostbite"
    },
    "Thick Wool Socks": {
        name: "Thick Wool Socks",
        category: "Clothing",
        weight: 0.5,
        durabilityPoints: 70,
        weatherProtection: 0.05,
        effects: "Provides 5% cold protection, Wicks away moisture",
        special: "Only one pair can be worn at a time",
        tooltip: "Multiple layers of wool socks for moisture control and warmth"
    },
    "Wool Muffler": {
        name: "Wool Muffler",
        category: "Clothing",
        weight: 0.5,
        durabilityPoints: 80,
        weatherProtection: 0.05,
        effects: "Provides 5% cold protection, Reduces stamina loss in blizzards",
        special: "Only one can be worn at a time",
        tooltip: "Traditional wool scarf for protecting neck and face"
    },
    "Sealskin Face Mask": {
        name: "Sealskin Face Mask",
        category: "Clothing",
        weight: 0.5,
        durabilityPoints: 100,
        weatherProtection: 0.10,
        effects: "Provides 10% cold protection, Extra protection in whiteouts",
        special: "Only one can be worn at a time",
        tooltip: "Sealskin mask providing crucial face protection in extreme conditions"
    },
    "Jersey Sweater": {
        name: "Jersey Sweater",
        category: "Clothing",
        weight: 2,
        durabilityPoints: 90,
        weatherProtection: 0.10,
        effects: "Provides 10% cold protection, Maintains warmth when wet",
        special: "Only one can be worn at a time",
        tooltip: "Mid-layer sweater worn between underwear and outer suit"
    },
    "Fur-Lined Hood": {
        name: "Fur-Lined Hood",
        category: "Clothing",
        weight: 1,
        durabilityPoints: 100,
        weatherProtection: 0.05,
        effects: "Provides 5% cold protection, Additional protection at night",
        special: "Only one can be worn at a time",
        tooltip: "Fur-lined hood providing essential head protection"
    },

    // Medical Supplies
    "Medical Kit": {
        name: "Medical Kit",
        category: "Medical Supplies",
        weight: 10,
        uses: 5,
        effects: "Can heal injuries, Required for treating frostbite",
        special: "5 major or 10 minor treatments",
        tooltip: "Contains morphine, bandages, and basic surgical tools"
    },
    "Snow Goggles": {
        name: "Snow Goggles",
        category: "Medical Supplies",
        weight: 0.5,
        durabilityPoints: 80,
        effects: "Prevents snow blindness, Increases visibility range by 50% during blizzards",
        special: "Required for glacier travel, Can crack in extreme cold",
        tooltip: "Essential protection against snow blindness and improved visibility in storms. Made of leather with thin slits"
    },

    // Emergency Supplies
    "Emergency Rope": {
        name: "Emergency Rope",
        category: "Emergency Supplies",
        weight: 5,
        durabilityPoints: 100,
        effects: "Required for crossing crevasses, Can rescue fallen team members",
        special: "Can be used as emergency binding/repair",
        tooltip: "Hemp rope for crevasse rescue and sledge repair"
    },

    // Repair Items
    "Basic Sewing Kit": {
        name: "Basic Sewing Kit",
        category: "Repair Items",
        weight: 2,
        uses: 10,
        effects: "Repairs 20-40% durability",
        special: "For clothing, tents, fabric items",
        tooltip: "Thread, needles, and patches. Essential for maintaining fabric items"
    },
    "Sledge Repair Kit": {
        name: "Sledge Repair Kit",
        category: "Repair Items",
        weight: 5,
        uses: 3,
        effects: "Repairs 40-60% durability",
        special: "3 major or 6 minor repairs",
        tooltip: "Spare runners, bindings, and wood. Critical for maintaining sledge integrity"
    },
    "Tool Maintenance Kit": {
        name: "Tool Maintenance Kit",
        category: "Repair Items",
        weight: 2,
        uses: 8,
        effects: "Repairs 25-45% durability",
        special: "For metal tools, stove, navigation equipment",
        tooltip: "Files, oil, and basic parts. Keeps tools functional in harsh conditions"
    }
};

export default ITEMS_DATABASE;
