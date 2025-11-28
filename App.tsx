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
  createNode,
  deleteNode,
} from './services/ollamaService';

// Components
import ProjectExplorer from './components/ProjectExplorer';
import SnippetHelperModal from './components/SnippetHelperModal';
import FileSaveModal from './components/FileSaveModal';
import SessionInfoPanel from './components/SessionInfoPanel';
import NodeInspectorPanel from './components/NodeInspectorPanel'; // [NEW]
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

  // Inspector & Staging State
  const [showInspector, setShowInspector] = useState(true);
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [inspectedPrompt, setInspectedPrompt] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState('');
  const [previewResponse, setPreviewResponse] = useState<string | null>(null);
  
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userName, setUserName] = useState('User');
  const [userDescription, setUserDescription] = useState('Core operator of this LocalMIND workspace.');

  // Project & Tree State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeNode, setActiveNode] = useState<{id: string, name: string, content: string} | null>(null);
  const [treeRefreshTrigger, setTreeRefreshTrigger] = useState(0);

  // Snippet / Isolation Modal State
  const [isSnippetOpen, setIsSnippetOpen] = useState(false);
  const [snippetContent, setSnippetContent] = useState('');
  const [isFileSaveOpen, setIsFileSaveOpen] = useState(false);
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

    setPreviewResponse(null);
    setPendingUserMessage(input);

    if (!showInspector) {
      await runInference(input, null, true);
      return;
    }

    setIsBuildingPrompt(true);
    setInspectedPrompt("Building orchestration context...");

    const buildTimeout = window.setTimeout(() => {
      setIsBuildingPrompt(false);
      setInspectedPrompt((prev) => prev + '\n\n# WARNING: Prompt build timed out.');
    }, 60000);

    try {
      const data: any = await buildPrompt(model, input, systemPrompt, true, userName, userDescription);
      
      if (data && data.final_prompt) {
        setInspectedPrompt(data.final_prompt);
        await runInference(input, data.final_prompt, false); 
      }
    } catch (err) {
      console.error('Error building prompt:', err);
      setInspectedPrompt((prev) => prev + '\n\n# ERROR: Failed to build prompt.');
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

  const runInference = async (originalInput: string, promptToRun: string | null, autoCommit: boolean) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    let assistantMessageId = '';

    try {
      if (autoCommit) {
        setProposedFacts([]);
        if (!messages.find((m) => m.content === originalInput)) {
          const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: originalInput };
          setMessages((prev) => [...prev, userMessage]);
        }
        assistantMessageId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);
      }

      let data;
      if (promptToRun) {
        data = await inferWithPrompt(promptToRun, model, originalInput, activeSummarizer);
      } else {
        data = await sendChat(model, originalInput, systemPrompt, true, activeSummarizer);
      }

      if (autoCommit) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: data.response } : msg,
          ),
        );
        if (data.new_memory) {
          setProposedFacts((prev) => [...prev, data.new_memory]);
        }
      } else {
        setPreviewResponse(data.response);
      }

    } catch (error) {
      if (autoCommit && assistantMessageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: 'Error during inference.' } : msg,
          ),
        );
      } else {
        setPreviewResponse('Error during inference: ' + error);
      }
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

  const handleSaveFile = () => {
    if (previewResponse) {
        setIsFileSaveOpen(true);
    }
  };
  
  const handleFileSaveSubmit = async (projectId: string, parentId: string | null, filename: string, content: string) => {
    await createNode(projectId, parentId, filename, 'file', content);
    setIsFileSaveOpen(false);
    setTreeRefreshTrigger(prev => prev + 1); // FORCE REFRESH
  };
  
  const handleSaveToMemory = (content: string) => {
    setEditingMemory({ id: 'temp_from_chat', content });
  };

  const handleUpdateMemory = async (id: string, newContent: string) => {
    await updateMemory(id, newContent);
  };

  const handleCommit = async () => {
    if (!previewResponse || !pendingUserMessage) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: pendingUserMessage };
    setMessages((prev) => [...prev, userMessage]);

    const botMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: previewResponse };
    setMessages((prev) => [...prev, botMessage]);

    setPreviewResponse(null);
    setPendingUserMessage('');
  };

  const handleDiscard = () => {
    setPreviewResponse(null);
    setPendingUserMessage('');
    setInspectedPrompt('');
  };

  const handleReRun = () => {
    if(inspectedPrompt && pendingUserMessage) {
        runInference(pendingUserMessage, inspectedPrompt, false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  // Node Handlers
  const handleNodeClick = (node: { id: string, name: string, content: string }) => {
    setActiveNode(node);
  };

  const handleNodeDoubleClick = (content: string) => {
    if(confirm("Load this file content into your message input?")) {
        setInspectedPrompt(prev => prev + `\n\n[CONTEXT FROM FILE]:\n${content}`);
        setShowInspector(true);
    }
  };

  const handleDeleteNode = async (id: string) => {
    if(confirm("Delete this file?")) {
        await deleteNode(id);
        setActiveNode(null);
        setTreeRefreshTrigger(prev => prev + 1);
    }
  }

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
        {/* --- LEFT COLUMN: SESSION + TREE + INSPECTOR --- */}
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
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onRunIsolated={handleRunIsolated}
              refreshTrigger={treeRefreshTrigger}
            />
          </div>

          <NodeInspectorPanel 
            selectedNode={activeNode}
            onRunIsolation={(id, content) => handleRunIsolated(id, content)}
            onDelete={handleDeleteNode}
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
              previewText={previewResponse}
              onPromptChange={setInspectedPrompt}
              onCommit={handleCommit}
              onDiscard={handleDiscard}
              onReRun={handleReRun}
              onCancel={() => setShowInspector(false)}
              model={model}
              isBuilding={isBuildingPrompt}
              isInferring={isLoading}
              onSaveFile={handleSaveFile}
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
      
      {isFileSaveOpen && previewResponse && (
      <FileSaveModal 
      initialContent={previewResponse}
      onSave={handleFileSaveSubmit}
      onClose={() => setIsFileSaveOpen(false)}
      />
      )}
      
    </div>
  );
};

export default App;