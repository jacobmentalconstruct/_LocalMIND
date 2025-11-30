import React, { useState } from 'react';
import { SaveIcon, XIcon, PencilIcon } from './icons';

interface FileEditorModalProps {
  node: { id: string; name: string; type: string; content?: string };
  onSave: (id: string, name: string, content: string) => void;
  onClose: () => void;
}

const FileEditorModal: React.FC<FileEditorModalProps> = ({ node, onSave, onClose }) => {
  const [name, setName] = useState(node.name);
  const [content, setContent] = useState(node.content || '');

  const handleSave = () => {
    onSave(node.id, name, content);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
            <PencilIcon className="w-4 h-4" /> Edit {node.type}
          </h3>
          <button onClick={onClose}><XIcon className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold">Name</label>
            <input 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white focus:border-emerald-500 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
          </div>

          {node.type === 'file' && (
             <div className="flex-1 flex flex-col min-h-[300px]">
                <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold">Content</label>
                <textarea 
                    className="flex-1 w-full bg-gray-900 border border-gray-700 rounded p-3 text-xs font-mono text-gray-300 focus:border-emerald-500 outline-none resize-none leading-relaxed"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 text-xs font-bold flex items-center gap-2 shadow-lg">
                <SaveIcon className="w-4 h-4" />
                Save Changes
            </button>
        </div>
      </div>
    </div>
  );
};

export default FileEditorModal;