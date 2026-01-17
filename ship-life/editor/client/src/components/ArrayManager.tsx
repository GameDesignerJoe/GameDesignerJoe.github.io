import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';

interface ArrayManagerProps {
  items: any[];
  itemName: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onReorder?: (index: number, direction: 'up' | 'down') => void;
  canAdd?: boolean;
  canRemove?: boolean;
  canReorder?: boolean;
  renderItem: (item: any, index: number) => React.ReactNode;
}

export function ArrayManager({
  items,
  itemName,
  onAdd,
  onRemove,
  onReorder,
  canAdd = true,
  canRemove = true,
  canReorder = false,
  renderItem
}: ArrayManagerProps) {
  
  const handleRemove = (index: number) => {
    onRemove(index);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div 
          key={index} 
          className="relative bg-gray-800 rounded border border-gray-700 p-3"
        >
          {/* Header with controls */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
            <span className="text-sm font-medium text-gray-400">
              {itemName} #{index + 1}
            </span>
            <div className="flex items-center gap-1">
              {/* Reorder buttons */}
              {canReorder && onReorder && (
                <>
                  <button
                    onClick={() => onReorder(index, 'up')}
                    disabled={index === 0}
                    className={`p-1 rounded ${
                      index === 0
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                    title="Move up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => onReorder(index, 'down')}
                    disabled={index === items.length - 1}
                    className={`p-1 rounded ${
                      index === items.length - 1
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                    title="Move down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}
              {/* Remove button */}
              {canRemove && (
                <button
                  onClick={() => handleRemove(index)}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          
          {/* Item content */}
          <div>
            {renderItem(item, index)}
          </div>
        </div>
      ))}
      
      {/* Add button */}
      {canAdd && (
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add {itemName}
        </button>
      )}
      
      {items.length === 0 && (
        <div className="text-center text-gray-500 text-sm py-4">
          No {itemName}s yet. Click "Add {itemName}" to create one.
        </div>
      )}
    </div>
  );
}
