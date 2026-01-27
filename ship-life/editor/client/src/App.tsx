import { useState, useCallback, useEffect } from 'react';
import { FileJson, X, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react';
import { useApi } from './hooks/useApi';
import { FileSelector } from './components/FileSelector';
import { ArrayManager } from './components/ArrayManager';
import { OptionalField } from './components/OptionalField';
import { getMainArray, getMainArrayKey, formatFieldName, isTextAreaField, getDropdownOptionsForField } from './utils/fieldHelpers';
import { getArrayConfig, getOptionalFieldTemplate, getSchemaForFile, getTooltipForField, getDynamicObjectConfig } from './config/schemas';
import type { OpenFile, DropdownOptions } from './types';

export default function App() {
  const { dropdownOptions, availableFiles, loadFile, saveFile, refreshCache } = useApi();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sortMode, setSortMode] = useState<'alpha' | 'difficulty-asc' | 'difficulty-desc'>('alpha');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGuardianSelector, setShowGuardianSelector] = useState(false);
  const [guardianSelectorPath, setGuardianSelectorPath] = useState<string[]>([]);
  const [saveTimeouts, setSaveTimeouts] = useState<Record<number, NodeJS.Timeout>>({});

  const currentFile = activeFileIndex !== null ? openFiles[activeFileIndex] : null;
  const mainArray = currentFile ? getMainArray(currentFile.data) : null;
  const activeTab = currentFile ? currentFile.activeTab : 0;
  const currentItem = mainArray && activeTab < mainArray.length ? mainArray[activeTab] : null;

  const handleFileSelect = async (filename: string) => {
    // Check if already open
    const existingIndex = openFiles.findIndex(f => f.name === filename);
    if (existingIndex !== -1) {
      setActiveFileIndex(existingIndex);
      return;
    }

    try {
      const result = await loadFile(filename);
      const newFile: OpenFile = {
        name: result.filename,
        data: result.data,
        activeTab: 0,
        isDirty: false,
        saveStatus: 'saved'
      };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileIndex(openFiles.length);
      setCollapsedSections({});
      setSearchFilter('');
    } catch (error) {
      console.error('Failed to load file:', error);
      alert(`Failed to load ${filename}`);
    }
  };

  const handleOpenAll = async () => {
    for (const filename of availableFiles) {
      await handleFileSelect(filename);
    }
  };

  const [showFilePicker, setShowFilePicker] = useState(false);

  const closeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newFiles);
    
    if (activeFileIndex === index) {
      setActiveFileIndex(newFiles.length > 0 ? Math.max(0, index - 1) : null);
    } else if (activeFileIndex !== null && activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const updateValue = useCallback((path: string[], value: any) => {
    if (activeFileIndex === null) return;
    
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    
    // Auto-update difficulty_multiplier when difficulty changes (missions.json only)
    if (newFiles[activeFileIndex].name === 'missions.json' && 
        path[path.length - 1] === 'difficulty' && 
        typeof value === 'number') {
      const difficultyMultipliers: { [key: number]: number } = {
        1: 0.6,
        2: 1.1,
        3: 1.5,
        4: 1.7,
        5: 2.0,
        6: 3.0,
        7: 4.0,
        8: 5.5,
        9: 6.5,
        10: 8.0
      };
      
      if (difficultyMultipliers[value] !== undefined) {
        current.difficulty_multiplier = difficultyMultipliers[value];
      }
    }
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    newFiles[activeFileIndex].saveStatus = 'saving';
    setOpenFiles(newFiles);

    // Auto-save with debounce
    if (saveTimeouts[activeFileIndex]) {
      clearTimeout(saveTimeouts[activeFileIndex]);
    }
    
    const timeout = setTimeout(async () => {
      try {
        await saveFile(newFiles[activeFileIndex].name, newFiles[activeFileIndex].data);
        newFiles[activeFileIndex].isDirty = false;
        newFiles[activeFileIndex].saveStatus = 'saved';
        setOpenFiles([...newFiles]);
      } catch (error) {
        console.error('Save failed:', error);
        newFiles[activeFileIndex].saveStatus = 'error';
        setOpenFiles([...newFiles]);
      }
    }, 500);

    setSaveTimeouts(prev => ({ ...prev, [activeFileIndex]: timeout }));
  }, [activeFileIndex, openFiles, saveFile, saveTimeouts]);

  // Array manipulation functions
  const addArrayItem = useCallback((path: string[], template: any) => {
    if (activeFileIndex === null) return;
    
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    // Add the new item
    if (Array.isArray(current)) {
      current.push(JSON.parse(JSON.stringify(template)));
    }
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    setOpenFiles(newFiles);
  }, [activeFileIndex, openFiles]);

  const removeArrayItem = useCallback((path: string[], index: number) => {
    if (activeFileIndex === null) return;
    
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    // Remove the item
    if (Array.isArray(current)) {
      current.splice(index, 1);
    }
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    setOpenFiles(newFiles);
  }, [activeFileIndex, openFiles]);

  const reorderArrayItem = useCallback((path: string[], index: number, direction: 'up' | 'down') => {
    if (activeFileIndex === null) return;
    
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    // Reorder the item
    if (Array.isArray(current)) {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex >= 0 && newIndex < current.length) {
        const [item] = current.splice(index, 1);
        current.splice(newIndex, 0, item);
      }
    }
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    setOpenFiles(newFiles);
  }, [activeFileIndex, openFiles]);

  // Add optional field
  const addOptionalField = useCallback((path: string[], fieldName: string, template: any) => {
    if (activeFileIndex === null) return;
    
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    // Navigate to the parent object
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    // Add the optional field with its template value
    current[fieldName] = JSON.parse(JSON.stringify(template));
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    setOpenFiles(newFiles);
  }, [activeFileIndex, openFiles]);

  const addNewItem = () => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const currentData = newFiles[activeFileIndex].data;
    const arrayKey = getMainArrayKey(currentData);
    
    // Handle direct array (trophies.json) vs wrapped array
    const array = arrayKey ? currentData[arrayKey] : currentData;
    if (!Array.isArray(array)) return;
    
    let template: any = {};
    if (array.length > 0) {
      template = JSON.parse(JSON.stringify(array[0]));
      const clearValues = (obj: any) => {
        for (let key in obj) {
          if (typeof obj[key] === 'string') obj[key] = '';
          else if (typeof obj[key] === 'number') obj[key] = 0;
          else if (typeof obj[key] === 'boolean') obj[key] = false;
          else if (Array.isArray(obj[key])) obj[key] = [];
          else if (typeof obj[key] === 'object' && obj[key] !== null) clearValues(obj[key]);
        }
      };
      clearValues(template);
    }
    
    const newData = JSON.parse(JSON.stringify(currentData));
    if (arrayKey) {
      newData[arrayKey].push(template);
      newFiles[activeFileIndex].activeTab = newData[arrayKey].length - 1;
    } else {
      // Direct array
      newData.push(template);
      newFiles[activeFileIndex].activeTab = newData.length - 1;
    }
    newFiles[activeFileIndex].data = newData;
    setOpenFiles(newFiles);
  };

  const deleteCurrentItem = async () => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const currentData = newFiles[activeFileIndex].data;
    const arrayKey = getMainArrayKey(currentData);
    const currentTab = newFiles[activeFileIndex].activeTab;
    
    // Handle direct array vs wrapped array
    const array = arrayKey ? currentData[arrayKey] : currentData;
    if (!Array.isArray(array) || array.length === 0 || currentTab >= array.length) return;
    
    const newData = JSON.parse(JSON.stringify(currentData));
    if (arrayKey) {
      newData[arrayKey].splice(currentTab, 1);
      const newLength = newData[arrayKey].length;
      if (currentTab >= newLength && newLength > 0) {
        newFiles[activeFileIndex].activeTab = newLength - 1;
      } else if (newLength === 0) {
        newFiles[activeFileIndex].activeTab = 0;
      }
    } else {
      // Direct array
      newData.splice(currentTab, 1);
      const newLength = newData.length;
      if (currentTab >= newLength && newLength > 0) {
        newFiles[activeFileIndex].activeTab = newLength - 1;
      } else if (newLength === 0) {
        newFiles[activeFileIndex].activeTab = 0;
      }
    }
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    newFiles[activeFileIndex].saveStatus = 'saving';
    setOpenFiles(newFiles);
    setShowDeleteModal(false);
    
    // Save immediately
    try {
      await saveFile(newFiles[activeFileIndex].name, newFiles[activeFileIndex].data);
      newFiles[activeFileIndex].isDirty = false;
      newFiles[activeFileIndex].saveStatus = 'saved';
      setOpenFiles([...newFiles]);
    } catch (error) {
      console.error('Save failed:', error);
      newFiles[activeFileIndex].saveStatus = 'error';
      setOpenFiles([...newFiles]);
      alert('Failed to save deletion. Please try again.');
    }
  };

  const duplicateCurrentItem = () => {
    if (activeFileIndex === null || !currentItem) return;
    const newFiles = [...openFiles];
    const currentData = newFiles[activeFileIndex].data;
    const arrayKey = getMainArrayKey(currentData);
    const currentTab = newFiles[activeFileIndex].activeTab;
    
    // Clone the current item
    const duplicatedItem = JSON.parse(JSON.stringify(currentItem));
    
    // Modify id/name to indicate it's a copy
    if (duplicatedItem.id) duplicatedItem.id = duplicatedItem.id + '_copy';
    if (duplicatedItem.name) duplicatedItem.name = duplicatedItem.name + ' (Copy)';
    if (duplicatedItem.title) duplicatedItem.title = duplicatedItem.title + ' (Copy)';
    
    const newData = JSON.parse(JSON.stringify(currentData));
    if (arrayKey) {
      newData[arrayKey].splice(currentTab + 1, 0, duplicatedItem);
      newFiles[activeFileIndex].activeTab = currentTab + 1;
    } else {
      // Direct array
      newData.splice(currentTab + 1, 0, duplicatedItem);
      newFiles[activeFileIndex].activeTab = currentTab + 1;
    }
    
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].isDirty = true;
    setOpenFiles(newFiles);
  };

  const renderField = (label: string, value: any, path: string[], parentObject?: any): JSX.Element | null => {
    if (value === null || value === undefined) return null;

    const fieldId = path.join('-');
    const fieldOptions = getDropdownOptionsForField(
      path[path.length - 1], 
      dropdownOptions, 
      path,
      currentFile?.name,
      parentObject
    );
    
    if (typeof value === 'boolean') {
      return (
        <div key={fieldId} className="mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => updateValue(path, e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500"
            />
            {label}
          </label>
        </div>
      );
    }

    if (typeof value === 'number') {
      // Get tooltip for this field
      const fieldPath = path.slice(2).join('.');
      const tooltip = currentFile ? getTooltipForField(currentFile.name, fieldPath) : null;
      
      return (
        <div key={fieldId} className="mb-3">
          <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1" title={tooltip || undefined}>
            {label}
            {tooltip && <span className="ml-1 text-xs text-gray-500 cursor-help">ⓘ</span>}
          </label>
          <input
            id={fieldId}
            type="number"
            value={value}
            onChange={(e) => updateValue(path, parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      );
    }

    if (typeof value === 'string') {
      // Check if field is empty (validation warning)
      const isEmpty = value.trim() === '';
      const fieldName = path[path.length - 1];
      // Exclude chain.name from required validation (empty chains are valid)
      const isRequiredField = ['id', 'name', 'title'].includes(fieldName) && 
                              path.join('.') !== 'chain.name';
      const showWarning = isEmpty && isRequiredField;
      
      if (fieldOptions && fieldOptions.length > 0) {
        return (
          <div key={fieldId} className="mb-3">
            <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1">
              {label}
              {showWarning && <span className="text-red-400 ml-1">*</span>}
            </label>
            <select
              id={fieldId}
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              className={`w-full px-2 py-1.5 text-sm bg-gray-700 border rounded text-gray-100 focus:outline-none focus:border-blue-500 ${
                showWarning ? 'border-red-500' : 'border-gray-600'
              }`}
            >
              <option value="">Select...</option>
              {fieldOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {showWarning && (
              <p className="text-xs text-red-400 mt-1">This field is required</p>
            )}
          </div>
        );
      }

      const isTextArea = isTextAreaField(label);
      return (
        <div key={fieldId} className="mb-3">
          <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1">
            {label}
            {showWarning && <span className="text-red-400 ml-1">*</span>}
          </label>
          {isTextArea ? (
            <textarea
              id={fieldId}
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              rows={2}
              className={`w-full px-2 py-1.5 text-sm bg-gray-700 border rounded text-gray-100 focus:outline-none focus:border-blue-500 resize-y ${
                showWarning ? 'border-red-500' : 'border-gray-600'
              }`}
            />
          ) : (
            <input
              id={fieldId}
              type="text"
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              className={`w-full px-2 py-1.5 text-sm bg-gray-700 border rounded text-gray-100 focus:outline-none focus:border-blue-500 ${
                showWarning ? 'border-red-500' : 'border-gray-600'
              }`}
            />
          )}
          {showWarning && (
            <p className="text-xs text-red-400 mt-1">This field is required</p>
          )}
        </div>
      );
    }

    return null;
  };

  const renderDialogueObject = (dialogueObj: any, path: string[]): JSX.Element[] => {
    // Render dialogue sections with delete buttons for guardian sections
    return Object.entries(dialogueObj).map(([guardianKey, dialogueLines]) => {
      if (typeof dialogueLines !== 'object' || dialogueLines === null) return null;
      
      const sectionKey = `${path.join('-')}-${guardianKey}`;
      const isCollapsed = collapsedSections[sectionKey];
      const isDefault = guardianKey.toLowerCase() === 'default';
      
      return (
        <div key={guardianKey} className="mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
              className="flex items-center gap-2 text-pink-400 hover:text-pink-300 mb-2"
            >
              <ChevronRight 
                size={14} 
                className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              />
              <span className="font-semibold capitalize">{guardianKey}</span>
            </button>
            {!isDefault && (
              <button
                onClick={() => {
                  if (!confirm(`Remove dialogue for ${guardianKey}?`)) return;
                  if (activeFileIndex === null) return;
                  const newFiles = [...openFiles];
                  const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
                  let current = newData;
                  for (let i = 0; i < path.length; i++) {
                    current = current[path[i]];
                  }
                  delete current[guardianKey];
                  newFiles[activeFileIndex].data = newData;
                  newFiles[activeFileIndex].isDirty = true;
                  setOpenFiles(newFiles);
                }}
                className="p-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded mb-2"
                title={`Remove ${guardianKey} dialogue`}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {!isCollapsed && (
            <div className="pl-4 border-l-2 border-pink-900">
              {renderObject(dialogueLines, [...path, guardianKey])}
            </div>
          )}
        </div>
      );
    }).filter(Boolean) as JSX.Element[];
  };

  const renderObject = (obj: any, path: string[] = []): JSX.Element[] => {
    const renderedFields = Object.entries(obj).map(([key, value]) => {
      if (key === '_documentation' || key === '_note') return null;

      const currentPath = [...path, key];
      const displayName = formatFieldName(key);

      if (Array.isArray(value)) {
        // ALL ARRAYS get management controls now
        // Create a template based on the array's existing items
        let template: any = '';
        if (value.length > 0) {
          const firstItem = value[0];
          if (typeof firstItem === 'object' && !Array.isArray(firstItem)) {
            // Object: copy structure and clear values
            template = JSON.parse(JSON.stringify(firstItem));
            const clearValues = (obj: any) => {
              for (let k in obj) {
                if (typeof obj[k] === 'string') obj[k] = '';
                else if (typeof obj[k] === 'number') obj[k] = 0;
                else if (typeof obj[k] === 'boolean') obj[k] = false;
                else if (Array.isArray(obj[k])) obj[k] = [];
                else if (typeof obj[k] === 'object' && obj[k] !== null) clearValues(obj[k]);
              }
            };
            clearValues(template);
          } else if (typeof firstItem === 'string') {
            template = '';
          } else if (typeof firstItem === 'number') {
            template = 0;
          }
        }
        
        // Check schema for specific array config (reordering, etc.)
        const fieldPath = currentPath.join('.').replace(/\.\d+\./g, '[].').replace(/^\w+\./, '');
        const arrayConfig = currentFile ? getArrayConfig(currentFile.name, fieldPath) : null;
        const canReorder = arrayConfig?.canReorder || false;
        
        return (
          <div key={key} className="mb-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">{displayName}</h4>
            <ArrayManager
              items={value}
              itemName={displayName.replace(/s$/, '')}
              onAdd={() => addArrayItem(currentPath, template)}
              onRemove={(index) => removeArrayItem(currentPath, index)}
              onReorder={canReorder ? (index, direction) => reorderArrayItem(currentPath, index, direction) : undefined}
              canAdd={true}
              canRemove={true}
              canReorder={canReorder}
              renderItem={(item, index) => (
                typeof item === 'object' && !Array.isArray(item) ? (
                  <div>{renderObject(item, [...currentPath, index.toString()])}</div>
                ) : (
                  <div>{renderField(key, item, [...currentPath, index.toString()])}</div>
                )
              )}
            />
          </div>
        );
      }

      if (typeof value === 'object' && value !== null) {
        const sectionKey = `${currentPath.join('-')}-obj`;
        const isCollapsed = collapsedSections[sectionKey];
        
        // Check if this is an optional field that can be removed
        const schema = currentFile ? getSchemaForFile(currentFile.name) : null;
        const isOptionalField = schema?.optionalFields && key in schema.optionalFields && path.length === 2;

        // Special handling for "dialogue" objects
        const isDialogueObject = key.toLowerCase() === 'dialogue';

        return (
          <div key={key} className="mb-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-2"
              >
                <ChevronRight 
                  size={16} 
                  className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                />
                <span className="font-semibold">{displayName}</span>
              </button>
              <div className="flex gap-2">
                {isDialogueObject && !isCollapsed && (
                  <button
                    onClick={() => {
                      setGuardianSelectorPath(currentPath);
                      setShowGuardianSelector(true);
                    }}
                    className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white mb-2"
                    title="Add Guardian Dialogue"
                  >
                    + Add Guardian
                  </button>
                )}
                {isOptionalField && (
                  <button
                    onClick={() => {
                      if (activeFileIndex === null) return;
                      const newFiles = [...openFiles];
                      const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
                      let current = newData;
                      for (let i = 0; i < path.length; i++) {
                        current = current[path[i]];
                      }
                      delete current[key];
                      newFiles[activeFileIndex].data = newData;
                      newFiles[activeFileIndex].isDirty = true;
                      setOpenFiles(newFiles);
                    }}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded mb-2"
                    title={`Remove ${displayName}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            {!isCollapsed && (
              <div className="pl-4 border-l-2 border-gray-700">
                {isDialogueObject ? renderDialogueObject(value, currentPath) : renderObject(value, currentPath)}
              </div>
            )}
          </div>
        );
      }

      return renderField(displayName, value, currentPath, obj);
    }).filter(Boolean) as JSX.Element[];

    // Check for optional fields that are missing
    // Show at the ROOT level of each item AND within nested objects (like required_stats)
    if (currentFile) {
      const schema = getSchemaForFile(currentFile.name);
      if (schema?.optionalFields) {
        // Build current path string for matching (e.g., "required_stats")
        const currentPathStr = path.length > 2 ? path.slice(2).join('.') : '';
        
        Object.entries(schema.optionalFields).forEach(([fieldName, template]) => {
          // Check for root-level optional fields (no dot in fieldName)
          if (path.length === 2 && !fieldName.includes('.')) {
            if (!(fieldName in obj)) {
              renderedFields.push(
                <OptionalField
                  key={`optional-${fieldName}`}
                  fieldName={fieldName}
                  displayName={formatFieldName(fieldName)}
                  onAdd={() => addOptionalField(path, fieldName, template)}
                />
              );
            }
          }
          // Check for nested optional fields (e.g., "required_stats.secondary")
          else if (fieldName.includes('.')) {
            const [parentField, childField] = fieldName.split('.');
            // If we're inside the parent object and child field is missing
            if (currentPathStr === parentField && !(childField in obj)) {
              renderedFields.push(
                <OptionalField
                  key={`optional-${fieldName}`}
                  fieldName={childField}
                  displayName={formatFieldName(childField)}
                  onAdd={() => addOptionalField(path, childField, template)}
                />
              );
            }
          }
        });
      }
    }

    return renderedFields;
  };

  // Get unique item types for filtering (only for items.json)
  const itemTypes = currentFile?.name === 'items.json' && mainArray
    ? Array.from(new Set(mainArray.map((item: any) => item.type).filter(Boolean))).sort()
    : [];

  const filteredArray = mainArray ? mainArray.filter((item: any) => {
    // Apply search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      const title = (item.name || item.title || item.id || '').toLowerCase();
      if (!title.includes(searchLower)) return false;
    }
    
    // Apply type filter (only for items.json)
    if (typeFilter && currentFile?.name === 'items.json') {
      if (item.type !== typeFilter) return false;
    }
    
    return true;
  }).sort((a: any, b: any) => {
    // Sort based on mode
    if (currentFile?.name === 'missions.json' && sortMode !== 'alpha') {
      // Difficulty-based sorting
      const aDiff = a.difficulty || 0;
      const bDiff = b.difficulty || 0;
      
      if (sortMode === 'difficulty-asc') {
        return aDiff - bDiff; // Easy to Hard (1-10)
      } else if (sortMode === 'difficulty-desc') {
        return bDiff - aDiff; // Hard to Easy (10-1)
      }
    }
    
    // Default: Alphabetically sort by name, title, or id
    const aName = (a.name || a.title || a.id || '').toLowerCase();
    const bName = (b.name || b.title || b.id || '').toLowerCase();
    return aName.localeCompare(bName);
  }) : null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileJson className="text-blue-400" size={28} />
            <h1 className="text-xl font-bold text-white">FellowDivers JSON Editor</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                try {
                  await refreshCache();
                  alert('Dropdowns refreshed! New images and items are now available.');
                } catch (error) {
                  alert('Failed to refresh cache. Check console for details.');
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 hover:text-white transition-colors"
              title="Refresh dropdown options (use after adding new images or items)"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {currentFile && (
              <div className="text-sm text-gray-400">
                {currentFile.saveStatus === 'saving' && '💾 Saving...'}
                {currentFile.saveStatus === 'saved' && '✓ All changes saved'}
                {currentFile.saveStatus === 'error' && '⚠ Save failed'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Tabs */}
      {openFiles.length > 0 && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 flex gap-1 overflow-x-auto flex-shrink-0">
          {openFiles.map((file, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 px-4 py-2 rounded-t transition-colors cursor-pointer ${
                activeFileIndex === index
                  ? 'bg-gray-900 text-white border-t border-l border-r border-gray-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <span 
                className="text-sm whitespace-nowrap" 
                onClick={() => setActiveFileIndex(index)}
              >
                {file.name}
              </span>
              {file.isDirty && <span className="text-yellow-400">●</span>}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(index, e);
                }} 
                className="hover:text-red-400 p-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowFilePicker(true)}
            className="flex items-center justify-center px-3 py-2 rounded-t bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition-colors"
            title="Open more files"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {openFiles.length === 0 ? (
          <div className="flex-1 p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <FileJson size={64} className="mx-auto text-gray-600 mb-4" />
                <h2 className="text-xl font-semibold text-gray-400 mb-2">
                  No Files Loaded
                </h2>
                <p className="text-gray-500">
                  Select a JSON file below to start editing
                </p>
              </div>
              <FileSelector availableFiles={availableFiles} onFileSelect={handleFileSelect} />
            </div>
          </div>
        ) : (
          <>
            {/* Sidebar */}
            {mainArray && (
              <div className="w-72 bg-gray-800 border-r border-gray-700 overflow-y-auto flex-shrink-0">
                <div className="p-3">
                  {/* Type Filter Buttons (items.json only) */}
                  {itemTypes.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1 mb-2">
                        <button
                          onClick={() => setTypeFilter('')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            typeFilter === ''
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          All
                        </button>
                        {itemTypes.map((type: string) => (
                          <button
                            key={type}
                            onClick={() => setTypeFilter(type)}
                            className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                              typeFilter === type
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Sort Buttons (missions.json only) */}
                  {currentFile?.name === 'missions.json' && (
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                        Sort By
                      </label>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setSortMode('alpha')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            sortMode === 'alpha'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          A-Z
                        </button>
                        <button
                          onClick={() => setSortMode('difficulty-asc')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            sortMode === 'difficulty-asc'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Easy → Hard
                        </button>
                        <button
                          onClick={() => setSortMode('difficulty-desc')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            sortMode === 'difficulty-desc'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Hard → Easy
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <div className="relative">
                      <Search size={16} className="absolute left-2 top-2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase">
                      Items ({filteredArray ? filteredArray.length : 0})
                    </h3>
                    <button
                      onClick={addNewItem}
                      className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white"
                    >
                      <Plus size={14} />
                      Add New
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    {filteredArray && filteredArray.map((item: any) => {
                      const originalIndex = mainArray.indexOf(item);
                      return (
                        <button
                          key={originalIndex}
                          onClick={() => {
                            const newFiles = [...openFiles];
                            newFiles[activeFileIndex!].activeTab = originalIndex;
                            setOpenFiles(newFiles);
                          }}
                          className={`w-full text-left px-3 py-2 rounded transition-colors ${
                            activeTab === originalIndex
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <div className="text-sm font-medium truncate">
                            {item.name || item.title || item.id || `Item ${originalIndex + 1}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-gray-800 rounded-lg p-4 max-w-4xl mx-auto">
                {currentItem ? (
                  <>
                    <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-700">
                      <h2 className="text-lg font-bold text-white">
                        {currentItem.name || currentItem.title || currentItem.id || 'Untitled'}
                      </h2>
                      <div className="flex gap-2">
                        <button
                          onClick={duplicateCurrentItem}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
                          title="Duplicate this item"
                        >
                          <Plus size={16} />
                          Duplicate
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm text-white"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                    {renderObject(currentItem, [getMainArrayKey(currentFile!.data) || '0', activeTab.toString()])}
                  </>
                ) : currentFile && !mainArray ? (
                  // Config-style file (no main array) - render entire data object
                  <>
                    <div className="mb-4 pb-3 border-b border-gray-700">
                      <h2 className="text-lg font-bold text-white">
                        {currentFile.name}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">Configuration File</p>
                    </div>
                    {renderObject(currentFile.data, [])}
                  </>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    {mainArray && mainArray.length === 0 ? (
                      <div>
                        <p className="mb-3">No items yet</p>
                        <button
                          onClick={addNewItem}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white mx-auto"
                        >
                          <Plus size={18} />
                          Add First Item
                        </button>
                      </div>
                    ) : (
                      'No data to display'
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-3">Delete Item?</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete "<strong>{currentItem?.name || currentItem?.title || currentItem?.id || 'this item'}</strong>"? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
              >
                Cancel
              </button>
              <button
                onClick={deleteCurrentItem}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Open Files</h3>
              <button
                onClick={() => setShowFilePicker(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <button
                onClick={() => {
                  handleOpenAll();
                  setShowFilePicker(false);
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white mb-3"
              >
                Open All Files
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableFiles.map((filename) => {
                const isOpen = openFiles.some(f => f.name === filename);
                return (
                  <button
                    key={filename}
                    onClick={() => {
                      handleFileSelect(filename);
                      setShowFilePicker(false);
                    }}
                    disabled={isOpen}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-colors text-left ${
                      isOpen
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                    }`}
                  >
                    <FileJson size={18} className={isOpen ? 'text-gray-600' : 'text-blue-400'} />
                    <span>{filename}</span>
                    {isOpen && <span className="ml-auto text-xs text-gray-500">Already open</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Guardian Selector Modal */}
      {showGuardianSelector && dropdownOptions?.guardians && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Select Guardian</h3>
              <button
                onClick={() => setShowGuardianSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Choose a guardian to add dialogue for:
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dropdownOptions.guardians.map((guardianId) => (
                <button
                  key={guardianId}
                  onClick={() => {
                    if (activeFileIndex === null) return;
                    const newFiles = [...openFiles];
                    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
                    let current = newData;
                    for (let i = 0; i < guardianSelectorPath.length; i++) {
                      current = current[guardianSelectorPath[i]];
                    }
                    
                    // Check if already exists
                    if (guardianId in current) {
                      alert(`Dialogue for ${guardianId} already exists!`);
                      return;
                    }
                    
                    // Add new guardian dialogue with template
                    current[guardianId] = {
                      initiate: '',
                      engage: '',
                      success: '',
                      fail: '',
                      downed: ''
                    };
                    
                    newFiles[activeFileIndex].data = newData;
                    newFiles[activeFileIndex].isDirty = true;
                    setOpenFiles(newFiles);
                    setShowGuardianSelector(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded transition-colors text-left bg-gray-700 hover:bg-gray-600 text-gray-100 capitalize"
                >
                  <span className="text-pink-400">●</span>
                  <span>{guardianId}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
