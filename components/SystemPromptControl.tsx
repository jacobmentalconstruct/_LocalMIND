import React, { useState, useEffect } from 'react';
import { SaveIcon, TrashIcon, PlusIcon, CopyIcon, PencilIcon, CheckIcon, XIcon } from './icons';

interface PromptPreset {
    id: string;
    name: string;
    content: string;
}

const DEFAULT_PROMPTS: PromptPreset[] = [
    { id: '1', name: 'Helpful Assistant', content: 'You are a helpful assistant.' },
    { id: '2', name: 'Code Expert', content: 'You are an expert programmer. Provide code snippets and technical explanations.' },
    { id: '3', name: 'Concise Oracle', content: 'Answer as concisely as possible. Do not offer extra explanation unless asked.' },
    { id: '4', name: 'Storyteller', content: 'You are a creative storyteller. Embellish your answers with narrative flair.' }
];

interface SystemPromptControlProps {
    currentPrompt: string;
    onPromptChange: (newPrompt: string) => void;
}

const SystemPromptControl: React.FC<SystemPromptControlProps> = ({ currentPrompt, onPromptChange }) => {
    const [presets, setPresets] = useState<PromptPreset[]>([]);
    const [selectedId, setSelectedId] = useState<string>('1');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameText, setRenameText] = useState('');

    // Load from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('system_prompts');
        if (saved) {
            setPresets(JSON.parse(saved));
        } else {
            setPresets(DEFAULT_PROMPTS);
        }
    }, []);

    // Save to LocalStorage whenever presets change
    useEffect(() => {
        if (presets.length > 0) {
            localStorage.setItem('system_prompts', JSON.stringify(presets));
        }
    }, [presets]);

    const handleLoadPreset = (id: string) => {
        setSelectedId(id);
        const preset = presets.find(p => p.id === id);
        if (preset) {
            onPromptChange(preset.content);
        }
    };

    const handleSave = () => {
        setPresets(prev => prev.map(p => 
            p.id === selectedId ? { ...p, content: currentPrompt } : p
        ));
    };

    const handleNew = () => {
        const newId = Date.now().toString();
        const newPreset = { id: newId, name: 'New Prompt', content: '' };
        setPresets(prev => [...prev, newPreset]);
        setSelectedId(newId);
        onPromptChange('');
        // Auto-start renaming for better UX
        setIsRenaming(true);
        setRenameText('New Prompt');
    };

    const handleDuplicate = () => {
        const current = presets.find(p => p.id === selectedId);
        if (current) {
            const newId = Date.now().toString();
            const newPreset = { 
                id: newId, 
                name: `${current.name} (Copy)`, 
                content: current.content 
            };
            setPresets(prev => [...prev, newPreset]);
            setSelectedId(newId);
            onPromptChange(current.content);
        }
    };

    const handleDelete = () => {
        if (presets.length <= 1) return; // Prevent deleting last one
        const newPresets = presets.filter(p => p.id !== selectedId);
        setPresets(newPresets);
        // Switch to the first available
        setSelectedId(newPresets[0].id);
        onPromptChange(newPresets[0].content);
    };

    const startRename = () => {
        const current = presets.find(p => p.id === selectedId);
        if (current) {
            setRenameText(current.name);
            setIsRenaming(true);
        }
    };

    const saveRename = () => {
        if (renameText.trim()) {
            setPresets(prev => prev.map(p => 
                p.id === selectedId ? { ...p, name: renameText } : p
            ));
            setIsRenaming(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between gap-2">
                {/* Left Side: Dropdown or Rename Input */}
                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <div className="flex items-center gap-1">
                            <input 
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                className="w-full text-xs bg-gray-900 border border-indigo-500 rounded px-1 py-1 text-white focus:outline-none"
                                autoFocus
                            />
                            <button onClick={saveRename} className="text-green-400 hover:text-green-300 p-1"><CheckIcon className="w-3 h-3"/></button>
                            <button onClick={() => setIsRenaming(false)} className="text-red-400 hover:text-red-300 p-1"><XIcon className="w-3 h-3"/></button>
                        </div>
                    ) : (
                        <select 
                            value={selectedId}
                            onChange={(e) => handleLoadPreset(e.target.value)}
                            className="w-full text-xs bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {presets.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Right Side: Action Buttons */}
                <div className="flex items-center gap-1">
                    {!isRenaming && (
                        <button onClick={startRename} title="Rename Preset" className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded transition-colors">
                            <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button onClick={handleSave} title="Save Changes to Current Preset" className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors">
                        <SaveIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleDuplicate} title="Duplicate Preset" className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors">
                        <CopyIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleNew} title="Create New Preset" className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                        <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleDelete} title="Delete Preset" className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors">
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <textarea 
                value={currentPrompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="w-full text-xs bg-gray-900/50 text-gray-300 p-2 rounded border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none h-16"
                placeholder="System prompt..."
            />
        </div>
    );
};

export default SystemPromptControl;