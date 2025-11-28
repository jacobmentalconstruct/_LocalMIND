import React from 'react';
import { BotIcon, TrashIcon, BookIcon } from './icons';

interface NodeInspectorPanelProps {
  selectedNode: { id: string; name: string; content: string } | null;
  onRunIsolation: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = ({ selectedNode, onRunIsolation, onDelete }) => {
  if (!selectedNode) {
    return (
      <div className="shrink-0 h-[20%] min-h-[120px] border-t border-gray-700 bg-gray-900 flex flex-col items-center justify-center text-xs text-gray-600 italic">
        <BookIcon className="w-6 h-6 mb-2 opacity-20" />
        <span>Select a file to inspect</span>
      </div>
    );
  }

  return (
    <div className="shrink-0 h-[20%] min-h-[120px] border-t border-gray-700 bg-gray-800/20 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between bg-gray-800">
        <span className="text-xs font-bold text-gray-300 truncate max-w-[150px] flex items-center gap-2">
            <BookIcon className="w-3.5 h-3.5 text-emerald-500" />
            {selectedNode.name}
        </span>
        <div className="flex gap-1">
          <button 
            onClick={() => onRunIsolation(selectedNode.id, selectedNode.content)} 
            className="p-1 text-indigo-400 hover:bg-gray-700 rounded transition-colors" 
            title="Ask in Isolation"
          >
            <BotIcon className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onDelete(selectedNode.id)} 
            className="p-1 text-red-400 hover:bg-gray-700 rounded transition-colors" 
            title="Delete File"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
        <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">
            {selectedNode.content.substring(0, 1000)}
            {selectedNode.content.length > 1000 && '... (truncated)'}
        </pre>
      </div>
    </div>
  );
};

export default NodeInspectorPanel;