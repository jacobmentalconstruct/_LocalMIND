import React, { useRef, useEffect, useState, useMemo } from 'react';
import { XIcon, BotIcon, SparklesIcon, CheckIcon, TrashIcon } from './icons';

interface PromptInspectorProps {
  promptText: string;
  previewText: string | null;
  onPromptChange: (text: string) => void;
  onCommit: () => void;
  onDiscard: () => void;
  onReRun: () => void;
  onCancel: () => void;
  model: string;
  isBuilding: boolean;
  isInferring: boolean;
}

// Helper to parse the raw prompt into sections
const parseSections = (text: string) => {
  const regex = /(===\s*[A-Z0-9\s\-\(\)]+\s*===)/g;
  const parts = text.split(regex);
  const sections: { header: string; content: string }[] = [];
  
  // If no headers found, return as one generic block
  if (parts.length < 2) {
    return [{ header: 'RAW PROMPT', content: text }];
  }

  let currentHeader = 'PREAMBLE';
  
  parts.forEach((part) => {
    if (part.match(regex)) {
      currentHeader = part.replace(/===/g, '').trim();
    } else if (part.trim()) {
      sections.push({ header: currentHeader, content: part.trim() });
    }
  });

  return sections;
};

const PromptInspector: React.FC<PromptInspectorProps> = ({
  promptText,
  previewText,
  onPromptChange,
  onCommit,
  onDiscard,
  onReRun,
  onCancel,
  model,
  isBuilding,
  isInferring,
}) => {
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'raw'>('form');

  // Auto-scroll preview
  useEffect(() => {
    if (previewRef.current && previewText) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [previewText]);

  // Parse prompt into structured data
  const sections = useMemo(() => parseSections(promptText), [promptText]);

  // Handle editing a specific section
  const handleSectionChange = (index: number, newContent: string) => {
    // Reconstruct the full string
    const newSections = [...sections];
    newSections[index].content = newContent;
    
    // Stitch it back: Header + \n + Content + \n\n
    const reconstructed = newSections.map(s => {
        if (s.header === 'RAW PROMPT' || s.header === 'PREAMBLE') return s.content;
        return `=== ${s.header} ===\n${s.content}`;
    }).join('\n\n');

    onPromptChange(reconstructed);
  };

  const isBusy = isBuilding || isInferring;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-full overflow-hidden transition-all">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800 shrink-0">
        <div className="flex items-center gap-3">
            <h2 className={`text-xs font-bold flex items-center gap-2 uppercase tracking-wider ${isBusy ? 'text-amber-400' : 'text-gray-400'}`}>
            <BotIcon className={`w-4 h-4 ${isBusy ? 'animate-pulse' : ''}`} /> 
            {isBuilding ? 'Orchestrating...' : isInferring ? 'Inferring...' : 'Staging'}
            </h2>
            {/* View Toggles */}
            <div className="flex bg-gray-900 rounded p-0.5 border border-gray-700">
                <button 
                    onClick={() => setActiveTab('form')}
                    className={`px-2 py-0.5 text-[9px] rounded ${activeTab === 'form' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    FORM
                </button>
                <button 
                    onClick={() => setActiveTab('raw')}
                    className={`px-2 py-0.5 text-[9px] rounded ${activeTab === 'raw' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    RAW
                </button>
            </div>
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-white"><XIcon className="w-4 h-4" /></button>
      </div>

      {/* Split View Container */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* TOP: PROMPT INPUT (Structured or Raw) */}
        <div className={`relative flex-1 min-h-0 flex flex-col ${previewText ? 'h-1/2 border-b border-gray-700' : 'h-full'}`}>
            
            {activeTab === 'raw' ? (
                <textarea
                    value={promptText}
                    onChange={(e) => !isBusy && onPromptChange(e.target.value)}
                    className={`w-full h-full bg-[#1e1e1e] font-mono text-xs p-4 resize-none focus:outline-none transition-colors text-green-300`}
                    spellCheck={false}
                    readOnly={isBusy}
                />
            ) : (
                <div className="flex-1 overflow-y-auto p-2 space-y-3 bg-[#1e1e1e] scrollbar-thin scrollbar-thumb-gray-700">
                    {sections.map((section, idx) => (
                        <div key={idx} className="flex flex-col gap-1 group">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider group-focus-within:text-emerald-500 transition-colors px-1">
                                {section.header}
                            </label>
                            <textarea 
                                value={section.content}
                                onChange={(e) => !isBusy && handleSectionChange(idx, e.target.value)}
                                className={`w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-300 font-mono focus:border-emerald-500/50 focus:outline-none resize-none transition-all ${
                                    section.header.includes('MESSAGE') ? 'min-h-[80px] text-white bg-gray-800' : 'min-h-[60px]'
                                }`}
                                style={{
                                    height: 'auto', 
                                    minHeight: section.content.length > 200 ? '120px' : '60px' 
                                }}
                                readOnly={isBusy}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* BOTTOM: PREVIEW OUTPUT */}
        {(previewText || isInferring) && (
            <div className="flex-1 min-h-0 flex flex-col bg-gray-900/50 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-2 bg-gray-800/50 border-b border-gray-700/50 text-[10px] text-indigo-300 font-bold uppercase tracking-wider flex justify-between items-center shrink-0">
                    <span className="flex items-center gap-2">
                        <span>MODEL RESPONSE ({model})</span>
                    </span>
                    {isInferring && (
                        <span className="flex items-center gap-2 text-amber-400 animate-pulse bg-amber-900/20 px-2 py-0.5 rounded text-[9px]">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"/>
                            INFERRING...
                        </span>
                    )}
                </div>
                <textarea
                    ref={previewRef}
                    value={previewText || ''}
                    readOnly
                    className={`w-full h-full bg-[#151515] font-sans text-xs p-4 resize-none focus:outline-none leading-relaxed ${isInferring ? 'text-amber-500/50' : 'text-gray-300'}`}
                    placeholder="Waiting for model output..."
                />
            </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className={`p-3 border-t border-gray-700 bg-gray-800 flex gap-2 shrink-0 ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          onClick={onDiscard}
          className="px-3 py-2 rounded bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-900/40 flex items-center justify-center gap-2 text-xs font-bold transition-all"
          title="Discard Draft"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onReRun}
          className="flex-1 px-3 py-2 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 flex items-center justify-center gap-2 text-xs font-bold transition-all"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Re-Run
        </button>

        <button
        onClick={onCommit}
        className="flex-[2] px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs font-bold transition-all"
        >
        <CheckIcon className="w-3.5 h-3.5" />
        Commit
        </button>
      </div>
    </div>
  );
};

export default PromptInspector;