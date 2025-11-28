import React, { useState, useEffect } from 'react';
import { Project, TreeNode } from '../types';
import { getProjects, getKnowledgeTree } from '../services/ollamaService';
import { SaveIcon, XIcon, SquareIcon, BookIcon } from './icons';

interface FileSaveModalProps {
  initialContent: string;
  onSave: (projectId: string, parentId: string | null, filename: string, content: string) => void;
  onClose: () => void;
}

const FileSaveModal: React.FC<FileSaveModalProps> = ({ initialContent, onSave, onClose }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [folders, setFolders] = useState<TreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root'); // 'root' or UUID
  const [filename, setFilename] = useState('new_memory.txt');
  const [content, setContent] = useState(initialContent);

  // Load Projects on Open
  useEffect(() => {
    getProjects().then(projs => {
      setProjects(projs);
      if (projs.length > 0) setSelectedProjectId(projs[0].id);
    });
  }, []);

  // Load Folders when Project Changes
  useEffect(() => {
    if (selectedProjectId) {
      getKnowledgeTree(selectedProjectId).then(nodes => {
        // Filter only folders for the destination picker
        setFolders(nodes.filter(n => n.type === 'folder'));
      });
    } else {
      setFolders([]);
    }
  }, [selectedProjectId]);

  const handleSave = () => {
    if (!selectedProjectId || !filename.trim()) return;
    const parentId = selectedFolderId === 'root' ? null : selectedFolderId;
    
    // Optional: Prepend Metadata
    const metadataHeader = `---
Source: LocalMIND Staging
Date: ${new Date().toISOString()}
---

`;
    const finalContent = metadataHeader + content;
    
    onSave(selectedProjectId, parentId, filename, finalContent);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
            <BookIcon className="w-4 h-4" /> Save to Project
          </h3>
          <button onClick={onClose}><XIcon className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          
          {/* Location Picker */}
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold">Workspace</label>
                <select 
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white focus:border-emerald-500 outline-none"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold">Folder</label>
                <select 
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white focus:border-emerald-500 outline-none"
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                >
                    <option value="root">/ (Root)</option>
                    {folders.map(f => <option key={f.id} value={f.id}>/ {f.name}</option>)}
                </select>
            </div>
          </div>

          {/* Filename */}
          <div>
            <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold">Filename</label>
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded px-2">
                <SquareIcon className="w-4 h-4 text-gray-500" />
                <input 
                    className="flex-1 bg-transparent p-2 text-xs text-white outline-none"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="example.txt"
                />
            </div>
          </div>

          {/* Content Preview */}
          <div className="flex-1 min-h-[150px] flex flex-col">
            <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold">Content Preview</label>
            <textarea 
                className="flex-1 w-full bg-gray-900 border border-gray-700 rounded p-3 text-xs font-mono text-gray-300 focus:border-emerald-500 outline-none resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button 
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 text-xs font-bold flex items-center gap-2 shadow-lg"
            >
                <SaveIcon className="w-4 h-4" />
                Save File
            </button>
        </div>

      </div>
    </div>
  );
};

export default FileSaveModal;