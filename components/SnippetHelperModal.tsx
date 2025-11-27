import React, { useState, useEffect } from 'react';
import { BotIcon } from './icons';

interface SnippetHelperModalProps {
  isOpen: boolean;
  snippet: string;
  model: string;
  isLoading: boolean;
  result: string | null;
  onClose: () => void;
  onRun: (systemPrompt: string, userPrompt: string) => void;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a careful analysis assistant. You are given a snippet of text and a user question. Answer ONLY using information from the snippet. If the snippet is insufficient, say so.';

const SnippetHelperModal: React.FC<SnippetHelperModalProps> = ({
  isOpen,
  snippet,
  model,
  isLoading,
  result,
  onClose,
  onRun,
}) => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState('');

  useEffect(() => {
    // Reset question when a new snippet is opened
    setUserPrompt('');
  }, [snippet, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;
    onRun(systemPrompt, userPrompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between bg-gray-900/90">
          <div className="flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Ask in Isolation
              </span>
              <span className="text-[10px] text-gray-500">
                Model: <span className="font-mono">{model}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded hover:bg-gray-800 text-gray-400 hover:text-gray-100"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Snippet preview */}
          <div className="p-3 border-b border-gray-800 bg-gray-900/60">
            <div className="text-[10px] uppercase text-gray-500 mb-1 tracking-wide">
              Selected Snippet
            </div>
            <div className="max-h-24 overflow-y-auto text-[11px] text-gray-300 bg-gray-800/60 border border-gray-700 rounded p-2 whitespace-pre-wrap">
              {snippet || <span className="italic text-gray-500">(No selection)</span>}
            </div>
          </div>

          {/* System prompt + question */}
          <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto">
            <div>
              <label className="block text-[10px] uppercase text-gray-500 mb-1 tracking-wide">
                System Instruction
              </label>
              <textarea
                className="w-full h-20 text-[11px] bg-gray-800 border border-gray-700 rounded p-2 text-gray-200 resize-none"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-gray-500 mb-1 tracking-wide">
                Your question
              </label>
              <input
                className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200"
                placeholder="What do you want to know about this snippet?"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between mt-1">
              <button
                type="submit"
                disabled={isLoading || !userPrompt.trim()}
                className="px-3 py-1.5 text-[11px] rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-semibold flex items-center gap-2"
              >
                {isLoading ? 'Analyzing…' : 'Run analysis'}
              </button>
              <span className="text-[10px] text-gray-500">
                Runs a one-off call with no chat history or saved memory.
              </span>
            </div>
          </div>

          {/* Result */}
          <div className="border-t border-gray-800 bg-gray-900/80 p-3">
            <div className="text-[10px] uppercase text-gray-500 mb-1 tracking-wide">
              Result
            </div>
            <div className="max-h-32 overflow-y-auto text-[11px] text-gray-200 bg-gray-800/60 border border-gray-700 rounded p-2 whitespace-pre-wrap">
              {isLoading && !result && <span className="italic text-gray-500">Waiting for response…</span>}
              {!isLoading && !result && (
                <span className="italic text-gray-600">No result yet. Run an analysis to see the answer.</span>
              )}
              {result && <span>{result}</span>}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SnippetHelperModal;
