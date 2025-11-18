import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, MemoryItem, OllamaStatus } from './types';
// FIX: Added getHistory to the import list
import { checkStatus, sendChat, getModels, getHistory } from './services/ollamaService';
import MemoryPanel from './components/MemoryPanel';
import ChatPanel from './components/ChatPanel';
import MessageInput from './components/MessageInput';
import { BrainCircuitIcon, CircleDotIcon, PowerIcon, PowerOffIcon } from './components/icons';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [longTermMemory, setLongTermMemory] = useState<MemoryItem[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('llama3');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');

  const SYSTEM_PROMPTS = [
    { label: 'Helpful Assistant', value: 'You are a helpful assistant.' },
    { label: 'Code Expert', value: 'You are an expert programmer. Provide code snippets and technical explanations.' },
    { label: 'Concise Oracle', value: 'Answer as concisely as possible. Do not offer extra explanation unless asked.' },
    { label: 'Storyteller', value: 'You are a creative storyteller. Embellish your answers with narrative flair.' }
  ];

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkOllamaStatus = useCallback(async () => {
    setOllamaStatus('checking');
    const isOnline = await checkStatus();
    setOllamaStatus(isOnline ? 'online' : 'offline');
  }, []);

  // Fetch models on mount
  useEffect(() => {
    getModels().then(models => {
      if (models.length > 0) {
        setAvailableModels(models);
        setModel(models[0]);
      }
    });
  }, []);

  useEffect(() => {
    checkOllamaStatus();
    // Load history on startup
    getHistory().then(history => {
        if (history.length > 0) {
            setMessages(history as any); 
        }
    });
  }, [checkOllamaStatus]);
  
  const handleSendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);

    abortControllerRef.current = new AbortController();
    const assistantMessageId = (Date.now() + 1).toString();
    
    setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

    try {
      const response = await sendChat(model, input, systemPrompt);
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: response } 
          : msg
      ));
    } catch (error) {
         setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: 'Sorry, I encountered an error. Please ensure the backend server is running.' } 
            : msg
        ));
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
  
  const handleSaveToMemory = (content: string) => {
    if (longTermMemory.some(item => item.content === content)) return;
    const newMemoryItem: MemoryItem = { id: Date.now().toString(), content };
    setLongTermMemory(prev => [newMemoryItem, ...prev]);
  };
  
  const handleDeleteFromMemory = (id: string) => {
    setLongTermMemory(prev => prev.filter(item => item.id !== id));
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
    <div className="flex h-screen font-sans bg-gray-900 text-gray-100">
      <MemoryPanel 
        memoryItems={longTermMemory} 
        onDelete={handleDeleteFromMemory}
        onClear={() => setLongTermMemory([])}
      />
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <BrainCircuitIcon className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-xl font-bold">LocalMind</h1>
              <p className="text-xs text-gray-400">Your local RAG-powered chat</p>
            </div>
          </div>
          <div className='flex items-center gap-4'>
            <select 
              value={model} 
              onChange={e => setModel(e.target.value)}
              className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableModels.length === 0 ? (
                 <option value="loading">Loading models...</option>
              ) : (
                availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))
              )}
            </select>
            
            <select 
              value={systemPrompt} 
              onChange={e => setSystemPrompt(e.target.value)}
              className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px] truncate"
            >
              {SYSTEM_PROMPTS.map(p => (
                <option key={p.label} value={p.value}>{p.label}</option>
              ))}
            </select>

            {getStatusIndicator()}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <ChatPanel messages={messages} onSaveToMemory={handleSaveToMemory} />
        </main>

        <footer className="p-4 border-t border-gray-700 bg-gray-800/50">
          <MessageInput 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading}
            onStop={handleStopGeneration}
            useLongTermMemory={true}
            onToggleMemory={() => {}}
            onClearChat={handleClearChat}
          />
        </footer>
      </div>
    </div>
  );
};

export default App;