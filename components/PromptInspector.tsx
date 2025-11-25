import React, { useState, useRef } from 'react';
import { SendIcon, XIcon, BotIcon } from './icons';
import { analyzeSnippet } from '../services/ollamaService';

interface PromptInspectorProps {
    promptText: string;
    onPromptChange: (text: string) => void;
    onRun: () => void;
    onCancel: () => void;
    model: string;
}

const PromptInspector: React.FC<PromptInspectorProps> = ({ promptText, onPromptChange, onRun, onCancel, model }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [snippetResult, setSnippetResult] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [snippetInstruction, setSnippetInstruction] = useState("Summarize this selection");

    const handleAnalyzeSelection = async () => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const selectedText = promptText.substring(start, end);

        if (!selectedText.trim()) return;

        setIsAnalyzing(true);
        try {
            const data = await analyzeSnippet(selectedText, snippetInstruction, model);
            setSnippetResult(data.result);
        } catch (e) {
            setSnippetResult("Error analyzing snippet.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-[500px] flex-shrink-0">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <BotIcon className="w-5 h-5 text-green-400"/> Prompt Inspector
                </h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-white"><XIcon className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 relative">
                <textarea 
                    ref={textareaRef}
                    value={promptText}
                    onChange={(e) => onPromptChange(e.target.value)}
                    className="w-full h-full bg-[#1e1e1e] text-green-300 font-mono text-xs p-4 resize-none focus:outline-none"
                    spellCheck={false}
                />
                
                {/* Floating Snippet Tool */}
                <div className="absolute bottom-4 right-4 bg-gray-800 p-2 rounded shadow-lg border border-gray-600 flex flex-col gap-2 w-64 opacity-90 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Snippet Utility</span>
                    <input 
                        value={snippetInstruction} 
                        onChange={e => setSnippetInstruction(e.target.value)}
                        className="bg-gray-900 text-xs p-1 rounded border border-gray-700 text-white" 
                        placeholder="Instruction..."
                    />
                    <button 
                        onClick={handleAnalyzeSelection} 
                        disabled={isAnalyzing}
                        className="bg-indigo-600 text-white text-xs py-1 rounded hover:bg-indigo-500 disabled:opacity-50"
                    >
                        {isAnalyzing ? "Thinking..." : "Analyze Selection"}
                    </button>
                </div>
            </div>

            {/* Snippet Result Popup Overlay */}
            {snippetResult && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-600 shadow-xl">
                        <h3 className="font-bold text-indigo-400 mb-2">Analysis Result</h3>
                        <div className="bg-gray-900 p-4 rounded text-sm text-gray-200 max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {snippetResult}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setSnippetResult(null)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 border-t border-gray-700 bg-gray-800 flex gap-4">
                <button onClick={onCancel} className="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">Cancel</button>
                <button onClick={onRun} className="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 font-bold">
                    <SendIcon className="w-4 h-4"/> Run Prompt
                </button>
            </div>
        </div>
    );
};

export default PromptInspector;

