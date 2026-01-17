import type { DropdownOptions } from '../types';

// Map field names to dropdown option keys
export function getDropdownOptionsForField(
  fieldName: string, 
  dropdownOptions: DropdownOptions | null
): string[] | null {
  if (!dropdownOptions) return null;

  const mapping: Record<string, keyof DropdownOptions> = {
    'actor': 'guardians',
    'type': 'conversationTypes',
    'player_char_req': 'playerCharReq',
    'item': 'items',
    'item_id': 'items',
    'blueprint_required': 'blueprints',
    'blueprint_id': 'blueprints',
    'unlocks_recipe': 'items',
    'mission': 'missions',
    'mission_id': 'missions',
    'workstation': 'workstations',
    'workstation_id': 'workstations',
    'room': 'rooms',
    'room_id': 'rooms',
    'anomaly': 'anomalies',
    'anomaly_id': 'anomalies',
    'trophy': 'trophies',
    'trophy_id': 'trophies',
    'guardian': 'guardians',
    'guardian_id': 'guardians',
    'participant': 'guardians',
    'character': 'guardians',
    'char_id': 'guardians'
  };

  const optionKey = mapping[fieldName.toLowerCase()];
  return optionKey && dropdownOptions[optionKey] ? dropdownOptions[optionKey] : null;
}

// Get the main array from a JSON data file
export function getMainArray(data: any): any[] | null {
  if (!data) return null;
  
  const arrayKeys = Object.keys(data).filter(key => 
    Array.isArray(data[key]) && key !== '_documentation'
  );
  
  return arrayKeys.length > 0 ? data[arrayKeys[0]] : null;
}

// Get the array key name from data
export function getMainArrayKey(data: any): string | null {
  if (!data) return null;
  
  const arrayKeys = Object.keys(data).filter(key => 
    Array.isArray(data[key]) && key !== '_documentation'
  );
  
  return arrayKeys.length > 0 ? arrayKeys[0] : null;
}

// Format field name for display
export function formatFieldName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Check if a field should be rendered as a textarea
export function isTextAreaField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return lowerName.includes('text') || 
         lowerName.includes('description') || 
         lowerName.includes('dialogue');
}
