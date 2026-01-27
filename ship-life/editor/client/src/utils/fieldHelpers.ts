import type { DropdownOptions } from '../types';
import { getSchemaForFile, getDropdownForField as getSchemaDropdown } from '../config/schemas';

// Get dropdown options for a field using schema-driven approach
export function getDropdownOptionsForField(
  fieldName: string, 
  dropdownOptions: DropdownOptions | null,
  path?: string[],
  currentFileName?: string,
  currentObject?: any
): string[] | null {
  if (!dropdownOptions) return null;

  // Build full field path, removing array name and numeric indices
  // e.g., "guardians.0.portrait.type" becomes "portrait.type"
  let fieldPath = fieldName;
  if (path && path.length > 0) {
    // Remove the first element (array name like "guardians") and any numeric indices
    const cleanPath = path.slice(1).filter(p => isNaN(parseInt(p)));
    fieldPath = cleanPath.length > 0 ? cleanPath.join('.') : fieldName;
  }
  
  // CONDITIONAL LOGIC: Check if this is a "value" field with a sibling "type" field
  if (fieldName.toLowerCase() === 'value' && currentObject && 'type' in currentObject) {
    const typeValue = currentObject.type;
    
    // If type is "image", return image dropdown based on the file
    if (typeValue === 'image' && currentFileName) {
      const schema = getSchemaForFile(currentFileName);
      if (schema?.imageFolder) {
        const imageKey = `${schema.imageFolder}Images` as keyof DropdownOptions;
        return dropdownOptions[imageKey] || null;
      }
    }
    
    // If type is "color", return null (will render as text input)
    if (typeValue === 'color') {
      return null;
    }
  }
  
  // Try schema-based dropdown first (file-specific)
  if (currentFileName) {
    const schema = getSchemaForFile(currentFileName);
    if (schema && schema.dropdowns) {
      // Check for exact field path match (e.g., "portrait.type")
      const dropdown = schema.dropdowns[fieldPath];
      if (dropdown) {
        if (Array.isArray(dropdown)) {
          return dropdown;
        }
        // If it's a source reference, get from dropdownOptions
        if (typeof dropdown === 'object' && dropdown.source) {
          const sourceKey = dropdown.source as keyof DropdownOptions;
          return dropdownOptions[sourceKey] || null;
        }
      }
      
      // Check for array item match (e.g., "participants[]" matches array items)
      const arrayItemPath = fieldPath + '[]';
      const arrayItemDropdown = schema.dropdowns[arrayItemPath];
      if (arrayItemDropdown) {
        if (Array.isArray(arrayItemDropdown)) {
          return arrayItemDropdown;
        }
        if (typeof arrayItemDropdown === 'object' && arrayItemDropdown.source) {
          const sourceKey = arrayItemDropdown.source as keyof DropdownOptions;
          return dropdownOptions[sourceKey] || null;
        }
      }
      
      // NEW: Check for nested array element patterns (e.g., "loot_table[].resource_id")
      // Build all possible array patterns from the path
      if (path && path.length > 2) {
        // Try to match patterns like "arrayName[].fieldName"
        const pathWithoutIndices = path.slice(1).map(p => isNaN(parseInt(p)) ? p : '[INDEX]');
        
        // Look for array patterns in schema
        for (const schemaKey in schema.dropdowns) {
          if (schemaKey.includes('[]')) {
            // Extract the field name after []
            const parts = schemaKey.split('[].');
            if (parts.length === 2 && parts[1] === fieldName) {
              // Check if our path contains the array name
              const arrayName = parts[0];
              if (pathWithoutIndices.includes(arrayName) || fieldPath.includes(arrayName)) {
                const dropdownDef = schema.dropdowns[schemaKey];
                if (Array.isArray(dropdownDef)) {
                  return dropdownDef;
                }
                if (typeof dropdownDef === 'object' && dropdownDef.source) {
                  const sourceKey = dropdownDef.source as keyof DropdownOptions;
                  return dropdownOptions[sourceKey] || null;
                }
              }
            }
          }
        }
      }
      
      // Check for simple field name match (e.g., just "type")
      const simpleFieldDropdown = schema.dropdowns[fieldName];
      if (simpleFieldDropdown) {
        if (Array.isArray(simpleFieldDropdown)) {
          return simpleFieldDropdown;
        }
        if (typeof simpleFieldDropdown === 'object' && simpleFieldDropdown.source) {
          const sourceKey = simpleFieldDropdown.source as keyof DropdownOptions;
          return dropdownOptions[sourceKey] || null;
        }
      }
    }
  }

  // Fallback to global field name mapping for cross-file references
  const mapping: Record<string, keyof DropdownOptions> = {
    'actor': 'guardians',
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
  
  // Handle direct array (e.g., trophies.json)
  if (Array.isArray(data)) {
    return data;
  }
  
  // Handle wrapped array (e.g., { "guardians": [...] })
  const arrayKeys = Object.keys(data).filter(key => 
    Array.isArray(data[key]) && key !== '_documentation'
  );
  
  return arrayKeys.length > 0 ? data[arrayKeys[0]] : null;
}

// Get the array key name from data
export function getMainArrayKey(data: any): string | null {
  if (!data) return null;
  
  // Handle direct array (no key name)
  if (Array.isArray(data)) {
    return null; // Direct array has no key
  }
  
  // Handle wrapped array
  const arrayKeys = Object.keys(data).filter(key => 
    Array.isArray(data[key]) && key !== '_documentation'
  );
  
  return arrayKeys.length > 0 ? arrayKeys[0] : null;
}

// Format field name for display
export function formatFieldName(key: string): string {
  // Custom labels for specific fields
  const customLabels: Record<string, string> = {
    'missions': 'Missions To Unlock',
    'missions_completed': 'Required Missions'
  };
  
  // Check if there's a custom label
  const customLabel = customLabels[key.toLowerCase()];
  if (customLabel) return customLabel;
  
  // Default formatting
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Check if a field should be rendered as a textarea
export function isTextAreaField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return lowerName.includes('text') || 
         lowerName.includes('description') || 
         lowerName.includes('dialogue');
}
