import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, MemoryItem, OllamaStatus } from './types';
import { checkStatus, sendChat, getModels, getHistory, getMemories, getSummarizerStatus, updateMemory, addMemory, buildPrompt, inferWithPrompt } from './services/ollamaService';
import MemoryPanel from './components/MemoryPanel';
import RefineryModal from './components/RefineryModal';
import ChatPanel from './components/ChatPanel';
import MessageInput from './components/MessageInput';
import SystemPromptControl from './components/SystemPromptControl';
import PromptInspector from './components/PromptInspector';
import { BrainCircuitIcon, CircleDotIcon, PowerIcon, PowerOffIcon } from './components/icons';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [longTermMemory, setLongTermMemory] = useState<MemoryItem[]>([]);
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
  const [showInspector, setShowInspector] = useState(true); // Default to open based on mock
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false); // [NEW] Loading state for orchestrator
  const [inspectedPrompt, setInspectedPrompt] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkOllamaStatus = useCallback(async () => {
    setOllamaStatus('checking');
    const isOnline = await checkStatus();
    setOllamaStatus(isOnline ? 'online' : 'offline');
  }, []);

  // Fetch models and summarizers on mount
  useEffect(() => {
    getModels().then(models => {
      if (models.length > 0) {
        setAvailableModels(models);
        setModel(models[0]);
      }
    });
  
    // Get Summarizer Status
    getSummarizerStatus().then(status => {
        setAvailableSummarizers(status.available);
        setMissingSummarizers(status.missing);
        if (status.available.length > 0) {
            setActiveSummarizer(status.available[0]); // Auto-select best
        }
    });
  }, []);

  useEffect(() => {
      checkOllamaStatus();
    
      // Load Memories (The "Important Notes")
      getMemories().then(mems => setLongTermMemory(mems));

      // Load chat history
      getHistory().then(history => {
          if (history.length > 0) setMessages(history as any); 
      });
  }, [checkOllamaStatus]);

  const handleSendMessage = async (input: string) => {
    if (!input.trim() || isLoading || isBuildingPrompt) return;

    // 1. Legacy Mode
    if (!showInspector) {
        await runInference(input, null);
        return;
    }

    // 2. Inspector Mode - START THE BUILD
    setIsBuildingPrompt(true);
    setPendingUserMessage(input);

    // [NEW] IMMEDIATE VISUAL SKELETON
    // This matches your request: "Populate right away with the template"
    setInspectedPrompt(`=== SYSTEM ===
  ${systemPrompt}

  === IDENTITY ===
  User: (Loading Profile...)
  Workspace: LocalMIND

  === PREVIOUS SESSION CONTEXT ===
  (Querying Session Manager...)

  === LONG-TERM MEMORY (RAG) ===
  (Querying Vector Database...)

  === RECENT HISTORY ===
  (Fetching SQLite Logs...)

  === CURRENT MESSAGE ===
  User: ${input}

  Assistant:`);
  };
  const runInference = async (originalInput: string, overriddenPrompt: string | null) => {
    setIsLoading(true);
    // UI Updates
    if (!messages.find(m => m.content === originalInput)) {
         const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: originalInput };
         setMessages(prev => [...prev, userMessage]);
    } 
           
    abortControllerRef.current = new AbortController(); 
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);
    
    try {
        let data;
        if (overriddenPrompt) {
             // Use new Inference Endpoint (Inspector Flow)
             data = await inferWithPrompt(overriddenPrompt, model, originalInput, activeSummarizer);
        } else {
             // Use Standard Endpoint (Direct Flow)
             data = await sendChat(model, originalInput, systemPrompt, true, activeSummarizer);
        }
        
        setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId ? { ...msg, content: data.response } : msg
        ));

        if (data.new_memory) {
            setProposedFacts(prev => [...prev, data.new_memory]);
        }
    } catch (error) {
         setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId ? { ...msg, content: 'Error during inference.' } : msg
        ));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      // We do NOT close the inspector automatically in persistent mode
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
  // Updating existing
  await handleUpdateMemory(id, content);
  } else {
  // Creating new
  const newMem = await addMemory(content);
  if (newMem) {
  setLongTermMemory(prev => [newMem, ...prev]);
  // Remove from proposed if it was there
  if (id) setProposedFacts(prev => prev.filter(p => p.id !== id));
  }
  }
  setEditingMemory(null); // Close modal
  };
  
  const handleSaveToMemory = (content: string) => {
    if (longTermMemory.some(item => item.content === content)) return;
    const newMemoryItem: MemoryItem = { id: Date.now().toString(), content };
    setLongTermMemory(prev => [newMemoryItem, ...prev]);
  };
  
  const handleDeleteFromMemory = (id: string) => {
    setLongTermMemory(prev => prev.filter(item => item.id !== id));
  };
  
  const handleUpdateMemory = async (id: string, newContent: string) => {
      const success = await updateMemory(id, newContent);
      if (success) {
          setLongTermMemory(prev => prev.map(item => 
              item.id === id ? { ...item, content: newContent } : item
          ));
      }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const getStatusIndicator = () => {
    switch (ollamaStatus) {
      case 'online':
        return <div className="flex items-center gap-2 text-green-400"><PowerIcon className="w-4 h-4" /><span>System Online</span></div>;
      case 'offline':
        return <div className="flex items-center gap-2 text-red-400"><PowerOffIcon className="w-4 h-4" /><span>System Offline</span></div>;
      case 'checking':
        return <div className="flex items-center gap-2 text-yellow-400"><CircleDotIcon className="w-4 h-4 animate-ping" /><span>Checking...</span></div>;
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 font-sans p-2 overflow-hidden">
      {/* GRID LAYOUT 
        Matches HTML mock: 260px | 1fr | 280px 
        */}
    {/* Add `min-h-0` so the grid and its children can shrink properly without
       overflowing. Without this Tailwind utility the flex children (such as
       the chat area) may grow beyond the viewport and cover other panels. */}
    <div className="grid grid-cols-[260px_1fr_280px] gap-2 h-full min-h-0">
        
      {/* --- LEFT COLUMN: MEMORY PANEL --- */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
      <MemoryPanel
      memoryItems={longTermMemory}
      proposedItems={proposedFacts}
      onDelete={handleDeleteFromMemory}
      onClear={() => setLongTermMemory([])}
        onEdit={(item) => setEditingMemory(item)}
          onCreate={() => setEditingMemory({ id: 'temp_manual_create', content: '' })}
            />
                </div>
                    
                    {/* --- CENTER COLUMN: SYSTEM + CHAT --- */}
                        {/* Allow the middle column to shrink vertically by adding `min-h-0`.  This fixes
                           an issue where the chat panel would overlap the message input area. */}
                        <div className="flex flex-col gap-2 min-w-0 min-h-0">
                        
                    {/* Top: System Prompt Control */}
                <div className="h-[120px] bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex flex-col gap-2 shadow-sm overflow-hidden"> 
               <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                    <BrainCircuitIcon className="w-4 h-4" />
                    System Instruction
                        </span>
                        {/* Model Selector Tucked Here */}
                            <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                        className="px-2 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded focus:outline-none text-gray-300"
                        >
                            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                            </div>
                        <div className="flex-1 min-h-0 overflow-y-auto"> 
                        <SystemPromptControl
                    currentPrompt={systemPrompt}
            onPromptChange={setSystemPrompt}
                    />
                    </div>
                        </div>
                        
                            {/* Bottom: Chat Window */}
                            {/* Chat container now sets `min-h-0` to allow the message list to shrink and
                               leaves room for the input box.  Without this the scroll area could
                               overflow and sit on top of the input. */}
                            <div className="flex-1 bg-gray-800/30 border border-gray-700 rounded-lg flex flex-col overflow-hidden relative min-h-0">
                            <div className="flex-1 overflow-y-auto relative min-h-0">
                        <ChatPanel messages={messages} onSaveToMemory={handleSaveToMemory} />
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
        
            {/* --- RIGHT COLUMN: INSPECTOR --- */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
                <PromptInspector
                promptText={inspectedPrompt} 
                    onPromptChange={setInspectedPrompt} 
                    onCancel={() => setShowInspector(false)} 
                    onRun={() => runInference(pendingUserMessage, inspectedPrompt)} 
                    model={model}
                isBuilding={isBuildingPrompt}
                />
                </div>
            
                    </div>
            
            {/* Refinery Modal (Overlay) */}
                {editingMemory && (
                    <RefineryModal 
                        initialContent={editingMemory.content}
                        memoryId={editingMemory.id.startsWith('temp_') ? undefined : editingMemory.id}
                    model={model}
                onClose={() => setEditingMemory(null)}
                    onSave={handleRefinerySave}
                />
                )}
                    </div>
                        );
                        };

export default App;



