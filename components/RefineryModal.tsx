import React, { useState } from 'react';
import { SparklesIcon, SaveIcon, XIcon } from './icons';
import { analyzeSnippet } from '../services/ollamaService';

interface RefineryModalProps {
    initialContent: string;
    memoryId?: string; 
    onSave: (content: string, id?: string) => void;
    onClose: () => void;
    model: string;
}

const RefineryModal: React.FC<RefineryModalProps> = ({ initialContent, memoryId, onSave, onClose, model }) => {
    const [content, setContent] = useState(initialContent);
    const [isPolishing, setIsPolishing] = useState(false);

    const handlePolish = async () => {
        setIsPolishing(true);
        try {
            const result = await analyzeSnippet(
                content, 
                "Rewrite this text to be a concise, standalone fact. Remove conversational filler (e.g. 'User said'). Ensure clarity and brevity.", 
                model
            );
            if (result && result.result) {
                setContent(result.result.trim());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsPolishing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                        {memoryId ? "Refine Knowledge" : "Curate New Fact"}
                    </h3>
                    <button onClick={onClose}><XIcon className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 flex flex-col gap-4 bg-[#1e1e1e]">
                    <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded text-xs text-blue-200">
                        <strong>Curator Mode:</strong> Edit this fact to ensure the Long-Term Memory (RAG) stays clean. 
                        This text will be embedded for future retrieval.
                    </div>
                    <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full flex-1 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 font-mono text-sm focus:border-emerald-500 focus:outline-none resize-none min-h-[200px] shadow-inner"
                    />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-between items-center">
                    <button 
                        onClick={handlePolish}
                        disabled={isPolishing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-300 rounded hover:bg-indigo-600/40 border border-indigo-500/30 transition-all text-sm"
                    >
                        <SparklesIcon className={`w-4 h-4 ${isPolishing ? 'animate-spin' : ''}`} />
                        {isPolishing ? "Polishing..." : "AI Cleanup"}
                    </button>

                    <button 
                        onClick={() => onSave(content, memoryId)}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 font-bold shadow-lg hover:shadow-emerald-500/20 transition-all"
                    >
                        <SaveIcon className="w-4 h-4" />
                        {memoryId ? "Update Database" : "Commit to Memory"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefineryModal;