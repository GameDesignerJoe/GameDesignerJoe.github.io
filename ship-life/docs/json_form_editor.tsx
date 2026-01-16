import React, { useState } from 'react';
import { Upload, Download, Plus, Trash2, FileJson, ChevronUp, ChevronDown, Copy, Check, ChevronRight, Search, X } from 'lucide-react';

export default function JSONEditor() {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Hardcoded options based on your data files
  const OPTIONS = {
    guardians: ['stella', 'vawn', 'tiberius', 'maestra'],
    conversationTypes: ['important', 'background'],
    playerCharReq: ['any', 'stella', 'vawn', 'tiberius', 'maestra']
  };

  const handleFileLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const newFile = {
          name: file.name,
          data: data,
          activeTab: 0
        };
        setOpenFiles(prev => [...prev, newFile]);
        setActiveFileIndex(openFiles.length);
        setCollapsedSections({});
        setSearchFilter('');
      } catch (error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const closeFile = (index, e) => {
    e.stopPropagation();
    const newFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newFiles);
    
    if (activeFileIndex === index) {
      setActiveFileIndex(newFiles.length > 0 ? Math.max(0, index - 1) : null);
    } else if (activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const handleCopy = async () => {
    if (activeFileIndex === null) return;
    const jsonString = JSON.stringify(openFiles[activeFileIndex].data, null, 2);
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  const handleExport = () => {
    if (activeFileIndex === null) return;
    const file = openFiles[activeFileIndex];
    const jsonString = JSON.stringify(file.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'edited.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    openFiles.forEach(file => {
      const jsonString = JSON.stringify(file.data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || 'edited.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const updateValue = (path, value) => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    
    newFiles[activeFileIndex].data = newData;
    setOpenFiles(newFiles);
  };

  const addArrayItem = (path, template) => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    current.push(template);
    newFiles[activeFileIndex].data = newData;
    setOpenFiles(newFiles);
  };

  const removeArrayItem = (path, index) => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    current.splice(index, 1);
    newFiles[activeFileIndex].data = newData;
    setOpenFiles(newFiles);
  };

  const moveArrayItem = (path, index, direction) => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const newData = JSON.parse(JSON.stringify(newFiles[activeFileIndex].data));
    let current = newData;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= current.length) return;
    
    [current[index], current[newIndex]] = [current[newIndex], current[index]];
    newFiles[activeFileIndex].data = newData;
    setOpenFiles(newFiles);
  };

  const setItemActiveTab = (tabIndex) => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    newFiles[activeFileIndex].activeTab = tabIndex;
    setOpenFiles(newFiles);
  };

  const addNewItem = () => {
    if (activeFileIndex === null) return;
    const newFiles = [...openFiles];
    const currentData = newFiles[activeFileIndex].data;
    const arrayKey = Object.keys(currentData).find(k => Array.isArray(currentData[k]) && k !== '_documentation');
    
    if (!arrayKey) return;
    
    const array = currentData[arrayKey];
    let template;
    
    if (array.length > 0) {
      // Copy structure from first item and clear values
      template = JSON.parse(JSON.stringify(array[0]));
      const clearValues = (obj) => {
        for (let key in obj) {
          if (typeof obj[key] === 'string') obj[key] = '';
          else if (typeof obj[key] === 'number') obj[key] = 0;
          else if (typeof obj[key] === 'boolean') obj[key] = false;
          else if (Array.isArray(obj[key])) obj[key] = [];
          else if (typeof obj[key] === 'object' && obj[key] !== null) clearValues(obj[key]);
        }
      };
      clearValues(template);
    } else {
      // Create minimal template based on common structure
      template = {
        id: '',
        name: '',
        description: ''
      };
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
    const arrayKey = Object.keys(currentData).find(k => Array.isArray(currentData[k]) && k !== '_documentation');
    
    if (!arrayKey) return;
    
    const array = currentData[arrayKey];
    const currentTab = newFiles[activeFileIndex].activeTab;
    
    if (array.length === 0 || currentTab >= array.length) return;
    
    const newData = JSON.parse(JSON.stringify(currentData));
    newData[arrayKey].splice(currentTab, 1);
    newFiles[activeFileIndex].data = newData;
    
    // Adjust active tab if needed
    if (currentTab >= newData[arrayKey].length && newData[arrayKey].length > 0) {
      newFiles[activeFileIndex].activeTab = newData[arrayKey].length - 1;
    } else if (newData[arrayKey].length === 0) {
      newFiles[activeFileIndex].activeTab = 0;
    }
    
    setOpenFiles(newFiles);
    setShowDeleteModal(false);
  };

  const toggleSection = (sectionKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const renderField = (label, value, path, options = null) => {
    if (value === null || value === undefined) return null;

    const fieldId = path.join('-');
    const isTextArea = label.toLowerCase().includes('text') || label.toLowerCase().includes('description');
    
    if (typeof value === 'boolean') {
      return (
        <div className="mb-3">
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
        <div className="mb-3">
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
      if (options && options.length > 0) {
        return (
          <div className="mb-3">
            <label htmlFor={fieldId} className="block text-sm text-gray-400 mb-1">
              {label}
            </label>
            <select
              id={fieldId}
              value={value}
              onChange={(e) => updateValue(path, e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      }

      return (
        <div className="mb-3">
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

  const renderObject = (obj, path = [], depth = 0) => {
    return Object.entries(obj).map(([key, value]) => {
      if (key === '_documentation' || key === '_note') return null;

      const currentPath = [...path, key];
      const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      if (Array.isArray(value)) {
        if (key === 'lines' && value.length > 0 && value[0].actor && value[0].text) {
          const linesSectionKey = `${currentPath.join('-')}-lines`;
          const isLinesCollapsed = collapsedSections[linesSectionKey];

          return (
            <div key={key} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => toggleSection(linesSectionKey)}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                >
                  <ChevronRight 
                    size={16} 
                    className={`transform transition-transform ${isLinesCollapsed ? '' : 'rotate-90'}`}
                  />
                  <span className="font-semibold">Dialogue Lines ({value.length})</span>
                </button>
                {!isLinesCollapsed && (
                  <button
                    onClick={() => addArrayItem(currentPath, { actor: "", text: "" })}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                  >
                    <Plus size={14} />
                    Add Line
                  </button>
                )}
              </div>
              {!isLinesCollapsed && (
                <div className="space-y-1.5 pl-4">
                  {value.map((line, index) => (
                    <div key={index} className="flex items-start gap-2 bg-gray-800 rounded p-2 border border-gray-700">
                      <div className="flex flex-col gap-0.5 mt-1">
                        <button
                          onClick={() => moveArrayItem(currentPath, index, 'up')}
                          disabled={index === 0}
                          className={`${index === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveArrayItem(currentPath, index, 'down')}
                          disabled={index === value.length - 1}
                          className={`${index === value.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <div className="flex-1 grid grid-cols-[120px_1fr] gap-2 items-start">
                        <select
                          value={line.actor}
                          onChange={(e) => updateValue([...currentPath, index, 'actor'], e.target.value)}
                          className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select...</option>
                          {OPTIONS.guardians.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <textarea
                          value={line.text}
                          onChange={(e) => updateValue([...currentPath, index, 'text'], e.target.value)}
                          placeholder="Dialogue text..."
                          rows={1}
                          className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500 resize-y"
                        />
                      </div>
                      <button
                        onClick={() => removeArrayItem(currentPath, index)}
                        className="text-red-400 hover:text-red-300 mt-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        if (key === 'participants') {
          return (
            <div key={key} className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">Participants</label>
              <div className="grid grid-cols-2 gap-2">
                {value.map((participant, index) => (
                  <select
                    key={index}
                    value={participant}
                    onChange={(e) => updateValue([...currentPath, index], e.target.value)}
                    className="px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    {OPTIONS.guardians.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          );
        }

        const arraySectionKey = `${currentPath.join('-')}-array`;
        const isArrayCollapsed = collapsedSections[arraySectionKey];

        return (
          <div key={key} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => toggleSection(arraySectionKey)}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                <ChevronRight 
                  size={16} 
                  className={`transform transition-transform ${isArrayCollapsed ? '' : 'rotate-90'}`}
                />
                <span className="font-semibold">{displayName} ({value.length})</span>
              </button>
              {!isArrayCollapsed && (
                <button
                  onClick={() => {
                    const template = value[0] ? JSON.parse(JSON.stringify(value[0])) : {};
                    addArrayItem(currentPath, template);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                >
                  <Plus size={14} />
                  Add
                </button>
              )}
            </div>
            {!isArrayCollapsed && (
              <div className="space-y-2 pl-4">
                {value.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-800 rounded border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-gray-400">
                        #{index + 1}
                      </span>
                      <button
                        onClick={() => removeArrayItem(currentPath, index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {typeof item === 'object' && !Array.isArray(item) ? (
                      renderObject(item, [...currentPath, index], depth + 1)
                    ) : (
                      renderField(key, item, [...currentPath, index])
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      if (typeof value === 'object' && value !== null) {
        const objSectionKey = `${currentPath.join('-')}-obj`;
        const isObjCollapsed = collapsedSections[objSectionKey];

        return (
          <div key={key} className="mb-4">
            <button
              onClick={() => toggleSection(objSectionKey)}
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-2"
            >
              <ChevronRight 
                size={16} 
                className={`transform transition-transform ${isObjCollapsed ? '' : 'rotate-90'}`}
              />
              <span className="font-semibold">{displayName}</span>
            </button>
            {!isObjCollapsed && (
              <div className="pl-4 border-l-2 border-gray-700">
                {renderObject(value, currentPath, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      let fieldOptions = null;
      if (key === 'type') fieldOptions = OPTIONS.conversationTypes;
      if (key === 'player_char_req') fieldOptions = OPTIONS.playerCharReq;

      return renderField(displayName, value, currentPath, fieldOptions);
    });
  };

  const getMainArray = (data) => {
    if (!data) return null;
    
    const arrayKeys = Object.keys(data).filter(key => 
      Array.isArray(data[key]) && key !== '_documentation'
    );
    
    return arrayKeys.length > 0 ? data[arrayKeys[0]] : null;
  };

  const currentFile = activeFileIndex !== null ? openFiles[activeFileIndex] : null;
  const mainArray = currentFile ? getMainArray(currentFile.data) : null;
  const activeTab = currentFile ? currentFile.activeTab : 0;
  const currentItem = mainArray && activeTab < mainArray.length ? mainArray[activeTab] : null;

  const filteredArray = mainArray ? mainArray.filter((item) => {
    if (!searchFilter) return true;
    
    const searchLower = searchFilter.toLowerCase();
    const title = (item.name || item.title || item.id || '').toLowerCase();
    const participants = item.participants ? item.participants.join(' ').toLowerCase() : '';
    
    return title.includes(searchLower) || participants.includes(searchLower);
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
          
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer text-white text-sm">
              <Upload size={18} />
              Load JSON
              <input
                type="file"
                accept=".json"
                onChange={handleFileLoad}
                className="hidden"
              />
            </label>
            
            {openFiles.length > 0 && (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
                >
                  <Download size={18} />
                  Export Current
                </button>
                {openFiles.length > 1 && (
                  <button
                    onClick={handleExportAll}
                    className="flex items-center gap-2 px-3 py-2 bg-green-700 hover:bg-green-800 rounded text-white text-sm"
                  >
                    <Download size={18} />
                    Export All
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* File Tabs */}
      {openFiles.length > 0 && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 flex gap-1 overflow-x-auto flex-shrink-0">
          {openFiles.map((file, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveFileIndex(index);
                setSearchFilter('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-t transition-colors ${
                activeFileIndex === index
                  ? 'bg-gray-900 text-white border-t border-l border-r border-gray-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <span className="text-sm whitespace-nowrap">{file.name}</span>
              <button
                onClick={(e) => closeFile(index, e)}
                className="hover:text-red-400"
              >
                <X size={14} />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {openFiles.length === 0 ? (
          <div className="flex-1 text-center py-20">
            <FileJson size={64} className="mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">
              No Files Loaded
            </h2>
            <p className="text-gray-500">
              Click "Load JSON" to open your first file
            </p>
          </div>
        ) : (
          <>
            {/* Sidebar for array items */}
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
                    {filteredArray && filteredArray.map((item) => {
                      const originalIndex = mainArray.indexOf(item);
                      return (
                        <button
                          key={originalIndex}
                          onClick={() => setItemActiveTab(originalIndex)}
                          className={`w-full text-left px-3 py-2 rounded transition-colors ${
                            activeTab === originalIndex
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <div className="text-sm font-medium truncate">
                            {item.name || item.title || item.id || `Item ${originalIndex + 1}`}
                          </div>
                          {item.participants && (
                            <div className="text-xs opacity-75 truncate mt-0.5">
                              {item.participants.join(', ')}
                            </div>
                          )}
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
                    {renderObject(currentItem, [Object.keys(currentFile.data).find(k => Array.isArray(currentFile.data[k])), activeTab])}
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
    </div>
  );
}