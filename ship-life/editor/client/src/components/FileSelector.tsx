import React from 'react';
import { FileJson } from 'lucide-react';

interface FileSelectorProps {
  availableFiles: string[];
  onFileSelect: (filename: string) => void;
}

export function FileSelector({ availableFiles, onFileSelect }: FileSelectorProps) {
  const handleOpenAll = () => {
    availableFiles.forEach(filename => onFileSelect(filename));
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase">
          Available Data Files
        </h3>
        <button
          onClick={handleOpenAll}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white font-medium"
        >
          Open All
        </button>
      </div>
      <div className="space-y-2">
        {availableFiles.map((filename) => (
          <button
            key={filename}
            onClick={() => onFileSelect(filename)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-left"
          >
            <FileJson size={20} className="text-blue-400" />
            <span className="text-gray-100">{filename}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
