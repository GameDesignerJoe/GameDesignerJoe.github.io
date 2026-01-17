import { PlusCircle } from 'lucide-react';

interface OptionalFieldProps {
  fieldName: string;
  displayName: string;
  onAdd: () => void;
}

export function OptionalField({ fieldName, displayName, onAdd }: OptionalFieldProps) {
  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-3 py-2 mb-3 bg-green-600 hover:bg-green-700 rounded text-white transition-colors w-full"
      title={`Add ${displayName} field`}
    >
      <PlusCircle size={16} />
      <span className="text-sm font-medium">Add {displayName}</span>
    </button>
  );
}
