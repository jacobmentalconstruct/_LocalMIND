import React, { useState, useEffect } from 'react';
import { Project, TreeNode } from '../types';
import { getProjects, createProject, getKnowledgeTree, createNode, deleteNode } from '../services/ollamaService';
import { PlusIcon, TrashIcon, BookIcon, BotIcon, SquareIcon, UserIcon, SaveIcon } from './icons';

interface ProjectExplorerProps {
  onNodeSelect: (content: string) => void;
  onRunIsolated: (nodeId: string, content: string) => void;
}

const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ onNodeSelect, onRunIsolated }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  
  // UI State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, nodeId: string} | null>(null);
  
  // Creation Modal State (for Folders/Files)
  const [creationTarget, setCreationTarget] = useState<{parentId: string | null, type: 'folder' | 'file'} | null>(null);
  const [newNodeName, setNewNodeName] = useState('');

  // 1. Load Projects on Mount
  useEffect(() => {
    loadProjects();
  }, []);

  // 2. Load Tree when Project Changes
  useEffect(() => {
    if (selectedProjectId) {
      loadTree(selectedProjectId);
    } else {
      setNodes([]);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    const projs = await getProjects();
    setProjects(projs);
    // Auto-select first project if none selected
    if (projs.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projs[0].id);
    }
  };

  const loadTree = async (pid: string) => {
    const treeNodes = await getKnowledgeTree(pid);
    setNodes(treeNodes);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const newProj = await createProject(newProjectName);
    if (newProj) {
      setProjects(prev => [newProj, ...prev]);
      setSelectedProjectId(newProj.id);
      setIsCreatingProject(false);
      setNewProjectName('');
    }
  };

  const handleCreateNode = async () => {
    if (!creationTarget || !selectedProjectId || !newNodeName.trim()) return;
    
    await createNode(
      selectedProjectId, 
      creationTarget.parentId, 
      newNodeName, 
      creationTarget.type, 
      creationTarget.type === 'file' ? '(New Empty File)' : ''
    );
    
    await loadTree(selectedProjectId);
    setCreationTarget(null);
    setNewNodeName('');
  };

  const handleDeleteNode = async (id: string) => {
    if (confirm('Are you sure you want to delete this?')) {
      await deleteNode(id);
      loadTree(selectedProjectId);
    }
  };

  // Recursive Tree Renderer
  const renderTreeNodes = (parentId: string | null, depth = 0) => {
    const children = nodes.filter(n => n.parent_id === parentId);
    
    if (children.length === 0 && depth === 0 && !parentId) {
        return <div className="p-4 text-xs text-gray-500 italic text-center">Empty Project. Create a folder!</div>;
    }

    return children.map(node => (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center justify-between py-1 px-2 hover:bg-gray-800 cursor-pointer group text-xs ${node.type === 'folder' ? 'text-indigo-200 font-semibold' : 'text-gray-300'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}

          onClick={() => node.type === 'file' && onNodeSelect(node.content || '')}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const x = e.clientX;
            const y = e.clientY;
            setContextMenu({ x, y, nodeId: node.id });
            return false;
          }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {node.type === 'folder' ? 
              <SquareIcon className="w-3 h-3 flex-shrink-0 text-indigo-400"/> : 
              <BookIcon className="w-3 h-3 flex-shrink-0 text-emerald-500"/>
            }
            <span className="truncate">{node.name}</span>
          </div>
          
          {/* Quick Actions on Hover */}
          {node.type === 'folder' && (
             <button 
               className="opacity-0 group-hover:opacity-100 hover:text-white text-gray-500"
               onClick={(e) => {
                 e.stopPropagation();
                 setCreationTarget({ parentId: node.id, type: 'file' });
               }}
               title="New File inside"
             >
                <PlusIcon className="w-3 h-3"/>
             </button>
          )}
        </div>
        
        {node.type === 'folder' && renderTreeNodes(node.id, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700 font-sans text-gray-300" onClick={() => setContextMenu(null)}>
      
      {/* 1. Project Selector Header */}
      <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex flex-col gap-2">
        <div className="flex items-center justify-between">
           <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Workspace</span>
           <button 
             onClick={() => setIsCreatingProject(!isCreatingProject)}
             className="text-gray-500 hover:text-emerald-400"
             title="New Project"
           >
             <PlusIcon className="w-3.5 h-3.5" />
           </button>
        </div>
        
        {isCreatingProject ? (
          <div className="flex gap-1 animate-in fade-in slide-in-from-top-1">
             <input 
               autoFocus
               className="flex-1 bg-gray-900 border border-gray-600 rounded text-xs px-2 py-1 outline-none focus:border-emerald-500"
               placeholder="Project Name..."
               value={newProjectName}
               onChange={e => setNewProjectName(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
             />
             <button onClick={handleCreateProject}><SaveIcon className="w-4 h-4 text-emerald-500"/></button>
          </div>
        ) : (
          <select 
            className="w-full bg-gray-900 border border-gray-700 rounded text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.length === 0 && <option value="">No Projects</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* 2. Root Actions */}
      <div className="flex items-center gap-1 p-2 bg-gray-900 border-b border-gray-800 text-[10px]">
         <button 
           disabled={!selectedProjectId}
           onClick={() => setCreationTarget({ parentId: null, type: 'folder' })}
           className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
         >
           <PlusIcon className="w-3 h-3"/> Folder
         </button>
         <button 
           disabled={!selectedProjectId}
           onClick={() => setCreationTarget({ parentId: null, type: 'file' })}
           className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
         >
           <PlusIcon className="w-3 h-3"/> File
         </button>
      </div>

      {/* 3. Tree View */}
      <div className="flex-1 overflow-y-auto py-2">
         {selectedProjectId ? renderTreeNodes(null) : (
            <div className="p-4 text-center text-xs text-gray-600">Select or create a project to begin.</div>
         )}
      </div>
      
      {/* 4. Creation Modal (Inline) */}
      {creationTarget && (
         <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-600 rounded p-4 w-64 shadow-2xl">
               <div className="text-xs font-bold uppercase text-gray-400 mb-2">
                 New {creationTarget.type}
               </div>
               <input 
                 autoFocus
                 className="w-full bg-gray-900 border border-gray-600 rounded text-sm px-2 py-1 mb-3 outline-none focus:border-emerald-500"
                 placeholder="Name..."
                 value={newNodeName}
                 onChange={e => setNewNodeName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleCreateNode()}
               />
               <div className="flex justify-end gap-2">
                  <button onClick={() => setCreationTarget(null)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={handleCreateNode} className="text-xs bg-emerald-600 px-3 py-1 rounded text-white hover:bg-emerald-500">Create</button>
               </div>
            </div>
         </div>
      )}

      {/* 5. Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-gray-800 border border-gray-600 rounded shadow-xl py-1 z-50 w-48 animate-in fade-in zoom-in-95 duration-75"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button 
            className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-600 text-gray-200 flex items-center gap-2"
            onClick={() => {
                const node = nodes.find(n => n.id === contextMenu.nodeId);
                if(node && node.type === 'file' && node.content) {
                  onRunIsolated(node.id, node.content);
                  setContextMenu(null);
                }
            }}
          >
            <BotIcon className="w-3 h-3" /> Run Isolation
          </button>
          
          <button 
            className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/50 text-red-400 flex items-center gap-2 border-t border-gray-700"
            onClick={() => {
              handleDeleteNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            <TrashIcon className="w-3 h-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectExplorer;