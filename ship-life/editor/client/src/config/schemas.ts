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
      'unlock_on_complete.missions[]': { source: 'missions' }
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
