import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, MemoryItem, OllamaStatus } from './types';
import { checkStatus, sendChat, getModels, getHistory, getMemories, getSummarizerStatus, updateMemory, buildPrompt, inferWithPrompt } from './services/ollamaService';
import MemoryPanel from './components/MemoryPanel';
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

  // Inspector State
  const [showInspector, setShowInspector] = useState(false); // Toggles the 3rd column
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

    // 1. If Inspector is CLOSED, just run (Legacy mode)
    if (!showInspector) {
        await runInference(input, null);
        return;
    }

    // 2. If Inspector is OPEN, start the "Orchestration Build"
    setIsBuildingPrompt(true);
    setPendingUserMessage(input);
    
    // UI Feedback: Show that we are working
    setInspectedPrompt(`=== ORCHESTRATION IN PROGRESS ===\n\n> Querying Vector Database (RAG)...\n> Fetching Session History...\n> Compiling Memory Context...\n> Applying System Templates...\n\n(Please Wait)`);

    try {
        // Fetch the fully constructed prompt from the backend
        const buildResult = await buildPrompt(model, input, systemPrompt, true);
        setInspectedPrompt(buildResult.final_prompt);
    } catch(e) {
        setInspectedPrompt(`Error building prompt: ${String(e)}`);
    } finally {
        setIsBuildingPrompt(false); // Unlock the UI
    }
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
            setLongTermMemory(prev => [data.new_memory, ...prev]);
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
    <div className="flex h-screen font-sans bg-gray-900 text-gray-100 overflow-hidden">
      <MemoryPanel 
        memoryItems={longTermMemory} 
        onDelete={handleDeleteFromMemory}
        onUpdate={handleUpdateMemory}
        onClear={() => setLongTermMemory([])}
      />
      
      {/* Main Content Column */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-gray-700">
        <header className="flex flex-col p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm gap-4">
          {/* Top Row: Logo, Indicators, Main Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BrainCircuitIcon className="w-8 h-8 text-indigo-400" />
                    <div>
                        <h1 className="text-xl font-bold">LocalMind</h1>
                        <p className="text-xs text-gray-400">Session Agent</p>
                    </div>
                </div> 
               
                <div className='flex items-center gap-4'>
                    {/* Main Chat Model */}
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Chat Model</span>
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                        {availableModels.length === 0 ? (
                            <option value="loading">Loading...</option>
                        ) : (
                            availableModels.map(m => <option key={m} value={m}>{m}</option>)
                        )} 
                        </select>
                    </div>
            
                    {/* Summarizer Selector */}
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Summarizer</span>
                        <select
                            value={activeSummarizer}
                            onChange={e => setActiveSummarizer(e.target.value)}
                            className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {availableSummarizers.length === 0 ? (
                                <option value="none">No Preferred Models!</option> 
                            ) : (
                                availableSummarizers.map(m => <option key={m} value={m}>{m}</option>)
                            )}
                        </select>
                    </div>
          
                    {getStatusIndicator()}
                </div>
            </div>
        
            {/* Inspector Toggle */}
            <div className="flex justify-end pr-1">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none hover:text-white transition-colors">
                <input 
                    type="checkbox" 
                    checked={showInspector} 
                    onChange={e => setShowInspector(e.target.checked)} 
                    className="accent-indigo-500"
                />
                Enable Prompt Inspector
                </label>
            </div>
                    
            {/* Middle Row: System Prompt */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <SystemPromptControl 
                        currentPrompt={systemPrompt}
                        onPromptChange={setSystemPrompt}
                    />
                </div>
                    
                {/* Missing Models Warning */}
                {missingSummarizers.length > 0 && (
                    <div className="w-1/3 text-[10px] text-orange-400 bg-orange-900/20 p-2 rounded border border-orange-900/50 overflow-y-auto h-16">
                        <strong>Missing Preferred Models:</strong>
                        <ul className="list-disc list-inside mt-1 text-orange-300/80">
                            {missingSummarizers.map(m => (
                                <li key={m}>ollama pull {m}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <ChatPanel messages={messages} onSaveToMemory={handleSaveToMemory} />
        </main>

        <footer className="p-4 border-t border-gray-700 bg-gray-800/50">
          <MessageInput 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading || isBuildingPrompt}
            onStop={handleStopGeneration}
            onClearChat={handleClearChat}
          />
        </footer>
      </div>

      {/* Persistent Inspector Column */}
      {showInspector && ( 
        <PromptInspector 
            promptText={inspectedPrompt}
            onPromptChange={setInspectedPrompt}
            onCancel={() => setShowInspector(false)}
            onRun={() => runInference(pendingUserMessage, inspectedPrompt)}
            model={model}
            isBuilding={isBuildingPrompt}
        />
      )}
    </div>
  );
};

export default App;