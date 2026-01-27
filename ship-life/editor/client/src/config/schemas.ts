// Schema definitions for each JSON file in the game
// This provides context-aware field handling, dropdowns, and validation

export interface FieldSchema {
  type: 'text' | 'number' | 'boolean' | 'dropdown' | 'textarea' | 'conditional';
  options?: string[];
  source?: string; // Reference to dropdown source (e.g., 'guardianImages', 'items')
  when?: { [key: string]: any }; // Conditional field display
  then?: FieldSchema;
}

export interface FileSchema {
  name: string;
  visualField?: {
    path: string; // e.g., "portrait", "visual", "icon", "background"
    types: string[]; // e.g., ["image", "color"]
  };
  imageFolder?: string; // Folder name in assets/images/
  dropdowns?: {
    [fieldPath: string]: string[] | { source: string };
  };
  arrayFields?: {
    [fieldPath: string]: {
      canAdd: boolean;
      canRemove: boolean;
      canReorder?: boolean;
      template?: any; // Default structure for new items
    };
  };
  optionalFields?: {
    [fieldPath: string]: any; // Template for optional fields
  };
  fieldOrder?: string[]; // Explicit field ordering with positions for optional fields
  tooltips?: {
    [fieldPath: string]: string; // Help text for fields
  };
}

export const FILE_SCHEMAS: { [filename: string]: FileSchema } = {
  'guardians.json': {
    name: 'Guardians',
    visualField: {
      path: 'portrait',
      types: ['image', 'color']
    },
    imageFolder: 'guardians',
    dropdowns: {
      'portrait.type': ['image', 'color'],
      'portrait.value': { source: 'guardianImages' }, // When type=image
      'role': ['DPS', 'Tank', 'Support', 'Ranged']
    }
  },

  'missions.json': {
    name: 'Missions',
    visualField: {
      path: 'visual',
      types: ['image', 'color']
    },
    imageFolder: 'missions',
    dropdowns: {
      'visual.type': ['image', 'color'],
      'visual.value': { source: 'missionImages' },
      'mission_type': ['diplomatic', 'collection', 'combat', 'rescue', 'search', 'recon'],
      'requirements.equipment_subtype': ['weapon', 'armor', 'tech', 'medical', 'structural'],
      'prerequisites.missions_completed[]': { source: 'missions' },
      'unlock_on_complete.missions[]': { source: 'missions' },
      'required_stats.primary': ['', 'health', 'attack', 'defense', 'movement', 'mind'],
      'required_stats.secondary': ['', 'health', 'attack', 'defense', 'movement', 'mind'],
      'required_stats.tertiary': ['', 'health', 'attack', 'defense', 'movement', 'mind']
    },
    tooltips: {
      'id': 'Unique identifier for this mission',
      'difficulty': 'Mission difficulty 1-10 scale (visible to player)',
      'difficulty_multiplier': 'Calculation multiplier - Defaults: 1=0.6, 2=1.1, 3=1.5, 4=1.7, 5=2.0, 6=3.0, 7=4.0, 8=5.5, 9=6.5, 10=8.0',
      'repeatable': 'If true, mission stays available after completion',
      'persist_on_fail': 'If true, mission stays available after failure',
      'chain.name': 'Name of the mission chain (empty if standalone)',
      'chain.part': 'Which part in the chain (1, 2, 3, etc.)',
      'chain.total': 'Total missions in this chain',
      'required_stats.primary': 'Primary stat (Gold) - 50% weight in success calculation',
      'required_stats.secondary': 'Secondary stat (Silver) - 30% weight in success calculation',
      'required_stats.tertiary': 'Tertiary stat (Bronze) - 20% weight in success calculation'
    },
    optionalFields: {
      'required_stats.secondary': '',
      'required_stats.tertiary': ''
    },
    arrayFields: {
      'prerequisites.missions_completed': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'prerequisites.flags': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'rewards.success': {
        canAdd: true,
        canRemove: true,
        template: { item: '', min: 1, max: 1, drop_chance: 100 }
      },
      'rewards.failure': {
        canAdd: true,
        canRemove: true,
        template: { item: '', min: 1, max: 1, drop_chance: 100 }
      },
      'unlock_on_complete.flags': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'unlock_on_complete.missions': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'simulation.messages': {
        canAdd: true,
        canRemove: true,
        canReorder: true,
        template: { text: '', bar_progress: 0, display_time: 3 }
      }
    }
  },

  'anomalies.json': {
    name: 'Anomalies',
    visualField: {
      path: 'icon',
      types: ['color']
    },
    dropdowns: {
      'icon.type': ['color'],
      'category': ['environmental', 'tactical', 'opportunity', 'social'],
      'rarity': ['common', 'uncommon', 'rare']
    },
    arrayFields: {
      'effects.reward_bonus_items': {
        canAdd: true,
        canRemove: true,
        template: { item: '', amount: 1 }
      }
    }
  },

  'conversations.json': {
    name: 'Conversations',
    dropdowns: {
      'type': ['important', 'background'],
      'participants[]': { source: 'guardians' }
    },
    arrayFields: {
      'participants': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'prerequisites.flags': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'prerequisites.previous_conversations': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'lines': {
        canAdd: true,
        canRemove: true,
        canReorder: true,
        template: { actor: '', text: '' }
      }
    }
  },

  'items.json': {
    name: 'Items',
    visualField: {
      path: 'icon',
      types: ['image', 'color']
    },
    imageFolder: 'items',
    dropdowns: {
      'icon.type': ['image', 'color'],
      'icon.value': { source: 'itemImages' },
      'type': ['resource', 'equipment', 'aspect', 'blueprint'],
      'subtype': ['weapon', 'armor', 'tech', 'medical', 'structural']
    }
  },

  'workstations.json': {
    name: 'Workstations',
    visualField: {
      path: 'visual',
      types: ['image', 'color']
    },
    imageFolder: 'workstations',
    dropdowns: {
      'visual.type': ['image', 'color'],
      'visual.value': { source: 'workstationImages' }
    },
    arrayFields: {
      'upgrade_costs': {
        canAdd: true,
        canRemove: true,
        template: { level: 2, resources: [] }
      },
      'upgrade_costs[].resources': {
        canAdd: true,
        canRemove: true,
        template: { item: '', amount: 1 }
      },
      'recipes': {
        canAdd: true,
        canRemove: true,
        template: {
          id: '',
          name: '',
          description: '',
          required_level: 1,
          blueprint_required: '',
          cost: [],
          output: { item: '', amount: 1 }
        }
      },
      'recipes[].cost': {
        canAdd: true,
        canRemove: true,
        template: { item: '', amount: 1 }
      }
    }
  },

  'blueprints.json': {
    name: 'Blueprints',
    visualField: {
      path: 'icon',
      types: ['color']
    },
    dropdowns: {
      'icon.type': ['color']
    }
  },

  'trophies.json': {
    name: 'Trophies',
    visualField: {
      path: 'icon',
      types: ['color']
    },
    dropdowns: {
      'icon.type': ['color'],
      'requirement.type': [
        'missions_completed',
        'perfect_streak',
        'mission_type',
        'squad_size',
        'solo_difficult',
        'full_loadouts',
        'unique_crafts',
        'rare_items',
        'conversations'
      ]
    }
  },

  'rooms.json': {
    name: 'Rooms',
    visualField: {
      path: 'background',
      types: ['image', 'color']
    },
    imageFolder: 'rooms',
    dropdowns: {
      'background.type': ['image', 'color'],
      'background.value': { source: 'roomImages' }
    }
  },

  'planets.json': {
    name: 'Planets',
    visualField: {
      path: 'map_image',
      types: ['image', 'color']
    },
    imageFolder: 'planets',
    dropdowns: {
      'map_image.type': ['image', 'color'],
      'map_image.value': { source: 'planetsImages' }
    },
    tooltips: {
      'id': 'Unique identifier for this planet (text field - enter new ID when creating planet)',
      'name': 'Display name shown to players',
      'subtitle': 'Descriptive subtitle (e.g., "Humanity\'s Homeworld")',
      'map_image': 'Visual for planet map - can be image path or color hex'
    }
  },

  'locations.json': {
    name: 'Locations',
    visualField: {
      path: 'location_image',
      types: ['image', 'color']
    },
    imageFolder: 'locations',
    dropdowns: {
      'planet_id': { source: 'planets' },
      'location_image.type': ['image', 'color'],
      'location_image.value': { source: 'locationImages' },
      'unlock_requirements.specific_activities[]': { source: 'activities' },
      'possible_resources[]': { source: 'items' }
    },
    arrayFields: {
      'unlock_requirements.specific_activities': {
        canAdd: true,
        canRemove: true,
        template: ''
      },
      'possible_resources': {
        canAdd: true,
        canRemove: true,
        template: ''
      }
    },
    tooltips: {
      'id': 'Unique identifier for this location',
      'planet_id': 'Which planet this location is on',
      'hotspot_position.x': 'X position on map (0-100 percentage)',
      'hotspot_position.y': 'Y position on map (0-100 percentage)',
      'locked': 'If true, location must be unlocked before access',
      'unlock_requirements.drop_count': 'Total drops required to unlock',
      'unlock_requirements.activities_completed': 'Total activities required to unlock',
      'activity_spawn_range.min': 'Minimum activities spawned per drop',
      'activity_spawn_range.max': 'Maximum activities spawned per drop',
      'max_activities': 'Maximum activities player can engage before extraction',
      'activity_type_distribution': 'Percentage chances for each activity type (must total 100%)',
      'possible_resources': 'Items that can be found at this location (for future use)'
    }
  },

  'activities.json': {
    name: 'Activities',
    dropdowns: {
      'type': ['combat', 'resource_gathering', 'investigating', 'puzzle'],
      'rarity': ['common', 'uncommon', 'rare'],
      'stat_requirements.primary.stat': ['health', 'attack', 'defense', 'movement', 'mind'],
      'stat_requirements.secondary.stat': ['health', 'attack', 'defense', 'movement', 'mind'],
      'stat_requirements.tertiary.stat': ['health', 'attack', 'defense', 'movement', 'mind'],
      'loot_table[].resource_id': { source: 'items' }
    },
    arrayFields: {
      'loot_table': {
        canAdd: true,
        canRemove: true,
        template: { resource_id: '', min: 1, max: 1, drop_chance: 100 }
      }
    },
    optionalFields: {
      'stat_requirements.tertiary': { stat: '', value: 0 }
    },
    tooltips: {
      'id': 'Unique identifier for this activity',
      'type': 'Activity category (affects spawning distribution)',
      'rarity': 'Spawn rarity (common: 66%, rare/uncommon: 33%)',
      'difficulty': 'Activity difficulty 1-10 scale',
      'stat_requirements.primary': 'Primary stat check (most important)',
      'stat_requirements.primary.stat': 'Which guardian stat to check (health, attack, defense, movement, mind)',
      'stat_requirements.primary.value': 'Minimum stat value required for success',
      'stat_requirements.secondary': 'Secondary stat check (moderately important, optional)',
      'stat_requirements.secondary.stat': 'Which guardian stat to check',
      'stat_requirements.secondary.value': 'Minimum stat value required',
      'stat_requirements.tertiary': 'Tertiary stat check (least important, optional)',
      'stat_requirements.tertiary.stat': 'Which guardian stat to check',
      'stat_requirements.tertiary.value': 'Minimum stat value required',
      'detection_risk': 'Chance (%) of being detected when attempting to avoid',
      'flee_chance': 'Chance (%) of successfully fleeing when detected',
      'down_risk': 'Chance (%) of guardian being downed on failure',
      'loot_table[].resource_id': 'Item ID to drop (should be dropdown - requires React fix)',
      'dialogue': 'Guardian-specific dialogue (5 moments: initiate, engage, success, fail, downed). Use "default" for fallback dialogue, then add guardian IDs (stella, vawn, etc.) for character-specific lines. NOTE: Adding new guardians requires manual JSON editing currently.'
    }
  },

  'game_config.json': {
    name: 'Game Config',
    tooltips: {
      '_note': 'Game configuration file - edit with caution. Contains global game settings.'
    }
  }
};

// Helper function to get schema for a file
export function getSchemaForFile(filename: string): FileSchema | null {
  return FILE_SCHEMAS[filename] || null;
}

// Helper to determine if a field should have a dropdown
export function getDropdownForField(
  filename: string,
  fieldPath: string,
  currentObject: any = {}
): string[] | null {
  const schema = getSchemaForFile(filename);
  if (!schema || !schema.dropdowns) return null;

  // Check for exact field path match
  const dropdown = schema.dropdowns[fieldPath];
  if (!dropdown) return null;

  // If it's an array, return it
  if (Array.isArray(dropdown)) {
    return dropdown;
  }

  // If it references a source, return null (will be handled by image scanning)
  // The source will be populated from dropdownOptions from the API
  return null;
}

// Helper to check if field path represents an array that can be managed
export function getArrayConfig(filename: string, fieldPath: string) {
  const schema = getSchemaForFile(filename);
  if (!schema || !schema.arrayFields) return null;

  return schema.arrayFields[fieldPath] || null;
}

// Helper to check if a field is optional and get its template
export function getOptionalFieldTemplate(filename: string, fieldPath: string): any {
  const schema = getSchemaForFile(filename);
  if (!schema || !schema.optionalFields) return null;

  return schema.optionalFields[fieldPath];
}

// Helper to get tooltip for a field
export function getTooltipForField(filename: string, fieldPath: string): string | null {
  const schema = getSchemaForFile(filename);
  if (!schema || !schema.tooltips) return null;

  return schema.tooltips[fieldPath] || null;
}
