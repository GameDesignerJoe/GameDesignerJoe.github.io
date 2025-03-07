import React, { useState } from 'react';
import { ContentTypeBase, EnemyContentType, defaultEnemyContent } from '../../types/ContentTypes';
import './ContentTypePanel.css';

interface ContentTypePanelProps {
  onContentTypeChange: (contentTypes: ContentTypeBase[]) => void;
}

export const ContentTypePanel: React.FC<ContentTypePanelProps> = ({ onContentTypeChange }) => {
  const [contentTypes, setContentTypes] = useState<ContentTypeBase[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<ContentTypeBase | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for enemy content type
  const [formData, setFormData] = useState<EnemyContentType>(defaultEnemyContent);

  const handleAddEnemy = () => {
    setFormData({
      ...defaultEnemyContent,
      id: `enemy-${Date.now()}` // Generate unique ID
    });
    setIsEditing(true);
    setSelectedContentType(null);
  };

  const handleEditContentType = (contentType: ContentTypeBase) => {
    setFormData(contentType as EnemyContentType);
    setSelectedContentType(contentType);
    setIsEditing(true);
  };

  const handleDeleteContentType = (contentType: ContentTypeBase) => {
    const newContentTypes = contentTypes.filter(ct => ct.id !== contentType.id);
    setContentTypes(newContentTypes);
    onContentTypeChange(newContentTypes);
    setSelectedContentType(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newContentTypes = selectedContentType
      ? contentTypes.map(ct => ct.id === selectedContentType.id ? formData : ct)
      : [...contentTypes, formData];

    setContentTypes(newContentTypes);
    onContentTypeChange(newContentTypes);
    setIsEditing(false);
    setSelectedContentType(null);
  };

  const handleFormCancel = () => {
    setIsEditing(false);
    setSelectedContentType(null);
    setFormData(defaultEnemyContent);
  };

  return (
    <div className="content-type-panel">
      <div className="content-type-header">
        <h2>Content Types</h2>
        <button onClick={handleAddEnemy}>Add Enemy</button>
      </div>

      {/* Content Type List */}
      <div className="content-type-list">
        {contentTypes.map(contentType => (
          <div 
            key={contentType.id} 
            className={`content-type-item ${selectedContentType?.id === contentType.id ? 'selected' : ''}`}
          >
            <div className="content-type-info">
              <div 
                className="content-type-color" 
                style={{ backgroundColor: contentType.color }}
              />
              <span>{contentType.name}</span>
            </div>
            <div className="content-type-actions">
              <button onClick={() => handleEditContentType(contentType)}>Edit</button>
              <button onClick={() => handleDeleteContentType(contentType)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Enemy Form */}
      {isEditing && (
        <form className="enemy-form" onSubmit={handleFormSubmit}>
          <h3>{selectedContentType ? 'Edit Enemy' : 'New Enemy'}</h3>
          
          <label>
            Name:
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>

          <label>
            Description:
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </label>

          <label>
            Color:
            <input
              type="color"
              value={formData.color}
              onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
            />
          </label>

          <label>
            Shape:
            <select
              value={formData.shape}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                shape: e.target.value as EnemyContentType['shape']
              }))}
            >
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="hexagon">Hexagon</option>
            </select>
          </label>

          <label>
            Size (meters):
            <input
              type="number"
              min="1"
              max="100"
              value={formData.size}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                size: parseInt(e.target.value) 
              }))}
              required
            />
          </label>

          <label>
            Quantity:
            <input
              type="number"
              min="1"
              max="1000"
              value={formData.quantity}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                quantity: parseInt(e.target.value) 
              }))}
              required
            />
          </label>

          <label>
            Minimum Spacing (meters):
            <input
              type="number"
              min="0"
              max="1000"
              value={formData.minSpacing}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                minSpacing: parseInt(e.target.value) 
              }))}
              required
            />
          </label>

          <label>
            Enemy Count:
            <input
              type="number"
              min="1"
              max="20"
              value={formData.enemyCount}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                enemyCount: parseInt(e.target.value) 
              }))}
              required
            />
          </label>

          <label>
            Difficulty (1-10):
            <input
              type="number"
              min="1"
              max="10"
              value={formData.difficulty}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                difficulty: parseInt(e.target.value) 
              }))}
              required
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={formData.canOverlap}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                canOverlap: e.target.checked 
              }))}
            />
            Can Overlap
          </label>

          <div className="form-actions">
            <button type="submit">
              {selectedContentType ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={handleFormCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
