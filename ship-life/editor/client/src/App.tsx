import { useState, useCallback, useEffect } from 'react';
import { FileJson, X, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useApi } from './hooks/useApi';
import { FileSelector } from './components/FileSelector';
import { getMainArray, getMainArrayKey, formatFieldName, isTextAreaField, getDropdownOptionsForField } from './utils/fieldHelpers';
import type { OpenFile, DropdownOptions } from './types';

export default function App() {
  const { dropdownOptions, availableFiles, loadFile, saveFile } = useApi();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const addNewItem = () => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const currentData = newFiles[activeFileIndex].data;
    const arrayKey = getMainArrayKey(currentData);
    
    if (!arrayKey) return;
    
    const array = currentData[arrayKey];
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
    newData[arrayKey].push(template);
    newFiles[activeFileIndex].data = newData;
    newFiles[activeFileIndex].activeTab = newData[arrayKey].length - 1;
    setOpenFiles(newFiles);
  };

  const deleteCurrentItem = () => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const currentData = newFiles[activeFileIndex].data;
    const arrayKey = getMainArrayKey(currentData);
    
    if (!arrayKey) return;
    
    const array = currentData[arrayKey];
    const currentTab = newFiles[activeFileIndex].activeTab;
    
    if (array.length === 0 || currentTab >= array.length) return;
    
    const newData = JSON.parse(JSON.stringify(currentData));
    newData[arrayKey].splice(currentTab, 1);
    newFiles[activeFileIndex].data = newData;
    
    if (currentTab >= newData[arrayKey].length && newData[arrayKey].length > 0) {
      newFiles[activeFileIndex].activeTab = newData[arrayKey].length - 1;
    } else if (newData[arrayKey].length === 0) {
      newFiles[activeFileIndex].activeTab = 0;
    }
    
    setOpenFiles(newFiles);
    setShowDeleteModal(false);
  };

  const renderField = (label: string, value: any, path: string[]): JSX.Element | null => {
    if (value === null || value === undefined) return null;

    const fieldId = path.join('-');
    const fieldOptions = getDropdownOptionsForField(path[path.length - 1], dropdownOptions);
    
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
      return (
        <div key={fieldId} className="mb-3">
          <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1">
            {label}
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
      if (fieldOptions && fieldOptions.length > 0) {
        return (
          <div key={fieldId} className="mb-3">
            <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1">
              {label}
            </label>
            <select
              id={fieldId}
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select...</option>
              {fieldOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      }

      const isTextArea = isTextAreaField(label);
      return (
        <div key={fieldId} className="mb-3">
          <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1">
            {label}
          </label>
          {isTextArea ? (
            <textarea
              id={fieldId}
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500 resize-y"
            />
          ) : (
            <input
              id={fieldId}
              type="text"
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500"
            />
          )}
        </div>
      );
    }

    return null;
  };

  const renderObject = (obj: any, path: string[] = []): JSX.Element[] => {
    return Object.entries(obj).map(([key, value]) => {
      if (key === '_documentation' || key === '_note') return null;

      const currentPath = [...path, key];
      const displayName = formatFieldName(key);

      if (Array.isArray(value)) {
        const sectionKey = `${currentPath.join('-')}-array`;
        const isCollapsed = collapsedSections[sectionKey];

        return (
          <div key={key} className="mb-4">
            <button
              onClick={() => setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-2"
            >
              <ChevronRight 
                size={16} 
                className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              />
              <span className="font-semibold">{displayName} ({value.length})</span>
            </button>
            {!isCollapsed && (
              <div className="pl-4 space-y-2">
                {value.map((item, index) => (
                  <div key={index} className="p-2 bg-gray-800 rounded border border-gray-700">
                    {typeof item === 'object' && !Array.isArray(item) ? (
                      renderObject(item, [...currentPath, index.toString()])
                    ) : (
                      renderField(key, item, [...currentPath, index.toString()])
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      if (typeof value === 'object' && value !== null) {
        const sectionKey = `${currentPath.join('-')}-obj`;
        const isCollapsed = collapsedSections[sectionKey];

        return (
          <div key={key} className="mb-4">
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
            {!isCollapsed && (
              <div className="pl-4 border-l-2 border-gray-700">
                {renderObject(value, currentPath)}
              </div>
            )}
          </div>
        );
      }

      return renderField(displayName, value, currentPath);
    }).filter(Boolean) as JSX.Element[];
  };

  const filteredArray = mainArray ? mainArray.filter((item: any) => {
    if (!searchFilter) return true;
    const searchLower = searchFilter.toLowerCase();
    const title = (item.name || item.title || item.id || '').toLowerCase();
    return title.includes(searchLower);
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
          {currentFile && (
            <div className="text-sm text-gray-400">
              {currentFile.saveStatus === 'saving' && '💾 Saving...'}
              {currentFile.saveStatus === 'saved' && '✓ All changes saved'}
              {currentFile.saveStatus === 'error' && '⚠ Save failed'}
            </div>
          )}
        </div>
      </div>

      {/* File Tabs */}
      {openFiles.length > 0 && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 flex gap-1 overflow-x-auto flex-shrink-0">
          {openFiles.map((file, index) => (
            <button
              key={index}
              onClick={() => setActiveFileIndex(index)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t transition-colors ${
                activeFileIndex === index
                  ? 'bg-gray-900 text-white border-t border-l border-r border-gray-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <span className="text-sm whitespace-nowrap">{file.name}</span>
              {file.isDirty && <span className="text-yellow-400">●</span>}
              <button onClick={(e) => closeFile(index, e)} className="hover:text-red-400">
                <X size={14} />
              </button>
            </button>
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
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm text-white"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                    {renderObject(currentItem, [getMainArrayKey(currentFile!.data)!, activeTab.toString()])}
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
    </div>
  );
}
