import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, MemoryItem, OllamaStatus } from './types';
import {
  checkStatus,
  sendChat,
  getModels,
  getHistory,
  getSummarizerStatus,
  updateMemory,
  addMemory,
  buildPrompt,
  inferWithPrompt,
  getUserProfile,
  resetSQLite,
  resetChroma,
  analyzeSnippet,
} from './services/ollamaService';

// Components
import ProjectExplorer from './components/ProjectExplorer';
import SnippetHelperModal from './components/SnippetHelperModal';
import SessionInfoPanel from './components/SessionInfoPanel';
import SuggestionsPanel from './components/SuggestionsPanel';
import RefineryModal from './components/RefineryModal';
import ChatPanel from './components/ChatPanel';
import MessageInput from './components/MessageInput';
import SystemPromptControl from './components/SystemPromptControl';
import PromptInspector from './components/PromptInspector';
import UserPanel from './components/UserPanel';
import { BrainCircuitIcon } from './components/icons';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('llama3');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');

  const [activeSummarizer, setActiveSummarizer] = useState('');
  const [availableSummarizers, setAvailableSummarizers] = useState<string[]>([]);
  const [missingSummarizers, setMissingSummarizers] = useState<string[]>([]);

  const [proposedFacts, setProposedFacts] = useState<MemoryItem[]>([]);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);

  // Inspector State
  const [showInspector, setShowInspector] = useState(true);
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [inspectedPrompt, setInspectedPrompt] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState('');
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userName, setUserName] = useState('User');
  const [userDescription, setUserDescription] = useState('Core operator of this LocalMIND workspace.');

  // Snippet / Isolation Modal State
  const [isSnippetOpen, setIsSnippetOpen] = useState(false);
  const [snippetContent, setSnippetContent] = useState('');
  const [snippetResult, setSnippetResult] = useState<string | null>(null);
  const [isSnippetLoading, setIsSnippetLoading] = useState(false);

  // Column widths
  const [leftColumnWidth, setLeftColumnWidth] = useState(260);
  const [rightColumnWidth, setRightColumnWidth] = useState(280);

  // Drag state
  const dragStateRef = useRef<{
    activeHandle: 'left' | 'right' | null;
    startX: number;
    startLeft: number;
    startRight: number;
  } | null>(null);

  const handleGlobalMouseMove = (event: MouseEvent) => {
    const state = dragStateRef.current;
    if (!state || !state.activeHandle) return;

    const delta = event.clientX - state.startX;

    if (state.activeHandle === 'left') {
      const next = Math.min(Math.max(state.startLeft + delta, 200), 500);
      setLeftColumnWidth(next);
    } else if (state.activeHandle === 'right') {
      const next = Math.min(Math.max(state.startRight - delta, 220), 520);
      setRightColumnWidth(next);
    }
  };

  const handleGlobalMouseUp = () => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
    }
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  };

  const beginColumnDrag =
    (handle: 'left' | 'right') =>
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragStateRef.current = {
        activeHandle: handle,
        startX: event.clientX,
        startLeft: leftColumnWidth,
        startRight: rightColumnWidth,
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    };

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkOllamaStatus = useCallback(async () => {
    setOllamaStatus('checking');
    const isOnline = await checkStatus();
    setOllamaStatus(isOnline ? 'online' : 'offline');
  }, []);

  // Fetch models and summarizers on mount
  useEffect(() => {
    getModels().then((models) => {
      if (models.length > 0) {
        setAvailableModels(models);
        setModel(models[0]);
      }
    });

    getSummarizerStatus().then((status) => {
      setAvailableSummarizers(status.available);
      setMissingSummarizers(status.missing);
      if (status.available.length > 0) {
        setActiveSummarizer(status.available[0]);
      }
    });
  }, []);

  useEffect(() => {
    checkOllamaStatus();

    getHistory().then((history) => {
      if (history.length > 0) setMessages(history as any);
    });

    getUserProfile().then((profile) => {
      if (profile) {
        setUserProfile(profile);
        if (profile.display_name) setUserName(profile.display_name);
        if (profile.description) setUserDescription(profile.description);
      }
    });
  }, [checkOllamaStatus]);

  const handleSendMessage = async (input: string) => {
    if (!input.trim() || isLoading || isBuildingPrompt) return;

    if (!showInspector) {
      await runInference(input, null);
      return;
    }

    setIsBuildingPrompt(true);
    setPendingUserMessage(input);

    const skeleton = `=== SYSTEM ===
  ${systemPrompt}

  === IDENTITY ===
  User: ${userName}
  Description: ${userDescription}
Workspace: LocalMIND
  
  === PREVIOUS SESSION CONTEXT ===
  (Querying Session Manager...)
  
  === LONG-TERM MEMORY (RAG) ===
  (Querying Knowledge Graph...)

  === RECENT HISTORY ===
  (Fetching SQLite Logs...)

  === CURRENT MESSAGE ===
  User: ${input}

  Assistant:`;
    setInspectedPrompt(skeleton);

    const buildTimeout = window.setTimeout(() => {
      setIsBuildingPrompt(false);
      setInspectedPrompt((prev) =>
        prev +
        '\n\n# WARNING: Prompt build timed out. You can retry or run without the Inspector.'
      );
    }, 60000);

    try {
      const data: any = await buildPrompt(model, input, systemPrompt, true, userName, userDescription);
      if (data && data.final_prompt) {
        setInspectedPrompt(data.final_prompt);
      }
    } catch (err) {
      console.error('Error building prompt:', err);
      setInspectedPrompt((prev) =>
        prev + '\n\n# ERROR: Failed to build prompt. Please try again.'
      );
    } finally {
      window.clearTimeout(buildTimeout);
      setIsBuildingPrompt(false);
    }
  };

  const handleWipeSQLite = async () => {
    if (confirm('Delete all chat history?')) {
      await resetSQLite();
      setMessages([]);
    }
  };

  const handleWipeVector = async () => {
    if (confirm('Delete all long-term memories?')) {
      await resetChroma();
    }
  };

  const runInference = async (originalInput: string, overriddenPrompt: string | null) => {
    setIsLoading(true);
    setProposedFacts([]);

    if (!messages.find((m) => m.content === originalInput)) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: originalInput,
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    abortControllerRef.current = new AbortController();
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

    try {
      let data;
      if (overriddenPrompt) {
        data = await inferWithPrompt(overriddenPrompt, model, originalInput, activeSummarizer);
      } else {
        data = await sendChat(model, originalInput, systemPrompt, true, activeSummarizer);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: data.response } : msg,
        ),
      );

      if (data.new_memory) {
        setProposedFacts((prev) => [...prev, data.new_memory]);
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: 'Error during inference.' } : msg,
        ),
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleRefinerySave = async (content: string, id?: string) => {
    if (id && !id.startsWith('temp_')) {
      await handleUpdateMemory(id, content);
    } else {
      await addMemory(content);
      if (id) setProposedFacts((prev) => prev.filter((p) => p.id !== id));
    }
    setEditingMemory(null);
  };

  const handleSaveToMemory = (content: string) => {
    setEditingMemory({ id: 'temp_from_chat', content });
  };

  const handleUpdateMemory = async (id: string, newContent: string) => {
    await updateMemory(id, newContent);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  // Handlers for the Project Explorer
  const handleNodeSelect = (content: string) => {
    if(confirm("Load this file content into your message input?")) {
        setInspectedPrompt(prev => prev + `\n\n[CONTEXT FROM FILE]:\n${content}`);
        setShowInspector(true);
    }
  };

  const handleRunIsolated = (nodeId: string, content: string) => {
    setSnippetContent(content);
    setSnippetResult(null);
    setIsSnippetOpen(true);
  };

  const handleAnalyzeSnippet = async (sys: string, user: string) => {
     setIsSnippetLoading(true);
     try {
        const res = await analyzeSnippet(snippetContent, `${sys}\n\nUser Question: ${user}`, model);
        if(res && res.result) {
            setSnippetResult(res.result);
        }
     } catch(e) {
        setSnippetResult("Error running analysis.");
     } finally {
        setIsSnippetLoading(false);
     }
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 font-sans p-2 overflow-hidden select-none">
      <div
        className="grid gap-2 h-full min-h-0"
        style={{ gridTemplateColumns: `${leftColumnWidth}px 1fr ${rightColumnWidth}px` }}
      >
        {/* --- LEFT COLUMN: SESSION + TREE + SUGGESTIONS --- */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col relative">
          
          <SessionInfoPanel 
            activeSummarizer={activeSummarizer}
            availableSummarizers={availableSummarizers}
            onSummarizerChange={setActiveSummarizer}
            onWipeSQLite={handleWipeSQLite}
            onWipeVector={handleWipeVector}
          />

          <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
            <ProjectExplorer 
              onNodeSelect={handleNodeSelect}
              onRunIsolated={handleRunIsolated}
            />
          </div>

          <SuggestionsPanel 
            proposedItems={proposedFacts}
            onEdit={(item) => setEditingMemory(item)}
          />
          
          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-gray-800/70 hover:bg-indigo-500 transition-colors"
            onMouseDown={beginColumnDrag('left')}
          />
        </div>

        {/* --- CENTER COLUMN: SYSTEM + CHAT --- */}
        <div className="flex flex-col gap-2 min-w-0 min-h-0">
          <div className="h-[120px] bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex flex-col gap-2 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <BrainCircuitIcon className="w-4 h-4" />
                System Instruction
              </span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-2 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded focus:outline-none text-gray-300 max-w-[150px] truncate"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-h-0">
              <SystemPromptControl currentPrompt={systemPrompt} onPromptChange={setSystemPrompt} />
            </div>
          </div>

          <div className="flex-1 bg-gray-800/30 border border-gray-700 rounded-lg flex flex-col overflow-hidden relative min-h-0">
            <div className="flex-1 overflow-y-auto relative min-h-0">
              <ChatPanel 
                 messages={messages} 
                 onSaveToMemory={handleSaveToMemory} 
                 onAskAboutSelection={(text) => handleRunIsolated("selection", text)} 
              />
            </div>
            <div className="p-3 border-t border-gray-700 bg-gray-800/80">
              <MessageInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading || isBuildingPrompt}
                onStop={handleStopGeneration}
                onClearChat={handleClearChat}
              />
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: USER PROFILE + INSPECTOR --- */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col relative">
          <div className="min-h-[120px] shrink-0 border-b border-gray-800">
            <UserPanel
              name={userName}
              description={userDescription}
              onSave={(n, d) => {
                setUserName(n);
                setUserDescription(d);
              }}
            />
          </div>
          <div className="flex-1 min-h-0">
            <PromptInspector
              promptText={inspectedPrompt}
              onPromptChange={setInspectedPrompt}
              onCancel={() => setShowInspector(false)}
              onRun={() => runInference(pendingUserMessage, inspectedPrompt)}
              model={model}
              isBuilding={isBuildingPrompt}
            />
          </div>
          <div
            className="absolute top-0 left-0 h-full w-1 cursor-col-resize bg-gray-800/70 hover:bg-indigo-500 transition-colors"
            onMouseDown={beginColumnDrag('right')}
          />
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {editingMemory && (
        <RefineryModal
          initialContent={editingMemory.content}
          memoryId={editingMemory.id.startsWith('temp_') ? undefined : editingMemory.id}
          model={model}
          onClose={() => setEditingMemory(null)}
          onSave={handleRefinerySave}
        />
      )}

      <SnippetHelperModal
        isOpen={isSnippetOpen}
        snippet={snippetContent}
        model={model}
        isLoading={isSnippetLoading}
        result={snippetResult}
        onClose={() => setIsSnippetOpen(false)}
        onRun={handleAnalyzeSnippet}
      />
      
    </div>
  );
};

export default App;